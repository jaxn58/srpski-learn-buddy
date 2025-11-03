import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, Sparkles } from "lucide-react";
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
      
      toast.success("Registration successful! Redirecting to login...");
      
      // Redirect to login after successful registration
      setTimeout(() => {
        window.location.href = getLoginUrl();
      }, 1500);
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
            🔥 Now in Beta Testing
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
              <a href="#beta-register">Register for Beta</a>
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
          
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <Card className="border-2 hover:border-primary transition-all">
              <CardHeader>
                <Sparkles className="h-10 w-10 text-primary mb-2 mx-auto" />
                <CardTitle className="text-2xl">Intensive</CardTitle>
                <CardDescription className="text-lg">3 Months</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">2-3 units per week, daily practice, fast progress</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary shadow-lg scale-105">
              <CardHeader>
                <Target className="h-10 w-10 text-primary mb-2 mx-auto" />
                <CardTitle className="text-2xl">Balanced</CardTitle>
                <CardDescription className="text-lg">6 Months</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">1 unit per week, steady learning, recommended pace</p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-primary transition-all">
              <CardHeader>
                <Clock className="h-10 w-10 text-primary mb-2 mx-auto" />
                <CardTitle className="text-2xl">Relaxed</CardTitle>
                <CardDescription className="text-lg">12 Months</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Flexible schedule, learn when you can, no pressure</p>
              </CardContent>
            </Card>
          </div>
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
      <section id="beta-register" className="container py-20">
        <Card className="max-w-2xl mx-auto border-2 border-secondary shadow-2xl shadow-blue-200">
          <CardHeader className="text-center bg-gradient-to-r from-red-50 via-white to-blue-50">
            <div className="inline-block px-4 py-2 bg-accent/30 rounded-full text-primary font-bold mb-4 border-2 border-accent">
              🎁 Get 50% OFF at Launch!
            </div>
            <CardTitle className="text-3xl">
              Join the Beta Testing Program
            </CardTitle>
            <CardDescription className="text-lg">
              Help shape the future of Serbian learning and get early access
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
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Course structure inspired by proven language learning methodologies
          </p>
          <p className="font-semibold">© 2025 Serbian AI Tutor by jacksenn.me. Powered by Manus AI.</p>
        </div>
      </footer>
    </div>
  );
}

