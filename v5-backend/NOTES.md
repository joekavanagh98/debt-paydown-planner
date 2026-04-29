# v5-backend Notes

v5 was the in-memory backend. v6 swapped that for MongoDB via
Mongoose. v7 added auth (JWT + bcrypt), per-user scoping on debts,
helmet, and rate limiting. All three live in the same folder
because v6 and v7 modify v5 in place per the project roadmap.

The original "everything below" sections describe v5's bones. The
"v6: Mongoose" and "v7: Authentication and security" sections at
the bottom collect the version-specific decisions and tradeoffs.

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

In v5, the `Debt` interface in `src/types/index.ts` and `debtSchema`
in `src/validators/debts.schema.ts` described the same shape and had
to agree manually. v6 consolidated via `z.infer<typeof debtSchema>`
so the schema is now the source of truth and the type derives from
it. See the v6 section below.

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

`cors({ origin: env.CORS_ORIGIN })` in v5. v7 switched to the array
form (`origin: [env.CORS_ORIGIN]`); see the v7 section. The pinned
single-origin policy mattered more once auth landed in v7, since
that's when the API started carrying user-specific data behind
tokens.

## Testing

### Four test files, 35 tests

- `paydownCalculator.test.ts`: 16 calculator tests, ported from v4
- `paydown.service.test.ts`: 2 dispatch tests
- `debts.service.test.ts`: 5 CRUD tests against Mongoose
- `app.test.ts`: 12 supertest end-to-end tests

The unit tests cover each layer in isolation. The supertest file
hits the layered chain end-to-end so a wiring bug between layers
would show up.

### supertest doesn't open a port

`request(buildApp())` runs the request through the Express
internals without binding to TCP. Tests don't fight each other for
ports. Suite total in v6 is around 3s, mostly the one-time
mongodb-memory-server startup; in-test queries are well under 2ms
each.

### Test isolation via memory-server, not a reset hatch

v5 used a module-scoped Map and a `_resetForTests()` export to
clear state between cases. v6 deletes that hatch. `setupMongo.ts`
runs as a vitest setupFile and provides the lifecycle:
`beforeAll` starts an ephemeral MongoDB and connects mongoose,
`afterEach` clears every collection so test cases never see each
other's data, `afterAll` stops the server. Tests don't have to
remember to clear anything.

## What could be better

### No request id

Pino logs each request through morgan but there's no correlation id
linking a request log to its error log. Adding a request-id
middleware (uuid per request, attached to the pino child logger)
would let me grep one id across access log, app log, and error log.

### Helmet is missing. **Fixed in v7.**

CLAUDE.md mentioned helmet for security headers in v7's plan. v7
adds `app.use(helmet())` at the top of the middleware stack. The
default config covers X-Content-Type-Options, X-Frame-Options,
Strict-Transport-Security (in production), a baseline
Content-Security-Policy, and about a dozen other response headers.

### CORS string vs array. **Fixed in v7.**

v5 used `cors({ origin: env.CORS_ORIGIN })` with a string, which
unconditionally echoes the configured value regardless of the
request's Origin. v7 switches to the array form
(`cors({ origin: [env.CORS_ORIGIN] })`) so cors only echoes the
allowed origin when the request matches it. Same outcome in
practice (the browser enforces either way), but the array form
makes intent explicit on the wire and is easy to extend with a
second deploy URL.

### Schemas duplicate the types. **Fixed in v6.**

In v5, the Debt interface in `src/types/index.ts` and the
`debtSchema` in `src/validators/debts.schema.ts` had to agree
manually. v6 consolidates: the Zod schema is the source of truth
and the type comes from `z.infer<typeof debtSchema>`. Same for
Strategy. `src/types/index.ts` re-exports those types, so existing
import paths still work and stay in sync automatically.

### No structured request body in pino

Morgan's line ends up as a string in the pino message. Pino-http
would log requests as structured fields (method, url, status,
duration as discrete keys). Trade-off: another dependency for a
slightly nicer log shape. CLAUDE.md asked for morgan, so morgan it
is.

### No graceful shutdown. **Fixed in v6.**

In v5, `server.ts` called `app.listen()` and that was it. A
SIGTERM (process manager kill) or SIGINT (Ctrl+C) would terminate
the process mid-request. v6 adds a graceful shutdown handler:
the listener stops accepting new connections, in-flight requests
drain, then mongoose disconnects. Same handler for both signals.

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

## v6: Mongoose

### Storage swap, signatures stay

The whole point of the layered architecture: persistence can change
without the routes, validators, controllers, or error handler
moving. v5 had a module-scoped Map; v6 has Mongoose. The service
exports the same three functions (`listDebts`, `createDebt`,
`deleteDebtById`), but they all return Promises now.

### Async controllers, no try/catch

Express 5 propagates async rejections to the error handler the same
way it does sync throws. So when a controller becomes
`async (req, res) => { ... }` and the service rejects, the existing
error handler middleware catches it. No `try { ... } catch (e) {
next(e); }` boilerplate. Express 4 needed `express-async-errors`
or hand-wrapping to do this.

### UUID `_id` instead of ObjectId

Mongoose's default `_id` is an ObjectId. Switching to ObjectIds in
v6 would break v5's API contract (`id: string (uuid)`), the Zod
validator (`z.string().uuid()`), and any deployed v4 frontend code
that already uses UUIDs. The model overrides `_id`:

