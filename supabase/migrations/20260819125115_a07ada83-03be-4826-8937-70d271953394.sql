CREATE OR REPLACE FUNCTION public.ledger_balance_delta()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(ROUND(SUM(
    CASE t.type
      WHEN 'income' THEN t.amount
      WHEN 'refund' THEN t.amount
      WHEN 'adjustment' THEN t.amount
      WHEN 'expense' THEN -t.amount
      WHEN 'bill_payment' THEN -t.amount
      ELSE 0
    END), 2), 0)
  FROM public.transactions t
  WHERE t.user_id = auth.uid() AND t.status = 'completed';
$$;

REVOKE ALL ON FUNCTION public.ledger_balance_delta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ledger_balance_delta() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ledger_balance_delta() TO service_role;