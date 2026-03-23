import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireSuperadminAction, parseJsonOrThrow, callAiJson, callAiText } from "./_shared";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const publishDraftToPreview = action({
  args: {
    draftId: v.id("contentDrafts"),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    if (!current.snapshot) throw new Error("Draft has no snapshot");

    // Preview requires a schema-valid unitPackage (so the real Unit UI can render it safely)
    const parsed = parseJsonOrThrow(current.snapshot.unitPackageJson);
    const base = UnitPackageSchema.safeParse(parsed);
    if (!base.success) {
      throw new Error("Preview publish requires a schema-valid unitPackage snapshot. Run Creator + Validator first.");
    }

    // Use post-autofix package (same as import pipeline)
    const { fixed } = autofixUnitPackage(base.data);

    // Compute a next unitVersion without archiving published content.
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const ver = await ctx.runQuery(api.contentImportAdmin.previewReplaceUnit, {
      unitNumber: fixed.unitNumber,
      languages: fixed.languages,
    });
    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const targetUnitVersion = Number((ver as any)?.nextUnitVersion ?? 2);

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const result = await ctx.runMutation(api.contentStudio.internalPublishUnitPackageToPreview, {
      unitPackage: fixed as any,
      unitVersion: targetUnitVersion,
      moduleId: args.moduleId,
    });

    return { ok: true, ...result };
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

    // Delegate to existing import pipeline (creates audit run)
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

// Translate already-published Unit content EN -> DE (no new content creation; translation only).
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const translatePublishedUnitEnToDe = action({
  args: {
    unitNumber: v.number(),
    confirm: v.string(), // Must equal `TRANSLATE UNIT <N> TO DE`
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    // Default: write as preview (same workflow as ContentStudio Preview)
    targetReleaseStatus: v.optional(v.union(v.literal("preview"), v.literal("published"))),
    // Default: "published" — use published EN as source. "preview" uses preview EN rows.
    sourceReleaseStatus: v.optional(v.union(v.literal("published"), v.literal("preview"))),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const unitNumber = Number(args.unitNumber);
    const expected = `TRANSLATE UNIT ${unitNumber} TO DE`;
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

    // Preview workflow: write a new preview unitVersion (like ContentStudio publish-to-preview).
    let previewUnitVersion = 1;
    if (targetReleaseStatus === "preview") {
      const ver = await ctx.runQuery(api.contentImportAdmin.previewReplaceUnit, {
        unitNumber,
        languages: ["en", "de"],
      });
      previewUnitVersion = Number((ver as any)?.nextUnitVersion ?? 2) || 2;
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const isRetryableAiError = (e: any) => {
      const msg = String(e?.message || e || "");
      return (
        msg.includes("AI API error: 503") ||
        msg.includes("AI API error: 429") ||
        msg.includes("AI returned no content") ||
        msg.includes("returned no content") ||
        msg.includes("AI API timeout") ||
        msg.includes("AI output truncated") ||
        msg.includes("finish_reason=length") ||
        /UNAVAILABLE|overloaded|high demand|rate limit|timeout|request aborted|truncated/i.test(msg)
      );
    };
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const primaryProvider: "gemini" | "openai" | undefined =
      preferredProvider || (hasGemini ? "gemini" : hasOpenAI ? "openai" : undefined);
    const fallbackProvider: "gemini" | "openai" | undefined =
      primaryProvider === "gemini" ? (hasOpenAI ? "openai" : undefined) : hasGemini ? "gemini" : undefined;

    const buildStageTryOrder = (stage: "specialist" | "auditor") => {
      // Model fallback: specialist->auditor typically means gemini pro -> flash (and gpt-4o -> gpt-4o-mini).
      return stage === "specialist" ? (["specialist", "auditor"] as const) : (["auditor", "specialist"] as const);
    };

    const timeoutForStepMs = (step: string) => {
      // Sections can be large markdown. Everything else should be fast.
      if (step.startsWith("section:")) return 120_000;
      if (step.startsWith("tests:")) return 60_000;
      if (step.startsWith("vocab:")) return 60_000;
      return 45_000; // metadata and other small JSON calls
    };

    const callJsonRobust = async (params: {
      step: string;
      stage: "specialist" | "auditor";
      system: string;
      user: string;
      maxTokens?: number;
    }) => {
      const providers: Array<"gemini" | "openai" | undefined> =
        fallbackProvider && fallbackProvider !== primaryProvider ? [primaryProvider, fallbackProvider] : [primaryProvider];
      const stageOrder = buildStageTryOrder(params.stage);
      const errors: string[] = [];

      for (const p of providers) {
        for (const stage of stageOrder) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              return await callAiJson(ctx, {
                stage,
                preferredProvider: p,
                system: params.system,
                user: params.user,
                maxTokens: params.maxTokens,
                timeoutMs: timeoutForStepMs(params.step),
              });
            } catch (e: any) {
              const msg = String(e?.message || e || "");
              errors.push(`[${params.step}] provider=${String(p)} stage=${stage} attempt=${attempt + 1} err=${msg.slice(0, 240)}`);
              const isNoContent = /returned no content/i.test(msg);
              if (isRetryableAiError(e) && attempt < 1 && !isNoContent) {
                await sleep(650 + attempt * 950);
                continue;
              }
              // retryable: next (stage/provider) combo
              if (isRetryableAiError(e)) break;
              throw e;
            }
          }
        }
      }

      throw new Error(
        `AI call failed after retries. Attempts:\n${errors.slice(-10).join("\n")}`
      );
    };

    const callTextRobust = async (params: {
      step: string;
      stage: "specialist" | "auditor";
      system: string;
      user: string;
      maxTokens?: number;
    }) => {
      const providers: Array<"gemini" | "openai" | undefined> =
        fallbackProvider && fallbackProvider !== primaryProvider ? [primaryProvider, fallbackProvider] : [primaryProvider];
      const stageOrder = buildStageTryOrder(params.stage);
      const errors: string[] = [];

      for (const p of providers) {
        for (const stage of stageOrder) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              return await callAiText(ctx, {
                stage,
                preferredProvider: p,
                system: params.system,
                user: params.user,
                maxTokens: params.maxTokens,
                timeoutMs: timeoutForStepMs(params.step),
              });
            } catch (e: any) {
              const msg = String(e?.message || e || "");
              errors.push(`[${params.step}] provider=${String(p)} stage=${stage} attempt=${attempt + 1} err=${msg.slice(0, 240)}`);
              const isNoContent = /returned no content/i.test(msg);
              if (isRetryableAiError(e) && attempt < 1 && !isNoContent) {
                await sleep(650 + attempt * 950);
                continue;
              }
              if (isRetryableAiError(e)) break;
              throw e;
            }
          }
        }
      }

      throw new Error(
        `AI call failed after retries. Attempts:\n${errors.slice(-10).join("\n")}`
      );
    };

    // 1) Metadata (EN -> DE) in one structured call (keeps array lengths stable)
    const metaSystem = [
      "You are a translation engine.",
      "Translate unit metadata from English to German (de-DE).",
      "Do NOT invent new items. Preserve array lengths and order.",
      "Return ONLY valid JSON with keys: titleDe, descriptionDe, topicsDe, grammarFocusDe, vocabularyThemesDe.",
      "If a source field is empty, return an empty string (for strings) or empty array (for arrays).",
    ].join("\n");

    const metaUser = [
      `Title (EN):`,
      String(source.metadataEn?.title ?? ""),
      ``,
      `Description (EN):`,
      String(source.metadataEn?.description ?? ""),
      ``,
      `Topics (EN) JSON:`,
      JSON.stringify(source.metadataEn?.topics ?? []),
      ``,
      `Grammar focus (EN) JSON:`,
      JSON.stringify(source.metadataEn?.grammarFocus ?? []),
      ``,
      `Vocabulary themes (EN) JSON:`,
      JSON.stringify(source.metadataEn?.vocabularyThemes ?? []),
    ].join("\n");

    const metaAi = await callJsonRobust({
      step: "metadata",
      stage: "specialist",
      system: metaSystem,
      user: metaUser,
      maxTokens: 1500,
    });
    let metaParsed: any;
    try {
      metaParsed = parseJsonOrThrow(metaAi.raw);
    } catch (e: any) {
      throw new Error(`AI returned invalid JSON for metadata translation. ${e?.message || ""}`);
    }

    // @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
    const metadataDe = {
      title: String(metaParsed?.titleDe ?? "").trim() || String(source.metadataEn?.title ?? ""),
      description:
        typeof metaParsed?.descriptionDe === "string" && String(metaParsed.descriptionDe).trim()
          ? String(metaParsed.descriptionDe).trim()
          : undefined,
      topics: Array.isArray(metaParsed?.topicsDe) ? metaParsed.topicsDe.map((x: any) => String(x)) : [],
      grammarFocus: Array.isArray(metaParsed?.grammarFocusDe) ? metaParsed.grammarFocusDe.map((x: any) => String(x)) : [],
      vocabularyThemes: Array.isArray(metaParsed?.vocabularyThemesDe) ? metaParsed.vocabularyThemesDe.map((x: any) => String(x)) : [],
      moduleMetadataId: source.metadataEn?.moduleMetadataId as any,
      moduleId: typeof source.metadataEn?.moduleId === "string" ? source.metadataEn.moduleId : undefined,
    };

    // 2) Unit content sections (Markdown) EN -> DE
    const translateMarkdownSection = async (params: {
      contentType: string;
      markdownEn: string;
      unitNumber: number;
    }): Promise<string> => {
      const input = String(params.markdownEn ?? "").replace(/\r\n/g, "\n").trim();
      if (!input) return "";

      const system = [
        "You are translating ONE Serbian course unit markdown section from English to German (de-DE).",
        "Goal: Make all explanatory content German while preserving structure exactly.",
        "",
        "CRITICAL: Preserve Markdown structure EXACTLY (do not reformat):",
        "- Do NOT reorder headings/sections.",
        "- Do NOT change tables: keep exact columns, pipes, separators, and one-row-per-line formatting.",
        "- Do NOT wrap table rows across lines.",
        "- Preserve blanks EXACTLY as '_____' (five underscores).",
        "- Preserve lettered options formatting: A) ...  B) ...  C) ...  D) ...",
        "- Preserve all IDs (e.g., questionId like u2_ex5_q01) exactly.",
        "",
        "CRITICAL: Do NOT translate Serbian content:",
        "- In vocabulary tables: do NOT change the Serbian column values.",
        "- Do NOT change any Serbian phrases inside examples or answers.",
        "- Only translate English explanatory/instructional text into German.",
        "",
        "Return ONLY the final Markdown content (no commentary, no code fences).",
      ].join("\n");

      const user = [
        `Unit: ${params.unitNumber}`,
        `Section: ${params.contentType}`,
        "",
        input,
      ].join("\n");

      const { raw } = await callTextRobust({
        step: `section:${params.contentType}`,
        stage: "specialist",
        system,
        user,
        maxTokens: 9000,
      });
      const out = String(raw ?? "").replace(/\r\n/g, "\n").trim();
      return out || input;
    };

    const contentDe: any[] = [];
    for (const row of source.contentEn ?? []) {
      const contentType = String((row as any).contentType ?? "");
      const mdEn = String((row as any).content ?? "");
      const unitVersion =
        targetReleaseStatus === "preview" ? previewUnitVersion : Number((row as any).unitVersion ?? 1) || 1;
      const mdDe = await translateMarkdownSection({ contentType, markdownEn: mdEn, unitNumber });
      contentDe.push(
        targetReleaseStatus === "preview"
          ? { contentType, content: mdDe }
          : { contentType, content: mdDe, unitVersion }
      );
    }

    // 3) Vocabulary translations (EN -> DE) - patch existing courseVocabulary rows only
    const vocabDe: Array<{ courseVocabularyId: any; de?: string; deAlt?: string; noteDe?: string }> = [];
    const vocabItems = Array.isArray(source.vocabEn) ? source.vocabEn : [];
    const vocabChunkSize = 25;
    for (let i = 0; i < vocabItems.length; i += vocabChunkSize) {
      const chunk = vocabItems.slice(i, i + vocabChunkSize);
      const system = [
        "You are a translation engine.",
        "Translate vocabulary entries from English to German (de-DE).",
        "Do NOT invent new entries. Do NOT change ids. Return ONLY valid JSON with key: items.",
        "Each item must have: id, de, deAlt, noteDe.",
        "If a source field is empty, return an empty string for that field.",
      ].join("\n");
      const user = JSON.stringify({
        items: chunk.map((v: any) => ({
          id: String(v?._id ?? ""),
          en: String(v?.en ?? ""),
          enAlt: typeof v?.enAlt === "string" ? v.enAlt : "",
          noteEn: typeof v?.noteEn === "string" ? v.noteEn : "",
        })),
      });
      const ai = await callJsonRobust({
        step: `vocab:${i}-${i + chunk.length - 1}`,
        stage: "specialist",
        system,
        user,
        maxTokens: 4000,
      });
      let parsed: any;
      try {
        parsed = parseJsonOrThrow(ai.raw);
      } catch (e: any) {
        throw new Error(`AI returned invalid JSON for vocabulary translation (chunk ${i}-${i + chunk.length - 1}). ${e?.message || ""}`);
      }
      const itemsOut: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
      const byId = new Map<string, any>();
      for (const it of itemsOut) {
        const id = String(it?.id ?? "").trim();
        if (!id) continue;
        byId.set(id, it);
      }
      for (const src of chunk) {
        const id = String(src?._id ?? "").trim();
        const out = byId.get(id);
        if (!out) continue;
        const de = typeof out?.de === "string" ? String(out.de).trim() : "";
        const deAlt = typeof out?.deAlt === "string" ? String(out.deAlt).trim() : "";
        const noteDe = typeof out?.noteDe === "string" ? String(out.noteDe).trim() : "";
        vocabDe.push({
          courseVocabularyId: src._id as any,
          ...(de ? { de } : {}),
          ...(deAlt ? { deAlt } : {}),
          ...(noteDe ? { noteDe } : {}),
        });
      }
    }

    // 4) Interactive tests (EN -> DE): translate instructions + question text; keep answers/options unchanged (Serbian).
    const testsEn: any[] = Array.isArray(source.testsEn) ? source.testsEn : [];
    const testsByCategory = new Map<string, { categoryInstructions: string; questions: any[] }>();
    for (const t of testsEn) {
      const cat = String(t?.category ?? "");
      if (!testsByCategory.has(cat)) {
        testsByCategory.set(cat, { categoryInstructions: String(t?.categoryInstructions ?? ""), questions: [] });
      }
      testsByCategory.get(cat)!.questions.push(t);
    }

    const testsDe: any[] = [];
    for (const [category, bucket] of testsByCategory.entries()) {
      const system = [
        "You are a translation engine.",
        "Translate interactive test prompts from English to German (de-DE).",
        "Do NOT change questionId, order, or questionType.",
        "Preserve blanks EXACTLY as '_____' (five underscores) and do not change the number of blanks.",
        "Do NOT translate Serbian content or any answer strings.",
        "Return ONLY valid JSON with keys: categoryInstructionsDe, questions.",
        "questions must be an array of { questionId, questionDe, hintDe }.",
      ].join("\n");

      const user = JSON.stringify({
        category,
        categoryInstructionsEn: bucket.categoryInstructions || "",
        questions: bucket.questions.map((q) => ({
          questionId: String(q.questionId),
          questionType: String(q.questionType),
          order: Number(q.order ?? 0) || 0,
          questionEn: String(q.question ?? ""),
          hintEn: typeof q.hint === "string" ? q.hint : "",
        })),
      });

      const ai = await callJsonRobust({
        step: `tests:${category}`,
        stage: "specialist",
        system,
        user,
        maxTokens: 3500,
      });
      let parsed: any;
      try {
        parsed = parseJsonOrThrow(ai.raw);
      } catch (e: any) {
        throw new Error(`AI returned invalid JSON for test translation (category=${category}). ${e?.message || ""}`);
      }
      const categoryInstructionsDe =
        typeof parsed?.categoryInstructionsDe === "string" ? String(parsed.categoryInstructionsDe).trim() : "";
      const outQuestions: any[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
      const outById = new Map<string, any>();
      for (const oq of outQuestions) {
        const id = String(oq?.questionId ?? "").trim();
        if (!id) continue;
        outById.set(id, oq);
      }

      for (const src of bucket.questions) {
        const qid = String(src.questionId);
        const oq = outById.get(qid);

        const countBlanks = (s: string) => (String(s || "").match(/_+/g) || []).length;
        const srcQuestion = String(src.question ?? "");
        const srcBlanks = countBlanks(srcQuestion);

        let translatedQ = typeof oq?.questionDe === "string" ? String(oq.questionDe) : srcQuestion;
        // Guard: preserve blank count for question types that can contain blanks.
        const qType = String(src.questionType ?? "");
        if (
          (qType === "fillInBlank" || qType === "matching" || qType === "dialogue") &&
          srcBlanks !== countBlanks(translatedQ)
        ) {
          translatedQ = srcQuestion;
        }
        const translatedHint = typeof oq?.hintDe === "string" ? String(oq.hintDe) : (typeof src.hint === "string" ? src.hint : undefined);

        testsDe.push(
          targetReleaseStatus === "preview"
            ? {
                questionId: qid,
                category: String(src.category ?? ""),
                categoryInstructions:
                  categoryInstructionsDe || (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
                questionType: String(src.questionType ?? ""),
                question: translatedQ,
                correctAnswer: String(src.correctAnswer ?? ""),
                acceptableAlternatives: src.acceptableAlternatives,
                options: src.options,
                hint: translatedHint,
                order: Number(src.order ?? 0) || 0,
              }
            : {
                questionId: qid,
                unitVersion: Number(src.unitVersion ?? 1) || 1,
                category: String(src.category ?? ""),
                categoryInstructions:
                  categoryInstructionsDe || (typeof src.categoryInstructions === "string" ? src.categoryInstructions : undefined),
                questionType: String(src.questionType ?? ""),
                question: translatedQ,
                correctAnswer: String(src.correctAnswer ?? ""),
                acceptableAlternatives: src.acceptableAlternatives,
                options: src.options,
                hint: translatedHint,
                order: Number(src.order ?? 0) || 0,
              }
        );
      }
    }

    // Persist translations
    // - preview: write releaseStatus="preview" (ContentStudio Preview workflow; published untouched)
    // - published: write published DE content + patch published vocab fields
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
    };
  },
});
