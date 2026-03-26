import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2, Settings, Plus, LayoutList, PanelLeft, PanelRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { UnitManagerTab } from "@/components/admin/UnitManagerTab";
const LazyImportTab = lazy(() => import("./ContentImportAdmin").then(m => ({ default: m.ImportTab })));
import { SettingsSheet } from "@/components/admin/contentStudio/SettingsSheet";
import { DraftList } from "@/components/admin/contentStudio/DraftList";
import { ArtifactsPanel } from "@/components/admin/contentStudio/ArtifactsPanel";
import { PromptPreview } from "@/components/admin/contentStudio/PromptPreview";
import { InspectorPanel } from "@/components/admin/contentStudio/InspectorPanel";
import type { InspectorStep } from "@/components/admin/contentStudio/InspectorPanel";
import { DraftStatusBadge } from "@/components/admin/contentStudio/StatusBadge";
import type { Mode, Provider, StageKey, SectionId, NextStepKey, StepId, SettingsTab, StudioView } from "@/components/admin/contentStudio/types";
import { CONTENT_STUDIO_DIALOG_WIDTH, SECTION_OPTIONS, isKnownModel, stageOrderedModels } from "@/components/admin/contentStudio/constants";
import { buildSideBySideDiffRows } from "@/components/admin/contentStudio/utils/diffAlgorithm";

