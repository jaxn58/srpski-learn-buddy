/**
 * Vocabulary Cleanup
 *
 * Tools for detecting and removing vocabulary entries that were wrongly
 * auto-inserted into `courseVocabulary` — primarily personal names picked up
 * by the exercise-scan heuristic BEFORE the `looksLikePersonalNameByContext`
 * filter was introduced.
 *
 * Provides:
 *   - `scanProperNounCandidates`   (query, superadmin-only) — reports two
 *     sections: (A) entries with the "AutoAdded: ..." note, (B) entries that
 *     match the name heuristic even though they don't carry that note.
 *   - `bulkDeleteVocabularyByIds`  (mutation, superadmin-only) — hard-deletes
 *     a list of courseVocabulary entries plus their vocabularyProgress rows.
 *     Requires a typed confirmation string to prevent accidents.
 *
 * Both operate on active (`isActive !== false`) entries only.
 */

import { v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireSuperadmin } from "./_shared";
import {
  looksLikePersonalNameByContext,
  normalizeSerbianKey,
} from "./_validatorHelpers";

const AUTO_ADDED_MARKER = "AutoAdded: new vocabulary used in exercises";

type CandidateEntry = {
  _id: Id<"courseVocabulary">;
  serbian: string;
  unitNumber: number;
  en?: string;
  de?: string;
  noteEn?: string;
  noteDe?: string;
  matchesHeuristic: boolean;
};

type ScanReport = {
  scannedAt: number;
  totalScanned: number;
  unitsScanned: number;
  autoAddedCandidates: CandidateEntry[];
  heuristicOnlyCandidates: CandidateEntry[];
};

/**
 * Extracts the "Serbian" column from markdown tables. Mirrors the private
 * helper in `_validatorHelpers.ts` so this cleanup module can operate on
 * DB-persisted content without importing internal helpers.
 */
function extractSerbianColumnFromMarkdown(markdown: string): string[] {
  const results: string[] = [];
  const lines = markdown.split("\n");
  let serbianColIdx = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      serbianColIdx = -1;
      continue;
    }

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;

    if (cells.some((c) => /^serbian$/i.test(c.replace(/\*+/g, "").trim()))) {
      serbianColIdx = cells.findIndex((c) =>
        /^serbian$/i.test(c.replace(/\*+/g, "").trim())
      );
      continue;
    }

    if (cells.every((c) => /^[-:\s]+$/.test(c))) continue;

    if (
      serbianColIdx >= 0 &&
      serbianColIdx < cells.length &&
      cells[serbianColIdx]
    ) {
      results.push(cells[serbianColIdx]);
    }
  }

  return results;
}

/**
 * Builds the same kind of original-case sample array that
 * `collectOriginalSerbianTextSamples` produces for draft packages — but
 * sourced from the DB (unitContent + unitInteractiveTests) for a single
 * unit. Only English rows are considered (matching the validator path).
 */
async function collectOriginalSerbianTextSamplesFromDb(
  ctx: { db: any },
  unitNumber: number
): Promise<string[]> {
  const samples: string[] = [];

  // 1) unitContent — Serbian column of phrases/dialogues markdown tables.
  const contentRows: Array<Doc<"unitContent">> = await ctx.db
    .query("unitContent")
    .withIndex("by_unit_lang", (q: any) =>
      q.eq("unitNumber", unitNumber).eq("language", "en")
    )
    .collect();

  for (const row of contentRows) {
    if (row.isActive === false) continue;
    if (row.contentType !== "phrases" && row.contentType !== "dialogues") continue;
    const md = String(row.content || "");
    if (!md.trim()) continue;
    const serbianTexts = extractSerbianColumnFromMarkdown(md);
    for (const t of serbianTexts) {
      const s = t.trim();
      if (s) samples.push(s);
    }
  }

  // 2) unitInteractiveTests — correctAnswer, options, hint, question.
  const testRows: Array<Doc<"unitInteractiveTests">> = await ctx.db
    .query("unitInteractiveTests")
    .withIndex("by_unit_lang", (q: any) =>
      q.eq("unitNumber", unitNumber).eq("language", "en")
    )
    .collect();

  for (const row of testRows) {
    if (row.isActive === false) continue;
    const ans = String(row.correctAnswer || "").trim();
    if (ans) samples.push(ans);
    if (Array.isArray(row.options)) {
      for (const opt of row.options) {
        const s = String(opt || "").trim();
        if (s) samples.push(s);
      }
    }
    const hint = String(row.hint || "").trim();
    if (hint) samples.push(hint);
    const qt = String(row.question || "").trim();
    if (qt) samples.push(qt);
  }

  return samples;
}

