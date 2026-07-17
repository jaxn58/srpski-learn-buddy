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
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import { toast } from "sonner";

export interface ArtifactsPanelProps {
  selected: any;
  selectedDraftId: string | null;
  isBusy: boolean;
  runningPublish: boolean;
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
}

export function ArtifactsPanel({
  selected,
  selectedDraftId,
  isBusy,
  runningPublish,
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
}: ArtifactsPanelProps) {
  void _setUnitPackageJson;
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
                {runningPublish ? "Creating preview…" : "Save & Create Preview"}
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
                <div className="rounded-lg border bg-card p-4">
                  <MarkdownContent content={markdownText} />
                </div>
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
