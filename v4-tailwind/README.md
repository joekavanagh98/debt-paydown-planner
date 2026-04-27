# v4 / v8 - Tailwind CSS Frontend

v4 stood up the Tailwind UI, charts, and the avalanche/snowball
comparison. v8 phase 1 wired this frontend up to the v5/v6/v7
backend (auth, per-user debts, MongoDB persistence). Subsequent v8
phases add deploy, AI debt extraction, and the staff view.

## What this is

The v3 TypeScript app with real visual design, a second paydown
strategy, charts, and a Vercel deploy config. As of v8 phase 1
debts persist to the v5-backend instead of localStorage, and the
app gates behind login.

v4 is where the app went from "logic works" to "ready to ship":
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

Plus what v8 phase 1 adds:

- **Sign in / register** screen as a gate above the app
- **In-memory token storage** (no localStorage / sessionStorage for the
  JWT, by design — XSS posture)
- **Backend-backed debts**: GET/POST/DELETE `/debts` against
  v5-backend, scoped per user via the JWT
- **Session-expired handling**: a 401 from any debts call clears
  auth state and shows a "Your session expired" message on the
  login screen
- **Sign-out button** in the header

## What does NOT yet ship

These features still belong to later v8 phases:

- Production deployment of frontend + backend (v8 phase 2)
- AI-assisted debt extraction from PDF statements (v8 phase 3)
- Staff dashboard (v8 phase 4)
- Refresh-token flow (deferred to v9+; the in-memory token strategy
  trades refresh-survival for XSS safety, see NOTES.md)
- Server-side user preferences (budget currently uses localStorage
  per-user-id as a stopgap)

## How to run

You need the v5-backend running on `http://localhost:3001`. See
`v5-backend/README.md` for the setup (Atlas connection string,
JWT secret, etc.).

```
cd v4-tailwind
cp .env.example .env.local   # VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).
The first screen is sign-in. Click Register to create an account.

Override the backend URL via the `VITE_API_URL` env var in
`.env.local`. Vite only exposes env vars prefixed with `VITE_` to
client code.

## How to test

```
npm test            # one-shot, CI-style
npm run test:watch  # interactive Vitest UI
```

The test suite covers both strategies and the minimum-payment
calculation. 16 tests in `src/utils/paydownCalculator.test.ts`.

## How to deploy

Vercel reads the framework preset and the `vercel.json` SPA rewrite
config in this folder automatically. The two project-specific
requirements (Root Directory must be set to `v4-tailwind`,
`VITE_API_URL` must be set to the backend's deploy URL) and the
"Vercel env-var changes don't auto-redeploy" gotcha are documented
in the unified deploy guide:
[docs/DEPLOY.md](../docs/DEPLOY.md).

## Files

```
v4-tailwind/
  index.html                   - Vite entry point
  package.json                 - deps + scripts
  vite.config.ts               - Vite + Tailwind + React plugins
  tsconfig.app.json            - strict compiler options for src/
  eslint.config.js             - typescript-eslint rules
  vercel.json                  - SPA rewrites for deploy
  .env.example                 - VITE_API_URL (v8)
  src/
    main.tsx                   - root render, wraps App in AuthProvider (v8)
    index.css                  - one-liner: @import "tailwindcss"
    App.tsx                    - gate + SignedInApp (key={user.id}) (v8)
    types/
      index.ts                 - Debt, NewDebt, Strategy, PaydownResult,
                                 plus User and LoginResponse (v8)
    lib/
      api.ts                   - fetch wrapper, in-memory token,
                                 401 handler hook (v8)
      debtsApi.ts              - typed wrappers for /debts (v8)
    features/
      auth/                    - (v8)
        AuthForm.tsx           - login/register UI, mode-aware
        AuthGate.tsx           - signed-out screen, error mapping
        AuthProvider.tsx       - state + actions, 401 wiring
        authContext.ts         - Context + useAuth hook (split for HMR)
      debts/
        BudgetInput.tsx        - monthly budget control
        DebtForm.tsx           - add-a-debt form, async submit (v8)
        DebtList.tsx           - list of debts
        DebtRow.tsx            - one row, with delete button
        Summary.tsx            - totals cards
        StrategyComparison.tsx - two strategies side-by-side + charts
        BalanceChart.tsx       - per-debt balance over time (Recharts)
    utils/
      paydownCalculator.ts     - runPaydown helper + avalanche/snowball
      paydownCalculator.test.ts
      formatMoney.ts           - currency formatting
      storage.ts               - generic localStorage wrapper (budget only after v8)
```
