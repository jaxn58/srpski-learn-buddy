/**
 * Unit Brief template: single source of truth for the structured creator brief.
 *
 * Shared between the Content Studio admin UI (form-based "Brief Builder") and
 * Convex (creator prompt assembly, later: unitType/CEFR extraction for
 * module gating and the Lector). Pure TypeScript, no framework imports.
 *
 * Design:
 *   - The canonical persisted representation stays the rendered TEXT in
 *     `contentDrafts.inspirationRef.notes`, so Brief Versions, templates,
 *     Adopt and the Creator keep working unchanged.
 *   - `renderBriefText(fields)` and `parseBriefText(text)` are inverse for
 *     text produced by the renderer (round-trip safe). Legacy free-text briefs
 *     are detected (`recognized === false`) and shown in raw mode.
 *   - Field definitions are DATA, not JSX, so labels, options and help texts
 *     can later move to the database (per tenant / language school) without
 *     touching the form component.
 *
 * Field labels below are the exact markers used in the rendered text and are
 * referenced by the `cs_unit_creator` prompt (BRIEF METADATA block). Changing a
 * label is a prompt change as well.
 */

export const BRIEF_MAX_CHARS = 6000;
export const BRIEF_WARN_CHARS = 5000;

export type BriefOption = { id: string; label: string };

export const BRIEF_UNIT_TYPES: BriefOption[] = [
  { id: "standard", label: "standard" },
  { id: "review", label: "review" },
  { id: "checkpoint", label: "checkpoint" },
  { id: "exam", label: "exam" },
];

export const BRIEF_CEFR_LEVELS: BriefOption[] = [
  { id: "A1.1", label: "A1.1" },
  { id: "A1.2", label: "A1.2" },
  { id: "A2.1", label: "A2.1" },
  { id: "A2.2", label: "A2.2" },
  { id: "B1", label: "B1" },
];

export const BRIEF_STRANDS: BriefOption[] = [
  { id: "ARR", label: "ARR – Arrival & Travel" },
  { id: "SET", label: "SET – Settling In" },
  { id: "DAY", label: "DAY – Everyday Life" },
  { id: "SOC", label: "SOC – People & Social" },
  { id: "BIZ", label: "BIZ – Work & Business" },
  { id: "DIG", label: "DIG – Digital & Services" },
  { id: "GEN", label: "GEN – Cross-strand language skill" },
];

export const BRIEF_SETTINGS: BriefOption[] = [
  { id: "serbia", label: "Serbia (dinars)" },
  { id: "montenegro_coast", label: "Montenegro coast (euros)" },
  { id: "mixed", label: "mixed" },
];

export type BriefFieldKind = "select" | "text" | "textarea" | "lines";

export type BriefFieldId =
  | "unitType"
  | "cefrLevel"
  | "strand"
  | "setting"
  | "situation"
  | "canDo"
  | "grammarIn"
  | "grammarOut"
  | "chunks"
  | "recycle"
  | "pitfalls"
  | "scenes"
  | "listening"
  | "cultural"
  | "exerciseFocus"
  | "vocabularyBudget";

export interface BriefFieldDef {
  id: BriefFieldId;
  /** Exact label used as line marker in the rendered brief text. */
  label: string;
  kind: BriefFieldKind;
  required?: boolean;
  options?: BriefOption[];
  /** One-line help shown under the field. */
  help: string;
  placeholder?: string;
  rows?: number;
  /** Rendered in the compact header row (selects). */
  header?: boolean;
}

