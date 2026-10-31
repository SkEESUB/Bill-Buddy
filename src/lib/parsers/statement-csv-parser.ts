/**
 * Bank Statement CSV Parser for BillBuddy.
 *
 * Supports common Indian and international bank statement formats:
 * - Bank of Baroda (BOB)
 * - State Bank of India (SBI)
 * - HDFC Bank
 * - ICICI Bank
 * - Axis Bank
 * - Generic statements (separate debit/credit, signed amount, or type columns)
 *
 * Features:
 * - RFC 4180 compliant CSV tokenizer (handles quotes, commas inside fields, CRLF/LF)
 * - Metadata preamble detection (skips header disclaimers/account info)
 * - Intelligent header autodetection with fuzzy aliases
 * - Resilient date parsing (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD-MMM-YYYY)
 * - INR amount cleaning (commas, Dr/Cr suffixes, parentheses, minus signs)
 * - Transaction classification (expense, income, refund, transfer, unknown)
 * - CSV formula injection protection
 */

export type TransactionType = "expense" | "income" | "refund" | "transfer" | "unknown";

export interface ParsedStatementRow {
  index: number;
  rawDate: string;
  date: string; // ISO YYYY-MM-DD
  rawDescription: string;
  description: string;
  debit: number;
  credit: number;
  amount: number;
  reference: string | null;
  type: TransactionType;
  isEligibleExpense: boolean;
  notes: string | null;
  error?: string | undefined;
}

export interface StatementParseResult {
  success: boolean;
  rows: ParsedStatementRow[];
  headerRowIndex: number;
  headers: string[];
  columnMapping: {
    date: string | null;
    description: string | null;
    debit: string | null;
    credit: string | null;
    amount: string | null;
    type: string | null;
    reference: string | null;
  };
  confidence: "high" | "medium" | "low";
  summary: {
    totalRows: number;
    eligibleExpenses: number;
    income: number;
    refunds: number;
    transfers: number;
    unknown: number;
    invalid: number;
    totalExpenseAmount: number;
  };
  errors: string[];
}

/**
 * Protect against Spreadsheet Formula Injection (CSV Injection).
 * If a string starts with =, +, -, @, \t, or \r, strip or neutralize it.
 */
export function sanitizeFormulaInjection(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // Escape or strip leading dangerous character
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * RFC-4180 compliant CSV tokenizer.
 * Properly handles quotes, commas inside quotes, multiline values, and CRLF.
 */
export function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  // Remove UTF-8 BOM if present
  const text = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i++;
        } else {
          // Closing quote
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRecord.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++; // Skip \n
        }
        currentRecord.push(currentField.trim());
        records.push(currentRecord);
        currentRecord = [];
        currentField = "";
      } else if (char === "\n") {
        currentRecord.push(currentField.trim());
        records.push(currentRecord);
        currentRecord = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  // Final field and record
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    records.push(currentRecord);
  }

  // Filter out completely empty rows
  return records.filter((row) => row.some((cell) => cell.length > 0));
}

/**
 * Normalizes header names for fuzzy matching.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Find the most likely header row by looking for key banking keywords.
 */
