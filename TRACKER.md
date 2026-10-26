# Project Task Tracker & Issue Register — BillBuddy Rebuild

**Document Version:** 2.1.0  
**Status:** Living Document / Authoritative Rebuild Tracker  
**Target Architecture:** Minimal, Premium, Single-Screen Bill Reminder App  
**Current Verification:** 253/253 Unit Tests Passing | TypeScript: 0 Errors | ESLint: 0 Errors | Production Build: Succeeded  
**Last Updated:** 2026-10-26

---

## 1. Product Rebuild Phases

| Phase        | Description                       | Status       | Verification                                                                                                                                                                         |
| :----------- | :-------------------------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1**  | Project Audit & Cleanup Plan      | ✅ Completed | Architecture mapped, dead code inventory confirmed                                                                                                                                   |
| **Phase 2**  | Architecture & Design Foundation  | ✅ Completed | Dead routes & pages pruned; Glassmorphic/Neumorphic design tokens added; DB migration created; 186/186 tests passing                                                                 |
| **Phase 3**  | Single-Screen UI                  | ✅ Completed | Header & greeting ("Hi, [User]"), compact Money Summary box, sorted bill list, 3-action bottom navigation; 186/186 tests passing                                                     |
| **Phase 4**  | Add Bill & Bill Details           | ✅ Completed | Reusable bill form (Name, ₹ Amount, Due Date, Reminder Time, Reminder Email, Repeat, Reminder Before, Notes); Details sheet (Mark as Completed, Edit, Delete); 186/186 tests passing |
| **Phase 5**  | Real Email Reminders              | ✅ Completed | Server-side email delivery service, HTML reminder templates, scheduler integration, automated reminder sync and cancellation; 189/189 tests passing                                  |
| **Phase 6**  | Final Polish & Verification       | ✅ Completed | Full responsive audit, interaction verification, 0 TypeScript errors, 0 ESLint errors, 189/189 tests passing, production build succeeded                                             |
| **Phase 7**  | Spends: Navigation & UI (Phase 1) | ✅ Completed | Bills / Spends navigation, cartoon wallet logo asset, Spends dashboard UI, Add Choice sheet                                                                                          |
| **Phase 8**  | Spends: Add Form & DB (Phase 2)   | ✅ Completed | Dedicated Add Spend modal, database table & migrations, persistence logic                                                                                                            |
| **Phase 9**  | Spends: Edit, Delete, Totals (3)  | ✅ Completed | Mutation operations, date selector filtering, accurate daily totals calculations                                                                                                     |
| **Phase 10** | Spends: Testing & QA (Phase 4)    | ✅ Completed | 17/17 Vitest test suites passing (253/253 tests), 0 TS errors, 0 ESLint errors, production build verified                                                                            |

---

## 2. Phase 2 Detailed Register: Architecture & Design Foundation

- [x] **REBUILD-01:** Pruned 32 obsolete routes in `src/routes/_authenticated/` and `src/routes/onboarding.tsx`.
- [x] **REBUILD-02:** Established single-screen route structure: root `/`, `/login`, and background scheduler webhook `/api/public/hooks/scheduler`.
- [x] **REBUILD-03:** Removed 16 obsolete multi-page screens and 14 obsolete ledger/chart components.
- [x] **REBUILD-04:** Configured Smart Home soft icy-blue, glassmorphic, and neumorphic design tokens in `src/styles.css` (`.glass-panel`, `.glass-card`, `.glass-pill`, `.glass-nav`, `.neu-sunken`, `.ambient-glow`).
- [x] **REBUILD-05:** Created database migration [`supabase/migrations/20261025000000_add_reminder_fields_to_bills.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/20261025000000_add_reminder_fields_to_bills.sql) adding `reminder_time` and `reminder_email` to `bills`.
- [x] **REBUILD-06:** Updated `Bill` type definition in [`src/types/database.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/types/database.ts).
- [x] **REBUILD-07:** Rebuilt [`src/components/Layout.tsx`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/components/Layout.tsx) as an atmospheric single-screen shell centered for mobile (360px-430px) and desktop.
- [x] **REBUILD-08:** Rebuilt [`src/components/BottomNav.tsx`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/components/BottomNav.tsx) for exactly three mandatory actions: Completed, Add Bill, Remaining.
- [x] **REBUILD-09:** Verified 186/186 Vitest unit tests pass and production build compiles with zero errors.

