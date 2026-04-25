# v5 - Express Backend

## What this is

A REST API for debt CRUD and paydown calculation, written in
TypeScript on Express 5 with the layered architecture (routes,
controllers, services). Same calculator math as v4 but accessible
over HTTP. Storage is an in-memory Map until v6 swaps in MongoDB.

v5 is a standalone project. It does not consume the v4 frontend
and v4 does not call this API yet. You exercise it with curl, an
HTTP client, or the test suite.

## What v5 does

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
- 35 tests across the calculator, services, and end-to-end via
  supertest

## What v5 does NOT include

Belongs to later versions:

- Persistent storage (MongoDB) - v6
- User accounts or login - v7
- Rate limiting and helmet security headers - v7
- Production deployment - v8
- AI-assisted debt extraction - v8
- Staff dashboard - v8
- The v4 frontend calling this API - v8

## How to run

```
cd v5-backend
npm install
npm run dev
```

The server listens on `http://localhost:3001` by default. Override
with the `PORT` env var. The dev script is tsx watch, so saves
trigger a rebuild and restart.

## How to test

```
npm test            # one-shot
npm run test:watch  # vitest UI
npm run typecheck   # tsc --noEmit
```

35 tests across `src/utils`, `src/services`, and a supertest end-
to-end file at `src/app.test.ts`.

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
  .env.example                 - PORT, CORS_ORIGIN, LOG_LEVEL, NODE_ENV
  src/
    server.ts                  - boot: read env, listen
    app.ts                     - buildApp(): wires middleware + router
    config/
      env.ts                   - zod-validated env, exits on bad config
    routes/
      index.ts                 - mounts /health, /debts, /paydown
      debts.routes.ts          - GET/POST/DELETE
      paydown.routes.ts        - POST /paydown
    controllers/
      debts.controller.ts      - thin: req → service → res
      paydown.controller.ts    - thin: req → service → res
    services/
      debts.service.ts         - in-memory Map (v6: Mongoose)
      paydown.service.ts       - strategy dispatch
    middleware/
      errorHandler.ts          - 4-arg express error middleware
      requestLogger.ts         - morgan piped through pino
      validate.ts              - validate(source, schema) factory
    validators/
      debts.schema.ts          - newDebtSchema, debtSchema, debtIdParamSchema
      paydown.schema.ts        - paydownRequestSchema
    errors/
      AppError.ts              - AppError, NotFoundError, ValidationError
    utils/
      paydownCalculator.ts     - pure math, ported from v4
      logger.ts                - pino instance
    types/
      index.ts                 - Debt, NewDebt, ScheduleEntry,
                                 ScheduleMonth, Strategy, PaydownResult
```
