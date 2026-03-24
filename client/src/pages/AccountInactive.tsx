import { useAuth } from "@/_core/hooks/useAuth";
import { useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2 } from "lucide-react";

function isStaffRole(role: string | undefined) {
  return role === "admin" || role === "superadmin";
}

export default function AccountInactivePage() {
  const { user, loading } = useAuth();
  const { signOut, isSignedIn, isLoaded: clerkLoaded } = useClerk();

  useEffect(() => {
    if (loading || !user) return;
    if (isStaffRole(user.role)) {
      window.location.assign("/dashboard");
    } else if (user.isActive !== false) {
      window.location.assign("/dashboard");
    }
  }, [loading, user]);

  if (!clerkLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-muted/30">
        <p className="text-muted-foreground text-center max-w-md">
          We could not load your profile. Please try signing in again.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  if (isStaffRole(user.role) || user.isActive !== false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm">
        <div className="container py-6">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer w-fit">
              <BookOpen className="h-8 w-8 text-primary" />
              <span className="text-xl font-semibold text-foreground">Serbian AI Tutor</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border bg-card text-card-foreground shadow-sm p-8 space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Account inactive</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account has been deactivated. You no longer have access to the learning app. If you think
            this is a mistake, please contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={() => signOut()}>Sign out</Button>
            <Button variant="outline" asChild>
              <a href="mailto:hello@jacksenn.me">Contact support</a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
