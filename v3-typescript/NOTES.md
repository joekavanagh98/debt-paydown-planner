# v3-typescript Notes

## Project structure

### Fresh scaffold, not a copy

`npm create vite@latest v3-typescript -- --template react-ts`, then
the v2 source ported file-by-file. The alternative was copying v2 and
renaming `.jsx` → `.tsx`. The fresh scaffold won: inheriting v2's
eslint/vite config would have meant hand-merging TypeScript settings
into configs that weren't built for them. Vite's `react-ts` template
gives you a tsconfig tuned for the bundler and a typescript-eslint
setup that already agrees with it.

### File extensions

`.ts` for pure logic (types, utils), `.tsx` for anything that renders
JSX. TypeScript parses `.ts` files differently — angle-bracket generics
like `<T>(x)` would be ambiguous with JSX, so JSX is only allowed in
`.tsx`.

## TypeScript strict mode

### What "strict mode" actually is

`"strict": true` in tsconfig is an umbrella that turns on a bundle of
checks: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`,
`strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`,
`useUnknownInCatchVariables`, `alwaysStrict`. The Vite scaffold
surprisingly doesn't include `strict` — it sets some linting-adjacent
flags (`noUnusedLocals`, `noUnusedParameters`) but leaves the core
strictness family off. v3 adds it in the second commit before any
code lands, so there's nothing to retrofit.

### Extra flags beyond `strict`

Three more turned on:

- `noImplicitReturns` — every branch of a function must return. Catches
  forgotten `return` statements in `if/else` chains.
- `noUncheckedIndexedAccess` — `arr[i]` and `obj[key]` resolve to
  `T | undefined`. The noisy one. It's on because the whole point of
  v3 is to learn strict TS, not to pick and choose which checks I
  feel like today.
- `exactOptionalPropertyTypes` — `{ x?: number }` means the key can be
  missing, not that its value can be `undefined`. Stops a subtle class
  of bug where code writes `undefined` to a field expected to be
  absent.

### How `noUncheckedIndexedAccess` shows up in the code

One real hit: `payoffMonth[d.name]` in `Schedule`. The resulting type
is `number | undefined`, which the existing `?? "—"` fallback already
handles cleanly. Without the flag the compiler would have said it's
just `number` and the `??` would have looked decorative. The flag
makes it load-bearing.

## Shared types

### Discriminated union for `PaydownResult`

```ts
type PaydownResult =
  | { feasible: true; schedule: ScheduleMonth[] }
  | { feasible: false; reason: "budgetBelowMinimums"; requiredMinimum: number; shortfall: number }
  | { feasible: false; reason: "exceeds50Years" };
```

The shared `feasible` tag is the "discriminant." Checking
`if (!result.feasible)` narrows the type to the two failure branches;
checking `result.reason === "budgetBelowMinimums"` narrows further so
`result.requiredMinimum` becomes accessible. The compiler refuses to
let you read `requiredMinimum` until you've proven which branch you're
in. JavaScript had this pattern already (check a field, then read
others) — TypeScript just enforces the order.

### `NewDebt = Omit<Debt, "id">`

The form produces a debt without an id; App stamps the id at the
boundary. `NewDebt` names that intermediate shape explicitly.
`Omit<Debt, "id">` is a built-in utility type — derives one type from
another by dropping a key.

### `calculateMinimumPayment` takes `Pick<Debt, "balance" | "rate" | "minPayment">`

Narrower than `Debt`. Lets the function accept a draft that hasn't
been assigned an id yet. The broader `Debt` would also work, but
taking only what the function reads is better documentation.

## Components

### Named `Props` interfaces, not inline types

```ts
interface DebtRowProps { debt: Debt; onDelete: (id: string) => void }
function DebtRow({ debt, onDelete }: DebtRowProps) { ... }
```

Could have been inline as `{ debt, onDelete }: { debt: Debt; ... }`.
The named version puts the prop contract at the top of the file where
you can grep for it, and it's what you'd use if you were re-exporting
the component's props for consumers.

### No `React.FC`

`function Foo(props: FooProps)` instead of
`const Foo: React.FC<FooProps> = (props) => ...`. `React.FC` used to
be the idiom; the community moved away from it because it implicitly
added a `children` prop on every component. Plain function
declarations are cleaner and type-check the same way.

### Event handler types

Two React types cover the events in this app:

- `ChangeEvent<HTMLInputElement>` for input `onChange`
- `FormEvent<HTMLFormElement>` for form `onSubmit`

Both come from `react` as type imports (`import type { ... }`). Type
imports get erased at build time and can't accidentally pull runtime
code along for the ride.

### The `[e.target.name] as keyof` cast in `DebtForm`

```ts
const name = e.target.name as keyof DebtFormDraft;
setForm((prev) => ({ ...prev, [name]: value }));
```

Every input in the form has `name="balance"`, `name="rate"`, etc, all
matching keys of `DebtFormDraft`. TypeScript can't verify that the
string coming out of the DOM is one of those four keys, so we assert
it. Runtime invariant (the HTML matches the type) that the compiler
can't see.

## State

### `useState<Debt[]>(() => loadJSON<Debt[]>(...))`

Both generics are explicit. Two reasons:

- `loadJSON(DEBTS_KEY, [])` would infer `T = never[]` from the empty
  array literal, and then every downstream setter would reject any
  actual `Debt` because `Debt` isn't assignable to `never`.
- Even with a non-empty fallback, being explicit makes the state's
  shape visible at the declaration instead of requiring a reader to
  chase the inference.

### `useEffect` with `void`-returning setters

`saveJSON` returns `void`. The effect callbacks implicitly return `void`
too. No type friction, just noting that React's types work.

## What could be better

### No tests

Still no tests. v1 had a calculator test harness; v2 and v3 dropped it.
The calculator is now typed, which makes mistypes impossible, but
doesn't prove the math. Planned for v4 or v5 under a real test runner
(Vitest).

### Index signature on `payoffMonth`

`Record<string, number>` loses the connection to debt names. With all
names known up front you could use a tagged type or a `Map<string, number>`,
but for a one-off local object the added strictness doesn't earn its
keep yet.

### No runtime validation on `loadJSON`

Generic and trusted. If localStorage contains garbage that parses as
JSON but isn't the expected shape, the app will explode later. v6
adds Zod and this becomes a real validator.

### The cast in `DebtForm`

`as keyof DebtFormDraft` is the one place where type safety is weaker
than it looks. A typo in a `name=` attribute would compile fine and
write to a bogus key. Alternatives: a single typed `onChange` handler
per field, or a factory that closes over the key. Not worth it for
four inputs.

### `strictPropertyInitialization`

Not exercised — all types are interfaces with plain data, no class
fields. The flag is on but there's nothing to catch. Meaningful once
we hit class-based Mongoose models in v6.
