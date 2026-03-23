import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import {
  requireSuperadminAction,
  parseJsonOrThrow,
  issuesToFindings,
  buildValidationReport,
  canonicalizeDialoguesToUnit1Tables,
  translateUnitMarkdownToEnglishIfNeeded,
  ensureFounderNoteInMarkdownIfConfigured,
  collectMarkdownLanguageIssuesForFounderNote,
  collectIncompleteHeadingIssues,
} from "./_shared";
import {
  fillMissingUnitPackageFields,
  syncVocabularyCoverageFromExercises,
  isTaughtEarlier,
  normalizeSerbianKey,
  calculateExerciseVarietyScore,
} from "./_validatorHelpers";
import { UnitPackageSchema, validateUnitPackageDeep, type ValidationIssue } from "../../scripts/unitPackage/schema";
import { validateUnitPackageTemplateRules } from "../../scripts/unitPackage/templateRules";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";
import { parseMarkdownToUnitPackage, validateMarkdownStructure } from "../../scripts/markdownParser/parser";

export const runQcValidate = action({
  args: { draftId: v.id("contentDrafts") },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const draft = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const snapshot = draft.snapshot;
    if (!snapshot) throw new Error("Draft has no snapshot to validate");

    const parsed = parseJsonOrThrow(snapshot.unitPackageJson);
    const base = UnitPackageSchema.safeParse(parsed);
    if (!base.success) {
      const parseIssues: ValidationIssue[] = base.error.issues.map((i) => ({
        level: "error",
        // Zod uses PropertyKey (string | number | symbol); our ValidationIssue expects (string | number).
        // Coerce defensively to keep the report JSON stable.
        path: (i.path as any[]).map((p) => (typeof p === "number" ? p : String(p))),
        message: i.message,
      }));
      const report = {
        ok: false,
        counts: { schemaErrors: parseIssues.length },
        schemaIssues: parseIssues,
      };
      await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
        draftId: args.draftId,
        unitPackageJson: snapshot.unitPackageJson,
        markdownSource: snapshot.markdownSource,
        validationReportJson: JSON.stringify(report),
        status: "qc_failed",
        replaceFindings: true,
        findings: issuesToFindings("validator", parseIssues).map((f) => ({
          stage: "validator",
          severity: "error" as const,
          code: "schema",
          message: f.message,
          path: f.path,
        })),
      });
      return { ok: false, report };
    }

    const { fixed, changes } = autofixUnitPackage(base.data);
    // Content Studio guardrail: ensure required template categories exist (even if creator/parser omitted them).
    const ensured = fillMissingUnitPackageFields(fixed, fixed);

    // Content Studio guardrail: vocabulary coverage.
    // If a Serbian word is used in exercises but missing in vocabulary, auto-add it from courseVocabulary (dictionary) or safe fallback.
    const vocabSync = await syncVocabularyCoverageFromExercises(ctx, ensured as any);
    const ensuredWithVocab = vocabSync.pkg;

    // Final deduplication pass: remove any remaining vocabulary duplicates (case-insensitive)
    // This is a safety net in case autofix didn't catch everything
    if (Array.isArray((ensuredWithVocab as any)?.vocabulary?.en)) {
      const vocab = (ensuredWithVocab as any).vocabulary.en;
      const seen = new Map<string, number>();
      const dedupedVocab = [];
      for (let i = 0; i < vocab.length; i++) {
        const key = String(vocab[i]?.serbian || "").toLowerCase().trim();
        if (!key) continue;
        if (seen.has(key)) {
          console.log(`[Validator] Removing duplicate vocabulary entry: ${vocab[i].serbian} (already seen)`);
          continue; // Skip duplicate
        }
        seen.set(key, dedupedVocab.length);
        dedupedVocab.push(vocab[i]);
      }
      (ensuredWithVocab as any).vocabulary.en = dedupedVocab;
    }

    const deepIssues = validateUnitPackageDeep(ensuredWithVocab as any);
    const templateIssuesBase = validateUnitPackageTemplateRules(ensuredWithVocab as any);

    // Content Studio continuity rules (hard gate):
    // - Unit vocabulary must not include already-taught words
    // - Any truly new word used in exercises must be in unit vocabulary AND have an English translation (schema already enforces non-empty if present)
    const continuityIssues: ValidationIssue[] = [];
    const unitNumber = Number((ensuredWithVocab as any)?.unitNumber ?? 1) || 1;
    const vocabEn: any[] = Array.isArray((ensuredWithVocab as any)?.vocabulary?.en) ? (ensuredWithVocab as any).vocabulary.en : [];

    const checkKeys = Array.from(
      new Set([
        ...vocabEn.map((v: any) => String(v?.serbian || "").trim()),
        ...(vocabSync.unresolvedNew ?? []),
      ].filter(Boolean))
    );

    const taughtFirstUnitByKey = new Map<string, number>();
    for (const serbian of checkKeys) {
      let found: any[] = [];
      try {
        found = await ctx.runQuery(api.vocabulary.findVocabularyBySerbian, { serbian });
      } catch {
        found = [];
      }
      const activeFound = Array.isArray(found) ? found.filter((e: any) => e?.isActive !== false && e?.releaseStatus !== "offline") : [];
      const earlier = activeFound
        .filter((e: any) => isTaughtEarlier(e, unitNumber))
        .sort((a: any, b: any) => (a.unitNumber ?? 9999) - (b.unitNumber ?? 9999));
      if (earlier.length) {
        const key = normalizeSerbianKey(serbian);
        taughtFirstUnitByKey.set(key, Number(earlier[0].unitNumber));
      }
    }

    // Deterministic enforcement (no manual work): remove already-taught entries from unit vocabulary.
    // This enforces the rule and reduces Creator revision workload.
    // We do NOT report these as errors since they are auto-fixed.
    const filteredVocabEn: any[] = [];
    const autoRemovedVocab: Array<{ serbian: string; firstUnit: number }> = [];
    for (let i = 0; i < vocabEn.length; i++) {
      const serbian = String(vocabEn[i]?.serbian || "").trim();
      const key = normalizeSerbianKey(serbian);
      const firstUnit = taughtFirstUnitByKey.get(key);
      if (firstUnit) {
        autoRemovedVocab.push({ serbian, firstUnit });
        continue; // Skip - auto-removed
      }
      filteredVocabEn.push(vocabEn[i]);
    }
    (ensuredWithVocab as any).vocabulary.en = filteredVocabEn;
    
    // Log auto-removed vocab for transparency (INFO level, not blocking)
    if (autoRemovedVocab.length > 0) {
      console.log(`[Validator] Auto-removed ${autoRemovedVocab.length} already-taught vocabulary entries:`, 
        autoRemovedVocab.map(v => `${v.serbian} (Unit ${v.firstUnit})`).join(", "));
    }

    // Rule C: any truly new word used in exercises must be present in unit vocabulary; if we couldn't auto-add safely, block.
    for (const serbian of vocabSync.unresolvedNew ?? []) {
      const key = normalizeSerbianKey(serbian);
      const firstUnit = taughtFirstUnitByKey.get(key);
      if (firstUnit) continue; // already taught earlier => allowed to be used without listing
      continuityIssues.push({
        level: "error",
        path: ["exercises", "en"],
        message: `New vocabulary '${serbian}' is used in exercises but has no safe translation and is missing from unit vocabulary. Creator/Lector must add it to vocabulary with an English translation (or remove usage).`,
      });
    }

    const languageIssues = collectMarkdownLanguageIssuesForFounderNote(ensuredWithVocab as any);
    const headingIssues = collectIncompleteHeadingIssues(ensuredWithVocab as any);

    const variety = calculateExerciseVarietyScore(ensuredWithVocab as any, "en");
    const varietyIssue: ValidationIssue | null =
      variety.score < 7
        ? {
            level: "warning",
            path: ["exercises", "en"],
            message:
              `Exercise variety score is low (${variety.score}/10). ` +
              `Consider revising question wording to reduce repetition` +
              (variety.topRepeatedStems.length
                ? ` (top repeated stems: ${variety.topRepeatedStems.map((s) => `"${s.stem}"×${s.count}`).join(", ")})`
                : "."),
          }
        : null;

    const templateIssues = [
      ...templateIssuesBase,
      ...continuityIssues,
      ...languageIssues,
      ...headingIssues,
      ...(varietyIssue ? [varietyIssue] : []),
    ];

    const reportBase = buildValidationReport({
      deepIssues,
      templateIssues,
      autofixChangesCount: changes.length,
    });
    const report = { ...reportBase, variety };

    const findings: Array<{
      stage: "validator";
      severity: "error" | "warning" | "info";
      code: string;
      message: string;
      path?: string;
      detailsJson?: string;
    }> = [];
    for (const i of [...deepIssues, ...templateIssues]) {
      findings.push({
        stage: "validator",
        severity: i.level === "error" ? "error" : "warning",
        code: "validation",
        message: i.message,
        path: i.path?.length ? i.path.join(".") : undefined,
      });
    }

    // Non-blocking informational findings about review words used in exercises.
    for (const dup of (vocabSync.alreadyTaughtUsed ?? []).slice(0, 30)) {
      findings.push({
        stage: "validator",
        severity: "info",
        code: "review_vocab_used",
        message: `'${dup.serbian}' is already taught (first seen in Unit ${dup.firstUnit}). It's fine to use for review, but do NOT list it as new vocabulary.`,
        path: "exercises.en",
      });
    }

    // Ensure the snapshot markdown carries the configured Founder/Author note as well
    // (so it doesn't depend on a manual "apply" step in the UI).
    let nextMarkdownSource = snapshot.markdownSource;
    if (typeof nextMarkdownSource === "string" && nextMarkdownSource.trim()) {
      try {
        let md = String(nextMarkdownSource);
        md = canonicalizeDialoguesToUnit1Tables(md);
        md = await translateUnitMarkdownToEnglishIfNeeded(ctx, md, undefined);
        md = await ensureFounderNoteInMarkdownIfConfigured(ctx, draft.draft as any, md, undefined);
        nextMarkdownSource = md;
      } catch {
        // If markdown injection/translation fails for any reason, keep the original markdownSource.
        nextMarkdownSource = snapshot.markdownSource;
      }
    }

    await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
      draftId: args.draftId,
      unitPackageJson: JSON.stringify(ensuredWithVocab),
      markdownSource: nextMarkdownSource,
      validationReportJson: JSON.stringify(report),
      status: report.ok ? "qc_passed" : "qc_failed",
      replaceFindings: true,
      findings,
    });

    return { ok: report.ok, report };
  },
});

