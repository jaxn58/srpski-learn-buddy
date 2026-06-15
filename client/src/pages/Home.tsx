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
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles, Check, HelpCircle, DollarSign, RefreshCw, Shield, Calendar, Zap, Loader2, Volume2, ListTodo, Minus, ChevronDown, Camera, Layers, GraduationCap, ArrowRight } from "lucide-react";
import { APP_LOGO } from "@/const";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState, lazy, Suspense, Fragment } from "react";
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

  // Feature-compare accordion state (mobile): which tier is currently expanded
  const [openCompareTier, setOpenCompareTier] = useState<string | null>(null);
  
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

  // ===== 4-tier × 4-duration plan model (Phase 5, June 2026) =====
  type TierId = "course" | "standalone" | "course_ai" | "course_ai_pro";
  type DurationMonths = 3 | 6 | 12;
  type CompoundPlanId = `${TierId}_${DurationMonths}m`;

  const TIER_IDS: readonly TierId[] = ["course", "standalone", "course_ai", "course_ai_pro"] as const;
  const DURATIONS: readonly DurationMonths[] = [3, 6, 12] as const;

  // Tier configuration: presentation metadata only. Backend stays the
  // single source of truth for prices/features – this drives icons, ordering
  // and which tier gets the "most popular" highlight.
  const TIER_META: Record<TierId, { icon: typeof Sparkles; highlight: boolean; allowsInstallments: boolean }> = {
    course:        { icon: BookOpen,  highlight: false, allowsInstallments: false },
    standalone:    { icon: Sparkles,  highlight: false, allowsInstallments: true },
    course_ai:     { icon: Target,    highlight: false, allowsInstallments: true },
    course_ai_pro: { icon: TrendingUp,highlight: true,  allowsInstallments: true },
  };

  // Feature comparison cell value:
  //  - true   => feature fully included (rendered as check)
  //  - false  => not included (rendered as dash)
  //  - "teaser" => included as limited preview (1-2 AI questions / 24h)
  type FeatureCell = boolean | "teaser";
  type FeatureKey =
    | "courseContent"
    | "aiBuddy"
    | "contextLinking"
    | "documents"
    | "photoScan"
    | "topups";

  const FEATURE_KEYS: readonly FeatureKey[] = [
    "courseContent",
    "aiBuddy",
    "contextLinking",
    "documents",
    "photoScan",
    "topups",
  ] as const;

  const FEATURE_MATRIX: Record<FeatureKey, Record<TierId, FeatureCell>> = {
    courseContent:  { course: true,     standalone: false, course_ai: true,     course_ai_pro: true  },
    aiBuddy:        { course: "teaser", standalone: true,  course_ai: true,     course_ai_pro: true  },
    contextLinking: { course: "teaser", standalone: false, course_ai: true,     course_ai_pro: true  },
    documents:      { course: false,    standalone: true,  course_ai: false,    course_ai_pro: true  },
    photoScan:      { course: false,    standalone: true,  course_ai: false,    course_ai_pro: true  },
    topups:         { course: false,    standalone: true,  course_ai: true,     course_ai_pro: true  },
  };

  type SubscriptionPlan = {
    id: "beta" | CompoundPlanId;
    name: string;
    tier?: TierId;
    months: number;
    durationMonths?: number;
    price: number; // cents
    unitsPerWeek?: number;
    allowsInstallments?: boolean;
    paymentOptions?: {
      prepaidTotal: number;
      installmentsMonthly?: number;
      installmentsTotal?: number;
      installmentsUpliftPercent?: number;
    };
  };

  // Load plans from Convex
  const availablePlans = useQuery(api.subscriptions.getPlans) as SubscriptionPlan[] | undefined;
  // Top-up packs (public read) for the AI Energy section on the landing page
  const topupPacks = useQuery(api.subscriptions.getTopupPacks);
  // Public energy quotas + cost examples (per tier monthly quota, "typical chat" cost etc.)
  const energyInfo = useQuery(api.subscriptions.getPublicEnergyInfo);

  // Upgrade-policy examples: 3 concrete scenarios with the actual price delta
  // computed from current plan data (no hardcoded numbers, no fake "max €50" claims).
  type UpgradeExample = {
    key: "tierUp" | "tierUpPro" | "durationUp";
    fromTier: TierId;
    fromMonths: DurationMonths;
    toTier: TierId;
    toMonths: DurationMonths;
    deltaCents: number;
  };
  const planByCompoundId = useMemo(() => {
    const map = new Map<string, SubscriptionPlan>();
    if (availablePlans) {
      availablePlans.forEach((plan) => map.set(plan.id, plan));
    }
    return map;
  }, [availablePlans]);

  // Build compound id (e.g. "course_ai_pro_12m") from (tier, months).
  const buildPlanId = (tier: TierId, months: DurationMonths): CompoundPlanId =>
    `${tier}_${months}m` as CompoundPlanId;

  // Derive 3 upgrade scenarios with real-data deltas (no hardcoded prices).
  const upgradeExamples: UpgradeExample[] = useMemo(() => {
    const scenarios: Omit<UpgradeExample, "deltaCents">[] = [
      { key: "tierUp",     fromTier: "course",    fromMonths: 6,  toTier: "course_ai",     toMonths: 6  },
      { key: "tierUpPro",  fromTier: "course_ai", fromMonths: 12, toTier: "course_ai_pro", toMonths: 12 },
      { key: "durationUp", fromTier: "course_ai", fromMonths: 3,  toTier: "course_ai",     toMonths: 12 },
    ];
    return scenarios.map((s) => {
      const from = planByCompoundId.get(`${s.fromTier}_${s.fromMonths}m`);
      const to = planByCompoundId.get(`${s.toTier}_${s.toMonths}m`);
      const fromPrice = from?.paymentOptions?.prepaidTotal ?? from?.price ?? 0;
      const toPrice = to?.paymentOptions?.prepaidTotal ?? to?.price ?? 0;
      return { ...s, deltaCents: Math.max(toPrice - fromPrice, 0) };
    });
  }, [planByCompoundId]);

  // Parse a plan id string into (tier, months) – tolerant of legacy/unknown ids.
  // Returns null for "beta" or unrecognized strings.
  const parsePlanType = (raw: string | null | undefined): { tier: TierId; months: number } | null => {
    if (!raw) return null;
    // Longest tier prefix first so "course_ai_pro" wins over "course_ai" / "course"
    const tiers: TierId[] = ["course_ai_pro", "course_ai", "standalone", "course"];
    for (const tier of tiers) {
      const prefix = `${tier}_`;
      if (raw.startsWith(prefix)) {
        const tail = raw.slice(prefix.length).replace(/m$/, "");
        const months = parseInt(tail, 10);
        if (Number.isFinite(months)) return { tier, months };
      }
    }
    // Legacy compound ids (buddy/basic/full) – map onto canonical tiers.
    const legacyMap: Record<string, TierId> = { buddy: "standalone", basic: "course_ai", full: "course_ai_pro" };
    for (const [legacy, canonical] of Object.entries(legacyMap)) {
      const prefix = `${legacy}_`;
      if (raw.startsWith(prefix)) {
        const tail = raw.slice(prefix.length).replace(/m$/, "");
        const months = parseInt(tail, 10);
        if (Number.isFinite(months)) return { tier: canonical, months };
      }
    }
    return null;
  };

  // Load current subscription for logged-in users
  const currentSubscription = useQuery(
    api.subscriptions.getCurrent,
    user?.clerkId ? {} : "skip"
  );

  const parsedCurrent = parsePlanType(currentSubscription?.planType ?? null);
  const currentTier: TierId | null = parsedCurrent?.tier ?? null;
  const currentMonths: number | null = parsedCurrent?.months ?? null;
  const hasActiveSubscription = Boolean(
    currentSubscription?.expiresAt && currentSubscription.expiresAt > Date.now()
  );

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
  
  // Determine plan relationship for a specific (tier, months) cell.
  // IMPORTANT: Our FAQ promises "upgrade to a longer plan within the same tier"
  // and explicitly says downgrades are not available. Cross-tier upgrades are
  // possible via the profile page.
  const getCellAction = (
    tier: TierId,
    months: DurationMonths
  ): "current" | "upgrade" | "downgrade" | "choose" => {
    if (!hasActiveSubscription) return "choose";
    if (!currentTier || currentMonths == null) return "choose";

    // Exact match → current plan
    if (currentTier === tier && currentMonths === months) return "current";

    // Same tier, different duration → upgrade or downgrade
    if (currentTier === tier) {
      if (months > currentMonths) return "upgrade";
      if (months < currentMonths) return "downgrade";
    }

    // Cross-tier: treat higher tier or longer duration as upgrade, otherwise choose.
    // Tier order: course < standalone < course_ai < course_ai_pro
    const tierRank: Record<TierId, number> = { course: 0, standalone: 1, course_ai: 2, course_ai_pro: 3 };
    if (tierRank[tier] > tierRank[currentTier]) return "upgrade";
    if (tierRank[tier] < tierRank[currentTier]) return "downgrade";
    return "choose";
  };

  const getCellButtonText = (tier: TierId, months: DurationMonths): string => {
    const action = getCellAction(tier, months);
    if (action === "current")    return t("home.pricing.cta.currentPlan");
    if (action === "downgrade")  return t("home.pricing.cta.downgradeNotAvailable");
    if (hasActiveSubscription && action === "upgrade") return t("home.pricing.cta.upgradePlan");
    return t("home.pricing.choosePlan");
  };

  const handleCellCTA = async (tier: TierId, months: DurationMonths) => {
    const action = getCellAction(tier, months);
    if (action === "current" || action === "downgrade") return;

    // Logged-in users should manage upgrades from inside the app.
    if (hasActiveSubscription) {
      setLocation("/profile");
      return;
    }

    // Honour the per-tier installments rule: "course" is prepaid-only.
    const effectiveMode: PaymentMode =
      TIER_META[tier].allowsInstallments ? paymentMode : "prepaid";

    await startPurchase(buildPlanId(tier, months), effectiveMode);
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
        <div className="container py-3 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={APP_LOGO} className="h-8 w-8 rounded-md object-cover" alt="Serbian AI Tutor" />
              <h1 className="hidden sm:inline text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t('home.header.title')}
              </h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {!isAuthenticated ? (
                <Select
                  value={displayLanguage}
                  onValueChange={(v) => setDisplayLanguage(v as "en" | "de")}
                >
                  <SelectTrigger className="w-[100px] sm:w-[140px]" aria-label={t("settings.language")}>
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
      <section className="container py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <a href="#beta-registration" className="inline-block px-4 py-2 bg-accent/20 rounded-full text-primary font-semibold mb-4 border border-accent/40 cursor-pointer hover:opacity-80 transition-opacity">
            {t('home.hero.badge')}
          </a>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {t('home.hero.title')}
            </span>
            <br />
            {t('home.hero.titleHighlight')}
          </h2>
          <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground/80 max-w-2xl mx-auto">
            {t('home.hero.subtitle')}
          </p>
          <p 
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto" 
            dangerouslySetInnerHTML={{
              __html: showWaitlist
                ? t("home.hero.descriptionWaitlist")
                : t("home.hero.description", HOME_COUNTS),
            }}
          />
          <div className="flex flex-wrap gap-3 sm:gap-4 justify-center pt-4">
            {!isAuthenticated ? (
              <>
                {showWaitlist && (
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90 text-base sm:text-lg px-6 sm:px-8"
                    onClick={() => setIsWaitlistModalOpen(true)}
                  >
                    {t("waitlist.title")}
                  </Button>
                )}
                {!showWaitlist && (
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-base sm:text-lg px-6 sm:px-8"
                    asChild
                  >
                    <a href="#beta-registration">{t('home.hero.ctaPrimary')}</a>
                  </Button>
                )}
                <Link href="/sign-in">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="text-base sm:text-lg px-6 sm:px-8 border-primary text-primary hover:bg-primary/10"
                  >
                    {t('home.header.login')}
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-base sm:text-lg px-6 sm:px-8"
                >
                  {t('home.header.dashboard')}
                </Button>
              </Link>
            )}
            <Button size="lg" variant="outline" asChild className="text-base sm:text-lg px-6 sm:px-8">
              <a href="#units">{t('home.hero.ctaSecondary')}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section: 8 cards in 4x2 grid
           Row 1: USPs unique to the new 4-tier architecture
           Row 2: Standard learning features */}
      <section className="w-full bg-white/50">
        <div className="container py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              {t("home.features.sectionTitle")}
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              {t("home.features.sectionSubtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

            {/* === Row 1: USPs of the new architecture === */}

            {/* 1) Structured Course Plan */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <BookOpen className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.structuredPlan.title")}</CardTitle>
                <CardDescription>
                  {showWaitlist
                    ? t("home.features.structuredPlan.descWaitlist")
                    : t("home.features.structuredPlan.desc", HOME_COUNTS)}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 2) AI Buddy with Context-Linking (THE differentiator) */}
            <Card className="border-2 border-primary/30 bg-primary/5 hover:border-primary hover:shadow-lg transition-all">
              <CardHeader>
                <Brain className="h-12 w-12 text-primary mb-2" />
                <div className="inline-flex w-fit items-center gap-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mb-1">
                  <Sparkles className="h-3 w-3" /> {t("home.features.aiBuddyContext.badge")}
                </div>
                <CardTitle>{t("home.features.aiBuddyContext.title")}</CardTitle>
                <CardDescription>{t("home.features.aiBuddyContext.desc")}</CardDescription>
              </CardHeader>
            </Card>

            {/* 3) Document Upload & Photo Scan */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <Camera className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.documents.title")}</CardTitle>
                <CardDescription>{t("home.features.documents.desc")}</CardDescription>
              </CardHeader>
            </Card>

            {/* 4) Flexible Plans: 4 tiers × 3 durations */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <Layers className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.flexiblePlans.title")}</CardTitle>
                <CardDescription>{t("home.features.flexiblePlans.desc")}</CardDescription>
              </CardHeader>
            </Card>

            {/* === Row 2: Standard learning features === */}

            {/* 5) AI Energy: fair & flexible */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <Zap className="h-12 w-12 text-amber-500 mb-2" />
                <CardTitle>{t("home.features.aiEnergy.title")}</CardTitle>
                <CardDescription>{t("home.features.aiEnergy.desc")}</CardDescription>
              </CardHeader>
            </Card>

            {/* 6) Vocabulary Trainer */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <GraduationCap className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.vocabulary.title")}</CardTitle>
                <CardDescription>
                  {showWaitlist
                    ? t("home.features.vocabulary.descWaitlist")
                    : t("home.features.vocabulary.desc", HOME_COUNTS)}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* 7) Audio Pronunciation */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <Volume2 className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.audio.title")}</CardTitle>
                <CardDescription>{t("home.features.audio.desc")}</CardDescription>
              </CardHeader>
            </Card>

            {/* 8) Gamification & Progress (combined) */}
            <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
              <CardHeader>
                <Trophy className="h-12 w-12 text-primary mb-2" />
                <CardTitle>{t("home.features.gamification.title")}</CardTitle>
                <CardDescription>{t("home.features.gamification.desc")}</CardDescription>
              </CardHeader>
            </Card>

          </div>
        </div>
      </section>

      {/* Pricing, Upgrade Policy & FAQ Section */}
      {/* Flexible Duration Section */}
      <section id="pricing" className="container py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t('home.pricing.title')}</h3>
            <p 
              className="text-base sm:text-lg md:text-xl text-muted-foreground" 
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

          {/* ===== Old standalone pricing matrix removed (June 2026) =====
              Reason: It duplicated the price + CTA rows that now live INSIDE the
              feature-comparison table below. Single source of truth for prices &
              purchase buttons = the compare-section's bottom rows. */}
          {/* Waitlist/launch hint (kept as global notice above the compare table) */}
          {((showWaitlist && !ENABLE_PURCHASE_FOR_TESTING) || DISABLE_PURCHASE_DURING_BETA) && (
            <p className="text-xs text-muted-foreground text-center -mb-4">
              {t("home.pricing.availableAfterLaunch")}
            </p>
          )}

          {/* Old standalone pricing matrix removed (June 2026). Single source of truth: compare table below. */}

          {/* ===== Feature Comparison: 4 tiers × 8 features =====
              Desktop (md+): tabular grid with sticky tier header.
              Mobile (<md): one expandable accordion card per tier with feature bullets. */}
          <div className="mt-12 sm:mt-16">
            <div className="text-center space-y-3 mb-6 sm:mb-8">
              <h4 className="text-xl sm:text-2xl md:text-3xl font-bold">
                {t("home.pricing.compare.title")}
              </h4>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                {t("home.pricing.compare.subtitle")}
              </p>
            </div>

            {/* Payment Mode Toggle: controls how the price rows in this compare table
                are rendered (prepaid total vs. per-month installments). Applies to
                both desktop and mobile views below. */}
            <div className="flex flex-col items-center gap-1.5 mb-6">
              <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                {t("home.pricing.paymentToggle.label")}
              </span>
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

            {/* Desktop / Tablet: comparison grid (md and up) */}
            <div className="hidden md:block lg:-mx-12 xl:-mx-20">
              <div className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
                {/* Header row: feature label column + 4 tier columns */}
                <div className="grid grid-cols-[minmax(220px,2fr)_repeat(4,1fr)] bg-gradient-to-br from-gray-50 to-white border-b-2 border-gray-200">
                  <div className="p-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("home.pricing.compare.featureHeader")}
                  </div>
                  {TIER_IDS.map((tier) => {
                    const meta = TIER_META[tier];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={`compare-head-${tier}`}
                        className={`p-4 text-center border-l border-gray-200 ${meta.highlight ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          <Icon className={`h-5 w-5 ${meta.highlight ? "text-primary" : "text-muted-foreground"}`} />
                          <div className={`text-sm font-bold leading-tight ${meta.highlight ? "text-primary" : "text-gray-900"}`}>
                            {t(`home.pricing.matrix.${tier}.title`)}
                          </div>
                          {meta.highlight && (
                            <span className="text-[10px] uppercase tracking-wide font-bold text-primary">
                              {t("home.pricing.matrix.mostPopular")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Feature rows */}
                {FEATURE_KEYS.map((feat, rowIdx) => (
                  <div
                    key={`compare-row-${feat}`}
                    className={`grid grid-cols-[minmax(220px,2fr)_repeat(4,1fr)] ${rowIdx % 2 === 1 ? "bg-gray-50/60" : ""} border-b border-gray-100 last:border-b-0`}
                  >
                    <div className="p-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {t(`home.pricing.compare.feature.${feat}.title`)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t(`home.pricing.compare.feature.${feat}.desc`)}
                      </div>
                    </div>
                    {TIER_IDS.map((tier) => {
                      const cell = FEATURE_MATRIX[feat][tier];
                      const meta = TIER_META[tier];
                      return (
                        <div
                          key={`compare-cell-${feat}-${tier}`}
                          className={`p-4 flex items-center justify-center border-l border-gray-100 ${meta.highlight ? "bg-primary/5" : ""}`}
                          aria-label={
                            cell === true
                              ? t("home.pricing.compare.legend.check")
                              : cell === "teaser"
                                ? t("home.pricing.compare.legend.teaser")
                                : t("home.pricing.compare.legend.cross")
                          }
                        >
                          {cell === true && <Check className="h-5 w-5 text-green-600" strokeWidth={3} />}
                          {cell === "teaser" && (
                            <div className="flex flex-col items-center gap-0.5">
                              <Check className="h-5 w-5 text-amber-500" strokeWidth={3} />
                              <span className="text-[10px] text-amber-600 font-medium leading-tight">
                                1–2 / 24h
                              </span>
                            </div>
                          )}
                          {cell === false && <Minus className="h-5 w-5 text-gray-300" />}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* ===== Monthly AI Energy row (dynamic, from platformConfig/loadEnergyConfig) ===== */}
                <div className="grid grid-cols-[minmax(220px,2fr)_repeat(4,1fr)] border-t-2 border-amber-200 bg-amber-50/40">
                  <div className="p-4">
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      {t("home.pricing.compare.energy.title")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t("home.pricing.compare.energy.desc")}
                    </div>
                  </div>
                  {TIER_IDS.map((tier) => {
                    const meta = TIER_META[tier];
                    const quota = energyInfo?.quotas[tier] ?? 0;
                    const typicalCost = energyInfo?.costs.typicalChat ?? 0;
                    const messageEstimate =
                      quota > 0 && typicalCost > 0 ? Math.floor(quota / typicalCost) : 0;
                    return (
                      <div
                        key={`compare-energy-${tier}`}
                        className={`p-4 flex flex-col items-center justify-center text-center border-l border-gray-100 ${meta.highlight ? "bg-primary/5" : ""}`}
                      >
                        {tier === "course" ? (
                          <>
                            <span className="text-[11px] font-medium text-amber-600">
                              {t("home.pricing.compare.energy.teaserOnly")}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                              1–2 / 24h
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-base font-bold text-gray-900">
                              {quota.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {t("home.pricing.compare.energy.perMonth")}
                            </span>
                            {messageEstimate > 0 && (
                              <span className="text-[10px] text-green-700 font-medium mt-0.5 leading-tight">
                                ≈ {messageEstimate} {t("home.pricing.compare.energy.chatsPerMonth")}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ===== Duration / price / CTA rows: one row per duration, one cell per tier ===== */}
                <div className="grid grid-cols-[minmax(220px,2fr)_repeat(4,1fr)] border-t-2 border-gray-200 bg-gradient-to-br from-primary/5 to-white">
                  <div className="p-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    {t("home.pricing.compare.chooseDuration")}
                  </div>
                  {TIER_IDS.map((tier) => {
                    const meta = TIER_META[tier];
                    return (
                      <div
                        key={`compare-duration-head-${tier}`}
                        className={`p-2 text-center border-l border-gray-200 text-[11px] font-medium text-muted-foreground ${meta.highlight ? "bg-primary/10" : ""}`}
                      >
                        {paymentMode === "installments" && meta.allowsInstallments
                          ? t("home.pricing.compare.priceMonthlyLabel")
                          : t("home.pricing.compare.priceTotalLabel")}
                      </div>
                    );
                  })}
                </div>

                {DURATIONS.map((months) => (
                  <div
                    key={`compare-price-row-${months}`}
                    className="grid grid-cols-[minmax(220px,2fr)_repeat(4,1fr)] border-t border-gray-100"
                  >
                    <div className="p-4 flex items-center">
                      <div>
                        <div className="text-base font-bold text-gray-900">
                          {t("home.pricing.matrix.durationLabel", { months })}
                        </div>
                        {months === 12 && (
                          <div className="text-[11px] text-green-700 font-semibold mt-0.5">
                            {t("home.pricing.compare.bestValueHint")}
                          </div>
                        )}
                      </div>
                    </div>
                    {TIER_IDS.map((tier) => {
                      const meta = TIER_META[tier];
                      const planId = buildPlanId(tier, months);
                      const plan = planByCompoundId.get(planId);
                      const prepaidCents = plan?.paymentOptions?.prepaidTotal ?? plan?.price ?? 0;
                      const installmentsCents = plan?.paymentOptions?.installmentsMonthly ?? 0;
                      const action = getCellAction(tier, months);
                      const showInstallments = paymentMode === "installments" && meta.allowsInstallments;
                      const priceForDisplayCents = showInstallments ? installmentsCents : prepaidCents;
                      const isCurrent = action === "current";

                      return (
                        <div
                          key={`compare-price-cell-${tier}-${months}`}
                          className={`p-3 border-l border-gray-100 flex flex-col gap-2 justify-between ${meta.highlight ? "bg-primary/5" : ""}`}
                        >
                          <div className="text-center">
                            {plansLoading ? (
                              <span className="text-xl font-bold animate-pulse">…</span>
                            ) : (
                              <>
                                <div className={`text-xl font-bold ${meta.highlight ? "text-primary" : "text-gray-900"}`}>
                                  €{(priceForDisplayCents / 100).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground leading-tight">
                                  {showInstallments
                                    ? t("home.pricing.matrix.perMonthHint")
                                    : t("home.pricing.matrix.totalHint", { months })}
                                </div>
                              </>
                            )}
                          </div>
                          {isCurrent && (
                            <div className="text-center">
                              <span className="inline-block bg-green-600 text-white px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap">
                                {t("home.pricing.currentPlanBadge")}
                              </span>
                            </div>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block">
                                <Button
                                  size="sm"
                                  className="w-full text-xs"
                                  disabled={
                                    (!user?.clerkId && !learningLanguage) ||
                                    DISABLE_PURCHASE_DURING_BETA ||
                                    (ENABLE_PURCHASE_FOR_TESTING &&
                                      !!user?.clerkId &&
                                      (action === "current" || action === "downgrade"))
                                  }
                                  onClick={() => void handleCellCTA(tier, months)}
                                  variant={
                                    isCurrent
                                      ? "secondary"
                                      : meta.highlight
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {getCellButtonText(tier, months)}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {DISABLE_PURCHASE_DURING_BETA && (
                              <TooltipContent>
                                <p>{t("billing.paidPlansAfterBeta")}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footnote below desktop table */}
              <p
                className="text-xs text-muted-foreground text-center mt-4"
                dangerouslySetInnerHTML={{ __html: t("home.pricing.compare.footnote") }}
              />
            </div>

            {/* Mobile: one accordion card per tier (<md) */}
            <div className="md:hidden space-y-3">
              {TIER_IDS.map((tier) => {
                const meta = TIER_META[tier];
                const Icon = meta.icon;
                const isOpen = openCompareTier === tier;
                const included = FEATURE_KEYS.filter((f) => FEATURE_MATRIX[f][tier] !== false);
                const excluded = FEATURE_KEYS.filter((f) => FEATURE_MATRIX[f][tier] === false);
                return (
                  <Card
                    key={`compare-mobile-${tier}`}
                    className={`border-2 ${meta.highlight ? "border-primary" : "border-gray-200"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenCompareTier(isOpen ? null : tier)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-left"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${meta.highlight ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <div className={`text-base font-bold ${meta.highlight ? "text-primary" : "text-gray-900"}`}>
                            {t(`home.pricing.matrix.${tier}.title`)}
                          </div>
                          {meta.highlight && (
                            <span className="text-[10px] uppercase tracking-wide font-bold text-primary">
                              {t("home.pricing.matrix.mostPopular")}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isOpen && (
                      <CardContent className="pt-0 pb-4 px-4 border-t border-gray-100">
                        {/* Monthly AI Energy banner (mobile) */}
                        {(() => {
                          const quota = energyInfo?.quotas[tier] ?? 0;
                          const typicalCost = energyInfo?.costs.typicalChat ?? 0;
                          const messageEstimate =
                            quota > 0 && typicalCost > 0 ? Math.floor(quota / typicalCost) : 0;
                          return (
                            <div className="mt-3 mb-1 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2.5">
                              <Zap className="h-5 w-5 text-amber-500 shrink-0" />
                              <div className="flex-1">
                                <div className="text-xs font-semibold text-gray-900">
                                  {t("home.pricing.compare.energy.title")}
                                </div>
                                {tier === "course" ? (
                                  <div className="text-xs text-amber-700 font-medium">
                                    {t("home.pricing.compare.energy.teaserOnly")} · 1–2 / 24h
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-700">
                                    <span className="font-bold">{quota.toLocaleString()}</span>{" "}
                                    {t("home.pricing.compare.energy.perMonth")}
                                    {messageEstimate > 0 && (
                                      <span className="text-green-700 font-medium ml-1">
                                        ≈ {messageEstimate} {t("home.pricing.compare.energy.chatsPerMonth")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="text-xs font-semibold uppercase tracking-wide text-green-700 mt-3 mb-2">
                          {t("home.pricing.compare.mobile.included")}
                        </div>
                        <ul className="space-y-2">
                          {included.map((feat) => {
                            const cell = FEATURE_MATRIX[feat][tier];
                            return (
                              <li key={`mob-inc-${tier}-${feat}`} className="flex gap-2 items-start">
                                {cell === "teaser" ? (
                                  <Check className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={3} />
                                ) : (
                                  <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" strokeWidth={3} />
                                )}
                                <div className="text-sm">
                                  <span className="font-medium text-gray-900">
                                    {t(`home.pricing.compare.feature.${feat}.title`)}
                                  </span>
                                  {cell === "teaser" && (
                                    <span className="ml-1.5 text-[11px] text-amber-600 font-medium whitespace-nowrap">
                                      (1–2 / 24h)
                                    </span>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {t(`home.pricing.compare.feature.${feat}.desc`)}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {excluded.length > 0 && (
                          <>
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">
                              {t("home.pricing.compare.mobile.notIncluded")}
                            </div>
                            <ul className="space-y-1.5">
                              {excluded.map((feat) => (
                                <li key={`mob-exc-${tier}-${feat}`} className="flex gap-2 items-start">
                                  <Minus className="h-4 w-4 text-gray-300 mt-0.5 shrink-0" />
                                  <span className="text-sm text-muted-foreground">
                                    {t(`home.pricing.compare.feature.${feat}.title`)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}

                        {/* Mobile: 3 duration tiles per tier (price + CTA) */}
                        <div className="mt-5 pt-4 border-t border-gray-100">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                            {t("home.pricing.compare.chooseDuration")}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {DURATIONS.map((months) => {
                              const planId = buildPlanId(tier, months);
                              const plan = planByCompoundId.get(planId);
                              const prepaidCents = plan?.paymentOptions?.prepaidTotal ?? plan?.price ?? 0;
                              const installmentsCents = plan?.paymentOptions?.installmentsMonthly ?? 0;
                              const action = getCellAction(tier, months);
                              const showInstallments = paymentMode === "installments" && meta.allowsInstallments;
                              const priceForDisplayCents = showInstallments ? installmentsCents : prepaidCents;
                              const isCurrent = action === "current";
                              return (
                                <div
                                  key={`compare-mob-cell-${tier}-${months}`}
                                  className={`p-2 rounded-lg border-2 flex flex-col gap-1.5 ${
                                    isCurrent
                                      ? "border-green-500 bg-green-50/30"
                                      : meta.highlight
                                      ? "border-primary/40 bg-white"
                                      : "border-gray-200 bg-white"
                                  }`}
                                >
                                  <div className="text-center">
                                    <div className="text-[10px] text-muted-foreground font-medium">
                                      {t("home.pricing.matrix.durationLabel", { months })}
                                    </div>
                                    {plansLoading ? (
                                      <div className="text-base font-bold animate-pulse">…</div>
                                    ) : (
                                      <>
                                        <div className={`text-base font-bold ${meta.highlight ? "text-primary" : "text-gray-900"}`}>
                                          €{(priceForDisplayCents / 100).toFixed(2)}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground leading-tight">
                                          {showInstallments
                                            ? t("home.pricing.matrix.perMonthHint")
                                            : t("home.pricing.matrix.totalHint", { months })}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <Button
                                    className="w-full text-sm min-h-11 px-2"
                                    disabled={
                                      (!user?.clerkId && !learningLanguage) ||
                                      DISABLE_PURCHASE_DURING_BETA ||
                                      (ENABLE_PURCHASE_FOR_TESTING &&
                                        !!user?.clerkId &&
                                        (action === "current" || action === "downgrade"))
                                    }
                                    onClick={() => void handleCellCTA(tier, months)}
                                    variant={
                                      isCurrent
                                        ? "secondary"
                                        : meta.highlight
                                        ? "default"
                                        : "outline"
                                    }
                                  >
                                    {getCellButtonText(tier, months)}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              <p
                className="text-xs text-muted-foreground text-center mt-4 px-2"
                dangerouslySetInnerHTML={{ __html: t("home.pricing.compare.footnote") }}
              />
            </div>
          </div>

          {/* ===== AI Energy: how it works + cost examples ===== */}
          <div className="mt-10 sm:mt-12 p-5 sm:p-6 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <h4 className="sm:hidden text-lg font-bold text-gray-900">
                  {t("home.pricing.energyExamples.title")}
                </h4>
              </div>
              <div className="flex-1 space-y-3">
                <h4 className="hidden sm:block text-lg sm:text-xl font-bold text-gray-900">
                  {t("home.pricing.energyExamples.title")}
                </h4>
                <p className="text-sm text-gray-700">
                  {t("home.pricing.energyExamples.subtitle")}
                </p>
                <div className="grid sm:grid-cols-3 gap-2 sm:gap-3 mt-3">
                  <div className="bg-white p-3 rounded-lg border border-amber-100">
                    <div className="text-xs text-muted-foreground">
                      {t("home.pricing.energyExamples.typicalChat.label")}
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {energyInfo?.costs.typicalChat ?? 2} {t("home.pricing.energyExamples.energyUnit")}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t("home.pricing.energyExamples.typicalChat.desc")}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100">
                    <div className="text-xs text-muted-foreground">
                      {t("home.pricing.energyExamples.detailed.label")}
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {energyInfo?.costs.detailedAnswer ?? 4} {t("home.pricing.energyExamples.energyUnit")}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t("home.pricing.energyExamples.detailed.desc")}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-100">
                    <div className="text-xs text-muted-foreground">
                      {t("home.pricing.energyExamples.photoScan.label")}
                    </div>
                    <div className="text-base font-bold text-gray-900">
                      {energyInfo?.costs.photoScan ?? 6} {t("home.pricing.energyExamples.energyUnit")}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {t("home.pricing.energyExamples.photoScan.desc")}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("home.pricing.energyExamples.footnote")}
                </p>
              </div>
            </div>
          </div>

          {/* ===== AI Energy top-up packs (public read; available for standalone, course_ai, course_ai_pro) ===== */}
          <div className="mt-10 sm:mt-12">
            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex items-center gap-2 justify-center">
                <Zap className="h-5 w-5 text-amber-500" />
                <h4 className="text-lg sm:text-xl md:text-2xl font-bold">
                  {t("home.pricing.topups.title")}
                </h4>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto px-4">
                {t("home.pricing.topups.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {(topupPacks ?? []).map((pack) => {
                const isPlus = pack.id === "plus";
                return (
                  <Card
                    key={`topup-${pack.id}`}
                    className={`border-2 ${isPlus ? "border-primary/40 bg-gradient-to-br from-amber-50 to-white" : "border-gray-200 bg-white"}`}
                  >
                    <CardContent className="p-4 sm:p-5 text-center">
                      <div className="text-sm font-bold text-gray-900 mb-1">
                        {t(`home.pricing.topups.${pack.id}.name`, { defaultValue: pack.name })}
                      </div>
                      {isPlus && (
                        <div className="text-[10px] uppercase tracking-wide font-bold text-primary mb-2">
                          {t("home.pricing.topups.popular")}
                        </div>
                      )}
                      <div className="flex items-baseline justify-center gap-1 mb-2">
                        <span className="text-2xl font-bold text-primary">
                          €{(pack.priceCents / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-gray-900">
                        {pack.totalEnergy.toLocaleString()} {t("home.pricing.topups.energyUnit")}
                      </div>
                      {pack.bonusAmount > 0 && (
                        <div className="text-[11px] text-green-700 font-medium mt-0.5">
                          {t("home.pricing.topups.bonusHint", {
                            base: pack.energyAmount.toLocaleString(),
                            bonus: pack.bonusAmount.toLocaleString(),
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4 px-2">
              {t("home.pricing.topups.footnote")}
            </p>
          </div>

          {/* Upgrade Policy Section: 3 concrete examples with live price deltas */}
          <div className="mt-12 p-4 sm:p-6 md:p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <div className="text-center space-y-4">
              <div className="inline-block p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-xl sm:text-2xl font-bold text-gray-900">{t('home.pricing.upgrade.title')}</h4>
              <p className="text-base sm:text-lg text-gray-700 max-w-2xl mx-auto">
                {t('home.pricing.upgrade.subtitle')}
              </p>

              <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mt-8 text-left">
                {upgradeExamples.map((ex) => (
                  <div
                    key={`upgrade-example-${ex.key}`}
                    className="bg-white p-5 rounded-xl shadow-md flex flex-col gap-3"
                  >
                    {/* Scenario label */}
                    <div className="text-[10px] uppercase tracking-wide font-bold text-primary">
                      {t(`home.pricing.upgrade.example.${ex.key}.label`)}
                    </div>

                    {/* From → To path */}
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="font-semibold text-gray-900">
                        {t(`home.pricing.matrix.${ex.fromTier}.title`)}
                      </span>
                      <span className="text-muted-foreground">
                        ({t("home.pricing.matrix.durationLabel", { months: ex.fromMonths })})
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-semibold text-gray-900">
                        {t(`home.pricing.matrix.${ex.toTier}.title`)}
                      </span>
                      <span className="text-muted-foreground">
                        ({t("home.pricing.matrix.durationLabel", { months: ex.toMonths })})
                      </span>
                    </div>

                    {/* Scenario description */}
                    <p className="text-xs text-gray-600">
                      {t(`home.pricing.upgrade.example.${ex.key}.desc`)}
                    </p>

                    {/* Delta price chip */}
                    <div className="mt-auto inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-fit">
                      <Check className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
                          {t("home.pricing.upgrade.youPay")}
                        </div>
                        <div className="text-lg font-bold text-green-700 leading-tight">
                          {plansLoading ? (
                            <span className="animate-pulse">€…</span>
                          ) : (
                            <>€{(ex.deltaCents / 100).toFixed(2)}</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs sm:text-sm text-gray-700 max-w-2xl mx-auto mt-2">
                {t("home.pricing.upgrade.footnote")}
              </p>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{t('home.faq.title')}</h3>
              <p className="text-base sm:text-lg text-gray-600">{t('home.faq.subtitle')}</p>
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
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4 shrink-0" /> {t('home.faq.q4.check1')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4 shrink-0" /> {t('home.faq.q4.check2')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4 shrink-0" /> {t('home.faq.q4.check3')}
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
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.course.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.course.desc')}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.standalone.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.standalone.desc')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.course_ai.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.course_ai.desc')}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border-2 border-primary">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.course_ai_pro.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.course_ai_pro.desc')}</p>
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
                  <h4 className="text-2xl sm:text-3xl font-bold text-yellow-900">{t('home.beta.banner.title')}</h4>
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
        <div className="container py-12 sm:py-16 md:py-20">
          <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t('home.units.title')}</h3>
            <p 
              className="text-base sm:text-lg md:text-xl text-muted-foreground" 
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
        <section id="beta-registration" className="container py-12 sm:py-16 md:py-20">
          <Card className="max-w-2xl mx-auto border-2 border-secondary shadow-2xl shadow-blue-200">
            <CardHeader className="text-center bg-gradient-to-r from-red-50 via-white to-blue-50">
              <div className="inline-block px-4 py-2 bg-accent/30 rounded-full text-primary font-bold mb-4 border-2 border-accent">
                {t('home.beta.discount')}
              </div>
              <CardTitle className="text-2xl sm:text-3xl">
                {t('home.beta.title')}
              </CardTitle>
              <CardDescription className="text-base sm:text-lg">
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
