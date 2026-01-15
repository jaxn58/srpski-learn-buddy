import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type Period = "all" | "30d" | "7d";

function formatPeriodLabel(period: Period) {
  if (period === "all") return "All-time";
  if (period === "30d") return "Last 30 days";
  return "Last 7 days";
}

export default function Leaderboards() {
  const { user, loading } = useAuth();
  const [period, setPeriod] = useState<Period>("7d");

  const publicLeaderboard = useQuery(api.leaderboard.getPublicLeaderboard, {
    period,
    limit: 10,
  });

  const privateLeaderboard = useQuery(
    api.leaderboard.getLeaderboard,
    user ? { period, limit: 100 } : "skip"
  );

  const periodLabel = useMemo(() => formatPeriodLabel(period), [period]);

  const isLoadingPublic = publicLeaderboard === undefined;
  const isLoadingPrivate = user ? privateLeaderboard === undefined : false;

  const publicEntries = (publicLeaderboard?.entries ?? []) as Array<{
    rank: number;
    xp: number;
    nickname: string;
    avatarUrl: string;
  }>;

  const privateEntries = (privateLeaderboard?.entries ?? []) as Array<{
    rank: number;
    xp: number;
    displayName: string;
    avatarUrl: string | null;
    isYou: boolean;
    isPublic: boolean;
  }>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Leaderboards</h1>
            <p className="text-sm text-muted-foreground">
              Rank is based on XP earned in the selected period.
            </p>
          </div>
        </div>

        <div className="min-w-[220px]">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger>
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All-time</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public Top 10</CardTitle>
          <CardDescription>
            Only users who enabled public display in their profile appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPublic ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : (publicLeaderboard?.entries?.length ?? 0) === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">
              No public entries yet for {periodLabel}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right w-[140px]">XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publicEntries.map((e) => (
                  <TableRow key={`${period}-public-${e.rank}-${e.nickname}`}>
                    <TableCell className="font-semibold">#{e.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={e.avatarUrl} alt={e.nickname} />
                          <AvatarFallback>{e.nickname.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{e.nickname}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{Math.floor(e.xp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {user && !loading && (
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {user.leaderboardPublicEnabled
                  ? "Your public display is enabled."
                  : "Want to appear publicly? Enable it in your profile."}
              </div>
              <Link href="/profile">
                <Button size="sm" variant="outline">
                  Go to Profile
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Full Leaderboard{" "}
            {user ? <Badge variant="secondary">Signed in</Badge> : <Badge variant="outline">Login required</Badge>}
          </CardTitle>
          <CardDescription>
            Shows the top ranks for {periodLabel}. Users without public display stay anonymous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="py-6 text-sm text-muted-foreground">
              Please sign in to view the full leaderboard.
            </div>
          ) : isLoadingPrivate ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : (privateLeaderboard?.entries?.length ?? 0) === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right w-[140px]">XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {privateEntries.map((e) => (
                  <TableRow key={`${period}-full-${e.rank}`} className={e.isYou ? "bg-primary/5" : undefined}>
                    <TableCell className="font-semibold">#{e.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={e.avatarUrl ?? undefined} alt={e.displayName} />
                          <AvatarFallback>{e.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{e.displayName}</span>
                          {e.isYou && <Badge variant="secondary">You</Badge>}
                          {!e.isYou && !e.isPublic && <Badge variant="outline">Private</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{Math.floor(e.xp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

