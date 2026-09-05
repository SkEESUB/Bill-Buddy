# PocketPilot — Path to Production

## Phase 0 audit (done)

What exists today:
- TanStack Start + React 19 + Tailwind v4, routes in `src/routes` with a working `_authenticated` gate.
- Backend: 6 tables (`profiles`, `user_settings`, `bills`, `payments`, `transactions`, `budgets`), all with RLS scoped to `auth.uid()` and correct grants. Triggers seed profile/settings on signup.
- Auth: email OTP, session persistence, sign-out. Works.
- UI: plum/lilac design system, bill/transaction cards, modals, Money/History/Analytics/Profile/Settings screens.

Real gaps against your spec:
1. **All data access runs from the browser.** There is not a single server function; nothing is server-authoritative.
2. **No payment provider.** `PaymentModal` opens a `upi://pay` link and then asks the user "did you pay?" — a paid bill is currently a client-trusted claim. This is the biggest correctness hole.
3. **No bill occurrences.** Recurring bills have no per-period rows, so no independent history, no real overdue engine, no next-occurrence generation.
4. **Missing tables**: categories, notification_preferences, notifications, payment_orders/attempts/events, attachments, audit_logs, support_tickets, user_roles.
5. **No tests at all**, no scheduled jobs, no admin, no account deletion, transfers not modelled, safe-to-spend not derived.
6. Some settings toggles persist; export is client-side CSV only.

## What I need from you before payments can be real

A live payment integration needs a provider account and secrets that only you can supply. Options:
- **Razorpay** (as your spec assumes): needs Key ID, Key Secret, Webhook Secret from your Razorpay dashboard.
- **Manual/UPI only**: keep UPI handoff but treat every payment as *manual, user-attested* — clearly labelled as such, no fake "verified" state.

Until credentials exist, the pay flow will show a real "Payment provider not configured" state, never a fake success.

## Delivery plan (phase by phase, one message each)

**Phase 1 — Data foundation**
Migration adding: `categories`, `bill_occurrences`, `notifications`, `notification_preferences`, `attachments`, `audit_logs`, `user_roles` + `has_role()`, plus new columns on `bills` (repeat_type/interval/end, amount_type, reminder_days_before, is_active) and `transactions` (type incl. transfer/refund, status, payment_method, bill_occurrence_id, external_reference). RLS + grants + indexes on every table. Backfill existing bills into occurrences.

**Phase 2 — Server-authoritative data layer**
Move every write to `createServerFn` with `requireSupabaseAuth`: bill CRUD, occurrence generation, manual payment, transactions, budgets. Zod validation server-side (amount > 0, finite, sane max; dates; enums). Client keeps reads via RLS.

**Phase 3 — Bill + recurring + overdue engine**
Deterministic occurrence generator (month-end clamp, leap years, end dates, pause/skip), overdue derived from date at query time, occurrence actions: pay, mark paid manually (real transaction, `payment_method='manual'`), skip, pause, delete-with-confirm.

**Phase 4 — Money engine**
Income/expense/transfer/refund transactions, transfers excluded from spending, budgets with spent/remaining/status thresholds, derived Available balance, Upcoming bills, Safe-to-spend, Daily safe-spend — all computed from rows, no constants.

**Phase 5 — Payments (needs your provider decision)**
`payment_orders` / `payment_attempts` / `payment_events`, idempotency keys, server-side order creation, signature verification, `/api/public/payments/webhook` with replay protection and event dedup, reconciliation job. Bill flips to paid only on trusted state; uncertainty renders "Payment verification pending".

**Phase 6 — Transactions, insights, export**
Paginated + debounced-search transaction list with filters and detail view; deterministic insights (month-over-month, category deltas, recurring commitment total, next-7-days obligations); real CSV/JSON export from the DB.

**Phase 7 — Settings, notifications, account deletion**
Every settings surface backed by a row, notification records + preference gating, scheduled jobs (reminders, overdue refresh, occurrence generation, reconciliation) — all idempotent, real account deletion via privileged server function.

**Phase 8 — Admin, hardening, tests**
Role-gated `/admin` (server-side `has_role`), audit logging, accessibility + performance pass, and a Vitest suite covering the money math, recurrence dates, overdue rules, payment state machine, and RLS cross-user isolation.

## How I'll report

After each phase: what's done, files changed, DB changes, security changes, tests, known issues, blockers. No phase gets called complete on an unverified claim.

## Scope note

This is many days of work compressed into a queue. I'll run it phase by phase and stop for your input at Phase 5 (payment provider) — tell me if you'd rather reorder or cut anything (e.g. skip Admin).
