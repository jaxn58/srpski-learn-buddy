import type { UnitPackage, ValidationIssue } from "./schema";

/**
 * Hard template rules derived from Unit 1/2 patterns.
 *
 * IMPORTANT:
 * - Keep this separate from validateUnitPackageDeep() so existing legacy content
 *   can still be imported/validated without being forced into the new template.
 * - Use this in the Content Studio draft/QC pipeline as a publish gate.
 */

const QUESTION_ID_REGEX = /^u\d+_ex\d+_q\d{2}$/i;

function hasExactlyOneFiveUnderscoreBlank(question: string): boolean {
  // Exactly one occurrence of "_____" and no other underscore runs
  const s = String(question || "");
  const five = (s.match(/_____/g) || []).length;
  const anyRun = (s.match(/_+/g) || []).length;
  return five === 1 && anyRun === 1;
}

function pushError(
  issues: ValidationIssue[],
  path: Array<string | number>,
  message: string
) {
  issues.push({ level: "error", path, message });
}

export function validateUnitPackageTemplateRules(pkg: UnitPackage): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1) Language constraints (current product constraint)
  if (!pkg.languages.includes("en")) {
    pushError(issues, ["languages"], `Template requires 'en' in languages`);
  }
  if (pkg.baseLanguage !== "en") {
    pushError(issues, ["baseLanguage"], `Template requires baseLanguage 'en'`);
  }
  if (pkg.targetLanguage !== "sr") {
    pushError(issues, ["targetLanguage"], `Template requires targetLanguage 'sr'`);
  }

  // 2) Required sections in content.en (can be empty but must exist)
  const c = (pkg.content as any)?.en;
  const requiredContentKeys = [
    "overviewMd",
    "grammarMd",
    "phrasesMd",
    "dialoguesMd",
    "testIntroductionMd",
  ] as const;
  for (const key of requiredContentKeys) {
    if (!c || typeof c[key] !== "string") {
      pushError(issues, ["content", "en", key], `Missing content.en.${key} (string required)`);
    }
  }

  // 3) Vocabulary template: enforce Notes conventions at least minimally (polysemy handled in deep validator)
  // We keep this light: the deep validator already enforces audio-clean + no duplicates.
  const vocab = pkg.vocabulary?.en || [];
  for (let i = 0; i < vocab.length; i++) {
    const v = vocab[i] as any;
    if (typeof v?.noteEn === "string" && v.noteEn.includes("Also:")) {
      pushError(
        issues,
        ["vocabulary", "en", i, "noteEn"],
        `Use structured Notes keys (e.g. 'AlsoMeaning: ...') instead of 'Also:'`
      );
    }
  }

  // 4) Exercises: require stable IDs + required categories + strict blank / options rules
  const cats = pkg.exercises?.en || [];
  const requiredCategories = new Set([
    "translation",
    "fillInBlank",
    "multipleChoice",
    "vocabularyMatching",
    "dialogueCompletion",
  ]);

  for (const req of requiredCategories) {
    if (!cats.some((c: any) => c?.category === req)) {
      pushError(issues, ["exercises", "en"], `Missing required exercise category '${req}'`);
    }
  }

  for (let cIdx = 0; cIdx < cats.length; cIdx++) {
    const cat = cats[cIdx] as any;
    const questions: any[] = Array.isArray(cat?.questions) ? cat.questions : [];

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const q = questions[qIdx];
      const qPath = ["exercises", "en", cIdx, "questions", qIdx] as const;

      // Stable ID shape
      const qid = String(q?.questionId || "");
      if (!QUESTION_ID_REGEX.test(qid)) {
        pushError(
          issues,
          [...qPath, "questionId"],
          `questionId must match u<UNIT>_ex<EX>_q<NN> (e.g. u2_ex5_q07). Got: '${qid}'`
        );
      }

      // Fill-in-the-blank strict blank format
      if (q?.questionType === "fillInBlank") {
        if (!hasExactlyOneFiveUnderscoreBlank(String(q?.question || ""))) {
          pushError(
            issues,
            [...qPath, "question"],
            `fillInBlank must contain exactly one blank '_____' (five underscores)`
          );
        }
      }

      // Vocabulary matching uses our single-input UI; enforce the same single-blank constraint.
      if (q?.questionType === "matching") {
        if (!hasExactlyOneFiveUnderscoreBlank(String(q?.question || ""))) {
          pushError(
            issues,
            [...qPath, "question"],
            `vocabularyMatching must contain exactly one blank '_____' (five underscores)`
          );
        }
      }

      // Dialogue completion in this product is treated as multipleChoice (must have options + answer match)
      const isDialogueCat = cat?.category === "dialogueCompletion";
      if (isDialogueCat || q?.questionType === "multipleChoice") {
        const options: string[] = Array.isArray(q?.options) ? q.options : [];
        if (options.length < 3) {
          pushError(
            issues,
            [...qPath, "options"],
            `multipleChoice/dialogueCompletion must have at least 3 options (recommended 3–4)`
          );
        }
        const ans = String(q?.correctAnswer || "");
        if (ans && options.length > 0 && !options.includes(ans)) {
          pushError(
            issues,
            [...qPath, "correctAnswer"],
            `correctAnswer must exactly match one of options (questionId=${qid})`
          );
        }
      }
    }
  }

  return issues;
}

