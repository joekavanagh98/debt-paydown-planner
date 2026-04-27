import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before any import statements in this file, so the
// mock is in place by the time @anthropic-ai/sdk gets imported by
// extraction.service.ts. mockCreate is the captured fn we drive
// from each test's setup.
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Anthropic's default export is a class invoked with `new`. vi.fn
// wrapped in an arrow factory isn't constructable, so we mock with
// an actual class whose `messages.create` is the captured mock.
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_options: unknown) {}
  },
}));

import { ExtractionError } from "../errors/AppError.js";
import { extractDebtsFromText } from "./extraction.service.js";

describe("extractDebtsFromText", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns parsed debts when the model produces a valid tool call", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "save_debts",
          input: {
            debts: [
              { name: "Visa", balance: 5000, rate: 24, minPayment: 100 },
              { name: "Auto Loan", balance: 12000, rate: 6.5 },
            ],
          },
        },
      ],
    });

    const result = await extractDebtsFromText("any input");
    expect(result.debts).toHaveLength(2);
    expect(result.debts[0]).toEqual({
      name: "Visa",
      balance: 5000,
      rate: 24,
      minPayment: 100,
    });
    expect(result.debts[1]?.minPayment).toBeUndefined();
  });

  it("returns an empty array when the model finds no debts", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "save_debts",
          input: { debts: [] },
        },
      ],
    });

    const result = await extractDebtsFromText("Just a deposit account.");
    expect(result.debts).toEqual([]);
  });

  it("throws ExtractionError when the model returns no tool_use block", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot extract debts from this." }],
    });

    await expect(extractDebtsFromText("any")).rejects.toThrow(ExtractionError);
  });

  it("throws ExtractionError when the model's output fails Zod validation", async () => {
    // negative balance: passes the JSON Schema, fails our Zod schema
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "save_debts",
          input: {
            debts: [{ name: "Bad", balance: -100, rate: 24 }],
          },
        },
      ],
    });

    await expect(extractDebtsFromText("any")).rejects.toThrow(ExtractionError);
  });

  it("throws ExtractionError on a missing required field", async () => {
    // missing rate
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "save_debts",
          input: {
            debts: [{ name: "Card", balance: 1000 }],
          },
        },
      ],
    });

    await expect(extractDebtsFromText("any")).rejects.toThrow(ExtractionError);
  });

  it("propagates SDK/network errors through (no swallow, no remap)", async () => {
    mockCreate.mockRejectedValue(new Error("network down"));

    await expect(extractDebtsFromText("any")).rejects.toThrow("network down");
  });

  it("wraps the user-provided text in <statement> tags before sending", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "save_debts",
          input: { debts: [] },
        },
      ],
    });

    await extractDebtsFromText("Visa balance $5000 at 24% APR");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0]?.[0] as {
      messages: { role: string; content: string }[];
      system: string;
    };
    expect(call.messages[0]?.content).toBe(
      "<statement>\nVisa balance $5000 at 24% APR\n</statement>",
    );
    // Sanity check: the system prompt names the delimiter so the
    // model can act on the boundary. If this assertion fails the
    // wrapping is doing nothing.
    expect(call.system).toContain("<statement> tags");
  });
});
