import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MasteryIndicator, MistakesIndicator } from "@/components/vocabulary/VocabularyDictionaryIndicators";
import { BuddyHelpHint } from "@/components/BuddyHelpHint";
import { useTranslation } from "react-i18next";

interface InteractiveTestProps {
  unitNumber: number;
  language: string;
}

export function InteractiveTest({ unitNumber, language }: InteractiveTestProps) {
  const { t } = useTranslation();
  const questions = useQuery(api.units.getUnitInteractiveTest, { unitNumber, language });
  const testIntro = useQuery(api.units.getUnitContentSections, { unitNumber, language });
  const questionProgress = useQuery(api.progress.getQuestionProgress, { unitNumber });
  const submitCategoryResultMutation = useMutation(api.progress.submitCategoryResult);

  // Some older units have the full exercise tables stored in `testIntroduction`.
  // We only want to show a short intro paragraph there (not the exercise tables / answer keys).
  const sanitizeTestIntroduction = (md: string): string => {
    const s = String(md || "").replace(/\r\n/g, "\n");
    if (!s.trim()) return "";

    const cutPoints = [
      // new format (EN) + translated variants (DE)
      s.search(/^\s*###\s+(Exercise|Exercises|Übung|Übungen|Aufgabe|Aufgaben)\b/im),
      s.search(/^\s*ex1\b/im), // legacy format (ex1 Translation)
      s.search(/\|\s*QUESTION\s+ID\s*\|/i), // legacy table header
      s.search(/\|\s*Answer\s*\(for database\)\s*\|/i), // legacy answer key header
    ].filter((n) => typeof n === "number" && n >= 0) as number[];

    if (cutPoints.length === 0) return s.trim();
    const idx = Math.min(...cutPoints);
    return s.slice(0, idx).trim();
  };

  /**
   * Some generated/legacy question strings repeat the category instruction, e.g.
   * "Translate into Serbian: day". We already show the category header + instruction,
   * so strip redundant prefixes for display only (do NOT change stored data/validation).
   */
  const formatQuestionForDisplay = (category: string, question: string): string => {
    const raw = String(question || "").trim();
    if (!raw) return raw;

    const cat = String(category || "").trim().toLowerCase();
    if (!cat.includes("translation")) return raw;

    // Common variants seen in generated content (case-insensitive).
    const patterns: RegExp[] = [
      /^translate\s+into\s+serbian\s*:\s*/i,
      /^translate\s+to\s+serbian\s*:\s*/i,
      /^translate\s+(?:the\s+following\s+)?(?:english\s+)?(?:sentences?\s+)?(?:into|to)\s+serbian\s*:\s*/i,
      /^translation\s+into\s+serbian\s*:\s*/i,
    ];

    let next = raw;
    for (const re of patterns) {
      next = next.replace(re, "");
    }
    next = next.trim();
    return next || raw;
  };
  
  const normalizeAnswer = (value: string) => {
    return (value ?? "")
      .trim()
      .toLowerCase()
      // diacritics: č/ć/š/ž -> c/s/z (via unicode decomposition)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Serbian keyboard fallback: đ/Đ is often typed as plain "d"
      .replace(/đ/g, "d")
      // strip punctuation
      .replace(/[.,!?;:'"()\[\]{}\-–—…¡¿]/g, "")
      // collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
  };

  // State for answers and block-level checking
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, boolean | null>>({}); // true=correct, false=incorrect, null=unchecked
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set());
  const [categoryResults, setCategoryResults] = useState<Record<string, {correct: number, total: number}>>({});
  const [categoryXP, setCategoryXP] = useState<Record<string, number>>({});
  
  // Mastery tracking per question (from backend)
  const [questionMastery, setQuestionMastery] = useState<Record<string, {
    correctAttempts: number,
    incorrectAttempts?: number,
    isMastered: boolean
  }>>({});

  // Load question mastery status from backend
  useEffect(() => {
    if (questionProgress) {
      const masteryMap: Record<string, {correctAttempts: number, incorrectAttempts?: number, isMastered: boolean}> = {};
      questionProgress.forEach(p => {
        masteryMap[p.questionId] = {
          correctAttempts: p.correctAttempts,
          incorrectAttempts: p.incorrectAttempts,
          isMastered: p.isMastered
        };
      });
      setQuestionMastery(masteryMap);
    }
  }, [questionProgress]);

  if (!questions || questions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No interactive test available for this unit yet.
      </div>
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
        const normalizedAnswer = normalizeAnswer(userAnswer);
        const normalizedCorrect = normalizeAnswer(q.correctAnswer);
        const alternatives = q.acceptableAlternatives?.map(a => normalizeAnswer(a)) || [];
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
      const updatedMastery: Record<string, {correctAttempts: number, incorrectAttempts?: number, isMastered: boolean}> = {};
      result.updatedProgress.forEach(p => {
        updatedMastery[p.questionId] = {
          correctAttempts: p.correctAttempts,
          incorrectAttempts: p.incorrectAttempts,
          isMastered: p.isMastered
        };
      });
      setQuestionMastery(prev => ({ ...prev, ...updatedMastery }));

      // Mark category as checked
      setCheckedCategories(prev => new Set(prev).add(category));

      // Show toast with result
      if (result.earnedXP > 0) {
        toast.success(t("interactiveTest.toastEarnedXp", { xp: result.earnedXP }));
      } else {
        const incorrectInThisCheck = categoryQuestions.length - correctCount;
        if (incorrectInThisCheck > 0) {
          toast.info(t("interactiveTest.toastSavedNoXp"));
        } else {
          toast.info(t("interactiveTest.toastAllMastered"));
        }
      }
    } catch (error) {
      console.error("Failed to submit category result:", error);
      toast.error(t("interactiveTest.toastSaveFailed"));
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
      if (earnedXP === 0) return t("interactiveTest.encouragement.perfectMastered");
      return t("interactiveTest.encouragement.perfectOutstanding");
    } else if (percentage >= 80) {
      return t("interactiveTest.encouragement.excellent");
    } else if (percentage >= 60) {
      return t("interactiveTest.encouragement.goodJob");
    } else if (percentage >= 40) {
      return t("interactiveTest.encouragement.notBad");
    } else {
      return t("interactiveTest.encouragement.keepPracticing");
    }
  };

  // Group questions by category, sorted by the first question's order in each category
  const categories = Array.from(new Set(questions.map(q => q.category))).sort((a, b) => {
    const minOrderA = Math.min(...questions.filter(q => q.category === a).map(q => q.order));
    const minOrderB = Math.min(...questions.filter(q => q.category === b).map(q => q.order));
    return minOrderA - minOrderB;
  });

  return (
    <div className="space-y-12 w-full">
      {/* Test Introduction */}
      {testIntro?.testIntroduction && sanitizeTestIntroduction(testIntro.testIntroduction) && (
        <div className="mb-8">
          <MarkdownContent content={sanitizeTestIntroduction(testIntro.testIntroduction)} className="text-gray-700" />
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
              <h2 className="text-xl sm:text-2xl font-bold mb-2">
                {t(`unit.exerciseCategory.${category}`, category.replace(/([A-Z])/g, ' $1').trim())}
              </h2>
              {instructions && (
                <p className="text-base font-semibold text-gray-900 mb-4">
                  {instructions}
                </p>
              )}
            </div>
            
            {/* Questions (Vocabulary-like table with Mastery/Mistakes columns) */}
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr] sm:grid-cols-[1fr_140px_120px] items-center gap-3 border-b bg-muted/25 px-4 py-2 text-xs font-medium text-muted-foreground">
                <div title="Question & answer">{t("unit.tab.exercises")}</div>
                <div className="hidden sm:block text-center" title="Progress toward mastery (3 correct)">
                  {t("unit.vocabTable.mastery")}
                </div>
                <div className="hidden sm:block text-center" title="Incorrect attempts">
                  {t("unit.vocabTable.mistakes")}
                </div>
              </div>

              {categoryQuestions.map((q) => {
                const isSubmitted = isCategoryChecked;
                const isCorrect = feedback[q.questionId] === true;
                const isIncorrect = feedback[q.questionId] === false;
                const progressForQuestion = questionMastery[q.questionId];
                const correctAttempts = Math.max(0, Number(progressForQuestion?.correctAttempts ?? 0) || 0);
                const incorrectAttempts = Math.max(0, Number(progressForQuestion?.incorrectAttempts ?? 0) || 0);
                const isMastered = Boolean(progressForQuestion?.isMastered) || correctAttempts >= 3;

                const renderInlineInput = () => {
                  const parts = q.question.split(/_+/);
                  const blanks = q.question.match(/_+/g) || [];
                  const inputWidth = q.questionType === "dialogue" ? "w-full sm:w-48" : "w-full sm:w-32";

                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      {parts.map((part, idx) => (
                        <React.Fragment key={idx}>
                          <span className="text-foreground">{part}</span>
                          {idx < blanks.length && (
                            <Input
                              placeholder="..."
                              value={answers[q.questionId] || ""}
                              onChange={(e) => handleAnswerChange(q.questionId, category, e.target.value)}
                              disabled={isCategoryChecked}
                              className={`inline-block ${inputWidth} h-9 text-sm ${
                                isCorrect ? "border-green-500" : isIncorrect ? "border-red-500" : ""
                              }`}
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  );
                };

                const renderAnswerInput = () => {
                  const isInline =
                    q.questionType === "fillInBlank" ||
                    q.questionType === "matching" ||
                    (q.questionType === "dialogue" && q.question.includes("_"));

                  if (isInline) return renderInlineInput();

                  if (q.questionType === "multipleChoice") {
                    return (
                      <RadioGroup
                        value={answers[q.questionId] || ""}
                        onValueChange={(val) => handleAnswerChange(q.questionId, category, val)}
                        disabled={isCategoryChecked}
                      >
                      <div className="space-y-2">
                        {q.options?.map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className={`flex items-center space-x-2 ${
                              isSubmitted && option === q.correctAnswer
                                ? "text-green-600 font-medium"
                                : isSubmitted && answers[q.questionId] === option && option !== q.correctAnswer
                                  ? "text-red-600"
                                  : ""
                            }`}
                          >
                            <RadioGroupItem value={option} id={`${q.questionId}-${optIdx}`} />
                            <Label htmlFor={`${q.questionId}-${optIdx}`} className="cursor-pointer">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </div>
                      </RadioGroup>
                    );
                  }

                  // translation / dialogue (no blanks)
                  if (q.questionType === "translation" || (q.questionType === "dialogue" && !q.question.includes("_"))) {
                    return (
                      <Input
                        placeholder={t("interactiveTest.answerPlaceholder")}
                        value={answers[q.questionId] || ""}
                        onChange={(e) => handleAnswerChange(q.questionId, category, e.target.value)}
                        disabled={isCategoryChecked}
                        className={`max-w-md ${isCorrect ? "border-green-500" : isIncorrect ? "border-red-500" : ""}`}
                      />
                    );
                  }

                  // fallback (shouldn't happen)
                  return null;
                };

                return (
                  <div
                    key={q.questionId}
                    className="grid grid-cols-[1fr] sm:grid-cols-[1fr_140px_120px] items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/3 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <div className="shrink-0 flex items-center gap-2 pt-0.5">
                          <span className="font-medium text-muted-foreground">{q.order}.</span>
                          {isMastered && <Star className="w-4 h-4 fill-amber-500 text-amber-500" />}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Question text */}
                          {q.questionType === "fillInBlank" || q.questionType === "matching" || q.questionType === "dialogue" ? null : (
                            <p className="text-foreground">{formatQuestionForDisplay(category, q.question)}</p>
                          )}

                          {/* Input */}
                          {renderAnswerInput()}

                          {/* Hint */}
                          {q.hint && !isSubmitted && (
                            <p className="text-xs text-muted-foreground italic">Hint: {q.hint}</p>
                          )}

                          {/* Feedback */}
                          {isSubmitted && (
                            <div className="text-sm">
                              <span className={`font-medium ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                                {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                              </span>
                              {isIncorrect && (
                                <>
                                  <p className="mt-1 text-sm text-red-600">
                                    Correct answer: <strong>{q.correctAnswer}</strong>
                                  </p>
                                  <BuddyHelpHint
                                    exerciseQuestion={q.question}
                                    correctAnswer={q.correctAnswer}
                                    userAnswer={answers[q.questionId] || ""}
                                    unitNumber={unitNumber}
                                    questionContext={q.questionType === "multipleChoice" ? "multiple-choice" : "fill-in-blank"}
                                    questionId={q.questionId}
                                    delay={0.2}
                                  />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex pt-0.5 justify-center">
                      <MasteryIndicator correctCount={correctAttempts} mastered={isMastered} />
                    </div>

                    <div className="hidden sm:flex pt-0.5 justify-center">
                      <MistakesIndicator count={incorrectAttempts} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Category Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 items-center">
              {!isCategoryChecked ? (
                <>
                  <Button 
                    onClick={() => checkCategoryAnswers(category)} 
                    disabled={!allAnswered}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Check Answers
                  </Button>
                  {!allAnswered && (
                    <p className="text-sm text-muted-foreground">
                      {t('interactiveTest.checkAnswersHint')}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {/* XP Display with Animation */}
                  <div className="flex-1 min-w-0 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-4 sm:px-6 py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="text-xl sm:text-2xl font-bold text-green-600 animate-in zoom-in delay-150">
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













