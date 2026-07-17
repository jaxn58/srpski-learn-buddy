import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireSuperadmin } from "./_shared";
import { isPublishedStatus, isPreviewStatus } from "./_shared";
import type { Doc, Id } from "../_generated/dataModel";
import {
  CS_PROMPT_KEYS,
  ALL_SECTION_IDS,
} from "./prompts";

export const listDrafts = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const drafts = await ctx.db.query("contentDrafts").order("desc").take(200);
    return drafts;
  },
});

export const listPublishedEnglishUnitsForTranslation = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const isPublishedStatus = (s: unknown) => s === undefined || s === "published";

    // For <100 units, a simple filter query is fine.
    const allEn = await ctx.db
      .query("unitMetadata")
      .filter((q) => q.eq(q.field("language"), "en"))
      .collect();

    // Keep only published (undefined or "published") and not offline (unit-level toggle).
    const eligible = (allEn as any[]).filter((m) => {
      if (!isPublishedStatus(m?.releaseStatus)) return false;
      if (m?.isOffline === true) return false;
      return typeof m?.unitNumber === "number" && m.unitNumber > 0;
    });

    // Deduplicate by unitNumber (prefer latest _creationTime).
    const bestByUnit = new Map<number, any>();
    for (const m of eligible) {
      const n = Number(m.unitNumber);
      const prev = bestByUnit.get(n);
      if (!prev) {
        bestByUnit.set(n, m);
        continue;
      }
      const prevT = Number(prev?._creationTime ?? 0);
      const t = Number(m?._creationTime ?? 0);
      if (t > prevT) bestByUnit.set(n, m);
    }

    return Array.from(bestByUnit.values())
      .sort((a, b) => Number(a.unitNumber) - Number(b.unitNumber))
      .map((m) => ({
        unitNumber: Number(m.unitNumber),
        title: typeof m.title === "string" && m.title.trim() ? m.title.trim() : `Unit ${Number(m.unitNumber)}`,
      }));
  },
});

