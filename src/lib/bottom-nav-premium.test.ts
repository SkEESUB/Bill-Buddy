import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 1: Three-Action Premium Bottom Navigation (Bills, +, Spends)", () => {
  const navSrc = readFileSync(join(process.cwd(), "src/components/BottomNav.tsx"), "utf8");
  const homeSrc = readFileSync(join(process.cwd(), "src/pages/HomePage.tsx"), "utf8");
  const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

  it("redesigns bottom navigation to contain exactly three primary actions: Bills, +, Spends", () => {
    // Contains Bills and Spends labels
    expect(navSrc).toContain("Bills");
    expect(navSrc).toContain("Spends");
    // Does not contain Completed or Remaining in BottomNav
    expect(navSrc).not.toContain("Completed");
    expect(navSrc).not.toContain("Remaining");
    // No central button labelled 'Add Bill' in bottom nav
    expect(navSrc).not.toContain("<span>Add Bill</span>");
  });

  it("renders the BillBuddy mascot logo for Bills and cartoon wallet logo for Spends", () => {
    expect(navSrc).toContain("BillBuddyLogo");
    expect(navSrc).toContain("/spends-icon.png");
  });

  it("provides a prominent 3D raised central plus button with blue-to-purple gradient", () => {
    expect(navSrc).toContain("Plus");
    expect(navSrc).toContain("bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600");
    // Has 3D highlight / sheen and rounded-full shape
    expect(navSrc).toContain("rounded-full");
    expect(navSrc).toContain("handleCenterClick");
  });

  it("highlights active state using nav-pill-btn with soft lavender and blue gradient", () => {
    expect(navSrc).toContain("nav-pill-btn");
    expect(navSrc).toContain('isBills ? "active" : ""');
    expect(navSrc).toContain('isSpends ? "active" : ""');
    expect(stylesSrc).toContain(".nav-pill-btn.active");
  });

  it("relocates Remaining and Completed controls inside the Bills page content with navbar matching glossy pill design", () => {
    // Remaining and Completed controls are within HomePage Bills panel
    expect(homeSrc).toContain('role="tab"');
    expect(homeSrc).toContain('billsFilter === "remaining"');
    expect(homeSrc).toContain('billsFilter === "completed"');
    // Outer container matches bottom nav styling
    expect(homeSrc).toContain("rounded-full glass-nav bg-white/90");
    // Active option uses smooth blue-to-purple gradient with glossy 3D sheen matching navbar
    expect(homeSrc).toContain("bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600");
    expect(homeSrc).toContain("bg-gradient-to-b from-white/35 to-transparent");
    // Top-level segmented control between bills/spends removed
    expect(homeSrc).not.toContain('id="bills-tab"');
    expect(homeSrc).not.toContain('id="spends-tab"');
  });

  it("opens AddChoiceSheet when central plus button is clicked with independent options and mascot logos", () => {
    const choiceSheetSrc = readFileSync(
      join(process.cwd(), "src/components/AddChoiceSheet.tsx"),
      "utf8",
    );
    expect(homeSrc).toContain("onOpenAddChoice={() => setChoiceSheetOpen(true)}");
    expect(homeSrc).toContain("onSelectAddBill");
    expect(homeSrc).toContain("onSelectAddSpend");
    expect(choiceSheetSrc).toContain("BillBuddyLogo");
    expect(choiceSheetSrc).toContain("/spends-icon.png");
  });
});
