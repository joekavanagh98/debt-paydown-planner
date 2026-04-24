# v4-tailwind Notes

## Project structure

### Copied v3, did not scaffold fresh

v3 was a fresh Vite scaffold because the template changed from
`react` to `react-ts`. v4 uses the same template as v3. Nothing
about the scaffold needed to change. `cp -r v3-typescript v4-tailwind`
was faster than running the scaffold again.

## Tailwind v4

### CSS-first config

Biggest change from v3 to v4. In Tailwind v3 you had a
`tailwind.config.js` file:

```js
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { brand: "#2563eb" } } },
};
```

In Tailwind v4 the config lives in CSS:

```css
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
}
```

v4-tailwind does not use `@theme` yet. The default palette is
enough. If I wanted a custom brand color, `--color-brand: #2563eb`
in the CSS would give me `bg-brand`, `text-brand`, etc.

Tailwind moved to this model because design tokens felt like they
belonged in CSS, not JS. When tokens are CSS variables, dev tools
and other stylesheets can read them directly.

### Content detection is automatic

No `content: [...]` glob to keep in sync. The Vite plugin scans
every template file in the project.

### Visual differences from v3

Most utility class names are the same. Three defaults changed:

1. `border` alone used to mean `gray-200`. In v4 it means
   `currentColor` (matches text color). A bare `border` class looks
   very different now.
2. Colors moved from HSL to OKLCH. Same class names, slightly
   different shades.
3. `ring` used to default to `ring-blue-500` at 3px. v4 changed
   both defaults.

I always specify colors and widths explicitly (`border-slate-200`,
`ring-blue-200`, `ring-2`), so none of these defaults affect v4-tailwind.

### Vite plugin instead of PostCSS

v3 used `@tailwindcss/postcss`. v4 has a native Vite plugin,
`@tailwindcss/vite`. Fewer tools in the chain, faster dev builds.

## Styling

### Mobile-first

Base classes are the mobile layout. Desktop uses `sm:` prefixes
(640px breakpoint). The whole responsive commit was three lines:

1. `sm:text-3xl` on the heading
2. `sm:grid-cols-3` on Summary
3. `sm:grid-cols-2` on DebtForm

Everything else adapts via flexbox without breakpoints.

### Utility classes inline

Current Tailwind guidance is to keep utilities inline. When they
repeat, abstract via React components, not `@apply` in CSS.
`DebtForm` pulls the four repeating input styles into `inputClass`
and `labelClass` constants at the top of the file.

### Color roles

- Slate for chrome (text, borders, backgrounds)
- Blue for primary actions and the "correct" strategy (avalanche)
- Red for destructive (delete)
- Amber for warnings (budget too low)

## Strategy comparison

### Shared loop

Both `avalanchePaydown` and `snowballPaydown` are thin wrappers
around an internal `runPaydown(debts, budget, compare)`. The only
difference is the sort comparator:

```ts
avalanche: (a, b) => b.rate - a.rate
snowball:  (a, b) => a.balance - b.balance
```

Avalanche's public signature did not change. All v3 calculator
tests still pass.

### Why show both at once

Comparing strategies is not about picking one. It is about seeing
the tradeoff. A number by itself does not teach that. Two charts
side by side do: the high-rate line drops fast under avalanche,
the small-balance line disappears first under snowball.

The takeaway sentence turns the deltas into words: "Avalanche
saves you $X in interest and finishes Y months sooner." Avalanche
is provably interest-optimal, so both deltas are always `>= 0`.
The sentence never needs a "snowball wins" case. If both
strategies produce identical schedules (single debt, ties on both
rate and balance), a different sentence covers that.

## Recharts with strict TS

Recharts' types are loose. Three places they collided with strict
TS:

### Tooltip formatter/labelFormatter

Recharts types `value` as `ValueType | undefined` and `label` as
`ReactNode`. Neither narrows the way I wanted. I typed my
parameters as `unknown` and coerced at the boundary:

```ts
(value: unknown) => formatMoney(Number(value))
(label: unknown) => `Month ${String(label)}`
```

### Line stroke

`noUncheckedIndexedAccess` makes `COLORS[i % COLORS.length]` return
`string | undefined`. Recharts wants `string`. I wrote a helper:

```ts
const colorFor = (i: number): string =>
  COLORS[i % COLORS.length] ?? "#475569";
```

The fallback never runs. The modulo is always in bounds. The
fallback is there so the compiler can prove that, without me
using a non-null assertion (`!`).

## Charts

Each chart plots per-debt balance over time. I prepend a month-0
row with each debt's original balance. Without it, the first
data point is the end of month 1, and the lines do not visibly
start at the top.

Six colors cycle through (blue, emerald, amber, violet, rose,
slate). If you track more than six debts the cycle wraps, but a
chart with seven lines stops being useful long before that.

## Deploy

### Vercel, Root Directory set to `v4-tailwind/`

The repo holds multiple versions. Only one is the live product at
any time (v4 until v5 lands). Vercel's Root Directory setting
(dashboard only, no `vercel.json` field for it) points the build at
`v4-tailwind/`. Framework preset picks up Vite automatically.

`v4-tailwind/vercel.json` is one line of real config: the SPA
rewrite fallback so any path returns `index.html`. v4 has no
client-side routing yet, so the rewrite is a no-op for now. It is
there so a future version with routing does not break.

## What could be better

### Bundle size

The production bundle went from ~200kB to ~545kB when I added
Recharts. Most of that is d3-scale, d3-shape, and friends that
Recharts pulls in. For v4 it is fine. A future commit could
lazy-load the chart with `React.lazy` and `Suspense` so the
comparison numbers render immediately and the chart follows after a
small delay.

### Still no component tests

16 calculator tests, 0 component tests. The form, the delete
button, the strategy comparison rendering, all untested. Planned
for v5 or v6 once there is a backend to stub.

### Silent form validation

Carried forward from v2 and v3. Invalid inputs bail out of the
submit handler with no UI feedback. HTML `required` and `min`
catch most cases at the browser level, but there is still a silent
path. Needs per-field error state in `DebtForm`.

### Per-debt payoff order

v3's Schedule component listed each debt with the month it paid
off. v4 dropped that. The information is visible in the chart
(watch lines hit zero) but not explicit. A small list per strategy
would close the gap.

### Chart accessibility

Recharts renders SVG with almost no ARIA. A screen reader gets
nothing useful. Options: add `role="img"` with an `aria-label`, or
render a visually-hidden data table next to the chart.

### No dark mode

Tailwind v4's `dark:` variant is free. Nothing in v4-tailwind uses
it. A small pass could add `dark:` classes and respect
`prefers-color-scheme`.

### Root-directory npm install pollution

Three times during v4 work, `npm install` ran from the repo root
instead of `v4-tailwind/` because the bash shell lost its working
directory between commands. Each time a stray `package.json`,
`package-lock.json`, and `node_modules/` appeared at the top level.
Each was cleaned up before committing. A root-level `package.json`
with an install script that blocks installs would catch it. Not
urgent.
