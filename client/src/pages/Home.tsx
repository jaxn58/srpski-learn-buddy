import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles, Check } from "lucide-react";
import { Link } from "wouter";
import { UNITS_DATA, TOTAL_VOCABULARY } from "@/data/unitsForLanding";
import { useState } from "react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [betaForm, setBetaForm] = useState({ name: "", email: "", motivation: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registerMutation = trpc.beta.register.useMutation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleBetaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!betaForm.name || !betaForm.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await registerMutation.mutateAsync({
        name: betaForm.name,
        email: betaForm.email,
        motivation: betaForm.motivation,
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
    } catch (error) {
      toast.error("Registration failed. Please try again.");
      setIsSubmitting(false);
    }
  };

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
            <Button asChild className="bg-primary hover:bg-primary/90">
              <a href={getLoginUrl()}>Login</a>
            </Button>
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
            Use AI to help.
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A structured course with <strong>27 units</strong> and <strong>{TOTAL_VOCABULARY}+ vocabulary words</strong> – featuring interactive exercises, vocabulary training, and AI-powered learning support.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90 text-lg px-8">
              <a href="#beta-register">Register for Beta – Gratis*</a>
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
              <CardTitle>AI Learning Assistant</CardTitle>
              <CardDescription>
                Ask questions about any unit to reinforce and review what you've learned
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
                <CardDescription className="text-base font-semibold">3 Months</CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€39</div>
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
                    <span>Daily practice</span>
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
                    <span>AI Professor</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>

            {/* Balanced Plan (Most Popular) */}
            <Card className="border-4 border-primary shadow-2xl scale-105 relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-semibold">Most Popular</span>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <Target className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Balanced</CardTitle>
                <CardDescription className="text-base font-semibold">6 Months</CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€69</div>
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
                    <span>Steady pace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Expert recommended</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Professor</span>
                  </li>
                </ul>
                <Button className="w-full bg-primary" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>

            {/* Standard Plan (New 9-Month) */}
            <Card className="border-2 hover:border-primary transition-all hover:shadow-xl relative">
              <CardHeader className="text-center pb-4">
                <BookOpen className="h-12 w-12 text-primary mb-3 mx-auto" />
                <CardTitle className="text-2xl mb-2">Standard</CardTitle>
                <CardDescription className="text-base font-semibold">9 Months</CardDescription>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-primary">€89</div>
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
                    <span>Comfortable pace</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>Best value</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Professor</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
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
                <CardDescription className="text-base font-semibold">12 Months</CardDescription>
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
                    <span>Learn when you can</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>No pressure</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>All 27 units</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                    <span>AI Professor</span>
                  </li>
                </ul>
                <Button className="w-full" disabled>
                  Choose Plan
                </Button>
                <p className="text-xs text-center text-muted-foreground">Available after launch</p>
              </CardContent>
            </Card>
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

