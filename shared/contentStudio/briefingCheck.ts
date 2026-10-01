import {
  BRIEF_FIELDS,
  parseBriefText,
  renderBriefText,
  type BriefFieldId,
  type BriefFields,
} from "./briefTemplate";

const CORRECTABLE_FIELD_IDS = new Set<string>(
  BRIEF_FIELDS.filter((field) => field.kind !== "select").map((field) => field.id),
);

/**
 * Writes corrected field texts into the briefing. Select fields stay as they are.
 * Returns null when nothing in the text changes.
 */
export function applyBriefingFieldCorrections(
  brief: string,
  patches: Record<string, string>,
): string | null {
  const parsed = parseBriefText(brief);
  if (!parsed.recognized) return null;
  const fields: BriefFields = { ...parsed.fields };
  let changed = false;
  for (const [id, value] of Object.entries(patches)) {
    if (!CORRECTABLE_FIELD_IDS.has(id)) continue;
    const next = String(value ?? "").trim();
    if (!next) continue;
    if (next === String(fields[id as BriefFieldId] ?? "").trim()) continue;
    fields[id as BriefFieldId] = next;
    changed = true;
  }
  if (!changed) return null;
  return renderBriefText({ moduleNumber: parsed.moduleNumber, fields });
}

/**
 * Gate between a finished briefing and the Creator.
 *
 * The linguistic judgement lives in the model call. This module only decides
 * whether a stored stamp still belongs to the briefing text the Creator would
 * read. No grammar rules live here.
 */

export interface BriefingContradiction {
  quoteA: string;
  quoteB: string;
  reason: string;
}

export interface BriefingCheckStamp {
  notesHash: string;
  ok: boolean;
  contradictions: BriefingContradiction[];
  checkedAt: number;
  model: string;
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable id of the briefing text. Line endings do not change the id. */
export function hashBriefingText(text: string): string {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").trim();
  const seeds = [0x811c9dc5, 0x01000193, (0x811c9dc5 ^ normalized.length) >>> 0, 0x9e3779b9];
  return seeds.map((seed) => fnv1a(normalized, seed).toString(16).padStart(8, "0")).join("");
}

/** The Creator may start only when this stamp passed for this exact text. */
export function briefingStampAllowsCreator(
  notes: string,
  stamp: BriefingCheckStamp | null | undefined,
): boolean {
  if (!stamp || stamp.ok !== true) return false;
  return stamp.notesHash === hashBriefingText(notes);
}
