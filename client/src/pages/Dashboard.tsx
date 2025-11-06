import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BookOpen, Brain, Calendar, MessageSquare, TrendingUp, Download, Clock, Home, Lock } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { GamificationStats } from "@/components/GamificationStats";
import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Sidebar } from "@/components/Sidebar";
import { AdminHeader } from "@/components/AdminHeader";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: progress, isLoading: progressLoading } = trpc.progress.get.useQuery();
  
  // Debug: Log user object to check isBetaTester
  useEffect(() => {
    if (user) {
      console.log('[Dashboard] User object:', user);
      console.log('[Dashboard] isBetaTester:', user.isBetaTester);
    }
  }, [user]);
  const { data: weeks } = trpc.course.getWeeks.useQuery();
  const { data: units } = trpc.course.getUnits.useQuery();
  const updateProgress = trpc.progress.update.useMutation();
  const utils = trpc.useUtils();
  const { t } = useTranslation();
  
  // Onboarding tutorial state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
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

  // Show pending approval overlay for inactive users
  if (!user.isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-2 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <CardTitle className="text-2xl">Account Pending Approval</CardTitle>
            </div>
            <CardDescription className="text-base">
              Your beta tester application is being reviewed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-yellow-200">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>Our team will review your application within 24-48 hours</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>You'll receive an email at <strong>{user.email}</strong> once approved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 mt-0.5">•</span>
                  <span>After approval, you'll have full access to Units 1-5</span>
                </li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => window.location.href = '/'} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
              <Button onClick={logout} variant="ghost" className="flex-1">
                Logout
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
    await updateProgress.mutateAsync({ learningDuration: parseInt(duration) });
    utils.progress.get.invalidate();
  };

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding 
          userName={user.name || user.email || 'there'} 
          onClose={handleCloseOnboarding}
        />
      )}
      
      <AdminHeader />
      
      <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="container py-8">
        {/* Gamification Stats */}
        <GamificationStats />

        <div className="h-6"></div>

        {/* Beta Tester Benefits Banner */}
        {user.isBetaTester && (
          <div className="mb-6 border-2 border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="bg-yellow-400 rounded-full p-3 flex-shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl mb-3 text-gray-900">Beta Tester Benefits</h3>
                <p className="text-sm text-gray-700 mb-3">
                  <strong>Thank you for being an early supporter!</strong> As a beta tester, you have:
                </p>
                <ul className="text-sm text-gray-700 space-y-2 mb-4">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span><strong>Free access</strong> to Units 1-5 during the beta phase</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span><strong>50% OFF discount</strong> on the full course (all 27 units) when we launch</span>
                  </li>

                </ul>
                <div className="bg-white/80 rounded-md p-3 border border-yellow-300">
                  <p className="text-xs text-gray-600">
                    <strong>📅 After Launch:</strong> You'll receive an email with your exclusive 50% discount code to unlock Units 6-27 and continue your Serbian learning journey!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                    const isLocked = user.isBetaTester && unitNum > 5;

                    if (isLocked) {
                      return (
                        <Card key={unitNum} className="transition-all opacity-60 bg-gray-50 border-gray-300">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-gray-100">
                                    Unit {unitNum}
                                  </Badge>
                                  <Lock className="h-4 w-4 text-gray-500" />
                                  <span className="text-gray-500 text-sm font-medium">🔒 Locked</span>
                                </div>
                                <div className="font-semibold text-lg mb-1 text-gray-600">
                                  {unit?.title}
                                </div>
                                <div className="text-sm text-gray-500 mb-3">
                                  {unit?.titleEnglish}
                                </div>
                                <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                                  🎁 <strong>Beta Tester:</strong> Units 6-27 will be unlocked after beta testing. You'll get <strong>50% OFF</strong> at launch!
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
                                  Locked
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

        {/* Footer with Book Reference */}
        <footer className="mt-16 pt-8 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>
                <strong>Companion to:</strong> "Step by Step Serbian 1" by Mirjana Danilović
                <span className="ml-2">• All content is original and independently created to complement the book</span>
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/step-by-step-serbian.pdf" target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            </Button>
          </div>
        </footer>
      </main>
    </div>
    </>
  );
}
