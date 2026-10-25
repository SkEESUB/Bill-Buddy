import { describe, expect, it } from "vitest";
import { buildReminderEmailHtml, sendReminderEmail } from "./email.server";
import { addDays } from "./money";

describe("Email Reminder System", () => {
  it("builds a responsive, formatted HTML reminder email", () => {
    const html = buildReminderEmailHtml({
      to: "user@example.com",
      billTitle: "Electricity Bill",
      amount: 2450.75,
      dueDate: "2026-11-15",
      notes: "Consumer No: 987654321",
    });

    expect(html).toContain("Electricity Bill");
    expect(html).toContain("2,450.75");
    expect(html).toContain("2026-11-15");
    expect(html).toContain("Consumer No: 987654321");
    expect(html).toContain("BillBuddy Reminder");
  });

  it("handles missing provider credentials gracefully without throwing", async () => {
    const originalKey = process.env["RESEND_API_KEY"];
    delete process.env["RESEND_API_KEY"];

    try {
      const result = await sendReminderEmail({
        to: "test@example.com",
        billTitle: "Internet Bill",
        amount: 999,
        dueDate: "2026-11-20",
      });

      expect(result.delivered).toBe(false);
      expect(result.provider).toBe("none");
      expect(result.error).toContain("No email provider configured");
    } finally {
      if (originalKey) process.env["RESEND_API_KEY"] = originalKey;
    }
  });

  it("calculates reminder lead times accurately", () => {
    const dueDate = "2026-11-10";

    expect(addDays(dueDate, 0)).toBe("2026-11-10"); // on due date
    expect(addDays(dueDate, -1)).toBe("2026-11-09"); // 1 day before
    expect(addDays(dueDate, -3)).toBe("2026-11-07"); // 3 days before
    expect(addDays(dueDate, -7)).toBe("2026-11-03"); // 7 days before
  });
});
