import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Group, NumberRow, SelectRow, SettingsHeader } from "@/components/settings/ui";
import { useAccount } from "@/hooks/useAccount";
import { bumpFinance } from "@/lib/finance-sync";

const PERIODS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

/** Income, balance and the defaults new budgets are created with. */
export function MoneySettingsPage() {
  const { settings, updateSettings, isLoading } = useAccount();

  const save = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
      bumpFinance();
      toast.success("Saved");
    } catch {
      /* error toast comes from useAccount */
    }
  };

  if (!settings) {
    return (
      <section className="animate-fade-in pb-8">
        <SettingsHeader title="Money & budgets" />
        <div className="card flex items-center justify-center p-10 text-text-secondary">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "No settings found."}
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader
        title="Money & budgets"
        subtitle="Used by safe-to-spend, forecasting and new budgets."
      />

      <Group title="Your money">
        <NumberRow
          label="Monthly income"
          hint="Expected take-home pay each month"
          value={Number(settings.monthly_income ?? 0)}
          onCommit={(v) => void save({ monthly_income: v })}
        />
        <NumberRow
          label="Monthly budget"
          hint="Overall spending ceiling"
          value={Number(settings.monthly_budget ?? 0)}
          onCommit={(v) => void save({ monthly_budget: v })}
        />
        <NumberRow
          label="Starting balance"
          hint="Opening balance the ledger builds on"
          value={Number(settings.starting_balance ?? 0)}
          min={-1_000_000_000}
          onCommit={(v) => void save({ starting_balance: v })}
        />
      </Group>

      <Group title="Budget defaults" description="Applied when you create a new budget.">
        <SelectRow
          label="Default period"
          value={String(settings.default_budget_period ?? "monthly")}
          options={PERIODS}
          onChange={(v) =>
            void save({
              default_budget_period: v as "weekly" | "monthly" | "quarterly" | "yearly" | "custom",
            })
          }
        />
        <NumberRow
          label="Warning at (%)"
          hint="Budget turns amber past this share"
          value={Number(settings.default_warn_threshold ?? 50)}
          min={1}
          onCommit={(v) => void save({ default_warn_threshold: v })}
        />
        <NumberRow
          label="Near limit at (%)"
          hint="Must be above the warning threshold"
          value={Number(settings.default_near_limit_threshold ?? 80)}
          min={2}
          onCommit={(v) => void save({ default_near_limit_threshold: v })}
        />
      </Group>
    </section>
  );
}