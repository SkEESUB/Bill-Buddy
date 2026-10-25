import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHANNELS,
  DEFAULT_SCHEDULE,
  budgetAlertDrafts,
  classifyFailure,
  isDuplicateKey,
  localTime,
  money,
  notificationLink,
  occurrenceDrafts,
  reminderDrafts,
  runKey,
  slotsFor,
  weeklySummaryDraft,
  type Channels,
  type OccurrenceLike,
  type Schedule,
  type Slot,
} from "./scheduler";

const channels: Channels = { ...DEFAULT_CHANNELS };
const schedule: Schedule = { ...DEFAULT_SCHEDULE, notify_weekly_summary: true };
const TODAY = "2026-08-19";

function occ(over: Partial<OccurrenceLike> = {}): OccurrenceLike {
  return {
    id: "occ-1",
    bill_id: "bill-1",
    scheduled_date: TODAY,
    expected_amount: 1200,
    status: "upcoming",
    title: "Electricity",
    reminder_days_before: 3,
    bill_active: true,
    ...over,
  };
}

const ctx = (slot: Slot, over: Partial<{ channels: Channels; schedule: Schedule }> = {}) => ({
  today: TODAY,
  slot,
  channels: over.channels ?? channels,
  schedule: over.schedule ?? schedule,
  currency: "INR",
});

/* ------------------------------ bill reminders ---------------------------- */

