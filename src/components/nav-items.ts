import { Home, Receipt, Sparkles, Target, User, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Primary desktop navigation destinations. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/insights", label: "Insights", icon: Sparkles },
];

/** Mobile bottom dock destinations (flanking the center Quick Add button). */
export const MOBILE_LEFT_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/bills", label: "Bills", icon: Receipt },
];

export const MOBILE_RIGHT_ITEMS: NavItem[] = [
  { to: "/money", label: "Money", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
];
