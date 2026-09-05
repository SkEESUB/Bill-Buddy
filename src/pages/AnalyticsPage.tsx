import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getBills, getPayments, type PaymentWithBill } from "@/lib/api";
import { category } from "@/lib/categories";
import { addDays, formatAmount, MONTHS_SHORT, toDay } from "@/lib/format";
import { log, timed } from "@/lib/logger";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import type { Bill } from "@/types/database";

type Period = "month" | "last" | "3months" | "year";

const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "This Month" },
  { key: "last", label: "Last Month" },
  { key: "3months", label: "Last 3 Months" },
  { key: "year", label: "This Year" },
];

/** Inclusive [start, end] day-string window for the selected period. */
function periodRange(
  period: Period,
  now = new Date(),
): { start: string; end: string; prevStart: string; prevEnd: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = (yy: number, mm: number) => toDay(new Date(yy, mm, 1));
  const last = (yy: number, mm: number) => toDay(new Date(yy, mm + 1, 0));

  if (period === "month")
    return {
      start: first(y, m),
      end: last(y, m),
      prevStart: first(y, m - 1),
      prevEnd: last(y, m - 1),
    };
  if (period === "last")
    return {
      start: first(y, m - 1),
      end: last(y, m - 1),
      prevStart: first(y, m - 2),
      prevEnd: last(y, m - 2),
    };
  if (period === "3months")
    return {
      start: first(y, m - 2),
      end: last(y, m),
      prevStart: first(y, m - 5),
      prevEnd: last(y, m - 3),
    };
  return {
    start: first(y, 0),
    end: last(y, 11),
    prevStart: first(y - 1, 0),
    prevEnd: last(y - 1, 11),
  };
}

