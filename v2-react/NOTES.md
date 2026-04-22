# v2-react Notes

## Project structure

### Vite scaffold

`npm create vite@latest v2-react -- --template react`. Working dev
server with hot reload in under a minute. Create React App is
deprecated. Vite is the default for new React projects.

### Feature-based folders

Components live under `src/features/debts/`. Grouping by feature
keeps files that change together close. Grouping by widget type
splits them. Only one feature exists right now, but starting with the
right structure means future versions don't have to refactor every
import path.

### Pure calculator ported unchanged

`utils/paydownCalculator.js` is v1's math, byte for byte. Writing it
as a pure function in v1 with no DOM access made the migration free.
Copy file, works.

### No router

Single page. React Router becomes useful when there are multiple
screens to switch between.

## React

### Lifting state to App

`debts` and `budget` live in `App.jsx`. The form, list, and schedule
get them as props and call back to App when they change. Single
source of truth at the top, props down, callbacks up.

### Controlled inputs with string state

Every input's `value` is a string in state, even the numeric fields.
A number-typed state breaks the input mid-typing because `1.` (period
with nothing after) round-trips through `Number()` as `1`. Strings
preserve the raw text. Parsing happens at the boundary in submit.

### `useMemo`

Caches a value between renders. The function only re-runs when
something in the dependency array changes by reference. Used in
`Schedule` for the avalanche calc, which can run hundreds of months.
Used in `Summary` too even though reducing 3-20 items is free, mostly
to practice the dependency-array discipline.

### Lazy initial state for load, `useEffect` for save

Loading via `useEffect` renders once with the empty default before
the saved data shows up, causing a flicker. Lazy initial state
(`useState(() => loadJSON(...))`) runs the loader once on mount,
before the first render. Saved data is in place from frame 1. Save
goes the other way: `useEffect([deps])` watches state and writes when
it changes.

### Functional updater in setters

`setDebts(prev => [...prev, newDebt])`. The non-functional form
captures `debts` from when the handler was defined and clobbers
queued updates if React batches them. Functional form always sees the
latest committed state.

### JSX escapes by default

JSX automatically escapes anything inside `{...}`. v1's `escapeHtml`
helper isn't needed. The way to break the escaping is
`dangerouslySetInnerHTML`, which is named to warn you.

### `crypto.randomUUID` direct

Vite targets modern browsers. v1's `Date.now() + Math.random()`
fallback isn't needed.

## Components

### `DebtForm` keeps draft state local

What the user is typing lives in the form's own `useState`. App only
sees the finished object on submit. Persistent data goes up,
in-progress UI state stays put.

### `BudgetInput` is its own component

Borderline overkill for one input, but matches the structure of
`DebtForm` and keeps `App.jsx` from accumulating inline JSX.

### `Schedule` returns null without inputs

No debts or no positive budget = render nothing. No "0 months to
debt-free" placeholder.

### Per-debt payoff month derived in `Schedule`

Walk the schedule once to find the first month each debt's balance
hits zero. Could expose it in the calculator's return shape, but
only one component needs it.

## Storage

### Generic `loadJSON` / `saveJSON`

Same wrapper pattern as v1, with JSON parse/stringify folded in. Two
functions that work for any value.

### Empty `catch` with a comment

ESLint's `no-empty` rule flags `catch {}` because empty blocks
usually mean unfinished code. Here the empty catch is intentional:
localStorage throws in Safari private mode and on quota exceeded, and
the right behavior is to fail silently and keep running in-memory.
The rule accepts blocks with a comment inside, which is the cleanest
fix for a single occurrence.

### Namespaced storage keys

`dpp.debts` and `dpp.budget`. localStorage is shared across the whole
origin, so a generic `debts` key could collide with anything else
running on `localhost`.

## Design decisions for v2

### Folder structure committed up front

Started with `features/debts/` even though one folder is silly at
this size. The alternative was a flat `components/` with a refactor
later. The refactor would touch every import path. Cheaper to commit
when there's nothing to migrate.

### No CSS

Default Vite stylesheet, barely touched. v2 is about React mechanics.
Visuals are v4's job under Tailwind.

### No prop validation

No PropTypes. v3 brings TypeScript and solves the same problem
properly.

### Schedule shows summary numbers, not a per-month table

Months to debt-free, total interest, payoff month per debt. Enough to
confirm the math works.

## What could be better

### Form validation is silent

`DebtForm.handleSubmit` returns early on bad input with no message,
no field highlight. HTML5 `required` and `min` catch most cases at
the browser level, but a determined user can hit the silent path.
Real per-field error feedback needed.

### Same problem in `BudgetInput`

Negatives, zero, NaN go straight into state. `Schedule` checks
`Number.isFinite` and `> 0` before computing so nothing breaks, but
no UI feedback that the input is unusable.

### No tests

v1 had `tests.html` for the calculator. v2 ported the calculator but
not the tests. Components have no coverage at all.

### `useMemo` on `Summary` doesn't earn its keep

Reducing 3-20 items every render is free. The memo wrapper costs
more than the work it caches.

### Save effect runs on first render

The save `useEffect` fires once on mount, writing the just-loaded
value back unchanged. One wasted localStorage write per state slice
per page load. Skippable with a `useRef` flag, not worth the noise.

### No error boundary

If a component throws during render, the whole tree unmounts and the
screen goes blank. React error boundaries catch the throw and show a
fallback.

### Empty state is a placeholder

`DebtList` shows "No debts added yet." That's text, not an empty
state.
