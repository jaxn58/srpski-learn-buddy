import { Fragment, type ReactNode } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Tighter type scale below the md breakpoint. Desktop classes stay unchanged. */
  compactOnMobile?: boolean;
}

function extractTextFromReactNode(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join("");
  // React element-like
  if (typeof node === "object" && "props" in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractTextFromReactNode((node as any).props?.children);
  }
  return "";
}

function plainHast(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(plainHast).join("");
  if (typeof node === "object" && node !== null) {
    const record = node as { value?: unknown; children?: unknown };
    if (typeof record.value === "string") return record.value;
    if (record.children) return plainHast(record.children);
  }
  return "";
}

function renderHastInline(node: unknown): ReactNode {
  if (!node) return null;
  if (Array.isArray(node)) {
    return node.map((child, index) => <Fragment key={index}>{renderHastInline(child)}</Fragment>);
  }
  if (typeof node !== "object") return null;
  const record = node as { type?: string; value?: string; tagName?: string; children?: unknown; properties?: { href?: string } };
  if (record.type === "text") return record.value ?? "";
  if (record.type !== "element") return plainHast(node);

  const children = record.children;
  switch (record.tagName) {
    case "strong":
      return <strong className="font-bold">{renderHastInline(children)}</strong>;
    case "em":
      return <em className="italic">{renderHastInline(children)}</em>;
    case "code":
      return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{renderHastInline(children)}</code>;
    case "a":
      return (
        <a href={record.properties?.href} className="font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          {renderHastInline(children)}
        </a>
      );
    default:
      return renderHastInline(children);
  }
}

export function isSerbianHeader(header: string): boolean {
  const normalized = header.toLowerCase();
  return normalized === "serbian" || normalized.includes("serbian") || normalized.includes("serbisch") || normalized.includes("srpski") || normalized.includes("srp");
}

function headerStem(header: string): string {
  return header
    .replace(/\*/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/['"„“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isGlossHeader(header: string): boolean {
  return /^(deutsch|german|english|englisch|translation|übersetzung|uebersetzung|meaning|bedeutung)$/i.test(headerStem(header));
}

export function isNoteHeader(header: string): boolean {
  return /^(notes?|anmerkungen?|beispiele?|examples?|aussprache.*|pronunciation.*|kommentar|comment)$/i.test(headerStem(header));
}

export function formCaption(header: string): string | null {
  const text = header.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const paren = text.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1]?.trim()) return paren[1].trim();
  const bare = headerStem(header);
  if (!bare || isGlossHeader(header) || isNoteHeader(header) || /^(person|persons|pronoun|pronomen|form|forms|letter|letters|buchstabe)$/i.test(bare)) {
    return null;
  }
  return bare;
}

export function isCompactForm(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  return normalized.length > 0 && normalized.length <= 28 && words.length <= 3;
}

