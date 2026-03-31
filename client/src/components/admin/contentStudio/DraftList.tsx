import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Search, Trash2 } from "lucide-react";
import { useState } from "react";
export interface DraftListProps {
  drafts: any[] | undefined;
  filteredDrafts: any[];
  selectedDraftId: string | null;
  onSelectDraft: (id: any) => void;
  draftsSearch: string;
  setDraftsSearch: (v: string) => void;
  draftsStatusFilter: string;
  setDraftsStatusFilter: (v: any) => void;
  onDeleteDraft: (draftId: string) => Promise<void>;
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
  onDeleteDraft,
}: DraftListProps) {
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!draftToDelete) return;
    setDeleting(true);
    try {
      await onDeleteDraft(draftToDelete);
    } finally {
      setDeleting(false);
      setDraftToDelete(null);
    }
  };

  return (
    <>
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
          <ScrollArea className="max-h-[560px] pr-1">
            <div className="space-y-1">
              {drafts === undefined ? (
                <div className="text-sm text-muted-foreground">Loading drafts…</div>
              ) : filteredDrafts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No drafts found.</div>
              ) : (
                filteredDrafts.map((d: any) => {
                  const isSelected = selectedDraftId === d._id;
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
                    <div key={d._id} className="group flex items-stretch gap-1.5">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-auto w-7 shrink-0 self-stretch rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftToDelete(String(d._id));
                        }}
                        aria-label="Delete draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog open={!!draftToDelete} onOpenChange={(open) => { if (!open && !deleting) setDraftToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft and all its snapshots, findings, and AI run logs. Published units are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleConfirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
