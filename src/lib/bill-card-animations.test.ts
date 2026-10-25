import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 2: Premium Bill Card Animations", () => {
  const cardSrc = readFileSync(join(process.cwd(), "src/components/BillCard.tsx"), "utf8");
  const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

  it("BillCard attaches premium card and status-specific classes", () => {
    expect(cardSrc).toContain("bill-card-premium");
    expect(cardSrc).toContain("statusClass");
    expect(cardSrc).toContain('"completed"');
    expect(cardSrc).toContain('"overdue"');
    expect(cardSrc).toContain('"due-soon"');
    expect(cardSrc).toContain('"upcoming"');
    expect(stylesSrc).toContain(".bill-card-premium.status-completed");
    expect(stylesSrc).toContain(".bill-card-premium.status-overdue");
    expect(stylesSrc).toContain(".bill-card-premium.status-due-soon");
  });

  it("applies gentle idle floating animation to active bills", () => {
    expect(cardSrc).toContain("bill-card-floating");
    expect(cardSrc).toContain("animationDelay: floatDelay");
    expect(stylesSrc).toContain("@keyframes bill-card-float");
    expect(stylesSrc).toContain(".bill-card-premium.bill-card-floating");
  });

  it("defines gentle neon edge highlights and ambient shadows", () => {
    expect(stylesSrc).toContain(".bill-card-premium::before");
    expect(stylesSrc).toContain(".bill-card-premium.status-overdue::before");
    expect(stylesSrc).toContain(".bill-card-premium.status-due-soon::before");
    expect(stylesSrc).toContain(".bill-card-premium.status-completed::before");
    expect(stylesSrc).toContain("box-shadow");
  });

  it("pauses floating on hover/focus and lifts the card", () => {
    expect(stylesSrc).toContain(".bill-card-premium:hover");
    expect(stylesSrc).toContain("animation-play-state: paused");
  });

  it("provides tactile active press feedback", () => {
    expect(stylesSrc).toContain(".bill-card-premium:active");
    expect(stylesSrc).toContain("transform: scale(0.985)");
  });

  it("strictly honors prefers-reduced-motion and reduce-motion class", () => {
    expect(stylesSrc).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesSrc).toContain(".reduce-motion .bill-card-premium");
    expect(stylesSrc).toContain("animation: none !important");
    expect(stylesSrc).toContain("transform: none !important");
  });
});
