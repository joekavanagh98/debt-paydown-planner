import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "./app.js";

const app = buildApp();

// The full end-to-end suite (debts CRUD, paydown, validation,
// scoped-debts isolation, rate limits) lands in the v7 test commit.
// The /health smoke check stays here since it doesn't require auth
// and is the canonical "is the app booted" probe.
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
