import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, Sparkles, Upload, RotateCcw, X } from "lucide-react";
import type { SectionId } from "./types";
import { SECTION_OPTIONS } from "./constants";
import { DraftStatusBadge } from "./StatusBadge";

export type InspectorStep = "setup" | "generate" | "review" | "publish";

export interface InspectorPanelProps {
  activeStep: InspectorStep;
  selected: any;
  selectedDraftId: string | null;
  isBusy: boolean;

  // Setup
  draftEditTitle: string;
  setDraftEditTitle: (v: string) => void;
  draftEditDescription: string;
  setDraftEditDescription: (v: string) => void;
  draftAuthorNoteName: string;
  setDraftAuthorNoteName: (v: string) => void;
  draftAuthorNoteQuote: string;
  setDraftAuthorNoteQuote: (v: string) => void;
  onFounderQuoteBlur: () => void;
  draftRefId: string;
  setDraftRefId: (v: string) => void;
  draftRefNotes: string;
  setDraftRefNotes: (v: string) => void;
  draftRefChapter: string;
  setDraftRefChapter: (v: string) => void;
  draftRefPages: string;
  setDraftRefPages: (v: string) => void;
  refs: any[] | undefined;
  specialistSkills: any[] | undefined;
  auditorSkills: any[] | undefined;
  draftSpecialistSkillIds: string[];
  setDraftSpecialistSkillIds: (v: string[]) => void;
  draftAuditorSkillIds: string[];
  setDraftAuditorSkillIds: (v: string[]) => void;
  onSaveDraftSkillsAndReference: () => void;
  hasUnsavedChanges: boolean;
  metaAutosaveStatus: "idle" | "saving" | "error";
  metaAutosavedAt: number | null;

  // Generate
  runningCreator: boolean;
  runningValidator: boolean;
  runningCreateValidate: boolean;
  progressPercent: number | null;
  progressMessage: string;
  elapsedSeconds: number;
  currentTaskLabel: string;
  onGenerate: () => void;
  onRunSpecialist: () => void;
  onRunValidate: () => void;

  // Review (QA + Edit)
  findings: any[];
  errorFindings: any[];
  warningFindings: any[];
  latestReport: any;
  runningRevise: boolean;
  runningLector: boolean;
  runningSectionRevise: boolean;
  fixHumanNotes: string;
  setFixHumanNotes: (v: string) => void;
  expandSection: SectionId;
  setExpandSection: (v: SectionId) => void;
  expandInstruction: string;
  setExpandInstruction: (v: string) => void;
  canRunLector: boolean;
  onRunRevise: () => void;
  onRunAuditor: () => void;
  onSectionRevise: () => void;
  onDismissFinding: (params: { findingId: any; dismissed: boolean }) => void;

  // Publish
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
  onPublishToPreview: () => void;
  onTakePreviewOffline: () => void;
  onApprovePreview: () => void;
  onDownloadApprovedMarkdown: () => void;
  onPublish: () => void;
  onTranslatePublishedToGerman: () => void;
  deleteUnitOpen: boolean;
  setDeleteUnitOpen: (v: boolean) => void;
  deleteConfirmation: string;
  setDeleteConfirmation: (v: string) => void;
  onDeleteUnit: () => void;
  onDeleteSelectedDraft: () => void;
  showDeleteDraftDialog: boolean;
  setShowDeleteDraftDialog: (v: boolean) => void;
  onConfirmDeleteDraft: () => void;
  cfgSpecialistProvider: string;
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { activeStep, selected, isBusy } = props;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {activeStep === "setup" ? "Setup" : activeStep === "generate" ? "Generate" : activeStep === "review" ? "Review" : "Publish"}
        </span>
        <DraftStatusBadge status={selected?.draft?.status} />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {activeStep === "setup" && <SetupContent {...props} />}
          {activeStep === "generate" && <GenerateContent {...props} />}
          {activeStep === "review" && <ReviewContent {...props} />}
          {activeStep === "publish" && <PublishContent {...props} />}
        </div>
      </ScrollArea>
    </div>
  );
}

