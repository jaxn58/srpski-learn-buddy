import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, Brain, Home, Lock, Star, TrendingUp, Volume2, Loader2, X, Gift, Search } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { FeedbackForm } from "@/components/FeedbackForm";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { logger } from "@/lib/logger";
import { DASHBOARD_BETA_BANNER_KEY } from "@/lib/dashboardAnnouncementKeys";
import { useVocabularyAudioPlayback } from "@/hooks/useVocabularyAudioPlayback";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { FlipCard } from "@/components/FlipCard";
import { Skeleton } from "@/components/ui/skeleton";

import { useMemo, useState, useEffect, memo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { user, loading: authLoading, logout, clerkUser } = useAuth();
  const { t, i18n } = useTranslation();
  const { language: uiLanguage } = useLanguage();
  // Fix: Scroll to top on mount to prevent auto-scroll to units
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Checkout return handling:
  // Dodo redirects to `return_url` even when the payment is NOT successful (declines, user closes checkout).
  // We therefore treat URL params as "return", never as "success". Confirmation happens via Convex state (webhook).
  const [checkoutReturn, setCheckoutReturn] = useState<null | { kind: "purchase" | "upgrade"; startedAt: number }>(
    null
  );

  const clearCheckoutReturnParams = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("purchase");
      url.searchParams.delete("upgrade");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", `${url.pathname}${qs ? `?${qs}` : ""}${url.hash || ""}`);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const upgrade = params.get("upgrade");
    const kind = purchase ? ("purchase" as const) : upgrade ? ("upgrade" as const) : null;
    const value = purchase ?? upgrade;

    // Backwards compatibility: older URLs used "...=success" even though it isn't reliable.
    if (!kind || (value !== "return" && value !== "success")) return;

    setCheckoutReturn({ kind, startedAt: Date.now() });
    toast.info(t("billing.checkout.closedVerifying"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Use user's learning language or fallback to UI language or 'en'
  const displayLanguage = user?.learningLanguage || (i18n.language === 'de' ? 'de' : 'en');
  
  const progress = useQuery(api.progress.getUserProgress);
  const progressLoading = progress === undefined;
  const accessibleUnits = useQuery(api.subscriptions.getAccessibleUnits);
  const currentSubscription = useQuery(api.subscriptions.getCurrent);
  const masteredUnits = useQuery(api.progress.getMasteredUnits, user ? undefined : "skip");
  const safeCurrentUnit =
    typeof progress?.currentUnit === "number" && Number.isFinite(progress.currentUnit) && progress.currentUnit > 0
      ? progress.currentUnit
      : 1;

  useEffect(() => {
    if (!checkoutReturn) return;
    const sub: any = currentSubscription;
    if (sub === undefined) return; // still loading

    const status = String(sub?.status || "");
    const planType = String(sub?.planType ?? sub?.plan ?? "").trim().toLowerCase();
    const isPaidPlan = planType === "intensive" || planType === "balanced" || planType === "standard" || planType === "relaxed";

    if (status === "active" && isPaidPlan) {
      toast.success(t("billing.checkout.paymentConfirmed"));
      clearCheckoutReturnParams();
      setCheckoutReturn(null);
      return;
    }

    if (status === "past_due") {
      toast.error(t("billing.checkout.paymentFailed"));
      clearCheckoutReturnParams();
      setCheckoutReturn(null);
    }
  }, [checkoutReturn, currentSubscription]);

  useEffect(() => {
    if (!checkoutReturn) return;

    const timeoutId = window.setTimeout(() => {
      toast.info(t("billing.checkout.notConfirmedYet"));
      clearCheckoutReturnParams();
      setCheckoutReturn(null);
    }, 30_000);

    return () => window.clearTimeout(timeoutId);
  }, [checkoutReturn]);
  
  // Check if user has started the current unit (for Current vs Next Unit label)
  const currentUnitActivity = useQuery(
    api.progress.hasUnitActivity,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit }
  );
  
  // Load dynamic data from DB instead of static files
  const units = useQuery(api.units.getAllUnitsMetadata, { language: displayLanguage });
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const dashboardStats = useQuery(api.progress.getDashboardStats, { todayStart });
  const seedDay = new Date().toISOString().slice(0, 10);
  const practicePreview = useQuery(
    api.vocabulary.getPracticePreview,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit, seedDay, audioCount: 5, language: displayLanguage }
  );
  
  const updateProgressMutation = useMutation(api.progress.updateProgress);
  const completedBadgeClass = "bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm";
  const masteredBadgeClass = "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm";
  
  // Onboarding tutorial state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Practice preview state
  const [showPracticeAnswer, setShowPracticeAnswer] = useState(false);
  const { play, playingAudioId, loadingAudioId } = useVocabularyAudioPlayback();
  
  // Beta / dashboard announcement banner dismiss state (per user + announcement key)
  const [showBetaBanner, setShowBetaBanner] = useState(true);
  
  // Units filter state
  const [unitFilter, setUnitFilter] = useState<'all' | 'in-progress' | 'completed' | 'locked'>('all');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  
  // Banner copy follows the app UI language (language switcher / app-language), not learningLanguage.
  const dbBetaBanner = useQuery(
    api.dashboardAnnouncements.getDashboardAnnouncementForUser,
    user ? { key: DASHBOARD_BETA_BANNER_KEY, language: uiLanguage } : "skip"
  );

  // Load banner dismiss preference (new key + legacy beta_banner_dismissed_*)
  useEffect(() => {
    if (!user) return;
    const modernKey = `dashboard_announcement_dismissed_${user._id}_${DASHBOARD_BETA_BANNER_KEY}`;
    try {
      const legacy = localStorage.getItem(`beta_banner_dismissed_${user._id}`);
      if (legacy === "true") {
        localStorage.setItem(modernKey, "true");
      }
      if (localStorage.getItem(modernKey) === "true") {
        setShowBetaBanner(false);
      }
    } catch {
      // ignore
    }
  }, [user]);

  const handleDismissBetaBanner = () => {
    if (!user) return;
    try {
      localStorage.setItem(
        `dashboard_announcement_dismissed_${user._id}_${DASHBOARD_BETA_BANNER_KEY}`,
        "true"
      );
      setShowBetaBanner(false);
    } catch {
      // ignore
    }
  };
  
  // Show onboarding automatically unless user has explicitly disabled it
  useEffect(() => {
    if (user) {
      const isDisabled = localStorage.getItem(`onboarding_disabled_${user._id}`);
      
      if (!isDisabled) {
        setShowOnboarding(true);
      }
    }
  }, [user]);
  
  const handleCloseOnboarding = (disableAutoShow: boolean = false) => {
    if (user && disableAutoShow) {
      localStorage.setItem(`onboarding_disabled_${user._id}`, 'true');
    }
    setShowOnboarding(false);
  };

  
  const completedUnits = progress?.completedUnits || [];
  
  // Determine if user is beta tester
  const isBeta = user?.isBetaTester || accessibleUnits?.isBeta || false;
  const totalUnits = isBeta ? 1 : (units?.length || 0);
  const progressPercentage = (completedUnits.length / totalUnits) * 100;
  const learningDuration = progress?.learningDuration || 12;
  
  // Admin bypass: Show all units for admins
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const rawAccessible = Array.isArray(accessibleUnits)
    ? accessibleUnits
    : Array.isArray((accessibleUnits as any)?.units)
    ? (accessibleUnits as any).units
    : Array.isArray((accessibleUnits as any)?.accessibleUnits)
    ? (accessibleUnits as any).accessibleUnits
    : [];
    
  // For non-admin users, show accessible units. For admins, show all units.
  const displayUnits = isAdmin ? units?.map(u => u.unitNumber) : rawAccessible;
  const visibleUnits = Array.from(
    new Set(
      [
        ...(displayUnits || []),
        ...(rawAccessible || []),
        progress?.currentUnit,
        ...completedUnits,
      ].filter(Boolean) as number[]
    )
  );

  const accessibleCount = Array.isArray(rawAccessible) ? rawAccessible.length : 0;

  const isBetaTester = !!user?.isBetaTester;

  const getUnitRow = useCallback(
    (unitNumber: number) => {
      if (!units) return undefined;
      const preferredLang = i18n.language === "de" ? "de" : "en";
      return (
        units.find((u) => u.unitNumber === unitNumber && u.language === preferredLang) ??
        units.find((u) => u.unitNumber === unitNumber && u.language === "en") ??
        units.find((u) => u.unitNumber === unitNumber)
      );
    },
    [units, i18n.language]
  );

  // Filter and search units
  const filteredUnits = useMemo(() => {
    if (!visibleUnits || !units) return [];
    
    let filtered = visibleUnits.filter((unitNum) => {
      const unit = getUnitRow(unitNum);
      const isCompleted = completedUnits.includes(unitNum);
      const isCurrent = unitNum === progress?.currentUnit;
      const isLocked = isBetaTester && unitNum > 1;
      
      // Apply filter
      if (unitFilter === 'completed' && !isCompleted) return false;
      if (unitFilter === 'in-progress' && (isCompleted || !isCurrent)) return false;
      if (unitFilter === 'locked' && !isLocked) return false;
      
      // Apply search
      if (unitSearchQuery) {
        const query = unitSearchQuery.toLowerCase();
        const title = unit?.title || "";
        const unitNumber = unitNum.toString();
        if (!title.toLowerCase().includes(query) && !unitNumber.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
    
    return filtered;
  }, [visibleUnits, units, completedUnits, progress?.currentUnit, unitFilter, unitSearchQuery, isBetaTester, getUnitRow]);

  const weeklyXp = dashboardStats?.weeklyProgress?.xpSum ?? 0;
  const weeklyXpTarget = dashboardStats?.weeklyGoal?.xpTarget ?? 150;
  const weeklyActiveDays = dashboardStats?.weeklyProgress?.activeDays ?? 0;
  const weeklyActiveDaysTarget = dashboardStats?.weeklyGoal?.activeDaysTarget ?? 3;

  const wordsMastered = dashboardStats?.accuracyStats?.masteredVocab ?? 0;
  const masteryEfficiency = dashboardStats?.masteryQuality?.masteredEfficiency;

  const startedDaysAgo = useMemo(() => {
    const ts = dashboardStats?.creationTime;
    if (!ts) return null;
    const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
    return Number.isFinite(days) && days >= 0 ? days : null;
  }, [dashboardStats?.creationTime]);

  const courseMasteryPercent = useMemo(() => {
    const total = totalUnits || 0;
    if (!total) return null;
    const completed = (dashboardStats?.completedUnits?.length ?? completedUnits.length) || 0;
    return Math.round((completed / total) * 100);
  }, [dashboardStats?.completedUnits?.length, completedUnits.length, totalUnits]);

  const practicePreviewWord = practicePreview?.word ?? null;
  const audioSamples = practicePreview?.audioSamples ?? [];
  const practicePreviewUnit = practicePreview?.resolvedUnit ?? safeCurrentUnit;

  useEffect(() => {
    // When the daily pick changes, default back to hiding the answer
    setShowPracticeAnswer(false);
  }, [practicePreviewWord?.id]);


  useEffect(() => {
    // Removed debug instrumentation
  }, [
    authLoading,
    progressLoading,
    user?._id,
    progress?.currentUnit,
    completedUnits.length,
    visibleUnits?.length,
    totalUnits,
    isBeta,
    accessibleCount,
    learningDuration,
  ]);

  // Show loading while auth or progress is loading
  // Also show loading while user is being synced to Convex
  if (authLoading || progressLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // All users now have immediate access - no pending approval needed

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding 
          userName={user.name || user.email || t("common.there")} 
          onClose={handleCloseOnboarding}
          language={displayLanguage}
        />
      )}
      
      <AnimatedPage>
        <div className="pb-24">
        {/* Beta tester banner: copy from Convex when key dashboard_beta exists; else i18n fallback */}
        {user.isBetaTester && showBetaBanner && dbBetaBanner !== undefined && (
          <div className="mb-4 border border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-3 md:p-4">
            <div className="flex items-start gap-2 md:gap-3">
              <div className="bg-yellow-400 rounded-full p-1.5 md:p-2 flex-shrink-0">
                <Gift className="h-4 w-4 md:h-5 md:w-5 text-yellow-900" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                  <h3 className="font-bold text-base md:text-lg text-gray-900">
                    {dbBetaBanner ? dbBetaBanner.title : t("dashboard.betaBanner.title")}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={handleDismissBetaBanner}
                    aria-label={t("dashboard.betaBanner.dismissAria")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {dbBetaBanner ? (
                  <>
                    <p className="text-xs md:text-sm text-gray-700 mb-1 md:mb-2">{dbBetaBanner.intro}</p>
                    <div className="bg-white/80 rounded-md p-1.5 md:p-2 border border-yellow-300">
                      <p className="text-xs md:text-sm text-gray-600 whitespace-pre-wrap">{dbBetaBanner.body}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs md:text-sm text-gray-700 mb-1 md:mb-2">
                      <strong>{t("dashboard.betaBanner.thankYou")}</strong> {t("dashboard.betaBanner.intro")}
                    </p>
                    <ul className="text-xs md:text-sm text-gray-700 space-y-0.5 md:space-y-1 mb-1 md:mb-2">
                      <li className="flex items-start">
                        <span className="mr-1 md:mr-2">✓</span>
                        <span>{t("dashboard.betaBanner.benefit1")}</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-1 md:mr-2">✓</span>
                        <span>{t("dashboard.betaBanner.benefit2")}</span>
                      </li>
                    </ul>
                    <div className="bg-white/80 rounded-md p-1.5 md:p-2 border border-yellow-300">
                      <p className="text-xs text-gray-600">
                        <strong>{t("dashboard.betaBanner.afterLaunch")}</strong>{" "}
                        {t("dashboard.betaBanner.afterLaunchDesc")}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            {t('dashboard.welcome', { name: user.name?.split(' ')[0] || t("dashboard.welcomeFallbackName") })}
          </h1>
        </div>

        {/* Primary Actions - Balanced Design */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <AnimatedItem>
            <Card className="hover:shadow-md transition-all h-full flex flex-col border border-border">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 rounded-lg p-2.5 flex-shrink-0">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold mb-1">
                      {currentUnitActivity?.hasActivity ? t('dashboard.continueLesson') : t('dashboard.startNextLesson')}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {(() => {
                        const unit = units?.find(u => u.unitNumber === safeCurrentUnit);
                        return (
                          <>
                            <span className="font-medium">{t('dashboard.unit', { number: safeCurrentUnit })}</span>
                            {unit?.title && <span> - {unit.title}</span>}
                          </>
                        );
                      })()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={`/unit/${safeCurrentUnit}`}>
                  <Button className="w-full" size="default">
                    {currentUnitActivity?.hasActivity ? t('dashboard.goToLesson') : t('dashboard.startLesson')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>

          <AnimatedItem>
            <Card className="hover:shadow-md transition-all h-full flex flex-col border border-border">
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="bg-yellow-500/10 rounded-lg p-2.5 flex-shrink-0">
                    <Brain className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold mb-1">{t('dashboard.chatWithProfessor')}</CardTitle>
                    <CardDescription className="text-sm">
                      {t('dashboard.chatDesc')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/chat">
                  <Button className="w-full" variant="outline">{t('dashboard.openChat')}</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>
        </div>

        {/* Dashboard Snippets (informative) */}
        <AnimatedItem className="mb-6 md:mb-10">
          <div className="grid gap-4 md:gap-6 lg:grid-cols-3 items-stretch">
            {/* Practice Preview (wide) */}
            <Card className="lg:col-span-2 hover:shadow-md transition-shadow border border-border">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold mb-1">{t("dashboard.practicePreview.title")}</CardTitle>
                    <CardDescription className="text-sm">
                      {t("dashboard.practicePreview.subtitle")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                    <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`} className="w-full sm:w-auto">
                      <Button size="sm" variant="default" className="gap-2 w-full sm:w-auto">
                        <BookOpen className="h-4 w-4" />
                        {t("dashboard.practicePreview.learnCta")}
                      </Button>
                    </Link>
                    <Link href={`/vocabulary?mode=quiz&unit=${safeCurrentUnit}`} className="w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 w-full sm:w-auto"
                      >
                        <Star className="h-4 w-4" />
                        {t("dashboard.practicePreview.quizCta")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {practicePreview === undefined ? (
                  <div className="space-y-4 py-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : !practicePreviewWord ? (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    {t("dashboard.practicePreview.empty")}
                  </div>
                ) : (
                  <div className="grid gap-4 items-stretch">
                    <FlipCard
                      flipped={showPracticeAnswer}
                      onFlip={() => setShowPracticeAnswer((s) => !s)}
                      className="h-full min-h-[200px]"
                      front={
                        <div className="rounded-xl border bg-muted/10 p-6 flex flex-col justify-center text-center h-full">
                          <div className="inline-flex items-center justify-center gap-2 mb-2">
                            <Badge variant="outline">{t("dashboard.unit", { number: practicePreviewUnit })}</Badge>
                            {practicePreviewWord.mastered && (
                              <Badge className="bg-amber-500 text-white border-amber-500">
                                {t("common.mastered")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xl md:text-4xl font-bold tracking-tight mb-3 md:mb-4">
                            {practicePreviewWord.serbian}
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            {t("dashboard.practicePreview.clickToReveal")}
                          </div>
                        </div>
                      }
                      back={
                        <div className="rounded-xl border bg-primary/5 p-6 flex flex-col justify-center text-center h-full">
                          <div className="inline-flex items-center justify-center gap-2 mb-2">
                            <Badge variant="outline">{t("dashboard.unit", { number: practicePreviewUnit })}</Badge>
                            {practicePreviewWord.mastered && (
                              <Badge className="bg-amber-500 text-white border-amber-500">
                                {t("common.mastered")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-2xl md:text-4xl font-bold tracking-tight mb-2">
                            {practicePreviewWord.serbian}
                          </div>
                          <div className="text-lg md:text-xl text-muted-foreground">
                            {practicePreviewWord.translation}
                          </div>
                        </div>
                      }
                    />
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowPracticeAnswer((s) => !s)}
                        className="w-full sm:w-auto"
                      >
                        {showPracticeAnswer ? t("dashboard.practicePreview.showWord") : t("dashboard.practicePreview.showTranslation")}
                      </Button>
                      <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`} className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">{t("dashboard.practicePreview.openTrainer")}</Button>
                      </Link>
                    </div>

                    {/* Audio sampler */}
                    <div className="rounded-xl border bg-muted/10 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{t("dashboard.practicePreview.audio.title")}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("dashboard.practicePreview.audio.subtitle")}
                          </div>
                        </div>
                        <Link href="/vocabulary-list">
                          <Button variant="outline" size="sm">
                            {t("dashboard.practicePreview.audio.viewAllWords")}
                          </Button>
                        </Link>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {audioSamples.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-6">
                            {t("dashboard.practicePreview.audio.empty")}
                          </div>
                        ) : (
                          audioSamples.map((s) => {
                            const isLoading = loadingAudioId === s.id;
                            const isPlaying = playingAudioId === s.id;
                            return (
                              <button
                                key={s.id}
                                className="group w-full text-left rounded-lg border bg-background hover:bg-accent/40 transition-colors p-3 flex items-center gap-3"
                                onClick={() =>
                                  play({
                                    vocabularyId: s.id,
                                    serbianWord: s.serbian,
                                    unitNumber: safeCurrentUnit,
                                    audioStorageId: s.audioStorageId,
                                  })
                                }
                                disabled={Boolean(loadingAudioId) && loadingAudioId !== s.id}
                              >
                                <span className="h-9 w-9 rounded-md bg-serbian-red/10 text-serbian-red flex items-center justify-center shrink-0">
                                  {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Volume2 className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block font-semibold truncate">
                                    {s.serbian}
                                  </span>
                                  <span className="block text-xs text-muted-foreground truncate">
                                    {s.translation}
                                  </span>
                                </span>
                                {isPlaying && (
                                  <span className="text-xs font-semibold text-serbian-red">
                                    {t("common.playing")}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly goal / XP (compact, like screenshot) */}
            <div className="grid gap-6">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{t("progress.cards.weeklyGoal.title")}</CardTitle>
                      <CardDescription>{t("dashboard.weeklyGoal.subtitle")}</CardDescription>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-2xl font-bold">
                    {weeklyXp} / {weeklyXpTarget} XP
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("progress.cards.weeklyGoal.xpThisWeek")}</span>
                      <span className="font-medium">{weeklyXp}</span>
                    </div>
                    <ProgressBar value={Math.min(100, (weeklyXp / Math.max(1, weeklyXpTarget)) * 100)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("progress.cards.weeklyGoal.activeDays")}</span>
                      <span className="font-medium">
                        {weeklyActiveDays} / {weeklyActiveDaysTarget}
                      </span>
                    </div>
                    <ProgressBar value={Math.min(100, (weeklyActiveDays / Math.max(1, weeklyActiveDaysTarget)) * 100)} />
                  </div>
                </CardContent>
              </Card>

              {/* Course progress compact */}
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">{t("dashboard.courseProgress.title")}</CardTitle>
                  <CardDescription>{t("dashboard.courseProgress.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("progress.cards.summary.courseMastery")}</span>
                    <span className="font-semibold">
                      {courseMasteryPercent === null ? "—" : `${courseMasteryPercent}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("progress.cards.summary.unitsCompleted")}</span>
                    <span className="font-semibold">
                      {(dashboardStats?.completedUnits?.length ?? completedUnits.length) || 0} / {totalUnits}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("progress.cards.summary.wordsMastered")}</span>
                    <span className="font-semibold">{wordsMastered}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("progress.cards.summary.masteryEfficiency")}</span>
                    <span className="font-semibold">
                      {typeof masteryEfficiency === "number"
                        ? `${Math.round(masteryEfficiency * 100)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("progress.cards.summary.started")}</span>
                    <span className="font-semibold">
                      {startedDaysAgo === null ? "—" : t("progress.cards.summary.startedAgo", { days: startedDaysAgo })}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Link href="/progress">
                      <Button variant="outline" className="w-full">
                        {t("dashboard.openProgress")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </AnimatedItem>

        {/* Modules List Card */}
        <AnimatedItem>
          {completedUnits.length === 0 && visibleUnits && visibleUnits.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("dashboard.emptyLearning.title")}
              description={t("dashboard.emptyLearning.desc")}
              action={{
                label: t("dashboard.emptyLearning.actionStartFirstUnit"),
                href: `/unit/1`,
              }}
            />
          ) : (
            <Card className="shadow-sm hover:shadow-md transition-shadow border border-border">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold mb-1">
                      {t('dashboard.allUnits', 'All Units')}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {t('dashboard.allUnitsDesc', 'Continue your learning journey')}
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <Badge variant="outline" className="flex-shrink-0">
                      {t("dashboard.adminAccessBadge")}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Filter and Search */}
                <div className="mb-4 md:mb-6 space-y-3 md:space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={unitFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUnitFilter('all')}
                    >
                      {t("dashboard.units.filter.all")}
                    </Button>
                    <Button
                      variant={unitFilter === 'in-progress' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUnitFilter('in-progress')}
                    >
                      {t("dashboard.units.filter.inProgress")}
                    </Button>
                    <Button
                      variant={unitFilter === 'completed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUnitFilter('completed')}
                    >
                      {t("dashboard.units.filter.completed")}
                    </Button>
                    {user.isBetaTester && (
                      <Button
                        variant={unitFilter === 'locked' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setUnitFilter('locked')}
                      >
                        {t("dashboard.units.filter.locked")}
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      type="text"
                      placeholder={t("dashboard.units.searchPlaceholder")}
                      value={unitSearchQuery}
                      onChange={(e) => setUnitSearchQuery(e.target.value)}
                      className="pl-9"
                      aria-label={t("dashboard.units.searchAria")}
                    />
                  </div>
                </div>
                <div className="grid gap-5">
                      {filteredUnits.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {t("dashboard.units.emptyNoMatch")}
                        </div>
                      ) : (
                        filteredUnits.map(unitNum => {
                    const unit = getUnitRow(unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;
                    const isMastered = masteredUnits?.includes(unitNum);
                    const isLocked = isBetaTester && unitNum > 1;

                    if (isLocked) {
                      return (
                        <Card key={unitNum} className="transition-all opacity-60 bg-gray-50 border-gray-300">
                          <CardContent className="p-4 md:p-5">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 md:gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-gray-100">
                                    {t('dashboard.unit', { number: unitNum })}
                                  </Badge>
                                  <Lock className="h-4 w-4 text-gray-500" />
                                  <span className="text-gray-500 text-sm font-medium">{t('dashboard.locked')}</span>
                                </div>
                                <div className="font-semibold text-lg mb-1 text-gray-600">
                                  {unit?.title}
                                </div>
                                <div className="text-sm text-gray-500 mb-3">
                                  {unit?.description}
                                </div>
                                <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                                  <strong>{t('dashboard.betaTester.note')}</strong> {t('dashboard.betaTester.unlockNote')}
                                </div>
                              </div>
                              <div className="text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="whitespace-nowrap"
                                  disabled
                                >
                                  <Lock className="mr-1 h-3 w-3" />
                                  {t('dashboard.lockedButton')}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    return (
                      <Link key={unitNum} href={`/unit/${unitNum}`}>
                        <Card className={`transition-all hover:shadow-lg hover:scale-[1.01] ${
                          isCurrent ? 'border-primary ring-2 ring-primary/20 shadow-md' : 
                          isMastered ? 'border-amber-400 bg-amber-50/60' :
                          isCompleted ? 'border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)]' : 
                          'hover:border-primary/50'
                        }`}>
                          <CardContent className="p-4 md:p-6">
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 md:gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 md:mb-3 flex-wrap">
                                  <Badge variant={isCurrent ? 'default' : 'outline'} className="text-sm">
                                    {t('dashboard.unit', { number: unitNum })}
                                  </Badge>
                                  {isCompleted && (
                                    <Badge className={completedBadgeClass}>
                                      {t('dashboard.completedBadge')}
                                    </Badge>
                                  )}
                                  {isMastered && (
                                    <Badge className={masteredBadgeClass}>
                                      <Star className="mr-1 h-3 w-3 text-white" fill="currentColor" strokeWidth={0} />
                                      {t("common.mastered")}
                                    </Badge>
                                  )}
                                  {isCurrent && !isCompleted && (
                                    <span className="text-primary text-sm font-medium">{t('dashboard.currentLessonBadge')}</span>
                                  )}
                                </div>
                                <div className="font-semibold text-lg md:text-xl mb-1 md:mb-2 leading-tight">
                                  {unit?.title}
                                </div>
                                <div className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 leading-relaxed">
                                  {unit?.description}
                                </div>
                                {unit?.topics && unit.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-4">
                                    {unit.topics.slice(0, 3).map((topic: string, idx: number) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {topic}
                                      </Badge>
                                    ))}
                                    {unit.topics.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        {t('dashboard.moreTopics', { count: unit.topics.length - 3 })}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0 w-full sm:w-auto">
                                <Button 
                                  variant={isCurrent ? 'default' : 'outline'} 
                                  size="sm"
                                  className="whitespace-nowrap w-full sm:w-auto"
                                >
                                  {isCompleted ? t('dashboard.review') : isCurrent ? t('dashboard.continue') : t('dashboard.start')}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })
                )}
                </div>
              </CardContent>
            </Card>
          )}
        </AnimatedItem>
        </div>
      </AnimatedPage>
    </>
  );
}
