# v9 Hardening

A pass closing security and operational gaps surfaced by code review:
DoS hygiene (body limit, input bounds, paydown rate limit), register
enumeration mitigation (atomic per-email counter), JWT shape check,
and an audit pass on logging and security headers. Each landed as a
separate small commit with tests. This document is the integrated
artifact: threat model, audit results, secret rotation procedure,
calculator-duplication tradeoff, and the items that were explicitly
considered and deferred.

For per-version architectural decisions across v5 through v8, see
`v5-backend/NOTES.md`. For the system diagram and request flows,
see `docs/architecture.md`. For deployment, see `docs/DEPLOY.md`.

## Threat model

Realistic threats this app faces, the mitigations in place, and the
residuals that aren't covered.

**Scope.** Covers the deployed app at v9. Trusts Render, MongoDB
Atlas, Vercel, and the developer's GitHub account. Out of scope:
npm supply-chain, infrastructure below the app layer, social
engineering.

**Credential stuffing.** Stolen email/password pairs against
`/auth/login`. bcrypt cost 12 (~250ms per guess) plus `authRateLimit`
at 3/hour per IP. Residual: distributed across many IPs is slowed
not stopped. No 2FA, no HIBP-style leaked-password check.

**Login enumeration.** Different responses or timings for "wrong
password" vs. "no such email" leak account presence. Identical 401s
either way, plus a dummy bcrypt hash that runs when no user is
found so wall-clock time matches the real case. Residual: the
timing match depends on the dummy hash and real hashing sharing
`BCRYPT_COST`. The invariant is maintained by code structure, not
tooling.

**Register enumeration.** A 409 on duplicate email leaks existence.
`authRateLimit` (IP-keyed) plus a per-email atomic counter in
`RegisterAttempt` (cross-IP, 3 per email per 24h, returns 429 after
the cap). Residual: each attempt before the cap still leaks one bit.
The proper fix is email verification (202 regardless of email
status, account pending until activated), out of scope because it
needs a transactional email provider.

**DoS via expensive endpoints.** `express.json` limit at 32kb;
`/paydown` bounds (50 debts, $1M budget, $10M balance, 100% rate);
`paydownRateLimit` at 60/min/user; `extractionRateLimit` at
10/hour/user. Residual: limits cap per-user blast radius but not
coordinated traffic across many accounts. The extraction endpoint
also has a per-call AI cost dimension that rate limits don't fully
cap; the Anthropic project budget is the secondary backstop.

**Prompt injection on `/debts/extract`.** Pasted text could carry
instructions targeting the model.

- System prompt declares `<statement>` content as data-only
- `tool_choice` forces structured output regardless of free-text
- Hint layer strips literal `</statement>` from input
- User reviews each extracted debt on the frontend before saving

Residual: the model could still misclassify or merge accounts under
adversarial inputs; the human-in-the-loop review is load-bearing
for that class.

**Token theft.** Stolen JWT is valid until expiry. 15-minute access
TTL, no refresh tokens (attacker has to re-steal each cycle),
`JWT_SECRET` rotation invalidates everything outstanding (procedure
under "Secret rotation"). Residual: no revocation list. A stolen
token works for up to 15 minutes after the user notices, until they
rotate.

**PII in logs.** Logs visible to anyone with Render access. Audited
every `logger.*` call and every throw site for customer-data
interpolation; sanitized findings to log structural facts only
(counts, durations, UUIDs). Residual: enforcement is by reviewer
judgment, not tooling. A pre-commit grep for `throw new
Error\(.*\$\{` would automate the most common regression pattern.

**CSRF.** Malicious site triggers state changes using a logged-in
user's credentials. JWT lives in the `Authorization` header (not a
cookie), so cross-site requests can't ride along; CORS pinned to
`env.CORS_ORIGIN`. Residual: needs a CSRF token mechanism if the
frontend ever moves to cookie auth. None today.

## Helmet header audit

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

## PII logging audit

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

## Secret rotation

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

## Calculator duplication, considered and deferred

The paydown calculator (~200 lines: avalanche, snowball, and the
month-by-month schedule loop) lives in two places:

- `v5-backend/src/utils/paydownCalculator.ts` runs on POST /paydown.
- `v4-tailwind/src/utils/paydownCalculator.ts` runs client-side in
  `StrategyComparison` so both strategies render without a round
  trip.

Both copies are tested independently. They're the same code today,
but nothing prevents them from drifting.

Dedup options considered:

- **Shared package via npm workspaces.** The architecturally clean
  option. The cost is real: Render's deploy config has to learn how
  to install workspaces from the repo root, and the shared package
  has to ship as compiled JavaScript instead of TypeScript source
  so the backend's stricter module resolution can import it. Both
  changes can break the live demo and would need careful testing.
- **Shared file at the repo root.** Both apps import from
  `../shared/paydownCalculator.ts`. Vite (the frontend bundler)
  expects files inside the project root and doesn't handle this
  layout cleanly. Workable but rough to read.
- **Copy at build time.** A script copies the canonical source into
  both apps before each build. Easy to set up, easy to forget, easy
  to break.

Chose to leave the duplication in place. The dedup saves ~200 lines
but introduces build complexity and deploy risk. The independent
test suites catch divergence in CI, which is the real risk worth
controlling. Revisit if the calculator grows past ~500 lines or a
third consumer appears.

## What's explicitly not done

Items that came up during the v9 pass and were considered, then
deferred. Each gets a sentence on the technical reason. Documenting
non-decisions is itself part of the artifact: it's the difference
between "we hadn't thought about it" and "we thought about it and
chose not to."

- **No npm workspaces migration.** Covered under calculator
  duplication above. Same reasoning applies to any other "shared
  module" need that comes up later.
- **No fork to a parallel v9-hardening folder.** v6, v7, and v8 are
  in-place modifications to v5-backend. v9 follows the same
  pattern. Forking would double the maintenance burden and force a
  deploy switch. Git tags preserve the version history without
  duplicate source trees.
- **No migration off Render.** Render works. Free-tier cold start
  (30-50 seconds on first request after idle) is documented in the
  README. Migrating to a different host for hypothetical workspace
  compatibility is not engineering work.
- **No lazy or literal dummy hash optimization.** The `await
  bcrypt.hash(...)` at module load adds ~250ms to cold start. On
  a free-tier host where the cold start is already 30-50 seconds,
  250ms is rounding error. Optimizing it adds complexity (literal
  in source needs justifying, lazy init needs concurrency safety)
  for no measurable user benefit.
- **No email verification flow.** Would close both the 409 and 429
  enumeration channels by returning a generic 202 regardless of
  email status. Adding a transactional email provider is real
  scope. The current rate limits make the residual channels
  impractical at this scale.
- **No wide frontend test coverage.** The error boundary has tests.
  The calculator is covered by backend tests. Adding many shallow
  component tests would push coverage numbers without catching the
  regressions that actually matter.
- **No JWT verify error binding.** The `} catch {` in
  `requireAuth.ts` drops the verify error. Adding `} catch (err) {`
  with `logger.debug({ err }, ...)` is fine but doesn't change
  behavior or the audit findings. Skipped because it's churn, not
  hardening.
- **No tsconfig strictness changes.** Both apps already use
  TypeScript 6 strict mode. Changing flags during a hardening pass
  invites regressions unrelated to the pass goals.
