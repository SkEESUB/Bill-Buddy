import { useState, useRef } from "react";
import {
  Calendar,
  CreditCard,
  Wallet,
  ArrowLeftRight,
  Camera,
  Target,
  X,
  Plus,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const finance = useFinance();
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<EntryType>("expense");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleScanReceipt = () => {
    onClose();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info(`Receipt "${file.name}" selected. Opening expense form...`);
      setTxType("expense");
      setTxModalOpen(true);
    }
  };

  const handleOpenGoal = () => {
    onClose();
    void navigate({ to: "/goals" });
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 pb-8 sm:items-center sm:pb-4 animate-fade-in"
          onClick={onClose}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[32px] border border-border-light bg-surface p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add New"
          >
            <div className="text-center pb-2">
              <h2 className="text-lg font-bold text-text-primary">Add New</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Select an item to record or create
              </p>
            </div>

            {/* 6-Grid matching Phase 1 Screen 4 */}
            <div className="mt-5 grid grid-cols-3 gap-3.5">
              {/* Add Bill */}
              <button
                type="button"
                onClick={handleOpenBill}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-amber-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                  <Calendar className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Add Bill</span>
              </button>

              {/* Add Expense */}
              <button
                type="button"
                onClick={() => handleOpenTx("expense")}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-rose-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                  <CreditCard className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Add Expense</span>
              </button>

              {/* Add Income */}
              <button
                type="button"
                onClick={() => handleOpenTx("income")}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-emerald-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <Wallet className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Add Income</span>
              </button>

              {/* Transfer */}
              <button
                type="button"
                onClick={() => handleOpenTx("expense")}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-blue-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                  <ArrowLeftRight className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Transfer</span>
              </button>

              {/* Scan Receipt */}
              <button
                type="button"
                onClick={handleScanReceipt}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-purple-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-500 transition-colors group-hover:bg-purple-500 group-hover:text-white">
                  <Camera className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Scan Receipt</span>
              </button>

              {/* Custom / Goal */}
              <button
                type="button"
                onClick={handleOpenGoal}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border-light/80 bg-surface p-3.5 text-center transition-all hover:scale-105 hover:border-teal-400 hover:shadow-md cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-500 transition-colors group-hover:bg-teal-500 group-hover:text-white">
                  <Target className="h-6 w-6 stroke-[2.2]" />
                </div>
                <span className="text-[12px] font-semibold text-text-primary">Add Goal</span>
              </button>
            </div>

            {/* Bottom Close Button matching Phase 1 Screen 4 */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90 hover:scale-105 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-6 w-6 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill creation modal */}
      <BillFormModal
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        onSubmit={handleBillSubmit}
      />

      {/* Transaction modal */}
      <TransactionFormModal
        open={txModalOpen}
        initialType={txType}
        onClose={() => setTxModalOpen(false)}
        onSubmit={handleTxSubmit}
      />
    </>
  );
}