```ts
_id: { type: String, default: () => randomUUID() }
```

The persisted document field is still called `_id` (Mongoose
convention) but holds a UUID. `toDebt()` in the model file remaps
`_id` to `id` for API responses, so the controller and clients
never see Mongo's underlying field name.

### Light Mongoose validation

Zod runs at the API boundary and validates shape before any
service call. Mongoose's own validators (`required`, `maxlength`,
etc.) are defense-in-depth, not the primary contract. They're set
on the schema for safety but they should never fire in practice.

### Atlas free tier for dev and prod

`MONGODB_URI` points at MongoDB Atlas's free M0 cluster. Same URI
shape (`mongodb+srv://...`) for dev and the v8 deploy. Tradeoffs:

- M0 is a shared cluster. Latency is 30-100ms vs sub-millisecond
  for a local Mongo. Fine for a planner; would be wrong for a
  high-throughput API.
- Connection string includes the user/password. `.env` is
  gitignored; `.env.example` shows the shape with placeholder
  credentials. Never commit a real one.
- Network allowlist is set to `0.0.0.0/0` for dev so the laptop
  doesn't need a stable IP and Vercel deploys can hit it without
  knowing Vercel's egress addresses ahead of time. Pragmatic
  capstone-tier compromise. v7's security pass focused on
  application-layer headers (helmet, rate limit) and didn't touch
  Atlas network rules; the v8 deploy is the natural place to
  narrow this to known egress IPs.

### Test database is mongodb-memory-server

CI/local test runs never touch Atlas. `mongodb-memory-server` spins
an ephemeral Mongo per test file in <1s after the first run (the
binary downloads once, ~80MB, then caches). Connection lifecycle
lives in `src/test/setupMongo.ts`. Each test file gets a clean
database; each test gets cleared collections.

### Connection lifecycle in server.ts

`connectMongo()` runs before `app.listen()` so the HTTP server
doesn't start taking requests before the driver is ready. Mongoose
internally buffers operations until the connection opens, but a
request that arrived during the buffer would silently stall, which
is worse than refusing to start.

`disconnectMongo()` runs from a SIGTERM/SIGINT handler that first
calls `server.close()` to drain in-flight requests, then closes
mongoose. Without it, a deploy or Ctrl+C would kill in-progress
queries mid-write.

### What v6 still does not do

- No request-id correlation across access log + app log + error log.
  Same gap as v5; pino-http or a custom request-id middleware would
  close it. v7 didn't get to it; carrying forward to v8.
- No connection-string rotation logic. If Atlas credentials change,
  the dev needs to re-set `.env` and restart. Fine for a capstone;
  not what a real production service would do.
- No retries on transient connection failures. Mongoose has built-in
  retryability for some operations, but a complete connection drop
  needs a reconnect strategy. v8 (deploy) is when this matters more.
- Mongoose schema and Zod schema describe the same shape twice.
  Libraries like zod-mongoose or mongoose-to-zod could derive one
  from the other. Adding a dependency to remove ~5 lines of
  duplication isn't worth it yet.

## v7: Authentication and security

### What v7 adds

- POST /auth/register and POST /auth/login
- bcrypt password hashing (cost 12)
- JWT access tokens (15 min default expiration)
- requireAuth middleware enforcing `Authorization: Bearer <token>`
- /debts and /paydown require auth
- /debts scoped per user (cross-user isolation)
- helmet for HTTP security headers
- CORS array form
- Rate limiting on /auth/register and /auth/login (5 per 15 min per IP)

### bcrypt cost 12

Cost 12 is roughly 250ms per hash on a modern laptop. CLAUDE.md
sets a cost-10 floor; 12 is the modern default and the right
balance between brute-force resistance and login-path latency. Any
higher and login starts feeling sluggish; any lower and offline
attacks against a leaked password database get cheaper.

### Dummy-hash defense in login

If the email isn't registered, login still runs `bcrypt.compare`
against a dummy hash that never validates. Same wall-clock time
either way. Without this, an attacker could distinguish "no such
user" from "wrong password" by timing the 401 response (the
no-such-user path would skip bcrypt and return in <5ms). The dummy
hash forces both branches to take ~250ms.

### No refresh tokens (deliberate)

v7 has access tokens only. No refresh-token flow. When the 15-min
token expires, the user logs in again.

The full refresh-token implementation needs token revocation, a
blacklist or version stamp, secure refresh-token storage on the
client, rotation on every refresh, and per-device session
management. That is a real design surface, and v7's scope is
"auth that works." Refresh tokens are deferred to v8+ when the
deployed app's UX makes the short window painful enough to justify
the complexity.

The shorter-window tradeoff: a stolen access token is valid for
the full window. Keeping the window short (15 min) bounds the
blast radius without needing revocation infrastructure.

### IP-based rate limit, not account-based

The 5-per-15-min rate limit on /auth/register and /auth/login is
keyed on the client IP. A distributed attacker rotating source
IPs through a botnet or proxy network defeats it.

The proper defense is account-based lockout: track failed attempts
per email, lock the account (or require additional verification)
after N misses regardless of source IP. v7 ships with the
IP-based defense because it covers the common single-host
brute-force case and ships in one library; account-based lockout
needs a Mongo-backed counter, expiry logic, and unlock UX, which
push it into v8 territory.

