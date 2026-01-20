import { z } from "zod";

export const SupportedLanguageSchema = z.enum(["en", "de", "sr", "es", "fr"]);
export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;

export const UnitPackageSchemaVersion = "unitPackage.v1" as const;

export const UnitPackageContentSchema = z.object({
  overviewMd: z.string(),
  // Optional for backward compatibility: older unit packages didn't store raw vocabulary section markdown.
  // When present, it may include multiple `###` category blocks used by the Unit UI.
  vocabularyMd: z.optional(z.string()),
  grammarMd: z.string(),
  phrasesMd: z.string(),
  dialoguesMd: z.string(),
  testIntroductionMd: z.string(),
});

export type UnitPackageContent = z.infer<typeof UnitPackageContentSchema>;

export const UnitPackageVocabularyEntrySchema = z.object({
  // IMPORTANT: must be audio-clean after autofix
  serbian: z.string().min(1),
  en: z.string().min(1),
  enAlt: z.optional(z.string().min(1)),
  noteEn: z.optional(z.string().min(1)),
  // Optional in JSON, but we will import to DB as a string ("m" | "f" | "n")
  gender: z.optional(z.string().min(1)),
});

export type UnitPackageVocabularyEntry = z.infer<typeof UnitPackageVocabularyEntrySchema>;

export const UnitPackageExerciseQuestionSchema = z.object({
  questionId: z.string().min(1),
  order: z.number().int().positive(),
  questionType: z.enum(["translation", "fillInBlank", "multipleChoice", "matching", "dialogue"]),
  question: z.string().min(1),
  // Keep optional at schema-level so we can still parse and produce a full report.
  // Hard requirements are enforced in validateUnitPackageDeep().
  correctAnswer: z.optional(z.string()),
  acceptableAlternatives: z.optional(z.array(z.string())),
  options: z.optional(z.array(z.string())),
  hint: z.optional(z.string().min(1)),
});

export type UnitPackageExerciseQuestion = z.infer<typeof UnitPackageExerciseQuestionSchema>;

export const UnitPackageExerciseCategorySchema = z.object({
  category: z.string().min(1),
  categoryInstructions: z.string().min(1),
  questions: z.array(UnitPackageExerciseQuestionSchema).min(1),
});

export type UnitPackageExerciseCategory = z.infer<typeof UnitPackageExerciseCategorySchema>;

export const UnitPackageSchema = z
  .object({
    schemaVersion: z.literal(UnitPackageSchemaVersion),
    unitNumber: z.number().int().positive(),
    module: z.object({
      moduleNumber: z.number().int().positive(),
      title: z.string().min(1),
    }),
    title: z.string().min(1),
    // Short description shown under the unit title in the app.
    // Optional for backward compatibility; recommended for new content.
    description: z.optional(z.string().min(1)),
    baseLanguage: z.literal("en"),
    targetLanguage: z.literal("sr"),
    languages: z.array(SupportedLanguageSchema).min(1),
    // Use string-key records to avoid requiring all enum keys; validate keys manually below.
    content: z.record(z.string(), UnitPackageContentSchema),
    vocabulary: z.record(z.string(), z.array(UnitPackageVocabularyEntrySchema)),
    exercises: z.record(z.string(), z.array(UnitPackageExerciseCategorySchema)),
  })
  .superRefine((pkg, ctx) => {
    // Require language coverage for declared languages
    for (const lang of pkg.languages) {
      if (!pkg.content[lang]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content", lang],
          message: `Missing content for language '${lang}'`,
        });
      }
      if (!pkg.vocabulary[lang]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["vocabulary", lang],
          message: `Missing vocabulary array for language '${lang}'`,
        });
      }
      if (!pkg.exercises[lang]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["exercises", lang],
          message: `Missing exercises array for language '${lang}'`,
        });
      }
    }

    // Disallow unknown language keys (must be supported, and ideally declared)
    const keySets: Array<{ root: "content" | "vocabulary" | "exercises"; obj: Record<string, unknown> }> = [
      { root: "content", obj: pkg.content },
      { root: "vocabulary", obj: pkg.vocabulary },
      { root: "exercises", obj: pkg.exercises },
    ];

    for (const { root, obj } of keySets) {
      for (const key of Object.keys(obj)) {
        const isSupported = SupportedLanguageSchema.safeParse(key).success;
        if (!isSupported) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [root, key],
            message: `Unsupported language key '${key}' in ${root}`,
          });
        }
      }
    }

    // Cross-field: unique questionIds within each language, and orders should be unique
    for (const lang of pkg.languages) {
      const cats = (pkg.exercises[lang] as any) || [];
      const seenIds = new Set<string>();
      const seenOrders = new Set<number>();
      for (let cIdx = 0; cIdx < cats.length; cIdx++) {
        const cat = cats[cIdx];
        for (let qIdx = 0; qIdx < cat.questions.length; qIdx++) {
          const q = cat.questions[qIdx];

          if (seenIds.has(q.questionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["exercises", lang, cIdx, "questions", qIdx, "questionId"],
              message: `Duplicate questionId '${q.questionId}' in language '${lang}'`,
            });
          } else {
            seenIds.add(q.questionId);
          }

          if (seenOrders.has(q.order)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["exercises", lang, cIdx, "questions", qIdx, "order"],
              message: `Duplicate order '${q.order}' in language '${lang}'`,
            });
          } else {
            seenOrders.add(q.order);
          }
        }
      }
    }
  });

