/** Small building blocks shared by every settings screen. */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function SettingsHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5 flex items-start gap-3">
      <Link
        to="/settings"
        aria-label="Back to settings"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-light text-text-secondary transition-colors hover:border-primary hover:text-primary"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-[26px] font-bold tracking-tight text-text-primary">{title}</h1>
        {subtitle ? <p className="text-[13px] text-text-secondary">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function Group({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6 first:mt-0">
      {title ? (
        <h2 className="mb-2 px-1 text-[13px] font-semibold text-text-tertiary">{title}</h2>
      ) : null}
      <div className="card p-5">
        {description ? <p className="mb-3 text-[13px] text-text-secondary">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border-light py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint ? <p className="text-[13px] text-text-tertiary">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 rounded-full transition-colors disabled:opacity-50"
      style={{ backgroundColor: checked ? "var(--primary)" : "var(--border-strong)" }}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? "26px" : "4px" }}
      />
    </button>
  );
}

export function SelectRow({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string | undefined;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <select
        aria-label={label}
        className="max-w-[190px] rounded-xl border border-border-light bg-surface px-3 py-2 text-sm font-medium text-text-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

export function NumberRow({
  label,
  hint,
  value,
  min = 0,
  onCommit,
}: {
  label: string;
  hint?: string | undefined;
  value: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));
  useEffect(() => setDraft(String(value ?? 0)), [value]);

  return (
    <Row label={label} hint={hint}>
      <input
        aria-label={label}
        inputMode="decimal"
        className="w-32 rounded-xl border border-border-light bg-surface px-3 py-2 text-right text-sm font-semibold tabular-nums text-text-primary"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={() => {
          const parsed = Number(draft);
          if (!Number.isFinite(parsed) || parsed < min) return setDraft(String(value ?? 0));
          if (parsed !== value) onCommit(parsed);
        }}
      />
    </Row>
  );
}