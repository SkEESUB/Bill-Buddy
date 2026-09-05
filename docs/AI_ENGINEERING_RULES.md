# BILLBUDDY AI ENGINEERING RULES

1. Existing working functionality is presumed intentional.
2. Audit before changing.
3. Never rebuild working systems unnecessarily.
4. Never fake functionality.
5. Never fake payment confirmation.
6. Never bypass RLS.
7. Never restore browser financial writes.
8. Never use truncated lists for financial aggregates.
9. Server state is authoritative.
10. Financial history is append-preserving.
11. Reversals offset; they do not erase history.
12. Every financial mutation must be validated and authorized.
13. Every payment settlement must be provider-authoritative.
14. Idempotency is mandatory for retryable financial operations.
15. Security fixes must have regression tests.
16. Performance optimizations must preserve financial correctness.
17. Accessibility must be tested, not assumed.
18. Offline behavior must be explicit, not fabricated.
19. "Not verified" is a valid status.
20. Never claim production-ready without evidence.
