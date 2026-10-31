# Project Task Tracker & Issue Register — BillBuddy Rebuild

**Document Version:** 2.5.0  
**Status:** Living Document / Authoritative Rebuild Tracker  
**Target Architecture:** Minimal, Premium, Single-Screen Bill Reminder App  
**Current Verification:** 340/340 Unit Tests Passing | TypeScript: 0 Errors | ESLint: 0 Errors | Production Build: Succeeded | Staging Security Verification: 100% PASSED  
**Last Updated:** 2026-10-31

---

## 1. Product Rebuild Phases

| Phase        | Description                                                        | Status       | Verification                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :----------- | :----------------------------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1**  | Project Audit & Cleanup Plan                                       | ✅ Completed | Architecture mapped, dead code inventory confirmed                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Phase 2**  | Architecture & Design Foundation                                   | ✅ Completed | Dead routes & pages pruned; Glassmorphic/Neumorphic design tokens added; DB migration created; 186/186 tests passing                                                                                                                                                                                                                                                                                                                                 |
| **Phase 3**  | Single-Screen UI                                                   | ✅ Completed | Header & greeting ("Hi, [User]"), compact Money Summary box, sorted bill list, 3-action bottom navigation; 186/186 tests passing                                                                                                                                                                                                                                                                                                                     |
| **Phase 4**  | Add Bill & Bill Details                                            | ✅ Completed | Reusable bill form (Name, ₹ Amount, Due Date, Reminder Time, Reminder Email, Repeat, Reminder Before, Notes); Details sheet (Mark as Completed, Edit, Delete); 186/186 tests passing                                                                                                                                                                                                                                                                 |
| **Phase 5**  | Real Email Reminders                                               | ✅ Completed | Server-side email delivery service, HTML reminder templates, scheduler integration, automated reminder sync and cancellation; 189/189 tests passing                                                                                                                                                                                                                                                                                                  |
| **Phase 6**  | Final Polish & Verification                                        | ✅ Completed | Full responsive audit, interaction verification, 0 TypeScript errors, 0 ESLint errors, 189/189 tests passing, production build succeeded                                                                                                                                                                                                                                                                                                             |
| **Phase 7**  | Spends: Navigation & UI (Phase 1)                                  | ✅ Completed | Bills / Spends navigation, cartoon wallet logo asset, Spends dashboard UI, Add Choice sheet                                                                                                                                                                                                                                                                                                                                                          |
| **Phase 8**  | Spends: Add Form & DB (Phase 2)                                    | ✅ Completed | Dedicated Add Spend modal, database table & migrations, persistence logic                                                                                                                                                                                                                                                                                                                                                                            |
| **Phase 9**  | Spends: Edit, Delete, Totals (3)                                   | ✅ Completed | Mutation operations, date selector filtering, accurate daily totals calculations                                                                                                                                                                                                                                                                                                                                                                     |
| **Phase 10** | Spends: Testing & QA (Phase 4)                                     | ✅ Completed | 17/17 Vitest test suites passing (253/253 tests), 0 TS errors, 0 ESLint errors, production build verified                                                                                                                                                                                                                                                                                                                                            |
| **Phase 11** | Upgrade Phase 1: 3-Action Bottom Nav & Section Separation          | ✅ Completed | Redesigned bottom nav [Bills][+][Spends], removed top segmented control, added in-page Remaining/Completed controls, verified AddChoiceSheet; 253/253 tests passing, 0 TS errors, prod build passed                                                                                                                                                                                                                                                  |
| **Phase 12** | Upgrade Phase 2: Date Selector & Spends Dashboard                  | ✅ Completed | Timezone-safe date navigation (`shiftDateString`), Prev/Next controls, calendar picker <= today, Total Spent card with mascot, daily expense cards, daily total footer; 255/255 tests passing                                                                                                                                                                                                                                                        |
| **Phase 13** | Bills Mascot in Navigation & Add Choice Sheet (Phase A)            | ✅ Completed | Replaced receipt icon with official BillBuddy mascot (`/billbuddy-icon.png`) in BottomNav and AddChoiceSheet; 256/256 tests passing, 0 TS errors, 0 ESLint errors, prod build succeeded                                                                                                                                                                                                                                                              |
| **Phase 14** | Floating 3D Spends Cards (Phase B)                                 | ✅ Completed | Applied `.spend-card-premium` & `.spend-card-floating` with layered shadows, ambient edge highlights, staggered physics, and `e.stopPropagation()`; 260/260 tests passing                                                                                                                                                                                                                                                                            |
| **Phase 15** | Mobile Authentication Viewport Fit (Phase C)                       | ✅ Completed | Scaled illustrations & spacing for Onboarding, Email, and OTP screens to fit mobile viewports cleanly with safe area and keyboard resilience; 260/260 tests passing                                                                                                                                                                                                                                                                                  |
| **Phase 16** | Email Reminder System Audit & Repair (Phase D)                     | ✅ Completed | Repaired destructive over-deletion in `deleteBill`, enhanced `processDueEmailReminders` with diagnostics and idempotency, identified missing Resend key & cron configuration; 262/262 tests passing                                                                                                                                                                                                                                                  |
| **Phase 17** | Remaining / Completed Toggle Navbar Match                          | ✅ Completed | Redesigned segmented toggle on Bills screen with `glass-nav` rounded pill container, glossy blue-to-purple gradient active pill with 3D sheen highlight, muted inactive pill, and count badges; 262/262 tests passing, 0 TS errors, 0 ESLint errors, prod build succeeded                                                                                                                                                                            |
| **Phase 18** | Automatic Spend Tracking — Phase 1: Spend Source Tracking          | ✅ Completed | Non-destructive migration adding `source` and `dedupe_hash` to `public.spends` with check constraints and indexes; server functions modernized to persist/preserve sources and check duplicates; `SpendFormModal` payment source selector (Cash, UPI/Bank, Card, Other); micro source badges on spend cards; 271/271 tests passing, 0 TS errors, prod build succeeded                                                                                |
| **Phase 19** | Automatic Spend Tracking — Phase 2: Bank Statement Import          | ✅ Completed | Reusable CSV statement parser (`src/lib/parsers/statement-csv-parser.ts`) supporting BOB, SBI, HDFC, ICICI, etc.; transaction classification (expense, income, refund, transfer); duplicate detection against spends & bill-payment ledger entries; CSV dropzone & interactive preview modal `StatementImportModal`; server functions `checkStatementDuplicates` & `importStatementSpends`; 286/286 tests passing, 0 TS errors, prod build succeeded |
| **Phase 20** | Automatic Spend Tracking — Phase 3: Android Notification Detection | ✅ Completed | Standalone Kotlin Android companion (`android-companion/`); non-destructive migration for `linked_devices`, `device_pairing_tokens`, and `notification_ingest_logs`; ephemeral QR pairing; HMAC-SHA256 request authentication with replay defense; parser engine for PhonePe, GPay, Paytm, and bob World; privacy filter dropping OTPs/promos; `AutomaticTrackingModal` UI; 312/312 tests passing, 0 TS errors, prod build succeeded                                                                                                                                                                                                              |
| **Phase 21** | Automatic Spend Tracking — Phase 3.2: Security Remediation         | ✅ Completed | AES-256-GCM encryption at rest for HMAC keys (`crypto.server.ts`); PostgREST `hmac_key` column access revoked from client roles with safe view `user_linked_devices`; atomic single-step pairing token consumption; atomic database nonce claim preventing concurrent replay attacks; strict LAN URL validation & localhost detection; 327/327 tests passing across 26 test suites, 0 TS errors, prod build succeeded |
| **Phase 22** | Automatic Spend Tracking — Phase 3.2.2: Critical Security Fixes    | ✅ Completed | Corrective migration `20261030030000_security_hardening_phase3.sql`; view `user_linked_devices` hardened with `security_invoker = true` and `auth.uid() = user_id`; RPCs `consume_pairing_token` and `ingest_notification_spend` secured with safe `search_path`, caller authorization, and execution restricted to `service_role`; environment key fail-closed enforcement across deployed/preview/staging; batch & lazy plaintext secret migration (`migratePlaintextDeviceSecrets`); safe idempotent retry recovery preventing transaction loss; 340/340 unit tests passing (27 test suites), 0 TS errors, 0 ESLint errors, prod build succeeded |
| **Phase 23** | Automatic Spend Tracking — Phase 3.3.3: Staging Schema & Security  | ✅ Completed | Verified and applied consolidated schema suite (`supabase/staging_migration_consolidated.sql`) to fresh isolated staging Supabase project `eiwybyhvnhagugjjbkkl`; 100% read-only post-migration audit passed (26 tables verified, columns & constraints verified, RLS active, `user_linked_devices` does not expose HMAC secret, RPC caller restrictions active, 0 plaintext secrets in staging DB, 100% isolated from production `xsytaixmyeypoiscfbim`); 340/340 tests passing |

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

