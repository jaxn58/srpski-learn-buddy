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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { isLectorStale } from "./utils/draftReviewState";
import { ChevronDown, ChevronRight, FilePlus2, Folder, GitBranch, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DRAFT_STATUS_LABEL } from "./constants";
export interface DraftListProps {
  drafts: any[] | undefined;
  filteredDrafts: any[];
  selectedDraftId: string | null;
  /** True while the New Draft form is open in the workspace. */
  isCreateMode: boolean;
  onSelectDraft: (id: any) => void;
  /** Opens the New Draft form (clears selection). */
  onNewDraft: () => void;
  draftsSearch: string;
  setDraftsSearch: (v: string) => void;
  draftsStatusFilter: string;
  setDraftsStatusFilter: (v: any) => void;
  onDeleteDraft: (draftId: string) => Promise<void>;
  /**
   * Short label (milestone name or timestamp) of the active Brief Version for
   * the currently selected draft. Shown only under the selected row.
   */
  activeBriefVersionSummary?: string | null;
}

export function DraftList({
  drafts,
  filteredDrafts,
  selectedDraftId,
  isCreateMode,
  onSelectDraft,
  onNewDraft,
  draftsSearch,
  setDraftsSearch,
  draftsStatusFilter,
  setDraftsStatusFilter,
  onDeleteDraft,
  activeBriefVersionSummary,
}: DraftListProps) {
  const { t } = useTranslation();
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [collapsedModules, setCollapsedModules] = useState<Set<number>>(new Set());

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

  const toggleModule = (moduleNumber: number) =>
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleNumber)) next.delete(moduleNumber);
      else next.add(moduleNumber);
      return next;
    });

  // Group drafts by module (folder), modules ascending, units ascending within.
  const draftGroups = useMemo(() => {
    const byModule = new Map<number, any[]>();
    for (const d of filteredDrafts) {
      const m = Number(d?.moduleNumber);
      const key = Number.isFinite(m) ? m : Number.POSITIVE_INFINITY;
      const arr = byModule.get(key) ?? [];
      arr.push(d);
      byModule.set(key, arr);
    }
    return Array.from(byModule.entries())
      .map(([moduleNumber, items]) => ({
        moduleNumber,
        drafts: [...items].sort((a, b) => {
          const ua = Number(a?.unitNumber);
          const ub = Number(b?.unitNumber);
          const na = Number.isFinite(ua) ? ua : Number.POSITIVE_INFINITY;
          const nb = Number.isFinite(ub) ? ub : Number.POSITIVE_INFINITY;
          if (na !== nb) return na - nb;
          return String(a?.title || "").localeCompare(String(b?.title || ""));
        }),
      }))
      .sort((a, b) => a.moduleNumber - b.moduleNumber);
  }, [filteredDrafts]);

  const renderDraftRow = (d: any) => {
    const isSelected = !isCreateMode && selectedDraftId === d._id;
    const status = String(d.status || "draft");
    const statusDot =
      status === "published" || status === "ready_to_publish" || status === "qc_passed"
        ? "bg-emerald-500"
        : status === "qc_failed" || status === "audit_failed"
          ? "bg-red-500"
          : "bg-muted-foreground/50";
    const statusShort: Record<string, string> = {
      draft: t("admin.contentStudio.unitList.statusShort.draft", "In progress"),
      qc_failed: t("admin.contentStudio.unitList.statusShort.qc_failed", "Validator failed"),
      qc_passed: t("admin.contentStudio.unitList.statusShort.qc_passed", "Validated"),
      audit_failed: t("admin.contentStudio.unitList.statusShort.audit_failed", "Lector flagged"),
      ready_to_publish: t("admin.contentStudio.unitList.statusShort.ready_to_publish", "Ready"),
      published: t("admin.contentStudio.unitList.statusShort.published", "Published"),
    };
    // The list has no findings per row, so this only reacts to the recorded
    // audit snapshot (drafts audited before that bookkeeping show nothing).
    const lectorStale = isLectorStale(d);
    return (
      <div key={d._id} className="group flex min-w-0 items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => onSelectDraft(d._id)}
          className={cn(
            "min-w-0 flex-1 overflow-hidden text-left rounded-md border px-2.5 py-1.5 transition-colors",
            isSelected
              ? "border-primary/50 bg-primary/8"
              : "hover:bg-muted/50 border-transparent hover:border-border"
          )}
        >
          {/* Row 1: Unit#, Status */}
          <div className="mb-0.5 flex min-w-0 items-center justify-between gap-1.5">
            <span className="shrink-0 text-[10px] font-bold tabular-nums text-foreground">
              U{d.unitNumber}
            </span>
            <div className="flex min-w-0 items-center justify-end gap-1">
              {lectorStale && (
                <span
                  className="truncate text-[9px] text-amber-600 dark:text-amber-400"
                  title={t("admin.contentStudio.unitList.lectorStaleHint", "Content changed after the last Lector run")}
                >
                  {t("admin.contentStudio.unitList.lectorStaleShort", "Lector outdated")}
                </span>
              )}
              <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
              <span className="truncate text-[9px] text-muted-foreground">
                {statusShort[status] ?? status}
              </span>
            </div>
          </div>
          {/* Row 2: Title */}
          <div className="line-clamp-2 break-words text-[11px] font-medium leading-snug text-foreground/90">
            {String(d.title || t("admin.contentStudio.unitList.untitled", "Untitled")).trim()}
          </div>
          {/* Row 3: Active Brief Version (selected draft only) */}
          {isSelected && activeBriefVersionSummary && (
            <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
              <GitBranch className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate font-mono" title={activeBriefVersionSummary}>
                {activeBriefVersionSummary}
              </span>
            </div>
          )}
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
          aria-label={t("admin.contentStudio.unitList.deleteUnitAria", "Delete unit")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <>
      <Card className="min-w-0 w-full overflow-x-hidden">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{t("admin.contentStudio.unitList.title", "Units in progress")}</CardTitle>
            <Badge variant="secondary">{drafts?.length ?? 0}</Badge>
          </div>

          <Button
            type="button"
            variant={isCreateMode ? "default" : "secondary"}
            size="sm"
            onClick={() => onNewDraft()}
            aria-pressed={isCreateMode}
            className="h-9 w-full justify-start gap-2 font-medium"
          >
            <FilePlus2 className="h-3.5 w-3.5 shrink-0" />
            {t("admin.contentStudio.unitList.newUnit", "New unit")}
          </Button>

          <div className="grid gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={draftsSearch}
                onChange={(e) => setDraftsSearch(e.target.value)}
                className="pl-8"
                placeholder={t("admin.contentStudio.unitList.searchPlaceholder", "Search (title, U#, M#)")}
              />
            </div>
            <Select value={draftsStatusFilter} onValueChange={(v) => setDraftsStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder={t("admin.contentStudio.unitList.filterStatus", "Filter status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.contentStudio.unitList.allStatuses", "All statuses")}</SelectItem>
                <SelectItem value="draft">{t("admin.contentStudio.status.draft", DRAFT_STATUS_LABEL.draft)}</SelectItem>
                <SelectItem value="qc_failed">{t("admin.contentStudio.status.qc_failed", DRAFT_STATUS_LABEL.qc_failed)}</SelectItem>
                <SelectItem value="qc_passed">{t("admin.contentStudio.status.qc_passed", DRAFT_STATUS_LABEL.qc_passed)}</SelectItem>
                <SelectItem value="audit_failed">{t("admin.contentStudio.status.audit_failed", DRAFT_STATUS_LABEL.audit_failed)}</SelectItem>
                <SelectItem value="ready_to_publish">{t("admin.contentStudio.status.ready_to_publish", DRAFT_STATUS_LABEL.ready_to_publish)}</SelectItem>
                <SelectItem value="published">{t("admin.contentStudio.status.published", DRAFT_STATUS_LABEL.published)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="min-w-0 space-y-1">
              {drafts === undefined ? (
                <div className="text-sm text-muted-foreground">{t("admin.contentStudio.unitList.loading", "Loading units…")}</div>
              ) : filteredDrafts.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("admin.contentStudio.unitList.empty", "No units found.")}</div>
              ) : (
                draftGroups.map((g) => {
                  const collapsed = collapsedModules.has(g.moduleNumber);
                  const moduleLabel = Number.isFinite(g.moduleNumber)
                    ? t("admin.contentStudio.unitList.moduleLabel", { defaultValue: "Module {{n}}", n: g.moduleNumber })
                    : t("admin.contentStudio.unitList.noModule", "No module");
                  return (
                    <div key={g.moduleNumber} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleModule(g.moduleNumber)}
                        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
                        aria-expanded={!collapsed}
                      >
                        {collapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                          {moduleLabel}
                        </span>
                        <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0 shrink-0">
                          {g.drafts.length}
                        </Badge>
                      </button>
                      {!collapsed && (
                        <div className="ml-2 min-w-0 space-y-1 border-l pl-2">
                          {g.drafts.map((d: any) => renderDraftRow(d))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!draftToDelete} onOpenChange={(open) => { if (!open && !deleting) setDraftToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.contentStudio.unitList.deleteTitle", "Delete this draft?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.contentStudio.unitList.deleteDescription",
                "This removes only this draft and its snapshots, findings and AI run logs. The published unit and any other drafts are not affected."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("admin.contentStudio.unitList.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleConfirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting
                ? t("admin.contentStudio.unitList.deleting", "Deleting…")
                : t("admin.contentStudio.unitList.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