---

## 3. Phase 3 Detailed Register: Single-Screen UI

- [x] **REBUILD-10:** Implemented Section A Header with custom BillBuddy brand wallet icon and dynamic greeting `"Hi, [User Name]"` from user profile / preferences.
- [x] **REBUILD-11:** Implemented Section B Compact Money Summary box in one cohesive glassmorphic container:
  - Remaining Amount & Bill Count (sum of unsettled bills)
  - Completed Amount & Bill Count (sum of settled bills)
  - Strict tabular numbers (`tabular-nums`) and safe numeric handling.
- [x] **REBUILD-12:** Implemented Section C Main Bill List with dynamic status pills (_Overdue_, _Due today_, _Due tomorrow_, _Due in X days_), reminder time badges, and sort by urgency/due date.
- [x] **REBUILD-13:** Enhanced `BillCard.tsx` with frosted glass styling and touch-friendly details trigger.
- [x] **REBUILD-14:** Wired Section D Fixed Bottom Navigation with exactly 3 buttons (Completed, Add Bill, Remaining) operating entirely in-place on route `/`.
- [x] **REBUILD-15:** Integrated loading skeleton, empty state, and actionable error retry states.
- [x] **REBUILD-16:** Verified 186/186 Vitest unit tests pass and production build succeeds.

---

## 4. Phase 4 Detailed Register: Add Bill & Bill Details

- [x] **REBUILD-17:** Implemented [`src/components/BillFormModal.tsx`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/components/BillFormModal.tsx) containing all required fields:
  - Bill Name (validated non-empty)
  - Amount in ₹ (validated positive numeric value)
  - Due Date (timezone-safe calendar selection)
  - Reminder Time (defaulting to 09:00)
  - Reminder Email (prefilled from authenticated user email with format validation)
  - Repeat Recurrence options (Does not repeat, Daily, Weekly, Monthly, Yearly)
  - Advance Reminder selection (On due date, 1 day, 3 days, 7 days before)
  - Collapsible Notes field
  - Prevention of double submission and preserved form state on failure.
- [x] **REBUILD-18:** Upgraded `createBill` and `updateBill` in [`src/lib/bills.functions.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/bills.functions.ts) to validate and persist `reminder_time` and `reminder_email`.
- [x] **REBUILD-19:** Upgraded `deleteBill` in [`src/lib/bills.functions.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/bills.functions.ts) to cleanly cancel pending reminders, prune future occurrences, and safely delete/archive the bill without throwing an error when settled history exists.
- [x] **REBUILD-20:** Implemented [`src/components/BillDetailsModal.tsx`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/components/BillDetailsModal.tsx) with full bill information, reminder configuration, Mark as Completed action, Edit trigger, and Delete action.
- [x] **REBUILD-21:** Connected reactive reloading of Money Summary and bill list upon create, edit, mark-as-completed, and delete.
- [x] **REBUILD-22:** Verified 186/186 Vitest unit tests pass and production build succeeds with zero errors.

---

## 5. Phase 5 Detailed Register: Real Email Reminders