## 7. Navigation & Spends Rebuild Register — Phase 1: 3-Action Bottom Nav & Section Separation

- [x] **NAV-01:** Redesigned `src/components/BottomNav.tsx` to exactly three primary actions: `[ Bills ] [ + ] [ Spends ]`.
- [x] **NAV-02:** Removed `Completed` and `Remaining` options from the global bottom navigation.
- [x] **NAV-03:** Removed the central button labelled `Add Bill`, replacing it with a prominent 3D raised circular plus button with blue-to-purple gradient (`from-blue-600 via-indigo-600 to-purple-600`) and soft glow.
- [x] **NAV-04:** Configured Bills action with `ReceiptText` icon, active pill highlight, and seamless section switching.
- [x] **NAV-05:** Configured Spends action with supplied cartoon wallet logo (`/spends-icon.png`), active pill highlight, and section switching.
- [x] **NAV-06:** Removed top segmented switch below the header in `src/pages/HomePage.tsx` — section switching is now exclusively via the bottom navigation.
- [x] **NAV-07:** Integrated dedicated in-page `Remaining` | `Completed` controls inside the Bills view with counts and interactive summary card columns.
- [x] **NAV-08:** Preserved existing `BillFormModal` and wired `AddChoiceSheet` ("What would you like to add?") to independently launch Add Bill or Add Spend.
- [x] **NAV-09:** Updated test suite in `src/lib/bottom-nav-premium.test.ts` to assert the new 3-action bottom navigation, in-page filter tabs, and AddChoiceSheet wiring.
- [x] **NAV-10:** Verified all 17 test suites (253/253 tests pass), `npx tsc --noEmit` (0 errors), and production build `npm run build` succeeds.

## 8. Spends Feature Register — Phase 2: Date Selector & Spends Dashboard

