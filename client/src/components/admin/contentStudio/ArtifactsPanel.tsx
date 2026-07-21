/**
 * ArtifactsPanel — Markdown / Rendered / JSON / Diff views of a Draft's
 * current Snapshot.
 *
 * Nomenclature reminder (see convex/contentStudio/_briefVersions.ts for the
 * full definitions): a Draft is the foundation of a unit's work and is never
 * the same thing as its Markdown. Markdown is the AI-generated artifact that
 * results from the Draft's Brief going through the Creator or Section-Revise,
 * held on a Snapshot. The "Rendered" tab below shows that Markdown and lets
 * the human either Adopt a revised section INTO the Brief, or Refuse it
 * (revert the Markdown one step) — neither action ever turns Markdown into
 * the Draft itself.
 */
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Eye, Loader2, PlusCircle, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { SectionId } from "./types";
import { SECTION_OPTIONS } from "./constants";
import { splitMarkdownIntoSections } from "./utils/sectionSplit";

export interface CuratedSectionInfo {
  section: SectionId;
  adoptedAt: number;
}

/**
 * A Section-Revise that has not yet been adopted into the Brief. Rendered in
 * the "Rendered" tab as a visual cue (accent border + Adopt-button
 * highlight) so the human reviewer clicks the correct section's Adopt-into-
 * Brief button (and not a neighboring one).
 *
 * Nomenclature reminder: this is Markdown-level state on the Draft's current
 * Snapshot, not the Draft itself and not the Brief. Adopting copies it INTO
 * the Brief (contentDrafts.curatedSections); refusing reverts the Markdown
 * one step and never touches the Brief.
 */
export interface PendingSectionRevisionInfo {
  section: SectionId;
  instruction: string;
  at: number;
}

export interface ArtifactsPanelProps {
  selected: any;
  selectedDraftId: string | null;
  isBusy: boolean;
  creatingPreview: boolean;
  markdownText: string;
  setMarkdownText: (v: string) => void;
  markdownDirty: boolean;
  restoreMarkdownText: string;
  setRestoreMarkdownText: (v: string) => void;
  setRestoreMarkdownUpdatedAt: (v: number | null) => void;
  restoreMarkdownUpdatedAt: number | null;
  markdownLocalStorageKey: string;
  unitPackageJson: string;
  setUnitPackageJson: (v: string) => void;
  preview: { ok: true; pkg: any } | { ok: false; error: string };
  draftSnapshots: any[] | undefined;
  diffLeftSnapshotId: string;
  setDiffLeftSnapshotId: (v: string) => void;
  diffRightSnapshotId: string;
  setDiffRightSnapshotId: (v: string) => void;
  diffRows: Array<{
    left: { op: "equal" | "del"; line: string } | null;
    right: { op: "equal" | "add"; line: string } | null;
  }>;
  onSaveMarkdown: () => void;
  onCreatePreview: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onLoadMarkdownFromSnapshot: () => void;
  onLoadFromSnapshot: () => void;
  onSaveJson: () => void;
  t: (key: string, params?: any) => string;
  /** Sections already adopted into the Brief (contentDrafts.curatedSections). */
  curatedSections?: CuratedSectionInfo[];
  /** True while the bulk adoption is running (spinner state). */
  adoptingChanges?: boolean;
  /**
   * Adopt ALL pending (revised-but-not-yet-adopted) sections into the Brief
   * in one step (creates a single new Brief Version). There is deliberately
   * no per-section adopt — the human only ever revises one section at a time,
   * and unchanged sections must not be "adopted".
   */
  onAdoptChanges?: () => void;
  /**
   * Section-Revises performed since the section's last adoption (or since
   * ever, if never adopted). Drives the visual highlight in the Rendered-tab
   * that tells the human which section(s) they revised, and gates the global
   * "Adopt changes into Brief" button.
   */
  pendingSectionRevisions?: PendingSectionRevisionInfo[];
  /**
   * True when a Preview has been created for the *current* snapshot. Adoption
   * is gated behind this: the human must review a preview of the current state
   * before a section can be adopted into the Brief.
   */
  previewCurrent?: boolean;
  /**
   * Refuse a single pending Section-Revise: reverts that section's Markdown
   * to the version it had immediately before the revise (one step back —
   * never the whole revision history of the section). The Brief is never
   * modified by this. Per-section (unlike the bulk Adopt), since refusing
   * one revised section says nothing about the others.
   */
  onRefuseChanges?: (section: SectionId) => void;
  /** Section currently being reverted (spinner / disabled state). */
  refusingSection?: SectionId | null;
}

