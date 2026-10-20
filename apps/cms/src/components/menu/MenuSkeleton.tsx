import { Skeleton } from '../ui/Skeleton';

/** Desktop menu editor placeholder while categories/items load. */
export function MenuSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading menu" className="flex min-h-0 flex-1">
      <div className="w-[300px] shrink-0 border-r border-line bg-surface p-2 max-wide:w-60">
        <div className="mb-2 h-12 border-b border-line-2" />
        {[88, 112, 96, 120, 80].map((w, i) => (
          <div key={i} className="flex h-10 items-center gap-2 px-2">
            <Skeleton className="h-3.5 w-2.5" />
            <Skeleton className="h-3.5" style={{ width: w }} />
          </div>
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-2 h-6 w-32" />
        <Skeleton className="mb-6 h-3.5 w-48" />
        <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="h-9 border-b border-line-2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex min-h-[60px] items-center gap-3 border-b border-line-2 px-3">
              <Skeleton className="h-3.5 w-2.5" />
              <Skeleton className="size-11" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-[40%]" />
                <Skeleton className="h-3 w-[60%]" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Mobile placeholder (design M5): chip row + six 64px rows + "Loading menu…". */
export function MobileMenuSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading menu" className="flex flex-1 flex-col">
      <div className="flex gap-1.5 border-b border-line px-4 pb-2.5 pt-2">
        <span className="h-9 w-[72px] rounded-full bg-line" />
        <span className="h-9 w-24 rounded-full bg-line-2" />
        <span className="h-9 w-20 rounded-full bg-line-2" />
        <span className="h-9 w-[100px] rounded-full bg-line-2" />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex h-16 items-center gap-3 border-b border-line-2 bg-surface px-4">
          <span className="size-11 rounded-lg bg-line-2" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-[55%] rounded-md bg-line-2" />
            <span className="h-2.5 w-[30%] rounded-[5px] bg-line-2" />
          </span>
          <span className="h-7 w-12 rounded-full bg-line-2" />
        </div>
      ))}
      <div className="p-5 text-center text-xs text-muted">Loading menu…</div>
    </div>
  );
}
