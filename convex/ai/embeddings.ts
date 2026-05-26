/**
 * Embedding utilities for RAG v3+
 *
 * Supports two providers with automatic fallback:
 *   1. Gemini text-embedding-004 (768 dims) - primary, uses GEMINI_API_KEY
 *   2. OpenAI text-embedding-3-small (768 dims) - fallback, uses OPENAI_API_KEY
 *
 * Both providers are configured for 768 dimensions for consistency.
 */

const EMBEDDING_DIMENSIONS = 768;

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const GEMINI_EMBEDDINGS_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/embeddings";

const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

function getEmbeddingProvider(): {
  url: string;
  model: string;
  apiKey: string;
} {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      url: GEMINI_EMBEDDINGS_URL,
      model: GEMINI_EMBEDDING_MODEL,
      apiKey: geminiKey,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      url: OPENAI_EMBEDDINGS_URL,
      model: OPENAI_EMBEDDING_MODEL,
      apiKey: openaiKey,
    };
  }

  throw new Error(
    "No embedding API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY."
  );
}

/**
 * Embed a single text string into a 768-dimensional vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const { url, model, apiKey } = getEmbeddingProvider();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

/**
 * Embed multiple texts in a single batch request.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { url, model, apiKey } = getEmbeddingProvider();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Split text into chunks of approximately `maxChars` characters,
 * breaking at paragraph boundaries when possible.
 *
 * Heuristic: ~4 chars per token, so maxChars=1600 ~ 400 tokens.
 */
export function chunkText(text: string, maxChars: number = 1600): string[] {
  if (text.length <= maxChars) return [text.trim()].filter(Boolean);

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? "\n\n" : "") + trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxChars) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let buf = "";
      for (const s of sentences) {
        if (buf.length + s.length + 1 > maxChars && buf.length > 0) {
          result.push(buf.trim());
          buf = s;
        } else {
          buf += (buf ? " " : "") + s;
        }
      }
      if (buf.trim()) result.push(buf.trim());
    }
  }

  return result.filter((c) => c.length > 20);
}