/**
 * Scans active course vocabulary and reports two categories of likely
 * wrongly-inserted entries:
 *   - autoAddedCandidates: carry the "AutoAdded" marker in noteEn.
 *   - heuristicOnlyCandidates: no marker, but the name heuristic considers
 *     them a personal name based on the context samples in their unit.
 *
 * This is a read-only query — nothing is mutated.
 */
export const scanProperNounCandidates = query({
  args: {
    // Optional unit filter; if omitted the full DB is scanned.
    unitNumber: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ScanReport> => {
    await requireSuperadmin(ctx);

    let vocab: Array<Doc<"courseVocabulary">>;
    if (typeof args.unitNumber === "number") {
      vocab = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber as number))
        .collect();
    } else {
      vocab = await ctx.db.query("courseVocabulary").collect();
    }

    vocab = vocab.filter((entry) => entry.isActive !== false);

    // Pull the "not-a-name" allowlist once and keep it as a Set for O(1) checks.
    const allowRows = await ctx.db
      .query("vocabularyProperNounAllowlist")
      .collect();
    const allowlist = new Set<string>(
      allowRows.map((r) => r.serbianNormalized)
    );

    // Cache samples per unit so we only build them once per scan.
    const samplesCache = new Map<number, string[]>();
    const getSamples = async (unitNumber: number): Promise<string[]> => {
      const cached = samplesCache.get(unitNumber);
      if (cached) return cached;
      const built = await collectOriginalSerbianTextSamplesFromDb(ctx, unitNumber);
      samplesCache.set(unitNumber, built);
      return built;
    };

    const autoAddedCandidates: CandidateEntry[] = [];
    const heuristicOnlyCandidates: CandidateEntry[] = [];

    for (const entry of vocab) {
      const serbian = String(entry.serbian || "").trim();
      if (!serbian) continue;

      // Whitelisted words are confirmed "not-a-name" and must not be surfaced
      // as cleanup candidates regardless of notes or heuristic.
      const normalized = normalizeSerbianKey(serbian);
      if (allowlist.has(normalized)) continue;

      const noteEn = String(entry.noteEn || "");
      const isAutoAdded = noteEn.includes(AUTO_ADDED_MARKER);

      const samples = await getSamples(entry.unitNumber);
      const matchesHeuristic = looksLikePersonalNameByContext(serbian, samples);

      if (isAutoAdded) {
        autoAddedCandidates.push({
          _id: entry._id,
          serbian,
          unitNumber: entry.unitNumber,
          en: entry.en,
          de: entry.de,
          noteEn: entry.noteEn,
          noteDe: entry.noteDe,
          matchesHeuristic,
        });
      } else if (matchesHeuristic) {
        heuristicOnlyCandidates.push({
          _id: entry._id,
          serbian,
          unitNumber: entry.unitNumber,
          en: entry.en,
          de: entry.de,
          noteEn: entry.noteEn,
          noteDe: entry.noteDe,
          matchesHeuristic: true,
        });
      }
    }

    // Stable sort: by unit then by serbian (case-insensitive).
    const sortFn = (a: CandidateEntry, b: CandidateEntry) => {
      if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
      return a.serbian.localeCompare(b.serbian, undefined, {
        sensitivity: "base",
      });
    };
    autoAddedCandidates.sort(sortFn);
    heuristicOnlyCandidates.sort(sortFn);

    return {
      scannedAt: Date.now(),
      totalScanned: vocab.length,
      unitsScanned: samplesCache.size,
      autoAddedCandidates,
      heuristicOnlyCandidates,
    };
  },
});

/**
 * Hard-deletes the given courseVocabulary entries and their related
 * vocabularyProgress rows. Superadmin only. Requires a confirm string
 * `DELETE <N> VOCABULARY` that matches the number of ids.
 */
