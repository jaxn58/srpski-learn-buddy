import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Single source of truth for feature gating on the client.
 *
 * Wraps the `featureAccess.getFeatureAccess` query so UI components and route
 * guards read entitlements from one place. Mirrors the server-side resolution
 * in `convex/featureAccess.ts` – the backend enforces the same rules, the
 * client only hides/shows accordingly.
 *
 * Returns `undefined` while loading (Convex query not yet resolved).
 */
export type FeatureAccess = NonNullable<
  ReturnType<typeof useFeatureAccessQuery>
>;

function useFeatureAccessQuery() {
  return useQuery(api.featureAccess.getFeatureAccess);
}

export function useFeatureAccess() {
  return useFeatureAccessQuery();
}

/**
 * Convenience boolean helpers. While access is still loading we return the
 * `loadingDefault` so the dominant case (full / beta / staff users) does not
 * flash hidden navigation. Route guards use the stricter resolved value.
 */
export function canUseLearning(access: FeatureAccess | undefined, loadingDefault = true): boolean {
  if (access === undefined) return loadingDefault;
  return access.features.learning;
}

export function canUseBuddy(access: FeatureAccess | undefined, loadingDefault = true): boolean {
  if (access === undefined) return loadingDefault;
  return access.features.buddyChat || access.features.teaser;
}

export function canUseDocuments(access: FeatureAccess | undefined, loadingDefault = false): boolean {
  if (access === undefined) return loadingDefault;
  return access.features.documents;
}