- [x] **SPEND-15:** Built `shiftDateString(dayStr, offsetDays)` in `src/lib/format.ts` for timezone-safe calendar navigation avoiding UTC offset bugs.
- [x] **SPEND-16:** Upgraded `SpendsDashboard.tsx` selected-date header with Previous-day button, Next-day button (disabled for today), calendar trigger, and native picker restricted to `<= today`.
- [x] **SPEND-17:** Configured Total Spent summary card with Indian rupee formatting (`formatAmount`), live expense count, and supplied cartoon wallet illustration (`/spends-icon.png`).
- [x] **SPEND-18:** Implemented date-specific headings ("Today's Spends" vs "Spends for [DD Mon YYYY]"), expense count badges, and "+ Add Spend" action.
- [x] **SPEND-19:** Implemented individual expense cards with cartoon wallet icon, spend name, ₹ amount, notes, edit, and delete actions (strictly no categories or time fields).
- [x] **SPEND-20:** Implemented compact daily total summary footer (`Total spent on this date: ₹...`) agreeing with upper total card.
- [x] **SPEND-21:** Automatic view shift in `HomePage.tsx` when saving an expense for a different date so records are immediately visible.
- [x] **SPEND-22:** Verified 17/17 test suites (255/255 tests passing), 0 TypeScript errors, and production build succeeded.

## 9. Mascot Alignment Register — Phase A: Bills Mascot in Navigation & Add Choice Sheet

- [x] **MASCOT-01:** Replaced generic `ReceiptText` icon in `src/components/BottomNav.tsx` with the official BillBuddy mascot component (`BillBuddyLogo` using `/billbuddy-icon.png`) matching bill cards.
- [x] **MASCOT-02:** Maintained 19x19 icon container, active `scale-110`, inactive `opacity-80`, aligned with Bills text, preserving Spends cartoon wallet logo unchanged.
- [x] **MASCOT-03:** Replaced generic `ReceiptText` in `src/components/AddChoiceSheet.tsx` with `BillBuddyLogo` (36px, `p-1.5`, hover zoom `scale-110`), matching the Add Spend wallet presentation.
- [x] **MASCOT-04:** Preserved all form behavior, Add Bill dialogs, Add Spend option, and un-impacted document icons.
- [x] **MASCOT-05:** Updated `src/lib/bottom-nav-premium.test.ts` to assert `BillBuddyLogo` in BottomNav and AddChoiceSheet; 256/256 unit tests passing, 0 TypeScript errors, 0 ESLint errors, and production build succeeded.

## 10. Spends & Auth Rebuild Register — Phase B & Phase C

- [x] **SPEND-3D-01:** Configured `.spend-card-premium` in `src/styles.css` with layered ambient shadow, subtle elevation, delicate outer borders, and blue/lavender ambient glow (`::before`).
- [x] **SPEND-3D-02:** Implemented `@keyframes spend-card-float` with staggered animation delays (`floatDelay`) in `src/components/spends/SpendsDashboard.tsx`.
- [x] **SPEND-3D-03:** Added tactile active press feedback (`scale(0.985)`) and isolated button triggers using `e.stopPropagation()` on edit and delete buttons.
- [x] **SPEND-3D-04:** Added full accessibility respect for `prefers-reduced-motion` and `.reduce-motion` styles.
- [x] **AUTH-FIT-01:** Responsive viewport optimization across all 3 auth screens (`welcome`, `email`, `otp`) in `src/pages/LoginPage.tsx`.
- [x] **AUTH-FIT-02:** Optimized SVG dimensions and container margins (`max-h-[125px]`, `py-0.5 sm:py-2`) for `WalletIllustration`, `EmailIllustration`, and `OTPIllustration`.
- [x] **AUTH-FIT-03:** Tuned feature icons (`h-9 w-9 xs:h-10 xs:w-10 sm:h-11 sm:w-11`), responsive font sizes, and button heights (`min-h-[48px] sm:min-h-[54px]`).
- [x] **AUTH-FIT-04:** Added height media queries (`@media (max-height: 720px)`, `@media (max-height: 680px)`, `@media (max-height: 560px)`) ensuring complete content visibility without forced vertical scrolling on standard mobile screens while retaining keyboard-adaptive scrolling.

## 11. Email Reminder Investigation & Repair — Phase D

- [x] **REMIND-01:** Identified and fixed catastrophic reminder cancellation bug in `deleteBill` (`src/lib/bills.functions.ts`), which previously deleted all pending reminders for all user bills instead of only the target bill.
- [x] **REMIND-02:** Enhanced `processDueEmailReminders` in `src/lib/jobs.server.ts` with comprehensive diagnostic logging (eligible count, skips with reasons, provider responses, failure tracking).
- [x] **REMIND-03:** Validated reminder idempotency and deduplication (`email_sent:${reminder.id}`) to guarantee that re-running the job never sends duplicate reminders.
- [x] **REMIND-04:** Documented root cause of missing reminder email: missing `RESEND_API_KEY` in environment causing simulation mode failure, and missing automated cron/pg_cron invocation for `/api/public/hooks/scheduler`.
- [x] **REMIND-05:** Added unit test suite in `src/lib/email.test.ts` covering reminder idempotency and bill deletion isolation. Verified 17/17 test suites (262/262 tests passing), 0 TypeScript compiler errors, 0 ESLint errors, and production build succeeded.

## 12. Automatic Spend Tracking — Phase 1: Database & Spend Source Tracking

