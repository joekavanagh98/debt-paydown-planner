# v1-vanilla Notes

## HTML

### `<noscript>` fallback

The whole app is a JavaScript calculator, so rendering nothing when
JS is disabled would leave a blank page. The `<noscript>` block sits
above the header and tells the user what's wrong. Cheap to add, saves
a confusing experience for the one-in-a-thousand case.

### `inputmode="decimal"` on money inputs

`type="number"` already gates what the input accepts, but on mobile
`inputmode` is what controls which keyboard shows up. Without it you
get a full alphanumeric keyboard for numeric fields, which is exactly
what nobody wants when typing dollar amounts.

### `autocomplete="off"` on the debt form

The browser wants to autofill "Name" with the user's own name and
"Balance" with anything it's seen in a balance field before. Neither
guess is useful here, so disable it. The budget input isn't on the
form so it's unaffected.

### `novalidate` on the form

HTML5 required/min/step attributes still provide hinting, but the
submit handler does its own validation with `Number.isFinite` and
shape checks. `novalidate` suppresses the browser's default error
bubbles so the JS path is the single source of truth. Less surprising
than fighting two validators.

### `maxlength="40"` on the name input

Nothing enforces the limit on the backend in v1 (there is no backend),
but capping at the UI keeps the debt list from blowing out the layout
if someone pastes a paragraph. Will revisit when the server-side
validator exists in v5.

### Hidden elements pattern

`#summary-payoff-card` and `#schedule-section` live in the DOM with a
`.hidden` class so JavaScript can toggle them on/off without rebuilding
markup. Keeps the rendering function's responsibility narrow: flip a
class, don't re-create nodes.

## CSS

### Custom properties on `:root`

Every color, space, and radius lives in a CSS variable. That's how
the tokens from the fundamentals calculator exercise transfer over:
change a value in one place and the whole app updates. Also sets up
v4 (Tailwind) mentally — tokens first, apply second.

### System font stack

`system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
sans-serif`. No web-font request, no FOUT, no external dependency.
Each OS renders its native system font. Fast and appropriate for a
utilitarian tool.

### Grid with `auto-fit` + `minmax`

`#summary-cards` uses `grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr))`.
Cards reflow from 4-across on desktop to 1-across on narrow screens
without a single media query. The grid tracks themselves handle the
breakpoints.

### Spinner removal on number inputs

The up/down arrows that browsers add to `type="number"` are ugly and
usually tapped by accident on mobile. `-webkit-appearance: none` on
the inner/outer spin buttons handles Safari and Chrome.
`-moz-appearance: textfield` plus standard `appearance: textfield`
handles Firefox and passes the lint rule that flags vendor-only
properties.

### `font-variant-numeric: tabular-nums`

On the summary card values, debt-meta line, and schedule output. Keeps
digits the same width so numbers line up vertically in the card stack
and in the schedule table. A small detail that the eye registers even
if the user couldn't name it.

### `.hidden` with `!important`

The utility class has to win against any element-level `display` rule.
`!important` is appropriate here because the whole point of the class
is "override whatever was set, hide this." Used sparingly - only this
one utility.

### `:focus-visible` instead of `:focus`

Keyboard users get a visible focus ring; mouse clicks don't show one.
`:focus-visible` is the modern way to get that behavior without JS
trickery. Accessibility win for free.

## JavaScript

### `Intl.NumberFormat` for currency

One formatter instance at module top, reused everywhere. Handles
thousands separators, currency symbol, and locale correctly. Way
better than hand-rolled `.toFixed(2)` string concatenation, and
cheap because the formatter is created once.

### Integer-cents arithmetic

Everything in the paydown loop runs in cents as integers (`toCents`
on entry, `toDollars` on the way out). 600 months of multiplying a
floating-point balance by a monthly rate accumulates real drift.
Integers don't.

### `FormData` + destructuring in the submit handler

`new FormData(form)` plus a destructure with `data.get(...)` is less
code than querying each field by id, and the form is already the
source of truth for field names. If a field gets renamed in HTML,
the handler breaks loudly at the right spot.

