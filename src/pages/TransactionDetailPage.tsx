import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Paperclip, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { moneyCategory } from "@/lib/categories";
import { formatAmount, formatDate } from "@/lib/format";
import { log } from "@/lib/logger";
import {
  amountPrefix,
  isEditable,
  isReversible,
  methodLabel,
  statusLabel,
  typeLabel,
  type LedgerRow,
} from "@/lib/transactions";
import {
  deleteTransaction as deleteTransactionFn,
  getAttachmentUrl as getAttachmentUrlFn,
  getTransaction as getTransactionFn,
  reverseTransaction as reverseTransactionFn,
  updateTransaction as updateTransactionFn,
  type TransactionDetail,
} from "@/lib/transactions.functions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BillCardSkeleton } from "@/components/Skeletons";
import {
  TransactionFormModal,
  type EntryType,
  type TransactionInput,
} from "@/components/TransactionFormModal";
import type { Transaction } from "@/types/database";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-light py-3 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-right text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/** Full audit view of a single ledger record, with edit / reverse / delete. */
export function TransactionDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const getTransaction = useServerFn(getTransactionFn);
  const updateTransaction = useServerFn(updateTransactionFn);
  const deleteTransaction = useServerFn(deleteTransactionFn);
  const reverseTransaction = useServerFn(reverseTransactionFn);
  const getAttachmentUrl = useServerFn(getAttachmentUrlFn);

  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "reverse" | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getTransaction({ data: { id } }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load transaction";
      log.error(message, e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [getTransaction, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEdit = async (values: TransactionInput) => {
    await updateTransaction({
      data: {
        id,
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        payment_method: values.payment_method,
        notes: values.notes,
      },
    });
    toast.success("Entry updated");
    void load();
  };

  const handleDelete = async () => {
    setWorking(true);
    try {
      await deleteTransaction({ data: { id } });
      toast.success("Entry deleted");
      void navigate({ to: "/transactions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete entry");
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  };

  const handleReverse = async () => {
    setWorking(true);
    try {
      await reverseTransaction({
        data: { id, client_request_id: crypto.randomUUID(), reason: "Reversed by user" },
      });
      toast.success("Reversal recorded");
      setConfirm(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reverse entry");
    } finally {
      setWorking(false);
    }
  };

  const openAttachment = async (attachmentId: string) => {
    try {
      const { url } = await getAttachmentUrl({ data: { id: attachmentId } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open receipt");
    }
  };

  if (loading) return <BillCardSkeleton />;

  if (error || !detail) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm font-medium text-error">{error ?? "Transaction not found."}</p>
        <Link to="/transactions" className="btn btn-secondary mt-4">
          Back to transactions
        </Link>
      </div>
    );
  }

  const row = detail.transaction as LedgerRow;
  const cat = moneyCategory(row.category);
  const Icon = cat.icon;
  const canEdit = isEditable(row);
  const canReverse = isReversible(row);

  return (
    <section className="animate-fade-in">
      <Link
        to="/transactions"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary"
      >
        <ArrowLeft className="h-4 w-4" /> Transactions
      </Link>

      <header className="card p-6 text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lilac/50"
          style={{ color: cat.color }}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <p className="mt-3 text-[34px] font-extrabold leading-tight text-text-primary tabular-nums">
          {amountPrefix(row)}
          {formatAmount(Math.abs(Number(row.amount)))}
        </p>
        <h1 className="mt-1 text-[17px] font-semibold text-text-primary">
          {row.description || typeLabel(row.type)}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {formatDate(row.date)} · {statusLabel(row.status)}
        </p>
      </header>

      <div className="card mt-4 px-5 py-2">
        <Row label="Type" value={typeLabel(row.type)} />
        <Row label="Category" value={cat.label} />
        <Row label="Payment method" value={methodLabel(row.payment_method)} />
        <Row label="Currency" value={row.currency ?? "INR"} />
        <Row label="Source" value={row.source === "provider" ? "Payment provider" : "Manual"} />
        {detail.providerReference ? (
          <Row label="Reference" value={detail.providerReference} />
        ) : null}
        {row.notes ? <Row label="Notes" value={row.notes} /> : null}
        {row.created_at ? (
          <Row label="Recorded" value={new Date(row.created_at).toLocaleString()} />
        ) : null}
      </div>

      {detail.bill && detail.occurrence ? (
        <div className="card mt-4 px-5 py-2">
          <Row label="Linked bill" value={detail.bill.title} />
          <Row label="Due date" value={formatDate(detail.occurrence.scheduled_date)} />
          <Row label="Expected" value={formatAmount(detail.occurrence.expected_amount)} />
        </div>
      ) : null}

      {detail.original || detail.reversal ? (
        <div className="card mt-4 px-5 py-2">
          {detail.original ? (
            <Row
              label="Reverses"
              value={
                <Link to="/transactions/$id" params={{ id: detail.original.id }} className="text-primary">
                  {formatAmount(Math.abs(detail.original.amount))} on{" "}
                  {formatDate(detail.original.date)}
                </Link>
              }
            />
          ) : null}
          {detail.reversal ? (
            <Row
              label="Reversed by"
              value={
                <Link to="/transactions/$id" params={{ id: detail.reversal.id }} className="text-primary">
                  {formatAmount(Math.abs(detail.reversal.amount))} on{" "}
                  {formatDate(detail.reversal.date)}
                </Link>
              }
            />
          ) : null}
        </div>
      ) : null}

      {detail.attachments.length > 0 ? (
        <div className="card mt-4 p-5">
          <h2 className="text-sm font-bold text-text-primary">Receipts</h2>
          <div className="mt-3 space-y-2">
            {detail.attachments.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void openAttachment(a.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-muted px-4 py-3 text-left"
              >
                <Paperclip className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                  {a.file_name}
                </span>
                <span className="text-xs text-text-tertiary">
                  {Math.max(1, Math.round(a.file_size / 1024))} KB
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canEdit}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4" /> Edit
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canReverse || working}
          onClick={() => setConfirm("reverse")}
        >
          {working && confirm === "reverse" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reverse
        </button>
        <button
          type="button"
          className="btn btn-secondary !text-[#A73A4C]"
          disabled={!canEdit || working}
          onClick={() => setConfirm("delete")}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
      {!canEdit ? (
        <p className="mt-2 px-1 text-xs text-text-tertiary">
          Payment and reversal records are permanent. Use a reversal to correct them.
        </p>
      ) : null}

      <TransactionFormModal
        open={editOpen}
        transaction={row as unknown as Transaction}
        initialType={(row.type as EntryType) ?? "expense"}
        allowAttachment={false}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this entry?"
        message="This removes the record permanently. Payments and reversals can't be deleted."
        confirmLabel="Delete"
        destructive
        busy={working}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={confirm === "reverse"}
        title="Reverse this transaction?"
        message="The original stays in your history and an offsetting record is added."
        confirmLabel="Reverse"
        busy={working}
        onCancel={() => setConfirm(null)}
        onConfirm={handleReverse}
      />
    </section>
  );
}
