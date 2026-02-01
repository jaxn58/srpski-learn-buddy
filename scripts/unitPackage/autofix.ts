import type { UnitPackage, UnitPackageExerciseCategory, UnitPackageVocabularyEntry } from "./schema";

export type AutoFixChange = {
  kind:
    | "sanitizeSerbian"
    | "splitVocabularyEntry"
    | "splitVocabularyGenderVariant"
    | "splitEnglishAlt"
    | "mergeExerciseCategories"
    | "normalizeChoiceOption"
    | "normalizeCorrectAnswer";
  path: Array<string | number>;
  before: unknown;
  after: unknown;
  note?: string;
};

const PUNCTUATION_DETECT_REGEX = /[.?!,:;]/;
const PUNCTUATION_REPLACE_REGEX = /[.?!,:;]/g;

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripChoicePrefix(input: unknown): string {
  const s = typeof input === "string" ? input : String(input ?? "");
  // "A) Text", "a) Text", "a. Text"
  return normalizeWhitespace(s.replace(/^\s*[A-Da-d](\)|\.)\s+/, ""));
}

function normalizeChoiceValue(input: unknown): string {
  // Normalize for robust matching (without changing displayed text semantics too much)
  return normalizeWhitespace(String(input ?? "").replace(/[.?!,:;]+$/g, ""));
}

function mapLetterAnswerToOption(correct: string, options: string[]): string | null {
  const trimmed = String(correct ?? "").trim();
  const m = trimmed.match(/^([A-Da-d])(\)|\.)?$/);
  if (!m) return null;
  const idx = m[1].toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  return options[idx] ?? null;
}

function detectGenderMarker(s: string): "m" | "f" | "n" | null {
  const lower = s.toLowerCase();
  // We only trust explicit markers in parentheses to avoid false positives.
  if (/\(m\)/.test(lower) || /\(m\.\)/.test(lower)) return "m";
  if (/\(f\)/.test(lower) || /\(f\.\)/.test(lower)) return "f";
  if (/\(n\)/.test(lower) || /\(n\.\)/.test(lower)) return "n";
  return null;
}

function removeGenderMarkersFromSerbian(s: string): string {
  return normalizeWhitespace(
    s
      .replace(/\((m|f|n)\.?\)/gi, "")
  );
}

