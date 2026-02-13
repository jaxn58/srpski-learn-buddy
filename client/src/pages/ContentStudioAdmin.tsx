import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { MarkdownContent } from "@/components/MarkdownContent";
import { Progress } from "@/components/ui/progress";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Sparkles, Upload, Info, Loader2, Settings, Plus, Search, LayoutList } from "lucide-react";
import { UnitManagerTab } from "@/components/admin/UnitManagerTab";

type Mode = "update" | "replace";
type Provider = "gemini" | "openai";
type StageKey = "specialist" | "auditor";

const MODEL_META: Record<Provider, Array<{ id: string; title: string; blurb: string }>> = {
  gemini: [
    { id: "gemini-2.5-pro", title: "gemini-2.5-pro", blurb: "Highest quality; best for authoring" },
    { id: "gemini-2.5-flash", title: "gemini-2.5-flash", blurb: "Fast + cheaper; best for fixes/audit" },
  ],
  openai: [
    { id: "gpt-4o", title: "gpt-4o", blurb: "Highest quality; best for authoring" },
    { id: "gpt-4o-mini", title: "gpt-4o-mini", blurb: "Fast + cheaper; best for fixes/audit" },
  ],
};

const STAGE_HELP: Record<StageKey, string> = {
  specialist:
    "Creator: generates the full unit as Markdown (Manus-compatible) which is then parsed into unitPackage.v1.",
  auditor:
    "Lector: reviews consistency/risk/obvious issues and can block publishing (structured findings).",
};

// Content Studio dialogs should be wide enough for comfortable editing.
// Desktop: ~80% viewport. Mobile: almost full width (as before).
const CONTENT_STUDIO_DIALOG_WIDTH = "w-[98vw] max-w-[98vw] sm:w-[90vw] sm:max-w-[90vw] md:w-[80vw] md:max-w-[80vw]";

const DRAFT_STATUS_LABEL: Record<
  "draft" | "qc_failed" | "qc_passed" | "audit_failed" | "ready_to_publish" | "published",
  string
> = {
  draft: "Draft",
  qc_failed: "Validator failed",
  qc_passed: "Validated",
  audit_failed: "Lector flagged issues",
  ready_to_publish: "Ready to publish",
  published: "Published",
};

function stageOrderedModels(provider: Provider, stage: StageKey): Array<{ id: string; title: string; blurb: string }> {
  const base = MODEL_META[provider] || [];
  if (stage === "specialist") return base;
  // Prefer the "fast" option first for qc/audit if present
  const fast = base.find((m) => /flash|mini/i.test(m.id));
  const rest = base.filter((m) => m !== fast);
  return fast ? [fast, ...rest] : base;
}

function isKnownModel(provider: Provider, model: string): boolean {
  return (MODEL_META[provider] || []).some((m) => m.id === model);
}

type DiffOp = { op: "equal" | "add" | "del"; line: string };

function myersDiffLines(aLines: string[], bLines: string[]): DiffOp[] {
  const N = aLines.length;
  const M = bLines.length;
  const max = N + M;

  let v = new Map<number, number>();
  v.set(1, 0);
  const trace: Array<Map<number, number>> = [];

  let found = false;
  for (let d = 0; d <= max; d++) {
    const v2 = new Map<number, number>();
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0));
      let x = down ? (v.get(k + 1) ?? 0) : (v.get(k - 1) ?? 0) + 1;
      let y = x - k;

      while (x < N && y < M && aLines[x] === bLines[y]) {
        x++;
        y++;
      }
      v2.set(k, x);
      if (x >= N && y >= M) {
        trace.push(v2);
        found = true;
        break;
      }
    }
    trace.push(v2);
    v = v2;
    if (found) break;
  }

  // Backtrack to build edit script
  const ops: DiffOp[] = [];
  let x = N;
  let y = M;

  for (let d = trace.length - 1; d >= 0; d--) {
    const vD = trace[d];
    const k = x - y;

    // For d=0, there is no previous diagonal choice.
    if (d === 0) {
      while (x > 0 && y > 0) {
        ops.push({ op: "equal", line: aLines[x - 1] });
        x--;
        y--;
      }
      break;
    }

    const vPrev = trace[d - 1];
    const down = k === -d || (k !== d && (vPrev.get(k - 1) ?? 0) < (vPrev.get(k + 1) ?? 0));
    const prevK = down ? k + 1 : k - 1;
    const prevX = vPrev.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ op: "equal", line: aLines[x - 1] });
      x--;
      y--;
    }

    if (down) {
      // Came from k+1: insertion in b
      if (y > 0) {
        ops.push({ op: "add", line: bLines[y - 1] });
        y--;
      }
    } else {
      // Came from k-1: deletion from a
      if (x > 0) {
        ops.push({ op: "del", line: aLines[x - 1] });
        x--;
      }
    }
  }

  ops.reverse();
  return ops;
}

