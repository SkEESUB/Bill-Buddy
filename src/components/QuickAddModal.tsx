import { useState } from "react";
import { Receipt, TrendingDown, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/hooks/useFinance";
import { BillFormModal, type BillInput } from "@/components/BillFormModal";
import {
  TransactionFormModal,
  type EntryType,
  type TransactionInput,
} from "@/components/TransactionFormModal";
import { toUserMessage } from "@/lib/errors";

export function QuickAddModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const finance = useFinance();
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<EntryType>("expense");

  if (!open && !billModalOpen && !txModalOpen) return null;

  const handleOpenBill = () => {
    onClose();
    setBillModalOpen(true);
  };

  const handleOpenTx = (type: EntryType) => {
    onClose();
    setTxType(type);
    setTxModalOpen(true);
  };

  const handleBillSubmit = async (values: BillInput) => {
    try {
      await finance.actions.createBill(values);
      toast.success("Bill added successfully");
      setBillModalOpen(false);
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  };

  const handleTxSubmit = async (values: TransactionInput) => {
    try {
      await finance.actions.createTransaction({
        type: values.type,
        amount: Number(values.amount),
        category: values.category,
        description: values.description ?? null,
        date: values.date,
        payment_method: values.payment_method,
        notes: values.notes ?? null,
        client_request_id: values.client_request_id,
      });
      toast.success(values.type === "income" ? "Income recorded" : "Expense recorded");
      setTxModalOpen(false);
    } catch (err) {
      toast.error(toUserMessage(err));
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in"
          onClick={onClose}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border-light bg-surface p-5 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick Actions"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-light">
              <div>
                <h2 className="text-base font-bold text-text-primary">Quick Add</h2>
                <p className="text-xs text-text-secondary">What would you like to record?</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-muted cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={handleOpenBill}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-left transition-all hover:border-primary hover:bg-muted/50 cursor-pointer"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">New Bill</p>
                  <p className="text-xs text-text-secondary">Track recurring or upcoming payments</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenTx("expense")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-left transition-all hover:border-status-error hover:bg-soft-red/30 cursor-pointer"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soft-red text-status-error">
                  <TrendingDown className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">Record Expense</p>
                  <p className="text-xs text-text-secondary">Log a daily or one-off expenditure</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleOpenTx("income")}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-left transition-all hover:border-status-success hover:bg-soft-green/30 cursor-pointer"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-soft-green text-status-success">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">Record Income</p>
                  <p className="text-xs text-text-secondary">Add salary, freelance or other income</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {billModalOpen && (
        <BillFormModal
          open={billModalOpen}
          onClose={() => setBillModalOpen(false)}
          onSubmit={handleBillSubmit}
        />
      )}

      {txModalOpen && (
        <TransactionFormModal
          open={txModalOpen}
          onClose={() => setTxModalOpen(false)}
          initialType={txType}
          onSubmit={handleTxSubmit}
        />
      )}
    </>
  );
}