export function ArtifactsPanel({
  selected,
  selectedDraftId,
  isBusy,
  creatingPreview,
  markdownText,
  setMarkdownText,
  markdownDirty,
  restoreMarkdownText,
  setRestoreMarkdownText,
  setRestoreMarkdownUpdatedAt,
  restoreMarkdownUpdatedAt,
  markdownLocalStorageKey,
  unitPackageJson,
  setUnitPackageJson: _setUnitPackageJson,
  preview,
  draftSnapshots,
  diffLeftSnapshotId,
  setDiffLeftSnapshotId,
  diffRightSnapshotId,
  setDiffRightSnapshotId,
  diffRows,
  onSaveMarkdown,
  onCreatePreview,
  onCopyMarkdown,
  onDownloadMarkdown,
  onLoadMarkdownFromSnapshot,
  onLoadFromSnapshot,
  onSaveJson,
  t,
  curatedSections,
  adoptingChanges,
  onAdoptChanges,
  previewCurrent,
  pendingSectionRevisions,
  onRefuseChanges,
  refusingSection,
}: ArtifactsPanelProps) {
  void _setUnitPackageJson;

  const curatedBySection = new Map<SectionId, CuratedSectionInfo>(
    (curatedSections ?? []).map((c) => [c.section, c])
  );
  const pendingBySection = new Map<SectionId, PendingSectionRevisionInfo>(
    (pendingSectionRevisions ?? []).map((p) => [p.section, p]),
  );
  const renderedSections = markdownText.trim() ? splitMarkdownIntoSections(markdownText) : [];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Artifacts</CardTitle>
          {(selected as any)?.snapshot?.createdAt ? (
            <span className="text-xs text-muted-foreground">
              {new Date((selected as any).snapshot.createdAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs defaultValue="markdown" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="rendered">Rendered</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>

          <TabsContent value="markdown" className="mt-4 space-y-3">
            {markdownDirty && selectedDraftId && (
              <div className="rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                Unsaved changes — click <strong>Save Markdown</strong> or use <strong>Save &amp; Create Preview</strong> to include your edits in the preview.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={onSaveMarkdown}
                disabled={isBusy || !selectedDraftId || !markdownText.trim()}
                className={markdownDirty ? "border-amber-500 ring-1 ring-amber-500" : ""}
              >
                Save Markdown{markdownDirty ? " *" : ""}
              </Button>
              <Button
                size="sm"
                onClick={onCreatePreview}
                disabled={isBusy || !selectedDraftId || !markdownText.trim()}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                {creatingPreview ? "Creating preview…" : "Save & Create Preview"}
              </Button>
              <Button size="sm" variant="secondary" onClick={onCopyMarkdown} disabled={!markdownText.trim()}>
                Copy
              </Button>
              <Button size="sm" variant="secondary" onClick={onDownloadMarkdown} disabled={!markdownText.trim()}>
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onLoadMarkdownFromSnapshot}
                disabled={isBusy || !selectedDraftId}
              >
                Load from snapshot
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Preview only — publishing (Update / Replace) happens in the <strong>Unit Manager</strong>.
            </p>

            {restoreMarkdownText.trim() ? (
              <div className="rounded border bg-muted/30 p-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Local autosave found{" "}
                  {restoreMarkdownUpdatedAt ? `(${new Date(restoreMarkdownUpdatedAt).toLocaleString()})` : ""}.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setMarkdownText(restoreMarkdownText);
                      toast.success(t("admin.contentStudio.toast.autosaveRestored"));
                    }}
                  >
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      try {
                        if (markdownLocalStorageKey) localStorage.removeItem(markdownLocalStorageKey);
                      } catch {
                        // ignore
                      }
                      setRestoreMarkdownText("");
                      setRestoreMarkdownUpdatedAt(null);
                      toast.success(t("admin.contentStudio.toast.autosaveDiscarded"));
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : null}

            <Textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              placeholder="No markdown yet. Run Creator first."
              className="min-h-[420px] font-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              Tip: Use “Edit Content” (right) for section-based revisions; then Save Markdown if you make manual edits.
            </div>
          </TabsContent>

          <TabsContent value="rendered" className="mt-4 space-y-3">
            {markdownText.trim() ? (
              <>
                <div className="text-xs text-muted-foreground">
                  {markdownDirty ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Unsaved changes</span>
                  ) : (
                    <span>Markdown is saved.</span>
                  )}
                </div>

                {onAdoptChanges &&
                  (pendingBySection.size > 0 ? (
                    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-3 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-semibold text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        {pendingBySection.size === 1
                          ? "1 section revised — not yet in the Brief"
                          : `${pendingBySection.size} sections revised — not yet in the Brief`}
                      </div>
                      <div className="text-[11px] leading-relaxed text-foreground">
                        The revised section{pendingBySection.size === 1 ? " is" : "s are"} highlighted below. Click{" "}
                        <strong>Adopt changes into Brief</strong> to persist{" "}
                        {pendingBySection.size === 1 ? "it" : "them"} — your instruction (the cause) and the resulting
                        Markdown (the effect) are written into a single new Brief Version. Unchanged sections are left
                        untouched.
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <Button
                          size="sm"
                          className="h-8 text-xs shadow-sm"
                          disabled={markdownDirty || adoptingChanges || !previewCurrent}
                          title={
                            markdownDirty
                              ? "Save Markdown first"
                              : !previewCurrent
                                ? "Create & review a Preview of the current state first"
                                : "Adopt all revised sections into a new Brief Version"
                          }
                          onClick={() => onAdoptChanges()}
                        >
                          {adoptingChanges ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {pendingBySection.size === 1
                            ? "Adopt changes into Brief"
                            : `Adopt ${pendingBySection.size} changes into Brief`}
                        </Button>
                        {!previewCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={isBusy || !selectedDraftId || !markdownText.trim()}
                            onClick={onCreatePreview}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            {creatingPreview ? "Creating preview…" : "Save & Create Preview"}
                          </Button>
                        )}
                        {markdownDirty ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Save Markdown first — adoption reads the last saved snapshot, not unsaved edits.
                          </span>
                        ) : !previewCurrent ? (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            Create &amp; review a Preview of the current state first.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
                      No section changes pending. Revise a section in the <strong>Edit Content</strong> panel; the
                      revised section will appear highlighted here with an <strong>Adopt changes into Brief</strong>{" "}
                      button, so a future full Creator regeneration builds upon your approved edits instead of
                      discarding them.
                    </div>
                  ))}

                {renderedSections.length > 0 ? (
                  <div className="space-y-4">
                    {renderedSections.map((block) => {
                      const label = SECTION_OPTIONS.find((s) => s.value === block.id)?.label || block.id;
                      const curated = curatedBySection.get(block.id);
                      const pending = pendingBySection.get(block.id);
                      return (
                        <div
                          key={block.id}
                          data-section-id={block.id}
                          className={cn(
                            "rounded-lg border bg-card p-4 space-y-2",
                            pending && "border-2 border-primary/60 shadow-md ring-1 ring-primary/20",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {label}
                              </span>
                              {pending && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] gap-1 bg-primary text-primary-foreground"
                                  title={`Revised ${new Date(pending.at).toLocaleString()}\nInstruction: ${pending.instruction}`}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Just revised
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {curated && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] gap-1"
                                  title={new Date(curated.adoptedAt).toLocaleString()}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  In Brief
                                </Badge>
                              )}
                              {pending && onRefuseChanges && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                                  disabled={refusingSection === block.id}
                                  title="Revert this section to the version it had before this revise (one step back). The Brief is not affected."
                                  onClick={() => onRefuseChanges(block.id)}
                                >
                                  {refusingSection === block.id ? (
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  ) : (
                                    <Undo2 className="h-3 w-3 mr-1" />
                                  )}
                                  Refuse & revert
                                </Button>
                              )}
                            </div>
                          </div>
                          {pending && (
                            <div className="rounded border border-primary/30 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground leading-snug">
                              <span className="font-semibold text-foreground">Your instruction:</span>{" "}
                              <span className="italic">{pending.instruction}</span>
                            </div>
                          )}
                          <MarkdownContent content={block.content} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card p-4">
                    <MarkdownContent content={markdownText} />
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No markdown to render yet.</div>
            )}
          </TabsContent>

          <TabsContent value="json" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onLoadFromSnapshot}
                disabled={isBusy || !selectedDraftId}
              >
                Load snapshot JSON
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={onSaveJson}
                disabled={isBusy || !selectedDraftId || !unitPackageJson.trim()}
              >
                Save JSON snapshot
              </Button>
            </div>

            {preview.ok ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(preview.pkg, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{preview.error}</div>
            )}
          </TabsContent>

          <TabsContent value="diff" className="mt-4 space-y-3">
            {Array.isArray(draftSnapshots) && draftSnapshots.length > 0 ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Left (older)</Label>
                    <Select
                      value={diffLeftSnapshotId || (draftSnapshots[0]?._id ? String(draftSnapshots[0]._id) : "")}
                      onValueChange={(v) => setDiffLeftSnapshotId(String(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftSnapshots.map((s: any) => (
                          <SelectItem key={String(s._id)} value={String(s._id)}>
                            {new Date(Number(s.createdAt)).toLocaleString()} • {String(s._id).slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Right (newer)</Label>
                    <Select
                      value={diffRightSnapshotId || (draftSnapshots[0]?._id ? String(draftSnapshots[0]._id) : "")}
                      onValueChange={(v) => setDiffRightSnapshotId(String(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select snapshot" />
                      </SelectTrigger>
                      <SelectContent>
                        {draftSnapshots.map((s: any) => (
                          <SelectItem key={String(s._id)} value={String(s._id)}>
                            {new Date(Number(s.createdAt)).toLocaleString()} • {String(s._id).slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        const a = diffLeftSnapshotId;
                        const b = diffRightSnapshotId;
                        setDiffLeftSnapshotId(b);
                        setDiffRightSnapshotId(a);
                      }}
                      disabled={!diffLeftSnapshotId || !diffRightSnapshotId}
                    >
                      Swap
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Green = added (right), red = removed (left). This compares <b>Markdown</b> between two snapshots.
                </div>

                <ScrollArea className="h-[420px] rounded border">
                  <div className="p-2 space-y-1">
                    {diffRows.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No diff.</div>
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
                                "min-h-[20px] rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words",
                                leftClass,
                              )}
                            >
                              {row.left ? row.left.line : ""}
                            </div>
                            <div
                              className={cn(
                                "min-h-[20px] rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words",
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
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No snapshots yet. Run Creator first.</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
