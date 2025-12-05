import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { COURSE_UNITS } from "@shared/data";
import { BookOpen, CheckCircle2, Brain, Lightbulb, Lock } from "lucide-react";
import { Link, useParams } from "wouter";
import { MarkdownContent } from "@/components/MarkdownContent";
import { InteractiveMarkdownContent } from "@/components/InteractiveMarkdownContent";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "react-i18next";

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
  const completeUnitMutation = useMutation(api.progress.completeUnit);
  const unitCompletionStatus = useQuery(api.progress.canCompleteUnit, { unitNumber });
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  
  // Calculate derived values after hooks
  const isLoading = explanation === undefined;
  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  
  // Check if unit is locked for beta testers
  const isLocked = user?.isBetaTester && unitNumber > 5;
  const isBetaLockError = false; // Handled by isLocked
  
  // Callback and effect hooks
  const handleComplete = React.useCallback(async () => {
    setIsCompleting(true);
    try {
      await completeUnitMutation({ unitNumber });
      setShowSuccess(true);
    } finally {
      setIsCompleting(false);
    }
  }, [completeUnitMutation, unitNumber]);

  // Automatischer Abschluss wenn Bedingungen erfüllt sind
  React.useEffect(() => {
    if (
      !isCompleted &&
      unitCompletionStatus?.canComplete &&
      !isCompleting &&
      !showSuccess
    ) {
      handleComplete();
    }
  }, [isCompleted, unitCompletionStatus?.canComplete, isCompleting, showSuccess, handleComplete]);
  
  console.log('[UnitView] Debug:', { 
    unitNumber, 
    hasExplanation: !!explanation, 
    isLoading,
    overviewLength: explanation?.overview?.length,
    grammarLength: explanation?.grammarExplained?.length 
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
  
  // Show locked message for beta testers trying to access Units 6-27
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
      <div className="flex-1">
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
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('unit.pageInCoursebook', { page: unit.page })}
                  </p>
                </div>
                {isCompleted && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    {t('unit.completed')}
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Success Message */}
          {showSuccess && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-900">{t('unit.unitCompleted')}</h3>
                      <p className="text-sm text-green-700">{t('unit.unitCompletedDesc', { number: unitNumber })}</p>
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
                    <MarkdownContent content={explanation.overview} />
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
                    <MarkdownContent content={explanation.grammarExplained} />
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
              {explanation ? (
                <Card>
                  <CardContent className="pt-6">
                    <InteractiveMarkdownContent content={explanation.practiceExamples} unitNumber={unit.number} />
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
                <Link href="/chat">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Brain className="mr-2 h-5 w-5" />
                    {t('unit.chatWithProfessor')}
                  </Button>
                </Link>
              </div>

              {/* Button entfernt - Abschluss erfolgt automatisch */}

              {isCompleted && nextUnit && (
                <Link href={`/unit/${nextUnit}`}>
                  <Button className="w-full" size="lg">
                    {t('unit.continueToUnit', { number: nextUnit })}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Book Reference */}
          {explanation?.bookReference && (
            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">
                  📖 {explanation.bookReference}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

