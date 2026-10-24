import { useState, useMemo } from "react";
import { Search, X, Receipt, ArrowUpRight, ArrowDownLeft, Calendar, Tag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useFinance } from "@/hooks/useFinance";
import { formatAmountShort } from "@/lib/format";

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "bills" | "transactions">("all");
  const finance = useFinance();

  const trimmed = query.trim().toLowerCase();

  const matchingBills = useMemo(() => {
    if (!trimmed) return [];
    return finance.snapshot.bills.filter((b) =>
      b.title.toLowerCase().includes(trimmed) ||
      (b.category && b.category.toLowerCase().includes(trimmed)) ||
      (b.notes && b.notes.toLowerCase().includes(trimmed))
    );
  }, [finance.snapshot.bills, trimmed]);

  const matchingTransactions = useMemo(() => {
    if (!trimmed) return [];
    return finance.snapshot.transactions.filter((t) =>
      (t.description && t.description.toLowerCase().includes(trimmed)) ||
      (t.category && t.category.toLowerCase().includes(trimmed)) ||
      (t.notes && t.notes.toLowerCase().includes(trimmed))
    );
  }, [finance.snapshot.transactions, trimmed]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-16 sm:pt-20 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-border-light bg-surface shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global Search"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border-light px-4 py-3.5">
          <Search className="h-5 w-5 text-text-tertiary" />
          <input
            autoFocus
            type="text"
            className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-tertiary outline-none"
            placeholder="Search bills, transactions, categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-text-secondary hover:bg-border-light"
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary px-2 py-1 rounded-lg"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Category Tabs */}
        {trimmed && (
          <div className="flex items-center gap-2 border-b border-border-light/70 px-4 py-2 bg-muted/40">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-text-secondary border border-border-light hover:text-text-primary"
              }`}
            >
              All ({matchingBills.length + matchingTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bills")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === "bills"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-text-secondary border border-border-light hover:text-text-primary"
              }`}
            >
              Bills ({matchingBills.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transactions")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === "transactions"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-text-secondary border border-border-light hover:text-text-primary"
              }`}
            >
              Transactions ({matchingTransactions.length})
            </button>
          </div>
        )}

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!trimmed ? (
            <div className="py-8 text-center text-text-tertiary">
              <Search className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">Type to search across your finances</p>
              <p className="text-xs text-text-tertiary mt-1">
                Find electricity, rent, food, transfers, and subscriptions
              </p>
            </div>
          ) : matchingBills.length === 0 && matchingTransactions.length === 0 ? (
            <div className="py-8 text-center text-text-tertiary">
              <p className="text-sm font-medium">No results found for "{query}"</p>
              <p className="text-xs text-text-tertiary mt-1">
                Check your spelling or try different keywords.
              </p>
            </div>
          ) : (
            <>
              {/* Bills Section */}
              {(activeTab === "all" || activeTab === "bills") && matchingBills.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2 px-1">
                    Bills ({matchingBills.length})
                  </h3>
                  <div className="space-y-1.5">
                    {matchingBills.map((bill) => (
                      <Link
                        key={bill.id}
                        to="/bills"
                        onClick={onClose}
                        className="flex items-center justify-between rounded-2xl border border-border-light/80 bg-surface p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Receipt className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{bill.title}</p>
                            <p className="text-xs text-text-tertiary capitalize">
                              {bill.category} · Due {bill.due_date}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-text-primary tabular-nums">
                          {formatAmountShort(Number(bill.amount))}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions Section */}
              {(activeTab === "all" || activeTab === "transactions") && matchingTransactions.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-2 px-1">
                    Transactions ({matchingTransactions.length})
                  </h3>
                  <div className="space-y-1.5">
                    {matchingTransactions.map((tx) => (
                      <Link
                        key={tx.id}
                        to="/transactions"
                        onClick={onClose}
                        className="flex items-center justify-between rounded-2xl border border-border-light/80 bg-surface p-3 transition-colors hover:border-primary/50 hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              tx.type === "income"
                                ? "bg-status-success/15 text-status-success"
                                : "bg-status-error/15 text-status-error"
                            }`}
                          >
                            {tx.type === "income" ? (
                              <ArrowDownLeft className="h-5 w-5" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5" />
                            )}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">
                              {tx.description || tx.category || "Transaction"}
                            </p>
                            <p className="text-xs text-text-tertiary">
                              {tx.date} · {tx.category}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            tx.type === "income" ? "text-status-success" : "text-status-error"
                          }`}
                        >
                          {tx.type === "income" ? "+" : "-"}
                          {formatAmountShort(Number(tx.amount))}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
