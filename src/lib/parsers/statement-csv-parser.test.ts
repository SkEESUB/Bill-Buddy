import { describe, expect, it } from "vitest";
import {
  parseBankStatementCsv,
  parseAmount,
  parseDate,
  classifyTransaction,
  sanitizeFormulaInjection,
} from "./statement-csv-parser";

describe("Statement CSV Parser — Indian Bank Formats & Classification", () => {
  it("parses Bank of Baroda (BOB) statement with separate Withdrawal and Deposit columns", () => {
    const bobCsv = `
Bank of Baroda - Account Statement
Account Name: Rajesh Kumar
Account Number: 12345678901234
Period: 01/10/2026 to 25/10/2026

Date,Description,Cheque No.,Withdrawal (Dr),Deposit (Cr),Balance
02-10-2026,UPI/SWIGGY/123456/PAYMENT,,450.00,,95550.00
05-10-2026,SALARY CREDIT NEFT,, ,50000.00,145550.00
10-10-2026,INDIAN OIL PETROL,,1200.50,,144349.50
12-10-2026,AMAZON REFUND RET,, ,899.00,145248.50
15-10-2026,AUTO SWEEP TO MOD,,25000.00,,120248.50
20-10-2026,"D-MART GROCERIES, ANDHERI",,3450.00,,116798.50
`;

    const result = parseBankStatementCsv(bobCsv);
    expect(result.success).toBe(true);
    expect(result.confidence).toBe("high");
    expect(result.summary.totalRows).toBe(6);

    // Classification checks:
    // 1. Swiggy -> Eligible Expense (Debit: 450)
    expect(result.rows[0]?.type).toBe("expense");
    expect(result.rows[0]?.isEligibleExpense).toBe(true);
    expect(result.rows[0]?.debit).toBe(450);
    expect(result.rows[0]?.date).toBe("2026-10-02");

    // 2. Salary -> Income (Credit: 50000)
    expect(result.rows[1]?.type).toBe("income");
    expect(result.rows[1]?.isEligibleExpense).toBe(false);

    // 3. Petrol -> Expense (Debit: 1200.50)
    expect(result.rows[2]?.type).toBe("expense");
    expect(result.rows[2]?.isEligibleExpense).toBe(true);
    expect(result.rows[2]?.debit).toBe(1200.5);

    // 4. Refund -> Refund (Credit: 899.00)
    expect(result.rows[3]?.type).toBe("refund");
    expect(result.rows[3]?.isEligibleExpense).toBe(false);

    // 5. Sweep -> Transfer (Debit: 25000)
    expect(result.rows[4]?.type).toBe("transfer");
    expect(result.rows[4]?.isEligibleExpense).toBe(false);

    // 6. Quoted D-Mart with comma -> Expense (Debit: 3450)
    expect(result.rows[5]?.type).toBe("expense");
    expect(result.rows[5]?.isEligibleExpense).toBe(true);
    expect(result.rows[5]?.description).toBe("D-MART GROCERIES, ANDHERI");

    // Summary counts
    expect(result.summary.eligibleExpenses).toBe(3);
    expect(result.summary.income).toBe(1);
    expect(result.summary.refunds).toBe(1);
    expect(result.summary.transfers).toBe(1);
    expect(result.summary.totalExpenseAmount).toBe(5100.5);
  });

  it("parses SBI statement format with Ref No and Value Date", () => {
    const sbiCsv = `Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
01/10/2026,01/10/2026,TO TRANSFER-UPI/DR/628192312/ZOMATO,UPI628192312,280.00,,12400.00
03/10/2026,03/10/2026,BY CLG CHQ-REVERSAL OF CHG,REF99812,,150.00,12550.00
05/10/2026,05/10/2026,TO TRANSFER-SELF TRANSFER OWN A/C,TRF1231,1000.00,,11550.00
`;

    const result = parseBankStatementCsv(sbiCsv);
    expect(result.success).toBe(true);
    expect(result.summary.totalRows).toBe(3);
    expect(result.rows[0]?.date).toBe("2026-10-01");
    expect(result.rows[0]?.reference).toBe("UPI628192312");
    expect(result.rows[0]?.type).toBe("expense");
    expect(result.rows[0]?.isEligibleExpense).toBe(true);

    expect(result.rows[1]?.type).toBe("refund");
    expect(result.rows[2]?.type).toBe("transfer");
  });

  it("handles negative amounts representing debits in single Amount column", () => {
    const neobankCsv = `Date,Description,Amount,Type
2026-10-24,Uber Ride,-245.50,DR
2026-10-24,Freelance Payment,15000.00,CR
2026-10-25,Coffee Shop,-120.00,DR
`;

    const result = parseBankStatementCsv(neobankCsv);
    expect(result.success).toBe(true);
    expect(result.summary.eligibleExpenses).toBe(2);
    expect(result.rows[0]?.debit).toBe(245.5);
    expect(result.rows[0]?.type).toBe("expense");
    expect(result.rows[1]?.credit).toBe(15000);
    expect(result.rows[1]?.type).toBe("income");
  });

  it("handles Indian number formatting with commas and currency symbols", () => {
    expect(parseAmount("₹1,25,450.50")).toBe(125450.5);
    expect(parseAmount("Rs. 450.00 Dr")).toBe(-450);
    expect(parseAmount("1,000.00 Cr")).toBe(1000);
    expect(parseAmount("(500.00)")).toBe(-500);
    expect(parseAmount("")).toBe(0);
  });

  it("parses multiple date formats including text months", () => {
    expect(parseDate("25/10/2026")).toBe("2026-10-25");
    expect(parseDate("05-11-2026")).toBe("2026-11-05");
    expect(parseDate("2026-10-30")).toBe("2026-10-30");
    expect(parseDate("15-OCT-2026")).toBe("2026-10-15");
    expect(parseDate("01-Jan-2026")).toBe("2026-01-01");
    expect(parseDate("invalid-date")).toBeNull();
  });

  it("sanitizes spreadsheet formula injection in descriptions and references", () => {
    expect(sanitizeFormulaInjection("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeFormulaInjection("+123456")).toBe("'+123456");
    expect(sanitizeFormulaInjection("-Payment")).toBe("'-Payment");
    expect(sanitizeFormulaInjection("@admin")).toBe("'@admin");
    expect(sanitizeFormulaInjection("Normal Description")).toBe("Normal Description");
  });

  it("detects and flags invalid rows gracefully without crashing", () => {
    const corruptCsv = `Date,Description,Withdrawal (Dr),Deposit (Cr)
invalid-date,Bad Date Row,100.00,
25-10-2026,,200.00,
26-10-2026,Zero Amount,0.00,0.00
27-10-2026,Valid Row,50.00,
`;

    const result = parseBankStatementCsv(corruptCsv);
    expect(result.rows.length).toBe(4);
    expect(result.summary.invalid).toBe(3);
    expect(result.summary.eligibleExpenses).toBe(1);
    expect(result.rows[0]?.error).toBe("Invalid date format");
    expect(result.rows[1]?.error).toBe("Missing description");
    expect(result.rows[2]?.error).toBe("Zero or invalid transaction amount");
    expect(result.rows[3]?.isEligibleExpense).toBe(true);
  });
});
