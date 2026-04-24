# v4 - Tailwind CSS

## What this is

The v3 TypeScript app with real visual design, a second paydown
strategy, charts, and a Vercel deploy config. Same typed core, same
component structure, same calculator math. The difference is that
v4 looks like a product a person would use.

v4 is where the app goes from "logic works" to "ready to ship":
Tailwind for styling, responsive breakpoints for mobile, Recharts
for the charts, Vercel for the URL.

## What v4 does

Everything v3 did:

- Add a debt: name, balance, interest rate (APR), minimum monthly payment
- Delete a debt: remove a debt from the list
- Persist across page refreshes: data saved to localStorage
- Avalanche paydown plan: payoff order by highest rate first

Plus the features that define v4:

- **Tailwind v4 CSS-first styling** across every component. Mobile-first
  with responsive breakpoints: single column on mobile, 3-column summary
  and 2-column form on tablet and up
- **Snowball strategy** (smallest balance first) alongside avalanche,
  sharing the same month-by-month loop internally
- **Side-by-side comparison** of both strategies with months-to-payoff,
  total interest paid, and a takeaway sentence describing the delta
- **Balance-over-time line charts** under each strategy, one line per
  debt, so the shape of the payoff is visible at a glance
- **Vercel deploy config** (`vercel.json` with SPA rewrites)

## What v4 does NOT include

These features still belong to later versions:

- Backend or database storage - v5
- Runtime validation of persisted data (Zod) - v6
- User accounts or login - v7
- AI-assisted debt extraction from statements - v8
- Staff dashboard - v8

## How to run

```
cd v4-tailwind
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## How to test

```
npm test            # one-shot, CI-style
npm run test:watch  # interactive Vitest UI
```

The test suite covers both strategies and the minimum-payment
calculation. 16 tests in `src/utils/paydownCalculator.test.ts`.

## How to deploy

Vercel picks up the config automatically once the project is imported.
One-time setup in the Vercel dashboard:

1. Import the GitHub repo as a new project
2. Set **Root Directory** to `v4-tailwind/`
3. Framework preset auto-detects as Vite. No further overrides needed.

The `vercel.json` in this folder handles SPA routing fallbacks. Build
command and output directory are inferred from the Vite framework
preset.

## Files

```
v4-tailwind/
  index.html                   - Vite entry point
  package.json                 - deps + scripts
  vite.config.ts               - Vite + Tailwind + React plugins
  tsconfig.app.json            - strict compiler options for src/
  eslint.config.js             - typescript-eslint rules
  vercel.json                  - SPA rewrites for deploy
  src/
    main.tsx                   - React root render, imports index.css
    index.css                  - one-liner: @import "tailwindcss"
    App.tsx                    - top-level state, handlers, layout
    types/
      index.ts                 - Debt, NewDebt, ScheduleEntry,
                                 PaydownResult, Strategy
    features/
      debts/
        BudgetInput.tsx        - monthly budget control
        DebtForm.tsx           - add-a-debt form (2-col grid on sm+)
        DebtList.tsx           - list of debts
        DebtRow.tsx            - one row, with delete button
        Summary.tsx            - totals cards
        StrategyComparison.tsx - two strategies side-by-side + charts
        BalanceChart.tsx       - per-debt balance over time (Recharts)
    utils/
      paydownCalculator.ts     - runPaydown helper + avalanche/snowball
      paydownCalculator.test.ts
      formatMoney.ts           - currency formatting
      storage.ts               - generic localStorage wrapper
```
