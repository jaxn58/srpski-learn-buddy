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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Info } from "lucide-react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
import {
  DEFAULT_VOCABULARY_BUDGET,
  MAX_VOCABULARY_BUDGET,
  MIN_VOCABULARY_BUDGET,
} from "@shared/contentStudio/vocabularyBudget";

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
  /** Vocabulary guideline per unit; kept as text so the field can be cleared. */
  cfgVocabularyBudget: string;
  setCfgVocabularyBudget: Dispatch<SetStateAction<string>>;
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
  inactiveStageSkills: any[] | undefined;
  onReactivateSkill: (id: string) => void | Promise<void>;
  onDeleteSkill: (id: string, name: string) => void | Promise<void>;

  refs: any[] | undefined;
  newRefType: "pdf" | "book" | "article" | "other";
  setNewRefType: Dispatch<SetStateAction<"pdf" | "book" | "article" | "other">>;
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
  // Named `tr` because this component already uses `t` as a loop variable for templates.
  const { t: tr } = useTranslation();
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
    cfgVocabularyBudget,
    setCfgVocabularyBudget,
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
    inactiveStageSkills,
    onReactivateSkill,
    onDeleteSkill,
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
          <SheetTitle>{tr("admin.contentStudio.settings.title", "Content Studio settings")}</SheetTitle>
          <SheetDescription>
            {tr("admin.contentStudio.settings.description", "Configure AI models and manage libraries")}
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as SettingsTab)}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="ai">{tr("admin.contentStudio.settings.tabAi", "AI models")}</TabsTrigger>
              <TabsTrigger value="libraries">{tr("admin.contentStudio.settings.tabLibraries", "Libraries")}</TabsTrigger>
              <TabsTrigger value="prompts">{tr("admin.contentStudio.settings.tabPrompts", "Prompt preview")}</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tr("admin.contentStudio.settings.modelConfigTitle", "AI roles – model config")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{tr("admin.contentStudio.settings.creator", "Creator")}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={tr("admin.contentStudio.settings.creatorHelp", "Creator help")}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{STAGE_HELP.specialist}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Label>{tr("admin.contentStudio.settings.provider", "Provider")}</Label>
                    <Select value={cfgSpecialistProvider} onValueChange={(v) => setCfgSpecialistProvider(v as Provider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">gemini</SelectItem>
                        <SelectItem value="openai">openai</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>{tr("admin.contentStudio.settings.model", "Model")}</Label>
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
                                <SelectValue placeholder={tr("admin.contentStudio.settings.selectModelPlaceholder", "Select model…")} />
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
                                    {tr("admin.contentStudio.settings.pricePer1M", {
                                      defaultValue: "${{input}} in / ${{output}} out per 1M tokens",
                                      input: m.inputPricePer1M.toFixed(2),
                                      output: m.outputPricePer1M.toFixed(2),
                                    })}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="py-2">
                              <span className="text-muted-foreground text-sm">
                                {tr("admin.contentStudio.settings.customModel", "Custom model…")}
                              </span>
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
                                  {tr("admin.contentStudio.settings.pricePer1M", {
                                    defaultValue: "${{input}} in / ${{output}} out per 1M tokens",
                                    input: m.inputPricePer1M.toFixed(2),
                                    output: m.outputPricePer1M.toFixed(2),
                                  })}
                                </p>
                              </div>
                            );
                          })()}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input value={cfgSpecialistModel} onChange={(e) => setCfgSpecialistModel(e.target.value)} />
                        <Button variant="secondary" onClick={() => setCfgSpecialistCustom(false)}>
                          {tr("admin.contentStudio.settings.backToDropdown", "Back to dropdown")}
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {tr("admin.contentStudio.settings.recommended", "Recommended:")}{" "}
                      <span className="font-medium">{stageOrderedModels(cfgSpecialistProvider, "specialist")[0]?.id}</span>
                    </div>
                  </div>
                  <div className="space-y-2 rounded border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{tr("admin.contentStudio.settings.lector", "Lector")}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={tr("admin.contentStudio.settings.lectorHelp", "Lector help")}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{STAGE_HELP.auditor}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Label>{tr("admin.contentStudio.settings.provider", "Provider")}</Label>
                    <Select value={cfgAuditorProvider} onValueChange={(v) => setCfgAuditorProvider(v as Provider)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">gemini</SelectItem>
                        <SelectItem value="openai">openai</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>{tr("admin.contentStudio.settings.model", "Model")}</Label>
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
                                <SelectValue placeholder={tr("admin.contentStudio.settings.selectModelPlaceholder", "Select model…")} />
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
                                    {tr("admin.contentStudio.settings.pricePer1M", {
                                      defaultValue: "${{input}} in / ${{output}} out per 1M tokens",
                                      input: m.inputPricePer1M.toFixed(2),
                                      output: m.outputPricePer1M.toFixed(2),
                                    })}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="py-2">
                              <span className="text-muted-foreground text-sm">
                                {tr("admin.contentStudio.settings.customModel", "Custom model…")}
                              </span>
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
                                  {tr("admin.contentStudio.settings.pricePer1M", {
                                    defaultValue: "${{input}} in / ${{output}} out per 1M tokens",
                                    input: m.inputPricePer1M.toFixed(2),
                                    output: m.outputPricePer1M.toFixed(2),
                                  })}
                                </p>
                              </div>
                            );
                          })()}
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Input value={cfgAuditorModel} onChange={(e) => setCfgAuditorModel(e.target.value)} />
                        <Button variant="secondary" onClick={() => setCfgAuditorCustom(false)}>
                          {tr("admin.contentStudio.settings.backToDropdown", "Back to dropdown")}
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {tr("admin.contentStudio.settings.recommended", "Recommended:")}{" "}
                      <span className="font-medium">{stageOrderedModels(cfgAuditorProvider, "auditor")[0]?.id}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button variant="secondary" onClick={onSaveModelConfig}>
                      {tr("admin.contentStudio.settings.saveModelConfig", "Save model config")}
                    </Button>
                  </div>
                  <div className="md:col-span-2 text-xs text-muted-foreground">
                    {tr(
                      "admin.contentStudio.settings.providerFallbackNote",
                      "Note: if the selected provider key is not configured, the system automatically falls back to the other provider (if available)."
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {tr("admin.contentStudio.settings.unitSizeTitle", "Unit size")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="cs-vocabulary-budget">
                      {tr("admin.contentStudio.settings.vocabularyBudget", "Vocabulary guideline per unit")}
                    </Label>
                    <Input
                      id="cs-vocabulary-budget"
                      type="number"
                      inputMode="numeric"
                      min={MIN_VOCABULARY_BUDGET}
                      max={MAX_VOCABULARY_BUDGET}
                      className="max-w-[160px]"
                      value={cfgVocabularyBudget}
                      onChange={(e) => setCfgVocabularyBudget(e.target.value)}
                      placeholder={String(DEFAULT_VOCABULARY_BUDGET)}
                    />
                    <p className="text-sm text-muted-foreground">
                      {tr(
                        "admin.contentStudio.settings.vocabularyBudgetHelp",
                        "How many new words a unit should introduce. This is a guideline, not a limit: words needed for grammar, dialogues or exercises are always listed, even above the guideline. You can override it for a single unit in its briefing.",
                      )}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={onSaveModelConfig}>
                      {tr("admin.contentStudio.settings.saveUnitSize", "Save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="libraries" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{tr("admin.contentStudio.settings.referenceLibraryTitle", "Reference library (external links)")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">{tr("admin.contentStudio.settings.addReference", "Add reference")}</div>
                    <Label>{tr("admin.contentStudio.settings.type", "Type")}</Label>
                    <Select value={newRefType} onValueChange={(v) => setNewRefType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">{tr("admin.contentStudio.settings.refTypePdf", "PDF")}</SelectItem>
                        <SelectItem value="book">{tr("admin.contentStudio.settings.refTypeBook", "Book")}</SelectItem>
                        <SelectItem value="article">{tr("admin.contentStudio.settings.refTypeArticle", "Article")}</SelectItem>
                        <SelectItem value="other">{tr("admin.contentStudio.settings.refTypeOther", "Other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>{tr("admin.contentStudio.settings.titleLabel", "Title")}</Label>
                    <Input value={newRefTitle} onChange={(e) => setNewRefTitle(e.target.value)} />
                    <Label>{tr("admin.contentStudio.settings.pdfUpload", "PDF upload (optional)")}</Label>
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
                        {tr(
                          "admin.contentStudio.settings.pdfUploadHint",
                          "PDF max 25 MB. Tip: you can either click “Upload PDF” first, or directly click “Create reference” (it will auto-upload)."
                        )}
                      </div>
                      <Button variant="secondary" onClick={onUploadReferencePdf} disabled={newRefUploading || !newRefFile}>
                        {newRefUploading
                          ? tr("admin.contentStudio.settings.uploading", "Uploading…")
                          : tr("admin.contentStudio.settings.uploadPdf", "Upload PDF")}
                      </Button>
                    </div>
                    {newRefStorageId ? (
                      <div className="text-xs text-muted-foreground">
                        {tr("admin.contentStudio.settings.uploaded", "Uploaded:")} <code>{newRefStorageId}</code>
                      </div>
                    ) : null}

                    <Label>{tr("admin.contentStudio.settings.urlOptional", "URL (optional)")}</Label>
                    <Input value={newRefUrl} onChange={(e) => setNewRefUrl(e.target.value)} placeholder="https://..." />
                    <Label>{tr("admin.contentStudio.settings.tags", "Tags (comma separated)")}</Label>
                    <Input value={newRefTags} onChange={(e) => setNewRefTags(e.target.value)} />
                    <Label>{tr("admin.contentStudio.settings.notes", "Notes (high-level, no copied text)")}</Label>
                    <Textarea value={newRefNotes} onChange={(e) => setNewRefNotes(e.target.value)} />
                    <Button onClick={onCreateReference}>{tr("admin.contentStudio.settings.createReference", "Create reference")}</Button>
                  </div>

                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">{tr("admin.contentStudio.settings.existingReferences", "Existing references")}</div>
                    <div className="max-h-[260px] overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tr("admin.contentStudio.settings.type", "Type")}</TableHead>
                            <TableHead>{tr("admin.contentStudio.settings.titleLabel", "Title")}</TableHead>
                            <TableHead>{tr("admin.contentStudio.settings.url", "URL")}</TableHead>
                            <TableHead className="w-[140px]">{tr("admin.contentStudio.settings.actions", "Actions")}</TableHead>
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
                                    {tr("admin.contentStudio.settings.downloadOpen", "Download / open")}
                                  </a>
                                ) : r.url ? (
                                  <a
                                    href={r.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline underline-offset-2"
                                  >
                                    {tr("admin.contentStudio.settings.openLink", "Open link")}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button size="sm" variant="secondary" onClick={() => onOpenEditReferenceGuidelines(r)}>
                                  {tr("admin.contentStudio.settings.editGuidelines", "Edit guidelines")}
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
                    <DialogTitle>{tr("admin.contentStudio.settings.editGuidelinesTitle", "Edit reference guidelines")}</DialogTitle>
                    <DialogDescription>
                      {tr(
                        "admin.contentStudio.settings.editGuidelinesDescription",
                        "Manual override. Keep this high-level and original (no quotes, no copied text)."
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  {!editRef ? (
                    <div className="text-sm text-muted-foreground">
                      {tr("admin.contentStudio.settings.noReferenceSelected", "No reference selected.")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">{tr("admin.contentStudio.settings.titleLabel", "Title")}</div>
                          <div className="text-sm font-medium">{String(editRef.title || "")}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            {tr("admin.contentStudio.settings.lastGuidelinesUpdate", "Last guidelines update")}
                          </div>
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
                                <Badge variant="secondary">
                                  {tr("admin.contentStudio.settings.loadedVersion", {
                                    defaultValue: "Loaded v{{version}}",
                                    version: editRefLoadedFromVersion,
                                  })}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  type="button"
                                  onClick={onReloadCurrentGuidelinesIntoEditor}
                                  disabled={editRefSaving}
                                >
                                  {tr("admin.contentStudio.settings.backToCurrent", "Back to current")}
                                </Button>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {tr("admin.contentStudio.settings.savingCreatesVersionTip", "Tip: saving always creates a new version in history.")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm">{tr("admin.contentStudio.settings.pdfAttachments", "PDF attachments")}</div>
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
                          <div className="text-xs text-muted-foreground">{tr("admin.contentStudio.settings.pdfMaxSize", "PDF max 25 MB.")}</div>
                          <Button
                            size="sm"
                            variant="secondary"
                            type="button"
                            onClick={onAddPdfToReference}
                            disabled={editRefPdfUploading || !editRefNewPdfFile}
                          >
                            {editRefPdfUploading
                              ? tr("admin.contentStudio.settings.uploading", "Uploading…")
                              : tr("admin.contentStudio.settings.addPdf", "Add PDF")}
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
                                        {tr("admin.contentStudio.settings.open", "Open")}
                                      </a>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      type="button"
                                      onClick={() => onRemovePdfFromReference(sid)}
                                      disabled={!sid || editRefPdfUploading}
                                    >
                                      {tr("admin.contentStudio.settings.remove", "Remove")}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {tr("admin.contentStudio.settings.noPdfsAttached", "No PDFs attached.")}
                            </div>
                          )}
                        </div>
                      </div>

                      <Textarea
                        value={editRefGuidelines}
                        onChange={(e) => setEditRefGuidelines(e.target.value)}
                        className="min-h-[360px] font-mono text-xs"
                        placeholder={tr(
                          "admin.contentStudio.settings.guidelinesPlaceholder",
                          "- Use clear unit scaffolding (overview, vocab, grammar, dialogues, exercises).\n- Keep progression beginner-friendly (Unit N builds on Units < N).\n- Ensure variety across exercises and avoid repetitive stems."
                        )}
                      />

                      <div className="space-y-2 rounded border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm">{tr("admin.contentStudio.settings.guidelinesHistory", "Guidelines history")}</div>
                          <Badge variant="secondary">{Array.isArray(guidelineVersions) ? guidelineVersions.length : 0}</Badge>
                        </div>
                        <div className="max-h-[200px] overflow-auto rounded border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{tr("admin.contentStudio.settings.version", "Version")}</TableHead>
                                <TableHead>{tr("admin.contentStudio.settings.when", "When")}</TableHead>
                                <TableHead>{tr("admin.contentStudio.settings.source", "Source")}</TableHead>
                                <TableHead className="w-[180px]">{tr("admin.contentStudio.settings.actions", "Actions")}</TableHead>
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
                                      {v.isManual ? ` ${tr("admin.contentStudio.settings.manualSource", "(manual)")}` : ""}
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
                                          {tr("admin.contentStudio.settings.open", "Open")}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          type="button"
                                          onClick={() => onRevertGuidelinesToVersion(Number(v.version))}
                                          disabled={editRefSaving}
                                        >
                                          {tr("admin.contentStudio.settings.revert", "Revert")}
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="destructive" type="button" disabled={editRefSaving}>
                                              {tr("admin.contentStudio.settings.delete", "Delete")}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>
                                                {tr("admin.contentStudio.settings.deleteVersionTitle", {
                                                  defaultValue: "Delete guideline version v{{version}}?",
                                                  version: String(v.version),
                                                })}
                                              </AlertDialogTitle>
                                              <AlertDialogDescription>
                                                {tr(
                                                  "admin.contentStudio.settings.deleteVersionDescription",
                                                  "This permanently removes the selected history entry. The current guidelines remain unchanged."
                                                )}
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel disabled={editRefSaving}>{tr("common.cancel", "Cancel")}</AlertDialogCancel>
                                              <AlertDialogAction
                                                disabled={editRefSaving}
                                                onClick={() =>
                                                  onDeleteGuidelinesVersion({
                                                    versionId: String(v._id),
                                                    version: Number(v.version),
                                                  })
                                                }
                                              >
                                                {tr("admin.contentStudio.settings.delete", "Delete")}
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
                                    {tr("admin.contentStudio.settings.noHistoryYet", "No history yet.")}
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <Button variant="destructive" type="button" onClick={onClearReferenceGuidelines} disabled={editRefSaving}>
                          {tr("admin.contentStudio.settings.clear", "Clear")}
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" type="button" onClick={() => setEditRefOpen(false)} disabled={editRefSaving}>
                            {tr("common.cancel", "Cancel")}
                          </Button>
                          <Button type="button" onClick={onSaveReferenceGuidelines} disabled={editRefSaving}>
                            {editRefSaving
                              ? tr("admin.contentStudio.settings.saving", "Saving…")
                              : tr("admin.contentStudio.settings.saveGuidelines", "Save guidelines")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Card>
                <CardHeader>
                  <CardTitle>{tr("admin.contentStudio.settings.templatesTitle", "Unit templates")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">
                      {tr("admin.contentStudio.settings.createTemplateFromCurrent", "Create template (from current unit)")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr(
                        "admin.contentStudio.settings.createTemplateHelp",
                        "Saves reference, house style (skills) and briefing of the currently selected unit."
                      )}
                    </div>
                    <Label>{tr("admin.contentStudio.settings.templateName", "Template name")}</Label>
                    <Input
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder={tr("admin.contentStudio.settings.templateNamePlaceholder", "e.g. Unit template (café)")}
                    />
                    <Label>{tr("admin.contentStudio.settings.descriptionOptional", "Description (optional)")}</Label>
                    <Input
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder={tr("admin.contentStudio.settings.templateDescriptionPlaceholder", "Short note for admins")}
                    />
                    <Button onClick={onCreateTemplateFromSelectedDraft} disabled={!selectedDraftId}>
                      {tr("admin.contentStudio.settings.saveAsTemplate", "Save current unit as template")}
                    </Button>
                  </div>

                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">{tr("admin.contentStudio.settings.existingTemplates", "Existing templates")}</div>
                    <div className="text-sm text-muted-foreground">
                      {tr("admin.contentStudio.settings.templatesCount", {
                        defaultValue: "{{n}} templates",
                        n: (draftTemplates || []).length ?? 0,
                      })}
                    </div>
                    <div className="max-h-[260px] overflow-auto rounded border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tr("admin.contentStudio.settings.name", "Name")}</TableHead>
                            <TableHead className="w-[180px]">{tr("admin.contentStudio.settings.actions", "Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(draftTemplates || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-sm text-muted-foreground">
                                {tr("admin.contentStudio.settings.noTemplatesYet", "No templates yet.")}
                              </TableCell>
                            </TableRow>
                          ) : (
                            (draftTemplates || []).map((t: any) => (
                              <TableRow key={t._id}>
                                <TableCell className="min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {String(t.name || tr("admin.contentStudio.settings.untitled", "Untitled"))}
                                  </div>
                                  {t.description ? (
                                    <div className="text-xs text-muted-foreground truncate">{String(t.description)}</div>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => onUseTemplate(t)}>
                                      {tr("admin.contentStudio.settings.use", "Use")}
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDeactivateTemplate(String(t._id))}>
                                      {tr("admin.contentStudio.settings.deactivate", "Deactivate")}
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
                  <CardTitle>{tr("admin.contentStudio.settings.skillsLibraryTitle", "House style (skills) by role")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">{tr("admin.contentStudio.settings.skillsLibraryTitle", "House style (skills) by role")}</div>
                    <div className="text-xs text-muted-foreground">
                      {tr(
                        "admin.contentStudio.settings.skillsLibraryHelp",
                        "The library only stores skills. They apply to a unit after you check them on the draft. A checked skill then follows the whole run (Creator, Lector, Translator). Translator-only skills stay DE-specific."
                      )}
                    </div>
                    <Label>{tr("admin.contentStudio.settings.role", "Role")}</Label>
                    <Select value={skillsStage} onValueChange={(v) => setSkillsStage(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="specialist">{tr("admin.contentStudio.settings.creator", "Creator")}</SelectItem>
                        <SelectItem value="auditor">{tr("admin.contentStudio.settings.lector", "Lector")}</SelectItem>
                        <SelectItem value="translator">{tr("admin.contentStudio.settings.roleTranslator", "EN → DE translator")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Label>{tr("admin.contentStudio.settings.name", "Name")}</Label>
                    <Input value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} />
                    <Label>{tr("admin.contentStudio.settings.promptSnippet", "Prompt snippet (system)")}</Label>
                    <Textarea value={newSkillPrompt} onChange={(e) => setNewSkillPrompt(e.target.value)} className="min-h-[160px]" />
                    <div className="flex gap-2">
                      <Button onClick={onCreateSkill}>
                        {editSkillId
                          ? tr("admin.contentStudio.settings.updateSkill", "Update skill")
                          : tr("admin.contentStudio.settings.createSkill", "Create skill")}
                      </Button>
                      {editSkillId ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditSkillId("");
                            setNewSkillName("");
                            setNewSkillPrompt("");
                          }}
                        >
                          {tr("common.cancel", "Cancel")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2 rounded border p-3">
                    <div className="font-medium">{tr("admin.contentStudio.settings.activeSkills", "Active skills (selected role)")}</div>
                    <div className="text-sm text-muted-foreground">
                      {tr("admin.contentStudio.settings.skillsCount", {
                        defaultValue: "{{n}} skills",
                        n: stageSkills?.length ?? 0,
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr(
                        "admin.contentStudio.settings.activeSkillsHelp",
                        "You can edit or deactivate a skill. Deactivated skills disappear from lists and won't be applied."
                      )}
                    </div>
                    <div className="max-h-[260px] overflow-auto rounded border p-2">
                      {(stageSkills || []).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          {tr("admin.contentStudio.settings.noSkillsForRole", "No skills for this role yet.")}
                        </div>
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
                                  {tr("admin.contentStudio.settings.edit", "Edit")}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => onDeactivateSkill(String(s._id))}>
                                  {tr("admin.contentStudio.settings.deactivate", "Deactivate")}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Deactivated skills: reactivate or delete permanently */}
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="inactive-skills" className="border-none">
                        <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
                          {tr("admin.contentStudio.skills.inactiveTitle", "Deactivated skills")} ({inactiveStageSkills?.length ?? 0})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="text-xs text-muted-foreground mb-2">
                            {tr(
                              "admin.contentStudio.skills.inactiveHelp",
                              "Deactivated skills are not applied. Reactivate them or delete them permanently; deleting also removes the skill from all units and templates."
                            )}
                          </div>
                          <div className="max-h-[220px] overflow-auto rounded border p-2">
                            {(inactiveStageSkills || []).length === 0 ? (
                              <div className="text-sm text-muted-foreground">
                                {tr("admin.contentStudio.skills.inactiveNone", "No deactivated skills for this role.")}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {(inactiveStageSkills || []).map((s: any) => (
                                  <div key={s._id} className="flex items-start justify-between gap-3 opacity-80">
                                    <div className="min-w-0">
                                      <div className="font-medium text-sm">{s.name}</div>
                                      <div className="text-xs text-muted-foreground break-words line-clamp-2">
                                        {String(s.prompt || "").slice(0, 220)}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                      <Button size="sm" variant="secondary" onClick={() => onReactivateSkill(String(s._id))}>
                                        {tr("admin.contentStudio.skills.reactivate", "Reactivate")}
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => onDeleteSkill(String(s._id), String(s.name || ""))}>
                                        {tr("admin.contentStudio.skills.delete", "Delete")}
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts" className="mt-4">
              {props.promptPreviewSlot ?? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  {tr("admin.contentStudio.settings.noPromptPreview", "No prompt preview available.")}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
