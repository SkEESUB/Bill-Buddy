/** Shimmering placeholders that mirror the real bill card layout. */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

export function BillCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4">
      <SkeletonBar className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <SkeletonBar className="h-4 w-2/5" />
        <SkeletonBar className="h-3 w-1/4" />
      </div>
      <div className="space-y-2 text-right">
        <SkeletonBar className="h-5 w-24" />
        <SkeletonBar className="h-3 w-16" />
      </div>
    </div>
  );
}

export function BillListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading bills">
      {Array.from({ length: count }).map((_, i) => (
        <BillCardSkeleton key={i} />
      ))}
    </div>
  );
}
