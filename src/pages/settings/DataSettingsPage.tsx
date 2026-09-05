import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Database, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Group, Row, SettingsHeader } from "@/components/settings/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/hooks/useFinance";
import { deleteAccount, exportAccountData } from "@/lib/account.functions";
import { exportTransactions } from "@/lib/transactions.functions";
import { downloadFile } from "@/lib/export";
import { toUserMessage } from "@/lib/errors";

/** Export everything, clear bills, or permanently close the account. */
export function DataSettingsPage() {
  const { overview } = useAccount();
  const { signOut } = useAuth();
  const finance = useFinance();
  const exportAll = useServerFn(exportAccountData);
  const exportLedger = useServerFn(exportTransactions);
  const deleteAccountFn = useServerFn(deleteAccount);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const counts = overview?.counts;

  const runExport = async (kind: "json" | "csv") => {
    setBusy(kind);
    try {
      const file =
        kind === "json"
          ? await exportAll({ data: undefined })
          : await exportLedger({ data: { format: "csv" } });
      downloadFile(file.filename, file.content, file.mime);
      toast.success("Export downloaded");
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const clearBills = async () => {
    setBusy("clear");
    let removed = 0;
    let kept = 0;
    try {
      for (const bill of finance.snapshot.bills) {
        try {
          await finance.actions.deleteBill(bill.id);
          removed += 1;
        } catch {
          kept += 1;
        }
      }
      if (removed > 0) toast.success(`Deleted ${removed} ${removed === 1 ? "bill" : "bills"}`);
      if (kept > 0) toast.error(`${kept} kept — bills with recorded payments can't be deleted.`);
      if (removed === 0 && kept === 0) toast.info("There are no bills to delete");
      setConfirmClear(false);
    } finally {
      setBusy(null);
    }
  };

  const closeAccount = async () => {
    setBusy("delete");
    try {
      await deleteAccountFn({ data: { confirmation, reason: reason.trim() || undefined } });
      toast.success("Your account has been deleted.");
      await signOut();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Privacy & data" subtitle="You own your records — take them anywhere." />

      <Group title="What we store">
        <Row label="Bills" hint="Scheduled and recurring commitments">
          <span className="text-sm font-semibold tabular-nums">{counts?.bills ?? "—"}</span>
        </Row>
        <Row label="Transactions" hint="Your financial ledger">
          <span className="text-sm font-semibold tabular-nums">{counts?.transactions ?? "—"}</span>
        </Row>
        <Row label="Budgets">
          <span className="text-sm font-semibold tabular-nums">{counts?.budgets ?? "—"}</span>
        </Row>
        <Row label="Receipts" hint="Private files, only readable by you">
          <span className="text-sm font-semibold tabular-nums">{counts?.attachments ?? "—"}</span>
        </Row>
        <p className="mt-3 flex items-start gap-2 text-[13px] text-text-tertiary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Your data is isolated per account at the database level. We never sell it and never share
          it with advertisers.
        </p>
      </Group>

      <Group title="Export">
        <button
          type="button"
          className="btn btn-secondary w-full"
          disabled={busy !== null}
          onClick={() => void runExport("json")}
        >
          {busy === "json" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-[18px] w-[18px]" />
          )}
          Download everything (JSON)
        </button>
        <button
          type="button"
          className="btn btn-secondary mt-3 w-full"
          disabled={busy !== null}
          onClick={() => void runExport("csv")}
        >
          {busy === "csv" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-[18px] w-[18px]" />
          )}
          Download ledger (CSV)
        </button>
      </Group>

      <Group title="Danger zone">
        <button
          type="button"
          className="btn w-full bg-soft-red !text-error"
          disabled={busy !== null}
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 className="h-[18px] w-[18px]" /> Clear all bills
        </button>
        <button
          type="button"
          className="btn mt-3 w-full bg-soft-red !text-error"
          disabled={busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-[18px] w-[18px]" /> Delete my account
        </button>
      </Group>

      <ConfirmDialog
        open={confirmClear}
        title="Clear all bills?"
        message="This deletes every bill and its scheduled instalments. Bills with recorded payments are kept so your payment history stays intact."
        confirmLabel="Delete bills"
        busy={busy === "clear"}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => void clearBills()}
      />

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm sm:items-center">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-text-primary">Delete your account?</h2>
            <p className="mt-2 text-[13px] text-text-secondary">
              This permanently removes your profile, bills, ledger, budgets and receipts. Only an
              anonymous record count is kept for financial audit. This cannot be undone.
            </p>
            <label className="mt-4 block text-[13px] font-medium text-text-secondary">
              Why are you leaving? (optional)
              <textarea
                className="input-field mt-1.5"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-[13px] font-medium text-text-secondary">
              Type DELETE to confirm
              <input
                className="input-field mt-1.5"
                value={confirmation}
                autoCapitalize="characters"
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                disabled={busy === "delete"}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn flex-1 bg-soft-red !text-error"
                disabled={confirmation.trim().toUpperCase() !== "DELETE" || busy === "delete"}
                onClick={() => void closeAccount()}
              >
                {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}