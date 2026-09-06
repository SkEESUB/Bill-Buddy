import { ArrowLeftRight, Home, Receipt, Sparkles, Target, Wallet, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/transactions", label: "Ledger", icon: ArrowLeftRight },
  { to: "/insights", label: "Insights", icon: Sparkles },
];
