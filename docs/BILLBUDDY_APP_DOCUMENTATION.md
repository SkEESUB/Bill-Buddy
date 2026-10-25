# BillBuddy — Comprehensive Application Documentation

## 1. Overview & Vision

**BillBuddy** is a modern, high-performance personal finance and bill-management web application. It combines automated recurring bill scheduling, one-tap UPI payments, real-time cash flow runway calculations, intelligent spending budgets, and full ledger tracking into an elegant, distraction-free fintech interface.

---

## 2. Technology Stack

- **Framework**: TanStack Start (SSR + Server Functions) with TanStack Router
- **Runtime**: Bun & Node.js
- **Styling**: Tailwind CSS v4 with custom semantic fintech tokens
- **Data Layer**: Supabase (PostgreSQL 15, Auth, Row-Level Security, Storage, Realtime)
- **State & Caching**: `@tanstack/react-query` v5 with server-authoritative mutations
- **Payment & Reconciliation**: Razorpay UPI integration with webhook HMAC verification and idempotency

---

## 3. Design System & Tokens (`src/styles.css`)

The interface replaces heavy neumorphism with a crisp modern fintech aesthetic:

- **Surfaces & Borders**: Subtle 1px borders (`border-border-light`), flat surfaces, and refined elevation shadows (`shadow-card`, `shadow-card-hover`).
- **Color Palette**:
  - **Light Mode**:
    - Background: `#f8fafc` (Slate 50)
    - Surface: `#ffffff` (Pure White)
    - Primary: `#4f46e5` (Indigo 600)
    - Success/Income: `#10b981` (Emerald 500)
    - Warning/Due Soon: `#f59e0b` (Amber 500)
    - Danger/Overdue/Expense: `#f43f5e` (Rose 500)
    - Text: `#0f172a` (High-contrast Slate 900)
  - **Dark Mode**:
    - Background: `#090d16` (Deep Charcoal Navy)
    - Surface: `#0f172a` (Refined Slate 900)
    - Primary: `#818cf8` (Indigo 400)
    - Text: `#f8fafc` (Slate 50)
- **Component Geometry**: Ergonomic 42px buttons, 44px input fields, 14px container radii.

---

## 4. Information Architecture & Navigation

### Global Top Navigation (`src/components/TopNav.tsx`)

- **Left**: BillBuddy branding with violet icon mark and bold wordmark.
- **Center (Desktop)**: Primary links: `Home`, `Bills`, `Money`, `Goals`, `Insights`.
- **Right**:
  - Notification Bell with unread count and real-time alerts.
  - **UserMenu (`src/components/UserMenu.tsx`)**: Interactive avatar dropdown containing profile details, direct links to Profile, Settings, Admin (if admin), Theme Switcher (Light/Dark/Auto), and Sign Out. The misplaced header signout button has been permanently relocated inside this menu.

### Mobile Bottom Dock (`src/components/BottomNav.tsx`)

A 5-item dock optimized for mobile ergonomics with safe-area bottom padding:

1. `Home` (`/`): Dashboard summary, safe to spend, upcoming bills.
2. `Bills` (`/bills`): Full bill list with status filters (Upcoming, Soon, Overdue, Paid).
3. `+` **Quick Add**: Center floating button triggering `QuickAddModal` ("New Bill", "Record Expense", "Record Income").
4. `Money` (`/money`): Integrated cash flow, category budgets, and financial ledger.
5. `Profile` (`/profile`): Comprehensive profile, financial defaults, and account security.

---

## 5. User Profile & Account System (`src/pages/ProfilePage.tsx`)

The unified Profile & Account hub is organized into 4 cohesive tabs:

1. **Personal**:
   - Avatar management (upload via signed URL, change, remove photo, or initials fallback).
   - Full Name, read-only auth Email, Mobile Phone, and Default UPI ID.
2. **Financial Preferences**:
   - Primary Currency (INR, USD, EUR, GBP, CAD, AUD, JPY, SGD, AED).
   - Monthly Income & Starting Available Balance for cash flow projections.
   - Monthly Spending Budget Limit.
3. **Notification Preferences**:
   - Upcoming bill reminders, overdue alerts, payment confirmations, and weekly digest toggles.
4. **Security & Danger Zone**:
   - Password reset email trigger, active session indicators.
   - Permanent account deletion modal with strict `DELETE` confirmation.

---

## 6. Onboarding Flow (`src/routes/onboarding.tsx`, `src/pages/OnboardingPage.tsx`)

New users are automatically guided through a 3-step setup wizard before accessing the dashboard:

- **Step 1**: Personal greeting & Full Name.
- **Step 2**: Preferred currency & Estimated monthly income.
- **Step 3**: Optional first bill creation (or skip to explore).
- Persists `profiles.onboarding_completed = true` in the database.
- Authenticated route gate (`_authenticated/route.tsx`) redirects users who have not yet completed onboarding.

---

## 7. Money & Ledger Integration (`src/pages/MoneyPage.tsx`)

- Top segment switcher: `[ Overview & Budgets | Full Ledger & Transactions ]`.
- **Overview Tab**: Current balance, monthly income, monthly expenses, net savings rate, and category budget progress bars.
- **Ledger Tab**: Complete transaction table with search, type filter (Income, Expense, Transfer), category filter, payment method filter, date range picker, and CSV/JSON export.
- Backward-compatible `/transactions` route renders the ledger view seamlessly.
- Error boundary and domain error classifier prevent raw `PGRST205` or Postgres schema cache messages from leaking to users.

---

## 8. Security & Database Resilience

- **Server Functions**: Gated by `requireActiveAccount` middleware (`src/lib/auth/active-account.ts`), ensuring deactivated, suspended, or closed accounts cannot execute writes.
- **Row-Level Security (RLS)**: Strictly enforced on `bills`, `bill_occurrences`, `transactions`, `budgets`, `profiles`, `user_settings`, and `spending_goals`.
- **Audit Logging**: Sensitive changes (payments, user status changes) are recorded to `audit_logs` with credential scrubbing.
