import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { availableBalance, totalSpending, type TxnLike } from "./money";
import { TRANSACTION_STATUSES } from "./transactions";

describe("Phase 3: Mark as Complete payment recording", () => {
  const billsFnSrc = readFileSync(join(process.cwd(), "src/lib/bills.functions.ts"), "utf8");

  it("handles database schema constraints gracefully by supporting 'settled' and 'completed'", () => {
    expect(billsFnSrc).toContain('status: "settled"');
    expect(billsFnSrc).toContain('status: "completed"');
    expect(billsFnSrc).toContain('status === "paid"');
  });

  it("TRANSACTION_STATUSES includes both settled and completed statuses", () => {
    expect(TRANSACTION_STATUSES).toContain("settled");
    expect(TRANSACTION_STATUSES).toContain("completed");
  });

  it("money calculations count both 'settled' and 'completed' transactions", () => {
    const txns: TxnLike[] = [
      { type: "income", amount: 1000, date: "2026-10-01", status: "completed" },
      { type: "income", amount: 500, date: "2026-10-02", status: "settled" },
      { type: "bill_payment", amount: 300, date: "2026-10-03", status: "settled" },
      { type: "bill_payment", amount: 200, date: "2026-10-04", status: "completed" },
      { type: "bill_payment", amount: 999, date: "2026-10-05", status: "pending" }, // pending should NOT count
    ];

    const balance = availableBalance(0, txns);
    // (1000 + 500) - (300 + 200) = 1000
    expect(balance).toBe(1000);

    const spend = totalSpending(txns);
    // 300 + 200 = 500
    expect(spend).toBe(500);
  });

  describe("Update 4: Bill Completion Date Display", () => {
    const modalSrc = readFileSync(
      join(process.cwd(), "src/components/BillDetailsModal.tsx"),
      "utf8",
    );

    it("formats human dates accurately (e.g. 4 November 2026, 1 November 2026)", async () => {
      const { formatFullDate } = await import("./format");
      expect(formatFullDate("2026-11-04")).toBe("4 November 2026");
      expect(formatFullDate("2026-11-01")).toBe("1 November 2026");
      expect(formatFullDate("2026-10-15")).toBe("15 October 2026");
      expect(formatFullDate("2026-11-04T12:00:00.000Z")).toBe("4 November 2026");
    });

    it("displays Completed check and Payment completed on in BillDetailsModal when settled", () => {
      expect(modalSrc).toContain("Completed ✓");
      expect(modalSrc).toContain("Payment completed on:");
      expect(modalSrc).toContain("formatFullDate(occurrence.paidAt || occurrence.dueDate)");
    });

    it("preserves the original due date separately under Due Date in bill details list", () => {
      expect(modalSrc).toContain("Due Date");
      expect(modalSrc).toContain("formatFullDate(occurrence.dueDate)");
    });
  });
});