function buildSideBySideDiffRows(aText: string, bText: string): Array<{
  left: { op: "equal" | "del"; line: string } | null;
  right: { op: "equal" | "add"; line: string } | null;
}> {
  const aLines = String(aText || "").replace(/\r\n/g, "\n").split("\n");
  const bLines = String(bText || "").replace(/\r\n/g, "\n").split("\n");
  const ops = myersDiffLines(aLines, bLines);

  const rows: Array<{
    left: { op: "equal" | "del"; line: string } | null;
    right: { op: "equal" | "add"; line: string } | null;
  }> = [];

  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === "equal") {
      rows.push({ left: { op: "equal", line: o.line }, right: { op: "equal", line: o.line } });
      continue;
    }
    if (o.op === "del") {
      const next = ops[i + 1];
      if (next?.op === "add") {
        rows.push({ left: { op: "del", line: o.line }, right: { op: "add", line: next.line } });
        i++;
      } else {
        rows.push({ left: { op: "del", line: o.line }, right: null });
      }
      continue;
    }
    // add
    rows.push({ left: null, right: { op: "add", line: o.line } });
  }

  return rows;
}

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

  // Section-based revision (targeted edits)
  type SectionId = "overview" | "vocabulary" | "grammar" | "phrases" | "exercises" | "cultural";
  const [expandSection, setExpandSection] = useState<SectionId>("phrases");
  const [expandInstruction, setExpandInstruction] = useState("");
  const SECTION_OPTIONS: { value: SectionId; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "vocabulary", label: "Vocabulary" },
    { value: "grammar", label: "Grammar" },
    { value: "phrases", label: "Phrases & Dialogues" },
    { value: "exercises", label: "Interactive Test (Exercises)" },
    { value: "cultural", label: "Cultural Note" },
  ];

  // Top-level view toggle: "drafts" = Draft Studio (default), "units" = Unit Manager
  const [studioView, setStudioView] = useState<"drafts" | "units">("drafts");

  // Settings sheet state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"ai" | "libraries">("ai");
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
  const errorFindings = findings.filter((f: any) => f.severity === "error");
  const warningFindings = findings.filter((f: any) => f.severity === "warning");
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

  type NextStepKey = "creator" | "validator" | "lector" | "preview" | "publish";

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
    const s = selected?.draft?.status;
    if (!s) return null;
    const color =
      s === "ready_to_publish" || s === "published" || s === "qc_passed"
        ? "bg-emerald-500"
        : s === "qc_failed" || s === "audit_failed"
          ? "bg-red-500"
          : "bg-muted-foreground";
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-white text-xs ${color}`}>
        {DRAFT_STATUS_LABEL[s as keyof typeof DRAFT_STATUS_LABEL] ?? String(s)}
      </span>
    );
  }, [selected?.draft?.status]);

  const renderDraftStatusPill = (status: string) => {
    const s = String(status || "draft") as keyof typeof DRAFT_STATUS_LABEL;
    const label = DRAFT_STATUS_LABEL[s] ?? String(status || "");
    const className =
      s === "ready_to_publish" || s === "published" || s === "qc_passed"
        ? "bg-emerald-600 text-white"
        : s === "qc_failed" || s === "audit_failed"
          ? "bg-red-600 text-white"
          : "bg-muted-foreground text-white";
    return (
      <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium", className)}>
        {label}
      </span>
    );
  };

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

  type StepId = "setup" | "generate" | "qa" | "preview" | "publish";
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

  const handleDeleteSelectedDraft = async () => {
    if (!selectedDraftId) return;
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
      await saveMarkdownSnapshot({ draftId: selectedDraftId, markdown: md } as any);
      toast.success(t("admin.contentStudio.toast.markdownSnapshotSaved"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.toast.markdownSnapshotSaveFailed"));
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
      });
      if (res.ok) {
        toast.success(t("admin.contentStudio.toast.revisionApplied"));
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
      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Content Studio Settings</SheetTitle>
            <SheetDescription>Configure AI models and manage libraries</SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(v as "ai" | "libraries")}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="ai">AI Models</TabsTrigger>
                <TabsTrigger value="libraries">Libraries</TabsTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">gemini</SelectItem>
                <SelectItem value="openai">openai</SelectItem>
              </SelectContent>
            </Select>
            <Label>Model</Label>
            {!cfgSpecialistCustom ? (
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
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent align="start">
                  {stageOrderedModels(cfgSpecialistProvider, "specialist").map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.title}</span>
                        <span className="text-xs text-muted-foreground">{m.blurb}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <span className="text-muted-foreground">Custom model…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input value={cfgSpecialistModel} onChange={(e) => setCfgSpecialistModel(e.target.value)} />
                <Button variant="secondary" onClick={() => setCfgSpecialistCustom(false)}>
                  Back to dropdown
                </Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Recommended: <span className="font-medium">{stageOrderedModels(cfgSpecialistProvider, "specialist")[0]?.id}</span>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">gemini</SelectItem>
                <SelectItem value="openai">openai</SelectItem>
              </SelectContent>
            </Select>
            <Label>Model</Label>
            {!cfgAuditorCustom ? (
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
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent align="start">
                  {stageOrderedModels(cfgAuditorProvider, "auditor").map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{m.title}</span>
                        <span className="text-xs text-muted-foreground">{m.blurb}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <span className="text-muted-foreground">Custom model…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Input value={cfgAuditorModel} onChange={(e) => setCfgAuditorModel(e.target.value)} />
                <Button variant="secondary" onClick={() => setCfgAuditorCustom(false)}>
                  Back to dropdown
                </Button>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Recommended: <span className="font-medium">{stageOrderedModels(cfgAuditorProvider, "auditor")[0]?.id}</span>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="secondary" onClick={handleSaveModelConfig}>Save Model Config</Button>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button
                variant="secondary"
                onClick={handleUploadReferencePdf}
                disabled={newRefUploading || !newRefFile}
              >
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
            <Button onClick={handleCreateReference}>Create Reference</Button>
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
                        <Button size="sm" variant="secondary" onClick={() => handleOpenEditReferenceGuidelines(r)}>
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
                          onClick={handleReloadCurrentGuidelinesIntoEditor}
                          disabled={editRefSaving}
                        >
                          Back to current
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Tip: Saving always creates a new version in history.
                      </div>
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
                    onClick={handleAddPdfToReference}
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
                            <div className="font-mono truncate">
                              {String(f?.fileName || sid || "PDF").slice(0, 120)}
                            </div>
                            <div className="text-muted-foreground">
                              {sid ? sid.slice(0, 16) : "—"}
                            </div>
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
                              onClick={() => handleRemovePdfFromReference(sid)}
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
                                  onClick={() => handleLoadGuidelinesVersionIntoEditor(Number(v.version))}
                                  disabled={editRefSaving}
                                >
                                  Open
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  type="button"
                                  onClick={() => handleRevertGuidelinesToVersion(Number(v.version))}
                                  disabled={editRefSaving}
                                >
                                  Revert
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      type="button"
                                      disabled={editRefSaving}
                                    >
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
                                          handleDeleteGuidelinesVersion({
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
                <Button
                  variant="destructive"
                  type="button"
                  onClick={handleClearReferenceGuidelines}
                  disabled={editRefSaving}
                >
                  Clear
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" type="button" onClick={() => setEditRefOpen(false)} disabled={editRefSaving}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSaveReferenceGuidelines} disabled={editRefSaving}>
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
            <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g. Unit template (café)" />
            <Label>Description (optional)</Label>
            <Input value={newTemplateDescription} onChange={(e) => setNewTemplateDescription(e.target.value)} placeholder="Short note for admins" />
            <Button onClick={handleCreateTemplateFromSelectedDraft} disabled={!selectedDraftId}>
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
                            <Button size="sm" variant="secondary" onClick={() => handleUseTemplate(t)}>
                              Use
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeactivateTemplate(String(t._id))}>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Button onClick={handleCreateSkill}>{editSkillId ? "Update Skill" : "Create Skill"}</Button>
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
                        <Button size="sm" variant="secondary" onClick={() => handleEditSkill(s)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeactivateSkill(String(s._id))}>
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
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Content Studio</h1>
          <div className="text-sm text-muted-foreground">
            {studioView === "drafts"
              ? "Draft \u2192 Generate \u2192 QA \u2192 Preview \u2192 Publish"
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

      {/* Unit Manager view */}
      {studioView === "units" && <UnitManagerTab recentlyTranslatedUnits={recentlyTranslatedUnits} />}

      {/* Draft Studio view (original layout) */}
      {studioView === "drafts" && <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">QC pass rate (last window)</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {typeof (studioMetrics as any)?.qc?.rate === "number"
                  ? `${Math.round(Number((studioMetrics as any).qc.rate) * 100)}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {String((studioMetrics as any)?.qc?.pass ?? "—")} / {String((studioMetrics as any)?.qc?.denom ?? "—")}
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Avg revisions per draft</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {typeof (studioMetrics as any)?.revisions?.avg === "number"
                  ? Number((studioMetrics as any).revisions.avg).toFixed(2)
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Based on {String((studioMetrics as any)?.revisions?.withSnapshots ?? "—")} drafts with snapshots
              </div>
            </div>

            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">Drafts by status</div>
              <div className="mt-2 space-y-1 text-xs">
                {(["draft", "qc_failed", "qc_passed", "audit_failed", "ready_to_publish", "published"] as const).map(
                  (s) => (
                    <div key={s} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{s}</span>
                      <span className="font-mono tabular-nums">{String((studioMetrics as any)?.statuses?.[s] ?? 0)}</span>
                    </div>
                  )
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Window: {String((studioMetrics as any)?.windowDrafts ?? "—")} drafts
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Left pane: Drafts */}
        <Card className="h-fit">
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Drafts</CardTitle>
              <Badge variant="secondary">{drafts?.length ?? 0}</Badge>
            </div>
            <div className="grid gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={draftsSearch}
                  onChange={(e) => setDraftsSearch(e.target.value)}
                  className="pl-8"
                  placeholder="Search (title, U#, M#)"
                />
              </div>
              <Select value={draftsStatusFilter} onValueChange={(v) => setDraftsStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="qc_failed">Validator failed</SelectItem>
                  <SelectItem value="qc_passed">Validated</SelectItem>
                  <SelectItem value="audit_failed">Lector flagged issues</SelectItem>
                  <SelectItem value="ready_to_publish">Ready to publish</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="text-xs text-muted-foreground">
                Batch select: <span className="font-medium">{batchSelectedDraftIds.length}</span> selected
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={selectAllFilteredDrafts}
                  disabled={batchRunning || filteredDrafts.length === 0}
                >
                  Select filtered
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={clearBatchSelection}
                  disabled={batchRunning || (batchSelectedDraftIds.length === 0 && batchResults.length === 0)}
                >
                  Clear
                </Button>
              </div>
            </div>

            {batchSelectedDraftIds.length > 0 ? (
              <div className="mb-3 space-y-2 rounded border p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Batch actions</div>
                  <Badge variant="secondary">{batchSelectedDraftIds.length} drafts</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void runBatch("generate")} disabled={batchRunning || isBusy}>
                    Batch Generate
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void runBatch("validate")}
                    disabled={batchRunning || isBusy}
                  >
                    Batch Validate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runBatch("preview")}
                    disabled={batchRunning || isBusy}
                  >
                    Batch Publish to Preview
                  </Button>
                </div>

                {batchProgress ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{batchProgress.label}</span>
                      <span className="tabular-nums">
                        {batchProgress.current}/{batchProgress.total}
                      </span>
                    </div>
                    <Progress value={Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)} />
                  </div>
                ) : null}

                {batchResults.length > 0 ? (
                  <div className="max-h-[160px] overflow-auto rounded border p-2 text-xs">
                    <div className="space-y-1">
                      {batchResults
                        .slice()
                        .reverse()
                        .slice(0, 20)
                        .map((r, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2">
                            <span className="font-mono text-muted-foreground">{String(r.draftId).slice(0, 8)}</span>
                            <span className="text-muted-foreground">{r.action}</span>
                            <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>
                              {r.status}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              {r.message ? String(r.message) : ""}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ScrollArea className="max-h-[560px] pr-2">
              <div className="space-y-2">
                {drafts === undefined ? (
                  <div className="text-sm text-muted-foreground">Loading drafts…</div>
                ) : filteredDrafts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No drafts found.</div>
                ) : (
                  filteredDrafts.map((d: any) => {
                    const isSelected = selectedDraftId === d._id;
                    const isBatchSelected = batchSelectedDraftIds.includes(String(d._id));
                    return (
                      <div key={d._id} className="flex items-start gap-2">
                        <div className="pt-2">
                          <Checkbox
                            checked={isBatchSelected}
                            onCheckedChange={(checked) => toggleBatchSelectDraft(String(d._id), Boolean(checked))}
                            disabled={batchRunning}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectDraft(d._id)}
                          className={cn(
                            "flex-1 w-full text-left rounded-lg border px-3 py-2 transition-colors",
                            isSelected
                              ? "border-accent bg-accent/20"
                              : "hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {`U${d.unitNumber} — ${String(d.title || "").trim() || "Untitled"}`}
                              </div>
                              <div className="text-xs text-muted-foreground">{`Module M${d.moduleNumber}`}</div>
                            </div>
                            {renderDraftStatusPill(String(d.status || "draft"))}
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Middle pane: Workspace */}
        <div className="space-y-6">
          {!selectedDraftId || !selected?.draft ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select a draft</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Choose a draft on the left or create a new one.
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Translate existing published Unit (EN → DE)</CardTitle>
                  <CardDescription>
                    For units that already exist in the database (even without a ContentStudio draft).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-[200px_1fr] items-end">
                    <div className="space-y-2">
                      <Label>English Unit</Label>
                      <Select
                        value={translateAnyUnitNumber}
                        onValueChange={(v) => {
                          setTranslateAnyUnitNumber(v);
                          setTranslateAnyConfirmation("");
                        }}
                        disabled={!publishedEnglishUnits || (publishedEnglishUnits as any[]).length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              publishedEnglishUnits === undefined
                                ? "Loading units…"
                                : (publishedEnglishUnits as any[]).length === 0
                                  ? "No published EN units found"
                                  : "Select a unit"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(publishedEnglishUnits || []).map((u: any) => (
                            <SelectItem key={String(u.unitNumber)} value={String(u.unitNumber)}>
                              {`Unit ${u.unitNumber}: ${String(u.title || "").trim()}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <AlertDialog open={translateAnyOpen} onOpenChange={setTranslateAnyOpen}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" disabled={isBusy || runningTranslateDe || !translateAnyUnitNumberParsed}>
                            {runningTranslateDe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Preview & Translate
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
                            {translateAnyPreview === undefined ? (
                              <div className="text-muted-foreground">Loading preview…</div>
                            ) : !(translateAnyPreview as any)?.sourceEn?.exists ? (
                              <div className="text-destructive">
                                No published EN source found for this unit. Publish the unit live first (EN), then translate.
                              </div>
                            ) : (
                              <>
                                <div className="font-medium">
                                  Source (EN): {(translateAnyPreview as any)?.sourceEn?.title || `Unit ${translateAnyUnitNumberParsed}`}
                                </div>
                                <div className="text-muted-foreground">
                                  Sections: {((translateAnyPreview as any)?.sourceEn?.contentSections || []).length} · Tests:{" "}
                                  {(translateAnyPreview as any)?.sourceEn?.tests?.count ?? 0} (v{(translateAnyPreview as any)?.sourceEn?.tests?.unitVersion ?? 1}) ·
                                  Vocabulary: {(translateAnyPreview as any)?.sourceEn?.vocabulary?.count ?? 0}
                                </div>
                                {Array.isArray((translateAnyPreview as any)?.warnings) && (translateAnyPreview as any).warnings.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="font-medium">Warnings</div>
                                    <ul className="list-disc pl-5 space-y-0.5">
                                      {(translateAnyPreview as any).warnings.slice(0, 6).map((w: any, idx: number) => (
                                        <li key={idx} className="text-muted-foreground">
                                          {String(w)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                                <div className="text-muted-foreground">
                                  Existing DE: metadata (published {(translateAnyPreview as any)?.existingDe?.metadata?.published ?? 0}, preview{" "}
                                  {(translateAnyPreview as any)?.existingDe?.metadata?.preview ?? 0}) · content rows{" "}
                                  {(translateAnyPreview as any)?.existingDe?.content?.publishedActiveCount ?? 0} · test rows{" "}
                                  {(translateAnyPreview as any)?.existingDe?.tests?.publishedActiveCount ?? 0}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="py-2 space-y-2">
                            <Label>
                              Type {translateAnyUnitNumberParsed ? `"TRANSLATE UNIT ${translateAnyUnitNumberParsed} TO DE"` : "the confirmation text"} to confirm:
                            </Label>
                            <Input
                              value={translateAnyConfirmation}
                              onChange={(e) => setTranslateAnyConfirmation(e.target.value)}
                              placeholder={translateAnyUnitNumberParsed ? `TRANSLATE UNIT ${translateAnyUnitNumberParsed} TO DE` : "TRANSLATE UNIT <N> TO DE"}
                            />
                          </div>

                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={runningTranslateDe}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleTranslateAnyUnitToGerman}
                              disabled={
                                runningTranslateDe ||
                                !translateAnyUnitNumberParsed ||
                                translateAnyConfirmation !== `TRANSLATE UNIT ${translateAnyUnitNumberParsed} TO DE` ||
                                !(translateAnyPreview as any)?.sourceEn?.exists
                              }
                            >
                              Translate & Save
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        variant="outline"
                        onClick={handleTakeUnitPreviewOfflineForAny}
                        disabled={isBusy || runningTranslateDe || runningPublish || !translateAnyUnitNumberParsed}
                      >
                        Take Preview Offline
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tip: This is the right tool for units that were imported/migrated outside ContentStudio and therefore don't appear as drafts.
                  </div>

                  {/* ===== DE Translation Preview Status (persists after translate) ===== */}
                  {translateDeResult && (
                    <div className="rounded-lg border border-accent bg-accent/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">
                          DE Preview active: Unit {translateDeResult.unitNumber}
                          {translateDeResult.previewVersion ? ` (v${translateDeResult.previewVersion})` : ""}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(translateDeResult.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        The German translation was written as <code>releaseStatus="preview"</code>.
                        Published EN content is untouched. Review the preview, then approve or discard.
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            window.open(`/unit/${translateDeResult.unitNumber}?lang=de`, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Open DE Preview
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handlePublishDeTranslationLive}
                          disabled={isBusy || runningTranslateDe}
                        >
                          {runningTranslateDe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Publish DE Live
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await handleTakeUnitPreviewOfflineForAny();
                            setTranslateDeResult(null);
                          }}
                          disabled={isBusy || runningTranslateDe || runningPublish}
                        >
                          Take Preview Offline
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTranslateDeResult(null)}
                        >
                          Dismiss
                        </Button>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        To re-translate: select the unit above and click "Preview & Translate" again. Previous preview rows are archived automatically.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate">
                        Workflow
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Draft U{selected.draft.unitNumber}: {selected.draft.title}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>Module M{selected.draft.moduleNumber}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>
                          Next: <span className="font-medium text-foreground">{nextStepLabel}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {statusBadge}
                      {hasUnsavedChanges ? <Badge variant="secondary">Unsaved changes</Badge> : null}
                      {metaAutosaveStatus === "saving" ? (
                        <span className="text-xs text-muted-foreground">Autosaving…</span>
                      ) : metaAutosaveStatus === "error" ? (
                        <span className="text-xs text-red-600 dark:text-red-400">Autosave failed</span>
                      ) : metaAutosavedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Autosaved {new Date(metaAutosavedAt).toLocaleTimeString()}
                        </span>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={handleSaveDraftSkillsAndReference}
                        disabled={!selectedDraftId || isBusy}
                      >
                        Save Draft
                      </Button>
                      <Button variant="destructive" onClick={handleDeleteSelectedDraft} disabled={isBusy}>
                        Delete Draft
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      Guided flow
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Next step:</span>{" "}
                      <span className="font-medium">{nextStepLabel}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="flex items-center gap-3 min-w-max py-1">
                      {[
                        { id: "setup" as const, label: "Setup" },
                        { id: "generate" as const, label: "Generate" },
                        { id: "qa" as const, label: "QA" },
                        { id: "preview" as const, label: "Preview" },
                        { id: "publish" as const, label: "Publish" },
                      ].map((s, idx, arr) => {
                        const isComplete = idx < activeStepIndex;
                        const isActive = idx === activeStepIndex;
                        const connectorClass =
                          idx < activeStepIndex
                            ? "bg-emerald-300 dark:bg-emerald-700"
                            : idx === activeStepIndex
                              ? "bg-accent"
                              : "bg-border";

                        return (
                          <div key={s.id} className="flex items-center gap-3">
                            <div className="flex items-center gap-2 shrink-0">
                              <div
                                className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border shrink-0",
                                  isComplete
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : isActive
                                      ? "bg-accent text-accent-foreground border-accent"
                                      : "bg-muted text-muted-foreground border-border"
                                )}
                                aria-label={s.label}
                                title={s.label}
                              >
                                {isComplete ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                              </div>
                              <div className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                                {s.label}
                                {isActive ? (
                                  <span className="ml-2 text-[11px] text-muted-foreground font-normal">(current)</span>
                                ) : null}
                              </div>
                            </div>

                            {idx < arr.length - 1 ? (
                              <div className={cn("h-px w-10 rounded", connectorClass)} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {isBusy ? (
                      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-blue-700 dark:text-blue-300">
                            {progressMessage || currentTaskLabel}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 tabular-nums">
                            {progressPercent != null ? `${Math.max(0, Math.min(100, progressPercent))}% • ` : ""}
                            {elapsedSeconds}s
                          </span>
                        </div>
                        {progressPercent != null ? (
                          <Progress value={Math.max(0, Math.min(100, progressPercent))} />
                        ) : (
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
                            <div className="absolute h-full w-1/3 bg-blue-500 animate-[progress-indeterminate_1.5s_ease-in-out_infinite]" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Primary path: Generate (Creator → Validator → Lector). Then Preview → Approve → Publish.
                      </div>
                    )}

                    <div className="grid gap-2 md:grid-cols-2">
                      <Button onClick={handleGenerate} disabled={isBusy || !selectedDraftId}>
                        {runningCreateValidate ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {runningCreateValidate ? "Generating…" : "Generate (auto)"}
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={isBusy || !selectedDraftId || (nextStepKey === "publish" && !canPublishLive)}
                        onClick={() => {
                          if (nextStepKey === "creator") return void handleRunSpecialist();
                          if (nextStepKey === "validator") return void handleRunValidate();
                          if (nextStepKey === "lector") return void handleRunAuditor();
                          if (nextStepKey === "preview") return void handlePublishToPreview();
                          if (nextStepKey === "publish") return void handlePublish();
                        }}
                      >
                        Run next step: {nextStepLabel}
                      </Button>
                    </div>

                    <Accordion type="single" collapsible defaultValue="setup" className="w-full">
                      <AccordionItem value="setup">
                        <AccordionTrigger>Setup</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                  value={draftEditTitle}
                                  onChange={(e) => setDraftEditTitle(e.target.value)}
                                  placeholder="Unit title (shown in the app)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Unit description (1 short sentence)</Label>
                                <Input
                                  value={draftEditDescription}
                                  onChange={(e) => setDraftEditDescription(e.target.value)}
                                  placeholder="This becomes **Description:** in the unit header (max ~120 chars)."
                                />
                                <div className="text-xs text-muted-foreground">
                                  This becomes <span className="font-mono">**Description:** ...</span> in the generated unit header.
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Unit author name (optional)</Label>
                                <Input
                                  value={draftAuthorNoteName}
                                  onChange={(e) => setDraftAuthorNoteName(e.target.value)}
                                  onBlur={() => {
                                    const name = String(draftAuthorNoteName || "").trim();
                                    const quote = String(draftAuthorNoteQuote || "").trim();
                                    if (name && quote) maybeApplyFounderNoteToMarkdown(name, quote);
                                  }}
                                  placeholder="Shown in the unit (e.g., 'Jacksenn')"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Founder quote (optional, will be English in the unit)</Label>
                                <Input
                                  value={draftAuthorNoteQuote}
                                  onChange={(e) => setDraftAuthorNoteQuote(e.target.value)}
                                  onBlur={() => void handleFounderQuoteBlur()}
                                  placeholder='You can type German; it will be translated to English automatically (e.g., "Don’t aim for perfect—aim for clear.")'
                                />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              The note is injected automatically (Creator/Validator/Editor) and will be persisted on the next snapshot/save.
                            </div>

                            <div className="space-y-2">
                              <Label>Creator Brief</Label>
                              <Textarea
                                value={draftRefNotes}
                                onChange={(e) => setDraftRefNotes(e.target.value)}
                                placeholder="Prerequisites, new vocab, scenes..."
                                className="min-h-[90px]"
                              />
                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Reference (optional)</Label>
                                  <Select
                                    value={draftRefId ? draftRefId : "none"}
                                    onValueChange={(v) => setDraftRefId(v === "none" ? "" : String(v))}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select reference" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      {(refs || []).map((r: any) => (
                                        <SelectItem key={r._id} value={String(r._id)}>
                                          {String(r.title || "Untitled")}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="text-xs text-muted-foreground">
                                    If selected, the PDF is distilled into high-level guidelines (no quotes) and used as inspiration for unit structure and question-writing.
                                  </div>
                                </div>

                                <div className="grid gap-3 grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Chapter</Label>
                                    <Input
                                      value={draftRefChapter}
                                      onChange={(e) => setDraftRefChapter(e.target.value)}
                                      placeholder="e.g. 3"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Pages</Label>
                                    <Input
                                      value={draftRefPages}
                                      onChange={(e) => setDraftRefPages(e.target.value)}
                                      placeholder="e.g. 12-15"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-3 py-2">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{(specialistSkills || []).length + (auditorSkills || []).length} AI skills auto-applied</span>
                                </div>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => {
                                    setSettingsTab("libraries");
                                    setSettingsOpen(true);
                                  }}
                                >
                                  Settings
                                </Button>
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Note: Unit number (U{selected.draft.unitNumber}) and module number (M{selected.draft.moduleNumber}) are fixed for this draft.
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="edit">
                        <AccordionTrigger>Edit Content</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-sm">Target section</Label>
                              <select
                                className="rounded border bg-background px-2 py-1.5 text-sm"
                                value={expandSection}
                                onChange={(e) => setExpandSection(e.target.value as SectionId)}
                              >
                                {SECTION_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <Textarea
                              value={expandInstruction}
                              onChange={(e) => setExpandInstruction(e.target.value)}
                              placeholder="Describe what you want to change…"
                              className="min-h-[110px]"
                            />
                            <Button
                              className="w-full"
                              onClick={handleSectionRevise}
                              disabled={isBusy || !selectedDraftId || !expandInstruction.trim()}
                            >
                              {runningSectionRevise ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                              )}
                              {runningSectionRevise ? "Applying…" : "Apply Changes"}
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="advanced">
                        <AccordionTrigger>Advanced</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-2 pt-2">
                            <Button variant="outline" onClick={handleRunSpecialist} disabled={isBusy || !selectedDraftId}>
                              Run Creator
                            </Button>
                            <Button variant="outline" onClick={handleRunValidate} disabled={isBusy || !selectedDraftId}>
                              Run Validator
                            </Button>
                            <Button variant="outline" onClick={handleRunAuditor} disabled={isBusy || !selectedDraftId || !canRunLector}>
                              Run Lector
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </CardContent>
              </Card>

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
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveMarkdown}
                          disabled={isBusy || !selectedDraftId || !markdownText.trim()}
                        >
                          Save Markdown
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleCopyMarkdown}
                          disabled={!markdownText.trim()}
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleDownloadMarkdown}
                          disabled={!markdownText.trim()}
                        >
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleLoadMarkdownFromSnapshot}
                          disabled={isBusy || !selectedDraftId}
                        >
                          Load from snapshot
                        </Button>
                      </div>

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

                    <TabsContent value="rendered" className="mt-4">
                      {markdownText.trim() ? (
                        <div className="rounded-lg border bg-card p-4">
                          <MarkdownContent content={markdownText} />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No markdown to render yet.</div>
                      )}
                    </TabsContent>

                    <TabsContent value="json" className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleLoadFromSnapshot}
                          disabled={isBusy || !selectedDraftId}
                        >
                          Load snapshot JSON
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleSaveJson}
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
                                      <div className={cn("min-h-[20px] rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words", leftClass)}>
                                        {row.left ? row.left.line : ""}
                                      </div>
                                      <div className={cn("min-h-[20px] rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words", rightClass)}>
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
            </>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-6 self-start">
          {!selectedDraftId || !selected?.draft ? (
            <Card>
              <CardHeader>
                <CardTitle>Workflow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Select a draft to run Creator/Validator/Lector and publish.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle>QA & Findings</CardTitle>
                      <div className="text-xs text-muted-foreground">Validator report + issues list.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={errorFindings.length > 0 ? "default" : "outline"}
                        onClick={handleRunRevise}
                        disabled={isBusy || (errorFindings.length === 0 && warningFindings.length === 0)}
                      >
                        {runningRevise ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Fix Findings
                      </Button>
                      <Badge variant={errorFindings.length ? "destructive" : "secondary"}>{errorFindings.length} errors</Badge>
                      <Badge variant="secondary">{warningFindings.length} warnings</Badge>
                      {typeof (latestReport as any)?.variety?.score === "number" ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "border",
                            (latestReport as any).variety.score >= 8
                              ? "border-emerald-300/60 text-emerald-700 dark:text-emerald-300"
                              : (latestReport as any).variety.score >= 7
                                ? "border-amber-300/60 text-amber-700 dark:text-amber-300"
                                : "border-red-300/60 text-red-700 dark:text-red-300"
                          )}
                        >
                          Variety {(latestReport as any).variety.score}/10
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestReport ? (
                    <div className="rounded border p-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Latest Validator report</span>
                        {latestReport.ok ? (
                          <span className="text-emerald-600 font-semibold">OK</span>
                        ) : (
                          <span className="text-red-600 font-semibold">NOT OK</span>
                        )}
                      </div>
                      <div className="mt-1">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(latestReport.counts ?? latestReport, null, 2)}</pre>
                      </div>
                    </div>
                  ) : null}

                  <div className="max-h-[360px] overflow-auto rounded border p-2">
                    {findings.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No findings yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {findings
                          .slice()
                          .sort((a: any, b: any) => (a.severity > b.severity ? -1 : 1))
                          .map((f: any, idx: number) => (
                            <div key={idx} className="flex gap-2 text-sm">
                              {f.severity === "error" ? (
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium">
                                  {f.code}{" "}
                                  {f.path ? <span className="text-muted-foreground">({f.path})</span> : null}
                                </div>
                                <div className="break-words text-muted-foreground">{f.message}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="ai-runs">
                      <AccordionTrigger>AI Runs</AccordionTrigger>
                      <AccordionContent>
                        <div className="rounded border p-2 text-xs text-muted-foreground">
                          {((selected as any)?.aiRuns?.length ?? 0) === 0 ? (
                            <div>No AI runs yet.</div>
                          ) : (
                            <div className="space-y-2">
                              {((selected as any).aiRuns as any[]).slice(0, 8).map((r: any) => (
                                <div key={r._id} className="rounded border-l-2 border-muted-foreground/30 pl-2 py-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {r.stage === "specialist" ? "Creator" : r.stage === "auditor" ? "Lector" : String(r.stage)}
                                      </span>
                                      <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>
                                        {r.status}
                                      </span>
                                    </div>
                                    <span className="text-muted-foreground text-[10px]">
                                      {typeof r.createdAt === "number" ? new Date(r.createdAt).toLocaleString() : "—"}
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground">
                                    {r.provider}/{r.model}
                                  </div>
                                  {typeof r.totalTokens === "number" ||
                                  typeof r.inputTokens === "number" ||
                                  typeof r.outputTokens === "number" ? (
                                    <div className="text-muted-foreground text-[10px]">
                                      tokens: in {typeof r.inputTokens === "number" ? r.inputTokens : "—"} • out{" "}
                                      {typeof r.outputTokens === "number" ? r.outputTokens : "—"} • total{" "}
                                      {typeof r.totalTokens === "number" ? r.totalTokens : "—"}
                                      {typeof r.estimatedCostUsd === "number"
                                        ? ` • $${Number(r.estimatedCostUsd).toFixed(4)}`
                                        : ""}
                                    </div>
                                  ) : null}
                                  {r.outputSummary ? (
                                    <div className="truncate">{String(r.outputSummary).slice(0, 160)}</div>
                                  ) : null}
                                  {r.error ? (
                                    <div className="text-red-600 break-words">{String(r.error).slice(0, 240)}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publish</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <Label>Mode</Label>
                      <Select value={publishMode} onValueChange={(v) => setPublishMode(v as Mode)}>
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
                      <Button variant="secondary" onClick={handlePublishToPreview} disabled={isBusy || !selectedDraftId}>
                        {runningPublish ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {runningPublish ? "Publishing…" : "Publish to Preview (Superadmin)"}
                      </Button>

                      <Button variant="outline" onClick={handleTakePreviewOffline} disabled={isBusy || !selectedDraftId}>
                        Take Preview Offline
                      </Button>

                      <div className="rounded border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="font-medium">Approve for Live Publish</div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleApprovePreview}
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
                            onClick={handleDownloadApprovedMarkdown}
                            disabled={!String((approvedMarkdown as any)?.markdownSource || "").trim()}
                          >
                            Download MD
                          </Button>
                        </div>
                      </div>

                      <Button onClick={handlePublish} disabled={isBusy || !canPublishLive}>
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
                                  onClick={handleTranslatePublishedToGerman}
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
                                  onClick={handleDeleteUnit}
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
            </>
          )}
        </div>
      </div>}
    </div>
  );
}

