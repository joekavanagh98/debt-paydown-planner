# Debt Paydown Planner

A consumer-facing financial planning tool for paying down debt via the
avalanche method (highest interest rate first). Given a list of debts
and a monthly budget, it computes a month-by-month payoff plan:
minimum payments on everything, extra cascading to the highest-rate
debt, and the next-highest as each one clears.

Built as a 14-day self-directed capstone to learn React, TypeScript,
Node.js, Express, MongoDB, and Tailwind CSS — the stack used by the
Online Lending team at Mariner Finance.

**Live demo:** coming in v8.

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
| v4 | Tailwind CSS | Responsive layout, charts, avalanche vs. snowball comparison, production deploy | Planned |
| v5 | Express, Node.js | Layered backend (routes/controllers/services/models), centralized error handling, structured logging, env-based config | Planned |
| v6 | MongoDB, Mongoose, Zod | Persistent storage, schema validation at the boundary | Planned |
| v7 | JWT, bcrypt | Authentication, rate limiting, security headers, CORS pinning | Planned |
| v8 | Deployed + Claude API | Production deployment, AI-assisted debt extraction from uploaded statements, staff dashboard | Planned |

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
- **Layered architecture (v5+, planned).** Routes delegate to
  controllers, controllers to services, services to models. Business
  logic lives in services so it's testable without HTTP plumbing. Zod
  validation runs as its own layer before business logic ever sees
  the request.
- **Configuration via environment (v5+, planned).** No hardcoded
  secrets, URLs, or tuning knobs. `.env.example` checked in;
  production `.env` never is.

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
