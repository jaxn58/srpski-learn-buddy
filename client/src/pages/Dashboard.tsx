import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, Brain, MessageSquare, Home, Lock, Star } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

import { WelcomeOnboarding } from "@/components/WelcomeOnboarding";
import { FeedbackForm } from "@/components/FeedbackForm";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { logger } from "@/lib/logger";

import { useState, useEffect } from "react";

export default function Dashboard() {
  const { user, loading: authLoading, logout, clerkUser } = useAuth();
  const { t, i18n } = useTranslation();
  
  // Use user's learning language or fallback to UI language or 'en'
  const displayLanguage = user?.learningLanguage || (i18n.language === 'de' ? 'de' : 'en');
  
  const progress = useQuery(api.progress.getUserProgress);
  const progressLoading = progress === undefined;
  const accessibleUnits = useQuery(api.subscriptions.getAccessibleUnits);
  const masteredUnits = useQuery(api.progress.getMasteredUnits, user ? undefined : "skip");
  const safeCurrentUnit =
    typeof progress?.currentUnit === "number" && Number.isFinite(progress.currentUnit) && progress.currentUnit > 0
      ? progress.currentUnit
      : 1;
  
  // Check if user has started the current unit (for Current vs Next Unit label)
  const currentUnitActivity = useQuery(
    api.progress.hasUnitActivity,
    progressLoading ? "skip" : { unitNumber: safeCurrentUnit }
  );
  
  // Load dynamic data from DB instead of static files
  const units = useQuery(api.units.getAllUnitsMetadata, { language: displayLanguage });
  
  const syncUserMutation = useMutation(api.users.syncUser);

  // Explicit sync check: If Clerk user exists but Convex user doesn't, trigger sync
  useEffect(() => {
    if (clerkUser && !authLoading && !user) {
      // Wait a moment to let useAuth hook handle it first, then retry if needed
      const timeoutId = setTimeout(() => {
        syncUserMutation({ learningLanguage: 'en' })
          .catch((error) => {
            logger.error('[Dashboard] Manual sync failed:', error);
          });
      }, 3000); // Wait 3 seconds to give useAuth hook a chance first

      return () => clearTimeout(timeoutId);
    }
  }, [clerkUser, user, authLoading, syncUserMutation]);
  
  const updateProgressMutation = useMutation(api.progress.updateProgress);
  const completedBadgeClass = "bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm";
  const masteredBadgeClass = "bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm";
  
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
  
  // Show onboarding automatically unless user has explicitly disabled it
  useEffect(() => {
    if (user) {
      const isDisabled = localStorage.getItem(`onboarding_disabled_${user._id}`);
      
      if (!isDisabled) {
        setShowOnboarding(true);
      }
    }
  }, [user]);
  
  const handleCloseOnboarding = (disableAutoShow: boolean = false) => {
    if (user && disableAutoShow) {
      localStorage.setItem(`onboarding_disabled_${user._id}`, 'true');
    }
    setShowOnboarding(false);
  };

  
  const completedUnits = progress?.completedUnits || [];
  
  // Determine if user is beta tester
  const isBeta = user?.isBetaTester || accessibleUnits?.isBeta || false;
  const totalUnits = isBeta ? 3 : (units?.length || 27);
  const progressPercentage = (completedUnits.length / totalUnits) * 100;
  const learningDuration = progress?.learningDuration || 12;
  
  // Admin bypass: Show all units for admins
  const isAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const rawAccessible = Array.isArray(accessibleUnits)
    ? accessibleUnits
    : Array.isArray((accessibleUnits as any)?.units)
    ? (accessibleUnits as any).units
    : Array.isArray((accessibleUnits as any)?.accessibleUnits)
    ? (accessibleUnits as any).accessibleUnits
    : [];
    
  // For non-admin users, show accessible units. For admins, show all units.
  const displayUnits = isAdmin ? units?.map(u => u.unitNumber) : rawAccessible;
  const visibleUnits = Array.from(
    new Set(
      [
        ...(displayUnits || []),
        ...(rawAccessible || []),
        progress?.currentUnit,
        ...completedUnits,
      ].filter(Boolean) as number[]
    )
  );

  const accessibleCount = Array.isArray(rawAccessible) ? rawAccessible.length : 0;


  useEffect(() => {
    // Removed debug instrumentation
  }, [
    authLoading,
    progressLoading,
    user?._id,
    progress?.currentUnit,
    completedUnits.length,
    visibleUnits?.length,
    totalUnits,
    isBeta,
    accessibleCount,
    learningDuration,
  ]);

  // Show loading while auth or progress is loading
  // Also show loading while user is being synced to Convex
  if (authLoading || progressLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // All users now have immediate access - no pending approval needed

  return (
    <>
      {showOnboarding && user && (
        <WelcomeOnboarding 
          userName={user.name || user.email || 'there'} 
          onClose={handleCloseOnboarding}
        />
      )}
      
      <AnimatedPage>
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
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8 items-stretch">
          <AnimatedItem className="h-full">
            <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
              <CardHeader className="flex-1">
                <BookOpen className="h-10 w-10 text-primary mb-2" />
                <CardTitle>
                  {currentUnitActivity?.hasActivity ? t('dashboard.continueLesson') : t('dashboard.startNextLesson')}
                </CardTitle>
                <CardDescription>
                  {(() => {
                    const unit = units?.find(u => u.unitNumber === safeCurrentUnit);
                    return (
                      <>
                        <span className="font-semibold">{t('dashboard.unit', { number: safeCurrentUnit })}</span>
                        {unit?.title && <span> - {unit.title}</span>}
                      </>
                    );
                  })()}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href={`/unit/${safeCurrentUnit}`}>
                  <Button className="w-full">
                    {currentUnitActivity?.hasActivity ? t('dashboard.goToLesson') : t('dashboard.startLesson')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>

          <AnimatedItem className="h-full">
            <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
              <CardHeader className="flex-1">
                <Brain className="h-10 w-10 text-yellow-500 mb-2" />
                <CardTitle>{t('dashboard.chatWithProfessor')}</CardTitle>
                <CardDescription>
                  {t('dashboard.chatDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link href="/chat">
                  <Button className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:border-yellow-600" variant="outline">{t('dashboard.openChat')}</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>
        </div>

        {/* Modules List Card */}
        <AnimatedItem>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {isAdmin ? t('dashboard.adminView') : t('dashboard.allUnits', 'All Units')}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isAdmin
                  ? t('dashboard.adminViewDesc', 'All available course modules')
                  : t('dashboard.allUnitsDesc', 'Continue your learning journey')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5">
                    {visibleUnits?.map(unitNum => {
                    const unit = units?.find(u => u.number === unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;
                    const isMastered = masteredUnits?.includes(unitNum);
                    const isLocked = user.isBetaTester && unitNum > 3;

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
                        <Card className={`transition-all hover:shadow-lg hover:scale-[1.01] ${
                          isCurrent ? 'border-primary ring-2 ring-primary/20 shadow-md' : 
                          isMastered ? 'border-amber-400 bg-amber-50/60' :
                          isCompleted ? 'border-[color:var(--brand-blue-soft-border)] bg-[color:var(--brand-blue-soft)]' : 
                          'hover:border-primary/50'
                        }`}>
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                  <Badge variant={isCurrent ? 'default' : 'outline'} className="text-sm">
                                    {t('dashboard.unit', { number: unitNum })}
                                  </Badge>
                                  {isCompleted && (
                                    <Badge className={completedBadgeClass}>
                                      {t('dashboard.completedBadge')}
                                    </Badge>
                                  )}
                                  {isMastered && (
                                    <Badge className={masteredBadgeClass}>
                                      <Star className="mr-1 h-3 w-3 text-white" fill="currentColor" strokeWidth={0} />
                                      {t('dashboard.masteredBadge', 'Mastered')}
                                    </Badge>
                                  )}
                                  {isCurrent && !isCompleted && (
                                    <span className="text-primary text-sm font-medium">{t('dashboard.currentLessonBadge')}</span>
                                  )}
                                </div>
                                <div className="font-semibold text-xl mb-2 leading-tight">
                                  {i18n.language === 'de' ? unit?.titleGerman : unit?.titleEnglish}
                                </div>
                                <div className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                  {unit?.title}
                                </div>
                                {unit?.topics && unit.topics.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-4">
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
                              <div className="flex-shrink-0">
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
            </CardContent>
          </Card>
        </AnimatedItem>
      </AnimatedPage>
    </>
  );
}
