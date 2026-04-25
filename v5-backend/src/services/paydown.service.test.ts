import { describe, it, expect } from "vitest";
import type { Debt } from "../types/index.js";
import { computePaydown } from "./paydown.service.js";

const debts: Debt[] = [
  { id: "1", name: "Big", balance: 5000, rate: 20, minPayment: 100 },
  { id: "2", name: "Small", balance: 500, rate: 8, minPayment: 25 },
];

describe("computePaydown", () => {
  it("dispatches to avalanche and targets the highest-rate debt first", () => {
    const result = computePaydown(debts, 200, "avalanche");
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    expect(result.schedule[0]?.find((e) => e.targeted)?.name).toBe("Big");
  });

  it("dispatches to snowball and targets the smallest balance first", () => {
    const result = computePaydown(debts, 200, "snowball");
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    expect(result.schedule[0]?.find((e) => e.targeted)?.name).toBe("Small");
  });
});
