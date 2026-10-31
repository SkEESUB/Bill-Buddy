/**
 * Notification Payment Parsers for Indian UPI and Banking Applications.
 *
 * Implements strict privacy pre-filtering (instant drop of OTPs, passwords, promotions),
 * extraction of amount, direction (DEBIT vs CREDIT), merchant/payee, and reference/UTR.
 *
 * Supported applications:
 * 1. PhonePe (com.phonepe.app)
 * 2. Google Pay (com.google.android.apps.nbu.paisa.user)
 * 3. Paytm (net.one97.paytm)
 * 4. Bank of Baroda bob World (com.bankofbaroda.mconnect)
 * 5. Generic banking notification fallback
 */

export type TransactionDirection = "DEBIT" | "CREDIT" | "UNKNOWN";

export interface ExtractedPayment {
  packageName: string;
  amount: number;
  direction: TransactionDirection;
  payee: string;
  timestamp: string; // ISO 8601 string
  reference?: string | null;
  accountSuffix?: string | null;
}

export const SUPPORTED_PACKAGES = {
  PHONEPE: "com.phonepe.app",
  GPAY: "com.google.android.apps.nbu.paisa.user",
  PAYTM: "net.one97.paytm",
  BOB_WORLD: "com.bankofbaroda.mconnect",
} as const;

/**
 * Privacy & Security Filter:
 * Detects OTPs, authentication secrets, passwords, UPI PINs, and promotional spam.
 * If matched, the notification MUST be discarded immediately in memory.
 */
export function isPrivacySensitiveOrPromotional(title: string, text: string): boolean {
  const combined = `${title} ${text}`.toLowerCase();

  // 1. Authentication, OTP, PIN, password keywords
  const sensitiveRegex =
    /\b(otp|one time password|verification code|security code|login code|secret code|auth code|password|upi pin|atm pin|cvv|do not share|valid for \d+ mins?)\b/i;
  if (sensitiveRegex.test(combined)) {
    return true;
  }

  // 2. Promotional, cashback, loan marketing keywords
  const promoRegex =
    /\b(pre-approved|apply now|congratulations|cashback of up to|claim your prize|flat \d+% off|limited period offer|discount coupon|free voucher|upgrade your credit card|exclusive offer)\b/i;
  if (promoRegex.test(combined)) {
    return true;
  }

  return false;
}

/**
 * Extract currency amounts like ₹450, Rs. 1,250.50, INR 500, Rs 320
 */
function extractAmount(text: string): number | null {
  // Regex to match (₹|Rs\.?|INR)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)
  const regex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const match = regex.exec(text);
  if (!match || !match[1]) return null;

  const cleanStr = match[1].replace(/,/g, "");
  const num = parseFloat(cleanStr);
  return Number.isNaN(num) || num <= 0 ? null : num;
}

/**
 * Extract UTR / Txn Reference Number if present
 */
