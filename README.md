# Debt Paydown Planner

A consumer-facing financial planning tool for paying down debt via the
avalanche method (highest interest rate first). Given a list of debts
and a monthly budget, it computes a month-by-month payoff plan:
minimum payments on everything, extra cascading to the highest-rate
debt, and the next-highest as each one clears.

Built as a 14-day self-directed capstone to learn React, TypeScript,
Node.js, Express, MongoDB, and Tailwind CSS — the stack used by the
Online Lending team at Mariner Finance.

**Live demo:** [debt-paydown-planner.vercel.app](https://debt-paydown-planner.vercel.app/)
(backend on Render free tier, so the first request after a 15-minute
idle window takes 30-50 seconds to wake the container).

## Version progression

Each version lives in its own folder and is independently runnable.
Rather than a single codebase that evolves in place, the repo is
structured as a sequence of self-contained apps — one per version —
so the progression of concepts is legible from the commit history and
from the directory tree.

| Version | Stack | Demonstrates | Status |
|---|---|---|---|
| [v1](v1-vanilla/) | HTML, CSS, vanilla JS | Pure paydown math in integer cents, hand-rolled test harness, event delegation, graceful-degradation storage | Complete |
| [v2](v2-react/) | React, Vite | Feature-based component structure, lifting state, controlled inputs, `useMemo`, lazy initial state, functional setters | Complete |
| [v3](v3-typescript/) | TypeScript strict | Shared types module, discriminated union for the calculator's result, typed props and event handlers, `noUncheckedIndexedAccess` opt-in | Complete |
| [v4](v4-tailwind/) | Tailwind CSS v4, Recharts | CSS-first Tailwind config, mobile-first responsive layout, avalanche and snowball comparison with per-debt balance charts, Vercel deploy config | Complete |
| [v5](v5-backend/) | Express 5, TypeScript, Zod | Layered backend (routes/controllers/services), centralized error handling and JSON error envelope, Zod request validation, env config validated at boot, pino + morgan logging, CORS, supertest end-to-end tests | Complete |
| [v6](v5-backend/) | MongoDB Atlas, Mongoose | Persistent storage in v5-backend (in-place modification), UUID `_id`, mongodb-memory-server for tests, graceful shutdown, schema/type consolidation via z.infer | Complete |
| [v7](v5-backend/) | JWT, bcrypt, helmet, express-rate-limit | JWT auth in v5-backend (in-place modification), bcrypt hashing with constant-time-ish login defense, per-user scoped debts, helmet security headers, IP-based rate limiting on auth endpoints, CORS array form | Complete |
| [v8](v5-backend/) | Render + Vercel + Anthropic SDK | Render Blueprint backend deploy and Vercel frontend deploy, Claude-backed debt extraction from pasted statements via tool use, three-layer prompt-injection defense (delimiter wrap, prompt hardening, review-before-save), per-user rate limit, role-gated staff dashboard with aggregate-only metrics and a leak-canary test enforcing the privacy invariant | Complete |

## How to run

Each version is standalone.

**v1** — no install:

```
open v1-vanilla/index.html
```

**v2, v3** — Vite dev server:

```
cd v2-react    # or v3-typescript
npm install
npm run dev
```

## Architecture highlights

- **Integer-cents arithmetic in the calculator.** Debt balances are
  converted to integer cents before any compounding happens, then
  back to dollars in the output. Eliminates floating-point drift over
  schedules that can run 600+ months.
- **Discriminated union for calculator results (v3+).** The avalanche
  function returns either `{ feasible: true; schedule: ... }` or one
  of two failure variants keyed on a `reason` discriminant. Consumers
  can't read branch-specific fields (like `requiredMinimum`) until
  they've narrowed by checking the tag.
- **Strict TypeScript throughout v3.** `strict`, `noImplicitReturns`,
  `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` all
  enabled before any code landed. Chose to opt in to the noisy flags
  up front rather than retrofit later.
- **Layered architecture (v5+).** Routes delegate to controllers,
  controllers to services, services to models. Business logic lives
  in services so it's testable without HTTP plumbing. Zod validation
  runs as its own layer before business logic ever sees the request.
- **Configuration via environment (v5+).** No hardcoded secrets,
  URLs, or tuning knobs. `.env.example` checked in; production
  `.env` never is.
- **Auth as middleware, not as a service-level concern (v7+).**
  `requireAuth` and `requireStaff` are Express middleware that gate
  entire routers. The controllers don't know auth exists; they just
  read `req.userId`. Same pattern keeps the staff dashboard's RBAC
  isolated from the aggregation logic it protects.
- **Aggregate-only invariant for staff data (v8).** The
  `/staff/summary` endpoint is enforced aggregate-only by a
  leak-canary test: a unique-token-seeded user is created, the
  endpoint is hit as a staff caller, and the entire response body is
  string-searched for the canary tokens. Any field that accidentally
  surfaces individual data fails the test before merge.

## Project documents

- [CLAUDE.md](CLAUDE.md) — project context, version roadmap,
  code-quality expectations, and notes on how AI assistance is used
  (and not used) in this repo.
- `NOTES.md` inside each version folder — version-specific learning
  notes and a "what could be better" section tracking known gaps.

## Author

Joe Kavanagh. Loan specialist at Mariner Finance, built this project
as part of an application to transfer into a junior software engineer
role on the Online Lending team.
