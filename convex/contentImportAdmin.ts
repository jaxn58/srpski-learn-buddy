import { v } from "convex/values";
import { action, internalMutation, query, ActionCtx, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

import { UnitPackageSchema, validateUnitPackageDeep } from "../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../scripts/unitPackage/autofix";
import { findEarlierUnitVocabulary, toVocabularyKey } from "./vocabulary";
import { purgeProgressForRemovedVocab } from "./contentStudio/_vocabularyProgressRemap";

type FileInput = { fileName: string; unitPackage: unknown };

type FileResult = {
  fileName: string;
  unitNumber?: number;
  title?: string;
  valid: boolean;
  changesCount: number;
  changesPreview: Array<{ kind: string; path: string; note?: string }>;
  errors: Array<{ path: string; message: string }>;
  parseErrors: Array<{ path: string; message: string }>;
  fixedPackage?: unknown;
};

type Report = {
  generatedAt: string;
  type: "validate" | "import";
  status: "success" | "failed";
  summary: {
    files: number;
    validFiles: number;
    invalidFiles: number;
    totalErrors: number;
    totalWarnings: number;
  };
  files: FileResult[];
};

async function getSuperadminUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || user.role !== "superadmin") return null;
  return user;
}

async function requireSuperadminAction(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized - Superadmin required");

  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }
  return user;
}

// ============= MODULE SELECTION FOR IMPORT =============
export const listModulesForImport = query({
  args: {},
  handler: async (ctx) => {
    const user = await getSuperadminUser(ctx);
    if (!user) throw new Error("Unauthorized - Superadmin required");

    // Get all consolidated modules (deduplicated by slug, sorted by moduleNumber)
    const modules = await ctx.db
      .query("moduleMetadata")
      .filter((q) => q.neq(q.field("slug"), undefined))
      .collect();
    
    // Deduplicate by moduleNumber - keep only one module per number
    const uniqueByNumber = new Map<number, typeof modules[0]>();
    for (const module of modules) {
      const num = module.moduleNumber;
      if (num !== undefined && !uniqueByNumber.has(num)) {
        uniqueByNumber.set(num, module);
      }
    }
    
    // Convert back to array and sort
    const uniqueModules = Array.from(uniqueByNumber.values());
    const sorted = uniqueModules.sort((a, b) => {
      const numA = a.moduleNumber ?? 999;
      const numB = b.moduleNumber ?? 999;
      return numA - numB;
    });
    
    // Return minimal info for dropdown
    return sorted.map(m => ({
      _id: m._id,
      moduleNumber: m.moduleNumber!,
      title: m.titleEn || m.title || `Module ${m.moduleNumber}`,
      slug: m.slug,
    }));
  },
});

function analyzeOne(input: FileInput, includeFixed: boolean): FileResult {
  let parsed: any = input.unitPackage;

  const base = UnitPackageSchema.safeParse(parsed);
  if (!base.success) {
    return {
      fileName: input.fileName,
      valid: false,
      changesCount: 0,
      changesPreview: [],
      errors: [],
      parseErrors: base.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      })),
      fixedPackage: includeFixed ? input.unitPackage : undefined,
    };
  }

  const { fixed, changes } = autofixUnitPackage(base.data);
  const deepIssues = validateUnitPackageDeep(fixed);

  const errors = deepIssues.filter((i) => i.level === "error");

  return {
    fileName: input.fileName,
    unitNumber: fixed.unitNumber,
    title: fixed.title,
    valid: errors.length === 0,
    changesCount: changes.length,
    changesPreview: changes.slice(0, 50).map((c) => ({
      kind: c.kind,
      path: c.path.join("."),
      note: c.note,
    })),
    errors: errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    parseErrors: [],
    fixedPackage: includeFixed ? fixed : undefined,
  };
}

