import { describe, it, expect } from "vitest";
import {
  parseNotification,
  isPrivacySensitiveOrPromotional,
  SUPPORTED_PACKAGES,
} from "./notification-parser";

describe("Notification Payment Parsers", () => {
  describe("Privacy & Promotional Filter", () => {
    it("drops OTP notifications immediately", () => {
      expect(
        isPrivacySensitiveOrPromotional(
          "PhonePe",
          "Your PhonePe OTP is 482910. Do not share it with anyone.",
        ),
      ).toBe(true);

      expect(
        isPrivacySensitiveOrPromotional(
          "Bank of Baroda",
          "Your OTP for Transaction of Rs. 450 at Swiggy is 674921. Valid for 5 mins.",
        ),
      ).toBe(true);

      expect(
        isPrivacySensitiveOrPromotional(
          "Google Pay",
          "123456 is your Google Pay verification code.",
        ),
      ).toBe(true);
    });

    it("drops UPI PIN and password alerts", () => {
      expect(
        isPrivacySensitiveOrPromotional(
          "Security Alert",
          "Never share your UPI PIN or ATM PIN with bank staff.",
        ),
      ).toBe(true);
    });

    it("drops promotional and loan marketing messages", () => {
      expect(
        isPrivacySensitiveOrPromotional(
          "Paytm Offer",
          "Congratulations! You have a pre-approved personal loan of up to Rs. 2,00,000. Apply now!",
        ),
      ).toBe(true);

      expect(
        isPrivacySensitiveOrPromotional(
          "PhonePe Rewards",
          "Claim your prize! Get cashback of up to Rs. 500 on your next mobile recharge.",
        ),
      ).toBe(true);
    });

    it("allows genuine transaction notifications through", () => {
      expect(isPrivacySensitiveOrPromotional("PhonePe", "Paid ₹450 to Swiggy successfully")).toBe(
        false,
      );

      expect(
        isPrivacySensitiveOrPromotional(
          "bob World",
          "A/c ...5678 debited by Rs. 2,400.00 on 30-Oct-26. Info: UPI/330491823412/Starbucks.",
        ),
      ).toBe(false);
    });
  });

  describe("PhonePe Notifications", () => {
    it("extracts outgoing debit payment", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PHONEPE,
        "Payment Successful",
        "Paid ₹450 to Swiggy successfully",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(450);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Swiggy");
    });

    it("extracts debit with reference number and account", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PHONEPE,
        "Transaction Alert",
        "Debited ₹1,250 from A/C XX1234 to Reliance Fresh. Txn ID: T2610301234",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(1250);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Reliance Fresh");
      expect(result?.reference).toBe("T2610301234");
      expect(result?.accountSuffix).toBe("1234");
    });

    it("classifies incoming credit as CREDIT", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PHONEPE,
        "Money Received",
        "Received ₹1,000 from Rahul Sharma",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(1000);
      expect(result?.direction).toBe("CREDIT");
      expect(result?.payee).toBe("Rahul Sharma");
    });
  });

  describe("Google Pay Notifications", () => {
    it("extracts outgoing debit payment", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.GPAY,
        "Google Pay",
        "You paid ₹250 to Chai Point",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(250);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Chai Point");
    });

    it("extracts debit with sent phrasing", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.GPAY,
        "Google Pay",
        "Payment of ₹850 to Zomato sent",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(850);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Zomato");
    });

    it("classifies incoming transfer as CREDIT", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.GPAY,
        "Google Pay",
        "Anita sent you ₹500",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(500);
      expect(result?.direction).toBe("CREDIT");
      expect(result?.payee).toBe("Anita");
    });
  });

  describe("Paytm Notifications", () => {
    it("extracts outgoing debit payment", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PAYTM,
        "Paytm",
        "Paid ₹150 to Sharma Grocery on Paytm",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(150);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Sharma Grocery");
    });

    it("extracts debit with reference number", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PAYTM,
        "Paytm Update",
        "Rs 320 debited from SBI a/c XX9876 for payment to Cafe Coffee Day. Ref: 4291823412",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(320);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Cafe Coffee Day");
      expect(result?.reference).toBe("4291823412");
    });

    it("classifies incoming credit as CREDIT", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.PAYTM,
        "Paytm",
        "Received Rs 500 from John via Paytm UPI",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(500);
      expect(result?.direction).toBe("CREDIT");
      expect(result?.payee).toBe("John");
    });
  });

  describe("Bank of Baroda (bob World) Notifications", () => {
    it("extracts outgoing debit with UPI narration", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.BOB_WORLD,
        "bob World Alert",
        "A/c ...5678 debited by Rs. 2,400.00 on 30-Oct-26. Info: UPI/330491823412/Starbucks. Avl Bal Rs. 14,200",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(2400);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toBe("Starbucks");
      expect(result?.reference).toBe("330491823412");
      expect(result?.accountSuffix).toBe("5678");
    });

    it("extracts debit towards POS merchant", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.BOB_WORLD,
        "BOB SMS Alert",
        "A/c ...1234 debited for Rs. 450 on 29-10-26 towards POS TXN AT RELIANCE DIGITAL",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(450);
      expect(result?.direction).toBe("DEBIT");
      expect(result?.payee).toContain("RELIANCE DIGITAL");
    });

    it("classifies incoming salary as CREDIT", () => {
      const result = parseNotification(
        SUPPORTED_PACKAGES.BOB_WORLD,
        "bob World",
        "A/c ...5678 credited by Rs. 25,000.00 on 30-Oct-26 by NEFT from INFOSYS LTD",
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(25000);
      expect(result?.direction).toBe("CREDIT");
      expect(result?.payee).toBe("INFOSYS LTD");
    });
  });

  describe("Edge Cases & Formatting", () => {
    it("returns null for non-financial notifications", () => {
      expect(
        parseNotification("com.whatsapp", "WhatsApp", "Hey are we still meeting today?"),
      ).toBeNull();
    });

    it("returns null if notification contains no currency amount", () => {
      expect(
        parseNotification(
          SUPPORTED_PACKAGES.PHONEPE,
          "PhonePe",
          "Your electricity bill is due tomorrow",
        ),
      ).toBeNull();
    });
  });
});
