import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Group, Row, SettingsHeader } from "@/components/settings/ui";
import { useAccount } from "@/hooks/useAccount";
import { isValidUpiId } from "@/lib/upi";
import { toUserMessage } from "@/lib/errors";

/** Default UPI ID plus an honest read on the online-checkout status. */
export function PaymentSettingsPage() {
  const { overview, updateProfile, savingProfile, isLoading } = useAccount();
  const profile = overview?.profile as { default_upi_id: string | null } | null | undefined;
  const [upi, setUpi] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setUpi(profile?.default_upi_id ?? ""), [profile?.default_upi_id]);

  const save = async () => {
    const value = upi.trim();
    if (value && !isValidUpiId(value)) return setError("Use the name@bank format.");
    setError(null);
    try {
      await updateProfile({ default_upi_id: value || null });
      toast.success("Payment settings saved");
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Payments" subtitle="How bills get paid from BillBuddy." />

      {isLoading && !profile ? (
        <div className="card flex items-center justify-center p-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <Group title="UPI" description="Prefilled on new bills and the UPI payment sheet.">
            <input
              className="input-field"
              aria-label="Default UPI ID"
              placeholder="name@bank"
              autoCapitalize="none"
              spellCheck={false}
              value={upi}
              onChange={(e) => setUpi(e.target.value.trim())}
            />
            {error ? <p className="mt-1.5 text-[13px] text-error">{error}</p> : null}
            <p className="mt-1.5 text-[13px] text-text-tertiary">
              We never store your UPI PIN — payment approval always happens in your bank app.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={savingProfile || upi === (profile?.default_upi_id ?? "")}
              onClick={() => void save()}
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-[18px] w-[18px]" />
              )}
              Save
            </button>
          </Group>

          <Group title="Online checkout">
            <Row label="Card / netbanking checkout" hint="Requires provider credentials">
              <span className="rounded-lg bg-soft-orange px-2 py-1 text-[12px] font-semibold text-warning">
                Not configured
              </span>
            </Row>
            <p className="mt-3 flex items-start gap-2 text-[13px] text-text-tertiary">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              Until a payment provider is connected, BillBuddy records payments manually and hands
              off to your UPI app. Nothing is simulated.
            </p>
          </Group>
        </>
      )}
    </section>
  );
}