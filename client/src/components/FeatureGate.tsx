import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";
import { useFeatureAccess, type FeatureAccess } from "@/hooks/useFeatureAccess";

/**
 * Route-level feature guard. Wrap a protected page so a user who reaches the
 * URL directly (deep link, bookmark) is redirected when their plan does not
 * include the feature. Navigation already hard-hides the entry points; this is
 * the enforcement layer for direct access. The backend enforces independently.
 */
export function FeatureGate({
  allow,
  redirectTo = "/dashboard",
  children,
}: {
  allow: (access: FeatureAccess) => boolean;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const access = useFeatureAccess();

  if (access === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allow(access)) {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}
