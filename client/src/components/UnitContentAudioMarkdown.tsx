import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2 } from "lucide-react";
import { useUnitContentAudioPlayback } from "@/hooks/useUnitContentAudioPlayback";

type ContentType = "phrases" | "dialogues";

type Props = {
  content: string;
  unitNumber: number;
  language: string;
  contentType: ContentType;
};

const AUDIO_VERSION_TAG = "neural2-v1";
const DEFAULT_VOICE_KEY = "default";

function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function mdastToPlainText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(mdastToPlainText).join("");
  if (typeof node.value === "string") return node.value;
  if (typeof node.alt === "string") return node.alt;
  if (node.children) return mdastToPlainText(node.children);
  return "";
}

function extractTextFromReactNode(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join("");
  if (typeof node === "object" && "props" in node) {
    return extractTextFromReactNode((node as any).props?.children);
  }
  return "";
}

function renderHastInline(node: any): React.ReactNode {
  if (!node) return null;
  if (Array.isArray(node)) return node.map((n, i) => <React.Fragment key={i}>{renderHastInline(n)}</React.Fragment>);
  if (node.type === "text") return node.value ?? "";
  if (node.type !== "element") return mdastToPlainText(node);

  const children = node.children ?? [];
  switch (node.tagName) {
    case "strong":
      return <strong className="font-bold">{renderHastInline(children)}</strong>;
    case "em":
      return <em className="italic">{renderHastInline(children)}</em>;
    case "code":
      return <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono">{renderHastInline(children)}</code>;
    case "a":
      return (
        <a
          href={node.properties?.href}
          className="text-primary hover:underline font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          {renderHastInline(children)}
        </a>
      );
    case "p":
    case "span":
      return <span>{renderHastInline(children)}</span>;
    default:
      return mdastToPlainText(node);
  }
}

function cleanSerbianForTts(text: string): string {
  // Remove common footnote markers like "*", "**" used in content notes
  // Keep punctuation and diacritics intact.
  return text
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSerbianLinesFromMarkdownTables(content: string): string[] {
  // Lightweight extractor for "Play all": find GFM tables and pick the column containing "Serbian".
  // We keep it conservative: if we cannot confidently detect a Serbian column, we return an empty list for that table.
  const lines: string[] = [];
  const blocks = content.split(/\n-{3,}\n/g); // split by horizontal rules
  for (const block of blocks) {
    const tableStart = block.indexOf("|");
    if (tableStart === -1) continue;

    const tableLines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && l.endsWith("|"));

    if (tableLines.length < 2) continue;

    const header = tableLines[0];
    const headers = header
      .split("|")
      .slice(1, -1)
      .map((h) => h.replace(/\*/g, "").trim().toLowerCase());

    // Accept translated header labels too ("Serbisch", "Srpski", etc.).
    const serbianIdx = headers.findIndex(
      (h) => h === "serbian" || h.includes("serbian") || h.includes("serbisch") || h.includes("srpski") || h.includes("srp")
    );
    if (serbianIdx < 0) continue;

    for (const row of tableLines.slice(2)) {
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((c) => cleanSerbianForTts(c));
      const cell = cells[serbianIdx] || "";
      if (cell) lines.push(cell);
    }
  }
  return lines;
}

