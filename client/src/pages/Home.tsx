import { useAuth } from "@/_core/hooks/useAuth";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles, Check, HelpCircle, DollarSign, RefreshCw, Shield, Calendar, Zap, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { getUnitsForLanding, getTotalVocabularyCount, VOCABULARY } from "@shared/data";
import { useState, useCallback } from "react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [betaForm, setBetaForm] = useState({ name: "", email: "", motivation: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registerMutation = useMutation(api.beta.register);
  
  // Generate units data for landing page
  const UNITS_DATA = getUnitsForLanding(VOCABULARY);
  const TOTAL_VOCABULARY = getTotalVocabularyCount(VOCABULARY);

  const handleBetaSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!betaForm.name || !betaForm.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await registerMutation({
        name: betaForm.name,
        email: betaForm.email,
        motivation: betaForm.motivation || undefined,
      });
      
      toast.success("🎉 Registration successful! Check your email for confirmation.", {
        description: "We've sent you a confirmation email. You'll receive another email once your account is activated.",
        duration: 5000,
      });
      
      // Reset form
      setBetaForm({ name: "", email: "", motivation: "" });
      setIsSubmitting(false);
      
      // Scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Registration failed. Please try again.";
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  }, [betaForm, registerMutation]);

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
      <header className="container py-6 border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Serbian AI Tutor
            </h1>
          </div>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button className="bg-primary hover:bg-primary/90">Go to Dashboard</Button>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button className="bg-primary hover:bg-primary/90">
                Login
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-block px-4 py-2 bg-accent/20 rounded-full text-primary font-semibold mb-4 border border-accent/40">
            🔥 Now in Beta Testing – Gratis*
          </div>
          <h2 className="text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Serbian for Beginners.
            </span>
            <br />
            With your AI Learn Buddy.
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A structured course with <strong>27 units</strong> and <strong>{TOTAL_VOCABULARY}+ vocabulary words</strong> – featuring interactive exercises, vocabulary training, and AI-powered learning support.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-lg px-8"
              onClick={() => {
                document.getElementById('beta-registration')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Register for Beta – Gratis*
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <a href="#units">Explore Units</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 bg-white/50">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Structured Plan</CardTitle>
              <CardDescription>
                Structured learning path through all 27 lessons of the course
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Brain className="h-12 w-12 text-primary mb-2" />
              <CardTitle>AI Learn Buddy</CardTitle>
              <CardDescription>
                Your personal AI tutor answers questions, explains grammar, provides conversation practice, and adapts to your learning style
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <Trophy className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Gamification & Rewards</CardTitle>
              <CardDescription>
                Earn XP, unlock badges, and maintain streaks to stay motivated
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Progress Tracking</CardTitle>
              <CardDescription>
                See your achievements and stay motivated with clear milestones
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-lg">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-primary mb-2" />
              <CardTitle>Vocabulary Trainer</CardTitle>
              <CardDescription>
                Master 737+ words with interactive flashcards and spaced repetition
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Flexible Duration Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h3 className="text-4xl font-bold">Learn at Your Own Pace</h3>
            <p className="text-xl text-muted-foreground">
              Choose your learning speed – from <strong>3 months intensive</strong> to <strong>12 months relaxed</strong>
            </p>
          </div>
          
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-4 gap-6 mt-12">
            {/* Intensive Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-center pb-4">
                <Sparkles className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Intensive</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">3 Months</CardDescription>
                <p className="text-xs text-muted-foreground italic">Full-time learners with 12+ hours/week</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€69</div>
                  <div className="text-xs text-muted-foreground">one-time payment</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>2-3 units/week</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Intensive immersion</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Fast progress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Learn Buddy</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>

            {/* Balanced Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-center pb-4">
                <Target className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Balanced</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">6 Months</CardDescription>
                <p className="text-xs text-muted-foreground italic">Working professionals with 6-8 hours/week</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€79</div>
                  <div className="text-xs text-muted-foreground">one-time payment</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>1 unit/week</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Perfect alongside job</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Structured progress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Learn Buddy</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>

            {/* Standard Plan (Most Popular - Best Value) */}
            <Card className="border-4 border-primary shadow-2xl scale-105 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">Most Popular</span>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <BookOpen className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Standard</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">9 Months</CardDescription>
                <p className="text-xs text-muted-foreground italic">Relaxed learning with 4-5 hours/week</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€95</div>
                  <div className="text-xs text-muted-foreground">one-time payment</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>2-3 units/month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Time to review & deepen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Best value for money</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Learn Buddy</span>
                  </li>
                </ul>
                <Button className="w-full bg-primary" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>

            {/* Relaxed Plan */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-center pb-4">
                <Clock className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Relaxed</CardTitle>
                <CardDescription className="text-base font-semibold mb-2">12 Months</CardDescription>
                <p className="text-xs text-muted-foreground italic">Learn on the side with 3-4 hours/week</p>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€119</div>
                  <div className="text-xs text-muted-foreground">one-time payment</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Flexible schedule</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Learn & apply in real life</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>No stress, no pressure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Learn Buddy</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Policy Section */}
          <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
            <div className="text-center space-y-4">
              <div className="inline-block p-3 bg-primary/10 rounded-full">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900">Need More Time? No Problem!</h4>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                Upgrade to a longer plan anytime - you only pay the difference. Fair, transparent, no surprises.
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-8 text-left">
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">Pay Only the Difference</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    If you bought Intensive (€69) and want to switch to Balanced (€79), you only pay €10 extra.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">Maximum Cost: €50</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    Even upgrading from Intensive to Relaxed on day 1 costs only €50 - never more than the price difference.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md">
                  <div className="flex items-center gap-3 mb-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <h5 className="font-bold text-gray-900">Instant Activation</h5>
                  </div>
                  <p className="text-sm text-gray-600">
                    Upgrade anytime, keep all your progress, and continue learning without interruption.
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
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h3>
              <p className="text-lg text-gray-600">Everything you need to know about our flexible pricing and upgrade options</p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {/* Q1: Can I upgrade? */}
              <AccordionItem value="item-1" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Can I upgrade to a longer plan later?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    Yes! You can upgrade to a longer plan anytime. You'll only pay the difference between your current plan and the new one. 
                    For example, if you purchased Intensive (€69) and want to upgrade to Balanced (€79), you only pay €10 extra. 
                    Your progress is preserved, and the upgrade takes effect immediately.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">Key Points:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Pay only the price difference</li>
                      <li>• Maximum upgrade cost: €50 (Intensive → Relaxed)</li>
                      <li>• Instant activation, no waiting</li>
                      <li>• All progress and achievements preserved</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q2: Can I downgrade? */}
              <AccordionItem value="item-2" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-primary" />
                    Can I downgrade to a shorter plan?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    No, downgrades are not available. Once you purchase a plan, you have access for the full duration. 
                    However, you can always learn at your own pace—there's no requirement to finish within the time frame. 
                    If you complete the course early, you'll still have access until your plan expires, giving you time to review and practice.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">Why no downgrades?</p>
                    <ul className="space-y-1 text-sm">
                      <li>• One-time payment model (not subscription)</li>
                      <li>• Full course access from day one</li>
                      <li>• Flexible learning pace within your timeframe</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q3: What if I don't finish in time? */}
              <AccordionItem value="item-3" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    What happens if I don't finish in time?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-3">
                  <p>
                    No problem! If you need more time, you can extend your access by upgrading to a longer plan. You'll only pay the difference. 
                    For example, if you have 2 months left on your Balanced plan (€79) and want to extend to Standard (€95), you pay €16 for 3 additional months. 
                    Alternatively, you can repurchase any plan at the standard price.
                  </p>
                  <div className="bg-green-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">Your options:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>Upgrade:</strong> Pay only the difference for more time</li>
                      <li>• <strong>Repurchase:</strong> Buy any plan again at full price</li>
                      <li>• <strong>Pause & Resume:</strong> Your progress is saved permanently</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q4: Subscription or one-time? */}
              <AccordionItem value="item-4" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Is this a subscription or one-time payment?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    It's a <strong>one-time payment</strong>. You pay once and get full access to all 27 units for your chosen duration (3, 6, 9, or 12 months). 
                    There are no recurring charges, no hidden fees, and no automatic renewals. After your access period ends, you can choose to repurchase if you want to continue learning.
                  </p>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> No surprise charges
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> Cancel-free
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <Check className="h-4 w-4" /> Transparent pricing
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q5: Same content? */}
              <AccordionItem value="item-5" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Do all plans include the same content?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">
                    Yes! All four plans (Intensive, Balanced, Standard, Relaxed) include the exact same content:
                  </p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>All 27 units with comprehensive lessons</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>737+ vocabulary words with flashcard trainer</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>Interactive exercises with instant feedback</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>AI Learn Buddy for questions and practice</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>Gamification: XP, badges, and streaks</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      <span>Progress tracking and achievements</span>
                    </div>
                  </div>
                  <p className="mt-4 font-semibold text-gray-900">
                    The only difference is the duration (how long you have access). Choose based on how much time you have per week to study.
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Q6: Refund policy */}
              <AccordionItem value="item-6" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    Can I get a refund?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    We offer a <strong>14-day money-back guarantee</strong>. If you're not satisfied with the course within the first 14 days, 
                    contact us for a full refund—no questions asked. After 14 days, refunds are not available, but you can upgrade to a longer plan anytime if you need more time.
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">Refund policy:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Full refund within 14 days of purchase</li>
                      <li>• No refunds after 14 days</li>
                      <li>• Upgrades available anytime (pay the difference)</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q7: After expiration */}
              <AccordionItem value="item-7" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    What happens after my plan expires?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    After your plan expires, you'll lose access to the course content, but <strong>your progress is saved permanently</strong>. 
                    If you repurchase any plan later, you'll pick up exactly where you left off—all completed units, XP, badges, and vocabulary progress will be restored.
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mt-3">
                    <p className="font-semibold text-gray-900 mb-2">After expiration:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Access to course content ends</li>
                      <li>• Progress saved in your account</li>
                      <li>• Repurchase anytime to continue</li>
                      <li>• All achievements and XP preserved</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q8: Which plan? */}
              <AccordionItem value="item-8" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    Which plan is right for me?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-4">Choose based on how much time you can dedicate per week:</p>
                  <div className="space-y-3">
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">Intensive (3 months, €69)</p>
                      <p className="text-sm">12+ hours/week — Best for full-time learners or those with an upcoming trip</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border-2 border-primary">
                      <p className="font-semibold text-gray-900">Balanced (6 months, €79) ⭐ Recommended</p>
                      <p className="text-sm">6-8 hours/week — Perfect for working professionals</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">Standard (9 months, €95)</p>
                      <p className="text-sm">4-5 hours/week — Best value per month (€10.56/month)</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="font-semibold text-gray-900">Relaxed (12 months, €119)</p>
                      <p className="text-sm">3-4 hours/week — Maximum flexibility, lowest monthly cost (€9.92/month)</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm italic">Not sure? Start with <strong>Balanced</strong>—it's our most popular plan and offers the best balance of time and value.</p>
                </AccordionContent>
              </AccordionItem>

              {/* Q9: Beta discount */}
              <AccordionItem value="item-9" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Do beta testers get a discount?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p>
                    Yes! Beta testers who register during the testing phase get <strong>50% OFF</strong> when the full course launches. 
                    During beta, you have free access to Units 1-5. When we launch, you can purchase any plan at half price. 
                    This is our way of saying thank you for helping us improve the course!
                  </p>
                  <div className="bg-yellow-50 p-4 rounded-lg mt-3 border-2 border-yellow-200">
                    <p className="font-semibold text-gray-900 mb-2">🎁 Beta benefits:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• Free access to Units 1-5 during beta</li>
                      <li>• 50% OFF any plan at launch</li>
                      <li>• Early access to new features</li>
                      <li>• Direct input on course development</li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Q10: How to upgrade */}
              <AccordionItem value="item-10" className="bg-white rounded-xl shadow-md border-2 border-gray-100 px-6">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-primary">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-primary" />
                    How do I upgrade my plan?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-700">
                  <p className="mb-3">Upgrading is simple:</p>
                  <ol className="space-y-2 ml-4">
                    <li>1. Go to your Dashboard</li>
                    <li>2. Click "My Subscription" or "Upgrade Plan"</li>
                    <li>3. Select your new plan</li>
                    <li>4. Pay only the difference (e.g., €10 to go from Intensive to Balanced)</li>
                    <li>5. Your access is extended immediately</li>
                  </ol>
                  <p className="mt-4">
                    Your progress, XP, badges, and completed units are automatically preserved. You can upgrade as many times as you want—the maximum you'll ever pay is €50 (from Intensive to Relaxed).
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </div>

          {/* Beta Tester Banner */}
          <Card className="mt-12 border-4 border-yellow-400 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-2xl">
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <div className="inline-block">
                  <span className="text-5xl">🎁</span>
                </div>
                <h4 className="text-3xl font-bold text-yellow-900">Get 50% OFF at Launch!</h4>
                <p className="text-lg text-yellow-800 max-w-3xl mx-auto">
                  Help shape the future of Serbian learning! Join our <strong>Beta Testing Program</strong> and get <strong>early access to Units 1-5</strong> for free, 
                  plus <strong>50% discount</strong> on your chosen plan when we launch.
                </p>
                <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-6">
                  <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                    <div className="text-2xl mb-2">✓</div>
                    <h5 className="font-semibold text-yellow-900 mb-1">Free Units 1-5</h5>
                    <p className="text-sm text-yellow-800">Test the full course experience with no commitment</p>
                  </div>
                  <div className="bg-white/80 rounded-lg p-4 border-2 border-yellow-300">
                    <div className="text-2xl mb-2">💰</div>
                    <h5 className="font-semibold text-yellow-900 mb-1">50% Launch Discount</h5>
                    <p className="text-sm text-yellow-800">Lock in your discount when the full course launches</p>
                  </div>
                </div>
                <div className="pt-4">
                  <a href="#beta-registration">
                    <Button size="lg" className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg px-8">
                      Register for Beta Test
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-yellow-700">No registration, no credit card required. Just test and send us feedback!</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* All 27 Units Section */}
      <section id="units" className="container py-20 bg-gradient-to-br from-red-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h3 className="text-4xl font-bold">Complete Course Overview</h3>
            <p className="text-xl text-muted-foreground">
              All <strong>27 units</strong> with <strong>{TOTAL_VOCABULARY}+ vocabulary words</strong>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {UNITS_DATA.map((unit) => (
              <Card 
                key={unit.number} 
                className="border-2 hover:border-secondary hover:shadow-blue-200 transition-all hover:shadow-xl hover:scale-105 bg-white"
              >
                <CardHeader>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-primary mb-1">Unit {unit.number}</div>
                    <CardTitle className="text-lg">{unit.titleEnglish}</CardTitle>
                    <p className="text-sm text-muted-foreground italic mt-1">{unit.title}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {unit.topics.map((topic, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-primary mr-2">•</span>
                        {topic}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Registration Form */}
      <section id="beta-registration" className="container py-20">
        <Card className="max-w-2xl mx-auto border-2 border-secondary shadow-2xl shadow-blue-200">
          <CardHeader className="text-center bg-gradient-to-r from-red-50 via-white to-blue-50">
            <div className="inline-block px-4 py-2 bg-accent/30 rounded-full text-primary font-bold mb-4 border-2 border-accent">
              🎁 Get 50% OFF at Launch!
            </div>
            <CardTitle className="text-3xl">
              Join the Beta Testing Program – Gratis*
            </CardTitle>
            <CardDescription className="text-lg">
              Help shape the future of Serbian learning and get early access to the first 5 units
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleBetaSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={betaForm.name}
                  onChange={(e) => setBetaForm({ ...betaForm, name: e.target.value })}


                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={betaForm.email}
                  onChange={(e) => setBetaForm({ ...betaForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivation">Why do you want to learn Serbian?</Label>
                <Textarea
                  id="motivation"
                  placeholder="Tell us about your motivation..."
                  value={betaForm.motivation}
                  onChange={(e) => setBetaForm({ ...betaForm, motivation: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 text-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Registering..." : "Register for Beta Test"}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                By registering, you'll be redirected to create your account. The admin will review and activate your access.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container py-8 border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50">
        <div className="text-center text-sm text-muted-foreground space-y-3">
          <p className="text-xs italic">
            * Gratis (Free) refers to the first 5 units of the course. Full access to all 27 units will be available with a paid subscription after the beta testing phase.
          </p>
          <p>
            Course structure inspired by proven language learning methodologies
          </p>
          <p className="font-semibold">© 2025 Serbian AI Tutor by jacksenn.me. Powered by Manus AI.</p>
        </div>
      </footer>
    </div>
  );
}
