import { useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Period = "all" | "30d" | "7d";

function formatPeriodLabel(period: Period) {
  if (period === "all") return "All-time";
  if (period === "30d") return "Last 30 days";
  return "Last 7 days";
}

export default function Leaderboards() {
  const { user, loading } = useAuth();
  const convex = useConvex();

  const stats = useQuery(api.progress.getDashboardStats, user ? undefined : "skip");
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
        { period: "7d" as const, label: "Leaderboard (7-day)", data: lb7d },
        { period: "30d" as const, label: "Leaderboard (30-day)", data: lb30d },
        { period: "all" as const, label: "Leaderboard (all-time)", data: lball },
      ] satisfies Array<{ period: Period; label: string; data: typeof lb7d }>,
    [lb7d, lb30d, lball]
  );

  const isLoadingTop =
    (user && stats === undefined) ||
    (user && myAvatar === undefined) ||
    levelDistribution === undefined;
  const XP_PER_LEVEL = 300;
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

  return (
    <div className="w-full space-y-8">
      <h1 className="sr-only">Leaderboards</h1>

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
                      <Avatar className="h-28 w-28 bg-white border">
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
                  <div className="text-xl font-semibold">{user?.publicNickname || user?.name || "You"}</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-[color:var(--brand-blue-strong-text)]">
                      Level {currentLevel}
                    </span>
                    <span className="mx-2 text-muted-foreground/60">·</span>
                    <span>{xpToNextLevel} XP to level {currentLevel + 1}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {xpToLastLevel === 0 ? (
                      <span>You reached Level {LAST_LEVEL}.</span>
                    ) : (
                      <span>
                        {xpToLastLevel} XP to reach Level {LAST_LEVEL}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 w-full max-w-sm space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress to Level {LAST_LEVEL}</span>
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
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: LAST_LEVEL }, (_, idx) => idx + 1).map((level) => {
                    const distRow = levelDistribution?.levels?.find((l) => l.level === level) ?? null;
                    const isLocked = level > currentLevel;
                    const isCurrent = level === currentLevel;
                    const requiredXp = (level - 1) * XP_PER_LEVEL;
                    return (
                      <div
                        key={level}
                        className={cn(
                          "flex items-center gap-3 rounded-xl p-3 border",
                          "bg-white",
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
                          <div className="text-sm font-semibold">Level {level}</div>
                          <div className="text-xs text-muted-foreground">
                            Requires {requiredXp} total XP
                            {distRow ? (
                              <span className="ml-2 text-muted-foreground/70">· {distRow.percent}% of members</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          }>;

          const xpLabel = (xp: number) =>
            b.period === "all" ? `${Math.floor(xp)}` : `+${Math.floor(xp)}`;

          return (
            <Card key={b.period} className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{b.label}</CardTitle>
                <CardDescription>
                  {b.period === "all"
                    ? "All-time total XP (public profiles only)."
                    : `XP earned in ${formatPeriodLabel(b.period).toLowerCase()} (public profiles only).`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                    <div className="h-10 rounded-lg bg-muted/30 animate-pulse" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="py-6 text-sm text-muted-foreground">No public entries yet.</div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((e) => (
                      <div
                        key={`${b.period}-${e.rank}-${e.nickname}`}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl p-2.5",
                          e.rank === 1 ? "bg-[color:var(--accent)]/10" : "hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                              e.rank <= 3
                                ? "bg-[color:var(--accent)] text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {e.rank}
                          </div>
                          <Avatar className="h-8 w-8 border flex-shrink-0">
                            <AvatarImage src={e.avatarUrl} alt={e.nickname} />
                            <AvatarFallback>{e.nickname.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate">{e.nickname}</span>
                              {(() => {
                                const entryLevel =
                                  typeof (e as any).level === "number" && Number.isFinite((e as any).level)
                                    ? (e as any).level
                                    : null;
                                const isYou =
                                  Boolean(user?.leaderboardPublicEnabled) &&
                                  Boolean(user?.publicNickname) &&
                                  e.nickname === user?.publicNickname;
                                const shownLevel = entryLevel ?? (isYou ? currentLevel : null);

                                if (shownLevel === null) return null;
                                return (
                                  <Badge
                                    variant="secondary"
                                    className="h-5 px-2 text-[10px] border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)] text-[color:var(--brand-blue-strong-text)]"
                                  >
                                    Lvl {shownLevel}
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
            {user.leaderboardPublicEnabled
              ? "Your public leaderboard display is enabled."
              : "Want to appear on the public leaderboards? Enable public display in your profile (nickname + avatar required)."}{" "}
          </div>
          <Link href="/profile">
            <Button size="sm" variant="outline">
              Go to Profile
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

