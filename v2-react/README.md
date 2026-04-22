# v2 - React

## What this is

The v1 debt paydown planner rebuilt as a React app with a feature-based
component architecture. Same product, same math, same localStorage
persistence. What changes is how the code is organized.

The point of v2 is to get comfortable with React fundamentals (JSX,
state, props, hooks, effects) and to lay out a component structure that
will hold up as more features arrive in v3 and beyond. The paydown
calculator is ported over from v1 unchanged.

## What v2 does

Everything v1 did:

- Add a debt: name, balance, interest rate (APR), minimum monthly payment
- Edit a debt: change any field on an existing entry
- Delete a debt: remove a debt from the list
- Persist across page refreshes: data saved to localStorage
- Avalanche paydown plan: given a total monthly budget, shows payoff
  order (highest interest rate first), monthly payment per debt, and
  months to payoff

Plus the structural changes that define v2:

- React + Vite dev server with hot module reloading
- Feature-based component folders (features/debts, components/common)
  so related UI lives together
- Pure paydown math in src/utils/ so it can be imported and tested
  independently of any component
- Prettier as a devDependency with the config matching v1 style

## What v2 does NOT include

These features still belong to later versions:

- TypeScript - coming in v3
- Tailwind CSS, charts, strategy comparison, responsive layout - v4
- Backend or database storage - v5
- User accounts or login - v7
- Snowball strategy (lowest balance first) - v4

## How to run

```
cd v2-react
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Files

```
v2-react/
  index.html              - Vite entry point
  package.json            - dependencies and npm scripts
  vite.config.js          - Vite configuration
  .prettierrc             - formatting rules
  src/
    main.jsx              - React root render
    App.jsx               - top-level layout
    components/
      common/             - shared UI (buttons, inputs, etc.)
    features/
      debts/              - debt form, list, and row components
    utils/
      paydownCalculator.js - pure math, ported from v1
```