- [x] **SPEND-SRC-01:** Created non-destructive, idempotent Supabase migration `supabase/migrations/20261030000000_add_spend_source_and_dedupe.sql` adding `source` (with check constraint `('cash','bank','statement','email','notification','card','upi','other')` defaulting to `'other'`) and `dedupe_hash` with indexes `idx_spends_user_source` and `idx_spends_user_dedupe`.
- [x] **SPEND-SRC-02:** Updated `src/types/database.ts` and `src/integrations/supabase/types.ts` with `SpendSource`, `source`, and `dedupe_hash`.
- [x] **SPEND-SRC-03:** Enhanced `src/lib/spends.functions.ts` with source validation, automatic deterministic `dedupe_hash` computation, source preservation on updates, duplicate detection via `findDuplicateSpend`, and resilient transaction fallback mapping.
- [x] **SPEND-SRC-04:** Updated `src/lib/finance.functions.ts` to hydrate `source` from spends or transaction fallbacks into the global finance snapshot.
- [x] **SPEND-SRC-05:** Added intuitive payment source selector in `src/components/spends/SpendFormModal.tsx` (`Cash`, `UPI/Bank`, `Card`, `Other`) with standard Lucide icons, preserving existing form layout, keeping cash entry simple, and strictly maintaining zero time pickers.
- [x] **SPEND-SRC-06:** Added micro source indicator badges in `src/components/spends/SpendsDashboard.tsx` displaying clean, subtle tags for Cash, Bank, Card, Statement, Email, and Notification on daily expense cards without visual clutter.
- [x] **SPEND-SRC-07:** Added comprehensive test suite in `src/lib/spends.test.ts` validating source validation, default cash source, source preservation on update, deterministic dedupe hashing, multi-source daily totals, UI selector presence, micro badge rendering, and migration SQL idempotency.
- [x] **SPEND-SRC-08:** Verified all 17 Vitest test suites (271/271 unit tests passing), 0 TypeScript errors (`npx tsc --noEmit`), and production build succeeded.

## 13. Automatic Spend Tracking — Phase 2: Bank Statement Import (CSV)

- [x] **STM-CSV-01:** Built RFC-4180 compliant streaming CSV tokenizer and parser in `src/lib/parsers/statement-csv-parser.ts` supporting Bank of Baroda (BOB), SBI, HDFC, ICICI, Axis and custom statements.
- [x] **STM-CSV-02:** Implemented intelligent header autodetection (fuzzy matching date, narration, debit, credit, amount, reference), preamble disclaimer skipping, and interactive column mapping override.
- [x] **STM-CSV-03:** Built robust currency & amount sanitizer (Indian comma notation `1,25,450.50`, `Dr`/`Cr` suffixes, parentheses, minus signs) and multi-format date parser (`DD-MM-YYYY`, `DD/MM/YYYY`, `DD-MMM-YYYY`, `YYYY-MM-DD`).
- [x] **STM-CSV-04:** Implemented strict transaction classification: separates `expense` (debits) from `income` (credits), `refund`, and `transfer` (self-transfers, sweeps); only confirmed debit expenses qualify for import.
- [x] **STM-CSV-05:** Added spreadsheet formula injection protection (`sanitizeFormulaInjection`) neutralizing potential CSV injection vectors.
- [x] **STM-CSV-06:** Created server functions `checkStatementDuplicates` (checking duplicate hashes, references/UTRs, and matching existing ledger `bill_payment` entries to prevent double-counting) and `importStatementSpends` with safe batch insertion and resilient transactions fallback.
- [x] **STM-CSV-07:** Designed and built `src/components/spends/StatementImportModal.tsx` with drag-and-drop CSV upload, 5MB file validation, column mapping drawer, summary metric pills, scrollable preview table with checkboxes, duplicate warning badges, and batch import CTA.
- [x] **STM-CSV-08:** Integrated "Import Bank Statement" entry points into `src/components/spends/SpendsDashboard.tsx` and `src/components/AddChoiceSheet.tsx`, linked through `src/pages/HomePage.tsx`.
- [x] **STM-CSV-09:** Added 15 new unit tests in `src/lib/parsers/statement-csv-parser.test.ts` and `src/lib/statement-import.test.ts` covering BOB format, SBI format, negative debits, refunds, sweeps, formula injection, duplicate hashes, multi-user isolation, bill-payment ledger match, and timezone boundaries.
- [x] **STM-CSV-10:** Verified 19/19 Vitest test suites passing (286/286 unit tests passing), 0 TypeScript errors (`npx tsc --noEmit`), and production build succeeded.

## 14. Automatic Spend Tracking — Phase 3: Android Notification Detection

- [x] **NOTIF-FEAS-01:** Investigated Android `NotificationListenerService` lifecycle, security permissions, and Android OS background restrictions (Doze mode, OEM battery management, notification channel filtering).
- [x] **NOTIF-FEAS-02:** Researched notification payloads from PhonePe, Google Pay, Paytm, and Bank of Baroda (bob World), verifying reliable extraction of debits vs. credits, amounts, merchants, and references.
- [x] **NOTIF-FEAS-03:** Evaluated `YouPI-PG` open-source architecture; concluded that while its QR pairing and HMAC-SHA256 signing are sound security models, its notification matching focuses strictly on merchant inbound credits and must be replaced with custom debit extraction regex patterns.
- [x] **NOTIF-MIG-04:** Created non-destructive migration `supabase/migrations/20261030010000_add_linked_devices_and_notifications.sql` creating `public.linked_devices`, `public.device_pairing_tokens`, and `public.notification_ingest_logs` with row-level security policies.
- [x] **NOTIF-SEC-05:** Implemented cryptographic device linking and ingestion pipeline in `src/lib/notifications/devices.server.ts` and `src/lib/notifications/ingest.server.ts` using 256-bit HMAC-SHA256 request signing, 5-minute timestamp drift checks, unique nonce replay protection, debit-only classification, deduplication against existing spends & bill-payment ledger entries, and minimal privacy-safe audit logging.
- [x] **NOTIF-END-06:** Created TanStack Start API routes `/api/public/devices/pair` and `/api/public/notifications/ingest` for mobile device pairing and notification payload ingestion.
- [x] **NOTIF-KOT-07:** Built native Kotlin Android companion application in `android-companion/` containing `NotificationListenerService`, `KeystoreManager` using `EncryptedSharedPreferences`, Room Database offline queue (`QueuedNotification`), OkHttp client with standard TLS, `PrivacyFilter` discarding OTPs/passwords/promotions, and camera-based QR scanner.
- [x] **NOTIF-TEST-08:** Built comprehensive test suites `src/lib/parsers/notification-parser.test.ts` (18 tests) and `src/lib/notifications-ingest.test.ts` (8 tests) testing PhonePe, GPay, Paytm, bob World debits, inbound credit classification, privacy filters, replay attacks, and duplicate detection.
- [x] **NOTIF-UI-09:** Designed and built `AutomaticTrackingModal.tsx` in `src/components/spends/` with real-time pairing QR SVG generation (`src/lib/qr/qr-code.ts`), linked device management, pause/resume controls, revocation actions, and privacy-safe sync activity logs; wired into `SpendsDashboard.tsx` and `AddChoiceSheet.tsx`.
- [x] **NOTIF-VERIF-10:** Verified all 21 Vitest test suites (312/312 unit tests passing), 0 TypeScript compiler errors (`npx tsc --noEmit`), 0 ESLint errors, and production build compiled successfully.

