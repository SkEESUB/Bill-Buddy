import { ArrowLeftRight, Home, Receipt, Sparkles, Wallet, type LucideIcon } from "lucide-react";

export const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/transactions", label: "Ledger", icon: ArrowLeftRight },
  { to: "/insights", label: "Insights", icon: Sparkles },
];
