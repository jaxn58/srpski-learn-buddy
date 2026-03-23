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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { Provider, SettingsTab, StageKey } from "./types";
import {
  CONTENT_STUDIO_DIALOG_WIDTH,
  MODEL_META,
  STAGE_HELP,
  TIER_ORDER,
  isKnownModel,
  stageOrderedModels,
} from "./constants";
import { ModelTierBadge } from "./ModelTierBadge";

export interface SettingsSheetProps {
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsTab: SettingsTab;
  setSettingsTab: Dispatch<SetStateAction<SettingsTab>>;

  cfgSpecialistProvider: Provider;
  setCfgSpecialistProvider: Dispatch<SetStateAction<Provider>>;
  cfgSpecialistModel: string;
  setCfgSpecialistModel: Dispatch<SetStateAction<string>>;
  cfgSpecialistCustom: boolean;
  setCfgSpecialistCustom: Dispatch<SetStateAction<boolean>>;
  cfgAuditorProvider: Provider;
  setCfgAuditorProvider: Dispatch<SetStateAction<Provider>>;
  cfgAuditorModel: string;
  setCfgAuditorModel: Dispatch<SetStateAction<string>>;
  cfgAuditorCustom: boolean;
  setCfgAuditorCustom: Dispatch<SetStateAction<boolean>>;
  onSaveModelConfig: () => void | Promise<void>;

  skillsStage: StageKey;
  setSkillsStage: Dispatch<SetStateAction<StageKey>>;
  stageSkills: any[] | undefined;
  newSkillName: string;
  setNewSkillName: Dispatch<SetStateAction<string>>;
  newSkillPrompt: string;
  setNewSkillPrompt: Dispatch<SetStateAction<string>>;
  editSkillId: string;
  setEditSkillId: Dispatch<SetStateAction<string>>;
  onCreateSkill: () => void | Promise<void>;
  onEditSkill: (s: any) => void;
  onDeactivateSkill: (id: string) => void | Promise<void>;

  refs: any[] | undefined;
  newRefType: string;
  setNewRefType: Dispatch<SetStateAction<string>>;
  newRefTitle: string;
  setNewRefTitle: Dispatch<SetStateAction<string>>;
  newRefUrl: string;
  setNewRefUrl: Dispatch<SetStateAction<string>>;
  newRefTags: string;
  setNewRefTags: Dispatch<SetStateAction<string>>;
  newRefNotes: string;
  setNewRefNotes: Dispatch<SetStateAction<string>>;
  newRefFile: File | null;
  setNewRefFile: Dispatch<SetStateAction<File | null>>;
  newRefStorageId: string;
  setNewRefStorageId: Dispatch<SetStateAction<string>>;
  newRefUploading: boolean;
  onCreateReference: () => void | Promise<void>;
  onUploadReferencePdf: () => void | Promise<void>;
  onOpenEditReferenceGuidelines: (r: any) => void;

  editRefOpen: boolean;
  setEditRefOpen: Dispatch<SetStateAction<boolean>>;
  setEditRefId: Dispatch<SetStateAction<string>>;
  editRef: any;
  editRefGuidelines: string;
  setEditRefGuidelines: Dispatch<SetStateAction<string>>;
  editRefLoadedFromVersion: number | null;
  setEditRefLoadedFromVersion: Dispatch<SetStateAction<number | null>>;
  editRefSaving: boolean;
  editRefNewPdfFile: File | null;
  setEditRefNewPdfFile: Dispatch<SetStateAction<File | null>>;
  editRefPdfUploading: boolean;
  guidelineVersions: any[] | undefined;
  onSaveReferenceGuidelines: () => void | Promise<void>;
  onClearReferenceGuidelines: () => void | Promise<void>;
  onRevertGuidelinesToVersion: (version: number) => void | Promise<void>;
  onDeleteGuidelinesVersion: (params: { versionId: string; version: number }) => void | Promise<void>;
  onLoadGuidelinesVersionIntoEditor: (version: number) => void;
  onReloadCurrentGuidelinesIntoEditor: () => void;
  onAddPdfToReference: () => void | Promise<void>;
  onRemovePdfFromReference: (storageId: string) => void | Promise<void>;

