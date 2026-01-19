import { useLocation } from "wouter";
import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  const [location] = useLocation();

  const pageType:
    | "dashboard"
    | "units"
    | "unit"
    | "chat"
    | "progress"
    | "vocabulary"
    | "leaderboards"
    | "profile"
    | "admin"
    | "generic" = (() => {
    if (location === "/dashboard") return "dashboard";
    if (location === "/units") return "units";
    if (location.startsWith("/unit/")) return "unit";
    if (location === "/chat") return "chat";
    if (location === "/progress") return "progress";
    if (location === "/vocabulary" || location === "/vocabulary-list") return "vocabulary";
    if (location === "/leaderboards") return "leaderboards";
    if (location === "/profile" || location === "/subscription") return "profile";
    if (location === "/admin" || location.startsWith("/admin/")) return "admin";
    return "generic";
  })();

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
      <main className="w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pt-6">
        {pageType === "dashboard" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="lg:col-span-2 h-80 rounded-xl" />
              <div className="grid gap-4">
                <Skeleton className="h-44 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
              </div>
            </div>
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : pageType === "chat" ? (
          <div className="flex gap-6">
            <div className="hidden md:block w-72 space-y-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-[520px] rounded-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton className="h-[640px] rounded-xl" />
            </div>
          </div>
        ) : pageType === "units" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-44 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ) : pageType === "unit" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-8 w-[520px] max-w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-[520px] rounded-xl" />
          </div>
        ) : pageType === "progress" ? (
          <div className="space-y-6">
            <Skeleton className="h-44 rounded-xl" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="lg:col-span-2 h-[360px] rounded-xl" />
              <Skeleton className="h-[360px] rounded-xl" />
            </div>
            <Skeleton className="h-[320px] rounded-xl" />
          </div>
        ) : pageType === "vocabulary" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-[520px] max-w-full" />
            </div>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-[420px] rounded-xl" />
          </div>
        ) : pageType === "leaderboards" ? (
          <div className="space-y-6">
            <Skeleton className="h-44 rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-[420px] rounded-xl" />
              <Skeleton className="h-[420px] rounded-xl" />
              <Skeleton className="h-[420px] rounded-xl" />
            </div>
          </div>
        ) : pageType === "profile" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="lg:col-span-2 h-[520px] rounded-xl" />
              <Skeleton className="h-[520px] rounded-xl" />
            </div>
          </div>
        ) : pageType === "admin" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-56" />
              <Skeleton className="h-4 w-[520px] max-w-full" />
            </div>
            <Skeleton className="h-[560px] rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-[520px] rounded-xl" />
          </div>
        )}
      </main>
    </div>
  );
}
