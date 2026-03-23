import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Upload,
  Download,
  FileCheck,
  FileJson,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  FileWarning,
  History,
  Database,
  FolderTree,
  Sparkles,
  Eye,
  Pencil
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeEU } from "@/lib/utils";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

type FileResult = {
  fileName: string;
  unitNumber?: number;
  title?: string;
  valid: boolean;
  changesCount: number;
  changesPreview: Array<{ kind: string; path: string; note?: string }>;
  errors: Array<{ path: string; message: string }>;
  parseErrors: Array<{ path: string; message: string }>;
  fixedPackage?: unknown;
};

type Report = {
  generatedAt: string;
  type: "validate" | "import";
  status: "success" | "failed";
  summary: {
    files: number;
    validFiles: number;
    invalidFiles: number;
    totalErrors: number;
    totalWarnings: number;
  };
  files: FileResult[];
};

type ImportRun = {
  _id: Id<"contentImportRuns">;
  _creationTime: number;
  type: "validate" | "import";
  status: "success" | "failed";
  mode?: "update" | "replace";
  unitVersion?: number;
  startedAt: number;
  completedAt?: number;
  createdBy: Id<"users">;
  fileNames: string[];
  filesCount: number;
  unitNumbers: number[];
  totalErrors: number;
  totalWarnings: number;
};

