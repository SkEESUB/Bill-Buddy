# BillBuddy — Smart Bill & Payment Manager

BillBuddy is a bright, mobile-first web app for tracking recurring and one-off
bills: when they're due, how much they cost, and what you've already paid.

## Features

- **Email OTP authentication** — passwordless sign-in with a 6-digit code,
  auto-focus/paste inputs, 60s resend cooldown and a 5-minute expiry timer.
- **Dashboard** — greeting hero with total upcoming amount, overdue total,
  bills due this week and a monthly budget progress bar.
- **Bill management** — create, edit and delete bills with category icons,
  recurring schedules, optional UPI ID and notes; full form validation.
- **Search & filters** — debounced search across title/category/notes plus
  All / Overdue / This week / Paid filter chips.
- **Payments** — bottom-sheet confirmation with a "payment impact" insight,
  payment-method chips, UPI copy / deep link, and a success animation.
- **History** — payments grouped by month, date-range filters, expandable
  transaction details, receipt download and CSV export.
- **Analytics** — period selector, stat cards with period-over-period trends,
  a Recharts spending chart, category breakdown bars and auto-generated insights.
- **Settings** — profile, preferences, full data export and destructive
  "clear all bills" with confirmation.
- **Quality** — error boundary, toast notifications, skeleton loaders,
  offline detection, empty states, keyboard-accessible dialogs and
  reduced-motion support.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19 + TanStack Start (SSR) |
| Routing | TanStack Router (file-based, `src/routes`) |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 with semantic tokens in `src/styles.css` |
| Backend | Lovable Cloud (Postgres + Auth) with Row Level Security |
| Charts | Recharts |
| Icons | lucide-react |
| Toasts | sonner |

> React Router is not supported on this stack; TanStack Router provides the
> equivalent routing primitives.

## Project structure

```
src/
  components/   reusable UI (BillCard, modals, nav, error boundary, ui/*)
  pages/        page bodies rendered by routes
  routes/       file-based routes; `_authenticated/*` is session-gated
  lib/          api, formatting, categories, logging, export, test data
  hooks/        useAuth, useDebounced, use-mobile
  types/        Bill / Payment types plus the SQL schema reference
```

## Environment variables

Provisioned automatically by Lovable Cloud in `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Run locally

```bash
bun install
bun run dev      # http://localhost:8080
bun run build    # production build
bun run lint     # eslint + prettier
```

## Test mode

Append `?test=true` to the dashboard URL to reveal a developer panel that
generates 15 realistic sample bills, clears all data and prints live app state.
All auth / bill / payment actions are logged to the console with emoji prefixes.

## Security

- Row Level Security scopes every row to `auth.uid()`; users can only read and
  write their own bills and payments.
- No passwords or card data are stored — authentication is one-time-code based.
- Session tokens are handled by the Supabase client with auto-refresh.
- All routes except `/login` require an authenticated session.

## Known limitations

- PDF export is not implemented; exports are CSV.
- Notification and theme toggles in Settings are UI-only preferences.
- Recurring bills do not yet auto-regenerate the next occurrence after payment.
