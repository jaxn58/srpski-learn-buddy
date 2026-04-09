import { SignIn } from "@clerk/clerk-react";
import { BookOpen } from "lucide-react";
import { Link } from "wouter";
import { AppFooter } from "@/components/AppFooter";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  type SessionPreference,
  getSessionPreference,
  setSessionPreference,
} from "@/lib/sessionPreference";

export default function SignInPage() {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<SessionPreference>(getSessionPreference);
  const redirectUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    const candidate = (params.get("redirect_url") || "").trim();
    if (!candidate) return "/dashboard";
    if (!candidate.startsWith("/")) return "/dashboard";
    if (candidate.startsWith("//")) return "/dashboard";
    if (candidate.includes("://")) return "/dashboard";
    return candidate;
  })();

  const handlePreferenceChange = (value: string) => {
    const pref = value as SessionPreference;
    setPreference(pref);
    setSessionPreference(pref);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex flex-col">
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

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
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

          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
            <p className="text-sm font-medium leading-none">
              {t("session.preference.label")}
            </p>
            <RadioGroup
              value={preference}
              onValueChange={handlePreferenceChange}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="permanent" id="sp-permanent" className="mt-0.5" />
                <Label htmlFor="sp-permanent" className="font-normal leading-snug cursor-pointer">
                  {t("session.preference.permanent")}
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="week" id="sp-week" className="mt-0.5" />
                <Label htmlFor="sp-week" className="font-normal leading-snug cursor-pointer">
                  {t("session.preference.week")}
                </Label>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="browser-close" id="sp-browser-close" className="mt-0.5" />
                <Label htmlFor="sp-browser-close" className="font-normal leading-snug cursor-pointer">
                  {t("session.preference.browserClose")}
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {t("session.preference.hint")}
            </p>
          </div>
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