## 15. Automatic Spend Tracking — Phase 3.2: Security Remediation

- [x] **SEC-REM-01 (HMAC Secret Encryption at Rest):** Implemented AES-256-GCM authenticated encryption service in `src/lib/notifications/crypto.server.ts` with randomized 96-bit IV, 128-bit authentication tag, structured format (`enc:v1:<iv>:<tag>:<ciphertext>`), backward-compatible legacy plaintext decryption, and fail-closed security for production when `SERVER_ENCRYPTION_KEY` is missing.
- [x] **SEC-REM-02 (Column Privilege Hardening & Safe View):** Created non-destructive migration `supabase/migrations/20261030020000_security_remediation_phase3.sql` that revokes `SELECT` on `linked_devices.hmac_key` from `authenticated` and `anon` roles while granting SELECT on all safe columns (`id`, `user_id`, `device_name`, `device_fingerprint`, `status`, `last_sync_at`, `created_at`, `revoked_at`), and creates the secure view `public.user_linked_devices`. Updated `listUserDevices` in `devices.server.ts` to query safe fields exclusively.
- [x] **SEC-REM-03 (Atomic Pairing Token Consumption):** Eliminated TOCTOU race conditions in pairing by replacing two-step `SELECT` then `UPDATE` with atomic PostgreSQL function `consume_pairing_token(p_token)` and atomic row-level fallback `UPDATE ... WHERE token = p_token AND used_at IS NULL AND expires_at > now() RETURNING user_id`. Added concurrency test in `pairing-concurrency.test.ts` verifying that exactly 1 out of multiple simultaneous parallel pairing requests succeeds.
- [x] **SEC-REM-04 (Atomic Notification Replay Protection):** Closed replay window by introducing transactional database function `ingest_notification_spend` and atomic claim-before-mutation fallback in `ingest.server.ts`. The unique `nonce` is claimed in `notification_ingest_logs` with a database unique constraint *before* any deduplication check or spend creation occurs. Added concurrency test in `ingest-concurrency.test.ts` verifying that simultaneous replay attacks result in exactly 1 spend record and reject parallel calls with `REPLAY_DETECTED`.
- [x] **SEC-REM-05 (Local Network QR Pairing & Host Validation):** Implemented intelligent localhost/loopback detection in `AutomaticTrackingModal.tsx` prompting users for their local LAN IP when running development servers, and added strict host validation in `validatePairingBaseUrl` (`src/lib/notifications.functions.ts`) rejecting non-HTTP protocols, embedded credentials (`user:pass@`), public non-HTTPS origins in production, while permitting local RFC-1918 private IPv4 addresses in development.
- [x] **SEC-REM-06 (Automated Security Test Coverage):** Added 5 dedicated test suites (`crypto.server.test.ts`, `secret-exposure.test.ts`, `pairing-validation.test.ts`, `pairing-concurrency.test.ts`, `ingest-concurrency.test.ts`).
- [x] **SEC-REM-07 (Full Codebase Verification):** Verified 26/26 Vitest test suites (327/327 tests passing), 0 TypeScript errors (`npx tsc --noEmit`), 0 ESLint errors, and production build succeeded.

## 16. Automatic Spend Tracking — Phase 3.2.2: Critical Security Fixes

