import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";

import { VOCABULARY, type VocabWord } from "@shared/vocabularyData";
import { Sidebar } from "@/components/Sidebar";

export default function Vocabulary() {
  const { user } = useAuth();
  const { data: progress } = trpc.progress.get.useQuery();
  const [location] = useLocation();
  
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [selectedUnit, setSelectedUnit] = useState<number | 'all'>('all');
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const utils = trpc.useUtils();
  const updateUserXP = trpc.user.addXP.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
    },
  });

  const handleQuizComplete = async () => {
    const earnedXP = calculateXP(score.correct, score.total);
    setXpEarned(earnedXP);
    if (user) {
      try {
        await updateUserXP.mutateAsync({ xp: earnedXP });
      } catch (error) {
        console.error('Failed to update XP:', error);
      }
    }
  };

  // Read unit parameter from URL and set it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unitParam = params.get('unit');
    if (unitParam) {
      const unitNum = parseInt(unitParam);
      if (!isNaN(unitNum) && unitNum >= 1 && unitNum <= 27) {
        setSelectedUnit(unitNum);
        setCurrentIndex(0); // Reset to first word
      }
    }
  }, [location]);

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter vocabulary by unit
  const filteredVocab = selectedUnit === 'all' 
    ? VOCABULARY 
    : VOCABULARY.filter(v => v.unit === selectedUnit);

  const currentWord = filteredVocab[currentIndex];
  const progressPercent = ((currentIndex + 1) / filteredVocab.length) * 100;

  const handleNext = () => {
    if (currentIndex < filteredVocab.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
    }
  };

  const handleSubmitAnswer = () => {
    if (!userAnswer.trim()) return;
    
    const userAnswerLower = userAnswer.trim().toLowerCase();
    const englishLower = currentWord.english.toLowerCase();
    const matchesAlternative = (currentWord.alternatives && currentWord.alternatives.some(alt => userAnswerLower === alt.toLowerCase())) || false;
    const correct = userAnswerLower === englishLower || matchesAlternative;
    
    setIsCorrect(correct);
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1 });
    setShowAnswer(true);
    
    setTimeout(() => {
      handleNext();
    }, 2000);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setScore({ correct: 0, total: 0 });
    setUserAnswer('');
    setIsCorrect(null);
    setXpEarned(0);
  };

  const calculateXP = (correct: number, total: number): number => {
    const percentage = (correct / total) * 100;
    if (percentage === 100) return total * 10;
    if (percentage >= 80) return Math.floor(total * 8);
    if (percentage >= 60) return Math.floor(total * 5);
    if (percentage >= 40) return Math.floor(total * 3);
    return Math.floor(total * 1);
  };

  const completedUnits = progress?.completedUnits || [];

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
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Vocabulary Practice</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Mode Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Mode</CardTitle>
              <CardDescription>Choose how you want to practice vocabulary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant={mode === 'learn' ? 'default' : 'outline'}
                  onClick={() => { setMode('learn'); handleReset(); }}
                  className="flex-1"
                >
                  📚 Learn Mode
                </Button>
                <Button
                  variant={mode === 'quiz' ? 'default' : 'outline'}
                  onClick={() => { setMode('quiz'); handleReset(); }}
                  className="flex-1"
                >
                  🎯 Quiz Mode
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Unit Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Filter by Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedUnit === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setSelectedUnit('all'); handleReset(); }}
                >
                  All Units
                </Button>
                {[1, 2, 3].map(unit => (
                  <Button
                    key={unit}
                    variant={selectedUnit === unit ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setSelectedUnit(unit); handleReset(); }}
                    disabled={!completedUnits.includes(unit)}
                  >
                    Unit {unit}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{currentIndex + 1} / {filteredVocab.length}</span>
                </div>
                <Progress value={progressPercent} />
                {mode === 'quiz' && score.total > 0 && (
                  <div className="text-sm text-muted-foreground text-center">
                    Score: {score.correct} / {score.total} ({Math.round((score.correct / score.total) * 100)}%)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Flashcard */}
          {currentWord && (
            <Card className="min-h-[400px] flex flex-col justify-center">
              <CardContent className="text-center space-y-8 py-12">
                <div>
                  <Badge variant="outline" className="mb-4">
                    Unit {currentWord.unit}
                  </Badge>
                  <h2 className="text-5xl font-bold mb-2">
                    {currentWord.serbian}
                  </h2>
                  {(mode === 'learn' || showAnswer) && (
                    <p className="text-2xl text-muted-foreground mt-4">
                      {currentWord.english}
                    </p>
                  )}
                </div>

                {mode === 'learn' ? (
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                    >
                      ← Previous
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={currentIndex === filteredVocab.length - 1}
                    >
                      Next →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-md mx-auto w-full">
                    {!showAnswer ? (
                      <>
                        <div className="text-sm text-muted-foreground mb-2">
                          Type the English translation:
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Your answer..."
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSubmitAnswer()}
                            disabled={showAnswer}
                            className="text-lg"
                            autoFocus
                          />
                          <Button
                            onClick={handleSubmitAnswer}
                            disabled={!userAnswer.trim()}
                            size="lg"
                          >
                            Submit
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg border-2 ${
                          isCorrect 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center justify-center gap-2 mb-2">
                            {isCorrect ? (
                              <>
                                <CheckCircle className="h-6 w-6 text-green-600" />
                                <span className="text-lg font-semibold text-green-600">Correct!</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-6 w-6 text-red-600" />
                                <span className="text-lg font-semibold text-red-600">Incorrect</span>
                              </>
                            )}
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Your answer:</div>
                            <div className="font-medium">{userAnswer}</div>
                            {!isCorrect && (
                              <>
                                <div className="text-sm text-muted-foreground mt-2">Correct answer:</div>
                                <div className="font-medium text-green-600">{currentWord.english}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completed */}
          {currentIndex === filteredVocab.length - 1 && showAnswer && mode === 'quiz' && (
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-center">🎉 Quiz Completed!</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-2xl font-bold">
                  Final Score: {score.correct} / {score.total} ({Math.round((score.correct / score.total) * 100)}%)
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-2">Experience Points Earned:</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    +{xpEarned === 0 ? calculateXP(score.correct, score.total) : xpEarned} XP
                  </p>
                </div>
                <div className="flex gap-4 justify-center">
                  <Button onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="outline">
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Back to Dashboard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Study Tips */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Vocabulary Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>📖 Practice daily for best results</li>
                <li>🗣️ Say the words out loud to improve pronunciation</li>
                <li>✍️ Write down words you find difficult</li>
                <li>🔁 Use spaced repetition - review older units regularly</li>
                <li>💬 Try using new words in the AI Learn Buddy chat</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </div>
  );
}
