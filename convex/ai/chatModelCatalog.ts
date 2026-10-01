/**
 * Chat-only model catalog.
 *
 * The provider list endpoints do not include prices. A model is selectable
 * for Learn Buddy only when MODEL_PRICING has a row for that provider, so
 * Energy never falls back to Gemini 2.5 Flash rates for an unknown model.
 */
import {
  isGeminiThinkingModel,
  supportsThinkingOff,
} from "../contentStudio/_modelCapabilities";
import {
  getVerifiedModelPricing,
  PRICING_SOURCE_URLS,
} from "./modelPricing";

export type ChatCatalogProvider = "google" | "openai";

export type ChatCatalogEntry = {
  provider: ChatCatalogProvider;
  id: string;
  displayName: string;
  selectable: boolean;
  thinkingAlwaysOn: boolean;
  pricingSourceUrl: string;
  inputUsdPer1M: number | null;
  outputUsdPer1M: number | null;
};

/** Gemini ids that are not text chat (embeddings, media, live audio, TTS). */
const GEMINI_EXCLUDED =
  /embedding|imagen|veo|tts|aqa|native-audio|-live|robotics|gemma/i;

/** OpenAI ids that are not chat completions. */
const OPENAI_EXCLUDED =
  /embedding|whisper|moderation|dall-e|dalle|tts|transcribe|realtime|audio|image|instruct|sora/i;

export function normalizeGeminiModelId(name: string): string {
  return name.replace(/^models\//, "").trim();
}

export function isGeminiChatModel(
  rawName: string,
  supportedGenerationMethods: readonly string[] | undefined
): boolean {
  const id = normalizeGeminiModelId(rawName).toLowerCase();
  if (!id.startsWith("gemini-")) return false;
  if (!supportedGenerationMethods?.includes("generateContent")) return false;
  if (GEMINI_EXCLUDED.test(id)) return false;
  return true;
}

export function isOpenAiChatModel(rawId: string): boolean {
  const id = rawId.trim().toLowerCase();
  if (!id || id.startsWith("ft:")) return false;
  if (OPENAI_EXCLUDED.test(id)) return false;
  if (id.startsWith("gpt-") || id.startsWith("chatgpt-")) return true;
  return /^o\d/.test(id);
}

/** Thinking cannot be switched off, so output usage includes thinking tokens. */
export function chatThinkingAlwaysOn(
  provider: ChatCatalogProvider,
  model: string
): boolean {
  if (provider !== "google") return false;
  return (
    isGeminiThinkingModel("gemini", model) &&
    !supportsThinkingOff("gemini", model)
  );
}

export function classifyChatModel(
  provider: ChatCatalogProvider,
  id: string,
  apiDisplayName?: string
): ChatCatalogEntry {
  const pricing = getVerifiedModelPricing(id, provider);
  const trimmedName = apiDisplayName?.trim();
  return {
    provider,
    id,
    displayName: pricing?.displayName ?? (trimmedName && trimmedName.length > 0 ? trimmedName : id),
    selectable: pricing !== null,
    thinkingAlwaysOn: chatThinkingAlwaysOn(provider, id),
    pricingSourceUrl: PRICING_SOURCE_URLS[provider],
    inputUsdPer1M: pricing?.inputUsdPer1M ?? null,
    outputUsdPer1M: pricing?.outputUsdPer1M ?? null,
  };
}

export function sortChatCatalog(entries: ChatCatalogEntry[]): ChatCatalogEntry[] {
  const seen = new Set<string>();
  const unique: ChatCatalogEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.provider}:${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique.sort((a, b) => {
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

type GeminiListModel = {
  name?: unknown;
  displayName?: unknown;
  supportedGenerationMethods?: unknown;
};

export function catalogFromGeminiList(body: unknown): ChatCatalogEntry[] {
  if (!isRecord(body) || !Array.isArray(body.models)) return [];
  const entries: ChatCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const raw of body.models) {
    if (!isRecord(raw)) continue;
    const model = raw as GeminiListModel;
    const name = typeof model.name === "string" ? model.name : "";
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods.filter((m): m is string => typeof m === "string")
      : undefined;
    if (!isGeminiChatModel(name, methods)) continue;
    const id = normalizeGeminiModelId(name);
    if (seen.has(id)) continue;
    seen.add(id);
    const displayName = typeof model.displayName === "string" ? model.displayName : undefined;
    entries.push(classifyChatModel("google", id, displayName));
  }
  return sortChatCatalog(entries);
}

export function catalogFromOpenAiList(body: unknown): ChatCatalogEntry[] {
  if (!isRecord(body) || !Array.isArray(body.data)) return [];
  const entries: ChatCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const raw of body.data) {
    if (!isRecord(raw) || typeof raw.id !== "string") continue;
    if (!isOpenAiChatModel(raw.id)) continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    entries.push(classifyChatModel("openai", raw.id));
  }
  return sortChatCatalog(entries);
}

export function geminiNextPageToken(body: unknown): string | null {
  if (!isRecord(body) || typeof body.nextPageToken !== "string") return null;
  const token = body.nextPageToken.trim();
  return token.length > 0 ? token : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
