import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-muted/20">
      {/* TopNavigation skeleton */}
      <div className="sticky top-0 z-50 w-full border-b bg-muted/30 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="hidden sm:block h-4 w-24" />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6 space-y-4">
        <Skeleton className="h-12 w-56 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
