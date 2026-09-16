import { SECTION_LABELS, SectionId } from "../../scripts/markdownParser/sectionUtils";

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT KEY REGISTRY -- Central mapping of DB keys used in chatPrompts table.
// All prompts are stored exclusively in the chatPrompts table (DB-only).
// No code-level fallbacks -- actions abort if a required prompt is missing.
// ═══════════════════════════════════════════════════════════════════════════

export type ContentStudioPromptKey =
  | "cs_unit_creator"
  | "cs_finding_fixer"
  | "cs_lector"
  | "cs_brief_assistant"
  | "cs_language_rules"
  | `cs_section_${string}`;

export const CS_PROMPT_KEYS = {
  unitCreator: "cs_unit_creator",
  findingFixer: "cs_finding_fixer",
  lector: "cs_lector",
  /** Turns a free-text unit description plus the course context into a structured briefing. */
  briefAssistant: "cs_brief_assistant",
  /**
   * Shared Serbian language rules (clitics, Ekavian norm, script). Optional:
   * appended to Creator, Section revise, Finding fixer and Lector when present.
   */
  languageRules: "cs_language_rules",
  section: (id: SectionId) => `cs_section_${id}` as const,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ALL SECTION IDs that need a prompt in the DB (for validation/preview)
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_SECTION_IDS: SectionId[] = [
  "overview",
  "vocabulary",
  "grammar",
  "phrases",
  "exercises",
  "cultural",
];

// ═══════════════════════════════════════════════════════════════════════════
// USER PROMPT TEMPLATE (parser-coupled, stays in code)
// This template defines the Markdown structure that the parser expects.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Ping-Pong: Brief <-> Markdown — curated sections block
// Renders human-adopted, reviewed sections (contentDrafts.curatedSections)
// into a prompt block that tells the AI to build upon them (soft variant:
// refine wording/consistency, but never discard the human's substance).
// ═══════════════════════════════════════════════════════════════════════════

export function buildCuratedSectionsBlock(
  curatedSections: Array<{ section: SectionId; markdown: string }> | undefined | null
): string {
  const list = Array.isArray(curatedSections) ? curatedSections : [];
  if (list.length === 0) return "";

  return [
    `═══════════════════════════════════════════════════════════════════════════`,
    `HUMAN-CURATED SECTIONS (authoritative basis — build upon, do not discard)`,
    `═══════════════════════════════════════════════════════════════════════════`,
    `A human reviewed a previous generation of this unit and explicitly adopted`,
    `the section(s) below into the brief. Treat their content as the authoritative`,
    `basis for that section: preserve its substance and additions. You MAY refine`,
    `wording, fix errors, and improve consistency with the rest of the unit, but`,
    `do NOT remove, contradict, or substantially rewrite what the human approved.`,
    ``,
    ...list.map((c) =>
      [`--- ${SECTION_LABELS[c.section] || c.section} (curated by human) ---`, c.markdown.trim(), ``].join("\n")
    ),
  ].join("\n");
}

export const getSpecialistUserPromptBase = (
  d: any,
  unitTitleOneLine: string,
  unitDescriptionOneLine: string,
  creatorBriefBlock: string,
  previousVocabKeys: string[] = [],
  curatedSectionsBlock: string = ""
) => [
  `Write the full unit as Markdown with this exact top structure:`,
  ``,
  `# Module ${d.moduleNumber}: ${String((d as any).moduleTitle || "").trim() || "Ankommen (Arrival)"}`,
  `## Unit ${d.unitNumber}: ${unitTitleOneLine || `Unit ${d.unitNumber}`}`,
  ``,
  `**Description:** ${unitDescriptionOneLine || "One short English sentence (max ~120 chars)."}`,
  ``,
  `**Base Language:** English`,
  `**Target Language:** Serbian`,
  ``,
  `---`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `KNOWN VOCABULARY (${previousVocabKeys.length} words already taught in previous units)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  // Full known-vocabulary list up to a generous cap. 75 units x ~25 words is
  // below 2,000 entries (~4k tokens), so the Creator normally sees everything
  // and never re-teaches a word by accident.
  previousVocabKeys.length > 0
    ? previousVocabKeys.slice(0, 2000).join(", ") + (previousVocabKeys.length > 2000 ? " ... (truncated)" : "")
    : "(This is Unit 1 - no previous vocabulary)",
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `REQUIRED SECTIONS (parser-validated structure)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `## 1. Overview`,
  `## 2. Vocabulary (Vokabular)`,
  `## 3. Grammar (Gramatika)`,
  `## 4. Phrases (Practical Application)`,
  `## 5. Interactive Test (Exercises)`,
  `Optional:`,
  `## 6. Cultural Note: <Title>`,
  ``,
  creatorBriefBlock ? `${creatorBriefBlock}\n` : ``,
  curatedSectionsBlock ? `${curatedSectionsBlock}\n` : ``,
].join("\n");
