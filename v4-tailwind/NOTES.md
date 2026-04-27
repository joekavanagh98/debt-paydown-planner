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

## v8 Phase 1: Frontend ↔ Backend integration

v8 wires the v4 frontend up to the v5/v6/v7 backend. Phase 1 lands
the local end-to-end flow: auth, then debts CRUD against
MongoDB-via-Atlas. Deploy, AI extraction, and the staff view are
later phases.

### What changed

- Auth (login + register + logout) on top of the existing app
- Debts persistence moved off localStorage and onto the backend's
  `/debts` endpoints
- Budget stays in localStorage but namespaced by user id
- 401 from any debts call triggers an automatic sign-out with a
  "session expired" message

### Token storage: in-memory only

The token returned from `/auth/login` lives in a module-scope
variable in `src/lib/api.ts`. No localStorage. No sessionStorage.

Both alternatives were considered and rejected:

- **localStorage** survives across refreshes and tabs, but a script
  that gets injected into the page (XSS) can read it. For a demo
  with public-facing auth that's the wrong tradeoff.
- **sessionStorage** is per-tab and slightly better, but still
  JS-readable. The XSS posture is the same; the only win over
  localStorage is tab isolation. Not worth the marginal benefit.

In-memory means a page refresh logs the user out. With v7's 15-min
token expiration that's not a huge regression, but it is friction.

The proper fix is a refresh-token flow: a long-lived
HttpOnly-cookie refresh token that the client can't read but that
the server uses to issue fresh access tokens. v7 deliberately
deferred refresh tokens to v9+ because the design surface (token
revocation, rotation, per-device session list, secure storage)
goes well beyond what v7 was scoped to do. The in-memory tradeoff
is the cost of that deferral.

### Type duplication between frontend and backend

`src/types/index.ts` declares `User`, `LoginResponse`, `Debt`,
`NewDebt`, etc. that mirror v5-backend's contracts. They're written
by hand in two places.

Three proper solutions, each with their own cost:

1. **Monorepo workspaces**, with a shared `@dpp/types` package.
   Lowest tool overhead but biggest restructure: `package.json`
   per workspace, root `package.json` with `workspaces`, build-
   order coordination. Doesn't earn its place for two consumers
   (frontend + backend) sharing a few types.
2. **OpenAPI codegen**: backend exposes an OpenAPI/Swagger spec,
   frontend's types are generated from it during build. Single
   source of truth, fully typed, but requires standing up the
   spec-emit pipeline on the backend (zod-to-openapi or similar)
   and wiring a codegen step into the frontend build.
3. **tRPC**: turn the API into typed procedure calls; frontend
   imports the backend's types directly. Best DX in this list,
   but ties the architecture to tRPC across the stack and rules
   out a public REST API for v9+.

Phase 1 stays with the duplication. None of the three options is
cheap enough to justify pulling the work into v8's window. Listing
them here because picking one when the project graduates beyond
the capstone is the next move.

### Auth state lives in context, error/loading state in the form

The AuthProvider exposes `user`, `sessionExpired`, and the three
action functions (login, register, logout). It does **not** track
"is the form submitting?" or "what was the last error?". Those
belong to the consumer that's actually rendering the form.

Why: a logout button in the header should not get its UI affected
by the login form's submitting state. The auth provider is the
data store. UI state lives next to the UI.

### File split for HMR

The auth Context, the `useAuth` hook, and the `AuthProvider`
component originally lived in one file (`AuthContext.tsx`). Vite's
React Fast Refresh ESLint rule (`react-refresh/only-export-components`)
flagged it: a file should export only components or only
non-components, not both. Mixing breaks HMR's ability to preserve
component state through hot reloads.

Split into two files:

- `authContext.ts`: the Context object and the `useAuth` hook (no
  components, no JSX, no rule violation)
- `AuthProvider.tsx`: just the AuthProvider component