- [x] **CRIT-FIX-01 (Cross-User Device Data Exposure Remediation):** Hardened `public.user_linked_devices` in new corrective migration `supabase/migrations/20261030030000_security_hardening_phase3.sql` and `20261030020000_security_remediation_phase3.sql` with `WITH (security_invoker = true)` and explicit `WHERE auth.uid() = user_id` filter. Explicitly revoked access from `PUBLIC` and `anon`, granting SELECT to `authenticated` and ALL to `service_role`. Guaranteed that no authenticated user can inspect devices or IP addresses belonging to other users.
- [x] **CRIT-FIX-02 (Unauthorized Financial RPC Protection):** Secured both `consume_pairing_token(text)` and `ingest_notification_spend(...)` with explicit `SET search_path = public, pg_temp;`. Revoked `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`, granting execution strictly to `service_role`. Added internal authorization assertions: `consume_pairing_token` rejects non-service_role callers; `ingest_notification_spend` rejects callers attempting actions for another `user_id` (`auth.uid() <> p_user_id`), verifies device ownership, and prevents cross-user financial insertion.
- [x] **HIGH-FIX-03 (Environment Key Fail-Closed Hardening):** Modernized `crypto.server.ts` to reject hardcoded development seeds across any deployed cloud environment (`NODE_ENV === "production"`, `VERCEL_ENV`, `CF_PAGES`, `FLY_APP_NAME`, `RENDER`, `APP_ENV === "staging"`, `APP_ENV === "preview"`, etc.). Local fallback is restricted strictly to local dev/test context. Enforced strict 32-byte key length validation (64 hex characters or 44 base64 characters) failing closed on invalid keys.
- [x] **HIGH-FIX-04 (Plaintext HMAC Secret Migration Procedure):** Implemented programmatic migration procedure `migratePlaintextDeviceSecrets(adminClient)` in `crypto.server.ts` that safely encrypts all existing plaintext keys with AES-256-GCM without exposing secrets in logs. Added automatic lazy in-place re-encryption in `ingest.server.ts` upon receipt of authentic device requests.
- [x] **HIGH-FIX-05 (Safe Idempotent Retry & Nonce Recovery):** Overhauled notification ingestion pipeline in `ingest.server.ts` and `ingest_notification_spend` RPC to support idempotent retry recovery. When a legitimate retry occurs after a transient timeout or crash (`status IN ('processing', 'rejected')`), it recovers and completes spend creation. When a retry occurs after successful processing (`status === 'imported'`), it returns the existing `spend_id` idempotently without creating duplicate spends. Replays from different devices or users are rejected with `REPLAY_DETECTED`.
- [x] **TEST-VERIF-06 (Comprehensive Test Suite):** Added 8 new tests in `src/lib/notifications/security-hardening.test.ts` and expanded `crypto.server.test.ts` to 10 tests, covering all 10 required audit scenarios. All 27 Vitest test suites (340/340 unit tests) passing with 0 failures.
- [x] **QUALITY-07 (Zero TypeScript, ESLint & Build Errors):** `npx tsc --noEmit` passed with 0 errors; `npx eslint . --quiet` passed with 0 errors; `npm run build` compiled production output successfully.

## 17. Automatic Spend Tracking — Phase 3.3.3: Staging Migration Execution & Post-Migration Verification

- [x] **STAGE-ISOL-01 (Strict Environment Isolation):** Connected and audited strictly against Staging Supabase project reference `eiwybyhvnhagugjjbkkl` (`https://eiwybyhvnhagugjjbkkl.supabase.co`). Zero requests routed to production project `xsytaixmyeypoiscfbim`.
- [x] **STAGE-MIG-02 (Consolidated Migration Application):** Inspected and assembled complete migration suite in dependency order (`001_billbuddy_schema.sql`, `20261026000000_create_spends_table.sql`, `20261030000000_add_spend_source_and_dedupe.sql`, `20261030010000_add_linked_devices_and_notifications.sql`, `20261030020000_security_remediation_phase3.sql`, and `20261030030000_security_hardening_phase3.sql`). Verified successful execution in staging Supabase SQL editor.
- [x] **STAGE-TBL-03 (Table Inventory & Schema Verification):** Programmatically verified all 26 required application tables exist and are queryable in staging: `profiles`, `user_settings`, `notification_preferences`, `user_roles`, `categories`, `bills`, `bill_occurrences`, `bill_reminders`, `payments`, `transactions`, `budgets`, `spending_goals`, `notifications`, `attachments`, `audit_logs`, `support_tickets`, `support_ticket_messages`, `payment_orders`, `payment_attempts`, `payment_events`, `closed_accounts`, `job_runs`, `spends`, `linked_devices`, `device_pairing_tokens`, and `notification_ingest_logs`.
- [x] **STAGE-COL-04 (Phase 3 Column & Constraint Verification):** Validated columns on `spends` (`source`, `dedupe_hash`), `linked_devices` (all 10 fields), `device_pairing_tokens` (all 5 fields), and `notification_ingest_logs` (all 10 fields).
- [x] **STAGE-VIEW-05 (user_linked_devices Secret Protection):** Verified `user_linked_devices` does NOT expose `hmac_key` (PostgREST select explicitly fails with error code `42703: column user_linked_devices.hmac_key does not exist`).
- [x] **STAGE-RLS-06 (Row-Level Security Active):** Verified anonymous queries return 0 rows or are blocked with HTTP 401; anonymous insert attempts fail with SQL code `42501: new row violates row-level security policy`.
- [x] **STAGE-RPC-07 (RPC Security Definer & Caller Authorization):** Verified `consume_pairing_token` and `ingest_notification_spend` are revoked from anonymous access (HTTP 401/404); verified service role execution enforces internal device ownership and user verification (`P0001: UNAUTHORIZED: Device does not exist`).
- [x] **STAGE-SECR-08 (Plaintext Secret Audit):** Audited `linked_devices` table in staging; confirmed zero plaintext secrets exist (fresh database, 0 devices).
- [x] **STAGE-TEST-09 (Test Suite Integrity):** All 27 Vitest test suites (340/340 unit tests) passing with 0 failures.

## 18. Automatic Spend Tracking — Phase 3.3.4: Final Security Verification (Read-Only)

