import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { requireSuperadmin } from "./_shared";
import type { DraftStatus } from "./_shared";
import {
  CS_PROMPT_KEYS,
  ALL_SECTION_IDS,
} from "./prompts";
import { findEarlierUnitVocabulary, toVocabularyKey } from "../vocabulary";
import { makeValidatorMemoryFingerprint } from "./_validatorMemory";
import {
  isSerbianStemExerciseType,
  stripTrailingParentheticalGlosses,
} from "./_translationCore";

export const createDraft = mutation({
  args: {
    unitNumber: v.number(),
    moduleNumber: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("contentDrafts", {
      unitNumber: args.unitNumber,
      moduleNumber: args.moduleNumber,
      title: args.title,
      description: args.description,
      status: "draft",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      lastSnapshotId: undefined,
      inspirationRef: undefined,
      // Founder note defaults (content is still authored by the admin, but shown as founder voice in the unit UI)
      authorNoteName: "Jacksenn",
      authorNoteQuote: undefined,
    });
    return id;
  },
});

export const createDraftTemplateFromDraft = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const draft: any = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const now = Date.now();
    const name = String(args.name || "").trim();
    if (!name) throw new Error("Template name is required");

    const ref = draft.inspirationRef || {};
    const templateId = await ctx.db.insert("contentDraftTemplates", {
      name,
      description: typeof args.description === "string" ? args.description : undefined,
      inspirationRef: {
        source: "template",
        chapter: ref.chapter,
        pages: ref.pages,
        notes: ref.notes,
        referenceId: ref.referenceId,
      },
      specialistSkillIds: Array.isArray(draft.specialistSkillIds) ? draft.specialistSkillIds : [],
      auditorSkillIds: Array.isArray(draft.auditorSkillIds) ? draft.auditorSkillIds : [],
      isActive: true,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    return templateId;
  },
});

export const updateDraftTemplate = mutation({
  args: {
    templateId: v.id("contentDraftTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    inspirationRef: v.optional(
      v.object({
        source: v.optional(v.string()),
        chapter: v.optional(v.string()),
        pages: v.optional(v.string()),
        notes: v.optional(v.string()),
        referenceId: v.optional(v.id("contentStudioReferences")),
      })
    ),
    specialistSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    auditorSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl) throw new Error("Template not found");
    const patch: any = { updatedAt: Date.now() };
    if (typeof args.name === "string") patch.name = args.name;
    if (typeof args.description === "string") patch.description = args.description;
    if (args.inspirationRef) patch.inspirationRef = args.inspirationRef;
    if (Array.isArray(args.specialistSkillIds)) patch.specialistSkillIds = args.specialistSkillIds;
    if (Array.isArray(args.auditorSkillIds)) patch.auditorSkillIds = args.auditorSkillIds;
    if (typeof args.isActive === "boolean") patch.isActive = args.isActive;
    await ctx.db.patch(args.templateId, patch);
    return { ok: true };
  },
});

export const deactivateDraftTemplate = mutation({
  args: { templateId: v.id("contentDraftTemplates") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl) return { ok: true };
    await ctx.db.patch(args.templateId, { isActive: false, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const createDraftFromTemplate = mutation({
  args: {
    templateId: v.id("contentDraftTemplates"),
    unitNumber: v.number(),
    moduleNumber: v.number(),
    title: v.string(),
    description: v.optional(v.string()),
    // Optional overrides
    inspirationRef: v.optional(
      v.object({
        source: v.optional(v.string()),
        chapter: v.optional(v.string()),
        pages: v.optional(v.string()),
        notes: v.optional(v.string()),
        referenceId: v.optional(v.id("contentStudioReferences")),
      })
    ),
    specialistSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    auditorSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const tpl: any = await ctx.db.get(args.templateId);
    if (!tpl || tpl.isActive === false) throw new Error("Template not found");

    const now = Date.now();
    const inspirationRef = args.inspirationRef ?? tpl.inspirationRef;
    const specialistSkillIds = args.specialistSkillIds ?? tpl.specialistSkillIds ?? [];
    const auditorSkillIds = args.auditorSkillIds ?? tpl.auditorSkillIds ?? [];

    const id = await ctx.db.insert("contentDrafts", {
      unitNumber: args.unitNumber,
      moduleNumber: args.moduleNumber,
      title: args.title,
      description: args.description,
      status: "draft",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      lastSnapshotId: undefined,
      inspirationRef: inspirationRef ? { ...inspirationRef, source: inspirationRef.source ?? "template" } : undefined,
      specialistSkillIds: Array.isArray(specialistSkillIds) ? specialistSkillIds : [],
      auditorSkillIds: Array.isArray(auditorSkillIds) ? auditorSkillIds : [],
      // Founder note defaults
      authorNoteName: "Jacksenn",
      authorNoteQuote: undefined,
    });
    return id;
  },
});

export const updateDraftMeta = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    authorNoteName: v.optional(v.string()),
    authorNoteQuote: v.optional(v.string()),
    inspirationRef: v.optional(
      v.object({
        source: v.optional(v.string()),
        chapter: v.optional(v.string()),
        pages: v.optional(v.string()),
        notes: v.optional(v.string()),
        referenceId: v.optional(v.id("contentStudioReferences")),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await ctx.db.patch(args.draftId, {
      ...(typeof args.title === "string" ? { title: args.title } : {}),
      ...(typeof args.description === "string" ? { description: args.description } : {}),
      ...(typeof args.authorNoteName === "string" ? { authorNoteName: args.authorNoteName } : {}),
      ...(typeof args.authorNoteQuote === "string" ? { authorNoteQuote: args.authorNoteQuote } : {}),
      ...(args.inspirationRef ? { inspirationRef: args.inspirationRef } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const setDraftSectionSkills = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    sectionSkillIds: v.object({
      overview: v.optional(v.id("contentStudioSkills")),
      grammar: v.optional(v.id("contentStudioSkills")),
      phrases: v.optional(v.id("contentStudioSkills")),
      dialogues: v.optional(v.id("contentStudioSkills")),
      exercises: v.optional(v.id("contentStudioSkills")),
    }),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await ctx.db.patch(args.draftId, { sectionSkillIds: args.sectionSkillIds, updatedAt: Date.now() });
  },
});

export const setDraftSpecialistSkills = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    skillIds: v.array(v.id("contentStudioSkills")),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await ctx.db.patch(args.draftId, { specialistSkillIds: args.skillIds, updatedAt: Date.now() });
  },
});

export const setDraftAuditorSkills = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    skillIds: v.array(v.id("contentStudioSkills")),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    await ctx.db.patch(args.draftId, { auditorSkillIds: args.skillIds, updatedAt: Date.now() });
  },
});

export const deleteDraft = mutation({
  args: { draftId: v.id("contentDrafts") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return { ok: true };

    const snaps = await ctx.db
      .query("contentDraftSnapshots")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    for (const s of snaps) await ctx.db.delete(s._id);

    const findings = await ctx.db
      .query("contentDraftFindings")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    for (const f of findings) await ctx.db.delete(f._id);

    const runs = await ctx.db
      .query("contentDraftAiRuns")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    for (const r of runs) await ctx.db.delete(r._id);

    await ctx.db.delete(args.draftId);
    return { ok: true };
  },
});

export const deleteUnitFull = mutation({
  args: {
    unitNumber: v.number(),
    confirm: v.string(), // Must be "DELETE UNIT <N>"
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const { unitNumber, confirm } = args;
    const expected = `DELETE UNIT ${unitNumber}`;
    if (confirm !== expected) {
      throw new Error(`Confirmation mismatch. Expected "${expected}", got "${confirm}"`);
    }

    const deleted: Record<string, number> = {
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
      userProgressPatched: 0,
    };

    // 1. Delete Published Content
    // unitMetadata
    const metas = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    for (const m of metas) {
      await ctx.db.delete(m._id);
      deleted.unitMetadata += 1;
    }

    // unitContent
    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    for (const c of contents) {
      await ctx.db.delete(c._id);
      deleted.unitContent += 1;
    }

    // unitInteractiveTests
    const tests = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    for (const t of tests) {
      await ctx.db.delete(t._id);
      deleted.unitInteractiveTests += 1;
    }

    // courseVocabulary (only those belonging primarily to this unit)
    const vocabs = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const courseVocabIds = (vocabs as any[]).map((v) => v._id);
    // vocabularyProgress (FK: courseVocabularyId)
    for (const vid of courseVocabIds) {
      const progressRows = await ctx.db
        .query("vocabularyProgress")
        .withIndex("by_course_vocab", (q) => q.eq("courseVocabularyId", vid))
        .collect();
      for (const p of progressRows as any[]) {
        await ctx.db.delete(p._id);
        deleted.vocabularyProgress += 1;
      }
    }
    for (const v of vocabs) {
      await ctx.db.delete(v._id);
      deleted.courseVocabulary += 1;
    }

    // unitContentAudio (TTS cache)
    const audios = await ctx.db
      .query("unitContentAudio")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const a of audios as any[]) {
      await ctx.db.delete(a._id);
      deleted.unitContentAudio += 1;
    }

    // 3. Delete gamification / progress data for this unit (cascade)
    const eqp = await ctx.db
      .query("exerciseQuestionProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const row of eqp as any[]) {
      await ctx.db.delete(row._id);
      deleted.exerciseQuestionProgress += 1;
    }

    const qp = await ctx.db
      .query("questionProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const row of qp as any[]) {
      await ctx.db.delete(row._id);
      deleted.questionProgress += 1;
    }

    const results = await ctx.db
      .query("exerciseResults")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const row of results as any[]) {
      await ctx.db.delete(row._id);
      deleted.exerciseResults += 1;
    }

    const completions = await ctx.db
      .query("exerciseCompletions")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const row of completions as any[]) {
      await ctx.db.delete(row._id);
      deleted.exerciseCompletions += 1;
    }

    const quizzes = await ctx.db
      .query("quizProgress")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    for (const row of quizzes as any[]) {
      await ctx.db.delete(row._id);
      deleted.quizProgress += 1;
    }

    // 4. Patch userProgress to remove deleted unit references
    const allUserProgress = await ctx.db.query("userProgress").collect();
    for (const up of allUserProgress as any[]) {
      const completedUnits: number[] = Array.isArray(up.completedUnits) ? up.completedUnits : [];
      const nextCompleted = completedUnits.filter((n) => n !== unitNumber);
      const wasCompleted = nextCompleted.length !== completedUnits.length;
      const currentUnit = typeof up.currentUnit === "number" ? up.currentUnit : 1;
      const nextCurrent = currentUnit === unitNumber ? Math.max(1, unitNumber - 1) : currentUnit;
      const currentChanged = nextCurrent !== currentUnit;
      if (!wasCompleted && !currentChanged) continue;
      await ctx.db.patch(up._id, {
        ...(wasCompleted ? { completedUnits: nextCompleted } : {}),
        ...(currentChanged ? { currentUnit: nextCurrent } : {}),
      });
      deleted.userProgressPatched += 1;
    }

    return { ok: true, unitNumber, deleted };
  },
});

