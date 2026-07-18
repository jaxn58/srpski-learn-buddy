/**
 * Brief-Version identifiers.
 *
 * Versions are an append-only history (never deleted), so a version's ordinal
 * position in creation order is a stable, deterministic number. We derive the
 * display number from that order instead of persisting it — no schema change,
 * no migration, and the number never drifts.
 *
 * Display format: `M{module}U{unit}_v{n}` (e.g. `M1U5_v3`).
 */

export interface BriefVersionNumberInput {
  _id: string;
  createdAt: number;
}

/**
 * Assigns a 1-based version number to each brief version, oldest = v1.
 * Sorted by `createdAt` (tie-break by `_id`) so the result is stable
 * regardless of the input order.
 */
export function computeBriefVersionNumbers(
  versions: ReadonlyArray<BriefVersionNumberInput> | undefined | null,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(versions)) return map;
  const ordered = [...versions].sort((a, b) => {
    const dt = Number(a.createdAt) - Number(b.createdAt);
    if (dt !== 0) return dt;
    return String(a._id).localeCompare(String(b._id));
  });
  ordered.forEach((v, idx) => map.set(String(v._id), idx + 1));
  return map;
}

/** Builds the compact identifier `M{module}U{unit}_v{n}`. */
export function formatBriefVersionId(
  moduleNumber: number | string | undefined | null,
  unitNumber: number | string | undefined | null,
  versionNumber: number | undefined | null,
): string {
  const m = Number(moduleNumber);
  const u = Number(unitNumber);
  const mPart = Number.isFinite(m) && m > 0 ? `M${m}` : "M?";
  const uPart = Number.isFinite(u) && u > 0 ? `U${u}` : "U?";
  const vPart = versionNumber && versionNumber > 0 ? `_v${versionNumber}` : "";
  return `${mPart}${uPart}${vPart}`;
}