export default function ContentStudioAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const drafts = useQuery(api.contentStudio.listDrafts);
  const studioMetrics = useQuery(api.contentStudio.getStudioMetrics);
  const [selectedDraftId, setSelectedDraftId] = useState<Id<"contentDrafts"> | null>(null);
  const publishedEnglishUnits = useQuery(api.contentStudio.listPublishedEnglishUnitsForTranslation);

  const selected = useQuery(
    api.contentStudio.getDraft,
    selectedDraftId ? { draftId: selectedDraftId } : ("skip" as any)
  );

  const modules = useQuery(api.contentImportAdmin.listModulesForImport);

  // Config + libraries
  const modelConfig = useQuery(api.contentStudio.getModelConfig);
  const promptPreview = useQuery(
    api.contentStudio.getPromptPreview,
    selectedDraftId ? { draftId: selectedDraftId } : {}
  );
  const upsertModelConfig = useMutation(api.contentStudio.upsertModelConfig);

  const refs = useQuery(api.contentStudio.listReferences);
  const upsertReference = useMutation(api.contentStudio.upsertReference);
  const generateReferenceUploadUrl = useMutation(api.contentStudio.generateReferenceUploadUrl);
  const setReferenceGuidelines = useMutation(api.contentStudio.setReferenceGuidelines);
  const addReferencePdfFile = useMutation(api.contentStudio.addReferencePdfFile);
  const removeReferencePdfFile = useMutation(api.contentStudio.removeReferencePdfFile);
  const revertReferenceGuidelinesToVersion = useMutation(api.contentStudio.revertReferenceGuidelinesToVersion);
  const deleteReferenceGuidelineVersion = useMutation(api.contentStudio.deleteReferenceGuidelineVersion);
  const draftTemplates = useQuery(api.contentStudio.listDraftTemplates);
  const createDraftFromTemplate = useMutation(api.contentStudio.createDraftFromTemplate);
  const createDraftTemplateFromDraft = useMutation(api.contentStudio.createDraftTemplateFromDraft);
  const deactivateDraftTemplate = useMutation(api.contentStudio.deactivateDraftTemplate);

  const [skillsStage, setSkillsStage] = useState<"specialist" | "auditor">("specialist");
  const stageSkills = useQuery(api.contentStudio.listStageSkills, { stage: skillsStage });
  const upsertStageSkill = useMutation(api.contentStudio.upsertStageSkill);
  const deactivateSkill = useMutation(api.contentStudio.deactivateSkill);

  const specialistSkills = useQuery(api.contentStudio.listStageSkills, { stage: "specialist" });
  const auditorSkills = useQuery(api.contentStudio.listStageSkills, { stage: "auditor" });

  const setDraftSpecialistSkills = useMutation(api.contentStudio.setDraftSpecialistSkills);
  const setDraftAuditorSkills = useMutation(api.contentStudio.setDraftAuditorSkills);

  const createDraft = useMutation(api.contentStudio.createDraft);
  const updateDraftMeta = useMutation(api.contentStudio.updateDraftMeta);
  const saveSnapshot = useMutation(api.contentStudio.saveUnitPackageSnapshot);
  const deleteDraft = useMutation(api.contentStudio.deleteDraft);
  const addHumanReviewNote = useMutation(api.contentStudio.addHumanReviewNote);
  const approveAfterPreview = useMutation(api.contentStudio.approveAfterPreview);
  const dismissFinding = useMutation(api.contentStudio.dismissFinding);

  const runSpecialist = useAction(api.contentStudio._creator.runAiSpecialistGenerate);
  const runValidate = useAction(api.contentStudio.runQcValidate);
  const runAuditor = useAction(api.contentStudio.runAiAuditor);
  const runRevise = useAction(api.contentStudio._creator.runAiCreatorRevise);
  const runSectionRevise = useAction(api.contentStudio.runSectionRevise);
  const addDialogue = useAction(api.contentStudio.addDialogue);
  const saveMarkdownSnapshot = useAction(api.contentStudio.saveMarkdownSnapshot);
  const translateToEnglish = useAction(api.contentStudio._creator.translateToEnglish);
  const publishDraftToPreview = useAction(api.contentStudio.publishDraftToPreview);
  const takePreviewOffline = useAction(api.contentStudio.takePreviewOffline);
  const takeUnitPreviewOfflineByUnitNumber = useAction(api.contentStudio.takeUnitPreviewOfflineByUnitNumber);
  const publishDraft = useAction(api.contentStudio.publishDraft);
  const translatePublishedUnitEnToDe = useAction(api.contentStudio.translatePublishedUnitEnToDe);
  const deleteUnitFull = useMutation(api.contentStudio.deleteUnitFull);

  const [newUnitNumber, setNewUnitNumber] = useState("3");
  const [newModuleNumber, setNewModuleNumber] = useState("1");
  const [newTitle, setNewTitle] = useState("New Unit");
  const [newDescription, setNewDescription] = useState("");
  const [newCreatorBrief, setNewCreatorBrief] = useState("");
  const [newTemplateId, setNewTemplateId] = useState<string>("");

  const [unitPackageJson, setUnitPackageJson] = useState<string>("");
  const [markdownText, setMarkdownText] = useState<string>("");
  const [restoreMarkdownText, setRestoreMarkdownText] = useState<string>("");
  const [restoreMarkdownUpdatedAt, setRestoreMarkdownUpdatedAt] = useState<number | null>(null);
  const [showMarkdownRendered, setShowMarkdownRendered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [publishMode, setPublishMode] = useState<Mode>("update");
  const [publishModuleId, setPublishModuleId] = useState<string>("");

  const metaAutosaveInFlight = useRef(false);
  const [metaAutosaveStatus, setMetaAutosaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [metaAutosavedAt, setMetaAutosavedAt] = useState<number | null>(null);

  const [deleteUnitOpen, setDeleteUnitOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDeleteDraftDialog, setShowDeleteDraftDialog] = useState(false);

  const [translateDeOpen, setTranslateDeOpen] = useState(false);
  const [translateDeConfirmation, setTranslateDeConfirmation] = useState("");
  const [translateAnyOpen, setTranslateAnyOpen] = useState(false);
  const [translateAnyUnitNumber, setTranslateAnyUnitNumber] = useState<string>("1");
  const [translateAnyConfirmation, setTranslateAnyConfirmation] = useState("");

  // DE Translation Preview workflow state (persists after dialog close)
  const [translateDeResult, setTranslateDeResult] = useState<{
    unitNumber: number;
    previewVersion: number | null;
    timestamp: number;
    info: any;
  } | null>(null);

  // UI running indicators (so the user sees progress)
  const [runningCreator, setRunningCreator] = useState(false);
  const [runningValidator, setRunningValidator] = useState(false);
  const [runningLector, setRunningLector] = useState(false);
  const [runningPublish, setRunningPublish] = useState(false);
  const [runningRevise, setRunningRevise] = useState(false);
  const [runningCreateValidate, setRunningCreateValidate] = useState(false);
  const [runningSectionRevise, setRunningSectionRevise] = useState(false);
  const [runningTranslateDe, setRunningTranslateDe] = useState(false);

  // Track recently translated units (unitNumber -> timestamp) for UnitManager highlighting
  const [recentlyTranslatedUnits, setRecentlyTranslatedUnits] = useState<Map<number, number>>(new Map());

  // Fix Findings: human notes for the revision AI
  const [fixHumanNotes, setFixHumanNotes] = useState("");

  // Section-based revision (targeted edits)
  const [expandSection, setExpandSection] = useState<SectionId>("phrases");
  const [expandInstruction, setExpandInstruction] = useState("");

  // Top-level view toggle: "drafts" = Draft Studio (default), "units" = Unit Manager, "import" = Quick Import
  const [studioView, setStudioView] = useState<StudioView>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "import" || v === "units") return v;
    return "drafts";
  });

  // Mobile responsive state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Settings sheet state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("ai");
  const [createDraftOpen, setCreateDraftOpen] = useState(false);

  // Draft list navigation (left pane)
  const [draftsSearch, setDraftsSearch] = useState("");
  const [draftsStatusFilter, setDraftsStatusFilter] = useState<
    "all" | "draft" | "qc_failed" | "qc_passed" | "audit_failed" | "ready_to_publish" | "published"
  >("all");

  // Batch operations (multi-select drafts)
  const [batchSelectedDraftIds, setBatchSelectedDraftIds] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [batchResults, setBatchResults] = useState<
    Array<{ draftId: string; action: string; status: "success" | "failed"; message?: string }>
  >([]);

  // Task progress tracking
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");

  // Model config local state (editable)
  const [cfgSpecialistProvider, setCfgSpecialistProvider] = useState<Provider>("gemini");
  const [cfgSpecialistModel, setCfgSpecialistModel] = useState<string>("gemini-2.5-pro");
  const [cfgAuditorProvider, setCfgAuditorProvider] = useState<Provider>("gemini");
  const [cfgAuditorModel, setCfgAuditorModel] = useState<string>("gemini-2.5-flash");
  const [cfgSpecialistCustom, setCfgSpecialistCustom] = useState(false);
  const [cfgAuditorCustom, setCfgAuditorCustom] = useState(false);

  // Draft: specialist skills + reference
  const [draftRefId, setDraftRefId] = useState<string>("");
  const [draftRefNotes, setDraftRefNotes] = useState<string>("");
  const [draftRefChapter, setDraftRefChapter] = useState<string>("");
  const [draftRefPages, setDraftRefPages] = useState<string>("");

  // Draft meta editing (title/description)
  const [draftEditTitle, setDraftEditTitle] = useState<string>("");
  const [draftEditDescription, setDraftEditDescription] = useState<string>("");
  const [draftAuthorNoteName, setDraftAuthorNoteName] = useState<string>("");
  const [draftAuthorNoteQuote, setDraftAuthorNoteQuote] = useState<string>("");

  const [draftSpecialistSkillIds, setDraftSpecialistSkillIds] = useState<string[]>([]);
  const [draftAuditorSkillIds, setDraftAuditorSkillIds] = useState<string[]>([]);

  // Approved markdown for download
  const approvedMarkdown = useQuery(
    api.contentStudio.getApprovedMarkdown,
    selectedDraftId ? { draftId: selectedDraftId } : ("skip" as any)
  );
  const translateDePreview = useQuery(
    api.contentStudio.getUnitTranslationPreviewEnToDe,
    translateDeOpen && selected?.draft?.unitNumber
      ? { unitNumber: selected.draft.unitNumber }
      : ("skip" as any)
  );
  const translateAnyUnitNumberParsed = useMemo(() => {
    const n = Number(String(translateAnyUnitNumber || "").trim());
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }, [translateAnyUnitNumber]);
  const translateAnyPreview = useQuery(
    api.contentStudio.getUnitTranslationPreviewEnToDe,
    translateAnyOpen && translateAnyUnitNumberParsed
      ? { unitNumber: translateAnyUnitNumberParsed }
      : ("skip" as any)
  );
  const [runningApprovePreview, setRunningApprovePreview] = useState(false);

  // Default selection for "translate any unit" dropdown.
  useEffect(() => {
    const list = (publishedEnglishUnits || []) as any[];
    if (!list.length) return;
    const current = translateAnyUnitNumberParsed;
    const hasCurrent = current != null && list.some((u) => Number(u?.unitNumber) === current);
    if (hasCurrent) return;
    // If current selection is invalid/missing, default to first published EN unit.
    const first = list[0];
    if (first?.unitNumber) setTranslateAnyUnitNumber(String(first.unitNumber));
  }, [publishedEnglishUnits, translateAnyUnitNumberParsed]);

  // Snapshot history (for diff view)
  const draftSnapshots = useQuery(
    api.contentStudio.listDraftSnapshots,
    selectedDraftId ? { draftId: selectedDraftId, limit: 20 } : ("skip" as any)
  );
  const [diffLeftSnapshotId, setDiffLeftSnapshotId] = useState<string>("");
  const [diffRightSnapshotId, setDiffRightSnapshotId] = useState<string>("");

  // Library: create skill (specialist)
  const [newSkillName, setNewSkillName] = useState<string>("");
  const [newSkillPrompt, setNewSkillPrompt] = useState<string>("");
  const [editSkillId, setEditSkillId] = useState<string>("");

  // Library: create reference
  const [newRefType, setNewRefType] = useState<"pdf" | "book" | "article" | "other">("pdf");
  const [newRefTitle, setNewRefTitle] = useState<string>("");
  const [newRefUrl, setNewRefUrl] = useState<string>("");
  const [newRefTags, setNewRefTags] = useState<string>("pedagogy,structure");
  const [newRefNotes, setNewRefNotes] = useState<string>("");
  const [newRefFile, setNewRefFile] = useState<File | null>(null);
  const [newRefStorageId, setNewRefStorageId] = useState<string>("");
  const [newRefUploading, setNewRefUploading] = useState<boolean>(false);

  // Library: draft templates
  const [newTemplateName, setNewTemplateName] = useState<string>("");
  const [newTemplateDescription, setNewTemplateDescription] = useState<string>("");

  // Library: edit reference guidelines (manual override)
  const [editRefOpen, setEditRefOpen] = useState(false);
  const [editRefId, setEditRefId] = useState<string>("");
  const [editRefGuidelines, setEditRefGuidelines] = useState<string>("");
  // If set, the editor currently shows a past version. Editing + saving will create a NEW version.
  const [editRefLoadedFromVersion, setEditRefLoadedFromVersion] = useState<number | null>(null);
  const [editRefSaving, setEditRefSaving] = useState<boolean>(false);
  const [editRefNewPdfFile, setEditRefNewPdfFile] = useState<File | null>(null);
  const [editRefPdfUploading, setEditRefPdfUploading] = useState<boolean>(false);
  const guidelineVersions = useQuery(
    api.contentStudio.listReferenceGuidelineVersions,
    editRefId ? { referenceId: editRefId as any, limit: 25 } : ("skip" as any)
  );

  const findings = selected?.findings ?? [];
  // Dismissed findings are excluded from counts and Fix prompt, but still rendered in the list (greyed out)
  const errorFindings = findings.filter((f: any) => f.severity === "error" && !f.dismissed);
  const warningFindings = findings.filter((f: any) => f.severity === "warning" && !f.dismissed);
  const canRunLector = (() => {
    const s = (selected as any)?.draft?.status;
    return s === "qc_passed" || s === "ready_to_publish" || s === "audit_failed";
  })();
  const isBusy =
    runningCreator ||
    runningValidator ||
    runningLector ||
    runningPublish ||
    runningRevise ||
    runningCreateValidate ||
    runningSectionRevise ||
    runningApprovePreview ||
    runningTranslateDe;

  const currentTaskLabel = useMemo(() => {
    if (runningCreator) return "Creator is generating content...";
    if (runningValidator) return "Validator is checking structure...";
    if (runningLector) return "Lector is reviewing content...";
    if (runningRevise) return "Applying revisions...";
    if (runningCreateValidate) return "Running Creator + Validator...";
    if (runningSectionRevise) return "Applying changes...";
    if (runningPublish) return "Publishing...";
    if (runningApprovePreview) return "Approving...";
    if (runningTranslateDe) return "Translating to German...";
    return "";
  }, [runningCreator, runningValidator, runningLector, runningCreateValidate, runningSectionRevise, runningPublish, runningApprovePreview, runningTranslateDe]);


  const nextStepKey: NextStepKey = useMemo(() => {
    const status = String((selected as any)?.draft?.status || "");
    const hasSnapshot = Boolean((selected as any)?.snapshot?._id);
    const approvedSnapshotId = String((selected as any)?.draft?.approvedSnapshotId || "");
    const lastSnapshotId = String((selected as any)?.draft?.lastSnapshotId || "");
    const isLatestSnapshotApproved = Boolean(approvedSnapshotId && lastSnapshotId && approvedSnapshotId === lastSnapshotId);
    const hasErrors = errorFindings.length > 0;

    if (!hasSnapshot) return "creator";
    if (hasErrors) return "validator"; // Has errors -> use "Edit Content" to fix, then re-validate
    if (status === "qc_passed") return "lector";
    if (status === "audit_failed") return "lector";
    if (status === "ready_to_publish") return isLatestSnapshotApproved ? "publish" : "preview";
    // Fallbacks
    if (status === "published") return "creator";
    return "validator";
  }, [selected, errorFindings.length]);

  const nextStepLabel = useMemo(() => {
    switch (nextStepKey) {
      case "creator":
        return "Run Creator";
      case "validator":
        return "Run Validator";
      case "lector":
        return "Run Lector";
      case "preview":
        return "Publish to Preview";
      case "publish":
        return "Publish live";
      default:
        return "Next step";
    }
  }, [nextStepKey]);

  const stepVariant = (key: NextStepKey) => (key === nextStepKey ? "default" : "secondary");

  const statusBadge = useMemo(() => {
    return <DraftStatusBadge status={selected?.draft?.status} />;
  }, [selected?.draft?.status]);


  const filteredDrafts = useMemo(() => {
    const list = (drafts || []) as any[];
    const q = draftsSearch.trim().toLowerCase();

    return list.filter((d) => {
      const status = String(d?.status || "draft") as any;
      if (draftsStatusFilter !== "all" && status !== draftsStatusFilter) return false;

      if (!q) return true;
      const title = String(d?.title || "").toLowerCase();
      const unit = String(d?.unitNumber ?? "").toLowerCase();
      const module = String(d?.moduleNumber ?? "").toLowerCase();
      return (
        title.includes(q) ||
        unit.includes(q) ||
        module.includes(q) ||
        `u${unit}`.includes(q) ||
        `m${module}`.includes(q)
      );
    });
  }, [drafts, draftsSearch, draftsStatusFilter]);

  const toggleBatchSelectDraft = (draftId: string, checked: boolean) => {
    const id = String(draftId || "");
    if (!id) return;
    setBatchSelectedDraftIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  };

  const clearBatchSelection = () => {
    setBatchSelectedDraftIds([]);
    setBatchResults([]);
    setBatchProgress(null);
  };

  const selectAllFilteredDrafts = () => {
    const ids = filteredDrafts.map((d: any) => String(d?._id)).filter(Boolean);
    setBatchSelectedDraftIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const activeStep: StepId = useMemo(() => {
    if (!selectedDraftId || !selected?.draft) return "setup";
    if (nextStepKey === "creator") return "generate";
    if (nextStepKey === "validator" || nextStepKey === "lector") return "qa";
    if (nextStepKey === "preview") return "preview";
    if (nextStepKey === "publish") return "publish";
    return "setup";
  }, [selectedDraftId, selected?.draft, nextStepKey]);

  const activeStepIndex = useMemo(() => {
    const map: Record<StepId, number> = { setup: 0, generate: 1, qa: 2, preview: 3, publish: 4 };
    return map[activeStep];
  }, [activeStep]);

  const [activeInspectorStep, setActiveInspectorStep] = useState<InspectorStep>("setup");

  useEffect(() => {
    const computed: InspectorStep = (() => {
      if (!selectedDraftId || !selected?.draft) return "setup";
      if (nextStepKey === "creator") return "generate";
      if (nextStepKey === "validator" || nextStepKey === "lector") return "review";
      if (nextStepKey === "preview") return "review";
      if (nextStepKey === "publish") return "publish";
      return "setup";
    })();
    setActiveInspectorStep(computed);
  }, [selectedDraftId, selected?.draft, nextStepKey]);

  const approvedSnapshotId = String((selected as any)?.draft?.approvedSnapshotId || "");
  const lastSnapshotId = String((selected as any)?.draft?.lastSnapshotId || "");
  const canPublishLive = Boolean(
    selected?.draft &&
      selected.draft.status === "ready_to_publish" &&
      approvedSnapshotId &&
      lastSnapshotId &&
      approvedSnapshotId === lastSnapshotId
  );

  const latestReport = useMemo(() => {
    const raw = (selected as any)?.snapshot?.validationReportJson;
    if (!raw || typeof raw !== "string") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { ok: false, parseError: true, raw };
    }
  }, [selected]);

  const preview = useMemo(() => {
    const raw =
      unitPackageJson && unitPackageJson.trim()
        ? unitPackageJson
        : String((selected as any)?.snapshot?.unitPackageJson || "");

    if (!raw.trim()) return { ok: false as const, error: "No unitPackage JSON available yet." };

    try {
      const parsed = JSON.parse(raw);
      const pkg =
        parsed && typeof parsed === "object" && (parsed as any).unitPackage
          ? (parsed as any).unitPackage
          : parsed;

      const contentEn = (pkg as any)?.content?.en;
      if (!contentEn || typeof contentEn !== "object") {
        return { ok: false as const, error: "Preview: JSON does not look like unitPackage.v1 (missing content.en)." };
      }

      return { ok: true as const, pkg };
    } catch (e: any) {
      return { ok: false as const, error: `Preview: invalid JSON (${e?.message || String(e)})` };
    }
  }, [unitPackageJson, selected]);

  const snapshotMarkdown = useMemo(() => {
    return String((selected as any)?.snapshot?.markdownSource || "");
  }, [selectedDraftId, (selected as any)?.snapshot?._id]);

  const markdownDirty = useMemo(() => {
    if (!selectedDraftId) return false;
    return String(markdownText || "") !== snapshotMarkdown;
  }, [selectedDraftId, markdownText, snapshotMarkdown]);

  const markdownLocalStorageKey = useMemo(() => {
    return selectedDraftId ? `contentStudio:markdown:${String(selectedDraftId)}` : "";
  }, [selectedDraftId]);

  const normalizeIdList = (ids: unknown): string[] => {
    if (!Array.isArray(ids)) return [];
    return ids.map((x) => String(x)).filter(Boolean).sort();
  };

  const persistedMetaKey = useMemo(() => {
    const d = (selected as any)?.draft;
    if (!selectedDraftId || !d) return "";
    const ref = d.inspirationRef || {};
    return JSON.stringify({
      title: String(d.title || ""),
      description: String(d.description || ""),
      authorNoteName: String(d.authorNoteName || ""),
      authorNoteQuote: String(d.authorNoteQuote || ""),
      refId: ref.referenceId ? String(ref.referenceId) : "",
      refNotes: ref.notes ? String(ref.notes) : "",
      refChapter: ref.chapter ? String(ref.chapter) : "",
      refPages: ref.pages ? String(ref.pages) : "",
      specialistSkills: normalizeIdList(d.specialistSkillIds),
      auditorSkills: normalizeIdList(d.auditorSkillIds),
    });
  }, [selectedDraftId, selected]);

  const currentMetaKey = useMemo(() => {
    if (!selectedDraftId) return "";
    return JSON.stringify({
      title: String(draftEditTitle || "").trim(),
      description: String(draftEditDescription || ""),
      authorNoteName: String(draftAuthorNoteName || ""),
      authorNoteQuote: String(draftAuthorNoteQuote || ""),
      refId: String(draftRefId || ""),
      refNotes: String(draftRefNotes || "").trim(),
      refChapter: String(draftRefChapter || "").trim(),
      refPages: String(draftRefPages || "").trim(),
      specialistSkills: normalizeIdList(draftSpecialistSkillIds),
      auditorSkills: normalizeIdList(draftAuditorSkillIds),
    });
  }, [
    selectedDraftId,
    draftEditTitle,
    draftEditDescription,
    draftAuthorNoteName,
    draftAuthorNoteQuote,
    draftRefId,
    draftRefNotes,
    draftRefChapter,
    draftRefPages,
    draftSpecialistSkillIds,
    draftAuditorSkillIds,
  ]);

  const metaDirty = useMemo(() => {
    if (!selectedDraftId) return false;
    if (!persistedMetaKey || !currentMetaKey) return false;
    return persistedMetaKey !== currentMetaKey;
  }, [selectedDraftId, persistedMetaKey, currentMetaKey]);

  const hasUnsavedChanges = metaDirty || markdownDirty;

  // Restore local markdown draft (if present) when switching drafts.
  useEffect(() => {
    if (!selectedDraftId || !markdownLocalStorageKey) return;
    try {
      const raw = localStorage.getItem(markdownLocalStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { v?: number; markdown?: string; updatedAt?: number };
      const md = String(parsed?.markdown || "");
      const updatedAt = typeof parsed?.updatedAt === "number" ? parsed.updatedAt : null;
      if (!md.trim()) return;
      if (md === snapshotMarkdown) return;
      setRestoreMarkdownText(md);
      setRestoreMarkdownUpdatedAt(updatedAt);
      // Do NOT auto-open a blocking modal when selecting a draft.
      // Instead we show a small inline banner in the Markdown tab.
    } catch {
      // ignore
    }
  }, [selectedDraftId, markdownLocalStorageKey, snapshotMarkdown]);

  // Local autosave for markdown (debounced)
  useEffect(() => {
    if (!selectedDraftId || !markdownLocalStorageKey) return;
    const t = setTimeout(() => {
      try {
        if (!markdownDirty) {
          localStorage.removeItem(markdownLocalStorageKey);
          return;
        }
        const payload = {
          v: 1,
          markdown: String(markdownText || ""),
          updatedAt: Date.now(),
        };
        localStorage.setItem(markdownLocalStorageKey, JSON.stringify(payload));
      } catch {
        // ignore (quota etc.)
      }
    }, 800);
    return () => clearTimeout(t);
  }, [selectedDraftId, markdownLocalStorageKey, markdownDirty, markdownText]);

  // Auto-save draft settings (meta + skills) 30s after last change
  useEffect(() => {
    if (!selectedDraftId) return;
    if (!metaDirty) return;
    if (isBusy) return;

    const draftIdAtSchedule = selectedDraftId;
    const t = setTimeout(() => {
      void (async () => {
        if (metaAutosaveInFlight.current) return;
        if (selectedDraftId !== draftIdAtSchedule) return;
        metaAutosaveInFlight.current = true;
        setMetaAutosaveStatus("saving");
        try {
          await setDraftSpecialistSkills({
            draftId: draftIdAtSchedule,
            skillIds: draftSpecialistSkillIds.map((id) => id as any),
          });
          await setDraftAuditorSkills({
            draftId: draftIdAtSchedule,
            skillIds: draftAuditorSkillIds.map((id) => id as any),
          });

          await updateDraftMeta({
            draftId: draftIdAtSchedule,
            title: draftEditTitle.trim() ? draftEditTitle.trim() : undefined,
            description: typeof draftEditDescription === "string" ? draftEditDescription : "",
            authorNoteName: typeof draftAuthorNoteName === "string" ? draftAuthorNoteName : "",
            authorNoteQuote: typeof draftAuthorNoteQuote === "string" ? draftAuthorNoteQuote : "",
            inspirationRef: {
              source: "reference-library",
              chapter: draftRefChapter.trim() || undefined,
              pages: draftRefPages.trim() || undefined,
              notes: draftRefNotes.trim() || undefined,
              referenceId: draftRefId ? (draftRefId as any) : undefined,
            },
          });

          setMetaAutosavedAt(Date.now());
          setMetaAutosaveStatus("idle");
        } catch {
          setMetaAutosaveStatus("error");
        } finally {
          metaAutosaveInFlight.current = false;
        }
      })();
    }, 30_000);

    return () => clearTimeout(t);
  }, [
    selectedDraftId,
    metaDirty,
    currentMetaKey,
    isBusy,
    draftSpecialistSkillIds,
    draftAuditorSkillIds,
    draftEditTitle,
    draftEditDescription,
    draftAuthorNoteName,
    draftAuthorNoteQuote,
    draftRefId,
    draftRefNotes,
    draftRefChapter,
    draftRefPages,
  ]);

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const stripLeadingSectionHeader = (md: string, expectedNumber?: number) => {
    const s = String(md || "").replace(/\r\n/g, "\n");
    if (!s.trim()) return "";
    if (expectedNumber != null) {
      const re = new RegExp(`^##\\s+${expectedNumber}\\.\\s+[^\\n]+\\n+`);
      return s.replace(re, "");
    }
    return s.replace(/^##\s+[^\n]+\n+/, "");
  };

  // Hydrate model config
  useEffect(() => {
    if (!modelConfig) return;
    setCfgSpecialistProvider(modelConfig.specialist.provider);
    setCfgSpecialistModel(modelConfig.specialist.model);
    setCfgAuditorProvider(modelConfig.auditor.provider);
    setCfgAuditorModel(modelConfig.auditor.model);
    setCfgSpecialistCustom(!isKnownModel(modelConfig.specialist.provider, modelConfig.specialist.model));
    setCfgAuditorCustom(!isKnownModel(modelConfig.auditor.provider, modelConfig.auditor.model));
  }, [modelConfig]);

  // If provider changes and current model doesn't exist in that provider, fallback to the recommended first option.
  useEffect(() => {
    if (cfgSpecialistCustom) return;
    if (!isKnownModel(cfgSpecialistProvider, cfgSpecialistModel)) {
      const next = stageOrderedModels(cfgSpecialistProvider, "specialist")[0]?.id;
      if (next) setCfgSpecialistModel(next);
    }
  }, [cfgSpecialistProvider]);

  useEffect(() => {
    if (cfgAuditorCustom) return;
    if (!isKnownModel(cfgAuditorProvider, cfgAuditorModel)) {
      const next = stageOrderedModels(cfgAuditorProvider, "auditor")[0]?.id;
      if (next) setCfgAuditorModel(next);
    }
  }, [cfgAuditorProvider]);

  // Elapsed time counter for running tasks
  useEffect(() => {
    if (!isBusy) {
      setTaskStartTime(null);
      setElapsedSeconds(0);
      setProgressPercent(null);
      setProgressMessage("");
      return;
    }
    if (!taskStartTime) {
      setTaskStartTime(Date.now());
    }
    const interval = setInterval(() => {
      if (taskStartTime) {
        setElapsedSeconds(Math.floor((Date.now() - taskStartTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isBusy, taskStartTime]);

  // Hydrate draft settings when selected changes
  useEffect(() => {
    const d = (selected as any)?.draft;
    if (!d) return;
    const ref = d.inspirationRef || {};
    setDraftRefId(ref.referenceId ? String(ref.referenceId) : "");
    setDraftRefNotes(ref.notes ? String(ref.notes) : "");
    setDraftRefChapter(ref.chapter ? String(ref.chapter) : "");
    setDraftRefPages(ref.pages ? String(ref.pages) : "");

    const ids: string[] = Array.isArray(d.specialistSkillIds) ? d.specialistSkillIds.map(String) : [];
    // Backward-compat: if an old draft used sectionSkillIds, prefill specialistSkillIds with unique IDs.
    const legacy = d.sectionSkillIds ? Object.values(d.sectionSkillIds).filter(Boolean).map(String) : [];
    const merged = Array.from(new Set([...ids, ...legacy]));
    setDraftSpecialistSkillIds(merged);
    setDraftAuditorSkillIds(Array.isArray(d.auditorSkillIds) ? d.auditorSkillIds.map(String) : []);

    setDraftEditTitle(typeof d.title === "string" ? d.title : "");
    setDraftEditDescription(typeof d.description === "string" ? d.description : "");
    setDraftAuthorNoteName(typeof d.authorNoteName === "string" ? d.authorNoteName : "");
    setDraftAuthorNoteQuote(typeof d.authorNoteQuote === "string" ? d.authorNoteQuote : "");
  }, [selected]);

  // Auto-load markdown from snapshot when snapshot changes
  useEffect(() => {
    const snapMd = String((selected as any)?.snapshot?.markdownSource || "");
    setMarkdownText(snapMd);
  }, [selectedDraftId, (selected as any)?.snapshot?._id]);

  // Diff defaults: compare previous snapshot -> latest snapshot
  useEffect(() => {
    if (!selectedDraftId) {
      setDiffLeftSnapshotId("");
      setDiffRightSnapshotId("");
      return;
    }
    const snaps = (draftSnapshots || []) as any[];
    if (snaps.length === 0) return;
    const ids = new Set(snaps.map((s) => String(s?._id)));
    const latestId = String(snaps[0]?._id || "");
    const prevId = String(snaps[1]?._id || snaps[0]?._id || "");
    if (latestId && (!diffRightSnapshotId || !ids.has(diffRightSnapshotId))) {
      setDiffRightSnapshotId(latestId);
    }
    if (prevId && (!diffLeftSnapshotId || !ids.has(diffLeftSnapshotId))) {
      setDiffLeftSnapshotId(prevId);
    }
  }, [selectedDraftId, draftSnapshots]);

  const diffLeftSnapshot = useMemo(() => {
    const snaps = (draftSnapshots || []) as any[];
    const id = String(diffLeftSnapshotId || "");
    if (!id) return null;
    return snaps.find((s) => String(s?._id) === id) || null;
  }, [draftSnapshots, diffLeftSnapshotId]);

  const diffRightSnapshot = useMemo(() => {
    const snaps = (draftSnapshots || []) as any[];
    const id = String(diffRightSnapshotId || "");
    if (!id) return null;
    return snaps.find((s) => String(s?._id) === id) || null;
  }, [draftSnapshots, diffRightSnapshotId]);

  const diffRows = useMemo(() => {
    const left = String((diffLeftSnapshot as any)?.markdownSource || "");
    const right = String((diffRightSnapshot as any)?.markdownSource || "");
    return buildSideBySideDiffRows(left, right);
  }, [(diffLeftSnapshot as any)?._id, (diffRightSnapshot as any)?._id]);

  if (!authLoading && (!user || user.role !== "superadmin")) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Content Studio</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Unauthorized. Superadmin required.</p>
        </CardContent>
      </Card>
    );
  }

  const handleSelectDraft = (id: Id<"contentDrafts">) => {
    setSelectedDraftId(id);
    // hydrate editor with latest snapshot
    const snap = drafts?.find((d: any) => d._id === id);
    void snap;
  };

  const handleCreateDraft = async () => {
    try {
      const unitNumber = Number(newUnitNumber);
      const moduleNumber = Number(newModuleNumber);
      if (!Number.isFinite(unitNumber) || unitNumber <= 0) throw new Error("Invalid unitNumber");
      if (!Number.isFinite(moduleNumber) || moduleNumber <= 0) throw new Error("Invalid moduleNumber");
      const title = newTitle.trim() || `Unit ${unitNumber}`;
      const description = newDescription.trim() || undefined;

      const hasTemplate = Boolean(newTemplateId);
      const template = hasTemplate
        ? (draftTemplates || []).find((t: any) => String(t?._id) === String(newTemplateId)) || null
        : null;

      const id = template
        ? await createDraftFromTemplate({
            templateId: template._id,
            unitNumber,
            moduleNumber,
            title,
            description,
            // Override only the brief/notes if the user typed something different.
            inspirationRef: template.inspirationRef
              ? {
                  ...template.inspirationRef,
                  source: "template",
                  notes: newCreatorBrief.trim() || template.inspirationRef?.notes || undefined,
                }
              : newCreatorBrief.trim()
                ? { source: "template", notes: newCreatorBrief.trim() }
                : undefined,
          } as any)
        : await createDraft({
            unitNumber,
            moduleNumber,
            title,
            description,
          });

      // For non-template drafts, store the creator brief immediately.
      if (!template && newCreatorBrief.trim()) {
        await updateDraftMeta({
          draftId: id,
          inspirationRef: {
            source: "creator-brief",
            notes: newCreatorBrief.trim(),
          },
        });
      }

      setSelectedDraftId(id);
      setCreateDraftOpen(false);
      setNewTemplateId("");
      toast.success(t("admin.contentStudio.toast.draftCreated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.draftCreateFailed"));
    }
  };

  const handleSaveModelConfig = async () => {
    try {
      await upsertModelConfig({
        specialist: { provider: cfgSpecialistProvider, model: cfgSpecialistModel.trim() },
        auditor: { provider: cfgAuditorProvider, model: cfgAuditorModel.trim() },
      });
      toast.success(t("admin.contentStudio.toast.modelConfigSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.modelConfigSaveFailed"));
    }
  };

  const handleCreateSkill = async () => {
    try {
      const name = newSkillName.trim();
      const prompt = newSkillPrompt.trim();
      if (!name) throw new Error(t("admin.contentStudio.error.skillNameRequired"));
      if (!prompt) throw new Error(t("admin.contentStudio.error.skillPromptRequired"));
      await upsertStageSkill({
        skillId: editSkillId ? (editSkillId as any) : undefined,
        stage: skillsStage,
        name,
        prompt,
        description: undefined,
        isActive: true,
      });
      setNewSkillName("");
      setNewSkillPrompt("");
      setEditSkillId("");
      toast.success(
        editSkillId ? t("admin.contentStudio.toast.skillUpdated") : t("admin.contentStudio.toast.skillCreated")
      );
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.skillCreateFailed"));
    }
  };

  const handleEditSkill = (s: any) => {
    setEditSkillId(String(s._id));
    setNewSkillName(String(s.name || ""));
    setNewSkillPrompt(String(s.prompt || ""));
    setSkillsStage(String(s.stage || "specialist") as any);
  };

  const handleDeactivateSkill = async (id: string) => {
    try {
      await deactivateSkill({ skillId: id as any });
      toast.success(t("admin.contentStudio.toast.skillDeactivated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.skillDeactivateFailed"));
    }
  };

  const handleCreateReference = async () => {
    try {
      const title = newRefTitle.trim();
      if (!title) throw new Error(t("admin.contentStudio.error.referenceTitleRequired"));
      const url = newRefUrl.trim();
      let storageId = newRefStorageId.trim();

      // Convenience: if a PDF was selected but not uploaded yet, upload it automatically here.
      if (!storageId && newRefFile) {
        if (newRefFile.type !== "application/pdf") {
          throw new Error(t("admin.contentStudio.error.pdfMustBePdf"));
        }
        const maxBytes = 25 * 1024 * 1024; // 25 MB
        if (newRefFile.size > maxBytes) {
          throw new Error(t("admin.contentStudio.error.pdfUnder25mb"));
        }

        setNewRefUploading(true);
        const uploadUrl = await generateReferenceUploadUrl({});
        const uploadResp = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": newRefFile.type || "application/octet-stream" },
          body: newRefFile,
        });
        if (!uploadResp.ok) {
          const text = await uploadResp.text().catch(() => uploadResp.statusText);
          throw new Error(`Upload failed: ${uploadResp.status} ${text}`);
        }
        const json = (await uploadResp.json()) as { storageId?: string };
        const sid = json.storageId;
        if (!sid) throw new Error("Upload failed: missing storageId.");
        storageId = sid;
        setNewRefStorageId(sid);
      }

      if (!url && !storageId) throw new Error("Provide either a URL or upload a PDF (storageId).");
      const tags = newRefTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await upsertReference({
        type: newRefType,
        title,
        url: url || undefined,
        storageId: storageId || undefined,
        fileName: newRefFile?.name,
        mimeType: newRefFile?.type,
        sizeBytes: typeof newRefFile?.size === "number" ? newRefFile.size : undefined,
        notes: newRefNotes.trim() || undefined,
        tags,
        isActive: true,
      });
      setNewRefTitle("");
      setNewRefUrl("");
      setNewRefFile(null);
      setNewRefStorageId("");
      toast.success(t("admin.contentStudio.toast.referenceCreated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.referenceCreateFailed"));
    } finally {
      setNewRefUploading(false);
    }
  };

  const handleCreateTemplateFromSelectedDraft = async () => {
    if (!selectedDraftId) {
      toast.error(t("admin.contentStudio.toast.selectDraftFirst"));
      return;
    }
    const name = newTemplateName.trim();
    if (!name) {
      toast.error(t("admin.contentStudio.toast.templateNameRequired"));
      return;
    }
    try {
      await createDraftTemplateFromDraft({
        draftId: selectedDraftId,
        name,
        description: newTemplateDescription.trim() || undefined,
      } as any);
      setNewTemplateName("");
      setNewTemplateDescription("");
      toast.success(t("admin.contentStudio.toast.templateCreatedFromDraft"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.templateCreateFailed"));
    }
  };

  const handleDeactivateTemplate = async (templateId: string) => {
    try {
      await deactivateDraftTemplate({ templateId: templateId as any } as any);
      toast.success(t("admin.contentStudio.toast.templateDeactivated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.templateDeactivateFailed"));
    }
  };

  const handleUseTemplate = (tpl: any) => {
    setNewTemplateId(String(tpl?._id || ""));
    const brief = String(tpl?.inspirationRef?.notes || "").trim();
    if (brief) setNewCreatorBrief(brief);
    setCreateDraftOpen(true);
  };

  const handleUploadReferencePdf = async () => {
    const file = newRefFile;
    if (!file) {
      toast.error(t("admin.contentStudio.error.pdfSelectFirst"));
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error(t("admin.contentStudio.error.pdfMustBePdf"));
      return;
    }
    // Keep reasonable default; can be increased later.
    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxBytes) {
      toast.error(t("admin.contentStudio.error.pdfUnder25mb"));
      return;
    }

    setNewRefUploading(true);
    try {
      const uploadUrl = await generateReferenceUploadUrl({});
      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadResp.ok) {
        const text = await uploadResp.text().catch(() => uploadResp.statusText);
        throw new Error(`Upload failed: ${uploadResp.status} ${text}`);
      }

      const json = (await uploadResp.json()) as { storageId?: string };
      const sid = json.storageId;
      if (!sid) throw new Error("Upload failed: missing storageId.");
      setNewRefStorageId(sid);
      toast.success(t("admin.contentStudio.toast.pdfUploaded"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.pdfUploadFailed"));
    } finally {
      setNewRefUploading(false);
    }
  };

  const editRef = useMemo(() => {
    const list = (refs || []) as any[];
    const id = String(editRefId || "");
    if (!id) return null;
    return list.find((r) => String(r?._id) === id) || null;
  }, [refs, editRefId]);

  useEffect(() => {
    if (!editRefOpen) return;
    setEditRefGuidelines(String((editRef as any)?.guidelines || ""));
    setEditRefLoadedFromVersion(null);
  }, [editRefOpen, (editRef as any)?.guidelinesUpdatedAt, editRefId]);

  const handleOpenEditReferenceGuidelines = (r: any) => {
    setEditRefId(String(r?._id || ""));
    setEditRefGuidelines(String(r?.guidelines || ""));
    setEditRefNewPdfFile(null);
    setEditRefLoadedFromVersion(null);
    setEditRefOpen(true);
  };

  const handleLoadGuidelinesVersionIntoEditor = (version: number) => {
    const list = Array.isArray(guidelineVersions) ? (guidelineVersions as any[]) : [];
    const found = list.find((v) => Number((v as any)?.version) === Number(version));
    if (!found) {
      toast.error("Guideline version not found.");
      return;
    }
    setEditRefGuidelines(String((found as any)?.guidelines || ""));
    setEditRefLoadedFromVersion(Number(version));
    toast.success(`Loaded v${Number(version)} into editor. Edit + save to create a new version.`);
  };

  const handleReloadCurrentGuidelinesIntoEditor = () => {
    setEditRefGuidelines(String((editRef as any)?.guidelines || ""));
    setEditRefLoadedFromVersion(null);
    toast.info("Loaded current guidelines.");
  };

  const handleSaveReferenceGuidelines = async () => {
    if (!editRef?._id) return;
    setEditRefSaving(true);
    try {
      const guidelines = editRefGuidelines.replace(/\r\n/g, "\n").trim();
      await setReferenceGuidelines({
        referenceId: editRef._id,
        guidelines,
        provider: "manual",
        model: "manual",
      } as any);
      toast.success(t("admin.contentStudio.toast.guidelinesSaved"));
      setEditRefOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.guidelinesSaveFailed"));
    } finally {
      setEditRefSaving(false);
    }
  };

  const handleClearReferenceGuidelines = async () => {
    if (!editRef?._id) return;
    setEditRefSaving(true);
    try {
      await setReferenceGuidelines({
        referenceId: editRef._id,
        guidelines: "",
        provider: "manual",
        model: "manual",
      } as any);
      toast.success(t("admin.contentStudio.toast.guidelinesCleared"));
      setEditRefOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.guidelinesClearFailed"));
    } finally {
      setEditRefSaving(false);
    }
  };

  const handleRevertGuidelinesToVersion = async (version: number) => {
    if (!editRef?._id) return;
    setEditRefSaving(true);
    try {
      await revertReferenceGuidelinesToVersion({
        referenceId: editRef._id,
        version,
      } as any);
      toast.success(t("admin.contentStudio.toast.guidelinesReverted", { version }));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.guidelinesRevertFailed"));
    } finally {
      setEditRefSaving(false);
    }
  };

  const handleDeleteGuidelinesVersion = async (params: { versionId: string; version: number }) => {
    setEditRefSaving(true);
    try {
      await deleteReferenceGuidelineVersion({
        versionId: params.versionId as any,
      });
      toast.success(`Deleted v${params.version}.`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete guideline version.");
    } finally {
      setEditRefSaving(false);
    }
  };

  const handleAddPdfToReference = async () => {
    if (!editRef?._id) return;
    const file = editRefNewPdfFile;
    if (!file) {
      toast.error(t("admin.contentStudio.error.pdfSelectFirst"));
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error(t("admin.contentStudio.error.pdfMustBePdf"));
      return;
    }
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(t("admin.contentStudio.error.pdfUnder25mb"));
      return;
    }

    setEditRefPdfUploading(true);
    try {
      const uploadUrl = await generateReferenceUploadUrl({});
      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResp.ok) {
        const text = await uploadResp.text().catch(() => uploadResp.statusText);
        throw new Error(`Upload failed: ${uploadResp.status} ${text}`);
      }
      const json = (await uploadResp.json()) as { storageId?: string };
      const sid = String(json.storageId || "").trim();
      if (!sid) throw new Error("Upload failed: missing storageId.");

      await addReferencePdfFile({
        referenceId: editRef._id,
        storageId: sid,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      } as any);

      setEditRefNewPdfFile(null);
      toast.success(t("admin.contentStudio.toast.pdfAdded"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.pdfAddFailed"));
    } finally {
      setEditRefPdfUploading(false);
    }
  };

  const handleRemovePdfFromReference = async (storageId: string) => {
    if (!editRef?._id) return;
    try {
      await removeReferencePdfFile({
        referenceId: editRef._id,
        storageId,
      } as any);
      toast.success(t("admin.contentStudio.toast.pdfRemoved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.pdfRemoveFailed"));
    }
  };

  const handleSaveDraftSkillsAndReference = async () => {
    if (!selectedDraftId) return;
    try {
      await setDraftSpecialistSkills({
        draftId: selectedDraftId,
        skillIds: draftSpecialistSkillIds.map((id) => id as any),
      });
      await setDraftAuditorSkills({
        draftId: selectedDraftId,
        skillIds: draftAuditorSkillIds.map((id) => id as any),
      });

      await updateDraftMeta({
        draftId: selectedDraftId,
        title: draftEditTitle.trim() || (selected as any)?.draft?.title || `Unit ${(selected as any)?.draft?.unitNumber ?? ""}`,
        // Allow clearing description explicitly by saving an empty string.
        description: typeof draftEditDescription === "string" ? draftEditDescription : "",
        authorNoteName: typeof draftAuthorNoteName === "string" ? draftAuthorNoteName : "",
        authorNoteQuote: typeof draftAuthorNoteQuote === "string" ? draftAuthorNoteQuote : "",
        inspirationRef: {
          source: "reference-library",
          chapter: draftRefChapter.trim() || undefined,
          pages: draftRefPages.trim() || undefined,
          notes: draftRefNotes.trim() || undefined,
          referenceId: draftRefId ? (draftRefId as any) : undefined,
        },
      });

      toast.success(t("admin.contentStudio.toast.draftSettingsSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.draftSettingsSaveFailed"));
    }
  };

  const looksGerman = (text: string): boolean => {
    const s = String(text || "");
    if (!s.trim()) return false;
    if (/[äöüßÄÖÜ]/.test(s)) return true;
    const hits = (s.toLowerCase().match(/\b(und|oder|wenn|nicht|aber|dann|weil|zum|zur|der|die|das|du|ihr|euch)\b/g) || [])
      .length;
    return hits >= 2;
  };

  const upsertFounderNoteInMarkdown = (md: string, name: string, quote: string) => {
    const safeName = String(name || "").trim().replace(/^"+|"+$/g, "");
    const safeQuote = String(quote || "").trim();

    // Remove existing Founder/Author note block if present (keep it simple and deterministic).
    const reExisting = /^####\s+A Note from the (?:Founder[^\n]*|Unit Author[^\n]*)\n(?:>.*\n)+\n?/m;
    let next = String(md || "").replace(reExisting, "");

    if (!safeName || !safeQuote) {
      return next;
    }

    const block = [
      `#### A Note from the Founder (${safeName})`,
      `> "${safeQuote.replace(/"/g, '\\"')}"`,
      ``,
    ].join("\n");

    const overviewHeader = next.match(/^##\s+1\.\s+Overview\b.*$/m);
    if (overviewHeader?.index != null) {
      const insertAt = overviewHeader.index + overviewHeader[0].length;
      const after = next.slice(insertAt);
      const normalizedAfter = after.replace(/^\n+/, "\n\n");
      return `${next.slice(0, insertAt)}\n\n${block}${normalizedAfter}`;
    }

    // Fallback: prepend at top (rare; for markdown that doesn't follow the template).
    return `${block}\n${next}`.trimStart();
  };

  const maybeApplyFounderNoteToMarkdown = (name: string, quote: string) => {
    if (!markdownText.trim()) return;
    const next = upsertFounderNoteInMarkdown(markdownText, name, quote);
    if (next !== markdownText) setMarkdownText(next);
  };

  const handleFounderQuoteBlur = async () => {
    const name = String(draftAuthorNoteName || "").trim();
    const quoteRaw = String(draftAuthorNoteQuote || "").trim();
    if (!name || !quoteRaw) return;

    let quote = quoteRaw;
    try {
      if (looksGerman(quoteRaw)) {
        const res = await translateToEnglish({ text: quoteRaw } as any);
        const english = String((res as any)?.english || "").trim();
        if (english) {
          quote = english;
          // Persist in UI state so future inserts are English
          setDraftAuthorNoteQuote(english);
        }
      }
    } catch {
      // no hard-fail; just keep original text
    }

    maybeApplyFounderNoteToMarkdown(name, quote);
  };

  const handleDeleteSelectedDraft = () => {
    if (!selectedDraftId) return;
    setShowDeleteDraftDialog(true);
  };

  const handleConfirmDeleteDraft = async () => {
    if (!selectedDraftId) return;
    setShowDeleteDraftDialog(false);
    try {
      await deleteDraft({ draftId: selectedDraftId });
      setSelectedDraftId(null);
      toast.success(t("admin.contentStudio.toast.draftDeleted"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.draftDeleteFailed"));
    }
  };

  const handleSaveJson = async () => {
    if (!selectedDraftId) return;
    try {
      const json = unitPackageJson.trim();
      if (!json) throw new Error(t("admin.contentStudio.error.emptyJson"));
      await saveSnapshot({
        draftId: selectedDraftId,
        unitPackageJson: json,
        validationReportJson: JSON.stringify({ ok: false, note: "Saved manually; run Validator." }),
        status: "draft",
        replaceFindings: true,
        findings: [],
      });
      toast.success(t("admin.contentStudio.toast.snapshotSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.snapshotSaveFailed"));
    }
  };

  const handleLoadMarkdownFromSnapshot = () => {
    const snap = selected?.snapshot as any;
    const md = String(snap?.markdownSource || "");
    if (md.trim()) {
      setMarkdownText(md);
      toast.success(t("admin.contentStudio.toast.loadedMarkdownFromSnapshot"));
      return;
    }
    toast.error(t("admin.contentStudio.toast.noMarkdownInSnapshot"));
  };

  const handleSaveMarkdown = async () => {
    if (!selectedDraftId) return;
    try {
      const md = markdownText.trim();
      if (!md) throw new Error(t("admin.contentStudio.error.emptyMarkdown"));
      await saveMarkdownSnapshot({ draftId: selectedDraftId, markdown: md, skipTranslation: true } as any);
      toast.success(t("admin.contentStudio.toast.markdownSnapshotSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.markdownSnapshotSaveFailed"));
    }
  };

  const handleSaveAndPublishToPreview = async () => {
    if (!selectedDraftId) return;
    setRunningPublish(true);
    try {
      const md = markdownText.trim();
      if (!md) throw new Error(t("admin.contentStudio.error.emptyMarkdown"));

      // Step 1: Save markdown (skipTranslation=true so the AI does not modify the manually-edited content)
      toast.info("Saving markdown…");
      await saveMarkdownSnapshot({ draftId: selectedDraftId, markdown: md, skipTranslation: true } as any);

      // Step 2: QC Validate (parses Markdown → JSON snapshot)
      toast.info(t("admin.contentStudio.toast.validatorRunning"));
      setRunningValidator(true);
      const valRes = await runValidate({ draftId: selectedDraftId });
      setRunningValidator(false);
      if (!valRes.ok) {
        toast.error("Validation failed — fix the errors in the findings before publishing.");
        return;
      }

      // Step 3: Publish to Preview
      toast.info(t("admin.contentStudio.toast.publishingToPreview"));
      await publishDraftToPreview({
        draftId: selectedDraftId,
        moduleId: publishModuleId ? (publishModuleId as any) : undefined,
      });
      toast.success(t("admin.contentStudio.toast.previewLive"));

      // Step 4: Open unit in new tab
      const unitNumber = Number((selected as any)?.draft?.unitNumber);
      if (Number.isFinite(unitNumber) && unitNumber > 0) {
        window.open(`/unit/${unitNumber}`, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(e?.message || "Save & Preview failed.");
    } finally {
      setRunningPublish(false);
      setRunningValidator(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      toast.success(t("admin.contentStudio.toast.copiedMarkdown"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.copyFailed"));
    }
  };

  const handleDownloadMarkdown = () => {
    try {
      const unitNumber = Number((selected as any)?.draft?.unitNumber);
      const fileName = Number.isFinite(unitNumber) && unitNumber > 0 ? `unit-${unitNumber}.md` : "unit.md";
      const blob = new Blob([markdownText], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("admin.contentStudio.toast.downloadedMarkdown"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.downloadFailed"));
    }
  };


  const handleApprovePreview = async () => {
    if (!selectedDraftId) return;
    setRunningApprovePreview(true);
    try {
      const res = await approveAfterPreview({ draftId: selectedDraftId } as any);
      toast.success(
        t("admin.contentStudio.toast.previewApproved", {
          id: String((res as any)?.approvedSnapshotId || "").slice(0, 12),
        })
      );
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.approveFailed"));
    } finally {
      setRunningApprovePreview(false);
    }
  };

  const handleDownloadApprovedMarkdown = () => {
    try {
      const md = String((approvedMarkdown as any)?.markdownSource || "");
      if (!md.trim()) {
        toast.error(t("admin.contentStudio.toast.noApprovedMarkdown"));
        return;
      }
      const unitNumber = Number((selected as any)?.draft?.unitNumber);
      const fileName = Number.isFinite(unitNumber) && unitNumber > 0 ? `unit-${unitNumber}.approved.md` : "unit.approved.md";
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t("admin.contentStudio.toast.downloadedApprovedMarkdown"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.downloadFailed"));
    }
  };

  const handleLoadFromSnapshot = () => {
    const snap = selected?.snapshot as any;
    if (snap?.unitPackageJson) {
      setUnitPackageJson(String(snap.unitPackageJson));
      toast.success(t("admin.contentStudio.toast.loadedSnapshot"));
      return;
    }
    const lastRun = (selected as any)?.aiRuns?.[0];
    if (lastRun?.status === "failed" && lastRun?.error) {
      toast.error(
        t("admin.contentStudio.toast.noSnapshotLastRunFailed", {
          error: String(lastRun.error).slice(0, 180),
        })
      );
    } else {
      toast.error(t("admin.contentStudio.toast.noSnapshotRunCreator"));
    }
  };

  const handleRunSpecialist = async () => {
    if (!selectedDraftId) return;
    setRunningCreator(true);
    setProgressPercent(25);
    setProgressMessage("Creator: generating markdown…");
    try {
      toast.info(t("admin.contentStudio.toast.creatorRunning"));
      await runSpecialist({ draftId: selectedDraftId });
      toast.success(t("admin.contentStudio.toast.creatorGenerated"));
      setProgressPercent(40);
      setProgressMessage("Creator finished.");
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.creatorFailed"));
    }
    finally {
      setRunningCreator(false);
    }
  };

  const handleRunValidate = async () => {
    if (!selectedDraftId) return;
    setRunningValidator(true);
    setProgressPercent(60);
    setProgressMessage("Validator: checking structure…");
    try {
      toast.info(t("admin.contentStudio.toast.validatorRunning"));
      const res = await runValidate({ draftId: selectedDraftId });
      if (res.ok) toast.success(t("admin.contentStudio.toast.validatorPassed"));
      else toast.error(t("admin.contentStudio.toast.validatorFailedSeeFindings"));
      setProgressPercent(res?.ok ? 80 : 70);
      setProgressMessage(res?.ok ? "Validator passed." : "Validator failed.");
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.validatorFailed"));
    }
    finally {
      setRunningValidator(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDraftId) return;
    setRunningCreateValidate(true);
    try {
      // Step 1: Creator
      toast.info(t("admin.contentStudio.toast.creatingContent"));
      setProgressPercent(10);
      setProgressMessage("Creator: generating content…");
      await runSpecialist({ draftId: selectedDraftId });
      
      // Step 2: Validator (includes auto-fix)
      toast.info(t("admin.contentStudio.toast.validating"));
      setProgressPercent(60);
      setProgressMessage("Validator: validating + autofix…");
      const valRes = await runValidate({ draftId: selectedDraftId });
      
      // Step 2b: Auto-Recovery for truncated Grammar
      // If validator found truncated Grammar, fix it automatically with section-based regeneration
      if (!valRes.ok && (valRes.report as any)?.deepIssues) {
        const issues = (valRes.report as any).deepIssues || [];
        const hasTruncatedGrammar = issues.some((i: any) => 
          i.message?.includes("Grammar section appears truncated") ||
          i.message?.includes("Grammar section appears to be cut off")
        );
        
        if (hasTruncatedGrammar) {
          toast.info(t("admin.contentStudio.toast.autoFixingGrammar"));
          setProgressPercent(70);
          setProgressMessage("Auto-fix: regenerating Grammar section…");
          await runSectionRevise({
            draftId: selectedDraftId,
            sectionId: "grammar",
            instruction: "Complete the Grammar section with proper subsections (###) and detailed examples. Include at least 3 examples with Serbian + English translations for each grammar concept."
          });
          
          // Re-validate after fix
          toast.info(t("admin.contentStudio.toast.revalidatingAfterFix"));
          setProgressPercent(75);
          setProgressMessage("Validator: re-validating after fix…");
          const revalidateRes = await runValidate({ draftId: selectedDraftId });
          if (!revalidateRes.ok) {
            toast.error(t("admin.contentStudio.toast.validationStillFailedAfterAutofix"));
            setProgressPercent(75);
            setProgressMessage("Validation failed after auto-fix.");
            return;
          }
        } else {
          toast.error(t("admin.contentStudio.toast.validationFailedCheckFindings"));
          setProgressPercent(65);
          setProgressMessage("Validation failed.");
          return;
        }
      } else if (!valRes.ok) {
        toast.error(t("admin.contentStudio.toast.validationFailedCheckFindings"));
        setProgressPercent(65);
        setProgressMessage("Validation failed.");
        return;
      }
      
      // Step 3: Lector
      toast.info(t("admin.contentStudio.toast.runningLector"));
      setProgressPercent(85);
      setProgressMessage("Lector: reviewing content…");
      const lecRes = await runAuditor({ draftId: selectedDraftId });
      
      if (lecRes.ok) {
        toast.success(t("admin.contentStudio.toast.doneReady"));
        setProgressPercent(100);
        setProgressMessage("Done. Ready for preview.");
      } else {
        toast.warning(t("admin.contentStudio.toast.lectorFoundIssues"));
        setProgressPercent(92);
        setProgressMessage("Lector found issues.");
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.generationFailed"));
      setProgressPercent(0);
      setProgressMessage("Generation failed.");
    } finally {
      setRunningCreateValidate(false);
    }
  };

  const runBatch = async (action: "generate" | "validate" | "preview") => {
    const ids = Array.from(new Set(batchSelectedDraftIds.map(String))).filter(Boolean);
    if (ids.length === 0) {
      toast.error(t("admin.contentStudio.toast.noDraftsSelected"));
      return;
    }
    if (isBusy) {
      toast.error(t("admin.contentStudio.toast.anotherTaskRunning"));
      return;
    }
    setBatchRunning(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: ids.length, label: `Starting batch ${action}…` });
    const results: Array<{ draftId: string; action: string; status: "success" | "failed"; message?: string }> = [];
    const pushResult = (r: { draftId: string; action: string; status: "success" | "failed"; message?: string }) => {
      results.push(r);
      setBatchResults([...results]);
    };
    try {
      for (let i = 0; i < ids.length; i++) {
        const draftId = ids[i] as any;
        setBatchProgress({ current: i + 1, total: ids.length, label: `${action} ${i + 1}/${ids.length}` });

        try {
          if (action === "validate") {
            const res = await runValidate({ draftId });
            if (res?.ok) {
              pushResult({ draftId: String(draftId), action, status: "success" });
            } else {
              pushResult({ draftId: String(draftId), action, status: "failed", message: "Validator failed (see findings)" });
            }
            continue;
          }

          if (action === "preview") {
            await publishDraftToPreview({ draftId } as any);
            pushResult({ draftId: String(draftId), action, status: "success" });
            continue;
          }

          // action === "generate" (Creator -> Validator -> Lector)
          await runSpecialist({ draftId } as any);

          const valRes = await runValidate({ draftId } as any);
          if (!valRes?.ok && (valRes as any)?.report?.deepIssues) {
            const issues = (valRes as any).report.deepIssues || [];
            const hasTruncatedGrammar = issues.some((iss: any) =>
              String(iss?.message || "").includes("Grammar section appears truncated") ||
              String(iss?.message || "").includes("Grammar section appears to be cut off")
            );
            if (hasTruncatedGrammar) {
              await runSectionRevise({
                draftId,
                sectionId: "grammar",
                instruction:
                  "Complete the Grammar section with proper subsections (###) and detailed examples. Include at least 3 examples with Serbian + English translations for each grammar concept.",
              } as any);
              const revalidateRes = await runValidate({ draftId } as any);
              if (!revalidateRes?.ok) {
                pushResult({ draftId: String(draftId), action, status: "failed", message: "Validation failed after auto-fix" });
                continue;
              }
            } else {
              pushResult({ draftId: String(draftId), action, status: "failed", message: "Validation failed" });
              continue;
            }
          } else if (!valRes?.ok) {
            pushResult({ draftId: String(draftId), action, status: "failed", message: "Validation failed" });
            continue;
          }

          const lecRes = await runAuditor({ draftId } as any);
          if (lecRes?.ok) {
            pushResult({ draftId: String(draftId), action, status: "success" });
          } else {
            pushResult({ draftId: String(draftId), action, status: "failed", message: "Lector found issues (see findings)" });
          }
        } catch (e: any) {
          pushResult({ draftId: String(draftId), action, status: "failed", message: e?.message || String(e) });
        }
      }

      const fails = results.filter((r) => r.status === "failed").length;
      const successes = results.filter((r) => r.status === "success").length;
      toast.success(t("admin.contentStudio.toast.batchFinished", { action, ok: successes, failed: fails }));
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
    }
  };

  const handleRunRevise = async () => {
    if (!selectedDraftId) return;
    setRunningRevise(true);
    try {
      toast.info(t("admin.contentStudio.toast.revisionRunning"));
      const res = await runRevise({
        draftId: selectedDraftId,
        preferredProvider: cfgSpecialistProvider,
        maxTokens: 12000,
        humanNotes: fixHumanNotes.trim() || undefined,
      });
      if (res.ok) {
        toast.success(t("admin.contentStudio.toast.revisionApplied"));
        setFixHumanNotes("");
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.revisionFailed"));
    } finally {
      setRunningRevise(false);
    }
  };

  const handleRunAuditor = async () => {
    if (!selectedDraftId) return;
    setRunningLector(true);
    try {
      toast.info(t("admin.contentStudio.toast.runningLector"));
      const res = await runAuditor({ draftId: selectedDraftId });
      if (res.ok) toast.success(t("admin.contentStudio.toast.lectorPassed"));
      else toast.error(t("admin.contentStudio.toast.lectorFlagged"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.lectorFailed"));
    }
    finally {
      setRunningLector(false);
    }
  };

  const handleSectionRevise = async () => {
    if (!selectedDraftId) return;
    if (!expandInstruction.trim()) {
      toast.error(t("admin.contentStudio.toast.instructionRequired"));
      return;
    }
    setRunningSectionRevise(true);
    setProgressPercent(70);
    setProgressMessage("Applying section changes…");
    try {
      const sectionLabel = SECTION_OPTIONS.find((s) => s.value === expandSection)?.label || expandSection;
      toast.info(t("admin.contentStudio.toast.applyingChanges", { section: sectionLabel }));
      const res = await runSectionRevise({
        draftId: selectedDraftId,
        sectionId: expandSection,
        instruction: expandInstruction.trim(),
      });
      if (res?.ok) {
        toast.success(t("admin.contentStudio.toast.sectionUpdated", { section: sectionLabel }));
        setExpandInstruction(""); // Clear after success
        setProgressPercent(80);
        setProgressMessage("Section updated.");
      } else {
        toast.error(t("admin.contentStudio.toast.changesFailed"));
        setProgressPercent(0);
        setProgressMessage("Section update failed.");
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.sectionReviseFailed"));
      setProgressPercent(0);
      setProgressMessage("Section update failed.");
    } finally {
      setRunningSectionRevise(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedDraftId) return;
    setRunningPublish(true);
    try {
      toast.info(t("admin.contentStudio.toast.publishing"));
      await publishDraft({
        draftId: selectedDraftId,
        mode: publishMode,
        moduleId: publishModuleId ? (publishModuleId as any) : undefined,
      });
      toast.success(t("admin.contentStudio.toast.published"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.publishFailed"));
    } finally {
      setRunningPublish(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!selected) return;
    const unitNum = selected.draft.unitNumber;
    if (deleteConfirmation !== `DELETE UNIT ${unitNum}`) {
      toast.error(t("admin.contentStudio.toast.confirmationTextMismatch"));
      return;
    }
    try {
      await deleteUnitFull({ unitNumber: unitNum, confirm: deleteConfirmation });
      toast.success(t("admin.contentStudio.toast.unitDeleted", { unit: unitNum }));
      setDeleteUnitOpen(false);
      setSelectedDraftId(null);
    } catch (e: any) {
      toast.error(e.message || t("admin.contentStudio.toast.unitDeleteFailed"));
    }
  };

  const handleTranslatePublishedToGerman = async () => {
    if (!selected) return;
    const unitNum = selected.draft.unitNumber;
    const expected = `TRANSLATE UNIT ${unitNum} TO DE`;
    if (translateDeConfirmation !== expected) {
      toast.error(t("admin.contentStudio.toast.confirmationTextMismatch"));
      return;
    }

    setRunningTranslateDe(true);
    try {
      toast.info(`Translating Unit ${unitNum} (EN → DE Preview)…`);
      const res = await translatePublishedUnitEnToDe({
        unitNumber: unitNum,
        confirm: translateDeConfirmation,
        preferredProvider: cfgSpecialistProvider,
        targetReleaseStatus: "preview",
      } as any);

      const info = (res as any)?.updated;
      const previewV = (res as any)?.previewUnitVersion;
      if (info?.contentInserted != null || info?.testsInserted != null || info?.vocabInserted != null) {
        toast.success(
          `DE Preview created${previewV ? ` (v${previewV})` : ""}. Content: ${info.contentInserted ?? 0}, Tests: ${info.testsInserted ?? 0}, Vocabulary: ${info.vocabInserted ?? 0}.`
        );
      } else if (info?.contentUpserted != null || info?.testsUpserted != null || info?.vocabPatched != null) {
        toast.success(
          `DE Preview created${previewV ? ` (v${previewV})` : ""}. Content: ${info.contentUpserted ?? 0}, Tests: ${info.testsUpserted ?? 0}, Vocabulary: ${info.vocabPatched ?? 0}.`
        );
      } else {
        toast.success(`DE Preview created for Unit ${unitNum}${previewV ? ` (v${previewV})` : ""}.`);
      }
      window.open(`/unit/${unitNum}?lang=de`, "_blank", "noopener,noreferrer");
      setTranslateDeOpen(false);
      setRecentlyTranslatedUnits((prev) => new Map<number, number>(prev).set(unitNum, Date.now()));
    } catch (e: any) {
      toast.error(e?.message || `Failed to translate Unit ${unitNum} to German.`);
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handleTranslateAnyUnitToGerman = async () => {
    const unitNum = translateAnyUnitNumberParsed;
    if (!unitNum) {
      toast.error("Please select a valid unit.");
      return;
    }
    const expected = `TRANSLATE UNIT ${unitNum} TO DE`;
    if (translateAnyConfirmation !== expected) {
      toast.error(t("admin.contentStudio.toast.confirmationTextMismatch"));
      return;
    }

    setRunningTranslateDe(true);
    try {
      toast.info(`Translating Unit ${unitNum} (EN → DE Preview)…`);
      const res = await translatePublishedUnitEnToDe({
        unitNumber: unitNum,
        confirm: translateAnyConfirmation,
        preferredProvider: cfgSpecialistProvider,
        targetReleaseStatus: "preview",
      } as any);

      const info = (res as any)?.updated;
      const previewV = (res as any)?.previewUnitVersion;
      if (info?.contentInserted != null || info?.testsInserted != null || info?.vocabInserted != null) {
        toast.success(
          `DE Preview created${previewV ? ` (v${previewV})` : ""}. Content: ${info.contentInserted ?? 0}, Tests: ${info.testsInserted ?? 0}, Vocabulary: ${info.vocabInserted ?? 0}.`
        );
      } else if (info?.contentUpserted != null || info?.testsUpserted != null || info?.vocabPatched != null) {
        toast.success(
          `DE Preview created${previewV ? ` (v${previewV})` : ""}. Content: ${info.contentUpserted ?? 0}, Tests: ${info.testsUpserted ?? 0}, Vocabulary: ${info.vocabPatched ?? 0}.`
        );
      } else {
        toast.success(`DE Preview created for Unit ${unitNum}${previewV ? ` (v${previewV})` : ""}.`);
      }
      setTranslateDeResult({
        unitNumber: unitNum,
        previewVersion: typeof previewV === "number" ? previewV : null,
        timestamp: Date.now(),
        info,
      });
      setTranslateAnyOpen(false);
      setRecentlyTranslatedUnits((prev) => new Map<number, number>(prev).set(unitNum, Date.now()));
    } catch (e: any) {
      toast.error(e?.message || `Failed to translate Unit ${unitNum} to German.`);
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handlePublishDeTranslationLive = async () => {
    if (!translateDeResult) return;
    const unitNum = translateDeResult.unitNumber;
    const expected = `TRANSLATE UNIT ${unitNum} TO DE`;
    setRunningTranslateDe(true);
    try {
      toast.info(`Publishing DE translation for Unit ${unitNum} live…`);
      // First take preview offline (clean up preview rows)
      await takeUnitPreviewOfflineByUnitNumber({ unitNumber: unitNum } as any);
      // Then write as published
      await translatePublishedUnitEnToDe({
        unitNumber: unitNum,
        confirm: expected,
        preferredProvider: cfgSpecialistProvider,
        targetReleaseStatus: "published",
      } as any);
      toast.success(`DE translation for Unit ${unitNum} published live.`);
      setTranslateDeResult(null);
    } catch (e: any) {
      toast.error(e?.message || `Failed to publish DE translation for Unit ${unitNum}.`);
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handleTakeUnitPreviewOfflineForAny = async () => {
    const unitNum = translateAnyUnitNumberParsed;
    if (!unitNum) {
      toast.error("Please select a valid unit.");
      return;
    }
    setRunningPublish(true);
    try {
      toast.info(`Taking preview offline for Unit ${unitNum}…`);
      await takeUnitPreviewOfflineByUnitNumber({ unitNumber: unitNum } as any);
      toast.success(`Preview taken offline for Unit ${unitNum}.`);
    } catch (e: any) {
      toast.error(e?.message || `Failed to take preview offline for Unit ${unitNum}.`);
    } finally {
      setRunningPublish(false);
    }
  };

  const handlePublishToPreview = async () => {
    if (!selectedDraftId) return;
    setRunningPublish(true);
    try {
      toast.info(t("admin.contentStudio.toast.publishingToPreview"));
      await publishDraftToPreview({
        draftId: selectedDraftId,
        moduleId: publishModuleId ? (publishModuleId as any) : undefined,
      });
      toast.success(t("admin.contentStudio.toast.previewLive"));
      const unitNumber = Number((selected as any)?.draft?.unitNumber);
      if (Number.isFinite(unitNumber) && unitNumber > 0) {
        window.open(`/unit/${unitNumber}`, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.previewPublishFailed"));
    } finally {
      setRunningPublish(false);
    }
  };

  const handleTakePreviewOffline = async () => {
    if (!selectedDraftId) return;
    setRunningPublish(true);
    try {
      toast.info(t("admin.contentStudio.toast.takingPreviewOffline"));
      await takePreviewOffline({ draftId: selectedDraftId });
      toast.success(t("admin.contentStudio.toast.previewTakenOffline"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.previewOfflineFailed"));
    } finally {
      setRunningPublish(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSheet
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        cfgSpecialistProvider={cfgSpecialistProvider}
        setCfgSpecialistProvider={setCfgSpecialistProvider}
        cfgSpecialistModel={cfgSpecialistModel}
        setCfgSpecialistModel={setCfgSpecialistModel}
        cfgSpecialistCustom={cfgSpecialistCustom}
        setCfgSpecialistCustom={setCfgSpecialistCustom}
        cfgAuditorProvider={cfgAuditorProvider}
        setCfgAuditorProvider={setCfgAuditorProvider}
        cfgAuditorModel={cfgAuditorModel}
        setCfgAuditorModel={setCfgAuditorModel}
        cfgAuditorCustom={cfgAuditorCustom}
        setCfgAuditorCustom={setCfgAuditorCustom}
        onSaveModelConfig={handleSaveModelConfig}
        skillsStage={skillsStage}
        setSkillsStage={setSkillsStage}
        stageSkills={stageSkills}
        newSkillName={newSkillName}
        setNewSkillName={setNewSkillName}
        newSkillPrompt={newSkillPrompt}
        setNewSkillPrompt={setNewSkillPrompt}
        editSkillId={editSkillId}
        setEditSkillId={setEditSkillId}
        onCreateSkill={handleCreateSkill}
        onEditSkill={handleEditSkill}
        onDeactivateSkill={handleDeactivateSkill}
        refs={refs}
        newRefType={newRefType}
        setNewRefType={setNewRefType}
        newRefTitle={newRefTitle}
        setNewRefTitle={setNewRefTitle}
        newRefUrl={newRefUrl}
        setNewRefUrl={setNewRefUrl}
        newRefTags={newRefTags}
        setNewRefTags={setNewRefTags}
        newRefNotes={newRefNotes}
        setNewRefNotes={setNewRefNotes}
        newRefFile={newRefFile}
        setNewRefFile={setNewRefFile}
        newRefStorageId={newRefStorageId}
        setNewRefStorageId={setNewRefStorageId}
        newRefUploading={newRefUploading}
        onCreateReference={handleCreateReference}
        onUploadReferencePdf={handleUploadReferencePdf}
        onOpenEditReferenceGuidelines={handleOpenEditReferenceGuidelines}
        editRefOpen={editRefOpen}
        setEditRefOpen={setEditRefOpen}
        setEditRefId={setEditRefId}
        editRef={editRef}
        editRefGuidelines={editRefGuidelines}
        setEditRefGuidelines={setEditRefGuidelines}
        editRefLoadedFromVersion={editRefLoadedFromVersion}
        setEditRefLoadedFromVersion={setEditRefLoadedFromVersion}
        editRefSaving={editRefSaving}
        editRefNewPdfFile={editRefNewPdfFile}
        setEditRefNewPdfFile={setEditRefNewPdfFile}
        editRefPdfUploading={editRefPdfUploading}
        guidelineVersions={guidelineVersions}
        onSaveReferenceGuidelines={handleSaveReferenceGuidelines}
        onClearReferenceGuidelines={handleClearReferenceGuidelines}
        onRevertGuidelinesToVersion={handleRevertGuidelinesToVersion}
        onDeleteGuidelinesVersion={handleDeleteGuidelinesVersion}
        onLoadGuidelinesVersionIntoEditor={handleLoadGuidelinesVersionIntoEditor}
        onReloadCurrentGuidelinesIntoEditor={handleReloadCurrentGuidelinesIntoEditor}
        onAddPdfToReference={handleAddPdfToReference}
        onRemovePdfFromReference={handleRemovePdfFromReference}
        draftTemplates={draftTemplates}
        newTemplateName={newTemplateName}
        setNewTemplateName={setNewTemplateName}
        newTemplateDescription={newTemplateDescription}
        setNewTemplateDescription={setNewTemplateDescription}
        selectedDraftId={selectedDraftId}
        onCreateTemplateFromSelectedDraft={handleCreateTemplateFromSelectedDraft}
        onDeactivateTemplate={handleDeactivateTemplate}
        onUseTemplate={handleUseTemplate}
        promptPreviewSlot={<PromptPreview promptPreview={promptPreview as any} />}
      />

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Content Studio</h1>
          <div className="text-sm text-muted-foreground">
            {studioView === "drafts"
              ? "Draft \u2192 Generate \u2192 QA \u2192 Preview \u2192 Publish"
              : studioView === "import"
                ? "Upload Markdown / JSON to import units"
                : "Manage all units across languages"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border bg-muted p-0.5">
            <Button
              variant={studioView === "drafts" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("drafts")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Draft Studio
            </Button>
            <Button
              variant={studioView === "import" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("import")}
            >
              Quick Import
            </Button>
            <Button
              variant={studioView === "units" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("units")}
            >
              <LayoutList className="mr-1.5 h-3.5 w-3.5" />
              Unit Manager
            </Button>
          </div>
          {studioView === "drafts" && (
            <Button variant="default" size="sm" onClick={() => setCreateDraftOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Draft
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Create Draft Dialog */}
      <Dialog open={createDraftOpen} onOpenChange={setCreateDraftOpen}>
        <DialogContent className={CONTENT_STUDIO_DIALOG_WIDTH}>
          <DialogHeader>
            <DialogTitle>Create Draft</DialogTitle>
            <DialogDescription>
              Define unit metadata and the Creator brief. Output must be English.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Template (optional)</Label>
                <Select
                  value={newTemplateId ? newTemplateId : "none"}
                  onValueChange={(v) => {
                    const next = v === "none" ? "" : String(v);
                    setNewTemplateId(next);
                    if (!next) return;
                    const tpl = (draftTemplates || []).find((t: any) => String(t?._id) === next) as any;
                    const brief = String(tpl?.inspirationRef?.notes || "").trim();
                    if (brief) setNewCreatorBrief(brief);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(draftTemplates || []).map((t: any) => (
                      <SelectItem key={String(t._id)} value={String(t._id)}>
                        {String(t.name || "Untitled")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Templates can pre-configure reference + skills + brief. You can still adjust everything after creation.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Module Number</Label>
                  <Input value={newModuleNumber} onChange={(e) => setNewModuleNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Number</Label>
                  <Input value={newUnitNumber} onChange={(e) => setNewUnitNumber(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Unit description (1 short sentence)</Label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="This becomes **Description:** in the unit header (max ~120 chars)."
                />
                <div className="text-xs text-muted-foreground">
                  This becomes the unit header line <span className="font-mono">**Description:** ...</span>.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Creator brief / unit prompt</Label>
              <div className="text-xs text-muted-foreground">
                Main prompt for the unit (scenes + didactic progression). You can write German or English — output is English.
              </div>
              <Textarea
                value={newCreatorBrief}
                onChange={(e) => setNewCreatorBrief(e.target.value)}
                className="min-h-[260px]"
                placeholder={[
                  "Example:",
                  "- Situation: café in Montenegro",
                  "- Prerequisites: greetings (Unit 1), introductions (Unit 2)",
                  "- New: ordering drinks, asking for the bill, 'Ja bih ...'",
                  "- Constraints: max 30 vocab, max 4 dialogues, keep it concise",
                ].join("\n")}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setCreateDraftOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleCreateDraft();
              }}
            >
              Create Draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import view */}
      {studioView === "import" && <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading...</div>}><LazyImportTab /></Suspense>}

      {/* Unit Manager view */}
      {studioView === "units" && (
        <UnitManagerTab
          recentlyTranslatedUnits={recentlyTranslatedUnits}
          onTranslationComplete={(unitNumber) =>
            setRecentlyTranslatedUnits((prev) => new Map(prev).set(unitNumber, Date.now()))
          }
        />
      )}

      {/* Draft Studio view */}
      {studioView === "drafts" && (() => {
        const draftListContent = (
          <DraftList
            drafts={drafts}
            filteredDrafts={filteredDrafts}
            selectedDraftId={selectedDraftId}
            onSelectDraft={(id) => { handleSelectDraft(id); setMobileSidebarOpen(false); }}
            draftsSearch={draftsSearch}
            setDraftsSearch={setDraftsSearch}
            draftsStatusFilter={draftsStatusFilter}
            setDraftsStatusFilter={setDraftsStatusFilter}
            batchSelectedDraftIds={batchSelectedDraftIds}
            toggleBatchSelectDraft={toggleBatchSelectDraft}
            selectAllFilteredDrafts={selectAllFilteredDrafts}
            clearBatchSelection={clearBatchSelection}
            batchRunning={batchRunning}
            batchProgress={batchProgress}
            batchResults={batchResults}
            isBusy={isBusy}
            onRunBatch={runBatch}
          />
        );

        const inspectorContent = selectedDraftId && selected?.draft ? (
          <InspectorPanel
            activeStep={activeInspectorStep}
            selected={selected}
            selectedDraftId={selectedDraftId}
            isBusy={isBusy}
            draftEditTitle={draftEditTitle}
            setDraftEditTitle={setDraftEditTitle}
            draftEditDescription={draftEditDescription}
            setDraftEditDescription={setDraftEditDescription}
            draftAuthorNoteName={draftAuthorNoteName}
            setDraftAuthorNoteName={setDraftAuthorNoteName}
            draftAuthorNoteQuote={draftAuthorNoteQuote}
            setDraftAuthorNoteQuote={setDraftAuthorNoteQuote}
            onFounderQuoteBlur={handleFounderQuoteBlur}
            draftRefId={draftRefId}
            setDraftRefId={setDraftRefId}
            draftRefNotes={draftRefNotes}
            setDraftRefNotes={setDraftRefNotes}
            draftRefChapter={draftRefChapter}
            setDraftRefChapter={setDraftRefChapter}
            draftRefPages={draftRefPages}
            setDraftRefPages={setDraftRefPages}
            refs={refs}
            specialistSkills={specialistSkills}
            auditorSkills={auditorSkills}
            draftSpecialistSkillIds={draftSpecialistSkillIds}
            setDraftSpecialistSkillIds={setDraftSpecialistSkillIds}
            draftAuditorSkillIds={draftAuditorSkillIds}
            setDraftAuditorSkillIds={setDraftAuditorSkillIds}
            onSaveDraftSkillsAndReference={handleSaveDraftSkillsAndReference}
            hasUnsavedChanges={hasUnsavedChanges}
            metaAutosaveStatus={metaAutosaveStatus}
            metaAutosavedAt={metaAutosavedAt}
            runningCreator={runningCreator}
            runningValidator={runningValidator}
            runningCreateValidate={runningCreateValidate}
            progressPercent={progressPercent}
            progressMessage={progressMessage}
            elapsedSeconds={elapsedSeconds}
            currentTaskLabel={currentTaskLabel}
            onGenerate={handleGenerate}
            onRunSpecialist={handleRunSpecialist}
            onRunValidate={handleRunValidate}
            findings={findings}
            errorFindings={errorFindings}
            warningFindings={warningFindings}
            latestReport={latestReport}
            runningRevise={runningRevise}
            runningLector={runningLector}
            runningSectionRevise={runningSectionRevise}
            fixHumanNotes={fixHumanNotes}
            setFixHumanNotes={setFixHumanNotes}
            expandSection={expandSection}
            setExpandSection={setExpandSection}
            expandInstruction={expandInstruction}
            setExpandInstruction={setExpandInstruction}
            canRunLector={canRunLector}
            onRunRevise={handleRunRevise}
            onRunAuditor={handleRunAuditor}
            onSectionRevise={handleSectionRevise}
            onDismissFinding={(p) => dismissFinding({ findingId: p.findingId, dismissed: p.dismissed })}
            runningPublish={runningPublish}
            runningTranslateDe={runningTranslateDe}
            runningApprovePreview={runningApprovePreview}
            publishMode={publishMode}
            setPublishMode={setPublishMode}
            publishModuleId={publishModuleId}
            setPublishModuleId={setPublishModuleId}
            modules={modules}
            canPublishLive={canPublishLive}
            approvedMarkdown={approvedMarkdown}
            translateDeOpen={translateDeOpen}
            setTranslateDeOpen={setTranslateDeOpen}
            translateDeConfirmation={translateDeConfirmation}
            setTranslateDeConfirmation={setTranslateDeConfirmation}
            translateDePreview={translateDePreview}
            onPublishToPreview={handlePublishToPreview}
            onTakePreviewOffline={handleTakePreviewOffline}
            onApprovePreview={handleApprovePreview}
            onDownloadApprovedMarkdown={handleDownloadApprovedMarkdown}
            onPublish={handlePublish}
            onTranslatePublishedToGerman={handleTranslatePublishedToGerman}
            deleteUnitOpen={deleteUnitOpen}
            setDeleteUnitOpen={setDeleteUnitOpen}
            deleteConfirmation={deleteConfirmation}
            setDeleteConfirmation={setDeleteConfirmation}
            onDeleteUnit={handleDeleteUnit}
            onDeleteSelectedDraft={handleDeleteSelectedDraft}
            showDeleteDraftDialog={showDeleteDraftDialog}
            setShowDeleteDraftDialog={setShowDeleteDraftDialog}
            onConfirmDeleteDraft={handleConfirmDeleteDraft}
            cfgSpecialistProvider={cfgSpecialistProvider}
          />
        ) : null;

        return (
        <div className="flex flex-col lg:flex-row gap-0 h-[calc(100vh-8rem)] border rounded-lg overflow-hidden bg-background">
          {/* Mobile Sidebar Sheet */}
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent side="left" className="w-[300px] p-0 lg:hidden">
              <div className="flex flex-col h-full overflow-hidden pt-8">
                {draftListContent}
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile Inspector Sheet */}
          <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
            <SheetContent side="right" className="w-[340px] p-0 lg:hidden">
              <div className="flex flex-col h-full overflow-y-auto pt-8">
                {inspectorContent}
              </div>
            </SheetContent>
          </Sheet>

          {/* Zone 1: Sidebar (desktop only) */}
          <div className="hidden lg:flex w-[260px] shrink-0 border-r flex-col overflow-hidden">
            {draftListContent}
          </div>

          {/* Zone 2: Central Workspace */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!selectedDraftId || !selected?.draft ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
                <span>Select a draft from the sidebar or create a new one.</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <PanelLeft className="h-4 w-4 mr-2" />
                  Open Drafts
                </Button>
              </div>
            ) : (
              <>
                {/* Workspace Header */}
                <div className="px-3 lg:px-4 py-2 border-b bg-muted/20 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 lg:hidden"
                      onClick={() => setMobileSidebarOpen(true)}
                    >
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-sm truncate">
                      U{selected.draft.unitNumber}: {selected.draft.title}
                    </span>
                    <DraftStatusBadge status={selected.draft.status} />
                    {hasUnsavedChanges && <Badge variant="secondary" className="text-[10px]">Unsaved</Badge>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={handleSaveDraftSkillsAndReference} disabled={!selectedDraftId || isBusy}>
                      Save
                    </Button>
                    {inspectorContent && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 lg:hidden"
                        onClick={() => setMobileInspectorOpen(true)}
                      >
                        <PanelRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 4-Step Stepper */}
                <div className="px-3 lg:px-4 py-2 border-b flex items-center gap-1 shrink-0 overflow-x-auto">
                  {(["setup", "generate", "review", "publish"] as InspectorStep[]).map((step, idx) => {
                    const isActive = step === activeInspectorStep;
                    const stepLabels: Record<InspectorStep, string> = {
                      setup: "1. Setup",
                      generate: "2. Generate",
                      review: "3. Review",
                      publish: "4. Publish",
                    };
                    return (
                      <Fragment key={step}>
                        {idx > 0 && <span className="text-muted-foreground/40 mx-1 hidden sm:inline">{"\u2192"}</span>}
                        <button
                          className={cn(
                            "px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => setActiveInspectorStep(step)}
                        >
                          {stepLabels[step]}
                        </button>
                      </Fragment>
                    );
                  })}
                  {isBusy && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="hidden sm:inline">{currentTaskLabel}</span>
                    </span>
                  )}
                </div>

                {/* Artifacts Panel (takes remaining height) */}
                <div className="flex-1 overflow-auto">
                  <ArtifactsPanel
                    selected={selected}
                    selectedDraftId={selectedDraftId}
                    isBusy={isBusy}
                    runningPublish={runningPublish}
                    markdownText={markdownText}
                    setMarkdownText={setMarkdownText}
                    markdownDirty={markdownDirty}
                    restoreMarkdownText={restoreMarkdownText}
                    setRestoreMarkdownText={setRestoreMarkdownText}
                    setRestoreMarkdownUpdatedAt={setRestoreMarkdownUpdatedAt}
                    restoreMarkdownUpdatedAt={restoreMarkdownUpdatedAt}
                    markdownLocalStorageKey={markdownLocalStorageKey}
                    unitPackageJson={unitPackageJson}
                    setUnitPackageJson={setUnitPackageJson}
                    preview={preview}
                    draftSnapshots={draftSnapshots}
                    diffLeftSnapshotId={diffLeftSnapshotId}
                    setDiffLeftSnapshotId={setDiffLeftSnapshotId}
                    diffRightSnapshotId={diffRightSnapshotId}
                    setDiffRightSnapshotId={setDiffRightSnapshotId}
                    diffRows={diffRows}
                    onSaveMarkdown={handleSaveMarkdown}
                    onSaveAndPublishToPreview={handleSaveAndPublishToPreview}
                    onCopyMarkdown={handleCopyMarkdown}
                    onDownloadMarkdown={handleDownloadMarkdown}
                    onLoadMarkdownFromSnapshot={handleLoadMarkdownFromSnapshot}
                    onLoadFromSnapshot={handleLoadFromSnapshot}
                    onSaveJson={handleSaveJson}
                    t={t}
                  />
                </div>
              </>
            )}
          </div>

          {/* Zone 3: Inspector (desktop only) */}
          {inspectorContent && (
            <div className="hidden lg:flex w-[320px] shrink-0 border-l flex-col overflow-hidden">
              {inspectorContent}
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}
