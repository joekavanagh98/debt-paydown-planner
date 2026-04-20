"use strict";

const MAX_MONTHS = 600;
const MIN_PAYMENT_FLOOR = 25;
const STORAGE_KEY_DEBTS = "planner:debts";
const STORAGE_KEY_BUDGET = "planner:budget";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const toCents = (dollars) => Math.round(dollars * 100);
const toDollars = (cents) => cents / 100;

// Minimal HTML escaper for user-controlled strings inserted into innerHTML.
// Covers the attack surface for HTML text content and quoted attributes.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// localStorage can throw in private mode or when quota is exceeded; swallow
// failures so the app still runs in-memory.
const storage = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `debt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns the monthly minimum payment for a debt. If the debt already
 * has an explicit minPayment, that wins. Otherwise, fall back to the
 * credit-card industry rule: interest + 1% of principal, floored at $25.
 */
function calculateMinimumPayment(debt) {
  if (debt.minPayment && debt.minPayment > 0) {
    return debt.minPayment;
  }
  const monthlyRate = debt.rate / 100 / 12;
  const interest = debt.balance * monthlyRate;
  const onePercentPrincipal = debt.balance * 0.01;
  const computed = interest + onePercentPrincipal;
  return Math.max(MIN_PAYMENT_FLOOR, Math.round(computed * 100) / 100);
}

/**
 * Avalanche paydown: pay minimums everywhere, then throw every spare
 * dollar at the highest-rate debt until it's gone, then roll to the
 * next-highest, and so on.
 *
 * Returns either:
 *   { feasible: true, schedule: Month[] }
 *   { feasible: false, reason, ... }
 * where Month = Entry[] and Entry = { name, balance, interestThisMonth, principalPaid, targeted }.
 * All dollar values in the output are in dollars (not cents).
 */
function avalanchePaydown(debts, monthlyBudget) {
  // Work in integer cents internally so 600 months of compounding can't
  // accumulate floating-point drift.
  const working = debts
    .map((d) => ({
      name: d.name,
      rate: d.rate,
      balance: toCents(d.balance),
      minPayment: toCents(calculateMinimumPayment(d)),
    }))
    .sort((a, b) => b.rate - a.rate);

  const budgetCents = toCents(monthlyBudget);
  const totalMinimums = working.reduce((sum, d) => sum + d.minPayment, 0);

  if (budgetCents < totalMinimums) {
    return {
      feasible: false,
      reason: "budgetBelowMinimums",
      requiredMinimum: toDollars(totalMinimums),
      shortfall: toDollars(totalMinimums - budgetCents),
    };
  }

  const schedule = [];

  while (working.some((d) => d.balance > 0)) {
    if (schedule.length >= MAX_MONTHS) {
      return { feasible: false, reason: "exceeds50Years" };
    }

    let extra = budgetCents - totalMinimums;
    const entries = working.map((d) => ({
      debt: d,
      interest: 0,
      principalPaid: 0,
      targeted: false,
    }));

    // Pass 1: accrue interest and apply the minimum payment on each
    // still-active debt. Any unspent minimum (debt already paid off,
    // or balance smaller than the minimum) rolls into the extra pool
    // so it cascades to the next avalanche target in the same month.
    for (const e of entries) {
      const d = e.debt;
      if (d.balance <= 0) {
        extra += d.minPayment;
        continue;
      }
      const monthlyRate = d.rate / 100 / 12;
      e.interest = Math.round(d.balance * monthlyRate);
      const payoffAmount = d.balance + e.interest;
      const minPay = Math.min(d.minPayment, payoffAmount);
      d.balance = d.balance + e.interest - minPay;
      e.principalPaid = minPay - e.interest;
      extra += d.minPayment - minPay;
    }

    // Pass 2: cascade extra payment down the rate-sorted list.
    for (const e of entries) {
      const d = e.debt;
      if (d.balance <= 0) continue;
      if (extra <= 0) break;
      const applied = Math.min(extra, d.balance);
      d.balance -= applied;
      e.principalPaid += applied;
      e.targeted = true;
      extra -= applied;
    }

    schedule.push(
      entries.map((e) => ({
        name: e.debt.name,
        balance: toDollars(e.debt.balance),
        interestThisMonth: toDollars(e.interest),
        principalPaid: toDollars(e.principalPaid),
        targeted: e.targeted,
      })),
    );
  }

  return { feasible: true, schedule };
}

let debts = [];

const form = document.getElementById("debt-form");
const budgetInput = document.getElementById("budget-amount");
const listEl = document.getElementById("debt-list");
const listEmpty = document.getElementById("list-empty");
const summaryBalance = document.getElementById("summary-balance");
const summaryMinimums = document.getElementById("summary-minimums");
const summaryCount = document.getElementById("summary-count");
const summaryMonths = document.getElementById("summary-months");
const summaryPayoffCard = document.getElementById("summary-payoff-card");
const scheduleSection = document.getElementById("schedule-section");
const scheduleOutput = document.getElementById("schedule-output");

function sumOfMinimums() {
  return debts.reduce((sum, d) => sum + calculateMinimumPayment(d), 0);
}

// If the user has typed a positive budget, honor it. Otherwise fall back to
// the sum of minimums so the app shows a useful plan immediately.
function effectiveBudget() {
  const typed = parseFloat(budgetInput.value);
  if (Number.isFinite(typed) && typed > 0) return typed;
  return sumOfMinimums();
}

function renderSummary() {
  const totalBalance = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimums = sumOfMinimums();
  summaryBalance.textContent = currency.format(totalBalance);
  summaryMinimums.textContent = currency.format(totalMinimums);
  summaryCount.textContent = String(debts.length);
}

function renderList() {
  if (debts.length === 0) {
    listEl.innerHTML = "";
    listEmpty.classList.remove("hidden");
    return;
  }
  listEmpty.classList.add("hidden");
  listEl.innerHTML = debts
    .map(
      (d) => `
        <li class="debt-item">
          <div class="debt-info">
            <span class="debt-name">${escapeHtml(d.name)}</span>
            <span class="debt-meta">${currency.format(d.balance)} · ${escapeHtml(d.rate)}% APR · min ${currency.format(calculateMinimumPayment(d))}</span>
          </div>
          <div class="debt-actions">
            <button type="button" class="btn-delete" data-action="delete" data-id="${escapeHtml(d.id)}">Delete</button>
          </div>
        </li>`,
    )
    .join("");
}

function renderSchedule() {
  const budget = effectiveBudget();

  if (debts.length === 0 || budget <= 0) {
    scheduleSection.classList.add("hidden");
    summaryPayoffCard.classList.add("hidden");
    return;
  }

  const result = avalanchePaydown(debts, budget);
  scheduleSection.classList.remove("hidden");

  if (!result.feasible) {
    summaryPayoffCard.classList.add("hidden");
    if (result.reason === "budgetBelowMinimums") {
      scheduleOutput.innerHTML = `<p>Budget too low. Minimum payments total ${currency.format(result.requiredMinimum)}. Increase budget by ${currency.format(result.shortfall)} to continue.</p>`;
    } else if (result.reason === "exceeds50Years") {
      scheduleOutput.innerHTML = `<p>This plan would take more than 50 years. Increase the budget or check the debt inputs.</p>`;
    } else {
      scheduleOutput.innerHTML = `<p>Unable to produce a schedule.</p>`;
    }
    return;
  }

  const months = result.schedule.length;
  summaryMonths.textContent = String(months);
  summaryPayoffCard.classList.remove("hidden");

  const perDebt = debts.map((d) => {
    let paidOffMonth = null;
    let totalInterest = 0;
    for (let m = 0; m < result.schedule.length; m++) {
      const entry = result.schedule[m].find((e) => e.name === d.name);
      if (!entry) continue;
      totalInterest += entry.interestThisMonth;
      if (paidOffMonth === null && entry.balance === 0) {
        paidOffMonth = m + 1;
      }
    }
    return { name: d.name, paidOffMonth, totalInterest };
  });

  const totalInterest = perDebt.reduce((s, p) => s + p.totalInterest, 0);

  scheduleOutput.innerHTML = `
    <p>Debt-free in <strong>${months}</strong> months. Total interest: <strong>${currency.format(totalInterest)}</strong>.</p>
    <table>
      <thead>
        <tr><th>Debt</th><th>Paid off</th><th>Total interest</th></tr>
      </thead>
      <tbody>
        ${perDebt
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.paidOffMonth ? `Month ${p.paidOffMonth}` : "--"}</td>
            <td>${currency.format(p.totalInterest)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderAll() {
  // Dynamic placeholder so the budget input hints at the sensible default.
  const hint = sumOfMinimums();
  budgetInput.placeholder = hint > 0 ? `Auto: ${currency.format(hint)}` : "0.00";
  renderSummary();
  renderList();
  renderSchedule();
}

function save() {
  storage.write(STORAGE_KEY_DEBTS, JSON.stringify(debts));
  storage.write(STORAGE_KEY_BUDGET, budgetInput.value);
}

function load() {
  const savedDebts = storage.read(STORAGE_KEY_DEBTS);
  if (savedDebts) {
    try {
      const parsed = JSON.parse(savedDebts);
      if (Array.isArray(parsed)) debts = parsed;
    } catch {
      storage.remove(STORAGE_KEY_DEBTS);
    }
  }
  const savedBudget = storage.read(STORAGE_KEY_BUDGET);
  if (savedBudget !== null) budgetInput.value = savedBudget;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const { name, balance, rate, minPayment } = {
    name: String(data.get("name") || "").trim(),
    balance: parseFloat(data.get("balance")),
    rate: parseFloat(data.get("rate")),
    minPayment: parseFloat(data.get("minPayment")),
  };

  if (!name) return;
  if (!Number.isFinite(balance) || balance <= 0) return;
  if (!Number.isFinite(rate) || rate < 0) return;
  if (!Number.isFinite(minPayment) || minPayment < 0) return;

  const debt = { id: generateId(), name, balance, rate, minPayment };
  debts = [...debts, debt];
  form.reset();
  renderAll();
  save();
});

listEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='delete']");
  if (!button) return;
  const id = button.dataset.id;
  debts = debts.filter((d) => d.id !== id);
  renderAll();
  save();
});

budgetInput.addEventListener("input", () => {
  renderAll();
  save();
});

load();
renderAll();
