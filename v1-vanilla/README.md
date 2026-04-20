# v1 - Vanilla JS

## What this is

A single-page debt paydown planner that runs entirely in the browser.
No build step, no framework, no server. Just HTML, CSS, and JavaScript.

The point of v1 is to get the core product working before adding any
tooling or architecture. If the math is wrong here, React won't fix it.

## What v1 does

- Add a debt: name, balance, interest rate (APR), minimum monthly payment
- Edit a debt: change any field on an existing entry
- Delete a debt: remove a debt from the list
- Persist across page refreshes: data saved to localStorage
- Avalanche paydown plan: given a total monthly budget, shows payoff order
  (highest interest rate first), monthly payment per debt, and months to
  payoff

The plan recalculates whenever debts or the budget change.

## What v1 does NOT include

These features belong in later versions and are intentionally left out:

- Snowball strategy (lowest balance first) - coming in v4
- Charts or visualizations - coming in v4
- User accounts or login - coming in v7
- Backend or database storage - coming in v5
- TypeScript - coming in v3
- React component architecture - coming in v2
- Responsive/mobile layout - coming in v4

## How to run

No install needed. Open `index.html` directly in a browser:

```
open v1-vanilla/index.html
```

Or double-click index.html in Finder. No npm, no build step.

## Files

```
v1-vanilla/
  index.html   - markup and layout
  style.css    - styles (plain CSS, no framework)
  app.js       - all application logic
  NOTES.md     - learning notes, not part of the product
```
