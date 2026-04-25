import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "./app.js";

// setupMongo handles connection lifecycle and per-test cleanup.
const app = buildApp();

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("debts routes", () => {
  it("GET /debts returns an empty array initially", async () => {
    const res = await request(app).get("/debts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /debts creates a debt and GET reflects it", async () => {
    const create = await request(app).post("/debts").send({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    expect(create.status).toBe(201);
    expect(create.body.id).toBeDefined();
    expect(create.body.name).toBe("Visa");

    const list = await request(app).get("/debts");
    expect(list.status).toBe(200);
    expect(list.body).toEqual([create.body]);
  });

  it("DELETE /debts/:id removes the debt", async () => {
    const create = await request(app).post("/debts").send({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    const del = await request(app).delete(`/debts/${create.body.id}`);
    expect(del.status).toBe(204);
    const list = await request(app).get("/debts");
    expect(list.body).toEqual([]);
  });

  it("DELETE /debts/:id returns 404 when id does not exist", async () => {
    const res = await request(app).delete(
      "/debts/00000000-0000-4000-8000-000000000000",
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("POST /debts with invalid body returns 400 with issues", async () => {
    const res = await request(app).post("/debts").send({
      name: "Visa",
      balance: -100,
      rate: 20,
      minPayment: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
    expect(Array.isArray(res.body.error.issues)).toBe(true);
  });

  it("POST /debts with extra fields returns 400 (strict)", async () => {
    const res = await request(app)
      .post("/debts")
      .send({
        name: "Visa",
        balance: 5000,
        rate: 20,
        minPayment: 100,
        sneaky: "bad",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });

  it("DELETE /debts/:id with non-uuid returns 400", async () => {
    const res = await request(app).delete("/debts/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
  });
});

describe("paydown route", () => {
  it("POST /paydown returns a feasible avalanche schedule", async () => {
    const res = await request(app)
      .post("/paydown")
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
    expect(Array.isArray(res.body.schedule)).toBe(true);
    expect(res.body.schedule.length).toBeGreaterThan(0);
  });

  it("POST /paydown returns infeasible when budget is too low", async () => {
    const res = await request(app)
      .post("/paydown")
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
        budget: 50,
        strategy: "avalanche",
      });
    expect(res.status).toBe(200);
    expect(res.body.feasible).toBe(false);
    expect(res.body.reason).toBe("budgetBelowMinimums");
  });

  it("POST /paydown with bad strategy returns 400", async () => {
    const res = await request(app)
      .post("/paydown")
      .send({ debts: [], budget: 100, strategy: "random" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_error");
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