The Context is exported from `authContext.ts` and imported by both
AuthProvider and useAuth. HMR works cleanly.

### Remount-by-key for cross-user state reset

The original App.tsx tried to reset state when the user changed by
checking `if (user === null)` inside a useEffect. ESLint's
`react-hooks/set-state-in-effect` rule flagged the synchronous
setState calls. Setting state synchronously inside an effect causes
an extra render and the rule asks you to derive state from props
or remount instead.

Remount is the right answer here. App now splits:

```
App        — gates: returns AuthGate when user === null
SignedInApp — receives user as a prop, key={user.id}
```

When the user changes (sign-out + sign-in as someone else),
`key={user.id}` changes, React unmounts SignedInApp and mounts a
fresh instance. All per-user state resets without manual cleanup.
SignedInApp's mount effect fetches that user's debts; previous
debts/budget/loading are simply gone with the previous instance.

### Budget in localStorage, namespaced by user id

`dpp.budget.${userId}` rather than `dpp.budget`. Two users on the
same browser don't see each other's budget value.

Server-side preferences would be the proper fix: a `/users/me/preferences`
endpoint backed by Mongo, the budget field stored alongside other
UI prefs. Out of scope for v8 phase 1, which is "wire the frontend
to the existing backend, don't grow the API surface." Worth
revisiting when staff dashboard or AI extraction lands and there's
already movement on `/users/me/*`.

### 401 mid-session: global handler in api.ts

When any debts call comes back 401 (typically because the JWT
expired idle), the user shouldn't see "Couldn't load your debts"
and have to puzzle out that they need to log in again. v8 adds a
global 401 handler:

`api.ts` exposes `setOnAuthError(callback)`. The AuthProvider
registers a callback once on mount that clears the in-memory
token, clears the user, and flips a `sessionExpired` flag in the
context. AuthGate reads `sessionExpired` and surfaces the message
"Your session expired. Please sign in again." above the form.

The alternative was wrapping every authed endpoint individually
in catch-401-call-logout. Rejected: a future authed endpoint would
have to remember to wrap, and the duplication would drift. The
api.ts boundary is the right home — it already owns the token
header on the request side, so it owns the 401 response on the
other side.

The `ApiRequestError` still throws after the handler fires, so the
per-call `.catch()` can pick a message. For 401 specifically the
page is about to unmount the call site (auth state cleared →
AuthGate renders), so the per-call message races a render that's
about to discard it. That's fine. The session-expired message wins.

### AuthForm accessibility posture

What's covered:

- Every input has a matching `<label htmlFor>` so screen readers
  announce the field name.
- `type="email"` and `type="password"` give browsers and password
  managers the right hints.
- `autoComplete` is set per field (`email`, `current-password`,
  `new-password`) so password managers know what to fill or save.
- The error panel uses `role="alert"` so AT users get notified
  when an error appears.
- Submit button text changes during submitting (just `...` for now)
  so the state change is visible.
- Inputs and the submit button go to the disabled style during
  submitting; visually clear that the form is in flight.

What's not covered:

- No `aria-describedby` linking the error panel to the email/password
  inputs. Screen readers announce the alert when it appears but
  don't tie it to a specific field.
- No focus management. After a submit fails, focus stays on the
  submit button rather than returning to the first invalid field.
- No `aria-invalid` on inputs after a failed submit. The error is
  generic ("incorrect", "already exists", etc.) so AT can't tell
  which field is at fault.
- Password minimum length (8) is enforced via `minLength` on the
  input, but the constraint message comes from the browser's
  native popover rather than an inline announcement.

These are real gaps for a production product. Calling them out
explicitly so they're visible rather than hidden in a TODO; phase
1's scope was end-to-end-flow, not full WCAG. Future commit could
add the four fixes above in one pass.

### Surprises during integration (not all listed above)

