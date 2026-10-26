# Product Requirements Document (PRD) — BillBuddy (Money Mind Frame)

**Document Version:** 1.2.0  
**Status:** Living Document / Authoritative  
**Target Runtime:** TanStack Start (SSR) + React 19 + Nitro + Supabase  
**Authoritative Supabase Project:** `xsytaixmyeypoiscfbim` (`https://xsytaixmyeypoiscfbim.supabase.co`)  
**Audit Verification:** 186/186 Unit Tests Passing | TypeScript Strict: 0 Errors | Production Build: Verified  
**Last Updated:** 2026-10-23

---

## 1. Executive Summary & Vision

**BillBuddy** (also referenced as **Money Mind Frame**) is a full-stack personal financial intelligence, bill-management, and liability-forecasting web application. The platform provides individuals, households, and freelancers with proactive visibility into recurring liabilities, cash-flow cycles, variable spending, savings targets, and debt amortisation.

### Core Value Proposition

- **Predictive Liability Tracking:** Transitioning from reactive bill payment to automated, calendarized run-rate forecasting.
- **Privacy-First Data Ownership:** Complete user data isolation using Supabase PostgreSQL Row-Level Security (RLS) policies (`auth.uid() = user_id`).
- **Frictionless Authentication:** 6-digit email One-Time Password (OTP) verification eliminating password fatigue while ensuring secure device sessions.
- **Actionable Financial Analytics:** Real-time financial health scoring, subscription creep audits, and exportable audit trails (CSV/JSON/PDF) without mandatory third-party bank credential escrow.
- **Transactional & Payment Integrity:** Strict state-machine enforcement for bill payment orders, idempotent financial writes (`client_request_id`), append-only reversals, and single active payment locks on bill occurrences.

---

## 2. Target Audience & User Personas

### 2.1 The Subscription-Heavy Professional ("Alex")

- **Profile:** 28–42 years old, maintains 15+ recurring SaaS, streaming, utility, and fitness memberships across multiple payment methods.
- **Core Pain Point:** Subscription creep, unexpected annual renewals, and difficulty tracking net cash outflow before payday.
- **Primary Need:** Proactive renewal alerts, cancellation recommendations, and upcoming bill run-rate projections.

### 2.2 The Budget-Conscious Household Planner ("Jordan")

- **Profile:** Manages shared family expenses, mortgage/rent payments, utilities, and emergency fund allocations.
- **Core Pain Point:** Misaligned cash flow where major bills coincide on the same week, causing temporary liquidity crunches.
- **Primary Need:** Calendarized cash-flow forecasting, categorized spending thresholds, and real-time budget vs. actual variance tracking.

### 2.3 The Debt & Savings Strategist ("Morgan")

- **Profile:** Working aggressively toward zero-debt milestones or targeted capital purchases (down payments, emergency reserves).
- **Core Pain Point:** Inability to see how paying an extra $100/month affects long-term debt payoff schedules or savings growth.
- **Primary Need:** Interactive goal tracking, debt payoff calculators, and net worth trend aggregation.

---

## 3. Product Scope & Functional Requirements

### 3.1 Authentication & Identity Management

- **REQ-AUTH-001 (Email OTP Delivery):** Users submit their email address to receive a secure, time-limited 6-digit OTP code (`supabase.auth.signInWithOtp`).
- **REQ-AUTH-002 (OTP Token Verification):** Users submit the 6-digit token alongside their email address (`supabase.auth.verifyOtp` with type `email`). Successful verification establishes a cryptographically signed session.
- **REQ-AUTH-003 (Session Persistence & SSR Cookie Mirroring):** Auth state is mirrored into secure HTTP cookies for TanStack Start SSR hydration and server function authorization.
- **REQ-AUTH-004 (Strict Email Isolation):** No magic links or legacy redirection URLs are permitted in production; authentication strictly completes within the active web application frame.
- **REQ-AUTH-005 (Graceful Sign Out):** Complete invalidation of client-side tokens and clearing of SSR session cookies on sign out.
- **REQ-AUTH-006 (Account Status Gates):** Server functions gate mutations against `account_status` (`ACTIVE`, `SUSPENDED`, `CLOSED`, `PENDING_DELETION`), failing closed if non-active.

