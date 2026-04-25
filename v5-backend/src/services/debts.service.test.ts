import { beforeEach, describe, it, expect } from "vitest";
import {
  _resetForTests,
  createDebt,
  deleteDebtById,
  listDebts,
} from "./debts.service.js";

beforeEach(() => {
  _resetForTests();
});

describe("debts service", () => {
  it("starts empty", () => {
    expect(listDebts()).toEqual([]);
  });

  it("createDebt assigns a uuid and stores the debt", () => {
    const created = createDebt({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(created.name).toBe("Visa");
    expect(listDebts()).toEqual([created]);
  });

  it("listDebts returns debts in insertion order", () => {
    const a = createDebt({ name: "A", balance: 100, rate: 10, minPayment: 25 });
    const b = createDebt({ name: "B", balance: 200, rate: 10, minPayment: 25 });
    const c = createDebt({ name: "C", balance: 300, rate: 10, minPayment: 25 });
    expect(listDebts().map((d) => d.id)).toEqual([a.id, b.id, c.id]);
  });

  it("deleteDebtById returns true when removing an existing debt", () => {
    const created = createDebt({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    expect(deleteDebtById(created.id)).toBe(true);
    expect(listDebts()).toEqual([]);
  });

  it("deleteDebtById returns false when the id does not exist", () => {
    expect(deleteDebtById("not-a-real-id")).toBe(false);
  });
});
