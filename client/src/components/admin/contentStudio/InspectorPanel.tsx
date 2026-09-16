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
import { Trans, useTranslation } from "react-i18next";
import { AiRunTokenLine, formatAiRunTimestamp, useAiRunStageLabel } from "./AiRunMeta";
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
import { Loader2, CheckCircle, XCircle, Sparkles, RotateCcw, X } from "lucide-react";
import type { SectionId } from "./types";
import { SECTION_OPTIONS } from "./constants";
import { useSectionLabel } from "./utils/sectionLabel";
import { isLectorStale } from "./utils/draftReviewState";
import { DraftStatusBadge } from "./StatusBadge";
import {
  PreviewStatusBanner,
  type PreviewCreationStateShape,
} from "./PreviewStatusBanner";

export type InspectorStep = "generate" | "review" | "createPreview";

export interface InspectorPanelProps {
  activeStep: InspectorStep;
  selected: any;
  selectedDraftId: string | null;
  isBusy: boolean;

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

  // Preview step (module selection; preview creation happens in Artifacts panel)
  previewModuleId: string;
  setPreviewModuleId: (v: string) => void;
  modules: any[] | undefined;
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
  const { activeStep, selected, selectedDraftId } = props;
  const { t } = useTranslation();
  const previewState = selected?.draft?.publishState as PreviewCreationStateShape | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {activeStep === "generate"
            ? t("admin.contentStudio.inspector.stepGenerate", "Generator")
            : activeStep === "review"
              ? t("admin.contentStudio.inspector.stepReview", "Review")
              : t("admin.contentStudio.inspector.stepPreview", "Preview")}
        </span>
        <DraftStatusBadge status={selected?.draft?.status} />
      </div>
      {previewState && selectedDraftId && (
        <PreviewStatusBanner draftId={selectedDraftId} previewState={previewState} />
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {activeStep === "generate" && <GenerateContent {...props} />}
          {activeStep === "review" && <ReviewContent {...props} />}
          {activeStep === "createPreview" && <CreatePreviewContent {...props} />}
        </div>
      </ScrollArea>
    </div>
  );
}

function GenerateContent(props: InspectorPanelProps) {
  const {
    isBusy, runningCreator, runningValidator, runningCreateValidate,
    progressPercent, progressMessage, elapsedSeconds, currentTaskLabel,
    onGenerate, onRunSpecialist, onRunValidate,
  } = props;
  const { t } = useTranslation();

  return (
    <>
      <Button
        className="w-full"
        onClick={onGenerate}
        disabled={isBusy}
      >
        {runningCreateValidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {t("admin.contentStudio.inspector.generateAuto", "Generate (auto)")}
      </Button>

      {isBusy && (
        <div className="space-y-2">
          {progressPercent != null && <Progress value={progressPercent} className="h-2" />}
          <div className="text-xs text-muted-foreground">{progressMessage || currentTaskLabel}</div>
          <div className="text-xs text-muted-foreground/60">
            {t("admin.contentStudio.inspector.elapsed", { defaultValue: "{{s}}s elapsed", s: elapsedSeconds })}
          </div>
        </div>
      )}

      <Separator />

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1">
            {t("admin.contentStudio.inspector.advanced", "Advanced")}
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <Button size="sm" variant="outline" className="w-full" onClick={onRunSpecialist} disabled={isBusy}>
              {runningCreator ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              {t("admin.contentStudio.inspector.runCreatorOnly", "Run Creator only")}
            </Button>
            <Button size="sm" variant="outline" className="w-full" onClick={onRunValidate} disabled={isBusy}>
              {runningValidator ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              {t("admin.contentStudio.inspector.runValidatorOnly", "Run Validator only")}
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
  const { t } = useTranslation();
  const stageLabel = useAiRunStageLabel();
  const sectionLabel = useSectionLabel();

  const lectorStale = isLectorStale(selected?.draft, findings);

  return (
    <>
      {lectorStale && (
        <div className="rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs leading-relaxed">
          {t(
            "admin.contentStudio.inspector.lectorStale",
            "The content changed after the last Lector run. Run the Lector again before creating a preview.",
          )}
        </div>
      )}

      {/* QA Summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {errorFindings.length > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="mr-1 h-3 w-3" />{" "}
            {t("admin.contentStudio.inspector.errorsCount", { defaultValue: "{{n}} errors", n: errorFindings.length })}
          </Badge>
        )}
        {warningFindings.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {t("admin.contentStudio.inspector.warningsCount", { defaultValue: "{{n}} warnings", n: warningFindings.length })}
          </Badge>
        )}
        {(() => {
          const infoCount = findings.filter((f: any) => f.severity === "info").length;
          if (errorFindings.length === 0 && warningFindings.length === 0) {
            return (
              <Badge variant="outline" className="text-[10px]">
                <CheckCircle className="mr-1 h-3 w-3 text-emerald-500" />
                {infoCount > 0
                  ? t("admin.contentStudio.inspector.noIssuesWithInfo", { defaultValue: "No issues ({{n}} info)", n: infoCount })
                  : t("admin.contentStudio.inspector.noIssues", "No issues")}
              </Badge>
            );
          }
          if (infoCount > 0) {
            return (
              <Badge variant="outline" className="text-[10px] border-blue-300/60 text-blue-600 dark:text-blue-400">
                {t("admin.contentStudio.inspector.infoCount", { defaultValue: "{{n}} info", n: infoCount })}
              </Badge>
            );
          }
          return null;
        })()}
      </div>

      {/* Fix Findings — button always visible for consistency with QAFindingsPanel.
          Disabled unless there are error/warning findings OR the admin has typed
          human notes (info-only findings alone are not enough to auto-fix). */}
      <div className="space-y-2">
        <Label className="text-xs">
          {t("admin.contentStudio.inspector.humanNotesLabel", "Author notes for the fix run")}
        </Label>
        <Textarea
          value={fixHumanNotes}
          onChange={(e) => setFixHumanNotes(e.target.value)}
          rows={2}
          placeholder={t("admin.contentStudio.inspector.humanNotesPlaceholder", "Optional: additional instructions for the fix…")}
          className="text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={onRunRevise}
          disabled={
            isBusy ||
            (errorFindings.length === 0 &&
              warningFindings.length === 0 &&
              !fixHumanNotes.trim())
          }
        >
          {runningRevise ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-2 h-3 w-3" />}
          {t("admin.contentStudio.inspector.fixFindings", "Fix findings")}
        </Button>
      </div>

      <Separator />

      {/* Section Edit */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t("admin.contentStudio.inspector.editSection", "Edit section")}</Label>
        <Select value={expandSection} onValueChange={(v) => setExpandSection(v as SectionId)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{sectionLabel(s.value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={expandInstruction}
          onChange={(e) => setExpandInstruction(e.target.value)}
          rows={3}
          placeholder={t("admin.contentStudio.inspector.sectionInstructionPlaceholder", "Describe changes for this section…")}
          className="text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          onClick={onSectionRevise}
          disabled={isBusy || !expandInstruction.trim()}
        >
          {runningSectionRevise ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          {t("admin.contentStudio.inspector.applySectionChanges", "Apply section changes")}
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
        {t("admin.contentStudio.inspector.runLector", "Run Lector")}
      </Button>

      {/* Findings List */}
      {findings.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="findings" className="border-none">
            <AccordionTrigger className="text-xs font-semibold py-1">
              {t("admin.contentStudio.inspector.allFindings", { defaultValue: "All findings ({{n}})", n: findings.length })}
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pt-1 min-w-0">
              {findings.map((f: any, i: number) => (
                <div
                  key={String(f._id || i)}
                  className={cn(
                    "rounded border p-2 text-xs min-w-0",
                    f.dismissed ? "opacity-40" : "",
                    f.severity === "error" ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" :
                    f.severity === "warning" ? "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30" :
                    "border-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-medium min-w-0 flex-1 break-words">{f.message}</span>
                    <button
                      className="shrink-0 ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => onDismissFinding({ findingId: f._id, dismissed: !f.dismissed })}
                    >
                      {f.dismissed ? <RotateCcw className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </button>
                  </div>
                  {f.path && <div className="text-muted-foreground mt-0.5 font-mono break-all">{f.path}</div>}
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
              {t("admin.contentStudio.aiRuns.title", "AI Runs")} ({selected.aiRuns.length})
            </AccordionTrigger>
            <AccordionContent className="space-y-1 pt-1">
              {(selected.aiRuns as any[]).slice(0, 10).map((r: any, i: number) => (
                <div key={String(r._id || i)} className="rounded border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      {r.status === "success" ? <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" /> : <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                      <span className="font-medium">{stageLabel(r.stage)}</span>
                      <span className="text-muted-foreground truncate">{r.model}</span>
                    </div>
                    <span className="text-muted-foreground text-xs shrink-0">{formatAiRunTimestamp(r)}</span>
                  </div>
                  <AiRunTokenLine run={r} className="text-muted-foreground text-xs mt-0.5" />
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

function CreatePreviewContent(props: InspectorPanelProps) {
  const {
    selected, previewModuleId,
    setPreviewModuleId, modules,
    deleteUnitOpen, setDeleteUnitOpen, deleteConfirmation, setDeleteConfirmation,
    onDeleteUnit, onDeleteSelectedDraft, showDeleteDraftDialog,
    setShowDeleteDraftDialog, onConfirmDeleteDraft,
  } = props;
  const { t } = useTranslation();

  return (
    <>
      {/* Module */}
      <div className="space-y-2">
        <div>
          <Label className="text-xs">{t("admin.contentStudio.inspector.moduleLabel", "Module")}</Label>
          <Select value={previewModuleId} onValueChange={setPreviewModuleId}>
            <SelectTrigger className="h-8 text-sm mt-1">
              <SelectValue placeholder={t("admin.contentStudio.inspector.autoDetect", "Auto-detect")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">{t("admin.contentStudio.inspector.autoDetect", "Auto-detect")}</SelectItem>
              {((modules || []) as any[]).map((m: any) => (
                <SelectItem key={String(m._id)} value={String(m._id)}>
                  M{m.moduleNumber}: {m.titleEn || m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <Trans
            i18nKey="admin.contentStudio.inspector.previewHint"
            defaults="Use <strong>Save &amp; Create preview</strong> in the Markdown tab to push a preview to the database. Publishing (Update / Replace) happens only in the <strong>Unit Manager</strong>."
            components={{ strong: <strong /> }}
          />
        </p>
      </div>

      <Separator />

      {/* Danger Zone */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="danger" className="border-none">
          <AccordionTrigger className="text-xs font-semibold py-1 text-red-600">
            {t("admin.contentStudio.inspector.dangerZone", "Danger zone")}
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-2">
            <Button size="sm" variant="destructive" className="w-full" onClick={onDeleteSelectedDraft}>
              {t("admin.contentStudio.inspector.deleteUnit", "Delete unit")}
            </Button>

            <AlertDialog open={deleteUnitOpen} onOpenChange={setDeleteUnitOpen}>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="w-full">
                  {t("admin.contentStudio.inspector.deleteUnitFromDb", "Delete unit from DB")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("admin.contentStudio.inspector.deleteUnitTitle", { defaultValue: "Delete unit {{n}}?", n: selected?.draft?.unitNumber })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "admin.contentStudio.inspector.deleteUnitDescription",
                      "This deletes all published data for this unit (metadata, content, tests, vocabulary) and user progress. The unit in the studio and its drafts are preserved."
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label>{t("admin.contentStudio.inspector.typeToConfirm", "Type:")} <code>DELETE UNIT {selected?.draft?.unitNumber}</code></Label>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("admin.contentStudio.inspector.cancel", "Cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteUnit} disabled={deleteConfirmation !== `DELETE UNIT ${selected?.draft?.unitNumber}`}>
                    {t("admin.contentStudio.inspector.delete", "Delete")}
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
            <AlertDialogTitle>{t("admin.contentStudio.inspector.deleteUnitConfirmTitle", "Delete this draft?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.contentStudio.inspector.deleteUnitConfirmDescription",
                "This removes only this draft and its snapshots, findings and AI run logs. The published unit and any other drafts are not affected."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.contentStudio.inspector.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDeleteDraft}>{t("admin.contentStudio.inspector.delete", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