export const BRIEF_FIELDS: BriefFieldDef[] = [
  {
    id: "unitType",
    label: "Unit type",
    kind: "select",
    options: BRIEF_UNIT_TYPES,
    required: true,
    header: true,
    help: "standard = new words and one grammar target; review/checkpoint = recap only; exam = simulation.",
  },
  {
    id: "cefrLevel",
    label: "CEFR Level",
    kind: "select",
    options: BRIEF_CEFR_LEVELS,
    required: true,
    header: true,
    help: "Controls sentence length, terminology and exercise difficulty.",
  },
  {
    id: "strand",
    label: "Strand",
    kind: "select",
    options: BRIEF_STRANDS,
    required: true,
    header: true,
    help: "Thematic strand of the unit.",
  },
  {
    id: "setting",
    label: "Setting",
    kind: "select",
    options: BRIEF_SETTINGS,
    required: true,
    header: true,
    help: "Places and currency used in dialogues and exercises.",
  },
  {
    id: "situation",
    label: "Situation",
    kind: "textarea",
    required: true,
    rows: 4,
    help: "Where, who, what happens. One paragraph. Optionally end with 'Suggested key vocabulary (max 30): ...'.",
    placeholder: "Arrival day in Belgrade. The learner lands at the airport and checks into a hotel ...",
  },
  {
    id: "canDo",
    label: "Can-Do Statements",
    kind: "lines",
    required: true,
    rows: 5,
    help: "4-6 statements, one per line, e.g. 'A1.1-SOC-01: Can greet, say goodbye ...'. They become the Learning Objectives.",
    placeholder: "A1.1-SOC-01: Can greet, say goodbye and use basic politeness formulas ...",
  },
  {
    id: "grammarIn",
    label: "Grammar Target - In Scope",
    kind: "textarea",
    required: true,
    rows: 3,
    help: "Exactly one primary grammar point with the exact forms to teach.",
    placeholder: "The verb biti in 1st and 2nd person singular: ja sam, ti si, plus negation nisam, nisi ...",
  },
  {
    id: "grammarOut",
    label: "Grammar Target - Out of Scope",
    kind: "textarea",
    rows: 3,
    help: "What must NOT be introduced yet (and in which unit it comes).",
    placeholder: "biti in 3rd person and plural (Unit 7); noun cases; the particle li (Unit 2) ...",
  },
  {
    id: "chunks",
    label: "Chunks allowed",
    kind: "textarea",
    rows: 3,
    help: "Fixed phrases the unit may use without explaining their grammar, with 'preview in Unit N' where known.",
    placeholder: "\"Zovem se ...\" (My name is), \"Drago mi je\" (Nice to meet you), \"u Beogradu\" (locative preview in Unit 19) ...",
  },
  {
    id: "recycle",
    label: "Recycle from previous units",
    kind: "textarea",
    rows: 2,
    help: "Grammar and key vocabulary from earlier units to reuse. 'none' for the first unit.",
    placeholder: "biti (sam/si) from Unit 1; greetings; hvala, molim ...",
  },
  {
    id: "pitfalls",
    label: "Typical L1 pitfalls (German/English speakers)",
    kind: "lines",
    rows: 3,
    help: "2-3 typical mistakes, one per line, as WRONG -> CORRECT with a short reason. Feeds the 'Watch Out' block.",
    placeholder: "Putting the short verb form first: WRONG \"Sam Ana.\" -> CORRECT \"Ja sam Ana.\"",
  },
  {
    id: "scenes",
    label: "Dialogue scenes",
    kind: "lines",
    rows: 3,
    help: "2-3 one-line scene descriptions, one per line.",
    placeholder: "Passport control: official greets, asks for the passport ...",
  },
  {
    id: "listening",
    label: "Listening focus",
    kind: "text",
    help: "3-5 words or minimal pairs the learner should listen to and repeat (TTS).",
    placeholder: "dovidjenja, hvala, Nemacka, kljuc, izvinite",
  },
  {
    id: "cultural",
    label: "Cultural note topic",
    kind: "text",
    help: "One line; the Creator writes 4-6 neutral sentences about it.",
    placeholder: "Greetings by time of day; handshake and eye contact when introducing yourself",
  },
  {
    id: "exerciseFocus",
    label: "Exercise focus",
    kind: "textarea",
    rows: 3,
    help: "Which exercise categories carry the grammar target; what the others test.",
    placeholder: "Exercise 2 and 3 test sam/si/nisam/nisi; Exercise 1 greetings; Exercise 4 key nouns; Exercise 5 the dialogue scenes.",
  },
  {
    id: "vocabularyBudget",
    label: "Vocabulary budget",
    kind: "text",
    help: "Guideline for this unit only; empty uses the studio setting. Words needed for grammar, dialogues or exercises are always included, even above the budget.",
    placeholder: "35",
  },
];

