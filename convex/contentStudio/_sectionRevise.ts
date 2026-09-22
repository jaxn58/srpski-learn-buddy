import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import {
  requireSuperadminAction,
  callAiText,
  parseJsonOrThrow,
  extractUnitPackageFromAi,
  canonicalizeDialoguesToUnit1Tables,
  translateUnitMarkdownToEnglishIfNeeded,
  ensureFounderNoteInMarkdownIfConfigured,
  usageForRunLog,
  createAiCallTimer,
} from "./_shared";
import { buildValidatorMemoryBlockFromEntries } from "./_validatorMemory";
import {
  fillMissingUnitPackageFields,
} from "./_validatorHelpers";
import {
  validateMarkdownStructure,
  parseMarkdownToUnitPackage,
} from "../../scripts/markdownParser/parser";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";
import {
  type SectionId,
  extractSection,
  replaceSection,
  validateSection,
  appendDialogue,
  deduplicateVocabularySectionMarkdown,
} from "../../scripts/markdownParser/sectionUtils";
import { CS_PROMPT_KEYS } from "./prompts";
import { resolvePromptFromDb, languageRulesBlock, buildStageSkillBlock } from "./_shared";

/**
 * Expand a single section of the markdown without touching other sections.
 * Much more reliable than full-markdown revision.
 */
// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const runSectionRevise = action({
  args: {
    draftId: v.id("contentDrafts"),
    sectionId: v.union(
      v.literal("overview"),
      v.literal("vocabulary"),
      v.literal("grammar"),
      v.literal("phrases"),
      v.literal("exercises"),
      v.literal("cultural")
    ),
    instruction: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
    maxTokens: v.optional(v.number()),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    // 1. Load current markdown
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const d = current.draft as any;
    const snapshot = current.snapshot as any;
    if (!snapshot?.markdownSource) {
      throw new Error("Draft has no markdownSource. Run Creator first.");
    }
    const markdown = String(snapshot.markdownSource).trim();

    // 2. Extract target section
    const sectionId = args.sectionId as SectionId;
    const sectionContent = extractSection(markdown, sectionId);
    if (!sectionContent) {
      throw new Error(`Section '${sectionId}' not found in markdown. Cannot revise.`);
    }

    // 3. Build context (e.g., vocabulary for phrases)
    let context = "";
    if (sectionId === "phrases" || sectionId === "exercises") {
      const vocabSection = extractSection(markdown, "vocabulary");
      if (vocabSection) {
        context = `\nCONTEXT (Use this vocabulary):\n${vocabSection}\n`;
      }
    }

    // 4. Build system prompt: base rules (cs_unit_creator) + specialist skills + section-specific prompt
    const basePrompt = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.unitCreator);
    const skillBlock = await buildStageSkillBlock(ctx, d as any, "specialist");
    const sectionPrompt = await resolvePromptFromDb(
      ctx,
      CS_PROMPT_KEYS.section(sectionId),
    );
    // Validator-Memory: inject known pitfalls so the revision doesn't reintroduce them.
    const memoryEntries = await ctx.runQuery(
      internal.contentStudio.getActiveValidatorMemoryForScope,
      { scope: "creator", limit: 60 }
    );
    const memoryBlock = buildValidatorMemoryBlockFromEntries(memoryEntries as any, { limit: 30 });
    const rulesBlock = await languageRulesBlock(ctx);
    const systemPrompt = [basePrompt, rulesBlock, skillBlock, memoryBlock, sectionPrompt]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = [
      `CURRENT CONTENT of '${sectionId}':`,
      sectionContent,
      ``,
      context,
      `INSTRUCTION: ${args.instruction}`,
      ``,
      `REVISED CONTENT (Markdown):`,
    ].join("\n");

    // 5. Call AI with only this section
    // v2 grammar sections (rule, pattern table, examples, watch-out, quick
    // check) run to ~1,500 output tokens; leave headroom for thinking models.
    const maxTokens = args.maxTokens ?? 6000;
    const aiTimer = createAiCallTimer();
    const { provider, model, raw, usage, estimatedCostUsd } = await aiTimer.measure(() =>
      callAiText(ctx, {
        stage: "specialist",
        preferredProvider: (args.preferredProvider as any) || undefined,
        system: systemPrompt,
        user: userPrompt,
        maxTokens,
      })
    );

    let revisedSection = String(raw || "").trim();
    if (!revisedSection) {
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider,
        model,
        inputSummary: `revise section=${sectionId}`,
        outputSummary: `revised chars=0`,
        ...usageForRunLog(usage),
        estimatedCostUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : undefined,
        longestAiCallMs: aiTimer.longestMs(),
        status: "failed",
        error: "AI returned empty content for section revision",
      });
      throw new Error("AI returned empty content. Please try again with a more specific instruction.");
    }

    // 5b. Auto-fix vocabulary duplicates before validation
    if (sectionId === "vocabulary") {
      const { fixed, removedKeys } = deduplicateVocabularySectionMarkdown(revisedSection);
      if (removedKeys.length > 0) {
        revisedSection = fixed;
        console.log(
          `[sectionRevise] Auto-removed ${removedKeys.length} duplicate vocabulary keys: ${removedKeys.join(", ")}`
        );
      }
    }

    // 6. Validate expanded section
    const validation = validateSection(sectionId, revisedSection);
    if (!validation.valid) {
      const details = validation.errors.length ? validation.errors.join("; ") : "Unknown validation error";

      // Log failure for easier debugging in UI
      await ctx.runMutation(api.contentStudio.logAiRun, {
        draftId: args.draftId,
        stage: "specialist",
        provider,
        model,
        inputSummary: `revise section=${sectionId}`,
        outputSummary: `revised chars=${revisedSection.length}`,
        ...usageForRunLog(usage),
        estimatedCostUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : undefined,
        longestAiCallMs: aiTimer.longestMs(),
        status: "failed",
        error: `section validation failed: ${details}`,
      });

      throw new Error(`AI generated invalid section content: ${details}`);
    }

    // 7. Replace section in original markdown
    let newMarkdown = replaceSection(markdown, sectionId, revisedSection);

    // 8. Post-processing (Canonicalize, Translate, Founder Note)
    newMarkdown = canonicalizeDialoguesToUnit1Tables(newMarkdown);
    newMarkdown = await translateUnitMarkdownToEnglishIfNeeded(ctx, newMarkdown, (args.preferredProvider as any) || undefined);
    newMarkdown = await ensureFounderNoteInMarkdownIfConfigured(ctx, d, newMarkdown, (args.preferredProvider as any) || undefined);
    newMarkdown = canonicalizeDialoguesToUnit1Tables(newMarkdown);

    // 9. Validate full markdown structure
    const structure = validateMarkdownStructure(newMarkdown);
    if (!structure.valid) {
      throw new Error(`Revised markdown failed structure validation: ${structure.errors.join("; ")}`);
    }

    // 10. Parse to unitPackage
    const parsedUnitPackage = parseMarkdownToUnitPackage(newMarkdown);
    const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
    if (!baseParsed.success) {
      const first = baseParsed.error.issues?.[0];
      throw new Error(
        `Parsed revised markdown produced invalid unitPackage.v1. First issue: ${first?.path?.join(".") || "(unknown)"}: ${first?.message || "invalid"}`
      );
    }

    // 11. Save new snapshot — attach section + instruction so a later
    // `Adopt into Brief` can copy the CAUSE (this instruction) alongside
    // the EFFECT (the generated markdown) into the curated section entry.
    await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
      draftId: args.draftId,
      unitPackageJson: JSON.stringify(baseParsed.data),
      markdownSource: newMarkdown,
      validationReportJson: JSON.stringify({ ok: false, note: `Revised section '${sectionId}'; run Validator.` }),
      status: "draft",
      replaceFindings: true,
      findings: [],
      sectionRevisionSection: sectionId,
      sectionRevisionInstruction: String(args.instruction ?? "").trim() || undefined,
    });

    await ctx.runMutation(api.contentStudio.logAiRun, {
      draftId: args.draftId,
      stage: "specialist",
      provider,
      model,
      inputSummary: `revise section=${sectionId}`,
      outputSummary: `revised chars=${revisedSection.length}`,
      ...usageForRunLog(usage),
      estimatedCostUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : undefined,
      longestAiCallMs: aiTimer.longestMs(),
      status: "success",
    });

    // Adopt the revision into the Briefing right away (decision 2026-09-16).
    // The instruction the author just gave IS the curation decision; asking
    // for a second click after a preview only lost edits (the alphabet block
    // of Unit 1 would have vanished on the next Creator run). Future Creator
    // runs build on curated sections; "Refuse & revert" removes one again.
    let adoptedIntoBriefing = false;
    try {
      // Explicit annotation breaks the api-type cycle (action -> mutation -> api).
      const adopted: { ok: boolean } = await ctx.runMutation(
        api.contentStudio.adoptSectionsIntoBrief,
        { draftId: args.draftId },
      );
      adoptedIntoBriefing = adopted?.ok === true;
    } catch (e: any) {
      // Not fatal: the revision is saved and stays "pending"; the Rendered tab
      // still offers the manual "Adopt changes into Briefing" button.
      console.warn("Section revise: automatic adoption into the Briefing failed:", e?.message || e);
    }

    // Do NOT nest runQcValidate here: the combined wall-clock of section AI +
    // optional translation/founder-note + full QC often exceeds the client
    // WebSocket lifetime ("Connection lost while action was in flight"), even
    // when the snapshot was already saved. The UI runs Validator as a separate
    // action after this returns.
    return { ok: true, needsValidation: true as const, adoptedIntoBriefing };
  },
});