describe("bill reminders", () => {
  it("sends the lead reminder exactly on the configured window", () => {
    const bill = occ({ scheduled_date: "2026-08-22", reminder_days_before: 3 });
    const drafts = occurrenceDrafts(bill, ctx("morning"));
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.type).toBe("bill_due");
    expect(drafts[0]!.title).toContain("due in 3 days");
    expect(drafts[0]!.dedupeKey).toBe("bill_due_3:occ-1");
  });

  it("honours a 7-day reminder window", () => {
    const bill = occ({ scheduled_date: "2026-08-26", reminder_days_before: 7 });
    expect(occurrenceDrafts(bill, ctx("morning"))[0]?.dedupeKey).toBe("bill_due_7:occ-1");
  });

  it("sends nothing on non-reminder days", () => {
    const bill = occ({ scheduled_date: "2026-08-24", reminder_days_before: 3 });
    expect(occurrenceDrafts(bill, ctx("morning"))).toHaveLength(0);
  });

  it("sends the 1-day heads-up in the evening only", () => {
    const bill = occ({ scheduled_date: "2026-08-20" });
    expect(occurrenceDrafts(bill, ctx("morning"))).toHaveLength(0);
    const evening = occurrenceDrafts(bill, ctx("evening"));
    expect(evening[0]?.title).toContain("due tomorrow");
    expect(evening[0]?.dedupeKey).toBe("bill_due_1:occ-1");
  });

  it("sends a due-today reminder in the morning", () => {
    const drafts = occurrenceDrafts(occ(), ctx("morning"));
    expect(drafts[0]?.title).toContain("due today");
    expect(drafts[0]?.body).toContain("₹1,200");
    expect(drafts[0]?.dedupeKey).toBe("bill_due_today:occ-1");
  });

  it("marks a past-due instalment overdue with the day count", () => {
    const drafts = occurrenceDrafts(occ({ scheduled_date: "2026-08-16" }), ctx("morning"));
    expect(drafts[0]?.type).toBe("bill_overdue");
    expect(drafts[0]?.body).toContain("3 days ago");
    expect(drafts[0]?.dedupeKey).toBe("bill_overdue:occ-1");
  });

  it.each(["paid", "skipped", "cancelled", "payment_pending"])(
    "never reminds about a %s instalment",
    (status) => {
      expect(occurrenceDrafts(occ({ status }), ctx("morning"))).toHaveLength(0);
      expect(
        occurrenceDrafts(occ({ status, scheduled_date: "2026-08-01" }), ctx("morning")),
      ).toHaveLength(0);
    },
  );

  it("ignores instalments of a paused bill", () => {
    expect(occurrenceDrafts(occ({ bill_active: false }), ctx("morning"))).toHaveLength(0);
  });

  it("uses the actual amount when one was recorded", () => {
    const drafts = occurrenceDrafts(occ({ actual_amount: 1500 }), ctx("morning"));
    expect(drafts[0]?.body).toContain("₹1,500");
  });

  it("produces identical dedupe keys across repeated runs", () => {
    const bill = occ();
    const keys = Array.from({ length: 5 }, () =>
      occurrenceDrafts(bill, ctx("morning"))
        .map((d) => d.dedupeKey)
        .join(),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("respects the schedule and channel switches", () => {
    const off = { ...schedule, notify_due_today: false };
    expect(occurrenceDrafts(occ(), ctx("morning", { schedule: off }))).toHaveLength(0);
    const noChannel = { ...channels, bill_reminders: false };
    expect(occurrenceDrafts(occ(), ctx("morning", { channels: noChannel }))).toHaveLength(0);
    const noOverdue = { ...channels, overdue_alerts: false };
    expect(
      occurrenceDrafts(
        occ({ scheduled_date: "2026-08-01" }),
        ctx("morning", { channels: noOverdue }),
      ),
    ).toHaveLength(0);
  });

  it("orders a whole schedule by due date", () => {
    const drafts = reminderDrafts(
      [occ({ id: "b", scheduled_date: TODAY }), occ({ id: "a", scheduled_date: "2026-08-10" })],
      ctx("morning"),
    );
    expect(drafts.map((d) => d.type)).toEqual(["bill_overdue", "bill_due"]);
  });
});

/* ------------------------------ budget alerts ----------------------------- */

const budget = (spent: number, over: Record<string, unknown> = {}) => ({
  id: "budget-1",
  name: "Food",
  amount: 5000,
  spent,
  cycleStart: "2026-08-01",
  warnThreshold: 80,
  state: "active",
  ...over,
});

describe("budget alerts", () => {
  const bctx = { channels, slot: "morning" as Slot, currency: "INR" };

  it.each([
    [0, []],
    [2500, []],
    [3950, []],
  ])("stays quiet at %s spent", (spent, expected) => {
    expect(budgetAlertDrafts(budget(spent as number), bctx).map((d) => d.type)).toEqual(expected);
  });

  it("warns once when spending crosses the configured threshold", () => {
    const drafts = budgetAlertDrafts(budget(4100), bctx);
    expect(drafts[0]?.type).toBe("budget_warning");
    expect(drafts[0]?.title).toBe("Food budget at 82%");
    expect(drafts[0]?.dedupeKey).toBe("budget_warning:budget-1:2026-08-01");
  });

  it("keeps the same warning key as spending climbs inside the cycle", () => {
    const a = budgetAlertDrafts(budget(4100), bctx)[0]!;
    const b = budgetAlertDrafts(budget(4500), bctx)[0]!;
    const c = budgetAlertDrafts(budget(4950), bctx)[0]!;
    expect(new Set([a.dedupeKey, b.dedupeKey, c.dedupeKey]).size).toBe(1);
  });

  it("switches to exceeded at 100% and beyond, once per cycle", () => {
    const at = budgetAlertDrafts(budget(5000), bctx);
    const over = budgetAlertDrafts(budget(6000), bctx);
    expect(at[0]?.type).toBe("budget_exceeded");
    expect(over[0]?.type).toBe("budget_exceeded");
    expect(over).toHaveLength(1);
    expect(at[0]?.dedupeKey).toBe(over[0]?.dedupeKey);
  });

  it("starts clean in the next cycle", () => {
    const august = budgetAlertDrafts(budget(4100), bctx)[0]!;
    const september = budgetAlertDrafts(budget(4100, { cycleStart: "2026-09-01" }), bctx)[0]!;
    expect(august.dedupeKey).not.toBe(september.dedupeKey);
  });

  it("respects a custom threshold", () => {
    expect(budgetAlertDrafts(budget(2600, { warnThreshold: 50 }), bctx)[0]?.type).toBe(
      "budget_warning",
    );
    expect(budgetAlertDrafts(budget(2600, { warnThreshold: 95 }), bctx)).toHaveLength(0);
  });

  it("skips paused budgets, zero-amount budgets, disabled channels and non-morning slots", () => {
    expect(budgetAlertDrafts(budget(9000, { state: "paused" }), bctx)).toHaveLength(0);
    expect(budgetAlertDrafts(budget(100, { amount: 0 }), bctx)).toHaveLength(0);
    expect(
      budgetAlertDrafts(budget(9000), { ...bctx, channels: { ...channels, budget_alerts: false } }),
    ).toHaveLength(0);
    expect(budgetAlertDrafts(budget(9000), { ...bctx, slot: "evening" })).toHaveLength(0);
  });
});

/* ----------------------------- weekly summary ----------------------------- */

const week = (over: Record<string, unknown> = {}) => ({
  weekStart: "2026-08-12",
  weekEnd: "2026-08-18",
  income: 30000,
  spent: 8200,
  billsPaid: 3400,
  upcoming: 5600,
  topCategory: { category: "Food", amount: 2100 },
  transactionCount: 12,
  ...over,
});

describe("weekly summary", () => {
  const wctx = { channels, schedule, currency: "INR" };

  it("summarises a week with real activity", () => {
    const result = weeklySummaryDraft(week(), wctx);
    expect(result.skipped).toBe(false);
    expect(result.draft?.title).toBe("Your weekly BillBuddy summary");
    expect(result.draft?.body).toContain("₹30,000");
    expect(result.draft?.body).toContain("Food");
    expect(result.draft?.dedupeKey).toBe("weekly_summary:2026-08-12");
  });

  it("sends nothing when there was no activity at all", () => {
    const result = weeklySummaryDraft(
      week({ income: 0, spent: 0, billsPaid: 0, transactionCount: 0, topCategory: null }),
      wctx,
    );
    expect(result).toEqual({ draft: null, skipped: true, reason: "insufficient_data" });
  });

  it("sends nothing when rows exist but no money moved", () => {
    const result = weeklySummaryDraft(
      week({ income: 0, spent: 0, billsPaid: 0, transactionCount: 3, topCategory: null }),
      wctx,
    );
    expect(result.skipped).toBe(true);
  });

  it("summarises an income-only week", () => {
    const result = weeklySummaryDraft(week({ spent: 0, billsPaid: 0, topCategory: null }), wctx);
    expect(result.draft?.body).toContain("Spent ₹0");
  });

  it("summarises an expenses-only week", () => {
    const result = weeklySummaryDraft(week({ income: 0 }), wctx);
    expect(result.draft?.body).toContain("Income ₹0");
  });

  it("summarises a bills-only week", () => {
    const result = weeklySummaryDraft(
      week({ income: 0, spent: 0, topCategory: null, transactionCount: 2 }),
      wctx,
    );
    expect(result.draft?.body).toContain("Bills ₹3,400");
  });

  it("respects both the channel and the schedule switch", () => {
    expect(
      weeklySummaryDraft(week(), { ...wctx, channels: { ...channels, weekly_summary: false } }),
    ).toMatchObject({ skipped: true, reason: "channel_off" });
    expect(
      weeklySummaryDraft(week(), {
        ...wctx,
        schedule: { ...schedule, notify_weekly_summary: false },
      }),
    ).toMatchObject({ skipped: true, reason: "schedule_off" });
  });

  it("uses one key per week, so a retry cannot duplicate it", () => {
    const keys = Array.from({ length: 5 }, () => weeklySummaryDraft(week(), wctx).draft?.dedupeKey);
    expect(new Set(keys).size).toBe(1);
  });
});

/* -------------------------------- timezone -------------------------------- */

describe("timezone scheduling", () => {
  it("maps one UTC instant to each user's own local hour", () => {
    const now = new Date("2026-08-19T03:30:00Z");
    expect(localTime("Asia/Kolkata", now)).toEqual({ day: "2026-08-19", hour: 9, weekday: 3 });
    expect(localTime("UTC", now).hour).toBe(3);
    expect(localTime("America/New_York", now).hour).toBe(23);
  });

  it("runs the morning batch at 9 AM local, not 9 AM UTC", () => {
    const now = new Date("2026-08-19T03:30:00Z");
    expect(slotsFor(localTime("Asia/Kolkata", now))).toEqual(["morning"]);
    expect(slotsFor(localTime("UTC", now))).toEqual([]);
    expect(slotsFor(localTime("Europe/London", new Date("2026-08-19T08:05:00Z")))).toEqual([
      "morning",
    ]);
  });

  it("crosses the local midnight boundary correctly", () => {
    const now = new Date("2026-08-19T18:30:00Z"); // 00:00 on the 20th in Kolkata
    const local = localTime("Asia/Kolkata", now);
    expect(local.day).toBe("2026-08-20");
    expect(local.hour).toBe(0);
    expect(slotsFor(local)).toEqual([]);
    expect(localTime("America/New_York", now).day).toBe("2026-08-19");
  });

  it("is DST aware", () => {
    const winter = localTime("America/New_York", new Date("2026-01-15T14:00:00Z"));
    const summer = localTime("America/New_York", new Date("2026-07-15T14:00:00Z"));
    expect(winter.hour).toBe(9);
    expect(summer.hour).toBe(10);
  });

  it("runs the evening heads-up at 6 PM local", () => {
    expect(slotsFor(localTime("Asia/Kolkata", new Date("2026-08-19T12:30:00Z")))).toEqual([
      "evening",
    ]);
  });

  it("adds the weekly slot on Monday mornings only", () => {
    const monday = localTime("Asia/Kolkata", new Date("2026-08-17T03:30:00Z"));
    expect(monday.weekday).toBe(1);
    expect(slotsFor(monday)).toEqual(["morning", "weekly"]);
    const tuesday = localTime("Asia/Kolkata", new Date("2026-08-18T03:30:00Z"));
    expect(slotsFor(tuesday)).toEqual(["morning"]);
  });

  it("falls back to UTC for an unknown timezone instead of throwing", () => {
    expect(localTime("Mars/Olympus", new Date("2026-08-19T09:00:00Z")).hour).toBe(9);
  });
});

/* ------------------------- job identity and failures ---------------------- */

describe("job identity, retries and failures", () => {
  it("uses one claim key per hour", () => {
    expect(runKey(new Date("2026-08-19T09:00:00Z"))).toBe("2026-08-19T09:00Z");
    expect(runKey(new Date("2026-08-19T09:59:59Z"))).toBe("2026-08-19T09:00Z");
    expect(runKey(new Date("2026-08-19T10:00:00Z"))).not.toBe(
      runKey(new Date("2026-08-19T09:00:00Z")),
    );
  });

  it("treats transient infrastructure errors as retryable", () => {
    for (const message of [
      "Connection timeout",
      "fetch failed",
      "ECONNRESET",
      "503 Service Unavailable",
      "deadlock detected",
    ]) {
      expect(classifyFailure(new Error(message))).toBe("retryable");
    }
  });

  it("treats data and constraint errors as permanent", () => {
    for (const message of [
      "invalid input syntax for type uuid",
      "violates check constraint",
      "row not found",
    ]) {
      expect(classifyFailure(new Error(message))).toBe("permanent");
    }
  });

  it("recognises a duplicate key as an already-done outcome", () => {
    expect(
      isDuplicateKey(
        new Error('duplicate key value violates unique constraint "notifications_dedupe_idx"'),
      ),
    ).toBe(true);
    expect(isDuplicateKey(new Error("connection timeout"))).toBe(false);
  });
});

/* -------------------------------- rendering ------------------------------- */

describe("presentation", () => {
  it("formats money without depending on the UI locale state", () => {
    expect(money(1200)).toBe("₹1,200");
    expect(money(1200.5)).toBe("₹1,200.50");
    expect(money(20, "USD")).toContain("20");
  });

  it("deep links each notification to the screen that owns it", () => {
    expect(notificationLink({ type: "payment_success", related_transaction_id: "t1" })).toBe(
      "/transactions/t1",
    );
    expect(notificationLink({ type: "budget_warning", related_budget_id: "b1" })).toBe(
      "/money/budgets/b1",
    );
    expect(notificationLink({ type: "bill_due", related_bill_id: "x" })).toBe("/bills");
    expect(notificationLink({ type: "weekly_summary" })).toBe("/insights");
    expect(notificationLink({ type: "security" })).toBe("/settings/security");
    expect(notificationLink({ type: "system" })).toBeNull();
  });
});

describe("duplicate detection across error shapes", () => {
  it("recognises the plain object shape returned by the database client", () => {
    expect(isDuplicateKey({ code: "23505", message: "duplicate key value" })).toBe(true);
    expect(isDuplicateKey({ code: "23505" })).toBe(true);
    expect(isDuplicateKey({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isDuplicateKey(null)).toBe(false);
  });
});
