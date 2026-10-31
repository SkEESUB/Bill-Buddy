import { useState, useRef, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  parseBankStatementCsv,
  type ParsedStatementRow,
  type StatementParseResult,
  type CustomColumnMapping,
} from "@/lib/parsers/statement-csv-parser";
import { formatAmount } from "@/lib/format";
import {
  checkStatementDuplicates,
  importStatementSpends,
  type DuplicateCheckResult,
} from "@/lib/spends.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

interface StatementImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess: () => Promise<void>;
}

export function StatementImportModal({
  open,
  onClose,
  onImportSuccess,
}: StatementImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkDuplicatesFn = useServerFn(checkStatementDuplicates);
  const importSpendsFn = useServerFn(importStatementSpends);

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [parseResult, setParseResult] = useState<StatementParseResult | null>(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [customMapping, setCustomMapping] = useState<CustomColumnMapping>({});

  // Duplicate check state
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMap, setDuplicateMap] = useState<Map<number, DuplicateCheckResult>>(new Map());

  // Selected row indices for import
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  // Submitting state
  const [importing, setImporting] = useState(false);

  const handleReset = () => {
    setFile(null);
    setCsvContent("");
    setParseResult(null);
    setShowColumnMapping(false);
    setCustomMapping({});
    setDuplicateMap(new Map());
    setSelectedIndices(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processCsvFile = async (selectedFile: File) => {
    // 1. File size limit: 5MB
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Maximum supported CSV size is 5MB.");
      return;
    }

    // 2. Extension check
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a valid .csv bank statement.");
      return;
    }

    try {
      const text = await selectedFile.text();
      setFile(selectedFile);
      setCsvContent(text);

      const parsed = parseBankStatementCsv(text);
      setParseResult(parsed);

      if (!parsed.success || parsed.confidence === "low") {
        setShowColumnMapping(true);
      }

      // Automatically run duplicate check for candidate expenses
      await runDuplicateCheck(parsed);
    } catch (err) {
      toast.error("Failed to read CSV file. Please verify the file format.");
    }
  };

  const runDuplicateCheck = async (
    parsed: StatementParseResult,
    mappingOverride?: CustomColumnMapping,
  ) => {
    const candidateExpenses = parsed.rows.filter((r) => r.isEligibleExpense && !r.error);
    if (candidateExpenses.length === 0) {
      setSelectedIndices(new Set());
      return;
    }

    setCheckingDuplicates(true);
    try {
      const candidatesPayload = candidateExpenses.map((row) => ({
        id: String(row.index),
        name: row.description,
        amount: row.debit,
        spend_date: row.date,
        reference: row.reference,
      }));

      const duplicateResults = await checkDuplicatesFn({
        data: { candidates: candidatesPayload },
      });

      const dupMap = new Map<number, DuplicateCheckResult>();
      const initialSelected = new Set<number>();

      for (const res of duplicateResults) {
        const rowIndex = parseInt(res.candidateId, 10);
        dupMap.set(rowIndex, res);

        // Pre-select only non-duplicates by default
        if (!res.isDuplicate) {
          initialSelected.add(rowIndex);
        }
      }

      setDuplicateMap(dupMap);
      setSelectedIndices(initialSelected);
    } catch (e) {
      console.warn("[duplicateCheck] Notice:", e);
      // Fallback: select all eligible expenses if duplicate check server call fails
      const fallbackSelected = new Set<number>(candidateExpenses.map((r) => r.index));
      setSelectedIndices(fallbackSelected);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleApplyCustomMapping = () => {
    if (!csvContent) return;
    const reParsed = parseBankStatementCsv(csvContent, customMapping);
    setParseResult(reParsed);
    runDuplicateCheck(reParsed, customMapping);
    setShowColumnMapping(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCsvFile(e.target.files[0]);
    }
  };

  const toggleSelectRow = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAllEligible = () => {
    if (!parseResult) return;
    const eligibleIndices = parseResult.rows.filter((r) => r.isEligibleExpense).map((r) => r.index);

    if (selectedIndices.size === eligibleIndices.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(eligibleIndices));
    }
  };

  const handleCommitImport = async () => {
    if (!parseResult || selectedIndices.size === 0 || importing) return;

    setImporting(true);
    try {
      const spendsToImport = parseResult.rows
        .filter((r) => selectedIndices.has(r.index))
        .map((r) => ({
          name: r.description,
          amount: r.debit,
          spend_date: r.date,
          notes: r.notes,
          reference: r.reference,
        }));

      const res = await importSpendsFn({
        data: { spends: spendsToImport },
      });

      toast.success(
        `Successfully imported ${res.importedCount} expense${res.importedCount === 1 ? "" : "s"} into Spends!`,
      );
      await onImportSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Failed to import expenses. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const eligibleRowsCount = useMemo(() => {
    return parseResult?.rows.filter((r) => r.isEligibleExpense).length ?? 0;
  }, [parseResult]);

  const selectedTotalAmount = useMemo(() => {
    if (!parseResult) return 0;
    return parseResult.rows
      .filter((r) => selectedIndices.has(r.index))
      .reduce((sum, r) => sum + r.debit, 0);
  }, [parseResult, selectedIndices]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-3 pb-6 sm:items-center sm:pb-3 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-3xl glass-panel bg-white/95 dark:bg-slate-900/95 border border-white/90 dark:border-slate-800 p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="statement-import-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60 p-2">
              <FileSpreadsheet className="h-full w-full text-amber-600 dark:text-amber-400 object-contain" />
            </div>
            <div>
              <h2
                id="statement-import-title"
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight"
              >
                Import Bank Statement (CSV)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically extract and review eligible debit expenses from your bank CSV
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1 flex flex-col gap-3.5">
          {/* STEP 1: UPLOAD DROPZONE */}
          {!parseResult && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                dragActive
                  ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 scale-[1.01]"
                  : "border-slate-200 dark:border-slate-700 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-800/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload CSV Bank Statement"
              />

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100/70 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 mb-3 shadow-xs">
                <Upload className="h-6 w-6 stroke-[2.2]" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Drop your CSV statement here, or{" "}
                <span className="text-amber-600 dark:text-amber-400 underline">browse</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-3">
                Supports Bank of Baroda, SBI, HDFC, ICICI, Axis and other standard bank CSV exports
                (Max 5MB).
              </p>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full">
                <Info className="h-3.5 w-3.5" />
                <span>Zero bank credentials or passwords requested. Processed privately.</span>
              </div>
            </div>
          )}

          {/* STEP 2: PARSED PREVIEW & SUMMARY */}
          {parseResult && (
            <div className="flex flex-col gap-3">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {file?.name || "Uploaded Statement"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({parseResult.rows.length} total transactions)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowColumnMapping(!showColumnMapping)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-600 shadow-xs cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Columns</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Column Mapping Drawer (if requested or low confidence) */}
              {showColumnMapping && (
                <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex flex-col gap-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                    <span>Confirm Column Mapping</span>
                    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      Detection confidence: {parseResult.confidence.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Date Column
                      </label>
                      <select
                        value={customMapping.dateCol ?? parseResult.columnMapping.date ?? ""}
                        onChange={(e) =>
                          setCustomMapping((prev) => ({ ...prev, dateCol: e.target.value }))
                        }
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Description
                      </label>
                      <select
                        value={customMapping.descCol ?? parseResult.columnMapping.description ?? ""}
                        onChange={(e) =>
                          setCustomMapping((prev) => ({ ...prev, descCol: e.target.value }))
                        }
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Debit Column
                      </label>
                      <select
                        value={customMapping.debitCol ?? parseResult.columnMapping.debit ?? ""}
                        onChange={(e) =>
                          setCustomMapping((prev) => ({ ...prev, debitCol: e.target.value }))
                        }
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Credit Column
                      </label>
                      <select
                        value={customMapping.creditCol ?? parseResult.columnMapping.credit ?? ""}
                        onChange={(e) =>
                          setCustomMapping((prev) => ({ ...prev, creditCol: e.target.value }))
                        }
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleApplyCustomMapping}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Apply & Re-parse
                    </button>
                  </div>
                </div>
              )}

              {/* Summary Metrics Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
                <div className="p-2 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                  <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    Eligible Spends
                  </span>
                  <span className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                    {parseResult.summary.eligibleExpenses}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60">
                  <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Income (Skipped)
                  </span>
                  <span className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                    {parseResult.summary.income}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60">
                  <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    Refunds/Transfers
                  </span>
                  <span className="text-sm font-extrabold text-purple-900 dark:text-purple-200">
                    {parseResult.summary.refunds + parseResult.summary.transfers}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
                  <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                    Duplicates
                  </span>
                  <span className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
                    {Array.from(duplicateMap.values()).filter((d) => d.isDuplicate).length}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 col-span-2 sm:col-span-1">
                  <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Selected
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedIndices.size} / {eligibleRowsCount}
                  </span>
                </div>
              </div>

              {/* Transactions Preview Table */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/70 dark:bg-slate-900/70">
                {/* Table Header Action Bar */}
                <div className="flex items-center justify-between p-2 px-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAllEligible}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedIndices.size === eligibleRowsCount
                        ? "Deselect All"
                        : "Select All Eligible"}
                    </button>
                    {checkingDuplicates && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Checking duplicates...
                      </span>
                    )}
                  </div>

                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-[11px]">
                    Only confirmed debit expenses are imported
                  </span>
                </div>

                {/* Table Scrollable List */}
                <div className="max-h-[36vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                  {parseResult.rows.map((row) => {
                    const isSelected = selectedIndices.has(row.index);
                    const duplicateInfo = duplicateMap.get(row.index);
                    const isDuplicate = duplicateInfo?.isDuplicate;

                    return (
                      <div
                        key={row.index}
                        onClick={() => row.isEligibleExpense && toggleSelectRow(row.index)}
                        className={`p-2.5 px-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                          !row.isEligibleExpense
                            ? "opacity-50 bg-slate-50/50 dark:bg-slate-800/20 cursor-not-allowed"
                            : isDuplicate
                              ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/70 cursor-pointer"
                              : "hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer"
                        }`}
                      >
                        {/* Checkbox & Details */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!row.isEligibleExpense}
                            onChange={() => toggleSelectRow(row.index)}
                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer disabled:cursor-not-allowed"
                            aria-label={`Select ${row.description}`}
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {row.date || row.rawDate}
                              </span>

                              {/* Classification Badges */}
                              {row.type === "expense" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                                  Debit
                                </span>
                              )}
                              {row.type === "income" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                                  Income
                                </span>
                              )}
                              {row.type === "refund" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                                  Refund
                                </span>
                              )}
                              {row.type === "transfer" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                                  Transfer
                                </span>
                              )}

                              {/* Duplicate Warning Badge */}
                              {isDuplicate && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                                  title={duplicateInfo.duplicateReason}
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                  Duplicate Warning
                                </span>
                              )}
                            </div>

                            <p className="font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                              {row.description}
                            </p>
                            {isDuplicate && duplicateInfo.duplicateReason && (
                              <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium truncate">
                                {duplicateInfo.duplicateReason}
                              </p>
                            )}
                            {row.reference && !isDuplicate && (
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                Ref: {row.reference}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="shrink-0 text-right">
                          <span
                            className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                              row.type === "expense"
                                ? "text-slate-900 dark:text-white"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {row.type === "expense" ? "-" : "+"}
                            {formatAmount(row.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {parseResult && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Total Selected:
              </span>
              <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tabular-nums">
                {formatAmount(selectedTotalAmount)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={selectedIndices.size === 0 || importing}
                onClick={handleCommitImport}
                className="px-5 h-10 rounded-xl bg-gradient-to-r from-amber-600 via-amber-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <span>Import {selectedIndices.size} Spends</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