function sanitizeSerbianForAudio(raw: string): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  let s = String(raw ?? "");

  // Remove Montenegro markers
  if (s.includes("*")) {
    removed.push("*");
    s = s.replace(/\*/g, "");
  }

  // Remove slashes here? (handled by split step) – but clean accidental leftover slashes safely
  if (s.includes("/")) {
    removed.push("/");
    s = s.replace(/\s*\/\s*/g, " ");
  }

  // Remove punctuation that breaks audio generation / indexing
  if (PUNCTUATION_DETECT_REGEX.test(s)) {
    removed.push("punctuation");
    s = s.replace(PUNCTUATION_REPLACE_REGEX, "");
  }

  // Remove quotes
  s = s.replace(/[“”"]/g, "");

  s = normalizeWhitespace(s);
  return { cleaned: s, removed };
}

function splitBySlash(raw: string): string[] {
  // Split on " / " or "/" if used as separator. Keep simple and safe.
  const s = String(raw ?? "");
  if (!s.includes("/")) return [s];
  return s.split("/").map((p) => normalizeWhitespace(p)).filter(Boolean);
}

function appendNote(existing: string | undefined, extra: string): string {
  const base = existing ? existing.trim() : "";
  if (!base) return extra;
  if (base.includes(extra)) return base;
  return `${base}\n${extra}`;
}

function expandVocabularyEntry(
  entry: UnitPackageVocabularyEntry
): Array<UnitPackageVocabularyEntry> {
  // Split Serbian variants "A / B"
  const parts = splitBySlash(entry.serbian);
  if (parts.length <= 1) return [entry];

  return parts.map((serbianPart) => ({
    ...entry,
    serbian: serbianPart,
  }));
}

function applyGenderSplit(
  entry: UnitPackageVocabularyEntry
): Array<UnitPackageVocabularyEntry> {
  // Handles patterns like "Dobrodošao (m)" and "Dobrodošla (f)" (already split by slash in many cases)
  const gender = detectGenderMarker(entry.serbian);
  if (!gender) return [entry];

  const cleanedSerbian = removeGenderMarkersFromSerbian(entry.serbian);
  const genderText = gender === "m" ? "masculine" : gender === "f" ? "feminine" : "neuter";
  return [
    {
      ...entry,
      serbian: cleanedSerbian,
      gender,
      noteEn: appendNote(entry.noteEn, `Gender: ${genderText}`),
    },
  ];
}

function splitEnglishAlt(entry: UnitPackageVocabularyEntry): UnitPackageVocabularyEntry {
  if (entry.enAlt && entry.enAlt.trim()) return entry;
  if (!entry.en.includes("/")) return entry;
  const parts = splitBySlash(entry.en);
  if (parts.length < 2) return entry;
  return { ...entry, en: parts[0], enAlt: parts[1] };
}

function normalizeExerciseCategories(
  categories: UnitPackageExerciseCategory[],
  changes: AutoFixChange[],
  basePath: Array<string | number>
): UnitPackageExerciseCategory[] {
  const byKey = new Map<string, UnitPackageExerciseCategory[]>();
  for (const c of categories) {
    const list = byKey.get(c.category) ?? [];
    list.push(c);
    byKey.set(c.category, list);
  }

  const result: UnitPackageExerciseCategory[] = [];
  for (const [catKey, list] of byKey.entries()) {
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }

    const mergedQuestions = list.flatMap((c) => c.questions);
    mergedQuestions.sort((a, b) => a.order - b.order);
    const instructionsUnique = Array.from(
      new Set(list.map((c) => c.categoryInstructions.trim()).filter(Boolean))
    );
    const mergedInstructions = instructionsUnique.join("\n\n");

    changes.push({
      kind: "mergeExerciseCategories",
      path: basePath,
      before: list.map((c) => ({ category: c.category, questions: c.questions.length })),
      after: { category: catKey, questions: mergedQuestions.length },
      note: `Merged ${list.length} blocks of category '${catKey}'`,
    });

    result.push({
      category: catKey,
      categoryInstructions: mergedInstructions || list[0].categoryInstructions,
      questions: mergedQuestions,
    });
  }

  // Keep deterministic order by first question order
  result.sort((a, b) => {
    const aMin = Math.min(...a.questions.map((q) => q.order));
    const bMin = Math.min(...b.questions.map((q) => q.order));
    return aMin - bMin;
  });
  return result;
}

