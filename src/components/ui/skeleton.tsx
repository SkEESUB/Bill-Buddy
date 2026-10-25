// src/components/ui/skeleton.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "text" | "card" | "avatar" | "row" | "chart";
}

export function Skeleton({ className, variant = "text", ...props }: SkeletonProps) {
  const base = "animate-pulse bg-gray-200 dark:bg-gray-700 rounded";

  if (variant === "card") {
    return (
      <div className={cn("rounded-xl p-4 space-y-3", base, className)} {...props}>
        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3" />
        <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-2/3" />
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className={cn("flex items-center gap-3 py-3", className)} {...props}>
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        </div>
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("rounded-xl p-4", className)} {...props}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/4 mb-4" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div
        className={cn(
          "rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse w-10 h-10",
          className,
        )}
        {...props}
      />
    );
  }

  // Default: text
  return <div className={cn("h-4 rounded animate-pulse", base, className)} {...props} />;
}

// Preset page skeletons
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <Skeleton variant="card" className="h-32" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton variant="card" className="h-24" />
        <Skeleton variant="card" className="h-24" />
        <Skeleton variant="card" className="h-24" />
        <Skeleton variant="card" className="h-24" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="row" />
        ))}
      </div>
    </div>
  );
}

export function TransactionListSkeleton() {
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Skeleton key={i} variant="row" className="px-4" />
      ))}
    </div>
  );
}

export function BillListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} variant="card" className="h-20" />
      ))}
    </div>
  );
}
