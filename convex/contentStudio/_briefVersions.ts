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
import { mutation, query } from "../_generated/server";
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
  sourceSnapshotId: v.id("contentDraftSnapshots"),
  adoptedAt: v.number(),
  adoptedBy: v.id("users"),
});

type CuratedSectionEntry = {
  section: SectionId;
  markdown: string;
  sourceSnapshotId: Id<"contentDraftSnapshots">;
  adoptedAt: number;
  adoptedBy: Id<"users">;
};

function getCuratedSections(draft: Doc<"contentDrafts">): CuratedSectionEntry[] {
  const list = (draft as unknown as { curatedSections?: CuratedSectionEntry[] }).curatedSections;
  return Array.isArray(list) ? list : [];
}

/**
 * Read a section from the draft's current snapshot and store it as the
 * authoritative curated content for that section on the live Brief. Creates
 * a new Brief Version (status-quo pointer moves to it) so the adoption is
 * captured in history immediately.
 */
export const adoptSectionIntoBrief = mutation({
  args: {
    draftId: v.id("contentDrafts"),
    section: sectionIdValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    briefVersionId: v.id("contentDraftBriefVersions"),
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

    const sectionContent = extractSection(String(snapshot.markdownSource), args.section as SectionId);
    if (!sectionContent) {
      throw new Error(
        `Section '${SECTION_LABELS[args.section as SectionId] || args.section}' was not found in the current snapshot's Markdown.`,
      );
    }

    const now = Date.now();
    const nextCurated: CuratedSectionEntry[] = [
      ...getCuratedSections(draft).filter((c) => c.section !== args.section),
      {
        section: args.section as SectionId,
        markdown: sectionContent,
        sourceSnapshotId: draft.lastSnapshotId,
        adoptedAt: now,
        adoptedBy: user._id,
      },
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

    return { ok: true, briefVersionId };
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