export function autofixUnitPackage(pkg: UnitPackage): {
  fixed: UnitPackage;
  changes: AutoFixChange[];
} {
  const changes: AutoFixChange[] = [];

  // 1) Vocabulary: split, gender, sanitize, english alt split
  const vocabFixed: UnitPackage["vocabulary"] = { ...pkg.vocabulary };
  for (const lang of pkg.languages) {
    const list = pkg.vocabulary[lang] ?? [];
    const newList: UnitPackageVocabularyEntry[] = [];

    for (let i = 0; i < list.length; i++) {
      const original = list[i];

      // a) split serbian variants
      let expanded = expandVocabularyEntry(original);
      if (expanded.length > 1) {
        changes.push({
          kind: "splitVocabularyEntry",
          path: ["vocabulary", lang, i, "serbian"],
          before: original.serbian,
          after: expanded.map((e) => e.serbian),
        });
      }

      // b) gender extraction (per expanded entry)
      const genderApplied: UnitPackageVocabularyEntry[] = [];
      for (const e of expanded) {
        const before = e.serbian;
        const afterGender = applyGenderSplit(e);
        if (afterGender.length === 1 && afterGender[0].serbian !== before) {
          changes.push({
            kind: "splitVocabularyGenderVariant",
            path: ["vocabulary", lang, i, "serbian"],
            before,
            after: afterGender[0].serbian,
          });
        }
        genderApplied.push(...afterGender);
      }

      // c) sanitize Serbian for audio
      for (const e of genderApplied) {
        const { cleaned } = sanitizeSerbianForAudio(e.serbian);
        const cleanedGenderRemoved = sanitizeSerbianForAudio(removeGenderMarkersFromSerbian(cleaned)).cleaned;

        if (cleanedGenderRemoved !== e.serbian) {
          changes.push({
            kind: "sanitizeSerbian",
            path: ["vocabulary", lang],
            before: e.serbian,
            after: cleanedGenderRemoved,
          });
        }

        let nextEntry: UnitPackageVocabularyEntry = { ...e, serbian: cleanedGenderRemoved };
        nextEntry = splitEnglishAlt(nextEntry);
        if (nextEntry.enAlt && !e.enAlt && e.en.includes("/")) {
          changes.push({
            kind: "splitEnglishAlt",
            path: ["vocabulary", lang],
            before: e.en,
            after: { en: nextEntry.en, enAlt: nextEntry.enAlt },
          });
        }

        newList.push(nextEntry);
      }
    }

    // d) Merge duplicate Serbian entries (keep first, merge notes)
    const deduped: UnitPackageVocabularyEntry[] = [];
    const seenKeys = new Map<string, number>(); // normalized serbian -> index in deduped
    for (const entry of newList) {
      const key = entry.serbian.toLowerCase().trim();
      const existingIdx = seenKeys.get(key);
      
      if (existingIdx !== undefined) {
        // Merge into existing entry
        const existing = deduped[existingIdx];
        const mergedNotes: string[] = [];
        if (existing.noteEn) mergedNotes.push(existing.noteEn);
        if (entry.noteEn && entry.noteEn !== existing.noteEn) mergedNotes.push(entry.noteEn);
        if (entry.en && entry.en !== existing.en) {
          mergedNotes.push(`AlsoMeaning: ${entry.en}`);
        }
        
        if (mergedNotes.length > 0) {
          existing.noteEn = mergedNotes.join("; ");
        }
        
        changes.push({
          kind: "mergeDuplicateVocabulary" as any,
          path: ["vocabulary", lang],
          before: entry.serbian,
          after: `merged into existing '${existing.serbian}'`,
        });
      } else {
        seenKeys.set(key, deduped.length);
        deduped.push(entry);
      }
    }

    vocabFixed[lang] = deduped;
  }

  // 2) Exercises: merge duplicate categories per language; normalize options/correctAnswer
  const exercisesFixed: UnitPackage["exercises"] = { ...pkg.exercises };
  for (const lang of pkg.languages) {
    const categories = pkg.exercises[lang] ?? [];
    let fixedCats = normalizeExerciseCategories(categories, changes, ["exercises", lang]);

    fixedCats = fixedCats.map((cat, cIdx) => {
      const fixedQuestions = cat.questions.map((q, qIdx) => {
        if (q.questionType !== "multipleChoice") {
          return q;
        }

        const beforeOptions = q.options ?? [];
        const afterOptions = beforeOptions.map((opt) => normalizeChoiceValue(stripChoicePrefix(opt))).filter(Boolean);
        if (JSON.stringify(beforeOptions) !== JSON.stringify(afterOptions)) {
          changes.push({
            kind: "normalizeChoiceOption",
            path: ["exercises", lang, cIdx, "questions", qIdx, "options"],
            before: beforeOptions,
            after: afterOptions,
          });
        }

        const beforeCorrect = q.correctAnswer;
        let afterCorrect = normalizeChoiceValue(stripChoicePrefix(beforeCorrect));
        if (beforeCorrect !== afterCorrect) {
          changes.push({
            kind: "normalizeCorrectAnswer",
            path: ["exercises", lang, cIdx, "questions", qIdx, "correctAnswer"],
            before: beforeCorrect,
            after: afterCorrect,
          });
        }

        // Ensure correctAnswer exactly matches one of the normalized options.
        // Common model failure: correctAnswer is "A" / "B" / "C" / "D".
        if (afterOptions.length > 0 && afterCorrect && !afterOptions.includes(afterCorrect)) {
          const mapped = mapLetterAnswerToOption(String(beforeCorrect ?? ""), afterOptions);
          if (mapped) {
            changes.push({
              kind: "normalizeCorrectAnswer",
              path: ["exercises", lang, cIdx, "questions", qIdx, "correctAnswer"],
              before: afterCorrect,
              after: mapped,
              note: "Mapped letter answer (A/B/C/D) to option text",
            });
            afterCorrect = mapped;
          } else {
            // Try a looser match (case-insensitive) to find the exact stored option string.
            const target = afterCorrect.toLowerCase();
            const found = afterOptions.find((o) => o.toLowerCase() === target);
            if (found) {
              afterCorrect = found;
            }
          }
        }

        return {
          ...q,
          options: afterOptions.length ? afterOptions : q.options,
          correctAnswer: afterCorrect,
        };
      });

      return { ...cat, questions: fixedQuestions };
    });

    exercisesFixed[lang] = fixedCats;
  }

  return {
    fixed: {
      ...pkg,
      vocabulary: vocabFixed,
      exercises: exercisesFixed,
    },
    changes,
  };
}