export const getUnitRemovalSummary = query({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = args.unitNumber;

    const counts: Record<string, number> = {
      drafts: 0,
      draftSnapshots: 0,
      draftFindings: 0,
      draftAiRuns: 0,
      draftHumanReviews: 0,
      unitMetadata: 0,
      unitContent: 0,
      unitInteractiveTests: 0,
      courseVocabulary: 0,
      vocabularyProgress: 0,
      unitContentAudio: 0,
      exerciseQuestionProgress: 0,
      questionProgress: 0,
      exerciseResults: 0,
      exerciseCompletions: 0,
      quizProgress: 0,
      userProgressWouldPatch: 0,
      userProgressCurrentUnitWouldChange: 0,
      userProgressCompletedUnitsWouldChange: 0,
    };

    // Draft layer
    const drafts = await ctx.db
      .query("contentDrafts")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.drafts = drafts.length;

    for (const d of drafts as any[]) {
      const snaps = await ctx.db
        .query("contentDraftSnapshots")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      counts.draftSnapshots += snaps.length;

      const findings = await ctx.db
        .query("contentDraftFindings")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      counts.draftFindings += findings.length;

      const runs = await ctx.db
        .query("contentDraftAiRuns")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      counts.draftAiRuns += runs.length;

      const reviews = await ctx.db
        .query("contentDraftHumanReviews")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      counts.draftHumanReviews += reviews.length;
    }

    // Published content
    const metas = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    counts.unitMetadata = metas.length;

    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    counts.unitContent = contents.length;

    const tests = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    counts.unitInteractiveTests = tests.length;

    const vocabs = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    counts.courseVocabulary = vocabs.length;

    const courseVocabIds = (vocabs as any[]).map((v) => v._id);
    for (const vid of courseVocabIds) {
      const progressRows = await ctx.db
        .query("vocabularyProgress")
        .withIndex("by_course_vocab", (q) => q.eq("courseVocabularyId", vid))
        .collect();
      counts.vocabularyProgress += progressRows.length;
    }

    const audios = await ctx.db
      .query("unitContentAudio")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.unitContentAudio = audios.length;

    // Gamification / progress (unitNumber-based)
    const eqp = await ctx.db
      .query("exerciseQuestionProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.exerciseQuestionProgress = eqp.length;

    const qp = await ctx.db
      .query("questionProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.questionProgress = qp.length;

    const results = await ctx.db
      .query("exerciseResults")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.exerciseResults = results.length;

    const completions = await ctx.db
      .query("exerciseCompletions")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.exerciseCompletions = completions.length;

    const quizzes = await ctx.db
      .query("quizProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.quizProgress = quizzes.length;

    // userProgress impact
    const allUserProgress = await ctx.db.query("userProgress").collect();
    for (const up of allUserProgress as any[]) {
      const completedUnits: number[] = Array.isArray(up.completedUnits) ? up.completedUnits : [];
      const wouldRemoveCompleted = completedUnits.includes(unitNumber);
      const currentUnit = typeof up.currentUnit === "number" ? up.currentUnit : 1;
      const wouldChangeCurrent = currentUnit === unitNumber;
      if (wouldRemoveCompleted || wouldChangeCurrent) {
        counts.userProgressWouldPatch += 1;
        if (wouldRemoveCompleted) counts.userProgressCompletedUnitsWouldChange += 1;
        if (wouldChangeCurrent) counts.userProgressCurrentUnitWouldChange += 1;
      }
    }

    return { unitNumber, counts };
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

const previewCreationStateValidator = v.object({
  status: v.union(
    v.literal("running"),
    v.literal("success"),
    v.literal("failed"),
  ),
  stage: v.union(
    v.literal("metadata"),
    v.literal("content"),
    v.literal("vocabulary"),
    v.literal("tests"),
    v.literal("complete"),
  ),
  batchIndex: v.optional(v.number()),
  totalBatches: v.optional(v.number()),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
});

/**
 * Latest preview-creation state for a unit (from any draft of that unitNumber).
 * Used by Unit Manager so admins see preview-creation progress/failures without
 * opening the Generator. Reads `contentDrafts.publishState` (DB field name kept
 * for backward compatibility) and exposes it as `previewState`.
 */
export const getLatestPreviewCreationStateForUnit = query({
  args: { unitNumber: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      draftId: v.id("contentDrafts"),
      draftTitle: v.optional(v.string()),
      previewState: previewCreationStateValidator,
    }),
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    if (!Number.isFinite(args.unitNumber) || args.unitNumber <= 0) return null;

    const drafts = await ctx.db
      .query("contentDrafts")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    let best: {
      draftId: Id<"contentDrafts">;
      draftTitle?: string;
      previewState: NonNullable<Doc<"contentDrafts">["publishState"]>;
    } | null = null;

    for (const d of drafts) {
      const ps = d.publishState;
      if (!ps) continue;
      if (!best || ps.updatedAt > best.previewState.updatedAt) {
        best = {
          draftId: d._id,
          draftTitle: d.title,
          previewState: ps,
        };
      }
    }

    return best;
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
  args: {
    stage: v.union(
      v.literal("specialist"),
      v.literal("auditor"),
      v.literal("translator")
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    return await ctx.db
      .query("contentStudioSkills")
      .withIndex("by_stage_active", (q) => q.eq("stage", args.stage).eq("isActive", true))
      .collect();
  },
});

/** Active skills for a stage — used by translator (and other action pipelines). */
export const listActiveSkillsByStageInternal = internalQuery({
  args: {
    stage: v.union(
      v.literal("specialist"),
      v.literal("auditor"),
      v.literal("translator"),
      v.literal("qc_fix_only")
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("contentStudioSkills"),
      name: v.string(),
      prompt: v.string(),
      description: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("contentStudioSkills")
      .withIndex("by_stage_active", (q) => q.eq("stage", args.stage).eq("isActive", true))
      .collect();
    return rows.map((s) => ({
      _id: s._id,
      name: String(s.name ?? ""),
      prompt: String(s.prompt ?? ""),
      description: typeof s.description === "string" ? s.description : undefined,
    }));
  },
});

// listSectionSkills removed -- section prompts are now managed exclusively
// via chatPrompts (cs_section_*) in the Prompt Administration.

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

// ===== Published unit export for translation (EN -> DE) =====
export const getPublishedUnitSourceEnForTranslation = query({
  args: {
    unitNumber: v.number(),
    // "published" (default) uses published EN rows; "preview" uses preview EN rows.
    sourceReleaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"))),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");

    const sourceStatus = args.sourceReleaseStatus ?? "published";
    const isEligibleSource = (s: unknown) =>
      sourceStatus === "preview" ? s === "preview" : (s === undefined || s === "published");

    // 1) Unit metadata (EN)
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const metaEnCandidates = (metaRows as any[]).filter((m) => isEligibleSource(m?.releaseStatus));
    metaEnCandidates.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const metaEn = metaEnCandidates[0] ?? null;
    if (!metaEn) {
      throw new Error(
        `${sourceStatus === "preview" ? "Preview" : "Published"} English unitMetadata not found for unit ${unitNumber}`
      );
    }

    // 2) Unit content sections (EN) - best per contentType by highest unitVersion
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleContent = (contentRows as any[]).filter(
      (c) => c?.isActive !== false && isEligibleSource(c?.releaseStatus)
    );
    const contentByType = new Map<string, any>();
    const versionOf = (row: any) => Number(row?.unitVersion ?? row?.version ?? 1) || 1;
    for (const c of eligibleContent) {
      const type = String(c?.contentType ?? "");
      if (!type) continue;
      const prev = contentByType.get(type);
      if (!prev) {
        contentByType.set(type, c);
        continue;
      }
      const v = versionOf(c);
      const pv = versionOf(prev);
      if (v > pv || (v === pv && (c?._creationTime ?? 0) > (prev?._creationTime ?? 0))) {
        contentByType.set(type, c);
      }
    }

    const contentEn = Array.from(contentByType.values()).map((c) => ({
      contentType: String(c.contentType),
      content: String(c.content ?? ""),
      unitVersion: versionOf(c),
    }));

    // 3) Interactive tests (EN) - best eligible max unitVersion
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleTests = (testRows as any[]).filter(
      (t) => t?.isActive !== false && isEligibleSource(t?.releaseStatus)
    );
    const maxTestVersion = eligibleTests.reduce((m, t) => Math.max(m, Number(t?.unitVersion ?? 1) || 1), 1);
    const testsEn = eligibleTests
      .filter((t) => (Number(t?.unitVersion ?? 1) || 1) === maxTestVersion)
      .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      .map((t) => ({
        category: String(t.category ?? ""),
        categoryInstructions: typeof t.categoryInstructions === "string" ? t.categoryInstructions : "",
        questionId: String(t.questionId ?? ""),
        questionType: String(t.questionType ?? ""),
        question: String(t.question ?? ""),
        correctAnswer: String(t.correctAnswer ?? ""),
        acceptableAlternatives: Array.isArray(t.acceptableAlternatives) ? t.acceptableAlternatives.map((x: any) => String(x)) : undefined,
        options: Array.isArray(t.options) ? t.options.map((x: any) => String(x)) : undefined,
        hint: typeof t.hint === "string" ? t.hint : undefined,
        order: Number(t.order ?? 0) || 0,
        unitVersion: Number(t.unitVersion ?? 1) || 1,
      }));

    // 4) Course vocabulary (eligible source, active) - best per normalized key by highest unitVersion
    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const eligibleVocab = (vocabRows as any[]).filter(
      (v) => v?.isActive !== false && isEligibleSource(v?.releaseStatus)
    );
    const vocabByKey = new Map<string, any>();
    for (const vdoc of eligibleVocab) {
      const key = String(vdoc?.serbianNormalized ?? vdoc?.serbian ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = vocabByKey.get(key);
      if (!prev) {
        vocabByKey.set(key, vdoc);
        continue;
      }
      const v = Number(vdoc?.unitVersion ?? 1) || 1;
      const pv = Number(prev?.unitVersion ?? 1) || 1;
      if (v > pv || (v === pv && (vdoc?._creationTime ?? 0) > (prev?._creationTime ?? 0))) {
        vocabByKey.set(key, vdoc);
      }
    }

    const vocabEn = Array.from(vocabByKey.values())
      .sort((a, b) => String(a?.serbian ?? "").localeCompare(String(b?.serbian ?? "")))
      .map((vdoc) => ({
        _id: vdoc._id,
        serbian: String(vdoc.serbian ?? ""),
        en: typeof vdoc.en === "string" ? vdoc.en : "",
        noteEn: typeof vdoc.noteEn === "string" ? vdoc.noteEn : undefined,
      }));

    return {
      unitNumber,
      metadataEn: {
        unitNumber: metaEn.unitNumber,
        language: "en",
        title: String(metaEn.title ?? ""),
        description: typeof metaEn.description === "string" ? metaEn.description : undefined,
        topics: Array.isArray(metaEn.topics) ? metaEn.topics.map((x: any) => String(x)) : [],
        grammarFocus: Array.isArray(metaEn.grammarFocus) ? metaEn.grammarFocus.map((x: any) => String(x)) : [],
        vocabularyThemes: Array.isArray(metaEn.vocabularyThemes) ? metaEn.vocabularyThemes.map((x: any) => String(x)) : [],
        moduleMetadataId: (metaEn as any).moduleMetadataId,
        moduleId: typeof (metaEn as any).moduleId === "string" ? (metaEn as any).moduleId : undefined,
      },
      contentEn,
      testsEn,
      vocabEn,
    };
  },
});

export const getUnitTranslationPreviewEnToDe = query({
  args: {
    unitNumber: v.number(),
    // "published" (default) = use published EN as source; "preview" = use preview EN as source.
    sourceReleaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"))),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");

    const sourceStatus = args.sourceReleaseStatus ?? "published";
    const isEligibleSource = (s: unknown) =>
      sourceStatus === "preview" ? s === "preview" : (s === undefined || s === "published");
    const isPublishedStatus = (s: unknown) => s === undefined || s === "published";

    const warnings: string[] = [];

    // Source EN (published or preview based on sourceStatus)
    const metaRowsEn = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const metaEnCandidates = (metaRowsEn as any[]).filter((m) => isEligibleSource(m?.releaseStatus));
    metaEnCandidates.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const metaEn = metaEnCandidates[0] ?? null;

    if (!metaEn) {
      warnings.push(
        sourceStatus === "preview"
          ? "No preview English unitMetadata found. Publish the unit to preview first."
          : "No published English unitMetadata found. Translate requires published EN source."
      );
      return {
        unitNumber,
        sourceEn: { exists: false as const },
        existingDe: { metadata: { published: 0, preview: 0, offline: 0 } },
        warnings,
      };
    }

    const contentRowsEn = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleContentEn = (contentRowsEn as any[]).filter(
      (c) => c?.isActive !== false && isEligibleSource(c?.releaseStatus)
    );
    const versionOf = (row: any) => Number(row?.unitVersion ?? row?.version ?? 1) || 1;
    const contentByType = new Map<string, any>();
    for (const c of eligibleContentEn) {
      const type = String(c?.contentType ?? "");
      if (!type) continue;
      const prev = contentByType.get(type);
      if (!prev) {
        contentByType.set(type, c);
        continue;
      }
      const v = versionOf(c);
      const pv = versionOf(prev);
      if (v > pv || (v === pv && (c?._creationTime ?? 0) > (prev?._creationTime ?? 0))) {
        contentByType.set(type, c);
      }
    }
    const sourceContent = Array.from(contentByType.values()).map((c) => ({
      contentType: String(c.contentType),
      unitVersion: versionOf(c),
      chars: String(c.content ?? "").length,
    }));
    if (sourceContent.length === 0) {
      warnings.push(
        sourceStatus === "preview"
          ? "No preview English unitContent found."
          : "No published English unitContent found."
      );
    }

    const testRowsEn = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleTestsEn = (testRowsEn as any[]).filter((t) => t?.isActive !== false && isEligibleSource(t?.releaseStatus));
    const maxTestVersion = eligibleTestsEn.reduce((m, t) => Math.max(m, Number(t?.unitVersion ?? 1) || 1), 1);
    const sourceTests = eligibleTestsEn
      .filter((t) => (Number(t?.unitVersion ?? 1) || 1) === maxTestVersion)
      .map((t) => ({ questionId: String(t.questionId), unitVersion: Number(t.unitVersion ?? 1) || 1 }));
    if (sourceTests.length === 0) {
      warnings.push(
        sourceStatus === "preview"
          ? "No preview English interactive tests found."
          : "No published English interactive tests found."
      );
    }

    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const eligibleVocab = (vocabRows as any[]).filter((v) => v?.isActive !== false && isEligibleSource(v?.releaseStatus));
    const vocabByKey = new Map<string, any>();
    for (const vdoc of eligibleVocab) {
      const key = String(vdoc?.serbianNormalized ?? vdoc?.serbian ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = vocabByKey.get(key);
      if (!prev) {
        vocabByKey.set(key, vdoc);
        continue;
      }
      const v = Number(vdoc?.unitVersion ?? 1) || 1;
      const pv = Number(prev?.unitVersion ?? 1) || 1;
      if (v > pv || (v === pv && (vdoc?._creationTime ?? 0) > (prev?._creationTime ?? 0))) {
        vocabByKey.set(key, vdoc);
      }
    }
    const sourceVocab = Array.from(vocabByKey.values());

    // Existing DE state
    const metaRowsDe = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const metaPublishedDe = (metaRowsDe as any[]).filter((m) => isPublishedStatus(m?.releaseStatus)).length;
    const metaPreviewDe = (metaRowsDe as any[]).filter((m) => m?.releaseStatus === "preview").length;
    const metaOfflineDe = (metaRowsDe as any[]).filter((m) => m?.releaseStatus === "offline").length;

    const contentRowsDe = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const publishedActiveContentDe = (contentRowsDe as any[]).filter(
      (c) => c?.isActive !== false && isPublishedStatus(c?.releaseStatus)
    );
    const srcContentKey = new Map<string, number>(); // type -> unitVersion
    for (const c of sourceContent) srcContentKey.set(c.contentType, c.unitVersion);
    const matchingDeContent = publishedActiveContentDe.filter((c) => {
      const type = String(c?.contentType ?? "");
      const srcV = srcContentKey.get(type);
      if (!srcV) return false;
      const v = Number(c?.unitVersion ?? c?.version ?? 1) || 1;
      return v === srcV;
    }).length;
    if (matchingDeContent > 0) {
      warnings.push(`Published DE content exists for ${matchingDeContent} section(s) at the same version and will be overwritten.`);
    }

    const testRowsDe = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const publishedActiveTestsDe = (testRowsDe as any[]).filter((t) => t?.isActive !== false && isPublishedStatus(t?.releaseStatus));
    const srcTestIds = new Set(sourceTests.map((t) => t.questionId));
    const srcTestVersion = sourceTests[0]?.unitVersion ?? maxTestVersion;
    const matchingDeTests = publishedActiveTestsDe.filter(
      (t) => srcTestIds.has(String(t?.questionId ?? "")) && (Number(t?.unitVersion ?? 1) || 1) === srcTestVersion
    ).length;
    if (matchingDeTests > 0) {
      warnings.push(`Published DE tests exist (${matchingDeTests} question rows) at the same version and will be overwritten.`);
    }

    // For vocabulary: we patch published rows from the EN source set (same ids), so show how many already have de filled.
    const vocabDeFilled = sourceVocab.filter((v: any) => typeof v?.de === "string" && String(v.de).trim()).length;
    const vocabNoteDeFilled = sourceVocab.filter((v: any) => typeof v?.noteDe === "string" && String(v.noteDe).trim()).length;
    if (vocabDeFilled > 0) {
      warnings.push(`Some vocabulary rows already have German translations (${vocabDeFilled}/${sourceVocab.length}). They will be updated/overwritten.`);
    }

    return {
      unitNumber,
      sourceEn: {
        exists: true as const,
        title: String(metaEn.title ?? ""),
        contentSections: sourceContent.sort((a, b) => a.contentType.localeCompare(b.contentType)),
        tests: { count: sourceTests.length, unitVersion: maxTestVersion },
        vocabulary: { count: sourceVocab.length, deFilled: vocabDeFilled, noteDeFilled: vocabNoteDeFilled },
      },
      existingDe: {
        metadata: { published: metaPublishedDe, preview: metaPreviewDe, offline: metaOfflineDe },
        content: {
          publishedActiveCount: publishedActiveContentDe.length,
          matchingSourceCount: matchingDeContent,
        },
        tests: {
          publishedActiveCount: publishedActiveTestsDe.length,
          matchingSourceCount: matchingDeTests,
        },
      },
      warnings,
    };
  },
});

// ===== Unit Manager: Overview of all units with per-language status =====
const SUPPORTED_LANGUAGES = ["en", "de"] as const;

// Helper: count active, non-offline rows (includes both published and preview for admin view).
function isVisibleForAdmin(row: any): boolean {
  if (row.isActive === false) return false;
  const s = row.releaseStatus;
  if (s === "offline") return false;
  return true; // published (undefined/"published") or preview — both visible to superadmin
}

export const getUnitManagementOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    // 1) Collect all unitMetadata rows.
    const allMeta = await ctx.db.query("unitMetadata").collect();

    // Build map: unitNumber -> { lang -> best metadata row }.
    // "best" = prefer preview over published (so admin sees latest state); then latest _creationTime.
    // Uses the same logic as pickBestByRelease in units.ts.
    type MetaBucket = { title: string; description?: string; releaseStatus: string; isOffline: boolean; _id: any; moduleMetadataId?: any; _creationTime: number };
    const unitMap = new Map<number, Record<string, MetaBucket>>();

    // Step 1: Group all eligible rows by unitNumber+lang.
    const grouped = new Map<string, typeof allMeta>();
    for (const m of allMeta as any[]) {
      const n = Number(m.unitNumber);
      const lang = String(m.language ?? "en");
      if (!n || n <= 0) continue;
      const status = m.releaseStatus ?? "published";
      if (status === "offline") continue;
      if (m.isActive === false) continue;
      const key = `${n}|${lang}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(m);
    }

    // Step 2: For each group, sort by: preview first, then _creationTime desc. Pick the best.
    const metaPrio = (s: any) => (isPreviewStatus(s) ? 3 : isPublishedStatus(s) ? 2 : 1);
    for (const [key, rows] of grouped.entries()) {
      const [nStr, lang] = key.split("|");
      const n = Number(nStr);
      (rows as any[]).sort((a, b) => {
        const aP = metaPrio(a.releaseStatus);
        const bP = metaPrio(b.releaseStatus);
        if (aP !== bP) return bP - aP; // higher prio first
        return (b._creationTime ?? 0) - (a._creationTime ?? 0); // newer first
      });
      const best = (rows as any[])[0];
      if (!best) continue;
      if (!unitMap.has(n)) unitMap.set(n, {});
      unitMap.get(n)![lang] = {
        title: String(best.title ?? ""),
        description: typeof best.description === "string" ? best.description : undefined,
        releaseStatus: String(best.releaseStatus ?? "published"),
        isOffline: best.isOffline === true,
        _id: best._id,
        moduleMetadataId: best.moduleMetadataId ?? undefined,
        _creationTime: Number(best._creationTime ?? 0),
      };
    }

    // 2) For each unit, count content/tests/vocab per language.
    const result: Array<{
      unitNumber: number;
      moduleName?: string;
      moduleNumber?: number;
      deTranslationStale?: boolean;
      versions: Record<string, {
        title: string;
        description?: string;
        releaseStatus: string;
        isOffline: boolean;
        sectionCount: number;
        testCount: number;
        vocabCount: number;
        latestContentUpdatedAt?: number;
      }>;
    }> = [];

    // Pre-fetch module metadata for names.
    const moduleIds = new Set<string>();
    for (const bucket of unitMap.values()) {
      for (const v of Object.values(bucket)) {
        if (v.moduleMetadataId) moduleIds.add(String(v.moduleMetadataId));
      }
    }
    const moduleMap = new Map<string, { titleEn?: string; moduleNumber?: number }>();
    for (const mid of moduleIds) {
      try {
        const mod: any = await ctx.db.get(mid as any);
        if (mod) moduleMap.set(mid, { titleEn: mod.titleEn, moduleNumber: mod.moduleNumber });
      } catch { /* ignore invalid ids */ }
    }

    for (const [unitNumber, langBucket] of Array.from(unitMap.entries()).sort((a, b) => a[0] - b[0])) {
      const versions: Record<string, any> = {};

      let moduleName: string | undefined;
      let moduleNumber: number | undefined;
      for (const v of Object.values(langBucket)) {
        if (v.moduleMetadataId) {
          const mod = moduleMap.get(String(v.moduleMetadataId));
          if (mod) {
            moduleName = mod.titleEn;
            moduleNumber = mod.moduleNumber;
            break;
          }
        }
      }

      for (const lang of SUPPORTED_LANGUAGES) {
        const meta = langBucket[lang];
        if (!meta) continue;

        // Count ALL active, non-offline content sections (admin sees everything).
        const contentRows = await ctx.db
          .query("unitContent")
          .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", lang))
          .collect();
        // Deduplicate by contentType (prefer preview over published, highest unitVersion).
        const bestByType = new Map<string, any>();
        for (const c of (contentRows as any[]).filter(isVisibleForAdmin)) {
          const type = String(c.contentType);
          const prev = bestByType.get(type);
          if (!prev) { bestByType.set(type, c); continue; }
          const cPrio = isPreviewStatus(c.releaseStatus) ? 2 : 1;
          const pPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
          if (cPrio > pPrio || (cPrio === pPrio && (c.unitVersion ?? 1) > (prev.unitVersion ?? 1))) {
            bestByType.set(type, c);
          }
        }

        // Count tests — use the same pool+maxVersion strategy as units.ts:getUnitInteractiveTest.
        // 1) Filter active, non-offline. 2) Prefer preview pool if any, else published pool.
        // 3) Within the chosen pool, only count tests at the highest unitVersion.
        const testRows = await ctx.db
          .query("unitInteractiveTests")
          .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", lang))
          .collect();
        const eligibleTests = (testRows as any[]).filter(isVisibleForAdmin);
        const hasPreviewTests = eligibleTests.some((t: any) => isPreviewStatus(t.releaseStatus));
        const testPool = hasPreviewTests
          ? eligibleTests.filter((t: any) => isPreviewStatus(t.releaseStatus))
          : eligibleTests.filter((t: any) => isPublishedStatus(t.releaseStatus));
        const maxTestVersion = testPool.reduce((m: number, t: any) => Math.max(m, Number(t.unitVersion ?? 1) || 1), 1);
        const finalTests = testPool.filter((t: any) => (Number(t.unitVersion ?? 1) || 1) === maxTestVersion);

        // Count vocab — deduplicate by serbianNormalized key.
        // Prefer preview over published, then highest unitVersion.
        let vocabCount = 0;
        const vocabRows = await ctx.db
          .query("courseVocabulary")
          .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
          .collect();
        const bestVocabByKey = new Map<string, any>();
        for (const v of (vocabRows as any[]).filter(isVisibleForAdmin)) {
          const key = String((v as any).serbianNormalized ?? (v as any).serbian ?? "").trim().toLowerCase();
          if (!key) continue;
          const prev = bestVocabByKey.get(key);
          if (!prev) { bestVocabByKey.set(key, v); continue; }
          const vPrio = isPreviewStatus(v.releaseStatus) ? 2 : 1;
          const pPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
          if (vPrio > pPrio || (vPrio === pPrio && (Number((v as any).unitVersion ?? 1) || 1) > (Number((prev as any).unitVersion ?? 1) || 1))) {
            bestVocabByKey.set(key, v);
          }
        }
        if (lang === "en") {
          vocabCount = bestVocabByKey.size;
        } else if (lang === "de") {
          // Only count deduplicated rows that have a DE translation.
          vocabCount = Array.from(bestVocabByKey.values()).filter(
            (v) => typeof v.de === "string" && String(v.de).trim()
          ).length;
        }

        // Only include this language version if it has actual content (not just metadata).
        const sectionCount = bestByType.size;
        const testCount = finalTests.length;
        if (sectionCount === 0 && testCount === 0 && vocabCount === 0 && lang !== "en") {
          continue;
        }

        let latestContentUpdatedAt: number | undefined;
        for (const c of bestByType.values()) {
          const t = Number((c as any).updatedAt ?? (c as any)._creationTime ?? 0);
          if (t > (latestContentUpdatedAt ?? 0)) latestContentUpdatedAt = t;
        }

        versions[lang] = {
          title: meta.title,
          description: meta.description,
          releaseStatus: meta.releaseStatus,
          isOffline: meta.isOffline,
          sectionCount,
          testCount,
          vocabCount,
          latestContentUpdatedAt,
        };
      }

      const enUpdated = versions.en?.latestContentUpdatedAt;
      const deUpdated = versions.de?.latestContentUpdatedAt;
      const deTranslationStale = !!(
        enUpdated && deUpdated && versions.de && enUpdated > deUpdated
      );

      if (Object.keys(versions).length > 0) {
        result.push({ unitNumber, moduleName, moduleNumber, deTranslationStale, versions });
      }
    }

    return result;
  },
});

// ===== Unit Manager: Full detail for a single unit + language =====
export const getUnitLanguageDetail = query({
  args: {
    unitNumber: v.number(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const language = String(args.language);

    // 1) Metadata — prefer preview over published (admin sees latest state).
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();

    const sorted = (metaRows as any[])
      .filter((m) => m.isActive !== false && m.releaseStatus !== "offline")
      .sort((a, b) => {
        // Admin view: preview has higher priority (latest state)
        const aPrio = isPreviewStatus(a.releaseStatus) ? 3 : isPublishedStatus(a.releaseStatus) ? 2 : 1;
        const bPrio = isPreviewStatus(b.releaseStatus) ? 3 : isPublishedStatus(b.releaseStatus) ? 2 : 1;
        if (aPrio !== bPrio) return bPrio - aPrio; // higher prio first
        return (b._creationTime ?? 0) - (a._creationTime ?? 0); // newer first
      });
    const meta = sorted[0] ?? null;
    if (!meta) return null;

    const releaseStatus = String(meta.releaseStatus ?? "published");

    // 2) Content sections — include ALL active non-offline rows, deduplicate per contentType.
    //    (Matches the logic in units.ts:getUnitContentSections for superadmin.)
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();

    const bestByType = new Map<string, any>();
    for (const c of (contentRows as any[]).filter(isVisibleForAdmin)) {
      const type = String(c.contentType);
      const prev = bestByType.get(type);
      if (!prev) { bestByType.set(type, c); continue; }
      // Prefer preview over published; then highest unitVersion.
      const cPrio = isPreviewStatus(c.releaseStatus) ? 2 : 1;
      const pPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
      if (cPrio > pPrio || (cPrio === pPrio && (c.unitVersion ?? 1) > (prev.unitVersion ?? 1))) {
        bestByType.set(type, c);
      }
    }

    const sectionOrder = ["overview", "grammar", "phrases", "dialogues", "vocabulary", "testIntroduction"];
    const sections = Array.from(bestByType.values())
      .map((c) => ({
        contentType: String(c.contentType),
        content: String(c.content ?? ""),
        unitVersion: Number(c.unitVersion ?? c.version ?? 1),
      }))
      .sort((a, b) => sectionOrder.indexOf(a.contentType) - sectionOrder.indexOf(b.contentType));

    // 3) Tests — use pool+maxVersion strategy (mirrors units.ts:getUnitInteractiveTest).
    //    1) Filter active, non-offline. 2) Prefer preview pool if any, else published.
    //    3) Within pool, only take tests at the highest unitVersion.
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    const eligibleTests = (testRows as any[]).filter(isVisibleForAdmin);
    const hasPreviewTests = eligibleTests.some((t: any) => isPreviewStatus(t.releaseStatus));
    const testPool = hasPreviewTests
      ? eligibleTests.filter((t: any) => isPreviewStatus(t.releaseStatus))
      : eligibleTests.filter((t: any) => isPublishedStatus(t.releaseStatus));
    const maxTestVersion = testPool.reduce((m: number, t: any) => Math.max(m, Number(t.unitVersion ?? 1) || 1), 1);
    const tests = testPool
      .filter((t: any) => (Number(t.unitVersion ?? 1) || 1) === maxTestVersion)
      .map((t) => ({
        category: String(t.category ?? ""),
        questionId: String(t.questionId ?? ""),
        questionType: String(t.questionType ?? ""),
        question: String(t.question ?? ""),
        correctAnswer: String(t.correctAnswer ?? ""),
        options: Array.isArray(t.options) ? t.options : undefined,
        hint: typeof t.hint === "string" ? t.hint : undefined,
        order: Number(t.order ?? 0),
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.order - b.order);

    // 4) Vocabulary — deduplicate by serbianNormalized key.
    //    Prefer preview over published, then highest unitVersion.
    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const bestVocabByKey = new Map<string, any>();
    for (const v of (vocabRows as any[]).filter(isVisibleForAdmin)) {
      const key = String((v as any).serbianNormalized ?? (v as any).serbian ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = bestVocabByKey.get(key);
      if (!prev) { bestVocabByKey.set(key, v); continue; }
      const vPrio = isPreviewStatus(v.releaseStatus) ? 2 : 1;
      const pPrio = isPreviewStatus(prev.releaseStatus) ? 2 : 1;
      if (vPrio > pPrio || (vPrio === pPrio && (Number((v as any).unitVersion ?? 1) || 1) > (Number((prev as any).unitVersion ?? 1) || 1))) {
        bestVocabByKey.set(key, v);
      }
    }

    let vocabulary: Array<{ serbian: string; translation: string; note?: string }>;
    if (language === "en") {
      vocabulary = Array.from(bestVocabByKey.values()).map((v) => ({
        serbian: String(v.serbian ?? ""),
        translation: String(v.en ?? ""),
        note: typeof v.noteEn === "string" ? v.noteEn : undefined,
      }));
    } else if (language === "de") {
      vocabulary = Array.from(bestVocabByKey.values())
        .filter((v) => typeof v.de === "string" && String(v.de).trim())
        .map((v) => ({
          serbian: String(v.serbian ?? ""),
          translation: String(v.de ?? ""),
          note: typeof v.noteDe === "string" ? v.noteDe : undefined,
        }));
    } else {
      vocabulary = [];
    }

    // 5) Test categories summary
    const categoryMap = new Map<string, number>();
    for (const t of tests) {
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1);
    }
    const testCategories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));

    return {
      metadata: {
        title: String(meta.title ?? ""),
        description: typeof meta.description === "string" ? meta.description : undefined,
        topics: Array.isArray(meta.topics) ? meta.topics : [],
        grammarFocus: Array.isArray(meta.grammarFocus) ? meta.grammarFocus : [],
        vocabularyThemes: Array.isArray(meta.vocabularyThemes) ? meta.vocabularyThemes : [],
        releaseStatus,
        isOffline: meta.isOffline === true,
      },
      sections,
      tests,
      testCategories,
      vocabulary,
    };
  },
});

// ---------------------------------------------------------------------------
// Current DE state for manual retry runs.
// Returns the CURRENT German translation state in a shape compatible with
// upsertUnitGermanTranslationToPreview / upsertPublishedUnitGermanTranslation.
// Used by retryDeTranslationForSelectedIssues: the retry action replaces only
// the items whose verifier issues the admin picked, and keeps everything else
// as-is by re-sending the unchanged items back through the same upsert path.
// ---------------------------------------------------------------------------
export const getCurrentUnitDeStateForRetry = query({
  args: {
    unitNumber: v.number(),
    targetReleaseStatus: v.union(v.literal("preview"), v.literal("published")),
    // Required when targetReleaseStatus === "preview"; identifies which preview
    // unitVersion to load (normally the one the main translate action created).
    previewUnitVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");

    const isPreview = args.targetReleaseStatus === "preview";
    const previewVer = Number(args.previewUnitVersion ?? 0) || 0;
    if (isPreview && previewVer <= 0) {
      throw new Error("previewUnitVersion is required when targetReleaseStatus === 'preview'");
    }

    const matchesTarget = (row: any, extras?: { expectUnitVersion?: number }) => {
      if (row?.isActive === false) return false;
      if (isPreview) {
        if (row?.releaseStatus !== "preview") return false;
        if (extras?.expectUnitVersion != null) {
          const rv = Number(row?.unitVersion ?? 1) || 1;
          if (rv !== extras.expectUnitVersion) return false;
        }
        return true;
      }
      // published branch
      return row?.releaseStatus === undefined || row?.releaseStatus === "published";
    };

    // 1) Metadata
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const metaCandidates = (metaRows as any[]).filter((m) => matchesTarget(m));
    metaCandidates.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const meta = metaCandidates[0] ?? null;
    if (!meta) return null;

    const metadataDe = {
      title: String(meta.title ?? ""),
      description:
        typeof meta.description === "string" && String(meta.description).trim()
          ? String(meta.description).trim()
          : undefined,
      topics: Array.isArray(meta.topics) ? meta.topics.map((x: any) => String(x)) : [],
      grammarFocus: Array.isArray(meta.grammarFocus) ? meta.grammarFocus.map((x: any) => String(x)) : [],
      vocabularyThemes: Array.isArray(meta.vocabularyThemes)
        ? meta.vocabularyThemes.map((x: any) => String(x))
        : [],
      ...(meta.moduleMetadataId ? { moduleMetadataId: meta.moduleMetadataId } : {}),
      ...(typeof meta.moduleId === "string" && meta.moduleId.trim() ? { moduleId: meta.moduleId.trim() } : {}),
    };

    // 2) Content sections
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const eligibleContent = (contentRows as any[]).filter((c) =>
      matchesTarget(c, { expectUnitVersion: isPreview ? previewVer : undefined })
    );
    // Dedup by contentType — for published, take max unitVersion; for preview they're the target ver.
    const contentByType = new Map<string, any>();
    for (const c of eligibleContent) {
      const type = String(c?.contentType ?? "");
      if (!type) continue;
      const prev = contentByType.get(type);
      if (!prev) {
        contentByType.set(type, c);
        continue;
      }
      const cv = Number(c?.unitVersion ?? c?.version ?? 1) || 1;
      const pv = Number(prev?.unitVersion ?? prev?.version ?? 1) || 1;
      if (cv > pv || (cv === pv && (c?._creationTime ?? 0) > (prev?._creationTime ?? 0))) {
        contentByType.set(type, c);
      }
    }
    const contentDe = Array.from(contentByType.values()).map((c) => ({
      contentType: String(c.contentType),
      content: String(c.content ?? ""),
      ...(isPreview ? {} : { unitVersion: Number(c?.unitVersion ?? c?.version ?? 1) || 1 }),
    }));

    // 3) Tests
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const eligibleTests = (testRows as any[]).filter((t) =>
      matchesTarget(t, { expectUnitVersion: isPreview ? previewVer : undefined })
    );
    // For published: restrict to max unitVersion (matching main translate action).
    let testsFiltered: any[] = eligibleTests;
    if (!isPreview) {
      const maxVer = eligibleTests.reduce(
        (m: number, t: any) => Math.max(m, Number(t?.unitVersion ?? 1) || 1),
        1
      );
      testsFiltered = eligibleTests.filter((t) => (Number(t?.unitVersion ?? 1) || 1) === maxVer);
    }

    // Preview storage suffixes questionId with "_preview_de_v<ver>"; strip to BASE id.
    const stripPreviewSuffix = (qid: string): string => {
      if (!isPreview) return qid;
      const m = qid.match(/^(.+?)_preview_de_v\d+$/);
      return m?.[1] ?? qid;
    };

    const testsDe = testsFiltered
      .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      .map((t) => ({
        questionId: stripPreviewSuffix(String(t.questionId ?? "")),
        ...(isPreview ? {} : { unitVersion: Number(t?.unitVersion ?? 1) || 1 }),
        category: String(t.category ?? ""),
        categoryInstructions:
          typeof t.categoryInstructions === "string" ? t.categoryInstructions : undefined,
        questionType: String(t.questionType ?? ""),
        question: String(t.question ?? ""),
        correctAnswer: String(t.correctAnswer ?? ""),
        acceptableAlternatives: Array.isArray(t.acceptableAlternatives)
          ? t.acceptableAlternatives.map((x: any) => String(x))
          : undefined,
        options: Array.isArray(t.options) ? t.options.map((x: any) => String(x)) : undefined,
        hint: typeof t.hint === "string" ? t.hint : undefined,
        order: Number(t.order ?? 0) || 0,
      }));

    // 4) Vocabulary — return minimal patch shape (courseVocabularyId + de fields).
    // We pull from courseVocabulary by unitNumber and match the target scope (preview vs published).
    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const eligibleVocab = (vocabRows as any[]).filter((v) => {
      if (v?.isActive === false) return false;
      if (isPreview) {
        // Preview translate either patched an existing preview row OR inserted a new preview copy at that unitVersion.
        if (v?.releaseStatus !== "preview") return false;
        if ((Number(v?.unitVersion ?? 1) || 1) !== previewVer) return false;
        return true;
      }
      return v?.releaseStatus === undefined || v?.releaseStatus === "published";
    });
    // Dedup by normalized serbian key (prefer latest unitVersion).
    const bestVocabByKey = new Map<string, any>();
    for (const v of eligibleVocab) {
      const key = String(v?.serbianNormalized ?? v?.serbian ?? "").trim().toLowerCase();
      if (!key) continue;
      const prev = bestVocabByKey.get(key);
      if (!prev) {
        bestVocabByKey.set(key, v);
        continue;
      }
      const cv = Number(v?.unitVersion ?? 1) || 1;
      const pv = Number(prev?.unitVersion ?? 1) || 1;
      if (cv > pv) bestVocabByKey.set(key, v);
    }
    const vocabularyDe = Array.from(bestVocabByKey.values())
      .filter((v) => typeof v.de === "string" && String(v.de).trim())
      .map((v) => ({
        courseVocabularyId: v._id as Id<"courseVocabulary">,
        ...(typeof v.de === "string" && String(v.de).trim() ? { de: String(v.de).trim() } : {}),
        ...(typeof v.noteDe === "string" && String(v.noteDe).trim() ? { noteDe: String(v.noteDe).trim() } : {}),
      }));

    return {
      unitNumber,
      targetReleaseStatus: args.targetReleaseStatus,
      previewUnitVersion: isPreview ? previewVer : undefined,
      metadataDe,
      contentDe,
      testsDe,
      vocabularyDe,
    };
  },
});

export const getPromptPreview = query({
  args: { draftId: v.optional(v.id("contentDrafts")) },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    async function resolveKey(key: string) {
      const doc: any = await ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: key });
      if (doc?.content) return { content: doc.content, source: "database" as const };
      return { content: "", source: "missing" as const };
    }

    const creator = await resolveKey(CS_PROMPT_KEYS.unitCreator);
    const fixer = await resolveKey(CS_PROMPT_KEYS.findingFixer);
    const lector = await resolveKey(CS_PROMPT_KEYS.lector);

    let skillsBlock = "";
    let referenceBlock = "";

    if (args.draftId) {
      const d: any = await ctx.db.get(args.draftId);
      if (d) {
        const specialistSkillIds = Array.isArray(d.specialistSkillIds) ? d.specialistSkillIds : [];
        if (specialistSkillIds.length > 0) {
          const skillDocs = await Promise.all(
            specialistSkillIds.map((id: any) => ctx.db.get(id))
          );
          const activeSkills = skillDocs.filter((s: any) => s?.isActive && s?.prompt);
          if (activeSkills.length > 0) {
            skillsBlock = activeSkills.map((s: any) => `--- SKILL: ${s.name} ---\n${s.prompt}`).join("\n\n");
          }
        }

        const refId = d.inspirationRef?.referenceId;
        if (refId) {
          const ref: any = await ctx.db.get(refId);
          if (ref?.guidelines) {
            referenceBlock = `--- REFERENCE GUIDELINES ---\n${ref.guidelines}`;
          }
        }
      }
    }

    const sectionPrompts: Record<string, { content: string; source: string }> = {};
    for (const sectionId of ALL_SECTION_IDS) {
      const key = CS_PROMPT_KEYS.section(sectionId);
      const resolved = await resolveKey(key);
      sectionPrompts[sectionId] = { content: resolved.content, source: resolved.source };
    }

    return {
      roles: {
        creator: { content: creator.content, source: creator.source, key: CS_PROMPT_KEYS.unitCreator },
        fixer: { content: fixer.content, source: fixer.source, key: CS_PROMPT_KEYS.findingFixer },
        lector: { content: lector.content, source: lector.source, key: CS_PROMPT_KEYS.lector },
      },
      skillsBlock: skillsBlock || null,
      referenceBlock: referenceBlock || null,
      sectionPrompts,
      baseSystemPrompt: creator.content,
      source: { base: creator.source === "missing" ? "MISSING -- create in /admin/prompt" : "database (chatPrompts)" },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT DUPLICATE CHECK for (moduleNumber, unitNumber)
//
// Prevents accidentally creating two Content-Studio drafts for the same unit
// slot. Already-published live units are NOT considered collisions - creating
// a new draft for an existing live unit is the intended update workflow.
//
// Also usable as a pure helper by mutations for the hard server-side guard.
// ═══════════════════════════════════════════════════════════════════════════

export type UnitModuleCollisionResult = {
  collides: boolean;
  conflictingDraftId: Id<"contentDrafts"> | null;
};

export async function findUnitModuleCollision(
  ctx: { db: any },
  args: {
    moduleNumber: number;
    unitNumber: number;
    excludeDraftId?: Id<"contentDrafts"> | null;
  }
): Promise<UnitModuleCollisionResult> {
  const empty: UnitModuleCollisionResult = {
    collides: false,
    conflictingDraftId: null,
  };

  if (!Number.isFinite(args.moduleNumber) || args.moduleNumber <= 0) return empty;
  if (!Number.isFinite(args.unitNumber) || args.unitNumber <= 0) return empty;

  const excludeId = args.excludeDraftId ?? null;

  // Draft duplicate (any status, same (moduleNumber, unitNumber), excluding self on update).
  const draftsWithUnit = await ctx.db
    .query("contentDrafts")
    .withIndex("by_unit", (q: any) => q.eq("unitNumber", args.unitNumber))
    .collect();
  const conflictingDraft = (draftsWithUnit as Array<Doc<"contentDrafts">>).find(
    (d) => d.moduleNumber === args.moduleNumber && String(d._id) !== String(excludeId)
  );

  return {
    collides: !!conflictingDraft,
    conflictingDraftId: conflictingDraft?._id ?? null,
  };
}

export const checkUnitModuleCollision = query({
  args: {
    moduleNumber: v.number(),
    unitNumber: v.number(),
    excludeDraftId: v.optional(v.id("contentDrafts")),
  },
  handler: async (ctx, args): Promise<UnitModuleCollisionResult> => {
    await requireSuperadmin(ctx);
    return await findUnitModuleCollision(ctx, {
      moduleNumber: args.moduleNumber,
      unitNumber: args.unitNumber,
      excludeDraftId: args.excludeDraftId ?? null,
    });
  },
});
