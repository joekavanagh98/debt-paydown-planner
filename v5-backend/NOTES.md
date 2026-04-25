# v5-backend Notes

## Project structure

### Fresh project, not a copy

v5 is a backend. v4 was a frontend. They share the calculator math
but nothing else. So v5 starts from an empty folder, not a copy of
v4. The calculator gets ported into `src/utils/`.

### ESM with the .js suffix in source

`package.json` has `"type": "module"` and tsconfig has
`"module": "nodenext"`. That means Node treats every file as ESM.
Node's ESM resolver does not extension-guess, so a relative import
has to include the file extension.

Source code uses the `.js` suffix even though the file on disk is
`.ts`:

```ts
import { router } from "./routes/index.js";
```

When tsc compiles, `./routes/index.ts` becomes `./routes/index.js`
in `dist/`, and the import resolves at runtime. tsx during
development handles this transparently.

### app.ts and server.ts are separate

`app.ts` builds and returns the Express instance. `server.ts` calls
`.listen()`. Splitting the two means tests can `import { buildApp }`
and run requests through supertest without ever opening a port.
Only `server.ts` ever talks to the network.

### Tests excluded from the build

`tsconfig.json` excludes `src/**/*.test.ts` from compilation.
Without that, `npm run build` would copy test files into `dist/`,
which would ship to production for no reason. Vitest still
type-checks tests when it transforms them, so they don't escape
review.

## Layered architecture

The four layers, top to bottom of a request:

1. **Routes** declare URL plus HTTP verb and point at a controller.
   No logic.
2. **Middleware** runs before controllers: CORS, request logger,
   body parser, validation, then the controller. After the
   controller comes the error handler.
3. **Controllers** read the request, call a service, send the
   response. They do not know about the database, the calculator,
   or any business rule. Trivially mockable.
4. **Services** own the business logic. The paydown service
   dispatches to the right strategy. The debts service holds the
   in-memory store today; v6 swaps the store for Mongoose calls
   without touching the controller above it.

### What's not here yet

Models is a layer too, but with in-memory storage, the "model" is
just a TypeScript interface. No file deserves a model layer until
v6 introduces Mongoose. Until then, types live in
`src/types/index.ts` and the in-memory Map lives inside the
service. Adding a `models/debt.model.ts` that just re-exports a
type would be ceremony.

## Express 5

### Async errors propagate automatically

In Express 4, throwing inside an async route handler crashed the
server unless you wrapped every controller in try/catch or pulled
in `express-async-errors`. Express 5 (stable Oct 2024) propagates
both sync throws and async rejections to error middleware on its
own. So controllers can throw `NotFoundError` and the error handler
catches it. No try/catch in any controller.

### Router stays the same

Most of Express 5's API is identical to 4. The differences that
matter are the async behavior above and a few tightened defaults
around path matching. v5 doesn't hit any of those.

## Zod validation

### Middleware factory, not per-controller calls

`validate(source, schema)` returns Express middleware. Each route
wires it in front of the controller:

```ts
debtsRouter.post("/", validate("body", newDebtSchema), postDebt);
```

By the time `postDebt` runs, `req.body` matches `newDebtSchema`.
The controller's `Request<unknown, unknown, NewDebt>` annotation is
a runtime guarantee, not a hopeful claim.

### Strict schemas

Every schema uses `.strict()`. Unrecognized keys reject. A typo in
a field name surfaces as a 400 instead of being silently dropped.

### z.coerce.number for env

`process.env` values are always strings. `z.coerce.number()` lets
the schema validate `PORT=3001` as a number even though the
underlying value is the string `"3001"`. Coerce only at the
boundary, not in the request body schemas, where the JSON parser
already produces typed values.

### Schemas are runtime; types are compile-time

The `Debt` interface in `src/types/index.ts` and `debtSchema` in
`src/validators/debts.schema.ts` describe the same shape. They have
to agree but neither derives from the other. v6 might consolidate
via `z.infer<typeof debtSchema>` so the schema becomes the source
of truth.

## Error handling

### One envelope, one handler

Every error response uses the same shape:

```json
{ "error": { "code": "...", "message": "...", "issues": [...optional...] } }
```

`AppError` is the base class. Three subclasses cover the cases:

- `NotFoundError` (404, code `not_found`)
- `ValidationError` (400, code `validation_error`, carries Zod's
  issues array)
- nothing else needs one yet

The handler renders any `AppError` using its statusCode/code/message.
Anything that isn't an `AppError` is unexpected: log the actual
error server-side, return a generic 500 envelope. The client never
sees stack traces or internal messages.

### Unmounted-route 404 also goes through the handler

