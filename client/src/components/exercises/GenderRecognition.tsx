import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, X, RotateCcw, HelpCircle, Eye, Star } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { toast } from 'sonner';

export interface GenderRecognitionQuestion {
  id: string;
  text: string;
  answer: "masculine" | "feminine" | "neuter";
  hint?: string;
}

export interface GenderRecognitionExerciseProps {
  title: string;
  instructions: string;
  questions: GenderRecognitionQuestion[];
  exerciseId: string;
  unitNumber: number;
}

type QuestionProgressDoc = Doc<"exerciseQuestionProgress">;

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

export function GenderRecognitionExercise({ title, instructions, questions, exerciseId, unitNumber }: GenderRecognitionExerciseProps) {
  const [answers, setAnswers] = useState<Record<string, "masculine" | "feminine" | "neuter" | null>>({});
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [hasChecked, setHasChecked] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const storageKey = `awarded:${exerciseId}`;
  const [awardedQuestions, setAwardedQuestions] = useState<Set<string>>(() => loadAwarded(storageKey));
  const submitResultMutation = useMutation(api.exercises.submitResult);
  
  const recordQuestionAnswerMutation = useMutation(api.exercises.recordExerciseQuestionAnswer);
  const questionProgressData = useQuery(api.exercises.getExerciseQuestionProgress, { exerciseId }) as QuestionProgressDoc[] | undefined;
  
  const [optimisticProgress, setOptimisticProgress] = useState<Map<string, { correctAnswerCount: number; incorrectAnswerCount: number }>>(new Map());

  useEffect(() => {
    setAwardedQuestions(loadAwarded(storageKey));
  }, [storageKey]);

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

  const handleAnswerChange = (questionId: string, value: "masculine" | "feminine" | "neuter") => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (checked[questionId] !== undefined) {
      setChecked(prev => ({ ...prev, [questionId]: null }));
    }
  };

  const checkAnswers = async () => {
    if (hasChecked) return;

    const newChecked: Record<string, boolean> = {};
    questions.forEach(q => {
      const userAnswer = answers[q.id];
      newChecked[q.id] = userAnswer === q.answer;
    });
    setChecked(newChecked);
    setHasChecked(true);

    let totalEarnedXP = 0;
    for (const question of questions) {
      const isCorrect = Boolean(newChecked[question.id]);
      const questionId = `${exerciseId}-${question.id}`;
      const alreadyAwarded = awardedQuestions.has(questionId);
      
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
    
    if (totalEarnedXP > 0) {
      setSessionXP(prev => prev + totalEarnedXP);
      toast.success(`+${totalEarnedXP} XP earned!`, {
        description: `Total session XP: ${sessionXP + totalEarnedXP}`,
        icon: '⭐',
      });
    }

    const correctCount = Object.values(newChecked).filter(v => v === true).length;
    
    try {
      await submitResultMutation({
        unitNumber,
        exerciseType: 'genderRecognition',
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
    setHasChecked(false);
    setShowSolutions(false);
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
            <span className="text-2xl">🎯</span>
            {title}
          </div>
          
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
                        <li>✨ <strong>1st time correct:</strong> +10 XP</li>
                        <li>🌟 <strong>2nd time correct:</strong> +5 XP</li>
                        <li>⭐ <strong>3rd time correct (Mastered):</strong> +3 XP</li>
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
        
        {/* Legend */}
        <div className="flex gap-4 text-sm mt-3 pt-3 border-t">
          <span className="font-medium">M = Masculine</span>
          <span className="font-medium">F = Feminine</span>
          <span className="font-medium">N = Neuter</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {questions.map((question, index) => {
            const isCorrect = checked[question.id];
            const userAnswer = answers[question.id];
            const questionProgress = getQuestionProgress(question.id);
            const correctCount = questionProgress?.correctAnswerCount || 0;
            
            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="font-medium text-muted-foreground min-w-[2rem]">
                    {index + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    <p className="font-medium">{question.text}</p>
                    
                    <div className="flex gap-4">
                      {(['masculine', 'feminine', 'neuter'] as const).map((gender) => {
                        const isSelected = userAnswer === gender;
                        const isCorrectAnswer = question.answer === gender;
                        const showFeedback = (hasChecked || showSolutions) && isCorrect !== null;
                        
                        return (
                          <label
                            key={gender}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              (hasChecked || showSolutions) && "cursor-not-allowed opacity-50"
                            )}
                          >
                            <input
                              type="radio"
                              name={`gender-${question.id}`}
                              value={gender}
                              checked={isSelected || (showSolutions && isCorrectAnswer)}
                              onChange={() => handleAnswerChange(question.id, gender)}
                              disabled={hasChecked || showSolutions}
                              className="w-4 h-4"
                            />
                            <span className={cn(
                              "flex items-center gap-1",
                              showFeedback && isCorrectAnswer && "text-green-600 font-medium",
                              showFeedback && isSelected && !isCorrectAnswer && "text-red-600 font-medium",
                              showSolutions && isCorrectAnswer && "text-green-600 font-medium"
                            )}>
                              {gender === 'masculine' && 'M'}
                              {gender === 'feminine' && 'F'}
                              {gender === 'neuter' && 'N'}
                            </span>
                            {showFeedback && isCorrectAnswer && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                            {showFeedback && isSelected && !isCorrectAnswer && (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                            {showSolutions && isCorrectAnswer && !showFeedback && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </label>
                        );
                      })}
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

                    {isCorrect === true && (
                      <p className="text-sm text-green-600 font-medium">✓ Correct!</p>
                    )}
                    {isCorrect === false && (
                      <p className="text-sm text-red-600">
                        ✗ Incorrect. The correct answer is <strong>{question.answer}</strong>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <Button onClick={checkAnswers} disabled={showSolutions || hasChecked || Object.keys(answers).length !== questions.length} className="gap-2">
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
                  <span className="font-semibold">Perfect! All answers are correct! 🎉</span>
                </div>
              </div>
            ) : (
              <div className="text-blue-800">
                <p className="font-semibold">
                  Score: {correctCount} / {questions.length} correct
                </p>
                <p className="text-sm mt-1">
                  Keep trying! You can reset and try again.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


