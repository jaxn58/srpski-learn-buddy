import { useAuth } from "@/_core/hooks/useAuth";
import { SignUp } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles, Check, HelpCircle, DollarSign, RefreshCw, Shield, Calendar, Zap, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { WaitlistModal } from "@/components/WaitlistModal";

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const { t, i18n } = useTranslation();
  
  // Waitlist modal state
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  
  // Environment checks
  const isWaitlistMode = import.meta.env.VITE_WAITLIST_MODE === 'on';
  const isSuperadmin = user?.role === 'superadmin';
  
  // Show waitlist only if: waitlist mode is ON AND user is NOT a superadmin (or not logged in)
  const showWaitlist = isWaitlistMode && !isSuperadmin;
  const showBetaRegistration = !isWaitlistMode || isSuperadmin;
  
  // BETA: Force English for all users
  useEffect(() => {
    i18n.changeLanguage('en');
    localStorage.removeItem('preferredLanguage');
  }, [i18n]);
  
  // Fetch data from database
  const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);
  const dbModules = useQuery(api.modules.getAllModulesConsolidated);
  const dbUnitsEn = useQuery(api.units.getAllUnitsMetadata, { language: "en" });
  
  // Generate modules data for landing page from database
  const MODULES_DATA = useMemo(() => {
    if (!dbModules || dbModules.length === 0 || !courseVocabulary) {
      return [];
    }
    
    // Count vocabulary per unit
    const vocabCounts = courseVocabulary.reduce((acc, word) => {
      acc[word.unitNumber] = (acc[word.unitNumber] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    // Count units per module
    const unitCounts = (dbUnitsEn || []).reduce((acc, unit) => {
      const moduleId = unit.moduleId;
      if (moduleId) {
        acc[moduleId] = (acc[moduleId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    return dbModules.map((module) => {
      // Calculate total vocabulary for this module by summing units
      const moduleUnits = (dbUnitsEn || []).filter(u => u.moduleId === module.slug);
      const vocabCount = moduleUnits.reduce((sum, unit) => {
        return sum + (vocabCounts[unit.unitNumber] || 0);
      }, 0);
      
      return {
        id: module.slug || "",
        number: module.moduleNumber || 0,
        title: module.titleEn || "",
        titleEnglish: module.titleEn || "",
        titleGerman: module.titleDe || "",
        description: module.descriptionEn || "",
        descriptionGerman: module.descriptionDe || "",
        unitCount: unitCounts[module.slug || ""] || 0,
        vocabCount: vocabCount,
      };
    });
  }, [dbModules, courseVocabulary, dbUnitsEn]);
  
  const TOTAL_VOCABULARY = useMemo(() => {
    return courseVocabulary?.length || 0;
  }, [courseVocabulary]);
  
  const TOTAL_UNITS = useMemo(() => {
    return dbUnitsEn?.length || 0;
  }, [dbUnitsEn]);
  
  const TOTAL_MODULES = useMemo(() => {
    return dbModules?.length || 0;
  }, [dbModules]);
  
  const HOME_COUNTS = useMemo(() => {
    return {
      moduleCount: TOTAL_MODULES,
      unitCount: TOTAL_UNITS,
      vocabCount: TOTAL_VOCABULARY,
    };
  }, [TOTAL_MODULES, TOTAL_UNITS, TOTAL_VOCABULARY]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      {/* Hero Section */}
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t('home.header.title')}
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                  <Button className="bg-primary hover:bg-primary/90">{t('home.header.dashboard')}</Button>
              </Link>
            ) : (
              <>
                {showWaitlist && (
                  <Button 
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                    onClick={() => setIsWaitlistModalOpen(true)}
                  >
                    Join Waitlist
                  </Button>
                )}
                <Link href="/sign-in">
                  <Button className="bg-primary hover:bg-primary/90">
                      {t('home.header.login')}
                  </Button>
                </Link>
              </>
            )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-block px-4 py-2 bg-accent/20 rounded-full text-primary font-semibold mb-4 border border-accent/40">
            {t('home.hero.badge')}
          </div>
          <h2 className="text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {t('home.hero.title')}
            </span>
            <br />
            {t('home.hero.titleHighlight')}
          </h2>
          <p className="text-2xl font-semibold text-foreground/80 max-w-2xl mx-auto">
            {t('home.hero.subtitle')}
          </p>
          <p 
            className="text-xl text-muted-foreground max-w-2xl mx-auto" 
            dangerouslySetInnerHTML={{
              __html: showWaitlist
                ? t("home.hero.descriptionWaitlist")
                : t("home.hero.description", HOME_COUNTS),
            }}
          />
          <div className="flex gap-4 justify-center pt-4">
            {!isAuthenticated ? (
              <>
                {showWaitlist && (
                  <Button 
                    size="lg" 
                    className="bg-primary hover:bg-primary/90 text-lg px-8"
                    onClick={() => setIsWaitlistModalOpen(true)}
                  >
                    Join Waitlist
                  </Button>
                )}
                <Link href="/sign-in">
                  <Button 
                    size="lg" 
                    variant={showWaitlist ? "outline" : "default"}
                    className={showWaitlist ? "text-lg px-8 border-primary text-primary hover:bg-primary/10" : "bg-primary hover:bg-primary/90 text-lg px-8"}
                  >
                    {t('home.header.login')}
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 text-lg px-8"
                >
                  {t('home.header.dashboard')}
                </Button>
              </Link>
            )}
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <a href="#units">{t('home.hero.ctaSecondary')}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full bg-white/50">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.structuredPlan.title')}</CardTitle>
              <CardDescription>
                {showWaitlist
                  ? t("home.features.structuredPlan.descWaitlist")
                  : t("home.features.structuredPlan.desc", HOME_COUNTS)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Brain className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.aiProfessor.title')}</CardTitle>
              <CardDescription>
                {t('home.features.aiProfessor.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Trophy className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.gamification.title')}</CardTitle>
              <CardDescription>
                {t('home.features.gamification.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.progress.title')}</CardTitle>
              <CardDescription>
                {t('home.features.progress.desc')}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>{t('home.features.vocabulary.title')}</CardTitle>
              <CardDescription>
                {showWaitlist
                  ? t("home.features.vocabulary.descWaitlist")
                  : t("home.features.vocabulary.desc", HOME_COUNTS)}
              </CardDescription>
            </CardHeader>
          </Card>
          </div>
        </div>
      </section>

      {/* Pricing, Upgrade Policy & FAQ Section */}
      {/* Flexible Duration Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h3 className="text-4xl font-bold">{t('home.pricing.title')}</h3>
            <p 
              className="text-xl text-muted-foreground" 
              dangerouslySetInnerHTML={{ __html: t('home.pricing.subtitle') }}
            />
          </div>
          
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {/* Intensive Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-left pb-4">
                <Sparkles className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.intensive.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.intensive.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.intensive.audience')}</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">{t('home.pricing.intensive.price')}</div>
                  <div className="text-xs text-muted-foreground">{t('home.pricing.intensive.payment')}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.intensive.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.intensive.feature5')}</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  {t('home.pricing.choosePlan')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
              </CardContent>
            </Card>

            {/* Balanced Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-left pb-4">
                <Target className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.balanced.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.balanced.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.balanced.audience')}</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">{t('home.pricing.balanced.price')}</div>
                  <div className="text-xs text-muted-foreground">{t('home.pricing.balanced.payment')}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.balanced.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.balanced.feature5')}</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  {t('home.pricing.choosePlan')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
              </CardContent>
            </Card>

            {/* Standard Plan (Most Popular - Best Value) */}
            <Card className="border-4 border-primary shadow-2xl scale-105 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">{t('home.pricing.standard.badge')}</span>
              </div>
              <CardHeader className="text-left pb-4 pt-8">
                <BookOpen className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.standard.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.standard.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.standard.audience')}</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">{t('home.pricing.standard.price')}</div>
                  <div className="text-xs text-muted-foreground">{t('home.pricing.standard.payment')}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.standard.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.standard.feature5')}</span>
                  </li>
                </ul>
                <Button className="w-full bg-primary" disabled>
                  {t('home.pricing.choosePlan')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
              </CardContent>
            </Card>

            {/* Relaxed Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-left pb-4">
                <Clock className="h-12 w-12 text-primary mb-3" />
                <CardTitle className="text-2xl mb-2">{t('home.pricing.relaxed.title')}</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">{t('home.pricing.relaxed.duration')}</CardDescription>
                <p className="text-xs text-muted-foreground italic">{t('home.pricing.relaxed.audience')}</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">{t('home.pricing.relaxed.price')}</div>
                  <div className="text-xs text-muted-foreground">{t('home.pricing.relaxed.payment')}</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-left">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature3')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>
                      {showWaitlist
                        ? t("home.pricing.feature4Waitlist")
                        : t("home.pricing.relaxed.feature4", HOME_COUNTS)}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>{t('home.pricing.relaxed.feature5')}</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  {t('home.pricing.choosePlan')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('home.pricing.availableAfterLaunch')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Policy Section */}
          <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <div className="text-center space-y-4">
              <div className="inline-block p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900">{t('home.pricing.upgrade.title')}</h4>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                {t('home.pricing.upgrade.subtitle')}
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8 text-left">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature1.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature1.desc')}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature2.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature2.desc')}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">{t('home.pricing.upgrade.feature3.title')}</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    {t('home.pricing.upgrade.feature3.desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing FAQ Section */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block p-3 bg-primary/10 rounded-full mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">{t('home.faq.title')}</h3>
              <p className="text-lg text-gray-600">{t('home.faq.subtitle')}</p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {/* Q1: Can I upgrade? */}
              <AccordionItem value="item-1" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('home.faq.q1.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    {t('home.faq.q1.answer')}
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q1.keyPoints')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q1.point1')}</li>
                      <li>{t('home.faq.q1.point2')}</li>
                      <li>{t('home.faq.q1.point3')}</li>
                      <li>{t('home.faq.q1.point4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q2: Can I downgrade? */}
              <AccordionItem value="item-2" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    {t('home.faq.q2.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    {t('home.faq.q2.answer')}
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q2.why')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q2.reason1')}</li>
                      <li>{t('home.faq.q2.reason2')}</li>
                      <li>{t('home.faq.q2.reason3')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q3: What if I don't finish in time? */}
              <AccordionItem value="item-3" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    {t('home.faq.q3.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    {t('home.faq.q3.answer')}
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q3.options')}</p>
                    <ul className="space-y-1 text-sm">
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option1') }} />
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option2') }} />
                      <li dangerouslySetInnerHTML={{ __html: t('home.faq.q3.option3') }} />
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q4: Subscription or one-time? */}
              <AccordionItem value="item-4" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {t('home.faq.q4.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p
                    dangerouslySetInnerHTML={{
                      __html: showWaitlist
                        ? t("home.faq.q4.answerWaitlist")
                        : t("home.faq.q4.answer", HOME_COUNTS),
                    }}
                  />
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check1')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check2')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> {t('home.faq.q4.check3')}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q5: Same content? */}
              <AccordionItem value="item-5" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    {t('home.faq.q5.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">
                    {t('home.faq.q5.answer')}
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>
                        {showWaitlist
                          ? t("home.faq.q5.item1Waitlist")
                          : t("home.faq.q5.item1", HOME_COUNTS)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>
                        {showWaitlist
                          ? t("home.faq.q5.item2Waitlist")
                          : t("home.faq.q5.item2", HOME_COUNTS)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item3')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item4')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item5')}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>{t('home.faq.q5.item6')}</span>
                    </div>
                  </div>
                  <p className="mt-4 font-semibold text-gray-900">
                    {t('home.faq.q5.note')}
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Q6: Refund policy */}
              <AccordionItem value="item-6" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    {t('home.faq.q6.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q6.answer') }} />
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q6.policy')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q6.rule1')}</li>
                      <li>{t('home.faq.q6.rule2')}</li>
                      <li>{t('home.faq.q6.rule3')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q7: After expiration */}
              <AccordionItem value="item-7" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    {t('home.faq.q7.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q7.answer') }} />
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q7.after')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q7.point1')}</li>
                      <li>{t('home.faq.q7.point2')}</li>
                      <li>{t('home.faq.q7.point3')}</li>
                      <li>{t('home.faq.q7.point4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q8: Which plan? */}
              <AccordionItem value="item-8" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    {t('home.faq.q8.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-4">{t('home.faq.q8.intro')}</p>
                  <div className="space-y-3">
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.intensive.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.intensive.desc')}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.balanced.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.balanced.desc')}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border-2 border-primary">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.standard.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.standard.desc')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">{t('home.faq.q8.relaxed.title')}</p>
                      <p className="text-sm">{t('home.faq.q8.relaxed.desc')}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm italic" dangerouslySetInnerHTML={{ __html: t('home.faq.q8.note') }} />
                </AccordionContent>
              </AccordionItem>

              {/* Q9: Beta discount */}
              <AccordionItem value="item-9" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t('home.faq.q9.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p dangerouslySetInnerHTML={{ __html: t('home.faq.q9.answer') }} />
                  <div className="bg-yellow-50 p-4 rounded-lg mt-3 border-2 border-yellow-200">
                    <p className="font-semibold text-gray-900 mb-2">{t('home.faq.q9.benefits')}</p>
                    <ul className="space-y-1 text-sm">
                      <li>{t('home.faq.q9.benefit1')}</li>
                      <li>{t('home.faq.q9.benefit2')}</li>
                      <li>{t('home.faq.q9.benefit3')}</li>
                      <li>{t('home.faq.q9.benefit4')}</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q10: How to upgrade */}
              <AccordionItem value="item-10" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    {t('home.faq.q10.question')}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">{t('home.faq.q10.intro')}</p>
                  <ol className="space-y-2 ml-4">
                    <li>{t('home.faq.q10.step1')}</li>
                    <li>{t('home.faq.q10.step2')}</li>
                    <li>{t('home.faq.q10.step3')}</li>
                    <li>{t('home.faq.q10.step4')}</li>
                    <li>{t('home.faq.q10.step5')}</li>
                  </ol>
                  <p className="mt-4">
                    {t('home.faq.q10.note')}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </div>

          {/* Beta Tester Banner */}
          {!showWaitlist && (
            <Card className="mt-12 border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-2xl">
              <CardContent className="py-8">
                <div className="text-center space-y-4">
                  <div className="inline-block">
                    <span className="text-5xl">🎁</span>
                  </div>
                  <h4 className="text-3xl font-bold text-yellow-900">{t('home.beta.banner.title')}</h4>
                  <p 
                    className="text-lg text-yellow-800 max-w-3xl mx-auto" 
                    dangerouslySetInnerHTML={{ __html: t('home.beta.banner.subtitle') }}
                  />
                  <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-6">
                    <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                      <div className="text-2xl mb-2">✓</div>
                      <h5 className="font-semibold text-yellow-900 mb-1">{t('home.beta.banner.feature1.title')}</h5>
                      <p className="text-sm text-yellow-800">{t('home.beta.banner.feature1.desc')}</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                      <div className="text-2xl mb-2">💰</div>
                      <h5 className="font-semibold text-yellow-900 mb-1">{t('home.beta.banner.feature2.title')}</h5>
                      <p className="text-sm text-yellow-800">{t('home.beta.banner.feature2.desc')}</p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <a href="#beta-registration">
                      <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg px-8">
                        {t('home.beta.banner.cta')}
                      </Button>
                    </a>
                  </div>
                  <p className="text-xs text-yellow-700">{t('home.beta.banner.note')}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Modules Section */}
      <section id="units" className="w-full bg-gradient-to-br from-red-50 via-blue-50/30 to-white">
        <div className="container py-20">
          <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h3 className="text-4xl font-bold">{t('home.units.title')}</h3>
            <p 
              className="text-xl text-muted-foreground" 
              dangerouslySetInnerHTML={{
                __html: showWaitlist
                  ? t("home.units.subtitleWaitlist")
                  : t("home.units.subtitle", HOME_COUNTS),
              }}
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES_DATA.map((module) => {
              // BETA: Always use English
              const displayTitle = module.titleEnglish;
              const displayDescription = module.description;
              
              return (
              <Card 
                key={module.id} 
                className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-xl hover:scale-105 bg-white"
              >
                <CardHeader>
                  <div className="flex-1">
                      <div className="text-sm font-semibold text-primary mb-1">
                        {t('home.units.module', { number: module.number })}
                      </div>
                      <CardTitle className="text-lg">{displayTitle}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{displayDescription}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span>
                        {showWaitlist
                          ? t("home.units.lessonsPlaceholder")
                          : t("home.units.lessons", { count: module.unitCount })}
                      </span>
                    </div>
                    {!showWaitlist && (
                      <div className="text-xs text-muted-foreground">
                        {module.vocabCount}+ vocabulary words
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
          </div>
        </div>
      </section>

      {/* Beta Registration / Sign Up Section - Only show if not in waitlist mode OR user is superadmin */}
      {showBetaRegistration && (
        <section id="beta-registration" className="container py-20">
          <Card className="max-w-2xl mx-auto border-2 border-secondary shadow-2xl shadow-blue-200">
            <CardHeader className="text-center bg-gradient-to-r from-red-50 via-white to-blue-50">
              <div className="inline-block px-4 py-2 bg-accent/30 rounded-full text-primary font-bold mb-4 border-2 border-accent">
                {t('home.beta.discount')}
              </div>
              <CardTitle className="text-3xl">
                {t('home.beta.title')}
              </CardTitle>
              <CardDescription className="text-lg">
                {t('home.beta.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {!isAuthenticated ? (
                <div className="space-y-4 flex flex-col items-center">
                  <SignUp
                    routing="virtual"
                    signInUrl="/sign-in"
                  />
                  <p className="text-sm text-center text-muted-foreground max-w-xl">
                    {t('home.beta.signupNote')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-semibold">
                    {t('home.beta.authenticated')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('home.beta.authenticatedDesc')}
                  </p>
                  <Link href="/dashboard">
                    <Button className="bg-primary hover:bg-primary/90 text-lg">
                      {t('home.beta.dashboard')}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Footer */}
      <footer className="w-full border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50">
        <div className="container py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold">© Developed by JACKSENN.ME 2025</p>
          </div>
        </div>
      </footer>

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={isWaitlistModalOpen} 
        onClose={() => setIsWaitlistModalOpen(false)} 
      />
    </div>
  );
}
