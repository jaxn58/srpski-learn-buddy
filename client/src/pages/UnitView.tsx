import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { COURSE_UNITS } from "@shared/data";
import { BookOpen, CheckCircle2, Brain, Lightbulb, Lock, Star } from "lucide-react";
import { Link, useParams } from "wouter";
import { MarkdownContent } from "@/components/MarkdownContent";
import { InteractiveMarkdownContent } from "@/components/InteractiveMarkdownContent";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const sanitizeBookHints = (markdown?: string | null) => {
  if (!markdown) return markdown;
  const forbidden = ["step by step serbian", "mirjana danilovi", "mirjana danilovich"];
  return markdown
    .split(/\r?\n/)
    .filter(line => {
      const lower = line.toLowerCase();
      return !forbidden.some(term => lower.includes(term));
    })
    .join("\n");
};

export default function UnitView() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");

  // Get unit from static course data
  const unit = COURSE_UNITS.find(u => u.number === unitNumber);
  // Get explanation from Convex
  const explanation = useQuery(api.units.getExplanation, { unitNumber });

  // All hooks must be called before any conditional returns
  const progress = useQuery(api.progress.getUserProgress);
  const masteryStatus = useQuery(api.progress.getUnitMasteryStatus, { unitNumber });
  const completeUnitMutation = useMutation(api.progress.completeUnit);
  const resetUnitCompletionMutation = useMutation(api.progress.resetUnitCompletion);
  const markUnit1CompleteMutation = useMutation(api.admin.markUnit1Complete);
  const unitCompletionStatus = useQuery(api.progress.canCompleteUnit, { unitNumber });
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = React.useState(false);
  const [isResettingUnit, setIsResettingUnit] = React.useState(false);

  // Calculate derived values after hooks
  const isLoading = explanation === undefined;
  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  const isMastered = masteryStatus?.isMastered ?? false;

  const shouldShowManualUnit1CompleteButton =
    unitNumber === 1 && !isCompleted && user?.role === "superadmin";
  
  // Check if unit is locked for beta testers
  const isLocked = user?.isBetaTester && unitNumber > 6;
  const isBetaLockError = false; // Handled by isLocked
  
  // Callback and effect hooks
  const handleComplete = React.useCallback(async () => {
    console.log('[UnitView] handleComplete called for unit', unitNumber);
    setIsCompleting(true);
    try {
      console.log('[UnitView] Calling completeUnitMutation...');
      await completeUnitMutation({ unitNumber });
      console.log('[UnitView] completeUnitMutation succeeded');
      setShowSuccess(true);
    } catch (error) {
      console.error('[UnitView] completeUnitMutation failed:', error);
    } finally {
      setIsCompleting(false);
    }
  }, [completeUnitMutation, unitNumber]);

  const canResetUnit =
    user?.role === "superadmin" || user?.role === "admin";

  const handleResetUnit = React.useCallback(async () => {
    if (!canResetUnit) return;

    setIsResettingUnit(true);
    try {
      const result = await resetUnitCompletionMutation({ unitNumber });
      toast.success(`Unit ${unitNumber} reset`, {
        description: result.updated
          ? "Progress updated. Reloading data..."
          : "Unit was already reset.",
      });
      if (result.updated) {
        setShowSuccess(false);
      }
    } catch (error: any) {
      console.error('[UnitView] resetUnitCompletion failed:', error);
      toast.error('Failed to reset unit', {
        description: error?.message || 'An error occurred',
      });
    } finally {
      setIsResettingUnit(false);
    }
  }, [canResetUnit, resetUnitCompletionMutation, unitNumber, user?.role]);

  // Handle manual Unit 1 completion
  const handleMarkUnit1Complete = React.useCallback(async () => {
    if (unitNumber !== 1) return;
    if (user?.role !== "superadmin") {
      toast.error("Unauthorized", {
        description: "This action is only available to superadmins.",
      });
      return;
    }
    
    setIsMarkingComplete(true);
    try {
      console.log('[UnitView] Calling markUnit1CompleteMutation...');
      const result = await markUnit1CompleteMutation();
      console.log('[UnitView] markUnit1CompleteMutation succeeded:', result);
      
      toast.success('Unit 1 marked as complete!', {
        description: `Processed ${result.vocabProcessed} vocabulary words and ${result.exercisesProcessed} exercises. Earned ${result.xpEarned} XP!`,
      });
      
      // Refresh the page to show updated progress
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('[UnitView] markUnit1CompleteMutation failed:', error);
      toast.error('Failed to mark Unit 1 as complete', {
        description: error.message || 'An error occurred',
      });
    } finally {
      setIsMarkingComplete(false);
    }
  }, [markUnit1CompleteMutation, unitNumber, user?.role, isCompleted]);

  // Automatischer Abschluss wenn Bedingungen erfüllt sind
  React.useEffect(() => {
    console.log('[UnitView] useEffect check:', {
      isCompleted,
      canComplete: unitCompletionStatus?.canComplete,
      isCompleting,
      showSuccess,
      willCallComplete: !isCompleted && unitCompletionStatus?.canComplete && !isCompleting && !showSuccess,
    });

    if (
      !isCompleted &&
      unitCompletionStatus?.canComplete &&
      !isCompleting &&
      !showSuccess
    ) {
      console.log('[UnitView] Calling handleComplete() automatically');
      handleComplete();
    }
  }, [isCompleted, unitCompletionStatus?.canComplete, isCompleting, showSuccess, handleComplete]);
  
  console.log('[UnitView] Debug:', { 
    unitNumber, 
    hasExplanation: !!explanation, 
    isLoading,
    userLanguage: 'en', // BETA: Force English
    overviewLength: explanation?.overview?.length,
    grammarLength: explanation?.grammarExplained?.length,
    overviewPreview: explanation?.overview?.substring(0, 100),
    hasOverviewGerman: !!(explanation as any)?.overviewGerman,
    overviewGermanLength: (explanation as any)?.overviewGerman?.length,
    // Unit completion status
    isCompleted,
    unitCompletionStatus: unitCompletionStatus ? {
      canComplete: unitCompletionStatus.canComplete,
      reasons: unitCompletionStatus.reasons,
      vocabMastered: unitCompletionStatus.vocabMastered,
      vocabTotal: unitCompletionStatus.vocabTotal,
      vocabMasteredCount: unitCompletionStatus.vocabMasteredCount,
      exercisesCompleted: unitCompletionStatus.exercisesCompleted,
    } : null,
    progress: progress ? {
      currentUnit: progress.currentUnit,
      completedUnits: progress.completedUnits,
    } : null,
    isCompleting,
    showSuccess,
  });

  // Show loading while auth is loading
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  if (!unit) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }
  
  // Show locked message for beta testers trying to access Units 7-27 (Modules 2-5)
  if (isLocked || isBetaLockError) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1">
        <header className="border-b bg-card">
          <div className="container py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← {t('unit.backToDashboard')}</Button>
              </Link>
              <div className="flex items-center gap-2">
                <Lock className="h-6 w-6 text-gray-500" />
                <h1 className="text-xl font-bold text-gray-600">{t('unit.locked', { number: unitNumber })}</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="container py-8 max-w-3xl">
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lock className="h-8 w-8 text-yellow-600" />
                <CardTitle className="text-2xl">{t('unit.lockedTitle')}</CardTitle>
              </div>
              <CardDescription className="text-base">
                {t('unit.lockedDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <h3 className="font-semibold text-lg mb-2">{t('unit.betaBenefits')}</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{t('unit.betaBenefit1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{t('unit.betaBenefit2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{t('unit.betaBenefit3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{t('unit.betaBenefit4')}</span>
                  </li>
                </ul>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>{t('unit.whatsNext')}</strong> {t('unit.whatsNextDesc')}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/dashboard">
                  <Button variant="default">← {t('unit.backToDashboard')}</Button>
                </Link>
                <Link href="/feedback">
                  <Button variant="outline">{t('unit.sendFeedback')}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        </div>
      </div>
    );
  }

  const nextUnit = unitNumber < 27 ? unitNumber + 1 : null;
  const prevUnit = unitNumber > 1 ? unitNumber - 1 : null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">← {t('unit.backToDashboard')}</Button>
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">{t('unit.unit', { number: unitNumber })}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prevUnit && (
                <Link href={`/unit/${prevUnit}`}>
                  <Button variant="outline" size="sm">{t('unit.previous')}</Button>
                </Link>
              )}
              {nextUnit && (
                <Link href={`/unit/${nextUnit}`}>
                  <Button variant="outline" size="sm">{t('unit.next')}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Unit Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2">
                    {i18n.language === 'de' ? unit.titleGerman : unit.titleEnglish}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {unit.title}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isCompleted && (
                    <Badge
                      variant="default"
                      className="bg-[color:var(--brand-blue)] text-[color:var(--brand-blue-foreground)] border-[color:var(--brand-blue)] shadow-sm"
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4 text-white" />
                      {t('unit.completed')}
                    </Badge>
                  )}
                  {isMastered && (
                    <Badge className="bg-amber-500 text-white border-amber-500 hover:bg-amber-500/90 shadow-sm">
                      <Star className="mr-1 h-4 w-4 text-white" fill="currentColor" strokeWidth={0} />
                      {t('unit.mastered', 'Mastered')}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Success Message */}
          {showSuccess && (
            <Card className="bg-[color:var(--brand-blue-soft)] border-[color:var(--brand-blue-soft-border)]">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-[color:var(--brand-blue)]" />
                    <div>
                      <h3 className="font-semibold text-[color:var(--brand-blue-strong-text)]">{t('unit.unitCompleted')}</h3>
                      <p className="text-sm text-[color:var(--brand-blue-strong-text)] opacity-80">{t('unit.unitCompletedDesc', { number: unitNumber })}</p>
                    </div>
                  </div>
                  {nextUnit && (
                    <Link href={`/unit/${nextUnit}`}>
                      <Button>{t('unit.continueToUnit', { number: nextUnit })}</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {isCompleted && !isMastered && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
              <div className="flex items-start gap-3">
                <Star className="h-5 w-5 text-amber-500 mt-0.5" fill="currentColor" strokeWidth={0} />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">{t('unit.masteryReminderTitle')}</p>
                  <p className="text-xs sm:text-sm text-amber-800">
                    {t('unit.masteryReminderDesc')}
                  </p>
                </div>
              </div>
              {masteryStatus && (
                <div className="flex flex-wrap gap-2 text-xs font-medium text-amber-900">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-white/90 px-3 py-1">
                    {t('unit.vocabProgress')}: {masteryStatus.vocabMasteredCount}/{masteryStatus.vocabTotal}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-white/90 px-3 py-1">
                    {t('unit.exerciseProgress')}: {masteryStatus.exerciseQuestionMasteredCount}/{masteryStatus.exerciseQuestionTotal}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">{t('unit.unitOverview')}</TabsTrigger>
              <TabsTrigger value="grammar">{t('unit.grammarExplained')}</TabsTrigger>
              <TabsTrigger value="practice">{t('unit.practiceExamples')}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-6">
              {explanation ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      {t('unit.unitOverview')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownContent content={sanitizeBookHints(explanation.overview) || ""} />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Topics */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('unit.lessonTopics')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(i18n.language === 'de' ? unit.topicsGerman : unit.topics).map((topic, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Grammar Focus */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('unit.grammarFocus')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {unit.grammarFocus.map((grammar, idx) => (
                          <Badge key={idx} variant="secondary">
                            {grammar}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Vocabulary Themes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('unit.vocabularyAreas')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {unit.vocabularyThemes.map((theme, idx) => (
                          <Badge key={idx} variant="outline">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Grammar Tab */}
            <TabsContent value="grammar" className="space-y-6 mt-6">
              {explanation ? (
                <Card>
                  <CardContent className="pt-6">
                    <MarkdownContent content={sanitizeBookHints(explanation.grammarExplained) || ""} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>{t('unit.grammarComingSoon')}</p>
                    <p className="text-sm mt-2">{t('unit.grammarComingSoonDesc')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Practice Tab */}
            <TabsContent value="practice" className="space-y-6 mt-6">
              {explanation && explanation.practiceExamples && explanation.practiceExamples.trim().length > 0 ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {t('unit.practiceExamples')}
                      </CardTitle>

                      {/* XP Info Modal Trigger */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                            <Star className="h-4 w-4 text-yellow-600 fill-yellow-500" />
                            <span className="text-sm">{t('unit.howXpWorks', 'How XP Works')}</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Star className="h-5 w-5 text-yellow-600 fill-yellow-500" />
                              {t('unit.xpSystemTitle', 'How XP Works')}
                            </DialogTitle>
                            <DialogDescription>
                              {t('unit.xpSystemDesc', 'Earn XP through Spaced Repetition - the more you practice, the more you earn!')}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-800 min-w-[60px] justify-center">+5 XP</Badge>
                                <span className="text-sm">{t('unit.xpFirstCorrect', '1st time correct')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 min-w-[60px] justify-center">+10 XP</Badge>
                                <span className="text-sm">{t('unit.xpSecondCorrect', '2nd time correct')}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 min-w-[60px] justify-center">+20 XP</Badge>
                                <span className="text-sm">{t('unit.xpThirdCorrect', '3rd time correct (Mastered!)')}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t">
                              <p className="text-sm font-medium text-foreground">
                                {t('unit.xpLevelUp', 'Every 300 XP = 1 Level Up! 🎉')}
                              </p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <InteractiveMarkdownContent content={sanitizeBookHints(explanation.practiceExamples) || ""} unitNumber={unit.number} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>{t('unit.practiceComingSoon')}</p>
                    <p className="text-sm mt-2">{t('unit.practiceComingSoonDesc')}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{t('unit.activities')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Link href={`/vocabulary?unit=${unitNumber}`}>
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <BookOpen className="mr-2 h-5 w-5" />
                    {t('unit.practiceVocab')}
                  </Button>
                </Link>
                <Link href={`/vocabulary?unit=${unitNumber}&mode=quiz`}>
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Star className="mr-2 h-5 w-5 text-yellow-600" />
                    {t('unit.vocabularyQuiz', 'Vocabulary Quiz')}
                  </Button>
                </Link>
              </div>
              <div className="grid md:grid-cols-1 gap-4">
                <Link href="/chat">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Brain className="mr-2 h-5 w-5" />
                    {t('unit.chatWithProfessor')}
                  </Button>
                </Link>
                {isMastered && (
                  <Button
                    variant="outline"
                    className="w-full justify-start border-amber-300 text-amber-900 hover:bg-amber-50"
                    size="lg"
                  >
                    <Star className="mr-2 h-5 w-5 text-amber-500" fill="currentColor" strokeWidth={0} />
                    {t('unit.masteredCta', 'Mastered – großartig!')}
                  </Button>
                )}
                {canResetUnit && (
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    size="lg"
                    onClick={handleResetUnit}
                    disabled={isResettingUnit}
                  >
                    {isResettingUnit ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                        Resetting Unit...
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
                        Reset Unit Completion (Admin)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Manual Unit 1 Completion Button - Only for Unit 1 */}
              {shouldShowManualUnit1CompleteButton && (
                <div className="border-t pt-4 mt-4">
                  <Button 
                    onClick={handleMarkUnit1Complete}
                    disabled={isMarkingComplete}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    {isMarkingComplete ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        Marking Unit 1 as complete...
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
                        Mark Unit 1 as Complete (Skip Exercises)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    This will mark all Unit 1 vocabulary as mastered and all exercises as completed. Use this if you've already completed Unit 1 before.
                  </p>
                </div>
              )}

              {isCompleted && nextUnit && (
                <Link href={`/unit/${nextUnit}`}>
                  <Button className="w-full" size="lg">
                    {t('unit.continueToUnit', { number: nextUnit })}
                  </Button>
                </Link>
              )}
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

