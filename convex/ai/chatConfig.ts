import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { generateText, streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Id } from "../_generated/dataModel";
import type { TokenUsage } from "../energy";
import { buildChatTools } from "./chatTools";

export type ChatAiConfig = {
  primaryProvider: string;
  primaryModel: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  maxTokens: number;
  temperature?: number;
  useAgenticRag?: boolean;
  enableSemanticSearch?: boolean;
};

const DEFAULT_CONFIG: ChatAiConfig = {
  primaryProvider: "google",
  primaryModel: "gemini-2.5-flash",
  fallbackProvider: "openai",
  fallbackModel: "gpt-4o-mini",
  maxTokens: 4096,
};

export async function resolveModelConfig(
  ctx: { runQuery: ActionCtx["runQuery"] }
): Promise<ChatAiConfig> {
  let dbConfig: ChatAiConfig | null = null;
  try {
    dbConfig = await ctx.runQuery(internal.admin.internalGetChatAiConfig, {});
  } catch {
    // DB config not available yet
  }

  const config = { ...(dbConfig ?? DEFAULT_CONFIG) };

  const hasGoogle = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  if (!hasGoogle && !hasOpenAI) {
    throw new Error(
      "No AI API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY in Convex environment variables."
    );
  }

  if (config.primaryProvider === "google" && !hasGoogle) {
    config.primaryProvider = "openai";
    config.primaryModel = config.fallbackModel ?? "gpt-4o-mini";
  } else if (config.primaryProvider === "openai" && !hasOpenAI) {
    config.primaryProvider = "google";
    config.primaryModel = config.fallbackModel ?? "gemini-2.5-flash";
  }

  return config;
}

type FetchParams = {
  url: string;
  model: string;
  apiKey: string;
  headers: Record<string, string>;
};

function buildFetchParams(provider: string, model: string): FetchParams {
  if (provider === "google") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model,
      apiKey,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    return {
      url: "https://api.openai.com/v1/chat/completions",
      model,
      apiKey,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string | URL; mediaType: string }
  | { type: "file"; data: string | URL; mediaType: string };

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiContentPart[];
};

export type StreamChatResult = {
  text: string;
  truncated: boolean;
  usage: TokenUsage | null;
  model: string;
};

const FALLBACK_RESPONSE = "I'm sorry, I couldn't generate a response.";

export async function generateChatResponse(
  config: ChatAiConfig,
  messages: AiMessage[]
): Promise<string> {
  try {
    return await doGenerate(
      config.primaryProvider, config.primaryModel, config, messages
    );
  } catch (primaryError) {
    if (!config.fallbackProvider || !config.fallbackModel) throw primaryError;

    try {
      buildFetchParams(config.fallbackProvider, config.fallbackModel);
    } catch {
      throw primaryError;
    }

    console.warn(
      `Primary ${config.primaryProvider}/${config.primaryModel} failed, trying fallback:`,
      primaryError
    );

    return await doGenerate(
      config.fallbackProvider, config.fallbackModel, config, messages
    );
  }
}

function toOpenAiContent(content: string | AiContentPart[]): string | Array<Record<string, unknown>> {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") {
      const imgSrc = part.image instanceof URL
        ? part.image.toString()
        : `data:${part.mediaType};base64,${part.image}`;
      return { type: "image_url", image_url: { url: imgSrc } };
    }
    const fileSrc = part.data instanceof URL
      ? part.data.toString()
      : `data:${part.mediaType};base64,${part.data}`;
    return { type: "image_url", image_url: { url: fileSrc } };
  });
}