- **`RequestInit['body']` is `BodyInit | null`** under
  exactOptionalPropertyTypes. Spreading `body: undefined` into a
  fetch options object fails type-check. Workaround: build the
  init incrementally so the `body` key is absent rather than set
  to undefined.
- **Single typed `apiRequest<T>` doesn't fit a 204-returning
  endpoint cleanly.** `return undefined as T` is a typed lie when
  T isn't void. Phase 1 split the transport into `apiRequest<T>`
  (throws on 204, expects a body) and `apiRequestVoid()` (DELETE,
  expects no body). Honest types at every call site.
- **`react-refresh/only-export-components` ESLint rule** drove the
  AuthContext file split (above).
- **`react-hooks/set-state-in-effect` ESLint rule** drove the App
  / SignedInApp + key remount split (above).

## v8 Phase 3: AI debt extraction (frontend)

The DebtExtractor component sits above the manual DebtForm and
drives the v8 phase 3 user flow: paste statement text, hit "Parse
with AI," review the extracted debts as editable cards, save each
one (or all at once) through the same `addDebt` callback the
manual form uses.

### Three-state component

The component renders one of three states based on local state:

1. **Input mode** (`debts === null`): textarea + "Parse with AI"
   button. The textarea's `maxLength` matches the backend's
   5000-character cap on `extractRequestSchema.text`, and a
   counter at the bottom flips red when the user hits the limit.
   Button is disabled when the text is empty or a request is in
   flight.
2. **Empty-result mode** (`debts is []`): a soft amber card noting
   that Claude found no debts and pointing the user at the manual
   form below. "Try different text" resets to input mode.
3. **Review mode** (`debts has entries`): each row is a small card
   with editable name/balance/rate/minPayment fields plus an
   "Add this debt" button. Saved rows go to a green-tinted
   read-only state with the inputs disabled.

State machine for each row: `ready` → `saving` → (`saved` |
`failed`). A `failed` row goes back to editable so the user can
fix and retry. A `saved` row is locked because re-saving the same
debt would create a duplicate.

### Review-before-save is the third defense layer

The backend's prompt-injection defense is two layers (delimiter
wrapping plus system-prompt hardening, documented in
v5-backend/NOTES). The third is here: the user has to physically
click "Add this debt" on each row before it persists. Even if the
model fabricated debts, an alert user reviewing the list catches
them before storage.

This is also why Save All is sequential, not parallel. A user who
paused mid-save because they noticed a fabricated entry should
not have their previous reviews already saved and the rest still
pending in flight.

### Why above DebtForm, not below

The AI option goes first because it is the answer to "I have a
statement, how do I get my debts in?" The manual form is the
fallback for users who don't have statement text on hand.

The two flows feed the same `addDebt` callback in App.tsx, which
is the same callback the localStorage flow used in v8 phase 1
before the API replaced it. Adding AI extraction didn't require
changing addDebt at all.

### Sequential saves, not parallel

Save All iterates rows with `await onAddDebt(...)` in a loop.
Three reasons not to `Promise.all`:

- Server-friendliness: 5 simultaneous POST /debts is rude even on
  free tier; sequential at human pace is fine.
- Predictable display order: the saved-debts list grows in
  extraction order, which matches the order the user is reviewing.
  Parallel saves can finish out of order on slow connections.
- Failure isolation: if row 3 fails, rows 1 and 2 already saved,
  rows 4+ stay ready. With `Promise.all`, one rejection rejects
  the whole batch and the user has to figure out which ones
  succeeded.

### Blank minPayment becomes 0

v5-backend's NewDebt schema requires `minPayment` as a number. The
extraction response makes it optional because not all source
statements state a minimum. The UI bridges this gap by treating
an empty input as 0 at save time.

The v3+ calculator interprets 0 as "no explicit minimum, use the
fallback rule (interest + 1% of principal, floored at $25)." So
blank-becomes-0 has the same downstream behavior as if the user
had left the field unfilled all the way through. The placeholder
text on the input reads "Leave blank if not stated" rather than
"Leave blank to use fallback" because "fallback" is jargon and
the data semantics ("not stated") match the user's mental model
better.

