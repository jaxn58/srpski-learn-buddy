/**
 * Ping-Pong: Brief <-> Markdown (Brief Version History)
 *
 * Nomenclature (do not conflate these terms):
 * - Draft (`contentDrafts`) is the FOUNDATION of a unit's work: metadata,
 *   status, and pointers to its Brief and Snapshots. A Draft is never a
 *   Markdown document.
 * - Brief is the editable, human-curated part OF a Draft: free-form notes
 *   (`inspirationRef.notes`) plus adopted section content (`curatedSections`),
 *   versioned in `contentDraftBriefVersions`.
 * - Markdown is an AI-GENERATED ARTIFACT that results from Draft+Brief going
 *   through the Creator or Section-Revise, stored on a Snapshot
 *   (`contentDraftSnapshots.markdownSource`). Markdown is never the Draft and
 *   is never "adopted into itself" — adoption always copies FROM the current
 *   Snapshot's Markdown INTO the Brief.
 *
 * Lets a human "adopt" a reviewed, rendered section of the current Snapshot's
 * Markdown back into the Brief (contentDrafts.curatedSections), so a future
 * full Creator regeneration builds upon it instead of discarding it. Every
 * adoption (and every Creator generation) creates a new, immutable Brief
 * Version row. Selecting an older version moves the "status quo" pointer
 * (contentDrafts.activeBriefVersionId) back to it without deleting history.
 *
 * Deliberately NOT triggered automatically by Section-Revise/manual Markdown
 * edits — the human must review the Preview/Rendered view first and then
 * explicitly adopt a section (see convex/contentStudio/_sectionRevise.ts and
 * client ArtifactsPanel "Rendered" tab for the manipulation/preview side).
 *
 * The counterpart to adoption is `refuseSectionRevision` below: instead of
 * copying the revised section INTO the Brief, it discards the revision by
 * writing the section's PREVIOUS Markdown content back into a new Snapshot.
 * This only ever touches the Markdown artifact — the Brief is never modified
 * by a refusal.
 */
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireSuperadmin } from "./_shared";
import { extractSection, replaceSection, SECTION_LABELS, type SectionId } from "../../scripts/markdownParser/sectionUtils";
import { validateMarkdownStructure, parseMarkdownToUnitPackage } from "../../scripts/markdownParser/parser";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import type { Doc, Id } from "../_generated/dataModel";

const sectionIdValidator = v.union(
  v.literal("overview"),
  v.literal("vocabulary"),
  v.literal("grammar"),
  v.literal("phrases"),
  v.literal("exercises"),
  v.literal("cultural"),
);

const curatedSectionEntryValidator = v.object({
  section: sectionIdValidator,
  markdown: v.string(),
  instruction: v.optional(v.string()),
  sourceSnapshotId: v.id("contentDraftSnapshots"),
  adoptedAt: v.number(),
  adoptedBy: v.id("users"),
});

type CuratedSectionEntry = {
  section: SectionId;
  markdown: string;
  instruction?: string;
  sourceSnapshotId: Id<"contentDraftSnapshots">;
  adoptedAt: number;
  adoptedBy: Id<"users">;
};

function getCuratedSections(draft: Doc<"contentDrafts">): CuratedSectionEntry[] {
  const list = (draft as unknown as { curatedSections?: CuratedSectionEntry[] }).curatedSections;
  return Array.isArray(list) ? list : [];
}

type PendingSectionRevision = {
  section: SectionId;
  instruction: string;
  snapshotId: Id<"contentDraftSnapshots">;
  at: number;
};

/**
 * Determine which sections were revised (via a targeted Section-Revise)
 * since each section was last "resolved" (adopted into the Brief, or
 * refused via refuseSectionRevision) and are therefore "pending adoption".
 * Shared by `listPendingSectionRevisions` (UI highlight) and
 * `adoptSectionsIntoBrief` (bulk adoption) so both agree on exactly what
 * counts as "changed". Bounded scan (200 newest snapshots per draft).
 */