The catch-all middleware that runs after every other route does
`next(new NotFoundError("Route not found"))` instead of writing a
response directly. So route-level 404s and resource-level 404s look
identical.

## Logging

### Pino is the only logger

Application logs go through pino. Production gets one JSON line per
log so log shippers can parse it. Development pipes through
pino-pretty for colorized human-readable output. The switch is
`NODE_ENV`.

### Morgan rides the same stream

CLAUDE.md asks for both pino and morgan. Morgan handles request
logging well but writes plain strings. The integration is a custom
stream that takes morgan's line and feeds it to `logger.info()`. So
request access logs and application logs land on the same stdout
through the same logger.

### Format switches on environment

Morgan's "dev" format in development, "combined" (Apache-style) in
production. Production format is what downstream tools know how to
parse.

## Env config

### Validate once at boot

`src/config/env.ts` is the only file that reads `process.env`.
Everything else imports the typed `env` object. A Zod schema
validates the whole environment at module load. If anything is
missing or malformed, the process exits with a formatted
diagnostic. No middleware ever crashes because someone forgot to
set `PORT`.

### Defaults that cover dev

`PORT`, `LOG_LEVEL`, `NODE_ENV`, and `CORS_ORIGIN` all have
defaults. The dev server starts without an `.env` file. Production
overrides via real env vars; the schema validates the override.

### CORS origin is a single string today

`cors({ origin: env.CORS_ORIGIN })`. Easy to switch to an array
once there are multiple deploy URLs, or to a function for dynamic
checks. v8 (auth + production) is when the wrong value would
actually leak data; setting it correctly now means one less thing
to remember.

## Testing

### Four test files, 35 tests

- `paydownCalculator.test.ts`: 16 calculator tests, ported from v4
- `paydown.service.test.ts`: 2 dispatch tests
- `debts.service.test.ts`: 5 in-memory CRUD tests
- `app.test.ts`: 12 supertest end-to-end tests

The unit tests cover each layer in isolation. The supertest file
hits the layered chain end-to-end so a wiring bug between layers
would show up.

### supertest doesn't open a port

`request(buildApp())` runs the request through the Express
internals without binding to TCP. Tests are fast (~250ms for the
whole suite) and don't fight each other for ports.

### _resetForTests escape hatch

The in-memory store is module-scoped. Between test cases it
survives. `_resetForTests()` clears the Map. The leading underscore
and the function name make the intent loud. v6 swaps the Map for
Mongoose calls and the hatch can go.

## What could be better

### No request id

Pino logs each request through morgan but there's no correlation id
linking a request log to its error log. Adding a request-id
middleware (uuid per request, attached to the pino child logger)
would let me grep one id across access log, app log, and error log.

### Helmet is missing

CLAUDE.md mentions helmet for security headers in v7's plan. It
applies to v5 too. One `app.use(helmet())` covers a dozen
sensible headers. Not in yet because v7 owns the security
hardening pass.

### CORS string vs array

`cors({ origin: env.CORS_ORIGIN })` with a string echoes that
origin on every response, regardless of the request's Origin
header. The browser still enforces the match. Switching to an
array (`origin: [env.CORS_ORIGIN]`) would only echo if the request
matches, which surfaces intent more clearly. Cosmetic for v5; will
probably switch in v7 alongside the rest of the security pass.

### Schemas duplicate the types

`Debt` interface in `src/types/index.ts` and `debtSchema` in
`src/validators/debts.schema.ts` have to agree manually.
`z.infer<typeof debtSchema>` would make the schema the single
source of truth and the interface a derived type. Not done because
v3+ has been treating types/index.ts as canonical, and v5 follows
the pattern. v6 might consolidate.

### No structured request body in pino

Morgan's line ends up as a string in the pino message. Pino-http
would log requests as structured fields (method, url, status,
duration as discrete keys). Trade-off: another dependency for a
slightly nicer log shape. CLAUDE.md asked for morgan, so morgan it
is.

### No graceful shutdown

`server.ts` calls `app.listen()` and that's it. SIGTERM/SIGINT
will kill the process mid-request. A graceful shutdown handler
that stops accepting new connections, waits for in-flight requests
to finish, then exits would be polite for production. v8
(deployment) is when this matters.

### Repeated npm install pollution. **Fixed.**

Same problem v4 had. Six times during v5 work, an `npm install`
ran from the repo root because the bash shell lost its working
directory between commands. Each created a stray
`package.json`/`node_modules/` at the top level, all cleaned
before committing.

Now structurally prevented: the repo root has a `package.json`
with a `preinstall` hook that runs `scripts/block-root-install.mjs`,
which prints a copy-pasteable recovery command and exits non-zero.
Any future install at the root fails loudly instead of polluting.
Active version is named in the script and updates when the focus
moves on.
