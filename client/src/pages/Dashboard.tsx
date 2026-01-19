import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, Brain, Home, Lock, Star, TrendingUp, Volume2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { FeedbackForm } from "@/components/FeedbackForm";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { logger } from "@/lib/logger";
import { useVocabularyAudioPlayback } from "@/hooks/useVocabularyAudioPlayback";

import { useMemo, useState, useEffect } from "react";

export default function Dashboard() {
  const { user, loading: authLoading, logout, clerkUser } = useAuth();
  const { t, i18n } = useTranslation();
  
  // Use user's learning language or fallback to UI language or 'en'
  const displayLanguage = user?.learningLanguage || (i18n.language === 'de' ? 'de' : 'en');
  
  const progress = useQuery(api.progress.getUserProgress);
  const progressLoading = progress === undefined;
  const accessibleUnits = useQuery(api.subscriptions.getAccessibleUnits);
  const masteredUnits = useQuery(api.progress.getMasteredUnits, user ? undefined : "skip");
  const safeCurrentUnit =
    typeof progress?.currentUnit === "number" && Number.isFinite(progress.currentUnit) && progress.currentUnit > 0
      ? progress.currentUnit
      : 1;
  
  // Check if user has started the current unit (for Current vs Next Unit label)
  const currentUnitActivity = useQuery(
    api.progress.hasUnitActivity,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit }
  );
  
  // Load dynamic data from DB instead of static files
  const units = useQuery(api.units.getAllUnitsMetadata, { language: displayLanguage });
  const dashboardStats = useQuery(api.progress.getDashboardStats);
  const vocabWithProgress = useQuery(
    api.vocabulary.getVocabularyWithProgress,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit }
  );
  
  const syncUserMutation = useMutation(api.users.syncUser);

  // Explicit sync check: If Clerk user exists but Convex user doesn't, trigger sync
  useEffect(() => {
    if (clerkUser && !authLoading && !user) {
      // Wait a moment to let useAuth hook handle it first, then retry if needed
      const timeoutId = setTimeout(() => {
        syncUserMutation({ learningLanguage: 'en' })
          .catch((error) => {
            logger.error('[Dashboard] Manual sync failed:', error);
          });
      }, 3000); // Wait 3 seconds to give useAuth hook a chance first

      return () => clearTimeout(timeoutId);
    }
  }, [clerkUser, user, authLoading, syncUserMutation]);
  
  const updateProgressMutation = useMutation(api.progress.updateProgress);
  const completedBadgeClass = "bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm";
  const masteredBadgeClass = "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm";
  
  // Onboarding tutorial state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Practice preview state
  const [showPracticeAnswer, setShowPracticeAnswer] = useState(false);
  const { play, playingAudioId, loadingAudioId } = useVocabularyAudioPlayback();
  
  // Beta banner dismiss state
  const [showBetaBanner, setShowBetaBanner] = useState(true);
  
  // Load beta banner preference from localStorage
  useEffect(() => {
    if (user) {
      const dismissed = localStorage.getItem(`beta_banner_dismissed_${user._id}`);
      if (dismissed === 'true') {
        setShowBetaBanner(false);
      }
    }
  }, [user]);
  
  // Handle dismissing the beta banner permanently
  const handleDismissBetaBanner = () => {
    if (user) {
      localStorage.setItem(`beta_banner_dismissed_${user._id}`, 'true');
      setShowBetaBanner(false);
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
  const totalUnits = isBeta ? 3 : (units?.length || 27);
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

  const practicePreviewWord = useMemo(() => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) return null;
    const pick = vocabWithProgress.find((w: any) => (w.progress?.correctAnswerCount ?? 0) < 3) ?? vocabWithProgress[0];
    const translation =
      (pick?.en && String(pick.en).trim()) ||
      (Array.isArray(pick?.translations)
        ? (pick.translations.find((t: any) => t.language === "en")?.translation ?? "")
        : "");
    const mastered =
      Boolean(pick?.progress?.mastered) || (Number(pick?.progress?.correctAnswerCount ?? 0) || 0) >= 3;

    return {
      serbian: String(pick?.serbian ?? ""),
      translation: String(translation || "-"),
      mastered,
    };
  }, [vocabWithProgress]);

  const audioSamples = useMemo(() => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) return [];
    const samples = vocabWithProgress.slice(0, 5).map((w: any) => {
      const translation =
        (w?.en && String(w.en).trim()) ||
        (Array.isArray(w?.translations)
          ? (w.translations.find((t: any) => t.language === "en")?.translation ?? "")
          : "");
      return {
        id: String(w?._id ?? ""),
        serbian: String(w?.serbian ?? ""),
        translation: String(translation || "-"),
        audioStorageId: (w?.audioStorageId ?? null) as string | null,
      };
    });
    return samples.filter((s) => s.id && s.serbian);
  }, [vocabWithProgress]);


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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // All users now have immediate access - no pending approval needed

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding 
          userName={user.name || user.email || 'there'} 
          onClose={handleCloseOnboarding}
        />
      )}
      
      <AnimatedPage>
        <div className="pb-24">
        {/* Beta Tester Benefits Banner */}
        {user.isBetaTester && showBetaBanner && (
          <div className="mb-6 border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-400 rounded-full p-3 flex-shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-3 text-gray-900">{t('dashboard.betaBanner.title')}</h3>
                <p className="text-sm text-gray-700 mb-3">
                  <strong>{t('dashboard.betaBanner.thankYou')}</strong> {t('dashboard.betaBanner.intro')}
                </p>
                <ul className="text-sm text-gray-700 space-y-2 mb-4">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>{t('dashboard.betaBanner.benefit1')}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>{t('dashboard.betaBanner.benefit2')}</span>
                  </li>
                </ul>
                <div className="bg-white/80 rounded-md p-3 border border-yellow-300 mb-3">
                  <p className="text-xs text-gray-600">
                    <strong>{t('dashboard.betaBanner.afterLaunch')}</strong> {t('dashboard.betaBanner.afterLaunchDesc')}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <input 
                    type="checkbox" 
                    id="dismiss-beta-banner"
                    className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleDismissBetaBanner();
                      }
                    }}
                  />
                  <label htmlFor="dismiss-beta-banner" className="cursor-pointer select-none">
                    {t('dashboard.betaBanner.dontShow')}
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {t('dashboard.welcome', { name: user.name?.split(' ')[0] || 'Learner' })}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8 items-stretch">
          <AnimatedItem className="h-full">
            <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
              <CardHeader className="flex-1">
                <BookOpen className="h-10 w-10 text-primary mb-2" />
                <CardTitle>
                  {currentUnitActivity?.hasActivity ? t('dashboard.continueLesson') : t('dashboard.startNextLesson')}
                </CardTitle>
                <CardDescription>
                  {(() => {
                    const unit = units?.find(u => u.unitNumber === safeCurrentUnit);
                    return (
                      <>
                        <span className="font-semibold">{t('dashboard.unit', { number: safeCurrentUnit })}</span>
                        {unit?.title && <span> - {unit.title}</span>}
                      </>
                    );
                  })()}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href={`/unit/${safeCurrentUnit}`}>
                  <Button className="w-full">
                    {currentUnitActivity?.hasActivity ? t('dashboard.goToLesson') : t('dashboard.startLesson')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>

          <AnimatedItem className="h-full">
            <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
              <CardHeader className="flex-1">
                <Brain className="h-10 w-10 text-yellow-500 mb-2" />
                <CardTitle>{t('dashboard.chatWithProfessor')}</CardTitle>
                <CardDescription>
                  {t('dashboard.chatDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href="/chat">
                  <Button className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:border-yellow-600" variant="outline">{t('dashboard.openChat')}</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>
        </div>

        {/* Dashboard Snippets (informative) */}
        <AnimatedItem className="mb-10">
          <div className="grid gap-6 lg:grid-cols-3 items-stretch">
            {/* Practice Preview (wide) */}
            <Card className="lg:col-span-2 hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Practice Preview</CardTitle>
                    <CardDescription>
                      A quick taste of Learn Mode — no commitment, just start.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`}>
                      <Button size="sm" className="gap-2">
                        <BookOpen className="h-4 w-4" />
                        Learn
                      </Button>
                    </Link>
                    <Link href={`/vocabulary?mode=quiz&unit=${safeCurrentUnit}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-[color:var(--accent)] text-foreground hover:bg-[color:var(--accent)]/10 hover:border-[color:var(--accent)]"
                      >
                        <Star className="h-4 w-4 text-[color:var(--accent)]" />
                        Quiz
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!practicePreviewWord ? (
                  <div className="text-sm text-muted-foreground py-10 text-center">
                    Loading preview…
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 items-stretch">
                    <div className="rounded-xl border bg-muted/10 p-6 flex flex-col justify-center text-center">
                      <div className="inline-flex items-center justify-center gap-2 mb-2">
                        <Badge variant="outline">Unit {safeCurrentUnit}</Badge>
                        {practicePreviewWord.mastered && (
                          <Badge className="bg-amber-500 text-white border-amber-500">
                            Mastered
                          </Badge>
                        )}
                      </div>
                      <div className="text-4xl font-bold tracking-tight">
                        {practicePreviewWord.serbian}
                      </div>
                      <div className="mt-3 text-lg text-muted-foreground">
                        {showPracticeAnswer ? practicePreviewWord.translation : "—"}
                      </div>
                      <div className="mt-6 flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowPracticeAnswer((s) => !s)}
                        >
                          {showPracticeAnswer ? "Hide answer" : "Show answer"}
                        </Button>
                        <Link href={`/vocabulary?mode=learn&unit=${safeCurrentUnit}`}>
                          <Button>Open Trainer</Button>
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-xl border p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">Your next win</div>
                        <span className="text-sm text-muted-foreground">
                          This week
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">XP</span>
                          <span className="font-semibold">
                            {weeklyXp} / {weeklyXpTarget}
                          </span>
                        </div>
                        <ProgressBar value={Math.min(100, (weeklyXp / Math.max(1, weeklyXpTarget)) * 100)} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Active days</span>
                          <span className="font-semibold">
                            {weeklyActiveDays} / {weeklyActiveDaysTarget}
                          </span>
                        </div>
                        <ProgressBar value={Math.min(100, (weeklyActiveDays / Math.max(1, weeklyActiveDaysTarget)) * 100)} />
                      </div>
                      <div className="text-xs text-muted-foreground pt-2 border-t">
                        Tip: even a short Learn Buddy chat counts as an active day.
                      </div>
                    </div>

                    {/* Audio sampler (2nd row) */}
                    <div className="md:col-span-2 rounded-xl border bg-muted/10 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">Listen & repeat</div>
                          <div className="text-sm text-muted-foreground">
                            Tap a word to hear a native-like pronunciation.
                          </div>
                        </div>
                        <Link href="/vocabulary-list">
                          <Button variant="outline" size="sm">
                            View all words
                          </Button>
                        </Link>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {audioSamples.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-6">
                            No vocabulary available for audio preview yet.
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
                                    Playing
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
                      <CardTitle className="text-base">Weekly Goal</CardTitle>
                      <CardDescription>Small steps, consistent progress.</CardDescription>
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
                      <span className="text-muted-foreground">XP this week</span>
                      <span className="font-medium">{weeklyXp}</span>
                    </div>
                    <ProgressBar value={Math.min(100, (weeklyXp / Math.max(1, weeklyXpTarget)) * 100)} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active days</span>
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
                  <CardTitle className="text-base">Course Progress</CardTitle>
                  <CardDescription>Your current snapshot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Course mastery</span>
                    <span className="font-semibold">
                      {courseMasteryPercent === null ? "—" : `${courseMasteryPercent}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Units completed</span>
                    <span className="font-semibold">
                      {(dashboardStats?.completedUnits?.length ?? completedUnits.length) || 0} / {totalUnits}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Words mastered</span>
                    <span className="font-semibold">{wordsMastered}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mastery efficiency</span>
                    <span className="font-semibold">
                      {typeof masteryEfficiency === "number"
                        ? `${Math.round(masteryEfficiency * 100)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-semibold">
                      {startedDaysAgo === null ? "—" : `${startedDaysAgo}d ago`}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Link href="/progress">
                      <Button variant="outline" className="w-full">
                        Open Progress
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
          <Card className="bg-gradient-to-br from-background to-muted/30 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">
                    {t('dashboard.allUnits', 'All Units')}
                  </CardTitle>
                  <CardDescription className="text-base mt-2">
                    {t('dashboard.allUnitsDesc', 'Continue your learning journey')}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Badge variant="outline" className="bg-white/70">
                    Admin access
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5">
                    {visibleUnits?.map(unitNum => {
                    const unit = units?.find(u => u.number === unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;
                    const isMastered = masteredUnits?.includes(unitNum);
                    const isLocked = user.isBetaTester && unitNum > 3;

                    if (isLocked) {
                      return (
                        <Card key={unitNum} className="transition-all opacity-60 bg-gray-50 border-gray-300">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-gray-100">
                                    {t('dashboard.unit', { number: unitNum })}
                                  </Badge>
                                  <Lock className="h-4 w-4 text-gray-500" />
                                  <span className="text-gray-500 text-sm font-medium">{t('dashboard.locked')}</span>
                                </div>
                                <div className="font-semibold text-lg mb-1 text-gray-600">
                                  {i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish}
                                </div>
                                <div className="text-sm text-gray-500 mb-3">
                                  {unit?.title}
                                </div>
                                <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                                  🎁 <strong>{t('dashboard.betaTester.note')}</strong> {t('dashboard.betaTester.unlockNote')}
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
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
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
                                      {t('dashboard.masteredBadge', 'Mastered')}
                                    </Badge>
                                  )}
                                  {isCurrent && !isCompleted && (
                                    <span className="text-primary text-sm font-medium">{t('dashboard.currentLessonBadge')}</span>
                                  )}
                                </div>
                                <div className="font-semibold text-xl mb-2 leading-tight">
                                  {i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish}
                                </div>
                                <div className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                  {unit?.title}
                                </div>
                                {unit?.topics && unit.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-4">
                                    {(i18n.language === 'de' ? unit.topicsGerman : unit.topics).slice(0, 3).map((topic, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {topic}
                                      </Badge>
                                    ))}
                                    {(i18n.language === 'de' ? unit.topicsGerman : unit.topics).length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        {t('dashboard.moreTopics', { count: (i18n.language === 'de' ? unit.topicsGerman : unit.topics).length - 3 })}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                <Button 
                                  variant={isCurrent ? 'default' : 'outline'} 
                                  size="sm"
                                  className="whitespace-nowrap"
                                >
                                  {isCompleted ? t('dashboard.review') : isCurrent ? t('dashboard.continue') : t('dashboard.start')}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </AnimatedItem>
        </div>
      </AnimatedPage>
    </>
  );
}
