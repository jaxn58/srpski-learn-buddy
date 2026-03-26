import { useAuth } from "../_core/hooks/useAuth";
import { SignUp } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles, Check, HelpCircle, DollarSign, RefreshCw, Shield, Calendar, Zap, Loader2, Volume2, ListTodo } from "lucide-react";
import { APP_LOGO } from "@/const";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
const WaitlistModal = lazy(() =>
  import("@/components/WaitlistModal").then((m) => ({ default: m.WaitlistModal }))
);
import { AppFooter } from "@/components/AppFooter";
import { buildLandingModuleCards, computeLandingCounts } from "./home/landingData";
import { initDodoPayments, openDodoCheckout } from "@/lib/dodo";
// During beta phase, we do not offer paid plans/checkout.

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const { t, i18n } = useTranslation();
  const { language: displayLanguage, setLanguage: setDisplayLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  
  // Waitlist modal state
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  
  // Environment checks
  const isWaitlistMode = import.meta.env.VITE_WAITLIST_MODE === 'on';
  const isPrivileged = user?.role === "admin" || user?.role === "superadmin";
  
  // Show waitlist only if: waitlist mode is ON AND user is NOT a privileged developer/admin user
  const showWaitlist = isWaitlistMode && !isPrivileged;
  const showBetaRegistration = !isWaitlistMode || isPrivileged;

  // Pricing/checkout is intentionally disabled during beta.
  // Keep the old pricing JSX gated behind a constant false to avoid a large UI rewrite here.
  // (Plans go live after beta.)
  
  // Dev-only: enable purchase buttons so we can test Dodo payments locally.
  // Production builds remain disabled until the beta phase ends.
  // We also enable it if we are explicitly in test_mode to allow testing on preview deployments.
  const billingConfig = useQuery(api.subscriptions.getBillingProviderConfig);
  const isTestMode = billingConfig?.dodo?.environment === "test_mode";
  const isBetaActive = billingConfig?.dodo?.betaMode === true;
  const ENABLE_PURCHASE_FOR_TESTING = import.meta.env.DEV || isTestMode;
  const DISABLE_PURCHASE_DURING_BETA = isBetaActive && !isPrivileged && !ENABLE_PURCHASE_FOR_TESTING;

  type PaymentMode = "prepaid" | "installments";
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("prepaid");
  const installmentsSelectable = true;
  const paymentToggleHint: string | null = null;

  type LearningLanguage = "en" | "de";
  const LEARNING_LANGUAGE_STORAGE_KEY = "learning-language";
  const [learningLanguage, setLearningLanguage] = useState<LearningLanguage | null>(() => {
    try {
      const stored = localStorage.getItem(LEARNING_LANGUAGE_STORAGE_KEY);
      if (stored === "en" || stored === "de") return stored;
    } catch {
      // ignore
    }
    return null;
  });

  const updateLearningLanguageChoice = (next: LearningLanguage) => {
    setLearningLanguage(next);
    try {
      localStorage.setItem(LEARNING_LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const scrollToLearningLanguageSelector = () => {
    try {
      const el = document.getElementById("learning-language-selector");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // ignore
    }
  };

  const requireLearningLanguageSelection = (): boolean => {
    if (learningLanguage === "en" || learningLanguage === "de") return true;
    toast.error(t("home.learningLanguage.requiredToast"));
    scrollToLearningLanguageSelector();
    return false;
  };

  type SubscriptionPlan = {
    id: "beta" | "intensive" | "balanced" | "standard" | "relaxed";
    name: string;
    months: number;
    price: number; // cents
    unitsPerWeek: number;
    paymentOptions?: {
      prepaidTotal: number;
      installmentsMonthly?: number;
      installmentsTotal?: number;
      installmentsUpliftPercent?: number;
    };
  };

  // Load plans from Convex
  const availablePlans = useQuery(api.subscriptions.getPlans) as SubscriptionPlan[] | undefined;
  const planById = useMemo(() => {
    const map = new Map<string, any>();
    if (availablePlans) {
      availablePlans.forEach(plan => map.set(plan.id, plan));
    }
    return map;
  }, [availablePlans]);

  // Load current subscription for logged-in users
  const currentSubscription = useQuery(
    api.subscriptions.getCurrent,
    user?.clerkId ? {} : "skip"
  );

  type PlanId = "intensive" | "balanced" | "standard" | "relaxed";
  const currentPlan: PlanId | null = (currentSubscription?.planType as PlanId | undefined) ?? null;
  const hasActiveSubscription = currentSubscription?.expiresAt && currentSubscription.expiresAt > Date.now();

  // Loading state for essential data
  const plansLoading = availablePlans === undefined;

  const dodoConfigured = billingConfig?.dodo?.configured === true;
  const createDodoCheckoutSession = useAction(api.subscriptions.createDodoCheckoutSession);

  // After successful signup, automatically continue with purchase (from localStorage)
  useEffect(() => {
    if (user?.clerkId && !loading) {
      const pendingPlan = localStorage.getItem('pendingPurchasePlan');
      const pendingMode = localStorage.getItem('pendingPaymentMode');
      
      if (pendingPlan) {
        // Safety guard: do not auto-open checkout unless a learning language was explicitly chosen.
        // (Normally ensured by CTA gating before signup.)
        try {
          const storedLearning = localStorage.getItem(LEARNING_LANGUAGE_STORAGE_KEY);
          if (storedLearning !== "en" && storedLearning !== "de") {
            toast.error(t("home.learningLanguage.requiredToast"));
            return;
          }
        } catch {
          toast.error(t("home.learningLanguage.requiredToast"));
          return;
        }

        // Clear from localStorage
        localStorage.removeItem('pendingPurchasePlan');
        localStorage.removeItem('pendingPaymentMode');
        
        // Restore payment mode
        if (pendingMode) {
          setPaymentMode(pendingMode as PaymentMode);
        }
        
        // Auto-trigger purchase after short delay
        setTimeout(() => {
          toast.success(t("billing.checkout.welcomeOpening"));
          void startPurchase(pendingPlan, pendingMode as PaymentMode);
        }, 1000);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clerkId, loading]);
  
  function getPlanMonths(planId: PlanId): number {
    const fallback: Record<PlanId, number> = {
      intensive: 3,
      balanced: 6,
      standard: 9,
      relaxed: 12,
    };
    const fromDb = Number((planById.get(planId) as any)?.months);
    return Number.isFinite(fromDb) && fromDb > 0 ? fromDb : fallback[planId];
  }

  // Determine plan relationship (current, upgrade, downgrade, choose).
  // IMPORTANT: Our FAQ promises "upgrade to a longer plan" and explicitly says downgrades are not available.
  const getPlanAction = (planId: PlanId): "current" | "upgrade" | "downgrade" | "choose" => {
    if (!hasActiveSubscription) return "choose";
    if (currentPlan === planId) return "current";
    if (!currentPlan) return "choose";
    
    const currentMonths = getPlanMonths(currentPlan);
    const targetMonths = getPlanMonths(planId);

    if (targetMonths > currentMonths) return "upgrade";
    if (targetMonths < currentMonths) return "downgrade";
    return "choose";
  };
  
  const getButtonText = (planId: PlanId): string => {
    const action = getPlanAction(planId);
    
    if (action === "current") {
      return t("home.pricing.cta.currentPlan");
    }

    if (action === "downgrade") {
      return t("home.pricing.cta.downgradeNotAvailable");
    }
    
    if (hasActiveSubscription && action === "upgrade") {
      return t("home.pricing.cta.upgradePlan");
    }
    
    // No active subscription -> "Choose Plan"
    return t('home.pricing.choosePlan');
  };

  const handlePlanCTA = async (planId: PlanId) => {
    const action = getPlanAction(planId);
    if (action === "current" || action === "downgrade") return;

    // Logged-in users should manage upgrades from inside the app.
    if (hasActiveSubscription) {
      setLocation("/profile");
      return;
    }

    await startPurchase(planId);
  };
  
  const getCardClasses = (planId: PlanId): string => {
    const action = getPlanAction(planId);
    const base = "border-2 transition-all hover:shadow-xl relative";
    
    // Current plan: green highlighted
    if (action === "current") {
      return `${base} border-green-500 shadow-lg shadow-green-200 bg-green-50/30`;
    }
    
    // All other plans when user has active subscription: normal (upgradeable)
    if (hasActiveSubscription) {
      return `${base} hover:border-primary`;
    }
    
    // No active subscription: normal
    return `${base} hover:border-primary`;
  };
  
  const startPurchase = async (planId: string, modeOverride?: PaymentMode) => {
    const effectiveMode = modeOverride || paymentMode;

    if (DISABLE_PURCHASE_DURING_BETA) {
      toast.info(t("billing.paidPlansAfterBeta"));
      return;
    }

    if (!ENABLE_PURCHASE_FOR_TESTING && !isPrivileged) {
      toast.info(t("billing.paidPlansAfterBeta"));
      return;
    }
    
    // Check if user is logged in - if not, redirect to sign-up
    if (!user?.clerkId) {
      if (!requireLearningLanguageSelection()) return;
      // Store plan selection in localStorage to resume after signup
      localStorage.setItem('pendingPurchasePlan', planId);
      localStorage.setItem('pendingPaymentMode', effectiveMode);
      toast.info(t("billing.signupToContinue"));
      setLocation("/sign-up?redirect_url=/");
      return;
    }
    
    if (!dodoConfigured) {
      toast.error(t("billing.dodoNotConfigured"));
      return;
    }

    try {
      // Ensure SDK is initialized right before opening
      const mode = billingConfig?.dodo?.environment === "live_mode" ? "live" : "test";
      initDodoPayments({ mode });

      const session = await createDodoCheckoutSession({
        planType: planId as any,
        paymentMode: effectiveMode,
        flow: "purchase",
        // NOTE: Dodo will redirect to return_url even if the payment is not successful
        // (e.g. user closes checkout, card declined). Never encode "success" in the URL.
        returnUrl: `${window.location.origin}/dashboard?purchase=return`,
        source: "home_page",
        beta50: false,
        language: i18n.language,
      });
      await openDodoCheckout({ checkoutUrl: session.checkoutUrl, mode });
    } catch (error: any) {
      toast.error(t("billing.purchaseError", { error: error?.message || String(error) }));
    }
  };
  
  // Language is controlled globally (LanguageProvider + DB user setting).
  
  // Fetch data from database
  const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);
  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" });
  
  // Generate modules data for landing page from database
  const MODULES_DATA = useMemo(() => {
    if (!dbModules || dbModules.length === 0 || !courseVocabulary) return [];

    const bySlug = new Map<string, any>();
    for (const m of dbModules as any[]) {
      const slug = String((m as any)?.slug ?? "");
      if (slug) bySlug.set(slug, m);
    }

    const base = buildLandingModuleCards({
      modules: dbModules as any,
      unitsEn: dbUnitsEn as any,
      vocab: courseVocabulary as any,
    });

    // Keep existing shape used throughout Home.tsx
    return base.map((m) => ({
      // Use slug as stable key to look up multilingual fields.
      // (buildLandingModuleCards focuses on EN; we enrich here from the DB.)
      id: m.id,
      number: m.number,
      title: m.title,
      titleEnglish: m.title,
      titleGerman: String((bySlug.get(m.id) as any)?.titleDe ?? ""),
      description: m.description,
      descriptionGerman: String((bySlug.get(m.id) as any)?.descriptionDe ?? ""),
      unitCount: m.unitCount,
      vocabCount: m.vocabCount,
    }));
  }, [dbModules, courseVocabulary, dbUnitsEn]);

  const HOME_COUNTS = useMemo(() => {
    return computeLandingCounts({
      modules: dbModules as any,
      unitsEn: dbUnitsEn as any,
      vocab: courseVocabulary as any,
    });
  }, [dbModules, dbUnitsEn, courseVocabulary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      {/* Hero Section */}
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={APP_LOGO} className="h-8 w-8 rounded-md object-cover" alt="Serbian AI Tutor" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t('home.header.title')}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {!isAuthenticated ? (
                <Select
                  value={displayLanguage}
                  onValueChange={(v) => setDisplayLanguage(v as "en" | "de")}
                >
                  <SelectTrigger className="w-[140px]" aria-label={t("settings.language")}>
                    <SelectValue placeholder={t("settings.language")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}

              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button className="bg-primary hover:bg-primary/90">{t('home.header.dashboard')}</Button>
                </Link>
              ) : (
                <>
                  {showWaitlist && (
                    <Button 
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10"
                      onClick={() => setIsWaitlistModalOpen(true)}
                    >
                      {t("waitlist.title")}
                    </Button>
                  )}
                  <Link href="/sign-in">
                    <Button className="bg-primary hover:bg-primary/90">
                      {t('home.header.login')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <a href="#beta-registration" className="inline-block px-4 py-2 bg-accent/20 rounded-full text-primary font-semibold mb-4 border border-accent/40 cursor-pointer hover:opacity-80 transition-opacity">
            {t('home.hero.badge')}
          </a>
          <h2 className="text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {t('home.hero.title')}
            </span>
            <br />
            {t('home.hero.titleHighlight')}
          </h2>
          <p className="text-2xl font-semibold text-foreground/80 max-w-2xl mx-auto">
            {t('home.hero.subtitle')}
          </p>
          <p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto" 
            dangerouslySetInnerHTML={{
              __html: showWaitlist
                ? t("home.hero.descriptionWaitlist")
                : t("home.hero.description", HOME_COUNTS),
            }}
          />
          <div className="flex gap-4 justify-center pt-4">
            {!isAuthenticated ? (
              <>
                {showWaitlist && (
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90 text-lg px-8"
                    onClick={() => setIsWaitlistModalOpen(true)}
                  >
                    {t("waitlist.title")}
                  </Button>
                )}
                {!showWaitlist && (
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-lg px-8"
                    asChild
                  >
                    <a href="#beta-registration">{t('home.hero.ctaPrimary')}</a>
                  </Button>
                )}
                <Link href="/sign-in">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="text-lg px-8 border-primary text-primary hover:bg-primary/10"
                  >
                    {t('home.header.login')}
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-lg px-8"
                >
                  {t('home.header.dashboard')}
                </Button>
              </Link>
            )}
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <a href="#units">{t('home.hero.ctaSecondary')}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full bg-white/50">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.structuredPlan.title')}</CardTitle>
              <CardDescription>
                {showWaitlist
                  ? t("home.features.structuredPlan.descWaitlist")
                  : t("home.features.structuredPlan.desc", HOME_COUNTS)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Brain className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.aiProfessor.title')}</CardTitle>
              <CardDescription>
                {t('home.features.aiProfessor.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Trophy className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.gamification.title')}</CardTitle>
              <CardDescription>
                {t('home.features.gamification.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.progress.title')}</CardTitle>
              <CardDescription>
                {t('home.features.progress.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.vocabulary.title')}</CardTitle>
              <CardDescription>
                {showWaitlist
                  ? t("home.features.vocabulary.descWaitlist")
                  : t("home.features.vocabulary.desc", HOME_COUNTS)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Volume2 className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t("home.features.audio.title")}</CardTitle>
              <CardDescription>{t("home.features.audio.desc")}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <ListTodo className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t("home.features.wishlist.title")}</CardTitle>
              <CardDescription>{t("home.features.wishlist.desc")}</CardDescription>
            </CardHeader>
          </Card>
          </div>
        </div>
      </section>

      {/* Pricing, Upgrade Policy & FAQ Section */}
      {/* Flexible Duration Section */}
      <section id="pricing" className="container py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h3 className="text-4xl font-bold">{t('home.pricing.title')}</h3>
            <p 
              className="text-xl text-muted-foreground" 
              dangerouslySetInnerHTML={{ __html: t('home.pricing.subtitle') }}
            />
          </div>

          {/* Learning Language (required before signup/purchase) */}
          {!isAuthenticated ? (
            <Card id="learning-language-selector" className="border-2">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{t("home.learningLanguage.title")}</CardTitle>
                <CardDescription>{t("home.learningLanguage.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 flex flex-col items-center gap-3">
                <RadioGroup
                  value={learningLanguage ?? ""}
                  onValueChange={(value) => {
                    if (value !== "en" && value !== "de") return;
                    updateLearningLanguageChoice(value);
                  }}
                  className="grid w-full max-w-2xl gap-3 sm:grid-cols-2"
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

                <div id="learning-language-note" className="text-xs text-muted-foreground text-center max-w-2xl">
                  {t("home.learningLanguage.note")}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Global Payment Mode Toggle */}
          <div className="flex flex-col items-center gap-2">
            <ToggleGroup
              type="single"
              value={paymentMode}
              onValueChange={(value) => {
                if (!value) return;
                setPaymentMode(value as PaymentMode);
              }}
              size="sm"
              className="bg-muted p-1 rounded-lg"
            >
              <ToggleGroupItem value="prepaid" className="px-3">
                {t("home.pricing.paymentToggle.payOnce")}
              </ToggleGroupItem>
              <ToggleGroupItem value="installments" disabled={!installmentsSelectable} className="px-3">
                {t("home.pricing.paymentToggle.payMonthly")}
              </ToggleGroupItem>
            </ToggleGroup>
            {paymentToggleHint ? (
              <div className="text-xs text-muted-foreground text-center">{paymentToggleHint}</div>
            ) : null}
          </div>
          
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {/* Intensive Plan */}
            <Card className={getCardClasses("intensive")}>
              {getPlanAction("intensive") === "current" && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {t("home.pricing.currentPlanBadge")}
                  </span>
                </div>
              )}
              <CardHeader className="text-left pb-4">
                <Sparkles className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.intensive.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.intensive.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.intensive.audience')}</p>
                <div className="mt-4 space-y-2">
                  {/* Pay once price */}
                  <div>
                    <div className={`font-bold ${paymentMode === "prepaid" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                      {plansLoading ? (
                        <span className="animate-pulse">{t("common.loading")}</span>
                      ) : (
                        <>€{(((planById.get("intensive") as any)?.paymentOptions?.prepaidTotal ?? 0) / 100).toFixed(2)}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('home.pricing.intensive.payment')}
                    </div>
                  </div>
                  
                  {/* Pay monthly price */}
                  {installmentsSelectable && (
                    <div>
                      <div className={`font-bold ${paymentMode === "installments" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.loading")}</span>
                        ) : (
                          <>€{(((planById.get("intensive") as any)?.paymentOptions?.installmentsMonthly ?? 0) / 100).toFixed(2)}</>
                        )}
                        <span className="text-sm text-muted-foreground">{t("home.pricing.perMonth")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.calculating")}</span>
                        ) : (
                          t("home.pricing.installmentsTotalLine", {
                            total: (((planById.get("intensive") as any)?.paymentOptions?.installmentsTotal ?? 0) / 100).toFixed(2),
                            months: (planById.get("intensive") as any)?.months ?? 3,
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.intensive.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature5')}</span>
                  </li>
                </ul>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        className="w-full"
                        disabled={
                          (!user?.clerkId && !learningLanguage) ||
                          DISABLE_PURCHASE_DURING_BETA ||
                          (ENABLE_PURCHASE_FOR_TESTING && user?.clerkId && (getPlanAction("intensive") === "current" || getPlanAction("intensive") === "downgrade"))
                        }
                        onClick={() => void handlePlanCTA("intensive")}
                        variant={getPlanAction("intensive") === "current" ? "secondary" : "default"}
                      >
                        {getButtonText("intensive")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {DISABLE_PURCHASE_DURING_BETA && (
                    <TooltipContent>
                      <p>{t("billing.paidPlansAfterBeta")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                {(showWaitlist && !ENABLE_PURCHASE_FOR_TESTING) || DISABLE_PURCHASE_DURING_BETA ? (
                  <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
                ) : null}
              </CardContent>
            </Card>

            {/* Balanced Plan */}
            <Card className={getCardClasses("balanced")}>
              {getPlanAction("balanced") === "current" && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {t("home.pricing.currentPlanBadge")}
                  </span>
                </div>
              )}
              <CardHeader className="text-left pb-4">
                <Target className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.balanced.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.balanced.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.balanced.audience')}</p>
                <div className="mt-4 space-y-2">
                  {/* Pay once price */}
                  <div>
                    <div className={`font-bold ${paymentMode === "prepaid" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                      {plansLoading ? (
                        <span className="animate-pulse">{t("common.loading")}</span>
                      ) : (
                        <>€{(((planById.get("balanced") as any)?.paymentOptions?.prepaidTotal ?? 0) / 100).toFixed(2)}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('home.pricing.balanced.payment')}
                    </div>
                  </div>
                  
                  {/* Pay monthly price */}
                  {installmentsSelectable && (
                    <div>
                      <div className={`font-bold ${paymentMode === "installments" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.loading")}</span>
                        ) : (
                          <>€{(((planById.get("balanced") as any)?.paymentOptions?.installmentsMonthly ?? 0) / 100).toFixed(2)}</>
                        )}
                        <span className="text-sm text-muted-foreground">{t("home.pricing.perMonth")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.calculating")}</span>
                        ) : (
                          t("home.pricing.installmentsTotalLine", {
                            total: (((planById.get("balanced") as any)?.paymentOptions?.installmentsTotal ?? 0) / 100).toFixed(2),
                            months: (planById.get("balanced") as any)?.months ?? 6,
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.balanced.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature5')}</span>
                  </li>
                </ul>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        className="w-full"
                        disabled={
                          (!user?.clerkId && !learningLanguage) ||
                          DISABLE_PURCHASE_DURING_BETA ||
                          (ENABLE_PURCHASE_FOR_TESTING && user?.clerkId && (getPlanAction("balanced") === "current" || getPlanAction("balanced") === "downgrade"))
                        }
                        onClick={() => void handlePlanCTA("balanced")}
                        variant={getPlanAction("balanced") === "current" ? "secondary" : "default"}
                      >
                        {getButtonText("balanced")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {DISABLE_PURCHASE_DURING_BETA && (
                    <TooltipContent>
                      <p>{t("billing.paidPlansAfterBeta")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                {(showWaitlist && !ENABLE_PURCHASE_FOR_TESTING) || DISABLE_PURCHASE_DURING_BETA ? (
                  <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
                ) : null}
              </CardContent>
            </Card>

            {/* Standard Plan (Most Popular - Best Value) */}
            <Card className={getPlanAction("standard") === "current" ? getCardClasses("standard") : "border-4 border-primary shadow-2xl scale-105 relative"}>
              {getPlanAction("standard") === "current" ? (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {t("home.pricing.currentPlanBadge")}
                  </span>
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">{t('home.pricing.standard.badge')}</span>
                </div>
              )}
              <CardHeader className="text-left pb-4 pt-8">
                <BookOpen className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.standard.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.standard.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.standard.audience')}</p>
                <div className="mt-4 space-y-2">
                  {/* Pay once price */}
                  <div>
                    <div className={`font-bold ${paymentMode === "prepaid" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                      {plansLoading ? (
                        <span className="animate-pulse">{t("common.loading")}</span>
                      ) : (
                        <>€{(((planById.get("standard") as any)?.paymentOptions?.prepaidTotal ?? 0) / 100).toFixed(2)}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('home.pricing.standard.payment')}
                    </div>
                  </div>
                  
                  {/* Pay monthly price */}
                  {installmentsSelectable && (
                    <div>
                      <div className={`font-bold ${paymentMode === "installments" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.loading")}</span>
                        ) : (
                          <>€{(((planById.get("standard") as any)?.paymentOptions?.installmentsMonthly ?? 0) / 100).toFixed(2)}</>
                        )}
                        <span className="text-sm text-muted-foreground">{t("home.pricing.perMonth")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.calculating")}</span>
                        ) : (
                          t("home.pricing.installmentsTotalLine", {
                            total: (((planById.get("standard") as any)?.paymentOptions?.installmentsTotal ?? 0) / 100).toFixed(2),
                            months: (planById.get("standard") as any)?.months ?? 9,
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.standard.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature5')}</span>
                  </li>
                </ul>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        className="w-full bg-primary"
                        disabled={
                          (!user?.clerkId && !learningLanguage) ||
                          DISABLE_PURCHASE_DURING_BETA ||
                          (ENABLE_PURCHASE_FOR_TESTING && user?.clerkId && (getPlanAction("standard") === "current" || getPlanAction("standard") === "downgrade"))
                        }
                        onClick={() => void handlePlanCTA("standard")}
                        variant={getPlanAction("standard") === "current" ? "secondary" : "default"}
                      >
                        {getButtonText("standard")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {DISABLE_PURCHASE_DURING_BETA && (
                    <TooltipContent>
                      <p>{t("billing.paidPlansAfterBeta")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                {(showWaitlist && !ENABLE_PURCHASE_FOR_TESTING) || DISABLE_PURCHASE_DURING_BETA ? (
                  <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
                ) : null}
              </CardContent>
            </Card>

            {/* Relaxed Plan */}
            <Card className={getCardClasses("relaxed")}>
              {getPlanAction("relaxed") === "current" && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
                    {t("home.pricing.currentPlanBadge")}
                  </span>
                </div>
              )}
              <CardHeader className="text-left pb-4">
                <Clock className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.relaxed.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.relaxed.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.relaxed.audience')}</p>
                <div className="mt-4 space-y-2">
                  {/* Pay once price */}
                  <div>
                    <div className={`font-bold ${paymentMode === "prepaid" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                      {plansLoading ? (
                        <span className="animate-pulse">{t("common.loading")}</span>
                      ) : (
                        <>€{(((planById.get("relaxed") as any)?.paymentOptions?.prepaidTotal ?? 0) / 100).toFixed(2)}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t('home.pricing.relaxed.payment')}
                    </div>
                  </div>
                  
                  {/* Pay monthly price */}
                  {installmentsSelectable && (
                    <div>
                      <div className={`font-bold ${paymentMode === "installments" ? "text-3xl text-primary" : "text-xl text-muted-foreground"}`}>
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.loading")}</span>
                        ) : (
                          <>€{(((planById.get("relaxed") as any)?.paymentOptions?.installmentsMonthly ?? 0) / 100).toFixed(2)}</>
                        )}
                        <span className="text-sm text-muted-foreground">{t("home.pricing.perMonth")}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plansLoading ? (
                          <span className="animate-pulse">{t("common.calculating")}</span>
                        ) : (
                          t("home.pricing.installmentsTotalLine", {
                            total: (((planById.get("relaxed") as any)?.paymentOptions?.installmentsTotal ?? 0) / 100).toFixed(2),
                            months: (planById.get("relaxed") as any)?.months ?? 12,
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.relaxed.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-700 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature5')}</span>
                  </li>
                </ul>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button
                        className="w-full"
                        disabled={
                          (!user?.clerkId && !learningLanguage) ||
                          DISABLE_PURCHASE_DURING_BETA ||
                          (ENABLE_PURCHASE_FOR_TESTING && user?.clerkId && (getPlanAction("relaxed") === "current" || getPlanAction("relaxed") === "downgrade"))
                        }
                        onClick={() => void handlePlanCTA("relaxed")}
                        variant={getPlanAction("relaxed") === "current" ? "secondary" : "default"}
                      >
                        {getButtonText("relaxed")}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {DISABLE_PURCHASE_DURING_BETA && (
                    <TooltipContent>
                      <p>{t("billing.paidPlansAfterBeta")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                {(showWaitlist && !ENABLE_PURCHASE_FOR_TESTING) || DISABLE_PURCHASE_DURING_BETA ? (
                  <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Policy Section */}
          <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <div className="text-center space-y-4">
              <div className="inline-block p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900">{t('home.pricing.upgrade.title')}</h4>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                {t('home.pricing.upgrade.subtitle')}
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8 text-left">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature1.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature1.desc')}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature2.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature2.desc')}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature3.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature3.desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">{t('home.faq.title')}</h3>
              <p className="text-lg text-gray-600">{t('home.faq.subtitle')}</p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {/* Q1: Can I upgrade? */}
              <AccordionItem value="item-1" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('home.faq.q1.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    {t('home.faq.q1.answer')}
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q1.keyPoints')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q1.point1')}</li>
                      <li>{t('home.faq.q1.point2')}</li>
                      <li>{t('home.faq.q1.point3')}</li>
                      <li>{t('home.faq.q1.point4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q2: Can I downgrade? */}
              <AccordionItem value="item-2" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    {t('home.faq.q2.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    {t('home.faq.q2.answer')}
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q2.why')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q2.reason1')}</li>
                      <li>{t('home.faq.q2.reason2')}</li>
                      <li>{t('home.faq.q2.reason3')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q3: What if I don't finish in time? */}
              <AccordionItem value="item-3" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('home.faq.q3.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    {t('home.faq.q3.answer')}
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q3.options')}</p>
                    <ul className="space-y-1 text-sm">
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option1') }} />
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option2') }} />
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option3') }} />
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q4: Subscription or one-time? */}
              <AccordionItem value="item-4" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {t('home.faq.q4.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p
                    dangerouslySetInnerHTML={{
                      __html: showWaitlist
                        ? t("home.faq.q4.answerWaitlist")
                        : t("home.faq.q4.answer", HOME_COUNTS),
                    }}
                  />
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check1')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check2')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check3')}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q5: Same content? */}
              <AccordionItem value="item-5" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    {t('home.faq.q5.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">
                    {t('home.faq.q5.answer')}
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>
                        {showWaitlist
                          ? t("home.faq.q5.item1Waitlist")
                          : t("home.faq.q5.item1", HOME_COUNTS)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>
                        {showWaitlist
                          ? t("home.faq.q5.item2Waitlist")
                          : t("home.faq.q5.item2", HOME_COUNTS)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item3')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item4')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item5')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item6')}</span>
                    </div>
                  </div>
                  <p className="mt-4 font-semibold text-gray-900">
                    {t('home.faq.q5.note')}
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Q6: Refund policy */}
              <AccordionItem value="item-6" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    {t('home.faq.q6.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q6.answer') }} />
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q6.policy')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q6.rule1')}</li>
                      <li>{t('home.faq.q6.rule2')}</li>
                      <li>{t('home.faq.q6.rule3')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q7: After expiration */}
              <AccordionItem value="item-7" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    {t('home.faq.q7.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q7.answer') }} />
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q7.after')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q7.point1')}</li>
                      <li>{t('home.faq.q7.point2')}</li>
                      <li>{t('home.faq.q7.point3')}</li>
                      <li>{t('home.faq.q7.point4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q8: Which plan? */}
              <AccordionItem value="item-8" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    {t('home.faq.q8.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-4">{t('home.faq.q8.intro')}</p>
                  <div className="space-y-3">
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.intensive.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.intensive.desc')}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.balanced.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.balanced.desc')}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border-2 border-primary">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.standard.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.standard.desc')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.relaxed.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.relaxed.desc')}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm italic" dangerouslySetInnerHTML={{ __html: t('home.faq.q8.note') }} />
                </AccordionContent>
              </AccordionItem>

              {/* Q9: Beta discount */}
              <AccordionItem value="item-9" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t('home.faq.q9.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q9.answer') }} />
                  <div className="bg-yellow-50 p-4 rounded-lg mt-3 border-2 border-yellow-200">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q9.benefits')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q9.benefit1')}</li>
                      <li>{t('home.faq.q9.benefit2')}</li>
                      <li>{t('home.faq.q9.benefit3')}</li>
                      <li>{t('home.faq.q9.benefit4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q10: How to upgrade */}
              <AccordionItem value="item-10" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    {t('home.faq.q10.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">{t('home.faq.q10.intro')}</p>
                  <ol className="space-y-2 ml-4">
                    <li>{t('home.faq.q10.step1')}</li>
                    <li>{t('home.faq.q10.step2')}</li>
                    <li>{t('home.faq.q10.step3')}</li>
                    <li>{t('home.faq.q10.step4')}</li>
                    <li>{t('home.faq.q10.step5')}</li>
                  </ol>
                  <p className="mt-4">
                    {t('home.faq.q10.note')}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </div>

          {/* Beta Tester Banner */}
          {!showWaitlist && (
            <Card className="mt-12 border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-2xl">
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <div className="inline-block">
                    <span className="text-5xl">🎁</span>
                  </div>
                  <h4 className="text-3xl font-bold text-yellow-900">{t('home.beta.banner.title')}</h4>
                  <p 
                    className="text-lg text-yellow-800 max-w-3xl mx-auto" 
                    dangerouslySetInnerHTML={{ __html: t('home.beta.banner.subtitle') }}
                  />
                  <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-6">
                    <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                      <div className="text-2xl mb-2">✓</div>
                      <h5 className="font-semibold text-yellow-900 mb-1">{t('home.beta.banner.feature1.title')}</h5>
                      <p className="text-sm text-yellow-800">{t('home.beta.banner.feature1.desc')}</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                      <div className="text-2xl mb-2">💰</div>
                      <h5 className="font-semibold text-yellow-900 mb-1">{t('home.beta.banner.feature2.title')}</h5>
                      <p className="text-sm text-yellow-800">{t('home.beta.banner.feature2.desc')}</p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <a href="#beta-registration">
                      <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg px-8">
                        {t('home.beta.banner.cta')}
                      </Button>
                    </a>
                  </div>
                  <p className="text-xs text-yellow-700">{t('home.beta.banner.note')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Modules Section */}
      <section id="units" className="w-full bg-gradient-to-br from-red-50 via-blue-50/30 to-white">
        <div className="container py-20">
          <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h3 className="text-4xl font-bold">{t('home.units.title')}</h3>
            <p 
              className="text-xl text-muted-foreground" 
              dangerouslySetInnerHTML={{
                __html: showWaitlist
                  ? t("home.units.subtitleWaitlist")
                  : t("home.units.subtitle", HOME_COUNTS),
              }}
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES_DATA.map((module: any) => {
              const pickText = (preferred: unknown, fallback: unknown): string => {
                const p = typeof preferred === "string" ? preferred.trim() : "";
                if (p) return preferred as string;
                return typeof fallback === "string" ? fallback : "";
              };

              const displayTitle =
                displayLanguage === "de"
                  ? pickText(module.titleGerman, module.titleEnglish)
                  : pickText(module.titleEnglish, module.titleGerman);
              const displayDescription =
                displayLanguage === "de"
                  ? pickText(module.descriptionGerman, module.description)
                  : pickText(module.description, module.descriptionGerman);
              
              return (
              <Card 
                key={module.id} 
                className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-xl hover:scale-105 bg-white"
              >
                <CardHeader>
                  <div className="flex-1">
                      <div className="text-sm font-semibold text-primary mb-1">
                        {t('home.units.module', { number: module.number })}
                      </div>
                      <CardTitle className="text-lg">{displayTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{displayDescription}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span>
                        {t("home.units.lessonsPlaceholder")}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
          </div>
        </div>
      </section>

      {/* Beta Registration / Sign Up Section - Only show if not in waitlist mode OR user is privileged */}
      {showBetaRegistration && (
        <section id="beta-registration" className="container py-20">
          <Card className="max-w-2xl mx-auto border-2 border-secondary shadow-2xl shadow-blue-200">
            <CardHeader className="text-center bg-gradient-to-r from-red-50 via-white to-blue-50">
              <div className="inline-block px-4 py-2 bg-accent/30 rounded-full text-primary font-bold mb-4 border-2 border-accent">
                {t('home.beta.discount')}
              </div>
              <CardTitle className="text-3xl">
                {t('home.beta.title')}
              </CardTitle>
              <CardDescription className="text-lg">
                {t('home.beta.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {!isAuthenticated ? (
                <div className="space-y-6 flex flex-col items-center">
                  {/* Program selector directly in registration card */}
                  <div className="w-full space-y-3">
                    <p className="text-sm font-semibold text-center">{t("home.learningLanguage.title")}</p>
                    <p className="text-xs text-muted-foreground text-center">{t("home.learningLanguage.hint")}</p>
                    <RadioGroup
                      value={learningLanguage ?? ""}
                      onValueChange={(value) => {
                        if (value !== "en" && value !== "de") return;
                        updateLearningLanguageChoice(value);
                      }}
                      className="grid w-full max-w-2xl gap-3 sm:grid-cols-2"
                      aria-describedby="beta-learning-language-note"
                    >
                      <div className="relative">
                        <RadioGroupItem value="de" id="beta-learning-language-de" className="peer sr-only" />
                        <Label
                          htmlFor="beta-learning-language-de"
                          className="flex items-center justify-center rounded-xl border-2 bg-white/70 px-4 py-4 text-sm font-semibold shadow-sm transition-all hover:border-primary/60 hover:bg-white peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent/20 peer-data-[state=checked]:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background cursor-pointer select-none"
                        >
                          {t("home.learningLanguage.option.de")}
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="en" id="beta-learning-language-en" className="peer sr-only" />
                        <Label
                          htmlFor="beta-learning-language-en"
                          className="flex items-center justify-center rounded-xl border-2 bg-white/70 px-4 py-4 text-sm font-semibold shadow-sm transition-all hover:border-primary/60 hover:bg-white peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent/20 peer-data-[state=checked]:shadow-md peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background cursor-pointer select-none"
                        >
                          {t("home.learningLanguage.option.en")}
                        </Label>
                      </div>
                    </RadioGroup>
                    <div id="beta-learning-language-note" className="text-xs text-muted-foreground text-center max-w-2xl">
                      {t("home.learningLanguage.note")}
                    </div>
                  </div>

                  {/* Clerk SignUp — only visible once program is selected */}
                  {learningLanguage && (
                    <>
                      <SignUp
                        routing="virtual"
                        signInUrl="/sign-in"
                      />
                      <p className="text-sm text-center text-muted-foreground max-w-xl">
                        {t('home.beta.signupNote')}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold">
                    {t('home.beta.authenticated')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('home.beta.authenticatedDesc')}
                  </p>
                  <Link href="/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-lg">
                      {t('home.beta.dashboard')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      </main>
      {/* Footer */}
      <AppFooter />

      {showWaitlist && (
        <Suspense fallback={null}>
          <WaitlistModal
            isOpen={isWaitlistModalOpen}
            onClose={() => setIsWaitlistModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
