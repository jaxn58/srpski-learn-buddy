/**
 * Curriculum plan (planned units + Can-Do statements).
 *
 * Read side is used by the Content Studio Brief Assistant to prefill unit
 * briefs from the course plan. Write side is an admin-secret import used by
 * scripts/curriculum/import-curriculum.ts (source: docs/curriculum/*.md).
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminSecret } from "./authz";
import { requireSuperadmin } from "./contentStudio/_shared";
import {
  curriculumCefrLevelValidator,
  curriculumSettingValidator,
  curriculumStrandValidator,
  curriculumUnitTypeValidator,
} from "./schema/curriculum";

const unitInputValidator = v.object({
  unitNumber: v.number(),
  moduleNumber: v.number(),
  unitType: curriculumUnitTypeValidator,
  cefrLevel: curriculumCefrLevelValidator,
  strand: v.optional(curriculumStrandValidator),
  setting: curriculumSettingValidator,
  titleEn: v.string(),
  situationEn: v.string(),
  primaryGrammarEn: v.string(),
  recycleEn: v.optional(v.string()),
  chunksEn: v.optional(v.string()),
  canDoIds: v.array(v.string()),
});

const canDoInputValidator = v.object({
  canDoId: v.string(),
  cefrLevel: curriculumCefrLevelValidator,
  strand: curriculumStrandValidator,
  statementEn: v.string(),
  targetUnits: v.array(v.number()),
  targetNote: v.optional(v.string()),
});

/**
 * Idempotent upsert of the whole plan. Rows not present in the payload are
 * deactivated (never deleted), so a re-import after editing the markdown keeps
 * history and does not break drafts that reference a unit number.
 */
export const adminImportCurriculum = mutation({
  args: {
    adminSecret: v.string(),
    source: v.string(),
    units: v.array(unitInputValidator),
    canDos: v.array(canDoInputValidator),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    unitsInserted: v.number(),
    unitsUpdated: v.number(),
    unitsDeactivated: v.number(),
    canDosInserted: v.number(),
    canDosUpdated: v.number(),
    canDosDeactivated: v.number(),
    dryRun: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertAdminSecret(args.adminSecret);
    const now = Date.now();
    const dryRun = args.dryRun === true;
    const result = {
      unitsInserted: 0,
      unitsUpdated: 0,
      unitsDeactivated: 0,
      canDosInserted: 0,
      canDosUpdated: 0,
      canDosDeactivated: 0,
      dryRun,
    };

    // Units
    const existingUnits = await ctx.db.query("curriculumUnits").collect();
    const unitByNumber = new Map(existingUnits.map((u) => [u.unitNumber, u]));
    const seenUnits = new Set<number>();
    for (const u of args.units) {
      seenUnits.add(u.unitNumber);
      const prev = unitByNumber.get(u.unitNumber);
      if (prev) {
        if (!dryRun) {
          await ctx.db.patch(prev._id, { ...u, isActive: true, source: args.source, updatedAt: now });
        }
        result.unitsUpdated += 1;
      } else {
        if (!dryRun) {
          await ctx.db.insert("curriculumUnits", { ...u, isActive: true, source: args.source, createdAt: now, updatedAt: now });
        }
        result.unitsInserted += 1;
      }
    }
    for (const prev of existingUnits) {
      if (!seenUnits.has(prev.unitNumber) && prev.isActive) {
        if (!dryRun) await ctx.db.patch(prev._id, { isActive: false, updatedAt: now });
        result.unitsDeactivated += 1;
      }
    }

    // Can-Do statements
    const existingCanDos = await ctx.db.query("curriculumCanDo").collect();
    const canDoById = new Map(existingCanDos.map((c) => [c.canDoId, c]));
    const seenCanDos = new Set<string>();
    for (const c of args.canDos) {
      seenCanDos.add(c.canDoId);
      const prev = canDoById.get(c.canDoId);
      if (prev) {
        if (!dryRun) {
          await ctx.db.patch(prev._id, { ...c, isActive: true, source: args.source, updatedAt: now });
        }
        result.canDosUpdated += 1;
      } else {
        if (!dryRun) {
          await ctx.db.insert("curriculumCanDo", { ...c, isActive: true, source: args.source, createdAt: now, updatedAt: now });
        }
        result.canDosInserted += 1;
      }
    }
    for (const prev of existingCanDos) {
      if (!seenCanDos.has(prev.canDoId) && prev.isActive) {
        if (!dryRun) await ctx.db.patch(prev._id, { isActive: false, updatedAt: now });
        result.canDosDeactivated += 1;
      }
    }

    return result;
  },
});

