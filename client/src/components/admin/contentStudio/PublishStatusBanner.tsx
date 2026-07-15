import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// Sticky / inline banner for the last `publishDraftToPreview` run.
// Backed by `contentDrafts.publishState` (see CONTENT_STUDIO_PUBLISH_TIMEOUT_FIX.md §10).

export type PublishStateStage =
  | "metadata"
  | "content"
  | "vocabulary"
  | "tests"
  | "complete";
export type PublishStateStatus = "running" | "success" | "failed";

export interface PublishStateShape {
  status: PublishStateStatus;
  stage: PublishStateStage;
  batchIndex?: number;
  totalBatches?: number;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

const STAGE_LABEL: Record<PublishStateStage, string> = {
  metadata: "Metadata",
  content: "Content",
  vocabulary: "Vocabulary",
  tests: "Tests",
  complete: "Complete",
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function formatDuration(startMs: number, endMs: number): string {
  const s = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export function PublishStatusBanner({
  draftId,
  publishState,
  className,
}: {
  draftId: string;
  publishState: PublishStateShape;
  /** Optional layout tweak (e.g. rounded inset in Unit Manager). */
  className?: string;
}) {
  const publishAction = useAction(api.contentStudio.publishDraftToPreview);
  const [showDetails, setShowDetails] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const stageLabel = STAGE_LABEL[publishState.stage] ?? publishState.stage;
  const hasProgress =
    typeof publishState.batchIndex === "number" &&
    typeof publishState.totalBatches === "number" &&
    publishState.totalBatches > 0;

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await publishAction({ draftId: draftId as Id<"contentDrafts"> });
    } catch {
      // Action already patches publishState; banner re-renders via useQuery.
    } finally {
      setRetrying(false);
    }
  };

  if (publishState.status === "running") {
    return (
      <div
        className={cn(
          "px-4 py-2.5 border-b bg-blue-50 dark:bg-blue-950/30 shrink-0",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-blue-900 dark:text-blue-100">
              Publishing to preview — {stageLabel}
              {hasProgress && (
                <span className="text-blue-700 dark:text-blue-300 font-normal">
                  {" "}
                  (batch {(publishState.batchIndex ?? 0) + 1} / {publishState.totalBatches})
                </span>
              )}
            </div>
            <div className="text-xs text-blue-700/80 dark:text-blue-300/80">
              started at {formatTime(publishState.startedAt)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (publishState.status === "success") {
    const finishedAt = publishState.completedAt ?? publishState.updatedAt;
    return (
      <div
        className={cn(
          "px-4 py-2.5 border-b bg-emerald-50 dark:bg-emerald-950/30 shrink-0",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-emerald-900 dark:text-emerald-100">
              Published to preview successfully
            </div>
            <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {formatTime(publishState.startedAt)} → {formatTime(finishedAt)}
              {" · "}
              {formatDuration(publishState.startedAt, finishedAt)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const errText = publishState.error ?? "Unknown publish error.";
  return (
    <div
      className={cn(
        "px-4 py-2.5 border-b bg-red-50 dark:bg-red-950/30 shrink-0",
        className,
      )}
    >
      <div className="flex items-start gap-2.5 text-sm">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-red-900 dark:text-red-100">
            Publish failed at stage &quot;{stageLabel}&quot;
            {hasProgress && (
              <span className="text-red-700 dark:text-red-300 font-normal">
                {" "}
                (batch {(publishState.batchIndex ?? 0) + 1} / {publishState.totalBatches})
              </span>
            )}
          </div>
          <div className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5 break-words">
            {showDetails
              ? errText
              : errText.slice(0, 180) + (errText.length > 180 ? "…" : "")}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1"
              onClick={() => void handleRetry()}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Retry
            </Button>
            {errText.length > 180 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {showDetails ? "Hide details" : "Details"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