export const bulkDeleteVocabularyByIds = mutation({
  args: {
    ids: v.array(v.id("courseVocabulary")),
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    const expected = `DELETE ${args.ids.length} VOCABULARY`;
    if (args.confirm !== expected) {
      throw new Error(
        `Confirmation mismatch. Expected exactly: "${expected}"`
      );
    }

    // De-duplicate in case the UI accidentally submits repeats.
    const uniqueIds = Array.from(new Set(args.ids));

    let deletedVocabulary = 0;
    let deletedProgress = 0;
    const deletedIds: Id<"courseVocabulary">[] = [];
    const missingIds: Id<"courseVocabulary">[] = [];

    for (const id of uniqueIds) {
      const doc = await ctx.db.get(id);
      if (!doc) {
        missingIds.push(id);
        continue;
      }

      // Cascade: delete all vocabularyProgress rows linked to this vocabulary.
      const progressRows = await ctx.db
        .query("vocabularyProgress")
        .withIndex("by_course_vocab", (q) => q.eq("courseVocabularyId", id))
        .collect();
      for (const p of progressRows) {
        await ctx.db.delete(p._id);
        deletedProgress += 1;
      }

      await ctx.db.delete(id);
      deletedVocabulary += 1;
      deletedIds.push(id);
    }

    return {
      deletedVocabulary,
      deletedProgress,
      deletedIds,
      missingIds,
      requestedCount: args.ids.length,
    };
  },
});

// ---------------------------------------------------------------------------
// Proper-noun allowlist (admin-confirmed "not-a-name" list)
// ---------------------------------------------------------------------------

/**
 * Internal, auth-free query used by `syncVocabularyCoverageFromExercises`
 * (runs inside actions without a direct user identity guarantee) to fetch just
 * the set of normalized allowlist keys. Returns a plain string array; no
 * admin metadata leaks out of the internal boundary.
 */
export const getAllowlistKeysInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("vocabularyProperNounAllowlist")
      .collect();
    return rows.map((r) => r.serbianNormalized);
  },
});

/**
 * Lists the full proper-noun allowlist for the admin UI, sorted by newest
 * first. Safe to show all rows because the list is manually curated and
 * bounded (a few hundred entries at most).
 */
export const getProperNounAllowlist = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx);

    const rows = await ctx.db
      .query("vocabularyProperNounAllowlist")
      .collect();

    rows.sort((a, b) => b.confirmedAt - a.confirmedAt);

    return rows.map((r) => ({
      _id: r._id,
      serbianNormalized: r.serbianNormalized,
      serbianOriginal: r.serbianOriginal,
      confirmedAt: r.confirmedAt,
      confirmedBy: r.confirmedBy,
      source: r.source,
      note: r.note,
    }));
  },
});

/**
 * Adds one or more courseVocabulary entries to the "not-a-name" allowlist
 * so neither the cleanup scan nor the validator heuristic flags them again.
 *
 * Idempotent per `serbianNormalized`: repeat requests update the audit trail
 * but never create duplicates. Intentionally one-click (no typed confirm)
 * because the operation is fully reversible via `removeFromProperNounAllowlist`.
 */
export const addToProperNounAllowlist = mutation({
  args: {
    ids: v.array(v.id("courseVocabulary")),
    source: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireSuperadmin(ctx);

    const uniqueIds = Array.from(new Set(args.ids));

    let added = 0;
    let updated = 0;
    let missing = 0;
    const nowMs = Date.now();
    const source = args.source ?? "cleanup_panel";

    for (const id of uniqueIds) {
      const entry = await ctx.db.get(id);
      if (!entry) {
        missing += 1;
        continue;
      }
      const serbianOriginal = String(entry.serbian || "").trim();
      if (!serbianOriginal) continue;
      const normalized = normalizeSerbianKey(serbianOriginal);
      if (!normalized) continue;

      const existing = await ctx.db
        .query("vocabularyProperNounAllowlist")
        .withIndex("by_serbian_normalized", (q) =>
          q.eq("serbianNormalized", normalized)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          serbianOriginal,
          confirmedBy: admin._id,
          confirmedAt: nowMs,
          source,
          note: args.note,
        });
        updated += 1;
      } else {
        await ctx.db.insert("vocabularyProperNounAllowlist", {
          serbianNormalized: normalized,
          serbianOriginal,
          confirmedBy: admin._id,
          confirmedAt: nowMs,
          source,
          note: args.note,
        });
        added += 1;
      }
    }

    return {
      requestedCount: args.ids.length,
      added,
      updated,
      missing,
    };
  },
});

/**
 * Removes rows from the allowlist, re-enabling the heuristic and classifier
 * filter for the listed tokens. Superadmin only.
 */
export const removeFromProperNounAllowlist = mutation({
  args: {
    ids: v.array(v.id("vocabularyProperNounAllowlist")),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    let removed = 0;
    let missing = 0;
    for (const id of Array.from(new Set(args.ids))) {
      const existing = await ctx.db.get(id);
      if (!existing) {
        missing += 1;
        continue;
      }
      await ctx.db.delete(id);
      removed += 1;
    }

    return {
      requestedCount: args.ids.length,
      removed,
      missing,
    };
  },
});
