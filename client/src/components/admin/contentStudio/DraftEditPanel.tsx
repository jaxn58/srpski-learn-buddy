import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, FilePlus2 } from "lucide-react";
import { DraftStatusBadge } from "./StatusBadge";
import {
  PreviewStatusBanner,
  type PreviewCreationStateShape,
} from "./PreviewStatusBanner";
import { BriefVersionsPanel, type BriefVersionShape } from "./BriefVersionsPanel";
import { CuratedSectionsPanel, type CuratedSectionEntryShape } from "./CuratedSectionsPanel";
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {showCreate ? (
            <div className="flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold">New Draft</span>
            </div>
          ) : hasDraft ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">
                U{selected?.draft?.unitNumber} · M{selected?.draft?.moduleNumber}
                {selected?.draft?.title ? ` — ${selected.draft.title}` : ""}
              </span>
              <DraftStatusBadge status={selected?.draft?.status} />
              {props.hasUnsavedChanges && (
                <Badge variant="secondary" className="text-[10px] shrink-0">Unsaved</Badge>
              )}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Select a draft or create a new one.</span>
          )}
        </div>
        {!showCreate && hasDraft && (
          <Button
            size="sm"
            onClick={onOpenInGenerator}
            disabled={isBusy}
            className="shrink-0"
          >
            Open in Generator
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
    if (ref.notes && !brief) setRefNotes(String(ref.notes));
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
    ? `Another draft already exists for Unit ${parsedUnit} in Module ${parsedModule}.`
    : null;

  const handleCreate = async () => {
    if (!numbersValid || collides) return;
    setCreating(true);
    try {
      await onCreateDraft({
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

  return (
    <div className="space-y-6">
      {/* Template */}
      {(draftTemplates || []).length > 0 && (
        <div className="space-y-2">
          <Label>Template (optional)</Label>
          <Select value={templateId || "none"} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {((draftTemplates || []) as any[]).map((t: any) => (
                <SelectItem key={String(t._id)} value={String(t._id)}>
                  {String(t.name || "Untitled")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecting a template pre-fills reference, skills, and creator brief below.
          </p>
          <Separator />
        </div>
      )}

      {/* Numbers + Title */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Module Number</Label>
          <Input
            value={moduleNumber}
            onChange={(e) => setModuleNumber(e.target.value)}
            aria-invalid={collides || undefined}
            className={cn(collides && "border-destructive focus-visible:ring-destructive")}
          />
        </div>
        <div className="space-y-2">
          <Label>Unit Number</Label>
          <Input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            aria-invalid={collides || undefined}
            className={cn(collides && "border-destructive focus-visible:ring-destructive")}
          />
        </div>
      </div>
      {collisionMessage && (
        <p className="text-sm text-destructive" role="alert">
          {collisionMessage}
        </p>
      )}

      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Unit description (1 short sentence)</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="This becomes **Description:** in the unit header (max ~120 chars)."
        />
        <p className="text-xs text-muted-foreground">
          Becomes the unit header line <span className="font-mono">**Description:** ...</span>.
        </p>
      </div>

      <Separator />

      {/* Creator Brief */}
      <div className="space-y-2">
        <Label>Creator brief / unit prompt</Label>
        <p className="text-xs text-muted-foreground">
          Main prompt for the unit (scenes, didactic progression). German or English — output is always English.
        </p>
        <Textarea
          value={creatorBrief}
          onChange={(e) => setCreatorBrief(e.target.value)}
          className="min-h-[180px]"
          placeholder={[
            "Example:",
            "- Situation: café in Montenegro",
            "- Prerequisites: greetings (Unit 1), introductions (Unit 2)",
            "- New: ordering drinks, asking for the bill, 'Ja bih ...'",
            "- Constraints: max 30 vocab, max 4 dialogues, keep it concise",
          ].join("\n")}
        />
      </div>

      <Separator />

      {/* Reference */}
      <div className="space-y-3">
        <Label className="font-semibold">Reference (optional)</Label>
        <Select
          value={refId || "__none__"}
          onValueChange={(v) => {
            setRefId(v === "__none__" ? "" : v);
            if (v === "__none__") { setRefChapter(""); setRefPages(""); setRefNotes(""); }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reference..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {((refs || []) as any[]).filter((r: any) => r?.isActive).map((r: any) => (
              <SelectItem key={String(r._id)} value={String(r._id)}>
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {refId && (
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Chapter</Label>
              <Input value={refChapter} onChange={(e) => setRefChapter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pages</Label>
              <Input value={refPages} onChange={(e) => setRefPages(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={refNotes} onChange={(e) => setRefNotes(e.target.value)} rows={2} />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Skills */}
      <div className="space-y-4">
        <Label className="font-semibold">Skills (optional)</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creator Skills</Label>
            <div className="space-y-1.5">
              {((specialistSkills || []) as any[]).map((s: any) => (
                <label key={String(s._id)} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={specialistSkillIds.includes(String(s._id))}
                    onChange={(e) => {
                      const id = String(s._id);
                      setSpecialistSkillIds(
                        e.target.checked
                          ? [...specialistSkillIds, id]
                          : specialistSkillIds.filter((x) => x !== id)
                      );
                    }}
                    className="rounded"
                  />
                  {s.name}
                </label>
              ))}
              {!specialistSkills?.length && (
                <span className="text-sm text-muted-foreground">No creator skills defined.</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lector Skills</Label>
            <div className="space-y-1.5">
              {((auditorSkills || []) as any[]).map((s: any) => (
                <label key={String(s._id)} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={auditorSkillIds.includes(String(s._id))}
                    onChange={(e) => {
                      const id = String(s._id);
                      setAuditorSkillIds(
                        e.target.checked
                          ? [...auditorSkillIds, id]
                          : auditorSkillIds.filter((x) => x !== id)
                      );
                    }}
                    className="rounded"
                  />
                  {s.name}
                </label>
              ))}
              {!auditorSkills?.length && (
                <span className="text-sm text-muted-foreground">No lector skills defined.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Author Note */}
      <div className="space-y-3">
        <Label className="font-semibold">Author Note (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Displayed as the founder voice at the top of the unit. Leave the quote empty to add it later in the draft settings.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={authorNoteName}
              onChange={(e) => setAuthorNoteName(e.target.value)}
              placeholder="e.g. Jacksenn"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Quote</Label>
            <Textarea
              value={authorNoteQuote}
              onChange={(e) => setAuthorNoteQuote(e.target.value)}
              rows={3}
              placeholder="A brief motivational quote..."
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <Button
          className="w-full"
          onClick={() => void handleCreate()}
          disabled={creating || !numbersValid || collides}
        >
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Draft
        </Button>
      </div>
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
    ? `Another draft already exists for Unit ${parsedUnit} in Module ${parsedModule}.`
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

  return (
    <div className="space-y-6">
      {/* Brief Versions (Ping-Pong) — compact, collapsed by default, at the top of the brief */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="brief-versions" className="rounded-lg border bg-muted/20 px-3">
          <AccordionTrigger className="py-2 hover:no-underline">
            <div className="flex items-center gap-2 min-w-0 text-left">
              <span className="text-sm font-semibold shrink-0">Brief Versions</span>
              {briefVersionCount > 0 && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {briefVersionCount}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {activeBriefSummary ? `· Active: ${activeBriefSummary}` : "· none yet"}
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

      {/* Numbers */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Module Number</Label>
            <Input
              value={draftEditModuleNumber}
              onChange={(e) => setDraftEditModuleNumber(e.target.value)}
              aria-invalid={collides || undefined}
              className={cn(collides && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
          <div className="space-y-2">
            <Label>Unit Number</Label>
            <Input
              value={draftEditUnitNumber}
              onChange={(e) => setDraftEditUnitNumber(e.target.value)}
              aria-invalid={collides || undefined}
              className={cn(collides && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
        </div>
        {collisionMessage && (
          <p className="text-sm text-destructive" role="alert">
            {collisionMessage}
          </p>
        )}
        {!numbersValid && (draftEditUnitNumber !== "" || draftEditModuleNumber !== "") && (
          <p className="text-xs text-muted-foreground">
            Module and Unit must both be positive integers.
          </p>
        )}
      </div>

      {/* Title + Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={draftEditTitle}
            onChange={(e) => setDraftEditTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Description / Creator Brief</Label>
          <Textarea
            value={draftEditDescription}
            onChange={(e) => setDraftEditDescription(e.target.value)}
            rows={6}
          />
        </div>

        <CuratedSectionsPanel
          curatedSections={curatedSections}
          briefVersions={briefVersions}
          moduleNumber={draftModuleNumber}
          unitNumber={draftUnitNumber}
        />
      </div>

      <Separator />

      {/* Reference */}
      <div className="space-y-3">
        <Label className="font-semibold">Reference</Label>
        <Select
          value={draftRefId || "__none__"}
          onValueChange={(v) => setDraftRefId(v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select reference..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {((refs || []) as any[]).filter((r: any) => r?.isActive).map((r: any) => (
              <SelectItem key={String(r._id)} value={String(r._id)}>
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draftRefId && (
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Chapter</Label>
              <Input
                value={draftRefChapter}
                onChange={(e) => setDraftRefChapter(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pages</Label>
              <Input
                value={draftRefPages}
                onChange={(e) => setDraftRefPages(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">
            {draftRefId ? "Reference notes" : "Creator brief / notes"}
          </Label>
          <Textarea
            value={draftRefNotes}
            onChange={(e) => setDraftRefNotes(e.target.value)}
            rows={draftRefId ? 2 : 6}
            placeholder={
              draftRefId
                ? "Additional notes about how to use this reference..."
                : "Main prompt for the unit (scenes, didactic progression)."
            }
          />
        </div>
      </div>

      <Separator />

      {/* Skills */}
      <Accordion type="single" collapsible className="w-full" defaultValue="skills">
        <AccordionItem value="skills" className="border-none">
          <AccordionTrigger className="text-sm font-semibold py-1">Skills</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Creator Skills</Label>
              <div className="space-y-1.5">
                {((specialistSkills || []) as any[]).map((s: any) => (
                  <label key={String(s._id)} className="flex items-center gap-2 text-sm cursor-pointer">
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
                {!specialistSkills?.length && (
                  <span className="text-sm text-muted-foreground">No creator skills defined.</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Lector Skills</Label>
              <div className="space-y-1.5">
                {((auditorSkills || []) as any[]).map((s: any) => (
                  <label key={String(s._id)} className="flex items-center gap-2 text-sm cursor-pointer">
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
                {!auditorSkills?.length && (
                  <span className="text-sm text-muted-foreground">No lector skills defined.</span>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />

      {/* Author Note */}
      <div className="space-y-3">
        <Label className="font-semibold">Author Note (optional)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={draftAuthorNoteName}
              onChange={(e) => setDraftAuthorNoteName(e.target.value)}
              placeholder="e.g. Maxi"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Quote</Label>
            <Textarea
              value={draftAuthorNoteQuote}
              onChange={(e) => setDraftAuthorNoteQuote(e.target.value)}
              onBlur={onFounderQuoteBlur}
              rows={2}
              placeholder="A brief motivational quote..."
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Save */}
      <div className="space-y-2 pb-4">
        <Button
          className="w-full"
          onClick={onSaveDraftSkillsAndReference}
          disabled={!props.selectedDraftId || isBusy || !numbersValid || collides}
        >
          Save Draft Settings
        </Button>
        <div className={cn("flex items-center gap-2 text-xs", "text-muted-foreground")}>
          {metaAutosaveStatus === "saving" && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Autosaving...
            </span>
          )}
          {metaAutosaveStatus === "error" && (
            <span className="text-red-600">Autosave failed</span>
          )}
          {metaAutosavedAt && metaAutosaveStatus === "idle" && (
            <span>Autosaved {new Date(metaAutosavedAt).toLocaleTimeString()}</span>
          )}
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-[10px]">Unsaved changes</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
