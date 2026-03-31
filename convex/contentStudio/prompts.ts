import { SectionId } from "../../scripts/markdownParser/sectionUtils";

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT KEY REGISTRY -- Central mapping of DB keys used in chatPrompts table.
// All prompts are stored exclusively in the chatPrompts table (DB-only).
// No code-level fallbacks -- actions abort if a required prompt is missing.
// ═══════════════════════════════════════════════════════════════════════════

export type ContentStudioPromptKey =
  | "cs_unit_creator"
  | "cs_finding_fixer"
  | "cs_lector"
  | `cs_section_${string}`;

export const CS_PROMPT_KEYS = {
  unitCreator: "cs_unit_creator",
  findingFixer: "cs_finding_fixer",
  lector: "cs_lector",
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

export const getSpecialistUserPromptBase = (
  d: any,
  unitTitleOneLine: string,
  unitDescriptionOneLine: string,
  creatorBriefBlock: string,
  previousVocabKeys: string[] = []
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
  `CONTEXT: KNOWN VOCABULARY`,
  `═══════════════════════════════════════════════════════════════════════════`,
  `The learner ALREADY KNOWS these words from previous units (${previousVocabKeys.length} words):`,
  previousVocabKeys.length > 0 
    ? previousVocabKeys.slice(0, 300).join(", ") + (previousVocabKeys.length > 300 ? " ... (truncated)" : "")
    : "(This is Unit 1 - no previous vocabulary)",
  ``,
  `RULES FOR VOCABULARY:`,
  `1. Do NOT add these words to the "## 2. Vocabulary" table again.`,
  `2. You CAN (and SHOULD) use them in sentences/dialogues for review.`,
  `3. Only add TRULY NEW words to the Vocabulary table.`,
  `4. English column must contain ONLY the translation.`,
  `5. Gender variants belong in Notes (e.g., "Gender: masculine/feminine"), not in the English cell.`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `SECTION 1: OVERVIEW (CRITICAL - MUST MATCH UNIT 1/2 FORMAT EXACTLY)`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `## 1. Overview`,
  ``,
  `MANDATORY STRUCTURE (follow EXACTLY as in Unit 1 & 2):`,
  ``,
  `#### A Note from the Founder (Jacksenn)`,
  ``,
  `> "Write a personal, motivating story from the founder's perspective (2-5 sentences).`,
  `> Use first-person ("I", "my", "me"). Be emotional and encouraging.`,
  `> Connect the unit topic to a real-life experience or challenge.`,
  `> End with motivation: 'This unit is about...' or 'This unit gives you...'`,
  `> Example tone: 'When I first arrived in Montenegro, I was terrified to speak. But the moment I said Dobar dan to a shopkeeper and she smiled back, I knew I was on the right path.'`,
  `> CRITICAL: Keep it SHORT (max 5 sentences). No academic tone. Be human."`,
  ``,
  `#### Learning Objectives`,
  ``,
  `By the end of this unit, **we** will be able to:`,
  ``,
  `1. **Use strong action verbs** to describe concrete skills (e.g., "Greet people", "Ask questions", "Use the verb biti")`,
  `2. **Be specific and practical** - what exactly can the learner DO after this unit?`,
  `3. **Keep it to 5-7 objectives** - focused, not overwhelming`,
  `4. **Always use "we"** (not "you") to create a learning-together feeling`,
  `5. **Format as numbered list** with clear, actionable items`,
  ``,
  `OPTIONAL (after Learning Objectives):`,
  ``,
  `**Progression:**`,
  `- **Prerequisites (Known from earlier units):** Basic greetings, personal pronouns, etc.`,
  `- **New in this Unit:**`,
  `    - **New Vocabulary:** <brief list>`,
  `    - **New Grammar:** <brief list>`,
  ``,
  `═══════════════════════════════════════════════════════════════════════════`,
  `OTHER SECTIONS`,
  `═══════════════════════════════════════════════════════════════════════════`,
  ``,
  `## 2. Vocabulary (Vokabular)`,
  `## 3. Grammar (Gramatika)`,
  `## 4. Phrases (Practical Application)`,
  `## 5. Interactive Test (Exercises)`,
  `Optional:`,
  `## 6. Cultural Note: <Title>`,
  ``,
  `Constraints:`,
  `- Keep vocabulary entries <= 30.`,
  `- Keep dialogues <= 4, short.`,
  `- Exercises: 6 rows per exercise block (ex1..ex5).`,
  `- Keep everything concise.`,
  creatorBriefBlock ? `\n${creatorBriefBlock}\n` : ``,
].join("\n");