async function computePendingSectionRevisions(
  ctx: QueryCtx,
  draft: Doc<"contentDrafts">,
): Promise<PendingSectionRevision[]> {
  const recent = await ctx.db
    .query("contentDraftSnapshots")
    .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
    .order("desc")
    .take(200);

  // A section counts as "resolved as of T" if it was either adopted into the
  // Brief (curatedSections[].adoptedAt) or refused (sectionRevisionRefused-
  // Section on a later snapshot) — whichever happened more recently. Without
  // folding refusals in here, a refused revision would keep reappearing as
  // pending forever, since the older sectionRevisionSection-tagged snapshot
  // that caused it never disappears from history.
  const resolvedAtBySection = new Map<SectionId, number>();
  for (const c of getCuratedSections(draft)) {
    const prev = resolvedAtBySection.get(c.section) ?? 0;
    if (c.adoptedAt > prev) resolvedAtBySection.set(c.section, c.adoptedAt);
  }
  for (const s of recent) {
    const refused = (s as unknown as { sectionRevisionRefusedSection?: SectionId }).sectionRevisionRefusedSection;
    if (!refused) continue;
    const prev = resolvedAtBySection.get(refused) ?? 0;
    if (s.createdAt > prev) resolvedAtBySection.set(refused, s.createdAt);
  }

  // Newest section-revise snapshot per section wins (iterating newest-first),
  // and only counts if it is newer than that section's last resolution.
  const pendingBySection = new Map<SectionId, PendingSectionRevision>();
  for (const s of recent) {
    const revised = (s as unknown as { sectionRevisionSection?: SectionId }).sectionRevisionSection;
    const instr = (s as unknown as { sectionRevisionInstruction?: string }).sectionRevisionInstruction;
    if (!revised || typeof instr !== "string" || instr.trim().length === 0) continue;
    if (pendingBySection.has(revised)) continue;
    const resolvedAt = resolvedAtBySection.get(revised) ?? 0;
    if (s.createdAt <= resolvedAt) continue;
    pendingBySection.set(revised, {
      section: revised,
      instruction: instr.trim(),
      snapshotId: s._id,
      at: s.createdAt,
    });
  }
  return Array.from(pendingBySection.values());
}

/**
 * Adopt ALL pending section-revisions of a draft into the Brief in a single
 * step, producing ONE new Brief Version that contains every changed section.
 *
 * "Pending" = a section that was targeted by a Section-Revise since its last
 * adoption (see computePendingSectionRevisions). Sections that were not
 * revised are left untouched — there is deliberately no per-section adopt and
 * no way to adopt an unchanged section (a full Creator run touches all
 * sections but sets no `sectionRevisionSection`, so it produces nothing to
 * adopt here).
 *
 * Content is taken from the current snapshot (`lastSnapshotId`, i.e. the
 * validated/postprocessed Markdown), while the instruction (the "cause") is
 * taken from the originating Section-Revise snapshot.
 */
