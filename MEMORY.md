# Institutional Memory & Historical Decisions — BillBuddy

**Document Version:** 1.2.0  
**Status:** Living Document / Authoritative  
**Target Repository:** BillBuddy / Money Mind Frame  
**Authoritative Supabase Project:** `xsytaixmyeypoiscfbim`  
**Last Updated:** 2026-10-23  

---

## 1. Project Background & Genesis

BillBuddy was initiated to solve recurring personal expense management, subscription bloat, and cash-flow unpredictability. The codebase evolved from an initial rapid-prototype single-page application (previously branded as *BillBoard* under the Lovable builder environment) into an isomorphic full-stack SSR application on **TanStack Start**, **React 19**, and **Supabase PostgreSQL**.

---

## 2. Key Architectural Decisions & Pivots

### ADR-001: Migration to Full-Stack SSR with TanStack Start
- **Context:** Initial single-page client rendering suffered from slower initial contentful paint on mobile devices and exposed sensitive database queries directly in the client bundle.
- **Decision:** Transition to TanStack Start (`@tanstack/react-start`) with Vite 8 and the Nitro server engine.
- **Impact:** Enabled server functions (`createServerFn` in `src/lib/*.functions.ts`) to securely handle sensitive mutations, balance aggregations, and batch database actions via the Supabase Service Role client, while maintaining client-side SPA navigation via TanStack Router.

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
- **Context:** The project accumulated fragmented, out-of-order SQL scripts (`202608...`, etc.) that created race conditions and schema cache misses (`PGRST205: Could not find table in schema cache`) when deployed against fresh environments, alongside missing tables like `payment_orders`.
- **Decision:** Consolidate all 22 tables, RLS policies, custom PostgreSQL functions, triggers, and storage buckets into a single authoritative, idempotent migration script: [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql).
- **Impact:** The complete database catalog can be deployed idempotently in one operation without dependency errors.

### ADR-005: Strict Financial Invariant Enforcement
- **Context:** Multi-currency ledgers, partial bill payments, and duplicate checkout submissions can easily compromise financial truth if not strictly constrained.
- **Decision:** Enforce four financial invariants via code and database constraints:
  1. Occurrence settlement and single-payment guarantee: Payment orders cannot leave `CAPTURED` except via explicit refunds.
  2. Transaction idempotency via unique `(user_id, client_request_id)` constraints.
  3. Active payment locks: Only one active payment order permitted per bill occurrence at any time.
  4. Append-only reversals: Reversals create offsetting rows linked to the original transaction without deleting historical data.

### ADR-006: Server Function Modernization to `.validator()`
- **Context:** TanStack Start deprecated `.inputValidator()` in favor of `.validator()`, causing 50+ compilation warnings across Vite build chunks.
- **Decision:** Refactored all 12 server function modules in `src/lib/*.functions.ts` to use `.validator()`.
- **Impact:** Clean, warning-free production builds and strict input parsing before server handler execution.

---

## 3. Critical Bug Fixes & Post-Mortems

### Post-Mortem 001: The Ghost Supabase Endpoint Crash (`ERR_NAME_NOT_RESOLVED`)
- **Symptoms:** Production login threw `POST https://ocajeyatrckazoxavvgg.supabase.co/auth/v1/otp net::ERR_NAME_NOT_RESOLVED`.
- **Root Cause:** Hardcoded strings in legacy environment fallback handlers in `src/integrations/supabase/client.ts` referenced an old, deleted Supabase project ID instead of reading the active environment configuration.
- **Resolution:** Removed all hardcoded fallbacks and rerouters; anchored both browser and server Supabase clients strictly to `xsytaixmyeypoiscfbim.supabase.co`.

### Post-Mortem 002: PostgREST Schema Cache Miss (`PGRST205`) & Missing `payment_orders`
- **Symptoms:** After successful 6-digit OTP login, navigating to Account & Profile showed `Failed to load profile: Could not find the table 'public.profiles' in the schema cache`, and creating indexes failed because `public.payment_orders does not exist`.
- **Root Cause:** Live read-only probe of `xsytaixmyeypoiscfbim.supabase.co/rest/v1/*` confirmed that none of the application tables (`profiles`, `bills`, `payment_orders`, etc.) exist in the remote database catalog, and storage buckets (`avatars`, `receipts`) return `NoSuchBucket`. The live Supabase instance was never migrated.
- **Resolution:** Formulated the safe, idempotent consolidated script [`supabase/migrations/001_billbuddy_schema.sql`](file:///c:/Users/EESUB/Downloads/Bill%20Buddy/supabase/migrations/001_billbuddy_schema.sql) and documented the exact execution procedure.

---

## 4. Third-Party Integrations & Platform Constraints

### 4.1 Lovable Platform Synchronization
- The repository is connected to Lovable's automated continuous deployment infrastructure.
- **Hard Rule:** Never force-push (`git push --force`) or rewrite public Git history on `main`. Lovable uses Git commit hashes to reconcile project evolution; rewriting history breaks Lovable's editor sync.

### 4.2 Supabase PostgreSQL RLS Constraints
- All application queries executed from browser clients are evaluated against PostgreSQL Row-Level Security.
- If a query fails silently or returns an empty array, inspect the table's RLS policy: ensuring `user_id = auth.uid()` is satisfied and the user's session cookie is active.