### 3.2 Bill & Subscription Management

- **REQ-BILL-001 (Bill Lifecycle):** Full CRUD for recurring and one-time bills, including name, positive amount (₹), due date, reminder time, reminder email, repeat cadence, and notes.
- **REQ-BILL-002 (Preserved Dashboard):** The Bills dashboard remains authoritative for upcoming, remaining, and completed liabilities with zero regression.

### 3.3 Daily Spending Management (Spends Feature) & Unified 3-Action Navigation

- **REQ-SPEND-001 (Separation of Concerns):** Daily expenses are kept strictly separated from bill liabilities. Daily spends do not mix into bills schedules, and bill occurrences do not pollute daily spends.
- **REQ-NAV-001 (3-Action Floating Bottom Navigation):** Global navigation features exactly three actions: **[ Bills ] [ + ] [ Spends ]**. "Completed" and "Remaining" are removed from global navigation; the central button is a 3D raised circular plus button with blue-to-purple gradient.
- **REQ-NAV-002 (Single-Point Section Switching):** The top segmented control below the header is removed. Navigation between Bills and Spends is accessible through the bottom navigation bar only.
- **REQ-NAV-003 (In-Page Bills Status Controls):** Inside the Bills page, two dedicated controls (`[ Remaining ]` | `[ Completed ]`) with item counts and interactive summary card columns filter the bill list in-place without global navigation.
- **REQ-SPEND-003 (Date-Scoped Spending Review):** Spends dashboard features a timezone-safe day selector (`shiftDateString`) with Previous-day arrow, Next-day arrow (disabled for today), calendar trigger, and picker restricted to `<= today`.
- **REQ-SPEND-004 (Daily Spending Calculations):** Displays prominent summary card with exact calculated "TOTAL SPENT" for the active date, expense count, and official cartoon wallet mascot.
- **REQ-SPEND-005 (Daily Spends List & Footer):** Lists date-specific expenses (Spend name, amount in ₹, wallet icon, edit and delete actions, strictly no categories or time fields) and presents an end-of-day total summary.
- **REQ-SPEND-006 (Independent Add Modals):** Central `+` button opens `AddChoiceSheet` ("What would you like to add?": Add Bill vs Add Spend). Add Spend modal accepts Spend Name (required), Amount in ₹ (required positive value), Date (required, defaults to active date, strictly NO time picker), and optional Note.
- **REQ-SPEND-007 (Mascot Branding & 3D Depth):** Official cartoon wallet mascot is utilized for Spends with gentle floating animations (`.animate-gentle-float`), 3D layered card shadows, and full reduced-motion accessibility support.

- **REQ-BILL-001 (CRUD Operations):** Create, read, update, archive, and delete recurring bills with custom recurrence frequencies (daily, weekly, bi-weekly, monthly, quarterly, semi-annually, annually).
- **REQ-BILL-002 (Status Lifecycle):** Mark bills and occurrences across states: `pending`, `paid`, `overdue`, or `skipped`.
- **REQ-BILL-003 (Occurrence Generation):** Recurrence rules generate concrete `bill_occurrences` records preventing duplicate schedules and tracking per-occurrence payment orders.
- **REQ-BILL-004 (Auto-Pay & Reminder Flags):** Configuration of lead-time alerts (`bill_reminders`) and auto-pay tracking flags.
- **REQ-BILL-005 (Category & Method Assignment):** Explicit linkage of bills to customizable expense categories and payment accounts.

### 3.3 Transaction Ledger & Expense Tracking