- [x] **VERIF-PROD-01 (Zero Production Impact):** Re-confirmed target URL is strictly `https://eiwybyhvnhagugjjbkkl.supabase.co`. Production project `xsytaixmyeypoiscfbim` was never accessed or modified.
- [x] **VERIF-USER-02 (Isolated Multi-User Auth):** Provisioned two temporary test accounts (`User A` and `User B`) via Supabase Auth Admin API and generated legitimate authenticated JWTs (`jwtA`, `jwtB`).
- [x] **VERIF-VIEW-03 (Cross-User Device Read Isolation):** Inserted isolated test devices for User A and User B. Queried `user_linked_devices` as User A: User A observed only their own device; User B's device was completely invisible. Attempting to select `hmac_key` returned error `42703 (column does not exist)`.
- [x] **VERIF-PAIR-04 (Cross-User Pairing Protection):** Created pairing token for User B. User A attempted execution of `consume_pairing_token(tokenB)`: blocked with HTTP 403 (`permission denied for function consume_pairing_token`). Direct `PATCH` attempt was blocked by RLS. Token remained unconsumed.
- [x] **VERIF-INGEST-05 (Cross-User Ingestion Guardrail):** User A attempted direct invocation of `ingest_notification_spend`: blocked with HTTP 403. Mismatched invocation via service role (Device A with User B) failed with error `P0001: UNAUTHORIZED: Device does not exist, is revoked, or does not belong to user`. Zero spends created for User B.
- [x] **VERIF-RPC-06 (Function Security Definer & Grants):** Confirmed `consume_pairing_token` and `ingest_notification_spend` are revoked from `anon` and `authenticated` roles (returning HTTP 401/403/404); both functions run with `SECURITY DEFINER SET search_path = public, pg_temp;`.
- [x] **VERIF-CRYPTO-07 (AES-256-GCM Verification with Real Secret):** Validated encryption of real 64-char hex secret using staging `SERVER_ENCRYPTION_KEY`: 5-part `enc:v1` envelope generated, 96-bit random IV, 128-bit GCM auth tag, plaintext absent from ciphertext, successful round-trip decryption, tampered auth tag throws corrupted tag error.
- [x] **VERIF-CLEAN-08 (Staging Test Cleanup):** Safely deleted temporary test devices, tokens, and auth users from staging database. Clean state restored.

## 19. Automatic Spend Tracking — Phase 3.4: Staging Deployment & End-to-End Verification

- [x] **DEPLOY-ISOL-01 (Strict Environment Isolation & Zero Production Impact):** Verified environment isolation. Target Supabase URL is strictly `https://eiwybyhvnhagugjjbkkl.supabase.co` (`eiwybyhvnhagugjjbkkl`). Production Supabase project `xsytaixmyeypoiscfbim` was never accessed or modified. Added staging guard to `src/integrations/supabase/client.ts` throwing fail-fast exceptions if staging environment is active and staging URL is missing or resolves to production.
- [x] **DEPLOY-CONF-02 (Secrets & Key Material Audit):** Verified all required environment variables (`SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SERVER_ENCRYPTION_KEY`). Confirmed `SERVER_ENCRYPTION_KEY` is exactly 32 bytes (64 hex characters) and verified server-only secrets are never leaked to client bundles.
- [x] **DEPLOY-ANDR-03 (Android Security & Cleartext Hardening):** Inspected Android companion project in `android-companion/`. Confirmed Gradle plugins (AGP 8.5.0, Kotlin 1.9.24), SDK compatibility (`compileSdk 34`, `minSdk 26`, `targetSdk 34`), and Java 17 compatibility. Hardened `AndroidManifest.xml` to disable cleartext HTTP (`android:usesCleartextTraffic="false"`) by default for release builds, while adding `android-companion/app/src/debug/AndroidManifest.xml` permitting cleartext HTTP strictly for debug/local LAN testing. Verified companion uses staging API URL configured via web app QR pairing handshake.
- [x] **DEPLOY-BLD-04 (Build, Typescript & Lint Verification):** Production SSR client and Nitro server build completed cleanly (`npm run build`). `tsc --noEmit` passed with 0 errors. `eslint --quiet` passed with 0 errors. All 28 Vitest test suites (344/344 unit tests) passed with 0 failures.
- [x] **DEPLOY-SERV-05 (Staging Server Boot & Route Verification):** Staging server was started with staging configuration (`.env.staging`). Verified staging website loads (`GET /` HTTP 200, `GET /login` HTTP 200). Verified live database connection against Staging Supabase (`profiles` select HTTP 200).
- [x] **DEPLOY-AUTH-06 (Staging Authentication Verified):** Provisioned test user via Staging Supabase Auth Admin API and successfully exchanged credentials for authenticated user session token.
- [x] **DEPLOY-CSV-07 (CSV Statement Import Verified):** Successfully inserted statement-imported spend into staging database `public.spends` table with `source: 'statement'` and `dedupe_hash`.
- [x] **DEPLOY-PAIR-08 (Device Pairing Endpoint Verified):** Tested `/api/public/devices/pair`. Confirmed unauthorized/missing token requests are rejected with HTTP 401; authentic pairing token exchange generates encrypted device registration in staging database and returns HTTP 200 with 64-hex-char HMAC key.
- [x] **DEPLOY-INGEST-09 (Notification Ingestion Endpoint Verified):** Tested `/api/public/notifications/ingest`. Verified tampered HMAC signature is rejected with HTTP 401. Verified authentic HMAC-SHA256 debit payload ingests successfully with HTTP 200 (`status: "imported"`). Verified idempotent retry recovery returns HTTP 200 with identical `spend_id`. Verified cross-device replay attack with claimed nonce is rejected with HTTP 409 (`REPLAY_DETECTED`).
- [x] **DEPLOY-CLEAN-10 (Staging Data Cleanup):** All temporary test users, linked devices, pairing tokens, spends, and ingest logs were deleted from the staging database following verification.

## 20. Automatic Spend Tracking — Phase 3.4.1: Public Vercel Staging Deployment Inspection

