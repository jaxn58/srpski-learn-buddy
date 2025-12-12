import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, CheckCircle2, Clock, TrendingUp, Calendar, Award } from "lucide-react";
import { Link } from "wouter";
import { COURSE_WEEKS, COURSE_MODULES, getModuleProgress } from "@shared/data";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "react-i18next";

export default function Progress() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
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
  const startDate = progress ? new Date(progress._creationTime) : new Date();
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
      <div className="flex-1 md:ml-64 w-full">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">{t('progress.backToDashboard')}</Button>
            </Link>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">{t('progress.title')}</h1>
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
                <CardTitle className="text-sm font-medium">{t('progress.totalProgress')}</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedUnits.length}/{totalUnits}</div>
                <p className="text-xs text-muted-foreground">{t('progress.unitsCompleted')}</p>
                <ProgressBar value={progressPercent} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('progress.currentWeek')}</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentWeek}/{totalWeeks}</div>
                <p className="text-xs text-muted-foreground">{t('progress.weekProgress')}</p>
                <ProgressBar value={weekProgress} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('progress.learningPace')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgUnitsPerWeek}</div>
                <p className="text-xs text-muted-foreground">{t('progress.unitsPerWeek')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('progress.daysActive')}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{daysSinceStart}</div>
                <p className="text-xs text-muted-foreground">{t('progress.sinceStarted')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Current Week Details */}
          {currentWeekInfo && (
            <Card>
              <CardHeader>
                <CardTitle>{t('progress.week', { number: currentWeek })}: {i18n.language === 'de' && currentWeekInfo.titleGerman ? currentWeekInfo.titleGerman : currentWeekInfo.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">{t('progress.learningObjectives')}</h4>
                    <ul className="space-y-1">
                      {(i18n.language === 'de' && currentWeekInfo.goalsGerman ? currentWeekInfo.goalsGerman : currentWeekInfo.goals)?.map((obj: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{obj}</span>
                        </li>
                      )) || <li className="text-sm text-muted-foreground">{t('progress.noObjectives')}</li>}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>{t('progress.timeline')}</CardTitle>
              <CardDescription>{t('progress.timelineDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <div>
                    <div className="font-medium">{t('progress.started')}</div>
                    <div className="text-muted-foreground">
                      {startDate.toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{t('progress.estimatedCompletion')}</div>
                    <div className="text-muted-foreground">
                      {estimatedEndDate.toLocaleDateString('de-DE')}
                    </div>
                  </div>
                </div>
                <ProgressBar value={weekProgress} className="h-3" />
                <div className="text-center text-sm text-muted-foreground">
                  {t('progress.weeksRemaining', { count: totalWeeks - currentWeek })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modules Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle>{t('progress.unitsOverview')}</CardTitle>
              <CardDescription>{t('progress.unitsOverviewDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {COURSE_MODULES.map((module) => {
                  const moduleProgress = getModuleProgress(module.id, completedUnits);
                  const moduleTitle = i18n.language === 'de' ? module.titleGerman : module.titleEnglish;
                  
                  return (
                    <div key={module.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-sm">
                            {t('units.module', { number: module.number })}
                          </Badge>
                          <span className="font-semibold">{moduleTitle}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {t('progress.lessonsCompleted', { 
                            completed: moduleProgress.completed, 
                            total: moduleProgress.total 
                          })}
                        </span>
                      </div>
                      <ProgressBar value={moduleProgress.percentage} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          {completedUnits.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  {t('progress.achievements')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {completedUnits.length >= 1 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🎯</div>
                      <div>
                        <div className="font-semibold">{t('progress.achievement.firstSteps')}</div>
                        <div className="text-xs text-muted-foreground">{t('progress.achievement.firstSteps.desc')}</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 5 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🚀</div>
                      <div>
                        <div className="font-semibold">{t('progress.achievement.gettingStarted')}</div>
                        <div className="text-xs text-muted-foreground">{t('progress.achievement.gettingStarted.desc')}</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 10 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">⭐</div>
                      <div>
                        <div className="font-semibold">{t('progress.achievement.halfwayThere')}</div>
                        <div className="text-xs text-muted-foreground">{t('progress.achievement.halfwayThere.desc')}</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length >= 20 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🏆</div>
                      <div>
                        <div className="font-semibold">{t('progress.achievement.almostThere')}</div>
                        <div className="text-xs text-muted-foreground">{t('progress.achievement.almostThere.desc')}</div>
                      </div>
                    </div>
                  )}
                  {completedUnits.length === 27 && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="text-3xl">🎓</div>
                      <div>
                        <div className="font-semibold">{t('progress.achievement.courseMaster')}</div>
                        <div className="text-xs text-muted-foreground">{t('progress.achievement.courseMaster.desc')}</div>
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
              <CardTitle className="text-primary">{t('progress.keepGoing')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>{t('progress.tip1')}</li>
                <li>{t('progress.tip2')}</li>
                <li>{t('progress.tip3')}</li>
                <li>{t('progress.tip4')}</li>
                <li>{t('progress.tip5')}</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="container py-8 border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold">© Developed by JACKSENN.ME 2025</p>
          </div>
        </footer>
      </main>
      </div>
    </div>
  );
}
