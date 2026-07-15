/** Default slug for the beta-tester dashboard banner (must match DB row `key`). */
export const DASHBOARD_BETA_BANNER_KEY = "dashboard_beta";

/** localStorage key for per-user banner dismiss (includes activation generation). */
export function dashboardAnnouncementDismissKey(
  userId: string,
  bannerKey: string,
  activationGeneration: number,
): string {
  return `dashboard_announcement_dismissed_${userId}_${bannerKey}_${activationGeneration}`;
}

/** Legacy dismiss keys (generation 1 / dashboard_beta only). */
export function legacyDashboardAnnouncementDismissKeys(userId: string, bannerKey: string): string[] {
  const keys = [`dashboard_announcement_dismissed_${userId}_${bannerKey}`];
  if (bannerKey === DASHBOARD_BETA_BANNER_KEY) {
    keys.push(`beta_banner_dismissed_${userId}`);
  }
  return keys;
}
