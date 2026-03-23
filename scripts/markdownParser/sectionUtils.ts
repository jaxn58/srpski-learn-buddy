/**
 * Section-based Markdown utilities
 * 
 * Enables targeted editing of individual sections without touching the rest.
 * This is more robust than full-markdown revision which can "forget" sections.
 */

// =============================================================================
// SECTION DEFINITIONS
// =============================================================================

/**
 * All recognized main sections in a Unit Markdown file.
 * The order matters for proper reassembly.
 */
export const SECTIONS = {
  overview: "## 1. Overview",
  vocabulary: "## 2. Vocabulary",
  grammar: "## 3. Grammar",
  phrases: "## 4. Phrases",
  exercises: "## 5. Interactive Test",
  cultural: "## 6. Cultural Note",
} as const;

export type SectionId = keyof typeof SECTIONS;

/**
 * Section IDs in document order (for reassembly).
 */
export const SECTION_ORDER: SectionId[] = [
  "overview",
  "vocabulary",
  "grammar",
  "phrases",
  "exercises",
  "cultural",
];

/**
 * Human-readable labels for UI display.
 */
export const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Overview",
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  phrases: "Phrases & Dialogues",
  exercises: "Interactive Test (Exercises)",
  cultural: "Cultural Note",
};

// =============================================================================
// EXTRACTION
// =============================================================================

/**
 * Extract the header/preamble (everything before ## 1. Overview).
 * This includes: # Module X:, ## Unit Y:, **Description:**, **Base Language:**, etc.
 */
