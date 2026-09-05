-- Ledger and settlement tables are written exclusively by validated server-side
-- code (service role). Revoke direct write privileges from signed-in sessions so
-- a stolen/valid token cannot fabricate a paid bill or a settled payment row
-- through the auto-generated data API. Reads stay RLS-scoped to the owner.
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bill_occurrences FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attachments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;

GRANT SELECT ON public.transactions TO authenticated;
GRANT SELECT ON public.bill_occurrences TO authenticated;
GRANT SELECT ON public.attachments TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.bill_occurrences TO service_role;
GRANT ALL ON public.attachments TO service_role;
GRANT ALL ON public.payments TO service_role;