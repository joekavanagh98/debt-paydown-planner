import { describe, it, expect } from "vitest";
import {
  createDebt,
  deleteDebtById,
  listDebts,
} from "./debts.service.js";

// setupMongo (vitest setupFile) handles connection lifecycle and
// per-test cleanup. No beforeEach reset hook needed in the service.

describe("debts service", () => {
  it("starts empty", async () => {
    expect(await listDebts()).toEqual([]);
  });

  it("createDebt assigns a uuid and stores the debt", async () => {
    const created = await createDebt({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(created.name).toBe("Visa");
    expect(await listDebts()).toEqual([created]);
  });

  it("listDebts returns each created debt", async () => {
    const a = await createDebt({ name: "A", balance: 100, rate: 10, minPayment: 25 });
    const b = await createDebt({ name: "B", balance: 200, rate: 10, minPayment: 25 });
    const c = await createDebt({ name: "C", balance: 300, rate: 10, minPayment: 25 });
    const ids = (await listDebts()).map((d) => d.id).sort();
    expect(ids).toEqual([a.id, b.id, c.id].sort());
  });

  it("deleteDebtById returns true when removing an existing debt", async () => {
    const created = await createDebt({
      name: "Visa",
      balance: 5000,
      rate: 20,
      minPayment: 100,
    });
    expect(await deleteDebtById(created.id)).toBe(true);
    expect(await listDebts()).toEqual([]);
  });

  it("deleteDebtById returns false when the id does not exist", async () => {
    expect(await deleteDebtById("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
