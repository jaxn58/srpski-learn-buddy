import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SECTION_OPTIONS } from "../constants";

/**
 * Localized label for a unit section id ("overview", "vocabulary", ...).
 * `SECTION_OPTIONS` stays the English fallback and the single list of ids;
 * translations live under `admin.contentStudio.section.<id>`.
 */
export function useSectionLabel() {
  const { t } = useTranslation();
  return useCallback(
    (sectionId: string): string => {
      const fallback = SECTION_OPTIONS.find((s) => s.value === sectionId)?.label || sectionId;
      return t(`admin.contentStudio.section.${sectionId}`, fallback);
    },
    [t],
  );
}
