/**
 * Extract learner-prompt words from translator quality-guard / verifier texts.
 * Examples:
 *  - learner prompt is still English "orange".
 *  - German question prompt is still English ("orange").
 */
export function parseUntranslatedPromptGuardFailures(message: string): string[] {
  const out: string[] = [];
  const text = String(message || "");
  for (const m of text.matchAll(
    /learner prompt is still English "([^"]+)"/gi
  )) {
    const n = normalizeTerm(m[1] ?? "");
    if (n) out.push(n);
  }
  for (const m of text.matchAll(
    /still English\s*\(\s*"([^"]+)"\s*\)/gi
  )) {
    const n = normalizeTerm(m[1] ?? "");
    if (n) out.push(n);
  }
  return [...new Set(out)];
}

function normalizeTerm(term: string): string {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // matching prompts may arrive as "_____ = orange"
    .replace(/_+/g, " ")
    .replace(/^\s*=\s*/g, "")
    .replace(/\s*=\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isTranslatorQualityGuardError(message: string): boolean {
  return /Test translation quality guard failed/i.test(String(message || ""));
}

export function isUntranslatedLearnerPromptIssue(code: string | undefined): boolean {
  return code === "test_untranslated_learner_prompt";
}
