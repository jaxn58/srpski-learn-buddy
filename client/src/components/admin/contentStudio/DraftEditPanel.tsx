import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, FilePlus2 } from "lucide-react";
import { DraftStatusBadge } from "./StatusBadge";
import {
  PreviewStatusBanner,
  type PreviewCreationStateShape,
} from "./PreviewStatusBanner";
import { BriefVersionsPanel, type BriefVersionShape } from "./BriefVersionsPanel";
import { CuratedSectionsPanel, type CuratedSectionEntryShape } from "./CuratedSectionsPanel";
import { useTranslation } from "react-i18next";
import { BriefWorkflow } from "./BriefWorkflow";
import { AuthorNoteField, DraftExtras } from "./DraftExtras";
import { computeBriefVersionNumbers, formatBriefVersionId } from "./utils/briefVersionLabel";

export interface DraftEditPanelCreateParams {
  unitNumber: number;
  moduleNumber: number;
  title: string;
  description?: string;
  templateId?: string;
  creatorBrief?: string;
  refId?: string;
  refChapter?: string;
  refPages?: string;
  refNotes?: string;
  specialistSkillIds?: string[];
  auditorSkillIds?: string[];
  authorNoteName?: string;
  authorNoteQuote?: string;
  /** Run Creator -> Validator -> Lector right after creating the unit. */
  generateAfterCreate?: boolean;
}

export interface DraftEditPanelProps {
  selectedDraftId: string | null;
  /** Explicit create-mode flag from the parent workspace. */
  isCreateMode: boolean;
  /** Bumps when opening New Draft so the create form remounts cleanly. */
  createFormKey?: string | number;
  onOpenInGenerator: () => void;

  // Templates (for create mode)
  draftTemplates: any[] | undefined;
  onCreateDraft: (params: DraftEditPanelCreateParams) => Promise<void>;
  /** Pre-fill the create form (e.g. when triggered via "Use Template" from Settings). */
  initialCreate?: { templateId?: string; creatorBrief?: string };

  // Edit mode: draft data
  selected: any;
  isBusy: boolean;

  // Edit mode: form state
  draftEditTitle: string;
  setDraftEditTitle: (v: string) => void;
  draftEditDescription: string;
  setDraftEditDescription: (v: string) => void;
  draftEditModuleNumber: string;
  setDraftEditModuleNumber: (v: string) => void;
  draftEditUnitNumber: string;
  setDraftEditUnitNumber: (v: string) => void;
  /** Creator brief / unit prompt (maps to inspirationRef.notes — the main authoring prompt). */
  draftCreatorBrief: string;
  setDraftCreatorBrief: (v: string) => void;
  draftAuthorNoteName: string;
  setDraftAuthorNoteName: (v: string) => void;
  draftAuthorNoteQuote: string;
  setDraftAuthorNoteQuote: (v: string) => void;
  onFounderQuoteBlur: () => void;
  draftRefId: string;
  setDraftRefId: (v: string) => void;
  /** Reference-specific note (maps to inspirationRef.referenceNotes — individualizes this unit's use of the reference). */
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
  /** Save unit settings and immediately run Creator -> Validator -> Lector. */
  onSaveAndGenerate: () => Promise<void>;
  /** Section revisions not yet adopted into the Briefing (legacy or failed auto-adoption). */
  pendingSectionRevisions?: Array<{ section: string; instruction: string; at?: number }>;
  onAdoptPendingSections?: () => void;
  adoptingPendingSections?: boolean;
  hasUnsavedChanges: boolean;
  metaAutosaveStatus: "idle" | "saving" | "error";
  metaAutosavedAt: number | null;

  // Ping-Pong: Brief Version history (adopted sections + milestones)
  briefVersions: BriefVersionShape[] | undefined;
  briefVersionBusy: boolean;
  onSelectBriefVersion: (versionId: string) => void;
  onSaveBriefMilestone: (label: string) => void;
  onRenameBriefVersion: (versionId: string, label: string) => void;
  onDeleteBriefVersion: (versionId: string) => void;
}

