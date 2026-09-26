/**
 * Deterministic check of the course plan against units that exist.
 *
 * A planned Can-Do is covered only when every target unit exists and that
 * unit's briefing contains the Can-Do id. A planned grammar target is covered
 * only when the unit exists and every form named in the plan (text in
 * backticks) appears in the briefing's "Grammar Target - In Scope" section.
 * Review, checkpoint and exam rows name no new forms; they are covered when
 * the unit exists.
 *
 * Started means at least the unit exists, but the briefing does not yet
 * contain everything the plan assigns to it. Open means no target unit exists.
 */

export type PlanItemStatus = "covered" | "started" | "open";

export type CanDoTargetCheck = {
  unitNumber: number;
  unitExists: boolean;
  idInBriefing: boolean;
};

export type CanDoCoverage = {
  canDoId: string;
  statementEn: string;
  targetNote?: string;
  status: PlanItemStatus;
  targets: CanDoTargetCheck[];
};

export type GrammarCoverage = {
  unitNumber: number;
  unitType: "standard" | "review" | "checkpoint" | "exam";
  titleEn: string;
  primaryGrammarEn: string;
  status: PlanItemStatus;
  missingMarkers: string[];
};

export type ModulePlanCoverage = {
  moduleNumber: number;
  canDoCovered: number;
  canDoStarted: number;
  canDoOpen: number;
  canDoTotal: number;
  grammarCovered: number;
  grammarStarted: number;
  grammarOpen: number;
  grammarTotal: number;
  canDos: CanDoCoverage[];
  grammar: GrammarCoverage[];
};

const CAN_DO_ID = /\b((?:A1\.1|A1\.2|A2\.1|A2\.2|B1)-[A-Z]{3}-\d{2})\b/g;

export function extractCanDoIds(briefing: string): Set<string> {
  return new Set(Array.from(briefing.matchAll(CAN_DO_ID), (m) => m[1]));
}

/** Paragraph after "Grammar Target - In Scope:" up to the next blank line or field. */
export function extractGrammarSection(briefing: string): string {
  const m = briefing.match(/Grammar Target - In Scope:\s*([\s\S]*?)(?:\n\s*\n|\n[A-Z][^\n:]{2,60}:|$)/);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

/**
 * Forms the plan names as the grammar target. Backtick groups are split on
 * commas and slashes (`sam, si`, `u/na`) so each form is checked on its own.
 */
export function grammarMarkers(primaryGrammarEn: string): string[] {
  const tokens: string[] = [];
  for (const phrase of primaryGrammarEn.matchAll(/`([^`]+)`/g)) {
    for (const part of phrase[1].split(/[,/]/)) {
      const token = part.trim();
      if (token.length > 0) tokens.push(token);
    }
  }
  return Array.from(new Set(tokens));
}

function isLetterOrNumber(ch: string): boolean {
  return ch !== "" && /[\p{L}\p{N}]/u.test(ch);
}

/** True when `marker` occurs as its own word, not inside a longer word. */
export function markerPresent(haystack: string, marker: string): boolean {
  const h = haystack.toLowerCase();
  const m = marker.toLowerCase();
  if (!m) return false;
  let from = 0;
  while (from < h.length) {
    const i = h.indexOf(m, from);
    if (i < 0) return false;
    const before = i === 0 ? "" : h.charAt(i - 1);
    const afterIndex = i + m.length;
    const after = afterIndex >= h.length ? "" : h.charAt(afterIndex);
    if (!isLetterOrNumber(before) && !isLetterOrNumber(after)) return true;
    from = i + 1;
  }
  return false;
}

export function canDoStatus(targets: CanDoTargetCheck[]): PlanItemStatus {
  if (targets.length === 0) return "open";
  if (targets.every((t) => t.unitExists && t.idInBriefing)) return "covered";
  if (targets.some((t) => t.unitExists)) return "started";
  return "open";
}

export function grammarItemStatus(
  unitExists: boolean,
  primaryGrammarEn: string,
  grammarSection: string,
): { status: PlanItemStatus; missingMarkers: string[] } {
  const markers = grammarMarkers(primaryGrammarEn);
  if (!unitExists) return { status: "open", missingMarkers: markers };
  if (markers.length === 0) return { status: "covered", missingMarkers: [] };
  const missingMarkers = markers.filter((marker) => !markerPresent(grammarSection, marker));
  if (missingMarkers.length === 0) return { status: "covered", missingMarkers: [] };
  return { status: "started", missingMarkers };
}

function countStatus<T extends { status: PlanItemStatus }>(items: T[]) {
  let covered = 0;
  let started = 0;
  let open = 0;
  for (const item of items) {
    if (item.status === "covered") covered += 1;
    else if (item.status === "started") started += 1;
    else open += 1;
  }
  return { covered, started, open, total: items.length };
}

export function buildModulePlanCoverage(args: {
  moduleNumber: number;
  units: Array<{
    unitNumber: number;
    unitType: GrammarCoverage["unitType"];
    titleEn: string;
    primaryGrammarEn: string;
  }>;
  canDos: Array<{
    canDoId: string;
    statementEn: string;
    targetUnits: number[];
    targetNote?: string;
  }>;
  unitExists: (unitNumber: number) => boolean;
  briefing: (unitNumber: number) => string;
}): ModulePlanCoverage {
  const unitNumbers = new Set(args.units.map((u) => u.unitNumber));

  const canDos: CanDoCoverage[] = args.canDos
    .filter((c) => c.targetUnits.some((n) => unitNumbers.has(n)))
    .map((c) => {
      const targets = c.targetUnits.map((unitNumber) => {
        const unitExists = args.unitExists(unitNumber);
        const idInBriefing = unitExists && extractCanDoIds(args.briefing(unitNumber)).has(c.canDoId);
        return { unitNumber, unitExists, idInBriefing };
      });
      const row: CanDoCoverage = {
        canDoId: c.canDoId,
        statementEn: c.statementEn,
        status: canDoStatus(targets),
        targets,
      };
      if (c.targetNote && c.targetNote.trim()) row.targetNote = c.targetNote.trim();
      return row;
    })
    .sort((a, b) => a.canDoId.localeCompare(b.canDoId));

  const grammar: GrammarCoverage[] = [...args.units]
    .sort((a, b) => a.unitNumber - b.unitNumber)
    .map((u) => {
      const unitExists = args.unitExists(u.unitNumber);
      const section = unitExists ? extractGrammarSection(args.briefing(u.unitNumber)) : "";
      const { status, missingMarkers } = grammarItemStatus(unitExists, u.primaryGrammarEn, section);
      return {
        unitNumber: u.unitNumber,
        unitType: u.unitType,
        titleEn: u.titleEn,
        primaryGrammarEn: u.primaryGrammarEn,
        status,
        missingMarkers,
      };
    });

  const canDoCounts = countStatus(canDos);
  const grammarCounts = countStatus(grammar);
  return {
    moduleNumber: args.moduleNumber,
    canDoCovered: canDoCounts.covered,
    canDoStarted: canDoCounts.started,
    canDoOpen: canDoCounts.open,
    canDoTotal: canDoCounts.total,
    grammarCovered: grammarCounts.covered,
    grammarStarted: grammarCounts.started,
    grammarOpen: grammarCounts.open,
    grammarTotal: grammarCounts.total,
    canDos,
    grammar,
  };
}