### Rate limit skipped in test mode

The 38-test supertest suite registers and logs in many users
back-to-back from the same loopback IP, well above the 5/15min
budget. The limiter calls `skip: () => env.NODE_ENV === "test"`
so the suite runs cleanly. The rate limit's actual behavior under
load isn't covered by the suite as a result.

A future commit can add a dedicated test that builds a separate
Express app with a tighter limit (e.g. 2/15min) and asserts the
3rd request gets a 429. Not in v7 because it would inflate this
commit and the cost-vs-coverage trade leans toward "worth it
later."

### Tests landed at end of v7 rather than per-commit

In a real production codebase I would write the auth service tests
alongside the service, not after. Per-commit tests would have
caught typo-class issues and confirmed each layer worked in
isolation before the next layer landed on top.

For v7's pace I bundled all the tests into a single test commit at
the end. The trade-off was faster iteration through the auth
surface against the discipline of TDD. Mitigation: keeping the
test commit separate from the feature commits makes the gap visible
in git history rather than hidden inside a "wrote feature, also
tests" diff. Future versions should match the per-commit test
pattern v6 used.

### What v7 does not do

- No password reset flow (no email channel set up yet, deferred to v8)
- No email verification on register (same reason)
- No session revocation. A leaked token is valid until expiration;
  there's no blacklist or version stamp to invalidate it sooner.
  Proper fix involves a server-side token store or short-lived
  access + refresh tokens.
- No CSRF protection. JWT travels in the Authorization header, not
  a cookie, so the typical CSRF attack vector doesn't apply.
  Switching to cookie-based auth (which v8 might consider for
  better deployment ergonomics) would put CSRF back on the table.
- No request-id correlation. Still on the v6 carry-forward list;
  not closed in v7 either.

## v8 Phase 2: Deploy

The backend went live on Render and the frontend on Vercel. URLs:

- Backend:  https://debt-paydown-planner-api.onrender.com
- Frontend: https://debt-paydown-planner.vercel.app/

The how-to is in `docs/DEPLOY.md`. This section is the lessons-
learned: what surprised us, what didn't, and what's worth knowing
the next time someone redeploys this project.

### What surprised us

**`npm ci` skipped devDependencies in the production build.** First
deploy attempt failed at the build step. Render sets
`NODE_ENV=production` before running the buildCommand, which makes
`npm ci` skip devDependencies by default. But TypeScript itself
and the `@types/*` packages live in devDependencies, and `tsc`
needs them to resolve types. The build crashed with a stack of
"Cannot find module" errors.

Fix: change `buildCommand` in `render.yaml` to
`npm ci --include=dev && npm run build`. The flag forces
devDependencies to install regardless of NODE_ENV. Runtime
NODE_ENV stays production for pino JSON output, helmet HSTS, and
the morgan combined-format access log.

The fix landed as `fix(v8): include devDependencies in Render
build`. Documented in `docs/DEPLOY.md` under Gotchas and
Troubleshooting.

**Vercel did not auto-detect the Root Directory.** Vercel saw the
repo and the package.json files, but didn't pick `v4-tailwind/` as
the project root automatically. Had to set Root Directory =
`v4-tailwind` manually in the Vercel dashboard before the deploy
would even start. The repo-root preinstall guard
(`scripts/block-root-install.mjs`) would have caught a Vercel
build that ran from the wrong directory, but the failure message
reads as "your install script exited 1" rather than "you forgot
to set Root Directory." Documented in `docs/DEPLOY.md` so the
next person doesn't waste cycles on it.

### What didn't fire (anticipated gotchas that turned out fine)

**Region: virginia accepted on Render free tier.** The yaml
comment named ohio and oregon as fallbacks; neither was needed.
Free-tier region availability shifts; future-self deploying a
fresh project should still confirm in the dashboard rather than
trust this.

**Cold start on the first `/health` after deploy.** The 30-50
second worst case documented in `docs/DEPLOY.md` didn't fire on
the initial post-build request. The container was already warm
from the build process, so the first user-facing request hit a
ready service. The cold-start window only applies after 15
minutes of inactivity, which the deploy moment doesn't qualify
as. The curl-warm-before-demo advice in the deploy guide still
stands for actual demos.

**Atlas allowlist already at 0.0.0.0/0 from v6.** The deploy guide
lists it as a prerequisite to verify; ours was already set from
the v6 development work, so no dashboard change was needed.
Future-self deploying a fresh project: this is real and necessary.

**CORS exact-match (trailing slash, protocol).** The gotcha is
documented, didn't bite. Possibly because the documentation made
it visible enough to avoid; possibly because Vercel's URL is
copy-pasteable and we didn't fat-finger it. Stays in the deploy
guide as anticipatory advice for redeploys.

**Vercel env-var redeploy gotcha.** `VITE_API_URL` got set once
during the initial Vercel project creation and never needed to
change for Phase 2. The "Vercel doesn't auto-redeploy on env
changes" gotcha would matter when the backend URL changes (or if
a value gets corrected after the first deploy). Stays in the
deploy guide as anticipatory advice.

### What's worth knowing for future deploys

- **Render Blueprint, not New Web Service.** Blueprint reads
  `render.yaml`. New Web Service ignores it.
