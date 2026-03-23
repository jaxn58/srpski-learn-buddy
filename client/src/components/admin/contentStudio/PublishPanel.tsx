import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";

export interface PublishPanelProps {
  selected: any;
  selectedDraftId: string | null;
  isBusy: boolean;
  runningPublish: boolean;
  runningTranslateDe: boolean;
  runningApprovePreview: boolean;
  publishMode: string;
  setPublishMode: (v: any) => void;
  publishModuleId: string;
  setPublishModuleId: (v: string) => void;
  modules: any[] | undefined;
  canPublishLive: boolean;
  approvedMarkdown: any;
  translateDeOpen: boolean;
  setTranslateDeOpen: (v: boolean) => void;
  translateDeConfirmation: string;
  setTranslateDeConfirmation: (v: string) => void;
  translateDePreview: any;
  deleteUnitOpen: boolean;
  setDeleteUnitOpen: (v: boolean) => void;
  deleteConfirmation: string;
  setDeleteConfirmation: (v: string) => void;
  onPublishToPreview: () => void;
  onTakePreviewOffline: () => void;
  onApprovePreview: () => void;
  onDownloadApprovedMarkdown: () => void;
  onPublish: () => void;
  onDeleteUnit: () => void;
  onTranslatePublishedToGerman: () => void;
  cfgSpecialistProvider: string;
}

