import { SignIn } from "@clerk/clerk-react";
import { BookOpen } from "lucide-react";
import { Link } from "wouter";
import { AppFooter } from "@/components/AppFooter";
import { useTranslation } from "react-i18next";

export default function SignInPage() {
  const { t } = useTranslation();
  const redirectUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = (params.get("redirect_url") || "").trim();
    if (!candidate) return "/dashboard";
    // Prevent open redirects.
    if (!candidate.startsWith("/")) return "/dashboard";
    if (candidate.startsWith("//")) return "/dashboard";
    if (candidate.includes("://")) return "/dashboard";
    return candidate;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
      {/* Header */}
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <BookOpen className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {t("app.title")}
                </h1>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <SignIn
          routing="virtual"
          afterSignInUrl={redirectUrl}
          signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`}
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl border-2",
              headerTitle: "text-2xl font-bold",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              footerActionLink: "text-primary hover:text-primary/90",
            },
          }}
        />
      </div>

      <AppFooter />
    </div>
  );
}