- [x] **VERCEL-AUDIT-01 (Git Branch & Deployment Setup Inspection):** Inspected Git branches and remotes. Active local branch is `main`, tracking `origin/main` (`https://github.com/SkEESUB/Bill-Buddy.git`). Pushing to `origin/main` triggers production Vercel auto-deployment, strictly prohibited under protection rules.
- [x] **VERCEL-AUDIT-02 (CLI Auth & Link Status):** Inspected Vercel CLI 65.9.0. CLI reports `Logged out`. No active `.vercel/project.json` linking exists. Global config at `AppData/Roaming/com.vercel.cli/Data/config.json` contains no auth token. Anonymous temporary deployment (`--temporary`) is rejected (`Your temporary deployment has expired`).
- [x] **VERCEL-AUDIT-03 (Safest Staging Deployment Method Established):**
  - **Method:** Create a distinct Vercel project (`billbuddy-staging`) separated from the production project, or provide a Vercel personal access token (`VERCEL_TOKEN`) with scope restricted to a staging deployment.
  - **Required Staging Environment Variables:**
    - `APP_ENV` = `staging`
    - `NODE_ENV` = `production`
    - `SUPABASE_URL` = `https://eiwybyhvnhagugjjbkkl.supabase.co`
    - `SUPABASE_PUBLISHABLE_KEY` = `[Staging publishable key]`
    - `SUPABASE_SERVICE_ROLE_KEY` = `[Staging service role secret]`
    - `VITE_SUPABASE_URL` = `https://eiwybyhvnhagugjjbkkl.supabase.co`
    - `VITE_SUPABASE_PUBLISHABLE_KEY` = `[Staging publishable key]`
    - `SERVER_ENCRYPTION_KEY` = `[32-byte staging AES-256 encryption key]`
  - **Zero Production Risk:** Avoids shared preview environment variable contamination; production Supabase (`xsytaixmyeypoiscfbim`) and production Vercel remain 100% untouched.
- [x] **VERCEL-AUDIT-04 (Stop Condition Reached):** In accordance with instruction ("If Vercel authentication, project permissions or deployment configuration is missing, stop and explain what is needed. Do not guess or use production credentials"), halted before public deployment until authentication is supplied.
- [x] **VERCEL-AUDIT-05 (Local Staging Readiness):** All 344 unit tests passing, `tsc` clean, Nitro server build verified against Staging Supabase `eiwybyhvnhagugjjbkkl`. Codebase is completely prepared for immediate deployment once Vercel token is provided.

## 21. Automatic Spend Tracking — Urgent Staging Save Failure Investigation & Remediation

- [x] **SAVE-INVEST-01 (Error Symptom Reproduction & Identification):** Investigated critical staging save failure ("Something went wrong. Please try again." on Add Bill and Add Spend forms). Traced error origin to generic fallback in `src/lib/errors.ts` (`classifyError` returning unknown error when backend error is unclassified or wrapped in HTTP 500 HTML responses).
- [x] **SAVE-INVEST-02 (Root Cause Identified):**
  1. **HTML 500 Middleware Masking:** `src/start.ts` `errorMiddleware` was catching server function RPC errors and returning `new Response(renderErrorPage(), { status: 500 })` with HTML content. TanStack Start's client-side deserializer expects JSON RPC data; receiving HTML caused a deserialization crash on the client, masking the true error behind a generic unknown failure.
  2. **Error Classifier Masking:** `src/lib/errors.ts` `classifyError()` unconditionally masked database constraint errors, staging guard errors, and save failure errors into generic `"Something went wrong. Please try again."` messages.
  3. **Build-Time Inlining & Staging Guard:** Vite production client builds inline `VITE_SUPABASE_URL`. When built without staging environment variables, the client authenticates against the production Supabase reference (`xsytaixmyeypoiscfbim`), whereas the server function verifies against staging (`eiwybyhvnhagugjjbkkl`), leading to `AUTH_INVALID: Invalid token` or triggering `isStagingEnv` production reference guards.
- [x] **SAVE-FIX-03 (Middleware & Server Function Unmasking):**
  - Updated `src/start.ts` so `errorMiddleware` never intercepts server function RPCs (`/_serverFn/` or `x-tss-server-fn`); errors bubble cleanly so TanStack Start serializes the real Error object back to the browser.
  - Enhanced `src/lib/errors.ts` with `db_constraint` and `server_error` classifications preserving actionable backend messages (`Failed to create bill: ...`, `Failed to create spend: ...`, `violates check constraint`).
  - Added `safeSanitizeMessage()` redacting JWTs, Bearer tokens, Supabase keys, and user emails.
  - Added `safeLogError()` ensuring error logging never exposes tokens, secrets, or PII.
  - Added `safeLogError` to `bills.functions.ts` and `spends.functions.ts`.
- [x] **SAVE-TEST-04 (Automated Regression Suite):** Created `src/lib/staging-save-resilience.test.ts` covering 11 unit tests for secret sanitization, safe logging, database constraint error preservation, and spend input validation. Total test count increased to 355/355 passing.
- [x] **SAVE-E2E-05 (Live Staging Supabase Verification):** Executed `scripts/verify-staging-save.mjs` against Staging Supabase (`eiwybyhvnhagugjjbkkl`):
  - Created isolated staging test user via Auth Admin API.
  - Authenticated and verified active profile status.
  - Created bill in `public.bills` and verified occurrence generation in `public.bill_occurrences` (status: `pending`).
  - Created spend in `public.spends` with `source: 'upi'` and deduplication hash.
  - Retrieved and verified saved bill and spend records directly from staging database.
  - Safely deleted all disposable test records (100% clean).
  - Production Supabase reference (`xsytaixmyeypoiscfbim`) confirmed 100% untouched.

- [x] All six documentation files exist and are accurate (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `MEMORY.md`, `RULES.md`, `TRACKER.md`).
- [x] Required database schema is consolidated in [`001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) covering all 22 tables.
- [x] Migration state and ordering are documented.
- [x] Automated tests pass (355/355 passing).
- [x] Type checking passes (0 errors).
- [x] Production build succeeds (`vite build` / Nitro output generated cleanly with zero deprecation warnings).
- [ ] Live database schema executed in Supabase project `xsytaixmyeypoiscfbim`.
- [ ] End-to-end live browser authentication and data persistence verified.