export function DraftEditPanel(props: DraftEditPanelProps) {
  const {
    selectedDraftId,
    isCreateMode,
    createFormKey,
    onOpenInGenerator,
    draftTemplates,
    onCreateDraft,
    initialCreate,
    selected,
    isBusy,
  } = props;

  const showCreate = isCreateMode;
  const hasDraft = !!selectedDraftId && !!selected?.draft;
  const previewState: PreviewCreationStateShape | undefined = selected?.draft?.publishState;
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showCreate ? (
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold">{t("admin.contentStudio.workflow.newDraft", "New unit")}</span>
            </div>
          ) : hasDraft ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">
                U{selected?.draft?.unitNumber} · M{selected?.draft?.moduleNumber}
                {selected?.draft?.title ? ` — ${selected.draft.title}` : ""}
              </span>
              <DraftStatusBadge status={selected?.draft?.status} />
              {props.hasUnsavedChanges && (
                <Badge variant="secondary" className="text-xs shrink-0">{t("admin.contentStudio.workflow.unsavedShort", "Unsaved")}</Badge>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{t("admin.contentStudio.workflow.selectDraft", "Select a unit or create a new one.")}</span>
          )}
        </div>
        {!showCreate && hasDraft && (
          <Button
            size="sm"
            onClick={onOpenInGenerator}
            disabled={isBusy}
            className="shrink-0"
          >
            {t("admin.contentStudio.workflow.openGenerator", "Open in Generator")}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Preview Status Banner — sticky between header and scroll area.
          Visible only in edit mode when a previewState is present. */}
      {!showCreate && hasDraft && previewState && selectedDraftId && (
        <PreviewStatusBanner
          draftId={selectedDraftId}
          previewState={previewState}
        />
      )}

      {/* Body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 max-w-3xl mx-auto">
          {showCreate ? (
            <CreateForm
              key={String(createFormKey ?? "create") + (initialCreate ? JSON.stringify(initialCreate) : "")}
              draftTemplates={draftTemplates}
              onCreateDraft={onCreateDraft}
              initialTemplateId={initialCreate?.templateId}
              initialCreatorBrief={initialCreate?.creatorBrief}
              refs={props.refs}
              specialistSkills={props.specialistSkills}
              auditorSkills={props.auditorSkills}
            />
          ) : hasDraft ? (
            <EditForm {...props} />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Create Form ─────────────────────────────────────────────────────────────

interface CreateFormProps {
  draftTemplates: any[] | undefined;
  onCreateDraft: (params: DraftEditPanelCreateParams) => Promise<void>;
  initialTemplateId?: string;
  initialCreatorBrief?: string;
  refs: any[] | undefined;
  specialistSkills: any[] | undefined;
  auditorSkills: any[] | undefined;
}

function CreateForm({
  draftTemplates, onCreateDraft,
  initialTemplateId, initialCreatorBrief,
  refs, specialistSkills, auditorSkills,
}: CreateFormProps) {
  const [templateId, setTemplateId] = useState<string>(initialTemplateId ?? "");
  const [unitNumber, setUnitNumber] = useState("3");
  const [moduleNumber, setModuleNumber] = useState("1");
  const [title, setTitle] = useState("New Unit");
  const [description, setDescription] = useState("");
  const [creatorBrief, setCreatorBrief] = useState(initialCreatorBrief ?? "");
  const [refId, setRefId] = useState("");
  const [refChapter, setRefChapter] = useState("");
  const [refPages, setRefPages] = useState("");
  const [refNotes, setRefNotes] = useState("");
  const [specialistSkillIds, setSpecialistSkillIds] = useState<string[]>([]);
  const [auditorSkillIds, setAuditorSkillIds] = useState<string[]>([]);
  const [authorNoteName, setAuthorNoteName] = useState<string>("Jacksenn");
  const [authorNoteQuote, setAuthorNoteQuote] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const handleTemplateChange = (v: string) => {
    const next = v === "none" ? "" : v;
    setTemplateId(next);
    if (!next) return;
    const tpl = ((draftTemplates || []) as any[]).find((t: any) => String(t?._id) === next) as any;
    const brief = String(tpl?.inspirationRef?.notes || "").trim();
    if (brief) setCreatorBrief(brief);
    // Pre-fill reference from template
    const ref = tpl?.inspirationRef || {};
    if (ref.referenceId) setRefId(String(ref.referenceId));
    if (ref.chapter) setRefChapter(String(ref.chapter));
    if (ref.pages) setRefPages(String(ref.pages));
    if (ref.referenceNotes) setRefNotes(String(ref.referenceNotes));
    // Pre-fill skills from template
    if (Array.isArray(tpl?.specialistSkillIds)) setSpecialistSkillIds(tpl.specialistSkillIds.map(String));
    if (Array.isArray(tpl?.auditorSkillIds)) setAuditorSkillIds(tpl.auditorSkillIds.map(String));
  };

  const parsedUnit = Number(unitNumber);
  const parsedModule = Number(moduleNumber);
  const numbersValid =
    Number.isInteger(parsedUnit) &&
    parsedUnit > 0 &&
    Number.isInteger(parsedModule) &&
    parsedModule > 0;

  // Live duplicate check against other drafts only. A live-published unit is
  // NOT a collision - a fresh draft for an existing live unit is the intended
  // update workflow. Skip while numbers are still invalid (e.g. mid-typing).
  const collisionCheck = useQuery(
    api.contentStudio.checkUnitModuleCollision,
    numbersValid
      ? { moduleNumber: parsedModule, unitNumber: parsedUnit }
      : "skip"
  );
  const collides = collisionCheck?.collides === true;
  const collisionMessage = collides
    ? collisionCheck?.message ??
      `Another draft already exists for Unit ${parsedUnit} in Module ${parsedModule}.`
    : null;

  const handleCreate = async (generateAfterCreate: boolean) => {
    if (!numbersValid || collides) return;
    setCreating(true);
    try {
      await onCreateDraft({
        generateAfterCreate,
        unitNumber: parsedUnit,
        moduleNumber: parsedModule,
        title: title.trim() || `Unit ${parsedUnit}`,
        description: description.trim() || undefined,
        templateId: templateId || undefined,
        creatorBrief: creatorBrief.trim() || undefined,
        refId: refId || undefined,
        refChapter: refChapter.trim() || undefined,
        refPages: refPages.trim() || undefined,
        refNotes: refNotes.trim() || undefined,
        specialistSkillIds: specialistSkillIds.length ? specialistSkillIds : undefined,
        auditorSkillIds: auditorSkillIds.length ? auditorSkillIds : undefined,
        authorNoteName: authorNoteName.trim() || undefined,
        authorNoteQuote: authorNoteQuote.trim() || undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const { t } = useTranslation();

  const templateSelect = (draftTemplates || []).length > 0 ? (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{t("admin.contentStudio.workflow.preset", "Template (optional)")}</Label>
      <Select value={templateId || "none"} onValueChange={handleTemplateChange}>
        <SelectTrigger className="h-10 text-sm">
          <SelectValue placeholder={t("admin.contentStudio.workflow.presetSelect", "Select a template")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-sm">{t("admin.contentStudio.workflow.presetNone", "None")}</SelectItem>
          {((draftTemplates || []) as any[]).map((tpl: any) => (
            <SelectItem key={String(tpl._id)} value={String(tpl._id)} className="text-sm">
              {String(tpl.name || "Untitled")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {t("admin.contentStudio.workflow.presetHelp", "A template pre-fills briefing, reference and skills. You can change everything afterwards.")}
      </p>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <BriefWorkflow
        mode="create"
        moduleNumber={moduleNumber}
        setModuleNumber={setModuleNumber}
        unitNumber={unitNumber}
        setUnitNumber={setUnitNumber}
        collides={collides}
        collisionMessage={collisionMessage}
        numbersValid={numbersValid}
        title={title}
        setTitle={setTitle}
        description={description}
        setDescription={setDescription}
        brief={creatorBrief}
        setBrief={setCreatorBrief}
        idPrefix="create-brief"
        onPrimary={() => handleCreate(true)}
        onSecondary={() => handleCreate(false)}
        actionBusy={creating}
        expertChildren={
          <>
            {templateSelect}
            <DraftExtras
              refs={refs}
              refId={refId} setRefId={setRefId}
              refChapter={refChapter} setRefChapter={setRefChapter}
              refPages={refPages} setRefPages={setRefPages}
              refNotes={refNotes} setRefNotes={setRefNotes}
              specialistSkills={specialistSkills}
              auditorSkills={auditorSkills}
              specialistSkillIds={specialistSkillIds} setSpecialistSkillIds={setSpecialistSkillIds}
              auditorSkillIds={auditorSkillIds} setAuditorSkillIds={setAuditorSkillIds}
              idPrefix="create"
            />
          </>
        }
        belowResult={
          <AuthorNoteField
            authorNoteName={authorNoteName} setAuthorNoteName={setAuthorNoteName}
            authorNoteQuote={authorNoteQuote} setAuthorNoteQuote={setAuthorNoteQuote}
            idPrefix="create"
          />
        }
      />
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

type EditFormProps = Omit<
  DraftEditPanelProps,
  "onOpenInGenerator" | "draftTemplates" | "onCreateDraft" | "isCreateMode" | "createFormKey" | "initialCreate"
>;

function EditForm(props: EditFormProps) {
  const {
    selectedDraftId,
    selected, isBusy,
    draftEditTitle, setDraftEditTitle,
    draftEditDescription, setDraftEditDescription,
    draftEditModuleNumber, setDraftEditModuleNumber,
    draftEditUnitNumber, setDraftEditUnitNumber,
    draftCreatorBrief, setDraftCreatorBrief,
    draftAuthorNoteName, setDraftAuthorNoteName,
    draftAuthorNoteQuote, setDraftAuthorNoteQuote, onFounderQuoteBlur,
    draftRefId, setDraftRefId,
    draftRefNotes, setDraftRefNotes,
    draftRefChapter, setDraftRefChapter,
    draftRefPages, setDraftRefPages,
    refs, specialistSkills, auditorSkills,
    draftSpecialistSkillIds, setDraftSpecialistSkillIds,
    draftAuditorSkillIds, setDraftAuditorSkillIds,
    onSaveDraftSkillsAndReference,
    onSaveAndGenerate,
    pendingSectionRevisions,
    onAdoptPendingSections,
    adoptingPendingSections,
    hasUnsavedChanges, metaAutosaveStatus, metaAutosavedAt,
    briefVersions, briefVersionBusy,
    onSelectBriefVersion, onSaveBriefMilestone, onRenameBriefVersion, onDeleteBriefVersion,
  } = props;

  const curatedSections: CuratedSectionEntryShape[] =
    ((selected as any)?.draft?.curatedSections as CuratedSectionEntryShape[] | undefined) ?? [];

  const parsedUnit = Number(draftEditUnitNumber);
  const parsedModule = Number(draftEditModuleNumber);
  const numbersValid =
    Number.isInteger(parsedUnit) &&
    parsedUnit > 0 &&
    Number.isInteger(parsedModule) &&
    parsedModule > 0;

  // Live duplicate check against other drafts only. Excludes the current
  // draft so re-saving without changes does not falsely flag the row against
  // itself. Live-published units are intentionally NOT considered a collision
  // because a fresh draft is the update path.
  const collisionCheck = useQuery(
    api.contentStudio.checkUnitModuleCollision,
    numbersValid && selectedDraftId
      ? {
          moduleNumber: parsedModule,
          unitNumber: parsedUnit,
          excludeDraftId: selectedDraftId as any,
        }
      : "skip"
  );
  const collides = collisionCheck?.collides === true;
  const collisionMessage = collides
    ? collisionCheck?.message ??
      `Another draft already exists for Unit ${parsedUnit} in Module ${parsedModule}.`
    : null;

  const draftModuleNumber = (selected as any)?.draft?.moduleNumber;
  const draftUnitNumber = (selected as any)?.draft?.unitNumber;
  const activeBriefVersionId = (selected as any)?.draft?.activeBriefVersionId;
  const briefVersionNumbers = computeBriefVersionNumbers(briefVersions as BriefVersionShape[] | undefined);
  const activeBriefVersion = Array.isArray(briefVersions)
    ? (briefVersions as BriefVersionShape[]).find((v) => String(v._id) === String(activeBriefVersionId))
    : undefined;
  const activeBriefSummary = activeBriefVersion
    ? (() => {
        const id = formatBriefVersionId(
          draftModuleNumber,
          draftUnitNumber,
          briefVersionNumbers.get(String(activeBriefVersion._id)),
        );
        const label = activeBriefVersion.label?.trim();
        return label ? `${id} · ${label}` : id;
      })()
    : null;
  const briefVersionCount = Array.isArray(briefVersions) ? briefVersions.length : 0;
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <BriefWorkflow
        mode="edit"
        moduleNumber={draftEditModuleNumber}
        setModuleNumber={setDraftEditModuleNumber}
        unitNumber={draftEditUnitNumber}
        setUnitNumber={setDraftEditUnitNumber}
        collides={collides}
        collisionMessage={collisionMessage}
        numbersValid={numbersValid}
        title={draftEditTitle}
        setTitle={setDraftEditTitle}
        description={draftEditDescription}
        setDescription={setDraftEditDescription}
        brief={draftCreatorBrief}
        setBrief={setDraftCreatorBrief}
        disabled={isBusy}
        idPrefix={`edit-brief-${String(selectedDraftId ?? "")}`}
        onPrimary={onSaveAndGenerate}
        onSecondary={onSaveDraftSkillsAndReference}
        actionBusy={isBusy}
        expertChildren={
          <>
            {/* Briefing versions (adopted sections + milestones) */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="brief-versions" className="rounded-lg border bg-muted/20 px-3">
                <AccordionTrigger className="py-2 hover:no-underline">
                  <div className="flex items-center gap-2 min-w-0 text-left">
                    <span className="text-sm font-semibold shrink-0">{t("admin.contentStudio.workflow.briefVersions", "Briefing versions")}</span>
                    {briefVersionCount > 0 && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {briefVersionCount}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {activeBriefSummary
                        ? `· ${t("admin.contentStudio.workflow.briefVersionActive", "Active")}: ${activeBriefSummary}`
                        : `· ${t("admin.contentStudio.workflow.briefVersionNone", "none yet")}`}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-3">
                  <BriefVersionsPanel
                    versions={briefVersions}
                    activeBriefVersionId={activeBriefVersionId}
                    busy={briefVersionBusy}
                    moduleNumber={draftModuleNumber}
                    unitNumber={draftUnitNumber}
                    onSelectVersion={onSelectBriefVersion}
                    onSaveMilestone={onSaveBriefMilestone}
                    onRenameVersion={onRenameBriefVersion}
                    onDeleteVersion={onDeleteBriefVersion}
                    hideTitle
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <DraftExtras
              refs={refs}
              refId={draftRefId} setRefId={setDraftRefId}
              refChapter={draftRefChapter} setRefChapter={setDraftRefChapter}
              refPages={draftRefPages} setRefPages={setDraftRefPages}
              refNotes={draftRefNotes} setRefNotes={setDraftRefNotes}
              specialistSkills={specialistSkills}
              auditorSkills={auditorSkills}
              specialistSkillIds={draftSpecialistSkillIds} setSpecialistSkillIds={setDraftSpecialistSkillIds}
              auditorSkillIds={draftAuditorSkillIds} setAuditorSkillIds={setDraftAuditorSkillIds}
              disabled={isBusy}
              idPrefix="edit"
            />
          </>
        }
        belowResult={
          <>
            <AuthorNoteField
              authorNoteName={draftAuthorNoteName} setAuthorNoteName={setDraftAuthorNoteName}
              authorNoteQuote={draftAuthorNoteQuote} setAuthorNoteQuote={setDraftAuthorNoteQuote}
              onAuthorQuoteBlur={onFounderQuoteBlur}
              disabled={isBusy}
              idPrefix="edit"
            />
            {/* Sections the author revised and thereby anchored in the Briefing.
                Renders nothing until the first revision, so it costs no attention
                in the normal flow but is visible when it matters. */}
            <CuratedSectionsPanel
              curatedSections={curatedSections}
              briefVersions={briefVersions}
              moduleNumber={draftModuleNumber}
              unitNumber={draftUnitNumber}
              pendingRevisions={props.pendingSectionRevisions}
              onAdoptPending={props.onAdoptPendingSections}
              adoptingPending={props.adoptingPendingSections}
            />
          </>
        }
      />

      {/* Autosave status */}
      <div className={cn("flex items-center justify-center gap-2 text-xs pb-4", "text-muted-foreground")}>
        {metaAutosaveStatus === "saving" && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> {t("admin.contentStudio.workflow.autosaving", "Saving automatically...")}
          </span>
        )}
        {metaAutosaveStatus === "error" && (
          <span className="text-red-600">{t("admin.contentStudio.workflow.autosaveFailed", "Automatic save failed")}</span>
        )}
        {metaAutosavedAt && metaAutosaveStatus === "idle" && (
          <span>{t("admin.contentStudio.workflow.autosavedAt", { defaultValue: "Saved automatically at {{time}}", time: new Date(metaAutosavedAt).toLocaleTimeString() })}</span>
        )}
        {hasUnsavedChanges && (
          <Badge variant="secondary" className="text-xs">{t("admin.contentStudio.workflow.unsaved", "Unsaved changes")}</Badge>
        )}
      </div>
    </div>
  );
}
