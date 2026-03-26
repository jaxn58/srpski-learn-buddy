import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, X, Eye, RotateCcw, Star, HelpCircle } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface TranslationQuestion {
  id: string;
  prompt: string; // e.g., "Good day!"
  answer: string; // e.g., "Dobar dan!"
  acceptableAlternatives?: string[]; // e.g., ["Dobar dan", "dobar dan"]
}

export interface TranslationExerciseProps {
  title: string;
  instructions: string;
  questions: TranslationQuestion[];
  exerciseId: string;
  unitNumber: number;
}

type QuestionProgressDoc = Doc<"exerciseQuestionProgress">;

const normalizeAnswer = (value: string) =>
  value
    ?.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?;:'"()\[\]{}\-–—…¡¿]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const loadAwarded = (storageKey: string) => {
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(storageKey) : null;
    if (!raw) return new Set<string>();
    return new Set<string>(JSON.parse(raw));
  } catch {
    return new Set<string>();
  }
};

const persistAwarded = (storageKey: string, awarded: Set<string>) => {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(Array.from(awarded)));
  } catch {
    // ignore storage errors
  }
};

export function TranslationExercise({ title, instructions, questions, exerciseId, unitNumber }: TranslationExerciseProps) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [showSolutions, setShowSolutions] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [sessionXP, setSessionXP] = useState(0); // Track XP earned in this session (from questions)
  const storageKey = `awarded:${exerciseId}`;
  const [awardedQuestions, setAwardedQuestions] = useState<Set<string>>(() => loadAwarded(storageKey)); // prevent double XP per session
  const submitResultMutation = useMutation(api.exercises.submitResult);
  
  // Neue Hooks für Question Progress
  const recordQuestionAnswerMutation = useMutation(api.exercises.recordExerciseQuestionAnswer);
  const questionProgressData = useQuery(api.exercises.getExerciseQuestionProgress, { exerciseId }) as QuestionProgressDoc[] | undefined;
  
  // Optimistic updates für sofortiges Feedback
  const [optimisticProgress, setOptimisticProgress] = useState<Map<string, { correctAnswerCount: number; incorrectAnswerCount: number }>>(new Map());

  // Helper function um Progress für eine Frage zu bekommen
  const getQuestionProgress = (questionId: string) => {
    const optimistic = optimisticProgress.get(questionId);
    const dbProgress = questionProgressData?.find((p: QuestionProgressDoc) => p.questionId === `${exerciseId}-${questionId}`);
    
    if (optimistic) {
      return {
        correctAnswerCount: optimistic.correctAnswerCount,
        incorrectAnswerCount: optimistic.incorrectAnswerCount,
        mastered: optimistic.correctAnswerCount >= 3,
      };
    }
    
    if (dbProgress) {
      return {
        correctAnswerCount: dbProgress.correctAnswerCount,
        incorrectAnswerCount: dbProgress.incorrectAnswerCount,
        mastered: dbProgress.mastered,
      };
    }
    
    return null;
  };

  useEffect(() => {
    // Hydrate awarded questions on client to avoid SSR empty init
    setAwardedQuestions(loadAwarded(storageKey));
  }, [storageKey]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (checked[questionId] !== undefined) {
      setChecked(prev => ({ ...prev, [questionId]: null }));
    }
  };

  const checkAnswers = async () => {
    if (hasChecked) return; // prevent multiple checks without reset

    const newChecked: Record<string, boolean> = {};
    questions.forEach(q => {
      const userAnswer = normalizeAnswer(answers[q.id] || '');
      const correctAnswer = normalizeAnswer(q.answer);
      const alternatives = q.acceptableAlternatives?.map(a => normalizeAnswer(a)) || [];
      
      newChecked[q.id] = 
        userAnswer === correctAnswer || 
        alternatives.includes(userAnswer);
    });
    setChecked(newChecked);
    setHasChecked(true);

    // Track each question individually and collect XP
    let totalEarnedXP = 0;
    for (const question of questions) {
      const isCorrect = Boolean(newChecked[question.id]);
      const questionId = `${exerciseId}-${question.id}`;
      const alreadyAwarded = awardedQuestions.has(questionId);
      
      // Optimistic update (UI feedback)
      const currentProgress = getQuestionProgress(question.id);
      const currentCorrectCount = currentProgress?.correctAnswerCount || 0;
      const currentIncorrectCount = currentProgress?.incorrectAnswerCount || 0;
      
      const newCorrectCount = isCorrect ? currentCorrectCount + 1 : currentCorrectCount;
      const newIncorrectCount = isCorrect ? currentIncorrectCount : currentIncorrectCount + 1;
      
      setOptimisticProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(question.id, {
          correctAnswerCount: newCorrectCount,
          incorrectAnswerCount: newIncorrectCount,
        });
        return newMap;
      });
      
      // Save to database and collect XP only if not already awarded in this session
      if (isCorrect && !alreadyAwarded) {
        try {
          const result = await recordQuestionAnswerMutation({
            exerciseId,
            questionId,
            unitNumber,
            isCorrect,
          });
          
          if (result && typeof result.earnedXP === 'number') {
            totalEarnedXP += result.earnedXP;
          }

          // Mark as awarded in this session to prevent double XP
          setAwardedQuestions(prev => {
            const next = new Set(prev);
            next.add(questionId);
            persistAwarded(storageKey, next);
            return next;
          });
        } catch (error) {
          console.error('Failed to record question answer:', error);
          setOptimisticProgress(prev => {
            const newMap = new Map(prev);
            newMap.delete(question.id);
            return newMap;
          });
        }
      }
    }
    
    // Update session XP and show toast
    if (totalEarnedXP > 0) {
      setSessionXP(prev => prev + totalEarnedXP);
      toast.success(t("exercise.toast.xpEarned", { xp: totalEarnedXP }), {
        description: t("exercise.toast.sessionTotal", { xp: sessionXP + totalEarnedXP }),
        icon: '⭐',
      });
    }

    // Submit result for completion tracking (no XP from this anymore)
    const correctCount = Object.values(newChecked).filter(v => v === true).length;
    
    try {
      await submitResultMutation({
        unitNumber,
        exerciseType: 'translation',
        exerciseId,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
      });
    } catch (error) {
      console.error('[Exercise] Failed to submit exercise result:', error);
    }
  };

  const resetExercise = () => {
    setAnswers({});
    setChecked({});
    setShowSolutions(false);
    setHasChecked(false);
    setOptimisticProgress(new Map());
    const empty = new Set<string>();
    setAwardedQuestions(empty);
    persistAwarded(storageKey, empty);
  };

  const allCorrect = hasChecked && questions.every(q => checked[q.id] === true);
  const correctCount = Object.values(checked).filter(v => v === true).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✏️</span>
            {title}
          </div>
          
          {/* Session XP Display with Gamification Modal */}
          {sessionXP > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Badge className="bg-yellow-500 text-white">
                    Session: +{sessionXP} XP
                  </Badge>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>🎮 How does XP work?</DialogTitle>
                  <DialogDescription className="space-y-4 pt-4">
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Progressive XP System</h4>
                      <p className="text-sm">
                        You earn XP based on <strong>Spaced Repetition</strong>:
                      </p>
                      <ul className="text-sm space-y-1 mt-2 ml-4">
                        <li>✨ <strong>1st time correct:</strong> +5 XP</li>
                        <li>🌟 <strong>2nd time correct:</strong> +10 XP</li>
                        <li>⭐ <strong>3rd time correct (Mastered):</strong> +20 XP</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Why Spaced Repetition?</h4>
                      <p className="text-sm">
                        Repeating questions helps you remember them long-term! 
                        Each time you answer correctly, you earn more XP. 
                        After 3 correct answers, the question is <strong>Mastered</strong>.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Level Up!</h4>
                      <p className="text-sm">
                        Every <strong>300 XP</strong> = 1 Level Up 🎉
                      </p>
                    </div>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{instructions}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Questions */}
        <div className="space-y-4">
          {questions.map((question, index) => {
            const isCorrect = checked[question.id];
            const userAnswer = answers[question.id] || '';
            const questionProgress = getQuestionProgress(question.id);
            const correctCount = questionProgress?.correctAnswerCount || 0;
            
            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="font-medium text-muted-foreground min-w-[2rem]">
                    {index + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    {/* Prompt */}
                    <p className="font-medium">{question.prompt}</p>
                    
                    {/* Input with feedback icon */}
                    <div className="relative">
                      <Input
                        value={userAnswer}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className={`pr-10 ${
                          isCorrect === true
                            ? 'border-green-500 bg-green-50'
                            : isCorrect === false
                            ? 'border-red-500 bg-red-50'
                            : ''
                        }`}
                        disabled={showSolutions}
                        placeholder="Type your translation..."
                      />
                      {isCorrect === true && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
                      )}
                      {isCorrect === false && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-600" />
                      )}
                    </div>

                    {/* Progress indicator - nur Zahlen (1/3, 2/3) oder Stern bei Meisterung */}
                    {questionProgress && (
                      <div className="flex items-center gap-2 mt-1">
                        {correctCount >= 3 ? (
                          <Badge className="bg-yellow-500 text-white gap-1">
                            <Star className="h-3 w-3 fill-white" />
                            Mastered
                          </Badge>
                        ) : correctCount > 0 ? (
                          <Badge variant="outline" className="text-sm">
                            {correctCount}/3
                          </Badge>
                        ) : null}
                      </div>
                    )}

                    {/* Show solution if requested or if wrong after checking */}
                    {(showSolutions || (hasChecked && isCorrect === false)) && (
                      <div className="pl-2 pt-1">
                        <p className="text-sm font-medium text-green-700">
                          ✓ Correct answer: <span className="font-bold">{question.answer}</span>
                        </p>
                        {question.acceptableAlternatives && question.acceptableAlternatives.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Also acceptable: {question.acceptableAlternatives.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show XP earned for this question based on progress */}
                    {hasChecked && isCorrect === true && (
                      <div className="pl-2 pt-1">
                        {(() => {
                          const currentProgress = getQuestionProgress(question.id);
                          const correctAnswerCount = currentProgress?.correctAnswerCount || 0;
                          let xpForQuestion = 0;
                          
                          // Calculate XP based on previous progress (before this attempt)
                          if (correctAnswerCount === 1) {
                            xpForQuestion = 5; // Was 0, now 1 → First time correct
                          } else if (correctAnswerCount === 2) {
                            xpForQuestion = 10; // Was 1, now 2 → Second time correct
                          } else if (correctAnswerCount === 3) {
                            xpForQuestion = 20; // Was 2, now 3 → Third time correct (Mastered!)
                          }
                          
                          if (xpForQuestion > 0) {
                            return (
                              <Badge className="bg-yellow-500 text-white gap-1 animate-bounce">
                                <Star className="h-3 w-3 fill-white" />
                                +{xpForQuestion} XP
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button onClick={checkAnswers} disabled={showSolutions || hasChecked} className="gap-2">
            <Check className="h-4 w-4" />
            Check Answers
          </Button>
          
          <Button 
            onClick={() => setShowSolutions(true)} 
            variant="outline"
            disabled={showSolutions}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Show Solutions
          </Button>

          <Button 
            onClick={resetExercise} 
            variant="outline"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Results Summary */}
        {hasChecked && (
          <div className={`p-4 rounded-lg border-2 ${
            allCorrect 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            {allCorrect ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">Perfect! All translations are correct! 🎉</span>
                </div>
                {sessionXP > 0 && (
                  <div className="flex items-center gap-2 text-yellow-700 font-semibold">
                    <Star className="h-5 w-5 fill-yellow-500" />
                    <span>Total session: +{sessionXP} XP</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-blue-800">
                <p className="font-semibold">
                  Score: {correctCount} / {questions.length} correct
                </p>
                <p className="text-sm mt-1">
                  Keep trying! You can check your answers again after making corrections.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

