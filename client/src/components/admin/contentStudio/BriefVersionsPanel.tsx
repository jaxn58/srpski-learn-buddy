import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Pencil, Save, Trash2 } from "lucide-react";
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
import { SECTION_OPTIONS } from "./constants";
import { buildSideBySideDiffRows } from "./utils/diffAlgorithm";
import { computeBriefVersionNumbers, formatBriefVersionId } from "./utils/briefVersionLabel";

export interface BriefVersionShape {
  _id: string;
  createdAt: number;
  createdBy?: string;
  label?: string;
  notes?: string;
  curatedSections?: Array<{ section: string; markdown: string }>;
}

export interface BriefVersionsPanelProps {
  versions: BriefVersionShape[] | undefined;
  activeBriefVersionId: string | undefined | null;
  busy: boolean;
  /** Module number of the draft — used to build the `M{module}U{unit}_v{n}` identifier. */
  moduleNumber?: number | string | null;
  /** Unit number of the draft — used to build the `M{module}U{unit}_v{n}` identifier. */
  unitNumber?: number | string | null;
  onSelectVersion: (versionId: string) => void;
  onSaveMilestone: (label: string) => void;
  onRenameVersion: (versionId: string, label: string) => void;
  /**
   * Optional delete handler. Delete button only shown when provided. The
   * button is disabled for the currently active version — the caller must
   * additionally enforce this server-side.
   */
  onDeleteVersion?: (versionId: string) => void;
  /** Hide the internal "Brief Versions" title (e.g. when rendered inside an accordion that already labels it). */
  hideTitle?: boolean;
}

function versionDiffText(v: BriefVersionShape | undefined, notesHeading: string): string {
  if (!v) return "";
  const parts: string[] = [];
  if (v.notes?.trim()) parts.push(`${notesHeading}\n${v.notes.trim()}`);
  for (const c of v.curatedSections ?? []) {
    const label = SECTION_OPTIONS.find((s) => s.value === c.section)?.label || c.section;
    parts.push(`\n${label.toUpperCase()}:\n${c.markdown.trim()}`);
  }
  return parts.join("\n");
}

