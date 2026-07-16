import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  BookOpen,
  Brain,
  ChevronRight,
  ChevronUp,
  Flame,
  HardDrive,
  Lock,
  Paperclip,
  Star,
  Volume2,
  Loader2,
  X,
  Gift,
  Folder,
  MessageSquare,
  FileText,
  Trophy,
  Lightbulb,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { AnimatedPage, AnimatedItem, AnimatedStagger } from "@/components/AnimatedPage";
import {
  dashboardAnnouncementDismissKey,
  legacyDashboardAnnouncementDismissKeys,
} from "@/lib/dashboardAnnouncementKeys";
import { useVocabularyAudioPlayback } from "@/hooks/useVocabularyAudioPlayback";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFeatureAccess,
  canUseChatAttachments,
  canUseChatLibrary,
  canUseKnowledgeRack,
} from "@/hooks/useFeatureAccess";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

type UnitMetadataRow = {
  unitNumber: number;
  language: string;
  title?: string;
  description?: string;
  topics?: string[];
};

type AudioSample = {
  id: string;
  serbian: string;
  translation?: string;
  audioStorageId?: string | null;
};

type WishlistStatus =
  | "pending"
  | "submitted"
  | "in_review"
  | "on_todo_list"
  | "im_working_on_it"
  | "shipped"
  | "duplicate"
  | "rejected";