function findHeaderRow(records: string[][]): {
  index: number;
  mapping: StatementParseResult["columnMapping"];
  confidence: "high" | "medium" | "low";
} {
  const dateKeywords = [
    "date",
    "txndate",
    "transactiondate",
    "valuedate",
    "transdate",
    "bookingdate",
  ];
  const descKeywords = [
    "narration",
    "description",
    "particulars",
    "details",
    "remarks",
    "merchant",
    "payee",
  ];
  const debitKeywords = [
    "debit",
    "withdrawal",
    "withdrawalamt",
    "dr",
    "withdrawalamount",
    "debitamt",
    "paidout",
  ];
  const creditKeywords = [
    "credit",
    "deposit",
    "depositamt",
    "cr",
    "depositamount",
    "creditamt",
    "paidin",
  ];
  const amountKeywords = ["amount", "txnamount", "transactionamount", "netamount"];
  const typeKeywords = ["type", "drcr", "crdr", "txntype", "transactiontype"];
  const refKeywords = [
    "refno",
    "reference",
    "utr",
    "chequeno",
    "chqno",
    "referenceno",
    "txnid",
    "transactionid",
    "tranid",
  ];

  let bestScore = -1;
  let bestRowIndex = 0;
  let bestMapping: StatementParseResult["columnMapping"] = {
    date: null,
    description: null,
    debit: null,
    credit: null,
    amount: null,
    type: null,
    reference: null,
  };

  // Inspect first 25 rows for header candidates
  const limit = Math.min(records.length, 25);
  for (let r = 0; r < limit; r++) {
    const row = records[r] || [];
    const norm = row.map((c) => normalizeHeader(c));

    let score = 0;
    const mapping: StatementParseResult["columnMapping"] = {
      date: null,
      description: null,
      debit: null,
      credit: null,
      amount: null,
      type: null,
      reference: null,
    };

    for (let c = 0; c < norm.length; c++) {
      const header = norm[c] || "";
      const rawHeader = row[c] || "";

      if (!mapping.date && dateKeywords.some((k) => header.includes(k))) {
        mapping.date = rawHeader;
        score += 3;
      } else if (!mapping.description && descKeywords.some((k) => header.includes(k))) {
        mapping.description = rawHeader;
        score += 3;
      } else if (!mapping.debit && debitKeywords.some((k) => header.includes(k))) {
        mapping.debit = rawHeader;
        score += 2;
      } else if (!mapping.credit && creditKeywords.some((k) => header.includes(k))) {
        mapping.credit = rawHeader;
        score += 2;
      } else if (!mapping.amount && amountKeywords.some((k) => header.includes(k))) {
        mapping.amount = rawHeader;
        score += 2;
      } else if (!mapping.type && typeKeywords.some((k) => header.includes(k))) {
        mapping.type = rawHeader;
        score += 1;
      } else if (!mapping.reference && refKeywords.some((k) => header.includes(k))) {
        mapping.reference = rawHeader;
        score += 1;
      }
    }

    if (mapping.date && mapping.description && (mapping.debit || mapping.amount)) {
      score += 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
      bestMapping = mapping;
    }
  }

  const confidence = bestScore >= 8 ? "high" : bestScore >= 5 ? "medium" : "low";

  return {
    index: bestRowIndex,
    mapping: bestMapping,
    confidence,
  };
}

/**
 * Parse an Indian or International numeric string to clean float.
 */
