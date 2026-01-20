import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Chat-only Markdown renderer.
 *
 * Intentionally uses tighter spacing than unit content.
 * Keep this separate from `MarkdownContent` so chat/units can evolve independently.
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

const chatMarkdownComponents = {
  p: ({ node, ...props }: any) => <p className="mb-2 leading-snug" {...props} />,
  ul: ({ node, ...props }: any) => (
    <ul className="list-disc list-outside ml-4 mb-3 space-y-1.5" {...props} />
  ),
  ol: ({ node, ...props }: any) => (
    <ol className="list-decimal list-outside ml-4 mb-3 space-y-1.5" {...props} />
  ),
  li: ({ node, children, ...props }: any) =>
    extractTextFromReactNode(children).trim().length === 0 ? null : (
      <li className="mb-0.5" {...props}>
        {children}
      </li>
    ),
  code: ({ node, inline, ...props }: any) =>
    inline ? (
      <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
    ) : (
      <code className="block bg-muted/80 p-3 rounded-md text-xs font-mono overflow-x-auto mb-3" {...props} />
    ),
  pre: ({ node, children, ...props }: any) => (
    <pre className="mb-3" {...props}>
      {children}
    </pre>
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm border-collapse border border-border" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => <thead className="bg-muted/60" {...props} />,
  tbody: ({ node, ...props }: any) => <tbody {...props} />,
  tr: ({ node, ...props }: any) => <tr className="border-b border-border" {...props} />,
  th: ({ node, ...props }: any) => (
    <th className="text-left font-semibold p-2 border-r border-border last:border-r-0" {...props} />
  ),
  td: ({ node, ...props }: any) => <td className="p-2 border-r border-border last:border-r-0" {...props} />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-primary/50 pl-3 italic mb-3 text-muted-foreground" {...props} />
  ),
  h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold mb-2 mt-2 first:mt-0" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-bold text-foreground" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  hr: ({ node, ...props }: any) => <hr className="my-4 border-border" {...props} />,
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