async function doGenerate(
  provider: string,
  model: string,
  config: ChatAiConfig,
  messages: AiMessage[]
): Promise<string> {
  const params = buildFetchParams(provider, model);

  const response = await fetch(params.url, {
    method: "POST",
    headers: params.headers,
    body: JSON.stringify({
      model: params.model,
      messages: messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
      max_tokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${provider}/${model}): ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
}

export async function streamChatResponse(
  config: ChatAiConfig,
  messages: AiMessage[],
  onChunk: (delta: string) => Promise<void>
): Promise<StreamChatResult> {
  try {
    return await doStream(
      config.primaryProvider, config.primaryModel, config, messages, onChunk
    );
  } catch (primaryError) {
    if (!config.fallbackProvider || !config.fallbackModel) throw primaryError;

    try {
      buildFetchParams(config.fallbackProvider, config.fallbackModel);
    } catch {
      throw primaryError;
    }

    console.warn(
      `Primary stream ${config.primaryProvider}/${config.primaryModel} failed, trying fallback:`,
      primaryError
    );

    return await doStream(
      config.fallbackProvider, config.fallbackModel, config, messages, onChunk
    );
  }
}

async function doStream(
  provider: string,
  model: string,
  config: ChatAiConfig,
  messages: AiMessage[],
  onChunk: (delta: string) => Promise<void>
): Promise<StreamChatResult> {
  const params = buildFetchParams(provider, model);

  const response = await fetch(params.url, {
    method: "POST",
    headers: params.headers,
    body: JSON.stringify({
      model: params.model,
      messages: messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
      max_tokens: config.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI stream error (${provider}/${model}): ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body stream");

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let finishReason: string | null = null;
  let usage: TokenUsage | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          await onChunk(delta);
        }
        const reason = parsed.choices?.[0]?.finish_reason;
        if (reason) finishReason = reason;
        if (parsed.usage) {
          usage = {
            inputTokens: parsed.usage.prompt_tokens ?? 0,
            outputTokens: parsed.usage.completion_tokens ?? 0,
          };
        }
      } catch {
        // skip malformed SSE chunks
      }
    }
  }

  return {
    text: fullText || FALLBACK_RESPONSE,
    truncated: finishReason === "length",
    usage,
    model,
  };
}

type SdkTextStream = {
  textStream: AsyncIterable<string>;
  finishReason: PromiseLike<string | undefined>;
  usage: PromiseLike<
    | {
        inputTokens?: number;
        outputTokens?: number;
        promptTokens?: number;
        completionTokens?: number;
      }
    | undefined
  >;
};

async function collectSdkTextStream(
  result: SdkTextStream,
  model: string,
  onChunk: (delta: string) => Promise<void>
): Promise<StreamChatResult> {
  let fullText = "";
  for await (const part of result.textStream) {
    if (part) {
      fullText += part;
      await onChunk(part);
    }
  }
  const finishReason = await result.finishReason;
  const rawUsage = await result.usage;
  const usage: TokenUsage | null = rawUsage
    ? {
        inputTokens: rawUsage.inputTokens ?? rawUsage.promptTokens ?? 0,
        outputTokens: rawUsage.outputTokens ?? rawUsage.completionTokens ?? 0,
      }
    : null;
  return {
    text: fullText || FALLBACK_RESPONSE,
    truncated: finishReason === "length",
    usage,
    model,
  };
}

// ============= AGENTIC RAG (v6) =============

function getAiSdkModel(provider: string, model: string) {
  if (provider === "google") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    const google = createGoogleGenerativeAI({ apiKey });
    return google(model);
  }
  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const openai = createOpenAI({ apiKey });
    return openai(model);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Stream a multimodal chat response via AI SDK (native Gemini API).
 * Used when the message contains file/image attachments that can't go
 * through the OpenAI-compatible REST endpoint.
 */
export async function streamMultimodalResponse(
  config: ChatAiConfig,
  messages: AiMessage[],
  onChunk: (delta: string) => Promise<void>
): Promise<StreamChatResult> {
  const sdkMessages = toAiSdkMessages(messages);
  const lastSdkMsg = sdkMessages[sdkMessages.length - 1];
  console.log("[streamMultimodal] Using:", config.primaryProvider, config.primaryModel,
    "messages:", sdkMessages.length,
    "lastRole:", lastSdkMsg?.role,
    "lastContentType:", Array.isArray(lastSdkMsg?.content) ? `array(${lastSdkMsg.content.length})` : typeof lastSdkMsg?.content);

  const model = getAiSdkModel(config.primaryProvider, config.primaryModel);

  try {
    const result = streamText({
      model,
      messages: sdkMessages,
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return await collectSdkTextStream(result, config.primaryModel, onChunk);
  } catch (primaryError) {
    if (!config.fallbackProvider || !config.fallbackModel) throw primaryError;

    console.warn(`Multimodal stream primary failed, trying fallback:`, primaryError);

    const fallbackModel = getAiSdkModel(config.fallbackProvider, config.fallbackModel);
    const result = streamText({
      model: fallbackModel,
      messages: toAiSdkMessages(messages),
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return await collectSdkTextStream(result, config.fallbackModel ?? config.primaryModel, onChunk);
  }
}

/**
 * Generate a chat response using Agentic RAG (tool-calling).
 * The AI decides which tools to invoke based on the conversation context.
 */
function toAiSdkMessages(messages: AiMessage[]): Array<{ role: "system"; content: string } | { role: "user"; content: string | Array<{ type: "text"; text: string } | { type: "image"; image: string | URL; mediaType: string } | { type: "file"; data: string | URL; mediaType: string }> } | { role: "assistant"; content: string }> {
  return messages.map((m) => {
    if (m.role === "user" && Array.isArray(m.content)) {
      return { role: "user" as const, content: m.content };
    }
    const text = typeof m.content === "string"
      ? m.content
      : m.content.filter((p): p is { type: "text"; text: string } => p.type === "text").map((p) => p.text).join("\n");
    return { role: m.role, content: text };
  });
}

export async function generateAgenticResponse(
  config: ChatAiConfig,
  messages: AiMessage[],
  ctx: ActionCtx,
  userId: Id<"users"> | undefined,
  learningLanguage: string
): Promise<string> {
  const model = getAiSdkModel(config.primaryProvider, config.primaryModel);
  const tools = buildChatTools(ctx, userId, learningLanguage);

  try {
    const result = await generateText({
      model,
      messages: toAiSdkMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return result.text || "I'm sorry, I couldn't generate a response.";
  } catch (primaryError) {
    if (!config.fallbackProvider || !config.fallbackModel) throw primaryError;

    console.warn(
      `Agentic primary ${config.primaryProvider}/${config.primaryModel} failed, trying fallback:`,
      primaryError
    );

    const fallbackModel = getAiSdkModel(config.fallbackProvider, config.fallbackModel);
    const result = await generateText({
      model: fallbackModel,
      messages: toAiSdkMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return result.text || "I'm sorry, I couldn't generate a response.";
  }
}

/**
 * Stream a chat response using Agentic RAG (tool-calling).
 * Intermediate tool call results are not streamed; only the final text is.
 */
export async function streamAgenticResponse(
  config: ChatAiConfig,
  messages: AiMessage[],
  onChunk: (delta: string) => Promise<void>,
  ctx: ActionCtx,
  userId: Id<"users"> | undefined,
  learningLanguage: string
): Promise<StreamChatResult> {
  const model = getAiSdkModel(config.primaryProvider, config.primaryModel);
  const tools = buildChatTools(ctx, userId, learningLanguage);

  try {
    const result = streamText({
      model,
      messages: toAiSdkMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return await collectSdkTextStream(result, config.primaryModel, onChunk);
  } catch (primaryError) {
    if (!config.fallbackProvider || !config.fallbackModel) throw primaryError;

    console.warn(
      `Agentic stream primary failed, trying fallback:`,
      primaryError
    );

    const fallbackModel = getAiSdkModel(config.fallbackProvider, config.fallbackModel);
    const result = streamText({
      model: fallbackModel,
      messages: toAiSdkMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      maxOutputTokens: config.maxTokens,
      ...(config.temperature != null ? { temperature: config.temperature } : {}),
    });

    return await collectSdkTextStream(result, config.fallbackModel ?? config.primaryModel, onChunk);
  }
}