export function AnalyticsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PaymentWithBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [showAllCategories, setShowAllCategories] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, p] = await timed("load analytics", () => Promise.all([getBills(), getPayments()]));
      setBills(b);
      setPayments(p);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load analytics";
      log.error(message, e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = useMemo(() => {
    const { start, end, prevStart, prevEnd } = periodRange(period);
    const inWindow = (day: string, a: string, b: string) => day >= a && day <= b;

    const periodBills = bills.filter((b) => inWindow(b.due_date, start, end));
    const prevBills = bills.filter((b) => inWindow(b.due_date, prevStart, prevEnd));
    const periodPayments = payments.filter((p) => inWindow(p.payment_date, start, end));
    const prevPayments = payments.filter((p) => inWindow(p.payment_date, prevStart, prevEnd));

    const paidIds = new Set(payments.map((p) => p.bill_id));
    const totalPaid = periodPayments.reduce((s, p) => s + Number(p.amount), 0);
    const prevPaid = prevPayments.reduce((s, p) => s + Number(p.amount), 0);
    const totalUpcoming = periodBills
      .filter((b) => !paidIds.has(b.id))
      .reduce((s, b) => s + Number(b.amount), 0);
    const totalAmount = periodBills.reduce((s, b) => s + Number(b.amount), 0);
    const averageBill = periodBills.length ? totalAmount / periodBills.length : 0;
    const prevAverage = prevBills.length
      ? prevBills.reduce((s, b) => s + Number(b.amount), 0) / prevBills.length
      : 0;

    // Category breakdown across all bills in the period.
    const byCategory = new Map<string, number>();
    for (const b of periodBills) {
      byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + Number(b.amount));
    }
    const categories = [...byCategory.entries()]
      .map(([key, amount]) => ({
        key,
        amount,
        pct: totalAmount ? (amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Chart series: last 6 buckets of payment spending.
    const chart: { label: string; amount: number }[] = [];
    if (period === "year") {
      for (let i = 0; i < 12; i += 1) {
        const prefix = `${new Date().getFullYear()}-${String(i + 1).padStart(2, "0")}`;
        chart.push({
          label: MONTHS_SHORT[i]!,
          amount: payments
            .filter((p) => p.payment_date.startsWith(prefix))
            .reduce((s, p) => s + Number(p.amount), 0),
        });
      }
    } else {
      for (let i = 5; i >= 0; i -= 1) {
        const dayStart = toDay(addDays(new Date(), -((i + 1) * 7 - 1)));
        const dayEnd = toDay(addDays(new Date(), -(i * 7)));
        chart.push({
          label: i === 0 ? "This wk" : `-${i}w`,
          amount: payments
            .filter((p) => p.payment_date >= dayStart && p.payment_date <= dayEnd)
            .reduce((s, p) => s + Number(p.amount), 0),
        });
      }
    }

    const recurring = bills.filter((b) => b.is_recurring);
    const recurringMonthly = recurring
      .filter((b) => b.recurring_type === "monthly")
      .reduce((s, b) => s + Number(b.amount), 0);
    const priciest = [...periodBills].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    const trend = (current: number, previous: number) =>
      previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

    return {
      count: periodBills.length,
      countTrend: trend(periodBills.length, prevBills.length),
      averageBill,
      averageTrend: trend(averageBill, prevAverage),
      totalUpcoming,
      totalPaid,
      paidTrend: trend(totalPaid, prevPaid),
      categories,
      chart,
      recurringCount: recurring.length,
      recurringMonthly,
      priciest,
      hasData: bills.length > 0 || payments.length > 0,
    };
  }, [bills, payments, period]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const top = data.categories[0];
    if (top)
      list.push(
        `Your highest spending category is ${category(top.key).label} (${formatAmount(top.amount)}).`,
      );
    if (data.paidTrend !== null)
      list.push(
        `You paid ${Math.abs(data.paidTrend)}% ${data.paidTrend >= 0 ? "more" : "less"} than the previous period.`,
      );
    if (data.priciest)
      list.push(
        `Your most expensive bill is ${data.priciest.title} at ${formatAmount(Number(data.priciest.amount))}.`,
      );
    if (data.recurringCount > 0)
      list.push(
        `You have ${data.recurringCount} recurring bills totalling ${formatAmount(data.recurringMonthly)}/month.`,
      );
    return list;
  }, [data]);

  const visibleCategories = showAllCategories ? data.categories : data.categories.slice(0, 5);

  return (
    <section className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Analytics</h1>
        <select
          className="input-field !min-h-10 w-auto !text-xs"
          value={period}
          aria-label="Time period"
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div role="alert" className="card mt-4 p-4">
          <p className="text-sm font-medium text-error">{error}</p>
          <button className="btn btn-secondary mt-3 !min-h-10 !text-xs" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="mt-4">
          <BillListSkeleton count={4} />
        </div>
      ) : !data.hasData ? (
        <div className="mt-4">
          <EmptyState
            icon={BarChart3}
            title="Nothing to analyse yet"
            subtitle="Add bills and record payments to unlock insights."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard
              icon={ClipboardList}
              label="Total bills"
              value={String(data.count)}
              trend={data.countTrend}
            />
            <StatCard
              icon={Wallet}
              label="Average bill"
              value={formatAmount(data.averageBill)}
              trend={data.averageTrend}
            />
            <StatCard
              icon={Clock}
              label="Total upcoming"
              value={formatAmount(data.totalUpcoming)}
              tone="#C5822B"
            />
            <StatCard
              icon={CheckCircle2}
              label="Total paid"
              value={formatAmount(data.totalPaid)}
              tone="#278A63"
              trend={data.paidTrend}
            />
          </div>

          <div className="card mt-5 p-5">
            <h2 className="text-sm font-bold text-text-primary">Spending Over Time</h2>
            <table className="sr-only">
              <caption>Spending over time for the selected period</caption>
              <thead>
                <tr>
                  <th scope="col">Time Period</th>
                  <th scope="col">Paid Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.chart.map((point) => (
                  <tr key={point.label}>
                    <th scope="row">{point.label}</th>
                    <td>{formatAmount(point.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 h-56 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8E6FA8" />
                      <stop offset="100%" stopColor="#4B1D3F" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-light)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--text-tertiary)"
                    dy={4}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--text-tertiary)"
                    width={54}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(75,29,63,0.07)" }}
                    formatter={(value: number) => [formatAmount(value), "Paid"]}
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid var(--border-light)",
                      fontSize: 12,
                      boxShadow: "0 12px 30px -12px rgba(15,23,42,0.3)",
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    fill="url(#barFill)"
                    radius={[10, 10, 4, 4]}
                    maxBarSize={38}
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card mt-5 p-5">
            <h2 className="text-sm font-bold text-text-primary">Spending by Category</h2>
            {visibleCategories.length === 0 ? (
              <p className="mt-3 text-sm text-text-secondary">No bills in this period.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {visibleCategories.map((row) => {
                  const cat = category(row.key);
                  return (
                    <li key={row.key}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-text-primary">{cat.label}</span>
                        <span className="font-mono font-semibold text-text-primary">
                          {formatAmount(row.amount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="neu-inset h-2.5 flex-1 overflow-hidden rounded-full bg-lilac/40">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${row.pct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs text-text-secondary">
                          {Math.round(row.pct)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.categories.length > 5 ? (
              <button
                className="btn btn-secondary mt-4 w-full !min-h-10 !text-xs"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? "Show less" : `View all ${data.categories.length}`}
              </button>
            ) : null}
          </div>

          {insights.length > 0 ? (
            <div className="mt-5 space-y-3">
              <h2 className="text-sm font-bold text-text-primary">Insights</h2>
              {insights.map((text) => (
                <div key={text} className="card flex items-start gap-3 p-4">
                  <span className="text-lg" aria-hidden="true">
                    💡
                  </span>
                  <p className="text-sm text-text-secondary">{text}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: number | null;
  tone?: string;
}) {
  return (
    <div className="card card-hover p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {label}
      </p>
      <p
        className="mt-1.5 font-mono text-lg font-bold tabular-nums"
        style={{ color: tone ?? "var(--text-primary)" }}
      >
        {value}
      </p>
      {trend !== null && trend !== undefined ? (
        <p
          className="mt-0.5 text-xs font-medium"
          style={{ color: trend >= 0 ? "#278A63" : "#C94F62" }}
        >
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs previous
        </p>
      ) : null}
    </div>
  );
}