const canDoOutValidator = v.object({
  canDoId: v.string(),
  cefrLevel: curriculumCefrLevelValidator,
  strand: curriculumStrandValidator,
  statementEn: v.string(),
  targetUnits: v.array(v.number()),
  targetNote: v.optional(v.string()),
});

const unitOutValidator = v.object({
  unitNumber: v.number(),
  moduleNumber: v.number(),
  unitType: curriculumUnitTypeValidator,
  cefrLevel: curriculumCefrLevelValidator,
  strand: v.optional(curriculumStrandValidator),
  setting: curriculumSettingValidator,
  titleEn: v.string(),
  situationEn: v.string(),
  primaryGrammarEn: v.string(),
  recycleEn: v.optional(v.string()),
  chunksEn: v.optional(v.string()),
  canDoIds: v.array(v.string()),
});

/**
 * Everything the Brief Assistant needs for one unit: the planned row, the
 * resolved Can-Do statements, and a compact list of earlier units (for
 * recycling and "out of scope" reasoning). Returns null when the unit is not
 * in the plan (e.g. a language school without a curriculum import).
 */
export const getUnitPlan = query({
  args: { unitNumber: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      unit: unitOutValidator,
      canDos: v.array(canDoOutValidator),
      previousUnits: v.array(
        v.object({
          unitNumber: v.number(),
          titleEn: v.string(),
          primaryGrammarEn: v.string(),
          unitType: curriculumUnitTypeValidator,
        }),
      ),
      nextUnits: v.array(
        v.object({
          unitNumber: v.number(),
          titleEn: v.string(),
          primaryGrammarEn: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);
    const unit = await ctx.db
      .query("curriculumUnits")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .unique();
    if (!unit || !unit.isActive) return null;

    const canDos = [];
    for (const id of unit.canDoIds) {
      const row = await ctx.db
        .query("curriculumCanDo")
        .withIndex("by_can_do_id", (q) => q.eq("canDoId", id))
        .unique();
      if (row && row.isActive) {
        canDos.push({
          canDoId: row.canDoId,
          cefrLevel: row.cefrLevel,
          strand: row.strand,
          statementEn: row.statementEn,
          targetUnits: row.targetUnits,
          targetNote: row.targetNote,
        });
      }
    }

    const all = await ctx.db
      .query("curriculumUnits")
      .withIndex("by_active_unit", (q) => q.eq("isActive", true))
      .collect();
    const previousUnits = all
      .filter((u) => u.unitNumber < args.unitNumber)
      .sort((a, b) => a.unitNumber - b.unitNumber)
      .map((u) => ({ unitNumber: u.unitNumber, titleEn: u.titleEn, primaryGrammarEn: u.primaryGrammarEn, unitType: u.unitType }));
    const nextUnits = all
      .filter((u) => u.unitNumber > args.unitNumber)
      .sort((a, b) => a.unitNumber - b.unitNumber)
      .slice(0, 3)
      .map((u) => ({ unitNumber: u.unitNumber, titleEn: u.titleEn, primaryGrammarEn: u.primaryGrammarEn }));

    return {
      unit: {
        unitNumber: unit.unitNumber,
        moduleNumber: unit.moduleNumber,
        unitType: unit.unitType,
        cefrLevel: unit.cefrLevel,
        strand: unit.strand,
        setting: unit.setting,
        titleEn: unit.titleEn,
        situationEn: unit.situationEn,
        primaryGrammarEn: unit.primaryGrammarEn,
        recycleEn: unit.recycleEn,
        chunksEn: unit.chunksEn,
        canDoIds: unit.canDoIds,
      },
      canDos,
      previousUnits,
      nextUnits,
    };
  },
});

// ---------------------------------------------------------------------------
// Course context for a new unit (decision 2026-09-16)
//
// The AI decides the grammar of a unit itself. What it needs to do that well:
//   - the CEFR level of the phase (taken from the module; inferred from the
//     module's position when not set),
//   - what earlier units already taught (so it recycles instead of repeating,
//     and progresses instead of jumping),
//   - optionally the planned grammar from the curriculum map as a hint.
// Nothing here fixes the content of the unit; topic, places and scenes are the
// author's.
// ---------------------------------------------------------------------------

const CEFR_LADDER = ["A1.1", "A1.2", "A2.1", "A2.2", "B1"] as const;
type CefrLevel = (typeof CEFR_LADDER)[number];

const taughtUnitValidator = v.object({
  unitNumber: v.number(),
  title: v.string(),
  grammar: v.string(),
  /** Where the grammar description came from: the unit's briefing, the published metadata, or the plan. */
  source: v.union(v.literal("briefing"), v.literal("published"), v.literal("plan")),
});

/** Reads the "Grammar Target - In Scope:" paragraph out of a briefing text (template format). */
function grammarFromBriefing(text: string | undefined): string | null {
  if (!text) return null;
  const m = text.match(/Grammar Target - In Scope:\s*([\s\S]*?)(?:\n\s*\n|\n[A-Z][^\n:]{2,60}:|$)/);
  const val = m?.[1]?.replace(/\s+/g, " ").trim();
  return val && val.length > 3 ? val.slice(0, 400) : null;
}

export const getUnitContext = query({
  args: { unitNumber: v.number(), moduleNumber: v.number() },
  returns: v.object({
    cefrLevel: curriculumCefrLevelValidator,
    levelSource: v.union(v.literal("module"), v.literal("plan"), v.literal("position")),
    moduleTitleEn: v.optional(v.string()),
    previouslyTaught: v.array(taughtUnitValidator),
    plannedHint: v.union(
      v.null(),
      v.object({
        primaryGrammarEn: v.string(),
        unitType: curriculumUnitTypeValidator,
        canDoStatements: v.array(v.string()),
      }),
    ),
    nextPlannedHints: v.array(v.object({ unitNumber: v.number(), primaryGrammarEn: v.string() })),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    // 1. Level of the phase: module setting, else plan, else position.
    const modules = (await ctx.db.query("moduleMetadata").collect())
      .filter((m) => typeof m.moduleNumber === "number")
      .sort((a, b) => (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0));
    const moduleRow = modules.find((m) => m.moduleNumber === args.moduleNumber);

    const planRows = await ctx.db
      .query("curriculumUnits")
      .withIndex("by_active_unit", (q) => q.eq("isActive", true))
      .collect();
    const planForUnit = planRows.find((u) => u.unitNumber === args.unitNumber) ?? null;
    const planLevelsInModule = planRows.filter((u) => u.moduleNumber === args.moduleNumber).map((u) => u.cefrLevel);

    let cefrLevel: CefrLevel;
    let levelSource: "module" | "plan" | "position";
    if (moduleRow?.cefrLevel) {
      cefrLevel = moduleRow.cefrLevel as CefrLevel;
      levelSource = "module";
    } else if (planLevelsInModule.length > 0) {
      const counts = new Map<string, number>();
      for (const l of planLevelsInModule) counts.set(l, (counts.get(l) ?? 0) + 1);
      cefrLevel = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] as CefrLevel;
      levelSource = "plan";
    } else {
      const idx = Math.max(0, modules.findIndex((m) => m.moduleNumber === args.moduleNumber));
      cefrLevel = CEFR_LADDER[Math.min(idx, CEFR_LADDER.length - 1)];
      levelSource = "position";
    }

    // 2. What earlier units already taught. Newest briefing per unit wins,
    //    then published metadata, then the plan.
    const taught = new Map<number, { unitNumber: number; title: string; grammar: string; source: "briefing" | "published" | "plan" }>();

    const drafts = await ctx.db.query("contentDrafts").withIndex("by_unit").collect();
    const newestByUnit = new Map<number, (typeof drafts)[number]>();
    for (const d of drafts) {
      if (d.unitNumber >= args.unitNumber) continue;
      const prev = newestByUnit.get(d.unitNumber);
      if (!prev || (d.updatedAt ?? 0) > (prev.updatedAt ?? 0)) newestByUnit.set(d.unitNumber, d);
    }
    for (const [n, d] of newestByUnit) {
      const g = grammarFromBriefing((d as any).inspirationRef?.notes);
      if (g) taught.set(n, { unitNumber: n, title: d.title ?? `Unit ${n}`, grammar: g, source: "briefing" });
    }

    const published = await ctx.db
      .query("unitMetadata")
      .filter((q) => q.eq(q.field("language"), "en"))
      .collect();
    for (const u of published) {
      if (u.unitNumber >= args.unitNumber || taught.has(u.unitNumber)) continue;
      const g = (u.grammarFocus ?? []).filter(Boolean).join("; ").trim();
      if (g) taught.set(u.unitNumber, { unitNumber: u.unitNumber, title: u.title, grammar: g.slice(0, 400), source: "published" });
    }

    for (const p of planRows) {
      if (p.unitNumber >= args.unitNumber || taught.has(p.unitNumber)) continue;
      taught.set(p.unitNumber, { unitNumber: p.unitNumber, title: p.titleEn, grammar: p.primaryGrammarEn, source: "plan" });
    }

    const previouslyTaught = [...taught.values()].sort((a, b) => a.unitNumber - b.unitNumber);

    // 3. Non-binding hints from the curriculum map.
    let plannedHint: { primaryGrammarEn: string; unitType: typeof planRows[number]["unitType"]; canDoStatements: string[] } | null = null;
    if (planForUnit) {
      const statements: string[] = [];
      for (const id of planForUnit.canDoIds) {
        const row = await ctx.db
          .query("curriculumCanDo")
          .withIndex("by_can_do_id", (q) => q.eq("canDoId", id))
          .unique();
        if (row?.isActive) statements.push(`${row.canDoId}: ${row.statementEn}`);
      }
      plannedHint = { primaryGrammarEn: planForUnit.primaryGrammarEn, unitType: planForUnit.unitType, canDoStatements: statements };
    }
    const nextPlannedHints = planRows
      .filter((u) => u.unitNumber > args.unitNumber)
      .sort((a, b) => a.unitNumber - b.unitNumber)
      .slice(0, 2)
      .map((u) => ({ unitNumber: u.unitNumber, primaryGrammarEn: u.primaryGrammarEn }));

    return {
      cefrLevel,
      levelSource,
      moduleTitleEn: moduleRow?.titleEn ?? undefined,
      previouslyTaught,
      plannedHint,
      nextPlannedHints,
    };
  },
});

/** Compact plan overview for admin views (module, unit, type, level, title). */
export const listCurriculumUnits = query({
  args: {},
  returns: v.array(
    v.object({
      unitNumber: v.number(),
      moduleNumber: v.number(),
      unitType: curriculumUnitTypeValidator,
      cefrLevel: curriculumCefrLevelValidator,
      strand: v.optional(curriculumStrandValidator),
      titleEn: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireSuperadmin(ctx);
    const rows = await ctx.db
      .query("curriculumUnits")
      .withIndex("by_active_unit", (q) => q.eq("isActive", true))
      .collect();
    return rows
      .sort((a, b) => a.unitNumber - b.unitNumber)
      .map((u) => ({
        unitNumber: u.unitNumber,
        moduleNumber: u.moduleNumber,
        unitType: u.unitType,
        cefrLevel: u.cefrLevel,
        strand: u.strand,
        titleEn: u.titleEn,
      }));
  },
});