function AudioTable({
  node,
  unitNumber,
  language,
  contentType,
  play,
  playingTextHash,
  loadingTextHash,
}: {
  node: any;
  unitNumber: number;
  language: string;
  contentType: ContentType;
  play: ReturnType<typeof useUnitContentAudioPlayback>["play"];
  playingTextHash: string | null;
  loadingTextHash: string | null;
}) {
  // NOTE: react-markdown passes a HAST node here (not MDAST).
  // With remark-gfm tables, the structure is: table -> thead/tbody -> tr -> th/td.
  if (!node || node.type !== "element" || node.tagName !== "table") return null;

  const tableChildren: any[] = Array.isArray(node.children) ? node.children : [];
  const thead = tableChildren.find((c) => c?.type === "element" && c.tagName === "thead");
  const tbody = tableChildren.find((c) => c?.type === "element" && c.tagName === "tbody");

  const headTr = thead?.children?.find((c: any) => c?.type === "element" && c.tagName === "tr");
  const headCells: any[] = Array.isArray(headTr?.children) ? headTr.children : [];
  const headers = headCells
    .filter((c) => c?.type === "element" && (c.tagName === "th" || c.tagName === "td"))
    .map((c) => mdastToPlainText(c).replace(/\*/g, "").trim());

  const headerKey = headers.map((h) => h.toLowerCase());
  const serbianIdx = headerKey.findIndex(
    (h) => h === "serbian" || h.includes("serbian") || h.includes("serbisch") || h.includes("srpski") || h.includes("srp")
  );
  const hasSerbian = serbianIdx >= 0;

  // Some ASTs may not include explicit <tbody>; be robust and fall back to any direct <tr> children
  // that are not part of <thead>.
  const bodyContainerChildren: any[] = Array.isArray(tbody?.children)
    ? tbody.children
    : tableChildren.filter((c: any) => c?.type === "element" && c.tagName === "tr");
  const bodyRows: any[] = bodyContainerChildren.filter((c: any) => c?.type === "element" && c.tagName === "tr");

  return (
    <div className="overflow-x-auto my-6 rounded-lg border border-border shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-gradient-to-r from-serbian-blue/10 to-serbian-blue/5">
          <tr>
            {headers.map((h, idx) => (
              <th
                key={idx}
                className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border/50">
          {bodyRows.map((rowNode, rowIdx) => {
            const cells: any[] = Array.isArray(rowNode?.children)
              ? rowNode.children.filter(
                  (c: any) => c?.type === "element" && (c.tagName === "td" || c.tagName === "th")
                )
              : [];
            return (
              <tr key={rowIdx} className="hover:bg-muted/3 transition-colors duration-150">
                {cells.map((cellNode, cellIdx) => {
                  const rawText = mdastToPlainText(cellNode);
                  const cellText = cleanSerbianForTts(rawText);
                  const isSerbianCell = hasSerbian && cellIdx === serbianIdx;
                  const hasAudioText = isSerbianCell && cellText.length > 0;
                  const cellHash = hasAudioText
                    ? fnv1a32Hex(`${AUDIO_VERSION_TAG}::${DEFAULT_VOICE_KEY}::${cellText}`)
                    : null;
                  const isPlaying = !!cellHash && playingTextHash === cellHash;
                  const showSpinner = !!cellHash && loadingTextHash === cellHash;

                  return (
                    <td key={cellIdx} className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground align-top">
                      {hasAudioText ? (
                        <div className="flex items-start gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="mt-0.5"
                            onClick={() =>
                              play({
                                unitNumber,
                                language,
                                contentType,
                                textSr: cellText,
                              })
                            }
                            disabled={!!loadingTextHash}
                            aria-label={loadingTextHash ? "Generating audio" : "Play pronunciation"}
                            title={loadingTextHash ? "Generating audio..." : "Play pronunciation"}
                          >
                            {showSpinner ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Volume2 className={`h-4 w-4 ${isPlaying ? "text-primary" : "text-muted-foreground"}`} />
                            )}
                          </Button>
                          <span>{cellText}</span>
                        </div>
                      ) : (
                        <span>{renderHastInline(cellNode.children ?? [])}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function UnitContentAudioMarkdown({ content, unitNumber, language, contentType }: Props) {
  const { play, stop, loadingTextHash, playingTextHash } = useUnitContentAudioPlayback();

  const allLines = React.useMemo(() => extractSerbianLinesFromMarkdownTables(content), [content]);

  const playAll = React.useCallback(async () => {
    stop();
    for (const line of allLines) {
      await play({ unitNumber, language, contentType, textSr: line });
    }
  }, [allLines, contentType, language, play, stop, unitNumber]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={playAll}
          disabled={allLines.length === 0 || !!loadingTextHash}
          title={allLines.length === 0 ? "No playable Serbian lines detected" : "Play all Serbian lines"}
        >
          Play all
        </Button>
      </div>

      <div className="prose prose-slate max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node }: any) => (
              <AudioTable
                node={node}
                unitNumber={unitNumber}
                language={language}
                contentType={contentType}
                play={play}
                playingTextHash={playingTextHash}
                loadingTextHash={loadingTextHash}
              />
            ),
            // Keep typography consistent with existing MarkdownContent
            h1: ({ children }) => (
              <h1 className="text-3xl font-bold mt-10 mb-4 text-foreground border-b pb-2 first:mt-0">{children}</h1>
            ),
            h2: ({ children }) => <h2 className="text-2xl font-bold mt-8 mb-3 text-foreground first:mt-0">{children}</h2>,
            h3: ({ children }) => <h3 className="text-xl font-semibold mt-7 mb-2 text-foreground first:mt-0">{children}</h3>,
            h4: ({ children }) => <h4 className="text-lg font-semibold mt-6 mb-2 text-foreground first:mt-0">{children}</h4>,
            h5: ({ children }) => <h5 className="text-[17px] font-semibold mt-5 mb-2 text-foreground first:mt-0">{children}</h5>,
            p: ({ children }) => <p className="mb-4 leading-7 text-foreground">{children}</p>,
            // Use list-outside so bullets align correctly when list items contain block elements (e.g. <p>).
            ul: ({ children }) => <ul className="list-disc list-outside mb-4 space-y-2 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-outside mb-4 space-y-2 pl-6">{children}</ol>,
            li: ({ children }) =>
              extractTextFromReactNode(children).trim().length === 0 ? null : (
                <li className="leading-7 text-foreground">{children}</li>
              ),
            strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
            em: ({ children }) => <em className="italic text-foreground">{children}</em>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">{children}</blockquote>
            ),
            hr: () => <hr className="my-8 border-t border-border" />,
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

