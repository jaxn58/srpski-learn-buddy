import { cn } from "@/lib/utils";
import { DRAFT_STATUS_LABEL } from "./constants";
import type { DraftStatusKey } from "./types";

export function renderDraftStatusPill(status: string) {
  const s = String(status || "draft") as DraftStatusKey;
  const label = DRAFT_STATUS_LABEL[s] ?? String(status || "");
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

export function DraftStatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const color =
    status === "ready_to_publish" || status === "published" || status === "qc_passed"
      ? "bg-emerald-500"
      : status === "qc_failed" || status === "audit_failed"
        ? "bg-red-500"
        : "bg-muted-foreground";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-white text-xs ${color}`}>
      {DRAFT_STATUS_LABEL[status as DraftStatusKey] ?? String(status)}
    </span>
  );
}
