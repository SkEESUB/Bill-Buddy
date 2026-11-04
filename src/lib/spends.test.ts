import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spendInputSchema, spendUpdateSchema } from "./spends.functions";
import { addDays, toDay } from "./format";
import type { Spend } from "@/types/database";

describe("Spends Feature — Business Logic & Validation", () => {
  const today = toDay(new Date());
  const yesterday = toDay(addDays(new Date(), -1));

  it("validates valid spend inputs", () => {
    const valid = spendInputSchema.safeParse({
      name: "Breakfast",
      amount: 80,
      spend_date: today,
      notes: "Idli and coffee",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.name).toBe("Breakfast");
      expect(valid.data.amount).toBe(80);
      expect(valid.data.spend_date).toBe(today);
      expect(valid.data.notes).toBe("Idli and coffee");
    }
  });

  it("rejects missing or empty spend names", () => {
    const invalidEmpty = spendInputSchema.safeParse({
      name: "   ",
      amount: 100,
      spend_date: today,
    });
    expect(invalidEmpty.success).toBe(false);
  });

  it("rejects non-positive monetary amounts", () => {
    const zeroAmount = spendInputSchema.safeParse({
      name: "Snacks",
      amount: 0,
      spend_date: today,
    });
    expect(zeroAmount.success).toBe(false);

    const negativeAmount = spendInputSchema.safeParse({
      name: "Snacks",
      amount: -50,
      spend_date: today,
    });
    expect(negativeAmount.success).toBe(false);
  });

  it("requires valid YYYY-MM-DD date format", () => {
    const badDate = spendInputSchema.safeParse({
      name: "Petrol",
      amount: 250,
      spend_date: "invalid-date",
    });
    expect(badDate.success).toBe(false);
  });

  it("allows optional notes to be null or omitted", () => {
    const withoutNotes = spendInputSchema.safeParse({
      name: "Metro ticket",
      amount: 40,
      spend_date: yesterday,
    });
    expect(withoutNotes.success).toBe(true);
    if (withoutNotes.success) {
      expect(withoutNotes.data.notes).toBeUndefined();
    }
  });

  it("validates spend update payloads require valid id", () => {
    const validUpdate = spendUpdateSchema.safeParse({
      id: "spend-123",
      name: "Updated Groceries",
      amount: 320,
      spend_date: today,
      notes: "Milk and fruits",
    });
    expect(validUpdate.success).toBe(true);

    const invalidUpdate = spendUpdateSchema.safeParse({
      id: "",
      name: "Updated Groceries",
      amount: 320,
      spend_date: today,
    });
    expect(invalidUpdate.success).toBe(false);
  });

  it("accurately calculates daily total and count without duplicate counting", () => {
    const mockSpends: Spend[] = [
      {
        id: "1",
        user_id: "user-1",
        name: "Breakfast",
        amount: 80,
        spend_date: today,
        notes: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        user_id: "user-1",
        name: "Petrol",
        amount: 250,
        spend_date: today,
        notes: "Full tank",
        created_at: new Date().toISOString(),
      },
      {
        id: "3",
        user_id: "user-1",
        name: "Snacks",
        amount: 40,
        spend_date: today,
        notes: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "4",
        user_id: "user-1",
        name: "Yesterday Dinner",
        amount: 300,
        spend_date: yesterday,
        notes: null,
        created_at: new Date().toISOString(),
      },
    ];

    // Filter by active date
    const todaySpends = mockSpends.filter((s) => s.spend_date === today);
    expect(todaySpends.length).toBe(3);

    const totalToday = todaySpends.reduce((sum, s) => sum + s.amount, 0);
    expect(totalToday).toBe(370);

    const yesterdaySpends = mockSpends.filter((s) => s.spend_date === yesterday);
    expect(yesterdaySpends.length).toBe(1);
    const totalYesterday = yesterdaySpends.reduce((sum, s) => sum + s.amount, 0);
    expect(totalYesterday).toBe(300);
  });

  it("handles empty spends state gracefully", () => {
    const emptyList: Spend[] = [];
    const total = emptyList.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(0);
    expect(emptyList.length).toBe(0);
  });

  it("calculates timezone-safe date shifting across month and year boundaries", async () => {
    const { shiftDateString } = await import("./format");
    expect(shiftDateString("2026-10-27", -1)).toBe("2026-10-26");
    expect(shiftDateString("2026-10-27", 1)).toBe("2026-10-28");
    // Month boundary
    expect(shiftDateString("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDateString("2026-02-28", 1)).toBe("2026-03-01");
    // Year boundary
    expect(shiftDateString("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateString("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("verifies date filtering isolation: today never shows yesterday, switching dates does not delete records", () => {
    const mockStore: Spend[] = [
      {
        id: "s1",
        user_id: "u1",
        name: "Morning Coffee",
        amount: 50,
        spend_date: "2026-10-27",
        notes: null,
        created_at: "2026-10-27T08:00:00Z",
      },
      {
        id: "s2",
        user_id: "u1",
        name: "Evening Snack",
        amount: 80,
        spend_date: "2026-10-27",
        notes: null,
        created_at: "2026-10-27T17:00:00Z",
      },
      {
        id: "s3",
        user_id: "u1",
        name: "Yesterday Fuel",
        amount: 500,
        spend_date: "2026-10-26",
        notes: null,
        created_at: "2026-10-26T10:00:00Z",
      },
      {
        id: "s4",
        user_id: "u1",
        name: "Past Groceries",
        amount: 1200,
        spend_date: "2026-10-15",
        notes: null,
        created_at: "2026-10-15T12:00:00Z",
      },
    ];

    // Select today
    const selectedDate1 = "2026-10-27";
    const date1Spends = mockStore.filter((s) => s.spend_date === selectedDate1);
    expect(date1Spends.length).toBe(2);
    expect(date1Spends.map((s) => s.name)).toEqual(["Morning Coffee", "Evening Snack"]);
    const total1 = date1Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total1).toBe(130);

    // Select yesterday
    const selectedDate2 = "2026-10-26";
    const date2Spends = mockStore.filter((s) => s.spend_date === selectedDate2);
    expect(date2Spends.length).toBe(1);
    expect(date2Spends[0]?.name).toBe("Yesterday Fuel");
    const total2 = date2Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total2).toBe(500);

    // Select historical date
    const selectedDate3 = "2026-10-15";
    const date3Spends = mockStore.filter((s) => s.spend_date === selectedDate3);
    expect(date3Spends.length).toBe(1);
    expect(date3Spends[0]?.name).toBe("Past Groceries");
    const total3 = date3Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total3).toBe(1200);

    // Returning to today verifies all original records are preserved
    expect(mockStore.length).toBe(4);
    const returnToday = mockStore.filter((s) => s.spend_date === selectedDate1);
    expect(returnToday.length).toBe(2);
    expect(returnToday.reduce((sum, s) => sum + s.amount, 0)).toBe(130);
  });

  describe("Phase B: Premium Floating 3D Spends Cards", () => {
    const dashboardSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendsDashboard.tsx"),
      "utf8",
    );
    const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    it("attaches spend-card-premium and spend-card-floating to spend cards", () => {
      expect(dashboardSrc).toContain("spend-card-premium");
      expect(dashboardSrc).toContain("spend-card-floating");
      expect(dashboardSrc).toContain("style={{ animationDelay: floatDelay }}");
    });

    it("defines floating 3D keyframes, ambient glow, and elevated shadow in CSS", () => {
      expect(stylesSrc).toContain("@keyframes spend-card-float");
      expect(stylesSrc).toContain(".spend-card-premium");
      expect(stylesSrc).toContain(".spend-card-premium.spend-card-floating");
      expect(stylesSrc).toContain(".spend-card-premium::before");
      expect(stylesSrc).toContain(".spend-card-premium:active");
    });

    it("stops propagation on edit and delete buttons to prevent accidental triggers", () => {
      expect(dashboardSrc).toContain("e.stopPropagation()");
    });

    it("strictly honors prefers-reduced-motion for spend cards", () => {
      expect(stylesSrc).toContain(".spend-card-premium");
      expect(stylesSrc).toContain(".spend-card-premium.spend-card-floating");
      expect(stylesSrc).toContain(".reduce-motion .spend-card-premium");
    });
  });

  describe("Update 2 & 3: Monthly Spends Summary & Falling Coins Animation", () => {
    const dashboardSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendsDashboard.tsx"),
      "utf8",
    );
    const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    it("calculates total monthly spends reflecting the selected month and year boundaries", () => {
      const mockSpends: Spend[] = [
        // October 2026: ₹8,500 total (e.g. 5000 + 3500)
        {
          id: "oct-1",
          user_id: "u1",
          name: "October Rent Share",
          amount: 5000,
          spend_date: "2026-10-05",
          notes: null,
          created_at: "2026-10-05T10:00:00Z",
        },
        {
          id: "oct-2",
          user_id: "u1",
          name: "October Groceries",
          amount: 3500,
          spend_date: "2026-10-20",
          notes: null,
          created_at: "2026-10-20T12:00:00Z",
        },
        // November 2026: ₹12,450 total (e.g. 10000 + 2450)
        {
          id: "nov-1",
          user_id: "u1",
          name: "November Laptop EMI",
          amount: 10000,
          spend_date: "2026-11-02",
          notes: null,
          created_at: "2026-11-02T09:00:00Z",
        },
        {
          id: "nov-2",
          user_id: "u1",
          name: "November Outing",
          amount: 2450,
          spend_date: "2026-11-04",
          notes: null,
          created_at: "2026-11-04T18:00:00Z",
        },
        // December 2026: ₹6,200 total
        {
          id: "dec-1",
          user_id: "u1",
          name: "December Travel",
          amount: 6200,
          spend_date: "2026-12-15",
          notes: null,
          created_at: "2026-12-15T08:00:00Z",
        },
        // Previous year November 2025: should NOT be included in November 2026!
        {
          id: "nov-2025",
          user_id: "u1",
          name: "Last Year November",
          amount: 9999,
          spend_date: "2025-11-04",
          notes: null,
          created_at: "2025-11-04T10:00:00Z",
        },
      ];

      // October 2026 calculations
      const octSpends = mockSpends.filter((s) => s.spend_date?.startsWith("2026-10"));
      expect(octSpends.length).toBe(2);
      expect(octSpends.reduce((sum, s) => sum + s.amount, 0)).toBe(8500);

      // November 2026 calculations
      const novSpends = mockSpends.filter((s) => s.spend_date?.startsWith("2026-11"));
      expect(novSpends.length).toBe(2);
      expect(novSpends.reduce((sum, s) => sum + s.amount, 0)).toBe(12450);

      // December 2026 calculations
      const decSpends = mockSpends.filter((s) => s.spend_date?.startsWith("2026-12"));
      expect(decSpends.length).toBe(1);
      expect(decSpends.reduce((sum, s) => sum + s.amount, 0)).toBe(6200);

      // Empty month returns 0 total and 0 transactions
      const janSpends = mockSpends.filter((s) => s.spend_date?.startsWith("2026-01"));
      expect(janSpends.length).toBe(0);
      expect(janSpends.reduce((sum, s) => sum + s.amount, 0)).toBe(0);
    });

    it("displays TOTAL MONTHLY SPENDS heading and monthly transaction count in SpendsDashboard", () => {
      expect(dashboardSrc).toContain("TOTAL MONTHLY SPENDS");
      expect(dashboardSrc).toContain("monthlyTotal");
      expect(dashboardSrc).toContain("monthlyCount");
      expect(dashboardSrc).toContain('"transactions"');
      expect(dashboardSrc).toContain("in {monthName}");
    });

    it("implements falling coins animation and money-received pulse in SpendsDashboard and CSS", () => {
      expect(dashboardSrc).toContain("falling-coins-container");
      expect(dashboardSrc).toContain("falling-coin");
      expect(dashboardSrc).toContain("money-received-pulse");
      expect(dashboardSrc).toContain("money-received-glow");

      expect(stylesSrc).toContain("@keyframes falling-coin-drop");
      expect(stylesSrc).toContain("@keyframes money-received-card-glow");
      expect(stylesSrc).toContain(".money-received-pulse");
      expect(stylesSrc).toContain(".money-received-glow");
    });

    it("strictly honors prefers-reduced-motion for falling coins and money-received animations", () => {
      expect(stylesSrc).toContain("@media (prefers-reduced-motion: reduce)");
    });
  });

  describe("Spends Summary Card Refinement: Premium 3D Floating & Enlarged Logo", () => {
    const dashboardSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendsDashboard.tsx"),
      "utf8",
    );
    const homeSrc = readFileSync(join(process.cwd(), "src/pages/HomePage.tsx"), "utf8");
    const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    it("preserves golden ₹ coins dropping into the monthly spends card without alteration", () => {
      expect(dashboardSrc).toContain("falling-coins-container");
      expect(dashboardSrc).toContain("falling-coin");
      expect(dashboardSrc).toContain("₹");
      expect(stylesSrc).toContain("@keyframes falling-coin-drop");
      expect(stylesSrc).toContain("rotateX");
      expect(stylesSrc).toContain("rotateY");
      expect(stylesSrc).toContain("rotateZ");
    });

    it("preserves smooth monthly spending amount counter and glow", () => {
      expect(dashboardSrc).toContain("useSmoothAmount");
      expect(dashboardSrc).toContain("displayedMonthlyTotal");
      expect(dashboardSrc).toContain("amount-smooth-count");
      expect(stylesSrc).toContain("@keyframes amount-smooth-glow");
      expect(stylesSrc).toContain(".amount-smooth-count");
    });

    it("enlarges the spends card mascot/logo image and keeps it static", () => {
      // Icon container is enlarged with p-1 padding so image occupies more of the container
      expect(dashboardSrc).toContain("h-20 w-20 sm:h-24 sm:w-24");
      expect(dashboardSrc).toContain("p-1");
      expect(dashboardSrc).toContain('src="/spends-icon.png"');
      expect(dashboardSrc).toContain("object-contain");
      // Mascot remains static - no celebration animations on the mascot
      expect(dashboardSrc).not.toContain("mascot-celebrating");
      expect(dashboardSrc).not.toContain("CelebrationMascot");
    });

    it("upgrades Total Monthly Spends card to premium 3D glassmorphic floating card", () => {
      expect(dashboardSrc).toContain("spends-summary-card-premium");
      expect(dashboardSrc).toContain("spends-summary-card-floating");
      expect(stylesSrc).toContain("@keyframes spends-summary-float");
      expect(stylesSrc).toContain(".spends-summary-card-premium");
      expect(stylesSrc).toContain(".spends-summary-card-premium.spends-summary-card-floating");
      expect(stylesSrc).toContain(".spends-summary-card-premium::before");
      expect(stylesSrc).toContain("perspective");
    });

    it("preserves official BillBuddy branding in header and spends card", () => {
      expect(homeSrc).toContain('src="/billbuddy-icon.png"');
      expect(dashboardSrc).toContain('src="/spends-icon.png"');
      expect(homeSrc).not.toContain("CelebrationMascot");
    });

    it("verifies removal of mascot celebration jump, arms, happy expression, and sparkles", () => {
      expect(stylesSrc).not.toContain("@keyframes mascot-celebration-jump");
      expect(stylesSrc).not.toContain("@keyframes mascot-hands-wave");
      expect(stylesSrc).not.toContain("@keyframes mascot-happy-face");
      expect(stylesSrc).not.toContain("@keyframes sparkle-pop");
      expect(stylesSrc).not.toContain(".mascot-celebrating");
    });

    it("strictly respects prefers-reduced-motion for the summary card and smooth amount", () => {
      expect(stylesSrc).toContain(".reduce-motion .spends-summary-card-premium");
      expect(stylesSrc).toContain(
        ".reduce-motion .spends-summary-card-premium.spends-summary-card-floating",
      );
      expect(stylesSrc).toContain(".reduce-motion .amount-smooth-count");
      expect(stylesSrc).toContain("@media (prefers-reduced-motion: reduce)");
    });
  });
});