export const internalCreateRun = internalMutation({
  args: {
    type: v.union(v.literal("validate"), v.literal("import")),
    status: v.union(v.literal("success"), v.literal("failed")),
    mode: v.optional(v.union(v.literal("update"), v.literal("replace"))),
    unitVersion: v.optional(v.number()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdBy: v.id("users"),
    fileNames: v.array(v.string()),
    filesCount: v.number(),
    unitNumbers: v.array(v.number()),
    totalErrors: v.number(),
    totalWarnings: v.number(),
    reportJson: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("contentImportRuns", args);
  },
});

export const previewReplaceUnit = query({
  args: {
    unitNumber: v.number(),
    languages: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getSuperadminUser(ctx);
    if (!user) throw new Error("Unauthorized - Superadmin required");

    // Publish-Timeout-Fix (Baustein E): use the active-only compound indexes
    // so we never scan the archived history. Previously this ran
    // `by_unit_lang`/`by_unit` + collect(), which pulled every archived row
    // ever written for the unit and got heavier every publish cycle.
    //
    // unitContent has no plain `by_unit_lang_active` — we iterate the six
    // canonical content types (bounded) instead.
    const UNIT_CONTENT_TYPES = [
      "overview",
      "vocabulary",
      "grammar",
      "phrases",
      "dialogues",
      "testIntroduction",
    ] as const;

    let maxVersion = 1;
    let activeContent = 0;
    let activeTests = 0;
    let activeVocab = 0;

    for (const lang of args.languages) {
      for (const contentType of UNIT_CONTENT_TYPES) {
        const contents = await ctx.db
          .query("unitContent")
          .withIndex("by_unit_lang_type_active", (q) =>
            q
              .eq("unitNumber", args.unitNumber)
              .eq("language", lang)
              .eq("contentType", contentType)
              .eq("isActive", true),
          )
          .collect();
        for (const c of contents as any[]) {
          activeContent += 1;
          maxVersion = Math.max(maxVersion, c.unitVersion ?? c.version ?? 1);
        }
      }

      const tests = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_unit_lang_active", (q) =>
          q.eq("unitNumber", args.unitNumber).eq("language", lang).eq("isActive", true),
        )
        .collect();
      for (const t of tests as any[]) {
        activeTests += 1;
        maxVersion = Math.max(maxVersion, t.unitVersion ?? 1);
      }
    }

    const vocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit_active", (q) =>
        q.eq("unitNumber", args.unitNumber).eq("isActive", true),
      )
      .collect();
    for (const vdoc of vocab as any[]) {
      activeVocab += 1;
      maxVersion = Math.max(maxVersion, vdoc.unitVersion ?? 1);
    }

    return {
      currentUnitVersion: maxVersion,
      nextUnitVersion: maxVersion + 1,
      willArchive: { content: activeContent, tests: activeTests, vocabulary: activeVocab },
    };
  },
});