### `crypto.randomUUID` with a fallback

Modern browsers have it. The fallback (`debt-${Date.now()}-${random}`)
covers older runtimes and Node test environments. Good enough for a
local-only list where collision odds round to zero.

### `escapeHtml` before `innerHTML`

Debt names are user input. Inserting them into an `innerHTML` template
without escaping is a textbook XSS hole. The 5-character replace chain
(`&`, `<`, `>`, `"`, `'`) covers the attack surface for text content
and quoted attributes. Will revisit in v2 when React handles escaping
automatically.

### Event delegation on the debt list

One listener on `#debt-list` instead of re-binding a handler to each
delete button every time the list re-renders. `event.target.closest("[data-action='delete']")`
walks up to the button, grabs its `data-id`, and deletes. Standard
pattern for dynamic lists.

### `storage` wrapper with try/catch

`localStorage` can throw in Safari private mode or when the quota is
hit. The wrapper swallows those errors so the app still works
in-memory without the persistence. Silent degradation is the right
call for non-critical data like "remember my inputs."

### Dynamic placeholder on the budget input

The input starts empty, not pre-filled. The placeholder shows
`Auto: $X.XX` where X is the sum of minimums. If the user never
types a budget, `effectiveBudget()` falls back to that sum. Avoids
the "is this my number or the app's number?" confusion that
pre-filling causes.

## Design decisions for v1

These are the calls I made up front so future-me (or a code reviewer)
doesn't have to reconstruct the reasoning.

### Minimum payment fallback formula

`max(25, interest + balance * 0.01)`

Interest-only would loop forever since principal never drops. 1% of
principal is the industry standard for credit card minimums and
guarantees the debt pays off eventually. $25 floor keeps payments from
going absurdly small on tiny balances.

### Infeasible budget handling

Return a structured result, not a throw.

```
{ feasible: false, reason: 'budgetBelowMinimums', requiredMinimum, shortfall }
{ feasible: true, schedule: [...] }
```

Throwing forces try/catch on every caller. Returning `null` loses
information. A structured result lets the UI show "Budget too low,
increase by $X" without extra work.

### Balance in month entry

End-of-month balance.

Matches how people read statements. Final-month payoff is unambiguous
because end-of-month balance of 0 means the debt is done.

### Cascade semantics

Extra payment cascades to the next avalanche target within the same
month, not next month. Unused minimum (paid-off debts, or tiny
balances smaller than the minimum) also cascades.

Approximation: all debts accrue full interest on their start-of-month
balance before any payment. In reality the cascade target gets a
couple fewer days of interest, but modeling that is not worth the
complexity.

### Money representation

All math happens in integer cents. Inputs are multiplied by 100 with
`Math.round` on entry, results divided by 100 on the way out.

Floating-point drift over 600 months of compounding is a real bug, not
theoretical. Integer cents eliminates it.

### Max months guard

600 months (50 years). If the loop runs longer than that, either the
inputs are bad or the budget is unrealistic. Return
`{ feasible: false, reason: 'exceeds50Years' }`.

## What could be better

### Test coverage gaps

- The "deterministic ordering" test only asserts two consecutive runs agree.
  Both could be deterministically wrong. A stronger version would assert
  _which_ debt wins ties (input order, since `Array.prototype.sort` is
  stable in modern engines). The current test still catches the common
  bug (random tiebreaking), which is what matters for v1.
- The "budget exactly matching minimums" test only checks month 1. It
  doesn't verify steady state after some debts pay off and their
  minimums start cascading. Not wrong, just narrower than it looks.
- No test for cascade behavior when a debt pays off mid-schedule (the
  rollover of unused minimum to the next target).
- No test that the 600-month ceiling actually fires on a degenerate
  input (e.g. user-supplied minimum below the interest accrual).
- No test for negative or NaN inputs. Current code might crash rather
  than fail gracefully. Validation at the UI boundary catches most of
  this in practice, but the math function itself has no guard.
