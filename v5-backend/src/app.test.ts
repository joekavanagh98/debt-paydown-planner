import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { requireStaff } from "./middleware/requireStaff.js";
import { UserModel } from "./models/user.model.js";

const app = buildApp();

// ---- Helpers ----

const PASSWORD = "password123";

const register = (email: string, password: string = PASSWORD) =>
  request(app).post("/auth/register").send({ email, password });

const login = (email: string, password: string = PASSWORD) =>
  request(app).post("/auth/login").send({ email, password });

async function registerAndLogin(email: string, password: string = PASSWORD) {
  await register(email, password);
  const res = await login(email, password);
  return {
    token: res.body.token as string,
    user: res.body.user as { id: string; email: string },
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---- Existing non-auth tests ----

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("unmounted routes", () => {
  it("returns 404 with the standard error envelope", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "not_found", message: "Route not found" },
    });
  });
});

describe("express.json body limit", () => {
  it("returns 413 with the standard envelope when the body exceeds 32kb", async () => {
    // 33kb of filler in an extra field. The body-parser rejects the
    // payload before the schema validator runs, so it doesn't matter
    // that `junk` would fail strict-mode validation downstream.
    const oversize = "a".repeat(33 * 1024);
    const res = await request(app)
      .post("/auth/register")
      .set("Content-Type", "application/json")
      .send({ email: "big@test.com", password: PASSWORD, junk: oversize });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
  });
});

// ---- requireAuth middleware (exercised through /debts) ----