function SetupContent(props: InspectorPanelProps) {
  const {
    selected, isBusy, draftEditTitle, setDraftEditTitle, draftEditDescription,
    setDraftEditDescription, draftAuthorNoteName, setDraftAuthorNoteName,
    draftAuthorNoteQuote, setDraftAuthorNoteQuote, onFounderQuoteBlur,
    draftRefId, setDraftRefId, draftRefNotes, setDraftRefNotes,
    draftRefChapter, setDraftRefChapter, draftRefPages, setDraftRefPages,
    refs, specialistSkills, auditorSkills, draftSpecialistSkillIds,
    setDraftSpecialistSkillIds, draftAuditorSkillIds, setDraftAuditorSkillIds,
    onSaveDraftSkillsAndReference, hasUnsavedChanges, metaAutosaveStatus, metaAutosavedAt,
  } = props;

  return (
    <>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Title</Label>
          <Input
            value={draftEditTitle}
            onChange={(e) => setDraftEditTitle(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Description / Creator Brief</Label>
          <Textarea
            value={draftEditDescription}
            onChange={(e) => setDraftEditDescription(e.target.value)}
            rows={3}
            className="mt-1 text-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs font-semibold">Author Note (optional)</Label>
        <div>
          <Label className="text-xs">Name</Label>
          <Input
            value={draftAuthorNoteName}
            onChange={(e) => setDraftAuthorNoteName(e.target.value)}
            placeholder="e.g. Maxi"
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Quote</Label>
          <Textarea
            value={draftAuthorNoteQuote}
            onChange={(e) => setDraftAuthorNoteQuote(e.target.value)}
            onBlur={onFounderQuoteBlur}
            rows={2}
            placeholder="A brief motivational quote..."
            className="mt-1 text-sm"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs font-semibold">Reference</Label>
        <Select value={draftRefId} onValueChange={setDraftRefId}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select reference..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {((refs || []) as any[]).filter((r: any) => r?.isActive).map((r: any) => (
              <SelectItem key={String(r._id)} value={String(r._id)}>
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draftRefId && (
          <div className="grid gap-2 grid-cols-2">
            <div>
              <Label className="text-xs">Chapter</Label>
              <Input value={draftRefChapter} onChange={(e) => setDraftRefChapter(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Pages</Label>
              <Input value={draftRefPages} onChange={(e) => setDraftRefPages(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={draftRefNotes} onChange={(e) => setDraftRefNotes(e.target.value)} rows={2} className="mt-1 text-sm" />
            </div>
          </div>
        )}
      </div>

      <Separator />

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="skills" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1">Skills</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Creator Skills</Label>
              <div className="mt-1 space-y-1">
                {((specialistSkills || []) as any[]).map((s: any) => (
                  <label key={String(s._id)} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftSpecialistSkillIds.includes(String(s._id))}
                      onChange={(e) => {
                        const id = String(s._id);
                        setDraftSpecialistSkillIds(
                          e.target.checked
                            ? [...draftSpecialistSkillIds, id]
                            : draftSpecialistSkillIds.filter((x) => x !== id)
                        );
                      }}
                      className="rounded"
                    />
                    {s.name}
                  </label>
                ))}
                {!specialistSkills?.length && <span className="text-xs text-muted-foreground">No creator skills defined.</span>}
              </div>
            </div>
            <div>
              <Label className="text-xs">Lector Skills</Label>
              <div className="mt-1 space-y-1">
                {((auditorSkills || []) as any[]).map((s: any) => (
                  <label key={String(s._id)} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftAuditorSkillIds.includes(String(s._id))}
                      onChange={(e) => {
                        const id = String(s._id);
                        setDraftAuditorSkillIds(
                          e.target.checked
                            ? [...draftAuditorSkillIds, id]
                            : draftAuditorSkillIds.filter((x) => x !== id)
                        );
                      }}
                      className="rounded"
                    />
                    {s.name}
                  </label>
                ))}
                {!auditorSkills?.length && <span className="text-xs text-muted-foreground">No lector skills defined.</span>}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="pt-2 space-y-2">
        <Button
          size="sm"
          className="w-full"
          onClick={onSaveDraftSkillsAndReference}
          disabled={!props.selectedDraftId || isBusy}
        >
          Save Draft Settings
        </Button>
        {metaAutosaveStatus === "saving" && (
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Autosaving...</span>
        )}
        {metaAutosaveStatus === "error" && (
          <span className="text-xs text-red-600">Autosave failed</span>
        )}
        {metaAutosavedAt && metaAutosaveStatus === "idle" && (
          <span className="text-xs text-muted-foreground">
            Autosaved {new Date(metaAutosavedAt).toLocaleTimeString()}
          </span>
        )}
        {hasUnsavedChanges && <Badge variant="secondary" className="text-[10px]">Unsaved changes</Badge>}
      </div>
    </>
  );
}

function GenerateContent(props: InspectorPanelProps) {
  const {
    isBusy, runningCreator, runningValidator, runningCreateValidate,
    progressPercent, progressMessage, elapsedSeconds, currentTaskLabel,
    onGenerate, onRunSpecialist, onRunValidate,
  } = props;

  return (
    <>
      <Button
        className="w-full"
        onClick={onGenerate}
        disabled={isBusy}
      >
        {runningCreateValidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Generate (auto)
      </Button>

      {isBusy && (
        <div className="space-y-2">
          {progressPercent != null && <Progress value={progressPercent} className="h-2" />}
          <div className="text-xs text-muted-foreground">{progressMessage || currentTaskLabel}</div>
          <div className="text-xs text-muted-foreground/60">{elapsedSeconds}s elapsed</div>
        </div>
      )}

      <Separator />

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1">Advanced</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <Button size="sm" variant="outline" className="w-full" onClick={onRunSpecialist} disabled={isBusy}>
              {runningCreator ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Run Creator only
            </Button>
            <Button size="sm" variant="outline" className="w-full" onClick={onRunValidate} disabled={isBusy}>
              {runningValidator ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              Run Validator only
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

function ReviewContent(props: InspectorPanelProps) {
  const {
    isBusy, findings, errorFindings, warningFindings, latestReport,
    runningRevise, runningLector, runningSectionRevise,
    fixHumanNotes, setFixHumanNotes, expandSection, setExpandSection,
    expandInstruction, setExpandInstruction, canRunLector,
    onRunRevise, onRunAuditor, onSectionRevise, onDismissFinding, selected,
  } = props;

  return (
    <>
      {/* QA Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {errorFindings.length > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="mr-1 h-3 w-3" /> {errorFindings.length} errors
          </Badge>
        )}
        {warningFindings.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {warningFindings.length} warnings
          </Badge>
        )}
        {errorFindings.length === 0 && warningFindings.length === 0 && findings.length === 0 && (
          <Badge variant="outline" className="text-[10px]">
            <CheckCircle className="mr-1 h-3 w-3 text-emerald-500" /> No issues
          </Badge>
        )}
      </div>

      {/* Fix Findings */}
      {(errorFindings.length > 0 || warningFindings.length > 0) && (
        <div className="space-y-2">
          <Label className="text-xs">Human notes for revision AI</Label>
          <Textarea
            value={fixHumanNotes}
            onChange={(e) => setFixHumanNotes(e.target.value)}
            rows={2}
            placeholder="Optional: additional instructions for fix..."
            className="text-sm"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={onRunRevise}
            disabled={isBusy}
          >
            {runningRevise ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-2 h-3 w-3" />}
            Fix Findings
          </Button>
        </div>
      )}

      <Separator />

      {/* Section Edit */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Edit Section</Label>
        <Select value={expandSection} onValueChange={(v) => setExpandSection(v as SectionId)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={expandInstruction}
          onChange={(e) => setExpandInstruction(e.target.value)}
          rows={3}
          placeholder="Describe changes for this section..."
          className="text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={onSectionRevise}
          disabled={isBusy || !expandInstruction.trim()}
        >
          {runningSectionRevise ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Apply Section Changes
        </Button>
      </div>

      <Separator />

      {/* Lector */}
      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={onRunAuditor}
        disabled={isBusy || !canRunLector}
      >
        {runningLector ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
        Run Lector
      </Button>

      {/* Findings List */}
      {findings.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="findings" className="border-none">
            <AccordionTrigger className="text-xs font-semibold py-1">
              All Findings ({findings.length})
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pt-1">
              {findings.map((f: any, i: number) => (
                <div
                  key={String(f._id || i)}
                  className={cn(
                    "rounded border p-2 text-xs",
                    f.dismissed ? "opacity-40" : "",
                    f.severity === "error" ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" :
                    f.severity === "warning" ? "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30" :
                    "border-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-medium">{f.message}</span>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => onDismissFinding({ findingId: f._id, dismissed: !f.dismissed })}
                    >
                      {f.dismissed ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </button>
                  </div>
                  {f.path && <div className="text-muted-foreground mt-0.5 font-mono">{f.path}</div>}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* AI Runs */}
      {selected?.aiRuns?.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="runs" className="border-none">
            <AccordionTrigger className="text-xs font-semibold py-1">
              AI Runs ({selected.aiRuns.length})
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pt-1">
              {(selected.aiRuns as any[]).slice(0, 10).map((r: any, i: number) => (
                <div key={String(r._id || i)} className="rounded border p-2 text-xs">
                  <div className="flex items-center gap-1">
                    {r.status === "success" ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    <span className="font-medium">{r.stage}</span>
                    <span className="text-muted-foreground">{r.model}</span>
                  </div>
                  {r.error && <div className="text-red-600 mt-0.5">{String(r.error).slice(0, 100)}</div>}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </>
  );
}

function PublishContent(props: InspectorPanelProps) {
  const {
    selected, selectedDraftId, isBusy, runningPublish, runningTranslateDe,
    runningApprovePreview, publishMode, setPublishMode, publishModuleId,
    setPublishModuleId, modules, canPublishLive, approvedMarkdown,
    translateDeOpen, setTranslateDeOpen, translateDeConfirmation,
    setTranslateDeConfirmation, translateDePreview,
    onPublishToPreview, onTakePreviewOffline, onApprovePreview,
    onDownloadApprovedMarkdown, onPublish, onTranslatePublishedToGerman,
    deleteUnitOpen, setDeleteUnitOpen, deleteConfirmation, setDeleteConfirmation,
    onDeleteUnit, onDeleteSelectedDraft, showDeleteDraftDialog,
    setShowDeleteDraftDialog, onConfirmDeleteDraft,
  } = props;

  return (
    <>
      {/* Module & Mode */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Module</Label>
          <Select value={publishModuleId} onValueChange={setPublishModuleId}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue placeholder="Auto-detect" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect</SelectItem>
              {((modules || []) as any[]).map((m: any) => (
                <SelectItem key={String(m._id)} value={String(m._id)}>
                  M{m.moduleNumber}: {m.titleEn || m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Mode</Label>
          <Select value={publishMode} onValueChange={setPublishMode}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="update">Update (merge)</SelectItem>
              <SelectItem value="replace">Replace (full)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Preview / Approve / Publish */}
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onPublishToPreview}
          disabled={isBusy}
        >
          {runningPublish ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
          Preview in App
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onTakePreviewOffline}
          disabled={isBusy}
        >
          Take Preview Offline
        </Button>

        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={onApprovePreview}
          disabled={isBusy || runningApprovePreview}
        >
          {runningApprovePreview ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-2 h-3 w-3" />}
          Approve
        </Button>

        {approvedMarkdown && (
          <Button size="sm" variant="ghost" className="w-full text-xs" onClick={onDownloadApprovedMarkdown}>
            Download approved .md
          </Button>
        )}

        <Separator />

        <Button
          size="sm"
          className="w-full"
          onClick={onPublish}
          disabled={isBusy || !canPublishLive}
        >
          {runningPublish ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Publish Live
        </Button>
        {!canPublishLive && (
          <p className="text-[10px] text-muted-foreground">
            Approve the latest snapshot before publishing live.
          </p>
        )}
      </div>

      <Separator />

      {/* Translate */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="translate" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1">Translate EN → DE</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <AlertDialog open={translateDeOpen} onOpenChange={setTranslateDeOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="w-full" disabled={isBusy || runningTranslateDe}>
                  Translate to German (Preview)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Translate Unit {selected?.draft?.unitNumber} EN → DE?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Creates a German preview version of this unit.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2">
                  <Label>Confirm by typing: <code>TRANSLATE UNIT {selected?.draft?.unitNumber} TO DE</code></Label>
                  <Input
                    value={translateDeConfirmation}
                    onChange={(e) => setTranslateDeConfirmation(e.target.value)}
                    placeholder={`TRANSLATE UNIT ${selected?.draft?.unitNumber} TO DE`}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onTranslatePublishedToGerman}
                    disabled={translateDeConfirmation !== `TRANSLATE UNIT ${selected?.draft?.unitNumber} TO DE`}
                  >
                    Translate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

      {/* Danger Zone */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="danger" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1 text-red-600">Danger Zone</AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <Button size="sm" variant="destructive" className="w-full" onClick={onDeleteSelectedDraft}>
              Delete Draft
            </Button>

            <AlertDialog open={deleteUnitOpen} onOpenChange={setDeleteUnitOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="w-full">
                  Delete Unit from DB
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Unit {selected?.draft?.unitNumber}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This deletes ALL data for this unit (metadata, content, tests, vocabulary).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label>Type: <code>DELETE UNIT {selected?.draft?.unitNumber}</code></Label>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteUnit} disabled={deleteConfirmation !== `DELETE UNIT ${selected?.draft?.unitNumber}`}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Delete Draft Confirm Dialog */}
      <AlertDialog open={showDeleteDraftDialog} onOpenChange={setShowDeleteDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the draft and all its snapshots. Published units are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDeleteDraft}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
