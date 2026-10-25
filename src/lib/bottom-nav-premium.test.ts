import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 3: Premium Completed and Remaining Bottom Nav Buttons", () => {
  const navSrc = readFileSync(
    join(process.cwd(), "src/components/BottomNav.tsx"),
    "utf8",
  );
  const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

  it("uses the nav-pill-btn class on Completed and Remaining buttons", () => {
    expect(navSrc).toContain("nav-pill-btn");
    expect(navSrc).toContain('isCompleted ? "active" : ""');
    expect(navSrc).toContain('isRemaining ? "active" : ""');
  });

  it("does not render any counts or amounts in Completed and Remaining buttons", () => {
    // Should NOT contain count or currency interpolation
    expect(navSrc).not.toContain("count");
    expect(navSrc).not.toContain("amount");
    expect(navSrc).not.toContain("₹");
    expect(navSrc).not.toContain("formatAmount");
  });

  it("defines soft blue and lavender gradients for the active pill state", () => {
    expect(stylesSrc).toContain(".nav-pill-btn.active");
    expect(stylesSrc).toContain("rgba(224, 231, 255"); // Soft lavender/blue
    expect(stylesSrc).toContain("rgba(243, 232, 255"); // Soft lilac/lavender
  });

  it("features subtle inner highlights and gentle glow in CSS", () => {
    expect(stylesSrc).toContain("inset 0 1px 1px 0 rgba(255, 255, 255");
    expect(stylesSrc).toContain("0 4px 14px -2px rgba(99, 102, 241");
  });

  it("provides tactile active press state and smooth transitions", () => {
    expect(stylesSrc).toContain(".nav-pill-btn:active");
    expect(stylesSrc).toContain("scale(0.97)");
    expect(stylesSrc).toContain("transition: all 220ms");
  });

  it("preserves prominent Add Bill button with sufficient surrounding space", () => {
    expect(navSrc).toContain("Add Bill");
    expect(navSrc).toContain("px-1 sm:px-1.5 shrink-0");
  });
});