export type UnitPackage = z.infer<typeof UnitPackageSchema>;

export type ValidationIssue = {
  level: "error" | "warning";
  path: Array<string | number>;
  message: string;
};

const SERBIAN_FORBIDDEN_REGEX = /[()\[\]*\/]|[.?!,:;]/;

function countWords(s: string): number {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countBlanks(question: string): number {
  // Our frontend uses a single input per questionId. Multiple blanks are currently not supported safely.
  const blanks = String(question).match(/_+/g) || [];
  return blanks.length;
}

function normalizeVocabKey(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Deep validation rules that go beyond structural schema checks.
 * Run this on the *post-autofix* package.
 */
export function validateUnitPackageDeep(pkg: UnitPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Unit description (shown under unit title in the app)
  if (!pkg.description || !String(pkg.description).trim()) {
    issues.push({
      level: "warning",
      path: ["description"],
      message: "Missing unit description (recommended): add a short one-sentence description.",
    });
  }

  // Vocabulary: audio-clean Serbian
  for (const lang of pkg.languages) {
    const vocab = pkg.vocabulary[lang] || [];

    // Disallow duplicate Serbian entries within the same unit/language.
    // Rationale:
    // - The app's vocabulary/trainer expects one "courseVocabulary" row per Serbian key.
    // - Duplicates can lead to "last one wins" overwrites during import and confusing UI duplicates.
    // If a word has multiple meanings/usages (e.g. "Molim"), keep ONE row and put extra meanings in Notes.
    const seenSerbian = new Map<string, number>(); // key -> first index
    for (let idx = 0; idx < vocab.length; idx++) {
      const key = normalizeVocabKey(vocab[idx]?.serbian);
      if (!key) continue;
      const firstIdx = seenSerbian.get(key);
      if (typeof firstIdx === "number") {
        issues.push({
          level: "error",
          path: ["vocabulary", lang, idx, "serbian"],
          message:
            `Duplicate Serbian entry '${vocab[idx].serbian}' (first at index ${firstIdx}). ` +
            `Use ONE row and put additional meanings/usages into Notes.`,
        });
      } else {
        seenSerbian.set(key, idx);
      }
    }

    for (let idx = 0; idx < vocab.length; idx++) {
      const v = vocab[idx];
      if (!v.serbian.trim()) {
        issues.push({
          level: "error",
          path: ["vocabulary", lang, idx, "serbian"],
          message: "serbian must be non-empty",
        });
        continue;
      }

      if (SERBIAN_FORBIDDEN_REGEX.test(v.serbian)) {
        issues.push({
          level: "error",
          path: ["vocabulary", lang, idx, "serbian"],
          message: `serbian contains forbidden characters for audio/indexing: '${v.serbian}'`,
        });
      }

      const words = countWords(v.serbian);
      if (words > 3) {
        issues.push({
          level: "error",
          path: ["vocabulary", lang, idx, "serbian"],
          message: `serbian has ${words} words (max 3 allowed): '${v.serbian}'`,
        });
      }
    }
  }

  // Exercises: completeness + multiple choice constraints + blank constraints
  for (const lang of pkg.languages) {
    const categories = pkg.exercises[lang] || [];

    // Category keys should be unique post-autofix
    const seenCat = new Set<string>();
    for (let cIdx = 0; cIdx < categories.length; cIdx++) {
      const c = categories[cIdx];
      if (seenCat.has(c.category)) {
        issues.push({
          level: "error",
          path: ["exercises", lang, cIdx, "category"],
          message: `Duplicate category '${c.category}' in exercises for language '${lang}'`,
        });
      }
      seenCat.add(c.category);

      for (let qIdx = 0; qIdx < c.questions.length; qIdx++) {
        const q = c.questions[qIdx];
        const qPath = ["exercises", lang, cIdx, "questions", qIdx] as const;

        if (!q.correctAnswer || !q.correctAnswer.trim()) {
          issues.push({
            level: "error",
            path: [...qPath, "correctAnswer"],
            message: `correctAnswer must be non-empty (questionId=${q.questionId})`,
          });
        }

        if (q.questionType === "multipleChoice") {
          if (!q.options || q.options.length < 2) {
            issues.push({
              level: "error",
              path: [...qPath, "options"],
              message: `multipleChoice must have at least 2 options (questionId=${q.questionId})`,
            });
          } else if (q.correctAnswer && q.correctAnswer.trim() && !q.options.includes(q.correctAnswer)) {
            issues.push({
              level: "error",
              path: [...qPath, "correctAnswer"],
              message: `correctAnswer must exactly match one of options (questionId=${q.questionId})`,
            });
          }
        }

        if (q.questionType === "fillInBlank" || q.questionType === "matching") {
          const blanks = countBlanks(q.question);
          if (blanks !== 1) {
            issues.push({
              level: "error",
              path: [...qPath, "question"],
              message: `question must contain exactly one blank '_____' (found ${blanks}) (questionId=${q.questionId})`,
            });
          }
        }

        if (q.questionType === "dialogue" && q.question.includes("_")) {
          const blanks = countBlanks(q.question);
          if (blanks !== 1) {
            issues.push({
              level: "error",
              path: [...qPath, "question"],
              message: `dialogue question with blanks must contain exactly one blank '_____' (found ${blanks}) (questionId=${q.questionId})`,
            });
          }
        }
      }
    }
  }

  return issues;
}