export type BriefFields = Partial<Record<BriefFieldId, string>>;

export const BRIEF_FIELD_DEFAULTS: BriefFields = {
  unitType: "standard",
  cefrLevel: "A1.1",
  strand: "DAY",
  setting: "serbia",
};

const FIELD_BY_ID: Record<string, BriefFieldDef> = Object.fromEntries(BRIEF_FIELDS.map((f) => [f.id, f]));

function optionLabel(def: BriefFieldDef, value: string): string {
  const opt = def.options?.find((o) => o.id === value || o.label === value);
  return opt ? opt.label : value;
}

function optionId(def: BriefFieldDef, raw: string): string {
  const v = raw.trim();
  const opt = def.options?.find((o) => o.id === v || o.label === v || o.label.startsWith(v + " "));
  return opt ? opt.id : v;
}

function splitLines(value: string): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Render structured fields into the canonical brief text understood by the
 * `cs_unit_creator` prompt. Empty optional fields are omitted.
 */
export function renderBriefText(params: { moduleNumber?: number | string; fields: BriefFields }): string {
  const { moduleNumber, fields } = params;
  const out: string[] = [];
  const mod = moduleNumber !== undefined && moduleNumber !== "" ? String(moduleNumber) : "";
  if (mod) out.push(`Module: ${mod}`);

  for (const def of BRIEF_FIELDS) {
    const raw = String(fields[def.id] ?? "").trim();
    if (!raw) continue;
    if (def.kind === "select" || def.kind === "text") {
      out.push(`${def.label}: ${def.kind === "select" ? optionLabel(def, raw) : raw}`);
    } else if (def.kind === "lines") {
      const lines = splitLines(raw).map((l) => (l.startsWith("- ") ? l : `- ${l}`));
      out.push("", `${def.label}:`, ...lines);
    } else {
      out.push("", `${def.label}: ${raw}`);
    }
  }
  return out.join("\n").trim();
}

export interface ParsedBrief {
  fields: BriefFields;
  moduleNumber?: number;
  /** True when the text follows the template (at least three known labels found). */
  recognized: boolean;
}

/**
 * Parse a brief text back into fields. Tolerant to missing fields and to
 * trailing text; unknown leading text (legacy free-text briefs) ends up in
 * `situation` only when `recognized` is false and the caller asks for it.
 */
export function parseBriefText(text: string): ParsedBrief {
  const src = String(text || "").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const fields: BriefFields = {};
  let moduleNumber: number | undefined;
  let current: BriefFieldDef | null = null;
  let buffer: string[] = [];
  let found = 0;

  const flush = () => {
    if (!current) return;
    const def = current;
    const joined = buffer.join("\n").trim();
    if (def.kind === "lines") {
      fields[def.id] = splitLines(joined).map((l) => l.replace(/^-\s+/, "")).join("\n");
    } else if (def.kind === "select") {
      fields[def.id] = optionId(def, joined);
    } else {
      fields[def.id] = joined;
    }
    current = null;
    buffer = [];
  };

  for (const line of lines) {
    const moduleMatch = line.match(/^Module:\s*(\d+)\s*$/i);
    if (moduleMatch) {
      flush();
      moduleNumber = Number(moduleMatch[1]);
      found += 1;
      continue;
    }
    let matched = false;
    for (const def of BRIEF_FIELDS) {
      if (line.startsWith(def.label + ":")) {
        flush();
        current = def;
        buffer = [line.slice(def.label.length + 1).trim()].filter(Boolean);
        found += 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (current) buffer.push(line);
  }
  flush();

  return { fields, moduleNumber, recognized: found >= 3 };
}

/** Required fields that are still empty (for form validation and hints). */
export function missingRequiredBriefFields(fields: BriefFields): BriefFieldDef[] {
  return BRIEF_FIELDS.filter((def) => def.required && !String(fields[def.id] ?? "").trim());
}

export function briefFieldDef(id: BriefFieldId): BriefFieldDef {
  return FIELD_BY_ID[id];
}
