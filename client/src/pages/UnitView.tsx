import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, MessageSquare, Lightbulb, MessageCircle } from "lucide-react";
import { Link, useParams } from "wouter";
import { getUnitExplanation } from "@shared/unitExplanations";

export default function UnitView() {
  const { user } = useAuth();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");

  const { data: unit } = trpc.course.getUnit.useQuery({ unitNumber });
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

  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  const explanation = getUnitExplanation(unitNumber);

  const handleComplete = async () => {
    await completeUnitMutation.mutateAsync({ unitNumber });
    utils.progress.get.invalidate();
    setShowSuccess(true);
  };

  const nextUnit = unitNumber < 27 ? unitNumber + 1 : null;
  const prevUnit = unitNumber > 1 ? unitNumber - 1 : null;

  return (
    <div className="min-h-screen bg-background">
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

          {/* Overview */}
          {explanation && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Lightbulb className="h-5 w-5" />
                  What You'll Learn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-900">{explanation.overview}</p>
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

            <TabsContent value="overview" className="space-y-4 mt-6">
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
            </TabsContent>

            <TabsContent value="grammar" className="space-y-6 mt-6">
              {explanation?.grammarExplanations.map((grammarItem, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-xl">{grammarItem.topic}</CardTitle>
                    <CardDescription className="text-base pt-2">
                      {grammarItem.simpleExplanation}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Examples */}
                    <div>
                      <h4 className="font-semibold mb-3">Examples:</h4>
                      <div className="space-y-3">
                        {grammarItem.examples.map((example, exIdx) => (
                          <div key={exIdx} className="p-4 bg-gray-50 rounded-lg border">
                            <div className="grid md:grid-cols-2 gap-2 mb-2">
                              <div>
                                <span className="text-xs text-muted-foreground">Serbian:</span>
                                <p className="font-semibold text-lg">{example.serbian}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">English:</span>
                                <p className="text-lg">{example.english}</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t mt-2">
                              <span className="text-xs text-muted-foreground">💡 Explanation:</span>
                              <p className="text-sm mt-1">{example.explanation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comparison to English */}
                    {grammarItem.comparisonToEnglish && (
                      <div className="p-4 bg-blue-50 border-blue-200 border rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">🔄</span>
                          <div>
                            <h4 className="font-semibold mb-1">How is this different from English?</h4>
                            <p className="text-sm">{grammarItem.comparisonToEnglish}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {!explanation && (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>Detailed grammar explanations for this unit are coming soon!</p>
                    <p className="text-sm mt-2">In the meantime, check the coursebook or ask the AI Professor.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="practice" className="space-y-6 mt-6">
              {explanation?.practicalExamples.map((example, idx) => (
                <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      {example.situation}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {example.dialogue.map((line, lineIdx) => (
                        <div key={lineIdx} className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-semibold text-lg mb-1">{line.serbian}</p>
                          <p className="text-muted-foreground">{line.english}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 border-yellow-200 border rounded">
                      <p className="text-sm">💡 <strong>Try it yourself:</strong> Practice this dialogue out loud, or use it as a template to create your own conversations!</p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!explanation && (
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
              <CardDescription>
                Use these features to master the lesson
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto py-4" asChild>
                  <Link href="/chat">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Chat with AI Professor</div>
                        <div className="text-xs text-muted-foreground">
                          Ask for explanations
                        </div>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="h-auto py-4" asChild>
                  <Link href="/vocabulary">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Practice Vocabulary</div>
                        <div className="text-xs text-muted-foreground">
                          Learn new words
                        </div>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>

              {!isCompleted ? (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleComplete}
                  disabled={completeUnitMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Mark lesson as completed
                </Button>
              ) : showSuccess ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <h3 className="font-semibold text-green-900 mb-1">Great job! Unit {unitNumber} completed!</h3>
                    <p className="text-sm text-green-700">You're making excellent progress in your Serbian learning journey.</p>
                  </div>
                  {nextUnit ? (
                    <Link href={`/unit/${nextUnit}`}>
                      <Button className="w-full" size="lg">
                        Continue to Unit {nextUnit} →
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/dashboard">
                      <Button className="w-full" size="lg">
                        Return to Dashboard
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <CheckCircle2 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-blue-900 font-medium">Unit already completed</p>
                  {nextUnit && (
                    <Link href={`/unit/${nextUnit}`}>
                      <Button className="w-full mt-3" variant="outline">
                        Continue to Unit {nextUnit} →
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Study Tips */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Study Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>📖 Read the lesson in the coursebook (page {unit.page})</li>
                <li>✍️ Complete the exercises in the book</li>
                <li>🗣️ Practice the dialogues out loud</li>
                <li>💬 Chat with the AI Professor if you have questions</li>
                <li>🔁 Review vocabulary daily</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