function extractReference(text: string): string | null {
  const patterns = [
    /\b(?:upi|ref|rrn|txn|id)[:\s/]+([a-zA-Z0-9]{8,22})\b/i,
    /\bupi\/(\d{12})\b/i,
    /\b(?:txn\s*id|reference\s*no\.?)[:\s]+([a-zA-Z0-9]+)\b/i,
  ];

  for (const p of patterns) {
    const match = p.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract masked account suffix (e.g. "A/c ...5678" or "XX1234")
 */
function extractAccountSuffix(text: string): string | null {
  const match = /(?:a\/c|acct|account)\s*(?:no\.?)?\s*(?:[*xX.]+|ending\s+in\s+)(\d{3,4})/i.exec(
    text,
  );
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Clean & normalize payee / merchant name
 */
function sanitizePayee(raw: string): string {
  return raw
    .replace(/^(google\s*pay|paytm|phonepe|bob\s*world)\s+/i, "")
    .replace(/^(to|towards|for payment to|via|on)\s+/i, "")
    .replace(/\s+(via|on|using|through)\s+.*$/i, "")
    .replace(/\s+(successfully|completed|sent|avl\s*bal.*|txn\s*id.*|ref.*)$/i, "")
    .replace(/[^\w\s.&'-]/g, " ")
    .replace(/\.+$/, "")
    .trim()
    .replace(/\s{2,}/g, " ")
    .slice(0, 80);
}

// ---------------------------------------------------------
// APP-SPECIFIC PARSERS
// ---------------------------------------------------------

/**
 * PhonePe Parser:
 * Debit: "Paid ₹450 to Swiggy successfully"
 * Debit: "Payment of ₹1,250 to Uber completed"
 * Debit: "Debited ₹500 from A/C XX1234 to Reliance Fresh. Txn ID: T2610301234"
 * Credit: "Received ₹1,000 from Rahul Sharma"
 */
function parsePhonePe(
  text: string,
  title: string,
): { amount: number; direction: TransactionDirection; payee: string } | null {
  const amount = extractAmount(`${title} ${text}`);
  if (!amount) return null;

  const combined = `${title} ${text}`;

  // Credit detection
  if (/\b(received|credited|received from)\b/i.test(combined)) {
    const payeeMatch = /from\s+([A-Za-z0-9\s.&'-]+?)(?:\s+(?:via|on|\.)|$)/i.exec(text);
    return {
      amount,
      direction: "CREDIT",
      payee: payeeMatch && payeeMatch[1] ? sanitizePayee(payeeMatch[1]) : "Unknown Sender",
    };
  }

  // Debit detection
  const isDebit = /\b(paid|debited|payment of|sent to)\b/i.test(combined);
  if (!isDebit) {
    return { amount, direction: "UNKNOWN", payee: "PhonePe Payment" };
  }

  let payee = "PhonePe Merchant";
  const toMatch =
    /(?:to|payment to)\s+([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\bTxn\b|\bfrom\b|\busing\b|\bsuccessfully\b|\bcompleted\b)|$)/i.exec(
      text,
    );
  if (toMatch && toMatch[1]) {
    payee = sanitizePayee(toMatch[1]);
  }

  return { amount, direction: "DEBIT", payee };
}

/**
 * Google Pay Parser:
 * Debit: "You paid ₹250 to Chai Point"
 * Debit: "Payment of ₹850 to Zomato sent"
 * Credit: "Anita sent you ₹500"
 * Credit: "Received ₹2,000 on Google Pay"
 */
function parseGooglePay(
  text: string,
  title: string,
): { amount: number; direction: TransactionDirection; payee: string } | null {
  const amount = extractAmount(`${title} ${text}`);
  if (!amount) return null;

  const combined = `${title} ${text}`;

  // Credit detection
  if (/\b(sent you|received|credited)\b/i.test(combined)) {
    // Look in text first so title doesn't pollute sender
    const senderMatch =
      /^([A-Za-z0-9\s&'-]+?)\s+sent you/i.exec(text) || /from\s+([A-Za-z0-9\s&'-]+)/i.exec(text);
    return {
      amount,
      direction: "CREDIT",
      payee: senderMatch && senderMatch[1] ? sanitizePayee(senderMatch[1]) : "Google Pay Sender",
    };
  }

  // Debit detection
  const isDebit = /\b(you paid|paid|payment of|sent)\b/i.test(combined);
  if (!isDebit) {
    return { amount, direction: "UNKNOWN", payee: "Google Pay Payment" };
  }

  let payee = "Google Pay Merchant";
  const toMatch =
    /(?:paid\s+(?:₹|rs\.?|inr)?[\d,.]*\s+to|payment of\s+(?:₹|rs\.?|inr)?[\d,.]*\s+to|to)\s+([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\bsent\b|\bcompleted\b|\busing\b)|$)/i.exec(
      text,
    );
  if (toMatch && toMatch[1]) {
    payee = sanitizePayee(toMatch[1]);
  }

  return { amount, direction: "DEBIT", payee };
}

/**
 * Paytm Parser:
 * Debit: "Paid ₹150 to Sharma Grocery on Paytm"
 * Debit: "Rs 320 debited from SBI a/c XX9876 for payment to Cafe Coffee Day. Ref: 4291823412"
 * Credit: "Received Rs 500 from John via Paytm UPI"
 */
function parsePaytm(
  text: string,
  title: string,
): { amount: number; direction: TransactionDirection; payee: string } | null {
  const amount = extractAmount(`${title} ${text}`);
  if (!amount) return null;

  const combined = `${title} ${text}`;

  // Credit detection
  if (/\b(received|credited|received from)\b/i.test(combined)) {
    const senderMatch = /from\s+([A-Za-z0-9\s&'-]+?)(?:\s+(?:via|on|\.)|$)/i.exec(text);
    return {
      amount,
      direction: "CREDIT",
      payee: senderMatch && senderMatch[1] ? sanitizePayee(senderMatch[1]) : "Paytm Sender",
    };
  }

  // Debit detection
  const isDebit = /\b(paid|debited|payment of)\b/i.test(combined);
  if (!isDebit) {
    return { amount, direction: "UNKNOWN", payee: "Paytm Payment" };
  }

  let payee = "Paytm Merchant";
  const toMatch =
    /(?:payment to|to)\s+([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\bRef\b|\bon paytm\b|\busing\b|\bvia\b)|$)/i.exec(
      text,
    );
  if (toMatch && toMatch[1]) {
    payee = sanitizePayee(toMatch[1]);
  }

  return { amount, direction: "DEBIT", payee };
}

/**
 * Bank of Baroda (bob World) Parser:
 * Debit: "A/c ...5678 debited by Rs. 2,400.00 on 30-Oct-26. Info: UPI/330491823412/Starbucks. Avl Bal Rs. 14,200"
 * Debit: "A/c ...1234 debited for Rs. 450 on 29-10-26 towards POS TXN AT RELIANCE DIGITAL"
 * Credit: "A/c ...5678 credited by Rs. 25,000.00 on 30-Oct-26 by NEFT from INFOSYS LTD"
 */
function parseBankOfBaroda(
  text: string,
  title: string,
): { amount: number; direction: TransactionDirection; payee: string } | null {
  const combined = `${title} ${text}`;
  const amount = extractAmount(combined);
  if (!amount) return null;

  // Credit detection
  if (/\b(credited by|credited with|credit of)\b/i.test(combined)) {
    const senderMatch =
      /(?:from|by\s+[A-Za-z]+\s+from)\s+([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\bon\b)|$)/i.exec(combined);
    return {
      amount,
      direction: "CREDIT",
      payee:
        senderMatch && senderMatch[1] ? sanitizePayee(senderMatch[1]) : "Bank of Baroda Credit",
    };
  }

  // Debit detection
  const isDebit = /\b(debited by|debited for|debited with|debit of)\b/i.test(combined);
  if (!isDebit) {
    return { amount, direction: "UNKNOWN", payee: "Bank of Baroda Txn" };
  }

  let payee = "Bank of Baroda Debit";
  // Check for UPI narration: "Info: UPI/330491823412/Starbucks. Avl Bal..."
  const upiInfoMatch = /info:\s*upi\/[^/]+\/([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\/|\bAvl\b)|$)/i.exec(
    combined,
  );
  if (upiInfoMatch && upiInfoMatch[1]) {
    payee = sanitizePayee(upiInfoMatch[1]);
  } else {
    // Check for "towards POS TXN AT RELIANCE DIGITAL" or "to Amazon"
    const towardsMatch =
      /(?:towards|at|to)\s+([A-Za-z0-9\s&'-]+?)(?:\s*(?:\.|\bavl bal\b)|$)/i.exec(combined);
    if (towardsMatch && towardsMatch[1]) {
      payee = sanitizePayee(towardsMatch[1]);
    }
  }

  return { amount, direction: "DEBIT", payee };
}

// ---------------------------------------------------------
// MAIN PARSER FACADE
// ---------------------------------------------------------

/**
 * Universal payment notification parser.
 * Discards privacy-sensitive text and extracts clean payment data.
 */
export function parseNotification(
  packageName: string,
  title: string,
  text: string,
  postTimeMs?: number,
): ExtractedPayment | null {
  // 1. Mandatory Privacy & Security pre-filter
  if (isPrivacySensitiveOrPromotional(title, text)) {
    return null;
  }

  const pkg = packageName.toLowerCase().trim();
  const combined = `${title} ${text}`;

  let parsed: { amount: number; direction: TransactionDirection; payee: string } | null = null;

  if (pkg === SUPPORTED_PACKAGES.PHONEPE) {
    parsed = parsePhonePe(text, title);
  } else if (pkg === SUPPORTED_PACKAGES.GPAY) {
    parsed = parseGooglePay(text, title);
  } else if (pkg === SUPPORTED_PACKAGES.PAYTM) {
    parsed = parsePaytm(text, title);
  } else if (pkg === SUPPORTED_PACKAGES.BOB_WORLD) {
    parsed = parseBankOfBaroda(text, title);
  } else {
    // Generic fallback for other banking/UPI apps
    const amount = extractAmount(combined);
    if (amount) {
      const isCredit = /\b(received|credited)\b/i.test(combined);
      const isDebit = /\b(paid|debited|spent|sent)\b/i.test(combined);
      const direction: TransactionDirection = isCredit ? "CREDIT" : isDebit ? "DEBIT" : "UNKNOWN";
      parsed = { amount, direction, payee: "Banking Payment" };
    }
  }

  if (!parsed) return null;

  const timestamp = postTimeMs ? new Date(postTimeMs).toISOString() : new Date().toISOString();

  return {
    packageName: pkg,
    amount: parsed.amount,
    direction: parsed.direction,
    payee: parsed.payee,
    timestamp,
    reference: extractReference(combined),
    accountSuffix: extractAccountSuffix(combined),
  };
}
