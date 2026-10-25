# Engineering Rules, Standards & Guardrails — BillBuddy

**Document Version:** 1.1.0  
**Status:** Living Document / Authoritative  
**Target Repository:** BillBuddy / Money Mind Frame  
**Last Updated:** 2026-10-23

---

## 1. Core Engineering Commandments

These rules are non-negotiable. Every developer, automated agent, and contributor must strictly adhere to these standards when working on the BillBuddy codebase.

```
1. NEVER expose secrets or administrative service-role keys to browser client bundles.
2. NEVER rewrite, rebase, squash, or force-push Git commits on published branches.
3. NEVER reintroduce magic-link authentication or hardcoded fallback Supabase URLs.
4. NEVER perform multi-table financial balance mutations directly from the browser client.
5. ALWAYS write unit tests for financial math, date recurrence logic, and data transformers.
6. ALWAYS preserve TypeScript strict mode with zero typecheck or build errors.
7. NEVER weaken RLS policies or bypass authentication to hide errors.
```

---

## 2. Git & Version Control Rules (Production Protection)

The BillBuddy repository is actively synchronized with production deployment infrastructure. Breaking Git history causes catastrophic synchronization and deployment failures.

### 2.1 Git Commands & Behaviors

- **PROHIBITED:**
  - `git push --force` or `git push -f`
  - `git rebase` on any commit already pushed to `origin/main`
  - `git commit --amend` on any commit already pushed to `origin/main`
  - `git reset --hard` to an earlier remote commit
- **MANDATED:**
  - Always use standard forward commits: `git add . && git commit -m "feat/fix: descriptive message" && git push`
  - If a mistake is pushed, fix it forward with a new commit or use `git revert <commit-hash>`.
  - Maintain a clean working directory. Do not leave untracked temporary files or scratch scripts in production branches.

---

## 3. Security & Environment Configuration Rules

### 3.1 Supabase Configuration Integrity

- **Authoritative Project Endpoint:** All client and server initialization must target project `xsytaixmyeypoiscfbim` (`https://xsytaixmyeypoiscfbim.supabase.co`).
- **Zero Ghost Projects:** Any pull request, patch, or configuration containing references to `ocajeaytrcakzoxavvvg`, `ocajeyatrckazoxavvgg`, or other ghost projects will be rejected immediately.
- **Fail-Fast Environment Loading:** Fail immediately if `VITE_SUPABASE_URL` is unconfigured.
- **Secret Isolation Boundary:**
  - Browser bundles: May consume only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`).
  - Server runtime: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to `src/integrations/supabase/client.server.ts` and Nitro server functions. Never prefix server secret variables with `VITE_`.

### 3.2 Database Security (RLS)

- Every table created in PostgreSQL must execute `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`.
- Default RLS policies must strictly enforce user ownership:
  ```sql
  CREATE POLICY "Users can only manage their own records"
    ON public.<table_name>
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  ```

---

## 4. Architecture & Coding Conventions

### 4.1 TypeScript & Type Safety

- The project runs in **strict mode** (`"strict": true` in `tsconfig.json`).
- **No `any` Types:** Use explicit interfaces or Zod schemas. If an external payload is unknown, use `unknown` and validate with a parser before consumption.
- Keep database types aligned with `src/integrations/supabase/types.ts`.

### 4.2 TanStack Start & Server Functions

- Client components must not perform direct multi-table balance mutations.
- Use `createServerFn` in `src/lib/*.functions.ts` for operations that:
  1. Modify financial balances or log payment histories across multiple tables.
  2. Require the administrative `SUPABASE_SERVICE_ROLE_KEY`.
  3. Aggregate sensitive user statistics across historical records.
- Server function inputs must be validated with Zod schemas.

### 4.3 Financial Math & Invariants

- All monetary operations must adhere to the tested financial invariants:
  1. **Idempotency:** Require a unique `client_request_id` for each financial write.
  2. **Active Payment Lock:** At most one live `payment_order` per bill occurrence.
  3. **Reversal Immutability:** Append-only offsetting entries for cancellations or refunds.
  4. **Net-Neutral Transfers:** Transfers do not alter aggregate net worth.
- Use dedicated rounding helpers (`roundCurrency(amount)`) from `src/lib/currency.ts`.
- In UI tables and metrics, always apply the Tailwind CSS class `tabular-nums`.

---

## 5. Testing & Quality Assurance Standards

### 5.1 Unit & Integration Testing (Vitest / Bun Test)

- Run tests locally using `bun test` or `bun x vitest run`.
- **Mandatory Test Coverage Areas:**
  - Date and recurrence calculators (`src/lib/dates.test.ts`).
  - Financial invariants, idempotency, and payment locks (`src/lib/invariants.test.ts`).
  - Payment state machines (`src/lib/payments/state.test.ts`).
  - Auth hardening and account gates (`src/lib/auth/hardening.test.ts`).
  - Role-based permissions (`src/lib/admin/permissions.test.ts`).
  - Insights, forecasting, and safe-to-spend models (`src/lib/insights.test.ts`).

### 5.2 Pre-Push Verification Checklist

Before committing or pushing any change to the repository, ensure:

```bash
# 1. Typecheck passes with zero errors
bun x tsc --noEmit

# 2. Test suite passes completely (all 186+ tests)
bun test

# 3. Production build compiles cleanly
bun run build
```
