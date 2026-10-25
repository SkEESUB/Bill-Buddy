import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addDays } from "./format";

describe("Phase 2: Simplified Add Bill Form & Reminder Scheduling", () => {
  const modalSrc = readFileSync(
    join(process.cwd(), "src/components/BillFormModal.tsx"),
    "utf8",
  );
  const serverSrc = readFileSync(join(process.cwd(), "src/lib/bills.server.ts"), "utf8");

  it("removes the reminder time input from BillFormModal", () => {
    // Should NOT have type="time" input
    expect(modalSrc).not.toContain('type="time"');
    expect(modalSrc).not.toContain("setReminderTime");
    expect(modalSrc).not.toContain("Reminder Time");
  });

  it("retains all essential bill fields: name, amount, due date, email, repeat, reminder notification, notes", () => {
    expect(modalSrc).toContain("Bill Name");
    expect(modalSrc).toContain("Amount (₹)");
    expect(modalSrc).toContain("Due Date");
    expect(modalSrc).toContain("Reminder Email");
    expect(modalSrc).toContain("Repeat");
    expect(modalSrc).toContain("Advance Reminder");
    expect(modalSrc).toContain("+ Add Note");
  });

  it("arranges Amount and Due Date in a 2-column compact grid layout", () => {
    expect(modalSrc).toContain("grid grid-cols-2 gap-2.5 sm:gap-3");
  });

  it("provides clear advance reminder options where due date is always scheduled", () => {
    expect(modalSrc).toContain("Due date only");
    expect(modalSrc).toContain("1 day before");
    expect(modalSrc).toContain("3 days before");
    expect(modalSrc).toContain("7 days before");
    expect(modalSrc).toContain("Due-date reminder is always sent");
  });

  it("syncBillReminders schedules due-date reminder by default and adds advance reminder when configured", () => {
    expect(serverSrc).toContain("occ.scheduled_date");
    expect(serverSrc).toContain("userTimezone");
    expect(serverSrc).toContain("Asia/Kolkata");
    expect(serverSrc).toContain("leadDays > 0");
    expect(serverSrc).toContain("toUtcIso");
  });

  it("preserves entered values and does not clear them in case of error", () => {
    // In handleSubmit, catch block does not reset state or call onClose
    expect(modalSrc).toContain("catch {");
    expect(modalSrc).toContain("setSubmitting(false)");
  });
});