### Error mapping at the call site

Five outcomes the user can hit:

- **`rate_limited`** (429 from `extractionRateLimit`): "Too many
  extractions. Try again in an hour."
- **`extraction_failed`** (502 from `ExtractionError`): "Couldn't
  extract debts from that text. Try a clearer paste, or add them
  manually below."
- **`validation_error`** (400 from Zod on the body): "Text was
  empty or over the 5000-char limit." Verified the code string
  against v5-backend/src/errors/AppError.ts to make sure it
  actually matches what the backend emits, not a guess.
- **401**: handled globally by the AuthProvider's session-expired
  flow from phase 1. The DebtExtractor doesn't need a code-specific
  message because the user is about to be unmounted.
- **Anything else**: generic "Something went wrong. Check your
  connection and try again."

Mapping lives in a `messageFor(err)` helper inside the same file.
Could be extracted into a shared lookup if more screens grow
similar mappings; deferred until that's actually true.

### What v8 Phase 3 frontend still does not do

- **PDF / image upload**. Text input only. The textarea is the
  only input affordance. Adding file upload would need a multipart
  request shape on the backend too; deferred to v9+.
- **Drag-and-drop paste**. The textarea accepts paste like any
  textarea, but there's no drop zone for screenshot files.
- **Statement format hints in the placeholder**. The textarea
  placeholder says "Paste a credit card or loan statement here..."
  but doesn't show an example. A subtle small-text example below
  the input would help first-time users; not built.
- **Prefill saved debts as already-saved on second extraction**.
  If the user pastes the same statement twice, the rows show up
  as ready to save again (and would create duplicates if added).
  Real product would dedupe by name+balance match; punted.
- **Optimistic save UI**. The "Saving..." button waits for the
  server round-trip. Could optimistically render the row as saved
  and roll back on failure, but the Render free tier's latency
  variance makes the optimistic version more confusing than
  reassuring.

## v8 Phase 4: Staff dashboard (frontend)

Phase 4 adds a staff-only view that fetches `/staff/summary` and
renders the aggregate metrics as cards. The view is reachable via
a Planner / Staff toggle in the header, only visible when the
signed-in user has `role === "staff"`. Backend design notes for
the same phase live in v5-backend/NOTES.md.

### View switch instead of a router

App-level navigation is one piece of state: `view: "main" |
"staff"` on `SignedInApp`. No `react-router-dom`, no path
matching, no route definitions.

Why: v8 has two views and no deep-linkable URLs that any user
would actually share. The Planner doesn't need a stable URL
because there's nothing to share other than the app itself; the
Staff dashboard isn't useful without an auth session and isn't
meant to be linked from anywhere external. A router would add a
dependency and a layer of indirection to solve a problem the app
doesn't have.

The trade-off: refresh-resets-the-view. If a staff user is on
the dashboard and reloads, they land back on the planner. Minor
friction, two clicks to recover. Adding a router (or persisting
view to localStorage like budget) is a one-pass change if it ever
matters.

When a router earns its place: a third view, or a deep link the
product genuinely wants (a per-user detail page, a sharable
report, an OAuth callback URL). The comment in App.tsx flags this
explicitly so future-self knows where the wiring goes.

### Role-gated toggle, role-gated render

Two layers of role-gating in the frontend:

1. **The toggle button group only renders when `user.role ===
   "staff"`.** A non-staff user sees no Staff button in the
   header. Read off the user object in the auth context, which
   is populated from the login response and refreshed on each
   sign-in.
2. **`StaffDashboard` itself doesn't check role.** The component
   assumes the caller has already gated. If a non-staff user
   somehow renders it, the backend's `requireStaff` returns 403
   and the component shows the forbidden message.

