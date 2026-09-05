DO $$
DECLARE u uuid := '4ff07b3a-cac4-46b6-95c5-a684ea1a1bfb';
BEGIN
INSERT INTO public.bills (user_id, title, amount, category, due_date, is_recurring, recurring_type, repeat_type, notes)
SELECT u, 'PERFTEST Bill '||g, (200 + (g*37)%4000)::numeric, (ARRAY['electricity','water','internet','mobile','rent','gas','subscription','insurance','loan','other'])[1+(g%10)],
  (current_date - ((g%400))*interval '1 day')::date, true, 'monthly', 'monthly', 'PERFTEST'
FROM generate_series(1,40) g;

INSERT INTO public.bill_occurrences (bill_id, user_id, scheduled_date, expected_amount, status)
SELECT bl.id, u, (current_date - (n*7)*interval '1 day')::date, bl.amount,
  (ARRAY['upcoming','due_soon','overdue','paid','paid','skipped'])[1+(n%6)]
FROM public.bills bl CROSS JOIN generate_series(1,30) n
WHERE bl.user_id=u AND bl.notes='PERFTEST';

INSERT INTO public.transactions (user_id, type, amount, category, description, date, status, payment_method, source, external_reference, notes)
SELECT u,
  (ARRAY['expense','expense','expense','expense','income','bill_payment','transfer','refund'])[1+(g%8)],
  (50 + (g*13)%9500)::numeric,
  (ARRAY['food','transport','shopping','entertainment','health','education','other_expense','salary','freelance','investment'])[1+(g%10)],
  'PERFTEST entry '||g||' '||(ARRAY['coffee','uber ride','groceries','netflix','pharmacy','tuition','salary credit','gift'])[1+(g%8)],
  (current_date - ((g%720))*interval '1 day')::date,
  (ARRAY['completed','completed','completed','completed','completed','pending','failed'])[1+(g%7)],
  (ARRAY['upi','card','cash','netbanking'])[1+(g%4)],
  'manual', 'PERFTEST', 'PERFTEST'
FROM generate_series(1,12000) g;

INSERT INTO public.notifications (user_id, type, title, body, dedupe_key, read_at)
SELECT u, (ARRAY['bill_due','bill_overdue','payment_success','budget_warning','weekly_summary','insight'])[1+(g%6)],
  'PERFTEST notice '||g, 'PERFTEST body '||g, 'PERFTEST:'||g,
  CASE WHEN g%3=0 THEN now() ELSE NULL END
FROM generate_series(1,1500) g;

INSERT INTO public.budgets (user_id, name, category, amount, period, start_date, status)
SELECT u, 'PERFTEST Budget '||g, (ARRAY['food','transport','shopping','entertainment','health','education','other_expense'])[1+(g%7)],
  (2000 + (g*97)%20000)::numeric, 'monthly', (date_trunc('month', current_date) - (g||' month')::interval)::date,
  CASE WHEN g<=7 THEN 'active' ELSE 'archived' END
FROM generate_series(1,120) g;
END $$;