function wishlistStatusToken(status: WishlistStatus): {
  key: string;
  className: string;
} {
  switch (status) {
    case "on_todo_list":
      return {
        key: "dashboard.community.wishlist.status.on_todo_list",
        className:
          "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-800/40",
      };
    case "im_working_on_it":
      return {
        key: "dashboard.community.wishlist.status.im_working_on_it",
        className:
          "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/40",
      };
    case "shipped":
      return {
        key: "dashboard.community.wishlist.status.shipped",
        className:
          "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800/40",
      };
    case "in_review":
      return {
        key: "dashboard.community.wishlist.status.in_review",
        className:
          "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800/40",
      };
    default:
      return {
        key: "dashboard.community.wishlist.status.pending",
        className:
          "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800/40",
      };
  }
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const { language: uiLanguage } = useLanguage();
  const featureAccess = useFeatureAccess();
  const hasChatAttachments = canUseChatAttachments(featureAccess);
  const hasChatLibrary = canUseChatLibrary(featureAccess);
  const hasKnowledgeRack = canUseKnowledgeRack(featureAccess);
  const hasLibraryAccess = hasChatLibrary || hasKnowledgeRack;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

    if (!kind || (value !== "return" && value !== "success")) return;

    setCheckoutReturn({ kind, startedAt: Date.now() });
    toast.info(t("billing.checkout.closedVerifying"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayLanguage = user?.learningLanguage || (i18n.language === "de" ? "de" : "en");

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
    const sub: { status?: string; planType?: string; plan?: string } | null | undefined = currentSubscription;
    if (sub === undefined) return;

    const status = String(sub?.status || "");
    const planType = String(sub?.planType ?? sub?.plan ?? "")
      .trim()
      .toLowerCase();
    const isPaidPlan =
      planType === "intensive" ||
      planType === "balanced" ||
      planType === "standard" ||
      planType === "relaxed";

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
  }, [checkoutReturn, currentSubscription, t]);

  useEffect(() => {
    if (!checkoutReturn) return;

    const timeoutId = window.setTimeout(() => {
      toast.info(t("billing.checkout.notConfirmedYet"));
      clearCheckoutReturnParams();
      setCheckoutReturn(null);
    }, 30_000);

    return () => window.clearTimeout(timeoutId);
  }, [checkoutReturn, t]);

  const units = useQuery(api.units.getAllUnitsMetadata, { language: displayLanguage });
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const dashboardStats = useQuery(api.progress.getDashboardStats, { todayStart });
  const seedDay = new Date().toISOString().slice(0, 10);
  const practicePreview = useQuery(
    api.vocabulary.getPracticePreview,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit, seedDay, audioCount: 5, language: displayLanguage }
  );
  const libraryHubStats = useQuery(
    api.documents.getLibraryHubStats,
    user && hasLibraryAccess ? {} : "skip"
  );
  const libraryFolders = useQuery(api.chatLibrary.listFolders, hasChatLibrary ? {} : "skip");

  const leaderboardTop5 = useQuery(
    api.leaderboard.getPublicLeaderboard,
    user ? { period: "7d", limit: 5 } : "skip"
  );
  const wishlistTop = useQuery(
    api.wishlist.listWishlistItems,
    user ? { sort: "top" } : "skip"
  );

  const [showOnboarding, setShowOnboarding] = useState(false);
  const { play, playingAudioId, loadingAudioId } = useVocabularyAudioPlayback();
  const [showAnnouncementBanner, setShowAnnouncementBanner] = useState(true);

  const activeAnnouncement = useQuery(
    api.dashboardAnnouncements.getActiveDashboardAnnouncementForUser,
    user ? { language: uiLanguage } : "skip"
  );

  useEffect(() => {
    if (!user || activeAnnouncement === undefined) return;
    if (activeAnnouncement === null) {
      setShowAnnouncementBanner(false);
      return;
    }

    const dismissKey = dashboardAnnouncementDismissKey(
      user._id,
      activeAnnouncement.key,
      activeAnnouncement.activationGeneration
    );

    try {
      if (activeAnnouncement.activationGeneration === 1) {
        for (const legacyKey of legacyDashboardAnnouncementDismissKeys(user._id, activeAnnouncement.key)) {
          if (localStorage.getItem(legacyKey) === "true") {
            localStorage.setItem(dismissKey, "true");
          }
        }
      }
      setShowAnnouncementBanner(localStorage.getItem(dismissKey) !== "true");
    } catch {
      setShowAnnouncementBanner(true);
    }
  }, [user, activeAnnouncement]);

  const handleDismissAnnouncementBanner = () => {
    if (!user || !activeAnnouncement) return;
    try {
      localStorage.setItem(
        dashboardAnnouncementDismissKey(user._id, activeAnnouncement.key, activeAnnouncement.activationGeneration),
        "true"
      );
      setShowAnnouncementBanner(false);
    } catch {
      // ignore
    }
  };

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
      localStorage.setItem(`onboarding_disabled_${user._id}`, "true");
    }
    setShowOnboarding(false);
  };

  const completedUnits = progress?.completedUnits || [];
  const isBeta = user?.isBetaTester || accessibleUnits?.isBeta || false;
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";

  const preferredLang = i18n.language === "de" ? "de" : "en";

  const getUnitRow = useCallback(
    (unitNumber: number): UnitMetadataRow | undefined => {
      if (!units) return undefined;
      const list = units as UnitMetadataRow[];
      return (
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber && u.language === preferredLang) ??
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber && u.language === "en") ??
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber)
      );
    },
    [units, preferredLang]
  );

  // Bug-Fix: alle Einheiten aus der Metadaten-Query nehmen (nicht mehr nur die freigeschalteten).
  // Der "Locked"-Status wird pro Karte anhand von accessibleUnits.maxUnits ermittelt.
  const allUnitNumbers = useMemo(() => {
    if (!units) return [] as number[];
    const list = units as UnitMetadataRow[];
    const set = new Set<number>();
    for (const row of list) {
      if (row.language === preferredLang || row.language === "en") {
        set.add(row.unitNumber);
      }
    }
    if (progress?.currentUnit) set.add(progress.currentUnit);
    for (const c of completedUnits) set.add(c);
    return Array.from(set).sort((a, b) => a - b);
  }, [units, preferredLang, progress?.currentUnit, completedUnits]);

  const totalUnits = isBeta ? 1 : allUnitNumbers.length || 0;
  const sortedUnits = allUnitNumbers;
  const isBetaTester = !!user?.isBetaTester;

  const completedBadgeClass =
    "bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm";
  const masteredBadgeClass = "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm";

  const weeklyXp = dashboardStats?.weeklyProgress?.xpSum ?? 0;
  const weeklyXpTarget = dashboardStats?.weeklyGoal?.xpTarget ?? 150;
  const weeklyXpPercent = weeklyXpTarget > 0 ? Math.min(100, Math.round((weeklyXp / weeklyXpTarget) * 100)) : 0;
  const streakDays = dashboardStats?.activeDaysCurrentStreak ?? 0;

  const courseMasteryPercent = useMemo(() => {
    const total = totalUnits || 0;
    if (!total) return null;
    const completed = (dashboardStats?.completedUnits?.length ?? completedUnits.length) || 0;
    return Math.round((completed / total) * 100);
  }, [dashboardStats?.completedUnits?.length, completedUnits.length, totalUnits]);

  const practicePreviewWord = practicePreview?.word ?? null;
  const audioSamples = practicePreview?.audioSamples ?? [];
  const currentUnitMeta = getUnitRow(safeCurrentUnit);

  const previewWords = useMemo(() => {
    type PreviewWord = AudioSample & { featured?: boolean };
    const items: PreviewWord[] = [];
    if (practicePreviewWord) {
      items.push({
        id: practicePreviewWord.id,
        serbian: practicePreviewWord.serbian,
        translation: practicePreviewWord.translation,
        audioStorageId: null,
        featured: true,
      });
    }
    for (const sample of audioSamples as AudioSample[]) {
      if (items.some((w) => w.id === sample.id)) continue;
      items.push(sample);
    }
    return items.slice(0, 6);
  }, [practicePreviewWord, audioSamples]);

  const topLevelLibraryFolders = useMemo(() => {
    if (!libraryFolders) return [];
    return libraryFolders.filter((f) => !f.parentId).slice(0, 4);
  }, [libraryFolders]);

  const topWishlist = useMemo(() => {
    if (!wishlistTop) return [];
    return wishlistTop.slice(0, 3);
  }, [wishlistTop]);

  if (authLoading || progressLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-7xl space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-28 w-full" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding
          userName={user.name || user.email || t("common.there")}
          onClose={handleCloseOnboarding}
          language={displayLanguage}
        />
      )}

      <AnimatedPage className="pb-24">
        {showAnnouncementBanner && activeAnnouncement && (
          <AnimatedItem className="mb-4">
            <div className="border border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-lg p-3 md:p-4">
              <div className="flex items-start gap-2 md:gap-3">
                <div className="bg-yellow-400 rounded-full p-1.5 md:p-2 flex-shrink-0">
                  <Gift className="h-4 w-4 md:h-5 md:w-5 text-yellow-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                    <h3 className="font-bold text-base md:text-lg text-foreground">{activeAnnouncement.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0"
                      onClick={handleDismissAnnouncementBanner}
                      aria-label={t("dashboard.betaBanner.dismissAria")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs md:text-sm text-foreground/80 mb-1 md:mb-2">{activeAnnouncement.intro}</p>
                  <div className="bg-background/80 rounded-md p-1.5 md:p-2 border border-yellow-300">
                    <p className="text-xs md:text-sm text-muted-foreground whitespace-pre-wrap">
                      {activeAnnouncement.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedItem>
        )}

        {/* Welcome-Header mit Status-Chips + XP-Progress */}
        <AnimatedItem className="mb-5 md:mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
                {t("dashboard.welcome", { name: user.name?.split(" ")[0] || t("dashboard.welcomeFallbackName") })}
              </h1>
              <Link href="/progress">
                <Button variant="link" size="sm" className="h-auto p-0 text-primary self-start sm:self-auto">
                  {t("dashboard.openProgress")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Wochenziel XP */}
              <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("dashboard.header.weeklyGoal")}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {weeklyXp}/{weeklyXpTarget} XP
                  </span>
                </div>
                <Progress value={weeklyXpPercent} className="h-1.5" indicatorClassName="bg-[color:var(--accent)]" />
              </div>

              {/* Streak */}
              <div className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-2.5">
                <div className="rounded-md bg-serbian-red/10 p-1.5 shrink-0">
                  <Flame className="h-4 w-4 text-serbian-red" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("dashboard.header.streak")}
                  </div>
                  <div className="flex items-baseline gap-1 leading-tight">
                    <span className="text-sm font-semibold tabular-nums">{streakDays}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("dashboard.header.streakUnit")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kurs-Mastery */}
              <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("dashboard.header.courseMastery")}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {courseMasteryPercent === null ? "—" : `${courseMasteryPercent}%`}
                  </span>
                </div>
                <Progress
                  value={courseMasteryPercent ?? 0}
                  className="h-1.5"
                  indicatorClassName="bg-[color:var(--brand-blue)]"
                />
              </div>
            </div>
          </div>
        </AnimatedItem>

        {/* Hero-Split: Weiterlernen · AI-Buddy */}
        <AnimatedItem interactive className="mb-4">
          <Card className="overflow-hidden border border-border shadow-sm">
            <div className="grid md:grid-cols-5">
              {/* Weiterlernen (linke Seite, 3/5) */}
              <div className="md:col-span-3 p-5 md:p-6 border-b md:border-b-0 md:border-r border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide font-medium">
                    {t("dashboard.hero.currentUnitEyebrow")}
                  </Badge>
                  <Badge className="text-[11px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                    {t("dashboard.unit", { number: safeCurrentUnit })}
                  </Badge>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-snug mb-1.5">
                  {currentUnitMeta?.title ?? t("dashboard.tools.continue.descFallback", { number: safeCurrentUnit })}
                </h2>
                {currentUnitMeta?.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                    {currentUnitMeta.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/unit/${safeCurrentUnit}`}>
                    <Button size="lg" className="gap-2">
                      <BookOpen className="h-4 w-4" />
                      {t("dashboard.hero.continueCta")}
                    </Button>
                  </Link>
                  <Link href={`/unit/${safeCurrentUnit}`}>
                    <Button size="lg" variant="ghost" className="gap-2 text-muted-foreground">
                      {t("dashboard.hero.overviewCta")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* AI-Buddy (rechte Seite, 2/5) */}
              <div className="md:col-span-2 p-5 md:p-6 bg-gradient-to-br from-serbian-red/[0.08] via-serbian-red/[0.04] to-background flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="rounded-xl bg-serbian-red p-2.5 shrink-0 shadow-sm">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide font-medium text-serbian-red/80 mb-0.5">
                      {t("dashboard.hero.buddyEyebrow")}
                    </div>
                    <CardTitle className="text-base md:text-lg font-semibold leading-tight">
                      {t("dashboard.tools.buddy.title")}
                    </CardTitle>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3 flex-1">
                  {t("dashboard.hero.buddyDesc")}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    {t("dashboard.tools.buddy.chip.explanations")}
                  </Badge>
                  {hasChatAttachments && (
                    <Badge variant="secondary" className="text-[11px] font-normal gap-1">
                      <Paperclip className="h-3 w-3" />
                      {t("dashboard.tools.buddy.chip.upload")}
                    </Badge>
                  )}
                </div>
                <Link href="/chat">
                  <Button className="w-full bg-serbian-red hover:bg-serbian-red/90 gap-2">
                    {t("dashboard.hero.buddyCta")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </AnimatedItem>

        {/* Sekundäre Aktionen: Quiz + Übersicht */}
        <AnimatedItem className="mb-6">
          <AnimatedStagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnimatedItem interactive>
              <Link href={`/vocabulary?mode=quiz&unit=${safeCurrentUnit}`}>
                <Card className="h-full border border-border hover:border-[color:var(--accent)]/60 hover:shadow-md transition-all cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="rounded-lg bg-[color:var(--accent)]/15 p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                      <Star className="h-5 w-5 text-[color:var(--accent)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{t("dashboard.tools.quiz.title")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("dashboard.tools.quiz.desc", { number: safeCurrentUnit })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </CardContent>
                </Card>
              </Link>
            </AnimatedItem>

            <AnimatedItem interactive>
              <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`}>
                <Card className="h-full border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="rounded-lg bg-primary/15 p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{t("dashboard.tools.vocabulary.title")}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {t("dashboard.tools.vocabulary.benefit")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </CardContent>
                </Card>
              </Link>
            </AnimatedItem>
          </AnimatedStagger>
        </AnimatedItem>

        {/* Praxis: Vokabel-Preview + Bibliothek */}
        <AnimatedItem className="mb-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border">
              <CardHeader className="py-3 px-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-serbian-red" />
                    {t("dashboard.practicePreview.audio.title")}
                  </CardTitle>
                  <div className="flex gap-1.5 shrink-0">
                    <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                        <BookOpen className="h-3 w-3" />
                        {t("dashboard.tools.vocabulary.learnCta")}
                      </Button>
                    </Link>
                    <Link href={`/vocabulary?mode=quiz&unit=${safeCurrentUnit}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                        <Star className="h-3 w-3" />
                        {t("dashboard.tools.vocabulary.quizCta")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {practicePreview === undefined ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : previewWords.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-3 text-center">
                    {t("dashboard.practicePreview.empty")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {previewWords.map((w) => {
                      const isLoading = loadingAudioId === w.id;
                      const isPlaying = playingAudioId === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() =>
                            play({
                              vocabularyId: w.id,
                              serbianWord: w.serbian,
                              unitNumber: safeCurrentUnit,
                              audioStorageId: w.audioStorageId,
                            })
                          }
                          disabled={Boolean(loadingAudioId) && loadingAudioId !== w.id}
                          className={`text-left rounded-lg border p-2 min-w-0 transition-colors hover:bg-accent/40 ${
                            w.featured ? "border-primary/40 bg-primary/5" : "bg-background"
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold truncate">{w.serbian}</span>
                              {w.translation && (
                                <span className="block text-[11px] text-muted-foreground truncate">
                                  {w.translation}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-serbian-red mt-0.5">
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Volume2 className="h-3 w-3" />
                              )}
                            </span>
                          </div>
                          {isPlaying && (
                            <span className="text-[10px] font-medium text-serbian-red mt-0.5 block">
                              {t("common.playing")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {hasLibraryAccess ? (
              <Link href="/library">
                <Card className="border border-border h-full hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <CardHeader className="py-3 px-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" />
                        {t("dashboard.tools.library.title")}
                      </CardTitle>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    {libraryHubStats && (
                      <CardDescription className="text-xs mt-1">
                        {t("dashboard.libraryPreview.stats", {
                          chats: libraryHubStats.chatSessionCount,
                          docs: libraryHubStats.documentCount,
                        })}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="rounded-lg border bg-muted/20 p-2 space-y-1 min-h-[7.5rem]">
                      {libraryHubStats === undefined ? (
                        <Skeleton className="h-20 w-full" />
                      ) : topLevelLibraryFolders.length > 0 ? (
                        topLevelLibraryFolders.map((folder) => (
                          <div
                            key={folder._id}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs bg-background/80"
                          >
                            <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate font-medium">{folder.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 text-center text-xs text-muted-foreground">
                          <MessageSquare className="h-5 w-5 mb-1.5 opacity-50" />
                          <p>{t("dashboard.libraryPreview.emptyFolders")}</p>
                        </div>
                      )}
                      {hasKnowledgeRack && libraryHubStats && libraryHubStats.documentCount > 0 && (
                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs bg-background/80 border-t border-border/50 mt-1 pt-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {t("dashboard.libraryPreview.documents", { count: libraryHubStats.documentCount })}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card className="border border-dashed border-muted-foreground/30 bg-muted/10 h-full">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      {t("dashboard.tools.library.title")}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {t("dashboard.tools.library.comingSoon")}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {t("dashboard.tools.library.benefit")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="rounded-lg border border-dashed bg-muted/30 p-2 space-y-1 opacity-70">
                    {(["demo1", "demo2", "demo3"] as const).map((key) => (
                      <div key={key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate text-muted-foreground">
                          {t(`dashboard.libraryPreview.${key}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </AnimatedItem>

        {/* Alle Einheiten - jetzt wirklich alle */}
        <AnimatedItem className="mb-6">
          {sortedUnits.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t("dashboard.emptyLearning.title")}
              description={t("dashboard.emptyLearning.desc")}
              action={{
                label: t("dashboard.emptyLearning.actionStartFirstUnit"),
                href: "/unit/1",
              }}
            />
          ) : (
            <Card className="border border-border">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {t("dashboard.allUnitsCount", { count: sortedUnits.length })}
                    </CardTitle>
                    <CardDescription className="text-sm">{t("dashboard.allUnitsDesc")}</CardDescription>
                  </div>
                  <Link href="/units">
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary self-start">
                      {t("dashboard.allUnitsOpenPage")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <AnimatedStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedUnits.map((unitNum) => {
                    const unit = getUnitRow(unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;
                    const isMastered = masteredUnits?.includes(unitNum);
                    const isLocked = isBetaTester && unitNum > (accessibleUnits?.maxUnits ?? 1);
                    const notStarted = !isCompleted && !isCurrent && !isLocked;

                    if (isLocked) {
                      return (
                        <AnimatedItem key={unitNum}>
                          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 opacity-80 h-full">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline">{t("dashboard.unit", { number: unitNum })}</Badge>
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground font-medium">
                                {t("dashboard.locked")}
                              </span>
                            </div>
                            <p className="font-medium text-muted-foreground leading-snug">{unit?.title}</p>
                            {unit?.description && (
                              <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                                {unit.description}
                              </p>
                            )}
                          </div>
                        </AnimatedItem>
                      );
                    }

                    return (
                      <AnimatedItem key={unitNum} interactive>
                        <Link href={`/unit/${unitNum}`}>
                          <div
                            className={`rounded-lg border p-4 h-full transition-all hover:shadow-md flex flex-col ${
                              isCurrent
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                : isMastered
                                  ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/10"
                                  : isCompleted
                                    ? "border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)]"
                                    : "hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant={isCurrent ? "default" : "outline"} className="text-xs">
                                {t("dashboard.unit", { number: unitNum })}
                              </Badge>
                              {isMastered && (
                                <Badge className={masteredBadgeClass}>
                                  <Star className="mr-1 h-3 w-3 text-white" fill="currentColor" strokeWidth={0} />
                                  {t("common.mastered")}
                                </Badge>
                              )}
                              {isCompleted && !isMastered && (
                                <Badge className={completedBadgeClass}>{t("dashboard.completedBadge")}</Badge>
                              )}
                              {isCurrent && !isCompleted && (
                                <span className="text-primary text-xs font-medium">
                                  {t("dashboard.currentLessonBadge")}
                                </span>
                              )}
                              {notStarted && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  {t("dashboard.unitStatus.notStarted")}
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold leading-snug mb-1">{unit?.title}</p>
                            {unit?.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                                {unit.description}
                              </p>
                            )}
                            <div className="mt-3">
                              <Button
                                variant={isCurrent ? "default" : "outline"}
                                size="sm"
                                className="pointer-events-none w-full"
                              >
                                {isCompleted
                                  ? t("dashboard.review")
                                  : isCurrent
                                    ? t("dashboard.continue")
                                    : t("dashboard.start")}
                              </Button>
                            </div>
                          </div>
                        </Link>
                      </AnimatedItem>
                    );
                  })}
                </AnimatedStagger>
              </CardContent>
            </Card>
          )}
        </AnimatedItem>

        {/* Community-Sektion: Leaderboard · Wunschliste · Feedback */}
        <AnimatedItem>
          <div className="mb-3 flex items-baseline gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base md:text-lg font-semibold text-foreground">
              {t("dashboard.community.title")}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t("dashboard.community.subtitle")}
            </span>
          </div>

          <AnimatedStagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Top-5 Leaderboard */}
            <AnimatedItem>
              <Card className="border border-border h-full flex flex-col">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-serbian-blue" />
                      {t("dashboard.community.leaderboard.title")}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {t("dashboard.community.leaderboard.periodChip")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 flex-1 flex flex-col">
                  {leaderboardTop5 === undefined ? (
                    <div className="space-y-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : leaderboardTop5.entries.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                      <Trophy className="h-6 w-6 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-medium">
                        {t("dashboard.community.leaderboard.emptyTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("dashboard.community.leaderboard.emptyDesc")}
                      </p>
                    </div>
                  ) : (
                    <>
                      <ul className="space-y-1 flex-1">
                        {leaderboardTop5.entries.map((entry) => (
                          <li
                            key={`${entry.rank}-${entry.nickname}`}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                              entry.isYou
                                ? "bg-serbian-red/10 border border-serbian-red/30"
                                : "bg-background"
                            }`}
                          >
                            <RankPill rank={entry.rank} />
                            {entry.avatarUrl ? (
                              <img
                                src={entry.avatarUrl}
                                alt=""
                                className="h-6 w-6 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
                            )}
                            <span className="truncate font-medium text-xs flex-1">
                              {entry.nickname}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                              {entry.xp.toLocaleString()} XP
                            </span>
                          </li>
                        ))}
                      </ul>
                      {leaderboardTop5.self && !leaderboardTop5.self.isInTopTen && (
                        <div className="mt-2 pt-2 border-t border-dashed border-border">
                          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs bg-serbian-red/5">
                            <RankPill rank={leaderboardTop5.self.rank} />
                            <span className="truncate flex-1 font-medium">
                              {t("dashboard.community.leaderboard.yourRank", {
                                rank: leaderboardTop5.self.rank,
                                xp: leaderboardTop5.self.xp.toLocaleString(),
                              })}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <Link href="/leaderboards" className="block mt-3">
                    <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                      {t("dashboard.community.leaderboard.viewAll")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </AnimatedItem>

            {/* Wunschliste */}
            <AnimatedItem>
              <Card className="border border-border h-full flex flex-col">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      {t("dashboard.community.wishlist.title")}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {t("dashboard.community.wishlist.chip")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 flex-1 flex flex-col">
                  {wishlistTop === undefined ? (
                    <div className="space-y-1.5 flex-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : topWishlist.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                      <Lightbulb className="h-6 w-6 text-muted-foreground/60 mb-2" />
                      <p className="text-sm font-medium">
                        {t("dashboard.community.wishlist.emptyTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("dashboard.community.wishlist.emptyDesc")}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-1.5 flex-1">
                      {topWishlist.map((item) => {
                        const status = wishlistStatusToken(item.status as WishlistStatus);
                        return (
                          <li key={item._id}>
                            <Link href={`/wishlist/${item._id}`}>
                              <div className="flex items-start gap-2 rounded-md border border-transparent bg-muted/30 hover:bg-muted/60 hover:border-border transition-colors px-2 py-1.5">
                                <div className="flex flex-col items-center gap-0.5 rounded bg-background border border-border px-1.5 py-1 shrink-0 min-w-[2.25rem]">
                                  <ChevronUp className="h-3 w-3 text-primary" />
                                  <span className="text-[11px] font-semibold tabular-nums leading-none">
                                    {item.upvoteCount ?? 0}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium truncate leading-tight">
                                    {item.title}
                                  </p>
                                  <span
                                    className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${status.className}`}
                                  >
                                    {t(status.key)}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Link href="/wishlist/new" className="flex-1">
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                        {t("dashboard.community.wishlist.submitCta")}
                      </Button>
                    </Link>
                    <Link href="/wishlist">
                      <Button variant="link" size="sm" className="h-auto p-0 text-primary text-xs">
                        {t("dashboard.community.wishlist.viewAll")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </AnimatedItem>

            {/* Feedback-CTA */}
            <AnimatedItem>
              <Card className="border border-border h-full flex flex-col bg-gradient-to-br from-serbian-red/[0.04] via-background to-background">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-serbian-red" />
                    <CardTitle className="text-sm font-semibold">
                      {t("dashboard.community.feedback.title")}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 flex-1 flex flex-col">
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                    {t("dashboard.community.feedback.desc")}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3 mb-3">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {t("dashboard.community.feedback.chip.bug")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {t("dashboard.community.feedback.chip.idea")}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {t("dashboard.community.feedback.chip.question")}
                    </Badge>
                  </div>
                  <Link href="/feedback">
                    <Button className="w-full bg-serbian-red hover:bg-serbian-red/90 h-8 text-xs gap-1.5">
                      {t("dashboard.community.feedback.cta")}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </AnimatedItem>
          </AnimatedStagger>
        </AnimatedItem>
      </AnimatedPage>
    </>
  );
}

function RankPill({ rank }: { rank: number }) {
  const base =
    "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 border";
  if (rank === 1) {
    return (
      <div className={`${base} bg-[color:var(--accent)] text-white border-white/40`} aria-label={`Rank ${rank}`}>
        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        className={`${base} bg-slate-300 text-slate-900 border-slate-200 dark:bg-slate-500 dark:text-white dark:border-slate-400/40`}
        aria-label={`Rank ${rank}`}
      >
        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div
        className={`${base} bg-amber-700 text-white border-amber-600/50 dark:bg-amber-600 dark:border-amber-500/40`}
        aria-label={`Rank ${rank}`}
      >
        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className={`${base} bg-serbian-blue text-white border-white/55 dark:border-white/20`}>
      {rank}
    </div>
  );
}
