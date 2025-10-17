import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, Brain, Calendar, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const { data: progress, isLoading: progressLoading } = trpc.progress.get.useQuery();
  const { data: weeks } = trpc.course.getWeeks.useQuery();
  const { data: units } = trpc.course.getUnits.useQuery();

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Serbian AI Tutor</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Willkommen zurück, {user.name?.split(' ')[0] || 'Lernender'}!
          </h2>
          <p className="text-muted-foreground">
            Sie sind in Woche {progress?.currentWeek} von 12. Weiter so!
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamtfortschritt</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedUnits.length}/{totalUnits}</div>
              <Progress value={progressPercentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(progressPercentage)}% abgeschlossen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktuelle Woche</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Woche {progress?.currentWeek}</div>
              <p className="text-xs text-muted-foreground mt-2">
                {currentWeek?.title}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktuelle Lektion</CardTitle>
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
              <CardTitle>Aktuelle Lektion fortsetzen</CardTitle>
              <CardDescription>
                {units?.find(u => u.number === progress?.currentUnit)?.titleEnglish}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/unit/${progress?.currentUnit}`}>
                <Button className="w-full">Zur Lektion</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Mit AI-Professor chatten</CardTitle>
              <CardDescription>
                Stellen Sie Fragen und üben Sie Konversation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/chat">
                <Button className="w-full" variant="outline">Chat öffnen</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Woche {progress?.currentWeek}: {currentWeek?.title}</CardTitle>
            <CardDescription>
              {currentWeek?.goals.join(" • ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Lektionen dieser Woche:</h4>
                <div className="grid gap-2">
                  {currentWeek?.units.map(unitNum => {
                    const unit = units?.find(u => u.number === unitNum);
                    const isCompleted = completedUnits.includes(unitNum);
                    const isCurrent = unitNum === progress?.currentUnit;

                    return (
                      <Link key={unitNum} href={`/unit/${unitNum}`}>
                        <div className={`p-4 rounded-lg border transition-colors ${
                          isCurrent ? 'border-primary bg-primary/5' : 
                          isCompleted ? 'border-green-500 bg-green-50' : 
                          'border-border hover:border-primary/50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                Unit {unitNum}: {unit?.title}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {unit?.titleEnglish}
                              </div>
                            </div>
                            <div>
                              {isCompleted && (
                                <span className="text-green-600 text-sm">✓ Abgeschlossen</span>
                              )}
                              {isCurrent && !isCompleted && (
                                <span className="text-primary text-sm">→ Aktuell</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Praxis-Aktivitäten:</h4>
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
              Vokabeln üben
            </Button>
          </Link>
          <Link href="/progress">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Fortschritt ansehen
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