export const adoptSectionsIntoBrief = mutation({
  args: {
    draftId: v.id("contentDrafts"),
  },
  returns: v.object({
    ok: v.boolean(),
    briefVersionId: v.optional(v.id("contentDraftBriefVersions")),
    adoptedSections: v.array(sectionIdValidator),
  }),
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    if (!draft.lastSnapshotId) {
      throw new Error("Draft has no snapshot yet. Run Creator first.");
    }
    const snapshot = await ctx.db.get(draft.lastSnapshotId);
    if (!snapshot?.markdownSource) {
      throw new Error("Current snapshot has no Markdown to adopt from.");
    }

    const pending = await computePendingSectionRevisions(ctx, draft);
    if (pending.length === 0) {
      throw new Error("No revised sections to adopt. Revise a section first, then adopt.");
    }

    const markdown = String(snapshot.markdownSource);
    const now = Date.now();
    const pendingSectionIds = new Set<SectionId>(pending.map((p) => p.section));

    const newEntries: CuratedSectionEntry[] = [];
    for (const p of pending) {
      const content = extractSection(markdown, p.section);
      if (!content) {
        throw new Error(
          `Section '${SECTION_LABELS[p.section] || p.section}' was not found in the current snapshot's Markdown.`,
        );
      }
      newEntries.push({
        section: p.section,
        markdown: content,
        instruction: p.instruction.length > 0 ? p.instruction : undefined,
        sourceSnapshotId: draft.lastSnapshotId,
        adoptedAt: now,
        adoptedBy: user._id,
      });
    }

    const nextCurated: CuratedSectionEntry[] = [
      ...getCuratedSections(draft).filter((c) => !pendingSectionIds.has(c.section)),
      ...newEntries,
    ];

    await ctx.db.patch(args.draftId, {
      curatedSections: nextCurated,
      updatedAt: now,
    } as Partial<Doc<"contentDrafts">>);

    const briefVersionId = await ctx.db.insert("contentDraftBriefVersions", {
      draftId: args.draftId,
      notes: draft.inspirationRef?.notes,
      curatedSections: nextCurated,
      label: undefined,
      parentVersionId: (draft as unknown as { activeBriefVersionId?: Id<"contentDraftBriefVersions"> })
        .activeBriefVersionId,
      createdAt: now,
      createdBy: user._id,
    });

    await ctx.db.patch(args.draftId, { activeBriefVersionId: briefVersionId } as Partial<Doc<"contentDrafts">>);

    return { ok: true, briefVersionId, adoptedSections: pending.map((p) => p.section) };
  },
});

/**
 * Move the "status quo" pointer to an older (or any other) Brief Version:
 * copies its notes + curatedSections back onto the live draft fields. Full
 * history is preserved — nothing is deleted by this operation.
 */
export const selectBriefVersion = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    versionId: v.id("contentDraftBriefVersions"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    const version = await ctx.db.get(args.versionId);
    if (!version || version.draftId !== args.draftId) {
      throw new Error("Brief version not found for this draft.");
    }

    await ctx.db.patch(args.draftId, {
      inspirationRef: { ...(draft.inspirationRef ?? {}), notes: version.notes },
      curatedSections: version.curatedSections,
      activeBriefVersionId: args.versionId,
      updatedAt: Date.now(),
    } as Partial<Doc<"contentDrafts">>);

    return { ok: true };
  },
});

/**
 * Explicitly snapshot the current live Brief state as a new, optionally
 * named (milestone) Brief Version. Used when the human wants to bookmark a
 * state without going through Section-Adopt (e.g. after editing notes).
 */
export const saveBriefVersion = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    label: v.optional(v.string()),
  },
  returns: v.id("contentDraftBriefVersions"),
  handler: async (ctx, args) => {
    const user = await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");

    const now = Date.now();
    const label = args.label?.trim();
    const briefVersionId = await ctx.db.insert("contentDraftBriefVersions", {
      draftId: args.draftId,
      notes: draft.inspirationRef?.notes,
      curatedSections: getCuratedSections(draft),
      label: label || undefined,
      parentVersionId: (draft as unknown as { activeBriefVersionId?: Id<"contentDraftBriefVersions"> })
        .activeBriefVersionId,
      createdAt: now,
      createdBy: user._id,
    });

    await ctx.db.patch(args.draftId, {
      activeBriefVersionId: briefVersionId,
      updatedAt: now,
    } as Partial<Doc<"contentDrafts">>);

    return briefVersionId;
  },
});

/**
 * Delete a single Brief Version row. The active (status-quo) version is
 * protected — the human must first `selectBriefVersion` a different one and
 * then delete the now-inactive row. Deletion is a hard delete because
 * Brief Versions are cheap, self-contained snapshots (notes + curatedSections
 * copied by value) — no cascading rows depend on them.
 */
