import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Lightbulb } from "lucide-react";
import { BUDGET_STATUS_STYLES } from "@/components/BudgetCard";
import { getInsights, type InsightsPayload } from "@/lib/insights.functions";
import {
  INSIGHT_RANGES,
  INSIGHT_RANGE_LABELS,
  buildInsights,
  type InsightRangeKey,
} from "@/lib/insights";
import { moneyCategory } from "@/lib/categories";
import { classifyError } from "@/lib/errors";
import { formatAmount, formatAmountShort, formatDate } from "@/lib/format";
import { useFinanceSync } from "@/lib/finance-sync";
import { SpendingDonutChart } from "@/components/insights/SpendingDonutChart";
import { MonthlyBarChart } from "@/components/insights/MonthlyBarChart";

const TONE_STYLES = {
  neutral: { bg: "#EEE5F5", color: "#4B1D3F" },
  positive: { bg: "#E7F5EF", color: "#1F7053" },
  warning: { bg: "#FFF3DF", color: "#9C6318" },
  danger: { bg: "#FCEAED", color: "#A73A4C" },
} as const;

export function InsightsPage() {
  const fetchInsights = useServerFn(getInsights);
  const [range, setRange] = useState<InsightRangeKey>("this_month");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const payload = (await fetchInsights({
        data: {
          range,
          from: range === "custom" ? custom.from || null : null,
          to: range === "custom" ? custom.to || null : null,
        },
      })) as InsightsPayload;
      setData(payload);
      setError(null);
    } catch (e) {
      setError(classifyError(e).message);
    } finally {
      setLoading(false);
    }
  }, [fetchInsights, range, custom.from, custom.to]);

  useEffect(() => {
    void load();
  }, [load]);
  useFinanceSync(load);

  const cards = useMemo(() => {
    if (!data) return [];
    return buildInsights({
      comparison: data.comparison,
      categories: data.categories,
      obligations: data.obligations,
      commitmentsTotal: data.commitments.total,
      budgets: data.budgets.map((b) => ({
        name: b.name,
        percentageUsed: b.progress.percentageUsed,
        status: b.progress.status,
      })),
      safe: data.safe,
      currency: (value) => formatAmount(value),
    });
  }, [data]);

  const donutData = useMemo(() => {
    if (!data?.categories?.length) return [];
    const total = data.categories.reduce((acc, c) => acc + c.amount, 0);
    if (total <= 0) return [];
    return data.categories.map((c, i) => {
      const meta = moneyCategory(c.category);
      return {
        category: meta?.label || c.category,
        amount: c.amount,
        color:
          (meta?.color ??
            ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"][i % 6]) as string,
        percentage: (c.amount / total) * 100,
      };
    });
  }, [data?.categories]);

  const monthlyBarData = useMemo(() => {
    if (!data) return [];
    return [
      {
        month: "Previous",
        income: data.comparison.previous.income,
        expenses: data.comparison.previous.spending,
      },
      {
        month: "Current",
        income: data.comparison.current.income,
        expenses: data.comparison.current.spending,
      },
    ];
  }, [data]);

  if (error) {
    return (
      <div role="alert" className="card p-5">
        <p className="text-sm font-medium text-error">{error}</p>
        <button className="btn btn-secondary mt-3 !min-h-10 !text-xs" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="card h-32 animate-pulse" aria-busy="true" />
        <div className="card h-48 animate-pulse" />
      </div>
    );
  }

  const { cashFlow, categories, obligations, commitments, safe, forecast, budgets } = data;
  const topCategories = categories.slice(0, 5);
  const currentScenario = forecast.scenarios.find((s) => s.key === "current");

  return (
    <section className="animate-fade-in space-y-6">
      <header>
        <h1 className="text-xl font-bold text-text-primary">Insights</h1>
        <p className="text-sm text-text-secondary">
          Calculated from your recorded transactions and bills — {formatDate(data.range.from)} to{" "}
          {formatDate(data.range.to)}.
        </p>
      </header>

      {/* Period selection */}
      <div className="flex flex-wrap gap-2">
        {INSIGHT_RANGES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            aria-pressed={range === key}
            className="min-h-11 rounded-full border px-3.5 text-xs font-semibold transition-colors"
            style={
              range === key
                ? { backgroundColor: "#EEE5F5", borderColor: "#4B1D3F", color: "#4B1D3F" }
                : {
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border-light)",
                    color: "var(--text-secondary)",
                  }
            }
          >
            {INSIGHT_RANGE_LABELS[key]}
          </button>
        ))}
      </div>
      {range === "custom" ? (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            aria-label="From date"
            className="input-field !min-h-11"
            value={custom.from}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
          />
          <input
            type="date"
            aria-label="To date"
            className="input-field !min-h-11"
            value={custom.to}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
          />
        </div>
      ) : null}

      {/* Overview */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Overview</h2>
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-text-tertiary">
          {safe.isShortfall ? "Shortfall" : "Safe to spend"}
        </p>
        <p
          className="text-[32px] font-extrabold leading-tight tabular-nums"
          style={{ color: safe.isShortfall ? "#A73A4C" : "#1F7053" }}
        >
          {safe.isShortfall ? formatAmount(safe.shortfall) : formatAmount(safe.amount)}
        </p>
        <p className="text-sm text-text-secondary">
          {safe.isShortfall
            ? `You're ${formatAmount(safe.shortfall)} short of your upcoming obligations.`
            : `${formatAmount(safe.perDay)} per day for the remaining ${safe.daysRemaining} day${safe.daysRemaining === 1 ? "" : "s"} of this month.`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-tertiary">Available balance</dt>
            <dd className="font-semibold text-text-primary">{formatAmount(safe.available)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Reserved for bills</dt>
            <dd className="font-semibold text-text-primary">{formatAmount(safe.reserved)}</dd>
          </div>
        </dl>
      </div>

      {/* Insight cards */}
      {cards.length > 0 ? (
        <div className="space-y-2">
          {cards.map((card) => (
            <p
              key={card.id}
              className="rounded-2xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: TONE_STYLES[card.tone].bg, color: TONE_STYLES[card.tone].color }}
            >
              {card.text}
            </p>
          ))}
        </div>
      ) : null}

      {data.hints.length > 0 ? (
        <div className="card p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
            <Lightbulb className="h-4 w-4" aria-hidden="true" /> Unlock more insight
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
            {data.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Cash flow */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Cash flow</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-tertiary">Income</dt>
            <dd className="font-bold tabular-nums text-text-primary">{formatAmount(cashFlow.income)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Expenses</dt>
            <dd className="font-bold tabular-nums text-text-primary">{formatAmount(cashFlow.expenses)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Bills</dt>
            <dd className="font-bold tabular-nums text-text-primary">
              {formatAmount(cashFlow.billPayments)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Net flow</dt>
            <dd
              className="font-bold tabular-nums"
              style={{ color: cashFlow.net >= 0 ? "#1F7053" : "#A73A4C" }}
            >
              {cashFlow.net >= 0 ? "+" : "−"}
              {formatAmount(Math.abs(cashFlow.net))}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-text-tertiary">
          Transfers ({formatAmount(cashFlow.transfers)}) move money between your own places and stay
          net-neutral. Refunds counted: {formatAmount(cashFlow.refunds)}.
        </p>

        {cashFlow.count === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No completed transactions in this period.
          </p>
        ) : (
          <>
            <table className="sr-only">
              <caption>Cash flow for the selected period</caption>
              <tbody>
                <tr>
                  <th scope="row">Income</th>
                  <td>{formatAmount(cashFlow.income)}</td>
                </tr>
                <tr>
                  <th scope="row">Expenses</th>
                  <td>{formatAmount(cashFlow.expenses)}</td>
                </tr>
                <tr>
                  <th scope="row">Bills</th>
                  <td>{formatAmount(cashFlow.billPayments)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 h-44 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { label: "Income", value: cashFlow.income },
                    { label: "Expenses", value: cashFlow.expenses },
                    { label: "Bills", value: cashFlow.billPayments },
                  ]}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEAEF" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => formatAmountShort(v)} width={56} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                    {["#1F7053", "#A73A4C", "#5E3A70"].map((color) => (
                      <Cell key={color} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>

        )}
      </div>

      {/* Comparison */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary mb-3">Compared with the previous period</h2>
        <div className="mb-4">
          <MonthlyBarChart data={monthlyBarData} />
        </div>
        {data.comparison.reliable ? (
          <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
            <li>
              Spending{" "}
              <span className="font-semibold text-text-primary">
                {data.comparison.spendingChange >= 0 ? "up" : "down"}{" "}
                {formatAmount(Math.abs(data.comparison.spendingChange))}
              </span>{" "}
              ({formatAmount(data.comparison.previous.spending)} →{" "}
              {formatAmount(data.comparison.current.spending)})
            </li>
            <li>
              Income{" "}
              <span className="font-semibold text-text-primary">
                {data.comparison.incomeChange >= 0 ? "up" : "down"}{" "}
                {formatAmount(Math.abs(data.comparison.incomeChange))}
              </span>
              {data.comparison.incomePercent !== null
                ? ` (${data.comparison.incomePercent}%)`
                : ""}
            </li>
          </ul>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            Not enough historical data for a reliable comparison.
          </p>
        )}
      </div>

      {/* Spending by category */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary mb-3">Top spending categories</h2>
        {topCategories.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">
            No completed spending recorded in this period.
          </p>
        ) : (
          <>
            <div className="mb-6">
              <SpendingDonutChart data={donutData} />
            </div>
            <ul className="mt-3 space-y-3">
            {topCategories.map((row) => {
              const meta = moneyCategory(row.category);
              return (
                <li key={row.category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <meta.icon className="h-4 w-4" style={{ color: meta.color }} aria-hidden="true" />
                      {meta.label}
                    </span>
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatAmount(row.amount)} · {row.share}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-lilac/40">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.share}%`, backgroundColor: meta.color }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {row.previousAmount === 0
                      ? "No spending in the previous period"
                      : `${row.change >= 0 ? "+" : "−"}${formatAmount(Math.abs(row.change))} vs previous period${
                          row.changePercent !== null ? ` (${row.changePercent}%)` : ""
                        }`}
                  </p>
                </li>
              );
            })}
            </ul>
          </>
        )}
        {categories.length > 5 ? (
          <p className="mt-3 text-xs text-text-tertiary">
            {categories.length - 5} more categories with recorded spending.
          </p>
        ) : null}
      </div>

      {/* Budgets */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-text-primary">Budgets</h2>
          <Link to="/money/budgets" className="text-xs font-semibold text-primary">
            Manage
          </Link>
        </div>
        {budgets.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">
            Create a budget to track category spending.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {budgets.map((budget) => {
              const style = BUDGET_STATUS_STYLES[budget.progress.status];
              return (
                <li key={budget.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-text-primary">{budget.name}</span>
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatAmount(budget.progress.spent)} / {formatAmount(budget.progress.budget)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-lilac/40">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, budget.progress.percentageUsed)}%`,
                        backgroundColor: style.color,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: style.color }}>
                    {style.label} · {budget.progress.percentageUsed}% used
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Bills */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Bills & commitments</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-tertiary">Overdue</dt>
            <dd className="font-bold text-text-primary">
              {formatAmount(obligations.overdue.amount)} · {obligations.overdue.count}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Due today</dt>
            <dd className="font-bold text-text-primary">
              {formatAmount(obligations.dueToday.amount)} · {obligations.dueToday.count}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Next 7 days</dt>
            <dd className="font-bold text-text-primary">
              {formatAmount(obligations.next7.amount)} · {obligations.next7.count}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Next 30 days</dt>
            <dd className="font-bold text-text-primary">
              {formatAmount(obligations.next30.amount)} · {obligations.next30.count}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Largest obligation</dt>
            <dd className="font-bold text-text-primary">{formatAmount(obligations.highest)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Recurring / month</dt>
            <dd className="font-bold text-text-primary">{formatAmount(commitments.total)}</dd>
          </div>
        </dl>
        {commitments.items.length > 0 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-text-secondary">
            {commitments.items.slice(0, 5).map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.title} <span className="text-text-tertiary">({item.repeat})</span>
                </span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatAmount(item.monthly)}/mo
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">
            Add recurring bills to see your monthly commitments.
          </p>
        )}
      </div>

      {/* Forecast */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Forecast</h2>
        {!forecast.sufficient || !currentScenario ? (
          <p className="mt-2 text-sm text-text-secondary">
            Not enough data to create a reliable projection.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-text-tertiary">
              Projection based on your recorded financial activity. {forecast.basis}
            </p>
            <table className="sr-only">
              <caption>Projected balance by month for each scenario</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  {forecast.scenarios.map((s) => (
                    <th key={s.key} scope="col">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentScenario.balances.map((point, index) => (
                  <tr key={point.month}>
                    <th scope="row">Month +{point.month}</th>
                    {forecast.scenarios.map((s) => (
                      <td key={s.key}>{formatAmount(s.balances[index]?.balance ?? 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 h-52 w-full" aria-hidden="true">

              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={currentScenario.balances.map((point, index) => ({
                    month: `M+${point.month}`,
                    conservative: forecast.scenarios[0]?.balances[index]?.balance ?? 0,
                    current: point.balance,
                    optimistic: forecast.scenarios[2]?.balances[index]?.balance ?? 0,
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEAEF" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => formatAmountShort(v)} width={56} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Line type="monotone" dataKey="conservative" name="Conservative" stroke="#A73A4C" dot={false} />
                  <Line type="monotone" dataKey="current" name="Current trend" stroke="#4B1D3F" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="optimistic" name="Optimistic" stroke="#1F7053" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {forecast.scenarios.map((scenario) => (
                <li key={scenario.key} className="rounded-2xl bg-muted p-3">
                  <p className="font-semibold text-text-primary">
                    {scenario.label}:{" "}
                    {formatAmount(scenario.balances[scenario.balances.length - 1]?.balance ?? 0)} in{" "}
                    {scenario.balances.length} months
                  </p>
                  <p className="text-xs text-text-secondary">{scenario.assumption}</p>
                  <p className="text-xs text-text-tertiary">
                    Monthly income {formatAmount(scenario.monthlyIncome)} · spending{" "}
                    {formatAmount(scenario.monthlySpend)} · net {formatAmount(scenario.monthlyNet)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}