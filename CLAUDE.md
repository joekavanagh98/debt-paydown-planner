# Project Context for Claude Code

## What this is

Debt Paydown Planner, a consumer-facing financial planning tool. I'm
building it as a 14-day self-directed capstone to demonstrate competence
on a specific full-stack: React, TypeScript, Node.js, Express, MongoDB,
Tailwind CSS. It's for an internal engineering interview at Mariner
Finance (consumer lending) where I'm transferring from a loan specialist
role into a junior software engineer role.

## Who I am

Junior developer with self-taught fundamentals (C++, Java, ~60 credits
of CS coursework at Towson, VBA/Python experience in prior jobs). No
professional experience with React, Node, or MongoDB before this project.
I'm learning these on the job. Assume I'm competent but new. Explain
your reasoning when making non-obvious choices.

## Goals of this project

1. Demonstrate real engineering discipline, not just working code.
   Layered architecture, validation layers, centralized error handling,
   structured logging, environment-based configuration.
2. Show a clear version progression from v1 (vanilla JS) through v8
   (deployed full-stack with AI integration and staff dashboard).
3. Build something actually useful. This is a real tool a real person
   could use to plan debt paydown, not a tutorial project.

## Version roadmap

- v1: Vanilla JS, localStorage, add/edit/delete, avalanche paydown
- v2: React with feature-based component architecture
- v3: TypeScript strict mode throughout
- v4: Tailwind CSS, responsive, charts, strategy comparison, deployed
- v5: Express backend with layered architecture
- v6: MongoDB via Mongoose with Zod validation
- v7: JWT auth with bcrypt and rate limiting
- v8: Production deployment + Claude API debt extraction + staff view

## Current state

Day 2 of 14. v1-vanilla folder about to be created. Capstone repo
structure so far:

- CLAUDE.md (this file)
- LICENSE
- README.md (top-level, will expand on Day 14)

Each version lives in its own folder (v1-vanilla, v2-react, etc).
v6 is a modification of v5-backend, not a new folder. The top-level
README will track version progression on Day 14.

## Tooling decisions per version

Tooling gets introduced where it earns its place. Don't suggest
adding tooling to versions that don't need it:

- v1 (vanilla JS): no package.json, no prettier, no eslint, no build.
  Just HTML, CSS, JS files opened directly in the browser.
- v2 (React): package.json via Vite scaffold, prettier config standard
- v3 (TypeScript): add tsconfig.json, type-check as part of build
- v4 (Tailwind): tailwind.config.js and postcss.config.js
- v5 (Express backend): package.json, .env.example, nodemon for dev
- v6-v8: incremental additions as noted in version roadmap above

`.gitignore` at the repo root covers all version folders.

## How I want you to help me learn

- When you write code, briefly explain non-obvious choices in chat so
  I can understand them before I accept the change
- If I ask why something works, explain the underlying concept, not
  just the syntax
- Push back if I'm about to do something wrong or overcomplicated
- I'm writing pure functions (math, business logic) myself without AI
  assistance. Use AI for wiring and boilerplate where I already know
  the patterns.
- Don't write code for me when I should be typing it myself to build
  muscle memory. Offer pseudocode or a description instead if I ask
  about something I should be practicing.

## Comment style in committed code

Code comments follow professional conventions, not learning-journal
conventions:

- Comments explain WHY, not WHAT
- "Sort by rate descending for avalanche strategy" is a good comment
- "Loop through each debt and add to total" is noise, delete it
- If code needs a comment to explain what it does, the code should
  probably be rewritten to be clearer
- JSDoc on exported functions is fine when the signature isn't obvious
- TODO: and FIXME: are fine when flagging real follow-up work

Teaching-style explanations go in NOTES.md files, not in the code.

## NOTES.md files

Each version folder has a NOTES.md for learning notes. Sections by
file (HTML, CSS, JavaScript, etc.), plus a "What could be better"
section at the bottom for self-critique. Mark items **Fixed.** when
addressed.

## Code quality expectations

- Layered backend: routes, controllers, services, models
- Business logic in services, not controllers (testable without req/res)
- Zod validation as its own layer before business logic
- Centralized error handling with consistent response shape
- Never expose stack traces or internal errors to users
- Structured logging (pino) and request logging (morgan)
- All configuration via environment variables, never hardcoded
- bcrypt cost 10+, JWT expiration under 1 hour in production
- Rate limiting on auth endpoints, helmet for security headers
- CORS pinned to specific frontend origin

## Git discipline

- Small commits, one logical change each
- Conventional commit format: feat:, fix:, refactor:, docs:, chore:, test:
- Scope annotation when relevant: feat(v1):, fix(v5-backend):
- Multi-line commit bodies explaining the why for non-trivial commits
- Never commit secrets, .env files, or node_modules

## Commit message conventions

- Conventional commit format with scope: feat(v1):, fix(v5):, etc.
- Lowercase after the colon, imperative mood ("add" not "added")
- Each logical change gets its own commit, not bundled together

## What I value in your help

- Explain non-obvious choices briefly so I learn, not just copy
- Prefer the simpler solution unless complexity is genuinely warranted
- Flag when you're about to do something that conflicts with the quality
  expectations above
- Don't silently install packages. Tell me what you're adding and why
- If the task could be done two reasonable ways, name the trade-off
  and ask rather than guess
- Make each commit in a separate step so I can review before the next
  one runs. Don't bundle multiple logical changes into one commit.

## What to avoid

- Adding features I didn't ask for
- Making architectural decisions without flagging them
- Installing heavy dependencies to solve simple problems
- Skipping error handling because it's "just a portfolio project"
- Using localStorage or sessionStorage in places where the plan calls
  for actual backend persistence (v5 onward)
- Teaching-style comments in committed code
- Writing code for me when I should be practicing writing it myself
- Suggesting tooling additions for versions that don't need them
