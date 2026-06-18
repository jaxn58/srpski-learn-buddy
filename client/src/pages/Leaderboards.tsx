import { useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { XP_PER_LEVEL } from "../../../convex/gamification";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Lock, Trophy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Period = "all" | "30d" | "7d";

function RankBadge({ rank }: { rank: number }) {
  const base =
    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border";

  if (rank === 1) {
    return (
      <div
        className={cn(base, "bg-[color:var(--accent)] text-white border-white/35")}
        aria-label={`Rank ${rank}`}
      >
        <Trophy className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{`Rank ${rank}`}</span>
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div
        className={cn(
          base,
          "bg-slate-300 text-slate-900 border-slate-200 dark:bg-slate-500 dark:text-white dark:border-slate-400/40"
        )}
        aria-label={`Rank ${rank}`}
      >
        <Trophy className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{`Rank ${rank}`}</span>
      </div>
    );
  }

  if (rank === 3) {
    return (
      <div
        className={cn(
          base,
          "bg-amber-700 text-white border-amber-600/50 dark:bg-amber-600 dark:border-amber-500/40"
        )}
        aria-label={`Rank ${rank}`}
      >
        <Trophy className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{`Rank ${rank}`}</span>
      </div>
    );
  }

  return (
    <div className={cn(base, "bg-serbian-blue text-white border-white/55 dark:border-white/20")}>
      {rank}
    </div>
  );
}

export default function Leaderboards() {
  const { user, loading } = useAuth();
  const convex = useConvex();
  const { t } = useTranslation();

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const stats = useQuery(api.progress.getDashboardStats, user ? { todayStart } : "skip");
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const [levelDistribution, setLevelDistribution] = useState<
    | {
        maxLevel: number;
        totalMembers: number;
        levels: Array<{ level: number; count: number; percent: number }>;
        updatedAt: number;
      }
    | null
    | undefined
  >(undefined);
  const [roadmapExpanded, setRoadmapExpanded] = useState(false);

  // Load level distribution in an effect so missing backend functions don't crash the page
  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.leaderboard.getLevelDistribution, { maxLevel: 25 })
      .then((res) => {
        if (!cancelled) setLevelDistribution(res as any);
      })
      .catch(() => {
        if (!cancelled) setLevelDistribution(null);
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  const lb7d = useQuery(api.leaderboard.getPublicLeaderboard, { period: "7d", limit: 10 });
  const lb30d = useQuery(api.leaderboard.getPublicLeaderboard, { period: "30d", limit: 10 });
  const lball = useQuery(api.leaderboard.getPublicLeaderboard, { period: "all", limit: 10 });

  const boards = useMemo(
    () =>
      [
        { period: "7d" as const, label: t("leaderboards.boardLabel.7d"), data: lb7d },
        { period: "30d" as const, label: t("leaderboards.boardLabel.30d"), data: lb30d },
        { period: "all" as const, label: t("leaderboards.boardLabel.all"), data: lball },
      ] satisfies Array<{ period: Period; label: string; data: typeof lb7d }>,
    [lb7d, lb30d, lball, t]
  );

  const isLoadingTop =
    (user && stats === undefined) ||
    (user && myAvatar === undefined) ||
    levelDistribution === undefined;
  const LAST_LEVEL = 25;
  const LAST_LEVEL_TOTAL_XP = (LAST_LEVEL - 1) * XP_PER_LEVEL; // 7200
  const totalXP = Math.floor(stats?.totalXP || 0);
  const currentLevel = stats?.level || 1;
  const xpIntoLevel = ((totalXP % XP_PER_LEVEL) + XP_PER_LEVEL) % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpIntoLevel;
  const progressToNextRatio = XP_PER_LEVEL > 0 ? Math.min(1, Math.max(0, xpIntoLevel / XP_PER_LEVEL)) : 0;
  const progressToLastRatio =
    LAST_LEVEL_TOTAL_XP > 0 ? Math.min(1, Math.max(0, totalXP / LAST_LEVEL_TOTAL_XP)) : 0;
  const xpToLastLevel = Math.max(0, LAST_LEVEL_TOTAL_XP - totalXP);
  const levelRange = useMemo(() => {
    const windowSize = 6;
    let start = Math.max(1, currentLevel - 1);
    let end = Math.min(LAST_LEVEL, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return { start, end };
  }, [currentLevel]);
  const allLevels = useMemo(
    () => Array.from({ length: LAST_LEVEL }, (_, idx) => idx + 1),
    [LAST_LEVEL]
  );

  return (
    <div className="w-full space-y-8">
      <h1 className="sr-only">{t("sidebar.leaderboards")}</h1>

      {/* Top: Level progress + distribution (Scroll-inspired) */}
      <Card className="shadow-sm">
        <CardContent className="p-6 md:p-8">
          {isLoadingTop ? (
            <div className="h-28 rounded-xl bg-muted/30 animate-pulse" />
          ) : (
            <div className="flex flex-col lg:flex-row gap-8 lg:items-center">
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                <div className="relative">
                  {/* Circular progress ring (to next level) */}
                  <div className="relative h-32 w-32">
                    <svg
                      className="absolute inset-0"
                      viewBox="0 0 128 128"
                      aria-hidden="true"
                    >
                      {(() => {
                        const r = 56;
                        const c = 2 * Math.PI * r;
                        const dashOffset = c * (1 - progressToNextRatio);
                        return (
                          <g transform="translate(64,64) rotate(-90)">
                            <circle
                              r={r}
                              cx={0}
                              cy={0}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={8}
                              className="text-muted/35"
                            />
                            <circle
                              r={r}
                              cx={0}
                              cy={0}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={8}
                              strokeLinecap="round"
                              strokeDasharray={`${c} ${c}`}
                              strokeDashoffset={dashOffset}
                              className="text-[color:var(--brand-blue)] transition-[stroke-dashoffset] duration-700 ease-out"
                            />
                          </g>
                        );
                      })()}
                    </svg>

                    <div className="absolute inset-2 flex items-center justify-center">
                      <Avatar className="h-28 w-28 bg-card border">
                    <AvatarImage
                      src={myAvatar?.url ?? user?.publicAvatarUrl ?? undefined}
                      alt={user?.publicNickname || user?.name || "User"}
                    />
                    <AvatarFallback className="text-lg font-semibold">
                      {(user?.publicNickname || user?.name || user?.email || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full bg-[color:var(--brand-blue)] text-white flex items-center justify-center font-bold border-4 border-white">
                    {currentLevel}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xl font-semibold">{user?.publicNickname || user?.name || t("leaderboards.you")}</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-[color:var(--brand-blue-strong-text)]">
                      {t("progress.hero.levelBadge", { level: currentLevel })}
                    </span>
                    <span className="mx-2 text-muted-foreground/60">·</span>
                    <span>{t("leaderboards.xpToNextLevel", { xp: xpToNextLevel, level: currentLevel + 1 })}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {xpToLastLevel === 0 ? (
                      <span>{t("leaderboards.reachedLastLevel", { level: LAST_LEVEL })}</span>
                    ) : (
                      <span>
                        {t("leaderboards.xpToReachLevel", { xp: xpToLastLevel, level: LAST_LEVEL })}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 w-full max-w-sm space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("leaderboards.progressToLevel", { level: LAST_LEVEL })}</span>
                      <span className="tabular-nums">{Math.round(progressToLastRatio * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/35 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[color:var(--brand-blue)] transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.round(progressToLastRatio * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <Collapsible open={roadmapExpanded} onOpenChange={setRoadmapExpanded}>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-semibold">{t("leaderboards.roadmap.title")}</div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                        {roadmapExpanded ? t("leaderboards.roadmap.showLess") : t("leaderboards.roadmap.showAllLevels")}
                        <ChevronDown
                          className={cn(
                            "ml-1.5 h-4 w-4 transition-transform",
                            roadmapExpanded && "rotate-180"
                          )}
                        />
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  {!roadmapExpanded && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {allLevels
                        .filter((level) => level >= levelRange.start && level <= levelRange.end)
                        .map((level) => {
                          const distRow = levelDistribution?.levels?.find((l) => l.level === level) ?? null;
                          const isLocked = level > currentLevel;
                          const isCurrent = level === currentLevel;
                          const requiredXp = (level - 1) * XP_PER_LEVEL;
                          return (
                            <div
                              key={level}
                              className={cn(
                                "flex items-center gap-3 rounded-xl p-3 border",
                                "bg-card",
                                isCurrent && "border-[color:var(--accent)] shadow-sm"
                              )}
                            >
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                                  isLocked ? "bg-muted text-muted-foreground" : "bg-[color:var(--accent)] text-white"
                                )}
                              >
                                {isLocked ? (
                                  <Lock className="h-4 w-4" />
                                ) : (
                                  <span className="font-bold">{level}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">{t("progress.hero.levelBadge", { level })}</div>
                                <div className="text-xs text-muted-foreground">
                                  {t("leaderboards.roadmap.requiresXp", { xp: requiredXp })}
                                  {distRow ? (
                                    <span className="ml-2 text-muted-foreground/70">
                                      · {t("leaderboards.roadmap.membersPercent", { percent: distRow.percent })}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <CollapsibleContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {allLevels.map((level) => {
                        const distRow = levelDistribution?.levels?.find((l) => l.level === level) ?? null;
                        const isLocked = level > currentLevel;
                        const isCurrent = level === currentLevel;
                        const requiredXp = (level - 1) * XP_PER_LEVEL;
                        return (
                          <div
                            key={level}
                            className={cn(
                              "flex items-center gap-3 rounded-xl p-3 border",
                              "bg-card",
                              isCurrent && "border-[color:var(--accent)] shadow-sm"
                            )}
                          >
                            <div
                              className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                                isLocked ? "bg-muted text-muted-foreground" : "bg-[color:var(--accent)] text-white"
                              )}
                            >
                              {isLocked ? <Lock className="h-4 w-4" /> : <span className="font-bold">{level}</span>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{t("progress.hero.levelBadge", { level })}</div>
                              <div className="text-xs text-muted-foreground">
                                {t("leaderboards.roadmap.requiresXp", { xp: requiredXp })}
                                {distRow ? (
                                  <span className="ml-2 text-muted-foreground/70">
                                    · {t("leaderboards.roadmap.membersPercent", { percent: distRow.percent })}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {boards.map((b) => {
          const isLoading = b.data === undefined;
          const entries = (b.data?.entries ?? []) as Array<{
            rank: number;
            xp: number;
            nickname: string;
            avatarUrl: string;
            level?: number;
            isYou?: boolean;
          }>;
          const self = b.data?.self ?? null;

          const xpLabel = (xp: number) =>
            b.period === "all" ? `${Math.floor(xp)}` : `+${Math.floor(xp)}`;

          return (
            <Card key={b.period} className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{b.label}</CardTitle>
                <CardDescription>
                  {b.period === "all"
                    ? t("leaderboards.boardSubtitle.all")
                    : b.period === "30d"
                      ? t("leaderboards.boardSubtitle.30d")
                      : t("leaderboards.boardSubtitle.7d")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                  </div>
                ) : entries.length === 0 && !self ? (
                  <div className="py-6 text-sm text-muted-foreground">{t("leaderboards.empty")}</div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((e) => (
                      <div
                        key={`${b.period}-${e.rank}-${e.nickname}`}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl p-2.5",
                          e.isYou
                            ? "bg-[color:var(--brand-blue-soft)] border border-[color:var(--brand-blue-soft-border)]"
                            : e.rank === 1
                              ? "bg-[color:var(--accent)]/10"
                              : "hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RankBadge rank={e.rank} />
                          <Avatar className="h-8 w-8 border flex-shrink-0">
                            <AvatarImage src={e.avatarUrl} alt={e.nickname} />
                            <AvatarFallback>{e.nickname.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{e.nickname}</span>
                              {e.isYou ? (
                                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                  {t("leaderboards.you")}
                                </Badge>
                              ) : null}
                              {(() => {
                                const entryLevel =
                                  typeof e.level === "number" && Number.isFinite(e.level)
                                    ? e.level
                                    : null;
                                if (entryLevel === null) return null;
                                return (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 px-2 text-[10px] border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)] text-[color:var(--brand-blue-strong-text)]"
                                  >
                                    {t("progress.hero.levelBadge", { level: entryLevel })}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-[color:var(--brand-blue-strong-text)]">
                          {xpLabel(e.xp)}
                        </div>
                      </div>
                    ))}
                    {self && user && !self.isInTopTen ? (
                      <div
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl p-2.5 mt-3 border",
                          "bg-[color:var(--brand-blue-soft)] border-[color:var(--brand-blue-soft-border)]"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RankBadge rank={self.rank} />
                          <Avatar className="h-8 w-8 border flex-shrink-0">
                            <AvatarImage
                              src={self.avatarUrl ?? undefined}
                              alt={self.nickname}
                            />
                            <AvatarFallback>{self.nickname.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{self.nickname}</span>
                              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                                {t("leaderboards.you")}
                              </Badge>
                              {typeof self.level === "number" && Number.isFinite(self.level) ? (
                                <Badge
                                  variant="secondary"
                                  className="h-5 px-2 text-[10px] border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)] text-[color:var(--brand-blue-strong-text)]"
                                >
                                  {t("progress.hero.levelBadge", { level: self.level })}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("leaderboards.yourRankLabel")}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums text-[color:var(--brand-blue-strong-text)]">
                          {xpLabel(self.xp)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {user && !loading && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            {user.leaderboardPublicEnabled === true
              ? t("leaderboards.publicDisplay.enabled")
              : t("leaderboards.publicDisplay.disabled")}{" "}
          </div>
          <Link href="/profile">
            <Button size="sm" variant="outline">
              {t("leaderboards.goToProfile")}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

