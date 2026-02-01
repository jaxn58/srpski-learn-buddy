import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireSuperadmin } from "./_shared";
import type { Doc, Id } from "../_generated/dataModel";

export const listDrafts = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const drafts = await ctx.db.query("contentDrafts").order("desc").take(200);
    return drafts;
  },
});

export const getStudioMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const drafts = await ctx.db.query("contentDrafts").order("desc").take(200);
    const draftIdSet = new Set(drafts.map((d: any) => String(d._id)));

    const snaps = await ctx.db.query("contentDraftSnapshots").order("desc").take(2000);
    const snapCounts = new Map<string, number>();
    for (const s of snaps as any[]) {
      const did = String(s?.draftId || "");
      if (!did || !draftIdSet.has(did)) continue;
      snapCounts.set(did, (snapCounts.get(did) ?? 0) + 1);
    }

    const statuses: Record<string, number> = {
      draft: 0,
      qc_failed: 0,
      qc_passed: 0,
      audit_failed: 0,
      ready_to_publish: 0,
      published: 0,
    };
    for (const d of drafts as any[]) {
      const s = String(d?.status || "draft");
      statuses[s] = (statuses[s] ?? 0) + 1;
    }

    const qcDenom =
      (statuses.qc_failed ?? 0) +
      (statuses.qc_passed ?? 0) +
      (statuses.audit_failed ?? 0) +
      (statuses.ready_to_publish ?? 0) +
      (statuses.published ?? 0);
    const qcPass =
      (statuses.qc_passed ?? 0) +
      (statuses.audit_failed ?? 0) +
      (statuses.ready_to_publish ?? 0) +
      (statuses.published ?? 0);

    const revisions: number[] = [];
    for (const d of drafts as any[]) {
      const c = snapCounts.get(String(d._id)) ?? 0;
      if (c > 0) revisions.push(Math.max(0, c - 1));
    }
    const avgRevisions = revisions.length ? revisions.reduce((a, b) => a + b, 0) / revisions.length : 0;

    return {
      windowDrafts: drafts.length,
      statuses,
      qc: {
        pass: qcPass,
        denom: qcDenom,
        rate: qcDenom ? qcPass / qcDenom : null,
      },
      revisions: {
        avg: avgRevisions,
        withSnapshots: revisions.length,
      },
    };
  },
});

export const getDraft = query({
  args: { draftId: v.id("contentDrafts") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const snapshot = draft.lastSnapshotId ? await ctx.db.get(draft.lastSnapshotId) : null;
    const findings = await ctx.db
      .query("contentDraftFindings")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    const aiRuns = await ctx.db
      .query("contentDraftAiRuns")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .take(50);

    return { draft, snapshot, findings, aiRuns };
  },
});

export const listDraftSnapshots = query({
  args: {
    draftId: v.id("contentDrafts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const lim = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 20;
    return await ctx.db
      .query("contentDraftSnapshots")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .take(lim);
  },
});

export const listHumanReviewNotes = query({
  args: {
    draftId: v.id("contentDrafts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const lim = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 10;
    return await ctx.db
      .query("contentDraftHumanReviews")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .take(lim);
  },
});

export const getApprovedMarkdown = query({
  args: { draftId: v.id("contentDrafts") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    if (!draft.approvedSnapshotId) return { snapshotId: null, markdownSource: null };

    const snap = await ctx.db.get(draft.approvedSnapshotId);
    if (!snap) return { snapshotId: null, markdownSource: null };
    return {
      snapshotId: draft.approvedSnapshotId,
      markdownSource: snap.markdownSource ?? null,
    };
  },
});

export const getModelConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const cfg = await ctx.db.query("contentStudioConfig").order("desc").first();
    if (!cfg) return null;
    // Fixer stage removed: expose only Creator (specialist) + Lector (auditor).
    return { specialist: cfg.specialist, auditor: cfg.auditor };
  },
});

// ===== Skills library (stage-based; primarily Specialist) =====
export const listStageSkills = query({
  args: { stage: v.union(v.literal("specialist"), v.literal("auditor")) },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    return await ctx.db
      .query("contentStudioSkills")
      .withIndex("by_stage_active", (q) => q.eq("stage", args.stage).eq("isActive", true))
      .collect();
  },
});

// Backward-compatible endpoints (section-based) – kept for now, but the UI no longer uses them.
export const listSectionSkills = query({
  args: { section: v.union(v.literal("overview"), v.literal("grammar"), v.literal("phrases"), v.literal("dialogues"), v.literal("exercises")) },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    return await ctx.db
      .query("contentStudioSkills")
      .withIndex("by_section_active", (q) => q.eq("section", args.section).eq("isActive", true))
      .collect();
  },
});

export const getSkillsByIds = query({
  args: { ids: v.array(v.id("contentStudioSkills")) },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const out: Array<Doc<"contentStudioSkills">> = [];
    for (const id of args.ids) {
      const s = await ctx.db.get(id);
      if (s) out.push(s);
    }
    return out;
  },
});

// ===== Reference library (external links) =====
export const listReferences = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const refs = await ctx.db
      .query("contentStudioReferences")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(200);
    // Resolve signed URLs for uploaded files (URLs expire).
    return await Promise.all(
      refs.map(async (r: any) => ({
        ...r,
        pdfFiles: Array.isArray(r.pdfFiles)
          ? r.pdfFiles
          : r.storageId
            ? [
                {
                  storageId: String(r.storageId),
                  fileName: r.fileName,
                  mimeType: r.mimeType,
                  sizeBytes: r.sizeBytes,
                  uploadedAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
                },
              ]
            : [],
        pdfDownloadUrls: Array.isArray(r.pdfFiles)
          ? await Promise.all((r.pdfFiles as any[]).map(async (f) => (f?.storageId ? await ctx.storage.getUrl(String(f.storageId)) : null)))
          : r.storageId
            ? [await ctx.storage.getUrl(String(r.storageId))]
            : [],
        downloadUrl: r.storageId ? await ctx.storage.getUrl(r.storageId) : (r.url ?? null),
      }))
    );
  },
});

export const getReferenceById = query({
  args: { referenceId: v.id("contentStudioReferences") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const r: any = await ctx.db.get(args.referenceId);
    if (!r) return null;
    const pdfFiles: any[] = Array.isArray(r.pdfFiles)
      ? r.pdfFiles
      : r.storageId
        ? [
            {
              storageId: String(r.storageId),
              fileName: r.fileName,
              mimeType: r.mimeType,
              sizeBytes: r.sizeBytes,
              uploadedAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
            },
          ]
        : [];
    return {
      ...r,
      pdfFiles,
      pdfDownloadUrls: pdfFiles.length
        ? await Promise.all(pdfFiles.map(async (f) => (f?.storageId ? await ctx.storage.getUrl(String(f.storageId)) : null)))
        : [],
      downloadUrl: r.storageId ? await ctx.storage.getUrl(r.storageId) : (r.url ?? null),
    };
  },
});

// ===== Draft templates =====
export const listDraftTemplates = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    return await ctx.db
      .query("contentDraftTemplates")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .take(200);
  },
});

// ===== Reference guideline versions =====
export const listReferenceGuidelineVersions = query({
  args: {
    referenceId: v.id("contentStudioReferences"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const lim = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 20;
    return await ctx.db
      .query("contentStudioReferenceGuidelineVersions")
      .withIndex("by_reference_version", (q) => q.eq("referenceId", args.referenceId))
      .order("desc")
      .take(lim);
  },
});