export function BriefVersionsPanel({
  versions,
  activeBriefVersionId,
  busy,
  moduleNumber,
  unitNumber,
  onSelectVersion,
  onSaveMilestone,
  onRenameVersion,
  onDeleteVersion,
  hideTitle,
}: BriefVersionsPanelProps) {
  const { t } = useTranslation();
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [diffLeftId, setDiffLeftId] = useState<string>("");
  const [diffRightId, setDiffRightId] = useState<string>("");
  const [showDiff, setShowDiff] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  const list = versions ?? [];

  const versionNumbers = useMemo(() => computeBriefVersionNumbers(list), [list]);
  const idOf = (v: BriefVersionShape) =>
    formatBriefVersionId(moduleNumber, unitNumber, versionNumbers.get(String(v._id)));

  const diffRows = useMemo(() => {
    if (!showDiff) return [];
    const left = list.find((v) => v._id === diffLeftId);
    const right = list.find((v) => v._id === diffRightId);
    const notesHeading = t("admin.contentStudio.briefingVersions.diffNotesHeading", "BRIEFING:");
    return buildSideBySideDiffRows(versionDiffText(left, notesHeading), versionDiffText(right, notesHeading));
  }, [showDiff, diffLeftId, diffRightId, list, t]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {hideTitle ? (
          <span />
        ) : (
          <Label className="font-semibold">{t("admin.contentStudio.briefingVersions.title", "Briefing versions")}</Label>
        )}
        {list.length >= 2 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowDiff((v) => !v)}>
            {showDiff
              ? t("admin.contentStudio.briefingVersions.hideDiff", "Hide diff")
              : t("admin.contentStudio.briefingVersions.diffTwoVersions", "Compare two versions")}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <Trans
          i18nKey="admin.contentStudio.briefingVersions.numberingHint"
          defaults="Versions are numbered <mono>M#U#_v#</mono>. &quot;Adopt into Briefing&quot; and &quot;Save current as version&quot; add a new one. Selecting an older version makes it the status quo — nothing is deleted."
          components={{ mono: <span className="font-mono" /> }}
        />
      </p>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {t(
            "admin.contentStudio.briefingVersions.empty",
            "No briefing versions yet. Adopt a reviewed section (Rendered tab) or save a milestone below."
          )}
        </p>
      ) : (
        <ScrollArea className="max-h-[280px] rounded border">
          <div className="divide-y">
            {list.map((v) => {
              const isActive = String(v._id) === String(activeBriefVersionId);
              const isRenaming = renamingId === v._id;
              const sectionCount = v.curatedSections?.length ?? 0;
              return (
                <div key={v._id} className={cn("px-2 py-1.5", isActive && "bg-primary/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-1.5 min-w-0"
                      title={new Date(v.createdAt).toLocaleString()}
                    >
                      {isActive && (
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-primary shrink-0"
                          aria-label={t("admin.contentStudio.briefingVersions.active", "Active")}
                        />
                      )}
                      <span className="font-mono text-xs font-semibold shrink-0">{idOf(v)}</span>
                      {v.label ? (
                        <span className="text-[11px] text-muted-foreground truncate">{v.label}</span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                        {t("admin.contentStudio.briefingVersions.sectionCount", { defaultValue: "· {{n}} sec", n: sectionCount })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2"
                          disabled={busy}
                          onClick={() => onSelectVersion(v._id)}
                        >
                          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                          {t("admin.contentStudio.briefingVersions.select", "Select")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        title={t("admin.contentStudio.briefingVersions.renameTitle", "Name (optional)")}
                        onClick={() => {
                          setRenamingId(v._id);
                          setRenameValue(v.label || "");
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {onDeleteVersion && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          title={
                            isActive
                              ? t(
                                  "admin.contentStudio.briefingVersions.cannotDeleteActive",
                                  "Cannot delete the active version — select another version first"
                                )
                              : t("admin.contentStudio.briefingVersions.deleteVersion", "Delete this version")
                          }
                          disabled={isActive || busy}
                          onClick={() => setDeleteCandidateId(v._id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isRenaming && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder={t("admin.contentStudio.briefingVersions.namePlaceholder", "Optional name…")}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          onRenameVersion(v._id, renameValue);
                          setRenamingId(null);
                        }}
                      >
                        {t("admin.contentStudio.briefingVersions.save", "Save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setRenamingId(null)}
                      >
                        {t("admin.contentStudio.briefingVersions.cancel", "Cancel")}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={milestoneLabel}
          onChange={(e) => setMilestoneLabel(e.target.value)}
          placeholder={t("admin.contentStudio.briefingVersions.namePlaceholder", "Optional name…")}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8 text-xs shrink-0"
          disabled={busy}
          onClick={() => {
            onSaveMilestone(milestoneLabel.trim());
            setMilestoneLabel("");
          }}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          {t("admin.contentStudio.briefingVersions.saveCurrent", "Save current as version")}
        </Button>
      </div>

      {showDiff && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Select value={diffLeftId} onValueChange={setDiffLeftId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("admin.contentStudio.briefingVersions.diffLeft", "Left (older)")} />
              </SelectTrigger>
              <SelectContent>
                {list.map((v) => (
                  <SelectItem key={v._id} value={v._id} className="text-xs">
                    <span className="font-mono">{idOf(v)}</span>
                    {v.label ? ` · ${v.label}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={diffRightId} onValueChange={setDiffRightId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("admin.contentStudio.briefingVersions.diffRight", "Right (newer)")} />
              </SelectTrigger>
              <SelectContent>
                {list.map((v) => (
                  <SelectItem key={v._id} value={v._id} className="text-xs">
                    <span className="font-mono">{idOf(v)}</span>
                    {v.label ? ` · ${v.label}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[260px] rounded border">
            <div className="p-2 space-y-1">
              {diffRows.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  {t("admin.contentStudio.briefingVersions.diffSelectBoth", "Select both versions to compare.")}
                </div>
              ) : (
                diffRows.map((row, idx) => {
                  const leftClass =
                    row.left?.op === "del"
                      ? "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200"
                      : "bg-transparent";
                  const rightClass =
                    row.right?.op === "add"
                      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : "bg-transparent";
                  return (
                    <div key={idx} className="grid grid-cols-2 gap-2">
                      <div
                        className={cn(
                          "min-h-[18px] rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-pre-wrap break-words",
                          leftClass,
                        )}
                      >
                        {row.left ? row.left.line : ""}
                      </div>
                      <div
                        className={cn(
                          "min-h-[18px] rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-pre-wrap break-words",
                          rightClass,
                        )}
                      >
                        {row.right ? row.right.line : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {onDeleteVersion && (
        <AlertDialog
          open={deleteCandidateId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteCandidateId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("admin.contentStudio.briefingVersions.deleteTitle", "Delete this briefing version?")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteCandidateId
                  ? (() => {
                      const v = list.find((x) => x._id === deleteCandidateId);
                      const id = v ? idOf(v) : "";
                      const label = v?.label?.trim();
                      return (
                        <>
                          <span className="font-mono">{id}</span>
                          {label ? ` · ${label}` : ""}
                          {" "}
                          {t(
                            "admin.contentStudio.briefingVersions.deleteDescription",
                            "will be removed from history. This cannot be undone. The live briefing (description, reference notes, curated sections) is not affected."
                          )}
                        </>
                      );
                    })()
                  : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.contentStudio.briefingVersions.cancel", "Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteCandidateId) {
                    onDeleteVersion(deleteCandidateId);
                    setDeleteCandidateId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("admin.contentStudio.briefingVersions.delete", "Delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
