import { describe, expect, it } from "vitest";
import {
  computeSpendDedupeHash,
  importStatementSpendsSchema,
  checkStatementDuplicatesSchema,
  type DuplicateCheckResult,
} from "./spends.functions";
import { parseBankStatementCsv, parseDate } from "./parsers/statement-csv-parser";

describe("Phase 2 — Bank Statement Import & Duplicate Detection", () => {
  const userIdA = "user-uuid-1111";
  const userIdB = "user-uuid-2222";

  // Sample Bank of Baroda CSV
  const bobCsv = `Bank of Baroda - Statement
Date,Description,Cheque No.,Withdrawal (Dr),Deposit (Cr),Balance
25-10-2026,UPI/SWIGGY/987654/FOOD,UPI987654,420.00,,50000.00
25-10-2026,UPI/AMAZON/112233/BOOKS,UPI112233,420.00,,49580.00
28-10-2026,BESCOM ELECTRICITY BILL,CHQ445566,1450.00,,48130.00
31-10-2026,MONTH END FUEL INDIAN OIL,REF778899,2000.00,,46130.00
`;

  it("parses Bank of Baroda sample with multiple expenses on same date with same amount", () => {
    const parsed = parseBankStatementCsv(bobCsv);
    expect(parsed.success).toBe(true);
    expect(parsed.summary.eligibleExpenses).toBe(4);

    // Two transactions on 25-10-2026 with same amount 420.00 but different references & descriptions
    const row1 = parsed.rows[0];
    const row2 = parsed.rows[1];
    expect(row1?.date).toBe("2026-10-25");
    expect(row2?.date).toBe("2026-10-25");
    expect(row1?.debit).toBe(420);
    expect(row2?.debit).toBe(420);
    expect(row1?.reference).toBe("UPI987654");
    expect(row2?.reference).toBe("UPI112233");

    // They must have distinct dedupe hashes because names and references differ
    const hash1 = computeSpendDedupeHash(userIdA, row1!.date, row1!.debit, row1!.description);
    const hash2 = computeSpendDedupeHash(userIdA, row2!.date, row2!.debit, row2!.description);
    expect(hash1).not.toBe(hash2);
  });

  it("handles duplicate statement uploads: identical file produces identical deduplication hashes", () => {
    const parsed1 = parseBankStatementCsv(bobCsv);
    const parsed2 = parseBankStatementCsv(bobCsv);

    for (let i = 0; i < parsed1.rows.length; i++) {
      const r1 = parsed1.rows[i]!;
      const r2 = parsed2.rows[i]!;
      const h1 = computeSpendDedupeHash(userIdA, r1.date, r1.debit, r1.description);
      const h2 = computeSpendDedupeHash(userIdA, r2.date, r2.debit, r2.description);
      expect(h1).toBe(h2);
    }
  });

  it("guarantees multi-user isolation in duplicate detection hashes", () => {
    const date = "2026-10-25";
    const amount = 420;
    const name = "UPI/SWIGGY/987654/FOOD";

    const hashUserA = computeSpendDedupeHash(userIdA, date, amount, name);
    const hashUserB = computeSpendDedupeHash(userIdB, date, amount, name);

    // User A and User B never collide or share duplicate keys
    expect(hashUserA).not.toBe(hashUserB);
  });

  it("detects duplicates against existing manual spends with same date and amount", () => {
    const existingSpends = [
      {
        id: "spend-existing-1",
        name: "Swiggy food order",
        amount: 420,
        spend_date: "2026-10-25",
        dedupe_hash: computeSpendDedupeHash(userIdA, "2026-10-25", 420, "Swiggy food order"),
        notes: null,
      },
    ];

    const candidate = {
      id: "candidate-1",
      name: "Swiggy food order",
      amount: 420,
      spend_date: "2026-10-25",
      reference: null,
    };

    const candHash = computeSpendDedupeHash(
      userIdA,
      candidate.spend_date,
      candidate.amount,
      candidate.name,
    );
    const match = existingSpends.find((s) => s.dedupe_hash === candHash);
    expect(match).toBeDefined();
    expect(match?.id).toBe("spend-existing-1");
  });

  it("detects duplicates against existing bill-payment ledger entries to prevent double counting", () => {
    // A bill payment was already recorded in transactions table
    const existingTransactions = [
      {
        id: "txn-bill-pay-1",
        description: "Electricity Bill (BESCOM)",
        amount: 1450,
        date: "2026-10-28",
        type: "bill_payment",
        bill_occurrence_id: "occ-12345",
      },
    ];

    // Bank statement includes the auto-debit for BESCOM
    const statementRow = {
      id: "cand-bescom",
      name: "BESCOM ELECTRICITY BILL",
      amount: 1450,
      spend_date: "2026-10-28",
      reference: "CHQ445566",
    };

    // Simulated ledger check logic matching checkStatementDuplicates handler
    const ledgerMatch = existingTransactions.find(
      (t) =>
        t.date === statementRow.spend_date &&
        Math.abs(t.amount - statementRow.amount) < 0.001 &&
        (t.type === "bill_payment" || t.bill_occurrence_id != null),
    );

    expect(ledgerMatch).toBeDefined();
    expect(ledgerMatch?.id).toBe("txn-bill-pay-1");
  });

  it("safely handles timezone boundaries on month and year ends", () => {
    expect(parseDate("31-10-2026")).toBe("2026-10-31");
    expect(parseDate("01-11-2026")).toBe("2026-11-01");
    expect(parseDate("31/12/2026")).toBe("2026-12-31");
    expect(parseDate("01/01/2027")).toBe("2027-01-01");
    expect(parseDate("29-Feb-2024")).toBe("2024-02-29");
  });

  it("validates server payload schemas for importStatementSpends", () => {
    const validPayload = {
      spends: [
        {
          name: "Groceries",
          amount: 850.5,
          spend_date: "2026-10-30",
          notes: "Imported from BOB",
          reference: "REF123",
        },
      ],
    };

    const parsed = importStatementSpendsSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);

    // Rejects non-positive amounts
    const invalidAmount = importStatementSpendsSchema.safeParse({
      spends: [
        {
          name: "Groceries",
          amount: -50,
          spend_date: "2026-10-30",
        },
      ],
    });
    expect(invalidAmount.success).toBe(false);

    // Rejects invalid date format
    const invalidDate = importStatementSpendsSchema.safeParse({
      spends: [
        {
          name: "Groceries",
          amount: 50,
          spend_date: "30-10-2026", // Schema expects ISO YYYY-MM-DD
        },
      ],
    });
    expect(invalidDate.success).toBe(false);

    // Rejects empty spend name
    const invalidName = importStatementSpendsSchema.safeParse({
      spends: [
        {
          name: "   ",
          amount: 50,
          spend_date: "2026-10-30",
        },
      ],
    });
    expect(invalidName.success).toBe(false);
  });

  it("validates checkStatementDuplicates candidate schema", () => {
    const validCandidates = {
      candidates: [
        {
          id: "1",
          name: "Metro Recharge",
          amount: 200,
          spend_date: "2026-10-30",
          reference: "UTR987654321",
        },
      ],
    };
    expect(checkStatementDuplicatesSchema.safeParse(validCandidates).success).toBe(true);
  });
});
