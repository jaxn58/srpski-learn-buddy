import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Sparkles, Loader2, Settings, Plus, LayoutList, PanelLeft, PanelRight, Volume2, Brain, FolderTree } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { UnitManagerTab } from "@/components/admin/UnitManagerTab";
const LazyModulesTab = lazy(() => import("@/components/admin/contentStudio/ModulesTab").then(m => ({ default: m.ModulesTab })));
const LazyAudioFilesTab = lazy(() => import("@/components/admin/contentStudio/AudioFilesTab").then(m => ({ default: m.AudioFilesTab })));
const LazyValidatorMemoryPanel = lazy(() => import("@/components/admin/contentStudio/ValidatorMemoryPanel").then(m => ({ default: m.ValidatorMemoryPanel })));
import { SettingsSheet } from "@/components/admin/contentStudio/SettingsSheet";
import { DraftList } from "@/components/admin/contentStudio/DraftList";
import { ArtifactsPanel } from "@/components/admin/contentStudio/ArtifactsPanel";
import { PromptPreview } from "@/components/admin/contentStudio/PromptPreview";
import { InspectorPanel } from "@/components/admin/contentStudio/InspectorPanel";
import type { InspectorStep } from "@/components/admin/contentStudio/InspectorPanel";
import { DraftEditPanel } from "@/components/admin/contentStudio/DraftEditPanel";
import { DraftStatusBadge } from "@/components/admin/contentStudio/StatusBadge";
import type { Mode, Provider, StageKey, SectionId, NextStepKey, StepId, SettingsTab, StudioView } from "@/components/admin/contentStudio/types";
import { isKnownModel, stageOrderedModels } from "@/components/admin/contentStudio/constants";
import { useSectionLabel } from "@/components/admin/contentStudio/utils/sectionLabel";
import { countOpenFindings, OBJECTIVE_FINDING_CODES } from "@/components/admin/contentStudio/utils/draftReviewState";
import {
  DEFAULT_VOCABULARY_BUDGET,
  parseVocabularyBudget,
} from "@shared/contentStudio/vocabularyBudget";
import { buildSideBySideDiffRows } from "@/components/admin/contentStudio/utils/diffAlgorithm";
import { computeBriefVersionNumbers, formatBriefVersionId } from "@/components/admin/contentStudio/utils/briefVersionLabel";
import {
  collectCognateCandidatesFromResult,
  parseUntranslatedPromptGuardFailures,
} from "@/components/admin/contentStudio/utils/parseTranslatorGuardError";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ContentStudioAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const sectionLabelOf = useSectionLabel();
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

  const [skillsStage, setSkillsStage] = useState<"specialist" | "auditor" | "translator">("specialist");
  const stageSkills = useQuery(api.contentStudio.listStageSkills, { stage: skillsStage });
  const inactiveStageSkills = useQuery(api.contentStudio.listInactiveStageSkills, { stage: skillsStage });
  const upsertStageSkill = useMutation(api.contentStudio.upsertStageSkill);
  const deactivateSkill = useMutation(api.contentStudio.deactivateSkill);
  const reactivateSkill = useMutation(api.contentStudio.reactivateSkill);
  const deleteSkill = useMutation(api.contentStudio.deleteSkill);

  const specialistSkills = useQuery(api.contentStudio.listStageSkills, { stage: "specialist" });
  const auditorSkills = useQuery(api.contentStudio.listStageSkills, { stage: "auditor" });

  const setDraftSpecialistSkills = useMutation(api.contentStudio.setDraftSpecialistSkills);
  const setDraftAuditorSkills = useMutation(api.contentStudio.setDraftAuditorSkills);

  const createDraft = useMutation(api.contentStudio.createDraft);
  const updateDraftMeta = useMutation(api.contentStudio.updateDraftMeta);
  const saveSnapshot = useMutation(api.contentStudio.saveUnitPackageSnapshot);
  const deleteDraft = useMutation(api.contentStudio.deleteDraft);
  const addHumanReviewNote = useMutation(api.contentStudio.addHumanReviewNote);
  const setDraftStatus = useMutation(api.contentStudio.setDraftStatus);
  const dismissFinding = useMutation(api.contentStudio.dismissFinding);

  // Ping-Pong: Brief <-> Markdown (Brief Version history + section adoption)
  const briefVersions = useQuery(
    api.contentStudio.listBriefVersions,
    selectedDraftId ? { draftId: selectedDraftId } : ("skip" as any)
  );
  const pendingSectionRevisions = useQuery(
    api.contentStudio.listPendingSectionRevisions,
    selectedDraftId ? { draftId: selectedDraftId } : ("skip" as any)
  );
  const adoptSectionsIntoBrief = useMutation(api.contentStudio.adoptSectionsIntoBrief);
  const refuseSectionRevisionMutation = useMutation(api.contentStudio.refuseSectionRevision);
  const selectBriefVersionMutation = useMutation(api.contentStudio.selectBriefVersion);
  const saveBriefVersionMutation = useMutation(api.contentStudio.saveBriefVersion);
  const nameBriefVersionMutation = useMutation(api.contentStudio.nameBriefVersion);
  const deleteBriefVersionMutation = useMutation(api.contentStudio.deleteBriefVersion);
  const [briefVersionBusy, setBriefVersionBusy] = useState(false);
  const [adoptingChanges, setAdoptingChanges] = useState(false);
  // Refuse = revert a single pending Section-Revise's Markdown one step back
  // (never the Brief). refuseSectionConfirm holds the section awaiting the
  // human's confirmation (destructive: discards the Section-Revise output);
  // refusingSection tracks which section's mutation is in flight.
  const [refuseSectionConfirm, setRefuseSectionConfirm] = useState<SectionId | null>(null);
  const [refusingSection, setRefusingSection] = useState<SectionId | null>(null);

  const runSpecialist = useAction(api.contentStudio._creator.runAiSpecialistGenerate);
  const runValidate = useAction(api.contentStudio.runQcValidate);
  const runAuditor = useAction(api.contentStudio.runAiAuditor);
  const runRevise = useAction(api.contentStudio._creator.runAiCreatorRevise);
  const runSectionRevise = useAction(api.contentStudio.runSectionRevise);
  const addDialogue = useAction(api.contentStudio.addDialogue);
  const saveMarkdownSnapshot = useAction(api.contentStudio.saveMarkdownSnapshot);
  const createDraftPreview = useAction(api.contentStudio.createDraftPreview);
  const takeUnitPreviewOfflineByUnitNumber = useAction(api.contentStudio.takeUnitPreviewOfflineByUnitNumber);
  const translatePublishedUnitEnToDe = useAction(api.contentStudio.translatePublishedUnitEnToDe);
  const addTranslatorCognates = useMutation(api.contentStudio.addTranslatorCognates);
  const deleteUnitFull = useMutation(api.contentStudio.deleteUnitFull);

  type CognateAcceptPrompt = {
    terms: string[];
    errorMessage: string;
  };
  const [cognateAcceptPrompt, setCognateAcceptPrompt] = useState<CognateAcceptPrompt | null>(null);
  const [cognateAcceptBusy, setCognateAcceptBusy] = useState(false);

  const offerCognateAccept = (terms: string[], detail?: string) => {
    const unique = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) return;
    setCognateAcceptPrompt({ terms: unique, errorMessage: detail ?? "" });
  };

  const offerCognateAcceptFromResult = (res: unknown) => {
    offerCognateAccept(collectCognateCandidatesFromResult(res));
  };

  const handleAcceptCognates = async () => {
    if (!cognateAcceptPrompt) return;
    setCognateAcceptBusy(true);
    try {
      const res = await addTranslatorCognates({
        terms: cognateAcceptPrompt.terms,
        note: "Akzeptiert nach Quality-Guard (EN=DE Cognate)",
      });
      const label = [...res.added, ...res.alreadyPresent].join(", ");
      toast.success(
        t("admin.contentStudio.toast.cognatesAccepted", {
          defaultValue: "Cognate(s) saved: {{terms}}. DE preview stays as written.",
          terms: label,
        })
      );
      setCognateAcceptPrompt(null);
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.cognatesSaveFailed", "Failed to save cognates.")
      );
    } finally {
      setCognateAcceptBusy(false);
    }
  };

  // Surface SR<->DE verifier summary as a toast; detailed issue list lives in UnitManagerTab.
  const showVerifierToast = (res: any) => {
    const v = res?.translationStats?.verifier;
    if (!v) return;
    const critical = v.finalCriticalCount ?? 0;
    const warning = v.finalWarningCount ?? 0;
    const retried = !!v.retryAttempted;
    if (critical > 0) {
      toast.warning(
        retried
          ? t("admin.contentStudio.toast.verifierCriticalRemainAfterRetry", {
              defaultValue:
                "SR→DE verifier: {{n}} critical issue(s) remain after auto-retry. Review the DE preview before publishing.",
              n: critical,
            })
          : t("admin.contentStudio.toast.verifierCriticalRemain", {
              defaultValue:
                "SR→DE verifier: {{n}} critical issue(s) remain. Review the DE preview before publishing.",
              n: critical,
            })
      );
    } else if (retried) {
      toast.success(
        t("admin.contentStudio.toast.verifierAutoFixed", {
          defaultValue: "SR→DE verifier: critical issues auto-fixed by retry ({{warnings}} warning(s) remain).",
          warnings: warning,
        })
      );
    } else if (warning > 0) {
      toast.info(
        t("admin.contentStudio.toast.verifierWarningsOnly", {
          defaultValue: "SR→DE verifier: {{warnings}} warning(s); no critical issues.",
          warnings: warning,
        })
      );
    }
  };

  const [unitPackageJson, setUnitPackageJson] = useState<string>("");
  const [markdownText, setMarkdownText] = useState<string>("");
  const [restoreMarkdownText, setRestoreMarkdownText] = useState<string>("");
  const [restoreMarkdownUpdatedAt, setRestoreMarkdownUpdatedAt] = useState<number | null>(null);
  const [showMarkdownRendered, setShowMarkdownRendered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewModuleId, setPreviewModuleId] = useState<string>("__auto__");

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
  const [creatingPreview, setCreatingPreview] = useState(false);
  const [runningRevise, setRunningRevise] = useState(false);
  /** Automatic Lector -> Fix -> Validator cycle (see handleReviewUntilClean). */
  const [runningReviewCycle, setRunningReviewCycle] = useState(false);
  const [runningCreateValidate, setRunningCreateValidate] = useState(false);
  // Guardrail: full Creator rebuild would discard curated snapshot; hold the
  // pending intent until the user confirms the overwrite in a dialog.
  const [creatorOverwriteConfirm, setCreatorOverwriteConfirm] = useState<
    null | { mode: "single" | "generate"; reason: string }
  >(null);
  const [runningSectionRevise, setRunningSectionRevise] = useState(false);
  const [runningTranslateDe, setRunningTranslateDe] = useState(false);

  // Track recently translated units (unitNumber -> timestamp) for UnitManager highlighting
  const [recentlyTranslatedUnits, setRecentlyTranslatedUnits] = useState<Map<number, number>>(new Map());

  // Fix Findings: human notes for the revision AI
  const [fixHumanNotes, setFixHumanNotes] = useState("");

  // Section-based revision (targeted edits)
  const [expandSection, setExpandSection] = useState<SectionId>("phrases");
  const [expandInstruction, setExpandInstruction] = useState("");

  // Top-level view toggle
  const [studioView, setStudioView] = useState<StudioView>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (
      v === "modules" ||
      v === "units" ||
      v === "drafts" ||
      v === "audioFiles" ||
      v === "validatorMemory"
    )
      return v as StudioView;
    return "draftManager";
  });

  // Mobile responsive state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Settings sheet state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("ai");
  // Pre-fill state for DraftEditPanel create form (triggered e.g. via "Use Template" in Settings)
  const [pendingDraftCreate, setPendingDraftCreate] = useState<{ templateId?: string; creatorBrief?: string } | null>(null);
  /** Explicit workspace mode: create form vs editing a selected draft. */
  const [isDraftCreateMode, setIsDraftCreateMode] = useState(false);
  const [draftCreateNonce, setDraftCreateNonce] = useState(0);

  // Draft list navigation (left pane)
  const [draftsSearch, setDraftsSearch] = useState("");
  const [draftsStatusFilter, setDraftsStatusFilter] = useState<
    "all" | "draft" | "qc_failed" | "qc_passed" | "audit_failed" | "ready_to_publish" | "published"
  >("all");

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
  /** Vocabulary guideline per unit; text so the field can be emptied while typing. */
  const [cfgVocabularyBudget, setCfgVocabularyBudget] = useState<string>(
    String(DEFAULT_VOCABULARY_BUDGET),
  );

  // Draft: specialist skills + reference
  const [draftRefId, setDraftRefId] = useState<string>("");
  // Reference-specific note (inspirationRef.referenceNotes) — individualizes
  // how THIS unit uses the selected reference. Distinct from the creator
  // brief below; the two must never overwrite each other.
  const [draftRefNotes, setDraftRefNotes] = useState<string>("");
  const [draftRefChapter, setDraftRefChapter] = useState<string>("");
  const [draftRefPages, setDraftRefPages] = useState<string>("");

  // Draft meta editing (title/description/numbers)
  const [draftEditTitle, setDraftEditTitle] = useState<string>("");
  const [draftEditDescription, setDraftEditDescription] = useState<string>("");
  const [draftEditModuleNumber, setDraftEditModuleNumber] = useState<string>("");
  const [draftEditUnitNumber, setDraftEditUnitNumber] = useState<string>("");
  // Creator brief / unit prompt (inspirationRef.notes) — the main authoring prompt.
  const [draftCreatorBrief, setDraftCreatorBrief] = useState<string>("");
  const [draftAuthorNoteName, setDraftAuthorNoteName] = useState<string>("");
  const [draftAuthorNoteQuote, setDraftAuthorNoteQuote] = useState<string>("");

  const [draftSpecialistSkillIds, setDraftSpecialistSkillIds] = useState<string[]>([]);
  const [draftAuditorSkillIds, setDraftAuditorSkillIds] = useState<string[]>([]);

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
    creatingPreview ||
    runningRevise ||
    runningReviewCycle ||
    runningCreateValidate ||
    runningSectionRevise ||
    runningTranslateDe;

  const currentTaskLabel = useMemo(() => {
    if (runningCreator) return t("admin.contentStudio.page.taskCreatorGenerating", "Creator is generating content...");
    if (runningValidator) return t("admin.contentStudio.page.taskValidatorChecking", "Validator is checking structure...");
    if (runningLector) return t("admin.contentStudio.page.taskLectorReviewing", "Lector is reviewing content...");
    if (runningRevise) return t("admin.contentStudio.page.taskApplyingRevisions", "Applying revisions...");
    if (runningReviewCycle) return progressMessage || t("admin.contentStudio.page.taskReviewCycle", "Reviewing until clean...");
    if (runningCreateValidate) return t("admin.contentStudio.page.taskCreatorValidator", "Running Creator + Validator...");
    if (runningSectionRevise) return t("admin.contentStudio.page.taskApplyingChanges", "Applying changes...");
    if (creatingPreview) return t("admin.contentStudio.page.taskCreatingPreview", "Creating preview...");
    if (runningTranslateDe) return t("admin.contentStudio.page.taskTranslatingGerman", "Translating to German...");
    return "";
  }, [runningCreator, runningValidator, runningLector, runningCreateValidate, runningSectionRevise, creatingPreview, runningTranslateDe, t]);


  const nextStepKey: NextStepKey = useMemo(() => {
    const status = String((selected as any)?.draft?.status || "");
    const hasSnapshot = Boolean((selected as any)?.snapshot?._id);
    const hasErrors = errorFindings.length > 0;

    if (!hasSnapshot) return "creator";
    if (hasErrors) return "validator";
    if (status === "qc_passed") return "lector";
    if (status === "audit_failed") return "lector";
    if (status === "ready_to_publish") return "createPreview";
    if (status === "published") return "creator";
    return "validator";
  }, [selected, errorFindings.length]);

  const nextStepLabel = useMemo(() => {
    switch (nextStepKey) {
      case "creator":
        return t("admin.contentStudio.page.nextStepRunCreator", "Run Creator");
      case "validator":
        return t("admin.contentStudio.page.nextStepRunValidator", "Run Validator");
      case "lector":
        return t("admin.contentStudio.page.nextStepRunLector", "Run Lector");
      case "createPreview":
        return t("admin.contentStudio.page.nextStepCreatePreview", "Create preview");
      default:
        return t("admin.contentStudio.page.nextStepDefault", "Next step");
    }
  }, [nextStepKey, t]);

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

  const activeStep: StepId = useMemo(() => {
    if (!selectedDraftId || !selected?.draft) return "generate";
    if (nextStepKey === "creator") return "generate";
    if (nextStepKey === "validator" || nextStepKey === "lector") return "qa";
    if (nextStepKey === "createPreview") return "createPreview";
    return "generate";
  }, [selectedDraftId, selected?.draft, nextStepKey]);

  const activeStepIndex = useMemo(() => {
    const map: Record<StepId, number> = { generate: 0, qa: 1, createPreview: 2 };
    return map[activeStep];
  }, [activeStep]);

  const [activeInspectorStep, setActiveInspectorStep] = useState<InspectorStep>("generate");

  // Findings the author has to act on: defects only. Style suggestions and
  // info notes are shown but never gate the workflow.
  const openFindingsCount = countOpenFindings(selected?.findings ?? []);

  useEffect(() => {
    const computed: InspectorStep = (() => {
      if (!selectedDraftId || !selected?.draft) return "generate";
      if (nextStepKey === "creator") return "generate";
      if (nextStepKey === "validator" || nextStepKey === "lector") return "review";
      // Do not skip past Review while the Lector's remarks are unread: after a
      // successful audit the status alone would advance to Preview and hide them.
      if (nextStepKey === "createPreview") return openFindingsCount > 0 ? "review" : "createPreview";
      return "generate";
    })();
    setActiveInspectorStep(computed);
  }, [selectedDraftId, selected?.draft, nextStepKey, openFindingsCount]);

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

    if (!raw.trim()) {
      return {
        ok: false as const,
        error: t("admin.contentStudio.page.previewNoJson", "No unitPackage JSON available yet."),
      };
    }

    try {
      const parsed = JSON.parse(raw);
      const pkg =
        parsed && typeof parsed === "object" && (parsed as any).unitPackage
          ? (parsed as any).unitPackage
          : parsed;

      const contentEn = (pkg as any)?.content?.en;
      if (!contentEn || typeof contentEn !== "object") {
        return {
          ok: false as const,
          error: t(
            "admin.contentStudio.page.previewNotUnitPackage",
            "Preview: JSON does not look like unitPackage.v1 (missing content.en)."
          ),
        };
      }

      return { ok: true as const, pkg };
    } catch (e: any) {
      return {
        ok: false as const,
        error: t("admin.contentStudio.page.previewInvalidJson", {
          defaultValue: "Preview: invalid JSON ({{error}})",
          error: e?.message || String(e),
        }),
      };
    }
  }, [unitPackageJson, selected, t]);

  const snapshotMarkdown = useMemo(() => {
    return String((selected as any)?.snapshot?.markdownSource || "");
  }, [selectedDraftId, (selected as any)?.snapshot?._id]);

  const markdownDirty = useMemo(() => {
    if (!selectedDraftId) return false;
    return String(markdownText || "") !== snapshotMarkdown;
  }, [selectedDraftId, markdownText, snapshotMarkdown]);

  // Ping-Pong adopt gate: a section may only be adopted into the Brief once the
  // human has actually reviewed a Preview of the *current* snapshot. We treat a
  // preview as "current" when it finished (success) at or after the latest
  // snapshot was written. A plain "Save Markdown" (or a fresh Creator run)
  // writes a newer snapshot without a preview, so the gate re-closes until a new
  // preview is created — exactly the "review before adopt" workflow.
  const previewIsCurrent = useMemo(() => {
    const ps = (selected as any)?.draft?.publishState;
    const snapCreatedAt = Number((selected as any)?.snapshot?.createdAt ?? 0);
    if (!ps || ps.status !== "success" || snapCreatedAt <= 0) return false;
    const doneAt = Number(ps.completedAt ?? ps.updatedAt ?? 0);
    return doneAt >= snapCreatedAt;
  }, [selected]);

  // Short summary of the currently active Brief Version (milestone label or
  // timestamp) for the draft-list sidebar hint.
  const activeBriefVersionSummary = useMemo(() => {
    const draft = (selected as any)?.draft;
    const activeId = draft?.activeBriefVersionId;
    if (!activeId || !Array.isArray(briefVersions)) return null;
    const active = (briefVersions as any[]).find((v) => String(v._id) === String(activeId));
    if (!active) return null;
    const numbers = computeBriefVersionNumbers(briefVersions as any[]);
    // Sidebar hint: number only (no trailing milestone label) to save space.
    return formatBriefVersionId(draft?.moduleNumber, draft?.unitNumber, numbers.get(String(activeId)));
  }, [briefVersions, selected]);

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
      title: String(d.title || "").trim(),
      description: String(d.description || ""),
      moduleNumber: typeof d.moduleNumber === "number" ? String(d.moduleNumber) : "",
      unitNumber: typeof d.unitNumber === "number" ? String(d.unitNumber) : "",
      authorNoteName: String(d.authorNoteName || ""),
      authorNoteQuote: String(d.authorNoteQuote || ""),
      creatorBrief: ref.notes ? String(ref.notes) : "",
      refId: ref.referenceId ? String(ref.referenceId) : "",
      refNotes: ref.referenceNotes ? String(ref.referenceNotes) : "",
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
      moduleNumber: String(draftEditModuleNumber || "").trim(),
      unitNumber: String(draftEditUnitNumber || "").trim(),
      authorNoteName: String(draftAuthorNoteName || ""),
      authorNoteQuote: String(draftAuthorNoteQuote || ""),
      creatorBrief: String(draftCreatorBrief || "").trim(),
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
    draftEditModuleNumber,
    draftEditUnitNumber,
    draftAuthorNoteName,
    draftAuthorNoteQuote,
    draftCreatorBrief,
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

          const parsedModuleNumber = Number(draftEditModuleNumber);
          const parsedUnitNumber = Number(draftEditUnitNumber);
          const moduleNumberValid =
            Number.isInteger(parsedModuleNumber) && parsedModuleNumber > 0;
          const unitNumberValid =
            Number.isInteger(parsedUnitNumber) && parsedUnitNumber > 0;

          await updateDraftMeta({
            draftId: draftIdAtSchedule,
            title: draftEditTitle.trim() ? draftEditTitle.trim() : undefined,
            description: typeof draftEditDescription === "string" ? draftEditDescription : "",
            ...(moduleNumberValid ? { moduleNumber: parsedModuleNumber } : {}),
            ...(unitNumberValid ? { unitNumber: parsedUnitNumber } : {}),
            authorNoteName: typeof draftAuthorNoteName === "string" ? draftAuthorNoteName : "",
            authorNoteQuote: typeof draftAuthorNoteQuote === "string" ? draftAuthorNoteQuote : "",
            inspirationRef: {
              source: "reference-library",
              chapter: draftRefChapter.trim() || undefined,
              pages: draftRefPages.trim() || undefined,
              notes: draftCreatorBrief.trim() || undefined,
              referenceNotes: draftRefNotes.trim() || undefined,
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
    draftEditModuleNumber,
    draftEditUnitNumber,
    draftAuthorNoteName,
    draftAuthorNoteQuote,
    draftCreatorBrief,
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
    setCfgVocabularyBudget(String(modelConfig.vocabularyBudget ?? DEFAULT_VOCABULARY_BUDGET));
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
    setDraftRefNotes(ref.referenceNotes ? String(ref.referenceNotes) : "");
    setDraftRefChapter(ref.chapter ? String(ref.chapter) : "");
    setDraftRefPages(ref.pages ? String(ref.pages) : "");
    setDraftCreatorBrief(ref.notes ? String(ref.notes) : "");

    const ids: string[] = Array.isArray(d.specialistSkillIds) ? d.specialistSkillIds.map(String) : [];
    // Backward-compat: if an old draft used sectionSkillIds, prefill specialistSkillIds with unique IDs.
    const legacy = d.sectionSkillIds ? Object.values(d.sectionSkillIds).filter(Boolean).map(String) : [];
    const merged = Array.from(new Set([...ids, ...legacy]));
    setDraftSpecialistSkillIds(merged);
    setDraftAuditorSkillIds(Array.isArray(d.auditorSkillIds) ? d.auditorSkillIds.map(String) : []);

    setDraftEditTitle(typeof d.title === "string" ? d.title : "");
    setDraftEditDescription(typeof d.description === "string" ? d.description : "");
    setDraftEditModuleNumber(
      typeof d.moduleNumber === "number" ? String(d.moduleNumber) : ""
    );
    setDraftEditUnitNumber(
      typeof d.unitNumber === "number" ? String(d.unitNumber) : ""
    );
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
          <CardTitle>{t("admin.contentStudio.page.title", "Content Studio")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("admin.contentStudio.page.unauthorized", "Unauthorized. Superadmin required.")}</p>
        </CardContent>
      </Card>
    );
  }

  const handleSelectDraft = (id: Id<"contentDrafts">) => {
    setIsDraftCreateMode(false);
    setSelectedDraftId(id);
    // hydrate editor with latest snapshot
    const snap = drafts?.find((d: any) => d._id === id);
    void snap;
  };

  const handleNewDraft = () => {
    setPendingDraftCreate(null);
    setIsDraftCreateMode(true);
    setSelectedDraftId(null);
    setDraftCreateNonce((n) => n + 1);
    setStudioView("draftManager");
    setMobileSidebarOpen(false);
  };

  const handleCreateDraft = async (params: {
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
  }) => {
    const {
      unitNumber, moduleNumber, title, description,
      templateId: tplId, creatorBrief,
      refId, refChapter, refPages, refNotes,
      specialistSkillIds: newSpecialistIds,
      auditorSkillIds: newAuditorIds,
      authorNoteName: newAuthorNoteName,
      authorNoteQuote: newAuthorNoteQuote,
    } = params;

    const trimmedAuthorNoteName = (newAuthorNoteName || "").trim();
    const trimmedAuthorNoteQuote = (newAuthorNoteQuote || "").trim();
    const effectiveAuthorNoteName = trimmedAuthorNoteName || "Jacksenn";

    const template = tplId
      ? (draftTemplates || []).find((t: any) => String(t?._id) === String(tplId)) || null
      : null;

    const trimmedTitle = title.trim() || `Unit ${unitNumber}`;
    const trimmedBrief = (creatorBrief || "").trim();
    const trimmedRefNotes = (refNotes || "").trim();
    const trimmedChapter = (refChapter || "").trim();
    const trimmedPages = (refPages || "").trim();

    // Compose inspirationRef once (single source of truth for meta write).
    // `notes` is always the creator brief; `referenceNotes` is always the
    // reference-specific note — the two are independent and never merged.
    const composedRef = refId
      ? {
          source: "reference-library" as const,
          referenceId: refId as any,
          chapter: trimmedChapter || undefined,
          pages: trimmedPages || undefined,
          notes: trimmedBrief || undefined,
          referenceNotes: trimmedRefNotes || undefined,
        }
      : trimmedBrief
        ? { source: "creator-brief" as const, notes: trimmedBrief }
        : template?.inspirationRef
          ? { ...template.inspirationRef, source: "template" as const }
          : undefined;

    const id = template
      ? await createDraftFromTemplate({
          templateId: template._id,
          unitNumber,
          moduleNumber,
          title: trimmedTitle,
          description,
          inspirationRef: composedRef as any,
          authorNoteName: trimmedAuthorNoteName || undefined,
          authorNoteQuote: trimmedAuthorNoteQuote || undefined,
        } as any)
      : await createDraft({
          unitNumber,
          moduleNumber,
          title: trimmedTitle,
          description,
          authorNoteName: trimmedAuthorNoteName || undefined,
          authorNoteQuote: trimmedAuthorNoteQuote || undefined,
        });

    // Persist meta (non-template path)
    if (!template && composedRef) {
      await updateDraftMeta({ draftId: id, inspirationRef: composedRef });
    }

    // Persist skills
    if (newSpecialistIds?.length) {
      await setDraftSpecialistSkills({ draftId: id, skillIds: newSpecialistIds as any });
    }
    if (newAuditorIds?.length) {
      await setDraftAuditorSkills({ draftId: id, skillIds: newAuditorIds as any });
    }

    // Seed parent edit state BEFORE leaving create mode so the EditForm shows
    // exactly what the user entered while the getDraft query re-fetches.
    setDraftEditTitle(trimmedTitle);
    setDraftEditDescription(typeof description === "string" ? description : "");
    setDraftEditModuleNumber(String(moduleNumber));
    setDraftEditUnitNumber(String(unitNumber));
    setDraftRefId(refId || "");
    setDraftRefChapter(trimmedChapter);
    setDraftRefPages(trimmedPages);
    setDraftCreatorBrief(trimmedBrief);
    setDraftRefNotes(trimmedRefNotes);
    setDraftSpecialistSkillIds(newSpecialistIds ? newSpecialistIds.map(String) : []);
    setDraftAuditorSkillIds(newAuditorIds ? newAuditorIds.map(String) : []);
    setDraftAuthorNoteName(effectiveAuthorNoteName);
    setDraftAuthorNoteQuote(trimmedAuthorNoteQuote);

    setIsDraftCreateMode(false);
    setSelectedDraftId(id);
    toast.success(t("admin.contentStudio.toast.draftCreated", "Unit created"));
    return id;
  };

  const handleSaveModelConfig = async () => {
    try {
      await upsertModelConfig({
        specialist: { provider: cfgSpecialistProvider, model: cfgSpecialistModel.trim() },
        auditor: { provider: cfgAuditorProvider, model: cfgAuditorModel.trim() },
        vocabularyBudget: parseVocabularyBudget(cfgVocabularyBudget),
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

  const handleReactivateSkill = async (id: string) => {
    try {
      await reactivateSkill({ skillId: id as any });
      toast.success(t("admin.contentStudio.toast.skillReactivated", "Skill reactivated."));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.skillReactivateFailed", "Could not reactivate skill."));
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    const confirmed = window.confirm(
      t("admin.contentStudio.skills.deleteConfirm", {
        defaultValue: 'Permanently delete the skill "{{name}}"? It will be removed from all units and templates.',
        name,
      })
    );
    if (!confirmed) return;
    try {
      const res: any = await deleteSkill({ skillId: id as any });
      toast.success(
        t("admin.contentStudio.toast.skillDeleted", {
          defaultValue: "Skill deleted (removed from {{drafts}} units, {{templates}} templates).",
          drafts: res?.draftsPatched ?? 0,
          templates: res?.templatesPatched ?? 0,
        })
      );
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.skillDeleteFailed", "Could not delete skill."));
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
          throw new Error(
            t("admin.contentStudio.error.uploadFailedStatus", {
              defaultValue: "Upload failed: {{status}} {{text}}",
              status: uploadResp.status,
              text,
            })
          );
        }
        const json = (await uploadResp.json()) as { storageId?: string };
        const sid = json.storageId;
        if (!sid) throw new Error(t("admin.contentStudio.error.uploadMissingStorageId", "Upload failed: missing storageId."));
        storageId = sid;
        setNewRefStorageId(sid);
      }

      if (!url && !storageId) {
        throw new Error(
          t("admin.contentStudio.error.provideUrlOrPdf", "Provide either a URL or upload a PDF (storageId).")
        );
      }
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
      toast.error(t("admin.contentStudio.toast.selectDraftFirst", "Select a unit first"));
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
      toast.success(t("admin.contentStudio.toast.templateCreatedFromDraft", "Template created from current unit"));
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
    const brief = String(tpl?.inspirationRef?.notes || "").trim();
    setPendingDraftCreate({ templateId: String(tpl?._id || ""), creatorBrief: brief || undefined });
    setIsDraftCreateMode(true);
    setSelectedDraftId(null);
    setDraftCreateNonce((n) => n + 1);
    setStudioView("draftManager");
    setSettingsOpen(false);
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
        throw new Error(
          t("admin.contentStudio.error.uploadFailedStatus", {
            defaultValue: "Upload failed: {{status}} {{text}}",
            status: uploadResp.status,
            text,
          })
        );
      }

      const json = (await uploadResp.json()) as { storageId?: string };
      const sid = json.storageId;
      if (!sid) throw new Error(t("admin.contentStudio.error.uploadMissingStorageId", "Upload failed: missing storageId."));
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
      toast.error(t("admin.contentStudio.toast.guidelineVersionNotFound", "Guideline version not found."));
      return;
    }
    setEditRefGuidelines(String((found as any)?.guidelines || ""));
    setEditRefLoadedFromVersion(Number(version));
    toast.success(
      t("admin.contentStudio.toast.guidelineVersionLoaded", {
        defaultValue: "Loaded v{{version}} into the editor. Edit and save to create a new version.",
        version: Number(version),
      })
    );
  };

  const handleReloadCurrentGuidelinesIntoEditor = () => {
    setEditRefGuidelines(String((editRef as any)?.guidelines || ""));
    setEditRefLoadedFromVersion(null);
    toast.info(t("admin.contentStudio.toast.guidelinesCurrentLoaded", "Loaded current guidelines."));
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
      toast.success(
        t("admin.contentStudio.toast.guidelineVersionDeleted", {
          defaultValue: "Deleted v{{version}}.",
          version: params.version,
        })
      );
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.guidelineVersionDeleteFailed", "Failed to delete guideline version.")
      );
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
        throw new Error(
          t("admin.contentStudio.error.uploadFailedStatus", {
            defaultValue: "Upload failed: {{status}} {{text}}",
            status: uploadResp.status,
            text,
          })
        );
      }
      const json = (await uploadResp.json()) as { storageId?: string };
      const sid = String(json.storageId || "").trim();
      if (!sid) throw new Error(t("admin.contentStudio.error.uploadMissingStorageId", "Upload failed: missing storageId."));

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

  const handleSaveDraftSkillsAndReference = async (): Promise<boolean> => {
    if (!selectedDraftId) return false;
    try {
      await setDraftSpecialistSkills({
        draftId: selectedDraftId,
        skillIds: draftSpecialistSkillIds.map((id) => id as any),
      });
      await setDraftAuditorSkills({
        draftId: selectedDraftId,
        skillIds: draftAuditorSkillIds.map((id) => id as any),
      });

      const parsedModuleNumber = Number(draftEditModuleNumber);
      const parsedUnitNumber = Number(draftEditUnitNumber);
      const moduleNumberValid =
        Number.isInteger(parsedModuleNumber) && parsedModuleNumber > 0;
      const unitNumberValid =
        Number.isInteger(parsedUnitNumber) && parsedUnitNumber > 0;

      await updateDraftMeta({
        draftId: selectedDraftId,
        title: draftEditTitle.trim() || (selected as any)?.draft?.title || `Unit ${(selected as any)?.draft?.unitNumber ?? ""}`,
        // Allow clearing description explicitly by saving an empty string.
        description: typeof draftEditDescription === "string" ? draftEditDescription : "",
        ...(moduleNumberValid ? { moduleNumber: parsedModuleNumber } : {}),
        ...(unitNumberValid ? { unitNumber: parsedUnitNumber } : {}),
        authorNoteName: typeof draftAuthorNoteName === "string" ? draftAuthorNoteName : "",
        authorNoteQuote: typeof draftAuthorNoteQuote === "string" ? draftAuthorNoteQuote : "",
        inspirationRef: {
          source: "reference-library",
          chapter: draftRefChapter.trim() || undefined,
          pages: draftRefPages.trim() || undefined,
          notes: draftCreatorBrief.trim() || undefined,
          referenceNotes: draftRefNotes.trim() || undefined,
          referenceId: draftRefId ? (draftRefId as any) : undefined,
        },
      });

      toast.success(t("admin.contentStudio.toast.draftSettingsSaved", "Unit settings saved"));
      return true;
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.draftSettingsSaveFailed", "Failed to save unit settings"));
      return false;
    }
  };

  // Simplified authoring path: save the unit (briefing, title, description),
  // switch to the Generator so progress is visible, and run Creator ->
  // Validator -> Lector in one go.
  const handleSaveAndGenerate = async () => {
    const ok = await handleSaveDraftSkillsAndReference();
    if (!ok) return;
    setStudioView("drafts");
    await runGenerateFlow(false);
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
    if (!quoteRaw) {
      maybeApplyFounderNoteToMarkdown(name, "");
      return;
    }
    maybeApplyFounderNoteToMarkdown(name, quoteRaw);
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
      setIsDraftCreateMode(false);
      setSelectedDraftId(null);
      toast.success(t("admin.contentStudio.toast.draftDeleted", "Unit deleted"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.draftDeleteFailed", "Failed to delete unit"));
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
      toast.success(t("admin.contentStudio.toast.snapshotSaved", "Draft saved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.snapshotSaveFailed", "Failed to save draft"));
    }
  };

  const handleLoadMarkdownFromSnapshot = () => {
    const snap = selected?.snapshot as any;
    const md = String(snap?.markdownSource || "");
    if (md.trim()) {
      setMarkdownText(md);
      toast.success(t("admin.contentStudio.toast.loadedMarkdownFromSnapshot", "Loaded markdown from draft"));
      return;
    }
    toast.error(
      t(
        "admin.contentStudio.toast.noMarkdownInSnapshot",
        "No markdown found in the latest draft. Run Creator first (or save Markdown once)."
      )
    );
  };

  const handleSaveMarkdown = async () => {
    if (!selectedDraftId) return;
    try {
      const md = markdownText.trim();
      if (!md) throw new Error(t("admin.contentStudio.error.emptyMarkdown"));
      const res: any = await saveMarkdownSnapshot({ draftId: selectedDraftId, markdown: md, skipTranslation: true } as any);
      if (res?.unchanged) {
        toast.info(t("admin.contentStudio.toast.markdownUnchanged", "No changes to save. The current version and its checks remain valid."));
      } else {
        toast.success(t("admin.contentStudio.toast.markdownSnapshotSaved", "Markdown draft saved. Run Validator next."));
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.markdownSnapshotSaveFailed", "Failed to save markdown draft"));
    }
  };

  const handleCreatePreview = async () => {
    if (!selectedDraftId) return;
    setCreatingPreview(true);

    const unitNumber = Number((selected as any)?.draft?.unitNumber);

    try {
      const md = markdownText.trim();
      if (!md) throw new Error(t("admin.contentStudio.error.emptyMarkdown"));

      // Step 1: Save markdown (skipTranslation=true so the AI does not modify the manually-edited content)
      toast.info(t("admin.contentStudio.toast.savingMarkdown", "Saving markdown…"));
      await saveMarkdownSnapshot({ draftId: selectedDraftId, markdown: md, skipTranslation: true } as any);

      // Step 2: QC Validate (parses Markdown → JSON snapshot)
      toast.info(t("admin.contentStudio.toast.validatorRunning"));
      setRunningValidator(true);
      const valRes = await withAuthRetry(() => runValidate({ draftId: selectedDraftId }));
      setRunningValidator(false);
      if (!valRes.ok) {
        toast.error(
          t(
            "admin.contentStudio.toast.validationFailedBeforePreview",
            "Validation failed — fix the errors in the findings before creating a preview."
          )
        );
        return;
      }

      // Step 3: Create Preview (not live publish — that happens in Unit Manager)
      toast.info(t("admin.contentStudio.toast.creatingPreview"));
      const previewResult = await createDraftPreview({
        draftId: selectedDraftId,
        moduleId: previewModuleId && previewModuleId !== "__auto__" ? (previewModuleId as any) : undefined,
      });

      // Step 4: Mark draft as ready for Unit Manager promote
      await setDraftStatus({ draftId: selectedDraftId as any, status: "ready_to_publish" });
      let previewMsg = t("admin.contentStudio.toast.previewLive");
      const dedupCount = (previewResult as any)?.stats?.vocabDeduplicated ?? 0;
      if (dedupCount > 0) {
        previewMsg += ` | ${t("admin.contentStudio.toast.duplicatesAutoRemoved", {
          defaultValue: "{{n}} duplicate(s) auto-removed.",
          n: dedupCount,
        })}`;
      }
      toast.success(previewMsg);

      // Step 5: Open unit page only after successful preview push
      if (Number.isFinite(unitNumber) && unitNumber > 0) {
        window.open(`/unit/${unitNumber}`, "_blank");
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.saveAndPreviewFailed", "Save & create preview failed."));
    } finally {
      setCreatingPreview(false);
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




  const handleLoadFromSnapshot = () => {
    const snap = selected?.snapshot as any;
    if (snap?.unitPackageJson) {
      setUnitPackageJson(String(snap.unitPackageJson));
      toast.success(t("admin.contentStudio.toast.loadedSnapshot", "Loaded draft into editor"));
      return;
    }
    const lastRun = (selected as any)?.aiRuns?.[0];
    if (lastRun?.status === "failed" && lastRun?.error) {
      toast.error(
        t("admin.contentStudio.toast.noSnapshotLastRunFailed", {
          defaultValue: "No draft yet. Last run failed: {{error}}",
          error: String(lastRun.error).slice(0, 180),
        })
      );
    } else {
      toast.error(
        t(
          "admin.contentStudio.toast.noSnapshotRunCreator",
          "No draft yet. Run Creator first (and check errors if it fails)."
        )
      );
    }
  };

  const runSpecialistFlow = async (force: boolean) => {
    if (!selectedDraftId) return;
    setRunningCreator(true);
    setProgressPercent(25);
    setProgressMessage(t("admin.contentStudio.page.progressCreatorMarkdown", "Creator: generating markdown…"));
    try {
      toast.info(t("admin.contentStudio.toast.creatorRunning"));
      const res: any = await runSpecialist({ draftId: selectedDraftId, confirmOverwrite: force } as any);
      if (res?.needsConfirm) {
        setCreatorOverwriteConfirm({ mode: "single", reason: String(res.reason || "existing_snapshot") });
        return;
      }
      toast.success(t("admin.contentStudio.toast.creatorGenerated"));
      setProgressPercent(40);
      setProgressMessage(t("admin.contentStudio.page.progressCreatorFinished", "Creator finished."));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.creatorFailed"));
    }
    finally {
      setRunningCreator(false);
    }
  };

  const handleRunSpecialist = async () => {
    await runSpecialistFlow(false);
  };

  const handleRunValidate = async () => {
    if (!selectedDraftId) return;
    setRunningValidator(true);
    setProgressPercent(60);
    setProgressMessage(t("admin.contentStudio.page.progressValidatorChecking", "Validator: checking structure…"));
    try {
      toast.info(t("admin.contentStudio.toast.validatorRunning"));
      const res = await runValidate({ draftId: selectedDraftId });
      if (res.ok) toast.success(t("admin.contentStudio.toast.validatorPassed"));
      else toast.error(t("admin.contentStudio.toast.validatorFailedSeeFindings"));
      setProgressPercent(res?.ok ? 80 : 70);
      setProgressMessage(
        res?.ok
          ? t("admin.contentStudio.page.progressValidatorPassed", "Validator passed.")
          : t("admin.contentStudio.page.progressValidatorFailed", "Validator failed.")
      );
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.validatorFailed"));
    }
    finally {
      setRunningValidator(false);
    }
  };

  const runGenerateFlow = async (force: boolean, draftIdOverride?: string) => {
    const targetDraftId = (draftIdOverride ?? selectedDraftId) as any;
    if (!targetDraftId) return;
    setRunningCreateValidate(true);
    try {
      // Step 1: Creator
      toast.info(t("admin.contentStudio.toast.creatingContent"));
      setProgressPercent(10);
      setProgressMessage(t("admin.contentStudio.page.progressCreatorContent", "Creator: generating content…"));
      const specRes: any = await runSpecialist({ draftId: targetDraftId, confirmOverwrite: force } as any);
      if (specRes?.needsConfirm) {
        setCreatorOverwriteConfirm({ mode: "generate", reason: String(specRes.reason || "existing_snapshot") });
        return;
      }
      
      // Step 2: Validator (includes auto-fix)
      toast.info(t("admin.contentStudio.toast.validating"));
      setProgressPercent(60);
      setProgressMessage(t("admin.contentStudio.page.progressValidatorAutofix", "Validator: validating + autofix…"));
      const valRes = await withAuthRetry(() => runValidate({ draftId: targetDraftId }));
      
      let validatorOk = Boolean(valRes?.ok);

      // Step 2b: Auto-Recovery for truncated Grammar. A cut-off Grammar
      // section is a generation accident, not a content defect: regenerate
      // the section instead of asking the Fix stage to patch a fragment.
      if (!validatorOk && (valRes.report as any)?.deepIssues) {
        const issues = (valRes.report as any).deepIssues || [];
        const hasTruncatedGrammar = issues.some((i: any) => 
          i.message?.includes("Grammar section appears truncated") ||
          i.message?.includes("Grammar section appears to be cut off")
        );
        
        if (hasTruncatedGrammar) {
          toast.info(t("admin.contentStudio.toast.autoFixingGrammar"));
          setProgressPercent(62);
          setProgressMessage(
            t("admin.contentStudio.page.progressAutofixGrammar", "Auto-fix: regenerating Grammar section…")
          );
          await runSectionRevise({
            draftId: targetDraftId,
            sectionId: "grammar",
            instruction: "Complete the Grammar section with proper subsections (###) and detailed examples. Include at least 3 examples with Serbian + English translations for each grammar concept."
          });
          
          toast.info(t("admin.contentStudio.toast.revalidatingAfterFix"));
          setProgressPercent(64);
          setProgressMessage(
            t("admin.contentStudio.page.progressRevalidating", "Validator: re-validating after fix…")
          );
          const revalidateRes = await withAuthRetry(() => runValidate({ draftId: targetDraftId }));
          validatorOk = Boolean(revalidateRes?.ok);
        }
      }

      // Step 3: review loop (Validator -> Lector -> Fix, up to three rounds).
      // Remaining validator defects go to the Fix stage inside the loop, so
      // the author only sees what three rounds could not resolve.
      const clean = await runReviewCycle(targetDraftId, { validatorOk, progressFrom: 65 });
      if (clean) {
        setProgressMessage(t("admin.contentStudio.page.progressDoneReadyPreview", "Done. Ready for preview."));
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.generationFailed"));
      setProgressPercent(0);
      setProgressMessage(t("admin.contentStudio.page.progressGenerationFailed", "Generation failed."));
    } finally {
      setRunningCreateValidate(false);
    }
  };

  const handleGenerate = async () => {
    await runGenerateFlow(false);
  };

  // Confirm handler for the overwrite guardrail dialog: re-runs the requested
  // flow with confirmOverwrite=true so the curated snapshot is intentionally rebuilt.
  const confirmCreatorOverwrite = async () => {
    const pending = creatorOverwriteConfirm;
    setCreatorOverwriteConfirm(null);
    if (!pending) return;
    if (pending.mode === "single") await runSpecialistFlow(true);
    else await runGenerateFlow(true);
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

  /**
   * Chained actions (revise -> validate -> lector) can hit the moment where the
   * Clerk token has expired and the refreshed one is not attached yet; the
   * server then sees no identity and answers "Unauthorized". Wait briefly for
   * the refresh and retry once. Authorization is still enforced server-side.
   */
  const withAuthRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e: any) {
      if (!/unauthorized/i.test(String(e?.message ?? e))) throw e;
      await new Promise((r) => setTimeout(r, 1500));
      return await fn();
    }
  };

  /**
   * Automatic review cycle: Lector -> Fix -> Validator -> Lector, at most
   * three rounds. Stops as soon as no objective findings remain, or when a
   * round makes no progress (same or higher count), so it never chases the
   * endless stream of style suggestions.
   */
  /**
   * Validator -> Lector -> Fix loop, up to MAX_ROUNDS. Each round starts with
   * the deterministic Validator (cheap, catches parser/clitic/coverage
   * defects), then the Lector. Anything objective that is still open goes to
   * the Fix stage and the next round re-validates. Returns true when the unit
   * ended clean. Shared by "Review until clean" and by the generate flow, so
   * the author sees only what three rounds could not resolve.
   */
  const runReviewCycle = async (
    draftId: string,
    initial?: { validatorOk: boolean; progressFrom?: number },
  ): Promise<boolean> => {
    // Two separate budgets. Validator repairs (deterministic defects such as
    // coverage gaps right after the Creator) must not eat the Lector's rounds:
    // on 2026-09-17 two validator-fix rounds left the Lector a single round,
    // so its one blocker ended the cycle unfixed.
    const MAX_LECTOR_ROUNDS = 3;
    const MAX_VALIDATOR_REPAIRS = 3;
    const base = initial?.progressFrom ?? 10;
    const span = 100 - base;
    const pct = (round: number, step: number) =>
      Math.min(99, Math.round(base + (span * ((round - 1) + step)) / MAX_LECTOR_ROUNDS));

    const countObjective = (report: any): number => {
      const audit = report?.audit ?? report;
      const list = [...(audit?.blockers ?? []), ...(audit?.warnings ?? [])];
      return list.filter((f: any) =>
        (OBJECTIVE_FINDING_CODES as readonly string[]).includes(String(f?.code ?? "")),
      ).length;
    };
    const fix = async (round: number, n: number) => {
      setProgressMessage(
        t("admin.contentStudio.page.progressCycleFix", {
          defaultValue: "Round {{round}}/{{max}}: fixing {{n}} finding(s)…",
          round,
          max: MAX_LECTOR_ROUNDS,
          n,
        }),
      );
      setProgressPercent(pct(round, 0.66));
      await withAuthRetry(() =>
        runRevise({
          draftId,
          preferredProvider: cfgSpecialistProvider,
          maxTokens: 12000,
          objectiveFindingsOnly: true,
        }),
      );
    };

    let previousCount = Number.POSITIVE_INFINITY;
    let validatorOk: boolean | undefined = initial?.validatorOk;
    let validatorRepairs = 0;
    let lectorRound = 0;

    for (;;) {
      if (validatorOk === undefined) {
        setProgressMessage(
          t("admin.contentStudio.page.progressCycleValidate", {
            defaultValue: "Round {{round}}/{{max}}: validating…",
            round: Math.max(1, lectorRound),
            max: MAX_LECTOR_ROUNDS,
          }),
        );
        setProgressPercent(pct(Math.max(1, lectorRound), 0));
        const valRes: any = await withAuthRetry(() => runValidate({ draftId }));
        validatorOk = Boolean(valRes?.ok);
      }

      if (!validatorOk) {
        // Deterministic defects first; the Lector would only repeat them.
        if (validatorRepairs >= MAX_VALIDATOR_REPAIRS) {
          toast.error(t("admin.contentStudio.toast.cycleValidatorFailed", "Stopped: the validator failed after the fix. Please look at the findings."));
          return false;
        }
        validatorRepairs += 1;
        await fix(Math.max(1, lectorRound), countOpenFindings(selected?.findings as any));
        validatorOk = undefined;
        continue;
      }

      if (lectorRound >= MAX_LECTOR_ROUNDS) {
        toast.warning(
          t("admin.contentStudio.toast.cycleMaxRounds", {
            defaultValue: "Stopped after {{max}} rounds, {{n}} finding(s) left.",
            max: MAX_LECTOR_ROUNDS,
            n: previousCount === Number.POSITIVE_INFINITY ? 0 : previousCount,
          }),
        );
        return false;
      }
      lectorRound += 1;

      setProgressMessage(
        t("admin.contentStudio.page.progressCycleLector", {
          defaultValue: "Round {{round}}/{{max}}: Lector reviewing…",
          round: lectorRound,
          max: MAX_LECTOR_ROUNDS,
        }),
      );
      setProgressPercent(pct(lectorRound, 0.33));
      const audit: any = await withAuthRetry(() => runAuditor({ draftId }));
      const open = countObjective(audit?.report);

      if (open === 0) {
        toast.success(t("admin.contentStudio.toast.cycleClean", "No defects left. Style suggestions, if any, are advisory."));
        setProgressPercent(100);
        setProgressMessage(t("admin.contentStudio.page.progressCycleDone", "Review finished."));
        return true;
      }
      if (open >= previousCount) {
        toast.warning(
          t("admin.contentStudio.toast.cycleNoProgress", {
            defaultValue: "Stopped: the last round did not reduce the findings ({{n}} left). Please look at them yourself.",
            n: open,
          }),
        );
        return false;
      }
      previousCount = open;

      if (lectorRound >= MAX_LECTOR_ROUNDS) {
        toast.warning(
          t("admin.contentStudio.toast.cycleMaxRounds", {
            defaultValue: "Stopped after {{max}} rounds, {{n}} finding(s) left.",
            max: MAX_LECTOR_ROUNDS,
            n: open,
          }),
        );
        return false;
      }

      await fix(lectorRound, open);
      validatorOk = undefined;
    }
  };

  const handleReviewUntilClean = async () => {
    if (!selectedDraftId) return;
    setRunningReviewCycle(true);
    setProgressPercent(10);
    try {
      await runReviewCycle(selectedDraftId);
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.cycleFailed", "Automatic review failed."));
    } finally {
      setRunningReviewCycle(false);
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
    setProgressMessage(t("admin.contentStudio.page.progressApplyingSectionChanges", "Applying section changes…"));
    try {
      const sectionLabel = sectionLabelOf(expandSection);
      toast.info(t("admin.contentStudio.toast.applyingChanges", { section: sectionLabel }));
      const res = await runSectionRevise({
        draftId: selectedDraftId,
        sectionId: expandSection,
        instruction: expandInstruction.trim(),
      });
      if (res?.ok) {
        toast.success(
          (res as any)?.adoptedIntoBriefing
            ? t("admin.contentStudio.toast.sectionUpdatedAndAdopted", {
                defaultValue: "{{section}} updated and adopted into the Briefing.",
                section: sectionLabel,
              })
            : t("admin.contentStudio.toast.sectionUpdated", { section: sectionLabel }),
        );
        setExpandInstruction(""); // Clear after success
        setProgressPercent(80);
        setProgressMessage(t("admin.contentStudio.page.progressSectionUpdatedValidating", "Section updated. Validating…"));

        // Validator runs as a separate action so the section revise call can return
        // before the client WebSocket times out (see runSectionRevise).
        setRunningSectionRevise(false);
        setRunningValidator(true);
        try {
          toast.info(t("admin.contentStudio.toast.validating"));
          const valRes = await withAuthRetry(() => runValidate({ draftId: selectedDraftId }));
          if (valRes?.ok) {
            toast.success(t("admin.contentStudio.toast.validatorPassed"));
            setProgressPercent(100);
            setProgressMessage(
              t("admin.contentStudio.page.progressSectionUpdatedValidated", "Section updated and validated.")
            );
          } else {
            toast.warning(t("admin.contentStudio.toast.validatorFailedSeeFindings"));
            setProgressPercent(90);
            setProgressMessage(
              t("admin.contentStudio.page.progressSectionUpdatedIssues", "Section updated; validation found issues.")
            );
          }
        } catch (valErr: any) {
          toast.error(valErr?.message || t("admin.contentStudio.toast.validatorFailed"));
          setProgressPercent(85);
          setProgressMessage(
            t("admin.contentStudio.page.progressSectionUpdatedValidationError", "Section updated; validation failed to run.")
          );
        } finally {
          setRunningValidator(false);
        }
      } else {
        toast.error(t("admin.contentStudio.toast.changesFailed"));
        setProgressPercent(0);
        setProgressMessage(t("admin.contentStudio.page.progressSectionUpdateFailed", "Section update failed."));
      }
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.sectionReviseFailed"));
      setProgressPercent(0);
      setProgressMessage(t("admin.contentStudio.page.progressSectionUpdateFailed", "Section update failed."));
    } finally {
      setRunningSectionRevise(false);
    }
  };

  // Ping-Pong: Brief <-> Markdown — adopt ALL pending (revised-but-not-yet-
  // adopted) sections into the Brief in one step, creating a single new Brief
  // Version. Deliberately manual/explicit: never triggered automatically by
  // Section-Revise or Markdown edits.
  const handleAdoptChanges = async () => {
    if (!selectedDraftId) return;
    setAdoptingChanges(true);
    try {
      const res = await adoptSectionsIntoBrief({ draftId: selectedDraftId });
      const labels = (res?.adoptedSections ?? [])
        .map((s: SectionId) => sectionLabelOf(s))
        .join(", ");
      toast.success(
        t("admin.contentStudio.toast.changesAdopted", {
          defaultValue:
            "Changes adopted into the briefing ({{sections}}). A future full regeneration will build upon them.",
          sections: labels,
        })
      );
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.sectionAdoptFailed", "Failed to adopt section into the briefing")
      );
    } finally {
      setAdoptingChanges(false);
    }
  };

  // Ping-Pong: Brief <-> Markdown — refuse a single pending Section-Revise by
  // reverting that section's Markdown to the version it had immediately
  // before the revise (one step back, never the whole history). Never
  // touches the Brief. Destructive to the Section-Revise's output, so it
  // requires confirmation via the AlertDialog below before running.
  const handleRefuseChanges = (section: SectionId) => {
    setRefuseSectionConfirm(section);
  };

  const confirmRefuseSection = async () => {
    const section = refuseSectionConfirm;
    if (!selectedDraftId || !section) return;
    setRefusingSection(section);
    try {
      await refuseSectionRevisionMutation({ draftId: selectedDraftId, section });
      const label = sectionLabelOf(section);
      toast.success(
        t("admin.contentStudio.toast.sectionRefused", {
          defaultValue: '"{{section}}" reverted to its previous version. The briefing was not changed.',
          section: label,
        })
      );
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.sectionRefuseFailed"));
    } finally {
      setRefusingSection(null);
      setRefuseSectionConfirm(null);
    }
  };

  const handleSelectBriefVersion = async (versionId: string) => {
    if (!selectedDraftId) return;
    setBriefVersionBusy(true);
    try {
      await selectBriefVersionMutation({ draftId: selectedDraftId, versionId: versionId as any });
      toast.success(t("admin.contentStudio.toast.briefVersionSelected", "Briefing version selected as status quo"));
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.briefVersionSelectFailed", "Failed to select briefing version")
      );
    } finally {
      setBriefVersionBusy(false);
    }
  };

  const handleSaveBriefMilestone = async (label: string) => {
    if (!selectedDraftId) return;
    setBriefVersionBusy(true);
    try {
      await saveBriefVersionMutation({ draftId: selectedDraftId, label: label || undefined });
      toast.success(t("admin.contentStudio.toast.briefVersionSaved", "Briefing version saved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.briefVersionSaveFailed", "Failed to save briefing version"));
    } finally {
      setBriefVersionBusy(false);
    }
  };

  const handleRenameBriefVersion = async (versionId: string, label: string) => {
    try {
      await nameBriefVersionMutation({ versionId: versionId as any, label });
      toast.success(t("admin.contentStudio.toast.briefVersionRenamed", "Briefing version renamed"));
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.briefVersionRenameFailed", "Failed to rename briefing version")
      );
    }
  };

  const handleDeleteBriefVersion = async (versionId: string) => {
    setBriefVersionBusy(true);
    try {
      await deleteBriefVersionMutation({ versionId: versionId as any });
      toast.success(t("admin.contentStudio.toast.briefVersionDeleted", "Briefing version deleted"));
    } catch (e: any) {
      toast.error(
        e?.message || t("admin.contentStudio.toast.briefVersionDeleteFailed", "Failed to delete briefing version")
      );
    } finally {
      setBriefVersionBusy(false);
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
      // deleteUnitFull only starts the (async, batched) deletion job — a full
      // deletion can touch thousands of rows and does not fit in a single
      // Convex function execution. Live progress can be checked in the Unit
      // Manager's Danger Zone (getUnitDeletionJob).
      await deleteUnitFull({ unitNumber: unitNum, confirm: deleteConfirmation });
      toast.info(t("admin.contentStudio.toast.unitDeletionStarted", { unit: unitNum }));
      setDeleteUnitOpen(false);
      setSelectedDraftId(null);
    } catch (e: any) {
      toast.error(e.message || t("admin.contentStudio.toast.unitDeleteFailed"));
    }
  };

  const handleTranslatePublishedToGerman = async () => {
    if (!selected) return;
    const unitNum = selected.draft.unitNumber;
    const expected = `TRANSLATE UNIT ${unitNum} SR TO DE`;
    if (translateDeConfirmation !== expected) {
      toast.error(t("admin.contentStudio.toast.confirmationTextMismatch"));
      return;
    }

    setRunningTranslateDe(true);
    try {
      toast.info(
        t("admin.contentStudio.toast.translatingUnitToDe", {
          defaultValue: "Translating Unit {{unit}} (SR → DE preview)…",
          unit: unitNum,
        })
      );
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
          t("admin.contentStudio.toast.dePreviewCreatedStats", {
            defaultValue: "DE preview created{{version}}. Content: {{content}}, Tests: {{tests}}, Vocabulary: {{vocab}}.",
            version: previewV ? ` (v${previewV})` : "",
            content: info.contentInserted ?? 0,
            tests: info.testsInserted ?? 0,
            vocab: info.vocabInserted ?? 0,
          })
        );
      } else if (info?.contentUpserted != null || info?.testsUpserted != null || info?.vocabPatched != null) {
        toast.success(
          t("admin.contentStudio.toast.dePreviewCreatedStats", {
            defaultValue: "DE preview created{{version}}. Content: {{content}}, Tests: {{tests}}, Vocabulary: {{vocab}}.",
            version: previewV ? ` (v${previewV})` : "",
            content: info.contentUpserted ?? 0,
            tests: info.testsUpserted ?? 0,
            vocab: info.vocabPatched ?? 0,
          })
        );
      } else {
        toast.success(
          t("admin.contentStudio.toast.dePreviewCreatedForUnit", {
            defaultValue: "DE preview created for Unit {{unit}}{{version}}.",
            unit: unitNum,
            version: previewV ? ` (v${previewV})` : "",
          })
        );
      }
      showVerifierToast(res);
      offerCognateAcceptFromResult(res);
      window.open(`/unit/${unitNum}?lang=de`, "_blank", "noopener,noreferrer");
      setTranslateDeOpen(false);
      setRecentlyTranslatedUnits((prev) => new Map<number, number>(prev).set(unitNum, Date.now()));
    } catch (e: any) {
      const message = String(e?.message || e || "");
      const terms = parseUntranslatedPromptGuardFailures(message);
      if (terms.length > 0) {
        offerCognateAccept(terms, message);
      } else {
        toast.error(message || t("admin.contentStudio.toast.translationFailed", "Translation failed."));
      }
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handleTranslateAnyUnitToGerman = async () => {
    const unitNum = translateAnyUnitNumberParsed;
    if (!unitNum) {
      toast.error(t("admin.contentStudio.toast.selectValidUnit", "Please select a valid unit."));
      return;
    }
    const expected = `TRANSLATE UNIT ${unitNum} SR TO DE`;
    if (translateAnyConfirmation !== expected) {
      toast.error(t("admin.contentStudio.toast.confirmationTextMismatch"));
      return;
    }

    setRunningTranslateDe(true);
    try {
      toast.info(
        t("admin.contentStudio.toast.translatingUnitToDe", {
          defaultValue: "Translating Unit {{unit}} (SR → DE preview)…",
          unit: unitNum,
        })
      );
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
          t("admin.contentStudio.toast.dePreviewCreatedStats", {
            defaultValue: "DE preview created{{version}}. Content: {{content}}, Tests: {{tests}}, Vocabulary: {{vocab}}.",
            version: previewV ? ` (v${previewV})` : "",
            content: info.contentInserted ?? 0,
            tests: info.testsInserted ?? 0,
            vocab: info.vocabInserted ?? 0,
          })
        );
      } else if (info?.contentUpserted != null || info?.testsUpserted != null || info?.vocabPatched != null) {
        toast.success(
          t("admin.contentStudio.toast.dePreviewCreatedStats", {
            defaultValue: "DE preview created{{version}}. Content: {{content}}, Tests: {{tests}}, Vocabulary: {{vocab}}.",
            version: previewV ? ` (v${previewV})` : "",
            content: info.contentUpserted ?? 0,
            tests: info.testsUpserted ?? 0,
            vocab: info.vocabPatched ?? 0,
          })
        );
      } else {
        toast.success(
          t("admin.contentStudio.toast.dePreviewCreatedForUnit", {
            defaultValue: "DE preview created for Unit {{unit}}{{version}}.",
            unit: unitNum,
            version: previewV ? ` (v${previewV})` : "",
          })
        );
      }
      showVerifierToast(res);
      offerCognateAcceptFromResult(res);
      setTranslateDeResult({
        unitNumber: unitNum,
        previewVersion: typeof previewV === "number" ? previewV : null,
        timestamp: Date.now(),
        info,
      });
      setTranslateAnyOpen(false);
      setRecentlyTranslatedUnits((prev) => new Map<number, number>(prev).set(unitNum, Date.now()));
    } catch (e: any) {
      const message = String(e?.message || e || "");
      const terms = parseUntranslatedPromptGuardFailures(message);
      if (terms.length > 0) {
        offerCognateAccept(terms, message);
      } else {
        toast.error(message || t("admin.contentStudio.toast.translationFailed", "Translation failed."));
      }
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handlePublishDeTranslationLive = async () => {
    if (!translateDeResult) return;
    const unitNum = translateDeResult.unitNumber;
    const expected = `TRANSLATE UNIT ${unitNum} SR TO DE`;
    setRunningTranslateDe(true);
    try {
      toast.info(
        t("admin.contentStudio.toast.publishingDeTranslation", {
          defaultValue: "Publishing DE translation for Unit {{unit}} live…",
          unit: unitNum,
        })
      );
      // First take preview offline (clean up preview rows)
      await takeUnitPreviewOfflineByUnitNumber({ unitNumber: unitNum } as any);
      // Then write as published
      const publishRes = await translatePublishedUnitEnToDe({
        unitNumber: unitNum,
        confirm: expected,
        preferredProvider: cfgSpecialistProvider,
        targetReleaseStatus: "published",
      } as any);
      toast.success(
        t("admin.contentStudio.toast.deTranslationPublished", {
          defaultValue: "DE translation for Unit {{unit}} published live.",
          unit: unitNum,
        })
      );
      showVerifierToast(publishRes);
      offerCognateAcceptFromResult(publishRes);
      setTranslateDeResult(null);
    } catch (e: any) {
      const message = String(e?.message || e || "");
      const terms = parseUntranslatedPromptGuardFailures(message);
      if (terms.length > 0) {
        offerCognateAccept(terms, message);
      } else {
        toast.error(message || t("admin.contentStudio.toast.translationFailed", "Translation failed."));
      }
    } finally {
      setRunningTranslateDe(false);
    }
  };

  const handleTakeUnitPreviewOfflineForAny = async () => {
    const unitNum = translateAnyUnitNumberParsed;
    if (!unitNum) {
      toast.error(t("admin.contentStudio.toast.selectValidUnit", "Please select a valid unit."));
      return;
    }
    setCreatingPreview(true);
    try {
      toast.info(
        t("admin.contentStudio.toast.takingPreviewOfflineForUnit", {
          defaultValue: "Taking preview offline for Unit {{unit}}…",
          unit: unitNum,
        })
      );
      await takeUnitPreviewOfflineByUnitNumber({ unitNumber: unitNum } as any);
      toast.success(
        t("admin.contentStudio.toast.previewTakenOfflineForUnit", {
          defaultValue: "Preview taken offline for Unit {{unit}}.",
          unit: unitNum,
        })
      );
    } catch (e: any) {
      toast.error(
        e?.message ||
          t("admin.contentStudio.toast.previewOfflineFailedForUnit", {
            defaultValue: "Failed to take preview offline for Unit {{unit}}.",
            unit: unitNum,
          })
      );
    } finally {
      setCreatingPreview(false);
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
        cfgVocabularyBudget={cfgVocabularyBudget}
        setCfgVocabularyBudget={setCfgVocabularyBudget}
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
        inactiveStageSkills={inactiveStageSkills}
        onReactivateSkill={handleReactivateSkill}
        onDeleteSkill={handleDeleteSkill}
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
          <h1 className="text-2xl font-bold leading-tight">{t("admin.contentStudio.page.title", "Content Studio")}</h1>
          <div className="text-sm text-muted-foreground">
            {studioView === "draftManager"
              ? t(
                  "admin.contentStudio.page.subtitleUnits",
                  "Create and configure units (house style, reference, briefing)"
                )
              : studioView === "drafts"
                ? t("admin.contentStudio.page.subtitleGenerator", "Generate \u2192 QA \u2192 Preview \u2192 Publish")
                : studioView === "modules"
                  ? t("admin.contentStudio.page.subtitleModules", "Create, edit and translate course modules")
                  : studioView === "audioFiles"
                  ? t("admin.contentStudio.page.subtitleAudioFiles", "Manage audio files across modules and units")
                  : studioView === "validatorMemory"
                  ? t(
                      "admin.contentStudio.page.subtitleValidatorMemory",
                      "Validator memory: curated lessons from resolved findings"
                    )
                  : t("admin.contentStudio.page.subtitleUnitManager", "Manage all units across languages")}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border bg-muted p-0.5">
            <Button
              variant={studioView === "draftManager" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("draftManager")}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabUnits", "Units in progress")}
            </Button>
            <Button
              variant={studioView === "drafts" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("drafts")}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabGenerator", "Generator")}
            </Button>
            <Button
              variant={studioView === "modules" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("modules")}
            >
              <FolderTree className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabModules", "Modules")}
            </Button>
            <Button
              variant={studioView === "units" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("units")}
            >
              <LayoutList className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabUnitManager", "Unit manager")}
            </Button>
            <Button
              variant={studioView === "audioFiles" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("audioFiles")}
            >
              <Volume2 className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabAudioFiles", "Audio files")}
            </Button>
            <Button
              variant={studioView === "validatorMemory" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStudioView("validatorMemory")}
            >
              <Brain className="mr-1.5 h-3.5 w-3.5" />
              {t("admin.contentStudio.page.tabValidatorMemory", "Validator memory")}
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            {t("admin.contentStudio.page.settings", "Settings")}
          </Button>
        </div>
      </div>

      {/* Modules view */}
      {studioView === "modules" && <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t("admin.contentStudio.page.loading", "Loading...")}</div>}><LazyModulesTab /></Suspense>}

      {/* Unit Manager view */}
      {studioView === "units" && (
        <UnitManagerTab
          recentlyTranslatedUnits={recentlyTranslatedUnits}
          onTranslationComplete={(unitNumber) =>
            setRecentlyTranslatedUnits((prev) => new Map(prev).set(unitNumber, Date.now()))
          }
        />
      )}

      {/* Audio Files view */}
      {studioView === "audioFiles" && <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t("admin.contentStudio.page.loading", "Loading...")}</div>}><LazyAudioFilesTab /></Suspense>}

      {/* Validator Memory view */}
      {studioView === "validatorMemory" && <Suspense fallback={<div className="p-8 text-center text-muted-foreground">{t("admin.contentStudio.page.loading", "Loading...")}</div>}><LazyValidatorMemoryPanel /></Suspense>}

      {/* Draft Manager view */}
      {studioView === "draftManager" && (() => {
        const draftListContent = (
          <DraftList
            drafts={drafts}
            filteredDrafts={filteredDrafts}
            selectedDraftId={selectedDraftId}
            isCreateMode={isDraftCreateMode}
            onSelectDraft={(id) => { handleSelectDraft(id); setMobileSidebarOpen(false); }}
            onNewDraft={handleNewDraft}
            draftsSearch={draftsSearch}
            setDraftsSearch={setDraftsSearch}
            draftsStatusFilter={draftsStatusFilter}
            setDraftsStatusFilter={setDraftsStatusFilter}
            onDeleteDraft={async (draftId) => {
              await deleteDraft({ draftId: draftId as any });
              if (selectedDraftId === draftId) { setIsDraftCreateMode(false); setSelectedDraftId(null); }
              toast.success(t("admin.contentStudio.toast.draftDeleted", "Unit deleted"));
            }}
            activeBriefVersionSummary={activeBriefVersionSummary}
          />
        );

        const editPanelContent = (
          <DraftEditPanel
            selectedDraftId={selectedDraftId ? String(selectedDraftId) : null}
            isCreateMode={isDraftCreateMode}
            createFormKey={draftCreateNonce}
            onOpenInGenerator={() => setStudioView("drafts")}
            draftTemplates={draftTemplates}
            initialCreate={pendingDraftCreate ?? undefined}
            onCreateDraft={async (params) => {
              try {
                const { generateAfterCreate, ...createParams } = params;
                const id = await handleCreateDraft(createParams);
                setPendingDraftCreate(null);
                if (generateAfterCreate && id) {
                  setStudioView("drafts");
                  await runGenerateFlow(false, String(id));
                }
              } catch (e: any) {
                toast.error(e?.message || t("admin.contentStudio.toast.draftCreateFailed", "Failed to create unit"));
              }
            }}
            selected={selected}
            isBusy={isBusy}
            draftEditTitle={draftEditTitle}
            setDraftEditTitle={setDraftEditTitle}
            draftEditDescription={draftEditDescription}
            setDraftEditDescription={setDraftEditDescription}
            draftEditModuleNumber={draftEditModuleNumber}
            setDraftEditModuleNumber={setDraftEditModuleNumber}
            draftEditUnitNumber={draftEditUnitNumber}
            setDraftEditUnitNumber={setDraftEditUnitNumber}
            draftCreatorBrief={draftCreatorBrief}
            setDraftCreatorBrief={setDraftCreatorBrief}
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
            onSaveDraftSkillsAndReference={() => { void handleSaveDraftSkillsAndReference(); }}
            onSaveAndGenerate={handleSaveAndGenerate}
            pendingSectionRevisions={pendingSectionRevisions ?? []}
            onAdoptPendingSections={handleAdoptChanges}
            adoptingPendingSections={adoptingChanges}
            hasUnsavedChanges={hasUnsavedChanges}
            metaAutosaveStatus={metaAutosaveStatus}
            metaAutosavedAt={metaAutosavedAt}
            briefVersions={briefVersions}
            briefVersionBusy={briefVersionBusy}
            onSelectBriefVersion={handleSelectBriefVersion}
            onSaveBriefMilestone={handleSaveBriefMilestone}
            onRenameBriefVersion={handleRenameBriefVersion}
            onDeleteBriefVersion={handleDeleteBriefVersion}
          />
        );

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

            {/* Zone 1: Sidebar (desktop only) */}
            <div className="hidden lg:flex w-[260px] shrink-0 border-r flex-col overflow-hidden">
              {draftListContent}
            </div>

            {/* Zone 2: Draft Edit Panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {editPanelContent}
            </div>
          </div>
        );
      })()}

      {/* Generator (Draft Studio) view */}
      {studioView === "drafts" && (() => {
        const draftListContent = (
          <DraftList
            drafts={drafts}
            filteredDrafts={filteredDrafts}
            selectedDraftId={selectedDraftId}
            isCreateMode={isDraftCreateMode}
            onSelectDraft={(id) => { handleSelectDraft(id); setMobileSidebarOpen(false); }}
            onNewDraft={handleNewDraft}
            draftsSearch={draftsSearch}
            setDraftsSearch={setDraftsSearch}
            draftsStatusFilter={draftsStatusFilter}
            setDraftsStatusFilter={setDraftsStatusFilter}
            onDeleteDraft={async (draftId) => {
              await deleteDraft({ draftId: draftId as any });
              if (selectedDraftId === draftId) { setIsDraftCreateMode(false); setSelectedDraftId(null); }
              toast.success(t("admin.contentStudio.toast.draftDeleted", "Unit deleted"));
            }}
            activeBriefVersionSummary={activeBriefVersionSummary}
          />
        );

        const inspectorContent = selectedDraftId && selected?.draft ? (
          <InspectorPanel
            activeStep={activeInspectorStep}
            selected={selected}
            selectedDraftId={selectedDraftId}
            isBusy={isBusy}
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
            runningReviewCycle={runningReviewCycle}
            onReviewUntilClean={handleReviewUntilClean}
            onRunRevise={handleRunRevise}
            onRunAuditor={handleRunAuditor}
            onSectionRevise={handleSectionRevise}
            onDismissFinding={(p) => dismissFinding({ findingId: p.findingId, dismissed: p.dismissed })}
            previewModuleId={previewModuleId}
            setPreviewModuleId={setPreviewModuleId}
            modules={modules}
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
                <span>{t("admin.contentStudio.page.selectUnitHint", "Select a unit from the sidebar to start generating.")}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStudioView("draftManager")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("admin.contentStudio.page.goToUnits", "Go to units in progress")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <PanelLeft className="h-4 w-4 mr-2" />
                  {t("admin.contentStudio.page.openUnitList", "Open unit list")}
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
                    {hasUnsavedChanges && (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("admin.contentStudio.page.unsavedBadge", "Unsaved")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setStudioView("draftManager")} disabled={isBusy}>
                      {t("admin.contentStudio.page.editUnit", "Edit unit")}
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

                {/* 3-Step Stepper */}
                <div className="px-3 lg:px-4 py-2 border-b flex items-center gap-1 shrink-0 overflow-x-auto">
                  {(["generate", "review", "createPreview"] as InspectorStep[]).map((step, idx) => {
                    const isActive = step === activeInspectorStep;
                    const stepLabels: Record<InspectorStep, string> = {
                      generate: t("admin.contentStudio.page.step1Generate", "1. Generate"),
                      review: t("admin.contentStudio.page.step2Review", "2. Review"),
                      createPreview: t("admin.contentStudio.page.step3Preview", "3. Preview"),
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
                          {/* Unfinished quality step: visible even from step 3. */}
                          {step === "review" && openFindingsCount > 0 && (
                            <span
                              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                              title={t("admin.contentStudio.page.openFindingsDot", {
                                defaultValue: "{{n}} open finding(s)",
                                n: openFindingsCount,
                              })}
                            />
                          )}
                        </button>
                      </Fragment>
                    );
                  })}
                </div>

                {/* Process Running Banner */}
                {isBusy && (
                  <div className="shrink-0 border-b bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 px-3 lg:px-4 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-200 flex-1 truncate">
                        {currentTaskLabel}
                      </span>
                      <span className="text-xs text-amber-700 dark:text-amber-400 shrink-0 tabular-nums">
                        {elapsedSeconds}s
                      </span>
                    </div>
                    {progressPercent != null && (
                      <Progress value={progressPercent} className="h-1.5" />
                    )}
                    {progressMessage && progressMessage !== currentTaskLabel && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 truncate">{progressMessage}</p>
                    )}
                  </div>
                )}

                {/* Artifacts Panel (takes remaining height) */}
                <div className="flex-1 overflow-auto">
                  <ArtifactsPanel
                    selected={selected}
                    selectedDraftId={selectedDraftId}
                    isBusy={isBusy}
                    creatingPreview={creatingPreview}
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
                    onCreatePreview={handleCreatePreview}
                    onCopyMarkdown={handleCopyMarkdown}
                    onDownloadMarkdown={handleDownloadMarkdown}
                    onLoadMarkdownFromSnapshot={handleLoadMarkdownFromSnapshot}
                    onLoadFromSnapshot={handleLoadFromSnapshot}
                    onSaveJson={handleSaveJson}
                    t={t}
                    curatedSections={(selected as any)?.draft?.curatedSections}
                    adoptingChanges={adoptingChanges}
                    onAdoptChanges={handleAdoptChanges}
                    previewCurrent={previewIsCurrent}
                    pendingSectionRevisions={pendingSectionRevisions ?? []}
                    onRefuseChanges={handleRefuseChanges}
                    refusingSection={refusingSection}
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

      <AlertDialog
        open={cognateAcceptPrompt !== null}
        onOpenChange={(open) => {
          if (!open && !cognateAcceptBusy) setCognateAcceptPrompt(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.contentStudio.page.cognateDialogTitle", "Quality guard: EN = DE cognate?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t(
                    "admin.contentStudio.page.cognateDialogBody",
                    "The DE preview is already written. If these words are correctly identical in German (e.g. park, hotel), accept them so the next translation does not flag them again."
                  )}
                </p>
                <ul className="list-disc pl-5 font-mono text-foreground">
                  {(cognateAcceptPrompt?.terms ?? []).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p className="text-xs break-words">
                  {cognateAcceptPrompt?.errorMessage
                    ? cognateAcceptPrompt.errorMessage.slice(0, 420)
                    : null}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cognateAcceptBusy}>
              {t("admin.contentStudio.page.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cognateAcceptBusy}
              onClick={(e) => {
                e.preventDefault();
                void handleAcceptCognates();
              }}
            >
              {cognateAcceptBusy
                ? t("admin.contentStudio.page.saving", "Saving…")
                : t("admin.contentStudio.page.cognateAcceptAndRetry", "Accept & remember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={creatorOverwriteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setCreatorOverwriteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.contentStudio.page.overwriteDialogTitle", "Run Creator again — overwrite curated content?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {t(
                    "admin.contentStudio.page.overwriteDialogBody1",
                    "This unit already has a draft (section edits or manual markdown changes). A full rebuild by the Creator"
                  )}{" "}
                  <strong>
                    {t(
                      "admin.contentStudio.page.overwriteDialogBodyStrong",
                      "discards all draft changes that were not adopted into the briefing"
                    )}
                  </strong>{" "}
                  {t("admin.contentStudio.page.overwriteDialogBody2", "and regenerates those parts from the briefing.")}
                </p>
                {(() => {
                  const curatedCount = ((selected as any)?.draft?.curatedSections as
                    | Array<{ section: string }>
                    | undefined
                  )?.length ?? 0;
                  return curatedCount > 0 ? (
                    <p>
                      <strong>
                        {curatedCount === 1
                          ? t("admin.contentStudio.page.overwriteCuratedOne", {
                              defaultValue: "{{n}} section already adopted into the briefing",
                              n: curatedCount,
                            })
                          : t("admin.contentStudio.page.overwriteCuratedMany", {
                              defaultValue: "{{n}} sections already adopted into the briefing",
                              n: curatedCount,
                            })}
                      </strong>{" "}
                      {curatedCount === 1
                        ? t(
                            "admin.contentStudio.page.overwriteCuratedKeptOne",
                            "is kept: the Creator builds on it (may refine wording) and does not discard it."
                          )
                        : t(
                            "admin.contentStudio.page.overwriteCuratedKeptMany",
                            "are kept: the Creator builds on them (may refine wording) and does not discard them."
                          )}
                    </p>
                  ) : null;
                })()}
                {creatorOverwriteConfirm?.reason === "approved_or_published" ? (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    {t(
                      "admin.contentStudio.page.overwriteApprovedWarning",
                      "Warning: this unit has already been approved or published."
                    )}
                  </p>
                ) : null}
                <p>
                  {t(
                    "admin.contentStudio.page.overwriteDialogHint",
                    "For targeted changes use \"Edit content\" (section revise) or \"Revise\" instead — or adopt the affected section into the briefing first in the Rendered tab."
                  )}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.contentStudio.page.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmCreatorOverwrite();
              }}
            >
              {t("admin.contentStudio.page.overwriteConfirm", "Regenerate anyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={refuseSectionConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !refusingSection) setRefuseSectionConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.contentStudio.page.refuseDialogTitle", "Discard section revision?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>
                    {sectionLabelOf(refuseSectionConfirm ?? "")}
                  </strong>{" "}
                  {t(
                    "admin.contentStudio.page.refuseDialogBody",
                    "will be reset in the markdown to the version before this revision — only this one step is discarded, older revisions of the same section stay untouched."
                  )}
                </p>
                <p>
                  {t("admin.contentStudio.page.refuseDialogBriefing1", "The briefing (curatedSections) is")}{" "}
                  <strong>{t("admin.contentStudio.page.refuseDialogBriefingNot", "not")}</strong>{" "}
                  {t("admin.contentStudio.page.refuseDialogBriefing2", "changed.")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refusingSection !== null}>
              {t("admin.contentStudio.page.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={refusingSection !== null}
              onClick={(e) => {
                e.preventDefault();
                void confirmRefuseSection();
              }}
            >
              {refusingSection
                ? t("admin.contentStudio.page.refuseInProgress", "Resetting…")
                : t("admin.contentStudio.page.refuseConfirm", "Discard & reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
