/**
 * Curriculum Tables
 *
 * Machine-readable course plan that drives the Content Studio Brief Assistant
 * and (later) module gating and the Lector:
 *   - curriculumUnits: one row per planned unit (module placement, CEFR level,
 *     unit type, strand, setting, situation, grammar targets, chunks, recycling,
 *     assigned Can-Do statement ids).
 *   - curriculumCanDo: CEFR-style Can-Do statements with stable ids.
 *
 * Source of truth for the initial import is docs/curriculum/UNIT_MAP.md and
 * docs/curriculum/CAN_DO_INVENTORY.md (scripts/curriculum/import-curriculum.ts).
 * Rows are meant to become editable in the admin UI later (per tenant), so
 * all learner-facing free text carries language suffixes (En/De) even though
 * only English is filled today.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const curriculumUnitTypeValidator = v.union(
  v.literal("standard"),
  v.literal("review"),
  v.literal("checkpoint"),
  v.literal("exam"),
);

export const curriculumCefrLevelValidator = v.union(
  v.literal("A1.1"),
  v.literal("A1.2"),
  v.literal("A2.1"),
  v.literal("A2.2"),
  v.literal("B1"),
);

export const curriculumStrandValidator = v.union(
  v.literal("ARR"),
  v.literal("SET"),
  v.literal("DAY"),
  v.literal("SOC"),
  v.literal("BIZ"),
  v.literal("DIG"),
  v.literal("GEN"),
);

export const curriculumSettingValidator = v.union(
  v.literal("serbia"),
  v.literal("montenegro_coast"),
  v.literal("mixed"),
);

export const curriculumTables = {
  curriculumUnits: defineTable({
    unitNumber: v.number(),
    moduleNumber: v.number(),
    unitType: curriculumUnitTypeValidator,
    cefrLevel: curriculumCefrLevelValidator,
    /** Undefined for review/checkpoint/exam units (they span strands). */
    strand: v.optional(curriculumStrandValidator),
    setting: curriculumSettingValidator,
    titleEn: v.string(),
    titleDe: v.optional(v.string()),
    situationEn: v.string(),
    situationDe: v.optional(v.string()),
    /** Primary grammar target (exact forms) as planned in the unit map. */
    primaryGrammarEn: v.string(),
    /** Recycled grammar / vocabulary hint. */
    recycleEn: v.optional(v.string()),
    /** Fixed phrases the unit may use before the grammar is taught. */
    chunksEn: v.optional(v.string()),
    /** Ids into curriculumCanDo.canDoId. */
    canDoIds: v.array(v.string()),
    isActive: v.boolean(),
    /** Import provenance, e.g. "UNIT_MAP.md@2026-09-16". */
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_unit", ["unitNumber"])
    .index("by_module", ["moduleNumber"])
    .index("by_active_unit", ["isActive", "unitNumber"]),

  curriculumCanDo: defineTable({
    /** Stable id such as "A1.1-SOC-01". */
    canDoId: v.string(),
    cefrLevel: curriculumCefrLevelValidator,
    strand: curriculumStrandValidator,
    statementEn: v.string(),
    statementDe: v.optional(v.string()),
    /** Units that introduce or recycle this statement (numbers only). */
    targetUnits: v.array(v.number()),
    /** Free-text detail of the target column (e.g. "U001 (1st/2nd sg), U007 (all persons)"). */
    targetNote: v.optional(v.string()),
    isActive: v.boolean(),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_can_do_id", ["canDoId"])
    .index("by_level", ["cefrLevel"])
    .index("by_level_strand", ["cefrLevel", "strand"]),
};
