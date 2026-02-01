import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { requireSuperadminAction, parseJsonOrThrow } from "./_shared";
import { UnitPackageSchema } from "../../scripts/unitPackage/schema";
import { autofixUnitPackage } from "../../scripts/unitPackage/autofix";

export const publishDraftToPreview = action({
  args: {
    draftId: v.id("contentDrafts"),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
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
    const ver = await ctx.runQuery(api.contentImportAdmin.previewReplaceUnit, {
      unitNumber: fixed.unitNumber,
      languages: fixed.languages,
    });
    const targetUnitVersion = Number((ver as any)?.nextUnitVersion ?? 2);

    const result = await ctx.runMutation(api.contentStudio.internalPublishUnitPackageToPreview, {
      unitPackage: fixed as any,
      unitVersion: targetUnitVersion,
      moduleId: args.moduleId,
    });

    return { ok: true, ...result };
  },
});

export const takePreviewOffline = action({
  args: {
    draftId: v.id("contentDrafts"),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
    const current = await ctx.runQuery(api.contentStudio.getDraft, { draftId: args.draftId });
    const unitNumber = current?.draft?.unitNumber;
    if (!unitNumber) throw new Error("Draft has no unit number");

    const res = await ctx.runMutation(api.contentStudio.internalTakeUnitPreviewOffline, {
      unitNumber,
    });
    return { ok: true, ...res };
  },
});

export const publishDraft = action({
  args: {
    draftId: v.id("contentDrafts"),
    mode: v.union(v.literal("update"), v.literal("replace")),
    moduleId: v.optional(v.id("moduleMetadata")),
  },
  handler: async (ctx, args) => {
    await requireSuperadminAction(ctx);
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
    const fileName = `content-studio-unit-${current.draft.unitNumber}.json`;
    const confirm = args.mode === "replace" ? `REPLACE UNIT ${current.draft.unitNumber}` : "IMPORT";
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
