import type { Debt, NewDebt } from "../types/index.js";

// Module-level Map keyed by debt id. v6 swaps this for Mongoose calls;
// the function signatures here stay the same so the controller layer
// doesn't have to change. Map (not array) for O(1) lookup by id, and
// because insertion order is preserved on iteration, listDebts returns
// debts in the order they were created without an explicit sort.
const store = new Map<string, Debt>();

export function listDebts(): Debt[] {
  return Array.from(store.values());
}

export function createDebt(input: NewDebt): Debt {
  const debt: Debt = { id: crypto.randomUUID(), ...input };
  store.set(debt.id, debt);
  return debt;
}

export function deleteDebtById(id: string): boolean {
  return store.delete(id);
}
