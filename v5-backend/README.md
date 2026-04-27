# v5 / v6 / v7 - Express Backend with MongoDB and Auth

Per the project roadmap, v6 and v7 modify v5-backend in place rather
than getting their own folders. v5 stood up the layered API with
in-memory storage. v6 swapped the in-memory Map for MongoDB via
Mongoose. v7 added authentication, per-user scoping on debts, and a
security middleware pass.

## What this is

A REST API for debt CRUD and paydown calculation, written in
TypeScript on Express 5 with the layered architecture (routes,
controllers, services, models). Same calculator math as v4, now
backed by MongoDB and gated by JWT auth.

This is a standalone project. It does not consume the v4 frontend
and v4 does not call this API yet. You exercise it with curl, an
HTTP client, or the test suite.

## What it does

- `GET /health` returns `{"status":"ok"}` for liveness probes
- `POST /auth/register` creates a user with a bcrypt-hashed password
- `POST /auth/login` returns a JWT access token (15 min by default)
- `GET /debts` lists the authenticated user's debts
- `POST /debts` creates a debt for the authenticated user
- `DELETE /debts/:id` removes one of the authenticated user's debts
- `POST /paydown` accepts `{debts, budget, strategy}` and returns
  the schedule (avalanche or snowball)
- Centralized JSON error envelope across every error response
- Zod validation in front of every input-taking route
- Pino structured logging plus morgan request logging
- CORS pinned to the configured frontend origin (array form)
- Helmet for HTTP security response headers
- Rate limiting on `/auth/register` and `/auth/login` (5 per 15 min)
- Env config validated at boot with Zod
- MongoDB persistence via Mongoose with UUID `_id`s
- Graceful shutdown on SIGTERM/SIGINT
- 38 tests across the calculator, services, and end-to-end via
  supertest, all running against an ephemeral mongodb-memory-server
  instance

## What this version does NOT include

Belongs to later versions:

- Refresh tokens (deferred — v7 has access tokens only)
- Account-based lockout (deferred — current rate limit is IP-based)
- Password reset flow
- Email verification on register
- Production deployment - v8
- AI-assisted debt extraction - v8
- Staff dashboard - v8
- The v4 frontend calling this API - v8

## How to run

You will need a MongoDB connection string. For dev, the easiest
path is MongoDB Atlas's free M0 tier:

1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create an M0 cluster
3. Database Access: add a user with a password (save it)
4. Network Access: allow `0.0.0.0/0` for dev (revisit before prod)
5. Cluster -> Connect -> Connect your application -> copy the
   `mongodb+srv://...` URI
6. Append a database name before the `?`:
   `.../debt-paydown-planner?retryWrites=...`

You also need a JWT signing secret. Generate one:

```
openssl rand -hex 64
```

Then:

```
cd v5-backend
cp .env.example .env
# edit .env: paste your real MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

The server listens on `http://localhost:3001` by default. Override
with the `PORT` env var. The dev script is `tsx watch`, so saves
trigger a rebuild and restart.

## How to test

```
npm test            # one-shot
npm run test:watch  # vitest UI
npm run typecheck   # tsc --noEmit
```

Tests use `mongodb-memory-server`, which starts an ephemeral local
MongoDB. No Atlas needed for tests; the suite never reads a real
`MONGODB_URI`. First run downloads ~80MB of MongoDB binaries (once);
subsequent runs use the cache.

Rate limiting is skipped when `NODE_ENV=test` so the supertest suite
can register and log in many users without tripping the per-IP
budget. See NOTES for the rationale.

## How to deploy

Render reads `render.yaml` at the repo root and provisions the
backend service. See [docs/DEPLOY.md](../docs/DEPLOY.md) for the
full guide (prerequisites, dashboard steps, the
`npm ci --include=dev` build-command requirement, the cold-start
behavior, and the troubleshooting list).

## Endpoints

### `GET /health`

```
$ curl http://localhost:3001/health
{"status":"ok"}
```

### `POST /auth/register`

```
$ curl -X POST http://localhost:3001/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com","password":"some-password"}'
{"id":"...","email":"you@example.com","createdAt":"..."}
```