// Save a Markdown snapshot (manual human edits) and regenerate unitPackage snapshot deterministically.
export const saveMarkdownSnapshot = action({
  args: {
    draftId: v.id("contentDrafts"),
    markdown: v.string(),
    // When true, skip the AI-based translation pass so that manually-edited
    // content is saved exactly as written (no AI modification).
    skipTranslation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    if (!current?.draft) throw new Error("Draft not found");

    let markdown = String(args.markdown || "").replace(/\r\n/g, "\n").trim();
    if (!markdown) throw new Error("Markdown is empty");

    // Deterministic canonicalization: bring dialogues into Unit 1/2 table format if needed.
    markdown = canonicalizeDialoguesToUnit1Tables(markdown);

    // Enforce Base Language: English — skip when the caller explicitly opted out
    // (e.g. manual saves from the Content Studio editor where the user wants their
    // edits preserved exactly and does not want the AI to modify the content).
    if (!args.skipTranslation) {
      markdown = await translateUnitMarkdownToEnglishIfNeeded(ctx, markdown, undefined);
    }
    // Ensure Founder note is present if configured on the draft.
    markdown = await ensureFounderNoteInMarkdownIfConfigured(ctx, current.draft as any, markdown, undefined);
    // Canonicalize again in case translation or edits produced near-miss dialogue formatting.
    markdown = canonicalizeDialoguesToUnit1Tables(markdown);

    const structure = validateMarkdownStructure(markdown);
    if (!structure.valid) {
      throw new Error(`Markdown structure invalid: ${structure.errors.join("; ")}`);
    }

    const parsedUnitPackage = parseMarkdownToUnitPackage(markdown);
    const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
    if (!baseParsed.success) {
      const first = baseParsed.error.issues?.[0];
      throw new Error(
        `Parsed markdown produced invalid unitPackage.v1. First issue: ${first?.path?.join(".") || "(unknown)"}: ${first?.message || "invalid"}`
      );
    }

    await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
      draftId: args.draftId,
      unitPackageJson: JSON.stringify(baseParsed.data),
      markdownSource: markdown,
      validationReportJson: JSON.stringify({ ok: false, note: "Markdown saved; run Validator." }),
      status: "draft",
      replaceFindings: true,
      findings: [],
    });

    return { ok: true };
  },
});