- **JWT_SECRET was generated fresh** via `openssl rand -hex 64`.
  The dev secret stays in `v5-backend/.env` (gitignored) and
  never made it to production.
- **CORS_ORIGIN was set with the placeholder
  `https://placeholder.vercel.app`** during the initial Render
  deploy, then updated to the real Vercel URL after the frontend
  deploy completed. Render auto-redeploys on env-var changes, so
  the cutover was one save in the dashboard.
- **MongoDB URI database name** (`/debt-paydown-planner`) matters
  even in production. Without it Mongoose connects but writes to
  the default `test` database. Verified in production.

That's the v8 Phase 2 record.

## v8 Phase 3: AI debt extraction

The backend exposes `POST /debts/extract`, a Claude-backed endpoint
that takes statement text and returns a list of structured debt
objects for the frontend to review before saving. Live behind
`requireAuth` and a per-user rate limit. Lives entirely server-side
behind the existing /debts router.

### Tool use, not prompt-only JSON

The extraction service uses Anthropic's tool-use feature instead of
asking the model for JSON in a free-text reply. The tool's
`input_schema` constrains the model up front: the API rejects
output that doesn't match the schema before we ever see it, which
catches a class of hallucinations (extra keys, wrong types, model
prose mixed in) automatically.

Prompt-only JSON works in many models but drifts. With tool use,
the model is required to emit a structured tool-call payload or
nothing at all. `tool_choice: { type: "tool", name: "save_debts" }`
forces it.

We Zod-parse the tool input afterward anyway. The JSON Schema can't
express "balance must be positive" or "name max 40 chars"; Zod
does. Defense in depth.

### Why claude-haiku-4-5

Three reasons:

- Cost: Haiku is the cheapest in the 4.x family. Extraction is a
  high-frequency feature (a user might paste several statements);
  Sonnet pricing would put real friction on the rate limit budget.
- Latency: Haiku responds noticeably faster than Sonnet. The UI
  shows "Parsing..." during the call; shorter is better.
- Capability: Haiku 4.5 is plenty for structured-extraction-from-text.
  Smoke tested with a multi-debt statement plus a deposit-account
  decoy line; it returned the right debts and skipped the decoy on
  the first attempt.

Pinned to the dated `claude-haiku-4-5-20251001` snapshot rather
than the floating `claude-haiku-4-5` alias. Snapshot pinning means
production behavior doesn't shift when an alias rolls forward.
Trade-off: model improvements don't reach production until a
deliberate version bump.

### Prompt design choices

The system prompt is short on purpose. Each line earns its place:

- **"balance/rate/minPayment are numbers"**: LLMs sometimes return
  `"$5000"` (string, with currency symbol) because that's how
  source statements display the value. Forcing numbers at the
  prompt level keeps the parsing on the model's side.
- **"rate as 24, not 0.24"**: APR is conventionally written as a
  percent, but models occasionally normalize to a decimal because
  they were trained on math contexts that prefer fractions. Naming
  the convention explicitly stops the second guess.
- **"skip non-debt lines"**: deposit accounts, transactions, and
  page headers all look statement-like. Without the rule the model
  pulls them in as zero-balance entries.
- **"empty array if no debts"**: prevents the model from
  hallucinating a default debt to fill the schema.
- **`minPayment` optional**: not every statement shows it. Forcing
  the model to invent a value would either pollute the data or
  push the model toward refusing the entire extraction.

Refining the prompt is cheap and the model honors instructions
faithfully when they're concrete. These choices held up in the
live smoke test.

### Prompt-injection defense

The threat model is unusual for an LLM-backed feature: the user is
both the attacker and the victim. Debts are scoped per user, so
malicious extracted output only pollutes the attacker's own data.
There is no cross-user attack surface and no privilege escalation
to gain. The defense is still worth doing because:

- The user can be tricked by their own paste (a statement that
  contains adversarial text added by a third party).
- Tooling that handles user input as instructions sets a poor
  habit if it ever gets reused for a higher-stakes feature.

Three defense layers are wired:

**Layer 1: delimiter wrapping.** User text is wrapped in
`<statement>` tags before being sent to the model. The system
prompt names this delimiter and labels its contents as data.

**Layer 2: system prompt hardening.** Two lines explicitly tell
the model the wrapped contents are data, not instructions, and
to ignore any instruction-shaped lines that appear inside.

**Layer 3: review-before-save.** The endpoint returns the
extracted debts; nothing persists until the user clicks "Add this
debt" on each row in the frontend's review UI. Even if layers 1
and 2 fail, the user has to physically confirm a fabricated debt
before it lands in storage.

What was considered and deferred:

- **Output-vs-input validation** (re-prompt the model with the
  output and ask if it looks coherent). Adds latency and token
  cost; the review-before-save layer covers the same outcome at
  zero model cost.
- **Constitutional AI patterns** (a second model call evaluating
  the output for instruction-following). Same cost concern, plus
  more moving parts.
- **Delimiter-collision protection.** A user paste containing a
  literal `</statement>` tag could close the wrapper early. The
  defense is to strip or escape the literal in user input before
  wrapping. Not implemented; the failure mode is the model would
  treat trailing input as instructions, but layers 2 and 3 still
  catch the abuse. Documented for a future hardening pass.

### Per-user rate limit, keyed on userId

