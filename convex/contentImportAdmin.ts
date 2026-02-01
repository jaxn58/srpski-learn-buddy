import { v } from "convex/values";
import { action, internalMutation, query, ActionCtx, QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

import { UnitPackageSchema, validateUnitPackageDeep } from "../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../scripts/unitPackage/autofix";
import { parseMarkdownToUnitPackage, validateMarkdownStructure } from "../scripts/markdownParser/parser";

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

export const listRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getSuperadminUser(ctx);
    if (!user) throw new Error("Unauthorized - Superadmin required");

    const limit = args.limit && args.limit > 0 ? Math.min(args.limit, 200) : 50;

    const runs = await ctx.db
      .query("contentImportRuns")
      .withIndex("by_started_at")
      .order("desc")
      .take(limit);

    // Keep list view lightweight (reportJson only via getRun)
    return runs.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      type: r.type,
      status: r.status,
      mode: (r as any).mode,
      unitVersion: (r as any).unitVersion,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdBy: r.createdBy,
      fileNames: r.fileNames,
      filesCount: r.filesCount,
      unitNumbers: r.unitNumbers,
      totalErrors: r.totalErrors,
      totalWarnings: r.totalWarnings,
    }));
  },
});

export const getRun = query({
  args: {
    runId: v.id("contentImportRuns"),
  },
  handler: async (ctx, args) => {
    const user = await getSuperadminUser(ctx);
    if (!user) throw new Error("Unauthorized - Superadmin required");

    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");
    return run;
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

    let maxVersion = 1;
    let activeContent = 0;
    let activeTests = 0;
    let activeVocab = 0;

    for (const lang of args.languages) {
      const contents = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", lang))
        .collect();
      for (const c of contents as any[]) {
        if (c.isActive === false) continue;
        activeContent += 1;
        maxVersion = Math.max(maxVersion, c.unitVersion ?? c.version ?? 1);
      }

      const tests = await ctx.db
        .query("unitInteractiveTests")
        .withIndex("by_unit_lang", (q) => q.eq("unitNumber", args.unitNumber).eq("language", lang))
        .collect();
      for (const t of tests as any[]) {
        if (t.isActive === false) continue;
        activeTests += 1;
        maxVersion = Math.max(maxVersion, t.unitVersion ?? 1);
      }
    }

    const vocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();
    for (const vdoc of vocab as any[]) {
      if (vdoc.isActive === false) continue;
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

export const validateUnitPackages = action({
  args: {
    files: v.array(v.object({ fileName: v.string(), unitPackage: v.any() })),
    includeFixed: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ runId: Id<"contentImportRuns">; report: Report }> => {
    const user = await requireSuperadminAction(ctx);

    const startedAt = Date.now();
    const includeFixed = args.includeFixed ?? true;

    const files: FileResult[] = args.files.map((f) => analyzeOne(f, includeFixed));
    const validFiles = files.filter((f) => f.valid).length;
    const invalidFiles = files.length - validFiles;
    const totalErrors = files.reduce((sum, f) => sum + f.errors.length + f.parseErrors.length, 0);
    const totalWarnings = 0;

    const status: "success" | "failed" = invalidFiles === 0 ? "success" : "failed";

    const report: Report = {
      generatedAt: new Date().toISOString(),
      type: "validate",
      status,
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
      type: "validate",
      status,
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
    // #region agent log
    if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H2',location:'convex/contentImportAdmin.ts:internalImportUnitPackage:start',message:'internalImportUnitPackage start',data:{fileName:args.fileName,unitNumber:(fixed as any).unitNumber,mode,unitVersion:(args as any).unitVersion ?? null,languages:(fixed as any).languages ?? []},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
    const __agentNorm = (s: unknown) =>
      String(s ?? "")
        .normalize("NFC")
        .trim();
    const __agentNormLower = (s: unknown) => __agentNorm(s).toLowerCase();
    const __agentIncomingCounts = new Map<string, number>();
    for (const e of vocabEn) {
      const k = __agentNormLower(e?.serbian);
      if (!k) continue;
      __agentIncomingCounts.set(k, (__agentIncomingCounts.get(k) ?? 0) + 1);
    }
    const __agentIncomingDupes = Array.from(__agentIncomingCounts.entries())
      .filter(([, c]) => c > 1)
      .slice(0, 8)
      .map(([k, c]) => ({ k, c }));
    // #region agent log
    if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H4',location:'convex/contentImportAdmin.ts:internalImportUnitPackage:vocab:incoming',message:'incoming vocab normalized duplicates (within file)',data:{unitNumber:fixed.unitNumber,incomingCount:vocabEn.length,dupesCount:__agentIncomingDupes.length,dupes:__agentIncomingDupes,mode},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // Preload existing (active) vocabulary for this unit and group by normalized key.
    const __agentExistingAll = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", fixed.unitNumber))
      .collect();
    const __agentExistingActive = (__agentExistingAll as any[]).filter((v: any) => v.isActive !== false);
    const __agentExistingByNorm = new Map<string, any[]>();
    for (const vdoc of __agentExistingActive) {
      const k = __agentNormLower(vdoc?.serbianNormalized ?? vdoc?.serbian);
      if (!k) continue;
      const arr = __agentExistingByNorm.get(k) ?? [];
      arr.push(vdoc);
      __agentExistingByNorm.set(k, arr);
    }
    const __agentExistingDupes = Array.from(__agentExistingByNorm.entries())
      .filter(([, arr]) => arr.length > 1)
      .slice(0, 6)
      .map(([k, arr]) => ({
        k,
        count: arr.length,
        sample: arr.slice(0, 3).map((d: any) => ({ id: String(d._id), serbian: d.serbian, unitVersion: d.unitVersion ?? 1, isActive: d.isActive !== false })),
      }));
    // #region agent log
    if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H5',location:'convex/contentImportAdmin.ts:internalImportUnitPackage:vocab:existing',message:'existing active vocab normalized duplicates (in DB)',data:{unitNumber:fixed.unitNumber,existingActiveCount:__agentExistingActive.length,normalizedKeys:__agentExistingByNorm.size,dupeKeysCount:__agentExistingDupes.length,dupeKeysSample:__agentExistingDupes,mode},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    for (const entry of vocabEn) {
      const __agentRawSerbian = String(entry?.serbian ?? "");
      const __agentNormSerbian = __agentNorm(__agentRawSerbian);
      const __agentNormKey = __agentNormLower(__agentRawSerbian);
      if (isReplace) {
        const payload: any = {
          unitNumber: fixed.unitNumber,
          serbian: entry.serbian,
          serbianNormalized: String(entry.serbian || "").toLowerCase().trim(), // Case-insensitive search
          translations: [
            { language: "en", translation: entry.en, alt: entry.enAlt || undefined },
          ],
          gender: entry.gender || undefined,
          noteEn: entry.noteEn || undefined,
          en: entry.en,
          enAlt: entry.enAlt || undefined,
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
      const __agentNormCandidates = __agentExistingByNorm.get(__agentNormKey) ?? [];
      if (candidates.length === 0 && __agentNormKey && __agentNormCandidates.length > 0) {
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H1',location:'convex/contentImportAdmin.ts:internalImportUnitPackage:vocab:mismatch',message:'no exact match, but normalized match exists (likely whitespace/case/unicode)',data:{unitNumber:fixed.unitNumber,entrySerbian:__agentRawSerbian,entrySerbianJson:JSON.stringify(__agentRawSerbian),entryLen:__agentRawSerbian.length,entryTrimmed:__agentNormSerbian,entryTrimmedJson:JSON.stringify(__agentNormSerbian),normKey:__agentNormKey,existingSameNormSample:__agentNormCandidates.slice(0,3).map((d:any)=>({id:String(d._id),serbian:d.serbian,serbianJson:JSON.stringify(String(d.serbian ?? "")),len:String(d.serbian ?? "").length,unitVersion:d.unitVersion ?? 1,isActive:d.isActive !== false}))},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      if (active.length > 1) {
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'vocab-dup-pre',hypothesisId:'VOC-H5',location:'convex/contentImportAdmin.ts:internalImportUnitPackage:vocab:multiple-active',message:'multiple active docs for same exact (unitNumber, serbian) candidates',data:{unitNumber:fixed.unitNumber,entrySerbian:__agentRawSerbian,candidatesCount:candidates.length,activeCount:active.length,activeSample:active.slice(0,3).map((d:any)=>({id:String(d._id),serbian:d.serbian,unitVersion:d.unitVersion ?? 1,isActive:d.isActive !== false}))},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
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
          alt: entry.enAlt || undefined,
        },
      ];

      const payload: any = {
        unitNumber: fixed.unitNumber,
        serbian: entry.serbian,
        serbianNormalized: String(entry.serbian || "").toLowerCase().trim(), // Case-insensitive search
        translations,
        gender: entry.gender || undefined,
        noteEn: entry.noteEn || undefined,
        en: entry.en,
        enAlt: entry.enAlt || undefined,
      };

      if (existing) {
        await ctx.db.patch(existing._id, { ...payload, isActive: true, unitVersion: existing.unitVersion ?? 1 });
      } else {
        await ctx.db.insert("courseVocabulary", { ...payload, isActive: true, unitVersion: 1 });
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
        const active = candidates.filter((t: any) => t.isActive !== false);
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

    return { unitNumber: fixed.unitNumber, title: fixed.title };
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

// ============= MARKDOWN TO JSON CONVERSION =============
export const parseMarkdownToJson = action({
  args: {
    files: v.array(v.object({ 
      fileName: v.string(), 
      markdownContent: v.string() 
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireSuperadminAction(ctx);
    // #region agent log
    if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H1',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:start',message:'parseMarkdownToJson start',data:{filesCount:args.files.length,fileNames:args.files.map(f=>f.fileName)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    
    // Parse all MD files to JSON
    const results = args.files.map(file => {
      try {
        // First, validate markdown structure
        const structureValidation = validateMarkdownStructure(file.markdownContent);
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H2',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:structure',message:'structure validation',data:{fileName:file.fileName,valid:structureValidation.valid,errorsCount:structureValidation.errors.length,hasOverview:file.markdownContent.includes("## 1. Overview"),hasExercises:file.markdownContent.includes("## 5. Interactive Test")},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!structureValidation.valid) {
          return {
            fileName: file.fileName,
            success: false,
            error: `Invalid Markdown structure: ${structureValidation.errors.join(", ")}`,
            structureErrors: structureValidation.errors,
          };
        }

        // Parse markdown to unit package
        const unitPackage = parseMarkdownToUnitPackage(file.markdownContent);
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H3',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:parsed',message:'parsed unitPackage',data:{fileName:file.fileName,unitNumber:unitPackage.unitNumber,moduleNumber:unitPackage.module?.moduleNumber,contentKeys:Object.keys(unitPackage.content?.en ?? {}),vocabCount:(unitPackage.vocabulary?.en ?? []).length,exerciseCategories:(unitPackage.exercises?.en ?? []).length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        // Apply auto-fixes
        const { fixed, changes } = autofixUnitPackage(unitPackage);

        const schemaResult = UnitPackageSchema.safeParse(fixed);
        if (!schemaResult.success) {
          const schemaErrors = schemaResult.error.issues.map((i) => ({
            path: i.path.join(".") || "(root)",
            message: i.message,
          }));
          // #region agent log
          if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H4',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:schemaFail',message:'schema validation failed',data:{fileName:file.fileName,errorsCount:schemaErrors.length,firstError:schemaErrors[0] ?? null,changesCount:changes.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return {
            fileName: file.fileName,
            success: false,
            unitPackage: fixed,
            unitNumber: fixed.unitNumber,
            title: fixed.title,
            changesCount: changes.length,
            changesPreview: changes.slice(0, 10), // First 10 changes
            errorsCount: schemaErrors.length,
            warningsCount: 0,
            errors: schemaErrors,
            warnings: [],
          };
        }

        // Validate the fixed package (deep rules)
        const issues = validateUnitPackageDeep(schemaResult.data);
        const errors = issues.filter((i) => i.level === "error");
        const warnings = issues.filter((i) => i.level === "warning");
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H5',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:deep',message:'deep validation',data:{fileName:file.fileName,errorsCount:errors.length,warningsCount:warnings.length,changesCount:changes.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        
        return {
          fileName: file.fileName,
          success: errors.length === 0,
          unitPackage: fixed,
          unitNumber: fixed.unitNumber,
          title: fixed.title,
          changesCount: changes.length,
          changesPreview: changes.slice(0, 10), // First 10 changes
          errorsCount: errors.length,
          warningsCount: warnings.length,
          errors: errors.map(e => ({ path: e.path, message: e.message })),
          warnings: warnings.map(w => ({ path: w.path, message: w.message })),
        };
      } catch (error: any) {
        // #region agent log
        if (process.env.NODE_ENV !== "production") fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H6',location:'convex/contentImportAdmin.ts:parseMarkdownToJson:catch',message:'parse error',data:{fileName:file.fileName,error:String(error?.message || error)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return {
          fileName: file.fileName,
          success: false,
          error: error.message || "Unknown parsing error",
        };
      }
    });
    
    return { results };
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