export function StackedMarkdownTable({ node, className }: { node: unknown; className?: string }) {
  const table = node as { type?: string; tagName?: string; children?: unknown[] } | null;
  if (!table || table.type !== "element" || table.tagName !== "table") return null;

  const tableChildren = Array.isArray(table.children) ? table.children : [];
  const thead = tableChildren.find((child) => (child as { tagName?: string }).tagName === "thead") as { children?: unknown[] } | undefined;
  const tbody = tableChildren.find((child) => (child as { tagName?: string }).tagName === "tbody") as { children?: unknown[] } | undefined;
  const headRow = thead?.children?.find((child) => (child as { tagName?: string }).tagName === "tr") as { children?: unknown[] } | undefined;
  const headCells = (headRow?.children ?? []).filter((child) => {
    const tag = (child as { tagName?: string }).tagName;
    return tag === "th" || tag === "td";
  });
  const headers = headCells.map((cell) => plainHast(cell).replace(/\*/g, "").trim());
  const serbianIdx = headers.findIndex((header) => isSerbianHeader(header) || isSerbianHeader(headerStem(header)));
  const anchorIdx = serbianIdx >= 0 ? serbianIdx : 0;

  const bodySource = Array.isArray(tbody?.children)
    ? tbody.children
    : tableChildren.filter((child) => (child as { tagName?: string }).tagName === "tr");
  const bodyRows = bodySource.filter((child) => (child as { tagName?: string }).tagName === "tr");

  return (
    <div className={cn("my-4 divide-y overflow-hidden rounded-lg border border-border bg-card md:hidden", className)}>
      {bodyRows.map((rowNode, rowIdx) => {
        const cells = ((rowNode as { children?: unknown[] }).children ?? []).filter((child) => {
          const tag = (child as { tagName?: string }).tagName;
          return tag === "td" || tag === "th";
        });
        const entries = cells.map((cell, cellIdx) => ({
          cell,
          cellIdx,
          header: headers[cellIdx] ?? "",
          text: plainHast(cell).replace(/\s+/g, " ").trim(),
        }));
        const anchor = entries.find((entry) => entry.cellIdx === anchorIdx) ?? entries[0];
        const formEntries = entries.filter((entry) => {
          if (!anchor || entry.cellIdx === anchor.cellIdx) return false;
          if (isGlossHeader(entry.header) || isNoteHeader(entry.header)) return false;
          return isCompactForm(entry.text);
        });
        const useGrid = formEntries.length >= 2;
        const stacked = entries.filter((entry) => {
          if (!anchor || entry.cellIdx === anchor.cellIdx) return false;
          if (useGrid && formEntries.some((form) => form.cellIdx === entry.cellIdx)) return false;
          return true;
        });

        return (
          <div key={rowIdx} className="px-3 py-3">
            {anchor ? (
              <div className="text-[15px] font-semibold leading-snug text-foreground">
                {renderHastInline((anchor.cell as { children?: unknown }).children)}
              </div>
            ) : null}
            {useGrid ? (
              <div className={cn("mt-2 grid gap-x-4 gap-y-2", formEntries.length >= 3 ? "grid-cols-3" : "grid-cols-2")}>
                {formEntries.map((entry) => {
                  const caption = formCaption(entry.header);
                  return (
                    <div key={entry.cellIdx} className="min-w-0">
                      <div className="text-[15px] font-semibold leading-tight text-foreground">
                        {renderHastInline((entry.cell as { children?: unknown }).children)}
                      </div>
                      {caption ? (
                        <div className="text-xs leading-4 text-muted-foreground">{caption}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {stacked.length > 0 ? (
              <div className={cn("space-y-0.5", anchor ? "mt-1" : "")}>
                {stacked.map((entry) => (
                  <div
                    key={entry.cellIdx}
                    className={isNoteHeader(entry.header) ? "text-xs leading-5 text-muted-foreground" : "text-sm leading-5 text-muted-foreground"}
                  >
                    {renderHastInline((entry.cell as { children?: unknown }).children)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders Markdown content with proper styling for educational content
 * Supports: headings, lists, tables, bold, italic, code blocks, etc.
 */
export function MarkdownContent({ content, className, compactOnMobile = false }: MarkdownContentProps) {
  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className={cn("text-3xl font-bold mt-10 mb-4 text-foreground border-b pb-2 first:mt-0", compactOnMobile && "max-md:text-2xl max-md:mt-6 max-md:mb-2.5")}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn("text-2xl font-bold mt-8 mb-3 text-foreground first:mt-0", compactOnMobile && "max-md:text-lg max-md:mt-5 max-md:mb-2")}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn("text-xl font-semibold mt-7 mb-2 text-foreground first:mt-0", compactOnMobile && "max-md:text-base max-md:mt-4 max-md:mb-1.5")}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={cn("text-lg font-semibold mt-6 mb-2 text-foreground first:mt-0", compactOnMobile && "max-md:text-[15px] max-md:mt-4 max-md:mb-1.5")}>
              {children}
            </h4>
          ),
          // Use a slightly larger h5 to reduce the visual jump from h4 (used by section blocks like "Progression")
          // while still preserving hierarchy.
          h5: ({ children }) => (
            <h5 className={cn("text-[17px] font-semibold mt-5 mb-2 text-foreground first:mt-0", compactOnMobile && "max-md:text-sm max-md:mt-3 max-md:mb-1.5")}>
              {children}
            </h5>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className={cn("mb-4 leading-7 text-foreground", compactOnMobile && "max-md:mb-2.5 max-md:text-[15px] max-md:leading-[1.4]")}>
              {children}
            </p>
          ),
          
          // Lists
          ul: ({ children }) => (
            // Use list-outside so bullets align correctly when list items contain block elements (e.g. <p>).
            <ul className={cn("list-disc list-outside mb-4 space-y-2 pl-6", compactOnMobile && "max-md:mb-2.5 max-md:space-y-1")}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={cn("list-decimal list-outside mb-4 space-y-2 pl-6", compactOnMobile && "max-md:mb-2.5 max-md:space-y-1")}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            // Avoid rendering empty list items (can appear due to markdown structure/whitespace)
            extractTextFromReactNode(children).trim().length === 0 ? null : (
              <li className={cn("leading-7 text-foreground", compactOnMobile && "max-md:text-[15px] max-md:leading-5")}>{children}</li>
            )
          ),
          
          // Tables - Modern Design
          table: ({ node, children }: { node?: unknown; children?: ReactNode }) => (
            <>
              <div className="my-6 hidden overflow-x-auto rounded-lg border border-border shadow-sm md:block">
                <table className="min-w-full divide-y divide-border">
                  {children}
                </table>
              </div>
              <StackedMarkdownTable node={node} />
            </>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-serbian-blue/10 to-serbian-blue/5">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-card divide-y divide-border/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/3 transition-colors duration-150">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs md:text-sm font-semibold text-foreground uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-foreground">
              {children}
            </td>
          ),
          
          // Emphasis
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">
              {children}
            </em>
          ),
          
          // Code
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-foreground">
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("block p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono", className)}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto">
              {children}
            </pre>
          ),
          
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          
          // Horizontal rule
          hr: () => (
            <hr className="my-8 border-t border-border" />
          ),
          
          // Links
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
  );
}

