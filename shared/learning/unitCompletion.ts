/**
 * Unit completion criterion (single source of truth).
 *
 * A unit is complete when every active published vocabulary row and every
 * active published interactive-test question of the learner's track has been
 * answered correctly at least once. Mastery (3×) is not required — that only
 * gates further XP.
 */

export type VocabProgressInput = {
  courseVocabularyId: string;
  correctAnswerCount: number;
};

export type QuestionProgressInput = {
  questionId: string;
  correctAttempts: number;
};

export type UnitCompletionResult = {
  complete: boolean;
  missingVocabIds: string[];
  missingQuestionIds: string[];
  vocabTotal: number;
  vocabPassed: number;
  questionsTotal: number;
  questionsPassed: number;
};

export function evaluateUnitCompletion(args: {
  requiredVocabIds: string[];
  requiredQuestionIds: string[];
  vocabProgress: VocabProgressInput[];
  questionProgress: QuestionProgressInput[];
}): UnitCompletionResult {
  const vocabPassed = new Set(
    args.vocabProgress
      .filter((row) => row.correctAnswerCount >= 1)
      .map((row) => row.courseVocabularyId),
  );
  const questionsPassed = new Set(
    args.questionProgress
      .filter((row) => row.correctAttempts >= 1)
      .map((row) => row.questionId),
  );

  const missingVocabIds = args.requiredVocabIds.filter((id) => !vocabPassed.has(id));
  const missingQuestionIds = args.requiredQuestionIds.filter((id) => !questionsPassed.has(id));

  // An empty unit (no published vocab and no published questions) is not completable.
  const hasWork = args.requiredVocabIds.length > 0 || args.requiredQuestionIds.length > 0;
  const complete = hasWork && missingVocabIds.length === 0 && missingQuestionIds.length === 0;

  return {
    complete,
    missingVocabIds,
    missingQuestionIds,
    vocabTotal: args.requiredVocabIds.length,
    vocabPassed: args.requiredVocabIds.length - missingVocabIds.length,
    questionsTotal: args.requiredQuestionIds.length,
    questionsPassed: args.requiredQuestionIds.length - missingQuestionIds.length,
  };
}
