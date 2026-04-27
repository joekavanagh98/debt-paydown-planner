# Deploying debt-paydown-planner

Backend on Render. Frontend on Vercel. Database on MongoDB Atlas.

The order is backend first (so the Render URL is known for the
frontend's VITE_API_URL), frontend second, then CORS_ORIGIN gets
updated on the backend with the Vercel URL. Step 5 (promote the
first staff user) is post-deploy and only needed if you want
access to the staff dashboard.

## Prerequisites

- GitHub repo with code pushed
- MongoDB Atlas account with an M0 free-tier cluster
  (see Atlas docs for cluster creation; not covered here)
- Render account
- Vercel account
- Atlas Network Access set to `0.0.0.0/0`
- Anthropic API key (https://console.anthropic.com) — used by the
  v8 phase 3 extraction endpoint. Use a project key with monthly
  spend limits set, not a personal key. Free trial credits cover
  testing; sustained use needs a paid account.

The Atlas allowlist is `0.0.0.0/0` because Render's free-tier egress
IPs aren't fixed and Vercel's aren't either. This is a known v8
deploy gap. Tightening it requires a paid Render tier with static
egress, or a Mongo Atlas dedicated cluster with a peering connection.
Documented; deferred.

## 1. Backend (Render)

Use **Render → New → Blueprint** (not "New Web Service"). Blueprint
reads `render.yaml` from the repo root and provisions the service
the way the file describes. New Web Service ignores `render.yaml`
and forces manual config — picking it by mistake is the fastest way
to spend a half-hour clicking through fields the yaml already covers.

Steps:

1. Render → New → Blueprint
2. Connect GitHub, select the repo
3. Render reads `render.yaml` and prompts for the four `sync: false`
   env vars (the others are pinned in the yaml):
   - **JWT_SECRET**: generate fresh in your terminal:
     ```
     openssl rand -hex 64
     ```
     Do not reuse the dev secret. Production gets its own.
   - **MONGODB_URI**: copy from Atlas → Connect → Drivers, replace
     `<password>` with the user password (URL-encode special chars),
     and add the database name before the `?`:
     ```
     mongodb+srv://USER:PASS@CLUSTER.mongodb.net/debt-paydown-planner?retryWrites=true&w=majority
     ```
   - **CORS_ORIGIN**: temporary placeholder
     `https://placeholder.vercel.app`. The real Vercel URL goes here
     in step 3 below.
   - **ANTHROPIC_API_KEY**: paste a key from
     https://console.anthropic.com. Use a project key with spend
     limits set so a runaway frontend can't drain a personal key.
     The key is required for /debts/extract; without it the service
     fails at boot rather than 500-ing on every extraction request.
4. Click Apply / Deploy
5. Wait 3-5 minutes for the first build (cold; subsequent deploys
   are faster because the dependency cache is warm)
6. Verify:
   ```
   curl https://your-service.onrender.com/health
   ```
   Should return `{"status":"ok"}`.

## 2. Frontend (Vercel)

Use **Vercel → Add New → Project**.

1. Import the same GitHub repo
2. **Root Directory: `v4-tailwind`** (this is critical and not
   auto-detected; if you skip it, Vercel tries to build from repo
   root and fails)
3. Framework auto-detects as Vite. Leave the build settings alone.
4. Environment Variable: **`VITE_API_URL` = the Render URL from
   step 1** (no trailing slash)
5. Click Deploy
6. Vercel returns a URL like `https://debt-paydown-planner-<hash>.vercel.app`

## 3. Wire CORS

Back in Render:

1. Service → Environment
2. Update `CORS_ORIGIN` to the Vercel URL from step 2 (exact match —
   no trailing slash, correct protocol)
3. Save → Render auto-redeploys

## 4. End-to-end verification

In an incognito browser window (so no stale cookies / state):

1. Open the Vercel URL → land on the sign-in screen
2. Register → debt list shows empty
3. Add a debt → appears in the list
4. Refresh the page → logged out (expected; in-memory token by design)
5. Log back in → debt persists
6. Delete the debt → disappears

If all six steps work, the deploy is good.

## 5. Promote the first staff user

The Staff dashboard is gated by `role: "staff"` on the User
document. Registration creates users with `role: "user"` by
design (no self-service promotion). For the first staff user
after a fresh deploy, flip the role manually in Atlas.

The promotion target is whichever account you want to be able
to view aggregate metrics. Typically that is your own account
(register through the live frontend first, then promote that
email).

Two paths:

**mongosh against the production cluster:**

```sh
mongosh "$MONGODB_URI"
```

In the shell:

```js
use test
db.users.updateOne(
  { email: "you@example.com" },
  { $set: { role: "staff" } }
)
```

The `use test` line matters. The current production `MONGODB_URI`
in Render does not specify a database name, so Mongoose connects
to the `test` database by default and existing production users
live there. (See v5-backend/NOTES.md § "Database name mismatch"
for the v9 carry-forward to unify dev and prod databases.)

A `modifiedCount: 1` response means the role flipped. `0` means
the email didn't match: typo, wrong cluster, or the user hasn't
registered yet via the frontend.

**Atlas Data Explorer (UI):**

1. Atlas dashboard → Browse Collections on the production cluster
2. Pick the `test` database, then `users`
3. Filter: `{ email: "you@example.com" }`
4. Edit the matched document, change `role` from `"user"` to
   `"staff"`, save
5. If the document has no `role` field at all (a pre-Phase-4
   account), add the key manually before saving

After promotion, sign out and sign back in on the live frontend.
The Planner / Staff toggle appears in the header; clicking Staff
loads the dashboard.

The backend reads role fresh from Mongo on every request (see
v5-backend/NOTES.md § "Why fresh DB lookup in requireStaff"),
so a service restart isn't required. The frontend caches the
user object returned at login, which is why re-login is needed
to surface the toggle.

## Gotchas

The list of things that have already tripped this project up. Read
before deploying so you avoid them.

### `npm ci --include=dev` in `buildCommand`

`render.yaml` sets `NODE_ENV=production`, which causes `npm ci` to
skip `devDependencies` by default. But TypeScript itself and the
`@types/*` packages live in `devDependencies`, and the build needs
them. Without `--include=dev`, `npm run build` fails with a stack
of `Cannot find module '@types/express'`-style errors.

The fix is in `render.yaml` already. If you fork or rewrite the
build pipeline, keep the flag.

### Render Blueprint vs New Web Service

Blueprint reads `render.yaml` and provisions the service from the
committed config. New Web Service ignores `render.yaml` and forces
you to fill out a form. Pick Blueprint.

### Vercel Root Directory must be set explicitly

Vercel does not auto-detect monorepo subfolders. If you forget to
set Root Directory to `v4-tailwind`, Vercel tries to install + build
from the repo root, where `package.json`'s preinstall guard
(`scripts/block-root-install.mjs`) exits 1 on purpose. The deploy
fails with the guard's message. Set Root Directory and re-deploy.

### CORS_ORIGIN must match the Vercel URL exactly

`https://app.vercel.app` and `https://app.vercel.app/` are different
to the CORS middleware. So are protocol mismatches (`http` vs
`https`). Copy the URL straight from Vercel and paste it into
Render with no edits.

### Database name in the MongoDB URI

The connection string from Atlas → Connect → Drivers does not
include a database name by default. The path between the host and
`?` looks like:

```
mongodb+srv://USER:PASS@CLUSTER.mongodb.net/?retryWrites=true...
                                            ^
                                     no database name
```

Add `/debt-paydown-planner` (or whatever you want to call the
database) before the `?`:

```
mongodb+srv://USER:PASS@CLUSTER.mongodb.net/debt-paydown-planner?retryWrites=true...
```

Without it, Mongoose connects but writes to the default `test`
database, not yours. Documents land somewhere unexpected and reads
return empty.

### Atlas allowlist stays at `0.0.0.0/0`

Render's free tier doesn't give static egress IPs, and Vercel's
egress is a wide range that shifts. The pragmatic capstone-tier
compromise is allowlist-from-anywhere on Atlas. Auth and bcrypt are
the actual defense. Tightening the allowlist requires paid Render
tier (egress IPs become known) or Mongo Atlas dedicated cluster
with VPC peering.

### Cold-start timing on Render free tier

Free-tier services sleep after 15 minutes of inactivity. The next
request takes 30-50 seconds while Render spins the container back
up. For a demo, hit `/health` 30 seconds before showing the app to
anyone:

```
curl https://your-service.onrender.com/health
```

Don't add a cron-warm or anti-cold-start mechanism for v8.
Switching to a paid Render tier removes the sleep entirely; that's
the upgrade path if cold start ever becomes a real demo problem.

### Vercel env var changes don't auto-redeploy

Vite bakes env vars into the bundle at build time. Editing
`VITE_API_URL` on Vercel changes the dashboard value but the
running app keeps using whatever was set when it was last built.
After every env var change on Vercel, manually trigger a redeploy:
Vercel → Deployments → most recent → ⋯ → Redeploy.

### Render env var changes auto-redeploy

The opposite of Vercel. Saving any env var change on Render
triggers a deploy automatically. This is convenient most of the
time but worth knowing if you change `CORS_ORIGIN` while a real
user is mid-request — they'll see a brief outage during the
restart.

### ANTHROPIC_API_KEY needs spend limits, not blank check

Anthropic project keys can be created with monthly spend caps. Set
one. The `/debts/extract` endpoint is rate-limited per user, but
nothing stops a misconfigured frontend (or a future bug) from
spamming the model. A spend cap is the last line of defense and
costs nothing to set.

Personal keys with no caps work but expose every dollar in your
account; if the key leaks the bill follows. Project keys are
free, isolated, and revocable.

## Troubleshooting

Specific failures hit while bringing this project up. Future-self,
this is for you when you forget what tripped you in 6 months.

### Build fails: `Cannot find module '@types/express'`

The build is running with `NODE_ENV=production` and `npm ci` is
skipping devDependencies. Confirm `render.yaml` has
`buildCommand: npm ci --include=dev && npm run build`. Without
`--include=dev`, every TypeScript build artifact is missing.

### Health check times out, deploy fails

The Express server `await connectMongo()`s before binding the HTTP
port. If Mongo never connects, the port never opens, and Render's
health check polls a port that nothing is listening on.

Causes:

- Atlas Network Access not set to `0.0.0.0/0`
- `MONGODB_URI` typo (URL-encoded password lost on paste, missing
  database name, leading/trailing whitespace)
- Atlas database user password rotated and `.env` not updated
- Render service in a region Atlas doesn't reach (rare)

Inspect the Render service logs. Look for the pino message
`MongoDB connected` (success) or any `MongooseServerSelectionError`
(failure). The error message tells you which case.

### CORS error in the browser console

The browser refuses requests from the Vercel origin because the
backend's `Access-Control-Allow-Origin` header doesn't match.

Check:

- `CORS_ORIGIN` on Render exactly matches the Vercel URL
- No trailing slash difference (`https://app.vercel.app` ≠
  `https://app.vercel.app/`)
- Protocol matches (`https://...`, not `http://...`)
- Render redeployed after you changed the env var (Render
  auto-redeploys, but check the deploys tab to confirm)

### 401 on every request after sign-in

Most likely `JWT_SECRET` is empty or shorter than 32 chars on
Render. The env schema rejects anything shorter, so the service
won't have started, and you'd see this in Render logs at boot:

```
Invalid environment configuration:
{ "JWT_SECRET": { "_errors": ["String must contain at least 32 character(s)"] } }
```

Generate a real secret (`openssl rand -hex 64`) and paste it into
Render → Environment → JWT_SECRET. Save and let the auto-redeploy
finish.

If `JWT_SECRET` is fine and 401s are still happening, the access
token may have been signed with an older secret value. The frontend
shows "Your session expired" automatically (v8 phase 1's 401 handler).
Sign back in to get a token signed with the current secret.

### /debts/extract returns 500 instead of extracting

The `ANTHROPIC_API_KEY` env var is missing or wrong on Render.
The env schema requires it, so the service should fail at boot
rather than reaching this state, but if you've stripped the
schema validation or the key is set to an empty string, requests
hit a runtime SDK error instead.

Check Render logs for an Anthropic SDK auth error. Re-paste the
key from https://console.anthropic.com → API Keys, save, let
Render redeploy.

### Staff toggle doesn't show after promoting a user

Two common causes after running step 5:

- **The user didn't sign out and back in.** The Planner / Staff
  toggle reads `user.role` off the cached user object the
  frontend got back at login. Promotion in Mongo flips the
  database value but the cached object on the client is stale
  until the next sign-in. Sign out, sign back in, the toggle
  appears.
- **The promotion ran against the wrong database.** Production
  users live in the `test` database (the URI's missing path
  segment defaults to `test`). If you ran `use
  debt-paydown-planner` first and updated there, you flipped a
  document that doesn't exist in production. `modifiedCount: 0`
  in the mongosh output is the symptom. Re-run with `use test`.

If both check out and the toggle still doesn't show, log the
user object from the auth context (browser console) and confirm
the `role` field on the user is `"staff"`. If it's missing or
still `"user"`, the login response didn't pick up the new role,
which means the promotion either didn't persist or hit a
different cluster than the one Render points at.

### /debts/extract returns 502 extraction_failed

The model returned something we couldn't parse into the expected
shape. Common causes:

- The user pasted text with no debts in it. Empty `debts: []`
  array is not an error and returns 200; this is something
  weirder.
- The model refused (returned a text response, not a tool call).
  Sometimes happens with adversarial input that trips a safety
  filter.
- A transient model glitch. Retry usually works.

The frontend's DebtExtractor maps this to "Couldn't extract debts
from that text. Try a clearer paste, or add them manually." which
is the right user-facing line. The 502 itself is fine; nothing to
fix on the backend.
