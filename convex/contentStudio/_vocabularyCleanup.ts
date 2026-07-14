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
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireSuperadmin } from "./_shared";
import {
  looksLikePersonalNameByContext,
  normalizeSerbianKey,
} from "./_validatorHelpers";
import { toVocabularyKey } from "../vocabulary";

/**
 * Superadmin OR CLI access. Cleanup functions are dual-purpose: they must
 * be callable from the superadmin UI *and* from `npx convex run ... --prod`
 * playbooks. `ctx.auth.getUserIdentity()` returns null for identity-less
 * CLI invocations, which we accept — CLI access is already gated by the
 * deploy key on the operator's machine.
 */
async function requireSuperadminOrCli(
  ctx: QueryCtx | MutationCtx,
): Promise<{ viaCli: true } | { viaCli: false; user: Doc<"users"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { viaCli: true };
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized - Superadmin required");
  }
  return { viaCli: false, user };
}

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
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const scanProperNounCandidates = query({
  args: {
    // Optional unit filter; if omitted the full DB is scanned.
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    unitNumber: v.optional(v.number()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
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
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const bulkDeleteVocabularyByIds = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    ids: v.array(v.id("courseVocabulary")),
    confirm: v.string(),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
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
      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
      const doc = await ctx.db.get(id);
      if (!doc) {
        // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
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

      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
      await ctx.db.delete(id);
      deletedVocabulary += 1;
      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
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
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getAllowlistKeysInternal = internalQuery({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx) => {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const rows = await ctx.db
      .query("vocabularyProperNounAllowlist")
      .collect();
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    return rows.map((r) => r.serbianNormalized);
  },
});

/**
 * Lists the full proper-noun allowlist for the admin UI, sorted by newest
 * first. Safe to show all rows because the list is manually curated and
 * bounded (a few hundred entries at most).
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const getProperNounAllowlist = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
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
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const addToProperNounAllowlist = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    ids: v.array(v.id("courseVocabulary")),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    source: v.optional(v.string()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    note: v.optional(v.string()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    const admin = await requireSuperadmin(ctx);

    const uniqueIds = Array.from(new Set(args.ids));

    let added = 0;
    let updated = 0;
    let missing = 0;
    const nowMs = Date.now();
    const source = args.source ?? "cleanup_panel";

    for (const id of uniqueIds) {
      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
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
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const removeFromProperNounAllowlist = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    ids: v.array(v.id("vocabularyProperNounAllowlist")),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    let removed = 0;
    let missing = 0;
    for (const id of Array.from(new Set(args.ids))) {
      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
      const existing = await ctx.db.get(id);
      if (!existing) {
        missing += 1;
        continue;
      }
      // @ts-ignore TS2345 TS2589 – Convex schema depth limit (50 tables)
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

// ---------------------------------------------------------------------------
// Cross-unit vocabulary duplicate report & cleanup
// ---------------------------------------------------------------------------
//
// The `courseVocabulary` table is supposed to contain each Serbian word at
// most once, anchored to its earliest unit. Legacy rows created before the
// cross-unit guards existed violate that invariant, and translators can
// surface (but no longer create) new ones because translation writes do
// not re-run the guard.
//
// This section provides four production-ready tools:
//
//   1. reportCrossUnitVocabularyDuplicates  (query) — read-only scan.
//   2. inspectSerbianKeyAcrossUnits         (query) — single-key forensic.
//   3. cleanupCrossUnitVocabularyDuplicates (mutation) — dryRun + confirm.
//   4. takeUnitVocabularyOfflineCompletely  (mutation) — confirm-gated.
//
// Production playbook (safe order — run against --prod deployment):
//
//   1) Snapshot the current state:
//      npx convex run contentStudio/_vocabularyCleanup:reportCrossUnitVocabularyDuplicates --prod
//
//   2) (Optional but recommended) Take any known test/clone unit offline
//      BEFORE the dedup run, so its rows drop out of the duplicate scan:
//      npx convex run contentStudio/_vocabularyCleanup:takeUnitVocabularyOfflineCompletely \
//          '{"unitNumber":<N>,"dryRun":true}' --prod
//      # review, then:
//      npx convex run contentStudio/_vocabularyCleanup:takeUnitVocabularyOfflineCompletely \
//          '{"unitNumber":<N>,"dryRun":false,"confirm":"OFFLINE UNIT <N> VOCABULARY"}' --prod
//
//   3) Dry-run the cleanup and review the merge plan + archived counts:
//      npx convex run contentStudio/_vocabularyCleanup:cleanupCrossUnitVocabularyDuplicates \
//          '{"dryRun":true}' --prod
//
//   4) Apply the cleanup:
//      npx convex run contentStudio/_vocabularyCleanup:cleanupCrossUnitVocabularyDuplicates \
//          '{"dryRun":false,"confirm":"CLEANUP CROSS-UNIT VOCABULARY DUPLICATES"}' --prod
//
//   5) Verify:
//      npx convex run contentStudio/_vocabularyCleanup:reportCrossUnitVocabularyDuplicates --prod
//      # must report groupCount: 0, duplicateRowCount: 0
//
// Shell quoting:
//   - bash / zsh:  single quotes around the JSON work directly.
//   - PowerShell:  backslash-escape inner double quotes, e.g.
//       `'{\"dryRun\":true}'`. When the JSON contains a confirmation
//       string with spaces (our case), PowerShell's argv handling strips
//       quotes and the Convex CLI rejects the result. Wrap the whole
//       invocation in `cmd /c '...'`:
//         cmd /c 'npx convex run contentStudio/_vocabularyCleanup:cleanupCrossUnitVocabularyDuplicates "{\"dryRun\":false,\"confirm\":\"CLEANUP CROSS-UNIT VOCABULARY DUPLICATES\"}"'

const CLEANUP_CONFIRM = "CLEANUP CROSS-UNIT VOCABULARY DUPLICATES";
const OFFLINE_UNIT_CONFIRM_PREFIX = "OFFLINE UNIT";
const ARCHIVED_DUPLICATE_MARKER = "[archived cross-unit duplicate]";
const OFFLINE_UNIT_MARKER = "[taken offline: test/clone unit]";

type DuplicateEntrySnapshot = {
  _id: Id<"courseVocabulary">;
  unitNumber: number;
  unitVersion?: number;
  serbian: string;
  serbianNormalized?: string;
  releaseStatus?: "published" | "preview" | "offline";
  isActive?: boolean;
  creationTime: number;
  en?: string;
  de?: string;
  noteEn?: string;
  noteDe?: string;
  gender?: string;
  pronunciation?: string;
  audioUrl?: string;
  audioStorageId?: string;
};

type FieldFill = {
  field: string;
  fromUnit: number;
  value: string;
};

type DuplicateGroup = {
  key: string;
  canonical: DuplicateEntrySnapshot;
  duplicates: DuplicateEntrySnapshot[];
  proposedFills: FieldFill[];
  progressRowsToRemap: number;
};

type ReportSummary = {
  scannedAt: number;
  totalActive: number;
  groupCount: number;
  duplicateRowCount: number;
  groups: DuplicateGroup[];
};

/**
 * Snapshot helper — picks only the fields we care about in reports/merges
 * so the wire payload stays small and stable.
 */
function snapshotEntry(
  e: Doc<"courseVocabulary">,
): DuplicateEntrySnapshot {
  return {
    _id: e._id,
    unitNumber: e.unitNumber,
    unitVersion: e.unitVersion,
    serbian: e.serbian,
    serbianNormalized: e.serbianNormalized,
    releaseStatus: e.releaseStatus,
    isActive: e.isActive,
    creationTime: e._creationTime,
    en: e.en,
    de: e.de,
    noteEn: e.noteEn,
    noteDe: e.noteDe,
    gender: e.gender,
    pronunciation: e.pronunciation,
    audioUrl: e.audioUrl,
    audioStorageId: e.audioStorageId,
  };
}

/**
 * Per-unit "best" entry: highest unitVersion wins, ties broken by newest
 * _creationTime. Mirrors the tie-breaking used elsewhere for the
 * by_unit_active_version index.
 */
function pickBestPerUnit(
  entries: Doc<"courseVocabulary">[],
): Map<number, Doc<"courseVocabulary">> {
  const best = new Map<number, Doc<"courseVocabulary">>();
  for (const e of entries) {
    const prev = best.get(e.unitNumber);
    if (!prev) {
      best.set(e.unitNumber, e);
      continue;
    }
    const prevV = prev.unitVersion ?? 1;
    const curV = e.unitVersion ?? 1;
    if (curV > prevV) {
      best.set(e.unitNumber, e);
    } else if (curV === prevV && e._creationTime > prev._creationTime) {
      best.set(e.unitNumber, e);
    }
  }
  return best;
}

/** String field is considered empty when undefined/null/whitespace only. */
function isEmptyStr(v: unknown): boolean {
  return typeof v !== "string" || v.trim().length === 0;
}

/**
 * Compute the field-merge plan: any field that is empty on canonical but
 * populated on a duplicate will be filled from the first (earliest-unit)
 * duplicate that has a value. Never overwrites a populated canonical field.
 *
 * Returns both the plan (for reporting) and the final patch object.
 */
function computeFieldMerge(
  canonical: Doc<"courseVocabulary">,
  duplicates: Doc<"courseVocabulary">[],
): { fills: FieldFill[]; patch: Partial<Doc<"courseVocabulary">> } {
  const fills: FieldFill[] = [];
  const patch: Record<string, unknown> = {};

  const stringFields: Array<keyof Doc<"courseVocabulary">> = [
    "en",
    "de",
    "sr",
    "es",
    "fr",
    "enAlt",
    "deAlt",
    "noteEn",
    "noteDe",
    "noteSr",
    "noteEs",
    "noteFr",
    "gender",
    "pronunciation",
    "audioUrl",
    "audioStorageId",
  ];

  for (const field of stringFields) {
    if (!isEmptyStr(canonical[field])) continue;
    for (const dup of duplicates) {
      const val = dup[field];
      if (!isEmptyStr(val)) {
        patch[field as string] = val;
        fills.push({
          field: String(field),
          fromUnit: dup.unitNumber,
          value: String(val),
        });
        break;
      }
    }
  }

  // Translations array (deprecated but still written): merge by language,
  // canonical wins for existing languages. Only touch canonical if we
  // actually add at least one language.
  const canonTranslations = canonical.translations ?? [];
  const canonLangs = new Set(canonTranslations.map((t) => t.language));
  const additions: Array<{ language: string; translation: string; alt?: string }> = [];
  for (const dup of duplicates) {
    for (const t of dup.translations ?? []) {
      if (canonLangs.has(t.language)) continue;
      if (additions.some((a) => a.language === t.language)) continue;
      if (isEmptyStr(t.translation)) continue;
      additions.push({ language: t.language, translation: t.translation, alt: t.alt });
      fills.push({
        field: `translations[${t.language}]`,
        fromUnit: dup.unitNumber,
        value: t.translation,
      });
    }
  }
  if (additions.length > 0) {
    patch.translations = [...canonTranslations, ...additions];
  }

  return { fills, patch: patch as Partial<Doc<"courseVocabulary">> };
}

/**
 * Core scan shared by the report query and the cleanup mutation so both
 * see exactly the same grouping. Returns **rows**, not snapshots, so the
 * mutation can patch them directly.
 */
async function scanDuplicateGroupsRaw(
  ctx: QueryCtx | MutationCtx,
): Promise<
  Array<{
    key: string;
    canonical: Doc<"courseVocabulary">;
    duplicates: Doc<"courseVocabulary">[];
    allInDuplicateUnits: Doc<"courseVocabulary">[];
  }>
> {
  const all = await ctx.db.query("courseVocabulary").collect();

  // Only consider rows that currently claim to be live content.
  const live = all.filter(
    (e) => e.isActive !== false && e.releaseStatus !== "offline",
  );

  const byKey = new Map<string, Doc<"courseVocabulary">[]>();
  for (const e of live) {
    const key = toVocabularyKey(e.serbianNormalized ?? e.serbian);
    if (!key) continue;
    const arr = byKey.get(key) ?? [];
    arr.push(e);
    byKey.set(key, arr);
  }

  const groups: Array<{
    key: string;
    canonical: Doc<"courseVocabulary">;
    duplicates: Doc<"courseVocabulary">[];
    allInDuplicateUnits: Doc<"courseVocabulary">[];
  }> = [];

  for (const [key, entries] of byKey.entries()) {
    const unitNumbers = new Set(entries.map((e) => e.unitNumber));
    if (unitNumbers.size <= 1) continue;

    const best = pickBestPerUnit(entries);
    const sorted = Array.from(best.entries()).sort(([a], [b]) => a - b);
    const [, canonical] = sorted[0];
    const duplicates: Doc<"courseVocabulary">[] = [];
    const allInDuplicateUnits: Doc<"courseVocabulary">[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const [dupUnit, dupBest] = sorted[i];
      duplicates.push(dupBest);
      // Include ALL live rows in the duplicate unit (not just the highest
      // version) so the cleanup archives everything, not only the "best".
      for (const e of entries) {
        if (e.unitNumber === dupUnit) allInDuplicateUnits.push(e);
      }
    }
    groups.push({ key, canonical, duplicates, allInDuplicateUnits });
  }

  groups.sort((a, b) => a.key.localeCompare(b.key));
  return groups;
}

/**
 * Read-only report of cross-unit vocabulary duplicates with a merge
 * preview per group. Safe to run on prod.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const reportCrossUnitVocabularyDuplicates = query({
  args: {},
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx): Promise<ReportSummary> => {
    await requireSuperadminOrCli(ctx);

    const all = await ctx.db.query("courseVocabulary").collect();
    const totalActive = all.filter(
      (e) => e.isActive !== false && e.releaseStatus !== "offline",
    ).length;

    const raw = await scanDuplicateGroupsRaw(ctx);

    const groups: DuplicateGroup[] = [];
    let duplicateRowCount = 0;
    for (const g of raw) {
      const { fills } = computeFieldMerge(g.canonical, g.duplicates);
      let progressToRemap = 0;
      for (const d of g.allInDuplicateUnits) {
        const rows = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_course_vocab", (q) =>
            q.eq("courseVocabularyId", d._id),
          )
          .collect();
        progressToRemap += rows.length;
      }
      duplicateRowCount += g.allInDuplicateUnits.length;
      groups.push({
        key: g.key,
        canonical: snapshotEntry(g.canonical),
        duplicates: g.duplicates.map(snapshotEntry),
        proposedFills: fills,
        progressRowsToRemap: progressToRemap,
      });
    }

    return {
      scannedAt: Date.now(),
      totalActive,
      groupCount: groups.length,
      duplicateRowCount,
      groups,
    };
  },
});

/**
 * Single-key forensic: returns every row (including inactive and offline)
 * for a given Serbian string, across all units. Replaces the pre-fix
 * `debugCrossUnitDedup` probe with a permanent, auth-gated equivalent.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const inspectSerbianKeyAcrossUnits = query({
  args: {
    serbian: v.string(),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminOrCli(ctx);

    const key = toVocabularyKey(args.serbian);

    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    const viaNormalized = await ctx.db
      .query("courseVocabulary")
      // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
      .withIndex("by_serbian_normalized", (q) =>
        // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
        q.eq("serbianNormalized", key),
      )
      .collect();

    // Cast net wider for legacy rows without serbianNormalized.
    const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
    const nfd = key.normalize("NFD");
    const variants = Array.from(
      new Set([key, capitalized, key.toUpperCase(), nfd]),
    );
    const viaSerbian: Doc<"courseVocabulary">[] = [];
    const seen = new Set(viaNormalized.map((r) => r._id));
    for (const variant of variants) {
      const rows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_serbian", (q) => q.eq("serbian", variant))
        .collect();
      for (const r of rows) {
        if (seen.has(r._id)) continue;
        viaSerbian.push(r);
        seen.add(r._id);
      }
    }

    const rows = [...viaNormalized, ...viaSerbian]
      .map(snapshotEntry)
      .sort((a, b) => {
        if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
        return a.creationTime - b.creationTime;
      });

    return {
      serbianInput: args.serbian,
      normalizedKey: key,
      rowCount: rows.length,
      activeNonOfflineCount: rows.filter(
        (r) => r.isActive !== false && r.releaseStatus !== "offline",
      ).length,
      rows,
    };
  },
});

/**
 * One-shot cleanup of cross-unit vocabulary duplicates with an explicit
 * merge phase:
 *   1. Identify duplicate groups via `scanDuplicateGroupsRaw`.
 *   2. For each group, fill any empty fields on the canonical (earliest
 *      unit) entry from the first duplicate that has a value. Never
 *      overwrites existing canonical data.
 *   3. Soft-archive every duplicate row: `isActive=false`,
 *      `releaseStatus="offline"`, `archivedAt=now`, plus an audit
 *      marker appended to `noteEn`.
 *   4. Remap vocabularyProgress rows from each duplicate to the canonical.
 *      If the user already has progress on canonical, counts are merged
 *      (sum correct/incorrect/review, max lastAnsweredAt/lastReviewedAt,
 *      OR mastered) and the duplicate progress row is deleted.
 *
 * Always safe to call with `dryRun: true` (default). Destructive mode
 * requires `confirm === "CLEANUP CROSS-UNIT VOCABULARY DUPLICATES"`.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const cleanupCrossUnitVocabularyDuplicates = mutation({
  args: {
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    dryRun: v.optional(v.boolean()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    confirm: v.optional(v.string()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminOrCli(ctx);

    const dryRun = args.dryRun !== false;
    if (!dryRun && args.confirm !== CLEANUP_CONFIRM) {
      throw new Error(
        `Confirmation mismatch for destructive cleanup. Expected exactly: "${CLEANUP_CONFIRM}"`,
      );
    }

    const now = Date.now();
    const groups = await scanDuplicateGroupsRaw(ctx);

    let archivedVocabulary = 0;
    let progressRemapped = 0;
    let progressMerged = 0;
    let canonicalsEnriched = 0;
    const groupReports: Array<{
      key: string;
      canonicalId: Id<"courseVocabulary">;
      canonicalUnit: number;
      duplicateUnits: number[];
      archivedIds: Id<"courseVocabulary">[];
      fills: FieldFill[];
    }> = [];

    for (const g of groups) {
      const { fills, patch } = computeFieldMerge(g.canonical, g.duplicates);

      if (Object.keys(patch).length > 0) {
        canonicalsEnriched += 1;
        if (!dryRun) {
          await ctx.db.patch(g.canonical._id, patch);
        }
      }

      const archivedIds: Id<"courseVocabulary">[] = [];
      for (const dup of g.allInDuplicateUnits) {
        archivedIds.push(dup._id);
        archivedVocabulary += 1;

        const archivedNote = (() => {
          const previous = String(dup.noteEn ?? "").trim();
          const marker = `${ARCHIVED_DUPLICATE_MARKER} canonical=Unit ${g.canonical.unitNumber}`;
          if (!previous) return marker;
          if (previous.includes(ARCHIVED_DUPLICATE_MARKER)) return previous;
          return `${previous} — ${marker}`;
        })();

        if (!dryRun) {
          await ctx.db.patch(dup._id, {
            isActive: false,
            releaseStatus: "offline",
            archivedAt: now,
            noteEn: archivedNote,
          });
        }

        const progressRows = await ctx.db
          .query("vocabularyProgress")
          .withIndex("by_course_vocab", (q) =>
            q.eq("courseVocabularyId", dup._id),
          )
          .collect();

        for (const prog of progressRows) {
          const existing = await ctx.db
            .query("vocabularyProgress")
            .withIndex("by_user_course_vocab", (q) =>
              q
                .eq("userId", prog.userId)
                .eq("courseVocabularyId", g.canonical._id),
            )
            .first();

          if (existing) {
            progressMerged += 1;
            if (!dryRun) {
              await ctx.db.patch(existing._id, {
                correctAnswerCount:
                  existing.correctAnswerCount + prog.correctAnswerCount,
                incorrectAnswerCount:
                  existing.incorrectAnswerCount + prog.incorrectAnswerCount,
                reviewCount: existing.reviewCount + prog.reviewCount,
                mastered: existing.mastered || prog.mastered,
                lastAnsweredAt:
                  Math.max(
                    existing.lastAnsweredAt ?? 0,
                    prog.lastAnsweredAt ?? 0,
                  ) || undefined,
                lastReviewedAt:
                  Math.max(
                    existing.lastReviewedAt ?? 0,
                    prog.lastReviewedAt ?? 0,
                  ) || undefined,
              });
              await ctx.db.delete(prog._id);
            }
          } else {
            progressRemapped += 1;
            if (!dryRun) {
              await ctx.db.patch(prog._id, {
                courseVocabularyId: g.canonical._id,
              });
            }
          }
        }
      }

      groupReports.push({
        key: g.key,
        canonicalId: g.canonical._id,
        canonicalUnit: g.canonical.unitNumber,
        duplicateUnits: Array.from(
          new Set(g.allInDuplicateUnits.map((d) => d.unitNumber)),
        ).sort((a, b) => a - b),
        archivedIds,
        fills,
      });
    }

    const summary = {
      dryRun,
      groupsProcessed: groups.length,
      canonicalsEnriched,
      archivedVocabulary,
      progressRemapped,
      progressMerged,
      groupReports,
    };

    console.log(
      `[CrossUnitCleanup] ${dryRun ? "DRY RUN" : "APPLIED"}: ` +
        `${groups.length} groups, ${archivedVocabulary} rows archived, ` +
        `${canonicalsEnriched} canonicals enriched, ` +
        `${progressRemapped} progress remapped, ${progressMerged} merged.`,
    );

    return summary;
  },
});

/**
 * Takes every active `courseVocabulary` row of a given unit fully offline:
 * `isActive=false`, `releaseStatus="offline"`, `archivedAt=now`, and
 * appends a clear audit marker to `noteEn`.
 *
 * Intended for unit numbers that are test clones and should never surface
 * in user-facing content or in cross-unit dedup scans. vocabularyProgress
 * rows are intentionally left alone — they become orphaned reference rows
 * but will simply not be shown any more, preserving any learner history.
 *
 * Destructive mode requires `confirm === "OFFLINE UNIT <unitNumber> VOCABULARY"`.
 */
// @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
export const takeUnitVocabularyOfflineCompletely = mutation({
  args: {
    unitNumber: v.number(),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    dryRun: v.optional(v.boolean()),
    // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
    confirm: v.optional(v.string()),
  },
  // @ts-ignore TS2589 TS2589 – Convex schema depth limit (50 tables)
  handler: async (ctx, args) => {
    await requireSuperadminOrCli(ctx);

    const dryRun = args.dryRun !== false;
    const expected = `${OFFLINE_UNIT_CONFIRM_PREFIX} ${args.unitNumber} VOCABULARY`;
    if (!dryRun && args.confirm !== expected) {
      throw new Error(
        `Confirmation mismatch. Expected exactly: "${expected}"`,
      );
    }

    const now = Date.now();
    const rows = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    let takenOffline = 0;
    let alreadyOffline = 0;
    const affectedIds: Id<"courseVocabulary">[] = [];

    for (const r of rows) {
      if (r.isActive === false && r.releaseStatus === "offline") {
        alreadyOffline += 1;
        continue;
      }
      const previous = String(r.noteEn ?? "").trim();
      const noteEn = previous
        ? previous.includes(OFFLINE_UNIT_MARKER)
          ? previous
          : `${previous} — ${OFFLINE_UNIT_MARKER}`
        : OFFLINE_UNIT_MARKER;

      if (!dryRun) {
        await ctx.db.patch(r._id, {
          isActive: false,
          releaseStatus: "offline",
          archivedAt: now,
          noteEn,
        });
      }
      takenOffline += 1;
      affectedIds.push(r._id);
    }

    console.log(
      `[TakeUnitOffline] ${dryRun ? "DRY RUN" : "APPLIED"} unit=${args.unitNumber}: ` +
        `${takenOffline} taken offline, ${alreadyOffline} already offline.`,
    );

    return {
      dryRun,
      unitNumber: args.unitNumber,
      scanned: rows.length,
      takenOffline,
      alreadyOffline,
      affectedIds,
    };
  },
});
