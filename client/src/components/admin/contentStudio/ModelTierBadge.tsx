import { useTranslation } from "react-i18next";
import type { ModelTier } from "./types";
import { TIER_BADGE_CONFIG } from "./constants";

export function ModelTierBadge({ tier }: { tier: ModelTier }) {
  const { t } = useTranslation();
  const cfg = TIER_BADGE_CONFIG[tier];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${cfg.className}`}>
      {t(`admin.contentStudio.modelTier.${tier}`, cfg.label)}
    </span>
  );
}