// @ts-ignore TS7022 TS2589 – Convex schema depth limit (50 tables)
export const addDialogue = action({
  args: {
    draftId: v.id("contentDrafts"),
    topic: v.string(),
    preferredProvider: v.optional(v.union(v.literal("gemini"), v.literal("openai"))),
  },
  // @ts-ignore TS7023 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);

    // 1. Load current markdown
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const snapshot = current.snapshot as any;
    if (!snapshot?.markdownSource) {
      throw new Error("Draft has no markdownSource. Run Creator first.");
    }
    const markdown = String(snapshot.markdownSource).trim();

    // 2. Extract Vocabulary for context
    const vocabSection = extractSection(markdown, "vocabulary") || "";

    // 3. Generate Dialogue
    const basePrompt = await resolvePromptFromDb(ctx, CS_PROMPT_KEYS.addDialogue);
    const rulesBlock = await languageRulesBlock(ctx);
    const skillBlock = await buildStageSkillBlock(ctx, current.draft as any, "specialist");
    const system = [basePrompt, rulesBlock, skillBlock].filter(Boolean).join("\n");

    const user = `Topic: ${args.topic}
    
Vocabulary Context:
${vocabSection}

Generate dialogue table:`;

    const aiTimer = createAiCallTimer();
    const { provider, model, raw, usage, estimatedCostUsd } = await aiTimer.measure(() =>
      callAiText(ctx, {
        stage: "specialist",
        preferredProvider: (args.preferredProvider as any) || undefined,
        system,
        user,
        maxTokens: 1000,
      })
    );

    const newDialogue = String(raw || "").trim();

    // 4. Append to Phrases section
    let newMarkdown = appendDialogue(markdown, newDialogue);

    // 5. Post-process
    newMarkdown = canonicalizeDialoguesToUnit1Tables(newMarkdown);
    newMarkdown = await ensureFounderNoteInMarkdownIfConfigured(ctx, current.draft as any, newMarkdown, (args.preferredProvider as any) || undefined);

    // 6. Validate
    const structure = validateMarkdownStructure(newMarkdown);
    if (!structure.valid) {
      throw new Error(`Revised markdown failed structure validation: ${structure.errors.join("; ")}`);
    }

    // 7. Parse & Save
    const parsedUnitPackage = parseMarkdownToUnitPackage(newMarkdown);
    const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
    if (!baseParsed.success) {
      throw new Error("Parsed markdown invalid.");
    }

    await ctx.runMutation(api.contentStudio.saveUnitPackageSnapshot, {
      draftId: args.draftId,
      unitPackageJson: JSON.stringify(baseParsed.data),
      markdownSource: newMarkdown,
      validationReportJson: JSON.stringify({ ok: false, note: "Added dialogue; run Validator." }),
      status: "draft",
      replaceFindings: true,
      findings: [],
      sectionRevisionSection: "phrases",
      sectionRevisionInstruction: `Add dialogue: ${String(args.topic ?? "").trim()}`.trim() || undefined,
    });

    await ctx.runMutation(api.contentStudio.logAiRun, {
      draftId: args.draftId,
      stage: "specialist",
      provider,
      model,
      inputSummary: `add dialogue topic=${args.topic}`,
      ...usageForRunLog(usage),
      estimatedCostUsd: typeof estimatedCostUsd === "number" ? estimatedCostUsd : undefined,
      longestAiCallMs: aiTimer.longestMs(),
      status: "success",
    });

    // Same as runSectionRevise: do not nest QC in this action (client disconnect risk).
    return { ok: true, needsValidation: true as const };
  },
});
