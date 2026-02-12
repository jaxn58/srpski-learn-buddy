import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Chat-only Markdown renderer.
 *
 * Kept minimal and flat: one dominant text size, little hierarchy (like WhatsApp/Viber).
 * No large headings or heavy bold – focus on readable conversation, not document layout.
 */
function extractTextFromReactNode(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join("");
  if (typeof node === "object" && "props" in node) {
    return extractTextFromReactNode((node as any).props?.children);
  }
  return "";
}

/** Same size as body, minimal emphasis – chat-style, not document-style */
const chatMarkdownComponents = {
  p: ({ node, ...props }: any) => <p className="mb-3 leading-snug" {...props} />,
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5" {...props} />
  ),
  li: ({ node, children, ...props }: any) =>
    extractTextFromReactNode(children).trim().length === 0 ? null : (
      <li className="mb-0.5" {...props}>
        {children}
      </li>
    ),
  code: ({ node, inline, ...props }: any) =>
    inline ? (
      <code className="bg-muted/70 px-1 py-0.5 rounded font-mono" {...props} />
    ) : (
      <code className="block bg-muted/70 p-2 rounded font-mono overflow-x-auto mb-2" {...props} />
    ),
  pre: ({ node, children, ...props }: any) => (
    <pre className="mb-2" {...props}>
      {children}
    </pre>
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full border-collapse border border-border" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => <thead className="bg-muted/50" {...props} />,
  tbody: ({ node, ...props }: any) => <tbody {...props} />,
  tr: ({ node, ...props }: any) => <tr className="border-b border-border" {...props} />,
  th: ({ node, ...props }: any) => (
    <th className="text-left font-medium p-2 border-r border-border last:border-r-0" {...props} />
  ),
  td: ({ node, ...props }: any) => <td className="p-2 border-r border-border last:border-r-0" {...props} />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-2 border-border pl-3 mb-2 opacity-90" {...props} />
  ),
  /* Headings as same-size lines with light emphasis only (no big type scale) */
  h1: ({ node, ...props }: any) => <p className="font-medium mb-1.5 mt-3 first:mt-0" {...props} />,
  h2: ({ node, ...props }: any) => <p className="font-medium mb-1 mt-2 first:mt-0" {...props} />,
  h3: ({ node, ...props }: any) => <p className="font-medium mb-1 mt-1.5 first:mt-0" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-medium text-foreground" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  hr: ({ node, ...props }: any) => <hr className="my-3 border-border" {...props} />,
};

export function ChatMarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

