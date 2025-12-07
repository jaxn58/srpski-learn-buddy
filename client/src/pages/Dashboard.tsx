import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { COURSE_WEEKS, COURSE_UNITS } from "@shared/data";
import { BookOpen, Brain, Calendar, MessageSquare, TrendingUp, Clock, Home, Lock } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Sidebar } from "@/components/Sidebar";

import { useState, useEffect } from "react";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const progress = useQuery(api.progress.getUserProgress);
  const progressLoading = progress === undefined;
  
  // Debug: Log user object to check isBetaTester
  useEffect(() => {
    if (user) {
      console.log('[Dashboard] User object:', user);
      console.log('[Dashboard] isBetaTester:', user.isBetaTester);
    }
  }, [user]);
  
  // Use static course data
  const weeks = COURSE_WEEKS;
  const units = COURSE_UNITS;
  const updateProgressMutation = useMutation(api.progress.updateProgress);
  const { t, i18n } = useTranslation();
  
  // Onboarding tutorial state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
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
  
  // Show onboarding for new users (created within last 24 hours)
  useEffect(() => {
    if (user && user.createdAt) {
      const createdDate = new Date(user.createdAt);
      const daysSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const hasSeenOnboarding = localStorage.getItem(`onboarding_seen_${user.id}`);
      
      if (daysSinceCreation < 1 && !hasSeenOnboarding) {
        setShowOnboarding(true);
      }
    }
  }, [user]);
  
  const handleCloseOnboarding = () => {
    if (user) {
      localStorage.setItem(`onboarding_seen_${user.id}`, 'true');
    }
    setShowOnboarding(false);
  };

  // Show loading while auth or progress is loading
  // Also show loading while user is being synced to Convex
  if (authLoading || progressLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show pending approval overlay for inactive users
  if (!user.isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-2 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <CardTitle className="text-2xl">{t('dashboard.pendingApproval.title')}</CardTitle>
            </div>
            <CardDescription className="text-base">
              {t('dashboard.pendingApproval.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <h3 className="font-semibold mb-2">{t('dashboard.pendingApproval.whatNext')}</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>{t('dashboard.pendingApproval.review')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: t('dashboard.pendingApproval.email', { email: user.email }) }} />
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>{t('dashboard.pendingApproval.access')}</span>
                </li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.href = '/'} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                {t('dashboard.pendingApproval.backHome')}
              </Button>
              <Button onClick={logout} variant="ghost" className="flex-1">
                {t('dashboard.pendingApproval.logout')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
    await updateProgressMutation({ learningDuration: parseInt(duration) });
    // Convex automatically updates the UI reactively
  };

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding 
          userName={user.name || user.email || 'there'} 
          onClose={handleCloseOnboarding}
        />
      )}
      
      <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="container py-8">


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
              <div className="text-2xl font-bold">{t('dashboard.week', { number: progress?.currentWeek })}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {i18n.language === 'de' && currentWeek?.titleGerman ? currentWeek.titleGerman : currentWeek?.title}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.currentLesson')}</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{t('dashboard.unit', { number: progress?.currentUnit })}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {(() => {
                  const unit = units?.find(u => u.number === progress?.currentUnit);
                  return i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish;
                })()}
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
                {(() => {
                  const unit = units?.find(u => u.number === progress?.currentUnit);
                  return i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/unit/${progress?.currentUnit}`}>
                <Button className="w-full">{t('dashboard.goToLesson')}</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
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
            <CardTitle>{t('dashboard.week', { number: progress?.currentWeek })}: {i18n.language === 'de' && currentWeek?.titleGerman ? currentWeek.titleGerman : currentWeek?.title}</CardTitle>
            <CardDescription>
              {(i18n.language === 'de' && currentWeek?.goalsGerman ? currentWeek.goalsGerman : currentWeek?.goals)?.join(" • ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-3 text-lg">
                  {isAdmin ? t('dashboard.adminView') : t('dashboard.lessonsThisWeek')}
                </h4>
                <div className="grid gap-4">
                  {displayUnits?.map(unitNum => {
                    const unit = units?.find(u => u.number === unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;
                    const isLocked = user.isBetaTester && unitNum > 5;

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
                                    {t('dashboard.unit', { number: unitNum })}
                                  </Badge>
                                  {isCompleted && (
                                    <span className="text-green-600 text-sm font-medium">{t('dashboard.completedBadge')}</span>
                                  )}
                                  {isCurrent && !isCompleted && (
                                    <span className="text-primary text-sm font-medium">{t('dashboard.currentLessonBadge')}</span>
                                  )}
                                </div>
                                <div className="font-semibold text-lg mb-1">
                                  {i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish}
                                </div>
                                <div className="text-sm text-muted-foreground mb-3">
                                  {unit?.title}
                                </div>
                                {unit?.topics && unit.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
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
                              <div className="text-right">
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
              </div>

              <div>
                <h4 className="font-semibold mb-2">{t('dashboard.practiceActivities')}</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {(i18n.language === 'de' && currentWeek?.practiceActivitiesGerman ? currentWeek.practiceActivitiesGerman : currentWeek?.practiceActivities)?.map((activity, idx) => (
                    <li key={idx}>• {activity}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
    </>
  );
}