export function parseAmount(value: string | undefined | null): number {
  if (!value) return 0;
  let clean = value.trim();

  // Handle parentheses for negative: (500.00) -> -500.00
  if (clean.startsWith("(") && clean.endsWith(")")) {
    clean = `-${clean.slice(1, -1)}`;
  }

  // Check for trailing Dr/Cr before stripping currency labels
  let isDebit = false;
  let isCredit = false;
  if (/\bdr\.?$/i.test(clean) || /dr$/i.test(clean)) {
    isDebit = true;
    clean = clean.replace(/\bdr\.?$/i, "").replace(/dr$/i, "");
  } else if (/\bcr\.?$/i.test(clean) || /cr$/i.test(clean)) {
    isCredit = true;
    clean = clean.replace(/\bcr\.?$/i, "").replace(/cr$/i, "");
  }

  // Remove currency prefixes (Rs., Rs, INR, symbols) and commas/whitespace
  clean = clean.replace(/^(rs\.?|inr|₹|\$|€|£)\s*/gi, "");
  clean = clean.replace(/[₹$€£\s,]/gi, "");

  const num = parseFloat(clean);
  if (isNaN(num)) return 0;

  if (isDebit && num > 0) return -num;
  if (isCredit && num < 0) return Math.abs(num);

  return num;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Parses diverse bank date formats into standard YYYY-MM-DD.
 */
export function parseDate(rawDate: string): string | null {
  if (!rawDate) return null;
  const clean = rawDate.trim().replace(/[/\\]/g, "-");

  // ISO: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // DD-MMM-YYYY (e.g. 25-OCT-2026, 05-Nov-2026)
  const textMonthMatch = clean.match(/^(\d{1,2})-([a-zA-Z]{3})-(\d{2,4})/);
  if (textMonthMatch && textMonthMatch[1] && textMonthMatch[2] && textMonthMatch[3]) {
    const d = textMonthMatch[1].padStart(2, "0");
    const mStr = textMonthMatch[2].toLowerCase();
    const m = MONTHS[mStr];
    let y = textMonthMatch[3];
    if (y.length === 2) y = `20${y}`;
    if (m) return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or MM-DD-YYYY
  const numericMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (numericMatch && numericMatch[1] && numericMatch[2] && numericMatch[3]) {
    const part1 = parseInt(numericMatch[1], 10);
    const part2 = parseInt(numericMatch[2], 10);
    let y = numericMatch[3];
    if (y.length === 2) y = `20${y}`;

    // Standard in India is DD-MM-YYYY
    let d = part1;
    let m = part2;

    if (part1 > 12 && part2 <= 12) {
      d = part1;
      m = part2;
    } else if (part2 > 12 && part1 <= 12) {
      m = part1;
      d = part2;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Classify a statement row based on amounts and narration patterns.
 */
export function classifyTransaction(
  debit: number,
  credit: number,
  description: string,
): TransactionType {
  const desc = description.toLowerCase();

  // 1. Refunds and Reversals
  const refundPatterns = [
    "refund",
    "reversal",
    "cashback",
    "rev:",
    "chargeback",
    "reversed",
    "failed txn rev",
  ];
  if (credit > 0 && refundPatterns.some((p) => desc.includes(p))) {
    return "refund";
  }

  // 2. Transfers
  const transferPatterns = [
    "self transfer",
    "own account",
    "sweep",
    "auto sweep",
    "mod transfer",
    "transfer to own",
    "fd closure",
    "rd transfer",
  ];
  if (transferPatterns.some((p) => desc.includes(p))) {
    return "transfer";
  }

  // 3. Clear Debit -> Expense
  if (debit > 0 && credit === 0) {
    return "expense";
  }

  // 4. Clear Credit -> Income
  if (credit > 0 && debit === 0) {
    return "income";
  }

  // 5. Mixed or unclear
  if (debit > 0 && credit > 0) {
    return "unknown";
  }

  return "unknown";
}

export interface CustomColumnMapping {
  dateCol?: string;
  descCol?: string;
  debitCol?: string;
  creditCol?: string;
  amountCol?: string;
  typeCol?: string;
  refCol?: string;
}

/**
 * Main parser entry point.
 */
export function parseBankStatementCsv(
  csvText: string,
  customMapping?: CustomColumnMapping,
): StatementParseResult {
  const records = parseCsvRecords(csvText);
  const errors: string[] = [];

  if (records.length === 0) {
    return {
      success: false,
      rows: [],
      headerRowIndex: -1,
      headers: [],
      columnMapping: {
        date: null,
        description: null,
        debit: null,
        credit: null,
        amount: null,
        type: null,
        reference: null,
      },
      confidence: "low",
      summary: {
        totalRows: 0,
        eligibleExpenses: 0,
        income: 0,
        refunds: 0,
        transfers: 0,
        unknown: 0,
        invalid: 0,
        totalExpenseAmount: 0,
      },
      errors: ["Empty CSV file"],
    };
  }

  const detected = findHeaderRow(records);
  const headerRowIndex = detected.index;
  const headers = records[headerRowIndex] || [];

  // Merge auto-detected mapping with user-supplied custom overrides
  const mapping = {
    date: customMapping?.dateCol ?? detected.mapping.date,
    description: customMapping?.descCol ?? detected.mapping.description,
    debit: customMapping?.debitCol ?? detected.mapping.debit,
    credit: customMapping?.creditCol ?? detected.mapping.credit,
    amount: customMapping?.amountCol ?? detected.mapping.amount,
    type: customMapping?.typeCol ?? detected.mapping.type,
    reference: customMapping?.refCol ?? detected.mapping.reference,
  };

  const getColIndex = (name: string | null): number => {
    if (!name) return -1;
    return headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
  };

  const dateIdx = getColIndex(mapping.date);
  const descIdx = getColIndex(mapping.description);
  const debitIdx = getColIndex(mapping.debit);
  const creditIdx = getColIndex(mapping.credit);
  const amountIdx = getColIndex(mapping.amount);
  const typeIdx = getColIndex(mapping.type);
  const refIdx = getColIndex(mapping.reference);

  if (dateIdx === -1) errors.push("Missing Date column");
  if (descIdx === -1) errors.push("Missing Description/Narration column");
  if (debitIdx === -1 && amountIdx === -1) {
    errors.push("Missing Debit or Amount column");
  }

  const rows: ParsedStatementRow[] = [];
  let eligibleExpenses = 0;
  let incomeCount = 0;
  let refundCount = 0;
  let transferCount = 0;
  let unknownCount = 0;
  let invalidCount = 0;
  let totalExpenseAmount = 0;

  for (let r = headerRowIndex + 1; r < records.length; r++) {
    const rawRow = records[r] || [];
    if (rawRow.length === 0 || rawRow.every((c) => !c.trim())) continue;

    const rawDate = dateIdx >= 0 ? rawRow[dateIdx] || "" : "";
    const rawDesc = descIdx >= 0 ? rawRow[descIdx] || "" : "";
    const rawDebit = debitIdx >= 0 ? rawRow[debitIdx] || "" : "";
    const rawCredit = creditIdx >= 0 ? rawRow[creditIdx] || "" : "";
    const rawAmount = amountIdx >= 0 ? rawRow[amountIdx] || "" : "";
    const rawType = typeIdx >= 0 ? rawRow[typeIdx] || "" : "";
    const rawRef = refIdx >= 0 ? rawRow[refIdx] || "" : "";

    const parsedDate = parseDate(rawDate);
    const sanitizedDesc = sanitizeFormulaInjection(rawDesc);
    const sanitizedRef = rawRef ? sanitizeFormulaInjection(rawRef) : null;

    let debit = 0;
    let credit = 0;

    if (debitIdx >= 0 || creditIdx >= 0) {
      const d = parseAmount(rawDebit);
      const c = parseAmount(rawCredit);
      debit = Math.abs(d);
      credit = Math.abs(c);
    } else if (amountIdx >= 0) {
      const parsedAmt = parseAmount(rawAmount);
      const isDebitFromType = /^(dr|debit|withdrawal)/i.test(rawType.trim());
      const isCreditFromType = /^(cr|credit|deposit)/i.test(rawType.trim());

      if (parsedAmt < 0 || isDebitFromType) {
        debit = Math.abs(parsedAmt);
      } else if (parsedAmt > 0 || isCreditFromType) {
        credit = Math.abs(parsedAmt);
      }
    }

    let error: string | undefined;
    if (!parsedDate) {
      error = "Invalid date format";
      invalidCount++;
    } else if (!sanitizedDesc) {
      error = "Missing description";
      invalidCount++;
    } else if (debit === 0 && credit === 0) {
      error = "Zero or invalid transaction amount";
      invalidCount++;
    }

    const type = error ? "unknown" : classifyTransaction(debit, credit, sanitizedDesc);
    const isEligible = !error && type === "expense" && debit > 0;

    if (isEligible) {
      eligibleExpenses++;
      totalExpenseAmount += debit;
    } else if (type === "income") {
      incomeCount++;
    } else if (type === "refund") {
      refundCount++;
    } else if (type === "transfer") {
      transferCount++;
    } else if (!error) {
      unknownCount++;
    }

    rows.push({
      index: r,
      rawDate,
      date: parsedDate || "",
      rawDescription: rawDesc,
      description: sanitizedDesc || "Bank Transaction",
      debit,
      credit,
      amount: debit > 0 ? debit : credit,
      reference: sanitizedRef,
      type,
      isEligibleExpense: isEligible,
      notes: sanitizedRef ? `Ref: ${sanitizedRef}` : null,
      error,
    });
  }

  return {
    success: errors.length === 0,
    rows,
    headerRowIndex,
    headers,
    columnMapping: mapping,
    confidence: detected.confidence,
    summary: {
      totalRows: rows.length,
      eligibleExpenses,
      income: incomeCount,
      refunds: refundCount,
      transfers: transferCount,
      unknown: unknownCount,
      invalid: invalidCount,
      totalExpenseAmount: Math.round(totalExpenseAmount * 100) / 100,
    },
    errors,
  };
}
