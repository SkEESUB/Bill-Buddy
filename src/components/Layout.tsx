import type { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col lg:flex-row">
      {/* Desktop Persistent Sidebar (>= lg) */}
      <DesktopSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72">
        {/* Top Header (Adapts on mobile vs desktop) */}
        <TopNav />

        {/* Fluid Page Body with Responsive Padding */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-28 pt-4 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation (< lg) */}
      <BottomNav />
    </div>
  );
}
