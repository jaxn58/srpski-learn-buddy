import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { requireSuperadmin } from "./_shared";
import type { DraftStatus } from "./_shared";
import {
  CS_PROMPT_KEYS,
  ALL_SECTION_IDS,
} from "./prompts";
import { findEarlierUnitVocabulary } from "../vocabulary";

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
      userProgressPatched: 0,
    };

    // 1. Delete all drafts for this unit
    const drafts = await ctx.db
      .query("contentDrafts")
      .filter((q) => q.eq(q.field("unitNumber"), unitNumber))
      .collect();

    for (const d of drafts) {
      deleted.drafts += 1;
      // Delete snapshots
      const snaps = await ctx.db
        .query("contentDraftSnapshots")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      for (const s of snaps) {
        await ctx.db.delete(s._id);
        deleted.draftSnapshots += 1;
      }

      // Delete findings
      const findings = await ctx.db
        .query("contentDraftFindings")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      for (const f of findings) {
        await ctx.db.delete(f._id);
        deleted.draftFindings += 1;
      }

      // Delete AI runs
      const runs = await ctx.db
        .query("contentDraftAiRuns")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      for (const r of runs) {
        await ctx.db.delete(r._id);
        deleted.draftAiRuns += 1;
      }

      // Delete human reviews
      const reviews = await ctx.db
        .query("contentDraftHumanReviews")
        .withIndex("by_draft", (q) => q.eq("draftId", d._id))
        .collect();
      for (const r of reviews) {
        await ctx.db.delete(r._id);
        deleted.draftHumanReviews += 1;
      }

      // Delete draft itself
      await ctx.db.delete(d._id);
    }

    // 2. Delete Published Content
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

    return { ok: true, unitNumber, deletedDrafts: drafts.length, deleted };
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
    stage: v.union(v.literal("specialist"), v.literal("auditor")),
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

      // Collect dismissed fingerprints so they survive a re-run of the lector/validator.
      // The AI re-words findings slightly each run, so we match on stage+code+path (stable identifiers)
      // rather than exact message text. This prevents dismissed false positives from resurfacing.
      const dismissedFingerprints = new Set<string>(
        existing
          .filter((f) => f.dismissed === true)
          .map((f) => `${f.stage}|${f.code}|${String(f.path || "").trim().toLowerCase()}`)
      );

      for (const f of existing) {
        await ctx.db.delete(f._id);
      }

      if (args.findings && args.findings.length) {
        for (const f of args.findings) {
          const fingerprint = `${f.stage}|${f.code}|${String(f.path || "").trim().toLowerCase()}`;
          const alreadyDismissed = dismissedFingerprints.has(fingerprint);
          await ctx.db.insert("contentDraftFindings", {
            draftId: args.draftId,
            ...f,
            dismissed: alreadyDismissed ? true : undefined,
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

// Internal mutations for publishing (bypassing some checks for speed/atomicity)
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

      // #region agent log
      console.log(`[DEBUG-8cc85d] publishPreview vocab PRE-ARCHIVE: Unit ${unitNumber}, total existing rows=${existing.length}, active=${(existing as any[]).filter((v: any) => v.isActive !== false).length}, preview=${(existing as any[]).filter((v: any) => v.releaseStatus === "preview" && v.isActive !== false).length}, published=${(existing as any[]).filter((v: any) => (v.releaseStatus === undefined || v.releaseStatus === "published") && v.isActive !== false).length}`);
      for (const vdoc of existing as any[]) {
        if (vdoc.isActive === false) continue;
        console.log(`[DEBUG-8cc85d] publishPreview existing active: serbian="${vdoc.serbian}", serbianNormalized="${vdoc.serbianNormalized}", releaseStatus="${vdoc.releaseStatus}", unitVersion=${vdoc.unitVersion}`);
      }
      // #endregion

      // Preserve DE translations from active preview rows before archiving them.
      const deTranslationMap = new Map<string, { de?: string; deAlt?: string; noteDe?: string }>();
      for (const vdoc of existing as any[]) {
        if (vdoc.isActive === false) continue;
        if (vdoc.releaseStatus !== "preview") continue;
        const key = String(vdoc.serbian || "").toLowerCase().trim();
        if (key && (vdoc.de || vdoc.deAlt || vdoc.noteDe)) {
          deTranslationMap.set(key, {
            de: vdoc.de,
            deAlt: vdoc.deAlt,
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
      // #region agent log
      const vocabKeys = vocabEn.map((e: any) => String(e.serbian || "").toLowerCase().trim());
      const vocabKeySet = new Set(vocabKeys);
      console.log(`[DEBUG-8cc85d] publishPreview vocab: Unit ${unitNumber}, vocabEn has ${vocabEn.length} entries, unique keys: ${vocabKeySet.size}, duplicateKeys: ${JSON.stringify(vocabKeys.filter((k: string, i: number) => vocabKeys.indexOf(k) !== i))}`);
      // #endregion
      const insertedInThisRun = new Set<string>();
      for (const entry of vocabEn) {
        const serbKey = String(entry.serbian || "").toLowerCase().trim();

        // #region agent log
        if (insertedInThisRun.has(serbKey)) {
          console.log(`[DEBUG-8cc85d] publishPreview: WITHIN-UNIT DUPLICATE detected for "${entry.serbian}" (serbKey="${serbKey}") in Unit ${unitNumber} — already inserted in this run!`);
        }
        // #endregion

        // Cross-unit dedup guard: skip if word is already taught in an earlier unit
        const earlier = await findEarlierUnitVocabulary(ctx, serbKey, unitNumber);
        if (earlier) {
          skippedDuplicates.push(`"${entry.serbian}" (already in Unit ${earlier.unitNumber})`);
          continue;
        }

        // #region agent log
        console.log(`[DEBUG-8cc85d] publishPreview: INSERTING "${entry.serbian}" (serbKey="${serbKey}") into Unit ${unitNumber}, noteEn="${entry.noteEn || ""}"`);
        // #endregion
        insertedInThisRun.add(serbKey);

        const prevDe = deTranslationMap.get(serbKey);
        await ctx.db.insert("courseVocabulary", {
          unitNumber,
          serbian: entry.serbian,
          serbianNormalized: serbKey,
          en: entry.en,
          enAlt: entry.enAlt || undefined,
          translations: [{ language: "en", translation: entry.en, alt: entry.enAlt || undefined }],
          gender: entry.gender || undefined,
          noteEn: entry.noteEn || undefined,
          ...(prevDe?.de ? { de: prevDe.de } : {}),
          ...(prevDe?.deAlt ? { deAlt: prevDe.deAlt } : {}),
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
          v.literal("testIntroduction")
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
        deAlt: v.optional(v.string()),
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
      if (typeof vrow.deAlt === "string") patch.deAlt = vrow.deAlt;
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
          v.literal("testIntroduction")
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
        deAlt: v.optional(v.string()),
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
      if (typeof vrow.deAlt === "string" && String(vrow.deAlt).trim()) dePatch.deAlt = String(vrow.deAlt).trim();
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
          enAlt: typeof src.enAlt === "string" ? src.enAlt : undefined,
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
    confirm: v.string(), // Must be "PUBLISH <LANG> UNIT <N>"
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unitNumber = Number(args.unitNumber);
    const language = String(args.language).toLowerCase();
    const expected = `PUBLISH ${language.toUpperCase()} UNIT ${unitNumber}`;
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

    // 4) courseVocabulary: merge DE fields from preview rows into published rows, then archive previews.
    if (language === "de") {
      const vocabRows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
        .collect();
      const previewVocab = (vocabRows as any[]).filter((v) => v.releaseStatus === "preview" && v.isActive !== false);
      const publishedVocab = (vocabRows as any[]).filter((v) =>
        (v.releaseStatus === undefined || v.releaseStatus === "published") && v.isActive !== false
      );

      // Build a lookup: serbian (normalized) -> published row
      const pubBySerbian = new Map<string, any>();
      for (const pv of publishedVocab) {
        const key = String(pv.serbian ?? "").toLowerCase().trim();
        if (key) pubBySerbian.set(key, pv);
      }

      for (const prev of previewVocab) {
        const key = String(prev.serbian ?? "").toLowerCase().trim();
        const pubRow = pubBySerbian.get(key);
        if (pubRow) {
          // Merge DE fields into the published row.
          const patch: any = {};
          if (typeof prev.de === "string" && String(prev.de).trim()) patch.de = prev.de;
          if (typeof prev.deAlt === "string" && String(prev.deAlt).trim()) patch.deAlt = prev.deAlt;
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

    return {
      ok: true,
      unitNumber,
      language,
      promoted: { metaPromoted, contentPromoted, testsPromoted, vocabMerged },
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