export const addHumanReviewNote = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    snapshotId: v.id("contentDraftSnapshots"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const notes = String(args.notes || "").trim();
    if (!notes) throw new Error("Review notes are empty");

    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    const snap = await ctx.db.get(args.snapshotId);
    if (!snap || snap.draftId !== args.draftId) throw new Error("Snapshot not found for this draft");

    await ctx.db.insert("contentDraftHumanReviews", {
      draftId: args.draftId,
      snapshotId: args.snapshotId,
      notes,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const upsertModelConfig = mutation({
  args: {
    specialist: v.object({ provider: v.union(v.literal("gemini"), v.literal("openai")), model: v.string() }),
    auditor: v.object({ provider: v.union(v.literal("gemini"), v.literal("openai")), model: v.string() }),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    const existing = await ctx.db.query("contentStudioConfig").order("desc").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        specialist: args.specialist,
        // Backward-compat: keep field in DB, but we no longer expose/use it.
        qcFixOnly: args.auditor,
        auditor: args.auditor,
        updatedAt: now,
        updatedBy: user._id,
      });
      return existing._id;
    }
    return await ctx.db.insert("contentStudioConfig", {
      specialist: args.specialist,
      qcFixOnly: args.auditor,
      auditor: args.auditor,
      updatedAt: now,
      updatedBy: user._id,
    });
  },
});

