/**
 * Ping-Pong: Brief <-> Markdown (Brief Version History)
 *
 * Lets a human "adopt" a reviewed, rendered section of the current snapshot's
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
 */
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { requireSuperadmin } from "./_shared";
import { extractSection, SECTION_LABELS, type SectionId } from "../../scripts/markdownParser/sectionUtils";
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
 * since each section's last adoption and are therefore "pending adoption".
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

  const adoptedAtBySection = new Map<SectionId, number>();
  for (const c of getCuratedSections(draft)) adoptedAtBySection.set(c.section, c.adoptedAt);

  // Newest section-revise snapshot per section wins (iterating newest-first),
  // and only counts if it is newer than that section's last adoption.
  const pendingBySection = new Map<SectionId, PendingSectionRevision>();
  for (const s of recent) {
    const revised = (s as unknown as { sectionRevisionSection?: SectionId }).sectionRevisionSection;
    const instr = (s as unknown as { sectionRevisionInstruction?: string }).sectionRevisionInstruction;
    if (!revised || typeof instr !== "string" || instr.trim().length === 0) continue;
    if (pendingBySection.has(revised)) continue;
    const lastAdopted = adoptedAtBySection.get(revised) ?? 0;
    if (s.createdAt <= lastAdopted) continue;
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
