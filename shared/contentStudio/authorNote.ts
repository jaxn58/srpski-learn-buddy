export type AuthorNoteLang = "en" | "de";

export function detectAuthorNoteLang(text: string): AuthorNoteLang {
  const s = String(text || "");
  if (!s.trim()) return "en";
  if (/[äöüßÄÖÜ]/.test(s)) return "de";
  const hits = (s.toLowerCase().match(/\b(und|oder|wenn|nicht|aber|dann|weil|zum|zur|der|die|das|du|ihr|euch)\b/g) || [])
    .length;
  return hits >= 2 ? "de" : "en";
}

export function hasWhyThisUnitMattersBlock(markdown: string): boolean {
  return /^#{2,4}\s+Why this unit matters\b/im.test(String(markdown || ""));
}

export function whyThisUnitMattersBlock(description?: string): string {
  const body =
    String(description || "").trim() ||
    "This unit builds the language you need for the situations in the brief. Learn the forms, then use them in the dialogues and the test.";
  return [`#### Why this unit matters`, body, ``].join("\n");
}

export function restoreOriginalAuthorQuote(mdDe: string, originalQuote: string): string {
  const quote = String(originalQuote || "").trim();
  if (!quote) return String(mdDe || "");

  const lines = String(mdDe || "").replace(/\r\n/g, "\n").split("\n");
  const headingRe =
    /^(?:\s*>\s*){0,3}\s*#{0,4}\s*(?:\*{0,2}\s*)?(?:A Note from the (?:Founder|Unit Author)|Eine Notiz (?:vom|von der|des) (?:Gründer|Autor)|Hinweis des Autors)\b/i;

  let headingAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i] ?? "")) {
      headingAt = i;
      break;
    }
  }
  if (headingAt < 0) return lines.join("\n");

  let i = headingAt + 1;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i += 1;
  const quoteStart = i;
  while (i < lines.length && (lines[i] ?? "").trim().startsWith(">")) i += 1;

  const escaped = quote.replace(/"/g, '\\"');
  return [...lines.slice(0, quoteStart), `> "${escaped}"`, ...lines.slice(i)].join("\n");
}
