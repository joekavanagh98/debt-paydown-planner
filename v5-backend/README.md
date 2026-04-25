# v5 / v6 - Express Backend with MongoDB

Per the project roadmap, v6 modifies v5-backend in place rather than
creating a new folder. v5 stood up the layered API with in-memory
storage; v6 swaps the in-memory Map for MongoDB via Mongoose without
changing the API surface.

## What this is

A REST API for debt CRUD and paydown calculation, written in
TypeScript on Express 5 with the layered architecture (routes,
controllers, services, models). Same calculator math as v4, now
backed by MongoDB and accessible over HTTP.

This is a standalone project. It does not consume the v4 frontend
and v4 does not call this API yet. You exercise it with curl, an
HTTP client, or the test suite.

## What it does

- `GET /health` returns `{"status":"ok"}` for liveness probes
- `GET /debts` lists all stored debts
- `POST /debts` creates a debt, server assigns the id, returns 201
- `DELETE /debts/:id` removes a debt, returns 204 (or 404 if the
  id does not exist)
- `POST /paydown` accepts `{debts, budget, strategy}` and returns
  the schedule from the avalanche or snowball calculator
- Centralized JSON error envelope across every error response
- Zod validation in front of every input-taking route
- Pino structured logging plus morgan request logging
- CORS pinned to the configured frontend origin
- Env config validated at boot with Zod (process exits with a
  diagnostic if anything is missing or wrong)
- MongoDB persistence via Mongoose (v6); UUID `_id` so the API
  contract still surfaces `id: string (uuid)`
- Graceful shutdown on SIGTERM/SIGINT (drains in-flight requests,
  closes Mongo cleanly)
- 35 tests across the calculator, services, and end-to-end via
  supertest, all running against an ephemeral
  mongodb-memory-server instance

## What this version does NOT include

Belongs to later versions:

- User accounts or login - v7
- Rate limiting and helmet security headers - v7
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

Then:

```
cd v5-backend
cp .env.example .env
# edit .env: paste your real MONGODB_URI
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
MongoDB. No Atlas needed for tests; `MONGODB_URI` is not read by
the test process. First run downloads ~80MB of MongoDB binaries
(once); subsequent runs use the cache.

## Endpoints

### `GET /health`

```
$ curl http://localhost:3001/health
{"status":"ok"}
```

### `GET /debts`

```
$ curl http://localhost:3001/debts
[]
```

### `POST /debts`

```
$ curl -X POST http://localhost:3001/debts \
    -H "Content-Type: application/json" \
    -d '{"name":"Visa","balance":5000,"rate":20,"minPayment":100}'
{"id":"...","name":"Visa","balance":5000,"rate":20,"minPayment":100}
```

Validation rejects missing fields, wrong types, negative balances,
and unrecognized keys with `400 validation_error` plus the Zod
issues array.

### `DELETE /debts/:id`

```
$ curl -X DELETE http://localhost:3001/debts/<uuid>
# 204 No Content
```

Returns `404 not_found` if the id does not exist. Returns
`400 validation_error` if the id is not a valid UUID.

### `POST /paydown`

```
$ curl -X POST http://localhost:3001/paydown \
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
  vitest.config.ts             - setupFiles + placeholder MONGODB_URI
  .env.example                 - PORT, MONGODB_URI, CORS_ORIGIN, LOG_LEVEL, NODE_ENV
  src/
    server.ts                  - boot: connect Mongo, listen, graceful shutdown
    app.ts                     - buildApp(): wires middleware + router
    config/
      env.ts                   - zod-validated env, exits on bad config
    db/
      mongo.ts                 - connect/disconnect helpers (v6)
    routes/
      index.ts                 - mounts /health, /debts, /paydown
      debts.routes.ts          - GET/POST/DELETE
      paydown.routes.ts        - POST /paydown
    controllers/
      debts.controller.ts      - thin async handlers (v6)
      paydown.controller.ts    - thin: req -> service -> res
    services/
      debts.service.ts         - Mongoose-backed (v6)
      paydown.service.ts       - strategy dispatch
    models/
      debt.model.ts            - Mongoose schema with UUID _id (v6)
    middleware/
      errorHandler.ts          - 4-arg express error middleware
      requestLogger.ts         - morgan piped through pino
      validate.ts              - validate(source, schema) factory
    validators/
      debts.schema.ts          - newDebtSchema, debtSchema, debtIdParamSchema, exported types
      paydown.schema.ts        - paydownRequestSchema, strategySchema, Strategy type
    errors/
      AppError.ts              - AppError, NotFoundError, ValidationError
    utils/
      paydownCalculator.ts     - pure math, ported from v4
      logger.ts                - pino instance
    test/
      setupMongo.ts            - vitest hook for mongodb-memory-server (v6)
    types/
      index.ts                 - re-exports Debt, NewDebt, Strategy from validators;
                                 ScheduleEntry, ScheduleMonth, PaydownResult
```
