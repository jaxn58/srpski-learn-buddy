import { SignUp } from "@clerk/clerk-react";
import { BookOpen } from "lucide-react";
import { Link } from "wouter";
import { AppFooter } from "@/components/AppFooter";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function SignUpPage() {
  const { t } = useTranslation();
  const LEARNING_LANGUAGE_STORAGE_KEY = "learning-language";
  const [learningLanguage, setLearningLanguage] = useState<"en" | "de" | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LEARNING_LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "de") setLearningLanguage(stored);
    } catch {
      // ignore
    }
  }, []);

  const chooseLearningLanguage = (next: "en" | "de") => {
    setLearningLanguage(next);
    try {
      localStorage.setItem(LEARNING_LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

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

      {/* Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {!learningLanguage ? (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">{t("home.learningLanguage.title")}</CardTitle>
                <CardDescription>{t("home.learningLanguage.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col items-center gap-3">
                <RadioGroup
                  value={learningLanguage ?? ""}
                  onValueChange={(value) => {
                    if (value !== "en" && value !== "de") return;
                    chooseLearningLanguage(value);
                  }}
                  className="grid w-full gap-3 sm:grid-cols-2"
                  aria-describedby="learning-language-note"
                >
                  <div className="relative">
                    <RadioGroupItem value="de" id="learning-language-de" className="peer sr-only" />
                    <Label
                      htmlFor="learning-language-de"
                      className="flex items-center justify-center rounded-xl border-2 bg-white/70 px-4 py-4 text-sm font-semibold shadow-sm transition-all hover:border-primary/60 hover:bg-white peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent/20 peer-data-[state=checked]:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background cursor-pointer select-none"
                    >
                      {t("home.learningLanguage.option.de")}
                    </Label>
                  </div>

                  <div className="relative">
                    <RadioGroupItem value="en" id="learning-language-en" className="peer sr-only" />
                    <Label
                      htmlFor="learning-language-en"
                      className="flex items-center justify-center rounded-xl border-2 bg-white/70 px-4 py-4 text-sm font-semibold shadow-sm transition-all hover:border-primary/60 hover:bg-white peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent/20 peer-data-[state=checked]:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background cursor-pointer select-none"
                    >
                      {t("home.learningLanguage.option.en")}
                    </Label>
                  </div>
                </RadioGroup>

                <div id="learning-language-note" className="text-xs text-muted-foreground text-center">
                  {t("home.learningLanguage.note")}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {learningLanguage ? (
            <SignUp
              routing="virtual"
              signInUrl={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
              afterSignUpUrl={redirectUrl}
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
          ) : null}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
