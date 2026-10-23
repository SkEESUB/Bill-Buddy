# Engineering Rules, Standards & Guardrails — BillBuddy

**Document Version:** 1.0.0  
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
```

---

## 2. Git & Version Control Rules (Lovable Sync Protection)

The BillBuddy repository is actively synchronized with **Lovable's** deployment infrastructure. Breaking Git history causes catastrophic synchronization failures.

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
- **Fail-Fast Environment Loading:**
  ```typescript
  // REQUIRED: Fail immediately if required environment variable is missing
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xsytaixmyeypoiscfbim.supabase.co';
  if (!supabaseUrl) {
    throw new Error('[Supabase] Missing critical configuration: VITE_SUPABASE_URL');
  }
  ```
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
- Client components should not perform direct multi-table mutations or calculate complex financial run-rates.
- Use `createServerFn` for operations that:
  1. Modify financial balances or log payment histories across multiple tables.
  2. Require the administrative `SUPABASE_SERVICE_ROLE_KEY`.
  3. Aggregate sensitive user statistics across historical records.
- Server function inputs must be validated with Zod:
  ```typescript
  export const processBillPayment = createServerFn({ method: 'POST' })
    .validator((data: unknown) => paymentSchema.parse(data))
    .handler(async ({ data, context }) => {
      // Authenticated server execution
    });
  ```

### 4.3 Financial Math & Floating-Point Discipline
- JavaScript `Number` types suffer from IEEE 754 floating-point inaccuracies (e.g. `0.1 + 0.2 = 0.30000000000000004`).
- All currency calculations must either:
  1. Store monetary values in integer cents (e.g., `$10.50` = `1050`) before summing or splitting.
  2. Use dedicated rounding helpers (`roundCurrency(amount)`) from `src/lib/currency.ts`.
- In UI tables and metrics, always apply the Tailwind CSS class `tabular-nums`.

### 4.4 Date & Recurrence Handling
- Always store dates in ISO 8601 format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss.sssZ`).
- When computing next recurring due dates (e.g. monthly, bi-weekly), handle edge cases such as leap years, 31st-of-the-month rollovers, and daylight saving shifts using pure utility functions tested with Vitest.

---

## 5. UI & Styling Rules (Tailwind CSS v4 & Radix)

- **Use Design System Tokens:** Never use raw arbitrary hex colors (e.g. `bg-[#123456]`). Always use semantic Tailwind variables (`bg-card`, `text-primary`, `border-border`, `text-muted-foreground`).
- **Tabular Numbers:** Every visual representation of money, percentages, and counters MUST include `tabular-nums`.
- **Accessible Primitives:** Modals, tooltips, dropdowns, and sheet drawers must be built using Radix UI primitives (`@radix-ui/react-*`) to ensure keyboard accessibility and correct ARIA attributes.
- **Loading & Optimistic States:**
  - Buttons must show an inline spinner (`Loader2`) and maintain consistent width while asynchronous actions are pending.
  - Queries must leverage TanStack Query optimistic updates when marking items as paid or adding expenses.

---

## 6. Testing & Quality Assurance Standards

### 6.1 Unit & Integration Testing (Vitest)
- Run tests locally using `bun test` or `bun x vitest run`.
- **Mandatory Test Coverage Areas:**
  - Date and recurrence calculators (`src/lib/dates.test.ts`).
  - Currency conversion, formatting, and arithmetic utilities (`src/lib/currency.test.ts`).
  - Financial health score algorithms (`src/lib/health-score.test.ts`).
  - Auth token input validators and formatters.
- Every new financial feature or utility function must be accompanied by corresponding Vitest unit tests.

### 6.2 Pre-Push Verification Checklist
Before committing or pushing any change to the repository, ensure:
```bash
# 1. Typecheck passes with zero errors
bun x tsc --noEmit

# 2. Test suite passes completely (all 186+ tests)
bun test

# 3. Production build compiles cleanly
bun run build
```