Returns 201. Duplicate email returns 409. Invalid body returns 400.

### `POST /auth/login`

```
$ curl -X POST http://localhost:3001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com","password":"some-password"}'
{"user":{"id":"...","email":"you@example.com","createdAt":"..."},"token":"eyJ..."}
```

Returns 200 with a JWT access token. Wrong password or nonexistent
email returns 401 (same shape, same timing — login does not leak
which case it was).

### `GET /debts`

Requires a Bearer token from `/auth/login`. Returns only the
authenticated user's debts.

```
$ curl http://localhost:3001/debts \
    -H "Authorization: Bearer <token>"
[]
```

### `POST /debts`

```
$ curl -X POST http://localhost:3001/debts \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"name":"Visa","balance":5000,"rate":20,"minPayment":100}'
{"id":"...","name":"Visa","balance":5000,"rate":20,"minPayment":100}
```

The debt is automatically scoped to the authenticated user. The
internal `userId` field is never returned.

### `DELETE /debts/:id`

```
$ curl -X DELETE http://localhost:3001/debts/<uuid> \
    -H "Authorization: Bearer <token>"
# 204 No Content
```

Returns `404 not_found` if the id does not exist OR belongs to
another user. Same response either way to avoid leaking ownership.

### `POST /paydown`

Requires auth (the calculator should not be drivable anonymously).

```
$ curl -X POST http://localhost:3001/paydown \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{
      "debts": [
        {"id":"...","name":"Visa","balance":5000,"rate":20,"minPayment":100}
      ],
      "budget": 300,
      "strategy": "avalanche"
    }'
```

Returns the discriminated-union shape from v4's calculator: either
`{feasible:true, schedule:[...]}` or `{feasible:false, reason:...}`.

## Files

```
v5-backend/
  package.json                 - deps + scripts
  tsconfig.json                - strict + nodenext + ESM
  vitest.config.ts             - setupFiles + placeholder env vars
  .env.example                 - PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, LOG_LEVEL, NODE_ENV
  src/
    server.ts                  - boot: connect Mongo, listen, graceful shutdown
    app.ts                     - buildApp(): wires middleware + router
    config/
      env.ts                   - zod-validated env, exits on bad config
    db/
      mongo.ts                 - connect/disconnect helpers (v6)
    routes/
      index.ts                 - mounts /health, /auth, /debts, /paydown
      auth.routes.ts           - register/login with rate limit (v7)
      debts.routes.ts          - GET/POST/DELETE behind requireAuth (v7)
      paydown.routes.ts        - POST /paydown behind requireAuth (v7)
    controllers/
      auth.controller.ts       - thin async glue for register/login (v7)
      debts.controller.ts      - thin async handlers (v6/v7)
      paydown.controller.ts    - thin: req -> service -> res
    services/
      auth.service.ts          - bcrypt + jwt with dummy-hash defense (v7)
      debts.service.ts         - Mongoose-backed, scoped by userId (v6/v7)
      paydown.service.ts       - strategy dispatch
    models/
      debt.model.ts            - Mongoose schema with UUID _id, userId field (v6/v7)
      user.model.ts            - Mongoose User schema (v7)
    middleware/
      errorHandler.ts          - 4-arg express error middleware
      requestLogger.ts         - morgan piped through pino
      validate.ts              - validate(source, schema) factory
      requireAuth.ts           - JWT verification, attaches userId (v7)
      rateLimit.ts             - express-rate-limit on auth endpoints (v7)
    validators/
      debts.schema.ts          - newDebtSchema, debtSchema, debtIdParamSchema
      paydown.schema.ts        - paydownRequestSchema, strategySchema
      auth.schema.ts           - registerSchema, loginSchema (v7)
    errors/
      AppError.ts              - AppError, NotFoundError, ValidationError, UnauthorizedError, ConflictError
    utils/
      paydownCalculator.ts     - pure math, ported from v4
      logger.ts                - pino instance
    test/
      setupMongo.ts            - vitest hook for mongodb-memory-server (v6)
    types/
      index.ts                 - re-exports types from validators and models
      express.d.ts             - augments Request with userId? (v7)
```
