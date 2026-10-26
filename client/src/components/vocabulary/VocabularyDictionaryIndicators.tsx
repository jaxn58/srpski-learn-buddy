import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Mastery counter shared by the Exercises section, the vocabulary trainer and
 * the dictionary tables.
 * 0 correct: neutral grey, no mark. 1-2: outline "x/3" (in progress).
 * 3 or more: yellow "Mastered" with a star.
 */
export function MasteryIndicator({
  correctCount,
  mastered,
}: {
  correctCount: number;
  mastered: boolean;
}) {
  const { t } = useTranslation();
  const filled = Math.max(0, Math.min(3, correctCount));
  const tooltip = t("common.mastery.tooltip");

  const badge = mastered || correctCount >= 3 ? (
    <Badge
      variant="outline"
      className="border-yellow-200 bg-yellow-50 text-yellow-900 gap-1"
      aria-label={t("common.mastery.aria", { filled: 3 })}
    >
      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
      {t("common.mastered")}
    </Badge>
  ) : filled === 0 ? (
    <Badge
      variant="outline"
      className="border-slate-200 bg-slate-50 text-slate-500 tabular-nums"
      aria-label={t("common.mastery.aria", { filled })}
    >
      0/3
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="tabular-nums"
      aria-label={t("common.mastery.aria", { filled })}
    >
      {filled}/3
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function MistakesIndicator({ count }: { count: number }) {
  const { t } = useTranslation();
  if (!count) return <span className="text-muted-foreground/40">—</span>;

  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-red-700 tabular-nums"
      title={t("vocabulary.incorrect")}
    >
      <XCircle className="h-3 w-3" />
      {count}
    </Badge>
  );
}