export const deleteBriefVersion = mutation({
  args: {
    versionId: v.id("contentDraftBriefVersions"),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Brief version not found");
    const draft = await ctx.db.get(version.draftId);
    if (!draft) throw new Error("Draft not found");

    const activeId = (draft as unknown as { activeBriefVersionId?: Id<"contentDraftBriefVersions"> })
      .activeBriefVersionId;
    if (activeId && String(activeId) === String(args.versionId)) {
      throw new Error(
        "Cannot delete the active version. Select another version first, then delete.",
      );
    }

    await ctx.db.delete(args.versionId);
    return { ok: true };
  },
});

/**
 * Rename (or clear) the milestone label of an existing Brief Version.
 * Renaming is possible at any time, independent of the status-quo pointer.
 */
export const nameBriefVersion = mutation({
  args: {
    versionId: v.id("contentDraftBriefVersions"),
    label: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Brief version not found");
    await ctx.db.patch(args.versionId, { label: args.label.trim() || undefined });
    return { ok: true };
  },
});

/**
 * List all section-revisions that were performed since the section's last
 * adoption (or since ever, if never adopted) and are therefore "pending
 * adoption". Used by the Rendered-tab UI to visually highlight the section
 * card the human just worked on and make Adopt-Into-Brief a one-click
 * confirmation rather than a hunt among six identical buttons.
 *
 * Bounded scan (200 most recent snapshots per draft). Section-Revise is a
 * human-triggered event; scanning 200 snapshots covers weeks of work.
 */
