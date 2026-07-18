"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireSuperadminAction, callAiText, resolvePromptFromDb, buildStageSkillBlock } from "./_shared";
import pdfParse from "pdf-parse";
import {
  validateMarkdownStructure,
  parseMarkdownToUnitPackage,
} from "../../scripts/markdownParser/parser";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import {
  canonicalizeDialoguesToUnit1Tables,
  ensureFounderNoteInMarkdownIfConfigured,
  translateUnitMarkdownToEnglishIfNeeded,
} from "./_shared";
import { syncVocabularyCoverageFromExercises } from "./_validatorHelpers";
import {
  getSpecialistUserPromptBase,
  buildCuratedSectionsBlock,
  CS_PROMPT_KEYS,
} from "./prompts";
import type { SectionId } from "../../scripts/markdownParser/sectionUtils";
import type { Id } from "../_generated/dataModel";
import {
  buildValidatorMemoryBlockFromEntries,
  buildCorrectionRecipesBlock,
  findMemoryForFindingsFromEntries,
} from "./_validatorMemory";

function normalizeForOverlap(s: string): string[] {
  const raw = String(s || "");
  if (!raw.trim()) return [];

  // Normalize diacritics (č/ć/š/ž/đ → c/c/s/z/d) so overlaps are detected robustly.
  const lowered = raw
    .normalize("NFKD")
    // eslint-disable-next-line no-control-regex
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  // Keep ASCII word tokens for stable overlap detection.
  return lowered
    .split(/[^a-z0-9]+/g)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function buildNgramSet(words: string[], n: number, maxNgrams = 60000): Set<string> {
  const out = new Set<string>();
  if (words.length < n) return out;

  const total = words.length - n + 1;
  const step = total > maxNgrams ? Math.ceil(total / maxNgrams) : 1;
  for (let i = 0; i <= words.length - n; i += step) {
    out.add(words.slice(i, i + n).join(" "));
  }
  return out;
}

function findOverlappingNgrams(params: { source: string; output: string; n: number; maxHits?: number }): string[] {
  const sourceWords = normalizeForOverlap(params.source);
  const outputWords = normalizeForOverlap(params.output);
  const sourceSet = buildNgramSet(sourceWords, params.n);

  const hits: string[] = [];
  const maxHits = params.maxHits ?? 8;
  if (outputWords.length < params.n) return hits;

  for (let i = 0; i <= outputWords.length - params.n; i++) {
    const gram = outputWords.slice(i, i + params.n).join(" ");
    if (sourceSet.has(gram)) {
      hits.push(gram);
      if (hits.length >= maxHits) break;
    }
  }
  return hits;
}

function sanitizeGuidelines(raw: string): string {
  const s = String(raw || "").replace(/\r\n/g, "\n");
  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // Drop headings / fences / quotes
    .filter((l) => !/^```/.test(l))
    .filter((l) => !/^\s*#{1,6}\s+/.test(l))
    .filter((l) => !/^\s*>/.test(l))
    .map((l) => {
      // Force bullet prefix
      if (l.startsWith("- ")) return l;
      if (l.startsWith("• ")) return `- ${l.slice(2).trim()}`;
      if (/^\d+\.\s+/.test(l)) return `- ${l.replace(/^\d+\.\s+/, "").trim()}`;
      return `- ${l}`;
    })
    // Remove any explicit quoting characters to reduce risk of verbatim passages
    .map((l) => l.replace(/["“”]/g, ""));

  // Max 25 bullets (as per prompt).
  return lines.slice(0, 25).join("\n").trim();
}

async function ensureReferenceGuidelines(ctx: any, refDoc: any, preferredProvider?: "gemini" | "openai") {
  const existing = String(refDoc?.guidelines || "").trim();
  if (existing) return { guidelines: existing, provider: String(refDoc?.guidelinesProvider || ""), model: String(refDoc?.guidelinesModel || "") };

  const type = String(refDoc?.type || "");
  const url = String(refDoc?.downloadUrl || refDoc?.url || "").trim();
  const storageId = String(refDoc?.storageId || "").trim();

  if (type !== "pdf" || (!url && !storageId)) {
    return { guidelines: "", provider: "", model: "" };
  }

  const pdfUrls: string[] = Array.isArray(refDoc?.pdfDownloadUrls)
    ? (refDoc.pdfDownloadUrls as any[]).map((u) => String(u || "").trim()).filter(Boolean)
    : url
      ? [url]
      : [];

  // Fetch PDF bytes (signed URL). Limit to reasonable file sizes (UI already restricts to 25MB).
  // Multi-PDF support: extract text from all PDFs (best-effort), then combine for summarization.
  const extractedParts: string[] = [];
  for (const pdfUrl of pdfUrls) {
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) continue;
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      const parseFn: any = (pdfParse as any)?.default || (pdfParse as any);
      const parsed: any = await parseFn(buf);
      const txt = String(parsed?.text || "").trim();
      if (txt) extractedParts.push(txt);
    } catch {
      // ignore per-file parse errors
    }
  }

  const extracted = extractedParts.join("\n\n---\n\n").trim();

  // If extraction fails, fall back to the human notes only.
  const notes = String(refDoc?.notes || "").trim();
  const sourceText = extracted || notes;
  if (!sourceText.trim()) {
    return { guidelines: "", provider: "", model: "" };
  }

  // Truncate input hard to avoid token blowups.
  // IMPORTANT: Smaller cap reduces risk of verbatim overlap and token blowups.
  const maxChars = 40000;
  const sample = sourceText.length > maxChars ? `${sourceText.slice(0, maxChars)}\n[TRUNCATED]` : sourceText;

  const system = [
    `You are an expert instructional designer.`,
    `You will be given reference material (possibly from a textbook PDF).`,
    `Your job is to extract HIGH-LEVEL GUIDELINES for how to structure learning units and how to write good exercise questions.`,
    ``,
    `STRICT COPYRIGHT-SAFETY RULES:`,
    `- Do NOT copy, quote, paraphrase, or rewrite any sentence from the reference.`,
    `- Do NOT include any verbatim phrases from the reference.`,
    `- If you feel tempted to reuse wording, replace it with abstract guidance.`,
    `- Output must be original, abstract guidance (principles, heuristics, checklists), NOT rewritten textbook text.`,
    `- Never include examples that mirror the reference wording.`,
    `- Focus on: unit structure, progression, exercise quality, question wording, variety, difficulty, and common pitfalls.`,
    `- Keep it concise: max 25 bullet points.`,
    `- Output ONLY plain text bullet points (start each line with "- ").`,
  ].join("\n");

  const user = [
    `REFERENCE MATERIAL (for inspiration only; do NOT quote):`,
    sample,
    ``,
    `Write the guidelines now.`,
  ].join("\n");

  const doGenerate = async (mode: "initial" | "rewrite", draft: string) => {
    if (mode === "initial") {
      return await callAiText(ctx, {
        stage: "specialist",
        preferredProvider: (preferredProvider as any) || undefined,
        system,
        user,
        maxTokens: 1200,
      });
    }

    const rewriteSystem = [
      `You are an expert instructional designer.`,
      `Rewrite the provided guidelines into MORE ABSTRACT, ORIGINAL wording.`,
      ``,
      `STRICT COPYRIGHT-SAFETY RULES:`,
      `- Do NOT copy, quote, paraphrase, or rewrite any sentence from the reference material.`,
      `- Avoid any distinctive phrasing; keep everything generic and principle-based.`,
      `- Output ONLY plain text bullet points (start each line with "- ").`,
      `- Max 25 bullet points.`,
    ].join("\n");

    const rewriteUser = [
      `Rewrite these guidelines into safer, more abstract guidance:`,
      ``,
      draft,
    ].join("\n");

    return await callAiText(ctx, {
      stage: "specialist",
      preferredProvider: (preferredProvider as any) || undefined,
      system: rewriteSystem,
      user: rewriteUser,
      maxTokens: 1200,
    });
  };

  const attempts = 3;
  let provider = "";
  let model = "";
  let guidelines = "";

  // Hard guard: check for overlapping 8-word sequences with the PDF extract/notes.
  // If found, force a rewrite and re-check. If still unsafe after retries, abort.
  for (let i = 0; i < attempts; i++) {
    const mode: "initial" | "rewrite" = i === 0 ? "initial" : "rewrite";
    const { provider: p, model: m, raw } = await doGenerate(mode, guidelines || "");
    provider = p;
    model = m;
    guidelines = sanitizeGuidelines(String(raw || ""));
    if (!guidelines) continue;

    const overlaps = findOverlappingNgrams({ source: sample, output: guidelines, n: 8, maxHits: 6 });
    if (overlaps.length === 0) break;

    // Force another rewrite attempt.
    if (i === attempts - 1) {
      throw new Error(
        "[COPYRIGHT_GUARD] Could not generate copyright-safe guidelines (overlap detected). Please use manual notes instead."
      );
    }
  }

  if (guidelines) {
    await ctx.runMutation(api.contentStudio.setReferenceGuidelines, {
      referenceId: refDoc._id,
      guidelines,
      provider,
      model,
    });
  }

  return { guidelines, provider, model };
}

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const translateToEnglish = action({
  args: {
    text: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const input = String(args.text || "").trim();
    if (!input) return { english: "" };

    const system = [
      `You are a translation engine.`,
      `Translate the user's text into natural, learner-friendly English.`,
      `Return ONLY the translated English text (no quotes, no markdown, no commentary).`,
      `Keep it concise; preserve the original tone.`,
    ].join("\n");

    const tryOnce = async (p?: "gemini" | "openai"): Promise<string | null> => {
      try {
        const { raw } = await callAiText(ctx, {
          stage: "specialist",
          preferredProvider: (p as any) || undefined,
          system,
          user: input,
          maxTokens: 600,
        });
        const out = String(raw || "").trim();
        return out || null;
      } catch {
        return null;
      }
    };

    const preferred = (args.preferredProvider as any) || undefined;
    const primary = await tryOnce(preferred);
    if (primary) return { english: primary };

    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const other =
      preferred === "gemini"
        ? (hasOpenAI ? "openai" : undefined)
        : preferred === "openai"
          ? (hasGemini ? "gemini" : undefined)
          : hasGemini
            ? "gemini"
            : hasOpenAI
              ? "openai"
              : undefined;
    const fallback = other ? await tryOnce(other) : null;
    if (fallback) return { english: fallback };

    // Final fallback: do not break the UI.
    return { english: input };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const runAiSpecialistGenerate = action({
  args: {
    draftId: v.id("contentDrafts"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    maxTokens: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    // Guardrail: a full Creator run regenerates the whole unit from the brief and
    // discards the curated snapshot (manual Markdown edits, section revisions).
    // Callers must pass confirmOverwrite=true to proceed once a snapshot exists.
    confirmOverwrite: v.optional(v.boolean()),
  },
  // Explicit return type breaks TS inference circularity (Convex schema depth).
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: boolean; needsConfirm?: boolean; reason?: string }> => {
    await requireSuperadminAction(ctx);
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const d = current.draft;

    // Guardrail against accidental loss of curation: if the draft already has a
    // snapshot, a full rebuild would overwrite it. Require explicit confirmation
    // (the UI shows a warning dialog and re-calls with confirmOverwrite=true).
    if ((d as any).lastSnapshotId && args.confirmOverwrite !== true) {
      const isApprovedOrPublished =
        !!(d as any).approvedSnapshotId || d.status === "published";
      return {
        ok: false as const,
        needsConfirm: true as const,
        reason: isApprovedOrPublished ? "approved_or_published" : "existing_snapshot",
      };
    }

    // Load previous vocabulary to prevent duplicates
    const allCourseVocab = await ctx.runQuery(api.vocabulary.getAllCourseVocabulary, {});
    const previousUnitsVocab = allCourseVocab
      .filter((v: any) => v.unitNumber < d.unitNumber)
      .map((v: any) => ({ serbian: v.serbian, en: v.en, unit: v.unitNumber }));
    const previousVocabKeys = previousUnitsVocab.map((v: any) => String(v.serbian).toLowerCase());

    const refId = (d as any).inspirationRef?.referenceId as Id<"contentStudioReferences"> | undefined;
    const refDoc = refId ? await ctx.runQuery(api.contentStudio.getReferenceById, { referenceId: refId }) : null;
    const creatorBriefRaw = String((d as any).inspirationRef?.notes || "").trim();
    const creatorBrief =
      creatorBriefRaw.length > 6000 ? `${creatorBriefRaw.slice(0, 6000)}\n[CREATOR_BRIEF_TRUNCATED]` : creatorBriefRaw;

    // If a PDF reference is selected, lazily distill a guidance summary once and store it on the reference.
    // This makes the reference actually influence authoring (structure, question writing, etc.).
    const refGuidelines = refDoc
      ? await (async () => {
          try {
            const res = await ensureReferenceGuidelines(ctx, refDoc as any, (args.preferredProvider as any) || undefined);
            return String(res?.guidelines || "").trim();
          } catch (e: any) {
            const msg = String(e?.message || e || "");
            // If the copyright guard trips, fail loudly so the user knows the PDF could not be processed safely.
            if (msg.includes("[COPYRIGHT_GUARD]")) throw new Error(msg);
            return String((refDoc as any)?.guidelines || "").trim();
          }
        })()
      : "";

    const skillBlock = await buildStageSkillBlock(ctx, d as any, "specialist");

    const referenceBlock = (() => {
      if (!refDoc) return "";
      const safeNotes = String((refDoc as any).notes || "").trim();
      const refUrl = String((refDoc as any).downloadUrl || (refDoc as any).url || "").trim();
      const safeGuidelines = refGuidelines;
      return [
        "REFERENCE (inspiration only; do NOT copy text):",
        `- Title: ${String((refDoc as any).title || "").trim()}`,
        refUrl ? `- URL: ${refUrl}` : "",
        safeNotes ? `- Notes: ${safeNotes}` : "",
        safeGuidelines ? `- Guidelines (distilled; follow these patterns):\n${safeGuidelines}` : "",
      ]
        .filter(Boolean)
        .join("\n")
        .trim();
    })();

    const creatorBriefBlock = (() => {
      if (!creatorBrief) return "";
      return [
        "CREATOR BRIEF (from user; may be German; output must still be English):",
        creatorBrief,
      ].join("\n");
    })();

    // Ping-Pong: Brief <-> Markdown — human-adopted sections from the active
    // Brief Version build upon themselves instead of being discarded by a
    // full regeneration (see convex/contentStudio/_briefVersions.ts).
    const curatedSectionsBlock = buildCuratedSectionsBlock(
      (d as any).curatedSections as Array<{ section: SectionId; markdown: string }> | undefined
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SPECIALIST SYSTEM PROMPT - loaded from DB (chatPrompts table)
    // ═══════════════════════════════════════════════════════════════════════════
    const baseSystemPrompt = await resolvePromptFromDb(
      ctx,
      CS_PROMPT_KEYS.unitCreator,
    );

    // Validator-Memory ("Gehirn"): known pitfalls from previously-fixed findings.
    // Injected into the system prompt so the Specialist proactively avoids them.
    const creatorMemoryEntries = await ctx.runQuery(
      internal.contentStudio.getActiveValidatorMemoryForScope,
      { scope: "creator", limit: 60 }
    );
    const memoryBlock = buildValidatorMemoryBlockFromEntries(
      creatorMemoryEntries as any,
      { limit: 40 }
    );

    // Replace [LANGUAGE] placeholder if present
    const system = [
      baseSystemPrompt.replace(/\[LANGUAGE\]/g, "English"), // Specialist always outputs English base
      skillBlock ? `\n${skillBlock}\n` : ``,
      memoryBlock ? `\n${memoryBlock}\n` : ``,
      referenceBlock ? `\n${referenceBlock}\n` : ``,
    ].join("\n");

    const unitTitleOneLine = String(d.title || "").replace(/\s+/g, " ").trim();
    const unitDescriptionOneLine = String(d.description || "").replace(/\s+/g, " ").trim();

    const userPromptBase = getSpecialistUserPromptBase(
      d,
      unitTitleOneLine,
      unitDescriptionOneLine,
      creatorBriefBlock,
      previousVocabKeys,
      curatedSectionsBlock
    );

    const startedAt = Date.now();
    let providerUsed = "unknown";
    let modelUsed = "unknown";
    let lastUsage: any = null;
    let lastEstimatedCostUsd: number | null = null;

    try {
      const maxTokensRaw = typeof args.maxTokens === "number" ? args.maxTokens : 12000;
      const maxTokens = Math.max(2000, Math.min(16000, Math.floor(maxTokensRaw)));
      const maxAttemptsRaw = typeof args.maxAttempts === "number" ? args.maxAttempts : 2;
      const maxAttempts = Math.max(1, Math.min(2, Math.floor(maxAttemptsRaw)));

      const runOnce = async (attempt: 1 | 2, previousErrors?: string[]) => {
        const extra = attempt === 2 && previousErrors?.length
          ? [
              ``,
              `IMPORTANT: Your previous output FAILED validation with these errors:`,
              ...previousErrors.map(e => `- ${e}`),
              ``,
              `Fix ALL listed errors. Return a single, complete Markdown document with ALL required headings/tables.`,
              `If you are running out of space, shorten dialogues and wording, but keep the structure complete.`,
            ].join("\n")
          : "";
        const { provider, model, raw, usage, estimatedCostUsd } = await callAiText(ctx, {
          stage: "specialist",
          preferredProvider: (args.preferredProvider as any) || undefined,
          system,
          user: userPromptBase + extra,
          // Give the creator room; markdown is less brittle than JSON but can still truncate.
          maxTokens,
        });
        providerUsed = provider;
        modelUsed = model;
        lastUsage = usage;
        lastEstimatedCostUsd = estimatedCostUsd;
        return raw;
      };

      const ensureDescriptionLine = (md: string) => {
        const normalized = String(md || "").replace(/\r\n/g, "\n");
        // If already present anywhere, keep as-is.
        if (normalized.match(/^\*\*(Description|Beschreibung):\*\*\s+.+/m)) return normalized;

        const desc =
          (unitDescriptionOneLine && unitDescriptionOneLine.trim())
            ? unitDescriptionOneLine.trim()
            : "One short English sentence (max ~120 chars).";

        // Prefer inserting right after the Unit header.
        const unitHeaderRe = /^##\s+Unit\s+\d+:[^\n]*$/m;
        const m = normalized.match(unitHeaderRe);
        if (m && m.index !== undefined) {
          const idx = m.index + m[0].length;
          return `${normalized.slice(0, idx)}\n\n**Description:** ${desc}\n${normalized.slice(idx)}`;
        }

        // Fallback: prepend near top.
        return `**Description:** ${desc}\n\n${normalized}`;
      };

      let markdown = await runOnce(1);
      markdown = ensureDescriptionLine(markdown);
      // Deterministic canonicalization: bring dialogues into Unit 1/2 table format if needed.
      markdown = canonicalizeDialoguesToUnit1Tables(markdown);
      let structure = validateMarkdownStructure(markdown);
      
      if (!structure.valid && maxAttempts >= 2) {
        markdown = await runOnce(2, structure.errors);
        markdown = ensureDescriptionLine(markdown);
        markdown = canonicalizeDialoguesToUnit1Tables(markdown);
        structure = validateMarkdownStructure(markdown);
        if (!structure.valid) {
          throw new Error(`Creator markdown failed structure validation after ${maxAttempts} attempt(s): ${structure.errors.join("; ")}`);
        }
      } else if (!structure.valid) {
        throw new Error(`Creator markdown failed structure validation: ${structure.errors.join("; ")}`);
      }

      // Enforce Base Language: English (auto-translate the whole unit if needed).
      markdown = await translateUnitMarkdownToEnglishIfNeeded(ctx, markdown, (args.preferredProvider as any) || undefined);
      // Ensure Founder note is present if configured on the draft.
      markdown = await ensureFounderNoteInMarkdownIfConfigured(ctx, d as any, markdown, (args.preferredProvider as any) || undefined);
      markdown = canonicalizeDialoguesToUnit1Tables(markdown);

      structure = validateMarkdownStructure(markdown);
      if (!structure.valid) {
        throw new Error(`Creator markdown failed structure validation after post-processing: ${structure.errors.join("; ")}`);
      }

      const parsedUnitPackage = parseMarkdownToUnitPackage(markdown);
      const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
      if (!baseParsed.success) {
        const first = baseParsed.error.issues?.[0];
        throw new Error(
          `Parsed markdown produced invalid unitPackage.v1 (unexpected). First issue: ${first?.path?.join(".") || "(unknown)"}: ${first?.message || "invalid"}`
        );
      }

      // Early guardrail: vocabulary coverage (so missing vocab doesn't only show up in QC)
      let pkg = baseParsed.data as any;
      let vocabAdded = 0;
      let vocabUnresolved = 0;
      let vocabSkippedProperNouns = 0;
      try {
        const vocabSync = await syncVocabularyCoverageFromExercises(ctx, pkg);
        pkg = vocabSync.pkg;
        vocabAdded = Array.isArray(vocabSync.added) ? vocabSync.added.length : 0;
        vocabUnresolved = Array.isArray(vocabSync.unresolvedNew) ? vocabSync.unresolvedNew.length : 0;
        vocabSkippedProperNouns = Array.isArray(vocabSync.skippedProperNouns) ? vocabSync.skippedProperNouns.length : 0;
      } catch (e: any) {
        console.warn("Creator: vocabulary coverage pre-check failed (will rely on Validator):", e?.message || e);
      }

      // Store snapshot; QC validate will still autofix + deep/template validate
      await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
        draftId: args.draftId,
        unitPackageJson: JSON.stringify(pkg),
        markdownSource: markdown,
        validationReportJson: JSON.stringify({
          ok: false,
          note: "Generated; run Validator.",
          vocabCoverage: {
            added: vocabAdded,
            unresolvedNew: vocabUnresolved,
            skippedProperNouns: vocabSkippedProperNouns,
          },
        }),
        status: "draft",
        replaceFindings: true,
        findings: [],
      });
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider: providerUsed,
        model: modelUsed,
        inputSummary: `module=${d.moduleNumber}, unit=${d.unitNumber}`,
        outputSummary: `generated markdownChars=${markdown.length} vocabAdded=${vocabAdded} unresolvedNew=${vocabUnresolved}`,
        inputTokens: typeof lastUsage?.inputTokens === "number" ? lastUsage.inputTokens : undefined,
        outputTokens: typeof lastUsage?.outputTokens === "number" ? lastUsage.outputTokens : undefined,
        totalTokens: typeof lastUsage?.totalTokens === "number" ? lastUsage.totalTokens : undefined,
        estimatedCostUsd: typeof lastEstimatedCostUsd === "number" ? lastEstimatedCostUsd : undefined,
        status: "success",
      });
    } catch (e: any) {
      const error = e?.message ? String(e.message) : String(e);
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider: providerUsed,
        model: modelUsed,
        inputSummary: `module=${d.moduleNumber}, unit=${d.unitNumber}`,
        inputTokens: typeof lastUsage?.inputTokens === "number" ? lastUsage.inputTokens : undefined,
        outputTokens: typeof lastUsage?.outputTokens === "number" ? lastUsage.outputTokens : undefined,
        totalTokens: typeof lastUsage?.totalTokens === "number" ? lastUsage.totalTokens : undefined,
        estimatedCostUsd: typeof lastEstimatedCostUsd === "number" ? lastEstimatedCostUsd : undefined,
        status: "failed",
        error,
      });
      throw e;
    } finally {
      // Touch draft timestamp
      await ctx.runMutation(api.contentStudio.updateDraftMeta, {
        draftId: args.draftId,
      });
    }

    return { ok: true };
  },
});

// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const runAiCreatorRevise = action({
  args: {
    draftId: v.id("contentDrafts"),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    maxTokens: v.optional(v.number()),
    humanNotes: v.optional(v.string()),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const d = current.draft;
    const snapshot = current.snapshot;
    
    if (!snapshot?.markdownSource) throw new Error("No markdown to revise");

    // Get findings (errors/warnings) – exclude dismissed ones from the Fix prompt
    const findings = current.findings || [];
    const issues = findings.filter((f: any) =>
      (f.severity === "error" || f.severity === "warning") && !f.dismissed
    );
    const humanNotes = String(args.humanNotes || "").trim();

    // Only re-append auditor findings that were NOT sent to the fixer.
    // Findings sent to the fixer are considered "attempted" -- if they persist,
    // the user should re-run the Lector for a fresh check.
    const sentToFixerIds = new Set(
      issues.map((f: any) => String(f._id || "")).filter(Boolean)
    );
    const survivingAuditorFindings = findings.filter(
      (f: any) => f.stage === "auditor" && !f.dismissed && !sentToFixerIds.has(String(f._id || ""))
    );

    if (issues.length === 0 && !humanNotes) {
       console.log("Running revision with no findings or notes (force re-roll?)");
    }

    const skillBlock = await buildStageSkillBlock(ctx, d as any, "specialist");

    const findingsBlock = issues.length > 0 
      ? `FINDINGS TO FIX:\n${issues.map((f: any) => `- [${f.code}] ${f.message} (path: ${f.path || "root"})`).join("\n")}`
      : "No automated findings.";

    const notesBlock = humanNotes 
      ? `HUMAN REVIEW NOTES:\n${humanNotes}`
      : "";

    // Validator-Memory: pull "correction recipes" curated from past fixes that
    // match any of the current findings. The AI sees the exact guidance, and -
    // if provided - concrete before/after examples, so similar findings get
    // fixed the same way every time.
    const fixMemoryEntries = issues.length > 0
      ? await ctx.runQuery(
          internal.contentStudio.getActiveValidatorMemoryForScope,
          { scope: "fix", limit: 120 }
        )
      : [];
    const matchedRecipes = findMemoryForFindingsFromEntries(
      fixMemoryEntries as any,
      issues.map((f: any) => ({ stage: f.stage, code: f.code, path: f.path })),
      { maxPerFinding: 2, maxTotal: 24 }
    );
    const recipesBlock = buildCorrectionRecipesBlock(matchedRecipes);

    const baseSystemPrompt = await resolvePromptFromDb(
      ctx,
      CS_PROMPT_KEYS.findingFixer,
    );

    // Replace [LANGUAGE] placeholder if present
    const system = [
      baseSystemPrompt.replace(/\[LANGUAGE\]/g, "English"), // Specialist always outputs English base
      skillBlock ? `\n${skillBlock}\n` : ``,
      `\nCONTEXT:`,
      `Unit ${d.unitNumber}: ${d.title}`,
      `Description: ${d.description}`,
    ].join("\n");

    const userPrompt = [
      `CURRENT MARKDOWN CONTENT:`,
      snapshot.markdownSource,
      ``,
      findingsBlock,
      ``,
      notesBlock,
      ``,
      recipesBlock,
      ``,
      `TASK: Revise the markdown to fix the findings and address the notes.`,
      `Return ONLY the full corrected Markdown.`,
    ].join("\n");

    const maxTokensRaw = typeof args.maxTokens === "number" ? args.maxTokens : 14000;
    const maxTokens = Math.max(2000, Math.min(16000, Math.floor(maxTokensRaw)));

    let providerUsed = "unknown";
    let modelUsed = "unknown";
    let lastUsage: any = null;
    let lastEstimatedCostUsd: number | null = null;

    try {
      const { provider, model, raw, usage, estimatedCostUsd } = await callAiText(ctx, {
        stage: "specialist",
        preferredProvider: (args.preferredProvider as any) || undefined,
        system,
        user: userPrompt,
        maxTokens,
      });
      providerUsed = provider;
      modelUsed = model;
      lastUsage = usage;
      lastEstimatedCostUsd = estimatedCostUsd;

      let markdown = String(raw || "").trim();

      // Truncation guard: if the model returned significantly less than the input markdown,
      // it only output the fixed parts instead of the full unit. Retry once with an explicit warning.
      const inputLength = (snapshot.markdownSource || "").length;
      const TRUNCATION_THRESHOLD = 0.55; // output < 55% of input = likely truncated
      if (inputLength > 500 && markdown.length < inputLength * TRUNCATION_THRESHOLD) {
        console.log(`[runAiCreatorRevise] Output truncated (${markdown.length} chars vs ${inputLength} input). Retrying with explicit full-output instruction.`);
        const retryUserPrompt = [
          `IMPORTANT: Your previous response was truncated. You MUST output the COMPLETE, FULL Markdown document.`,
          `Do NOT output only the changed sections. The output must include ALL sections: ## 1. Overview, ## 2. Vocabulary, ## 3. Grammar, ## 4. Phrases, ## 5. Interactive Test.`,
          ``,
          `CURRENT MARKDOWN CONTENT:`,
          snapshot.markdownSource,
          ``,
          findingsBlock,
          ``,
          notesBlock,
          ``,
          recipesBlock,
          ``,
          `TASK: Revise the markdown to fix the findings. Return the ENTIRE corrected Markdown from the very first line to the very last line. Do not cut it short.`,
        ].join("\n");
        const retryResult = await callAiText(ctx, {
          stage: "specialist",
          preferredProvider: (args.preferredProvider as any) || undefined,
          system,
          user: retryUserPrompt,
          maxTokens,
        });
        markdown = String(retryResult.raw || "").trim();
        // Update usage tracking to the retry run
        lastUsage = retryResult.usage;
        lastEstimatedCostUsd = retryResult.estimatedCostUsd;
      }

      // Post-processing
      markdown = canonicalizeDialoguesToUnit1Tables(markdown);
      markdown = await translateUnitMarkdownToEnglishIfNeeded(ctx, markdown, (args.preferredProvider as any) || undefined);
      markdown = await ensureFounderNoteInMarkdownIfConfigured(ctx, d as any, markdown, (args.preferredProvider as any) || undefined);
      markdown = canonicalizeDialoguesToUnit1Tables(markdown);

      const structure = validateMarkdownStructure(markdown);
      if (!structure.valid) {
         throw new Error(`Revised markdown failed structure validation: ${structure.errors.join("; ")}`);
      }

      const parsedUnitPackage = parseMarkdownToUnitPackage(markdown);
      const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
      if (!baseParsed.success) {
          throw new Error("Revised markdown produced invalid unitPackage.v1");
      }

      await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
        draftId: args.draftId,
        unitPackageJson: JSON.stringify(baseParsed.data),
        markdownSource: markdown,
        validationReportJson: JSON.stringify({ ok: false, note: "Revised; running Validator..." }),
        status: "draft",
        replaceFindings: true,
        findings: [],
      });

      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider: providerUsed,
        model: modelUsed,
        inputSummary: `revise findings=${issues.length} notes=${humanNotes.length}`,
        outputSummary: `revised markdownChars=${markdown.length}`,
        inputTokens: typeof lastUsage?.inputTokens === "number" ? lastUsage.inputTokens : undefined,
        outputTokens: typeof lastUsage?.outputTokens === "number" ? lastUsage.outputTokens : undefined,
        totalTokens: typeof lastUsage?.totalTokens === "number" ? lastUsage.totalTokens : undefined,
        estimatedCostUsd: typeof lastEstimatedCostUsd === "number" ? lastEstimatedCostUsd : undefined,
        status: "success",
      });

      // Auto-validate as requested
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      const validateRes = await ctx.runAction(api.contentStudio.runQcValidate, { draftId: args.draftId });

      // Restore surviving auditor findings so they remain visible after the QC-Validate overwrite.
      // This prevents the Lector→Fix→Lector endloop: auditor warnings stay in the list
      // until the user explicitly runs Lector again or dismisses them.
      if (survivingAuditorFindings.length > 0) {
        await ctx.runMutation(api.contentStudio.appendFindings, {
          draftId: args.draftId,
          findings: survivingAuditorFindings.map((f: any) => ({
            stage: "auditor" as const,
            severity: "warning" as const,
            code: String(f.code || "STYLE_SUGGESTION"),
            message: String(f.message || ""),
            path: typeof f.path === "string" ? f.path : undefined,
            detailsJson: typeof f.detailsJson === "string" ? f.detailsJson : undefined,
          })),
        });
      }

      return { ok: true, validate: validateRes };
    } catch (e: any) {
      const error = e?.message ? String(e.message) : String(e);
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider: providerUsed,
        model: modelUsed,
        inputSummary: `revise findings=${issues.length}`,
        inputTokens: typeof lastUsage?.inputTokens === "number" ? lastUsage.inputTokens : undefined,
        outputTokens: typeof lastUsage?.outputTokens === "number" ? lastUsage.outputTokens : undefined,
        totalTokens: typeof lastUsage?.totalTokens === "number" ? lastUsage.totalTokens : undefined,
        estimatedCostUsd: typeof lastEstimatedCostUsd === "number" ? lastEstimatedCostUsd : undefined,
        status: "failed",
        error,
      });
      throw e;
    }
  },
});