- [x] **REBUILD-23:** Implemented [`src/lib/email.server.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/email.server.ts) server-only email service supporting Resend API (`RESEND_API_KEY`) and standard SMTP/webhook transports without client credential exposure.
- [x] **REBUILD-24:** Created responsive HTML email template for BillBuddy reminder notifications matching the Smart Home aesthetic (brand header, prominent ₹ amount, due date, notes, and action guidance).
- [x] **REBUILD-25:** Implemented `syncBillReminders` in [`src/lib/bills.server.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/bills.server.ts) to calculate and synchronize pending `bill_reminders` records for all open occurrences of active bills.
- [x] **REBUILD-26:** Implemented automatic reminder cancellation when an occurrence is marked as completed in `recordOccurrencePayment` or when a bill is deleted.
- [x] **REBUILD-27:** Added `processDueEmailReminders` in [`src/lib/jobs.server.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/jobs.server.ts) to query and deliver due email reminders during the hourly sweep or via scheduled jobs independently of website sessions.
- [x] **REBUILD-28:** Updated webhook endpoint in [`src/routes/api/public/hooks/scheduler.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/routes/api/public/hooks/scheduler.ts) to support email reminder execution.
- [x] **REBUILD-29:** Authored unit test suite in [`src/lib/email.test.ts`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/src/lib/email.test.ts); verified 189/189 Vitest unit tests pass and production build succeeds.

---

## 6. Phase 6 Detailed Register: Final Polish & Verification

- [x] **REBUILD-30:** Resolved all TypeScript compiler errors with `npx tsc --noEmit` (0 errors across whole repository).
- [x] **REBUILD-31:** Resolved ESLint validation with `npm run lint` (0 errors).
- [x] **REBUILD-32:** Formatted entire codebase to standard style with `npm run format`.
- [x] **REBUILD-33:** Verified responsive viewport scaling (360px mobile to 1440px desktop shell) with touch-safe tap targets, safe-area padding (`pb-28`), and scrollable modal sheets.
- [x] **REBUILD-34:** Executed full automated verification: 189/189 Vitest unit tests passing across all 8 test suites.
- [x] **REBUILD-35:** Verified production build compilation (`npm run build`) producing optimal client and SSR bundles with zero build errors.

---

## 7. Executive Implementation Status Overview

| Workstream                       | Overall Status   | Verified Unit Tests   | Primary Blocker / Action Item                                                     |
| :------------------------------- | :--------------- | :-------------------- | :-------------------------------------------------------------------------------- |
| **1. Authentication & Security** | ✅ Verified      | 34 / 34 passing       | End-to-end browser login blocked by remote DB schema.                             |
| **2. Supabase Integration**      | 🟡 Code Complete | 28 / 28 passing       | Master migration must be executed on live Supabase project.                       |
| **3. Bills & Subscriptions**     | ✅ Verified      | 42 / 42 passing       | Recurrence, payment order locking, and status transitions verified in unit suite. |
| **4. Ledger & Transactions**     | ✅ Verified      | 36 / 36 passing       | Idempotency (`client_request_id`) and append-only reversals verified in suite.    |
| **5. Budgets & Goals**           | ✅ Verified      | 24 / 24 passing       | Envelope limits, threshold alerts, and spending goals logic verified.             |
| **6. Financial Analytics**       | ✅ Verified      | 22 / 22 passing       | Health score algorithms, safe-to-spend, and forecasting verified.                 |
| **7. Email Reminders**           | ✅ Verified      | 3 / 3 passing         | Resend API / SMTP configuration ready; automated schedule verified.               |
| **Total Automated Tests**        | **189 Passing**  | **189 / 189 Passing** | **0 Failures, 0 TypeScript Errors, Production Build OK**                          |

---

## 2. Detailed Task Breakdown & Workstream Register

### Workstream 1: Authentication & Identity Management

- [x] **TASK-AUTH-01:** Implement 6-digit numeric OTP request flow (`supabase.auth.signInWithOtp`).
- [x] **TASK-AUTH-02:** Implement 6-digit OTP token verification (`supabase.auth.verifyOtp` with type `email`).
- [x] **TASK-AUTH-03:** Purge all deprecated magic-link redirects and legacy preview URLs from auth callbacks.
- [x] **TASK-AUTH-04:** Implement 60-second cooldown timer on OTP resend button.
- [x] **TASK-AUTH-05:** Establish SSR cookie session synchronization for TanStack Start server functions.
- [x] **TASK-AUTH-06:** Implement clean session invalidation on user logout.
- [x] **TASK-AUTH-07:** Implement account status middleware gate (`ACTIVE`, `SUSPENDED`, `CLOSED`, `PENDING_DELETION`).

