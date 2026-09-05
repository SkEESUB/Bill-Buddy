import type { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
