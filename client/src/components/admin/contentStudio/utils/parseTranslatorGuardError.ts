/**
 * Extract EN=DE identity terms from translator quality-guard / verifier texts.
 * Examples:
 *  - learner prompt is still English "orange".
 *  - fill-in source cue is still English "(park)".
 *  - German question prompt is still English ("orange").
 */
export function parseUntranslatedPromptGuardFailures(message: string): string[] {
  const out: string[] = [];
  const text = String(message || "");
  const patterns = [
    /fill-in source cue is still English "\(([^)]+)\)"/gi,
    /learner prompt is still English "([^"]+)"/gi,
    /still English\s*\(\s*"([^"]+)"\s*\)/gi,
    /still English "\(([^)]+)\)"/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const n = extractCandidateTerm(m[1] ?? "");
      if (n) out.push(n);
    }
  }
  return [...new Set(out)];
}

function normalizeTerm(term: string): string {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_+/g, " ")
    .replace(/^\s*=\s*/g, "")
    .replace(/\s*=\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCandidateTerm(raw: string): string {
  const n = normalizeTerm(
    String(raw || "")
      .replace(/^[\s(]+/, "")
      .replace(/[\s)]+$/, "")
  );
  if (!n || /[.!?…]/.test(n)) return "";
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return "";
  return n;
}

export function collectCognateCandidatesFromResult(res: unknown): string[] {
  const stats = (res as { translationStats?: { cognateCandidates?: unknown; steps?: Array<{ qualityIssues?: string[] }> } } | null)
    ?.translationStats;
  const fromStats = Array.isArray(stats?.cognateCandidates)
    ? stats.cognateCandidates.map((t) => extractCandidateTerm(String(t))).filter(Boolean)
    : [];
  if (fromStats.length > 0) return [...new Set(fromStats)];
  const issues = (stats?.steps ?? []).flatMap((s) => s.qualityIssues ?? []);
  return parseUntranslatedPromptGuardFailures(issues.join("\n"));
}

export function isTranslatorQualityGuardError(message: string): boolean {
  return /Test translation quality guard failed/i.test(String(message || ""));
}

export function isUntranslatedLearnerPromptIssue(code: string | undefined): boolean {
  return code === "test_untranslated_learner_prompt";
}

export function partitionTranslatorQualityIssues(
  issues: readonly string[],
  savedCognates: Set<string>
): { pendingCognate: string[]; acceptedCognate: string[]; other: string[] } {
  const pendingCognate: string[] = [];
  const acceptedCognate: string[] = [];
  const other: string[] = [];
  for (const issue of issues) {
    const terms = parseUntranslatedPromptGuardFailures(issue);
    if (terms.length === 0) {
      other.push(issue);
      continue;
    }
    if (terms.every((t) => savedCognates.has(t))) acceptedCognate.push(issue);
    else pendingCognate.push(issue);
  }
  return { pendingCognate, acceptedCognate, other };
}

export function shortVerifierErrorMessage(message: string): string {
  return String(message || "")
    .replace(/\s*Preview:\s*[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}
