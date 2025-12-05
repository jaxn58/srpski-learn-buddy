import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, CheckCircle2, Clock, TrendingUp, Calendar, Award } from "lucide-react";
import { Link } from "wouter";
import { COURSE_WEEKS } from "@shared/data";
import { Sidebar } from "@/components/Sidebar";

export default function Progress() {
  const { user } = useAuth();
  const progress = useQuery(api.progress.getUserProgress);
  const isLoading = progress === undefined;

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const completedUnits = progress?.completedUnits || [];
  const totalUnits = 27;
  const progressPercent = (completedUnits.length / totalUnits) * 100;
  const currentWeek = progress?.currentWeek || 1;
  const learningDuration = progress?.learningDuration || 12;
  const totalWeeks = learningDuration;
  const weekProgress = (currentWeek / totalWeeks) * 100;

  // Calculate estimated completion date
  const startDate = progress?.startedAt ? new Date(progress.startedAt) : new Date();
  const estimatedEndDate = new Date(startDate);
  estimatedEndDate.setDate(estimatedEndDate.getDate() + (learningDuration * 7));

  // Calculate days since start
  const daysSinceStart = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate average units per week
  const weeksElapsed = Math.max(1, Math.floor(daysSinceStart / 7));
  const avgUnitsPerWeek = (completedUnits.length / weeksElapsed).toFixed(1);

  // Get current week info
  const currentWeekInfo = COURSE_WEEKS.find(w => w.weekNumber === currentWeek);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← Back to Dashboard</Button>
            </Link>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Learning Progress</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Overview Stats */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Progress</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedUnits.length}/{totalUnits}</div>
                <p className="text-xs text-muted-foreground">Units completed</p>
                <ProgressBar value={progressPercent} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Week</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentWeek}/{totalWeeks}</div>
                <p className="text-xs text-muted-foreground">Week progress</p>
                <ProgressBar value={weekProgress} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Pace</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgUnitsPerWeek}</div>
                <p className="text-xs text-muted-foreground">Units per week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Days Active</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{daysSinceStart}</div>
                <p className="text-xs text-muted-foreground">Since you started</p>
              </CardContent>
            </Card>
          </div>

          {/* Current Week Details */}
          {currentWeekInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Week {currentWeek}: {currentWeekInfo.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Learning Objectives:</h4>
                    <ul className="space-y-1">
                      {currentWeekInfo.goals?.map((obj: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{obj}</span>
                        </li>
                      )) || <li className="text-sm text-muted-foreground">No objectives available</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Timeline</CardTitle>
              <CardDescription>Your journey through the course</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <div>
                    <div className="font-medium">Started</div>
                    <div className="text-muted-foreground">
                      {startDate.toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">Estimated Completion</div>
                    <div className="text-muted-foreground">
                      {estimatedEndDate.toLocaleDateString('de-DE')}
                    </div>
                  </div>
                </div>
                <ProgressBar value={weekProgress} className="h-3" />
                <div className="text-center text-sm text-muted-foreground">
                  {totalWeeks - currentWeek} weeks remaining
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Units Progress Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Units Overview</CardTitle>
              <CardDescription>Track your progress through all 27 units</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-9 gap-2">
                {Array.from({ length: totalUnits }, (_, i) => i + 1).map((unitNum) => {
                  const isCompleted = completedUnits.includes(unitNum);
                  const isCurrent = progress?.currentUnit === unitNum;
                  
                  return (
                    <div
                      key={unitNum}
                      className={`
                        aspect-square rounded-lg border-2 flex items-center justify-center font-semibold
                        ${isCompleted 
                          ? 'bg-green-50 border-green-500 text-green-700' 
                          : isCurrent
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <span className="text-sm">{unitNum}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-500"></div>
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-500"></div>
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200"></div>
                  <span>Not Started</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          {completedUnits.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {completedUnits.length >= 1 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🎯</div>
                      <div>
                        <div className="font-semibold">First Steps</div>
                        <div className="text-xs text-muted-foreground">Completed first unit</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 5 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🚀</div>
                      <div>
                        <div className="font-semibold">Getting Started</div>
                        <div className="text-xs text-muted-foreground">Completed 5 units</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 10 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">⭐</div>
                      <div>
                        <div className="font-semibold">Halfway There</div>
                        <div className="text-xs text-muted-foreground">Completed 10 units</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 20 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🏆</div>
                      <div>
                        <div className="font-semibold">Almost There</div>
                        <div className="text-xs text-muted-foreground">Completed 20 units</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length === 27 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🎓</div>
                      <div>
                        <div className="font-semibold">Course Master</div>
                        <div className="text-xs text-muted-foreground">Completed all units!</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Study Tips */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Keep Going!</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>📚 Consistency is key - try to study a little every day</li>
                <li>🎯 Set weekly goals to stay on track</li>
                <li>💬 Practice with the AI Learn Buddy regularly</li>
                <li>🔁 Review completed units to reinforce learning</li>
                <li>✍️ Complete all exercises in the coursebook</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </div>
  );
}