`extractionRateLimit` in `src/middleware/rateLimit.ts` allows 10
requests per user per hour, keyed on `req.userId` rather than IP.

Why userId: the endpoint is behind `requireAuth`, so userId is
always set by the time the limiter runs. IP-keying would let one
user share quota with anyone else on their network (false
friction) and let one user bypass quota by switching networks
(false ceiling). userId is the unit of cost so it's the unit of
quota.

Why 10/hour: realistic use is 1-3 extractions per session — paste
a statement, review, save. 10/hour is generous enough to avoid
friction during demos and normal use, tight enough to bound the
worst-case cost. At Haiku 4.5 pricing, 10 requests per hour for
24 hours is roughly $0.36/user/day in the worst case. Bursty
real-world usage (statement-paste a few times a week) sits well
below that.

The keyGenerator falls back to `ip:<ip>` if userId is somehow
unset. Defensive: should never fire in practice, but returning an
empty string would defeat the limiter, and an IP fallback at least
preserves the rate limit if a future route gets misconfigured.

Skipped in test mode for the same reason `authRateLimit` is.

### Anthropic SDK is mocked, not stubbed, in tests

Vitest mocks `@anthropic-ai/sdk` per-file via `vi.mock`. The mock
is a class because the SDK's default export is invoked with `new`,
and `vi.fn(() => ...)` arrow factories aren't constructable.
`mockCreate` is hoisted via `vi.hoisted` so it's available before
any imports.

App-level supertest tests (`app.test.ts`) deliberately don't mock
the SDK. They cover only the auth and validation layers of
`/debts/extract`, which fail before the controller runs and so
never reach the SDK. The success-case path stays in
`extraction.service.test.ts` where the mock is set up. Splits the
SDK setup so it lives in exactly one place.

### What didn't fire (anticipated gotchas that turned out fine)

- **Token type confusion**: the model returned plain numbers from
  the smoke test, no string-vs-number ambiguity to handle.
- **Decimal-vs-integer rate**: came back as 21.99 and 18.49 (not
  0.2199 / 0.1849) on the first try, matching the prompt rule.
- **Deposit-account false positive**: a Bank of America Checking
  line in the smoke input was correctly skipped.
- **Missing minPayment handling**: when the source statement
  didn't list a minimum, the field was omitted from the response
  rather than invented. Optional Zod field accepted it cleanly.

### What v8 Phase 3 still does not do

- **PDF upload**. Text-input only for v8. PDF support would need
  either the Anthropic Files / vision API (sends the PDF binary
  as part of the prompt, model reads it natively) or an OCR
  pre-step. Documented as a deferred feature; v9+ if user demand
  warrants. Adding it later is additive; the existing /debts/extract
  endpoint stays.
- **Image upload (statement screenshots)**. Same reason as PDF.
  Vision API would handle this too.
- **Streaming responses**. The endpoint blocks for the model's
  full response (1-3 seconds typical). Streaming the tool-call
  output incrementally would let the frontend render rows as they
  arrive. Negligible latency win for a 3-second call; not built.
- **Cost telemetry per user**. The rate limit bounds spend, but
  the app doesn't track per-user token usage. A real product
  rolling AI features would expose usage in the user's settings
  and cap by dollars not requests.
- **Re-prompt-on-bad-output**. If Zod rejects the tool input, the
  service throws ExtractionError immediately. A retry pass with
  feedback to the model could recover, but adds latency and token
  cost for an edge case that hasn't fired yet.
- **Delimiter escaping** (see Prompt-injection defense above).

That's the v8 Phase 3 backend record.

## v8 Phase 4: Staff dashboard

The backend exposes `GET /staff/summary`, an aggregate-only endpoint
gated by `requireAuth + requireStaff`. Returns user counts, debt
totals, average APR, and a debt-count distribution. Nothing in the
response identifies an individual user. Promotion to staff is a
manual database operation, not a self-service flow.

### Role lives on the User schema, not a separate roles table

A second collection (`roles`, joined by user id) was rejected. v8
has two roles (`user`, `staff`), no plans for a multi-role
hierarchy, and no use case for a user holding multiple roles at
once. A separate collection would carry a join cost on every
auth-gated request to satisfy a flat enum.

The schema field:

```ts
role: {
  type: String,
  enum: ["user", "staff"],
  default: "user",
  required: true,
}
```

