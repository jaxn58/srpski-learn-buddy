import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireSuperadminAction, parseJsonOrThrow } from "./_shared";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";
import {
  verifySerbianGermanAlignment,
  formatRetryFeedback,
  type VerifierReport,
} from "./_verifier";
import {
  buildSerbianContextBlock,
  runMetadataTranslation,
  buildMetadataDeFromAi,
  translateMarkdownSection,
  buildContentDeForSection,
  translateVocabChunks,
  translateTestsForCategory,
  buildVerifierItems,
  pickPrimaryProvider,
  pickFallbackProvider,
  type StepLog,
  type AiCallOptions,
  type VocabTranslationResult,
} from "./_translationCore";

// Publish-Timeout-Fix: split preview-creation chain, orchestrated here.
// The old monolith `internalPublishUnitPackageToPreview` remained as a
// deprecated rollback safety net — do not call it from the action.
// See `docs/CONTENT_STUDIO_PUBLISH_TIMEOUT_FIX.md`.
const PREVIEW_VOCAB_BATCH_SIZE = 100;
const PREVIEW_TESTS_BATCH_SIZE = 100;

type PreviewCreationStage = "metadata" | "content" | "vocabulary" | "tests" | "complete";

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const createDraftPreview = action({
  args: {
    draftId: v.id("contentDrafts"),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const current: any = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    if (!current.snapshot) throw new Error("Draft has no snapshot");

    const parsed = parseJsonOrThrow(current.snapshot.unitPackageJson);
    const base = UnitPackageSchema.safeParse(parsed);
    if (!base.success) {
      throw new Error("Preview creation requires a schema-valid unitPackage snapshot. Run Creator + Validator first.");
    }

    const { fixed } = autofixUnitPackage(base.data);
    const unitPackage: any = fixed as any;

    // The draft is the single source of truth for placement. Never trust the
    // snapshot/markdown-authored unit number when deciding which unit to write,
    // otherwise a header like "## Unit 1" in a U6 draft would overwrite Unit 1.
    const draftUnitNumber = Number((current.draft as any)?.unitNumber);
    if (!Number.isFinite(draftUnitNumber) || draftUnitNumber <= 0) {
      throw new Error("Draft has no valid unitNumber");
    }
    const draftModuleNumber = Number((current.draft as any)?.moduleNumber);
    const snapshotUnitNumber = Number(unitPackage?.unitNumber);
    if (Number.isFinite(snapshotUnitNumber) && snapshotUnitNumber !== draftUnitNumber) {
      console.warn(
        `[CreatePreview] Snapshot unitNumber (${snapshotUnitNumber}) != draft.unitNumber (${draftUnitNumber}). ` +
          `Forcing draft value. Re-run "Save Markdown" to regenerate a fully consistent snapshot.`,
      );
    }
    // Force placement onto the package so every downstream mutation targets the
    // draft's unit/module (metadata resolves the module via module.moduleNumber).
    unitPackage.unitNumber = draftUnitNumber;
    if (
      unitPackage.module &&
      typeof unitPackage.module === "object" &&
      Number.isFinite(draftModuleNumber) &&
      draftModuleNumber > 0
    ) {
      unitPackage.module.moduleNumber = draftModuleNumber;
    }
    const unitNumber = draftUnitNumber;
    const languages: string[] = Array.isArray(unitPackage?.languages) && unitPackage.languages.length > 0
      ? unitPackage.languages
      : ["en"];
    const startedAt = Date.now();

    // Track current stage so the catch handler can report where it failed.
    let currentStage: PreviewCreationStage = "metadata";
    let currentBatchIndex: number | undefined = undefined;
    let currentTotalBatches: number | undefined = undefined;

    const updateState = async (patch: {
      status?: "running" | "success" | "failed";
      stage?: PreviewCreationStage;
      batchIndex?: number;
      totalBatches?: number;
      completedAt?: number;
      error?: string;
      reset?: boolean;
    }) => {
      if (patch.stage) currentStage = patch.stage;
      if (patch.batchIndex !== undefined) currentBatchIndex = patch.batchIndex;
      if (patch.totalBatches !== undefined) currentTotalBatches = patch.totalBatches;
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      await ctx.runMutation(api.contentStudio.internalUpdateDraftPreviewCreationState, {
        draftId: args.draftId,
        ...patch,
        startedAt: patch.reset ? startedAt : undefined,
      });
    };

    // Initialize state so the UI banner shows the run immediately.
    await updateState({ reset: true, status: "running", stage: "metadata" });

    try {
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      const ver = await ctx.runQuery(api.contentImportAdmin.previewReplaceUnit, {
        unitNumber,
        languages,
      });
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      const targetUnitVersion = Number((ver as any)?.nextUnitVersion ?? 2);

      // ── Stage 1: metadata ─────────────────────────────────────────────────
      await updateState({ stage: "metadata", batchIndex: undefined, totalBatches: undefined });
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      await ctx.runMutation(api.contentStudio.internalCreatePreviewUnitMetadata, {
        unitPackage,
        moduleId: args.moduleId,
      });

      // ── Stage 2: content — one mutation per language ──────────────────────
      await updateState({ stage: "content", batchIndex: 0, totalBatches: languages.length });
      for (let i = 0; i < languages.length; i++) {
        await updateState({ batchIndex: i, totalBatches: languages.length });
        // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
        await ctx.runMutation(api.contentStudio.internalCreatePreviewUnitContent, {
          unitPackage,
          unitVersion: targetUnitVersion,
          language: languages[i],
        });
      }

      // ── Stage 3: vocabulary — archive + cross-unit dedup + batched inserts ──
      const vocabItems: any[] = Array.isArray(unitPackage?.vocabulary?.en) ? unitPackage.vocabulary.en : [];
      const totalVocabBatches = vocabItems.length > 0
        ? Math.max(1, Math.ceil(vocabItems.length / PREVIEW_VOCAB_BATCH_SIZE))
        : 0;
      await updateState({ stage: "vocabulary", batchIndex: 0, totalBatches: totalVocabBatches });

      // 3a) Archive active preview vocab rows once and capture DE preservation map.
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      const archiveVocab = await ctx.runMutation(api.contentStudio.internalArchivePreviewVocabulary, {
        unitNumber,
      });
      const preservedDe = ((archiveVocab as any)?.preservedDe ?? []) as Array<{
        serbianKey: string;
        de?: string;
        noteDe?: string;
      }>;

      // 3b) Cross-unit dedup lookup — batched query, no mutation-side ops.
      const serbianKeys = vocabItems
        .map((v: any) => (typeof v?.serbian === "string" ? v.serbian : ""))
        .filter((s: string) => s.length > 0);
      let dedupHits: Array<{ serbianKey: string; foundInUnit: number }> = [];
      if (serbianKeys.length > 0) {
        // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
        dedupHits = (await ctx.runQuery(api.vocabulary.getVocabularyCrossUnitDuplicates, {
          serbianKeys,
          excludeUnitNumber: unitNumber,
        })) as Array<{ serbianKey: string; foundInUnit: number }>;
      }

      // 3c) Batched inserts.
      let vocabInserted = 0;
      let vocabSkipped = 0;
      const vocabSkippedDuplicates: string[] = [];
      for (let start = 0, batchIndex = 0; start < vocabItems.length; start += PREVIEW_VOCAB_BATCH_SIZE, batchIndex++) {
        await updateState({ batchIndex, totalBatches: totalVocabBatches });
        const batch = vocabItems.slice(start, start + PREVIEW_VOCAB_BATCH_SIZE);
        // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
        const res = (await ctx.runMutation(api.contentStudio.internalCreatePreviewUnitVocabulary, {
          unitNumber,
          unitVersion: targetUnitVersion,
          batch,
          preservedDe,
          dedupHits,
        })) as { insertedCount: number; skippedCount: number; skippedDuplicates: string[] };
        vocabInserted += res.insertedCount;
        vocabSkipped += res.skippedCount;
        vocabSkippedDuplicates.push(...res.skippedDuplicates);
      }

      if (vocabSkippedDuplicates.length > 0) {
        console.warn(
          `[CreatePreview] Skipped ${vocabSkippedDuplicates.length} cross-unit duplicate(s) for Unit ${unitNumber}: ` +
            vocabSkippedDuplicates.join(", "),
        );
      }

      // 3d) Single within-unit dedup pass AFTER all batches have been inserted.
      // Runs once per publish (not per batch) to keep the insert mutation small
      // and OCC-friendly. Idempotent: safe to re-run.
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      const dedupResult = (await ctx.runMutation(
        api.contentStudio.internalDeduplicateUnitVocabulary,
        { unitNumber },
      )) as { deduplicatedCount: number; progressRemapped: number };
      const vocabDeduplicated = dedupResult.deduplicatedCount;
      if (vocabDeduplicated > 0) {
        console.log(
          `[CreatePreview] Unit ${unitNumber}: post-insert dedup archived ${vocabDeduplicated} duplicate(s), ` +
            `remapped ${dedupResult.progressRemapped} progress row(s).`,
        );
      }

      // ── Stage 4: interactive tests — archive + batched inserts ────────────
      // English only for now (matches original monolith behaviour).
      const testsLanguage = "en";
      const exercisesEn: any[] = Array.isArray(unitPackage?.exercises?.en) ? unitPackage.exercises.en : [];
      const flatTests: Array<{ category: string; categoryInstructions?: string; question: any }> = [];
      for (const cat of exercisesEn) {
        const category = String(cat?.category ?? "");
        const categoryInstructions =
          typeof cat?.categoryInstructions === "string" ? String(cat.categoryInstructions) : undefined;
        for (const q of (cat?.questions ?? []) as any[]) {
          flatTests.push({ category, categoryInstructions, question: q });
        }
      }
      const totalTestBatches = flatTests.length > 0
        ? Math.max(1, Math.ceil(flatTests.length / PREVIEW_TESTS_BATCH_SIZE))
        : 0;
      await updateState({ stage: "tests", batchIndex: 0, totalBatches: totalTestBatches });

      // 4a) Archive active preview test rows once.
      // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
      await ctx.runMutation(api.contentStudio.internalArchivePreviewTests, {
        unitNumber,
        language: testsLanguage,
      });

      // 4b) Batched inserts.
      let testsInserted = 0;
      for (let start = 0, batchIndex = 0; start < flatTests.length; start += PREVIEW_TESTS_BATCH_SIZE, batchIndex++) {
        await updateState({ batchIndex, totalBatches: totalTestBatches });
        const batch = flatTests.slice(start, start + PREVIEW_TESTS_BATCH_SIZE);
        // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
        const res = (await ctx.runMutation(api.contentStudio.internalCreatePreviewUnitTests, {
          unitNumber,
          language: testsLanguage,
          unitVersion: targetUnitVersion,
          batch,
        })) as { insertedCount: number };
        testsInserted += res.insertedCount;
      }

      // ── Complete ──────────────────────────────────────────────────────────
      const completedAt = Date.now();
      await updateState({
        status: "success",
        stage: "complete",
        completedAt,
        batchIndex: undefined,
        totalBatches: undefined,
      });

      return {
        ok: true,
        unitNumber,
        version: targetUnitVersion,
        status: "preview" as const,
        stats: {
          languages,
          vocabInserted,
          vocabSkipped,
          vocabDeduplicated,
          testsInserted,
          durationMs: completedAt - startedAt,
        },
      };
    } catch (err: any) {
      // Publish-Timeout-Fix: surface the failure into publishState (the
      // draft's preview-creation state) so the Draft UI banner can show
      // exactly which stage / batch broke, and let the admin retry from the
      // same button.
      const rawMessage = err instanceof Error ? err.message : String(err ?? "Unknown preview creation error");
      const contextParts: string[] = [`stage=${currentStage}`];
      if (currentBatchIndex !== undefined) contextParts.push(`batchIndex=${currentBatchIndex}`);
      if (currentTotalBatches !== undefined) contextParts.push(`totalBatches=${currentTotalBatches}`);
      const contextTag = contextParts.join(" ");
      const fullError = `[${contextTag}] ${rawMessage}`.slice(0, 1900);

      try {
        await updateState({
          status: "failed",
          stage: currentStage,
          error: fullError,
          completedAt: Date.now(),
        });
      } catch (stateErr) {
        console.warn(`[CreatePreview] Failed to persist preview creation state after error:`, stateErr);
      }

      console.error(`[CreatePreview] Unit ${unitNumber} failed at ${contextTag}: ${rawMessage}`);
      throw new Error(fullError);
    }
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const takePreviewOffline = action({
  args: {
    draftId: v.id("contentDrafts"),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const unitNumber = current?.draft?.unitNumber;
    if (!unitNumber) throw new Error("Draft has no unit number");

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const res = await ctx.runMutation(api.contentStudio.internalTakeUnitPreviewOffline, {
      unitNumber,
    });
    return { ok: true, ...res };
  },
});

// Take preview release offline for a unitNumber (used by translation-preview workflow where no draft exists).
// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const takeUnitPreviewOfflineByUnitNumber = action({
  args: {
    unitNumber: v.number(),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const unitNumber = Number(args.unitNumber);
    if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const res = await ctx.runMutation(api.contentStudio.internalTakeUnitPreviewOffline, { unitNumber });
    return { ok: true, ...res };
  },
});

// @deprecated — Publishing now goes through Unit Manager (promoteLanguagePreviewToPublished).
// Kept for backwards compatibility with any external callers.
// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const publishDraft = action({
  args: {
    draftId: v.id("contentDrafts"),
    mode: v.union(v.literal("update"), v.literal("replace")),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    if (current.draft.status !== "ready_to_publish") {
      throw new Error("Draft is not ready_to_publish");
    }
    if (!current.draft.approvedSnapshotId) {
      throw new Error("Live publish requires preview approval (approvedSnapshotId missing)");
    }
    if (current.draft.approvedSnapshotId !== current.draft.lastSnapshotId) {
      throw new Error("Live publish requires the latest snapshot to be approved (approvedSnapshotId != lastSnapshotId)");
    }
    if (!current.snapshot) throw new Error("Draft has no snapshot");

    const unitPackage = parseJsonOrThrow(current.snapshot.unitPackageJson);

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const fileName = `content-studio-unit-${current.draft.unitNumber}.json`;
    const confirm = args.mode === "replace" ? `REPLACE UNIT ${current.draft.unitNumber}` : "IMPORT";
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const result = await ctx.runAction(api.contentImportAdmin.importUnitPackages, {
      files: [{ fileName, unitPackage }],
      confirm,
      moduleId: args.moduleId,
      mode: args.mode,
    });

    await ctx.runMutation(api.contentStudio.setDraftStatus, {
      draftId: args.draftId,
      status: "published",
    });
    return result;
  },
});