export const internalImportUnitPackage = internalMutation({
  args: {
    fileName: v.string(),
    unitPackage: v.any(),
    moduleId: v.optional(v.id("moduleMetadata")), // Optional: manually selected module
    mode: v.optional(v.union(v.literal("update"), v.literal("replace"))),
    unitVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const base = UnitPackageSchema.safeParse(args.unitPackage);
    if (!base.success) {
      throw new Error(`Invalid unitPackage for ${args.fileName}`);
    }

    const { fixed } = autofixUnitPackage(base.data);
    const issues = validateUnitPackageDeep(fixed);
    const errors = issues.filter((i) => i.level === "error");
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${args.fileName}`);
    }

    const now = Date.now();
    const mode: "update" | "replace" = (args as any).mode ?? "update";
    const isReplace = mode === "replace";
    const targetUnitVersion = isReplace ? (args as any).unitVersion : undefined;
    if (isReplace && (typeof targetUnitVersion !== "number" || targetUnitVersion < 1)) {
      throw new Error(`Replace mode requires a valid unitVersion for ${args.fileName}`);
    }

    // Module link: prefer manually selected, fallback to JSON moduleNumber
    let module = null;
    if (args.moduleId) {
      // Use manually selected module from UI
      module = await ctx.db.get(args.moduleId);
    } else {
      // Fallback: best-effort module link by moduleNumber from JSON
      module = await ctx.db
        .query("moduleMetadata")
        .filter((q) => q.eq(q.field("moduleNumber"), fixed.module.moduleNumber))
        .first();
    }

    // 1) Unit metadata (per language)
    for (const lang of fixed.languages) {
      const existing = await ctx.db
        .query("unitMetadata")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", fixed.unitNumber).eq("language", lang))
        .first();

      const payload: any = {
        unitNumber: fixed.unitNumber,
        language: lang,
        title: fixed.title,
        // Unit description comes from Markdown/UnitPackage (preferred source of truth).
        // IMPORTANT: We only set it when present to avoid unintentionally wiping existing descriptions.
        ...(typeof (fixed as any).description === "string" && String((fixed as any).description).trim()
          ? { description: String((fixed as any).description).trim() }
          : {}),
        topics: [],
        grammarFocus: [],
        vocabularyThemes: [],
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

    // 2) Unit content (per language)
    type UnitContentType =
      | "overview"
      | "vocabulary"
      | "grammar"
      | "phrases"
      | "dialogues"
      | "testIntroduction";
    const contentTypeMap: Array<{ key: string; type: UnitContentType }> = [
      { key: "overviewMd", type: "overview" },
      { key: "vocabularyMd", type: "vocabulary" },
      { key: "grammarMd", type: "grammar" },
      { key: "phrasesMd", type: "phrases" },
      { key: "dialoguesMd", type: "dialogues" },
      { key: "testIntroductionMd", type: "testIntroduction" },
    ];

    for (const lang of fixed.languages) {
      const contentForLang: any = (fixed as any).content?.[lang] ?? {};
      for (const m of contentTypeMap) {
        const contentValue = String(contentForLang?.[m.key] ?? "");
        if (isReplace) {
          await ctx.db.insert("unitContent", {
            unitNumber: fixed.unitNumber,
            language: lang,
            contentType: m.type,
            content: contentValue,
            createdAt: now,
            updatedAt: now,
            isActive: true,
            archivedAt: undefined,
            unitVersion: targetUnitVersion,
            version: targetUnitVersion, // legacy field; keep aligned
          });
          continue;
        }

        const candidates = await ctx.db
          .query("unitContent")
          .withIndex("by_unit_lang_type", (q) =>
            q.eq("unitNumber", fixed.unitNumber).eq("language", lang).eq("contentType", m.type)
          )
          .collect();
        const active = candidates.filter((c: any) => c.isActive !== false);
        let existing: any | null = null;
        let bestV = -1;
        for (const c of active) {
          const v = c.unitVersion ?? c.version ?? 1;
          if (v > bestV) {
            existing = c;
            bestV = v;
          }
        }

        if (existing) {
          await ctx.db.patch(existing._id, {
            content: contentValue,
            updatedAt: now,
            isActive: true,
            unitVersion: existing.unitVersion ?? 1,
          });
        } else {
          await ctx.db.insert("unitContent", {
            unitNumber: fixed.unitNumber,
            language: lang,
            contentType: m.type as any,
            content: contentValue,
            createdAt: now,
            updatedAt: now,
            isActive: true,
            unitVersion: 1,
            version: 1,
          });
        }
      }
    }

    // 3) Vocabulary (courseVocabulary master data) — English only for now
    const vocabEn: any[] = ((fixed as any).vocabulary?.en as any[]) ?? [];

    const skippedCrossUnitDups: string[] = [];
    // Keys that should remain active in THIS unit after import (update mode
    // reconcile). Cross-unit duplicates are intentionally excluded because they
    // live in an earlier unit, not here.
    const desiredKeys = new Set<string>();
    for (const entry of vocabEn) {
      const entryNormKey = toVocabularyKey(entry?.serbian);

      const earlierHit = await findEarlierUnitVocabulary(ctx, entryNormKey, fixed.unitNumber);
      if (earlierHit) {
        skippedCrossUnitDups.push(`"${entry.serbian}" (already in Unit ${earlierHit.unitNumber})`);
        continue;
      }
      if (entryNormKey) desiredKeys.add(entryNormKey);

      if (isReplace) {
        const payload: any = {
          unitNumber: fixed.unitNumber,
          serbian: entry.serbian,
          serbianNormalized: entryNormKey,
          translations: [{ language: "en", translation: entry.en }],
          gender: entry.gender || undefined,
          noteEn: entry.noteEn || undefined,
          autoAdded: entry.autoAdded === true ? true : undefined,
          en: entry.en,
          isActive: true,
          archivedAt: undefined,
          unitVersion: targetUnitVersion,
        };
        await ctx.db.insert("courseVocabulary", payload);
        continue;
      }

      const candidates = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit_serbian", (q) => q.eq("unitNumber", fixed.unitNumber).eq("serbian", entry.serbian))
        .collect();
      const active = candidates.filter((v: any) => v.isActive !== false);
      let existing: any | null = null;
      let bestV = -1;
      for (const v of active) {
        const ver = v.unitVersion ?? 1;
        if (ver > bestV) {
          existing = v;
          bestV = ver;
        }
      }

      const translations = [
        {
          language: "en",
          translation: entry.en,
        },
      ];

      const payload: any = {
        unitNumber: fixed.unitNumber,
        serbian: entry.serbian,
        serbianNormalized: entryNormKey, // Case-insensitive + NFC-normalized
        translations,
        gender: entry.gender || undefined,
        noteEn: entry.noteEn || undefined,
        autoAdded: entry.autoAdded === true ? true : undefined,
        en: entry.en,
      };

      if (existing) {
        await ctx.db.patch(existing._id, { ...payload, isActive: true, unitVersion: existing.unitVersion ?? 1 });
      } else {
        await ctx.db.insert("courseVocabulary", { ...payload, isActive: true, unitVersion: 1 });
      }
    }
    if (skippedCrossUnitDups.length > 0) {
      console.warn(
        `[Import] Skipped ${skippedCrossUnitDups.length} cross-unit duplicate(s) for Unit ${fixed.unitNumber}: ` +
          skippedCrossUnitDups.join(", "),
      );
    }

    // Update-mode reconcile: archive active EN vocabulary of this unit that is
    // no longer part of the imported source, and purge its per-vocabulary
    // progress (total XP stays untouched). Replace mode already rebuilds the
    // unit from scratch, so reconcile only applies to update.
    let reconciledRemovals = 0;
    if (!isReplace) {
      const activeRows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", fixed.unitNumber))
        .collect();
      for (const row of activeRows as any[]) {
        if (row.isActive === false) continue;
        if (row.releaseStatus === "preview" || row.releaseStatus === "offline") continue;
        const key = toVocabularyKey(row.serbianNormalized ?? row.serbian);
        if (!key) continue;
        if (desiredKeys.has(key)) continue;
        await purgeProgressForRemovedVocab(ctx, fixed.unitNumber, row._id);
        await ctx.db.patch(row._id, {
          isActive: false,
          archivedAt: now,
          releaseStatus: "offline",
        });
        reconciledRemovals += 1;
      }
      if (reconciledRemovals > 0) {
        console.log(
          `[Import] Unit ${fixed.unitNumber}: update reconcile archived ${reconciledRemovals} removed vocabulary entr(ies).`,
        );
      }
    }

    // 4) Exercises (unitInteractiveTests) — English only for now
    const exercisesEn: any[] = ((fixed as any).exercises?.en as any[]) ?? [];
    for (const cat of exercisesEn) {
      for (const q of cat.questions) {
        const questionIdToWrite = isReplace ? `${q.questionId}_v${targetUnitVersion}` : q.questionId;
        if (isReplace) {
          const payload: any = {
            unitNumber: fixed.unitNumber,
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
            unitVersion: targetUnitVersion,
          };
          await ctx.db.insert("unitInteractiveTests", payload);
          continue;
        }

        const candidates = await ctx.db
          .query("unitInteractiveTests")
          .withIndex("by_question_id", (qq) => qq.eq("questionId", questionIdToWrite))
          .collect();
        // IMPORTANT: questionId is shared across languages (e.g. EN + DE).
        // When importing EN, never patch DE rows.
        const active = candidates.filter(
          (t: any) => t.isActive !== false && t.unitNumber === fixed.unitNumber && t.language === "en"
        );
        let existing: any | null = null;
        let bestV = -1;
        for (const t of active) {
          const ver = t.unitVersion ?? 1;
          if (ver > bestV) {
            existing = t;
            bestV = ver;
          }
        }

        const payload: any = {
          unitNumber: fixed.unitNumber,
          language: "en",
          category: cat.category,
          categoryInstructions: cat.categoryInstructions,
          questionId: q.questionId,
          questionType: q.questionType,
          question: q.question,
          correctAnswer: q.correctAnswer,
          acceptableAlternatives: q.acceptableAlternatives,
          options: q.options,
          hint: q.hint,
          order: q.order,
        };

        if (existing) {
          await ctx.db.patch(existing._id, { ...payload, questionId: questionIdToWrite, isActive: true, unitVersion: existing.unitVersion ?? 1 });
        } else {
          await ctx.db.insert("unitInteractiveTests", { ...payload, questionId: questionIdToWrite, isActive: true, unitVersion: 1 });
        }
      }
    }

    return { unitNumber: fixed.unitNumber, title: fixed.title, reconciledRemovals };
  },
});

export const internalArchiveUnitForReplace = internalMutation({
  args: {
    unitNumber: v.number(),
    languages: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let maxVersion = 1;
    let archivedContent = 0;
    let archivedTests = 0;
    let archivedVocab = 0;

    // Archive unitContent + unitInteractiveTests per language
    for (const lang of args.languages) {
      const contents = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", lang))
        .collect();
      for (const c of contents as any[]) {
        if (c.isActive === false) continue;
        maxVersion = Math.max(maxVersion, c.unitVersion ?? c.version ?? 1);
        await ctx.db.patch(c._id, { isActive: false, archivedAt: now });
        archivedContent += 1;
      }

      const tests = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", lang))
        .collect();
      for (const t of tests as any[]) {
        if (t.isActive === false) continue;
        maxVersion = Math.max(maxVersion, t.unitVersion ?? 1);
        await ctx.db.patch(t._id, { isActive: false, archivedAt: now });
        archivedTests += 1;
      }
    }

    // Archive courseVocabulary (language-agnostic)
    const vocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const vdoc of vocab as any[]) {
      if (vdoc.isActive === false) continue;
      maxVersion = Math.max(maxVersion, vdoc.unitVersion ?? 1);
      await ctx.db.patch(vdoc._id, { isActive: false, archivedAt: now });
      archivedVocab += 1;
    }

    return {
      nextUnitVersion: maxVersion + 1,
      archived: { content: archivedContent, tests: archivedTests, vocabulary: archivedVocab },
    };
  },
});

export const importUnitPackages = action({
  args: {
    files: v.array(v.object({ fileName: v.string(), unitPackage: v.any() })),
    confirm: v.string(),
    moduleId: v.optional(v.id("moduleMetadata")), // Optional: manually selected module
    mode: v.optional(v.union(v.literal("update"), v.literal("replace"))),
  },
  handler: async (ctx, args): Promise<{ runId: Id<"contentImportRuns">; report: Report; imported?: Array<{ fileName: string; unitNumber: number; title: string }> }> => {
    const user = await requireSuperadminAction(ctx);
    const mode: "update" | "replace" = (args as any).mode ?? "update";

    const startedAt = Date.now();

    // Validate first (blocking)
    const files: FileResult[] = args.files.map((f) => analyzeOne(f, false));
    const validFiles = files.filter((f) => f.valid).length;
    const invalidFiles = files.length - validFiles;
    const totalErrors = files.reduce((sum, f) => sum + f.errors.length + f.parseErrors.length, 0);
    const totalWarnings = 0;

    if (invalidFiles > 0) {
      const report: Report = {
        generatedAt: new Date().toISOString(),
        type: "import",
        status: "failed",
        summary: {
          files: files.length,
          validFiles,
          invalidFiles,
          totalErrors,
          totalWarnings,
        },
        files,
      };

      const fileNames = files.map((f) => f.fileName);
      const unitNumbers = Array.from(
        new Set(files.map((f) => f.unitNumber).filter((n): n is number => typeof n === "number"))
      ).sort((a, b) => a - b);

      const runId = await ctx.runMutation(internal.contentImportAdmin.internalCreateRun, {
        type: "import",
        status: "failed",
        mode,
        startedAt,
        completedAt: Date.now(),
        createdBy: user._id as Id<"users">,
        fileNames,
        filesCount: files.length,
        unitNumbers,
        totalErrors,
        totalWarnings,
        reportJson: JSON.stringify(report),
      });

      return { runId, report };
    }

    const unitNumbersForConfirm = Array.from(
      new Set(files.map((f) => f.unitNumber).filter((n): n is number => typeof n === "number"))
    ).sort((a, b) => a - b);
    const expectedConfirm =
      mode === "replace"
        ? unitNumbersForConfirm.length === 1
          ? `REPLACE UNIT ${unitNumbersForConfirm[0]}`
          : `REPLACE UNITS ${unitNumbersForConfirm.join(",")}`
        : "IMPORT";
    if (args.confirm !== expectedConfirm) {
      throw new Error(`Confirmation required: confirm must equal '${expectedConfirm}'`);
    }

    // Import sequentially
    const imported: Array<{ fileName: string; unitNumber: number; title: string }> = [];
    const fixedFiles: Array<{ fileName: string; fixed: any }> = [];
    for (const f of args.files) {
      const base = UnitPackageSchema.safeParse(f.unitPackage);
      if (!base.success) throw new Error(`Invalid package (unexpected) for ${f.fileName}`);
      const { fixed } = autofixUnitPackage(base.data);
      fixedFiles.push({ fileName: f.fileName, fixed });
    }

    const unitVersionByUnit = new Map<number, number>();
    if (mode === "replace") {
      const langsByUnit = new Map<number, Set<string>>();
      for (const f of fixedFiles) {
        const u = f.fixed.unitNumber as number;
        const langs: string[] = f.fixed.languages ?? [];
        if (!langsByUnit.has(u)) langsByUnit.set(u, new Set());
        for (const l of langs) langsByUnit.get(u)!.add(l);
      }
      for (const u of unitNumbersForConfirm) {
        const langs = Array.from(langsByUnit.get(u) ?? new Set(["en"]));
        const res = await ctx.runMutation(internal.contentImportAdmin.internalArchiveUnitForReplace, {
          unitNumber: u,
          languages: langs,
        });
        unitVersionByUnit.set(u, res.nextUnitVersion);
      }
    }

    for (const f of fixedFiles) {
      const unitNumber = f.fixed.unitNumber as number;
      const result = await ctx.runMutation(internal.contentImportAdmin.internalImportUnitPackage, {
        fileName: f.fileName,
        unitPackage: f.fixed,
        moduleId: args.moduleId, // Pass manually selected module
        mode,
        unitVersion: mode === "replace" ? unitVersionByUnit.get(unitNumber) : undefined,
      });
      imported.push({ fileName: f.fileName, unitNumber: result.unitNumber, title: result.title });
    }

    const report: Report = {
      generatedAt: new Date().toISOString(),
      type: "import",
      status: "success",
      summary: {
        files: files.length,
        validFiles,
        invalidFiles,
        totalErrors: 0,
        totalWarnings: 0,
      },
      files,
    };

    const fileNames = files.map((f) => f.fileName);
    const unitNumbers = imported.map((i) => i.unitNumber).sort((a, b) => a - b);

    const runId = await ctx.runMutation(internal.contentImportAdmin.internalCreateRun, {
      type: "import",
      status: "success",
      mode,
      unitVersion: mode === "replace" && unitNumbersForConfirm.length === 1 ? unitVersionByUnit.get(unitNumbersForConfirm[0]) : undefined,
      startedAt,
      completedAt: Date.now(),
      createdBy: user._id as Id<"users">,
      fileNames,
      filesCount: files.length,
      unitNumbers,
      totalErrors: 0,
      totalWarnings: 0,
      reportJson: JSON.stringify({ ...report, imported }),
    });

    return { runId, report, imported };
  },
});