`enum` is the contract; Mongoose rejects writes that don't match.
`default: "user"` covers two cases: a fresh registration via
`/auth/register` (which doesn't set role explicitly), and any pre-
Phase-4 user document that exists in Mongo without a role field
at all. `toUserPublic` mirrors the safety net at the read side
with `role: doc.role ?? "user"` so a legacy document loads
without crashing the controller.

Promotion is `db.users.updateOne({ email }, { $set: { role:
"staff" } })`. No demotion route. To demote a staff user, set
role back to `"user"` the same way.

### Aggregate service, not raw queries in the controller

`/staff/summary`'s controller is one line: call
`getStaffSummary()` from the aggregate service, return its
result. All the Mongoose aggregation pipelines live in
`src/services/aggregate.service.ts`.

The service runs three pipelines in parallel via `Promise.all`:

- **Users**: `$group` on a constant key with `$min` and `$max`
  on `createdAt`, plus `$sum: 1` for total. One round-trip to
  the users collection.
- **Debts**: `$group` on a constant key with `$sum: "$balance"`,
  `$avg: "$rate"`, and `$sum: 1` for total count. One round-
  trip to the debts collection.
- **Distribution**: a two-stage pipeline. First `$group` on
  `userId` to get `{ _id: userId, count: <debtCount> }`; then
  in JS, bucket those counts into 1-2 / 3-5 / 6+. The "0 debts"
  bucket is computed in JS as `userCount -
  userDebtCounts.length`, since users with zero debts don't show
  up in the `$group` output at all.

Why a service rather than letting the controller call Mongoose
directly: the aggregation logic is the part that needs unit
coverage (the leak canary plus the bucket-math), and a service
function is straightforward to call from a test without spinning
up Express. Same shape as `paydown.service` and
`extraction.service`.

### Promotion is manual on purpose

There is no `/auth/promote` route. Granting staff is a privileged
operation that affects who can read aggregate data; self-service
promotion would require a separate admin role to gate it, and a
capstone with one staff user doesn't earn that ladder.

The flow: a developer with access to the Atlas cluster runs an
update on the `users` collection, setting `role: "staff"` for a
specific email. Two ways to do it.

**Option A: mongosh against Atlas.** From a shell with the same
`MONGODB_URI` the backend uses:

```sh
mongosh "$MONGODB_URI"
```

Then in the shell:

```js
db.users.updateOne(
  { email: "person@example.com" },
  { $set: { role: "staff" } }
)
```

The matched/modified count comes back inline. A modified count of 1
means the role flipped; 0 means the email didn't match (typo,
wrong cluster, or the user hasn't registered yet).

**Option B: Atlas Data Explorer UI.** For non-CLI sessions:

1. Atlas dashboard, Browse Collections on the cluster
2. Pick the database (`test` in production, `debt-paydown-planner`
   in local dev — see "Database name mismatch" below), then `users`
3. Filter: `{ email: "person@example.com" }`
4. Edit the matched document, change `role` from `"user"` to
   `"staff"`, save
5. If the doc has no `role` field at all (legacy registration
   before the field landed), add the key manually before saving

After promotion, the affected user signs out and back in. The
backend reads the role fresh from Mongo on every request, so a
restart isn't required, but the frontend caches the user object
returned at login. Re-login refreshes the cached role and the
Planner/Staff toggle appears.

For the deploy-time variant of this (promoting the first staff
user against the production cluster, including the database-name
gotcha), see `docs/DEPLOY.md` § "Promote the first staff user"
and the matching troubleshooting entry "Staff toggle doesn't
show after promoting a user."

### Why fresh DB lookup in requireStaff

`requireStaff` queries `User.findById(req.userId)` on every
request rather than reading the role off the JWT payload. The
JWT only carries `userId`. Two reasons:

- **Revocation**. If a staff member is later demoted, putting the
  role in the JWT means the old token still grants staff access
  until expiration (15 min). The DB lookup loses the cache hit but
  gains immediate revocation.
- **Token shape stability**. Adding role to the JWT is a breaking
  change to existing tokens; users with valid sessions would need
  to re-login after the deploy. Not worth the migration for a 15-
  minute window.

The cost is one extra Mongo round-trip per `/staff/*` request.
Acceptable: staff endpoints are low-traffic (one developer
checking a dashboard occasionally), not the hot path.

### Aggregate-only invariant

The `/staff/summary` response is reviewed every commit to make
sure no field could leak individual data. Today's response carries
totals, averages, distribution buckets, and the earliest/latest
signup dates. Nothing identifies a user.

The leak canary test (`staff/summary leak canary` in `app.test.ts`)
seeds a user with an obviously unique email and debt name (random
UUID tokens), hits `/staff/summary` as a staff caller, then asserts
`JSON.stringify(res.body)` contains none of the canary tokens or
either user id. If a future field accidentally surfaces individual
data, the canary catches it before merge.

The frontend banner ("Aggregate data only no individual customer
information is displayed") is a soft check. The load-bearing
guarantee is the canary test; the banner is the user-facing
reminder.

### Signup-range precision tradeoff

`users.earliestSignup` and `users.latestSignup` are exact ISO
timestamps. With developer-controlled accounts only (the v8 deploy
has a handful of test users we created ourselves), exact dates are
fine: nobody's privacy is implicated by knowing when our own test
accounts registered.

If v9 opens external testing or any non-developer signup flow, the
precision becomes a soft information leak. Two mitigations to
consider before that point:

- **Month granularity**: round both timestamps to the first of the
  month before returning. Coarser than ISO but still useful for
  "how long has this product been collecting users."
- **Threshold-gating**: only return the range when total users
  exceeds some N (say, 10). Below the threshold, return null.
  Prevents the case where one or two users could be identified by
  their signup time.

Either approach is a one-line service change; not building it now
because the threat model doesn't apply yet, and shipping a
defense-in-depth against a non-existent attack is the kind of
hypothetical-future-requirement work CLAUDE.md tells me to skip.
Documented here so the v9 work picks it up if external testing
arrives.

### Database name mismatch (carry-forward to v9)

Production and local dev are pointed at different databases inside
the same Atlas cluster:

- **Production** (Render): `MONGODB_URI` ends at the cluster host,
  with no `/<db>` path segment. Mongoose defaults the database
  name to `test` in that case, so all production users and debts
  live in the `test` database.
- **Local dev**: `.env` sets the URI with `/debt-paydown-planner`
  appended, so dev writes go to a separate, properly named
  database in the same cluster.

The v8 Phase 2 note above ("MongoDB URI database name matters
even in production. Without it Mongoose connects but writes to
the default `test` database. Verified in production.") flagged the
risk but the actual production env var was set without the path
segment, so prod ended up in `test` anyway. Both copies of the
data are real; no migration was attempted.

Practical impact today: when running staff promotion against
production, the database in Atlas Data Explorer is `test`. When
running it locally, the database is `debt-paydown-planner`. Same
collection name (`users`) in both.

For v9: unify by adding the `/debt-paydown-planner` path segment
to Render's `MONGODB_URI` and migrating the existing `test`
documents into the named database. The migration is a one-shot
mongosh script (insertMany from `test` into `debt-paydown-planner`,
then drop the source collections), but it's a coordinated change
that needs the deploy URI updated in lock-step. Out of scope for
v8; documented so v9 picks it up.

### Test count after Phase 4

Backend test suite is 55 tests across the existing files plus the
Phase 4 additions (`requireStaff` middleware tests and the
`/staff/summary` route tests including the leak canary). Suite
runs in ~3s, same as Phase 3.

### What v8 Phase 4 still does not do

- **Audit log for staff access**. The dashboard logs the request
  through morgan but doesn't write a structured audit row ("staff
  user X read aggregates at time Y"). For a real product with
  privileged data access, that audit trail is the compliance
  artifact. v9+ if the dashboard surface grows.
- **Per-staff-user permission scopes**. Today it's a binary
  user/staff role. A real lending product would want at least
  read-only-aggregates vs. read-individual-account, and probably a
  third tier for ops actions. Single role is sufficient for the
  one dashboard view in v8.
- **Server-driven role changes via API**. As above, promotion is
  intentionally manual. A `/auth/promote` route gated by an admin
  role is the natural extension if a v9 admin surface needs it.

## v9: Hardening pass

A pass closing security and operational gaps surfaced by code review:
DoS hygiene (body limit, input bounds, paydown rate limit), register
enumeration (atomic per-email counter), JWT shape check, and an audit
pass on logging and security headers. Each landed as a separate small
commit with tests.

### Threat model

Lays out the realistic threats this app faces and the mitigations in
place. The residuals are documented honestly so future work has a
clear list of what's not covered.

**Scope and assumptions.** This threat model covers the deployed
web application as it exists in v9. It assumes the deployment
platform (Render, MongoDB Atlas, Vercel) is trusted, the developer's
GitHub account is trusted, and secrets stored in Render env vars
are not visible to attackers without compromising Render itself.
Out of scope: supply-chain attacks on npm dependencies,
infrastructure-level threats below the application layer, and
social engineering of the developer.

**Credential stuffing.** Attacker submits stolen email/password pairs
to `/auth/login`. Mitigations: bcrypt cost 12 makes each guess cost
~250ms of CPU; `authRateLimit` caps a single IP at 3 attempts per
hour. Residual: distributed credential stuffing across many IPs is
slowed but not stopped. No 2FA, no leaked-password check against a
HIBP-style list.

**Email enumeration on login.** Different responses or different
response times for "email exists, password wrong" vs. "no such email"
let an attacker check whether an email has an account. Mitigations:
identical 401 message either way; the dummy bcrypt hash in
`auth.service.ts` runs against the wrong-password input when no user
is found, so the wall-clock time matches the real-user case. Residual:
the timing equivalence depends on bcrypt's cost factor remaining the
same for both the dummy hash (computed at module load) and real
password hashing. A future change to `BCRYPT_COST` would update both
at restart. The defense is brittle in the sense that it depends on
this invariant being maintained by code structure rather than
enforced by tooling.

**Email enumeration on register.** A 409 on duplicate email tells the
attacker the email exists. Mitigations: `authRateLimit` (IP-keyed)
plus the per-email atomic counter in `RegisterAttempt` (cross-IP, 3
per email per 24h). After the cap, every attempt returns 429 instead
of 409. Residual: the 409 itself before the cap is reached still
leaks one bit per attempt; the rate limits make extraction slow but
not impossible. The proper fix is email verification: register always
returns 202, account stays pending until activated. Out of scope here
because it requires a transactional email provider.

**DoS via expensive endpoints.** A single client driving the
calculator or the extraction model in a loop ties up the event loop.
Mitigations: `express.json` limit at 32kb (parse-time cap); upper
bounds on `/paydown` inputs (50 debts, $1M budget, $10M balance, 100%
rate); `paydownRateLimit` at 60/min per user; `extractionRateLimit`
at 10/hour per user. Residual: the limits cap blast radius per user
but don't address coordinated traffic across many accounts. Render's
free tier is the deployment-side floor. The extraction endpoint also
has a per-call AI cost dimension that the rate limits don't fully
cap — many accounts each making 10 calls/hour could still drive
cumulative API spend; the Anthropic-side deployment budget is the
secondary backstop.

**Prompt injection on `/debts/extract`.** Pasted statement text could
contain instructions targeting the model.

Mitigations:

- System prompt declares `<statement>` content as data-only
- `tool_choice` forces the model to produce a structured tool call
  regardless of free-text prose
- Hint layer strips literal `</statement>` from input before wrapping
- Human-in-the-loop review on the frontend before any debt is saved

Residual: the model could still skip rows or merge accounts
incorrectly under adversarial inputs; the human-in-the-loop review
is the load-bearing defense for that class.

**Token theft.** A stolen JWT is valid until expiry. Mitigations:
15-minute access token TTL; no refresh tokens, so the attacker has to
re-steal after each cycle; `JWT_SECRET` rotation invalidates all
outstanding tokens at once (procedure documented under "Secret
rotation" below). Residual: no revocation list. A stolen token is
valid for up to 15 minutes after the user notices, until they rotate
the secret.

**PII in logs.** Server logs are visible to anyone with Render
access. If logs include customer debt narratives, balances, or
email addresses, that's a compliance issue at a regulated lender.
Mitigation: audited every `logger.*` call and every `throw new
Error(...)` site for customer-data interpolation; sanitized findings
to log structural facts (debt counts, durations, UUIDs) instead of
values. Residual: the rule is enforced by reviewer judgment, not
tooling. A pre-commit grep for `throw new Error\(.*\$\{` would
automate detection of the most common regression pattern.

**CSRF.** A malicious site triggers state-changing requests using a
logged-in user's credentials. Mitigations: the JWT lives in
`Authorization: Bearer ...`, not a cookie, so a cross-site request
can't ride along with an existing session. CORS is pinned to the
single configured frontend origin via `env.CORS_ORIGIN`. Residual:
if the frontend ever moves to cookie-based auth the app needs a
CSRF token mechanism; it does not have one today.

### PII logging audit

Read-only pass through `src/` to map what could end up in log files.
Five logger call sites, none log user data:

- `server.ts`: startup port, shutdown signal.
- `mongo.ts`: connection lifecycle.
- `requestLogger.ts`: pipes morgan into pino. Morgan `combined` logs
  method, URL, status, content-length, referrer, user-agent. URLs
  carry UUID `:id` params only; sensitive data is in POST bodies,
  which morgan doesn't log.
- `errorHandler.ts`: `logger.error({ err }, "Unhandled error")` only
  fires on non-AppError throws, so handled errors (auth, validation,
  conflict, etc.) never reach it. AppError messages are hardcoded
  except for `Debt ${id} not found` where `id` is a UUID.

Statement text from `/debts/extract` is wrapped and sent to
Anthropic but never logged. Anthropic SDK errors don't carry the
original request body, so a network failure on that call doesn't
leak the wrapped text either.

Forward rule: error messages stay hardcoded or interpolate UUIDs
only. If a future change interpolates user input into a thrown
message, this audit needs to be redone.

### Helmet header audit

curl -I against the live api, diffed against helmet 8 source. All
defaults reach the client through Render and Cloudflare. Headers
verified: CSP, HSTS (365 days, no preload directive), COOP, CORP,
COEP (unset by helmet default since v7), Origin-Agent-Cluster,
Referrer-Policy, X-Frame-Options, X-Content-Type-Options,
X-XSS-Protection.

Two non-trivial defaults left in place:

- CSP `style-src` includes `'unsafe-inline'`. Recharts emits inline
  styles for chart elements; tightening would break the dashboard
  and the strategy comparison charts.
- COEP unset. Requiring CORP/CORS on every embedded resource is too
  aggressive for an app that loads images and external fonts.

HSTS preload is opt-in (the domain has to be submitted to the preload
list and the directive added to the helmet config). Out of scope here.

Conclusion: helmet defaults match this app's threat model. No code
change.

### Secret rotation

Two production secrets, both live in Render env vars:
`JWT_SECRET` (signs and verifies access tokens) and
`ANTHROPIC_API_KEY` (authenticates the extraction call to Claude).
There's no KMS or vault layer at this scale; the env var IS the
storage. The procedures below assume Render is the source of truth
and that the rotator has dashboard access.

**JWT_SECRET rotation.**

1. Generate a new secret: `openssl rand -base64 64`.
2. Paste into Render's env var for the API service. Save.
3. Render auto-restarts the service (about 30 seconds).
4. All existing JWTs become invalid the moment the new process is
   serving requests. Users see a 401 on their next authenticated
   request and re-login.

During the ~30 second restart window, in-flight requests may
complete against the old secret. Once the new process is serving
traffic, all old JWTs are rejected. There's no graceful overlap
window where both secrets are accepted; this is acceptable because
the worst case is "user sees one 401 and re-logs in."

User-visible impact is bounded by the 15-minute access token TTL
even without rotation; a forced rotation just collapses that window
to "instantly." Since there are no refresh tokens, there's nothing
else to revoke.

**ANTHROPIC_API_KEY rotation.**

1. In the Anthropic console, create a new API key on the same
   project. Spend limits stay attached to the project, not the key.
2. Update `ANTHROPIC_API_KEY` in Render. Save.
3. Render auto-restarts.
4. In the Anthropic console, revoke the old key.

No user-visible impact. The extraction endpoint may serve a single
in-flight request with the old key around the restart boundary;
that request either completes or fails with the standard
ExtractionError envelope.

**If a secret is suspected leaked.** Rotate immediately rather than
investigating first. Investigation runs in parallel with the
restart, not before it. The 30-second restart window is small
relative to the time to confirm a leak.
