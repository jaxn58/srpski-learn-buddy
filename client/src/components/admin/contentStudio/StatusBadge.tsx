import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DRAFT_STATUS_LABEL } from "./constants";
import type { DraftStatusKey } from "./types";

/** Localised label for a unit status; falls back to the English map in constants.ts. */
export function useDraftStatusLabel(): (status: string | undefined) => string {
  const { t } = useTranslation();
  return (status) => {
    const key = String(status || "");
    const fallback = DRAFT_STATUS_LABEL[key as DraftStatusKey] ?? key;
    return t(`admin.contentStudio.status.${key}`, fallback);
  };
}

function DraftStatusPill({ status }: { status: string }) {
  const statusLabel = useDraftStatusLabel();
  const s = String(status || "draft") as DraftStatusKey;
  const label = statusLabel(s);
  const className =
    s === "ready_to_publish" || s === "published" || s === "qc_passed"
      ? "bg-emerald-600 text-white"
      : s === "qc_failed" || s === "audit_failed"
        ? "bg-red-600 text-white"
        : "bg-muted-foreground text-white";
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium", className)}>
      {label}
    </span>
  );
}

/**
 * Plain-function helper kept for backward compatibility. Delegates to a
 * component so the label is translated at render time.
 */
export function renderDraftStatusPill(status: string) {
  return <DraftStatusPill status={status} />;
}

export function DraftStatusBadge({ status }: { status: string | undefined }) {
  const statusLabel = useDraftStatusLabel();
  if (!status) return null;
  const color =
    status === "ready_to_publish" || status === "published" || status === "qc_passed"
      ? "bg-emerald-500"
      : status === "qc_failed" || status === "audit_failed"
        ? "bg-red-500"
        : "bg-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-white text-xs ${color}`}>
      {statusLabel(status)}
    </span>
  );
}
