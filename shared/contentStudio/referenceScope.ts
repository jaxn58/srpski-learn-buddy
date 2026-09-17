export const REFERENCE_SLICE_MAX_CHARS = 20_000;

export function normalizeGuidelineScopeKey(chapter?: string, pages?: string): string {
  const c = String(chapter || "").trim().toLowerCase().replace(/\s+/g, " ");
  const p = String(pages || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!c && !p) return "all";
  return `${c || "-"}|${p || "-"}`;
}

export function parsePageSpec(pages?: string): number[] {
  const raw = String(pages || "").trim();
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(/[,;]+/)) {
    const token = part.trim().replace(/\s+/g, "");
    if (!token) continue;
    const range = token.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (!Number.isInteger(from) || !Number.isInteger(to)) continue;
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      for (let n = start; n <= end && n - start < 80; n += 1) out.add(n);
      continue;
    }
    const single = Number(token);
    if (Number.isInteger(single) && single > 0) out.add(single);
  }
  return [...out].sort((a, b) => a - b);
}

export function extractPageTexts(fullText: string, numpages?: number): string[] {
  const text = String(fullText || "");
  const byFormFeed = text.split("\f").map((p) => p.trim()).filter((p) => p.length > 0);
  if (byFormFeed.length > 1) return byFormFeed;

  const pages = typeof numpages === "number" && Number.isInteger(numpages) ? numpages : 0;
  if (pages > 1 && text.length > pages * 40) {
    const size = Math.ceil(text.length / pages);
    const chunks: string[] = [];
    for (let i = 0; i < pages; i += 1) {
      chunks.push(text.slice(i * size, (i + 1) * size));
    }
    return chunks;
  }
  return text.trim() ? [text] : [];
}

function findChapterSlice(text: string, chapter: string): string | null {
  const needle = chapter.trim();
  if (!needle) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(
    `(?:^|\\b)(?:chapter|kapitel|lektion|unit|lekcija)\\s*${escaped}\\b|${escaped}`,
    "i",
  );
  const headingRe = /^(?:chapter|kapitel|lektion|unit|lekcija)\s+\S+/i;

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (startRe.test((lines[i] ?? "").trim())) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    if (headingRe.test(line) && !startRe.test(line)) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim() || null;
}

export function sliceReferenceSource(args: {
  text: string;
  chapter?: string;
  pages?: string;
  pageTexts?: string[];
  maxChars?: number;
}): string {
  const maxChars = args.maxChars ?? REFERENCE_SLICE_MAX_CHARS;
  const full = String(args.text || "");
  const pageNums = parsePageSpec(args.pages);
  const pages = Array.isArray(args.pageTexts) ? args.pageTexts : [];

  let sliced = full;
  if (pageNums.length > 0 && pages.length > 0) {
    sliced = pageNums
      .map((n) => pages[n - 1] ?? "")
      .filter((p) => p.trim().length > 0)
      .join("\n\n");
  }

  const chapter = String(args.chapter || "").trim();
  if (chapter) {
    const fromChapter = findChapterSlice(sliced || full, chapter);
    if (fromChapter) sliced = fromChapter;
  }

  const source = sliced.trim() || full.trim();
  if (source.length <= maxChars) return source;
  return `${source.slice(0, maxChars)}\n[TRUNCATED]`;
}
