import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { COURSE_MODULES } from "@shared/data";
import { BookOpen, CheckCircle2, Brain, Lightbulb, Lock, Star, MessageSquare, Mic, PenTool, ChevronRight } from "lucide-react";
import { Link, useParams } from "wouter";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Sidebar } from "@/components/Sidebar";
import { AnimatedPage } from "@/components/AnimatedPage";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InteractiveTest } from "@/components/InteractiveTest";

export default function UnitView() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");
  
  // Use user's learning language or fallback
  const displayLanguage = user?.learningLanguage || (i18n.language === 'de' ? 'de' : 'en');

  // Load Unit Metadata & Content from DB
  const unitMetadata = useQuery(api.units.getUnitMetadata, { unitNumber, language: displayLanguage });
  const content = useQuery(api.units.getUnitContentSections, { unitNumber, language: displayLanguage });
  const vocabulary = useQuery(api.vocabulary.getCourseVocabularyByUnit, { unitNumber });

  // Determine Module from unitMetadata
  // Priority: 1. moduleMetadataId (new structure), 2. moduleId/slug (old structure), 3. COURSE_MODULES fallback
  const moduleSlug = unitMetadata?.moduleId || COURSE_MODULES.find(m => m.units.includes(unitNumber))?.id;
  
  // Try to get module by slug (new consolidated structure)
  const moduleMetadata = useQuery(api.modules.getModuleBySlug, 
    moduleSlug ? { slug: moduleSlug } : "skip"
  );
  
  // Fallback: Try old getModuleMetadata if new structure doesn't exist
  const oldModuleMetadata = useQuery(api.modules.getModuleMetadata,
    moduleSlug && !moduleMetadata ? { moduleId: moduleSlug, language: displayLanguage } : "skip"
  );

  const moduleTitle = React.useMemo(() => {
    if (!moduleSlug) {
      return undefined;
    }

    const sanitizeTitle = (rawTitle: string) => {
      const parenthesesMatch = rawTitle.match(/\(([^)]+)\)/);
      if (parenthesesMatch?.[1]) {
        return parenthesesMatch[1].trim();
      }
      return rawTitle.trim();
    };

    // Use new consolidated structure if available
    if (moduleMetadata) {
      const title = displayLanguage === "de" ? moduleMetadata.titleDe : moduleMetadata.titleEn;
      if (title) {
        return sanitizeTitle(title);
      }
    }

    // Fallback to old structure
    if (oldModuleMetadata?.title) {
      return sanitizeTitle(oldModuleMetadata.title);
    }

    // Final fallback to COURSE_MODULES
    const fallbackModule = COURSE_MODULES.find((module) => module.id === moduleSlug);
    return displayLanguage === "de" ? fallbackModule?.titleGerman : fallbackModule?.titleEnglish;
  }, [moduleSlug, moduleMetadata, oldModuleMetadata, displayLanguage]);

  // Progress hooks
  const progress = useQuery(api.progress.getUserProgress);
  const masteryStatus = useQuery(api.progress.getUnitMasteryStatus, { unitNumber });
  const completeUnitMutation = useMutation(api.progress.completeUnit);
  const markUnit1CompleteMutation = useMutation(api.admin.markUnit1Complete);
  const unitCompletionStatus = useQuery(api.progress.canCompleteUnit, { unitNumber });
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = React.useState(false);

  // Derived values
  const isLoading = unitMetadata === undefined || content === undefined;
  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  const isMastered = masteryStatus?.isMastered ?? false;
  const isLocked = user?.isBetaTester && unitNumber > 6; // Module 1 Limit

  const nextUnit = unitNumber < 27 ? unitNumber + 1 : null;
  const prevUnit = unitNumber > 1 ? unitNumber - 1 : null;

  // Handle completion
  const handleComplete = React.useCallback(async () => {
    setIsCompleting(true);
    try {
      await completeUnitMutation({ unitNumber });
      setShowSuccess(true);
    } catch (error) {
      console.error('Failed to complete unit:', error);
    } finally {
      setIsCompleting(false);
    }
  }, [completeUnitMutation, unitNumber]);

  // Auto-complete if requirements met - TEMPORARILY DISABLED
  // React.useEffect(() => {
  //   if (!isCompleted && unitCompletionStatus?.canComplete && !isCompleting && !showSuccess) {
  //     handleComplete();
  //   }
  // }, [isCompleted, unitCompletionStatus?.canComplete, isCompleting, showSuccess, handleComplete]);

  // Handle manual Unit 1 completion (Admin)
  const handleMarkUnit1Complete = async () => {
    setIsMarkingComplete(true);
    try {
      await markUnit1CompleteMutation();
      toast.success('Unit 1 marked as complete!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to mark Unit 1 as complete');
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (!user || !unitMetadata) {
    return <div className="min-h-screen flex items-center justify-center">Unit not found</div>;
  }

  if (isLocked) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <AnimatedPage>
        <div className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md border-yellow-200 bg-yellow-50">
            <CardHeader>
              <div className="flex items-center gap-2 text-yellow-600">
                <Lock className="h-6 w-6" />
                <CardTitle>{t('unit.lockedTitle')}</CardTitle>
              </div>
              <CardDescription>{t('unit.lockedDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard"><Button>Back to Dashboard</Button></Link>
            </CardContent>
          </Card>
        </div>
        </AnimatedPage>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <AnimatedPage>
      <div className="flex-1 md:ml-64 w-full">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="container py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  {t('sidebar.dashboard')}
                </Link>
                {moduleTitle && moduleSlug && (
                  <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <Link 
                      href={`/units#module-${moduleSlug}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {moduleTitle}
                    </Link>
                  </>
                )}
                {unitMetadata && (
                  <>
                    <ChevronRight className="h-4 w-4 mx-1" />
                    <span className="font-bold text-primary">
                      {unitMetadata.title} <span className="font-normal text-muted-foreground">(Unit {unitNumber})</span>
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prevUnit && <Link href={`/unit/${prevUnit}`}><Button variant="outline" size="sm">{t('unit.previous')}</Button></Link>}
              {nextUnit && <Link href={`/unit/${nextUnit}`}><Button variant="outline" size="sm">{t('unit.next')}</Button></Link>}
            </div>
          </div>
        </header>

        <main className="container py-8 max-w-5xl">
          {/* Header Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-3xl mb-2">{unitMetadata.title}</CardTitle>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {unitMetadata.topics?.map((topic: string, i: number) => (
                      <Badge key={i} variant="secondary">{topic}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {/* {isCompleted && <Badge className="bg-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/> Completed</Badge>} */}
                  {isMastered && <Badge className="bg-amber-500"><Star className="w-4 h-4 mr-1"/> Mastered</Badge>}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* New 6-Tab Structure */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
              <TabsTrigger value="overview" className="gap-2"><Lightbulb className="w-4 h-4"/> Overview</TabsTrigger>
              <TabsTrigger value="vocabulary" className="gap-2"><BookOpen className="w-4 h-4"/> Vocabulary</TabsTrigger>
              <TabsTrigger value="grammar" className="gap-2"><Brain className="w-4 h-4"/> Grammar</TabsTrigger>
              <TabsTrigger value="phrases" className="gap-2"><MessageSquare className="w-4 h-4"/> Phrases</TabsTrigger>
              <TabsTrigger value="dialogues" className="gap-2"><Mic className="w-4 h-4"/> Dialogues</TabsTrigger>
              <TabsTrigger value="test" className="gap-2"><PenTool className="w-4 h-4"/> Exercises</TabsTrigger>
            </TabsList>

            {/* 1. Overview */}
            <TabsContent value="overview" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {content?.overview ? (
                    <MarkdownContent content={content.overview} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No overview available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Vocabulary */}
            <TabsContent value="vocabulary" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Unit Vocabulary</CardTitle>
                  <CardDescription>Master these words to complete the unit.</CardDescription>
                </CardHeader>
                <CardContent>
                  {vocabulary && vocabulary.length > 0 ? (
                    <div className="space-y-2">
                      {vocabulary.map((word: any, i: number) => {
                        // NEW: Column-based translation access (consistent with moduleMetadata)
                        // FALLBACK: Support old translations[] array during migration
                        let displayTranslation: string;
                        let altSuffix = "";
                        let hasAlt = false;
                        
                        if (word.en && word.de) {
                          // NEW: Column-based structure
                          displayTranslation = displayLanguage === "de" ? word.de : word.en;
                          const alt = displayLanguage === "de" ? word.deAlt : word.enAlt;
                          hasAlt = Boolean(alt);
                          altSuffix = hasAlt ? ` (alt: ${alt})` : "";
                        } else if (word.translations && Array.isArray(word.translations)) {
                          // FALLBACK: Old translations[] array structure
                          const trans =
                            word.translations.find((t: any) => t.language === displayLanguage) ||
                            word.translations.find((t: any) => t.language === "en");
                          hasAlt = Boolean(trans?.alt);
                          altSuffix = hasAlt ? ` (alt: ${trans?.alt})` : "";
                          displayTranslation = trans?.translation || "-";
                        } else {
                          displayTranslation = "-";
                        }
                        
                        const displayWord = hasAlt ? `${word.serbian}*` : word.serbian;

                        return (
                          <div key={i} className="rounded-md border bg-muted/30 px-3 py-2">
                            <div className="font-medium">{displayWord}</div>
                            <div className="text-muted-foreground text-sm">
                              {`${displayTranslation}${altSuffix}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : content?.vocabulary ? (
                    <MarkdownContent content={content.vocabulary} />
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No vocabulary loaded.</p>
                  )}
                  <div className="mt-6 flex justify-end">
                    <Link href={`/vocabulary?unit=${unitNumber}`}>
                      <Button>Practice in Vocabulary Trainer</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Grammar */}
            <TabsContent value="grammar" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {content?.grammar ? (
                    <MarkdownContent content={content.grammar} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No grammar content available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. Phrases */}
            <TabsContent value="phrases" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {content?.phrases ? (
                    <MarkdownContent content={content.phrases} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No phrases available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Dialogues */}
            <TabsContent value="dialogues" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  {content?.dialogues ? (
                    <MarkdownContent content={content.dialogues} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No dialogues available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 6. Interactive Test */}
            <TabsContent value="test" className="mt-6">
              <InteractiveTest unitNumber={unitNumber} language={displayLanguage} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      </AnimatedPage>
    </div>
  );
}