export function ImportTab() {
  const { t } = useTranslation();
  // Prefer Markdown as primary import method; keep JSON import behind a toggle.
  const ENABLE_JSON_IMPORT = false;
  const runs = useQuery(api.contentImportAdmin.listRuns, { limit: 50 }) as ImportRun[] | undefined;
  const runsLoading = runs === undefined;
  const availableModules = useQuery(api.contentImportAdmin.listModulesForImport) as Doc<"moduleMetadata">[] | undefined;
  const dbModules = useQuery(api.modules.getAllModulesConsolidated) as Doc<"moduleMetadata">[] | undefined;
  
  const validateAction = useAction(api.contentImportAdmin.validateUnitPackages);
  const importAction = useAction(api.contentImportAdmin.importUnitPackages);
  const parseMarkdownAction = useAction(api.contentImportAdmin.parseMarkdownToJson);

  const createModuleMutation = useMutation(api.modules.createModule);
  const updateModuleMutation = useMutation(api.modules.updateModuleMetadata);
  
  
  // JSON Import states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationReport, setValidationReport] = useState<Report | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<Id<"moduleMetadata"> | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importMode, setImportMode] = useState<"update" | "replace">("update");
  const [replaceConfirmText, setReplaceConfirmText] = useState("");
  const [markdownImportToConfirm, setMarkdownImportToConfirm] = useState<any | null>(null);
  const [selectedRun, setSelectedRun] = useState<ImportRun | null>(null);
  const [selectedRunFull, setSelectedRunFull] = useState<any | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Markdown Import states
  const [markdownFile, setMarkdownFile] = useState<File | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResults, setParseResults] = useState<any[] | null>(null);
  const [selectedJsonPreview, setSelectedJsonPreview] = useState<any | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [isDraggingMarkdown, setIsDraggingMarkdown] = useState(false);

  // Module Management states (Superadmin-only)
  const [newModuleNumber, setNewModuleNumber] = useState<string>("");
  const [newTitleEn, setNewTitleEn] = useState<string>("");
  const [newTitleDe, setNewTitleDe] = useState<string>("");
  const [newDescriptionEn, setNewDescriptionEn] = useState<string>("");
  const [newDescriptionDe, setNewDescriptionDe] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");
  const [newSlugTouched, setNewSlugTouched] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<Id<"moduleMetadata"> | null>(null);
  const [editModuleNumber, setEditModuleNumber] = useState<string>("");
  const [editTitleEn, setEditTitleEn] = useState<string>("");
  const [editTitleDe, setEditTitleDe] = useState<string>("");
  const [editDescriptionEn, setEditDescriptionEn] = useState<string>("");
  const [editDescriptionDe, setEditDescriptionDe] = useState<string>("");
  const [editSlug, setEditSlug] = useState<string>("");

  
  
  const getRun = useQuery(
    api.contentImportAdmin.getRun,
    selectedRun ? { runId: selectedRun._id } : "skip"
  );

  const slugify = useCallback((input: string) => {
    return input
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, []);

  // Auto-generate slug from English title until user edits slug manually.
  useEffect(() => {
    if (newSlugTouched) return;
    setNewSlug(slugify(newTitleEn));
  }, [newTitleEn, newSlugTouched, slugify]);

  const confirmUnitNumber = useMemo(() => {
    const fromMarkdown = markdownImportToConfirm?.unitNumber;
    if (typeof fromMarkdown === "number") return fromMarkdown;
    const fromJson = validationReport?.files?.[0]?.unitNumber;
    return typeof fromJson === "number" ? fromJson : undefined;
  }, [markdownImportToConfirm, validationReport]);

  const confirmLanguages = useMemo(() => {
    const fromMarkdown = markdownImportToConfirm?.unitPackage?.languages;
    if (Array.isArray(fromMarkdown) && fromMarkdown.length > 0) return fromMarkdown as string[];
    const fromJsonFixed = (validationReport?.files?.[0]?.fixedPackage as any)?.languages;
    if (Array.isArray(fromJsonFixed) && fromJsonFixed.length > 0) return fromJsonFixed as string[];
    return ["en"];
  }, [markdownImportToConfirm, validationReport]);

  const expectedReplaceConfirm = useMemo(() => {
    return typeof confirmUnitNumber === "number" ? `REPLACE UNIT ${confirmUnitNumber}` : "";
  }, [confirmUnitNumber]);

  const replacePreview = useQuery(
    api.contentImportAdmin.previewReplaceUnit,
    showImportConfirm && importMode === "replace" && typeof confirmUnitNumber === "number"
      ? { unitNumber: confirmUnitNumber, languages: confirmLanguages }
      : "skip"
  );

  // #region agent log
  useEffect(() => {
    if (!__AGENT_LOG_ENABLED__) return;
    fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'history-pre',hypothesisId:'H1',location:'client/src/pages/ContentImportAdmin.tsx:history:useEffect',message:'history state snapshot',data:{selectedRunId:selectedRun?._id ?? null,showRunDetails,hasGetRun:!!getRun,reportJsonLen:(getRun as any)?.reportJson ? String((getRun as any).reportJson).length : null},timestamp:Date.now()})}).catch(()=>{});
  }, [selectedRun?._id, showRunDetails, getRun]);
  // #endregion

  // #region agent log
  useEffect(() => {
    if (!showRunDetails) return;
    if (!__AGENT_LOG_ENABLED__) return;
    fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'history-post',hypothesisId:'H3',location:'client/src/pages/ContentImportAdmin.tsx:history:ui-config',message:'run details modal ui config',data:{modalClass:'w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[90vh] max-h-[90vh] overflow-y-auto overflow-x-hidden',preClass:'whitespace-pre-wrap break-all overflow-x-hidden overflow-y-auto max-h-[65vh]',hasGetRun:!!getRun,reportJsonLen:(getRun as any)?.reportJson ? String((getRun as any).reportJson).length : null},timestamp:Date.now()})}).catch(()=>{});
  }, [showRunDetails, getRun]);
  // #endregion

  // #region agent log
  useEffect(() => {
    if (!showRunDetails) return;
    if (!__AGENT_LOG_ENABLED__) return;
    requestAnimationFrame(() => {
      const modal = document.querySelector('[data-agent="run-details-modal"]') as HTMLElement | null;
      const pre = document.querySelector('[data-agent="run-details-pre"]') as HTMLElement | null;
      const modalRect = modal?.getBoundingClientRect();
      const preRect = pre?.getBoundingClientRect();
      fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'history-post',hypothesisId:'H4',location:'client/src/pages/ContentImportAdmin.tsx:history:dom-metrics',message:'run details dom metrics',data:{window:{w:window.innerWidth,h:window.innerHeight},modal:modal?{w:Math.round(modalRect?.width||0),h:Math.round(modalRect?.height||0),scrollW:modal.scrollWidth,scrollH:modal.scrollHeight}:null,pre:pre?{w:Math.round(preRect?.width||0),h:Math.round(preRect?.height||0),scrollW:pre.scrollWidth,scrollH:pre.scrollHeight}:null},timestamp:Date.now()})}).catch(()=>{});
    });
  }, [showRunDetails, getRun]);
  // #endregion

  // Prevent default drag & drop behavior on the entire page
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent browser from opening files dragged into the window
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', preventDefault);
    };
  }, []);

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error(t("admin.contentImport.toast.invalidFileType.title"), {
        description: t("admin.contentImport.toast.invalidFileType.desc"),
      });
      return;
    }

    setUploadedFile(file);
    setValidationReport(null);
    setSelectedModuleId(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.onerror = () => {
      toast.error(t("admin.contentImport.toast.readFailed"));
      setUploadedFile(null);
      setFileContent(null);
    };
    reader.readAsText(file);
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [processFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleValidate = async () => {
    if (!fileContent || !uploadedFile) {
      toast.error(t("admin.contentImport.toast.noFile"));
      return;
    }

    try {
      setValidating(true);
      let unitPackage: unknown;
      try {
        unitPackage = JSON.parse(fileContent);
      } catch (e: any) {
        toast.error(t("admin.contentImport.toast.invalidJson.title"), {
          description: String(e?.message || e),
        });
        return;
      }
      
      const result = await validateAction({
        files: [{ fileName: uploadedFile.name, unitPackage }],
        includeFixed: true
      });
      
      setValidationReport(result.report);
      
      if (result.report.status === "success") {
        const firstFile = result.report.files[0];
        toast.success(t("admin.contentImport.toast.validationPassed.title"), {
          description: t("admin.contentImport.toast.validationPassed.desc", { unit: firstFile.unitNumber }),
        });
      } else {
        toast.error(t("admin.contentImport.toast.validationFailed.title"), {
          description: t("admin.contentImport.toast.validationFailed.desc", { count: result.report.summary.totalErrors }),
        });
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      toast.error(t("admin.contentImport.toast.validationFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
      setValidationReport(null);
    } finally {
      setValidating(false);
    }
  };

  const handleDownloadFixedJson = () => {
    if (!validationReport || !validationReport.files[0]?.fixedPackage) return;

    try {
      const fixedPackage = validationReport.files[0].fixedPackage;
      
      // Create a download link
      const dataStr = JSON.stringify(fixedPackage, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      
      const exportFileDefaultName = uploadedFile?.name.replace('.json', '-fixed.json') || 'unit-package-fixed.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      toast.success(t("admin.contentImport.toast.downloadStarted.title"), {
        description: t("admin.contentImport.toast.downloadStarted.desc"),
      });
    } catch (error: any) {
      toast.error(t("admin.contentImport.toast.downloadFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
    }
  };

  const handleImport = async (override?: { fileName: string; unitPackage: any; unitNumber?: number; onReset?: () => void }) => {
    if (!override && (!fileContent || !uploadedFile || validationReport?.status !== "success")) {
      toast.error(t("admin.contentImport.toast.cannotImport.title"), {
        description: t("admin.contentImport.toast.cannotImport.desc"),
      });
      return;
    }

    try {
      setImporting(true);
      const fileName = override?.fileName ?? uploadedFile!.name;
      let unitPackage: any = override?.unitPackage;
      if (!override) {
        try {
          unitPackage = JSON.parse(fileContent!);
        } catch (e: any) {
          toast.error(t("admin.contentImport.toast.invalidJson.title"), { description: String(e?.message || e) });
          return;
        }
      }
      const unitNumber =
        typeof override?.unitNumber === "number"
          ? override.unitNumber
          : typeof validationReport?.files?.[0]?.unitNumber === "number"
            ? validationReport!.files[0].unitNumber
            : typeof unitPackage?.unitNumber === "number"
              ? unitPackage.unitNumber
              : undefined;

      const confirm =
        importMode === "replace" && typeof unitNumber === "number"
          ? `REPLACE UNIT ${unitNumber}`
          : "IMPORT";

      if (importMode === "replace") {
        if (!unitNumber) {
          toast.error(t("admin.contentImport.toast.cannotReplace.title"), {
            description: t("admin.contentImport.toast.cannotReplace.unitMissing"),
          });
          return;
        }
        if (replaceConfirmText.trim() !== confirm) {
          toast.error(t("admin.contentImport.toast.confirmRequired.title"), {
            description: t("admin.contentImport.toast.confirmRequired.desc", { expected: confirm }),
          });
          return;
        }
      }
      
      const result = await importAction({
        files: [{ fileName, unitPackage }],
        confirm,
        mode: importMode,
        moduleId: selectedModuleId || undefined,
      });
      
      if (result.report.status === "success") {
        const firstFile = result.report.files[0];
        toast.success(t("admin.contentImport.toast.importCompleted.title"), {
          description: t("admin.contentImport.toast.importCompleted.desc", { unit: firstFile.unitNumber }),
        });
      } else {
        const firstFile = result.report.files[0];
        const firstIssue = firstFile?.parseErrors?.[0] || firstFile?.errors?.[0];
        toast.error(t("admin.contentImport.toast.importFailed.title"), {
          description: t("admin.contentImport.toast.importFailed.desc", {
            count: result.report.summary.totalErrors,
            details: firstIssue ? ` | ${firstIssue.path}: ${firstIssue.message}` : "",
          }),
        });
        return;
      }
      
      // Reset UI
      setReplaceConfirmText("");
      setMarkdownImportToConfirm(null);
      setShowImportConfirm(false);

      if (override?.onReset) {
        override.onReset();
      } else {
        // Reset JSON form
        setUploadedFile(null);
        setFileContent(null);
        setValidationReport(null);
        setSelectedModuleId(null);

        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
      
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(t("admin.contentImport.toast.importFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmImportClick = async () => {
    if (markdownImportToConfirm?.unitPackage) {
      const resetMarkdown = () => {
        setMarkdownFile(null);
        setMarkdownContent(null);
        setParseResults(null);
        setSelectedModuleId(null);
        setMarkdownImportToConfirm(null);

        const fileInput = document.getElementById('markdown-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      };

      await handleImport({
        fileName: markdownImportToConfirm.fileName,
        unitPackage: markdownImportToConfirm.unitPackage,
        unitNumber: markdownImportToConfirm.unitNumber,
        onReset: resetMarkdown,
      });
      return;
    }

    await handleImport();
  };

  const handleViewRunDetails = async (run: ImportRun) => {
    setSelectedRun(run);
    setShowRunDetails(true);
    // #region agent log
    if (__AGENT_LOG_ENABLED__) fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'history-pre',hypothesisId:'H2',location:'client/src/pages/ContentImportAdmin.tsx:handleViewRunDetails',message:'clicked View Report',data:{runId:run._id,type:run.type,status:run.status,totalErrors:run.totalErrors,filesCount:run.filesCount,unitNumbers:run.unitNumbers},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  };

  // ============= MARKDOWN IMPORT HANDLERS =============
  
  const processMarkdownFile = useCallback((file: File) => {
    if (!file.name.endsWith('.md')) {
      toast.error(t("admin.contentImport.toast.invalidFileType.title"), {
        description: t("admin.contentImport.toast.invalidMarkdownType.desc"),
      });
      return;
    }

    setMarkdownFile(file);
    setParseResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setMarkdownContent(content);
    };
    reader.onerror = () => {
      toast.error(t("admin.contentImport.toast.readFailed"));
      setMarkdownFile(null);
      setMarkdownContent(null);
    };
    reader.readAsText(file);
  }, []);

  const handleMarkdownUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processMarkdownFile(file);
  }, [processMarkdownFile]);

  const handleMarkdownDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMarkdown(true);
  }, []);

  const handleMarkdownDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMarkdown(false);
  }, []);

  const handleMarkdownDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMarkdownDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMarkdown(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processMarkdownFile(files[0]);
    }
  }, [processMarkdownFile]);

  const handleParseMarkdown = async () => {
    if (!markdownContent || !markdownFile) {
      toast.error(t("admin.contentImport.toast.noFile"));
      return;
    }

    try {
      setParsing(true);
      // #region agent log
      if (__AGENT_LOG_ENABLED__) fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H1',location:'client/src/pages/ContentImportAdmin.tsx:handleParseMarkdown:before',message:'parse markdown request',data:{fileName:markdownFile.name,contentLength:markdownContent.length,firstLine:markdownContent.split("\\n")[0] || "",secondLine:markdownContent.split("\\n")[1] || "",hasOverview:markdownContent.includes("## 1. Overview"),hasExercises:markdownContent.includes("## 5. Interactive Test"),hasExercise8:markdownContent.includes("### Exercise 8")},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const result = await parseMarkdownAction({
        files: [{ fileName: markdownFile.name, markdownContent }],
      });
      
      setParseResults(result.results);
      // #region agent log
      if (__AGENT_LOG_ENABLED__) fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H2',location:'client/src/pages/ContentImportAdmin.tsx:handleParseMarkdown:after',message:'parse markdown response',data:{files:result.results?.map((r:any)=>({fileName:r.fileName,success:r.success,errorsCount:r.errorsCount,changesCount:r.changesCount,unitNumber:r.unitNumber,firstError:r.errors?.[0] || null,firstWarning:r.warnings?.[0] || null}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // #region agent log
      if (__AGENT_LOG_ENABLED__) fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'parse-md-pre',hypothesisId:'H5',location:'client/src/pages/ContentImportAdmin.tsx:handleParseMarkdown:set-state',message:'setting parseResults state',data:{resultsLength:result.results?.length || 0,resultsFirstItem:result.results?.[0] ? {fileName:result.results[0].fileName,success:result.results[0].success,errorsCount:result.results[0].errorsCount,warningsCount:result.results[0].warningsCount} : null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      const successCount = result.results.filter((r: any) => r.success).length;
      const failedCount = result.results.length - successCount;
      
      if (successCount > 0) {
        toast.success(t("admin.contentImport.toast.parsingCompleted.title"), {
          description: t("admin.contentImport.toast.parsingCompleted.desc", { count: successCount }),
        });
      }
      
      if (failedCount > 0) {
        toast.error(t("admin.contentImport.toast.parsingFailed.title"), {
          description: t("admin.contentImport.toast.parsingFailed.desc", { count: failedCount }),
        });
      }
    } catch (error: any) {
      console.error("Parsing error:", error);
      toast.error(t("admin.contentImport.toast.parsingFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
      setParseResults(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDownloadGeneratedJson = (result: any) => {
    if (!result.unitPackage) {
      toast.error(t("admin.contentImport.toast.noJsonAvailable"));
      return;
    }

    try {
      const dataStr = JSON.stringify(result.unitPackage, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = result.fileName.replace('.md', '.json');

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();

      toast.success(t("admin.contentImport.toast.downloadStarted.title"));
    } catch (error: any) {
      toast.error(t("admin.contentImport.toast.downloadFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
    }
  };

  const handleImportFromMarkdown = async (result: any) => {
    if (!result.success || !result.unitPackage) {
      toast.error(t("admin.contentImport.toast.cannotImport.title"), {
        description: t("admin.contentImport.toast.cannotImportMarkdown.desc"),
      });
      return;
    }

    try {
      if (importMode === "replace") {
        setMarkdownImportToConfirm({
          fileName: result.fileName,
          unitNumber: result.unitNumber,
          unitPackage: result.unitPackage,
        });
        setReplaceConfirmText("");
        setShowImportConfirm(true);
        return;
      }

      setImporting(true);
      
      const importResult = await importAction({
        files: [{ fileName: result.fileName, unitPackage: result.unitPackage }],
        confirm: "IMPORT",
        mode: "update",
        moduleId: selectedModuleId || undefined
      });

      if (importResult.report.status === "success") {
        toast.success(t("admin.contentImport.toast.importCompleted.title"), {
          description: t("admin.contentImport.toast.importCompleted.desc", { unit: result.unitNumber }),
        });

        // Reset Markdown form
        setMarkdownFile(null);
        setMarkdownContent(null);
        setParseResults(null);
        setSelectedModuleId(null);

        // Reset file input
        const fileInput = document.getElementById('markdown-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const firstFile = importResult.report.files[0];
        const firstIssue = firstFile?.parseErrors?.[0] || firstFile?.errors?.[0];
        toast.error(t("admin.contentImport.toast.importFailed.title"), {
          description: t("admin.contentImport.toast.importFailed.desc", {
            count: importResult.report.summary.totalErrors,
            details: firstIssue ? ` | ${firstIssue.path}: ${firstIssue.message}` : "",
          }),
        });
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(t("admin.contentImport.toast.importFailed.title"), {
        description: error?.message || t("admin.contentImport.toast.unknownError"),
      });
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (status: "success" | "failed", type: "validate" | "import") => {
    if (status === "success") {
      if (type === "import") {
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Imported</Badge>;
      } else {
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><FileCheck className="h-3 w-3 mr-1" />Valid</Badge>;
      }
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    }
  };

  const humanizeModuleError = (message: string) => {
    if (message.includes("MODULE_SLUG_TAKEN")) return "Slug is already in use. Please choose a unique slug.";
    if (message.includes("MODULE_NUMBER_TAKEN")) return "Module number is already in use. Please choose a different number.";
    if (message.includes("INVALID_MODULE_NUMBER")) return "Module number must be a positive number.";
    if (message.includes("INVALID_SLUG")) return "Slug is invalid. Use letters/numbers and hyphens.";
    if (message.includes("MISSING_REQUIRED_FIELDS")) return "Please fill all required fields.";
    if (message.includes("Unauthorized")) return "Unauthorized. Superadmin required.";
    return message;
  };

  const resetNewModuleForm = () => {
    setNewModuleNumber("");
    setNewTitleEn("");
    setNewTitleDe("");
    setNewDescriptionEn("");
    setNewDescriptionDe("");
    setNewSlug("");
    setNewSlugTouched(false);
  };

  const handleCreateModule = async () => {
    try {
      const moduleNumber = Number(newModuleNumber);
      const slug = newSlug || slugify(newTitleEn);

      await createModuleMutation({
        moduleNumber,
        slug,
        titleEn: newTitleEn,
        titleDe: newTitleDe,
        descriptionEn: newDescriptionEn,
        descriptionDe: newDescriptionDe,
      });

      toast.success(t("admin.contentImport.toast.moduleCreated"));
      resetNewModuleForm();
    } catch (error: any) {
      toast.error(t("admin.contentImport.toast.moduleCreateFailed.title"), {
        description: humanizeModuleError(String(error?.message || error)),
      });
    }
  };

  const openEditModule = (m: Doc<"moduleMetadata">) => {
    setEditingModuleId(m._id);
    setEditModuleNumber(String(m.moduleNumber ?? ""));
    setEditSlug(String(m.slug ?? ""));
    setEditTitleEn(String(m.titleEn ?? ""));
    setEditTitleDe(String(m.titleDe ?? ""));
    setEditDescriptionEn(String(m.descriptionEn ?? ""));
    setEditDescriptionDe(String(m.descriptionDe ?? ""));
    setEditDialogOpen(true);
  };

  const handleSaveEditModule = async () => {
    if (!editingModuleId) return;
    try {
      const moduleNumber = Number(editModuleNumber);
      await updateModuleMutation({
        moduleId: editingModuleId,
        moduleNumber,
        slug: editSlug,
        titleEn: editTitleEn,
        titleDe: editTitleDe,
        descriptionEn: editDescriptionEn,
        descriptionDe: editDescriptionDe,
      });

      toast.success(t("admin.contentImport.toast.moduleUpdated"));
      setEditDialogOpen(false);
      setEditingModuleId(null);
    } catch (error: any) {
      toast.error(t("admin.contentImport.toast.moduleUpdateFailed.title"), {
        description: humanizeModuleError(String(error?.message || error)),
      });
    }
  };

  // Units tab removed — unit management is now in Content Studio > Unit Manager

  return (
    <div className="space-y-6">
      <Tabs defaultValue={ENABLE_JSON_IMPORT ? "import" : "markdown"} className="space-y-6">
        <TabsList>
          {ENABLE_JSON_IMPORT && (
            <TabsTrigger value="import" className="gap-2">
              <FileJson className="h-4 w-4" />
              Import JSON
            </TabsTrigger>
          )}
          <TabsTrigger value="markdown" className="gap-2">
            <FileText className="h-4 w-4" />
            Import Markdown
          </TabsTrigger>
          {/* Units tab removed — now in Content Studio > Unit Manager */}
          <TabsTrigger value="modules" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {ENABLE_JSON_IMPORT && (
        <TabsContent value="import" className="space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Upload JSON Unit Package
              </CardTitle>
              <CardDescription>
                Select a JSON file containing unit content, vocabulary, and exercises.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-300"
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <FileJson className={`h-12 w-12 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-medium">
                      {uploadedFile 
                        ? uploadedFile.name 
                        : isDragging 
                          ? "Drop JSON file here" 
                          : "Click to upload or drag & drop JSON file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported format: unitPackage.v1
                    </p>
                  </label>
                </div>

                {uploadedFile && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleValidate}
                      disabled={validating || !fileContent}
                      className="flex-1"
                    >
                      {validating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4 mr-2" />
                          Validate
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validationReport && validationReport.files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {validationReport.status === "success" ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Validation Passed
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      Validation Failed
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  Unit {validationReport.files[0].unitNumber} | {validationReport.files[0].title}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Total Errors:</span> {validationReport.summary.totalErrors}
                  </div>
                  <div>
                    <span className="font-semibold">Auto-fixes:</span> {validationReport.files[0].changesCount}
                  </div>
                </div>

                {/* Import mode */}
                <div className="space-y-2">
                  <Label>Import mode</Label>
                  <Select
                    value={importMode}
                    onValueChange={(value) => {
                      setImportMode(value as any);
                      setReplaceConfirmText("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select import mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="update">Update (keep progress)</SelectItem>
                      <SelectItem value="replace">Replace (progress reset)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Update patches existing rows. Replace archives the current active unit content/vocabulary/tests and writes a new version (learning view shows latest active).
                  </p>
                  {importMode === "replace" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Replace is a superadmin-only operation and resets progress for this unit by creating a new version.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Auto-fixes Applied */}
                {validationReport.files[0].changesCount > 0 && (
                  <Alert>
                    <FileWarning className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Auto-fixes applied ({validationReport.files[0].changesCount}):</p>
                      <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                        {validationReport.files[0].changesPreview.slice(0, 10).map((change, idx) => (
                          <li key={idx} className="font-mono">
                            {change.kind} @ {change.path}
                            {change.note && <span className="text-muted-foreground"> - {change.note}</span>}
                          </li>
                        ))}
                        {validationReport.files[0].changesCount > 10 && (
                          <li className="text-muted-foreground">... and {validationReport.files[0].changesCount - 10} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation Issues */}
                {(validationReport.files[0].errors.length > 0 || validationReport.files[0].parseErrors.length > 0) && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Validation Issues:</h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {validationReport.files[0].parseErrors.map((issue, idx) => (
                        <div
                          key={`parse-${idx}`}
                          className="p-3 rounded-lg border bg-red-50 border-red-200"
                        >
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-muted-foreground">
                                {issue.path}
                              </p>
                              <p className="text-sm">{issue.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {validationReport.files[0].errors.map((issue, idx) => (
                        <div
                          key={`error-${idx}`}
                          className="p-3 rounded-lg border bg-red-50 border-red-200"
                        >
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-muted-foreground">
                                {issue.path}
                              </p>
                              <p className="text-sm">{issue.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Module Selection (only if validation passed) */}
                {validationReport.status === "success" && (
                  <div className="space-y-2 pt-4 border-t">
                    <Label htmlFor="module-select" className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4" />
                      Select Module (Optional)
                    </Label>
                    <Select
                      value={selectedModuleId || "none"}
                      onValueChange={(value) => setSelectedModuleId(value === "none" ? null : value as Id<"moduleMetadata">)}
                    >
                      <SelectTrigger id="module-select">
                        <SelectValue placeholder="Use module from JSON or select manually" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use module from JSON file</SelectItem>
                        {availableModules && availableModules.length > 0 && (
                          <>
                            {availableModules.map((module) => (
                              <SelectItem key={module._id} value={module._id}>
                                Module {module.moduleNumber}: {module.title}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedModuleId 
                        ? "This unit will be assigned to the selected module above." 
                        : "No module selected. The unit will be assigned based on the module information in the JSON file."}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  {validationReport.files[0].changesCount > 0 && !!validationReport.files[0].fixedPackage && (
                    <Button
                      variant="outline"
                      onClick={handleDownloadFixedJson}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Fixed JSON
                    </Button>
                  )}
                  {validationReport.status === "success" && (
                    <Button
                      onClick={() => {
                        setMarkdownImportToConfirm(null);
                        setReplaceConfirmText("");
                        setShowImportConfirm(true);
                      }}
                      disabled={importing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Import to Database
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        )}

        <TabsContent value="markdown" className="space-y-6">
          {/* Markdown Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload Markdown File
              </CardTitle>
              <CardDescription>
                Upload a Markdown file (.md) from external AI to automatically convert to JSON and import.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDraggingMarkdown 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-300"
                  }`}
                  onDragEnter={handleMarkdownDragEnter}
                  onDragLeave={handleMarkdownDragLeave}
                  onDragOver={handleMarkdownDragOver}
                  onDrop={handleMarkdownDrop}
                >
                  <input
                    id="markdown-upload"
                    type="file"
                    accept=".md"
                    onChange={handleMarkdownUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="markdown-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <FileText className={`h-12 w-12 ${isDraggingMarkdown ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-medium">
                      {markdownFile 
                        ? markdownFile.name 
                        : isDraggingMarkdown 
                          ? "Drop Markdown file here" 
                          : "Click to upload or drag & drop Markdown file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supported format: .md (Unit content from external AI)
                    </p>
                  </label>
                </div>

                {markdownFile && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleParseMarkdown}
                      disabled={parsing || !markdownContent}
                      className="flex-1"
                    >
                      {parsing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Parsing to JSON...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Parse to JSON
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Parse Results */}
          {parseResults && parseResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Parsing Results
                </CardTitle>
                <CardDescription>
                  Review the generated JSON packages before importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Auto-Fixes</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{result.fileName}</TableCell>
                        <TableCell>
                          {result.success && result.unitNumber 
                            ? `Unit ${result.unitNumber}` 
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.changesCount ? (
                            <Badge variant="outline">{result.changesCount}</Badge>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell>
                          {result.errorsCount > 0 ? (
                            <span className="text-red-600">{result.errorsCount}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedJsonPreview(result);
                                setShowJsonPreview(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadGeneratedJson(result)}
                              disabled={!result.success}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              JSON
                            </Button>
                            {result.success && (
                              <Button
                                size="sm"
                                onClick={() => handleImportFromMarkdown(result)}
                                disabled={importing}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Database className="h-4 w-4 mr-1" />
                                Import
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Module Selection for Markdown Import */}
                {parseResults.some((r: any) => r.success) && (
                  <div className="mt-6 pt-6 border-t space-y-2">
                    <Label htmlFor="markdown-module-select" className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4" />
                      Select Module for Import (Optional)
                    </Label>
                    <Select
                      value={selectedModuleId || "none"}
                      onValueChange={(value) => setSelectedModuleId(value === "none" ? null : value as Id<"moduleMetadata">)}
                    >
                      <SelectTrigger id="markdown-module-select">
                        <SelectValue placeholder="Use module from JSON or select manually" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Use module from parsed JSON</SelectItem>
                        {availableModules && availableModules.length > 0 && (
                          <>
                            {availableModules.map((module) => (
                              <SelectItem key={module._id} value={module._id}>
                                Module {module.moduleNumber}: {module.title}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This module will be used for all valid units when clicking Import.
                    </p>

                    <div className="mt-4 space-y-2">
                      <Label>Import mode</Label>
                      <Select
                        value={importMode}
                        onValueChange={(value) => {
                          setImportMode(value as any);
                          setReplaceConfirmText("");
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select import mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="update">Update (keep progress)</SelectItem>
                          <SelectItem value="replace">Replace (progress reset)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Update patches existing rows. Replace archives the current active unit and writes a new version (learning view shows latest active).
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Units TabsContent removed — unit management moved to Content Studio > Unit Manager */}

        <TabsContent value="modules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Module Management
              </CardTitle>
              <CardDescription>
                Create and update modules (EN + DE). These modules are used to group units and to assign units during import.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Module number</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="1"
                    value={newModuleNumber}
                    onChange={(e) => setNewModuleNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    placeholder="foundation"
                    value={newSlug}
                    onChange={(e) => {
                      setNewSlugTouched(true);
                      setNewSlug(e.target.value);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in URLs and as stable identifier. Auto-generated from Title (EN) until edited.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Title (EN)</Label>
                  <Input
                    placeholder="Module 1: Foundation"
                    value={newTitleEn}
                    onChange={(e) => setNewTitleEn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title (DE)</Label>
                  <Input
                    placeholder="Modul 1: Grundlagen"
                    value={newTitleDe}
                    onChange={(e) => setNewTitleDe(e.target.value)}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Description (EN)</Label>
                  <Textarea
                    placeholder="Short description shown in the app (English)."
                    value={newDescriptionEn}
                    onChange={(e) => setNewDescriptionEn(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description (DE)</Label>
                  <Textarea
                    placeholder="Kurze Beschreibung in der App (Deutsch)."
                    value={newDescriptionDe}
                    onChange={(e) => setNewDescriptionDe(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button onClick={() => void handleCreateModule()} className="gap-2">
                  <FolderTree className="h-4 w-4" />
                  Create Module
                </Button>
                <Button variant="outline" onClick={resetNewModuleForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Modules</CardTitle>
              <CardDescription>Sorted by moduleNumber (as stored).</CardDescription>
            </CardHeader>
            <CardContent>
              {dbModules === undefined ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : dbModules.length === 0 ? (
                <Alert>
                  <AlertDescription>No modules found in the database yet.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Title (EN)</TableHead>
                      <TableHead>Title (DE)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbModules.map((m) => (
                      <TableRow key={m._id}>
                        <TableCell className="font-medium">{m.moduleNumber ?? "—"}</TableCell>
                        <TableCell>{m.slug ?? "—"}</TableCell>
                        <TableCell>{m.titleEn ?? "—"}</TableCell>
                        <TableCell>{m.titleDe ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => openEditModule(m)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Edit Module</AlertDialogTitle>
                <AlertDialogDescription>
                  Update module fields. Slug and module number must remain unique.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid gap-4 md:grid-cols-2 py-2">
                <div className="space-y-2">
                  <Label>Module number</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={editModuleNumber}
                    onChange={(e) => setEditModuleNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Title (EN)</Label>
                  <Input value={editTitleEn} onChange={(e) => setEditTitleEn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Title (DE)</Label>
                  <Input value={editTitleDe} onChange={(e) => setEditTitleDe(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description (EN)</Label>
                  <Textarea value={editDescriptionEn} onChange={(e) => setEditDescriptionEn(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description (DE)</Label>
                  <Textarea value={editDescriptionDe} onChange={(e) => setEditDescriptionDe(e.target.value)} />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingModuleId(null);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    // Prevent AlertDialogAction default close until mutation succeeds.
                    e.preventDefault();
                    void handleSaveEditModule();
                  }}
                >
                  Save
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                View all content import operations performed via this admin tool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : runs && runs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File(s)</TableHead>
                      <TableHead>Unit(s)</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run._id}>
                        <TableCell className="font-medium">
                          {run.fileNames.length === 1 ? run.fileNames[0] : `${run.fileNames.length} files`}
                        </TableCell>
                        <TableCell>
                          {run.unitNumbers.length > 0 
                            ? run.unitNumbers.map(n => `Unit ${n}`).join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={run.type === "import" ? "default" : "outline"}>
                            {run.type === "import" ? "Import" : "Validate"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {run.type === "import" && run.mode ? (
                            <Badge variant={run.mode === "replace" ? "destructive" : "secondary"}>
                              {run.mode}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {run.type === "import" && typeof run.unitVersion === "number" ? `v${run.unitVersion}` : "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(run.status, run.type)}</TableCell>
                        <TableCell>
                          {run.totalErrors > 0 ? (
                            <span className="text-red-600">{run.totalErrors}</span>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTimeEU(run.startedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewRunDetails(run)}
                          >
                            View Report
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No import history found. Start by uploading and validating a JSON file.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will import <strong>Unit {confirmUnitNumber ?? "—"}</strong> into the database.
                This action will create or update content, vocabulary, and exercises.
              </p>
              {selectedModuleId && availableModules && (
                <p className="text-sm bg-blue-50 border border-blue-200 rounded p-2">
                  <strong>Module:</strong> {availableModules.find(m => m._id === selectedModuleId)?.title || "Selected Module"}
                </p>
              )}
              {!selectedModuleId && (
                <p className="text-sm bg-gray-50 border border-gray-200 rounded p-2">
                  <strong>Module:</strong> From package (Module {
                    markdownImportToConfirm?.unitPackage?.module?.moduleNumber ??
                    ((validationReport?.files?.[0]?.fixedPackage as any)?.module?.moduleNumber ?? "—")
                  })
                </p>
              )}
              {importMode === "replace" && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm bg-red-50 border border-red-200 rounded p-2">
                    <strong>Replace mode:</strong> the current active version will be archived (soft delete), and a new version will be written. Learning view will show the newest active version.
                  </p>
                  {replacePreview === undefined ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading replace preview...
                    </p>
                  ) : replacePreview ? (
                    <p className="text-sm bg-gray-50 border border-gray-200 rounded p-2">
                      <strong>Will archive:</strong> {replacePreview.willArchive.content} content rows, {replacePreview.willArchive.vocabulary} vocab rows, {replacePreview.willArchive.tests} test rows.{" "}
                      <strong>New version:</strong> {replacePreview.nextUnitVersion}
                    </p>
                  ) : null}

                  <div className="space-y-1">
                    <Label>Type to confirm</Label>
                    <p className="text-xs text-muted-foreground font-mono">
                      {expectedReplaceConfirm || "REPLACE UNIT <n>"}
                    </p>
                    <Input
                      value={replaceConfirmText}
                      onChange={(e) => setReplaceConfirmText(e.target.value)}
                      placeholder={expectedReplaceConfirm || "REPLACE UNIT <n>"}
                    />
                  </div>
                </div>
              )}
              <p className="pt-2">
                <strong>Are you sure you want to proceed?</strong>
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImportClick}
              disabled={
                importing ||
                (importMode === "replace" && expectedReplaceConfirm.length > 0 && replaceConfirmText.trim() !== expectedReplaceConfirm)
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Yes, Import"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run Details Dialog */}
      <AlertDialog open={showRunDetails} onOpenChange={setShowRunDetails}>
        <AlertDialogContent
          data-agent="run-details-modal"
          className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[90vh] max-h-[90vh] overflow-y-auto overflow-x-hidden"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3"
            onClick={() => {
              setShowRunDetails(false);
              setSelectedRun(null);
              setSelectedRunFull(null);
            }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Report Details</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRun?.fileNames.join(", ")} | {selectedRun && formatDateTimeEU(selectedRun.startedAt)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {selectedRun && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Status:</span> {getStatusBadge(selectedRun.status, selectedRun.type)}
                  </div>
                  <div>
                    <span className="font-semibold">Type:</span> {selectedRun.type}
                  </div>
                  <div>
                    <span className="font-semibold">Files:</span> {selectedRun.filesCount}
                  </div>
                  <div>
                    <span className="font-semibold">Units:</span> {selectedRun.unitNumbers.join(", ") || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Errors:</span> <span className={selectedRun.totalErrors > 0 ? "text-red-600" : "text-green-600"}>{selectedRun.totalErrors}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Warnings:</span> {selectedRun.totalWarnings}
                  </div>
                </div>
                {getRun && (
                  <div>
                    <h4 className="font-semibold mb-2">Full Report (JSON):</h4>
                    <pre
                      data-agent="run-details-pre"
                      className="bg-muted p-4 rounded-lg text-xs whitespace-pre-wrap break-all overflow-x-hidden overflow-y-auto max-h-[65vh]"
                    >
                      {JSON.stringify(JSON.parse(getRun.reportJson), null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowRunDetails(false);
              setSelectedRun(null);
              setSelectedRunFull(null);
            }}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* JSON Preview Dialog */}
      <AlertDialog open={showJsonPreview} onOpenChange={setShowJsonPreview}>
        <AlertDialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[90vh] max-h-[90vh] overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle>Generated JSON Preview</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedJsonPreview?.fileName} | Unit {selectedJsonPreview?.unitNumber}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            {selectedJsonPreview && (
              <>
                {/* Status Summary */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Status:</span>{" "}
                    {selectedJsonPreview.success ? (
                      <Badge className="bg-green-100 text-green-800">Valid</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Invalid</Badge>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">Auto-Fixes:</span> {selectedJsonPreview.changesCount || 0}
                  </div>
                  <div>
                    <span className="font-semibold">Errors:</span>{" "}
                    <span className={selectedJsonPreview.errorsCount > 0 ? "text-red-600" : "text-green-600"}>
                      {selectedJsonPreview.errorsCount}
                    </span>
                  </div>
                </div>

                {/* High-level error message (e.g. structure validation / thrown parsing error) */}
                {(selectedJsonPreview.error || selectedJsonPreview.structureErrors?.length) && (
                  <div className="text-xs bg-red-50 border border-red-200 rounded p-3 space-y-2">
                    {selectedJsonPreview.error ? (
                      <div>
                        <div className="font-semibold text-red-700 mb-1">Error</div>
                        <div className="text-red-800">{String(selectedJsonPreview.error)}</div>
                      </div>
                    ) : null}
                    {Array.isArray(selectedJsonPreview.structureErrors) && selectedJsonPreview.structureErrors.length > 0 ? (
                      <div>
                        <div className="font-semibold text-red-700 mb-1">Structure Errors</div>
                        <ul className="list-disc ml-5 space-y-1">
                          {selectedJsonPreview.structureErrors.map((e: any, i: number) => (
                            <li key={i} className="text-red-800">{String(e)}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Errors */}
                {selectedJsonPreview.errors && selectedJsonPreview.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-red-600">Validation Errors:</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {selectedJsonPreview.errors.map((err: any, idx: number) => (
                        <div key={idx} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                          <code className="text-muted-foreground">{err.path}</code>
                          <p>{err.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Changes */}
                {((selectedJsonPreview.changesPreview || selectedJsonPreview.changes) ?? []).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-orange-600">Auto-Fixes Applied:</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {((selectedJsonPreview.changesPreview || selectedJsonPreview.changes) ?? []).map((change: any, idx: number) => (
                        <div key={idx} className="text-xs bg-orange-50 border border-orange-200 rounded p-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <strong>{String(change.kind ?? "autofix")}</strong>
                            <span className="text-muted-foreground">at</span>
                            <code className="text-muted-foreground">
                              {Array.isArray(change.path) ? change.path.join(".") : String(change.path ?? "(unknown path)")}
                            </code>
                          </div>
                          {change.note ? <p className="mt-1">{change.note}</p> : null}
                          {"before" in change || "after" in change ? (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                              {"before" in change ? (
                                <div className="bg-white/60 border rounded p-2">
                                  <div className="font-semibold mb-1">Before</div>
                                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify((change as any).before, null, 2)}</pre>
                                </div>
                              ) : null}
                              {"after" in change ? (
                                <div className="bg-white/60 border rounded p-2">
                                  <div className="font-semibold mb-1">After</div>
                                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify((change as any).after, null, 2)}</pre>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generated JSON */}
                <div>
                  <h4 className="font-semibold mb-2">Generated JSON Unit Package:</h4>
                  <div className="bg-muted rounded-lg text-xs border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/60">
                      <span className="font-semibold">JSON (with line numbers)</span>
                    </div>
                    <div className="overflow-y-auto max-h-[55vh]">
                      {(() => {
                        const text = selectedJsonPreview.unitPackage
                          ? JSON.stringify(selectedJsonPreview.unitPackage, null, 2)
                          : "No JSON available";
                        const lines = text.split("\n");
                        return (
                          <div className="font-mono">
                            {lines.map((line: string, i: number) => (
                              <div key={i} className="grid grid-cols-[64px_1fr] gap-3 px-4">
                                <div className="text-muted-foreground select-none text-right pr-2 border-r">
                                  {i + 1}
                                </div>
                                <div className="whitespace-pre-wrap break-words">{line}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowJsonPreview(false);
              setSelectedJsonPreview(null);
            }}>Close</AlertDialogCancel>
            {selectedJsonPreview?.success && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedJsonPreview) {
                      handleDownloadGeneratedJson(selectedJsonPreview);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
                <Button
                  onClick={() => {
                    setShowJsonPreview(false);
                    if (selectedJsonPreview) {
                      handleImportFromMarkdown(selectedJsonPreview);
                    }
                  }}
                  disabled={importing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Import to Database
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ContentImportAdmin() {
  useEffect(() => {
    window.location.replace("/admin/content-studio?view=import");
  }, []);
  return null;
}