### Workstream 2: Supabase Platform & Database Schema

- [x] **TASK-DB-01:** Purge ghost/deprecated Supabase project references (`ocajeaytrcakzoxavvvg` / `ocajeyatrckazoxavvgg`).
- [x] **TASK-DB-02:** Consolidate client configuration to single authoritative project: `xsytaixmyeypoiscfbim`.
- [x] **TASK-DB-03:** Author master idempotent migration script `supabase/migrations/001_billbuddy_schema.sql` (22 tables, RLS policies, RPCs, storage buckets `avatars` and `receipts`).
- [ ] **TASK-DB-04:** **[CRITICAL ACTION ITEM / P0]** Execute `supabase/migrations/001_billbuddy_schema.sql` in the Supabase SQL Editor on project `xsytaixmyeypoiscfbim` to establish live PostgREST schema cache and resolve `PGRST205` / missing `payment_orders` errors.
- [x] **TASK-DB-05:** Implement graceful error boundary cards in the UI for unmigrated database states.

### Workstream 3: Bills & Recurring Subscriptions

- [x] **TASK-BILL-01:** Implement bill creation modal with recurrence options (daily, weekly, bi-weekly, monthly, quarterly, annual).
- [x] **TASK-BILL-02:** Build recurrence date math calculator with month-end rollover handling.
- [x] **TASK-BILL-03:** Implement bill occurrence generation and status transitions (`pending`, `paid`, `overdue`, `skipped`).
- [x] **TASK-BILL-04:** Implement payment orders with strict state machines and active occurrence locks.
- [x] **TASK-BILL-05:** Build upcoming bill timeline and calendarized list views.
- [x] **TASK-BILL-06:** Add auto-pay configuration toggles and reminder lead-time flags (`bill_reminders`).

### Workstream 4: Transaction Ledger & Expense Tracking

- [x] **TASK-TXN-01:** Build ledger data table supporting income, expense, and transfer records.
- [x] **TASK-TXN-02:** Enforce idempotency via `client_request_id` unique constraint.
- [x] **TASK-TXN-03:** Enforce append-only reversals for cancelled/refunded transactions.
- [x] **TASK-TXN-04:** Guarantee net-neutral transfers across accounts.
- [x] **TASK-TXN-05:** Implement CSV bank statement parsing and import mapping.
- [x] **TASK-TXN-06:** Build CSV and JSON statement export utilities.

### Workstream 5: Budgets, Goals & Net Worth

- [x] **TASK-BDG-01:** Implement monthly category budget ceilings and envelope limits.
- [x] **TASK-BDG-02:** Build real-time spend velocity progress bars with visual warning thresholds (>80% = amber, >100% = red).
- [x] **TASK-GOAL-01:** Build savings and spending goal tracker with milestone deadlines (`spending_goals`).
- [x] **TASK-GOAL-02:** Implement goal progress tracking and remaining target calculations.

### Workstream 6: Financial Intelligence & Analytics

- [x] **TASK-ANA-01:** Implement financial health score calculation algorithm.
- [x] **TASK-ANA-02:** Build 30-day cash flow projection chart with Recharts.
- [x] **TASK-ANA-03:** Build category expense donut distribution charts.
- [x] **TASK-ANA-04:** Implement upcoming bill run-rate and safe-to-spend calculations.

---

## 3. Prioritized Defect & Blocker Register

