import { useTranslation } from "react-i18next";
import { formatDateTimeEU } from "@/lib/utils";

/**
 * Shared meta lines for one `contentDraftAiRuns` row: timestamp and token
 * usage (incl. thinking tokens of reasoning models) plus estimated cost.
 * Used by InspectorPanel and QAFindingsPanel so both views show the same
 * information in the same format.
 */
export type AiRunLike = {
  stage?: string;
  createdAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  thinkingTokens?: number;
  estimatedCostUsd?: number;
};

export function formatAiRunTimestamp(run: AiRunLike): string {
  return typeof run.createdAt === "number" ? formatDateTimeEU(run.createdAt) : "\u2014";
}

export function hasAiRunTokens(run: AiRunLike): boolean {
  return (
    typeof run.inputTokens === "number" ||
    typeof run.outputTokens === "number" ||
    typeof run.totalTokens === "number" ||
    typeof run.thinkingTokens === "number"
  );
}

/** Localised display name for a run stage ("specialist" -> Creator, "auditor" -> Lector). */
export function useAiRunStageLabel(): (stage: string | undefined) => string {
  const { t } = useTranslation();
  return (stage) => {
    if (stage === "specialist") return t("admin.contentStudio.aiRuns.stage.creator", "Creator");
    if (stage === "auditor") return t("admin.contentStudio.aiRuns.stage.lector", "Lector");
    return String(stage ?? "");
  };
}

export function AiRunTokenLine({ run, className }: { run: AiRunLike; className?: string }) {
  const { t, i18n } = useTranslation();
  if (!hasAiRunTokens(run)) return null;
  const locale = i18n.language?.startsWith("de") ? "de-DE" : "en-US";
  const fmt = (n: number | undefined) => (typeof n === "number" ? n.toLocaleString(locale) : "\u2014");
  const sep = " \u2022 ";
  const parts = [
    `${t("admin.contentStudio.aiRuns.tokensIn", "in")} ${fmt(run.inputTokens)}`,
    `${t("admin.contentStudio.aiRuns.tokensOut", "out")} ${fmt(run.outputTokens)}`,
  ];
  if (typeof run.thinkingTokens === "number") {
    parts.push(`${t("admin.contentStudio.aiRuns.tokensThinking", "thinking")} ${fmt(run.thinkingTokens)}`);
  }
  parts.push(`${t("admin.contentStudio.aiRuns.tokensTotal", "total")} ${fmt(run.totalTokens)}`);
  if (typeof run.estimatedCostUsd === "number") {
    parts.push(`$${Number(run.estimatedCostUsd).toFixed(4)}`);
  }
  return (
    <div className={className ?? "text-muted-foreground text-xs"}>
      {t("admin.contentStudio.aiRuns.tokens", "tokens")}: {parts.join(sep)}
    </div>
  );
}