export function extractPreamble(markdown: string): string {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const firstSectionIdx = normalized.indexOf(SECTIONS.overview);
  if (firstSectionIdx < 0) {
    // No overview found - return everything up to any ## heading
    const anyH2 = normalized.search(/\n##\s+/);
    if (anyH2 < 0) return normalized.trim();
    return normalized.slice(0, anyH2).trim();
  }
  return normalized.slice(0, firstSectionIdx).trim();
}

/**
 * Extract a single section from the Markdown.
 * Returns the full section including its header, or null if not found.
 * 
 * @param markdown - Full markdown content
 * @param sectionId - Which section to extract
 * @returns Section content including header, or null if not found
 */
export function extractSection(markdown: string, sectionId: SectionId): string | null {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const header = SECTIONS[sectionId];
  
  // Find start of this section
  const startIdx = normalized.indexOf(header);
  if (startIdx < 0) return null;
  
  // Find end: next "## N." section header or end of document
  const afterHeader = normalized.slice(startIdx + header.length);
  const nextSectionMatch = afterHeader.search(/\n##\s+(?:\d+\.|[A-Z]\.)\s+/);
  
  if (nextSectionMatch < 0) {
    // This is the last section - take everything to end
    return normalized.slice(startIdx).trimEnd();
  }
  
  // Include content up to (but not including) the next section
  return normalized.slice(startIdx, startIdx + header.length + nextSectionMatch).trimEnd();
}

/**
 * Extract a section by its header prefix (more flexible matching).
 * Useful for sections with variable titles like "## 6. Cultural Note: Title".
 */
export function extractSectionByPrefix(markdown: string, headerPrefix: string): string | null {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const startIdx = normalized.indexOf(headerPrefix);
  if (startIdx < 0) return null;
  
  const afterHeader = normalized.slice(startIdx + headerPrefix.length);
  const nextSectionMatch = afterHeader.search(/\n##\s+(?:\d+\.|[A-Z]\.)\s+/);
  
  if (nextSectionMatch < 0) {
    return normalized.slice(startIdx).trimEnd();
  }
  
  return normalized.slice(startIdx, startIdx + headerPrefix.length + nextSectionMatch).trimEnd();
}

/**
 * List all sections present in the Markdown.
 */
export function listSections(markdown: string): SectionId[] {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const found: SectionId[] = [];
  
  for (const id of SECTION_ORDER) {
    if (normalized.includes(SECTIONS[id])) {
      found.push(id);
    }
  }
  
  // Check for Cultural Note with variable title
  if (!found.includes("cultural")) {
    if (/##\s+(?:\d+\.|[A-Z]\.)\s*Cultural Note/i.test(normalized)) {
      found.push("cultural");
    }
  }
  
  return found;
}

// =============================================================================
// SUB-SECTION EXTRACTION (for Dialogues within Phrases)
// =============================================================================

/**
 * Extract all dialogue blocks from a Phrases section.
 * Dialogues are identified by "### Dialogue" or "### ... Dialogue ..." headings.
 * 
 * @param phrasesContent - The content of the ## 4. Phrases section
 * @returns Array of dialogue blocks, each including its ### header
 */
export function extractDialogueBlocks(phrasesContent: string): string[] {
  const normalized = String(phrasesContent || "").replace(/\r\n/g, "\n");
  const dialogues: string[] = [];
  
  // Match "### Dialogue N: Title" or "### Something Dialogue Something"
  const dialoguePattern = /^###\s+.*Dialogue.*$/gim;
  const matches = [...normalized.matchAll(dialoguePattern)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIdx = match.index!;
    
    // End is either the next ### heading or end of content
    let endIdx: number;
    if (i + 1 < matches.length) {
      endIdx = matches[i + 1].index!;
    } else {
      // Find next ### or ## heading, or end
      const remaining = normalized.slice(startIdx + match[0].length);
      const nextHeading = remaining.search(/\n###?\s+/);
      endIdx = nextHeading < 0 
        ? normalized.length 
        : startIdx + match[0].length + nextHeading;
    }
    
    dialogues.push(normalized.slice(startIdx, endIdx).trimEnd());
  }
  
  return dialogues;
}

/**
 * Extract the non-dialogue part of Phrases (Common Phrases table, etc.)
 */
export function extractPhrasesWithoutDialogues(phrasesContent: string): string {
  const normalized = String(phrasesContent || "").replace(/\r\n/g, "\n");
  
  // Find first dialogue heading
  const firstDialogue = normalized.search(/^###\s+.*Dialogue/im);
  if (firstDialogue < 0) return normalized.trimEnd();
  
  return normalized.slice(0, firstDialogue).trimEnd();
}

/**
 * Extract a specific dialogue by number (1-based).
 */
export function extractDialogueByNumber(phrasesContent: string, dialogueNum: number): string | null {
  const dialogues = extractDialogueBlocks(phrasesContent);
  if (dialogueNum < 1 || dialogueNum > dialogues.length) return null;
  return dialogues[dialogueNum - 1];
}

// =============================================================================
// REPLACEMENT
// =============================================================================

/**
 * Replace a section in the Markdown with new content.
 * The new content should include the section header.
 * 
 * @param markdown - Full markdown content
 * @param sectionId - Which section to replace
 * @param newContent - New section content (must include header)
 * @returns Updated markdown
 */
export function replaceSection(
  markdown: string, 
  sectionId: SectionId, 
  newContent: string
): string {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const header = SECTIONS[sectionId];
  
  // Find start of this section
  const startIdx = normalized.indexOf(header);
  if (startIdx < 0) {
    // Section doesn't exist - append it in the right position
    return appendSectionInOrder(normalized, sectionId, newContent);
  }
  
  // Find end: next "## N." section header or end of document
  const afterHeader = normalized.slice(startIdx + header.length);
  const nextSectionMatch = afterHeader.search(/\n##\s+(?:\d+\.|[A-Z]\.)\s+/);
  
  let endIdx: number;
  if (nextSectionMatch < 0) {
    endIdx = normalized.length;
  } else {
    endIdx = startIdx + header.length + nextSectionMatch;
  }
  
  // Replace
  const before = normalized.slice(0, startIdx).trimEnd();
  const after = normalized.slice(endIdx).trimStart();
  
  const parts = [before, newContent.trim()];
  if (after) parts.push(after);
  
  return parts.join("\n\n");
}

/**
 * Append a section in the correct document order.
 */
function appendSectionInOrder(markdown: string, sectionId: SectionId, content: string): string {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const targetOrder = SECTION_ORDER.indexOf(sectionId);
  
  // Find the last existing section that comes before this one
  let insertAfterIdx = -1;
  for (let i = targetOrder - 1; i >= 0; i--) {
    const prevHeader = SECTIONS[SECTION_ORDER[i]];
    const idx = normalized.indexOf(prevHeader);
    if (idx >= 0) {
      // Find end of that section
      const afterPrev = normalized.slice(idx + prevHeader.length);
      const nextMatch = afterPrev.search(/\n##\s+(?:\d+\.|[A-Z]\.)\s+/);
      insertAfterIdx = nextMatch < 0 
        ? normalized.length 
        : idx + prevHeader.length + nextMatch;
      break;
    }
  }
  
  if (insertAfterIdx < 0) {
    // No previous sections found - append after preamble
    const preamble = extractPreamble(normalized);
    return `${preamble}\n\n${content.trim()}`;
  }
  
  const before = normalized.slice(0, insertAfterIdx).trimEnd();
  const after = normalized.slice(insertAfterIdx).trimStart();
  
  const parts = [before, content.trim()];
  if (after) parts.push(after);
  
  return parts.join("\n\n");
}

/**
 * Replace a specific dialogue within the Phrases section.
 * 
 * @param markdown - Full markdown
 * @param dialogueNum - Which dialogue to replace (1-based)
 * @param newDialogue - New dialogue content (must include ### header)
 */
export function replaceDialogue(
  markdown: string,
  dialogueNum: number,
  newDialogue: string
): string {
  const phrases = extractSection(markdown, "phrases");
  if (!phrases) throw new Error("## 4. Phrases section not found");
  
  const dialogues = extractDialogueBlocks(phrases);
  if (dialogueNum < 1 || dialogueNum > dialogues.length) {
    throw new Error(`Dialogue ${dialogueNum} not found (have ${dialogues.length} dialogues)`);
  }
  
  // Reconstruct phrases with replaced dialogue
  const nonDialoguePart = extractPhrasesWithoutDialogues(phrases);
  const newDialogues = [...dialogues];
  newDialogues[dialogueNum - 1] = newDialogue.trim();
  
  const newPhrases = [nonDialoguePart, ...newDialogues].join("\n\n");
  
  return replaceSection(markdown, "phrases", newPhrases);
}

/**
 * Append a new dialogue to the Phrases section.
 */
export function appendDialogue(markdown: string, newDialogue: string): string {
  const phrases = extractSection(markdown, "phrases");
  if (!phrases) throw new Error("## 4. Phrases section not found");
  
  const newPhrases = `${phrases.trimEnd()}\n\n${newDialogue.trim()}`;
  return replaceSection(markdown, "phrases", newPhrases);
}

// =============================================================================
// VALIDATION (per section)
// =============================================================================

export interface SectionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a single section.
 */
export function validateSection(sectionId: SectionId, content: string): SectionValidationResult {
  const validators: Record<SectionId, (c: string) => SectionValidationResult> = {
    overview: validateOverview,
    vocabulary: validateVocabulary,
    grammar: validateGrammar,
    phrases: validatePhrases,
    exercises: validateExercises,
    cultural: validateCultural,
  };
  
  return validators[sectionId](content);
}

function validateOverview(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content.includes("## 1. Overview")) {
    errors.push("Missing section header '## 1. Overview'");
  }
  
  if (!content.includes("Learning Objectives")) {
    warnings.push("Missing 'Learning Objectives' subsection");
  }
  
  if (content.length < 200) {
    warnings.push("Overview seems too short (less than 200 characters)");
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

function validateVocabulary(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content.includes("## 2. Vocabulary")) {
    errors.push("Missing section header '## 2. Vocabulary'");
  }
  
  // Must have at least one table with Serbian | English | Notes
  if (!content.includes("| Serbian |") || !content.includes("| English |")) {
    errors.push("Missing vocabulary table with '| Serbian | English | Notes |' format");
  }
  
  // Check for duplicate Serbian keys (ignore header/separator rows across multiple tables)
  // We intentionally allow multiple tables (e.g. per category) without tripping on repeated headers.
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const serbianKeys: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    // Split table cells, dropping outer pipes.
    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;

    const serbian = cells[0];
    const english = cells[1] ?? "";

    // Skip header rows
    if (/^serbian$/i.test(serbian) && /^english$/i.test(english)) continue;
    // Skip alignment/separator rows like ":---"
    if (/^:?-{3,}:?$/.test(serbian)) continue;
    if (!serbian) continue;

    serbianKeys.push(serbian);
  }

  const duplicates = serbianKeys.filter((k, i) => serbianKeys.indexOf(k) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate Serbian keys: ${[...new Set(duplicates)].join(", ")}`);
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

function validateGrammar(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content.includes("## 3. Grammar")) {
    errors.push("Missing section header '## 3. Grammar'");
  }
  
  if (content.length < 300) {
    warnings.push("Grammar section seems too short (less than 300 characters)");
  }
  
  // Should have at least one ### subsection
  if (!/###\s+/.test(content)) {
    warnings.push("Grammar should have ### subsections for different grammar points");
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

function validatePhrases(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content.includes("## 4. Phrases")) {
    errors.push("Missing section header '## 4. Phrases'");
  }
  
  // Must have at least one dialogue
  const hasDialogues = /###\s+.*Dialogue/i.test(content);
  if (!hasDialogues) {
    errors.push("Missing dialogues: add '### Dialogue N: Title' blocks");
  }
  
  // Dialogues must use table format
  if (hasDialogues && !/\|\s*Role\s*\|\s*Serbian\s*\|\s*English\s*\|/i.test(content)) {
    errors.push("Dialogues must use table format: '| Role | Serbian | English |'");
  }
  
  // Should have common phrases table too
  if (!/\|\s*Serbian\s*\|\s*English\s*\|/i.test(content)) {
    warnings.push("Consider adding a Common Phrases table");
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

function validateExercises(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!content.includes("## 5. Interactive Test")) {
    errors.push("Missing section header '## 5. Interactive Test'");
  }
  
  // Check for all 5 exercise types
  const exerciseTypes = [
    { pattern: /###\s+Exercise\s+1.*Translation/i, name: "Translation (ex1)" },
    { pattern: /###\s+Exercise\s+2.*Fill/i, name: "Fill-in-the-Blank (ex2)" },
    { pattern: /###\s+Exercise\s+3.*Multiple\s+Choice/i, name: "Multiple Choice (ex3)" },
    { pattern: /###\s+Exercise\s+4.*Matching/i, name: "Vocabulary Matching (ex4)" },
    { pattern: /###\s+Exercise\s+5.*Dialogue/i, name: "Dialogue Completion (ex5)" },
  ];
  
  for (const { pattern, name } of exerciseTypes) {
    if (!pattern.test(content)) {
      errors.push(`Missing exercise: ${name}`);
    }
  }
  
  // Each exercise should have **Instructions:**
  const exerciseBlocks = content.split(/###\s+Exercise/).slice(1);
  for (let i = 0; i < exerciseBlocks.length; i++) {
    if (!/\*\*Instructions:\*\*/i.test(exerciseBlocks[i])) {
      warnings.push(`Exercise ${i + 1} missing '**Instructions:**' line`);
    }
  }

  // Objective quality gate: no duplicate question/sentence rows within an exercise table.
  // Duplicate prompts create ambiguous exercises (especially for fill-in-the-blank) and should fail validation.
  const normalizePrompt = (s: string): string => {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\r\n/g, "\n")
      .replace(/_+/g, "_____") // normalize blanks
      .replace(/[“”"']/g, "")
      .replace(/[.,!?;:()[\]{}]/g, "")
      .replace(/\s+/g, " ");
  };

  const parseRow = (line: string): string[] => {
    const raw = String(line || "").trim();
    const trimmed = raw.startsWith("|") ? raw.slice(1) : raw;
    const trimmed2 = trimmed.endsWith("|") ? trimmed.slice(0, -1) : trimmed;
    return trimmed2.split("|").map((c) => c.trim());
  };

  // Split full section into concrete exercise bodies by headings.
  const blocks = String(content || "").replace(/\r\n/g, "\n").split(/(?=^###\s+Exercise\s+\d+)/gm);
  const exerciseOnly = blocks.filter((b) => /^###\s+Exercise\s+\d+/m.test(b));

  for (const block of exerciseOnly) {
    const headingMatch = block.match(/^###\s+Exercise\s+(\d+)\s*:/m);
    const exNum = headingMatch?.[1] ? Number(headingMatch[1]) : null;

    // Find the first markdown table in the block
    const lines = block.split("\n");
    const firstTableIdx = lines.findIndex((l) => l.trim().startsWith("|"));
    if (firstTableIdx < 0) continue;

    // Collect contiguous table lines
    const tableLines: string[] = [];
    for (let i = firstTableIdx; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln.trim().startsWith("|")) break;
      tableLines.push(ln);
    }

    if (tableLines.length < 3) continue; // header + separator + at least one row

    const headers = parseRow(tableLines[0]).map((h) => h.toLowerCase());
    const firstColIdx = 0;
    const firstColName = headers[firstColIdx] || "prompt";

    const prompts: string[] = [];
    for (let i = 2; i < tableLines.length; i++) {
      const cells = parseRow(tableLines[i]);
      const p = cells[firstColIdx] ?? "";
      const norm = normalizePrompt(p);
      if (norm) prompts.push(norm);
    }

    if (prompts.length < 2) continue;

    const counts = new Map<string, number>();
    for (const p of prompts) counts.set(p, (counts.get(p) || 0) + 1);
    const dups = Array.from(counts.entries()).filter(([, c]) => c > 1);

    if (dups.length > 0) {
      const samples = dups
        .slice(0, 3)
        .map(([p, c]) => `"${p.slice(0, 60)}${p.length > 60 ? "…" : ""}" ×${c}`)
        .join(", ");
      errors.push(
        `Duplicate prompts in Exercise ${exNum ?? "?"} (${firstColName} column): ${samples}`
      );
    }
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

function validateCultural(content: string): SectionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Cultural note header can vary
  if (!/##\s+(?:\d+\.|[A-Z]\.)\s*Cultural Note/i.test(content)) {
    errors.push("Missing Cultural Note header");
  }
  
  if (content.length < 100) {
    warnings.push("Cultural note seems too short");
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// UTILITY: Auto-fix vocabulary duplicates on markdown level
// =============================================================================

/**
 * Remove duplicate Serbian vocabulary rows from a vocabulary section's markdown.
 * Keeps the LAST occurrence (which is typically the AI's updated version).
 * Returns { fixed, removedKeys } so callers can log what was auto-fixed.
 */
export function deduplicateVocabularySectionMarkdown(
  sectionContent: string
): { fixed: string; removedKeys: string[] } {
  const lines = sectionContent.replace(/\r\n/g, "\n").split("\n");
  const seen = new Map<string, number>();
  const linesToRemove = new Set<number>();
  const removedKeys: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;

    const serbian = cells[0];
    const english = cells[1] ?? "";

    if (/^serbian$/i.test(serbian) && /^english$/i.test(english)) continue;
    if (/^:?-{3,}:?$/.test(serbian)) continue;
    if (!serbian) continue;

    const key = serbian.toLowerCase().trim();
    if (seen.has(key)) {
      linesToRemove.add(seen.get(key)!);
      removedKeys.push(serbian);
    }
    seen.set(key, i);
  }

  if (linesToRemove.size === 0) {
    return { fixed: sectionContent, removedKeys: [] };
  }

  const fixedLines = lines.filter((_, i) => !linesToRemove.has(i));
  return { fixed: fixedLines.join("\n"), removedKeys: [...new Set(removedKeys)] };
}

// UTILITY: Reassemble full markdown from parts
// =============================================================================

export interface MarkdownParts {
  preamble: string;
  sections: Partial<Record<SectionId, string>>;
}

/**
 * Parse markdown into preamble + sections.
 */
export function parseIntoSections(markdown: string): MarkdownParts {
  const preamble = extractPreamble(markdown);
  const sections: Partial<Record<SectionId, string>> = {};
  
  for (const id of SECTION_ORDER) {
    const content = extractSection(markdown, id);
    if (content) {
      sections[id] = content;
    }
  }
  
  return { preamble, sections };
}

/**
 * Reassemble markdown from preamble + sections.
 */
export function reassembleMarkdown(parts: MarkdownParts): string {
  const orderedSections: string[] = [];
  
  for (const id of SECTION_ORDER) {
    const content = parts.sections[id];
    if (content) {
      orderedSections.push(content.trim());
    }
  }
  
  return [parts.preamble.trim(), ...orderedSections].join("\n\n");
}
