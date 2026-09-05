/**
 * Single source of truth for bill categories: outline icon, label and accent color.
 * Shared by the dashboard, modals, history and analytics so a category always
 * looks identical everywhere.
 */
import {
  Banknote,
  BookOpen,
  Briefcase,
  Car,
  CreditCard,
  Droplets,
  Flame,
  Gift,
  Heart,
  Home,
  Laptop,
  Lightbulb,
  MonitorPlay,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from "lucide-react";

export type CategoryOption = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { key: "electricity", label: "Electricity", icon: Lightbulb, color: "#4B1D3F" },
  { key: "water", label: "Water", icon: Droplets, color: "#5E3A70" },
  { key: "internet", label: "Internet", icon: Wifi, color: "#8E6FA8" },
  { key: "mobile", label: "Mobile", icon: Smartphone, color: "#7A4A6B" },
  { key: "rent", label: "Rent", icon: Home, color: "#6B2C59" },
  { key: "gas", label: "Gas", icon: Flame, color: "#93627F" },
  { key: "subscription", label: "Subscription", icon: Tv, color: "#A98AC0" },
  { key: "insurance", label: "Insurance", icon: ShieldCheck, color: "#3F5E52" },
  { key: "loan", label: "Loan", icon: Banknote, color: "#37132D" },
  { key: "other", label: "Other", icon: Receipt, color: "#6E5B69" },
];

const BY_KEY = new Map(CATEGORY_OPTIONS.map((c) => [c.key, c]));
const FALLBACK = CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1]!;

/** Look up a category descriptor, falling back to "Other" for unknown keys. */
export function category(key: string): CategoryOption {
  return BY_KEY.get(key) ?? { ...FALLBACK, key, label: key || FALLBACK.label };
}

export const categoryColor = (key: string) => category(key).color;
export const categoryIcon = (key: string) => category(key).icon;
export const categoryLabel = (key: string) => category(key).label;

export type BillStatus = "overdue" | "today" | "upcoming" | "paid";

export const STATUS_STYLES: Record<BillStatus, { bg: string; color: string; label: string }> = {
  overdue: { bg: "#FCEAED", color: "#A73A4C", label: "Overdue" },
  today: { bg: "#FFF3DF", color: "#9C6318", label: "Due today" },
  upcoming: { bg: "#EEE5F5", color: "#4B1D3F", label: "Upcoming" },
  paid: { bg: "#E7F5EF", color: "#1F7053", label: "Paid" },
};

/** Soft amber treatment for bills due within the next few days. */
export const DUE_SOON_STYLE = { bg: "#FFF3DF", color: "#9C6318", label: "Due soon" };

/** Money-tracking categories (separate from bill categories). */
export const EXPENSE_CATEGORIES: CategoryOption[] = [
  { key: "food", label: "Food", icon: Utensils, color: "#4B1D3F" },
  { key: "transport", label: "Transport", icon: Car, color: "#5E3A70" },
  { key: "shopping", label: "Shopping", icon: ShoppingBag, color: "#A98AC0" },
  { key: "entertainment", label: "Fun", icon: MonitorPlay, color: "#8E6FA8" },
  { key: "health", label: "Health", icon: Heart, color: "#3F5E52" },
  { key: "education", label: "Education", icon: BookOpen, color: "#6B2C59" },
  { key: "other_expense", label: "Other", icon: CreditCard, color: "#6E5B69" },
];

export const INCOME_CATEGORIES: CategoryOption[] = [
  { key: "salary", label: "Salary", icon: Briefcase, color: "#278A63" },
  { key: "freelance", label: "Freelance", icon: Laptop, color: "#3F5E52" },
  { key: "investment", label: "Investment", icon: TrendingUp, color: "#5E3A70" },
  { key: "gift", label: "Gift", icon: Gift, color: "#A98AC0" },
  { key: "other_income", label: "Other", icon: Wallet, color: "#6E5B69" },
];

const MONEY_BY_KEY = new Map([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.key, c]));

/** Look up an income/expense category descriptor. */
export function moneyCategory(key: string): CategoryOption {
  return (
    MONEY_BY_KEY.get(key) ?? { key, label: key || "Other", icon: CreditCard, color: "#6E5B69" }
  );
}
