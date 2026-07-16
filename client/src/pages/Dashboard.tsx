import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  BookOpen,
  Brain,
  ChevronRight,
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
  const totalUnits = isBeta ? 1 : units?.length || 0;
  const isAdmin = user?.role === "superadmin" || user?.role === "admin";
  const rawAccessible = Array.isArray(accessibleUnits)
    ? accessibleUnits
    : Array.isArray((accessibleUnits as { units?: number[] })?.units)
      ? (accessibleUnits as { units: number[] }).units
      : Array.isArray((accessibleUnits as { accessibleUnits?: number[] })?.accessibleUnits)
        ? (accessibleUnits as { accessibleUnits: number[] }).accessibleUnits
        : [];

  const displayUnits = isAdmin
    ? (units as UnitMetadataRow[] | undefined)?.map((u: UnitMetadataRow) => u.unitNumber)
    : rawAccessible;

  const visibleUnits = Array.from(
    new Set(
      [...(displayUnits || []), ...(rawAccessible || []), progress?.currentUnit, ...completedUnits].filter(
        Boolean
      ) as number[]
    )
  );

  const isBetaTester = !!user?.isBetaTester;

  const getUnitRow = useCallback(
    (unitNumber: number): UnitMetadataRow | undefined => {
      if (!units) return undefined;
      const list = units as UnitMetadataRow[];
      const preferredLang = i18n.language === "de" ? "de" : "en";
      return (
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber && u.language === preferredLang) ??
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber && u.language === "en") ??
        list.find((u: UnitMetadataRow) => u.unitNumber === unitNumber)
      );
    },
    [units, i18n.language]
  );

  const sortedUnits = useMemo(
    () => [...visibleUnits].sort((a, b) => a - b),
    [visibleUnits]
  );

  const completedBadgeClass =
    "bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm";
  const masteredBadgeClass = "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm";

  const weeklyXp = dashboardStats?.weeklyProgress?.xpSum ?? 0;
  const weeklyXpTarget = dashboardStats?.weeklyGoal?.xpTarget ?? 150;

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

          <AnimatedItem className="mb-5 md:mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">
                {t("dashboard.welcome", { name: user.name?.split(" ")[0] || t("dashboard.welcomeFallbackName") })}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {weeklyXp}/{weeklyXpTarget} XP
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {courseMasteryPercent === null ? "—" : `${courseMasteryPercent}%`}{" "}
                  {t("progress.cards.summary.courseMastery").toLowerCase()}
                </span>
                <Link href="/progress">
                  <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                    {t("dashboard.openProgress")}
                  </Button>
                </Link>
              </div>
            </div>
          </AnimatedItem>

          {/* Featured: AI Learn Buddy */}
          <AnimatedItem interactive className="mb-4">
            <Card className="overflow-hidden border-2 border-serbian-red/25 bg-gradient-to-br from-serbian-red/[0.07] via-background to-background shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="rounded-xl bg-serbian-red p-3 shrink-0 shadow-sm">
                      <Brain className="h-7 w-7 text-white" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg md:text-xl font-semibold mb-1">
                        {t("dashboard.tools.buddy.title")}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("dashboard.tools.buddy.featuredDesc")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {t("dashboard.tools.buddy.chip.explanations")}
                        </Badge>
                        {hasChatAttachments && (
                          <Badge variant="secondary" className="text-xs font-normal gap-1">
                            <Paperclip className="h-3 w-3" />
                            {t("dashboard.tools.buddy.chip.upload")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href="/chat" className="shrink-0 w-full md:w-auto">
                    <Button size="lg" className="w-full md:w-auto bg-serbian-red hover:bg-serbian-red/90 gap-2">
                      {t("dashboard.tools.buddy.cta")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </AnimatedItem>

          {/* Quick actions: Quiz + Current unit */}
          <AnimatedItem className="mb-4">
            <AnimatedStagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatedItem interactive>
                <Link href={`/vocabulary?mode=quiz&unit=${safeCurrentUnit}`}>
                  <Card className="h-full border-2 border-[color:var(--accent)]/30 bg-[color:var(--accent)]/5 hover:border-[color:var(--accent)]/60 hover:shadow-md transition-all cursor-pointer group">
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
                <Link href={`/unit/${safeCurrentUnit}`}>
                  <Card className="h-full border-2 border-primary/30 bg-primary/5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="rounded-lg bg-primary/15 p-2.5 shrink-0 group-hover:scale-105 transition-transform">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm">
                          {t("dashboard.unit", { number: safeCurrentUnit })}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {currentUnitMeta?.title ?? t("dashboard.tools.continue.descFallback", { number: safeCurrentUnit })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </CardContent>
                  </Card>
                </Link>
              </AnimatedItem>
            </AnimatedStagger>
          </AnimatedItem>

          {/* Practice vocabulary + Library preview */}
          <AnimatedItem className="mb-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border border-border">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold">{t("dashboard.tools.vocabulary.title")}</CardTitle>
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
                      <CardTitle className="text-sm font-semibold">{t("dashboard.tools.library.title")}</CardTitle>
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

          {/* Full units overview */}
          <AnimatedItem>
            {completedUnits.length === 0 && sortedUnits.length === 0 ? (
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
                      <CardTitle className="text-lg font-semibold">{t("dashboard.allUnits")}</CardTitle>
                      <CardDescription className="text-sm">{t("dashboard.allUnitsDesc")}</CardDescription>
                    </div>
                    <Link href="/units">
                      <Button variant="outline" size="sm">
                        {t("dashboard.upNext.viewAll")}
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <AnimatedStagger className="grid gap-3 sm:grid-cols-2">
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
                            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 opacity-70 h-full">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="outline">{t("dashboard.unit", { number: unitNum })}</Badge>
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-medium">
                                  {t("dashboard.locked")}
                                </span>
                              </div>
                              <p className="font-medium text-muted-foreground">{unit?.title}</p>
                            </div>
                          </AnimatedItem>
                        );
                      }

                      return (
                        <AnimatedItem key={unitNum} interactive>
                          <Link href={`/unit/${unitNum}`}>
                            <div
                              className={`rounded-lg border p-4 h-full transition-all hover:shadow-md ${
                                isCurrent
                                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                                  : isMastered
                                    ? "border-amber-400 bg-amber-50/40"
                                    : isCompleted
                                      ? "border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)]"
                                      : "hover:border-primary/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
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
                                  <p className="font-semibold leading-snug">{unit?.title}</p>
                                  {unit?.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {unit.description}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant={isCurrent ? "default" : "outline"}
                                  size="sm"
                                  className="shrink-0 pointer-events-none"
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
      </AnimatedPage>
    </>
  );
}
