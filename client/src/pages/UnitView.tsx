import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, MessageSquare, Lightbulb, Lock } from "lucide-react";
import { Link, useParams } from "wouter";
import { MarkdownContent } from "@/components/MarkdownContent";
import { InteractiveMarkdownContent } from "@/components/InteractiveMarkdownContent";
import { Sidebar } from "@/components/Sidebar";

export default function UnitView() {
  const { user } = useAuth();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");

  const { data: unit } = trpc.course.getUnit.useQuery({ unitNumber });
  const { data: explanation, isLoading, error } = trpc.course.getUnitExplanation.useQuery({ unitNumber });
  
  // Check if unit is locked for beta testers
  const isLocked = user?.isBetaTester && unitNumber > 5;
  const isBetaLockError = error?.message?.includes('BETA_LOCKED');
  
  console.log('[UnitView] Debug:', { 
    unitNumber, 
    hasExplanation: !!explanation, 
    isLoading,
    error: error?.message,
    overviewLength: explanation?.overview?.length,
    grammarLength: explanation?.grammarExplained?.length 
  });
  const { data: progress } = trpc.progress.get.useQuery();
  const completeUnitMutation = trpc.progress.completeUnit.useMutation();
  const utils = trpc.useUtils();
  
  // All hooks must be called before any conditional returns
  const [showSuccess, setShowSuccess] = React.useState(false);

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
                <Button variant="ghost" size="sm">← Back to Dashboard</Button>
              </Link>
              <div className="flex items-center gap-2">
                <Lock className="h-6 w-6 text-gray-500" />
                <h1 className="text-xl font-bold text-gray-600">Unit {unitNumber} - Locked</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="container py-8 max-w-3xl">
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <Lock className="h-8 w-8 text-yellow-600" />
                <CardTitle className="text-2xl">🔒 This Unit is Locked</CardTitle>
              </div>
              <CardDescription className="text-base">
                As a beta tester, you have access to Units 1-5 for free.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <h3 className="font-semibold text-lg mb-2">🎁 Beta Tester Benefits</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Free access</strong> to Units 1-5 during beta testing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>50% OFF discount</strong> when the full course launches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Early access</strong> to all features and improvements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span><strong>Shape the future</strong> of the app with your feedback</span>
                  </li>
                </ul>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>💡 What's next?</strong> Complete Units 1-5, practice vocabulary, and send us your feedback! 
                  Units 6-27 will be unlocked after the beta testing phase ends.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/dashboard">
                  <Button variant="default">← Back to Dashboard</Button>
                </Link>
                <Link href="/feedback">
                  <Button variant="outline">Send Feedback</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        </div>
      </div>
    );
  }

  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;

  const handleComplete = async () => {
    await completeUnitMutation.mutateAsync({ unitNumber });
    utils.progress.get.invalidate();
    setShowSuccess(true);
  };

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
                <Button variant="ghost" size="sm">← Back to Dashboard</Button>
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Unit {unitNumber}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prevUnit && (
                <Link href={`/unit/${prevUnit}`}>
                  <Button variant="outline" size="sm">← Previous</Button>
                </Link>
              )}
              {nextUnit && (
                <Link href={`/unit/${nextUnit}`}>
                  <Button variant="outline" size="sm">Next →</Button>
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
                    {unit.title}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {unit.titleEnglish}
                  </CardDescription>
                  <p className="text-sm text-muted-foreground mt-2">
                    Page {unit.page} in coursebook
                  </p>
                </div>
                {isCompleted && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Completed
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
                      <h3 className="font-semibold text-green-900">Great job! Unit completed!</h3>
                      <p className="text-sm text-green-700">You've finished Unit {unitNumber}. Keep up the excellent work!</p>
                    </div>
                  </div>
                  {nextUnit && (
                    <Link href={`/unit/${nextUnit}`}>
                      <Button>Continue to Unit {nextUnit} →</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="grammar">Grammar Explained</TabsTrigger>
              <TabsTrigger value="practice">Practice Examples</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-6">
              {explanation ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-primary" />
                      Unit Overview
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
                      <CardTitle>Lesson Topics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {unit.topics.map((topic, idx) => (
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
                      <CardTitle>Grammar Focus</CardTitle>
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
                      <CardTitle>Vocabulary Areas</CardTitle>
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
                    <p>Detailed grammar explanations for this unit are coming soon!</p>
                    <p className="text-sm mt-2">In the meantime, check the coursebook or ask the AI Professor.</p>
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
                    <p>Practice dialogues for this unit are coming soon!</p>
                    <p className="text-sm mt-2">Check the coursebook for exercises and dialogues.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Learning Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Link href={`/vocabulary?unit=${unitNumber}`}>
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <BookOpen className="mr-2 h-5 w-5" />
                    Practice Vocabulary
                  </Button>
                </Link>
                <Link href="/chat">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Ask AI Professor
                  </Button>
                </Link>
              </div>

              {!isCompleted && (
                <Button 
                  onClick={handleComplete} 
                  className="w-full" 
                  size="lg"
                  disabled={completeUnitMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  {completeUnitMutation.isPending ? "Marking as complete..." : "Mark Unit as Complete"}
                </Button>
              )}

              {isCompleted && nextUnit && (
                <Link href={`/unit/${nextUnit}`}>
                  <Button className="w-full" size="lg">
                    Continue to Unit {nextUnit} →
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