// Helper: sum an array of nullable numbers (skips nulls).
function sumNullable(arr: (number | null)[]): number | null {
  const valid = arr.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
}

// Translate already-published Unit content SR/EN -> DE.
// PRIMARY semantic source: Serbian content this unit teaches.
// English is only a bridge/reference (may be imprecise); verifier compares SR<->DE.
// On critical verifier issues we auto-retry affected items once (Pass 2).
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const translatePublishedUnitEnToDe = action({
  args: {
    unitNumber: v.number(),
    confirm: v.string(), // Must equal `TRANSLATE UNIT <N> SR TO DE`
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    targetReleaseStatus: v.optional(v.union(v.literal("preview"), v.literal("published"))),
    sourceReleaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"))),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const unitNumber = Number(args.unitNumber);
    const expected = `TRANSLATE UNIT ${unitNumber} SR TO DE`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation required: confirm must equal '${expected}'`);
    }

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const source = await ctx.runQuery(api.contentStudio.getPublishedUnitSourceEnForTranslation, {
      unitNumber,
      sourceReleaseStatus: (args.sourceReleaseStatus as any) || "published",
    });

    const preferredProvider = (args.preferredProvider as any) || undefined;
    const targetReleaseStatus = (args.targetReleaseStatus as any) || "preview";

    // Preview workflow: write a new preview unitVersion.
    let previewUnitVersion = 1;
    if (targetReleaseStatus === "preview") {
      const ver = await ctx.runQuery(api.contentImportAdmin.previewReplaceUnit, {
        unitNumber,
        languages: ["en", "de"],
      });
      previewUnitVersion = Number((ver as any)?.nextUnitVersion ?? 2) || 2;
    }

    // ── Setup ────────────────────────────────────────────────────────────────
    const stepLogs: StepLog[] = [];
    const actionStartMs = Date.now();
    const primaryProvider = pickPrimaryProvider(preferredProvider);
    const fallbackProvider = pickFallbackProvider(primaryProvider);
    const aiOpts: AiCallOptions = { primaryProvider, fallbackProvider };
    const serbianContextBlock = buildSerbianContextBlock(source as any);

    // 1) Metadata (EN -> DE), trilingual prompt (SR primary).
    const metaAi = await runMetadataTranslation(ctx, {
      source: source as any,
      serbianContextBlock,
      ai: aiOpts,
      stepLogs,
    });
    let metadataDe: any = buildMetadataDeFromAi(metaAi.raw, source as any);

    // 2) Unit content sections (Markdown) EN -> DE, trilingual prompt.
    let contentDe: any[] = [];
    for (const row of source.contentEn ?? []) {
      const contentType = String((row as any).contentType ?? "");
      const mdEn = String((row as any).content ?? "");
      const { mdDe, log: sectionLog } = await translateMarkdownSection(ctx, {
        contentType,
        markdownEn: mdEn,
        unitNumber,
        ai: aiOpts,
      });
      stepLogs.push(sectionLog);
      contentDe.push(buildContentDeForSection(row, mdDe, targetReleaseStatus, previewUnitVersion));
    }

    // 3) Vocabulary translations.
    const vocabItems: any[] = Array.isArray(source.vocabEn) ? source.vocabEn : [];
    let vocabDe: VocabTranslationResult[] = await translateVocabChunks(ctx, {
      items: vocabItems,
      ai: aiOpts,
      stepLogs,
    });

    // 4) Interactive tests grouped by category.
    const testsEn: any[] = Array.isArray(source.testsEn) ? source.testsEn : [];
    const testsByCategory = new Map<string, { categoryInstructions: string; questions: any[] }>();
    for (const t of testsEn) {
      const cat = String((t as any)?.category ?? "");
      if (!testsByCategory.has(cat)) {
        testsByCategory.set(cat, {
          categoryInstructions: String((t as any)?.categoryInstructions ?? ""),
          questions: [],
        });
      }
      testsByCategory.get(cat)!.questions.push(t);
    }

    let testsDe: any[] = [];
    for (const [category, bucket] of testsByCategory.entries()) {
      const produced = await translateTestsForCategory(ctx, {
        category,
        bucket,
        targetReleaseStatus,
        ai: aiOpts,
        stepLogs,
      });
      testsDe.push(...produced);
    }

    // ── SR↔DE Verifier (Pass 1) ─────────────────────────────────────────────
    const verifierItemsPass1 = buildVerifierItems({
      source: source as any,
      serbianContextBlock,
      metadataDe,
      contentDe,
      vocabDe,
      testsDe,
    });
    let verifierReport: VerifierReport | null = null;
    let verifierReportPass2: VerifierReport | null = null;
    let retryAttempted = false;

    try {
      verifierReport = await verifySerbianGermanAlignment(ctx, {
        items: verifierItemsPass1,
        preferredProvider: primaryProvider,
        pass: "pass1",
      });
      console.log(
        `[Translation Verifier pass1] Unit ${unitNumber}: ${verifierReport.itemsChecked} items checked, ` +
        `${verifierReport.criticals.length} critical, ${verifierReport.warnings.length} warning(s).`
      );
    } catch (e: any) {
      console.warn(`[Translation Verifier pass1] Unit ${unitNumber} failed:`, e?.message || e);
      verifierReport = {
        itemsChecked: verifierItemsPass1.length,
        issues: [],
        criticals: [],
        warnings: [],
        infos: [],
        durationMs: 0,
        provider: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
        thinkingTokens: null,
        estimatedCostUsd: null,
        error: String(e?.message || e).slice(0, 400),
        pass: "pass1",
      };
    }

    // Pass 2: auto-retry only critically-failed items, once, with feedback.
    if (verifierReport && verifierReport.criticals.length > 0) {
      retryAttempted = true;
      const feedback = formatRetryFeedback(verifierReport.criticals);
      const retriedKeys = new Set<string>();

      if (feedback.metadata) {
        try {
          const retryAi = await runMetadataTranslation(ctx, {
            source: source as any,
            serbianContextBlock,
            ai: aiOpts,
            stepLogs,
            retryFeedback: feedback.metadata,
          });
          metadataDe = buildMetadataDeFromAi(retryAi.raw, source as any);
          retriedKeys.add("metadata:main");
        } catch (e: any) {
          console.warn(`[Translation Verifier pass2] metadata retry failed:`, e?.message || e);
        }
      }

      const criticalVocabIds = new Set(
        verifierReport.criticals
          .filter((c) => c.itemKind === "vocabulary")
          .map((c) => c.itemKey.replace(/^vocab:/, ""))
      );
      if (criticalVocabIds.size > 0 && feedback.vocabulary) {
        const itemsToRetry = (source.vocabEn ?? []).filter((v: any) =>
          criticalVocabIds.has(String(v?._id ?? ""))
        );
        if (itemsToRetry.length > 0) {
          try {
            const retriedVocab = await translateVocabChunks(ctx, {
              items: itemsToRetry,
              ai: aiOpts,
              stepLogs,
              retryFeedback: feedback.vocabulary,
              stepPrefix: "vocab:retry",
            });
            const retriedById = new Map<string, VocabTranslationResult>();
            for (const r of retriedVocab) retriedById.set(String(r.courseVocabularyId ?? ""), r);
            vocabDe = vocabDe.map((existing) => {
              const id = String(existing.courseVocabularyId ?? "");
              return retriedById.has(id) ? (retriedById.get(id) as VocabTranslationResult) : existing;
            });
            for (const id of criticalVocabIds) retriedKeys.add(`vocab:${id}`);
          } catch (e: any) {
            console.warn(`[Translation Verifier pass2] vocab retry failed:`, e?.message || e);
          }
        }
      }

      const criticalTestIds = new Set(
        verifierReport.criticals
          .filter((c) => c.itemKind === "test")
          .map((c) => c.itemKey.replace(/^test:/, ""))
      );
      if (criticalTestIds.size > 0 && feedback.test) {
        const affectedCategories = new Set<string>();
        for (const t of source.testsEn ?? []) {
          if (criticalTestIds.has(String((t as any)?.questionId ?? ""))) {
            affectedCategories.add(String((t as any)?.category ?? ""));
          }
        }
        for (const cat of affectedCategories) {
          const bucket = testsByCategory.get(cat);
          if (!bucket) continue;
          try {
            const produced = await translateTestsForCategory(ctx, {
              category: cat,
              bucket,
              targetReleaseStatus,
              ai: aiOpts,
              stepLogs,
              retryFeedback: feedback.test,
            });
            const producedByQid = new Map<string, any>();
            for (const p of produced) producedByQid.set(String(p.questionId ?? ""), p);
            testsDe = testsDe.map((existing: any) => {
              if (String(existing.category ?? "") !== cat) return existing;
              const qid = String(existing.questionId ?? "");
              return producedByQid.has(qid) ? producedByQid.get(qid) : existing;
            });
            for (const q of bucket.questions) retriedKeys.add(`test:${String(q.questionId)}`);
          } catch (e: any) {
            console.warn(`[Translation Verifier pass2] tests retry (category=${cat}) failed:`, e?.message || e);
          }
        }
      }

      const affectedContentTypes = new Set<string>(Object.keys(feedback.sectionByContentType));
      if (affectedContentTypes.size > 0) {
        for (const ct of affectedContentTypes) {
          const srcRow = (source.contentEn ?? []).find((r: any) => String(r?.contentType) === ct);
          if (!srcRow) continue;
          try {
            const { mdDe, log: sectionLog } = await translateMarkdownSection(ctx, {
              contentType: ct,
              markdownEn: String((srcRow as any).content ?? ""),
              unitNumber,
              ai: aiOpts,
              retryFeedback: feedback.sectionByContentType[ct],
            });
            stepLogs.push(sectionLog);
            contentDe = contentDe.map((existing) =>
              String(existing.contentType ?? "") === ct
                ? buildContentDeForSection(srcRow, mdDe, targetReleaseStatus, previewUnitVersion)
                : existing
            );
            retriedKeys.add(`section:${ct}`);
          } catch (e: any) {
            console.warn(`[Translation Verifier pass2] section retry (${ct}) failed:`, e?.message || e);
          }
        }
      }

      if (retriedKeys.size > 0) {
        const pass2Items = buildVerifierItems({
          source: source as any,
          serbianContextBlock,
          metadataDe,
          contentDe,
          vocabDe,
          testsDe,
          restrictKeys: retriedKeys,
        });
        try {
          verifierReportPass2 = await verifySerbianGermanAlignment(ctx, {
            items: pass2Items,
            preferredProvider: primaryProvider,
            pass: "pass2",
          });
          console.log(
            `[Translation Verifier pass2] Unit ${unitNumber}: ${verifierReportPass2.itemsChecked} items re-checked, ` +
            `${verifierReportPass2.criticals.length} critical, ${verifierReportPass2.warnings.length} warning(s).`
          );
        } catch (e: any) {
          console.warn(`[Translation Verifier pass2] Unit ${unitNumber} verify failed:`, e?.message || e);
        }
      }
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const result =
      targetReleaseStatus === "preview"
        ? await ctx.runMutation(api.contentStudio.upsertUnitGermanTranslationToPreview, {
            unitNumber,
            unitVersion: previewUnitVersion,
            metadataDe: metadataDe as any,
            contentDe: contentDe as any,
            testsDe: testsDe as any,
            vocabularyDe: vocabDe as any,
          })
        : await ctx.runMutation(api.contentStudio.upsertPublishedUnitGermanTranslation, {
            unitNumber,
            metadataDe: metadataDe as any,
            contentDe: contentDe as any,
            testsDe: testsDe as any,
            vocabularyDe: vocabDe as any,
          });

    // ── Stats + return ───────────────────────────────────────────────────────
    const finalCriticals = verifierReportPass2
      ? [
          ...((verifierReport?.criticals ?? []).filter(
            (c) => !verifierReportPass2!.issues.some((p2) => p2.itemKey === c.itemKey)
          )),
          ...verifierReportPass2.criticals,
        ]
      : (verifierReport?.criticals ?? []);

    const verifierSummary = verifierReport
      ? {
          pass1: verifierReport,
          pass2: verifierReportPass2,
          retryAttempted,
          finalCriticalCount: finalCriticals.length,
          finalWarningCount:
            (verifierReport?.warnings.length ?? 0) + (verifierReportPass2?.warnings.length ?? 0),
        }
      : null;

    const translationStats = {
      totalDurationMs: Date.now() - actionStartMs,
      totalInputTokens: sumNullable(stepLogs.map((s) => s.inputTokens)) ?? 0,
      totalOutputTokens: sumNullable(stepLogs.map((s) => s.outputTokens)) ?? 0,
      totalThinkingTokens: sumNullable(stepLogs.map((s) => s.thinkingTokens)) ?? 0,
      totalCostUsd: sumNullable(stepLogs.map((s) => s.estimatedCostUsd)),
      stepCount: stepLogs.length,
      qualityIssueCount: stepLogs.reduce((sum, s) => sum + s.qualityIssues.length, 0),
      steps: stepLogs,
      verifier: verifierSummary,
    };

    console.log(
      `[Translation] Unit ${unitNumber} complete — ${stepLogs.length} steps, ` +
      `${(translationStats.totalDurationMs / 1000).toFixed(1)}s, ` +
      `in=${translationStats.totalInputTokens} out=${translationStats.totalOutputTokens} ` +
      `thinking=${translationStats.totalThinkingTokens} ` +
      `issues=${translationStats.qualityIssueCount}` +
      (verifierSummary
        ? ` | verifier: retry=${retryAttempted ? "yes" : "no"} ` +
          `final_critical=${verifierSummary.finalCriticalCount} ` +
          `final_warning=${verifierSummary.finalWarningCount}`
        : "")
    );

    return {
      ok: true,
      unitNumber,
      targetReleaseStatus,
      ...(targetReleaseStatus === "preview" ? { previewUnitVersion } : {}),
      meta: {
        provider: metaAi.provider,
        model: metaAi.model,
      },
      updated: (result as any)?.updated ?? (result as any)?.created ?? null,
      translationStats,
    };
  },
});

// ---------------------------------------------------------------------------
// Selective manual retry of verifier-reported issues
// ---------------------------------------------------------------------------
// Admin-flow: after the full translation + verifier produced a report, the admin
// can select individual issues (warnings/criticals that remained) in the UI and
// trigger this action to re-translate ONLY those items with issue-specific
// feedback. Non-selected items stay as-is.
//
// Flow:
//   1. Load EN source + current DE state (to preserve non-retried items).
//   2. Group selected issues by kind, format feedback (_verifier.ts).
//   3. Re-translate metadata / vocab / tests-by-category / sections as needed.
//   4. Upsert the merged DE state (non-retried items stay untouched).
//   5. Re-verify ONLY the retried items; return a report in the same shape as
//      the main action so the UI can render it with the existing panel.
// ---------------------------------------------------------------------------
// @ts-ignore TS2589 – Convex schema depth limit (50 tables)
export const retryDeTranslationForSelectedIssues = action({
  args: {
    unitNumber: v.number(),
    // Must equal `RETRY UNIT <N> SR TO DE` as a guard against accidental calls.
    confirm: v.string(),
    // Issue tuples selected by the admin. itemKey format mirrors the verifier:
    //   metadata:main | vocab:<id> | test:<qid> | section:<contentType>
    selectedIssues: v.array(
      v.object({
        itemKey: v.string(),
        itemKind: v.union(
          v.literal("metadata"),
          v.literal("vocabulary"),
          v.literal("test"),
          v.literal("section")
        ),
        itemLabel: v.string(),
        severity: v.union(v.literal("critical"), v.literal("warning"), v.literal("info")),
        issue: v.string(),
        suggestion: v.optional(v.string()),
      })
    ),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    targetReleaseStatus: v.union(v.literal("preview"), v.literal("published")),
    // For preview: the unitVersion of the preview row set we want to replace.
    // Required when targetReleaseStatus === "preview".
    previewUnitVersion: v.optional(v.number()),
    sourceReleaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"))),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const unitNumber = Number(args.unitNumber);
    const expected = `RETRY UNIT ${unitNumber} SR TO DE`;
    if (String(args.confirm) !== expected) {
      throw new Error(`Confirmation required: confirm must equal '${expected}'`);
    }
    if (!Array.isArray(args.selectedIssues) || args.selectedIssues.length === 0) {
      throw new Error("selectedIssues must be a non-empty array");
    }
    if (args.targetReleaseStatus === "preview" && !args.previewUnitVersion) {
      throw new Error("previewUnitVersion is required when targetReleaseStatus === 'preview'");
    }

    const targetReleaseStatus = args.targetReleaseStatus;
    const previewUnitVersion = Number(args.previewUnitVersion ?? 1) || 1;
    const preferredProvider = (args.preferredProvider as any) || undefined;

    // 1) Load EN source (same query as full translation).
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const source = await ctx.runQuery(api.contentStudio.getPublishedUnitSourceEnForTranslation, {
      unitNumber,
      sourceReleaseStatus: (args.sourceReleaseStatus as any) || "published",
    });

    // 2) Load current DE state (to upsert the full merged payload while only
    //    mutating the retried items; non-retried items stay as they are).
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const currentDe: any = await ctx.runQuery(
      api.contentStudio.getCurrentUnitDeStateForRetry,
      {
        unitNumber,
        targetReleaseStatus,
        previewUnitVersion: targetReleaseStatus === "preview" ? previewUnitVersion : undefined,
      }
    );
    if (!currentDe) {
      throw new Error(
        `No current German ${targetReleaseStatus} state found for unit ${unitNumber}. ` +
          `Run full translation first.`
      );
    }

    // 3) Setup core helpers.
    const stepLogs: StepLog[] = [];
    const actionStartMs = Date.now();
    const primaryProvider = pickPrimaryProvider(preferredProvider);
    const fallbackProvider = pickFallbackProvider(primaryProvider);
    const aiOpts: AiCallOptions = { primaryProvider, fallbackProvider };
    const serbianContextBlock = buildSerbianContextBlock(source as any);

    // 4) Format retry feedback (groups issues by kind + adds severity tags).
    const feedback = formatRetryFeedback(args.selectedIssues as any);

    // 5) Clone the current DE state so we can selectively replace items.
    let metadataDe: any = { ...(currentDe.metadataDe ?? {}) };
    let contentDe: any[] = Array.isArray(currentDe.contentDe) ? currentDe.contentDe.slice() : [];
    let testsDe: any[] = Array.isArray(currentDe.testsDe) ? currentDe.testsDe.slice() : [];
    let vocabDe: VocabTranslationResult[] = Array.isArray(currentDe.vocabularyDe)
      ? currentDe.vocabularyDe.slice()
      : [];
    const retriedKeys = new Set<string>();

    // ── Metadata retry ──────────────────────────────────────────────────────
    const hasMetadataSelected = args.selectedIssues.some((i) => i.itemKind === "metadata");
    if (hasMetadataSelected && feedback.metadata) {
      try {
        const retryAi = await runMetadataTranslation(ctx, {
          source: source as any,
          serbianContextBlock,
          ai: aiOpts,
          stepLogs,
          retryFeedback: feedback.metadata,
        });
        metadataDe = buildMetadataDeFromAi(retryAi.raw, source as any);
        retriedKeys.add("metadata:main");
      } catch (e: any) {
        console.warn(`[Manual Retry] metadata retry failed:`, e?.message || e);
      }
    }

    // ── Vocabulary retry (per-id) ───────────────────────────────────────────
    const vocabIdsToRetry = new Set(
      args.selectedIssues
        .filter((i) => i.itemKind === "vocabulary")
        .map((i) => String(i.itemKey).replace(/^vocab:/, ""))
    );
    if (vocabIdsToRetry.size > 0 && feedback.vocabulary) {
      const itemsToRetry = (source.vocabEn ?? []).filter((v: any) =>
        vocabIdsToRetry.has(String(v?._id ?? ""))
      );
      if (itemsToRetry.length > 0) {
        try {
          const retried = await translateVocabChunks(ctx, {
            items: itemsToRetry,
            ai: aiOpts,
            stepLogs,
            retryFeedback: feedback.vocabulary,
            stepPrefix: "vocab:manualRetry",
          });
          const retriedById = new Map<string, VocabTranslationResult>();
          for (const r of retried) retriedById.set(String(r.courseVocabularyId ?? ""), r);
          vocabDe = vocabDe.map((existing) => {
            const id = String(existing.courseVocabularyId ?? "");
            return retriedById.has(id) ? (retriedById.get(id) as VocabTranslationResult) : existing;
          });
          for (const id of vocabIdsToRetry) retriedKeys.add(`vocab:${id}`);
        } catch (e: any) {
          console.warn(`[Manual Retry] vocab retry failed:`, e?.message || e);
        }
      }
    }

    // ── Tests retry (by affected category, consistent with Pass 2) ──────────
    const testQidsToRetry = new Set(
      args.selectedIssues
        .filter((i) => i.itemKind === "test")
        .map((i) => String(i.itemKey).replace(/^test:/, ""))
    );
    if (testQidsToRetry.size > 0 && feedback.test) {
      const testsEn: any[] = Array.isArray(source.testsEn) ? source.testsEn : [];
      const testsByCategory = new Map<string, { categoryInstructions: string; questions: any[] }>();
      for (const t of testsEn) {
        const cat = String((t as any)?.category ?? "");
        if (!testsByCategory.has(cat)) {
          testsByCategory.set(cat, {
            categoryInstructions: String((t as any)?.categoryInstructions ?? ""),
            questions: [],
          });
        }
        testsByCategory.get(cat)!.questions.push(t);
      }
      const affectedCategories = new Set<string>();
      for (const t of testsEn) {
        if (testQidsToRetry.has(String((t as any)?.questionId ?? ""))) {
          affectedCategories.add(String((t as any)?.category ?? ""));
        }
      }
      for (const cat of affectedCategories) {
        const bucket = testsByCategory.get(cat);
        if (!bucket) continue;
        try {
          const produced = await translateTestsForCategory(ctx, {
            category: cat,
            bucket,
            targetReleaseStatus,
            ai: aiOpts,
            stepLogs,
            retryFeedback: feedback.test,
          });
          const producedByQid = new Map<string, any>();
          for (const p of produced) producedByQid.set(String(p.questionId ?? ""), p);
          testsDe = testsDe.map((existing: any) => {
            if (String(existing.category ?? "") !== cat) return existing;
            const qid = String(existing.questionId ?? "");
            return producedByQid.has(qid) ? producedByQid.get(qid) : existing;
          });
          for (const q of bucket.questions) retriedKeys.add(`test:${String(q.questionId)}`);
        } catch (e: any) {
          console.warn(`[Manual Retry] tests retry (category=${cat}) failed:`, e?.message || e);
        }
      }
    }

    // ── Section retry (by contentType) ──────────────────────────────────────
    const sectionTypesToRetry = new Set<string>();
    for (const i of args.selectedIssues) {
      if (i.itemKind !== "section") continue;
      const m = String(i.itemKey).match(/^section:(.+)$/);
      if (m && m[1]) sectionTypesToRetry.add(m[1]);
    }
    if (sectionTypesToRetry.size > 0) {
      for (const ct of sectionTypesToRetry) {
        const srcRow = (source.contentEn ?? []).find((r: any) => String(r?.contentType) === ct);
        if (!srcRow) continue;
        const fb = feedback.sectionByContentType[ct] || "";
        try {
          const { mdDe, log: sectionLog } = await translateMarkdownSection(ctx, {
            contentType: ct,
            markdownEn: String((srcRow as any).content ?? ""),
            unitNumber,
            ai: aiOpts,
            retryFeedback: fb,
          });
          stepLogs.push(sectionLog);
          contentDe = contentDe.map((existing) =>
            String(existing.contentType ?? "") === ct
              ? buildContentDeForSection(srcRow, mdDe, targetReleaseStatus, previewUnitVersion)
              : existing
          );
          retriedKeys.add(`section:${ct}`);
        } catch (e: any) {
          console.warn(`[Manual Retry] section retry (${ct}) failed:`, e?.message || e);
        }
      }
    }

    if (retriedKeys.size === 0) {
      throw new Error(
        "Manual retry produced no retried items. Check that selectedIssues reference valid itemKeys."
      );
    }

    // 6) Upsert the merged DE state.
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const result =
      targetReleaseStatus === "preview"
        ? await ctx.runMutation(api.contentStudio.upsertUnitGermanTranslationToPreview, {
            unitNumber,
            unitVersion: previewUnitVersion,
            metadataDe: metadataDe as any,
            contentDe: contentDe as any,
            testsDe: testsDe as any,
            vocabularyDe: vocabDe as any,
          })
        : await ctx.runMutation(api.contentStudio.upsertPublishedUnitGermanTranslation, {
            unitNumber,
            metadataDe: metadataDe as any,
            contentDe: contentDe as any,
            testsDe: testsDe as any,
            vocabularyDe: vocabDe as any,
          });

    // 7) Re-verify ONLY the retried items (pass2 scope).
    let verifierReport: VerifierReport | null = null;
    try {
      const items = buildVerifierItems({
        source: source as any,
        serbianContextBlock,
        metadataDe,
        contentDe,
        vocabDe,
        testsDe,
        restrictKeys: retriedKeys,
      });
      verifierReport = await verifySerbianGermanAlignment(ctx, {
        items,
        preferredProvider: primaryProvider,
        pass: "pass2",
      });
      console.log(
        `[Manual Retry Verifier] Unit ${unitNumber}: ${verifierReport.itemsChecked} items re-checked, ` +
        `${verifierReport.criticals.length} critical, ${verifierReport.warnings.length} warning(s).`
      );
    } catch (e: any) {
      console.warn(`[Manual Retry Verifier] Unit ${unitNumber} verify failed:`, e?.message || e);
    }

    // 8) Report in the same shape the UI already renders (pass2-only).
    const verifierSummary = verifierReport
      ? {
          pass1: null,
          pass2: verifierReport,
          retryAttempted: true,
          finalCriticalCount: verifierReport.criticals.length,
          finalWarningCount: verifierReport.warnings.length,
        }
      : null;

    const translationStats = {
      totalDurationMs: Date.now() - actionStartMs,
      totalInputTokens: sumNullable(stepLogs.map((s) => s.inputTokens)) ?? 0,
      totalOutputTokens: sumNullable(stepLogs.map((s) => s.outputTokens)) ?? 0,
      totalThinkingTokens: sumNullable(stepLogs.map((s) => s.thinkingTokens)) ?? 0,
      totalCostUsd: sumNullable(stepLogs.map((s) => s.estimatedCostUsd)),
      stepCount: stepLogs.length,
      qualityIssueCount: stepLogs.reduce((sum, s) => sum + s.qualityIssues.length, 0),
      steps: stepLogs,
      verifier: verifierSummary,
    };

    console.log(
      `[Manual Retry] Unit ${unitNumber} complete — ${stepLogs.length} step(s), ` +
      `${(translationStats.totalDurationMs / 1000).toFixed(1)}s, ` +
      `retried=${retriedKeys.size} items` +
      (verifierSummary
        ? ` | verifier: critical=${verifierSummary.finalCriticalCount} warning=${verifierSummary.finalWarningCount}`
        : "")
    );

    return {
      ok: true,
      unitNumber,
      targetReleaseStatus,
      ...(targetReleaseStatus === "preview" ? { previewUnitVersion } : {}),
      retriedKeys: Array.from(retriedKeys),
      updated: (result as any)?.updated ?? (result as any)?.created ?? null,
      translationStats,
    };
  },
});
