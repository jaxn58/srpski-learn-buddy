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
