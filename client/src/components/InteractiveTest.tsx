import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { MarkdownContent } from "@/components/MarkdownContent";

interface InteractiveTestProps {
  unitNumber: number;
  language: string;
}

export function InteractiveTest({ unitNumber, language }: InteractiveTestProps) {
  const questions = useQuery(api.units.getUnitInteractiveTest, { unitNumber, language });
  const testIntro = useQuery(api.units.getUnitContentSections, { unitNumber, language });
  const questionProgress = useQuery(api.progress.getQuestionProgress, { unitNumber });
  const submitCategoryResultMutation = useMutation(api.progress.submitCategoryResult);
  
  // State for answers and block-level checking
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, boolean | null>>({}); // true=correct, false=incorrect, null=unchecked
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set());
  const [categoryResults, setCategoryResults] = useState<Record<string, {correct: number, total: number}>>({});
  const [categoryXP, setCategoryXP] = useState<Record<string, number>>({});
  
  // Mastery tracking per question (from backend)
  const [questionMastery, setQuestionMastery] = useState<Record<string, {
    correctAttempts: number,
    isMastered: boolean
  }>>({});

  // Load question mastery status from backend
  useEffect(() => {
    if (questionProgress) {
      const masteryMap: Record<string, {correctAttempts: number, isMastered: boolean}> = {};
      questionProgress.forEach(p => {
        masteryMap[p.questionId] = {
          correctAttempts: p.correctAttempts,
          isMastered: p.isMastered
        };
      });
      setQuestionMastery(masteryMap);
    }
  }, [questionProgress]);

  if (!questions || questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No interactive test available for this unit yet.
        </CardContent>
      </Card>
    );
  }

  const handleAnswerChange = (questionId: string, category: string, value: string) => {
    // Don't allow changes if category is already checked
    if (checkedCategories.has(category)) return;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const checkCategoryAnswers = async (category: string) => {
    const categoryQuestions = questions.filter(q => q.category === category);
    
    // Check all answers
    const questionResults: Array<{questionId: string, isCorrect: boolean}> = [];
    const newFeedback: Record<string, boolean> = {};
    let correctCount = 0;

    for (const q of categoryQuestions) {
      const userAnswer = answers[q.questionId];
      if (!userAnswer) {
        newFeedback[q.questionId] = false;
        questionResults.push({ questionId: q.questionId, isCorrect: false });
        continue;
      }

      let isCorrect = false;
      if (q.questionType === "multipleChoice") {
        isCorrect = userAnswer === q.correctAnswer;
      } else {
        const normalizedAnswer = userAnswer.trim().toLowerCase();
        const normalizedCorrect = q.correctAnswer.toLowerCase();
        const alternatives = q.acceptableAlternatives?.map(a => a.toLowerCase()) || [];
        isCorrect = normalizedAnswer === normalizedCorrect || alternatives.includes(normalizedAnswer);
      }

      newFeedback[q.questionId] = isCorrect;
      questionResults.push({ questionId: q.questionId, isCorrect });
      if (isCorrect) correctCount++;
    }

    // Update feedback state
    setFeedback(prev => ({ ...prev, ...newFeedback }));

    // Submit to backend
    try {
      const result = await submitCategoryResultMutation({
        unitNumber,
        category,
        questionResults,
      });

      // Update category results and XP
      setCategoryResults(prev => ({
        ...prev,
        [category]: { correct: correctCount, total: categoryQuestions.length }
      }));
      setCategoryXP(prev => ({ ...prev, [category]: result.earnedXP }));

      // Update mastery state with new progress
      const updatedMastery: Record<string, {correctAttempts: number, isMastered: boolean}> = {};
      result.updatedProgress.forEach(p => {
        updatedMastery[p.questionId] = {
          correctAttempts: p.correctAttempts,
          isMastered: p.isMastered
        };
      });
      setQuestionMastery(prev => ({ ...prev, ...updatedMastery }));

      // Mark category as checked
      setCheckedCategories(prev => new Set(prev).add(category));

      // Show toast with result
      if (result.earnedXP > 0) {
        toast.success(`You earned ${result.earnedXP} XP!`);
      } else {
        toast.info("All questions in this category are mastered!");
      }
    } catch (error) {
      console.error("Failed to submit category result:", error);
      toast.error("Failed to save progress");
    }
  };

  const resetCategory = (category: string) => {
    const categoryQuestions = questions.filter(q => q.category === category);
    
    // Clear answers and feedback for this category
    const newAnswers = { ...answers };
    const newFeedback = { ...feedback };
    categoryQuestions.forEach(q => {
      delete newAnswers[q.questionId];
      delete newFeedback[q.questionId];
    });
    
    setAnswers(newAnswers);
    setFeedback(newFeedback);
    
    // Uncheck category
    const newChecked = new Set(checkedCategories);
    newChecked.delete(category);
    setCheckedCategories(newChecked);
    
    // Clear category results and XP display
    const newResults = { ...categoryResults };
    const newXP = { ...categoryXP };
    delete newResults[category];
    delete newXP[category];
    setCategoryResults(newResults);
    setCategoryXP(newXP);
    
    // Note: Mastery status is NOT reset (stays in backend)
  };

  const allCategoryQuestionsAnswered = (category: string) => {
    const categoryQuestions = questions.filter(q => q.category === category);
    return categoryQuestions.every(q => answers[q.questionId]?.trim());
  };

  const getEncouragementMessage = (result: {correct: number, total: number}, earnedXP: number) => {
    const percentage = (result.correct / result.total) * 100;
    
    if (percentage === 100) {
      if (earnedXP === 0) return "Perfect! All mastered!";
      return "Perfect! Outstanding work!";
    } else if (percentage >= 80) {
      return "Excellent! Keep it up!";
    } else if (percentage >= 60) {
      return "Good job! You're making progress!";
    } else if (percentage >= 40) {
      return "Not bad! Try again for more XP!";
    } else {
      return "Keep practicing! You'll get there!";
    }
  };

  // Group questions by category, sorted by the first question's order in each category
  const categories = Array.from(new Set(questions.map(q => q.category))).sort((a, b) => {
    const minOrderA = Math.min(...questions.filter(q => q.category === a).map(q => q.order));
    const minOrderB = Math.min(...questions.filter(q => q.category === b).map(q => q.order));
    return minOrderA - minOrderB;
  });

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Test Introduction */}
      {testIntro?.testIntroduction && (
        <div className="mb-8">
          <MarkdownContent content={testIntro.testIntroduction} className="text-gray-700" />
        </div>
      )}

      {categories.map(category => {
        const categoryQuestions = questions.filter(q => q.category === category);
        const instructions = categoryQuestions[0]?.categoryInstructions;
        const isCategoryChecked = checkedCategories.has(category);
        const allAnswered = allCategoryQuestionsAnswered(category);
        
        return (
          <div key={category} className="space-y-6">
            {/* Category Title */}
            <div>
              <h2 className="text-2xl font-bold mb-2 capitalize">
                {category.replace(/([A-Z])/g, ' $1').trim()}
              </h2>
              {instructions && (
                <p className="text-base font-semibold text-gray-900 mb-4">
                  {instructions}
                </p>
              )}
            </div>
            
            {/* Questions */}
            <div className="space-y-6">
              {categoryQuestions.map((q) => {
                const isSubmitted = isCategoryChecked;
                const isCorrect = feedback[q.questionId] === true;
                const isIncorrect = feedback[q.questionId] === false;
                const isMastered = questionMastery[q.questionId]?.isMastered ?? false;

                return (
                  <div key={q.questionId} className="space-y-3">
                    {/* Question with inline input for fill-in-the-blank, vocabulary matching, and dialogue with blanks */}
                    {(q.questionType === "fillInBlank" || q.questionType === "matching" || (q.questionType === "dialogue" && q.question.includes('_'))) ? (
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium text-gray-900">{q.order}.</span>
                          {isMastered && (
                            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                          )}
                          <span className="text-xs text-gray-500">
                            {questionMastery[q.questionId]?.correctAttempts || 0}/3
                          </span>
                        </div>
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          {(() => {
                            const parts = q.question.split(/_+/);
                            const blanks = q.question.match(/_+/g) || [];
                            // Dialogue questions typically need more space for answers
                            const inputWidth = q.questionType === "dialogue" ? "w-48" : "w-32";
                            
                            return parts.map((part, idx) => (
                              <React.Fragment key={idx}>
                                <span className="text-gray-900">{part}</span>
                                {idx < blanks.length && (
                                  <Input 
                                    placeholder="..."
                                    value={answers[q.questionId] || ""}
                                    onChange={(e) => handleAnswerChange(q.questionId, category, e.target.value)}
                                    disabled={isCategoryChecked}
                                    className={`inline-block ${inputWidth} h-8 text-sm ${isCorrect ? "border-green-500" : isIncorrect ? "border-red-500" : ""}`}
                                  />
                                )}
                              </React.Fragment>
                            ));
                          })()}
                          {isSubmitted && (
                            <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Question Text for other types */}
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium text-gray-900">{q.order}.</span>
                            {isMastered && (
                              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                            )}
                            <span className="text-xs text-gray-500">
                              {questionMastery[q.questionId]?.correctAttempts || 0}/3
                            </span>
                          </div>
                          <p className="text-gray-900 flex-1">{q.question}</p>
                          {isSubmitted && (
                            <span className={`text-sm font-medium shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {isCorrect ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </>
                    )}

                    {/* Mastery Badge */}
                    {isMastered && (
                      <div className="pl-6">
                        <Badge className="bg-amber-500 text-white">
                          <Star className="w-3 h-3 mr-1 fill-white"/> Mastered ({questionMastery[q.questionId]?.correctAttempts}/3)
                        </Badge>
                      </div>
                    )}

                    {/* Answer Input for non-inline types */}
                    {q.questionType !== "fillInBlank" && q.questionType !== "matching" && !(q.questionType === "dialogue" && q.question.includes('_')) && (
                      <div className="pl-6">
                        {q.questionType === "multipleChoice" ? (
                          <RadioGroup 
                            value={answers[q.questionId] || ""} 
                            onValueChange={(val) => handleAnswerChange(q.questionId, category, val)}
                            disabled={isCategoryChecked}
                          >
                            <div className="space-y-2">
                              {q.options?.map((option, optIdx) => (
                                <div key={optIdx} className={`flex items-center space-x-2 ${
                                  isSubmitted && option === q.correctAnswer ? "text-green-600 font-medium" : 
                                  isSubmitted && answers[q.questionId] === option && option !== q.correctAnswer ? "text-red-600" : 
                                  ""
                                }`}>
                                  <RadioGroupItem value={option} id={`${q.questionId}-${optIdx}`} />
                                  <Label htmlFor={`${q.questionId}-${optIdx}`} className="cursor-pointer">{option}</Label>
                                </div>
                              ))}
                            </div>
                          </RadioGroup>
                        ) : q.questionType === "translation" || (q.questionType === "dialogue" && !q.question.includes('_')) ? (
                          <Input 
                            placeholder="Type your answer..." 
                            value={answers[q.questionId] || ""}
                            onChange={(e) => handleAnswerChange(q.questionId, category, e.target.value)}
                            disabled={isCategoryChecked}
                            className={`max-w-md ${isCorrect ? "border-green-500" : isIncorrect ? "border-red-500" : ""}`}
                          />
                        ) : null}
                        
                        {/* Feedback */}
                        {isIncorrect && (
                          <p className="mt-2 text-sm text-red-600">
                            Correct answer: <strong>{q.correctAnswer}</strong>
                          </p>
                        )}
                        {q.hint && !isSubmitted && (
                          <p className="mt-2 text-xs text-muted-foreground italic">Hint: {q.hint}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Feedback for inline input types */}
                    {(q.questionType === "fillInBlank" || q.questionType === "matching" || (q.questionType === "dialogue" && q.question.includes('_'))) && isIncorrect && (
                      <div className="pl-6">
                        <p className="text-sm text-red-600">
                          Correct answer: <strong>{q.correctAnswer}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Category Action Buttons */}
            <div className="flex gap-3 pt-4 items-center">
              {!isCategoryChecked ? (
                <Button 
                  onClick={() => checkCategoryAnswers(category)} 
                  disabled={!allAnswered}
                  className="bg-primary hover:bg-primary/90"
                >
                  Check Answers
                </Button>
              ) : (
                <>
                  {/* XP Display with Animation */}
                  <div className="flex-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-6 py-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold text-green-600 animate-in zoom-in delay-150">
                        +{categoryXP[category]} XP
                      </div>
                      {categoryResults[category] && (
                        <div className="text-sm text-green-700">
                          {getEncouragementMessage(categoryResults[category], categoryXP[category])}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => resetCategory(category)} 
                    variant="outline"
                  >
                    Reset
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}










