import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import {
  requireSuperadminAction,
  parseJsonOrThrow,
  callAiJson,
  buildStageSkillBlock,
  resolvePromptFromDb,
} from "./_shared";
import { buildAuditPayload, normalizeSerbianKey } from "./_validatorHelpers";
import { LECTOR_SYSTEM_PROMPT, CS_PROMPT_KEYS } from "./prompts";
import type { Id } from "../_generated/dataModel";

export const runAiAuditor = action({
  args: {
    draftId: v.id("contentDrafts"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const snapshot = current.snapshot;
    if (!snapshot) throw new Error("Draft has no snapshot to audit");

    // Require QC pass first.
    // Allow re-running the Lector after a failed audit without forcing another Validator run.
    if (
      current.draft.status !== "qc_passed" &&
      current.draft.status !== "ready_to_publish" &&
      current.draft.status !== "audit_failed"
    ) {
      throw new Error("Run Validator (pass) before running Lector");
    }

    const pkg = parseJsonOrThrow(snapshot.unitPackageJson);
    const unitNumber = typeof pkg?.unitNumber === "number" ? pkg.unitNumber : 0;

    // Load ALL vocabulary from previous units (full course context for Lector)
    const allCourseVocab = await ctx.runQuery(api.vocabulary.getAllCourseVocabulary, {});
    const previousUnitsVocab = allCourseVocab
      .filter((v: any) => v.unitNumber < unitNumber)
      .map((v: any) => ({ serbian: v.serbian, en: v.en, unit: v.unitNumber }));
    const previousVocabKeys = previousUnitsVocab.map((v: any) => String(v.serbian).toLowerCase());

    const auditSkillBlock = await buildStageSkillBlock(ctx, current.draft as any, "auditor");

    const refId = (current.draft as any).inspirationRef?.referenceId as Id<"contentStudioReferences"> | undefined;
    const refDoc = refId ? await ctx.runQuery(api.contentStudio.getReferenceById, { referenceId: refId }) : null;
    const referenceBlock = (() => {
      if (!refDoc) return "";
      const title = String((refDoc as any).title || "").trim();
      const notes = String((refDoc as any).notes || "").trim();
      const guidelines = String((refDoc as any).guidelines || "").trim();
      const refUrl = String((refDoc as any).downloadUrl || (refDoc as any).url || "").trim();
      return [
        title ? `- Title: ${title}` : "",
        refUrl ? `- URL: ${refUrl}` : "",
        guidelines ? `- Guidelines:\n${guidelines}` : "",
        notes ? `- Notes: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .trim();
    })();
    const { content: baseLectorPrompt } = await resolvePromptFromDb(
      ctx, CS_PROMPT_KEYS.lector, LECTOR_SYSTEM_PROMPT,
    );
    const system = [
      baseLectorPrompt,
      ``,
      `=== COURSE CONTEXT ===`,
      `This is Unit ${unitNumber} of a Serbian language course for English speakers.`,
      `The course teaches STANDARD SERBIAN (Ekavian dialect, Latin script primarily).`,
      referenceBlock ? `\n=== REFERENCE GUIDELINES (inspiration only; do NOT quote) ===\n${referenceBlock}\n` : ``,
      ``,
      `VOCABULARY ALREADY TAUGHT IN PREVIOUS UNITS (${previousUnitsVocab.length} words):`,
      previousVocabKeys.length > 0
        ? previousVocabKeys.slice(0, 200).join(", ") + (previousVocabKeys.length > 200 ? " ... (truncated)" : "")
        : "(This is Unit 1 - no previous vocabulary)",
      ``,
      `IMPORTANT: Words from previous units are ALREADY KNOWN to the learner. They do NOT need to be re-introduced. Using them in exercises for REVIEW is encouraged.`,
      auditSkillBlock ? `\n${auditSkillBlock}\n` : ``,
    ].join("\n");

    const payload = buildAuditPayload(pkg);
    const userPrompt = [`AUDIT PAYLOAD JSON:`, JSON.stringify(payload)].join("\n");

    let providerUsed = "unknown";
    let modelUsed = "unknown";
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let hasAnyTokens = false;
    let estimatedCostUsdTotal = 0;
    let hasAnyCost = false;

    const addUsage = (usage: any, estimatedCostUsd: any) => {
      if (usage && typeof usage === "object") {
        if (typeof usage.inputTokens === "number") {
          inputTokens += usage.inputTokens;
          hasAnyTokens = true;
        }
        if (typeof usage.outputTokens === "number") {
          outputTokens += usage.outputTokens;
          hasAnyTokens = true;
        }
        if (typeof usage.totalTokens === "number") {
          totalTokens += usage.totalTokens;
          hasAnyTokens = true;
        }
      }
      if (typeof estimatedCostUsd === "number") {
        estimatedCostUsdTotal += estimatedCostUsd;
        hasAnyCost = true;
      }
    };

    try {
      const maxTokensRaw = typeof args.maxTokens === "number" ? args.maxTokens : 2000;
      const maxTokens = Math.max(1000, Math.min(3500, Math.floor(maxTokensRaw)));

      const { provider, model, raw, usage, estimatedCostUsd } = await callAiJson(ctx, {
        stage: "auditor",
        preferredProvider: (args.preferredProvider as any) || undefined,
        system,
        user: userPrompt,
        maxTokens,
      });
      providerUsed = provider;
      modelUsed = model;
      addUsage(usage, estimatedCostUsd);

      let audit: any;
      try {
        audit = parseJsonOrThrow(raw);
      } catch (e: any) {
        // Some models still truncate or emit invalid JSON despite response_format=json_object.
        // Attempt a single "repair" call to turn the raw output into valid JSON.
        const rawPreview = String(raw || "").slice(0, 12000);
        const repairSystem = [
          `You are a JSON repair bot.`,
          `Input may contain truncated/invalid JSON and/or extra text.`,
          `Return ONLY a valid JSON object with exactly these keys:`,
          `{"ok":boolean,"blockers":[{"code":string,"message":string,"path"?:string}],"warnings":[{"code":string,"message":string,"path"?:string}]}`,
          `Rules:`,
          `- Do NOT add markdown fences.`,
          `- Do NOT include commentary.`,
          `- If you cannot recover a meaningful audit, return ok=false with one blocker code INVALID_AUDITOR_JSON and include a short message.`,
        ].join("\n");
        const repairUser = [
          `EXPECTED SHAPE: {"ok":boolean,"blockers":[...],"warnings":[...]}`,
          ``,
          `RAW OUTPUT (repair this into valid JSON):`,
          rawPreview,
        ].join("\n");

        const repaired = await callAiJson(ctx, {
          stage: "auditor",
          preferredProvider: (args.preferredProvider as any) || undefined,
          system: repairSystem,
          user: repairUser,
          maxTokens: 1800,
        });
        providerUsed = repaired.provider;
        modelUsed = repaired.model;
        addUsage(repaired.usage, repaired.estimatedCostUsd);
        audit = parseJsonOrThrow(repaired.raw);
      }

      let blockers = Array.isArray(audit?.blockers) ? audit.blockers : [];
      let warnings = Array.isArray(audit?.warnings) ? audit.warnings : [];

      // Defensive normalization: ensure issues are consistently shaped strings.
      const normalizeIssue = (i: any) => ({
        code: String(i?.code || "").trim(),
        message: String(i?.message || "").trim(),
        path: typeof i?.path === "string" ? i.path : undefined,
      });

      // Server-side enforcement: some models still emit subjective "blockers".
      // We only allow objective blockers in this pipeline. Downgrade known subjective codes to warnings.
      const downgradeCodes = new Set([
        "GRAMMAR_CONTENT_TRUNCATED",
        "EXERCISE_TYPE_MISMATCH",
        "EXERCISE_CONTENT_MISMATCH",
        "EXERCISE_MISMATCH",
        "EXERCISE_INCONSISTENCY",
        "EXERCISE_CATEGORY_MISSING",
        "VOCAB_MISSING",
        "VOCAB_MISSING_FROM_SAMPLE",
        "VOCAB_MISSING_KEY",
        "VOCAB_MISSING_IN_DIALOGUE",
        "VOCAB_KEY_INVALID",        // Linguistic suggestions (e.g., "use infinitive instead of conjugated form")
        "MISSING_VOCABULARY",
        "MISSING_CORE_VOCABULARY",
      ]);

      const allowedExerciseCategories = new Set([
        "translation",
        "fillInBlank",
        "multipleChoice",
        "vocabularyMatching",
        "dialogueCompletion",
      ]);

      const downgraded: any[] = [];
      blockers = blockers.filter((b: any) => {
        const code = String(b?.code || "");
        const msg = String(b?.message || "");
        const looksTrunc = /truncat/i.test(code) || /truncat/i.test(msg);

        // If the model invents missing categories outside our supported set, always downgrade.
        if (code === "EXERCISE_CATEGORY_MISSING") {
          const m = msg.match(/category\s+'([^']+)'/i);
          const cat = m ? String(m[1] || "").trim() : "";
          if (cat && !allowedExerciseCategories.has(cat)) {
            downgraded.push({
              code,
              message: `Auditor suggested unsupported exercise category '${cat}'. Ignored.`,
              path: b?.path,
            });
            return false;
          }
        }

        if (downgradeCodes.has(code) || looksTrunc) {
          downgraded.push({
            code: code || "auditor_warning",
            message: msg || "Warning",
            path: b?.path,
          });
          return false;
        }
        return true;
      });
      if (downgraded.length) warnings = [...downgraded, ...warnings];

      // Additional safety: the Lector is not reliable enough to hard-block publishing.
      // Convert any remaining blockers into warnings.
      if (blockers.length) {
        warnings = [
          ...blockers.map((b: any) => ({
            ...normalizeIssue(b),
            code: String(b?.code || "auditor_blocker").trim() || "auditor_blocker",
            message: String(b?.message || "Blocker").trim() || "Blocker",
          })),
          ...warnings,
        ];
        blockers = [];
      }

      // Post-process: Filter out vocabulary warnings for words that already exist in the course
      // This catches false positives where the Lector claims a word is "missing" but it's already taught
      const vocabWarningCodes = new Set([
        "VOCAB_MISSING_KEY",
        "VOCAB_MISSING",
        "VOCAB_MISSING_IN_DIALOGUE",
        "MISSING_VOCABULARY",
        "MISSING_CORE_VOCABULARY",
      ]);
      
      // Extract Serbian word from warning message (patterns like "'soba'" or "word 'soba'")
      const extractSerbianWord = (msg: string): string | null => {
        const match = msg.match(/['']([a-zA-ZčćšžđČĆŠŽĐ]+)['']/);
        return match ? match[1].toLowerCase() : null;
      };

      // Unit vocabulary keys (normalized) for filtering false "missing" reports.
      const unitVocabKeys = new Set(
        (payload?.vocabularyKeys ?? []).map((k: any) => normalizeSerbianKey(k))
      );

      // Also get ALL course vocabulary keys for comprehensive check
      const allVocabKeys = new Set(allCourseVocab.map((v: any) => String(v.serbian || "").toLowerCase()));

      const filteredWarnings: any[] = [];
      for (const w of warnings) {
        const norm = normalizeIssue(w);
        const code = norm.code;
        const msg = norm.message;
        const looksTrunc = /truncat/i.test(code) || /truncat/i.test(msg);
        if (looksTrunc) continue;
        // Enforce evidence: warnings without a concrete path are too noisy/unreliable.
        if (!norm.path) continue;

        // Normalize/limit codes to reduce UI noise and prevent "invented" categories.
        const allowedCodes = new Set(["SERBIAN_ERROR", "TRANSLATION_MISMATCH", "CULTURAL_FACT_RISK", "STYLE_SUGGESTION"]);
        const outCode = allowedCodes.has(code) ? code : "STYLE_SUGGESTION";
        const outMsg = allowedCodes.has(code) ? msg : `[${code || "unknown"}] ${msg}`;
        
        if (vocabWarningCodes.has(code)) {
          const word = extractSerbianWord(outMsg);
          const normWord = word ? normalizeSerbianKey(word) : null;
          if (normWord && unitVocabKeys.has(normWord)) continue; // already present in unit vocabulary
          if (word && allVocabKeys.has(word)) continue; // already exists in course vocabulary
        }
        if (!outMsg.trim()) continue;
        filteredWarnings.push({ ...w, code: outCode, message: outMsg, path: norm.path });
      }
      // Deduplicate warnings by (code + message + path) to reduce model spam.
      const seen = new Set<string>();
      warnings = filteredWarnings.filter((w: any) => {
        const k = `${String(w?.code || "")}||${String(w?.message || "")}||${String(w?.path || "")}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Normalize audit object so UI shows the post-processed blocker/warning sets.
      const normalizedAudit = {
        ...(audit && typeof audit === "object" ? audit : {}),
        blockers,
        warnings,
      };

      // Non-blocking by design: auditor output is advisory only.
      const ok = true;

      const findings = [
        ...blockers.map((b: any) => ({
          stage: "auditor" as const,
          severity: "error" as const,
          code: String(b?.code || "auditor_blocker"),
          message: String(b?.message || "Blocker"),
          path: typeof b?.path === "string" ? b.path : undefined,
          detailsJson: undefined,
        })),
        ...warnings.map((w: any) => ({
          stage: "auditor" as const,
          severity: "warning" as const,
          code: String(w?.code || "auditor_warning"),
          message: String(w?.message || "Warning"),
          path: typeof w?.path === "string" ? w.path : undefined,
          detailsJson: undefined,
        })),
      ];

      await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
        draftId: args.draftId,
        unitPackageJson: snapshot.unitPackageJson,
        markdownSource: snapshot.markdownSource,
        validationReportJson: JSON.stringify({ ok, audit: normalizedAudit }),
        status: "ready_to_publish",
        // Replace findings so old auditor blockers don't linger after reruns.
        // After qc_passed, validator findings should already be empty, so this is safe.
        replaceFindings: true,
        findings,
      });

      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "auditor",
        provider: providerUsed,
        model: modelUsed,
        inputSummary: "audit",
        outputSummary: `${ok ? "audit ok" : `audit blockers=${blockers.length} warnings=${warnings.length}`} rawChars=${String(raw || "").length}`,
        inputTokens: hasAnyTokens ? inputTokens : undefined,
        outputTokens: hasAnyTokens ? outputTokens : undefined,
        totalTokens: hasAnyTokens ? (totalTokens || inputTokens + outputTokens) : undefined,
        estimatedCostUsd: hasAnyCost ? estimatedCostUsdTotal : undefined,
        status: "success",
      });

      return { ok, report: normalizedAudit };
    } catch (e: any) {
      const error = e?.message ? String(e.message) : String(e);
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "auditor",
        provider: providerUsed,
        model: modelUsed || "unknown",
        inputSummary: "audit",
        inputTokens: hasAnyTokens ? inputTokens : undefined,
        outputTokens: hasAnyTokens ? outputTokens : undefined,
        totalTokens: hasAnyTokens ? (totalTokens || inputTokens + outputTokens) : undefined,
        estimatedCostUsd: hasAnyCost ? estimatedCostUsdTotal : undefined,
        status: "failed",
        error,
      });
      throw e;
    } finally {
      await ctx.runMutation(api.contentStudio.updateDraftMeta, {
        draftId: args.draftId,
      });
    }
  },
});
