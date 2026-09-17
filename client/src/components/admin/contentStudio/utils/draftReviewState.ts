/**
 * Review state of a unit: how far its quality checks got, and whether the
 * Lector's verdict still refers to the current content. Single source of
 * truth for the amber/red signalling in the unit list, the Review step and
 * the preview button.
 */
export type ReviewSeverity = "clean" | "attention" | "failed";

export interface DraftLike {
  status?: string;
  lastSnapshotId?: string;
  lastAuditedSnapshotId?: string;
}

export interface FindingLike {
  stage?: string;
  severity?: string;
  code?: string;
  dismissed?: boolean;
}

/**
 * Lector codes that describe a defect rather than a matter of taste. Only
 * these gate the workflow: STYLE_SUGGESTION is endless by nature (there is
 * always something to polish), so it is shown but never blocks a preview.
 */
export const OBJECTIVE_FINDING_CODES = [
  "SERBIAN_ERROR",
  "TRANSLATION_MISMATCH",
  "CULTURAL_FACT_RISK",
  "DIDACTIC_GAP",
] as const;

/** A finding the author has to act on (as opposed to may act on). */
export function isObjectiveFinding(f: FindingLike): boolean {
  if (f.dismissed) return false;
  if (f.severity === "error") return true;
  if (f.severity !== "warning") return false;
  // Validator warnings are structural (parser/schema), always objective.
  if (f.stage === "validator") return true;
  return (OBJECTIVE_FINDING_CODES as readonly string[]).includes(String(f.code ?? ""));
}

/** Findings the author still has to act on. Style and info notes excluded. */
export function countOpenFindings(findings: FindingLike[] | undefined): number {
  return (findings ?? []).filter(isObjectiveFinding).length;
}

/**
 * True when the content changed after the last Lector run. Drafts audited
 * before this bookkeeping existed fall back to "has auditor findings".
 */
export function isLectorStale(draft: DraftLike | undefined, findings?: FindingLike[]): boolean {
  if (!draft?.lastSnapshotId) return false;
  if (!draft.lastAuditedSnapshotId) {
    return (findings ?? []).some((f) => f.stage === "auditor");
  }
  return String(draft.lastAuditedSnapshotId) !== String(draft.lastSnapshotId);
}

/**
 * "failed"    - a check reported a defect (validator failed, Lector blocked).
 * "attention" - open findings or a stale Lector verdict: a step is unfinished.
 * "clean"     - nothing pending.
 */
export function reviewSeverity(
  draft: DraftLike | undefined,
  findings: FindingLike[] | undefined,
): ReviewSeverity {
  const status = String(draft?.status ?? "");
  if (status === "qc_failed" || status === "audit_failed") return "failed";
  if ((findings ?? []).some((f) => f.severity === "error" && !f.dismissed)) return "failed";
  if (countOpenFindings(findings) > 0 || isLectorStale(draft, findings)) return "attention";
  return "clean";
}
