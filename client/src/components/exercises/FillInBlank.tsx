import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, Eye, RotateCcw } from 'lucide-react';

export interface FillInBlankQuestion {
  id: string;
  text: string; // e.g., "Ja ____ student. (I am a student)"
  answer: string; // e.g., "sam"
  hint?: string; // Optional hint
}

export interface FillInBlankExerciseProps {
  title: string;
  instructions: string;
  questions: FillInBlankQuestion[];
}

export function FillInBlankExercise({ title, instructions, questions }: FillInBlankExerciseProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean | null>>({});
  const [showSolutions, setShowSolutions] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    // Clear the check status when user changes answer
    if (checked[questionId] !== undefined) {
      setChecked(prev => ({ ...prev, [questionId]: null }));
    }
  };

  const checkAnswers = () => {
    const newChecked: Record<string, boolean> = {};
    questions.forEach(q => {
      const userAnswer = (answers[q.id] || '').trim().toLowerCase();
      const correctAnswer = q.answer.trim().toLowerCase();
      newChecked[q.id] = userAnswer === correctAnswer;
    });
    setChecked(newChecked);
    setHasChecked(true);
  };

  const resetExercise = () => {
    setAnswers({});
    setChecked({});
    setShowSolutions(false);
    setHasChecked(false);
  };

  const allCorrect = hasChecked && questions.every(q => checked[q.id] === true);
  const correctCount = Object.values(checked).filter(v => v === true).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">✏️</span>
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{instructions}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Questions */}
        <div className="space-y-4">
          {questions.map((question, index) => {
            const isCorrect = checked[question.id];
            const userAnswer = answers[question.id] || '';
            
            return (
              <div key={question.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="font-medium text-muted-foreground min-w-[2rem]">
                    {index + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    {/* Question text with inline input */}
                    <div className="flex flex-wrap items-center gap-3">
                      {question.text.split('____').map((part, i) => (
                        <span key={i} className="inline-flex items-center gap-3">
                          <span>{part}</span>
                          {i < question.text.split('____').length - 1 && (
                            <div className="relative inline-block">
                              <Input
                                value={userAnswer}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className={`w-32 h-9 pr-10 ${
                                  isCorrect === true
                                    ? 'border-green-500 bg-green-50'
                                    : isCorrect === false
                                    ? 'border-red-500 bg-red-50'
                                    : ''
                                }`}
                                disabled={showSolutions}
                                placeholder="..."
                              />
                              {isCorrect === true && (
                                <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
                              )}
                              {isCorrect === false && (
                                <X className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-red-600" />
                              )}
                            </div>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Hint */}
                    {question.hint && (
                      <p className="text-sm text-muted-foreground italic pl-2">
                        💡 {question.hint}
                      </p>
                    )}

                    {/* Show solution if requested or if wrong after checking */}
                    {(showSolutions || (hasChecked && isCorrect === false)) && (
                      <div className="pl-2 pt-1">
                        <p className="text-sm font-medium text-green-700">
                          ✓ Correct answer: <span className="font-bold">{question.answer}</span>
                        </p>
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
          <Button onClick={checkAnswers} disabled={showSolutions} className="gap-2">
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
              <div className="flex items-center gap-2 text-green-800">
                <Check className="h-5 w-5" />
                <span className="font-semibold">Perfect! All answers are correct! 🎉</span>
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

