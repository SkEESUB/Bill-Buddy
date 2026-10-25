# BillBuddy — Master Changelog

## [2.1.0] — Modern Fintech Redesign, Account Hub & Navigation Polish

### 🎨 Design System & Visuals

- **Fintech Token Architecture**: Replaced heavy plum/purple neumorphism (`--neu-raised`, `--neu-inset`, 16px blur bevels) with a modern high-contrast fintech design token system in `src/styles.css`.
- **Surfaces & Borders**: Replaced multiple drop shadows with crisp 1px borders (`border-border-light`) and subtle elevation shadows (`shadow-card`).
- **Ergonomics**: Normalized button heights to 42px (down from 54px) and input heights to 44px for balanced desktop and mobile layouts.
- **Theme Support**: Seamless dark mode (`#090d16` charcoal/navy) and light mode (`#f8fafc` clean slate) with high-contrast text meeting WCAG AAA accessibility guidelines.

### 🧭 Global Navigation & Shell

- **TopNav Redesign (`src/components/TopNav.tsx`)**:
  - Compact 56px header with brand mark, desktop navigation links, and notification bell.
  - Removed misplaced header "Sign out" button.
  - Added **UserMenu (`src/components/UserMenu.tsx`)**: Interactive avatar dropdown menu providing quick access to Profile, Settings, Admin Console (for admin users), Theme switcher (Light/Dark/Auto), and Sign out.
- **Mobile Bottom Dock (`src/components/BottomNav.tsx`)**:
  - Replaced cluttered 6-item mobile bar with a clean 5-item dock: `Home`, `Bills`, `+ Quick Add`, `Money`, and `Profile`.
  - Added safe area padding (`safe-bottom`) for modern iOS and Android home indicator bars.
- **Quick Add Modal (`src/components/QuickAddModal.tsx`)**:
  - Added center floating action popup with one-tap access to "Add Bill", "Record Expense", and "Record Income".

### 👤 Profile & Account Hub (`src/pages/ProfilePage.tsx`)

- Transformed the profile view into a comprehensive personal account hub with 4 tabs:
  1. **Personal Information**: Avatar management (upload/change/remove or initials fallback), full name, read-only auth email, mobile number, and default UPI ID.
  2. **Financial Preferences**: Default currency selector (INR, USD, EUR, GBP, CAD, AUD, JPY, SGD, AED), monthly income, starting balance, and monthly spending budget limit.
  3. **Notification Preferences**: Toggles for upcoming bill reminders, overdue alerts, payment recorded confirmations, and weekly summary digest.
  4. **Security & Danger Zone**: Password reset email trigger, active session indicators, and permanent account deletion modal with strict `DELETE` confirmation.
- Persists changes to both `profiles` and `user_settings` tables with optimistic UI updates and toast confirmations.

### 🚀 Onboarding Experience (`src/pages/OnboardingPage.tsx`, `src/routes/onboarding.tsx`)

- Added a 3-step setup wizard for new users:
  - Step 1: Profile greeting & full name.
  - Step 2: Currency selection & baseline monthly income.
  - Step 3: Optional first bill creation with immediate due date and reminder setup.
- Persists `profiles.onboarding_completed = true` and `onboarding_step = 3`.
- Route gate in `src/routes/_authenticated/route.tsx` automatically redirects first-time users to onboarding.

### 📊 Dashboard & Information Architecture (`src/pages/HomePage.tsx`)

- Eliminated 4 redundant quick action cards (`Bills`, `Money`, `Insights`, `Add Bill`) that duplicated the primary navigation.
- Re-architected financial hierarchy:
  - Hero card: Greeting, "Safe to Spend this month" with daily allowance and budget utilization progress bar.
  - 4 Financial KPI cards: Available Balance, Income this month, Spent this month, Due This Week / Overdue.
  - Upcoming bills list with search and status filter chips.
  - Recent activity snapshot: Displays the latest 4 transactions with a direct link to the full ledger.
  - Hidden desktop speed-dial on mobile to prevent overlapping the mobile bottom dock.

### 💼 Money & Ledger Integration (`src/pages/MoneyPage.tsx`, `src/pages/TransactionsPage.tsx`)

- Added segment switcher in `MoneyPage.tsx`: `[ Overview & Budgets | Full Ledger & Transactions ]`.
- Integrated `TransactionsPage` as an embedded view within the Money tab, enabling unified budgeting and transaction auditing.
- Error resilience: Wrapped transaction and money loading in `toUserMessage` from `@/lib/errors`, preventing raw `PGRST205` or Postgres schema cache messages from displaying to users.

### ✅ Verification & Testing

- `bun test`: All 186 automated unit tests pass in 145ms.
- `bun x tsc --noEmit`: 0 TypeScript compiler errors.
- `bun run build`: Clean production build across all client and SSR Nitro server bundles.
