import type { SectionId } from "../types";

/**
 * Client-side mirror of the section header markers in
 * scripts/markdownParser/sectionUtils.ts (SECTIONS / extractSection). Cannot
 * import that file directly: it lives outside the Vite client root
 * (client/vite.config.ts sets `root: client/`, `server.fs.strict: true`) and
 * would be blocked by the dev server's filesystem boundary. Keep these
 * header strings in sync manually if the Markdown structure changes.
 */
const SECTION_HEADERS: Record<SectionId, string> = {
  overview: "## 1. Overview",
  vocabulary: "## 2. Vocabulary",
  grammar: "## 3. Grammar",
  phrases: "## 4. Phrases",
  exercises: "## 5. Interactive Test",
  cultural: "## 6. Cultural Note",
};

const SECTION_ORDER: SectionId[] = ["overview", "vocabulary", "grammar", "phrases", "exercises", "cultural"];

const NEXT_SECTION_RE = /\n##\s+(?:\d+\.|[A-Z]\.)\s+/;

export interface MarkdownSectionBlock {
  id: SectionId;
  content: string;
}

/**
 * Split full unit Markdown into its known sections (in document order). Used
 * by the "Rendered" preview so each section can carry its own "Adopt into
 * Brief" action. Falls back to an empty array if no known header is found
 * (caller should then render the full markdown as a single block).
 */
export function splitMarkdownIntoSections(markdown: string): MarkdownSectionBlock[] {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const blocks: MarkdownSectionBlock[] = [];

  for (const id of SECTION_ORDER) {
    const header = SECTION_HEADERS[id];
    const startIdx = normalized.indexOf(header);
    if (startIdx < 0) continue;

    const afterHeader = normalized.slice(startIdx + header.length);
    const nextMatch = afterHeader.search(NEXT_SECTION_RE);
    const content =
      nextMatch < 0
        ? normalized.slice(startIdx).trimEnd()
        : normalized.slice(startIdx, startIdx + header.length + nextMatch).trimEnd();

    blocks.push({ id, content });
  }

  // Cultural Note headers may carry a variable title (e.g. "## 6. Cultural Note: Coffee Culture").
  if (!blocks.some((b) => b.id === "cultural")) {
    const match = normalized.match(/##\s+(?:\d+\.|[A-Z]\.)\s*Cultural Note.*/i);
    if (match && typeof match.index === "number") {
      const startIdx = match.index;
      const afterHeader = normalized.slice(startIdx + match[0].length);
      const nextMatch = afterHeader.search(NEXT_SECTION_RE);
      const content =
        nextMatch < 0
          ? normalized.slice(startIdx).trimEnd()
          : normalized.slice(startIdx, startIdx + match[0].length + nextMatch).trimEnd();
      blocks.push({ id: "cultural", content });
    }
  }

  return blocks;
}