describe("requireAuth middleware (via /debts)", () => {
  it("rejects requests without an Authorization header", async () => {
    const res = await request(app).get("/debts");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects requests with a non-Bearer scheme", async () => {
    const res = await request(app)
      .get("/debts")
      .set("Authorization", "Basic abc123");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects expired tokens", async () => {
    const expired = jwt.sign(
      { sub: "user-1" },
      process.env.JWT_SECRET ?? "",
      { expiresIn: "-1m" },
    );
    const res = await request(app)
      .get("/debts")
      .set(auth(expired));
    expect(res.status).toBe(401);
  });

  it("rejects tokens with an invalid signature", async () => {
    const wrongSecret = jwt.sign(
      { sub: "user-1" },
      "different-secret-different-secret-different",
    );
    const res = await request(app)
      .get("/debts")
      .set(auth(wrongSecret));
    expect(res.status).toBe(401);
  });

  it("attaches userId for valid tokens (proven by /debts returning the empty list scoped to that user)", async () => {
    const { token } = await registerAndLogin("middleware@test.com");
    const res = await request(app).get("/debts").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ---- POST /auth/register ----

describe("POST /auth/register", () => {
  it("creates a user and returns the public projection (no passwordHash)", async () => {
    const res = await register("new@test.com");
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe("new@test.com");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("returns 409 for a duplicate email", async () => {
    await register("dup@test.com");
    const res = await register("dup@test.com");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_exists");
  });

  it("returns 400 for invalid body (missing password, bad email format)", async () => {
    const missingPassword = await request(app)
      .post("/auth/register")
      .send({ email: "x@y.z" });
    expect(missingPassword.status).toBe(400);
    expect(missingPassword.body.error.code).toBe("validation_error");

    const badEmail = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: PASSWORD });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe("validation_error");
  });
});

// ---- POST /auth/login ----

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await register("known@test.com");
  });

  it("returns 200 with token and user on success", async () => {
    const res = await login("known@test.com");
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe("known@test.com");
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("returns 401 for wrong password", async () => {
    const res = await login("known@test.com", "wrong-password");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("returns 401 for nonexistent email", async () => {
    const res = await login("nobody@test.com", "anything-here");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("nonexistent-email login runs bcrypt against the dummy hash (timing parity)", async () => {
    const t1 = performance.now();
    await login("known@test.com", "wrong-password");
    const dWrong = performance.now() - t1;

    const t2 = performance.now();
    await login("nobody@test.com", "anything-here");
    const dMissing = performance.now() - t2;

    // bcrypt at cost 12 is ~250ms per compare. Both paths should run
    // a real compare. Don't assert tight equality (CI noise) — just
    // confirm the missing-email path took long enough to indicate
    // bcrypt actually ran. A skipped compare would resolve in <5ms.
    expect(dMissing).toBeGreaterThanOrEqual(30);
    expect(dWrong).toBeGreaterThanOrEqual(30);
  });
});

// ---- /debts CRUD with auth ----

describe("/debts CRUD with auth", () => {
  it("GET /debts returns only the caller's debts", async () => {
    const a = await registerAndLogin("user-a@test.com");
    const b = await registerAndLogin("user-b@test.com");

    await request(app)
      .post("/debts")
      .set(auth(a.token))
      .send({ name: "A's Visa", balance: 100, rate: 10, minPayment: 25 });
    await request(app)
      .post("/debts")
      .set(auth(b.token))
      .send({ name: "B's Card", balance: 200, rate: 15, minPayment: 25 });

    const aRes = await request(app).get("/debts").set(auth(a.token));
    expect(aRes.status).toBe(200);
    expect(aRes.body).toHaveLength(1);
    expect(aRes.body[0].name).toBe("A's Visa");

    const bRes = await request(app).get("/debts").set(auth(b.token));
    expect(bRes.body).toHaveLength(1);
    expect(bRes.body[0].name).toBe("B's Card");
  });

  it("POST /debts stamps the debt with the authenticated user (userId not in response)", async () => {
    const { token } = await registerAndLogin("post-debt@test.com");
    const res = await request(app)
      .post("/debts")
      .set(auth(token))
      .send({ name: "Visa", balance: 5000, rate: 20, minPayment: 100 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.userId).toBeUndefined();
    expect(res.body.name).toBe("Visa");
  });

  it("DELETE /debts/:id returns 404 (not 403) when targeting another user's debt", async () => {
    const a = await registerAndLogin("del-a@test.com");
    const b = await registerAndLogin("del-b@test.com");

    const created = await request(app)
      .post("/debts")
      .set(auth(a.token))
      .send({ name: "A's debt", balance: 100, rate: 10, minPayment: 25 });
    const aDebtId = created.body.id;

    const res = await request(app)
      .delete(`/debts/${aDebtId}`)
      .set(auth(b.token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");

    // A's debt still exists
    const aList = await request(app).get("/debts").set(auth(a.token));
    expect(aList.body).toHaveLength(1);
  });

  it("all /debts endpoints reject requests without a token", async () => {
    const get = await request(app).get("/debts");
    expect(get.status).toBe(401);

    const post = await request(app)
      .post("/debts")
      .send({ name: "X", balance: 1, rate: 1, minPayment: 1 });
    expect(post.status).toBe(401);

    const del = await request(app).delete(
      "/debts/00000000-0000-4000-8000-000000000000",
    );
    expect(del.status).toBe(401);
  });
});

// ---- /debts/extract with auth + validation ----
//
// Success-case extraction (Anthropic SDK call) is covered by
// extraction.service.test.ts where the SDK is mocked. These tests
// only exercise the route's auth and validation layers, which fail
// before the controller runs and so never reach the SDK.

describe("/debts/extract", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app)
      .post("/debts/extract")
      .send({ text: "Visa $5000 at 24% APR" });
    expect(res.status).toBe(401);
  });

  it("rejects empty text with 400 validation_error", async () => {
    const { token } = await registerAndLogin("extract-empty@test.com");
    const res = await request(app)
      .post("/debts/extract")
      .set(auth(token))
      .send({ text: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("rejects text over 5000 chars with 400 validation_error", async () => {
    const { token } = await registerAndLogin("extract-toolong@test.com");
    const res = await request(app)
      .post("/debts/extract")
      .set(auth(token))
      .send({ text: "a".repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});

// ---- requireStaff middleware ----
//
// The real /staff/* routes land in commit c2 of v8 phase 4. To keep
// c1 self-contained we mount the middleware against a tiny in-test
// Express app with one route, sized to exercise the three branches
// (no token, user role, staff role).

function buildStaffTestApp(): express.Express {
  const a = express();
  a.use(express.json());
  a.get("/test", requireAuth, requireStaff, (_req, res) => {
    res.json({ ok: true });
  });
  a.use(errorHandler);
  return a;
}

describe("requireStaff middleware", () => {
  const staffApp = buildStaffTestApp();

  it("rejects requests without a token (401)", async () => {
    const res = await request(staffApp).get("/test");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects requests from regular users (403)", async () => {
    const { token } = await registerAndLogin("regular@test.com");
    const res = await request(staffApp).get("/test").set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("allows requests from staff users (200)", async () => {
    const { token, user } = await registerAndLogin("staff@test.com");
    // Promotion is manual in v8 phase 4 (no self-service or invite
    // flow) — for the test, write the role straight to Mongo.
    await UserModel.updateOne({ _id: user.id }, { $set: { role: "staff" } });
    const res = await request(staffApp).get("/test").set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ---- /staff/summary ----

describe("/staff/summary", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).get("/staff/summary");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("rejects requests from regular users (403)", async () => {
    const { token } = await registerAndLogin("regular-summary@test.com");
    const res = await request(app).get("/staff/summary").set(auth(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("returns the aggregate shape for a staff user", async () => {
    // Build a known dataset: 3 users, of which 2 have debts.
    const a = await registerAndLogin("user-a-summary@test.com");
    const b = await registerAndLogin("user-b-summary@test.com");
    await registerAndLogin("user-c-summary@test.com"); // no debts
    await request(app)
      .post("/debts")
      .set(auth(a.token))
      .send({ name: "A1", balance: 1000, rate: 10, minPayment: 25 });
    await request(app)
      .post("/debts")
      .set(auth(a.token))
      .send({ name: "A2", balance: 2000, rate: 20, minPayment: 50 });
    await request(app)
      .post("/debts")
      .set(auth(b.token))
      .send({ name: "B1", balance: 500, rate: 15, minPayment: 25 });

    // Promote a fourth account to staff so the staff caller is
    // separate from the data we created above.
    const staff = await registerAndLogin("staff-summary@test.com");
    await UserModel.updateOne(
      { _id: staff.user.id },
      { $set: { role: "staff" } },
    );

    const res = await request(app)
      .get("/staff/summary")
      .set(auth(staff.token));
    expect(res.status).toBe(200);

    expect(res.body.users.total).toBe(4);
    expect(res.body.users.earliestSignup).toEqual(expect.any(String));
    expect(res.body.users.latestSignup).toEqual(expect.any(String));

    expect(res.body.debts.totalCount).toBe(3);
    expect(res.body.debts.totalBalance).toBe(3500);
    // (10 + 20 + 15) / 3 = 15
    expect(res.body.debts.averageRate).toBeCloseTo(15, 5);

    // a has 2 debts, b has 1, c and staff have 0.
    expect(res.body.debtCountDistribution).toEqual({
      zero: 2,
      oneToTwo: 2,
      threeToFive: 0,
      sixPlus: 0,
    });
  });

  it("aggregate response leaks no individual user data (canary check)", async () => {
    // Build users + debts whose names contain unique tokens. After
    // calling /staff/summary, JSON.stringify the body and assert
    // none of those tokens appear. This is the load-bearing check
    // on the aggregate-only design — if any token leaks, an
    // aggregation pipeline somewhere is returning identifying data.
    //
    // randomUUID() generates the tokens per run so collisions
    // against any real value are statistically impossible, not just
    // "unlikely with this hand-picked hex string."
    const EMAIL_CANARY = `leak-${randomUUID()}`;
    const NAME_CANARY = `debt-${randomUUID()}`;

    const u = await registerAndLogin(`${EMAIL_CANARY}@test.com`);
    await request(app)
      .post("/debts")
      .set(auth(u.token))
      .send({
        name: NAME_CANARY,
        balance: 1234.56,
        rate: 17.89,
        minPayment: 42,
      });

    const staff = await registerAndLogin("staff-canary@test.com");
    await UserModel.updateOne(
      { _id: staff.user.id },
      { $set: { role: "staff" } },
    );

    const res = await request(app)
      .get("/staff/summary")
      .set(auth(staff.token));
    expect(res.status).toBe(200);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain(EMAIL_CANARY);
    expect(body).not.toContain(NAME_CANARY);
    expect(body).not.toContain(u.user.id);
    expect(body).not.toContain(staff.user.id);
  });
});

// ---- /paydown with auth ----

describe("/paydown with auth", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app)
      .post("/paydown")
      .send({ debts: [], budget: 100, strategy: "avalanche" });
    expect(res.status).toBe(401);
  });

  it("returns a feasible schedule with a valid token", async () => {
    const { token } = await registerAndLogin("paydown@test.com");
    const res = await request(app)
      .post("/paydown")
      .set(auth(token))
      .send({
        debts: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Visa",
            balance: 5000,
            rate: 20,
            minPayment: 100,
          },
        ],
        budget: 300,
        strategy: "avalanche",
      });
    expect(res.status).toBe(200);
    expect(res.body.feasible).toBe(true);
  });

  it("rejects more than 50 debts in a single request", async () => {
    const { token } = await registerAndLogin("paydown-bounds-1@test.com");
    const debts = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      name: `D${i}`,
      balance: 100,
      rate: 10,
      minPayment: 10,
    }));
    const res = await request(app)
      .post("/paydown")
      .set(auth(token))
      .send({ debts, budget: 1000, strategy: "avalanche" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("rejects an unrealistic balance above 10M", async () => {
    const { token } = await registerAndLogin("paydown-bounds-2@test.com");
    const res = await request(app)
      .post("/paydown")
      .set(auth(token))
      .send({
        debts: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Mortgage",
            balance: 1e8,
            rate: 5,
            minPayment: 100,
          },
        ],
        budget: 5000,
        strategy: "avalanche",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("rejects a rate above 100%", async () => {
    const { token } = await registerAndLogin("paydown-bounds-3@test.com");
    const res = await request(app)
      .post("/paydown")
      .set(auth(token))
      .send({
        debts: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Loan",
            balance: 5000,
            rate: 101,
            minPayment: 100,
          },
        ],
        budget: 300,
        strategy: "avalanche",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});
