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
      unitExplanations: 0,
      exerciseQuestionProgress: 0,
      questionProgress: 0,
      exerciseResults: 0,
      exerciseCompletions: 0,
      quizProgress: 0,
      legacyVocabulary: 0,
      legacyVocabularyTranslations: 0,
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

    const legacyExpl = await ctx.db
      .query("unitExplanations")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    counts.unitExplanations = legacyExpl.length;

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

    const legacyVocab = await ctx.db
      .query("vocabulary")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    counts.legacyVocabulary = legacyVocab.length;

    const legacyVocabIds = (legacyVocab as any[]).map((v) => v._id);
    for (const vid of legacyVocabIds) {
      const translations = await ctx.db
        .query("vocabularyTranslations")
        .withIndex("by_vocab_lang", (q) => q.eq("vocabularyId", vid))
        .collect();
      counts.legacyVocabularyTranslations += translations.length;
    }

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

// ===== Published unit export for translation (EN -> DE) =====
export const getPublishedUnitSourceEnForTranslation = query({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");

    const isPublishedStatus = (s: unknown) => s === undefined || s === "published";

    // 1) Unit metadata (EN)
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const metaEnCandidates = (metaRows as any[]).filter((m) => isPublishedStatus(m?.releaseStatus));
    metaEnCandidates.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const metaEn = metaEnCandidates[0] ?? null;
    if (!metaEn) {
      throw new Error(`Published English unitMetadata not found for unit ${unitNumber}`);
    }

    // 2) Unit content sections (EN) - best per contentType by highest unitVersion
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleContent = (contentRows as any[]).filter(
      (c) => c?.isActive !== false && isPublishedStatus(c?.releaseStatus)
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

    // 3) Interactive tests (EN) - best published max unitVersion
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleTests = (testRows as any[]).filter(
      (t) => t?.isActive !== false && isPublishedStatus(t?.releaseStatus)
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

    // 4) Course vocabulary (published, active) - best per normalized key by highest unitVersion
    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const eligibleVocab = (vocabRows as any[]).filter(
      (v) => v?.isActive !== false && isPublishedStatus(v?.releaseStatus)
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
        enAlt: typeof vdoc.enAlt === "string" ? vdoc.enAlt : undefined,
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
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");

    const isPublishedStatus = (s: unknown) => s === undefined || s === "published";

    const warnings: string[] = [];

    // Source EN (published)
    const metaRowsEn = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const metaEnCandidates = (metaRowsEn as any[]).filter((m) => isPublishedStatus(m?.releaseStatus));
    metaEnCandidates.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const metaEn = metaEnCandidates[0] ?? null;

    if (!metaEn) {
      warnings.push("No published English unitMetadata found. Translate requires published EN source.");
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
      (c) => c?.isActive !== false && isPublishedStatus(c?.releaseStatus)
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
    if (sourceContent.length === 0) warnings.push("No published English unitContent found.");

    const testRowsEn = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
      .collect();
    const eligibleTestsEn = (testRowsEn as any[]).filter((t) => t?.isActive !== false && isPublishedStatus(t?.releaseStatus));
    const maxTestVersion = eligibleTestsEn.reduce((m, t) => Math.max(m, Number(t?.unitVersion ?? 1) || 1), 1);
    const sourceTests = eligibleTestsEn
      .filter((t) => (Number(t?.unitVersion ?? 1) || 1) === maxTestVersion)
      .map((t) => ({ questionId: String(t.questionId), unitVersion: Number(t.unitVersion ?? 1) || 1 }));
    if (sourceTests.length === 0) warnings.push("No published English interactive tests found.");

    const vocabRows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const eligibleVocab = (vocabRows as any[]).filter((v) => v?.isActive !== false && isPublishedStatus(v?.releaseStatus));
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
