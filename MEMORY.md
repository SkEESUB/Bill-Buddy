# Institutional Memory & Historical Decisions — BillBuddy

**Document Version:** 1.0.0  
**Status:** Living Document / Authoritative  
**Target Repository:** BillBuddy / Money Mind Frame  
**Last Updated:** 2026-10-23  

---

## 1. Project Background & Genesis

BillBuddy was initiated to solve recurring personal expense management, subscription bloat, and cash-flow unpredictability. The codebase evolved from an initial rapid-prototype single-page application (previously branded as *BillBoard* under the Lovable builder environment) into an isomorphic full-stack SSR application on **TanStack Start**, **React 19**, and **Supabase PostgreSQL**.

---

## 2. Key Architectural Decisions & Pivots

### ADR-001: Migration to Full-Stack SSR with TanStack Start
- **Context:** Initial single-page client rendering suffered from slower initial contentful paint on mobile devices and exposed sensitive database queries directly in the client bundle.
- **Decision:** Transition to TanStack Start (`@tanstack/react-start`) with Vite 8 and the Nitro server engine.
- **Impact:** Enabled server functions (`createServerFn`) to securely handle sensitive mutations, balance aggregations, and batch database actions via the Supabase Service Role client, while maintaining client-side SPA navigation via TanStack Router.

### ADR-002: Transition to 6-Digit Email OTP Authentication
- **Context:** Previous authentication relied on email magic links. In practice, clicking magic links opened separate browser windows or default external mail client webviews, breaking established sessions and occasionally redirecting to legacy staging domains.
- **Decision:** Shift exclusively to **6-digit email OTP** codes via `supabase.auth.signInWithOtp` and `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
- **Impact:** Eliminates cross-browser redirect failures; authentication completes entirely within the user's active session tab.

### ADR-003: Consolidation to Single Authoritative Supabase Project
- **Context:** During rapid development cycles and environment syncs, ghost Supabase project credentials (specifically `ocajeaytrcakzoxavvvg` and `ocajeyatrckazoxavvgg`) contaminated environment variables and production bundles, leading to `ERR_NAME_NOT_RESOLVED` network crashes.
- **Decision:** Identify the authoritative database directly from the live Supabase dashboard and completely purge all references to ghost projects.
- **Authoritative Configuration:**
  - **Project ID:** `xsytaixmyeypoiscfbim`
  - **Supabase URL:** `https://xsytaixmyeypoiscfbim.supabase.co`
- **Impact:** Exactly one clean Supabase client initialization in `src/integrations/supabase/client.ts` and one server client in `src/integrations/supabase/client.server.ts`. Zero fallback rerouting or ghost projects.

### ADR-004: Consolidation of Database Migrations into Single Master Script
- **Context:** The project accumulated fragmented, out-of-order SQL scripts (`000_core_schema.sql`, `001_initial_schema.sql`, `002_finance_functions.sql`, etc.) that created race conditions and schema cache misses (`PGRST205: Could not find table in schema cache`).
- **Decision:** Consolidate all 22 tables, RLS policies, custom PostgreSQL functions, triggers, and storage buckets into a single authoritative, idempotent migration script: [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql).
- **Impact:** Developers and CI environments can spin up the entire database schema in a single execution without dependency conflicts.

---

## 3. Critical Bug Fixes & Post-Mortems

### Post-Mortem 001: The Ghost Supabase Endpoint Crash (`ERR_NAME_NOT_RESOLVED`)
- **Symptoms:** Production login threw `POST https://ocajeyatrckazoxavvgg.supabase.co/auth/v1/otp net::ERR_NAME_NOT_RESOLVED` and console warned of deprecated ghost project publishable keys.
- **Root Cause:** Hardcoded strings in legacy environment fallback handlers in `src/integrations/supabase/client.ts` referenced an old, deleted Supabase project ID instead of reading the active environment configuration.
- **Resolution:** Removed all hardcoded fallbacks and rerouters; anchored both browser and server Supabase clients strictly to `xsytaixmyeypoiscfbim.supabase.co`.
- **Lesson Learned:** Never inject hardcoded secondary project fallbacks into client source files. If an environment variable is missing, fail fast with a descriptive error.

### Post-Mortem 002: PostgREST Schema Cache Miss (`PGRST205`)
- **Symptoms:** After successful 6-digit OTP login, navigating to Account & Profile showed `Failed to load profile: Could not find the table 'public.profiles' in the schema cache`, and Home/Bills showed `Service temporarily unavailable`.
- **Root Cause:** The authoritative Supabase project (`xsytaixmyeypoiscfbim`) had not yet had the full database schema migration executed on its live PostgreSQL instance. The application code correctly targeted the project, but the remote database catalog was empty.
- **Resolution:** Formulated the consolidated idempotent migration script [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) containing all 22 tables and triggers, documented the requirement to execute it in the Supabase SQL editor, and added graceful error boundary cards in the UI.

---

## 4. Third-Party Integrations & Platform Constraints

### 4.1 Lovable Platform Synchronization
- The repository is connected to Lovable's automated continuous deployment infrastructure.
- **Hard Rule:** Never force-push (`git push --force`) or rewrite public Git history on `main`. Lovable uses Git commit hashes to reconcile project evolution; rewriting history breaks Lovable's editor sync.

### 4.2 Supabase PostgreSQL RLS Constraints
- All application queries executed from browser clients are evaluated against PostgreSQL Row-Level Security.
- If a query fails silently or returns an empty array, inspect the table's RLS policy: ensuring `user_id = auth.uid()` is satisfied and the user's session cookie is active.

---

## 5. Deprecated Patterns & What NOT to Do

1. **DO NOT reintroduce magic-link authentication:**
   - Always enforce 6-digit OTP codes. Do not configure email templates to send redirect links.
2. **DO NOT use multiple Supabase client instances:**
   - Always import the shared singleton client from `src/integrations/supabase/client.ts` in browser code, or `client.server.ts` in server functions. Never call `createClient()` inline inside React components.
3. **DO NOT store financial calculations in floating-point client state:**
   - Currency totals and budget variances must use integer cents or decimal strings with explicit rounding utilities (`src/lib/currency.ts`) to avoid JavaScript floating-point drift (e.g., `0.1 + 0.2 === 0.30000000000000004`).
4. **DO NOT bypass server functions for multi-table financial operations:**
   - Direct client mutations across multiple tables (e.g., confirming a bill payment and writing to payment history) risk orphaned records if the client disconnects midway. Use transactional server functions or PostgreSQL RPCs.
