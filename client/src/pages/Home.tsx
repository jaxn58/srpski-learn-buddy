import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { BookOpen, Brain, MessageSquare, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();

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
      <header className="container py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">{t('app.title')}</h1>
          </div>
          <Button asChild>
            <a href={getLoginUrl()}>{t('common.login')}</a>
          </Button>
        </div>
      </header>

      <section className="container py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-5xl font-bold tracking-tight">
            {t('home.hero.title')}
            <span className="text-primary"> {t('home.hero.titleHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('home.hero.subtitle')}
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <a href={getLoginUrl()}>{t('home.cta.start')}</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">{t('home.cta.learnMore')}</a>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="container py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <BookOpen className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('features.structuredPlan.title')}</CardTitle>
              <CardDescription>
                {t('features.structuredPlan.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Brain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('features.aiProfessor.title')}</CardTitle>
              <CardDescription>
                {t('features.aiProfessor.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('features.conversation.title')}</CardTitle>
              <CardDescription>
                {t('features.conversation.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary mb-2" />
              <CardTitle>{t('features.progress.title')}</CardTitle>
              <CardDescription>
                {t('features.progress.desc')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="container py-20">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">{t('course.structure.title')}</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-primary">{t('course.month1.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('course.month1.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Alphabet & Pronunciation</li>
                  <li>• First Conversations</li>
                  <li>• Getting Around the City</li>
                  <li>• Shopping & Restaurant</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">{t('course.month2.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('course.month2.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Daily Routine & Family</li>
                  <li>• Talking About the Past</li>
                  <li>• Genitive & Accusative</li>
                  <li>• Describing People</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">{t('course.month3.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('course.month3.subtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Travel & Weather</li>
                  <li>• Future Plans</li>
                  <li>• Imperative & Conditional</li>
                  <li>• Cyrillic Alphabet</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container py-20">
        <Card className="max-w-2xl mx-auto bg-primary text-primary-foreground">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">
              Ready to learn Serbian?
            </CardTitle>
            <CardDescription className="text-primary-foreground/80 text-lg">
              Start your journey to the Serbian language today
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button size="lg" variant="secondary" asChild>
              <a href={getLoginUrl()}>
                Start for Free
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="container py-8 border-t">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Based on "Step by Step Serbian 1" by Mirjana Danilović
          </p>
          <p className="mt-2">© 2024 Serbian AI Tutor. Powered by Manus AI.</p>
        </div>
      </footer>
    </div>
  );
}
