import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { BookOpen, Brain, MessageSquare, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    window.location.href = "/dashboard";
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <header className="container py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Serbian AI Tutor</h1>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>Anmelden</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-5xl font-bold tracking-tight">
            Lernen Sie Serbisch mit Ihrem
            <span className="text-primary"> persönlichen AI-Professor</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Ein strukturierter 3-Monats-Kurs basierend auf "Step by Step Serbian 1" – 
            mit interaktiven Übungen, Vokabeltraining und intelligenter Konversationspraxis.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>Jetzt starten</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Mehr erfahren</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <BookOpen className="h-10 w-10 text-primary mb-2" />
              <CardTitle>12-Wochen-Plan</CardTitle>
              <CardDescription>
                Strukturierter Lernpfad durch alle 27 Lektionen des Kursbuchs
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>AI-Professor</CardTitle>
              <CardDescription>
                Ihr persönlicher Tutor erklärt Grammatik, korrigiert Fehler und motiviert Sie
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Konversationspraxis</CardTitle>
              <CardDescription>
                Üben Sie echte Gespräche auf Serbisch mit sofortigem Feedback
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Fortschrittsverfolgung</CardTitle>
              <CardDescription>
                Sehen Sie Ihre Erfolge und bleiben Sie motiviert durch klare Meilensteine
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Course Structure */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">Ihr Lernweg</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Monat 1</CardTitle>
                <CardDescription className="text-base">
                  Die Grundlagen schaffen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Alphabet & Aussprache</li>
                  <li>• Erste Gespräche</li>
                  <li>• Orientierung in der Stadt</li>
                  <li>• Einkaufen & Restaurant</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Monat 2</CardTitle>
                <CardDescription className="text-base">
                  Grammatik vertiefen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Tagesablauf & Familie</li>
                  <li>• Vergangenheit sprechen</li>
                  <li>• Genitiv & Akkusativ</li>
                  <li>• Menschen beschreiben</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Monat 3</CardTitle>
                <CardDescription className="text-base">
                  Fortgeschrittene Strukturen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Reisen & Wetter</li>
                  <li>• Zukunftspläne</li>
                  <li>• Imperativ & Konditional</li>
                  <li>• Kyrillisches Alphabet</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <Card className="max-w-2xl mx-auto bg-primary text-primary-foreground">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Bereit, Serbisch zu lernen?</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-lg">
              Starten Sie noch heute Ihre Reise zur serbischen Sprache
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" variant="secondary" asChild>
              <a href={getLoginUrl()}>Kostenlos beginnen</a>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container py-8 border-t">
        <div className="text-center text-sm text-muted-foreground">
          <p>Basierend auf "Step by Step Serbian 1" von Mirjana Danilović</p>
          <p className="mt-2">© 2024 Serbian AI Tutor. Powered by Manus AI.</p>
        </div>
      </footer>
    </div>
  );
}

