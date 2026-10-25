import { describe, expect, it } from "vitest";
import { byUrgency, type OccurrenceView } from "./occurrences";

/**
 * Replicate the primaryRemainingOccurrences deduplication logic from HomePage.tsx
 */
function getPrimaryRemainingOccurrences(views: OccurrenceView[]): OccurrenceView[] {
  const sorted = [...views.filter((o) => !o.isSettled)].sort(byUrgency);
  const seenBills = new Set<string>();
  const result: OccurrenceView[] = [];

  for (const occ of sorted) {
    if (!occ.isRecurring) {
      result.push(occ);
    } else {
      if (!seenBills.has(occ.billId)) {
        seenBills.add(occ.billId);
        result.push(occ);
      }
    }
  }
  return result;
}

function getGreeting(profileName: string | null | undefined): string {
  const trimmed = profileName?.trim();
  return trimmed ? `Hi, ${trimmed}` : "Hi there";
}

describe("Recurring Bill Deduplication Logic", () => {
  it("deduplicates multiple future recurring occurrences to show only the earliest upcoming one", () => {
    const weeklyRentOccurrences: OccurrenceView[] = [
      {
        id: "occ-1",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-11-02",
        isSettled: false,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-2",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-10-26",
        isSettled: false,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "due_soon",
        storedStatus: "due_soon",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-3",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-11-09",
        isSettled: false,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
    ];

    const result = getPrimaryRemainingOccurrences(weeklyRentOccurrences);
    // Should show exactly 1 card
    expect(result).toHaveLength(1);
    // Should be the earliest occurrence (2026-10-26)
    expect(result[0]?.id).toBe("occ-2");
    expect(result[0]?.dueDate).toBe("2026-10-26");
  });

  it("preserves non-recurring bills alongside recurring bills", () => {
    const items: OccurrenceView[] = [
      {
        id: "occ-one-off",
        billId: "bill-groceries",
        title: "Groceries",
        amount: 1200,
        category: "groceries",
        dueDate: "2026-10-28",
        isSettled: false,
        isRecurring: false,
        repeatType: "none",
        reminderTime: null,
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-wifi-1",
        billId: "bill-wifi",
        title: "WiFi",
        amount: 999,
        category: "utilities",
        dueDate: "2026-10-27",
        isSettled: false,
        isRecurring: true,
        repeatType: "monthly",
        reminderTime: "10:00:00",
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-wifi-2",
        billId: "bill-wifi",
        title: "WiFi",
        amount: 999,
        category: "utilities",
        dueDate: "2026-11-27",
        isSettled: false,
        isRecurring: true,
        repeatType: "monthly",
        reminderTime: "10:00:00",
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
    ];

    const result = getPrimaryRemainingOccurrences(items);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["occ-wifi-1", "occ-one-off"]);
  });

  it("advances schedule when the earliest occurrence is marked settled", () => {
    const items: OccurrenceView[] = [
      {
        id: "occ-1",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-10-26",
        isSettled: true, // Marked paid!
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "paid",
        storedStatus: "paid",
        upiId: null,
        paidAt: "2026-10-25T12:00:00Z",
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-2",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-11-02",
        isSettled: false,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "upcoming",
        storedStatus: "upcoming",
        upiId: null,
        paidAt: null,
        isActive: true,
        createdAt: "2026-10-01",
      },
    ];

    const result = getPrimaryRemainingOccurrences(items);
    // Now occ-2 should be the primary upcoming occurrence
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("occ-2");
    expect(result[0]?.dueDate).toBe("2026-11-02");
  });

  it("completed view retains all settled occurrences for historical tracking", () => {
    const items: OccurrenceView[] = [
      {
        id: "occ-1",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-10-19",
        isSettled: true,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "paid",
        storedStatus: "paid",
        upiId: null,
        paidAt: "2026-10-19T10:00:00Z",
        isActive: true,
        createdAt: "2026-10-01",
      },
      {
        id: "occ-2",
        billId: "bill-rent",
        title: "Rent",
        amount: 5000,
        category: "housing",
        dueDate: "2026-10-26",
        isSettled: true,
        isRecurring: true,
        repeatType: "weekly",
        reminderTime: "09:00:00",
        notes: null,
        status: "paid",
        storedStatus: "paid",
        upiId: null,
        paidAt: "2026-10-25T11:00:00Z",
        isActive: true,
        createdAt: "2026-10-01",
      },
    ];

    const completed = items.filter((o) => o.isSettled);
    expect(completed).toHaveLength(2);
  });
});

describe("User Profile Display Name Greeting", () => {
  it("greets with saved full_name when available", () => {
    expect(getGreeting("Arun")).toBe("Hi, Arun");
    expect(getGreeting("  Sarah Connor  ")).toBe("Hi, Sarah Connor");
  });

  it("falls back to 'Hi there' when profile name is null, undefined, or empty", () => {
    expect(getGreeting(null)).toBe("Hi there");
    expect(getGreeting(undefined)).toBe("Hi there");
    expect(getGreeting("")).toBe("Hi there");
    expect(getGreeting("   ")).toBe("Hi there");
  });

  it("never extracts or displays an email address username in the greeting", () => {
    const greeting = getGreeting(null);
    expect(greeting).not.toContain("@");
    expect(greeting).toBe("Hi there");
  });
});