| Issue ID      | Priority | Description                                                                                       | Classification                                  | Status                                  | Remediation Plan                                                                                                                                                                                   |
| :------------ | :------- | :------------------------------------------------------------------------------------------------ | :---------------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ISSUE-001** | **P0**   | PostgREST `PGRST205` / "schema cache" error & `public.payment_orders does not exist` on live site | E. Blocked by configuration / execution         | Blocked on Supabase dashboard execution | Execute [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) in project `xsytaixmyeypoiscfbim` SQL editor. |
| **ISSUE-002** | **P1**   | Deprecated `.inputValidator()` calls in `src/lib/*.functions.ts`                                  | Refactored                                      | ✅ Resolved                             | All 12 modules migrated to `.validator()`. Build is warning-free.                                                                                                                                  |
| **ISSUE-003** | **P2**   | Live browser end-to-end verification of user workflows A–F                                        | B. Implemented but not verified in live browser | Pending P0 completion                   | Run manual & automated browser verification once live schema is established.                                                                                                                       |

---

---

## 5. Spends Feature Register — Phase 1: Navigation & Spends Dashboard UI

- [x] **SPEND-01:** Inspect project architecture, configuration, routing, and database schema.
- [x] **SPEND-02:** Process supplied cartoon wallet character into clean, high-DPI, transparent square assets (`public/spends-icon.png`, `public/spends-character-crop.png`, `public/spends-character.png`).
- [x] **SPEND-03:** Implement Bills / Spends rounded segmented navigation pill directly beneath the dashboard header.
- [x] **SPEND-04:** Implement `SpendsDashboard` component:
  - Date selector with Previous Day, Next Day (blocking future dates), Selected Date, and native date picker.
  - Daily spending summary card (`TOTAL SPENT ₹0.00`, expense count, glassmorphic styling).
  - Daily expense list ("Today's Spends" / date-specific title, friendly empty state with cartoon mascot, spend cards with spend name, amount, wallet icon, action triggers).
  - Daily total summary footer (`Total spent today: ₹[amount]`).
- [x] **SPEND-05:** Implement `AddChoiceSheet` modal ("What would you like to add?" -> "Add Bill" vs "Add Spend").
- [x] **SPEND-06:** Wire `BottomNav` central plus action to open `AddChoiceSheet`, maintaining complete preservation of existing Bills functionality and unit test compatibility.
- [x] **SPEND-07:** Run type checks, linting, Vitest unit tests (244/244 passing), and production build to verify 0 regressions.

## 6. Spends Feature Register — Phase 2 & 3: Database, Form, Editing & Daily Totals

- [x] **SPEND-08:** Create database migration `supabase/migrations/20261026000000_create_spends_table.sql` with user isolation RLS policies and performance indexes.
- [x] **SPEND-09:** Add `spends` table types to `src/integrations/supabase/types.ts` and `src/types/database.ts`.
- [x] **SPEND-10:** Build server-authoritative server functions in `src/lib/spends.functions.ts` (`createSpend`, `updateSpend`, `deleteSpend`, `listSpends`) with Zod input validation and resilient fallback handling.
- [x] **SPEND-11:** Build `SpendFormModal.tsx` matching Add Bill styling with Spend Name, Amount (₹), Date (strictly no time field), Note, and loading button state.
- [x] **SPEND-12:** Integrate Spends into `useFinance.ts` and `finance.functions.ts` for unified snapshot state and instant mutation refreshes.
- [x] **SPEND-13:** Wire editing, deletion confirmation dialogs, date switching, and accurate daily total calculation in `HomePage.tsx`.
- [x] **SPEND-14:** Add comprehensive Vitest unit tests in `src/lib/spends.test.ts` (8/8 tests passing, 253/253 total passing).

- [x] All six documentation files exist and are accurate (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `MEMORY.md`, `RULES.md`, `TRACKER.md`).
- [x] Required database schema is consolidated in [`001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) covering all 22 tables.
- [x] Migration state and ordering are documented.
- [x] Automated tests pass (186/186 passing).
- [x] Type checking passes (0 errors).
- [x] Production build succeeds (`vite build` / Nitro output generated cleanly with zero deprecation warnings).
- [ ] Live database schema executed in Supabase project `xsytaixmyeypoiscfbim`.
- [ ] End-to-end live browser authentication and data persistence verified.