export const listPendingSectionRevisions = query({
  args: { draftId: v.id("contentDrafts") },
  returns: v.array(
    v.object({
      section: sectionIdValidator,
      instruction: v.string(),
      snapshotId: v.id("contentDraftSnapshots"),
      at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return [];
    return await computePendingSectionRevisions(ctx, draft);
  },
});

/**
 * Refuse a pending Section-Revise: reverts the section's Markdown to the
 * version it had immediately before that revise, discarding only that one
 * step (never the whole revision history of the section — a second Refuse
 * on a freshly-re-revised section would roll back one more step in the same
 * way). The Brief is never touched by this — refusal only concerns the
 * Markdown artifact on the Draft's Snapshots.
 *
 * "Immediately before" = the newest Snapshot older than the pending
 * Section-Revise Snapshot that still has Markdown. Bounded scan (200 newest
 * snapshots), same bound as `computePendingSectionRevisions` above, which
 * this function's "still pending" check depends on.
 */
export const refuseSectionRevision = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    section: sectionIdValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    snapshotId: v.id("contentDraftSnapshots"),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found");
    if (!draft.lastSnapshotId) {
      throw new Error("Draft has no snapshot yet.");
    }

    const pending = await computePendingSectionRevisions(ctx, draft);
    const target = pending.find((p) => p.section === args.section);
    if (!target) {
      throw new Error(
        `Section '${SECTION_LABELS[args.section] || args.section}' has no pending revision to refuse.`,
      );
    }

    const currentSnapshot = await ctx.db.get(draft.lastSnapshotId);
    if (!currentSnapshot?.markdownSource) {
      throw new Error("Current snapshot has no Markdown to revert.");
    }

    // Same bounded, newest-first scan as computePendingSectionRevisions, so the
    // position of the pending revise's snapshot within it is meaningful.
    const recent = await ctx.db
      .query("contentDraftSnapshots")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .take(200);

    const targetIdx = recent.findIndex((s) => String(s._id) === String(target.snapshotId));
    if (targetIdx === -1) {
      throw new Error("Pending revision snapshot not found in recent history.");
    }

    // The one immediately preceding version: the newest snapshot OLDER than
    // the pending revise that still carries Markdown. Only ever one step back.
    const baseline = recent
      .slice(targetIdx + 1)
      .find((s) => typeof s.markdownSource === "string" && s.markdownSource.trim().length > 0);
    if (!baseline) {
      throw new Error(
        `No earlier version of '${SECTION_LABELS[args.section] || args.section}' exists to revert to.`,
      );
    }

    const baselineSectionContent = extractSection(String(baseline.markdownSource), args.section);
    if (!baselineSectionContent) {
      throw new Error(
        `Section '${SECTION_LABELS[args.section] || args.section}' was not found in the previous version's Markdown.`,
      );
    }

    const currentMarkdown = String(currentSnapshot.markdownSource);
    const revertedMarkdown = replaceSection(currentMarkdown, args.section, baselineSectionContent);

    const structure = validateMarkdownStructure(revertedMarkdown);
    if (!structure.valid) {
      throw new Error(`Reverted markdown failed structure validation: ${structure.errors.join("; ")}`);
    }

    const parsedUnitPackage = parseMarkdownToUnitPackage(revertedMarkdown);
    const baseParsed = UnitPackageSchema.safeParse(parsedUnitPackage);
    if (!baseParsed.success) {
      const first = baseParsed.error.issues?.[0];
      throw new Error(
        `Parsed reverted markdown produced invalid unitPackage.v1. First issue: ${first?.path?.join(".") || "(unknown)"}: ${first?.message || "invalid"}`,
      );
    }

    const now = Date.now();

    // New Snapshot deliberately has NO sectionRevisionSection/Instruction (it
    // must never itself count as a new pending revision), but DOES carry
    // sectionRevisionRefusedSection as an explicit "resolved" marker, so
    // computePendingSectionRevisions stops counting the refused revision as
    // pending — the Rendered-tab banner clears itself for it.
    const snapshotId = await ctx.db.insert("contentDraftSnapshots", {
      draftId: args.draftId,
      unitPackageJson: JSON.stringify(baseParsed.data),
      markdownSource: revertedMarkdown,
      validationReportJson: JSON.stringify({
        ok: false,
        note: `Reverted section '${args.section}' to its previous version; run Validator.`,
      }),
      briefVersionId: (draft as unknown as { activeBriefVersionId?: Id<"contentDraftBriefVersions"> })
        .activeBriefVersionId,
      sectionRevisionRefusedSection: args.section,
      createdAt: now,
    });

    // Content changed (a section was rolled back) — clear findings the same
    // way runSectionRevise does, so stale issues from the now-discarded
    // revision don't linger. Status returns to "draft" pending re-validation.
    const existingFindings = await ctx.db
      .query("contentDraftFindings")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .collect();
    for (const f of existingFindings) await ctx.db.delete(f._id);

    await ctx.db.patch(args.draftId, {
      lastSnapshotId: snapshotId,
      status: "draft",
      updatedAt: now,
    } as Partial<Doc<"contentDrafts">>);

    return { ok: true, snapshotId };
  },
});

/**
 * List Brief Versions for a draft (newest first) for the selection/diff/
 * milestone-naming UI. Bounded like listDraftSnapshots — Brief Versions are
 * created at most once per adoption/generation, never per user action at
 * scale.
 */
export const listBriefVersions = query({
  args: {
    draftId: v.id("contentDrafts"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("contentDraftBriefVersions"),
      _creationTime: v.number(),
      draftId: v.id("contentDrafts"),
      notes: v.optional(v.string()),
      curatedSections: v.optional(v.array(curatedSectionEntryValidator)),
      label: v.optional(v.string()),
      parentVersionId: v.optional(v.id("contentDraftBriefVersions")),
      createdAt: v.number(),
      createdBy: v.id("users"),
    }),
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const lim = typeof args.limit === "number" ? Math.max(1, Math.min(200, Math.floor(args.limit))) : 100;
    return await ctx.db
      .query("contentDraftBriefVersions")
      .withIndex("by_draft", (q) => q.eq("draftId", args.draftId))
      .order("desc")
      .take(lim);
  },
});
