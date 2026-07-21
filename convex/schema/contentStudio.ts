/**
 * Content Studio Tables
 *
 * AI-powered content creation pipeline: configuration, skills (prompts),
 * reference materials, draft templates, drafts with snapshots,
 * AI run logs, findings, human reviews, and import audit logs.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

// Canonical section identifiers, mirrored from
// scripts/markdownParser/sectionUtils.ts (SectionId). Kept in sync manually
// since Convex validators cannot import a TS type-derived union at runtime.
// "phrases" already covers dialogues (see sectionUtils.ts SECTIONS map).
const curatedSectionIdValidator = v.union(
  v.literal("overview"),
  v.literal("vocabulary"),
  v.literal("grammar"),
  v.literal("phrases"),
  v.literal("exercises"),
  v.literal("cultural"),
);

// A single human-curated section: the reviewed, approved Markdown for one
// section of the unit, adopted from a specific snapshot into the Brief so a
// future full Creator regeneration builds upon it instead of discarding it.
//
// `instruction` captures the ORIGIN of this section: the human's revise-
// instruction (from the Section Editor) that led to this Markdown. This is
// the "cause" the human cares about in the Brief; the `markdown` is the
// "effect". Adoption copies both. May be absent for adoptions from snapshots
// that were not produced by runSectionRevise/addDialogue (e.g. adopting a
// section straight from a Creator full-run snapshot).
const curatedSectionEntryValidator = v.object({
  section: curatedSectionIdValidator,
  markdown: v.string(),
  instruction: v.optional(v.string()),
  sourceSnapshotId: v.id("contentDraftSnapshots"),
  adoptedAt: v.number(),
  adoptedBy: v.id("users"),
});

export const contentStudioTables = {
  // ============= CONTENT STUDIO (Draft Layer, All-AI Pipeline) =============
  // Drafts are NOT live content. They are validated and then published via the existing import pipeline.
  // Book/PDF is inspiration only: we store references/notes, but never copy book content.
  contentStudioConfig: defineTable({
    specialist: v.object({
      provider: v.union(v.literal("gemini"), v.literal("openai")),
      model: v.string(),
    }),
    qcFixOnly: v.object({
      provider: v.union(v.literal("gemini"), v.literal("openai")),
      model: v.string(),
    }),
    auditor: v.object({
      provider: v.union(v.literal("gemini"), v.literal("openai")),
      model: v.string(),
    }),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_updated_at", ["updatedAt"]),

  contentStudioSkills: defineTable({
    // New intended usage: stage/role skills (primarily Specialist).
    // Keep backward compatibility: some docs may still be "section" scoped.
    scope: v.union(v.literal("stage"), v.literal("section")),
    stage: v.optional(v.union(
      v.literal("specialist"),
      v.literal("qc_fix_only"),
      v.literal("auditor"),
      // EN→DE translator stage (admin-managed skills injected into translation prompts)
      v.literal("translator")
    )),
    section: v.optional(v.union(
      v.literal("overview"),
      v.literal("vocabulary"),
      v.literal("grammar"),
      v.literal("phrases"),
      v.literal("dialogues"),
      v.literal("exercises"),
      v.literal("cultural")
    )),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(), // system prompt snippet
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_stage_active", ["stage", "isActive"])
    .index("by_section_active", ["section", "isActive"]),

  contentStudioReferences: defineTable({
    type: v.union(v.literal("pdf"), v.literal("book"), v.literal("article"), v.literal("other")),
    title: v.string(),
    // Either external url OR uploaded PDF in Convex Storage (storageId)
    url: v.optional(v.string()),
    storageId: v.optional(v.string()), // Convex Storage ID (preferred for PDFs)
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    // Multi-PDF support (optional). If present, treat these as the canonical list of PDF attachments.
    // Backward compatibility: older references may still only use storageId/fileName.
    pdfFiles: v.optional(
      v.array(
        v.object({
          storageId: v.string(),
          fileName: v.optional(v.string()),
          mimeType: v.optional(v.string()),
          sizeBytes: v.optional(v.number()),
          uploadedAt: v.number(),
        })
      )
    ),
    notes: v.optional(v.string()), // high-level summary / what to learn structurally (no copied text)
    // AI-generated guidance distilled from the reference (no quotes, no copied text).
    // Used as inspiration for unit structure and question-writing.
    guidelines: v.optional(v.string()),
    guidelinesUpdatedAt: v.optional(v.number()),
    guidelinesProvider: v.optional(v.string()),
    guidelinesModel: v.optional(v.string()),
    tags: v.array(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_created_at", ["createdAt"]),

  contentStudioReferenceGuidelineVersions: defineTable({
    referenceId: v.id("contentStudioReferences"),
    version: v.number(), // monotonically increasing per reference
    guidelines: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    isManual: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_reference", ["referenceId"])
    .index("by_reference_version", ["referenceId", "version"]),

  contentDraftTemplates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    // Template configuration for new drafts
    inspirationRef: v.optional(
      v.object({
        source: v.optional(v.string()), // e.g. "template"
        chapter: v.optional(v.string()),
        pages: v.optional(v.string()),
        notes: v.optional(v.string()), // creator brief / unit prompt (no copied content)
        // Reference-specific note (e.g. "this PDF covers the language exam") that
        // individualizes content creation. Kept separate from `notes` (the
        // creator brief) so the two never overwrite each other.
        referenceNotes: v.optional(v.string()),
        referenceId: v.optional(v.id("contentStudioReferences")),
      })
    ),
    specialistSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    auditorSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_created_at", ["createdAt"]),

  contentDrafts: defineTable({
    unitNumber: v.number(),
    moduleNumber: v.number(),
    title: v.string(),
    description: v.optional(v.string()),

    // Draft workflow state (hard gates)
    status: v.union(
      v.literal("draft"),
      v.literal("qc_failed"),
      v.literal("qc_passed"),
      v.literal("audit_failed"),
      v.literal("ready_to_publish"),
      v.literal("published")
    ),

    // Inspiration reference only (no book text)
    inspirationRef: v.optional(
      v.object({
        source: v.optional(v.string()), // e.g. "StepByStepSerbian"
        chapter: v.optional(v.string()),
        pages: v.optional(v.string()), // freeform like "12-15"
        notes: v.optional(v.string()), // creator brief / unit prompt (no copied content)
        // Reference-specific note (e.g. "this PDF covers the language exam") that
        // individualizes content creation. Kept separate from `notes` (the
        // creator brief) so the two never overwrite each other.
        referenceNotes: v.optional(v.string()),
        referenceId: v.optional(v.id("contentStudioReferences")),
      })
    ),

    // Section-based AI skills (prompt snippets applied during authoring)
    sectionSkillIds: v.optional(
      v.object({
        overview: v.optional(v.id("contentStudioSkills")),
        grammar: v.optional(v.id("contentStudioSkills")),
        phrases: v.optional(v.id("contentStudioSkills")),
        dialogues: v.optional(v.id("contentStudioSkills")),
        exercises: v.optional(v.id("contentStudioSkills")),
      })
    ),

    // Stage skills (preferred): influences the Specialist (content creator) directly
    specialistSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    // Stage skills for the other two AI roles
    qcFixOnlySkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
    auditorSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),

    // Validator Memory auto-capture: snapshot of the findings that were open
    // right before a Fix-Findings run cleared them (status="draft"). The
    // subsequent Validator/Auditor re-run reads this to do the before/after
    // comparison, since the live findings table is already empty by then.
    // Consumed (reset to undefined) once the comparison has run.
    preFindingFingerprints: v.optional(
      v.array(
        v.object({
          fingerprint: v.string(),
          stage: v.union(v.literal("validator"), v.literal("auditor")),
          code: v.string(),
          path: v.optional(v.string()),
          message: v.string(),
        })
      )
    ),

    // Bookkeeping
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSnapshotId: v.optional(v.id("contentDraftSnapshots")),

    // Human approval after preview (stores a fixed, approved markdown snapshot)
    approvedSnapshotId: v.optional(v.id("contentDraftSnapshots")),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),

    // ── Ping-Pong: Brief <-> Markdown (Brief Version Loop) ──────────────────
    // Human-curated, per-section Markdown adopted from a reviewed snapshot
    // back into the Brief (live/working copy). Replaced per section (not
    // appended) so the Brief stays lean and always reflects the latest
    // adopted state. NOT written automatically on section manipulation —
    // only via the explicit "adopt into Brief" action from Preview/Rendered
    // view, after the human has reviewed the rendered result.
    curatedSections: v.optional(v.array(curatedSectionEntryValidator)),
    // Status-quo pointer: which contentDraftBriefVersions row the live
    // inspirationRef.notes + curatedSections currently correspond to.
    // Selecting an older version moves this pointer (nothing is lost — full
    // history remains in contentDraftBriefVersions).
    activeBriefVersionId: v.optional(v.id("contentDraftBriefVersions")),

    // Public unit author note (optional; intended to be inserted into Markdown)
    authorNoteName: v.optional(v.string()),
    authorNoteQuote: v.optional(v.string()),

    // Publish-Timeout-Fix: explicit state of the last preview-creation run so
    // admins can see progress and failures in the Content Studio UI without
    // digging through logs. Written by the split preview-creation mutations
    // (internalCreatePreviewUnit*) via internalUpdateDraftPreviewCreationState.
    // Field name kept as `publishState` for backward compatibility (no schema
    // migration); conceptually this is the draft's "preview creation" state,
    // NOT a production publish. Optional/backwards compatible: absent on
    // drafts that never ran preview creation.
    publishState: v.optional(
      v.object({
        status: v.union(
          v.literal("running"),
          v.literal("success"),
          v.literal("failed"),
        ),
        stage: v.union(
          v.literal("metadata"),
          v.literal("content"),
          v.literal("vocabulary"),
          v.literal("tests"),
          v.literal("complete"),
        ),
        batchIndex: v.optional(v.number()),
        totalBatches: v.optional(v.number()),
        startedAt: v.number(),
        updatedAt: v.number(),
        completedAt: v.optional(v.number()),
        error: v.optional(v.string()),
      }),
    ),
  })
    .index("by_unit", ["unitNumber"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updatedAt"])
    .index("by_created_by", ["createdBy"]),

  contentDraftSnapshots: defineTable({
    draftId: v.id("contentDrafts"),
    unitPackageJson: v.string(), // canonical draft artifact (unitPackage.v1 JSON string)
    markdownSource: v.optional(v.string()), // optional: if draft was generated from markdown
    validationReportJson: v.string(), // JSON string: deep/template validation output
    // Which Brief Version (input) this snapshot (output) was generated from.
    // Absent for snapshots created before this field existed. Lets the UI show
    // "generated from Brief Version N" for full input->output traceability.
    briefVersionId: v.optional(v.id("contentDraftBriefVersions")),
    // If this snapshot was produced by a single-section revise (runSection-
    // Revise or addDialogue), captures which section was revised and the
    // human instruction that caused it. Read by adoptSectionsIntoBrief so
    // the Brief carries the CAUSE, not just the EFFECT. Absent for full
    // Creator runs, fix-findings snapshots, and legacy rows.
    sectionRevisionSection: v.optional(curatedSectionIdValidator),
    sectionRevisionInstruction: v.optional(v.string()),
    // Explicit "resolved" marker written by refuseSectionRevision on the new
    // (reverted) snapshot it creates. Unlike sectionRevisionSection above,
    // this never itself counts as a new pending revision — it only tells
    // computePendingSectionRevisions (convex/contentStudio/_briefVersions.ts)
    // "this section's pending revision was refused as of this snapshot's
    // createdAt", exactly mirroring how curatedSections[].adoptedAt tells it
    // "this section was adopted as of this timestamp". Without this marker,
    // a refused revision keeps reappearing as pending forever, because the
    // older sectionRevisionSection-tagged snapshot that caused it never
    // disappears from history.
    sectionRevisionRefusedSection: v.optional(curatedSectionIdValidator),
    createdAt: v.number(),
  })
    .index("by_draft", ["draftId"])
    .index("by_created_at", ["createdAt"]),

  // ── Ping-Pong: Brief Version History ──────────────────────────────────────
  // Each row is a full, self-contained snapshot of the Brief's editable state
  // (inspirationRef.notes + curatedSections) at one point in time. Created
  // automatically when a Section is adopted into the Brief, and whenever the
  // Creator generates from the Brief. Can be manually named as a milestone.
  // Selecting an older version moves contentDrafts.activeBriefVersionId to
  // it (and copies its notes/curatedSections back onto the live draft) — it
  // becomes the new status quo. History is never deleted by selection.
  contentDraftBriefVersions: defineTable({
    draftId: v.id("contentDrafts"),
    notes: v.optional(v.string()), // copy of inspirationRef.notes at save time
    curatedSections: v.optional(v.array(curatedSectionEntryValidator)),
    label: v.optional(v.string()), // named milestone, e.g. "v1 approved"
    parentVersionId: v.optional(v.id("contentDraftBriefVersions")),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_draft", ["draftId"])
    .index("by_created_at", ["createdAt"]),

  contentDraftAiRuns: defineTable({
    draftId: v.id("contentDrafts"),
    stage: v.union(
      v.literal("specialist"),
      v.literal("qc_fix_only"),
      v.literal("auditor")
    ),
    provider: v.optional(v.string()), // "gemini" | "openai" | custom
    model: v.string(),
    promptHash: v.optional(v.string()),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    status: v.union(v.literal("success"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_draft", ["draftId"])
    .index("by_stage", ["stage"])
    .index("by_created_at", ["createdAt"]),

  contentDraftFindings: defineTable({
    draftId: v.id("contentDrafts"),
    stage: v.union(v.literal("validator"), v.literal("auditor")),
    severity: v.union(v.literal("error"), v.literal("warning"), v.literal("info")),
    code: v.string(),
    message: v.string(),
    path: v.optional(v.string()), // dot-joined path (keeps schema simple)
    detailsJson: v.optional(v.string()),
    dismissed: v.optional(v.boolean()), // user-acknowledged: excluded from Fix prompt and status counts
    // How many consecutive validator runs this exact finding (by fingerprint stage|code|path)
    // has survived across replaceFindings cycles. 0 = first time seen after last clean run,
    // >=2 = persists after at least one Fix-Findings attempt (likely not AI-fixable).
    persistCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_draft", ["draftId"])
    .index("by_draft_severity", ["draftId", "severity"])
    .index("by_created_at", ["createdAt"]),

  contentDraftHumanReviews: defineTable({
    draftId: v.id("contentDrafts"),
    snapshotId: v.id("contentDraftSnapshots"),
    notes: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_draft", ["draftId"])
    .index("by_snapshot", ["snapshotId"])
    .index("by_created_at", ["createdAt"]),

  // ============= VALIDATOR MEMORY (Content Studio Brain) =============
  // Persistent "memory" of previously-fixed validator/auditor findings.
  // Auto-captured when a finding disappears after a Fix-Findings cycle,
  // manually curated by admins, and injected back into three stages:
  //   - Creator (prevention: "Known pitfalls to avoid")
  //   - Fix-Findings AI (reparation: "Correction recipes from past fixes")
  //   - Validator (regression: soft warning when a known pattern re-appears)
  contentStudioValidatorMemory: defineTable({
    // Stable key: stage|code|path (lowercased path). Used for upsert and de-duplication.
    fingerprint: v.string(),
    // Identification
    stage: v.union(v.literal("validator"), v.literal("auditor")),
    code: v.string(),
    path: v.optional(v.string()),
    // Human-friendly summary + guidance that is injected into prompts
    title: v.string(),
    guidance: v.string(),
    // Optional concrete before/after examples (short strings)
    exampleBefore: v.optional(v.string()),
    exampleAfter: v.optional(v.string()),
    // Optional regex for the validator regression check (applied to relevant fields)
    pattern: v.optional(v.string()),
    patternFlags: v.optional(v.string()),
    // Where the entry is applied. Default on auto-capture: creator=true, fix=true, validator=false, translator=false.
    // applyInTranslator is optional for backward compatibility (missing ⇒ false).
    scope: v.object({
      applyInCreator: v.boolean(),
      applyInFix: v.boolean(),
      applyInValidator: v.boolean(),
      applyInTranslator: v.optional(v.boolean()),
    }),
    // Lifecycle: candidate (auto-captured, not yet curated), active (in use), archived (hidden).
    status: v.union(
      v.literal("candidate"),
      v.literal("active"),
      v.literal("archived")
    ),
    // Source metadata (where the entry was first captured from)
    sourceDraftId: v.optional(v.id("contentDrafts")),
    sourceUnitNumber: v.optional(v.number()),
    // Bookkeeping
    occurrenceCount: v.number(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_status", ["status"])
    .index("by_last_seen_at", ["lastSeenAt"]),

  // ============= CONTENT IMPORT RUNS (Admin Audit Log) =============
  // Stores validation/import runs from the admin content import tool.
  // Keep the report as a JSON string to stay forwards-compatible with report schema changes.
  contentImportRuns: defineTable({
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
  })
    .index("by_started_at", ["startedAt"])
    .index("by_created_by", ["createdBy"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // Admin-managed EN/DE identical prompt cognates for translator quality guard + verifier.
  // Complements code defaults in _translatorCognates.ts (e.g. "orange", "mango").
  contentStudioTranslatorCognates: defineTable({
    term: v.string(), // lowercased
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_term", ["term"]),

  // ============= UNIT DELETION RUNS (Danger Zone: async batched cascade) =============
  // deleteUnitFull can touch thousands of rows (metadata/content/tests/vocabulary and
  // all users' progress for the unit), far beyond Convex's per-execution read limit.
  // Deletion therefore runs as a scheduler-driven batch job (see processUnitDeletionBatch
  // in contentStudio/_mutations.ts). This table tracks live status so the admin UI can
  // show progress and survive a page reload while the job is still running.
  unitDeletionRuns: defineTable({
    unitNumber: v.number(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    // Which cascade step is currently being processed (order fixed in _mutations.ts).
    phase: v.union(
      v.literal("unitMetadata"),
      v.literal("unitContent"),
      v.literal("unitInteractiveTests"),
      v.literal("courseVocabulary"),
      v.literal("unitContentAudio"),
      v.literal("exerciseQuestionProgress"),
      v.literal("questionProgress"),
      v.literal("exerciseResults"),
      v.literal("exerciseCompletions"),
      v.literal("quizProgress"),
      v.literal("userProgress"),
      v.literal("done"),
    ),
    counts: v.object({
      unitMetadata: v.number(),
      unitContent: v.number(),
      unitInteractiveTests: v.number(),
      courseVocabulary: v.number(),
      vocabularyProgress: v.number(),
      unitContentAudio: v.number(),
      exerciseQuestionProgress: v.number(),
      questionProgress: v.number(),
      exerciseResults: v.number(),
      exerciseCompletions: v.number(),
      quizProgress: v.number(),
      userProgressPatched: v.number(),
      userProgressScanned: v.number(),
    }),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    startedBy: v.id("users"),
  })
    .index("by_unit", ["unitNumber"])
    .index("by_started_at", ["startedAt"]),
};
