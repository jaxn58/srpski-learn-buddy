import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, MessageSquare } from "lucide-react";
import { Link, useParams } from "wouter";

export default function UnitView() {
  const { user } = useAuth();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");

  const { data: unit } = trpc.course.getUnit.useQuery({ unitNumber });
  const { data: progress } = trpc.progress.get.useQuery();
  const completeUnitMutation = trpc.progress.completeUnit.useMutation();
  const utils = trpc.useUtils();

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

  const handleComplete = async () => {
    await completeUnitMutation.mutateAsync({ unitNumber });
    utils.progress.get.invalidate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">← Zurück zum Dashboard</Button>
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Unit {unitNumber}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
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
                    Seite {unit.page} im Kursbuch
                  </p>
                </div>
                {isCompleted && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Abgeschlossen
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Topics */}
          <Card>
            <CardHeader>
              <CardTitle>Themen dieser Lektion</CardTitle>
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
              <CardTitle>Grammatik-Schwerpunkte</CardTitle>
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
              <CardTitle>Vokabular-Bereiche</CardTitle>
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

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Lernaktivitäten</CardTitle>
              <CardDescription>
                Nutzen Sie diese Funktionen, um die Lektion zu meistern
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-auto py-4" asChild>
                  <Link href="/chat">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="h-6 w-6" />
                      <div className="text-center">
                        <div className="font-semibold">Mit AI-Professor chatten</div>
                        <div className="text-xs text-muted-foreground">
                          Fragen Sie nach Erklärungen
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
                        <div className="font-semibold">Vokabeln üben</div>
                        <div className="text-xs text-muted-foreground">
                          Lernen Sie neue Wörter
                        </div>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>

              {!isCompleted && (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleComplete}
                  disabled={completeUnitMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Lektion als abgeschlossen markieren
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Study Tips */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Lerntipps</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>📖 Lesen Sie die Lektion im Kursbuch (Seite {unit.page})</li>
                <li>✍️ Machen Sie die Übungen im Buch</li>
                <li>🗣️ Üben Sie die Dialoge laut</li>
                <li>💬 Chatten Sie mit dem AI-Professor bei Fragen</li>
                <li>🔁 Wiederholen Sie die Vokabeln täglich</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
