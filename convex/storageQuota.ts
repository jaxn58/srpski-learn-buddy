/**
 * Per-user file storage quotas and usage tracking.
 * Single source of truth for storage limits (see storage strategy plan).
 */
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { FeatureAccess } from "./featureAccess";
import { loadBetaPhaseActive } from "./platform";

/** Default per-tier storage quotas in bytes. */
export const DEFAULT_STORAGE_QUOTA_BYTES = {
  /** Chat attachments only (no Knowledge Base). */
  course_ai: 100 * 1024 * 1024,
  standalone: 500 * 1024 * 1024,
  course_ai_pro: 1024 * 1024 * 1024,
  beta: 0,
} as const;

export const CHAT_ATTACHMENT_DAILY_LIMIT = 10;
export const KNOWLEDGE_RACK_DAILY_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export type UploadSource = "chat_attachment" | "knowledge_rack";

export type StorageQuotaConfig = {
  quotaStandaloneBytes: number;
  quotaCourseAiProBytes: number;
  quotaBetaBytes: number;
};

export async function loadStorageQuotaConfig(
  ctx: QueryCtx | MutationCtx
): Promise<StorageQuotaConfig> {
  // @ts-ignore TS2589
  const cfg = await ctx.db.query("platformConfig").first();
  return {
    quotaStandaloneBytes:
      cfg?.storageQuotaStandaloneBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.standalone,
    quotaCourseAiProBytes:
      cfg?.storageQuotaCourseAiProBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.course_ai_pro,
    quotaBetaBytes: cfg?.storageQuotaBetaBytes ?? DEFAULT_STORAGE_QUOTA_BYTES.beta,
  };
}

export function resolveStorageQuotaBytes(
  access: FeatureAccess,
  quotas: StorageQuotaConfig,
  betaPhaseActive: boolean,
  uploadSource?: UploadSource
): number | null {
  if (access.isStaff || access.energy.unlimited) return null;

  if (access.source === "beta" && betaPhaseActive) {
    return 0;
  }

  const source =
    uploadSource ??
    (access.features.knowledgeRack ? "knowledge_rack" : "chat_attachment");

  switch (access.tier) {
    case "course_ai":
      return source === "knowledge_rack"
        ? 0
        : DEFAULT_STORAGE_QUOTA_BYTES.course_ai;
    case "standalone":
      return quotas.quotaStandaloneBytes;
    case "course_ai_pro":
      return quotas.quotaCourseAiProBytes;
    default:
      return 0;
  }
}

/** Sum bytes from knowledge-rack documents + chat message attachments. */
export async function getUserStorageUsageBytes(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const docs = await ctx.db
    .query("userDocuments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let total = docs.reduce((sum, doc) => sum + (doc.fileSizeBytes ?? 0), 0);

  const messages = await ctx.db
    .query("chatMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const docStorageIds = new Set(docs.map((d) => d.storageId as string));
  for (const message of messages) {
    if (!message.attachmentStorageId) continue;
    if (docStorageIds.has(message.attachmentStorageId as string)) continue;
    total += message.attachmentSizeBytes ?? 0;
  }

  return total;
}

export async function assertStorageQuotaAvailable(
  ctx: MutationCtx,
  userId: Id<"users">,
  access: FeatureAccess,
  additionalBytes: number,
  uploadSource: UploadSource = "chat_attachment"
): Promise<void> {
  if (access.isStaff || access.energy.unlimited) return;

  const quotas = await loadStorageQuotaConfig(ctx);
  const betaPhaseActive = await loadBetaPhaseActive(ctx);
  const quotaBytes = resolveStorageQuotaBytes(
    access,
    quotas,
    betaPhaseActive,
    uploadSource
  );

  if (quotaBytes === null) return;
  if (quotaBytes <= 0) {
    throw new Error(
      uploadSource === "knowledge_rack"
        ? "Knowledge Base storage is not included in your current plan."
        : "File storage is not included in your current plan."
    );
  }

  const used = await getUserStorageUsageBytes(ctx, userId);
  if (used + additionalBytes > quotaBytes) {
    const usedMb = (used / (1024 * 1024)).toFixed(1);
    const quotaMb = (quotaBytes / (1024 * 1024)).toFixed(0);
    throw new Error(
      `Storage quota exceeded (${usedMb} MB of ${quotaMb} MB used). Delete files in My Library to free space.`
    );
  }
}

export async function assertDailyUploadRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  source: UploadSource,
  isStaff: boolean
): Promise<void> {
  if (isStaff) return;

  const cutoff = Date.now() - DAY_MS;
  const limit =
    source === "chat_attachment"
      ? CHAT_ATTACHMENT_DAILY_LIMIT
      : KNOWLEDGE_RACK_DAILY_LIMIT;

  if (source === "chat_attachment") {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const count = messages.filter(
      (m) => m.attachmentStorageId && m._creationTime >= cutoff
    ).length;
    if (count >= limit) {
      throw new Error(
        `Daily upload limit reached (${limit} chat attachments per day). Try again tomorrow.`
      );
    }
    return;
  }

  const docs = await ctx.db
    .query("userDocuments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const count = docs.filter((d) => d._creationTime >= cutoff).length;
  if (count >= limit) {
    throw new Error(
      `Daily upload limit reached (${limit} documents per day). Try again tomorrow.`
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Public per-tier storage quotas for the landing page pricing table. */
export const getPublicStorageInfo = query({
  args: {},
  returns: v.object({
    quotasBytes: v.object({
      course: v.number(),
      standalone: v.number(),
      course_ai: v.number(),
      course_ai_pro: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const quotas = await loadStorageQuotaConfig(ctx);
    return {
      quotasBytes: {
        course: 0,
        standalone: quotas.quotaStandaloneBytes,
        course_ai: DEFAULT_STORAGE_QUOTA_BYTES.course_ai,
        course_ai_pro: quotas.quotaCourseAiProBytes,
      },
    };
  },
});
