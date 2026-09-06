// src/components/insights/SpendingDonutChart.tsx
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format-currency";

export interface CategorySpend {
  category: string;
  amount: number;
  color: string;
  percentage: number;
}

export interface SpendingDonutChartProps {
  data: CategorySpend[];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="font-medium text-gray-900 dark:text-white text-sm">
        {item.name}
      </p>
      <p className="text-indigo-600 dark:text-indigo-400 font-bold">
        {formatCurrency(item.value)}
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-xs">
        {item.payload.percentage.toFixed(1)}% of total
      </p>
    </div>
  );
}

export function SpendingDonutChart({ data }: SpendingDonutChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        No spending data for this period
      </div>
    );
  }

  // Bucket small categories into "Other"
  const threshold = 3;
  const significant = data.filter((d) => d.percentage >= threshold);
  const other = data.filter((d) => d.percentage < threshold);

  const chartData = [...significant];
  if (other.length > 0) {
    chartData.push({
      category: "Other",
      amount: other.reduce((s, d) => s + d.amount, 0),
      color: "#94a3b8",
      percentage: other.reduce((s, d) => s + d.percentage, 0),
    });
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            animationBegin={0}
            animationDuration={600}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {chartData.map((item) => (
          <div key={item.category} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {item.category}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {formatCurrency(item.amount)}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
