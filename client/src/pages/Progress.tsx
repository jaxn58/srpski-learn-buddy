import { useAuth } from "@/_core/hooks/useAuth";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import {
  TrendingUp,
  Calendar,
  Zap,
  Target,
  BookOpen,
  CheckCircle2,
  Trophy,
  Flame,
  ArrowRight,
  Star,
  Award,
  Lock,
  Footprints,
  Flag,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { formatDateEU, formatDateShortEU, formatMonthYearShortEU } from "@/lib/utils";
import { GamificationModal } from "@/components/GamificationModal";

type AchievementTone = "units" | "streak" | "xp" | "level" | "misc";
type AchievementIconComponent = React.ComponentType<{ className?: string }>;

const getAchievementTone = (badgeId: string): AchievementTone => {
  if (badgeId.startsWith("streak_")) return "streak";
  if (badgeId.startsWith("xp_")) return "xp";
  if (badgeId.startsWith("level_")) return "level";
  if (badgeId === "first_steps" || badgeId === "unit_complete" || badgeId === "five_units" || badgeId === "ten_units")
    return "units";
  return "misc";
};

const getAchievementIcon = (badgeId: string): AchievementIconComponent => {
  if (badgeId === "first_steps") return Footprints;
  if (badgeId === "unit_complete") return CheckCircle2;
  if (badgeId === "five_units") return Flag;
  if (badgeId === "ten_units") return Trophy;
  if (badgeId.startsWith("streak_")) return Flame;
  if (badgeId.startsWith("xp_")) return Zap;
  if (badgeId.startsWith("level_")) return Star;
  return Award;
};

const achievementToneEmblemClass = (tone: AchievementTone) => {
  if (tone === "units") return "bg-serbian-blue";
  if (tone === "streak") return "bg-serbian-red";
  if (tone === "xp") return "bg-gradient-to-br from-amber-400 to-amber-600";
  if (tone === "level") return "bg-gradient-to-br from-purple-500 to-indigo-600";
  return "bg-gradient-to-br from-slate-500 to-slate-700";
};

export default function Progress() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const stats = useQuery(api.progress.getDashboardStats);
  const backfillDailyActivity = useMutation(api.progress.backfillDailyActivityForCurrentUser);

  const userBadges = useQuery(api.badges.getUserBadges);
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);

  // Load modules and units from database
  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" });

  const [activityRange, setActivityRange] = useState<"7d" | "30d" | "lifetime">("7d");
  const didLegacyBackfillRef = useRef(false);
  const didReconcileRef = useRef(false);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Memoize modules list to prevent duplicate renders - MUST be before early returns
  const modulesList = useMemo(() => {
    if (!dbModules || dbModules.length === 0) return [];
    return dbModules.map((module: any) => ({
      id: module.slug || "",
      number: module.moduleNumber || 0,
      titleEnglish: module.titleEn || "",
      titleGerman: module.titleDe || "",
      units: (dbUnitsEn || [])
        .filter((unit: any) => unit.moduleId === module.slug)
        .map((unit: any) => unit.unitNumber),
    }));
  }, [dbModules, dbUnitsEn]);

  const isLoading = stats === undefined;

  // IMPORTANT: Do not navigate during render, and do not place early-returns before hooks.
  // Redirect unauthenticated users in an effect to keep hook order stable across renders.
  useEffect(() => {
    if (!user) {
      window.location.href = "/";
    }
  }, [user]);

  const completedUnits: number[] = stats?.completedUnits || [];
  const currentUnitNumber = useMemo(() => {
    const unique = Array.from(new Set((completedUnits || []).filter((n) => Number.isInteger(n) && n > 0))).sort(
      (a, b) => a - b
    );
    let u = 1;
    for (const n of unique) {
      if (n === u) {
        u += 1;
        continue;
      }
      if (n > u) break;
    }
    return u;
  }, [completedUnits]);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const totalUnitsFromDb = dbUnitsEn?.length || 27;
  const maxAccessibleUnits = accessInfo?.maxUnits ?? 0;
  const totalUnits = isAdmin
    ? totalUnitsFromDb
    : maxAccessibleUnits > 0
      ? Math.min(totalUnitsFromDb, maxAccessibleUnits)
      : totalUnitsFromDb;
  const progressPercent = totalUnits > 0 ? (completedUnits.length / totalUnits) * 100 : 0;

  // Dates / activity helpers
  // App-wide: European numeric dates (TT.MM.JJJJ). Weekday labels can still be localized.
  const weekdayLocale = i18n.language === "de" ? "de-DE" : "en-GB";
  const activityGranularity: "day" | "week" | "month" = activityRange === "lifetime" ? "month" : "day";

  // Fallback activity source: query dailyActivity directly for the selected window.
  // This makes 30D/Lifetime work even if getDashboardStats doesn't (yet) return activityChart30/activityChartDynamic.
  const dayMs = 24 * 60 * 60 * 1000;
  const createdAt = typeof stats?.creationTime === "number" ? stats.creationTime : Date.now();
  const daysSinceStartForActivity = Math.max(1, Math.floor((Date.now() - createdAt) / dayMs) + 1);
  // NOTE: "Lifetime" should mean "all recorded activity", not "since account creationTime".
  // Use a large window (10y) which is safe for per-day activity rows and avoids missing pre-creation legacy rows.
  const activityDays = activityRange === "7d" ? 7 : activityRange === "30d" ? 30 : 3650;
  const dailyActivityFallback = useQuery(api.units.getDailyActivity, { days: activityDays });
  const isDailyActivityFallbackLoading = dailyActivityFallback === undefined;
  // Always fetch 30D for the heatmap + meta, regardless of selected range.
  const dailyActivity30 = useQuery(api.units.getDailyActivity, { days: 30 });
  const isDailyActivity30Loading = dailyActivity30 === undefined;

  const activity7Raw = stats?.activityChart || [];
  const activity30Raw = (stats as any)?.activityChart30 || [];
  const activityLifetimeRaw = (stats as any)?.activityChartDynamic || [];

  const startOfDayTs = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const denseDays = (days: number, rows: Array<{ date: number; xp: number; units: number; exercises: number }>) => {
    const end = startOfDayTs(Date.now());
    const start = end - (days - 1) * dayMs;
    const map = new Map<number, { xp: number; units: number; exercises: number }>();
    for (const r of rows) {
      const key = startOfDayTs(r.date);
      map.set(key, { xp: r.xp ?? 0, units: r.units ?? 0, exercises: r.exercises ?? 0 });
    }
    const out: Array<{ date: number; xp: number; units: number; exercises: number }> = [];
    for (let i = 0; i < days; i++) {
      const date = start + i * dayMs;
      const v = map.get(date);
      out.push({ date, xp: v?.xp ?? 0, units: v?.units ?? 0, exercises: v?.exercises ?? 0 });
    }
    return out;
  };

  const activityFallbackRaw = (dailyActivityFallback || []).map((a: any) => ({
    date: a.activityDate,
    xp: a.xpEarned,
    units: a.unitsCompleted,
    exercises: a.exercisesCompleted,
  }));
  const activityFallback30Raw = (dailyActivity30 || []).map((a: any) => ({
    date: a.activityDate,
    xp: a.xpEarned,
    units: a.unitsCompleted,
    exercises: a.exercisesCompleted,
  }));

  // Make 7D/30D views always feel like 7/30 days (include zeros), even if DB only stores active days.
  const activityFallbackDense = useMemo(() => {
    if (isDailyActivityFallbackLoading) return [];
    if (activityDays > 30) return activityFallbackRaw;
    return denseDays(activityDays, activityFallbackRaw as any);
  }, [isDailyActivityFallbackLoading, activityDays, activityFallbackRaw]);

  const activityFallback30Dense = useMemo(() => {
    if (isDailyActivity30Loading) return [];
    return denseDays(30, activityFallback30Raw as any);
  }, [isDailyActivity30Loading, activityFallback30Raw]);

  const selectedActivity = (() => {
    // Prefer server-provided series when present, else fallback to dailyActivity query.
    if (activityRange === "7d") {
      return {
        raw: activityFallbackDense,
        granularity: "day" as const,
        source: "dailyActivity.7d" as const,
        loading: isDailyActivityFallbackLoading,
      };
    }
    if (activityRange === "30d") {
      return {
        raw: activityFallbackDense,
        granularity: "day" as const,
        source: "dailyActivity.30d" as const,
        loading: isDailyActivityFallbackLoading,
      };
    }
    {
      const hasLifetime = activityLifetimeRaw.length > 0;
      const raw = hasLifetime ? activityLifetimeRaw : activityFallbackRaw;
      return {
        raw,
        granularity: activityGranularity,
        source: hasLifetime ? ("stats.lifetime" as const) : ("dailyActivity.lifetime" as const),
        loading: !hasLifetime && isDailyActivityFallbackLoading,
      };
    }
  })();

  const activityData = (selectedActivity.raw || []).map((day: any) => {
    const date = new Date(day.date);
    const name =
      activityRange === "7d"
        ? date.toLocaleDateString(weekdayLocale, { weekday: "short" })
        : activityRange === "30d"
          ? formatDateShortEU(date)
          : selectedActivity.granularity === "month"
            ? formatMonthYearShortEU(date)
            : formatDateShortEU(date);

    return {
      name,
      xp: day.xp ?? 0,
      fullDate: formatDateEU(date),
    };
  });
  const hasAnyActivity = activityData.some((d: any) => (d?.xp ?? 0) > 0);
  const selectedXpSum = activityData.reduce((s: number, d: any) => s + (d?.xp ?? 0), 0);
  const selectedActiveDays = activityData.reduce((s: number, d: any) => s + ((d?.xp ?? 0) > 0 ? 1 : 0), 0);


  // 30d stats + heatmap (only shown when 7d is selected)
  const activity30Stats = stats?.activityStats30d;
  const activeDays30 = activity30Stats?.activeDays ?? 0;
  const activity30Chart = activityFallback30Dense.slice(-30);
  const activity30XpSumFromChart = activity30Chart.reduce((s: number, d: any) => s + (d?.xp ?? 0), 0);
  const activity30ActiveDaysFromChart = activity30Chart.reduce((s: number, d: any) => s + ((d?.xp ?? 0) > 0 ? 1 : 0), 0);
  const activity30MaxXp = activity30Chart.reduce((max: number, d: any) => Math.max(max, d?.xp ?? 0), 0);
  const heatClassForXp = (xp: number) => {
    if (xp <= 0) return "bg-slate-100";
    if (activity30MaxXp <= 0) return "bg-blue-200";
    const ratio = xp / activity30MaxXp;
    if (ratio < 0.34) return "bg-blue-200";
    if (ratio < 0.67) return "bg-blue-400";
    return "bg-blue-600";
  };

  // Accuracy
  const totalCorrect = stats?.accuracyStats?.totalCorrect || 0;
  const totalIncorrect = stats?.accuracyStats?.totalIncorrect || 0;
  const totalAttempts = stats?.accuracyStats?.totalAttempts || 0;
  const hasAccuracyData = totalAttempts > 0;
  const accuracyPercent = hasAccuracyData ? Math.round((totalCorrect / totalAttempts) * 100) : null;

  // Mastery efficiency
  const masteryEfficiency = stats?.masteryQuality?.masteredEfficiency;
  const masteryEfficiencyLabel =
    masteryEfficiency === null || masteryEfficiency === undefined ? "—" : `${Math.round(masteryEfficiency * 100)}%`;

  // Level (source of truth: 300 XP per level)
  const XP_PER_LEVEL = 300;
  const totalXP = Math.floor(stats?.totalXP || 0);
  const currentLevel = stats?.level || 1;
  const xpIntoLevel = ((totalXP % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  const levelProgress = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);

  const weeklyGoal = stats?.weeklyGoal ?? { windowDays: 7, activeDaysTarget: 3, xpTarget: 150 };
  const weeklyProgress = stats?.weeklyProgress ?? { windowDays: 7, activeDays: 0, xpSum: 0 };
  const weeklyXpRemaining = Math.max(0, (weeklyGoal.xpTarget ?? 0) - (weeklyProgress.xpSum ?? 0));
  const weeklyDaysRemaining = Math.max(0, (weeklyGoal.activeDaysTarget ?? 0) - (weeklyProgress.activeDays ?? 0));

  // Calculate days since start (display only)
  const startDate = stats?.creationTime ? new Date(stats.creationTime) : new Date();
  const daysSinceStart = Math.max(
    1,
    Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } },
  };

  // If user has legacy XP but no dailyActivity history, backfill once (best-effort).
  // Trigger only when Lifetime is selected, to avoid unnecessary work.
  useEffect(() => {
    if (didLegacyBackfillRef.current) return;
    if (activityRange !== "lifetime") return;
    if (totalXP <= 0) return;
    if (hasAnyActivity) return;
    if ((activity30Stats?.activeDays ?? 0) > 0) return;

    didLegacyBackfillRef.current = true;
    backfillDailyActivity({})
      .catch(() => {});
  }, [activityRange, totalXP, hasAnyActivity, activity30Stats?.activeDays, backfillDailyActivity]);

  // If Lifetime activity is present but does not sum up to totalXP, reconcile once (best-effort).
  useEffect(() => {
    if (didReconcileRef.current) return;
    if (activityRange !== "lifetime") return;
    if ((selectedActivity as any)?.loading) return;
    if (((selectedActivity as any)?.source ?? "") !== "dailyActivity.lifetime") return;
    if (totalXP <= 0) return;
    if (selectedXpSum === totalXP) return;

    didReconcileRef.current = true;
    backfillDailyActivity({})
      .catch(() => {});
  }, [activityRange, totalXP, selectedXpSum, selectedActivity, backfillDailyActivity]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Screen-reader title (visual context handled by TopNavigation active state) */}
      <h1 className="sr-only">{t("progress.title")}</h1>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
          {/* HERO SECTION: STORY + NEXT WIN */}
          <motion.div variants={itemVariants}>
            {/* Use the exact same Serbian Blue gradient as the Level card (`bg-serbian-blue`) */}
            <Card className="border-none shadow-lg overflow-hidden bg-serbian-blue text-white relative">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10">
                  <Trophy className="w-72 h-72" />
                </div>
                <div className="absolute -bottom-14 -left-14">
                  <Flame className="w-72 h-72" />
                </div>
              </div>
              <CardContent className="p-6 md:p-8 relative z-10">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-white/10 text-white border-white/20">
                        {t("progress.hero.levelBadge", { level: currentLevel })}
                      </Badge>
                      <Badge className="bg-white/10 text-white border-white/20">
                        {t("progress.hero.activeDaysBadge", { count: stats?.activeDaysCurrentStreak || 0 })}
                      </Badge>
                      <Badge className="bg-white/10 text-white border-white/20">
                        {t("progress.hero.badgesBadge", { count: userBadges?.length ?? 0 })}
                      </Badge>
                    </div>
                    <div className="text-3xl md:text-4xl font-bold leading-tight">
                      {t("progress.hero.headline", { xp: xpToNextLevel, nextLevel: currentLevel + 1 })}
                    </div>
                    <div className="text-sm md:text-base text-blue-100 max-w-2xl">
                      {t("progress.hero.weekSummary", {
                        xp: weeklyProgress.xpSum,
                        xpTarget: weeklyGoal.xpTarget,
                        days: weeklyProgress.activeDays,
                        daysTarget: weeklyGoal.activeDaysTarget,
                      })}
                      {weeklyXpRemaining === 0 && weeklyDaysRemaining === 0 ? (
                        <span className="ml-2 text-green-200 font-semibold">
                          {t("progress.hero.weeklyGoalAchieved")}
                        </span>
                      ) : (
                        <span className="ml-2">
                          {t("progress.hero.nextWin", { xp: weeklyXpRemaining, days: weeklyDaysRemaining })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between text-xs text-blue-100">
                        <span>{t("progress.hero.progressToNextLevel")}</span>
                        <span>{Math.round(levelProgress)}%</span>
                      </div>
                      <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${levelProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href={`/unit/${currentUnitNumber}`}>
                      <Button className="gap-2 bg-white text-slate-900 hover:bg-white/90">
                        {t("progress.cta.continueUnit", { unit: currentUnitNumber })}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href="/vocabulary">
                      <Button variant="outline" className="gap-2 border-white/30 text-white hover:bg-white/10">
                        {t("progress.cta.practiceVocabulary")}
                        <Star className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* MOMENTUM ROW */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Level Card */}
            <Card className="bg-serbian-blue text-white overflow-hidden relative border-none shadow-lg h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Trophy className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10 flex items-center justify-between h-full">
                <div>
                  <div className="text-blue-100 text-sm font-medium mb-1">{t("progress.cards.currentLevel.title")}</div>
                  <div className="text-4xl font-bold mb-2">Level {currentLevel}</div>
                  <div className="text-blue-100 text-sm mb-4">{t("progress.cards.currentLevel.totalXp", { xp: totalXP })}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-blue-100">
                      <span>{t("progress.cards.currentLevel.progressToLevel", { level: currentLevel + 1 })}</span>
                      <span>{Math.round(levelProgress)}%</span>
                    </div>
                    <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/90 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${levelProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-blue-100 pt-2">{t("progress.cards.currentLevel.xpToNext", { xp: xpToNextLevel })}</div>
                  </div>
                </div>
                <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20">
                  <Zap className="h-10 w-10 text-yellow-300 fill-yellow-300" />
                </div>
              </CardContent>
            </Card>

            {/* Active Days Card */}
            <Card className="bg-serbian-red text-white overflow-hidden relative border-none shadow-lg h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Flame className="w-32 h-32" />
              </div>
              <CardContent className="p-6 relative z-10 flex items-center justify-between h-full">
                <div>
                  <div className="text-orange-100 text-sm font-medium mb-1">{t("progress.cards.activeDays.title")}</div>
                  <div className="text-4xl font-bold mb-2">{stats?.activeDaysCurrentStreak || 0} Days</div>
                  <div className="text-orange-100 text-sm space-y-1">
                    <div>{t("progress.cards.activeDays.keepItUp")}</div>
                    <div className="text-xs">
                      {t("progress.cards.activeDays.longest", { count: stats?.activeDaysLongestStreak || 0 })}
                    </div>
                    <div className="text-xs">
                      {t("progress.cards.activeDays.last30d", { count: stats?.activeDays30d || 0 })}
                    </div>
                  </div>
                </div>
                <div className="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/20 animate-pulse">
                  <Flame className="h-10 w-10 text-white fill-white" />
                </div>
              </CardContent>
            </Card>

            {/* Weekly Goal Card */}
            <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <Target className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">{t("progress.cards.weeklyGoal.title")}</div>
                    <div className="text-2xl font-bold">
                      {t("progress.cards.weeklyGoal.subtitle", {
                        xp: weeklyProgress.xpSum,
                        xpTarget: weeklyGoal.xpTarget,
                      })}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("progress.cards.weeklyGoal.xpThisWeek")}</span>
                      <span className="font-medium">
                        {weeklyProgress.xpSum} / {weeklyGoal.xpTarget}
                      </span>
                    </div>
                    <ProgressBar value={weeklyGoal.xpTarget > 0 ? (weeklyProgress.xpSum / weeklyGoal.xpTarget) * 100 : 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("progress.cards.weeklyGoal.activeDays")}</span>
                      <span className="font-medium">
                        {weeklyProgress.activeDays} / {weeklyGoal.activeDaysTarget}
                      </span>
                    </div>
                    <ProgressBar
                      value={
                        weeklyGoal.activeDaysTarget > 0
                          ? (weeklyProgress.activeDays / weeklyGoal.activeDaysTarget) * 100
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                  <div className="pt-1 text-xs text-muted-foreground">
                    {weeklyXpRemaining === 0 && weeklyDaysRemaining === 0
                      ? t("progress.cards.weeklyGoal.momentumAchieved")
                      : t("progress.cards.weeklyGoal.nextWin", { xp: weeklyXpRemaining, days: weeklyDaysRemaining })}
                  </div>
                  <div className="pt-3 border-t flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">How is XP calculated?</span>
                    <GamificationModal trigger={
                      <Button variant="ghost" size="sm" className="gap-2 h-8">
                        <Info className="h-4 w-4" />
                        Learn More
                      </Button>
                    } />
                  </div>
                  <div className="pt-2 border-t text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("progress.cards.summary.courseMastery")}</span>
                      <span className="font-medium">{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">{t("progress.cards.summary.unitsCompleted")}</span>
                      <span className="font-medium">
                        {completedUnits.length} / {totalUnits}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">{t("progress.cards.summary.wordsMastered")}</span>
                      <span className="font-medium">{stats?.accuracyStats?.masteredVocab || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        {t("progress.cards.summary.masteryEfficiency")}
                      </span>
                      <span className="font-medium">{masteryEfficiencyLabel}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">{t("progress.cards.summary.started")}</span>
                      <span className="font-medium">{t("progress.cards.summary.startedAgo", { days: daysSinceStart })}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">{t("progress.cards.summary.activeDays30d")}</span>
                      <span className="font-medium">{stats?.activeDays30d ?? activeDays30}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Chart */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        {t("progress.activity.title")}
                      </CardTitle>
                      <CardDescription>
                        {activityRange === "7d"
                          ? t("progress.activity.subtitle.7d")
                          : activityRange === "30d"
                            ? t("progress.activity.subtitle.30d")
                            : t("progress.activity.subtitle.lifetime")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t("progress.activity.heatmap.toggle")}</span>
                        <Switch checked={showHeatmap} onCheckedChange={setShowHeatmap} />
                      </div>
                      <Tabs value={activityRange} onValueChange={(v) => setActivityRange(v as any)}>
                        <TabsList>
                          <TabsTrigger value="7d">{t("progress.activity.range.7d")}</TabsTrigger>
                          <TabsTrigger value="30d">{t("progress.activity.range.30d")}</TabsTrigger>
                          <TabsTrigger value="lifetime">{t("progress.activity.range.lifetime")}</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748b", fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                            cursor={false}
                            formatter={(value: any) => [t("progress.activity.tooltipXp", { xp: value }), "XP"]}
                            labelFormatter={(label: any, payload: any) => {
                              const fullDate = payload?.[0]?.payload?.fullDate;
                              return fullDate ? `${label} · ${fullDate}` : label;
                            }}
                          />
                          <Bar
                            dataKey="xp"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            barSize={activityData.length > 16 ? 18 : 40}
                            animationDuration={1200}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {(selectedActivity as any)?.loading && (
                      <div className="w-full rounded-lg border bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-slate-800">Loading activity…</div>
                            <div className="text-xs text-muted-foreground">Fetching your timeline.</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!hasAnyActivity && !(selectedActivity as any)?.loading && (
                      <div className="w-full flex items-center justify-between gap-4 rounded-lg border bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center border">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">
                              {activityRange === "7d"
                                ? t("progress.activity.empty.title.7d")
                                : activityRange === "30d"
                                  ? t("progress.activity.empty.title.30d")
                                  : t("progress.activity.empty.title.lifetime")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {activityRange === "7d"
                                ? t("progress.activity.empty.desc.7d")
                                : activityRange === "30d"
                                  ? t("progress.activity.empty.desc.30d")
                                  : t("progress.activity.empty.desc.lifetime")}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/unit/${currentUnitNumber}`}>
                            <Button size="sm" className="gap-2">
                              {t("progress.activity.cta.continue")}
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href="/vocabulary">
                            <Button size="sm" variant="outline">
                              {t("progress.activity.cta.practice")}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end text-xs text-muted-foreground">
                      {t("progress.activity.last30Days.meta", { xp: selectedXpSum })}
                    </div>

                    {showHeatmap && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">{t("progress.activity.heatmap.title")}</div>
                          <div className="text-xs text-muted-foreground">
                            {activityRange === "7d"
                              ? t("progress.activity.heatmap.subtitle.7d")
                              : activityRange === "30d"
                                ? t("progress.activity.heatmap.subtitle.30d")
                                : t("progress.activity.heatmap.subtitle.lifetime")}
                          </div>
                        </div>
                        {activityRange === "7d" ? (
                          <div className="grid grid-cols-7 gap-1">
                            {(activityData || []).slice(-7).map((d: any, idx: number) => (
                              <div
                                key={`${d.fullDate}-${idx}`}
                                title={`${d.fullDate} · ${d.xp ?? 0} XP`}
                                className={`h-3 w-full rounded ${heatClassForXp(d.xp ?? 0)}`}
                              />
                            ))}
                          </div>
                        ) : activityRange === "30d" ? (
                          <div className="grid grid-cols-10 gap-1">
                            {activity30Chart.map((d: any) => (
                              <div
                                key={d.date}
                                title={`${formatDateEU(d.date)} · ${d.xp ?? 0} XP`}
                                className={`h-3 w-full rounded ${heatClassForXp(d.xp ?? 0)}`}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto pb-1">
                            {(() => {
                              // 52-week heatmap based on last 364 days (most recent on the right)
                              const days = (isDailyActivityFallbackLoading ? [] : denseDays(364, activityFallbackRaw as any)) as any[];
                              return days.map((d: any, idx: number) => (
                                <div
                                  key={`${d.date}-${idx}`}
                                  title={`${formatDateEU(d.date)} · ${d.xp ?? 0} XP`}
                                  className={`h-3 w-3 rounded ${heatClassForXp(d.xp ?? 0)}`}
                                />
                              ));
                            })()}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{t("progress.activity.legend.less")}</span>
                          <span className="h-3 w-3 rounded bg-slate-100 border" />
                          <span className="h-3 w-3 rounded bg-blue-200" />
                          <span className="h-3 w-3 rounded bg-blue-400" />
                          <span className="h-3 w-3 rounded bg-blue-600" />
                          <span>{t("progress.activity.legend.more")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Accuracy */}
            <motion.div variants={itemVariants}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    {t("progress.accuracy.title")}
                  </CardTitle>
                  <CardDescription>{t("progress.accuracy.subtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {hasAccuracyData ? (
                    <div className="space-y-6">
                      <div className="relative h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart
                            cx="50%"
                            cy="52%"
                            innerRadius="70%"
                            outerRadius="95%"
                            barSize={14}
                            data={[{ name: "accuracy", value: accuracyPercent ?? 0 }]}
                            startAngle={220}
                            endAngle={-40}
                          >
                            <defs>
                              <linearGradient id="accuracyGradient" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#22c55e" />
                                <stop offset="100%" stopColor="#16a34a" />
                              </linearGradient>
                            </defs>
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar dataKey="value" cornerRadius={999} fill="url(#accuracyGradient)" />
                          </RadialBarChart>
                        </ResponsiveContainer>

                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <div className="text-4xl font-extrabold text-slate-900 tracking-tight">{accuracyPercent}%</div>
                          <div className="text-xs text-muted-foreground">{t("progress.accuracy.correctLabel")}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border bg-white p-3">
                          <div className="text-xs text-muted-foreground">{t("progress.correct")}</div>
                          <div className="text-xl font-bold text-slate-900">{totalCorrect}</div>
                        </div>
                        <div className="rounded-lg border bg-white p-3">
                          <div className="text-xs text-muted-foreground">{t("progress.incorrect")}</div>
                          <div className="text-xl font-bold text-slate-900">{totalIncorrect}</div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">{totalAttempts} total attempts</div>
                    </div>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm text-center px-8">
                      {t("progress.accuracy.empty")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* MODULES OVERVIEW */}
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {t("progress.unitsOverview")}
                </CardTitle>
                <CardDescription>{t("progress.unitsOverviewDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {modulesList.map((module) => {
                    const completed = module.units.filter((unitNum: number) => completedUnits.includes(unitNum)).length;
                    const total = module.units.length;
                    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                    const moduleTitle = i18n.language === "de" ? module.titleGerman : module.titleEnglish;

                    return (
                      <div key={`module-${module.number}-${module.id}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-sm bg-slate-50">
                              {t("units.module", { number: module.number })}
                            </Badge>
                            <span className="font-semibold text-slate-700">{moduleTitle}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {t("progress.lessonsCompleted", { completed, total })}
                          </span>
                        </div>
                        <ProgressBar value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements Section (Badges) */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800">
                  <Award className="h-5 w-5 text-amber-600" />
                  {t("progress.achievements")}
                </CardTitle>
                <CardDescription>{t("progress.achievements.desc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const unlocked = new Set((userBadges || []).map((b: any) => b.badgeId));
                  const badgeDefs: Array<{
                    id: string;
                    title: string;
                    description: string;
                    requirement: string;
                    progressText?: string;
                  }> = [
                    { id: "first_steps", title: t("progress.badge.first_steps.title"), description: t("progress.badge.first_steps.desc"), requirement: t("progress.badge.first_steps.req") },
                    { id: "unit_complete", title: t("progress.badge.unit_complete.title"), description: t("progress.badge.unit_complete.desc"), requirement: t("progress.badge.unit_complete.req"), progressText: `${Math.min(completedUnits.length, 1)}/1` },
                    { id: "five_units", title: t("progress.badge.five_units.title"), description: t("progress.badge.five_units.desc"), requirement: t("progress.badge.five_units.req"), progressText: `${Math.min(completedUnits.length, 5)}/5` },
                    { id: "ten_units", title: t("progress.badge.ten_units.title"), description: t("progress.badge.ten_units.desc"), requirement: t("progress.badge.ten_units.req"), progressText: `${Math.min(completedUnits.length, 10)}/10` },
                    { id: "streak_3", title: t("progress.badge.streak_3.title"), description: t("progress.badge.streak_3.desc"), requirement: t("progress.badge.streak_3.req"), progressText: `${Math.min(stats?.currentStreak || 0, 3)}/3` },
                    { id: "streak_7", title: t("progress.badge.streak_7.title"), description: t("progress.badge.streak_7.desc"), requirement: t("progress.badge.streak_7.req"), progressText: `${Math.min(stats?.currentStreak || 0, 7)}/7` },
                    { id: "streak_30", title: t("progress.badge.streak_30.title"), description: t("progress.badge.streak_30.desc"), requirement: t("progress.badge.streak_30.req"), progressText: `${Math.min(stats?.currentStreak || 0, 30)}/30` },
                    { id: "xp_100", title: t("progress.badge.xp_100.title"), description: t("progress.badge.xp_100.desc"), requirement: t("progress.badge.xp_100.req"), progressText: `${Math.min(totalXP, 100)}/100` },
                    { id: "xp_500", title: t("progress.badge.xp_500.title"), description: t("progress.badge.xp_500.desc"), requirement: t("progress.badge.xp_500.req"), progressText: `${Math.min(totalXP, 500)}/500` },
                    { id: "xp_1000", title: t("progress.badge.xp_1000.title"), description: t("progress.badge.xp_1000.desc"), requirement: t("progress.badge.xp_1000.req"), progressText: `${Math.min(totalXP, 1000)}/1000` },
                    { id: "xp_2000", title: t("progress.badge.xp_2000.title"), description: t("progress.badge.xp_2000.desc"), requirement: t("progress.badge.xp_2000.req"), progressText: `${Math.min(totalXP, 2000)}/2000` },
                    { id: "xp_5000", title: t("progress.badge.xp_5000.title"), description: t("progress.badge.xp_5000.desc"), requirement: t("progress.badge.xp_5000.req"), progressText: `${Math.min(totalXP, 5000)}/5000` },
                    { id: "xp_10000", title: t("progress.badge.xp_10000.title"), description: t("progress.badge.xp_10000.desc"), requirement: t("progress.badge.xp_10000.req"), progressText: `${Math.min(totalXP, 10000)}/10000` },
                    { id: "xp_20000", title: t("progress.badge.xp_20000.title"), description: t("progress.badge.xp_20000.desc"), requirement: t("progress.badge.xp_20000.req"), progressText: `${Math.min(totalXP, 20000)}/20000` },
                    { id: "xp_50000", title: t("progress.badge.xp_50000.title"), description: t("progress.badge.xp_50000.desc"), requirement: t("progress.badge.xp_50000.req"), progressText: `${Math.min(totalXP, 50000)}/50000` },
                    { id: "level_5", title: t("progress.badge.level_5.title"), description: t("progress.badge.level_5.desc"), requirement: t("progress.badge.level_5.req"), progressText: `${Math.min(currentLevel, 5)}/5` },
                    { id: "level_10", title: t("progress.badge.level_10.title"), description: t("progress.badge.level_10.desc"), requirement: t("progress.badge.level_10.req"), progressText: `${Math.min(currentLevel, 10)}/10` },
                    { id: "level_15", title: t("progress.badge.level_15.title"), description: t("progress.badge.level_15.desc"), requirement: t("progress.badge.level_15.req"), progressText: `${Math.min(currentLevel, 15)}/15` },
                    { id: "level_20", title: t("progress.badge.level_20.title"), description: t("progress.badge.level_20.desc"), requirement: t("progress.badge.level_20.req"), progressText: `${Math.min(currentLevel, 20)}/20` },
                    { id: "level_25", title: t("progress.badge.level_25.title"), description: t("progress.badge.level_25.desc"), requirement: t("progress.badge.level_25.req"), progressText: `${Math.min(currentLevel, 25)}/25` },
                  ];

                  return (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {badgeDefs.map((b) => {
                        const isUnlocked = unlocked.has(b.id);
                        const tone = getAchievementTone(b.id);
                        const Icon = getAchievementIcon(b.id);
                        return (
                          <div
                            key={b.id}
                            className={`rounded-xl border p-4 transition-all ${
                              isUnlocked
                                ? "bg-white border-amber-100 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                : "bg-slate-50 border-slate-100"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div className="relative">
                                  <div
                                    className={`h-12 w-12 rounded-2xl flex items-center justify-center border shadow-sm ring-1 ring-black/5 ${achievementToneEmblemClass(
                                      tone
                                    )} ${isUnlocked ? "" : "grayscale opacity-60"}`}
                                  >
                                    <Icon className="h-6 w-6 text-white" />
                                  </div>
                                  {!isUnlocked && (
                                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border shadow-sm flex items-center justify-center">
                                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                    <span className="truncate">{b.title}</span>
                                    {isUnlocked && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                        {t("progress.badges.unlocked")}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">{b.description}</div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{b.requirement}</span>
                                <span className="text-muted-foreground">{b.progressText ?? ""}</span>
                              </div>
                              {b.progressText && (
                                <ProgressBar
                                  value={(() => {
                                    const [curRaw, totalRaw] = b.progressText!.split("/");
                                    const cur = Number(curRaw);
                                    const tot = Number(totalRaw);
                                    if (!Number.isFinite(cur) || !Number.isFinite(tot) || tot <= 0) return 0;
                                    return Math.min(100, (cur / tot) * 100);
                                  })()}
                                  className="h-2"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
      </motion.div>
    </div>
  );
}

