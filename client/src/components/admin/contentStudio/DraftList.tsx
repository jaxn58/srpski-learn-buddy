import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { renderDraftStatusPill } from "./StatusBadge";

export interface DraftListProps {
  drafts: any[] | undefined;
  filteredDrafts: any[];
  selectedDraftId: string | null;
  onSelectDraft: (id: any) => void;
  draftsSearch: string;
  setDraftsSearch: (v: string) => void;
  draftsStatusFilter: string;
  setDraftsStatusFilter: (v: any) => void;
  batchSelectedDraftIds: string[];
  toggleBatchSelectDraft: (draftId: string, checked: boolean) => void;
  selectAllFilteredDrafts: () => void;
  clearBatchSelection: () => void;
  batchRunning: boolean;
  batchProgress: { current: number; total: number; label: string } | null;
  batchResults: Array<{ draftId: string; action: string; status: "success" | "failed"; message?: string }>;
  isBusy: boolean;
  onRunBatch: (action: "generate" | "validate" | "preview") => void;
}

export function DraftList({
  drafts,
  filteredDrafts,
  selectedDraftId,
  onSelectDraft,
  draftsSearch,
  setDraftsSearch,
  draftsStatusFilter,
  setDraftsStatusFilter,
  batchSelectedDraftIds,
  toggleBatchSelectDraft,
  selectAllFilteredDrafts,
  clearBatchSelection,
  batchRunning,
  batchProgress,
  batchResults,
  isBusy,
  onRunBatch,
}: DraftListProps) {
  return (
    <Card className="h-fit">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Drafts</CardTitle>
          <Badge variant="secondary">{drafts?.length ?? 0}</Badge>
        </div>
        <div className="grid gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={draftsSearch}
              onChange={(e) => setDraftsSearch(e.target.value)}
              className="pl-8"
              placeholder="Search (title, U#, M#)"
            />
          </div>
          <Select value={draftsStatusFilter} onValueChange={(v) => setDraftsStatusFilter(v as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="qc_failed">Validator failed</SelectItem>
              <SelectItem value="qc_passed">Validated</SelectItem>
              <SelectItem value="audit_failed">Lector flagged issues</SelectItem>
              <SelectItem value="ready_to_publish">Ready to publish</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2 pb-3">
          <div className="text-xs text-muted-foreground">
            Batch select: <span className="font-medium">{batchSelectedDraftIds.length}</span> selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={selectAllFilteredDrafts}
              disabled={batchRunning || filteredDrafts.length === 0}
            >
              Select filtered
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={clearBatchSelection}
              disabled={batchRunning || (batchSelectedDraftIds.length === 0 && batchResults.length === 0)}
            >
              Clear
            </Button>
          </div>
        </div>

        {batchSelectedDraftIds.length > 0 ? (
          <div className="mb-3 space-y-2 rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Batch actions</div>
              <Badge variant="secondary">{batchSelectedDraftIds.length} drafts</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void onRunBatch("generate")} disabled={batchRunning || isBusy}>
                Batch Generate
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onRunBatch("validate")}
                disabled={batchRunning || isBusy}
              >
                Batch Validate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void onRunBatch("preview")}
                disabled={batchRunning || isBusy}
              >
                Batch Publish to Preview
              </Button>
            </div>

            {batchProgress ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{batchProgress.label}</span>
                  <span className="tabular-nums">
                    {batchProgress.current}/{batchProgress.total}
                  </span>
                </div>
                <Progress value={Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)} />
              </div>
            ) : null}

            {batchResults.length > 0 ? (
              <div className="max-h-[160px] overflow-auto rounded border p-2 text-xs">
                <div className="space-y-1">
                  {batchResults
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((r, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2">
                        <span className="font-mono text-muted-foreground">{String(r.draftId).slice(0, 8)}</span>
                        <span className="text-muted-foreground">{r.action}</span>
                        <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>
                          {r.status}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {r.message ? String(r.message) : ""}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <ScrollArea className="max-h-[560px] pr-1">
          <div className="space-y-1">
            {drafts === undefined ? (
              <div className="text-sm text-muted-foreground">Loading drafts…</div>
            ) : filteredDrafts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No drafts found.</div>
            ) : (
              filteredDrafts.map((d: any) => {
                const isSelected = selectedDraftId === d._id;
                const isBatchSelected = batchSelectedDraftIds.includes(String(d._id));
                const status = String(d.status || "draft");
                const statusDot =
                  status === "published" || status === "ready_to_publish" || status === "qc_passed"
                    ? "bg-emerald-500"
                    : status === "qc_failed" || status === "audit_failed"
                      ? "bg-red-500"
                      : "bg-muted-foreground/50";
                const statusShort: Record<string, string> = {
                  draft: "Draft",
                  qc_failed: "QC Failed",
                  qc_passed: "QC OK",
                  audit_failed: "Review",
                  ready_to_publish: "Ready",
                  published: "Published",
                };
                return (
                  <div key={d._id} className="flex items-stretch gap-1.5">
                    <div className="flex items-center pt-0.5">
                      <Checkbox
                        checked={isBatchSelected}
                        onCheckedChange={(checked) => toggleBatchSelectDraft(String(d._id), Boolean(checked))}
                        disabled={batchRunning}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectDraft(d._id)}
                      className={cn(
                        "flex-1 min-w-0 text-left rounded-md border px-2.5 py-1.5 transition-colors",
                        isSelected
                          ? "border-primary/40 bg-primary/8 ring-1 ring-primary/20"
                          : "hover:bg-muted/50 border-transparent hover:border-border"
                      )}
                    >
                      {/* Row 1: Unit#, Module, Status */}
                      <div className="flex items-center justify-between gap-1.5 mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold tabular-nums text-foreground">
                            U{d.unitNumber}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            M{d.moduleNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", statusDot)} />
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {statusShort[status] ?? status}
                          </span>
                        </div>
                      </div>
                      {/* Row 2: Title */}
                      <div className="text-xs font-medium leading-snug line-clamp-2 text-foreground/90">
                        {String(d.title || "Untitled").trim()}
                      </div>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