export function PublishPanel({
  selected,
  selectedDraftId,
  isBusy,
  runningPublish,
  runningTranslateDe,
  runningApprovePreview,
  publishMode,
  setPublishMode,
  publishModuleId,
  setPublishModuleId,
  modules,
  canPublishLive,
  approvedMarkdown,
  translateDeOpen,
  setTranslateDeOpen,
  translateDeConfirmation,
  setTranslateDeConfirmation,
  translateDePreview,
  deleteUnitOpen,
  setDeleteUnitOpen,
  deleteConfirmation,
  setDeleteConfirmation,
  onPublishToPreview,
  onTakePreviewOffline,
  onApprovePreview,
  onDownloadApprovedMarkdown,
  onPublish,
  onDeleteUnit,
  onTranslatePublishedToGerman,
  cfgSpecialistProvider: _cfgSpecialistProvider,
}: PublishPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Mode</Label>
            <Select value={publishMode} onValueChange={(v) => setPublishMode(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="update">update</SelectItem>
                <SelectItem value="replace">replace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label>Module (optional)</Label>
            <Select value={publishModuleId} onValueChange={setPublishModuleId}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-link by moduleNumber" />
              </SelectTrigger>
              <SelectContent>
                {(modules || []).map((m: any) => (
                  <SelectItem key={m._id} value={m._id}>
                    {m.moduleNumber} – {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Button variant="secondary" onClick={onPublishToPreview} disabled={isBusy || !selectedDraftId}>
              {runningPublish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {runningPublish ? "Publishing…" : "Publish to Preview (Superadmin)"}
            </Button>

            <Button variant="outline" onClick={onTakePreviewOffline} disabled={isBusy || !selectedDraftId}>
              Take Preview Offline
            </Button>

            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-medium">Approve for Live Publish</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onApprovePreview}
                  disabled={isBusy || !selectedDraftId}
                >
                  {runningApprovePreview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Approve
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Review at <code>/unit/&lt;unit&gt;</code>, then approve.
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="text-muted-foreground">
                  Approved:{" "}
                  {(selected as any)?.draft?.approvedSnapshotId
                    ? `${String((selected as any).draft.approvedSnapshotId).slice(0, 8)}… at ${typeof (selected as any)?.draft?.approvedAt === "number" ? new Date((selected as any).draft.approvedAt).toLocaleString() : "—"}`
                    : "Not yet"}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDownloadApprovedMarkdown}
                  disabled={!String((approvedMarkdown as any)?.markdownSource || "").trim()}
                >
                  Download MD
                </Button>
              </div>
            </div>

            <Button onClick={onPublish} disabled={isBusy || !canPublishLive}>
              {runningPublish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {runningPublish ? "Publishing…" : "Publish (Live for everyone)"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Preview writes content as <code>releaseStatus=preview</code>. Live publish requires status <code>ready_to_publish</code> and latest snapshot approved.
          </div>

          {selected?.draft?.status === "published" ? (
            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-medium">Translate published EN → DE</div>
                <AlertDialog open={translateDeOpen} onOpenChange={setTranslateDeOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={isBusy || runningTranslateDe}>
                      {runningTranslateDe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Translate
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Translate published content to German?</AlertDialogTitle>
                      <AlertDialogDescription>
                              This translates the <b>published English</b> unit content into <b>German</b> and writes it as a <b>Preview</b> release
                              (<code>releaseStatus="preview"</code>). Published content stays untouched.
                              Serbian text and answers are preserved. Preview test <code>questionId</code>s are suffixed to avoid collisions.
                                </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded border p-3 text-xs space-y-2">
                      {translateDePreview === undefined ? (
                        <div className="text-muted-foreground">Loading preview…</div>
                      ) : !(translateDePreview as any)?.sourceEn?.exists ? (
                        <div className="text-destructive">
                          No published EN source found for this unit. Publish the unit live first (EN), then translate.
                        </div>
                      ) : (
                        <>
                          <div className="font-medium">
                            Source (EN): {(translateDePreview as any)?.sourceEn?.title || `Unit ${selected.draft.unitNumber}`}
                          </div>
                          <div className="text-muted-foreground">
                            Sections: {((translateDePreview as any)?.sourceEn?.contentSections || []).length} · Tests:{" "}
                            {(translateDePreview as any)?.sourceEn?.tests?.count ?? 0} (v{(translateDePreview as any)?.sourceEn?.tests?.unitVersion ?? 1}) ·
                            Vocabulary: {(translateDePreview as any)?.sourceEn?.vocabulary?.count ?? 0}
                          </div>
                          {Array.isArray((translateDePreview as any)?.warnings) && (translateDePreview as any).warnings.length > 0 ? (
                            <div className="space-y-1">
                              <div className="font-medium">Warnings</div>
                              <ul className="list-disc pl-5 space-y-0.5">
                                {(translateDePreview as any).warnings.slice(0, 6).map((w: any, idx: number) => (
                                  <li key={idx} className="text-muted-foreground">
                                    {String(w)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <div className="text-muted-foreground">
                            Existing DE: metadata (published {(translateDePreview as any)?.existingDe?.metadata?.published ?? 0}, preview{" "}
                            {(translateDePreview as any)?.existingDe?.metadata?.preview ?? 0}) · content rows{" "}
                            {(translateDePreview as any)?.existingDe?.content?.publishedActiveCount ?? 0} · test rows{" "}
                            {(translateDePreview as any)?.existingDe?.tests?.publishedActiveCount ?? 0}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="py-4">
                      <Label>Type "TRANSLATE UNIT {selected.draft.unitNumber} TO DE" to confirm:</Label>
                      <Input
                        value={translateDeConfirmation}
                        onChange={(e) => setTranslateDeConfirmation(e.target.value)}
                        placeholder={`TRANSLATE UNIT ${selected.draft.unitNumber} TO DE`}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={runningTranslateDe}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onTranslatePublishedToGerman}
                        disabled={
                          runningTranslateDe ||
                          translateDeConfirmation !== `TRANSLATE UNIT ${selected.draft.unitNumber} TO DE` ||
                          !(translateDePreview as any)?.sourceEn?.exists
                        }
                      >
                        Translate & Save
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="text-xs text-muted-foreground">
                Use this after the unit is live-published. It updates German content used when learners set their learning language to <code>de</code>.
              </div>
            </div>
          ) : null}

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="danger">
              <AccordionTrigger>
                <span className="text-destructive">Danger Zone</span>
              </AccordionTrigger>
              <AccordionContent>
                <AlertDialog open={deleteUnitOpen} onOpenChange={setDeleteUnitOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Delete Unit {selected.draft.unitNumber} (Full)</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete <b>Unit {selected.draft.unitNumber}</b>,
                        including all drafts, snapshots, <b>PUBLISHED CONTENT</b> (Metadata, Content, Tests, Vocabulary), and related user progress/gamification data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label>Type "DELETE UNIT {selected.draft.unitNumber}" to confirm:</Label>
                      <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder={`DELETE UNIT ${selected.draft.unitNumber}`}
                        className="mt-2"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDeleteUnit}
                        disabled={deleteConfirmation !== `DELETE UNIT ${selected.draft.unitNumber}`}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Unit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardContent>
    </Card>
  );
}
