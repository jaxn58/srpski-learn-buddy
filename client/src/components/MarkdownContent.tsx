import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
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

/**
 * Renders Markdown content with proper styling for educational content
 * Supports: headings, lists, tables, bold, italic, code blocks, etc.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("prose prose-slate max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-10 mb-4 text-foreground border-b pb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold mt-8 mb-3 text-foreground first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-7 mb-2 text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold mt-6 mb-2 text-foreground first:mt-0">
              {children}
            </h4>
          ),
          // Use a slightly larger h5 to reduce the visual jump from h4 (used by section blocks like "Progression")
          // while still preserving hierarchy.
          h5: ({ children }) => (
            <h5 className="text-[17px] font-semibold mt-5 mb-2 text-foreground first:mt-0">
              {children}
            </h5>
          ),
          
          // Paragraphs
          p: ({ children }) => (
            <p className="mb-4 leading-7 text-foreground">
              {children}
            </p>
          ),
          
          // Lists
          ul: ({ children }) => (
            // Use list-outside so bullets align correctly when list items contain block elements (e.g. <p>).
            <ul className="list-disc list-outside mb-4 space-y-2 pl-6">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside mb-4 space-y-2 pl-6">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            // Avoid rendering empty list items (can appear due to markdown structure/whitespace)
            extractTextFromReactNode(children).trim().length === 0 ? null : (
              <li className="leading-7 text-foreground">{children}</li>
            )
          ),
          
          // Tables - Modern Design
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-border shadow-sm">
              <table className="min-w-full divide-y divide-border">
                {children}
              </table>
            </div>
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