- **REQ-TXN-001 (Ledger Management):** Ingestion of income, expense, and transfer records with timestamp, merchant, category, amount, and notes.
- **REQ-TXN-002 (Idempotency):** Client mutations supply unique `client_request_id` keys to ensure duplicate submissions are deduplicated at the database layer.
- **REQ-TXN-003 (Append-Only Reversals):** Transaction updates and cancellations generate auditable offsetting reversal records preserving full historical ledger integrity.
- **REQ-TXN-004 (Net-Neutral Transfers):** Internal transfers between accounts maintain net-zero impact on aggregate user net worth.
- **REQ-TXN-005 (Batch Import / Export):** Ingestion of CSV bank statements with client-side header mapping and export of transaction logs to CSV and JSON.

### 3.4 Budgets & Financial Goal Setting

- **REQ-BDG-001 (Envelope & Category Budgets):** Allocation of spending ceilings per category on a calendar-month cadence.
- **REQ-BDG-002 (Run-Rate Variance Alerts):** Visual indicators when current spending velocity projects a budget overrun prior to month-end.
- **REQ-GOAL-001 (Spending & Savings Targets):** Creation of goals in `spending_goals` with target amounts, target dates, and linked status tracking.
- **REQ-GOAL-002 (Visual Progress Metrics):** Percentage completion tracking and projected time-to-completion calculations based on historical contribution velocity.

### 3.5 Financial Intelligence & Reporting

- **REQ-REP-001 (Financial Health Score):** Algorithmic scoring evaluating debt-to-income ratio, savings rate, and on-time bill payment compliance.
- **REQ-REP-002 (Cash-Flow Projections):** Dynamic chart rendering projecting 30-day liquidity based on confirmed upcoming bills vs. anticipated recurring income.
- **REQ-REP-003 (Category Breakdown Visualizations):** Recharts-driven donut and bar visualizations itemizing expenditure distributions.

### 3.6 Profile, Settings & Audit

- **REQ-PROF-001 (User Profile Management):** User customization of display name, primary currency (USD, EUR, GBP, INR, etc.), date format, and avatar photo (`avatars` storage bucket).
- **REQ-PROF-002 (User Settings & Notification Preferences):** Dedicated persistence in `user_settings` and `notification_preferences`.
- **REQ-PROF-003 (Data Privacy & Export):** One-click full data export (JSON bundle of all user records) and self-service account erasure complying with GDPR/CCPA.
- **REQ-AUD-001 (Audit Logging):** System and security events write structured, credential-stripped entries to `audit_logs`.

---

## 4. Non-Functional Requirements

### 4.1 Security & Compliance

- **NFR-SEC-001 (Row-Level Security):** 100% of the 22 database tables containing user-associated data must enforce PostgreSQL RLS policies where `auth.uid() = user_id`.
- **NFR-SEC-002 (Zero Secret Leakage):** Service-role keys and backend administrative credentials must never be bundled into client-accessible JavaScript artifacts.
- **NFR-SEC-003 (Input Sanitization):** All inputs processed through TanStack Start server functions must validate payloads using Zod schemas (`.validator()`) before database dispatch.
- **NFR-SEC-004 (Payment State Machine):** Strict transition validation for `payment_orders` preventing transitions out of `CAPTURED` except for verified refunds.

### 4.2 Performance & Responsiveness

- **NFR-PERF-001 (Hydration & TTI):** SSR initial page load under 1.2s on standard broadband; Time to Interactive (TTI) under 1.8s.
- **NFR-PERF-002 (Optimistic Updates):** Common interactions (marking a bill as paid, adding an expense) must apply TanStack Query optimistic cache updates immediately.
- **NFR-PERF-003 (Responsive Layouts):** Adaptive interfaces supporting mobile devices (320px+), tablets (768px+), and high-resolution desktop viewports (1440px+).

---

## 5. Constraints & Dependencies

### 5.1 Database Schema Dependencies

The application requires all 22 relational tables, RLS policies, triggers, and the two storage buckets (`avatars`, `receipts`) defined in [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) to be active on project `xsytaixmyeypoiscfbim`.

### 5.2 External Platform Guardrails

- **Production Sync Guardrail:** Changes pushed to repository branch `main` sync directly to continuous deployment (Vercel). Force-pushing, history re-writing, and unverified package upgrades are strictly prohibited.
