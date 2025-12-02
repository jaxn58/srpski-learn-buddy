import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame, Star, Award } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export function GamificationStats() {
  const { user } = useAuth();
  // Use user data which includes gamification stats
  const stats = user ? {
    level: user.level || 1,
    totalXP: user.totalXP || 0,
    currentStreak: user.currentStreak || 0,
    longestStreak: user.longestStreak || 0,
    xpToNextLevel: 300 - ((user.totalXP || 0) % 300),
  } : null;
  const isLoading = !user;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-20"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const xpProgress = ((stats.totalXP % 300) / 300) * 100;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Level */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Level</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.level}</div>
            <p className="text-xs text-muted-foreground">
              {stats.xpToNextLevel} XP to next level
            </p>
            <Progress value={xpProgress} className="mt-2" />
          </CardContent>
        </Card>

        {/* Total XP */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP</CardTitle>
            <Star className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalXP}</div>
            <p className="text-xs text-muted-foreground">
              Experience points earned
            </p>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.currentStreak} 🔥</div>
            <p className="text-xs text-muted-foreground">
              Days in a row (best: {stats.longestStreak})
            </p>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Badges</CardTitle>
            <Award className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.badges.length}</div>
            <p className="text-xs text-muted-foreground">
              Achievements unlocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Badges Display - Achievement Style */}
      {stats.badges.length > 0 && (
        <Card className="border-pink-200 bg-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-700">
              <Award className="h-5 w-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-pink-300 hover:shadow-sm transition-all"
                  title={badge.description}
                >
                  <div className="text-3xl flex-shrink-0 pt-0.5">
                    {badge.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {badge.name}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {badge.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

