import { Loader2, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Group, SelectRow, Row, SettingsHeader, Toggle } from "@/components/settings/ui";
import { useAccount } from "@/hooks/useAccount";
import { usePreferences, timezoneOptions, type ThemeChoice } from "@/lib/preferences";
import { SUPPORTED_CURRENCIES, formatAmount, formatDateTime } from "@/lib/format";

const THEMES: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Theme, motion, currency and timezone — saved to the account, applied instantly. */
export function AppearanceSettingsPage() {
  const { settings, updateSettings, isLoading } = useAccount();
  const prefs = usePreferences();

  const save = async (patch: Parameters<typeof updateSettings>[0], optimistic: () => void) => {
    optimistic();
    try {
      await updateSettings(patch);
      toast.success("Saved");
    } catch {
      /* useAccount surfaces the error; refetch restores the stored value */
    }
  };

  if (isLoading && !settings) {
    return (
      <section className="animate-fade-in pb-8">
        <SettingsHeader title="Appearance & locale" />
        <div className="card flex items-center justify-center p-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader
        title="Appearance & locale"
        subtitle="These preferences follow your account on every device."
      />

      <Group title="Theme">
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const active = prefs.theme === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => void save({ theme: value }, () => prefs.apply({ theme: value }))}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-[13px] font-semibold transition-all cursor-pointer ${
                  active
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border-light text-text-secondary hover:border-primary/50"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-text-tertiary">
          Currently showing the {prefs.resolvedTheme} theme.
        </p>
      </Group>

      <Group title="Motion">
        <Row label="Reduce motion" hint="Turns off animations and transitions across the app.">
          <Toggle
            label="Reduce motion"
            checked={prefs.reducedMotion}
            onChange={(v) =>
              void save({ reduced_motion: v }, () => prefs.apply({ reducedMotion: v }))
            }
          />
        </Row>
      </Group>

      <Group title="Locale">
        <SelectRow
          label="Currency"
          hint={`Every amount is shown as ${formatAmount(1234.5)}`}
          value={prefs.currency}
          options={SUPPORTED_CURRENCIES.map((c) => ({
            value: c.code,
            label: `${c.code} — ${c.label}`,
          }))}
          onChange={(v) => void save({ currency: v }, () => prefs.apply({ currency: v }))}
        />
        <SelectRow
          label="Timezone"
          hint={`Now: ${formatDateTime(new Date().toISOString(), prefs.timezone)}`}
          value={prefs.timezone}
          options={timezoneOptions().map((z) => ({ value: z, label: z }))}
          onChange={(v) => void save({ timezone: v }, () => prefs.apply({ timezone: v }))}
        />
      </Group>
    </section>
  );
}