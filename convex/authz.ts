import type { Doc } from "./_generated/dataModel";

/** Admin and superadmin bypass learner inactive checks (e.g. admin panel while flagged inactive). */
export function isStaffRole(role: string | undefined): boolean {
  return role === "superadmin" || role === "admin";
}

export function isLearnerAccountSuspended(user: Doc<"users">): boolean {
  return !isStaffRole(user.role) && user.isActive === false;
}

/**
 * Enforce that non-staff accounts are active. Call after resolving the Convex user row.
 * Staff roles are always allowed.
 */
export function assertLearnerAccountActive(user: Doc<"users">): void {
  if (isLearnerAccountSuspended(user)) {
    throw new Error("Account inactive");
  }
}

/**
 * Length-padded, branch-free string comparison to avoid leaking secret contents
 * via response timing. Not a hardware-constant-time primitive, but removes the
 * early-exit timing signal of `===`.
 */
function timingSafeStringEquals(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}

/**
 * Fail-closed gate for the shared ops/migration secret (`ADMIN_SECRET`).
 *
 * This secret authenticates headless, cross-deployment scripts (e.g. the
 * dev->prod email-template sync) that connect via the Convex HTTP API and have
 * no Clerk identity. Centralizing the check guarantees every secret-gated
 * function fails closed when the env var is missing and compares the value
 * without an early-exit timing side channel.
 */
export function assertAdminSecret(provided: string | undefined | null): void {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    throw new Error("ADMIN_SECRET is not configured");
  }
  if (typeof provided !== "string" || !timingSafeStringEquals(provided, expected)) {
    throw new Error("Invalid admin secret");
  }
}