  draftTemplates: any[] | undefined;
  newTemplateName: string;
  setNewTemplateName: Dispatch<SetStateAction<string>>;
  newTemplateDescription: string;
  setNewTemplateDescription: Dispatch<SetStateAction<string>>;
  selectedDraftId: string | null | undefined;
  onCreateTemplateFromSelectedDraft: () => void | Promise<void>;
  onDeactivateTemplate: (templateId: string) => void | Promise<void>;
  onUseTemplate: (tpl: any) => void;

  promptPreviewSlot?: ReactNode;
}

export function SettingsSheet(props: SettingsSheetProps) {
  const {
    settingsOpen,
    setSettingsOpen,
    settingsTab,
    setSettingsTab,
    cfgSpecialistProvider,
    setCfgSpecialistProvider,
    cfgSpecialistModel,
    setCfgSpecialistModel,
    cfgSpecialistCustom,
    setCfgSpecialistCustom,
    cfgAuditorProvider,
    setCfgAuditorProvider,
    cfgAuditorModel,
    setCfgAuditorModel,
    cfgAuditorCustom,
    setCfgAuditorCustom,
    onSaveModelConfig,
    skillsStage,
    setSkillsStage,
    stageSkills,
    newSkillName,
    setNewSkillName,
    newSkillPrompt,
    setNewSkillPrompt,
    editSkillId,
    setEditSkillId,
    onCreateSkill,
    onEditSkill,
    onDeactivateSkill,
    refs,
    newRefType,
    setNewRefType,
    newRefTitle,
    setNewRefTitle,
    newRefUrl,
    setNewRefUrl,
    newRefTags,
    setNewRefTags,
    newRefNotes,
    setNewRefNotes,
    newRefFile,
    setNewRefFile,
    newRefStorageId,
    setNewRefStorageId,
    newRefUploading,
    onCreateReference,
    onUploadReferencePdf,
    onOpenEditReferenceGuidelines,
    editRefOpen,
    setEditRefOpen,
    setEditRefId,
    editRef,
    editRefGuidelines,
    setEditRefGuidelines,
    editRefLoadedFromVersion,
    setEditRefLoadedFromVersion,
    editRefSaving,
    editRefNewPdfFile,
    setEditRefNewPdfFile,
    editRefPdfUploading,
    guidelineVersions,
    onSaveReferenceGuidelines,
    onClearReferenceGuidelines,
    onRevertGuidelinesToVersion,
    onDeleteGuidelinesVersion,
    onLoadGuidelinesVersionIntoEditor,
    onReloadCurrentGuidelinesIntoEditor,
    onAddPdfToReference,
    onRemovePdfFromReference,
    draftTemplates,
    newTemplateName,
    setNewTemplateName,
    newTemplateDescription,
    setNewTemplateDescription,
    selectedDraftId,
    onCreateTemplateFromSelectedDraft,
    onDeactivateTemplate,
    onUseTemplate,
  } = props;

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Content Studio Settings</SheetTitle>
          <SheetDescription>Configure AI models and manage libraries</SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as SettingsTab)}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="ai">AI Models</TabsTrigger>
              <TabsTrigger value="libraries">Libraries</TabsTrigger>
              <TabsTrigger value="prompts">Prompt Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Roles – Model Config</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">Creator</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground" aria-label="Creator help">
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{STAGE_HELP.specialist}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Label>Provider</Label>
                    <Select value={cfgSpecialistProvider} onValueChange={(v) => setCfgSpecialistProvider(v as Provider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">gemini</SelectItem>
                        <SelectItem value="openai">openai</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>Model</Label>
                    {!cfgSpecialistCustom ? (
                      <>
                        <Select
                          value={cfgSpecialistModel}
                          onValueChange={(v) => {
                            if (v === "__custom__") {
                              setCfgSpecialistCustom(true);
                              return;
                            }
                            setCfgSpecialistModel(v);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            {(() => {
                              const m = MODEL_META[cfgSpecialistProvider]?.find((e) => e.id === cfgSpecialistModel);
                              return m ? (
                                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                  <span className="truncate font-medium text-sm">{m.title}</span>
                                  <ModelTierBadge tier={m.tier} />
                                </div>
                              ) : (
                                <SelectValue placeholder="Select model…" />
                              );
                            })()}
                          </SelectTrigger>
                          <SelectContent align="start" className="w-[min(420px,90vw)]">
                            {stageOrderedModels(cfgSpecialistProvider, "specialist").map((m) => (
                              <SelectItem key={m.id} value={m.id} className="py-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{m.title}</span>
                                    <ModelTierBadge tier={m.tier} />
                                  </div>
                                  <span className="text-xs text-muted-foreground leading-snug">{m.blurb}</span>
                                  <span className="text-xs text-muted-foreground/60 font-mono">
                                    ${m.inputPricePer1M.toFixed(2)} in / ${m.outputPricePer1M.toFixed(2)} out per 1M tokens
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="py-2">
                              <span className="text-muted-foreground text-sm">Custom model…</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {MODEL_META[cfgSpecialistProvider]?.find((e) => e.id === cfgSpecialistModel) &&
                          (() => {
                            const m = MODEL_META[cfgSpecialistProvider].find((e) => e.id === cfgSpecialistModel)!;
                            return (
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                                <p className="text-muted-foreground leading-snug">{m.blurb}</p>
                                <p className="font-mono text-muted-foreground/60">
                                  ${m.inputPricePer1M.toFixed(2)} in / ${m.outputPricePer1M.toFixed(2)} out per 1M tokens
                                </p>
                              </div>
                            );
                          })()}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input value={cfgSpecialistModel} onChange={(e) => setCfgSpecialistModel(e.target.value)} />
                        <Button variant="secondary" onClick={() => setCfgSpecialistCustom(false)}>
                          Back to dropdown
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Recommended:{" "}
                      <span className="font-medium">{stageOrderedModels(cfgSpecialistProvider, "specialist")[0]?.id}</span>
                    </div>
                  </div>
                  <div className="space-y-2 rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">Lector</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="text-muted-foreground hover:text-foreground" aria-label="Lector help">
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{STAGE_HELP.auditor}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Label>Provider</Label>
                    <Select value={cfgAuditorProvider} onValueChange={(v) => setCfgAuditorProvider(v as Provider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">gemini</SelectItem>
                        <SelectItem value="openai">openai</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>Model</Label>
                    {!cfgAuditorCustom ? (
                      <>
                        <Select
                          value={cfgAuditorModel}
                          onValueChange={(v) => {
                            if (v === "__custom__") {
                              setCfgAuditorCustom(true);
                              return;
                            }
                            setCfgAuditorModel(v);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            {(() => {
                              const m = MODEL_META[cfgAuditorProvider]?.find((e) => e.id === cfgAuditorModel);
                              return m ? (
                                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                  <span className="truncate font-medium text-sm">{m.title}</span>
                                  <ModelTierBadge tier={m.tier} />
                                </div>
                              ) : (
                                <SelectValue placeholder="Select model…" />
                              );
                            })()}
                          </SelectTrigger>
                          <SelectContent align="start" className="w-[min(420px,90vw)]">
                            {stageOrderedModels(cfgAuditorProvider, "auditor").map((m) => (
                              <SelectItem key={m.id} value={m.id} className="py-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{m.title}</span>
                                    <ModelTierBadge tier={m.tier} />
                                  </div>
                                  <span className="text-xs text-muted-foreground leading-snug">{m.blurb}</span>
                                  <span className="text-xs text-muted-foreground/60 font-mono">
                                    ${m.inputPricePer1M.toFixed(2)} in / ${m.outputPricePer1M.toFixed(2)} out per 1M tokens
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="py-2">
                              <span className="text-muted-foreground text-sm">Custom model…</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {MODEL_META[cfgAuditorProvider]?.find((e) => e.id === cfgAuditorModel) &&
                          (() => {
                            const m = MODEL_META[cfgAuditorProvider].find((e) => e.id === cfgAuditorModel)!;
                            return (
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                                <p className="text-muted-foreground leading-snug">{m.blurb}</p>
                                <p className="font-mono text-muted-foreground/60">
                                  ${m.inputPricePer1M.toFixed(2)} in / ${m.outputPricePer1M.toFixed(2)} out per 1M tokens
                                </p>
                              </div>
                            );
                          })()}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input value={cfgAuditorModel} onChange={(e) => setCfgAuditorModel(e.target.value)} />
                        <Button variant="secondary" onClick={() => setCfgAuditorCustom(false)}>
                          Back to dropdown
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Recommended:{" "}
                      <span className="font-medium">{stageOrderedModels(cfgAuditorProvider, "auditor")[0]?.id}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button variant="secondary" onClick={onSaveModelConfig}>
                      Save Model Config
                    </Button>
                  </div>
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    Note: If the selected provider key is not configured, the system automatically falls back to the other provider (if available).
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="libraries" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reference Library (external links)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">Add reference</div>
                    <Label>Type</Label>
                    <Select value={newRefType} onValueChange={(v) => setNewRefType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">pdf</SelectItem>
                        <SelectItem value="book">book</SelectItem>
                        <SelectItem value="article">article</SelectItem>
                        <SelectItem value="other">other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>Title</Label>
                    <Input value={newRefTitle} onChange={(e) => setNewRefTitle(e.target.value)} />
                    <Label>PDF Upload (optional)</Label>
                    <Input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setNewRefFile(f);
                        setNewRefStorageId("");
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        PDF max 25 MB. Tip: you can either click “Upload PDF” first, or directly click “Create Reference” (it will auto-upload).
                      </div>
                      <Button variant="secondary" onClick={onUploadReferencePdf} disabled={newRefUploading || !newRefFile}>
                        {newRefUploading ? "Uploading..." : "Upload PDF"}
                      </Button>
                    </div>
                    {newRefStorageId ? (
                      <div className="text-xs text-muted-foreground">
                        Uploaded: <code>{newRefStorageId}</code>
                      </div>
                    ) : null}

                    <Label>URL (optional)</Label>
                    <Input value={newRefUrl} onChange={(e) => setNewRefUrl(e.target.value)} placeholder="https://..." />
                    <Label>Tags (comma separated)</Label>
                    <Input value={newRefTags} onChange={(e) => setNewRefTags(e.target.value)} />
                    <Label>Notes (high-level, no copied text)</Label>
                    <Textarea value={newRefNotes} onChange={(e) => setNewRefNotes(e.target.value)} />
                    <Button onClick={onCreateReference}>Create Reference</Button>
                  </div>

                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">Existing references</div>
                    <div className="max-h-[260px] overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead className="w-[140px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(refs || []).map((r: any) => (
                            <TableRow key={r._id}>
                              <TableCell>{r.type}</TableCell>
                              <TableCell>{r.title}</TableCell>
                              <TableCell className="truncate max-w-[240px]">
                                {r.downloadUrl ? (
                                  <a
                                    href={r.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-2"
                                  >
                                    Download / Open
                                  </a>
                                ) : r.url ? (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-2"
                                  >
                                    Open link
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="secondary" onClick={() => onOpenEditReferenceGuidelines(r)}>
                                  Edit guidelines
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Dialog
                open={editRefOpen}
                onOpenChange={(open) => {
                  setEditRefOpen(open);
                  if (!open) {
                    setEditRefId("");
                    setEditRefGuidelines("");
                    setEditRefLoadedFromVersion(null);
                  }
                }}
              >
                <DialogContent className={CONTENT_STUDIO_DIALOG_WIDTH}>
                  <DialogHeader>
                    <DialogTitle>Edit Reference Guidelines</DialogTitle>
                    <DialogDescription>
                      Manual override. Keep this high-level and original (no quotes, no copied text).
                    </DialogDescription>
                  </DialogHeader>

                  {!editRef ? (
                    <div className="text-sm text-muted-foreground">No reference selected.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Title</div>
                          <div className="text-sm font-medium">{String(editRef.title || "")}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Last guidelines update</div>
                          <div className="text-sm">
                            {(editRef as any)?.guidelinesUpdatedAt
                              ? new Date(Number((editRef as any).guidelinesUpdatedAt)).toLocaleString()
                              : "—"}
                            {(editRef as any)?.guidelinesProvider ? (
                              <span className="text-muted-foreground">
                                {" "}
                                • {String((editRef as any).guidelinesProvider)}
                                {(editRef as any)?.guidelinesModel ? `/${String((editRef as any).guidelinesModel)}` : ""}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {typeof editRefLoadedFromVersion === "number" ? (
                              <>
                                <Badge variant="secondary">Loaded v{editRefLoadedFromVersion}</Badge>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  type="button"
                                  onClick={onReloadCurrentGuidelinesIntoEditor}
                                  disabled={editRefSaving}
                                >
                                  Back to current
                                </Button>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">Tip: Saving always creates a new version in history.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm">PDF attachments</div>
                          <Badge variant="secondary">
                            {Array.isArray((editRef as any)?.pdfFiles) ? (editRef as any).pdfFiles.length : 0}
                          </Badge>
                        </div>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => setEditRefNewPdfFile(e.target.files?.[0] ?? null)}
                          disabled={editRefPdfUploading}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">PDF max 25 MB.</div>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={onAddPdfToReference}
                            disabled={editRefPdfUploading || !editRefNewPdfFile}
                          >
                            {editRefPdfUploading ? "Uploading…" : "Add PDF"}
                          </Button>
                        </div>

                        <div className="space-y-1">
                          {Array.isArray((editRef as any)?.pdfFiles) && (editRef as any).pdfFiles.length > 0 ? (
                            (editRef as any).pdfFiles.map((f: any, idx: number) => {
                              const sid = String(f?.storageId || "");
                              const url = Array.isArray((editRef as any)?.pdfDownloadUrls)
                                ? String(((editRef as any).pdfDownloadUrls[idx] as any) || "")
                                : "";
                              return (
                                <div key={sid || idx} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="min-w-0">
                                    <div className="font-mono truncate">{String(f?.fileName || sid || "PDF").slice(0, 120)}</div>
                                    <div className="text-muted-foreground">{sid ? sid.slice(0, 16) : "—"}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {url ? (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary underline underline-offset-2"
                                      >
                                        Open
                                      </a>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      type="button"
                                      onClick={() => onRemovePdfFromReference(sid)}
                                      disabled={!sid || editRefPdfUploading}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-muted-foreground">No PDFs attached.</div>
                          )}
                        </div>
                      </div>

                      <Textarea
                        value={editRefGuidelines}
                        onChange={(e) => setEditRefGuidelines(e.target.value)}
                        className="min-h-[360px] font-mono text-xs"
                        placeholder={[
                          "- Use clear unit scaffolding (overview, vocab, grammar, dialogues, exercises).",
                          "- Keep progression beginner-friendly (Unit N builds on Units < N).",
                          "- Ensure variety across exercises and avoid repetitive stems.",
                        ].join("\n")}
                      />

                      <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm">Guidelines history</div>
                          <Badge variant="secondary">{Array.isArray(guidelineVersions) ? guidelineVersions.length : 0}</Badge>
                        </div>
                        <div className="max-h-[200px] overflow-auto rounded border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Version</TableHead>
                                <TableHead>When</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead className="w-[180px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Array.isArray(guidelineVersions) && guidelineVersions.length > 0 ? (
                                guidelineVersions.map((v: any) => (
                                  <TableRow key={v._id}>
                                    <TableCell className="font-mono">v{String(v.version)}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {typeof v.createdAt === "number" ? new Date(v.createdAt).toLocaleString() : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {String(v.provider || "—")}
                                      {v.model ? `/${String(v.model)}` : ""}
                                      {v.isManual ? " (manual)" : ""}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          type="button"
                                          onClick={() => onLoadGuidelinesVersionIntoEditor(Number(v.version))}
                                          disabled={editRefSaving}
                                        >
                                          Open
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          type="button"
                                          onClick={() => onRevertGuidelinesToVersion(Number(v.version))}
                                          disabled={editRefSaving}
                                        >
                                          Revert
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="destructive" type="button" disabled={editRefSaving}>
                                              Delete
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Delete guideline version v{String(v.version)}?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                This permanently removes the selected history entry. The current guidelines remain unchanged.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel disabled={editRefSaving}>Cancel</AlertDialogCancel>
                                              <AlertDialogAction
                                                disabled={editRefSaving}
                                                onClick={() =>
                                                  onDeleteGuidelinesVersion({
                                                    versionId: String(v._id),
                                                    version: Number(v.version),
                                                  })
                                                }
                                              >
                                                Delete
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                                    No history yet.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Button variant="destructive" type="button" onClick={onClearReferenceGuidelines} disabled={editRefSaving}>
                          Clear
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" type="button" onClick={() => setEditRefOpen(false)} disabled={editRefSaving}>
                            Cancel
                          </Button>
                          <Button type="button" onClick={onSaveReferenceGuidelines} disabled={editRefSaving}>
                            {editRefSaving ? "Saving…" : "Save guidelines"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Card>
                <CardHeader>
                  <CardTitle>Draft Templates</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">Create template (from current draft)</div>
                    <div className="text-xs text-muted-foreground">
                      Saves reference + skills + brief from the currently selected draft.
                    </div>
                    <Label>Template name</Label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Unit template (café)"
                    />
                    <Label>Description (optional)</Label>
                    <Input
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Short note for admins"
                    />
                    <Button onClick={onCreateTemplateFromSelectedDraft} disabled={!selectedDraftId}>
                      Save current draft as template
                    </Button>
                  </div>

                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">Existing templates</div>
                    <div className="text-sm text-muted-foreground">{(draftTemplates || []).length ?? 0} templates</div>
                    <div className="max-h-[260px] overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[180px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(draftTemplates || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-sm text-muted-foreground">
                                No templates yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            (draftTemplates || []).map((t: any) => (
                              <TableRow key={t._id}>
                                <TableCell className="min-w-0">
                                  <div className="font-medium text-sm truncate">{String(t.name || "Untitled")}</div>
                                  {t.description ? (
                                    <div className="text-xs text-muted-foreground truncate">{String(t.description)}</div>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => onUseTemplate(t)}>
                                      Use
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDeactivateTemplate(String(t._id))}>
                                      Deactivate
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Skills Library (by role)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">AI Skills Library (by role)</div>
                    <div className="text-xs text-muted-foreground">
                      These skills influence a specific AI role globally (Creator / Lector).
                    </div>
                    <Label>Role</Label>
                    <Select value={skillsStage} onValueChange={(v) => setSkillsStage(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="specialist">Creator</SelectItem>
                        <SelectItem value="auditor">Lector</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>Name</Label>
                    <Input value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} />
                    <Label>Prompt snippet (system)</Label>
                    <Textarea value={newSkillPrompt} onChange={(e) => setNewSkillPrompt(e.target.value)} className="min-h-[160px]" />
                    <div className="flex gap-2">
                      <Button onClick={onCreateSkill}>{editSkillId ? "Update Skill" : "Create Skill"}</Button>
                      {editSkillId ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditSkillId("");
                            setNewSkillName("");
                            setNewSkillPrompt("");
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">Active skills (selected role)</div>
                    <div className="text-sm text-muted-foreground">{stageSkills?.length ?? 0} skills</div>
                    <div className="text-xs text-muted-foreground">
                      You can edit or deactivate a skill. Deactivated skills disappear from lists and won't be applied.
                    </div>
                    <div className="max-h-[260px] overflow-auto rounded border p-2">
                      {(stageSkills || []).length === 0 ? (
                        <div className="text-sm text-muted-foreground">No skills for this role yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {(stageSkills || []).map((s: any) => (
                            <div key={s._id} className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-sm">{s.name}</div>
                                <div className="text-xs text-muted-foreground break-words line-clamp-2">
                                  {String(s.prompt || "").slice(0, 220)}
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" variant="secondary" onClick={() => onEditSkill(s)}>
                                  Edit
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => onDeactivateSkill(String(s._id))}>
                                  Deactivate
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts" className="mt-4">
              {props.promptPreviewSlot ?? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  No prompt preview available.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