export const upsertStageSkill = mutation({
  args: {
    skillId: v.optional(v.id("contentStudioSkills")),
    stage: v.union(
      v.literal("specialist"),
      v.literal("auditor"),
      v.literal("translator")
    ),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    if (args.skillId) {
      await ctx.db.patch(args.skillId, {
        scope: "stage",
        stage: args.stage,
        name: args.name,
        description: args.description,
        prompt: args.prompt,
        isActive: args.isActive,
        updatedAt: now,
      });
      return args.skillId;
    }
    return await ctx.db.insert("contentStudioSkills", {
      scope: "stage",
      stage: args.stage,
      section: undefined,
      name: args.name,
      description: args.description,
      prompt: args.prompt,
      isActive: args.isActive,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deactivateSkill = mutation({
  args: { skillId: v.id("contentStudioSkills") },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    await ctx.db.patch(args.skillId, { isActive: false, updatedAt: Date.now() });
    return { ok: true };
  },
});

// upsertSectionSkill removed -- section prompts are now managed exclusively
// via chatPrompts (cs_section_*) in the Prompt Administration.

export const generateReferenceUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const upsertReference = mutation({
  args: {
    referenceId: v.optional(v.id("contentStudioReferences")),
    type: v.union(v.literal("pdf"), v.literal("book"), v.literal("article"), v.literal("other")),
    title: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.string()),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    notes: v.optional(v.string()),
    tags: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const now = Date.now();
    const url = typeof args.url === "string" ? args.url.trim() : "";
    const storageId = typeof args.storageId === "string" ? args.storageId.trim() : "";
    if (!url && !storageId) {
      throw new Error("Reference requires either url or storageId (uploaded file).");
    }
    if (args.referenceId) {
      const existing: any = await ctx.db.get(args.referenceId);
      if (!existing) throw new Error("Reference not found");

      // Backward-compat migration: if this reference has a storageId but no pdfFiles array, create it once.
      const shouldBootstrapPdfFiles = storageId && !Array.isArray(existing.pdfFiles);

      await ctx.db.patch(args.referenceId, {
        type: args.type,
        title: args.title,
        url: url || undefined,
        storageId: storageId || undefined,
        fileName: args.fileName,
        mimeType: args.mimeType,
        sizeBytes: args.sizeBytes,
        ...(shouldBootstrapPdfFiles
          ? {
              pdfFiles: [
                {
                  storageId,
                  fileName: args.fileName,
                  mimeType: args.mimeType,
                  sizeBytes: args.sizeBytes,
                  uploadedAt: now,
                },
              ],
            }
          : {}),
        notes: args.notes,
        tags: args.tags,
        isActive: args.isActive,
        updatedAt: now,
      });
      return args.referenceId;
    }
    return await ctx.db.insert("contentStudioReferences", {
      type: args.type,
      title: args.title,
      url: url || undefined,
      storageId: storageId || undefined,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      pdfFiles: storageId
        ? [
            {
              storageId,
              fileName: args.fileName,
              mimeType: args.mimeType,
              sizeBytes: args.sizeBytes,
              uploadedAt: now,
            },
          ]
        : undefined,
      notes: args.notes,
      tags: args.tags,
      isActive: args.isActive,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addReferencePdfFile = mutation({
  args: {
    referenceId: v.id("contentStudioReferences"),
    storageId: v.string(),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const ref: any = await ctx.db.get(args.referenceId);
    if (!ref) throw new Error("Reference not found");
    const now = Date.now();

    const baseFiles: any[] = Array.isArray(ref.pdfFiles) ? ref.pdfFiles.slice() : [];
    if (baseFiles.length === 0 && ref.storageId) {
      baseFiles.push({
        storageId: String(ref.storageId),
        fileName: ref.fileName,
        mimeType: ref.mimeType,
        sizeBytes: ref.sizeBytes,
        uploadedAt: typeof ref.createdAt === "number" ? ref.createdAt : now,
      });
    }

    const sid = String(args.storageId || "").trim();
    if (!sid) throw new Error("storageId is required");
    if (baseFiles.some((f) => String(f?.storageId) === sid)) {
      return { ok: true, alreadyPresent: true };
    }

    baseFiles.push({
      storageId: sid,
      fileName: args.fileName,
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      uploadedAt: now,
    });

    // Keep storageId pointing at the first PDF for backward compatibility.
    const primary = baseFiles[0];
    await ctx.db.patch(args.referenceId, {
      pdfFiles: baseFiles,
      storageId: primary?.storageId ? String(primary.storageId) : ref.storageId,
      fileName: primary?.fileName ?? ref.fileName,
      mimeType: primary?.mimeType ?? ref.mimeType,
      sizeBytes: primary?.sizeBytes ?? ref.sizeBytes,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const removeReferencePdfFile = mutation({
  args: {
    referenceId: v.id("contentStudioReferences"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const ref: any = await ctx.db.get(args.referenceId);
    if (!ref) throw new Error("Reference not found");
    const now = Date.now();

    const current: any[] = Array.isArray(ref.pdfFiles) ? ref.pdfFiles.slice() : [];
    const sid = String(args.storageId || "").trim();
    const next = current.filter((f) => String(f?.storageId) !== sid);

    const primary = next[0] || null;
    await ctx.db.patch(args.referenceId, {
      pdfFiles: next.length ? next : undefined,
      storageId: primary ? String(primary.storageId) : undefined,
      fileName: primary?.fileName,
      mimeType: primary?.mimeType,
      sizeBytes: primary?.sizeBytes,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const revertReferenceGuidelinesToVersion = mutation({
  args: {
    referenceId: v.id("contentStudioReferences"),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const ref = await ctx.db.get(args.referenceId);
    if (!ref) throw new Error("Reference not found");

    const target = await ctx.db
      .query("contentStudioReferenceGuidelineVersions")
      .withIndex("by_reference_version", (q) => q.eq("referenceId", args.referenceId).eq("version", args.version))
      .first();
    if (!target) throw new Error("Guideline version not found");

    const now = Date.now();
    const last = await ctx.db
      .query("contentStudioReferenceGuidelineVersions")
      .withIndex("by_reference_version", (q) => q.eq("referenceId", args.referenceId))
      .order("desc")
      .first();
    const nextVersion = (typeof (last as any)?.version === "number" ? Number((last as any).version) : 0) + 1;

    // Store a new version entry for the revert action (audit trail).
    await ctx.db.insert("contentStudioReferenceGuidelineVersions", {
      referenceId: args.referenceId,
      version: nextVersion,
      guidelines: (target as any).guidelines,
      provider: "revert",
      model: `v${args.version}`,
      isManual: true,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.patch(args.referenceId, {
      guidelines: (target as any).guidelines,
      guidelinesUpdatedAt: now,
      guidelinesProvider: "revert",
      guidelinesModel: `v${args.version}`,
      updatedAt: now,
    });

    return { ok: true, revertedFromVersion: args.version, newVersion: nextVersion };
  },
});

// Hard-delete a single guideline version entry (admin-only).
// This does NOT change the current `contentStudioReferences.guidelines` field.
export const deleteReferenceGuidelineVersion = mutation({
  args: {
    versionId: v.id("contentStudioReferenceGuidelineVersions"),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const row = await ctx.db.get(args.versionId);
    if (!row) {
      // Idempotent delete: treat missing row as success.
      return { ok: true, deleted: false };
    }
    await ctx.db.delete(args.versionId);
    return {
      ok: true,
      deleted: true,
      referenceId: row.referenceId,
      version: row.version,
    };
  },
});

export const setReferenceGuidelines = mutation({
  args: {
    referenceId: v.id("contentStudioReferences"),
    guidelines: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const ref = await ctx.db.get(args.referenceId);
    if (!ref) throw new Error("Reference not found");

    const now = Date.now();
    const last = await ctx.db
      .query("contentStudioReferenceGuidelineVersions")
      .withIndex("by_reference_version", (q) => q.eq("referenceId", args.referenceId))
      .order("desc")
      .first();
    const nextVersion = (typeof (last as any)?.version === "number" ? Number((last as any).version) : 0) + 1;
    const provider = typeof args.provider === "string" ? args.provider : undefined;
    const model = typeof args.model === "string" ? args.model : undefined;
    const isManual = provider === "manual";

    await ctx.db.insert("contentStudioReferenceGuidelineVersions", {
      referenceId: args.referenceId,
      version: nextVersion,
      guidelines: args.guidelines,
      provider,
      model,
      isManual,
      createdBy: user._id,
      createdAt: now,
    });

    await ctx.db.patch(args.referenceId, {
      guidelines: args.guidelines,
      guidelinesUpdatedAt: now,
      guidelinesProvider: provider,
      guidelinesModel: model,
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const saveUnitPackageSnapshot = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    unitPackageJson: v.string(),
    markdownSource: v.optional(v.string()),
    validationReportJson: v.string(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("qc_failed"),
        v.literal("qc_passed"),
        v.literal("audit_failed"),
        v.literal("ready_to_publish"),
        v.literal("published")
      )
    ),
    replaceFindings: v.optional(v.boolean()),
    findings: v.optional(
      v.array(
        v.object({
          stage: v.union(v.literal("validator"), v.literal("auditor")),
          severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
          code: v.string(),
          message: v.string(),
          path: v.optional(v.string()),
          detailsJson: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();
    const snapId = await ctx.db.insert("contentDraftSnapshots", {
      draftId: args.draftId,
      unitPackageJson: args.unitPackageJson,
      markdownSource: args.markdownSource,
      validationReportJson: args.validationReportJson,
      createdAt: now,
    });

    // Replace findings if requested (keep simple: delete all findings for draft)
    if (args.replaceFindings) {
      const existing = await ctx.db
        .query("contentDraftFindings")
        .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
        .collect();

      const makeFingerprint = (
        stage: string,
        code: string,
        path: string | undefined | null
      ) => `${stage}|${code}|${String(path || "").trim().toLowerCase()}`;

      // Collect dismissed fingerprints so they survive a re-run of the lector/validator.
      // The AI re-words findings slightly each run, so we match on stage+code+path (stable identifiers)
      // rather than exact message text. This prevents dismissed false positives from resurfacing.
      const dismissedFingerprints = new Set<string>(
        existing
          .filter((f) => f.dismissed === true)
          .map((f) => makeFingerprint(f.stage, f.code, f.path))
      );

      // Track persistCount per fingerprint across the replaceFindings cycle so the UI
      // can surface "this finding survived N Fix-Findings attempts" to the user.
      // Only non-dismissed findings count: a dismissed finding resets persistCount on
      // re-emergence so the user isn't confused by a stale counter.
      const priorPersistByFingerprint = new Map<string, number>();
      for (const f of existing) {
        if (f.dismissed === true) continue;
        const fp = makeFingerprint(f.stage, f.code, f.path);
        const prev = typeof f.persistCount === "number" ? f.persistCount : 0;
        const current = priorPersistByFingerprint.get(fp);
        priorPersistByFingerprint.set(
          fp,
          typeof current === "number" ? Math.max(current, prev) : prev
        );
      }

      // ---------------------------------------------------------------------
      // Validator Memory auto-capture
      //
      // When the Validator re-runs after a Fix attempt and a previously-seen
      // finding is no longer present, we promote its fingerprint into the
      // Validator Memory as a "candidate". Admins then curate title+guidance
      // and flip status -> "active" so the entry starts influencing future
      // Creator / Fix / Validator runs.
      //
      // Guardrails:
      //   - Only run on Validator/Auditor saves (status = qc_passed / qc_failed /
      //     audit_failed). Fix clears findings with status = "draft" - we must
      //     not treat that as "resolved".
      //   - Only consider non-dismissed findings from the previous state.
      //   - Keep the example message for context (first-fill only; we never
      //     overwrite a curated exampleBefore later).
      // ---------------------------------------------------------------------
      const isValidatorSave =
        args.status === "qc_passed" ||
        args.status === "qc_failed" ||
        args.status === "audit_failed";
      if (isValidatorSave && existing.length > 0) {
        const newFingerprints = new Set<string>(
          (args.findings || []).map((f) =>
            makeValidatorMemoryFingerprint(f.stage, f.code, f.path)
          )
        );

        const resolvedByFingerprint = new Map<
          string,
          { stage: "validator" | "auditor"; code: string; path?: string; message: string }
        >();
        for (const f of existing) {
          if (f.dismissed === true) continue;
          if (f.severity === "info") continue;
          const fp = makeValidatorMemoryFingerprint(f.stage, f.code, f.path);
          if (newFingerprints.has(fp)) continue;
          if (!resolvedByFingerprint.has(fp)) {
            resolvedByFingerprint.set(fp, {
              stage: f.stage,
              code: f.code,
              path: f.path,
              message: String(f.message || ""),
            });
          }
        }

        if (resolvedByFingerprint.size > 0) {
          const draftDoc = await ctx.db.get(args.draftId);
          const sourceUnitNumber =
            typeof draftDoc?.unitNumber === "number" ? draftDoc.unitNumber : undefined;

          for (const [fingerprint, info] of resolvedByFingerprint) {
            const existingMemory = await ctx.db
              .query("contentStudioValidatorMemory")
              .withIndex("by_fingerprint", (q) => q.eq("fingerprint", fingerprint))
              .first();

            if (existingMemory) {
              const patch: any = {
                occurrenceCount: (existingMemory.occurrenceCount ?? 0) + 1,
                lastSeenAt: now,
                updatedAt: now,
              };
              if (!existingMemory.exampleBefore && info.message) {
                patch.exampleBefore = info.message.slice(0, 500);
              }
              await ctx.db.patch(existingMemory._id, patch);
            } else {
              await ctx.db.insert("contentStudioValidatorMemory", {
                fingerprint,
                stage: info.stage,
                code: info.code,
                path: info.path,
                title: info.code,
                guidance: "",
                exampleBefore: info.message ? info.message.slice(0, 500) : undefined,
                exampleAfter: undefined,
                pattern: undefined,
                patternFlags: undefined,
                scope: {
                  applyInCreator: true,
                  applyInFix: true,
                  applyInValidator: false,
                  applyInTranslator: false,
                },
                status: "candidate",
                sourceDraftId: args.draftId,
                sourceUnitNumber,
                occurrenceCount: 1,
                lastSeenAt: now,
                createdAt: now,
                createdBy: undefined,
                updatedAt: now,
                updatedBy: undefined,
              });
            }
          }
        }
      }

      for (const f of existing) {
        await ctx.db.delete(f._id);
      }

      if (args.findings && args.findings.length) {
        for (const f of args.findings) {
          const fingerprint = makeFingerprint(f.stage, f.code, f.path);
          const alreadyDismissed = dismissedFingerprints.has(fingerprint);
          const priorCount = priorPersistByFingerprint.get(fingerprint);
          const nextPersistCount =
            typeof priorCount === "number" ? priorCount + 1 : 0;
          await ctx.db.insert("contentDraftFindings", {
            draftId: args.draftId,
            ...f,
            dismissed: alreadyDismissed ? true : undefined,
            persistCount: nextPersistCount > 0 ? nextPersistCount : undefined,
            createdAt: now,
          });
        }
      }
    } else if (args.findings && args.findings.length) {
      for (const f of args.findings) {
        await ctx.db.insert("contentDraftFindings", {
          draftId: args.draftId,
          ...f,
          createdAt: now,
        });
      }
    }

    const patch: any = {
      lastSnapshotId: snapId,
      updatedAt: now,
    };
    if (args.status) patch.status = args.status as DraftStatus;
    await ctx.db.patch(args.draftId, patch);
    return snapId;
  },
});

export const logAiRun = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    stage: v.union(v.literal("specialist"), v.literal("auditor")),
    provider: v.optional(v.string()),
    model: v.string(),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    status: v.union(v.literal("success"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    await ctx.db.insert("contentDraftAiRuns", {
      draftId: args.draftId,
      stage: args.stage,
      provider: args.provider,
      model: args.model,
      promptHash: undefined,
      inputSummary: args.inputSummary,
      outputSummary: args.outputSummary,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      estimatedCostUsd: args.estimatedCostUsd,
      status: args.status,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

export const setDraftStatus = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    status: v.union(
      v.literal("draft"),
      v.literal("qc_failed"),
      v.literal("qc_passed"),
      v.literal("audit_failed"),
      v.literal("ready_to_publish"),
      v.literal("published")
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    await ctx.db.patch(args.draftId, { status: args.status as DraftStatus, updatedAt: Date.now() });
  },
});

/**
 * Publish-Timeout-Fix (F2): tiny mutation for updating `contentDrafts.publishState`.
 *
 * Called by `publishDraftToPreview` at the start of every publish stage
 * (metadata / content / vocabulary / tests / complete) and on failure. Kept
 * intentionally minimal so it never contributes to the Convex system-op
 * limit, no matter how the surrounding publish batches evolve.
 *
 * The mutation always sets `updatedAt = Date.now()`. Callers control which
 * of the other fields to update via optional args; unset args are left
 * untouched (patch, not replace). This lets the same mutation drive
 * "started running", "moved to next stage", "batch progress",
 * "finished successfully", and "failed with error".
 */
export const internalUpdateDraftPublishState = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    status: v.optional(
      v.union(v.literal("running"), v.literal("success"), v.literal("failed")),
    ),
    stage: v.optional(
      v.union(
        v.literal("metadata"),
        v.literal("content"),
        v.literal("vocabulary"),
        v.literal("tests"),
        v.literal("complete"),
      ),
    ),
    batchIndex: v.optional(v.number()),
    totalBatches: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // Reset the publishState entirely (used at the beginning of a fresh run).
    reset: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();

    if (args.reset) {
      const started = args.startedAt ?? now;
      await ctx.db.patch(args.draftId, {
        publishState: {
          status: args.status ?? "running",
          stage: args.stage ?? "metadata",
          batchIndex: args.batchIndex,
          totalBatches: args.totalBatches,
          startedAt: started,
          updatedAt: now,
          completedAt: args.completedAt,
          error: args.error,
        },
      });
      return null;
    }

    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const prev = (draft as any).publishState;
    if (!prev) {
      // No previous state; initialize with the incoming fields (defensive).
      await ctx.db.patch(args.draftId, {
        publishState: {
          status: args.status ?? "running",
          stage: args.stage ?? "metadata",
          batchIndex: args.batchIndex,
          totalBatches: args.totalBatches,
          startedAt: args.startedAt ?? now,
          updatedAt: now,
          completedAt: args.completedAt,
          error: args.error,
        },
      });
      return null;
    }

    await ctx.db.patch(args.draftId, {
      publishState: {
        status: args.status ?? prev.status,
        stage: args.stage ?? prev.stage,
        batchIndex: args.batchIndex ?? prev.batchIndex,
        totalBatches: args.totalBatches ?? prev.totalBatches,
        startedAt: args.startedAt ?? prev.startedAt,
        updatedAt: now,
        completedAt: args.completedAt ?? prev.completedAt,
        error: args.error ?? prev.error,
      },
    });
    return null;
  },
});

// Internal mutations for publishing (bypassing some checks for speed/atomicity)
/**
 * @deprecated Superseded by the split publish chain
 * (`internalPublishUnitMetadata`, `internalPublishUnitContent`,
 * `internalArchivePreviewVocabulary` + `internalPublishUnitVocabulary`,
 * `internalArchivePreviewTests` + `internalPublishUnitTests`) orchestrated
 * by the `publishDraftToPreview` action.
 *
 * Do NOT call this from new code. The publish-timeout fix moves all
 * publish work through the split chain so a single mutation never exceeds
 * the Convex system-op limit. This monolith is retained ONLY as a
 * rollback safety net: if the new chain breaks in prod, swap the action
 * back to invoking this wrapper directly (single-line change).
 *
 * Any external callers should migrate to the new chain.
 */
export const internalPublishUnitPackageToPreview = mutation({
  args: {
    unitPackage: v.any(),
    unitVersion: v.number(),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    // NOTE: The DB schema is normalized (unitContent by contentType, unitInteractiveTests per question).
    // This mutation writes a PREVIEW release without touching published rows.
    const pkg: any = args.unitPackage;
    const unitNumber = Number(pkg?.unitNumber);
    const now = Date.now();
    const languages: string[] = Array.isArray(pkg?.languages) && pkg.languages.length > 0 ? pkg.languages : ["en"];

    // Module link: prefer manually selected, fallback to JSON moduleNumber.
    let module: any | null = null;
    if (args.moduleId) {
      module = await ctx.db.get(args.moduleId);
    } else if (typeof pkg?.module?.moduleNumber === "number") {
      module = await ctx.db
        .query("moduleMetadata")
        .filter((q) => q.eq(q.field("moduleNumber"), pkg.module.moduleNumber))
        .first();
    }

    // 1) Unit metadata (per language). NOTE: unitMetadata has no unitVersion; preview is gated via releaseStatus.
    for (const lang of languages) {
      const existing = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", lang))
        .first();

      const payload: any = {
        unitNumber,
        language: lang,
        title: String(pkg?.title ?? ""),
        ...(typeof pkg?.description === "string" && String(pkg.description).trim()
          ? { description: String(pkg.description).trim() }
          : {}),
        topics: [],
        grammarFocus: [],
        vocabularyThemes: [],
        releaseStatus: "preview",
      };
      if (module?._id) {
        payload.moduleMetadataId = module._id;
      }

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("unitMetadata", payload);
      }
    }

    // 2) Unit content (per language + contentType) — insert new preview version, archive previous preview versions.
    type UnitContentType = "overview" | "vocabulary" | "grammar" | "phrases" | "dialogues" | "testIntroduction";
    const contentTypeMap: Array<{ key: string; type: UnitContentType }> = [
      { key: "overviewMd", type: "overview" },
      { key: "vocabularyMd", type: "vocabulary" },
      { key: "grammarMd", type: "grammar" },
      { key: "phrasesMd", type: "phrases" },
      { key: "dialoguesMd", type: "dialogues" },
      { key: "testIntroductionMd", type: "testIntroduction" },
    ];

    for (const lang of languages) {
      const contentForLang: any = pkg?.content?.[lang] ?? {};
      for (const m of contentTypeMap) {
        const contentValue = String(contentForLang?.[m.key] ?? "");

        // Archive previous preview rows (keep published untouched).
        const candidates = await ctx.db
          .query("unitContent")
          .withIndex("by_unit_lang_type", (q) => q.eq("unitNumber", unitNumber).eq("language", lang).eq("contentType", m.type))
          .collect();
        for (const c of candidates as any[]) {
          if (c.isActive === false) continue;
          if (c.releaseStatus !== "preview") continue;
          await ctx.db.patch(c._id, { isActive: false, archivedAt: now, updatedAt: now });
        }

        await ctx.db.insert("unitContent", {
          unitNumber,
          language: lang,
          contentType: m.type,
          content: contentValue,
          createdAt: now,
          updatedAt: now,
          isActive: true,
          archivedAt: undefined,
          unitVersion: args.unitVersion,
          version: args.unitVersion, // legacy field; keep aligned
          releaseStatus: "preview",
        });
      }
    }

    // 3) Vocabulary (courseVocabulary master data) — English + carry over existing DE translations.
    {
      const vocabEn: any[] = (pkg?.vocabulary?.en as any[]) ?? [];
      const existing = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();

      // Preserve DE translations from active preview rows before archiving them.
      const deTranslationMap = new Map<string, { de?: string; noteDe?: string }>();
      for (const vdoc of existing as any[]) {
        if (vdoc.isActive === false) continue;
        if (vdoc.releaseStatus !== "preview") continue;
        const key = toVocabularyKey(vdoc.serbian);
        if (key && (vdoc.de || vdoc.noteDe)) {
          deTranslationMap.set(key, {
            de: vdoc.de,
            noteDe: vdoc.noteDe,
          });
        }
      }

      for (const vdoc of existing as any[]) {
        if (vdoc.isActive === false) continue;
        if (vdoc.releaseStatus !== "preview") continue;
        await ctx.db.patch(vdoc._id, { isActive: false, archivedAt: now });
      }

      const skippedDuplicates: string[] = [];
      for (const entry of vocabEn) {
        const serbKey = toVocabularyKey(entry.serbian);

        // Cross-unit dedup guard: skip if word is already taught in an earlier unit
        const earlier = await findEarlierUnitVocabulary(ctx, serbKey, unitNumber);
        if (earlier) {
          skippedDuplicates.push(`"${entry.serbian}" (already in Unit ${earlier.unitNumber})`);
          continue;
        }

        const prevDe = deTranslationMap.get(serbKey);
        await ctx.db.insert("courseVocabulary", {
          unitNumber,
          serbian: entry.serbian,
          serbianNormalized: serbKey,
          en: entry.en,
          translations: [{ language: "en", translation: entry.en }],
          gender: entry.gender || undefined,
          noteEn: entry.noteEn || undefined,
          ...(prevDe?.de ? { de: prevDe.de } : {}),
          ...(prevDe?.noteDe ? { noteDe: prevDe.noteDe } : {}),
          isActive: true,
          archivedAt: undefined,
          unitVersion: args.unitVersion,
          releaseStatus: "preview",
        });
      }
      if (skippedDuplicates.length > 0) {
        console.warn(
          `[PublishPreview] Skipped ${skippedDuplicates.length} cross-unit duplicate(s) for Unit ${unitNumber}: ` +
            skippedDuplicates.join(", "),
        );
      }
    }

    // 4) Exercises (unitInteractiveTests) — English only for now. Insert new preview version, archive previous preview rows.
    {
      const existing = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "en"))
        .collect();
      for (const t of existing as any[]) {
        if (t.isActive === false) continue;
        if (t.releaseStatus !== "preview") continue;
        await ctx.db.patch(t._id, { isActive: false, archivedAt: now });
      }

      const exercisesEn: any[] = (pkg?.exercises?.en as any[]) ?? [];
      for (const cat of exercisesEn) {
        for (const q of cat.questions ?? []) {
          const questionIdToWrite = `${q.questionId}_preview_v${args.unitVersion}`;
          await ctx.db.insert("unitInteractiveTests", {
            unitNumber,
            language: "en",
            category: cat.category,
            categoryInstructions: cat.categoryInstructions,
            questionId: questionIdToWrite,
            questionType: q.questionType,
            question: q.question,
            correctAnswer: q.correctAnswer,
            acceptableAlternatives: q.acceptableAlternatives,
            options: q.options,
            hint: q.hint,
            order: q.order,
            isActive: true,
            archivedAt: undefined,
            unitVersion: args.unitVersion,
            releaseStatus: "preview",
          });
        }
      }
    }

    return { unitNumber, version: args.unitVersion, status: "preview" };
  },
});

export const internalTakeUnitPreviewOffline = mutation({
  args: { unitNumber: v.number() },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();

    // 1) unitMetadata: mark preview rows offline (metadata has no versioning/isActive).
    const metas = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const m of metas as any[]) {
      if (m.releaseStatus !== "preview") continue;
      await ctx.db.patch(m._id, { releaseStatus: "offline" });
    }

    // 2) unitContent: archive preview rows.
    const contents = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const c of contents as any[]) {
      if (c.releaseStatus !== "preview") continue;
      if (c.isActive === false) continue;
      await ctx.db.patch(c._id, { releaseStatus: "offline", isActive: false, archivedAt: now, updatedAt: now });
    }

    // 3) unitInteractiveTests: archive preview rows.
    const tests = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const t of tests as any[]) {
      if (t.releaseStatus !== "preview") continue;
      if (t.isActive === false) continue;
      await ctx.db.patch(t._id, { releaseStatus: "offline", isActive: false, archivedAt: now });
    }

    // 4) courseVocabulary: archive preview rows.
    const vocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const vdoc of vocab as any[]) {
      if (vdoc.releaseStatus !== "preview") continue;
      if (vdoc.isActive === false) continue;
      await ctx.db.patch(vdoc._id, { releaseStatus: "offline", isActive: false, archivedAt: now });
    }

    return { ok: true };
  },
});



// @deprecated — Approval step removed; draft is auto-set to ready_to_publish on push-to-preview.
export const approveAfterPreview = mutation({
  args: { draftId: v.id("contentDrafts") },
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);

    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    if (!draft.lastSnapshotId) throw new Error("Draft has no lastSnapshotId to approve");

    const snap = await ctx.db.get(draft.lastSnapshotId);
    if (!snap) throw new Error("Last snapshot not found");

    // Optional (recommended) precondition: ensure preview content exists for this unit.
    const metas = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", draft.unitNumber))
      .collect();
    const hasPreview = (metas as any[]).some((m) => m?.releaseStatus === "preview");
    if (!hasPreview) {
      throw new Error("Cannot approve: no preview content found for this unit. Publish to preview first.");
    }

    const now = Date.now();
    await ctx.db.patch(args.draftId, {
      approvedSnapshotId: draft.lastSnapshotId,
      status: "ready_to_publish",
      updatedAt: now,
    });
    return { ok: true };
  },
});

// ===== EN -> DE published translation upsert (ContentStudio tool) =====
export const upsertPublishedUnitGermanTranslation = mutation({
  args: {
    unitNumber: v.number(),
    // NOTE: This mutation writes PUBLISHED rows (no preview writes).
    metadataDe: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      topics: v.array(v.string()),
      grammarFocus: v.array(v.string()),
      vocabularyThemes: v.array(v.string()),
      moduleMetadataId: v.optional(v.id("moduleMetadata")),
      moduleId: v.optional(v.string()),
    }),
    contentDe: v.array(
      v.object({
        contentType: v.union(
          v.literal("overview"),
          v.literal("grammar"),
          v.literal("phrases"),
          v.literal("dialogues"),
          v.literal("vocabulary"),
          v.literal("testIntroduction"),
          v.literal("practice")
        ),
        content: v.string(),
        unitVersion: v.number(),
      })
    ),
    testsDe: v.array(
      v.object({
        questionId: v.string(),
        unitVersion: v.number(),
        category: v.string(),
        categoryInstructions: v.optional(v.string()),
        questionType: v.string(),
        question: v.string(),
        correctAnswer: v.string(),
        acceptableAlternatives: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
        hint: v.optional(v.string()),
        order: v.number(),
      })
    ),
    vocabularyDe: v.array(
      v.object({
        courseVocabularyId: v.id("courseVocabulary"),
        de: v.optional(v.string()),
        noteDe: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const now = Date.now();
    const isPublishedStatus = (s: unknown) => s === undefined || s === "published";

    // 1) unitMetadata (DE)
    const metaRowsDe = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    const publishedMetaDe = (metaRowsDe as any[]).filter((m) => isPublishedStatus(m?.releaseStatus));
    publishedMetaDe.sort((a, b) => (b?._creationTime ?? 0) - (a?._creationTime ?? 0));
    const existingMetaDe = publishedMetaDe[0] ?? null;
    const metaPayload: any = {
      unitNumber,
      language: "de",
      title: String(args.metadataDe.title ?? "").trim(),
      ...(typeof args.metadataDe.description === "string" && String(args.metadataDe.description).trim()
        ? { description: String(args.metadataDe.description).trim() }
        : {}),
      topics: Array.isArray(args.metadataDe.topics) ? args.metadataDe.topics : [],
      grammarFocus: Array.isArray(args.metadataDe.grammarFocus) ? args.metadataDe.grammarFocus : [],
      vocabularyThemes: Array.isArray(args.metadataDe.vocabularyThemes) ? args.metadataDe.vocabularyThemes : [],
      ...(args.metadataDe.moduleMetadataId ? { moduleMetadataId: args.metadataDe.moduleMetadataId } : {}),
      ...(typeof args.metadataDe.moduleId === "string" && args.metadataDe.moduleId.trim()
        ? { moduleId: args.metadataDe.moduleId.trim() }
        : {}),
    };
    if (existingMetaDe) {
      await ctx.db.patch(existingMetaDe._id, metaPayload);
    } else {
      await ctx.db.insert("unitMetadata", metaPayload);
    }

    // 2) unitContent (DE) - upsert per contentType + unitVersion (published)
    const existingContentDe = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    // IMPORTANT: Never patch preview rows here. This tool writes published DE content.
    const activeDe = (existingContentDe as any[]).filter(
      (c) => c?.isActive !== false && isPublishedStatus(c?.releaseStatus)
    );

    let contentUpserted = 0;
    for (const row of args.contentDe as any[]) {
      const type = String(row.contentType);
      const ver = Number(row.unitVersion) || 1;
      const match = activeDe.find(
        (c) => String(c?.contentType) === type && (Number(c?.unitVersion ?? c?.version ?? 1) || 1) === ver
      );
      if (match) {
        await ctx.db.patch(match._id, {
          content: String(row.content ?? ""),
          updatedAt: now,
          isActive: true,
          unitVersion: ver,
          version: ver,
        });
      } else {
        await ctx.db.insert("unitContent", {
          unitNumber,
          language: "de",
          contentType: type,
          content: String(row.content ?? ""),
          createdAt: now,
          updatedAt: now,
          isActive: true,
          archivedAt: undefined,
          unitVersion: ver,
          version: ver,
        } as any);
      }
      contentUpserted += 1;
    }

    // 3) unitInteractiveTests (DE) - upsert per questionId + unitVersion (published)
    const existingTestsDe = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();
    // IMPORTANT: Never patch preview rows here. This tool writes published DE tests.
    const activeTestsDe = (existingTestsDe as any[]).filter(
      (t) => t?.isActive !== false && isPublishedStatus(t?.releaseStatus)
    );

    let testsUpserted = 0;
    for (const t of args.testsDe as any[]) {
      const qid = String(t.questionId ?? "").trim();
      if (!qid) continue;
      const ver = Number(t.unitVersion ?? 1) || 1;

      const existing = activeTestsDe.find(
        (x) => String(x?.questionId) === qid && (Number(x?.unitVersion ?? 1) || 1) === ver
      );

      const payload: any = {
        unitNumber,
        language: "de",
        category: String(t.category ?? ""),
        categoryInstructions: typeof t.categoryInstructions === "string" ? t.categoryInstructions : undefined,
        questionId: qid, // shared ID across languages (shared progress)
        questionType: String(t.questionType ?? ""),
        question: String(t.question ?? ""),
        correctAnswer: String(t.correctAnswer ?? ""),
        acceptableAlternatives: Array.isArray(t.acceptableAlternatives) ? t.acceptableAlternatives : undefined,
        options: Array.isArray(t.options) ? t.options : undefined,
        hint: typeof t.hint === "string" ? t.hint : undefined,
        order: Number(t.order ?? 0) || 0,
        isActive: true,
        archivedAt: undefined,
        unitVersion: ver,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("unitInteractiveTests", payload);
      }
      testsUpserted += 1;
    }

    // 4) courseVocabulary (DE) - patch only; no new rows
    let vocabPatched = 0;
    for (const vrow of args.vocabularyDe as any[]) {
      const id = vrow.courseVocabularyId;
      const doc: any = await ctx.db.get(id);
      if (!doc) continue;
      if (Number(doc.unitNumber) !== unitNumber) continue;

      const patch: any = {};
      if (typeof vrow.de === "string") patch.de = vrow.de;
      if (typeof vrow.noteDe === "string") patch.noteDe = vrow.noteDe;
      if (Object.keys(patch).length === 0) continue;

      await ctx.db.patch(id, patch);
      vocabPatched += 1;
    }

    return {
      ok: true,
      unitNumber,
      updated: {
        contentUpserted,
        testsUpserted,
        vocabPatched,
        metadataUpserted: 1,
      },
    };
  },
});

// ===== EN -> DE preview translation upsert (ContentStudio tool) =====
// Writes DE rows as releaseStatus="preview" without touching any published rows.
export const upsertUnitGermanTranslationToPreview = mutation({
  args: {
    unitNumber: v.number(),
    unitVersion: v.number(),
    metadataDe: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      topics: v.array(v.string()),
      grammarFocus: v.array(v.string()),
      vocabularyThemes: v.array(v.string()),
      moduleMetadataId: v.optional(v.id("moduleMetadata")),
      moduleId: v.optional(v.string()),
    }),
    contentDe: v.array(
      v.object({
        contentType: v.union(
          v.literal("overview"),
          v.literal("grammar"),
          v.literal("phrases"),
          v.literal("dialogues"),
          v.literal("vocabulary"),
          v.literal("testIntroduction"),
          v.literal("practice")
        ),
        content: v.string(),
      })
    ),
    testsDe: v.array(
      v.object({
        // questionId here is the BASE id (shared across languages). We'll suffix for preview storage.
        questionId: v.string(),
        category: v.string(),
        categoryInstructions: v.optional(v.string()),
        questionType: v.string(),
        question: v.string(),
        correctAnswer: v.string(),
        acceptableAlternatives: v.optional(v.array(v.string())),
        options: v.optional(v.array(v.string())),
        hint: v.optional(v.string()),
        order: v.number(),
      })
    ),
    vocabularyDe: v.array(
      v.object({
        courseVocabularyId: v.id("courseVocabulary"),
        de: v.optional(v.string()),
        noteDe: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const unitVersion = Number(args.unitVersion) || 1;
    const now = Date.now();

    // 1) unitMetadata (DE) — insert a new PREVIEW row (do not patch published rows)
    await ctx.db.insert("unitMetadata", {
      unitNumber,
      language: "de",
      title: String(args.metadataDe.title ?? "").trim(),
      ...(typeof args.metadataDe.description === "string" && String(args.metadataDe.description).trim()
        ? { description: String(args.metadataDe.description).trim() }
        : {}),
      topics: Array.isArray(args.metadataDe.topics) ? args.metadataDe.topics : [],
      grammarFocus: Array.isArray(args.metadataDe.grammarFocus) ? args.metadataDe.grammarFocus : [],
      vocabularyThemes: Array.isArray(args.metadataDe.vocabularyThemes) ? args.metadataDe.vocabularyThemes : [],
      ...(args.metadataDe.moduleMetadataId ? { moduleMetadataId: args.metadataDe.moduleMetadataId } : {}),
      ...(typeof args.metadataDe.moduleId === "string" && args.metadataDe.moduleId.trim()
        ? { moduleId: args.metadataDe.moduleId.trim() }
        : {}),
      releaseStatus: "preview",
    } as any);

    // 2) unitContent (DE) — archive previous DE preview rows per type, then insert new preview version.
    let contentInserted = 0;
    for (const row of args.contentDe as any[]) {
      const type = String(row?.contentType ?? "");
      const content = String(row?.content ?? "");
      if (!type) continue;

      const candidates = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) => q.eq("unitNumber", unitNumber).eq("language", "de").eq("contentType", type as "overview" | "grammar" | "phrases" | "dialogues" | "vocabulary" | "testIntroduction" | "practice"))
        .collect();
      for (const c of candidates as any[]) {
        if (c.isActive === false) continue;
        if (c.releaseStatus !== "preview") continue;
        await ctx.db.patch(c._id, { isActive: false, archivedAt: now, updatedAt: now });
      }

      await ctx.db.insert("unitContent", {
        unitNumber,
        language: "de",
        contentType: type,
        content,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        archivedAt: undefined,
        unitVersion,
        version: unitVersion, // legacy field; keep aligned
        releaseStatus: "preview",
      } as any);
      contentInserted += 1;
    }

    // 3) unitInteractiveTests (DE) — archive previous DE preview rows, then insert new preview version.
    {
      const existing = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
        .collect();
      for (const t of existing as any[]) {
        if (t.isActive === false) continue;
        if (t.releaseStatus !== "preview") continue;
        await ctx.db.patch(t._id, { isActive: false, archivedAt: now });
      }
    }

    let testsInserted = 0;
    for (const t of args.testsDe as any[]) {
      const baseQid = String(t?.questionId ?? "").trim();
      if (!baseQid) continue;
      // IMPORTANT: Keep preview questionIds globally unique to avoid collisions with published rows and other languages.
      const previewQid = `${baseQid}_preview_de_v${unitVersion}`;

      await ctx.db.insert("unitInteractiveTests", {
        unitNumber,
        language: "de",
        category: String(t?.category ?? ""),
        categoryInstructions: typeof t?.categoryInstructions === "string" ? t.categoryInstructions : undefined,
        questionId: previewQid,
        questionType: String(t?.questionType ?? ""),
        question: String(t?.question ?? ""),
        correctAnswer: String(t?.correctAnswer ?? ""),
        acceptableAlternatives: Array.isArray(t?.acceptableAlternatives) ? t.acceptableAlternatives : undefined,
        options: Array.isArray(t?.options) ? t.options : undefined,
        hint: typeof t?.hint === "string" ? t.hint : undefined,
        order: Number(t?.order ?? 0) || 0,
        isActive: true,
        archivedAt: undefined,
        unitVersion,
        releaseStatus: "preview",
      } as any);
      testsInserted += 1;
    }

    // 4) courseVocabulary — handle DE preview fields.
    // - If the source row is already a preview row: patch it directly with DE fields
    //   (avoids duplicate preview rows when translating from a preview EN source).
    // - If the source row is published: insert a new preview copy (original behavior).
    let vocabInserted = 0;
    for (const vrow of args.vocabularyDe as any[]) {
      const id = vrow.courseVocabularyId;
      const src: any = await ctx.db.get(id);
      if (!src) continue;
      if (Number(src.unitNumber) !== unitNumber) continue;
      if (src.isActive === false) continue;

      const dePatch: any = {};
      if (typeof vrow.de === "string" && String(vrow.de).trim()) dePatch.de = String(vrow.de).trim();
      if (typeof vrow.noteDe === "string" && String(vrow.noteDe).trim()) dePatch.noteDe = String(vrow.noteDe).trim();

      if (src.releaseStatus === "preview") {
        // Source is a preview row → patch DE fields directly; no new row needed.
        if (Object.keys(dePatch).length > 0) {
          await ctx.db.patch(src._id, dePatch);
        }
      } else {
        // Source is published → insert a new preview copy with DE fields.
        await ctx.db.insert("courseVocabulary", {
          unitNumber,
          serbian: String(src.serbian ?? ""),
          serbianNormalized: typeof src.serbianNormalized === "string"
            ? src.serbianNormalized
            : String(src.serbian ?? "").toLowerCase().trim(),
          en: typeof src.en === "string" ? src.en : undefined,
          translations: Array.isArray(src.translations) ? src.translations : undefined,
          gender: typeof src.gender === "string" ? src.gender : undefined,
          pronunciation: typeof src.pronunciation === "string" ? src.pronunciation : undefined,
          audioUrl: typeof src.audioUrl === "string" ? src.audioUrl : undefined,
          audioStorageId: typeof src.audioStorageId === "string" ? src.audioStorageId : undefined,
          noteEn: typeof src.noteEn === "string" ? src.noteEn : undefined,
          ...dePatch,
          isActive: true,
          archivedAt: undefined,
          unitVersion,
          releaseStatus: "preview",
        } as any);
      }
      vocabInserted += 1;
    }

    return {
      ok: true,
      unitNumber,
      unitVersion,
      created: {
        metadataInserted: 1,
        contentInserted,
        testsInserted,
        vocabInserted,
      },
    };
  },
});

// ===== Unit Manager: Promote a language preview to published =====
// Changes releaseStatus from "preview" to "published" for a specific language.
// For vocabulary (column-based), merges DE fields from preview rows into published rows,
// then archives the preview copies.
export const promoteLanguagePreviewToPublished = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    confirm: v.string(), // "PUBLISH <LANG> UNIT <N>" or "REPLACE <LANG> UNIT <N>"
    mode: v.optional(v.union(v.literal("update"), v.literal("replace"))),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const language = String(args.language).toLowerCase();
    const mode = args.mode ?? "update";
    const expected = mode === "replace"
      ? `REPLACE ${language.toUpperCase()} UNIT ${unitNumber}`
      : `PUBLISH ${language.toUpperCase()} UNIT ${unitNumber}`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation mismatch. Expected "${expected}", got "${args.confirm}"`);
    }
    const now = Date.now();

    let metaPromoted = 0;
    let contentPromoted = 0;
    let testsPromoted = 0;
    let vocabMerged = 0;

    // 1) unitMetadata: promote preview -> published for this language.
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    for (const m of metaRows as any[]) {
      if (m.releaseStatus !== "preview") continue;
      await ctx.db.patch(m._id, { releaseStatus: "published" });
      metaPromoted += 1;
    }
    if (metaPromoted === 0) {
      throw new Error(`No preview metadata found for Unit ${unitNumber} language="${language}".`);
    }

    // 2) unitContent: promote preview -> published for this language.
    //    Also archive any existing published rows of the same contentType to avoid duplicates.
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    const previewContent = (contentRows as any[]).filter((c) => c.releaseStatus === "preview" && c.isActive !== false);
    const publishedContent = (contentRows as any[]).filter((c) =>
      (c.releaseStatus === undefined || c.releaseStatus === "published") && c.isActive !== false
    );

    for (const pc of previewContent) {
      // Archive any published row with the same contentType.
      for (const pub of publishedContent) {
        if (pub.contentType === pc.contentType) {
          await ctx.db.patch(pub._id, { isActive: false, archivedAt: now, releaseStatus: "published" });
        }
      }
      await ctx.db.patch(pc._id, { releaseStatus: "published", isActive: true });
      contentPromoted += 1;
    }

    // 3) unitInteractiveTests: promote preview -> published for this language.
    //    Archive existing published tests for this language first.
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    const previewTests = (testRows as any[]).filter((t) => t.releaseStatus === "preview" && t.isActive !== false);
    const publishedTests = (testRows as any[]).filter((t) =>
      (t.releaseStatus === undefined || t.releaseStatus === "published") && t.isActive !== false
    );

    // Archive all currently published tests for this language.
    for (const pub of publishedTests) {
      await ctx.db.patch(pub._id, { isActive: false, archivedAt: now });
    }
    // Promote preview tests: strip the preview suffix from questionId if present.
    for (const pt of previewTests) {
      // Preview questionIds may have suffix like _preview_de_v2 — strip to base for published.
      let qid = String(pt.questionId ?? "");
      const previewSuffixMatch = qid.match(/^(.+?)_preview(?:_[a-z]{2})?_v\d+$/);
      if (previewSuffixMatch) {
        qid = previewSuffixMatch[1];
      }
      await ctx.db.patch(pt._id, {
        releaseStatus: "published",
        isActive: true,
        questionId: qid,
      });
      testsPromoted += 1;
    }

    // 4) courseVocabulary promotion.
    {
      const vocabRows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();
      const previewVocab = (vocabRows as any[]).filter((v) => v.releaseStatus === "preview" && v.isActive !== false);
      const publishedVocab = (vocabRows as any[]).filter((v) =>
        (v.releaseStatus === undefined || v.releaseStatus === "published") && v.isActive !== false
      );

      if (language === "en") {
        // EN promote: preview vocabulary rows become the new published rows.
        // In replace mode, archive existing published rows first.
        if (mode === "replace") {
          for (const pub of publishedVocab) {
            await ctx.db.patch(pub._id, { isActive: false, archivedAt: now, releaseStatus: "published" });
          }
        }
        for (const prev of previewVocab) {
          await ctx.db.patch(prev._id, { releaseStatus: "published", isActive: true });
          vocabMerged += 1;
        }
      } else if (language === "de") {
        // DE promote: merge DE fields from preview rows into published rows, then archive previews.
        const pubBySerbian = new Map<string, any>();
        for (const pv of publishedVocab) {
          const key = String(pv.serbian ?? "").toLowerCase().trim();
          if (key) pubBySerbian.set(key, pv);
        }

        for (const prev of previewVocab) {
          const key = String(prev.serbian ?? "").toLowerCase().trim();
          const pubRow = pubBySerbian.get(key);
          if (pubRow) {
            const patch: any = {};
            if (typeof prev.de === "string" && String(prev.de).trim()) patch.de = prev.de;
            if (typeof prev.noteDe === "string" && String(prev.noteDe).trim()) patch.noteDe = prev.noteDe;
            if (Object.keys(patch).length > 0) {
              await ctx.db.patch(pubRow._id, patch);
              vocabMerged += 1;
            }
          }
          // Archive the preview copy.
          await ctx.db.patch(prev._id, { isActive: false, archivedAt: now, releaseStatus: "offline" });
        }
      }
    }

    // Sync draft status: if a matching draft exists at ready_to_publish, mark it published.
    if (language === "en") {
      const drafts = await ctx.db
        .query("contentDrafts")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const d of drafts) {
        if (d.status === "ready_to_publish") {
          await ctx.db.patch(d._id, { status: "published" as DraftStatus, updatedAt: now });
        }
      }
    }

    // Replace mode: reset all user progress for this unit.
    let progressReset: Record<string, number> | undefined;
    if (mode === "replace") {
      progressReset = {
        questionProgress: 0,
        exerciseQuestionProgress: 0,
        exerciseResults: 0,
        exerciseCompletions: 0,
        quizProgress: 0,
        vocabularyProgress: 0,
      };

      const qpRows = await ctx.db
        .query("questionProgress")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const row of qpRows) {
        await ctx.db.delete(row._id);
        progressReset.questionProgress += 1;
      }

      const eqpRows = await ctx.db
        .query("exerciseQuestionProgress")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const row of eqpRows) {
        await ctx.db.delete(row._id);
        progressReset.exerciseQuestionProgress += 1;
      }

      const erRows = await ctx.db
        .query("exerciseResults")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const row of erRows) {
        await ctx.db.delete(row._id);
        progressReset.exerciseResults += 1;
      }

      const ecRows = await ctx.db
        .query("exerciseCompletions")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const row of ecRows) {
        await ctx.db.delete(row._id);
        progressReset.exerciseCompletions += 1;
      }

      const qzRows = await ctx.db
        .query("quizProgress")
        .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
        .collect();
      for (const row of qzRows) {
        await ctx.db.delete(row._id);
        progressReset.quizProgress += 1;
      }

      const unitVocabs = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();
      for (const vocab of unitVocabs) {
        const vpRows = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_course_vocab", (q) => q.eq("courseVocabularyId", vocab._id))
          .collect();
        for (const vp of vpRows) {
          await ctx.db.delete(vp._id);
          progressReset.vocabularyProgress += 1;
        }
      }
    }

    return {
      ok: true,
      unitNumber,
      language,
      mode,
      promoted: { metaPromoted, contentPromoted, testsPromoted, vocabMerged },
      ...(progressReset ? { progressReset } : {}),
    };
  },
});

// ===== Unit Manager: Take a language-specific preview offline =====
// Only affects preview rows of the specified language (unlike internalTakeUnitPreviewOffline which affects all languages).
export const takeLanguagePreviewOffline = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    confirm: v.string(), // Must be "OFFLINE <LANG> PREVIEW UNIT <N>"
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const language = String(args.language).toLowerCase();
    const expected = `OFFLINE ${language.toUpperCase()} PREVIEW UNIT ${unitNumber}`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation mismatch. Expected "${expected}", got "${args.confirm}"`);
    }
    const now = Date.now();

    let metaOfflined = 0;
    let contentOfflined = 0;
    let testsOfflined = 0;
    let vocabOfflined = 0;

    // 1) unitMetadata: mark preview rows offline for this language.
    const metaRows = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    for (const m of metaRows as any[]) {
      if (m.releaseStatus !== "preview") continue;
      await ctx.db.patch(m._id, { releaseStatus: "offline" });
      metaOfflined += 1;
    }

    // 2) unitContent: archive preview rows for this language.
    const contentRows = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    for (const c of contentRows as any[]) {
      if (c.releaseStatus !== "preview") continue;
      if (c.isActive === false) continue;
      await ctx.db.patch(c._id, { releaseStatus: "offline", isActive: false, archivedAt: now });
      contentOfflined += 1;
    }

    // 3) unitInteractiveTests: archive preview rows for this language.
    const testRows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", language))
      .collect();
    for (const t of testRows as any[]) {
      if (t.releaseStatus !== "preview") continue;
      if (t.isActive === false) continue;
      await ctx.db.patch(t._id, { releaseStatus: "offline", isActive: false, archivedAt: now });
      testsOfflined += 1;
    }

    // 4) courseVocabulary: archive preview rows for this unit.
    //    Only if language is "de" — vocabulary is column-based, preview copies are separate rows.
    if (language === "de") {
      const vocabRows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();
      for (const v of vocabRows as any[]) {
        if (v.releaseStatus !== "preview") continue;
        if (v.isActive === false) continue;
        await ctx.db.patch(v._id, { releaseStatus: "offline", isActive: false, archivedAt: now });
        vocabOfflined += 1;
      }
    }

    return {
      ok: true,
      unitNumber,
      language,
      offlined: { metaOfflined, contentOfflined, testsOfflined, vocabOfflined },
    };
  },
});

export const dismissFinding = mutation({
  args: {
    findingId: v.id("contentDraftFindings"),
    dismissed: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const finding = await ctx.db.get(args.findingId);
    if (!finding) throw new Error("Finding not found");
    await ctx.db.patch(args.findingId, { dismissed: args.dismissed });
  },
});

export const appendFindings = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    findings: v.array(
      v.object({
        stage: v.union(v.literal("validator"), v.literal("auditor")),
        severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
        code: v.string(),
        message: v.string(),
        path: v.optional(v.string()),
        detailsJson: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();
    for (const f of args.findings) {
      await ctx.db.insert("contentDraftFindings", {
        draftId: args.draftId,
        ...f,
        createdAt: now,
      });
    }
  },
});

/**
 * Check which Content Studio prompt keys are missing from the chatPrompts table.
 * Does NOT create or seed any prompts -- all prompts must be managed via /admin/prompt.
 */
export const checkMissingPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allKeys = [
      CS_PROMPT_KEYS.unitCreator,
      CS_PROMPT_KEYS.findingFixer,
      CS_PROMPT_KEYS.lector,
      ...ALL_SECTION_IDS.map((id) => CS_PROMPT_KEYS.section(id)),
    ];

    const results: Array<{ name: string; status: "found" | "missing" }> = [];
    for (const key of allKeys) {
      const existing = await ctx.db
        .query("chatPrompts")
        .withIndex("by_name", (q) => q.eq("name", key))
        .first();
      results.push({ name: key, status: existing?.content ? "found" : "missing" });
    }
    return results;
  },
});

// ===== Repair: restore vocabulary for a published unit from its snapshot =====
export const repairPublishedUnitVocabulary = internalMutation({
  args: {
    unitNumber: v.number(),
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    const unitNumber = Number(args.unitNumber);
    const expected = `REPAIR VOCAB UNIT ${unitNumber}`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation required: confirm must equal '${expected}'`);
    }
    const now = Date.now();

    // Check current active vocabulary count
    const currentVocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
      .collect();
    const activeCount = currentVocab.filter((v: any) => v.isActive !== false && v.releaseStatus !== "offline").length;

    // Strategy 1: Try to reactivate archived preview entries as published
    const archivedPreview = currentVocab.filter(
      (v: any) => v.isActive === false && v.releaseStatus === "preview"
    );
    if (archivedPreview.length > 0 && activeCount === 0) {
      let reactivated = 0;
      for (const v of archivedPreview) {
        await ctx.db.patch(v._id, { isActive: true, archivedAt: undefined, releaseStatus: "published" });
        reactivated += 1;
      }
      return {
        ok: true,
        strategy: "reactivated_archived_preview",
        unitNumber,
        previousActiveCount: activeCount,
        reactivated,
      };
    }

    // Strategy 2: Try to reactivate any archived entries
    const archivedAny = currentVocab.filter((v: any) => v.isActive === false);
    // Pick the latest version per serbian key
    const latestByKey = new Map<string, any>();
    for (const v of archivedAny as any[]) {
      const key = String(v.serbian ?? "").toLowerCase().trim();
      if (!key) continue;
      const existing = latestByKey.get(key);
      if (!existing || (v.unitVersion ?? 1) > (existing.unitVersion ?? 1)) {
        latestByKey.set(key, v);
      }
    }
    if (latestByKey.size > 0 && activeCount === 0) {
      let reactivated = 0;
      for (const v of latestByKey.values()) {
        await ctx.db.patch(v._id, { isActive: true, archivedAt: undefined, releaseStatus: "published" });
        reactivated += 1;
      }
      return {
        ok: true,
        strategy: "reactivated_latest_archived",
        unitNumber,
        previousActiveCount: activeCount,
        reactivated,
      };
    }

    // Strategy 3: Re-create from snapshot
    const drafts = await ctx.db
      .query("contentDrafts")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();
    let snapshotJson: string | null = null;
    for (const d of drafts) {
      if (!d.lastSnapshotId) continue;
      const snap = await ctx.db.get(d.lastSnapshotId as any);
      if (snap && (snap as any).unitPackageJson) {
        snapshotJson = (snap as any).unitPackageJson;
        break;
      }
    }
    if (!snapshotJson) {
      return {
        ok: false,
        error: "No snapshot found and no archived entries to reactivate",
        unitNumber,
        previousActiveCount: activeCount,
        archivedTotal: currentVocab.filter((v: any) => v.isActive === false).length,
      };
    }

    const pkg = JSON.parse(snapshotJson);
    const vocabEn: any[] = pkg?.vocabulary?.en ?? [];
    if (vocabEn.length === 0) {
      return { ok: false, error: "Snapshot has 0 vocabulary entries", unitNumber };
    }

    let created = 0;
    for (const entry of vocabEn) {
      const serbKey = toVocabularyKey(entry.serbian);
      await ctx.db.insert("courseVocabulary", {
        unitNumber,
        serbian: entry.serbian,
        serbianNormalized: serbKey,
        en: entry.en,
        translations: [{ language: "en", translation: entry.en }],
        gender: entry.gender || undefined,
        noteEn: entry.noteEn || undefined,
        isActive: true,
        archivedAt: undefined,
        unitVersion: 1,
        releaseStatus: "published",
      });
      created += 1;
    }
    return {
      ok: true,
      strategy: "recreated_from_snapshot",
      unitNumber,
      previousActiveCount: activeCount,
      created,
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════
// PUBLISH-TIMEOUT FIX — split publish chain
// ─────────────────────────────────────────────────────────────────────────
// The monolith `internalPublishUnitPackageToPreview` above did everything in
// one mutation and started hitting Convex's system-op ceiling in prod once
// units had enough publish history. These smaller building blocks are called
// in sequence by the `publishDraftToPreview` action; each one is bounded and
// idempotent (archive+insert can be re-run without producing duplicates).
// See `docs/CONTENT_STUDIO_PUBLISH_TIMEOUT_FIX.md`.
// ═════════════════════════════════════════════════════════════════════════

/**
 * Step 1: unit metadata for all requested languages. Small, single call.
 */
export const internalPublishUnitMetadata = mutation({
  args: {
    unitPackage: v.any(),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  returns: v.object({
    unitNumber: v.number(),
    languages: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const pkg: any = args.unitPackage;
    const unitNumber = Number(pkg?.unitNumber);
    const languages: string[] = Array.isArray(pkg?.languages) && pkg.languages.length > 0 ? pkg.languages : ["en"];

    let module: any | null = null;
    if (args.moduleId) {
      module = await ctx.db.get(args.moduleId);
    } else if (typeof pkg?.module?.moduleNumber === "number") {
      module = await ctx.db
        .query("moduleMetadata")
        .filter((q) => q.eq(q.field("moduleNumber"), pkg.module.moduleNumber))
        .first();
    }

    for (const lang of languages) {
      const existing = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", lang))
        .first();

      const payload: any = {
        unitNumber,
        language: lang,
        title: String(pkg?.title ?? ""),
        ...(typeof pkg?.description === "string" && String(pkg.description).trim()
          ? { description: String(pkg.description).trim() }
          : {}),
        topics: [],
        grammarFocus: [],
        vocabularyThemes: [],
        releaseStatus: "preview",
      };
      if (module?._id) {
        payload.moduleMetadataId = module._id;
      }

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("unitMetadata", payload);
      }
    }

    return { unitNumber, languages };
  },
});

/**
 * Step 2: unit content for ONE language (all 6 content types).
 * Uses the release+active index so archiving reads bounded rows — never
 * scans the full history for that language.
 */
export const internalPublishUnitContent = mutation({
  args: {
    unitPackage: v.any(),
    unitVersion: v.number(),
    language: v.string(),
  },
  returns: v.object({
    unitNumber: v.number(),
    language: v.string(),
    archivedCount: v.number(),
    insertedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const pkg: any = args.unitPackage;
    const unitNumber = Number(pkg?.unitNumber);
    const now = Date.now();

    type UnitContentType = "overview" | "vocabulary" | "grammar" | "phrases" | "dialogues" | "testIntroduction";
    const contentTypeMap: Array<{ key: string; type: UnitContentType }> = [
      { key: "overviewMd", type: "overview" },
      { key: "vocabularyMd", type: "vocabulary" },
      { key: "grammarMd", type: "grammar" },
      { key: "phrasesMd", type: "phrases" },
      { key: "dialoguesMd", type: "dialogues" },
      { key: "testIntroductionMd", type: "testIntroduction" },
    ];

    const contentForLang: any = pkg?.content?.[args.language] ?? {};
    let archivedCount = 0;
    let insertedCount = 0;

    for (const m of contentTypeMap) {
      const contentValue = String(contentForLang?.[m.key] ?? "");

      // Only active preview rows — bounded, index-narrowed.
      const activePreview = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type_release_active_version", (q) =>
          q
            .eq("unitNumber", unitNumber)
            .eq("language", args.language)
            .eq("contentType", m.type)
            .eq("releaseStatus", "preview")
            .eq("isActive", true),
        )
        .collect();

      for (const c of activePreview) {
        await ctx.db.patch(c._id, { isActive: false, archivedAt: now, updatedAt: now });
        archivedCount += 1;
      }

      await ctx.db.insert("unitContent", {
        unitNumber,
        language: args.language,
        contentType: m.type,
        content: contentValue,
        createdAt: now,
        updatedAt: now,
        isActive: true,
        archivedAt: undefined,
        unitVersion: args.unitVersion,
        version: args.unitVersion,
        releaseStatus: "preview",
      });
      insertedCount += 1;
    }

    return { unitNumber, language: args.language, archivedCount, insertedCount };
  },
});

/**
 * Step 3a: archive active preview vocabulary rows for a unit AND capture
 * their DE translations so the action can pass them into the next insert
 * batches. One call before the insert batches begin.
 */
export const internalArchivePreviewVocabulary = mutation({
  args: {
    unitNumber: v.number(),
  },
  returns: v.object({
    archivedCount: v.number(),
    preservedDe: v.array(
      v.object({
        serbianKey: v.string(),
        de: v.optional(v.string()),
        noteDe: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();

    // Narrowed by release+active: only current preview rows.
    const active = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit_release_active_version", (q) =>
        q
          .eq("unitNumber", args.unitNumber)
          .eq("releaseStatus", "preview")
          .eq("isActive", true),
      )
      .collect();

    const preservedDe: Array<{ serbianKey: string; de?: string; noteDe?: string }> = [];
    for (const row of active as any[]) {
      const key = toVocabularyKey(row.serbian);
      if (key && (row.de || row.noteDe)) {
        preservedDe.push({
          serbianKey: key,
          ...(row.de ? { de: row.de as string } : {}),
          ...(row.noteDe ? { noteDe: row.noteDe as string } : {}),
        });
      }
      await ctx.db.patch(row._id, { isActive: false, archivedAt: now });
    }

    return { archivedCount: active.length, preservedDe };
  },
});

/**
 * Step 3b: insert one batch of vocabulary rows. Batch size 100 (Faktor 16
 * puffer zum Convex-Limit). `preservedDe` and `dedupHits` are provided by
 * the action (both come from queries run outside the mutation loop).
 */
export const internalPublishUnitVocabulary = mutation({
  args: {
    unitNumber: v.number(),
    unitVersion: v.number(),
    batch: v.array(v.any()), // slice of pkg.vocabulary.en
    preservedDe: v.array(
      v.object({
        serbianKey: v.string(),
        de: v.optional(v.string()),
        noteDe: v.optional(v.string()),
      }),
    ),
    dedupHits: v.array(
      v.object({
        serbianKey: v.string(),
        foundInUnit: v.number(),
      }),
    ),
  },
  returns: v.object({
    insertedCount: v.number(),
    skippedCount: v.number(),
    skippedDuplicates: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const preservedMap = new Map<string, { de?: string; noteDe?: string }>();
    for (const p of args.preservedDe) {
      preservedMap.set(p.serbianKey, { de: p.de, noteDe: p.noteDe });
    }
    const dedupMap = new Map<string, number>();
    for (const h of args.dedupHits) {
      dedupMap.set(h.serbianKey, h.foundInUnit);
    }

    let insertedCount = 0;
    let skippedCount = 0;
    const skippedDuplicates: string[] = [];

    for (const entry of args.batch as any[]) {
      const serbKey = toVocabularyKey(entry?.serbian);
      if (!serbKey) {
        skippedCount += 1;
        continue;
      }

      const dupUnit = dedupMap.get(serbKey);
      if (typeof dupUnit === "number") {
        skippedDuplicates.push(`"${entry.serbian}" (already in Unit ${dupUnit})`);
        skippedCount += 1;
        continue;
      }

      const prevDe = preservedMap.get(serbKey);
      await ctx.db.insert("courseVocabulary", {
        unitNumber: args.unitNumber,
        serbian: entry.serbian,
        serbianNormalized: serbKey,
        en: entry.en,
        translations: [{ language: "en", translation: entry.en }],
        gender: entry.gender || undefined,
        noteEn: entry.noteEn || undefined,
        ...(prevDe?.de ? { de: prevDe.de } : {}),
        ...(prevDe?.noteDe ? { noteDe: prevDe.noteDe } : {}),
        isActive: true,
        archivedAt: undefined,
        unitVersion: args.unitVersion,
        releaseStatus: "preview",
      });
      insertedCount += 1;
    }

    return { insertedCount, skippedCount, skippedDuplicates };
  },
});

/**
 * Step 4a: archive active preview interactive-test rows for one language.
 * Single call before the insert batches begin.
 */
export const internalArchivePreviewTests = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
  },
  returns: v.object({
    archivedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const now = Date.now();

    const active = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang_release_active_version", (q) =>
        q
          .eq("unitNumber", args.unitNumber)
          .eq("language", args.language)
          .eq("releaseStatus", "preview")
          .eq("isActive", true),
      )
      .collect();

    for (const t of active) {
      await ctx.db.patch(t._id, { isActive: false, archivedAt: now });
    }

    return { archivedCount: active.length };
  },
});

/**
 * Step 4b: insert one batch of interactive-test rows. Batch size 100.
 * Each item is an already-flattened question record (category + question
 * merged by the action) so the mutation can insert without further
 * restructuring.
 */
export const internalPublishUnitTests = mutation({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    unitVersion: v.number(),
    batch: v.array(
      v.object({
        category: v.string(),
        categoryInstructions: v.optional(v.string()),
        question: v.any(), // canonical question payload from pkg.exercises.en[i].questions[j]
      }),
    ),
  },
  returns: v.object({
    insertedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    let insertedCount = 0;
    for (const item of args.batch) {
      const q: any = item.question;
      const questionIdToWrite = `${q.questionId}_preview_v${args.unitVersion}`;
      await ctx.db.insert("unitInteractiveTests", {
        unitNumber: args.unitNumber,
        language: args.language,
        category: item.category,
        categoryInstructions: item.categoryInstructions,
        questionId: questionIdToWrite,
        questionType: q.questionType,
        question: q.question,
        correctAnswer: q.correctAnswer,
        acceptableAlternatives: q.acceptableAlternatives,
        options: q.options,
        hint: q.hint,
        order: q.order,
        isActive: true,
        archivedAt: undefined,
        unitVersion: args.unitVersion,
        releaseStatus: "preview",
      });
      insertedCount += 1;
    }

    return { insertedCount };
  },
});

/**
 * Strip leftover HELP parentheticals (full-sentence translation of the Serbian stem)
 * from DE exercise prompts for one unit. Keeps fill-in source cues like "(Milch)".
 * Safe, deterministic content fix — no AI. Applies to preview + published active rows.
 * Callable from CLI: npx convex run contentStudio/_mutations:stripDeExerciseGlossesForUnit ...
 */
export const stripDeExerciseGlossesForUnit = internalMutation({
  args: {
    unitNumber: v.number(),
    confirm: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    scanned: v.number(),
    updated: v.number(),
    dryRun: v.boolean(),
    examples: v.array(
      v.object({
        questionId: v.string(),
        before: v.string(),
        after: v.string(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const unitNumber = Number(args.unitNumber);
    const expected = `STRIP_DE_GLOSSES_UNIT_${unitNumber}`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation required: confirm must equal '${expected}'`);
    }
    const dryRun = args.dryRun === true;
    const rows = await ctx.db
      .query("unitInteractiveTests")
      .withIndex("by_unit_lang", (q) => q.eq("unitNumber", unitNumber).eq("language", "de"))
      .collect();

    let scanned = 0;
    let updated = 0;
    const examples: Array<{ questionId: string; before: string; after: string }> = [];

    for (const row of rows) {
      if (row.isActive === false) continue;
      scanned += 1;
      const qType = String(row.questionType ?? "");
      const category = String(row.category ?? "");
      const treatAsStem =
        isSerbianStemExerciseType(qType) ||
        category === "fillInBlank" ||
        category === "multipleChoice" ||
        category === "dialogueCompletion";
      if (!treatAsStem) continue;

      const before = String(row.question ?? "");
      const after = stripTrailingParentheticalGlosses(before);
      if (after === before) continue;

      updated += 1;
      if (examples.length < 12) {
        examples.push({ questionId: String(row.questionId), before, after });
      }
      if (!dryRun) {
        await ctx.db.patch(row._id, { question: after });
      }
    }

    return { scanned, updated, dryRun, examples };
  },
});

const TRANSLATOR_DIALOGUE_SKILL_NAME =
  "Dialogue-Completion: kein Referenztext anhängen";

const TRANSLATOR_DIALOGUE_SKILL_PROMPT = [
  `For questions with category=="dialogueCompletion":`,
  `- The prompt is a Serbian dialogue snippet with speaker markers (A: / B:).`,
  `- Keep the Serbian text EXACTLY as-is. Do NOT translate it into German.`,
  `- Do NOT append a parenthetical reference translation.`,
  `- Do NOT paraphrase, restructure, or extend the dialogue.`,
  `- Options and correctAnswer stay Serbian and unchanged.`,
].join("\n");

/**
 * Idempotent seed for the initial translator skill (dialogueCompletion rule).
 * CLI: npx convex run contentStudio/_mutations:seedTranslatorDialogueCompletionSkill '{"confirm":"SEED_TRANSLATOR_DIALOGUE_SKILL"}'
 * Safe to re-run: updates prompt if the skill already exists by name.
 */
export const seedTranslatorDialogueCompletionSkill = internalMutation({
  args: { confirm: v.string() },
  returns: v.object({
    ok: v.boolean(),
    skillId: v.id("contentStudioSkills"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (args.confirm !== "SEED_TRANSLATOR_DIALOGUE_SKILL") {
      throw new Error(
        "Confirmation required: confirm must equal 'SEED_TRANSLATOR_DIALOGUE_SKILL'"
      );
    }
    const now = Date.now();
    // Prefer an admin/staff user as createdBy; fall back to any user.
    const users = await ctx.db.query("users").take(50);
    const owner =
      users.find((u) => u.role === "superadmin" || u.role === "admin") ?? users[0];
    if (!owner) {
      throw new Error("Cannot seed translator skill: no users in database");
    }

    const existing = await ctx.db
      .query("contentStudioSkills")
      .withIndex("by_stage_active", (q) => q.eq("stage", "translator").eq("isActive", true))
      .collect();
    const found = existing.find((s) => s.name === TRANSLATOR_DIALOGUE_SKILL_NAME);
    if (found) {
      await ctx.db.patch(found._id, {
        prompt: TRANSLATOR_DIALOGUE_SKILL_PROMPT,
        description:
          "Hardening rule: dialogueCompletion stems stay Serbian; no EN reference in parentheses.",
        updatedAt: now,
      });
      return { ok: true, skillId: found._id, created: false };
    }
    const skillId = await ctx.db.insert("contentStudioSkills", {
      scope: "stage",
      stage: "translator",
      section: undefined,
      name: TRANSLATOR_DIALOGUE_SKILL_NAME,
      description:
        "Hardening rule: dialogueCompletion stems stay Serbian; no EN reference in parentheses.",
      prompt: TRANSLATOR_DIALOGUE_SKILL_PROMPT,
      isActive: true,
      createdBy: owner._id,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, skillId, created: true };
  },
});

/**
 * One-time backfill: set scope.applyInTranslator=false where the field is missing.
 */
export const backfillValidatorMemoryApplyInTranslator = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), patched: v.number() }),
  handler: async (ctx) => {
    const all = await ctx.db.query("contentStudioValidatorMemory").collect();
    let patched = 0;
    for (const e of all) {
      if (e.scope?.applyInTranslator !== undefined) continue;
      await ctx.db.patch(e._id, {
        scope: {
          applyInCreator: e.scope.applyInCreator,
          applyInFix: e.scope.applyInFix,
          applyInValidator: e.scope.applyInValidator,
          applyInTranslator: false,
        },
      });
      patched += 1;
    }
    return { scanned: all.length, patched };
  },
});
