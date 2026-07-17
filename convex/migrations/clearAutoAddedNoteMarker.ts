/**
 * One-time cleanup: the exercise-scan auto-add path used to write the
 * internal bookkeeping string "AutoAdded: new vocabulary used in exercises"
 * directly into `noteEn` (and, via the EN->DE translation step, a German
 * paraphrase of that same sentence into `noteDe`). That is learner-facing
 * garbage — the note fields must only ever contain real linguistic notes.
 *
 * The code path has been fixed (see `_validatorHelpers.ts`) to flag these
 * rows via the new internal `autoAdded` boolean field instead. This
 * migration backfills that field on existing rows and strips the marker
 * (and its known German paraphrases) out of `noteEn`/`noteDe`.
 *
 * IMPORTANT — noteDe is NOT blindly cleared. A manual audit of every unique
 * noteDe value on marker-carrying rows (Dev, 2026-07-17) showed that most of
 * them already contain a real, useful German note (added by a later
 * translation/QC pass) with no garbage text at all — e.g. "Personalpronomen."
 * or "3. Person Singular von 'zvati se' (heißen).". Only a small, exact set
 * of German paraphrases of the marker sentence exist as a LEADING sentence;
 * those are stripped (keeping any real content that follows), everything
 * else is left untouched.
 *
 * Run in Dev:
 *   npx convex run migrations/clearAutoAddedNoteMarker:run
 *
 * Dry-run (default):
 *   npx convex run migrations/clearAutoAddedNoteMarker:run '{"dryRun":true}'
 *
 * After verifying dry-run output, execute:
 *   npx convex run migrations/clearAutoAddedNoteMarker:run '{"dryRun":false}'
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const MARKER_EN = "AutoAdded: new vocabulary used in exercises";

/**
 * Exact German paraphrases of the marker sentence seen in `noteDe` across
 * the current Dev dataset, longest first so a longer variant is never
 * shadowed by a shorter one that happens to be its prefix.
 */
const MARKER_DE_PREFIXES = [
  "Automatisch hinzugefügt: neuer Wortschatz, der in den Übungen verwendet wird.",
  "Automatisch hinzugefügter neuer Wortschatz aus den Übungen.",
  "Automatisch hinzugefügt: neuer Wortschatz aus den Übungen.",
  "Automatisch hinzugefügt: neue Vokabeln, die in Übungen verwendet werden",
  "Neuer Wortschatz, der in den Übungen verwendet wird.",
].sort((a, b) => b.length - a.length);

/**
 * Removes the marker substring and trims any dangling separator left behind
 * by the archive/offline audit-note concatenation pattern
 * (`${previous} — ${auditMarker}`), without touching unrelated audit text.
 */
function stripEnMarker(noteEn: string): string {
  let result = noteEn.split(MARKER_EN).join("");
  result = result.replace(/^\s*—\s*/, "").replace(/\s*—\s*$/, "");
  result = result.replace(/^\s*-\s*/, "").replace(/\s*-\s*$/, "");
  return result.trim();
}

/**
 * Strips a leading German marker paraphrase from noteDe, if present, and
 * returns the remainder (empty string if nothing else was there). Returns
 * `null` if noteDe doesn't start with any known garbage phrase — meaning it
 * is real content and must be left untouched.
 */
function stripDeMarkerPrefix(noteDe: string): string | null {
  for (const prefix of MARKER_DE_PREFIXES) {
    if (noteDe.startsWith(prefix)) {
      return noteDe.slice(prefix.length).trim();
    }
  }
  return null;
}

export const run = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    totalScanned: v.number(),
    matched: v.number(),
    noteEnCleared: v.number(),
    noteEnTrimmed: v.number(),
    noteDeCleared: v.number(),
    noteDeTrimmed: v.number(),
    noteDeLeftUntouched: v.number(),
    autoAddedBackfilled: v.number(),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun !== false;

    const all = await ctx.db.query("courseVocabulary").collect();

    let matched = 0;
    let noteEnCleared = 0;
    let noteEnTrimmed = 0;
    let noteDeCleared = 0;
    let noteDeTrimmed = 0;
    let noteDeLeftUntouched = 0;
    let autoAddedBackfilled = 0;

    for (const row of all) {
      const noteEn = String(row.noteEn ?? "");
      if (!noteEn.includes(MARKER_EN)) continue;
      matched += 1;

      const patch: Record<string, unknown> = {};

      const cleanedEn = stripEnMarker(noteEn);
      if (cleanedEn) {
        patch.noteEn = cleanedEn;
        noteEnTrimmed += 1;
      } else {
        patch.noteEn = undefined;
        noteEnCleared += 1;
      }

      if (row.noteDe) {
        const remainder = stripDeMarkerPrefix(row.noteDe);
        if (remainder === null) {
          noteDeLeftUntouched += 1;
        } else if (remainder) {
          patch.noteDe = remainder;
          noteDeTrimmed += 1;
        } else {
          patch.noteDe = undefined;
          noteDeCleared += 1;
        }
      }

      if (row.autoAdded !== true) {
        patch.autoAdded = true;
        autoAddedBackfilled += 1;
      }

      if (!dryRun) {
        await ctx.db.patch(row._id, patch);
      }
    }

    const summary = {
      dryRun,
      totalScanned: all.length,
      matched,
      noteEnCleared,
      noteEnTrimmed,
      noteDeCleared,
      noteDeTrimmed,
      noteDeLeftUntouched,
      autoAddedBackfilled,
    };

    console.log(
      `[${dryRun ? "DRY RUN" : "EXECUTED"}] ${matched} row(s) carry the AutoAdded marker. ` +
        `noteEn: cleared ${noteEnCleared}, trimmed ${noteEnTrimmed}. ` +
        `noteDe: cleared ${noteDeCleared}, trimmed ${noteDeTrimmed}, left untouched (real content) ${noteDeLeftUntouched}. ` +
        `autoAdded backfilled on ${autoAddedBackfilled}.`,
    );

    return summary;
  },
});
