# v3 - TypeScript

## What this is

The v2 React app rebuilt with strict TypeScript throughout. Same
product, same math, same component architecture. What changes is that
every prop, every piece of state, every function signature, and the
calculator's result shape are now type-checked at build time.

The point of v3 is to get comfortable with the TypeScript type system
on a real app — discriminated unions, generics, utility types, event
typing in React — and to tighten the compiler to the level where
careless mistakes stop compiling rather than stop at runtime.

## What v3 does

Everything v2 did:

- Add a debt: name, balance, interest rate (APR), minimum monthly payment
- Delete a debt: remove a debt from the list
- Persist across page refreshes: data saved to localStorage
- Avalanche paydown plan: given a total monthly budget, shows payoff
  order (highest interest rate first), monthly payment per debt, and
  months to payoff

Plus the structural changes that define v3:

- Strict TypeScript: `strict`, `noImplicitReturns`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Shared types module at `src/types/` — single source of truth for
  `Debt`, `NewDebt`, `ScheduleEntry`, `ScheduleMonth`, `PaydownResult`
- Discriminated union on `PaydownResult` so consumers must narrow by
  checking the `feasible` tag before reading branch-specific fields
- Named `Props` interfaces per component, typed React event handlers
  (`ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`)
- Explicit generics on `useState` and on the `loadJSON` helper so
  inference never widens to `never[]`

## What v3 does NOT include

These features still belong to later versions:

- Tailwind CSS, charts, strategy comparison, responsive layout - v4
- Backend or database storage - v5
- Runtime validation of persisted data (Zod) - v6
- User accounts or login - v7
- Snowball strategy (lowest balance first) - v4

## How to run

```
cd v3-typescript
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Files

```
v3-typescript/
  index.html              - Vite entry point
  package.json            - dependencies and npm scripts
  vite.config.ts          - Vite configuration
  tsconfig.json           - TS project-references root
  tsconfig.app.json       - strict compiler options for src/
  tsconfig.node.json      - config for the Vite config itself
  eslint.config.js        - typescript-eslint rules
  src/
    main.tsx              - React root render
    App.tsx               - top-level state, handlers, layout
    types/
      index.ts            - shared domain types
    features/
      debts/              - debt form, list, row, summary, schedule
    utils/
      paydownCalculator.ts - pure avalanche math
      formatMoney.ts       - currency formatting
      storage.ts           - generic localStorage wrapper
```