Frontend gating is UX (don't show what you can't do); backend
gating is the actual security boundary. The component design
keeps these layered correctly: the toggle is the convenience
gate, requireStaff is the wall.

A demoted staff user (role flipped to "user" in Mongo while a
session is live) still sees the toggle until they re-login,
because the cached user object hasn't refreshed. Clicking Staff
fires the request, which 403s. The error mapping (below)
surfaces "You no longer have staff access. Switch to the
planner view." Acceptable transient state; full immediate
revocation would need either a websocket or a polled `/auth/me`
refresh, neither of which earned a place in v8.

### Privacy banner is a soft check

The "Aggregate data only" banner (full text in
StaffDashboard.tsx) sits at the top of the Staff dashboard. It
is non-collapsible and renders before the cards.

The banner is informational, not a security control. If a
backend bug accidentally surfaced individual data, the banner's
claim would no longer match the page, but the banner itself
would still render. It doesn't inspect the response. The
load-bearing guarantee against leaks is the backend's leak
canary test (`v5-backend/NOTES.md`, "Aggregate-only invariant").

Why keep a banner that doesn't enforce anything: the staff user
needs an explicit reminder that the page they're looking at
should not contain individual customer data, so a future change
that adds an individual-detail field stands out as out of
character. It is a documented expectation, displayed.

### Error mapping at the call site

Three failure modes mapped to user-facing messages in
`messageFor(err)`:

- **403 (`forbidden`)**: "You no longer have staff access.
  Switch to the planner view." Most likely cause: a staff user
  was demoted while their session was live. The message names
  the recovery (toggle back to Planner) explicitly, since the
  user is on a page they can no longer reach.
- **401 (`unauthorized`)**: "Your session expired." Mostly a
  visual flash before the AuthProvider's global 401 handler
  fires, clears the user, and routes to the auth screen. The
  message is for the brief render window where the dashboard
  has rendered but the auth state hasn't propagated yet.
- **Anything else**: "Couldn't load the staff summary. Try
  again." Network blip, model glitch, transient backend
  failure, etc.

The same `ApiRequestError` shape that backs the DebtExtractor's
`messageFor` is what's used here, with different error codes
mapped. Same pattern; per-screen mapping function. Extract
into a shared lookup if a third screen grows the same need.

### Distribution chart is hand-rolled, not Recharts

The debt-count distribution renders as four horizontal bars,
each a flexbox row with a label, a `<div>` with width set as a
percentage of the largest bucket, and a count. No chart
library.

Why not Recharts (already in the bundle for the strategy
comparison): the distribution is four numbers. A bar chart
component pulls in axis machinery, tooltips, and animations
designed for time-series data. Four `<li>` rows in 30 lines of
JSX render faster, look right at the page's information density,
and don't need any new dependencies.

Recharts continues to be the right tool for the strategy
comparison page's per-debt balance lines. Different data, same
file.

### What v8 Phase 4 frontend still does not do

- **Persisted view across refresh**. Refreshing while on the
  Staff dashboard kicks back to Planner. localStorage-backed
  view state would fix this but adds the same per-user namespace
  problem the budget already solves; deferred.
- **Live update of role changes**. Demotion mid-session shows
  the stale toggle until re-login. A `/auth/me` poll or a
  re-fetch on visibility change would cover this; not built.
- **Audit trail in the UI**. The dashboard shows what the data
  is now, not when it was last fetched or by whom. A "last
  refreshed" timestamp would help a staff user reading
  near-realtime data; not built.
- **Drill-down from buckets**. Clicking the "6+ debts" bar
  doesn't show anything. The dashboard is aggregate-only by
  design, but a future product surface might want a flow from
  "users in the high-bucket" into a non-PII follow-up
  (recommended budget guidance, say).
- **Dark mode**. Same v4-tailwind-wide gap noted above; nothing
  on the staff page uses `dark:` variants either.
