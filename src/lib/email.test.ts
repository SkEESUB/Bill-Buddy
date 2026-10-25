import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReminderEmailHtml, sendReminderEmail } from "./email.server";
import { processDueEmailReminders } from "./jobs.server";
import { addDays } from "./money";

describe("Email Reminder System", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds a responsive, formatted HTML reminder email with bill details", () => {
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

  it("includes UPI ID and one-click UPI payment link in email HTML when available", () => {
    const html = buildReminderEmailHtml({
      to: "user@example.com",
      billTitle: "Apartment Maintenance",
      amount: 5000,
      dueDate: "2026-11-01",
      upiId: "society@icici",
    });

    expect(html).toContain("society@icici");
    expect(html).toContain("Pay ₹5,000.00 via UPI");
    expect(html).toContain("upi://pay?pa=society%40icici&pn=Apartment%20Maintenance&am=5000&cu=INR");
  });

  it("handles missing provider credentials gracefully without throwing", async () => {
    delete process.env["RESEND_API_KEY"];

    const result = await sendReminderEmail({
      to: "test@example.com",
      billTitle: "Internet Bill",
      amount: 999,
      dueDate: "2026-11-20",
    });

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("none");
    expect(result.error).toContain("No email provider configured");
  });

  it("dispatches to Resend API when RESEND_API_KEY is configured", async () => {
    process.env["RESEND_API_KEY"] = "re_test_key_123456";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_resend_999" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendReminderEmail({
      to: "client@example.com",
      billTitle: "Gym Membership",
      amount: 2000,
      dueDate: "2026-11-05",
      upiId: "gym@upi",
    });

    expect(result.delivered).toBe(true);
    expect(result.provider).toBe("resend");
    expect(result.messageId).toBe("msg_resend_999");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({
      Authorization: "Bearer re_test_key_123456",
      "Content-Type": "application/json",
    });

    const parsedBody = JSON.parse(options.body as string);
    expect(parsedBody.to).toEqual(["client@example.com"]);
    expect(parsedBody.subject).toContain("Gym Membership");
    expect(parsedBody.subject).toContain("₹2000");
    expect(parsedBody.html).toContain("gym@upi");
    expect(parsedBody.text).toContain("UPI ID: gym@upi");
  });

  it("handles Resend API error responses gracefully without throwing", async () => {
    process.env["RESEND_API_KEY"] = "re_invalid_key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Invalid API Key" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendReminderEmail({
      to: "client@example.com",
      billTitle: "Water Bill",
      amount: 350,
      dueDate: "2026-11-10",
    });

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("resend");
    expect(result.error).toContain("Resend error (401)");
  });

  it("calculates reminder lead times accurately", () => {
    const dueDate = "2026-11-10";

    expect(addDays(dueDate, 0)).toBe("2026-11-10"); // on due date
    expect(addDays(dueDate, -1)).toBe("2026-11-09"); // 1 day before
    expect(addDays(dueDate, -3)).toBe("2026-11-07"); // 3 days before
    expect(addDays(dueDate, -7)).toBe("2026-11-03"); // 7 days before
  });

  describe("processDueEmailReminders background worker", () => {
    it("delivers due reminders for unpaid occurrences and marks them as sent with sent_at", async () => {
      process.env["RESEND_API_KEY"] = "re_worker_test";
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: "msg_worker_123" }),
        }),
      );

      const updateCalls: Array<{ table: string; payload: any; filter: any }> = [];
      const insertCalls: Array<{ table: string; payload: any }> = [];

      const mockDb: any = {
        from: (table: string) => {
          if (table === "bill_reminders") {
            return {
              select: () => ({
                eq: (f1: string, v1: any) => ({
                  eq: (f2: string, v2: any) => ({
                    lte: () => ({
                      limit: () => ({
                        data: [
                          {
                            id: "rem-1",
                            user_id: "user-1",
                            bill_occurrence_id: "occ-1",
                            reminder_type: "email",
                            scheduled_for: "2026-10-25T08:00:00Z",
                            occurrence: {
                              id: "occ-1",
                              scheduled_date: "2026-10-25",
                              expected_amount: 1200,
                              actual_amount: null,
                              status: "pending",
                              bill: {
                                id: "bill-1",
                                title: "Cloud VPS",
                                reminder_email: "dev@company.com",
                                is_active: true,
                                notes: null,
                                upi_id: "cloud@upi",
                              },
                            },
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
              update: (payload: any) => ({
                eq: (field: string, val: any) => {
                  updateCalls.push({ table, payload, filter: { [field]: val } });
                  return Promise.resolve({ error: null });
                },
              }),
            };
          }
          if (table === "notifications") {
            return {
              insert: (payload: any) => {
                insertCalls.push({ table, payload });
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      };

      const result = await processDueEmailReminders(mockDb, new Date("2026-10-25T09:00:00Z"));

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);

      // Verify reminder marked as sent with timestamp
      const sentUpdate = updateCalls.find((c) => c.payload.status === "sent");
      expect(sentUpdate).toBeDefined();
      expect(sentUpdate?.filter?.id).toBe("rem-1");
      expect(sentUpdate?.payload.sent_at).toBeDefined();

      // Verify notification draft with dedupe key for idempotency
      const draft = insertCalls.find((c) => c.table === "notifications");
      expect(draft?.payload.dedupe_key).toBe("email_sent:rem-1");
    });

    it("cancels reminder and does not send if occurrence is already paid", async () => {
      const updateCalls: Array<{ table: string; payload: any }> = [];

      const mockDb: any = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      {
                        id: "rem-paid",
                        user_id: "user-1",
                        bill_occurrence_id: "occ-paid",
                        reminder_type: "email",
                        scheduled_for: "2026-10-25T08:00:00Z",
                        occurrence: {
                          id: "occ-paid",
                          scheduled_date: "2026-10-25",
                          expected_amount: 1500,
                          actual_amount: 1500,
                          status: "paid", // Already paid!
                          bill: {
                            id: "bill-1",
                            title: "Broadband",
                            reminder_email: "test@example.com",
                            is_active: true,
                          },
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (payload: any) => ({
            eq: () => {
              updateCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };

      const result = await processDueEmailReminders(mockDb, new Date());

      expect(result.sent).toBe(0);
      const cancelledUpdate = updateCalls.find((c) => c.payload.status === "cancelled");
      expect(cancelledUpdate).toBeDefined();
    });

    it("cancels reminder and does not send if bill is paused or inactive", async () => {
      const updateCalls: Array<{ table: string; payload: any }> = [];

      const mockDb: any = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      {
                        id: "rem-inactive",
                        user_id: "user-1",
                        bill_occurrence_id: "occ-2",
                        reminder_type: "email",
                        scheduled_for: "2026-10-25T08:00:00Z",
                        occurrence: {
                          id: "occ-2",
                          scheduled_date: "2026-10-25",
                          expected_amount: 500,
                          status: "pending",
                          bill: {
                            id: "bill-inactive",
                            title: "Magazine Subscription",
                            reminder_email: "test@example.com",
                            is_active: false, // Inactive / paused
                          },
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (payload: any) => ({
            eq: () => {
              updateCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };

      const result = await processDueEmailReminders(mockDb, new Date());

      expect(result.sent).toBe(0);
      const cancelledUpdate = updateCalls.find((c) => c.payload.status === "cancelled");
      expect(cancelledUpdate).toBeDefined();
    });

    it("marks status as failed without crashing if destination email is missing", async () => {
      const updateCalls: Array<{ table: string; payload: any }> = [];

      const mockDb: any = {
        auth: {
          admin: {
            getUserById: async () => ({ data: { user: { email: null } }, error: null }),
          },
        },
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  limit: () => ({
                    data: [
                      {
                        id: "rem-no-email",
                        user_id: "user-no-email",
                        bill_occurrence_id: "occ-3",
                        reminder_type: "email",
                        scheduled_for: "2026-10-25T08:00:00Z",
                        occurrence: {
                          id: "occ-3",
                          scheduled_date: "2026-10-25",
                          expected_amount: 800,
                          status: "pending",
                          bill: {
                            id: "bill-3",
                            title: "Newspaper",
                            reminder_email: null,
                            is_active: true,
                          },
                        },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (payload: any) => ({
            eq: () => {
              updateCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            },
          }),
        }),
      };

      const result = await processDueEmailReminders(mockDb, new Date());

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      const failedUpdate = updateCalls.find((c) => c.payload.status === "failed");
      expect(failedUpdate).toBeDefined();
    });
  });
});
