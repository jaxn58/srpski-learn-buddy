import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BookOpen, Brain, Calendar, MessageSquare, TrendingUp, Download, Clock } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: progress, isLoading: progressLoading } = trpc.progress.get.useQuery();
  const { data: weeks } = trpc.course.getWeeks.useQuery();
  const { data: units } = trpc.course.getUnits.useQuery();
  const updateProgress = trpc.progress.update.useMutation();
  const utils = trpc.useUtils();
  const { t } = useTranslation();

  if (authLoading || progressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  const currentWeek = weeks?.find(w => w.weekNumber === progress?.currentWeek);
  const completedUnits = progress?.completedUnits || [];
  const totalUnits = units?.length || 27;
  const progressPercentage = (completedUnits.length / totalUnits) * 100;
  const learningDuration = progress?.learningDuration || 12;
  
  // Admin bypass: Show all units for admins
  const isAdmin = user.role === 'superadmin' || user.role === 'admin';
  const displayUnits = isAdmin ? units?.map(u => u.number) : currentWeek?.units;

  const handleDurationChange = async (duration: string) => {
    await updateProgress.mutateAsync({ learningDuration: parseInt(duration) });
    utils.progress.get.invalidate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">{t('app.title')}</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="outline" size="sm">
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={() => logout()}>
                {t('common.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Book Reference Alert */}
        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <BookOpen className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong>Companion to:</strong> "Step by Step Serbian 1" by Mirjana Danilović
              <span className="text-muted-foreground ml-2">• All content is original and independently created to complement the book</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/step-by-step-serbian.pdf" target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            </Button>
          </AlertDescription>
        </Alert>

        {/* Learning Plan Settings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('settings.learningPlan')}
            </CardTitle>
            <CardDescription>
              Adjust your learning pace to match your available time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Course Duration:</label>
              <Select value={learningDuration.toString()} onValueChange={handleDurationChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">3 Months (Intensive)</SelectItem>
                  <SelectItem value="24">6 Months (Standard)</SelectItem>
                  <SelectItem value="36">9 Months (Relaxed)</SelectItem>
                  <SelectItem value="48">12 Months (Leisurely)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                = {learningDuration} weeks
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            {t('dashboard.welcome', { name: user.name?.split(' ')[0] || 'Learner' })}
          </h2>
          <p className="text-muted-foreground">
            {t('dashboard.weekProgress', { current: progress?.currentWeek, total: learningDuration })}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.totalProgress')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedUnits.length}/{totalUnits}</div>
              <Progress value={progressPercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(progressPercentage)}% {t('dashboard.completed')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.currentWeek')}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Week {progress?.currentWeek}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {currentWeek?.title}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.currentLesson')}</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Unit {progress?.currentUnit}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {units?.find(u => u.number === progress?.currentUnit)?.title}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <BookOpen className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('dashboard.continueLesson')}</CardTitle>
              <CardDescription>
                {units?.find(u => u.number === progress?.currentUnit)?.titleEnglish}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/unit/${progress?.currentUnit}`}>
                <Button className="w-full">Go to Lesson</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('dashboard.chatWithProfessor')}</CardTitle>
              <CardDescription>
                {t('dashboard.chatDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/chat">
                <Button className="w-full" variant="outline">{t('dashboard.openChat')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Week {progress?.currentWeek}: {currentWeek?.title}</CardTitle>
            <CardDescription>
              {currentWeek?.goals.join(" • ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3 text-lg">
                  {isAdmin ? 'All Units (Admin View)' : t('dashboard.lessonsThisWeek')}
                </h4>
                <div className="grid gap-4">
                  {displayUnits?.map(unitNum => {
                    const unit = units?.find(u => u.number === unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;

                    return (
                      <Link key={unitNum} href={`/unit/${unitNum}`}>
                        <Card className={`transition-all hover:shadow-md ${
                          isCurrent ? 'border-primary ring-2 ring-primary/20' : 
                          isCompleted ? 'border-green-500 bg-green-50/50' : 
                          'hover:border-primary/50'
                        }`}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={isCurrent ? 'default' : isCompleted ? 'secondary' : 'outline'}>
                                    Unit {unitNum}
                                  </Badge>
                                  {isCompleted && (
                                    <span className="text-green-600 text-sm font-medium">✓ Completed</span>
                                  )}
                                  {isCurrent && !isCompleted && (
                                    <span className="text-primary text-sm font-medium">→ Current Lesson</span>
                                  )}
                                </div>
                                <div className="font-semibold text-lg mb-1">
                                  {unit?.title}
                                </div>
                                <div className="text-sm text-muted-foreground mb-3">
                                  {unit?.titleEnglish}
                                </div>
                                {unit?.topics && unit.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {unit.topics.slice(0, 3).map((topic, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {topic}
                                      </Badge>
                                    ))}
                                    {unit.topics.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{unit.topics.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <Button 
                                  variant={isCurrent ? 'default' : 'outline'} 
                                  size="sm"
                                  className="whitespace-nowrap"
                                >
                                  {isCompleted ? 'Review' : isCurrent ? 'Continue' : 'Start'}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">{t('dashboard.practiceActivities')}</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {currentWeek?.practiceActivities.map((activity, idx) => (
                    <li key={idx}>• {activity}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/vocabulary">
            <Button variant="outline">
              <Brain className="mr-2 h-4 w-4" />
              {t('dashboard.practiceVocab')}
            </Button>
          </Link>
          <Link href="/vocabulary-list">
            <Button variant="outline">
              <BookOpen className="mr-2 h-4 w-4" />
              View All Words
            </Button>
          </Link>
          <Link href="/progress">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              {t('dashboard.viewProgress')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
