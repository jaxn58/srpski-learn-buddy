import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  Brain,
  Inbox,
  Archive,
  Pencil,
  Trash2,
  CheckCircle2,
  Search,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ValidatorMemoryEntry = {
  _id: Id<"contentStudioValidatorMemory">;
  fingerprint: string;
  stage: "validator" | "auditor";
  code: string;
  path?: string;
  title: string;
  guidance: string;
  exampleBefore?: string;
  exampleAfter?: string;
  pattern?: string;
  patternFlags?: string;
  scope: {
    applyInCreator: boolean;
    applyInFix: boolean;
    applyInValidator: boolean;
    applyInTranslator?: boolean;
  };
  status: "candidate" | "active" | "archived";
  sourceDraftId?: Id<"contentDrafts">;
  sourceUnitNumber?: number;
  occurrenceCount: number;
  lastSeenAt: number;
  createdAt: number;
  updatedAt: number;
};

type StatusFilter = "all" | "candidate" | "active" | "archived";

type EditorState = {
  mode: "create" | "edit";
  entry?: ValidatorMemoryEntry;
  title: string;
  guidance: string;
  exampleBefore: string;
  exampleAfter: string;
  pattern: string;
  patternFlags: string;
  stage: "validator" | "auditor";
  code: string;
  path: string;
  scope: {
    applyInCreator: boolean;
    applyInFix: boolean;
    applyInValidator: boolean;
    applyInTranslator: boolean;
  };
};

const EMPTY_EDITOR: EditorState = {
  mode: "create",
  title: "",
  guidance: "",
  exampleBefore: "",
  exampleAfter: "",
  pattern: "",
  patternFlags: "",
  stage: "validator",
  code: "",
  path: "",
  scope: {
    applyInCreator: true,
    applyInFix: true,
    applyInValidator: false,
    applyInTranslator: false,
  },
};

function formatTimestamp(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "-";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function ScopeBadges({ scope }: { scope: ValidatorMemoryEntry["scope"] }) {
  const { t } = useTranslation();
  const inTranslator = scope.applyInTranslator === true;
  return (
    <div className="flex flex-wrap gap-1">
      {scope.applyInCreator && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {t("admin.contentStudio.validatorMemory.scopeCreator", "Creator")}
        </Badge>
      )}
      {scope.applyInFix && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {t("admin.contentStudio.validatorMemory.scopeFix", "Fix")}
        </Badge>
      )}
      {scope.applyInValidator && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {t("admin.contentStudio.validatorMemory.scopeValidator", "Validator")}
        </Badge>
      )}
      {inTranslator && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {t("admin.contentStudio.validatorMemory.scopeTranslator", "Translator")}
        </Badge>
      )}
      {!scope.applyInCreator && !scope.applyInFix && !scope.applyInValidator && !inTranslator && (
        <Badge variant="secondary" className="text-[10px]">
          {t("admin.contentStudio.validatorMemory.scopeNone", "No scope")}
        </Badge>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ValidatorMemoryEntry["status"] }) {
  const { t } = useTranslation();
  if (status === "candidate") {
    return <Badge variant="secondary">{t("admin.contentStudio.validatorMemory.statusCandidate", "Candidate")}</Badge>;
  }
  if (status === "active") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        {t("admin.contentStudio.validatorMemory.statusActive", "Active")}
      </Badge>
    );
  }
  return <Badge variant="outline">{t("admin.contentStudio.validatorMemory.statusArchived", "Archived")}</Badge>;
}

export function ValidatorMemoryPanel() {
  const { t } = useTranslation();
  const all = (useQuery(api.contentStudio.listValidatorMemory, {}) ?? []) as unknown as ValidatorMemoryEntry[];

  const createEntry = useMutation(api.contentStudio.createValidatorMemoryEntry);
  const updateEntry = useMutation(api.contentStudio.updateValidatorMemoryEntry);
  const setStatus = useMutation(api.contentStudio.setValidatorMemoryStatus);
  const deleteEntry = useMutation(api.contentStudio.deleteValidatorMemoryEntry);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ValidatorMemoryEntry | null>(null);

  const candidates = useMemo(
    () =>
      all
        .filter((e) => e.status === "candidate")
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [all]
  );

  const filteredActive = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return all
      .filter((e) => {
        if (statusFilter === "all") return true;
        return e.status === statusFilter;
      })
      .filter((e) => {
        if (!needle) return true;
        return (
          e.title.toLowerCase().includes(needle) ||
          e.code.toLowerCase().includes(needle) ||
          (e.path ?? "").toLowerCase().includes(needle) ||
          e.guidance.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (b.occurrenceCount !== a.occurrenceCount) {
          return b.occurrenceCount - a.occurrenceCount;
        }
        return b.lastSeenAt - a.lastSeenAt;
      });
  }, [all, statusFilter, search]);

  const openCreate = () => setEditor({ ...EMPTY_EDITOR });

  const openEdit = (entry: ValidatorMemoryEntry) => {
    setEditor({
      mode: "edit",
      entry,
      title: entry.title ?? "",
      guidance: entry.guidance ?? "",
      exampleBefore: entry.exampleBefore ?? "",
      exampleAfter: entry.exampleAfter ?? "",
      pattern: entry.pattern ?? "",
      patternFlags: entry.patternFlags ?? "",
      stage: entry.stage,
      code: entry.code,
      path: entry.path ?? "",
      scope: {
        applyInCreator: entry.scope.applyInCreator,
        applyInFix: entry.scope.applyInFix,
        applyInValidator: entry.scope.applyInValidator,
        applyInTranslator: entry.scope.applyInTranslator === true,
      },
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editor) return;
    if (!editor.title.trim()) {
      toast.error(t("admin.contentStudio.validatorMemory.errorTitleRequired", "Title is required"));
      return;
    }
    if (editor.mode === "create" && !editor.code.trim()) {
      toast.error(t("admin.contentStudio.validatorMemory.errorCodeRequired", "Code is required"));
      return;
    }
    if (editor.pattern.trim()) {
      try {
        new RegExp(editor.pattern, editor.patternFlags || undefined);
      } catch {
        toast.error(t("admin.contentStudio.validatorMemory.errorInvalidRegex", "Invalid regex in the pattern field"));
        return;
      }
    }
    setSaving(true);
    try {
      if (editor.mode === "create") {
        await createEntry({
          stage: editor.stage,
          code: editor.code.trim(),
          path: editor.path.trim() || undefined,
          title: editor.title.trim(),
          guidance: editor.guidance.trim(),
          exampleBefore: editor.exampleBefore.trim() || undefined,
          exampleAfter: editor.exampleAfter.trim() || undefined,
          pattern: editor.pattern.trim() || undefined,
          patternFlags: editor.patternFlags.trim() || undefined,
          scope: editor.scope,
          status: "active",
        });
        toast.success(t("admin.contentStudio.validatorMemory.toastCreated", "Memory entry created"));
      } else if (editor.entry) {
        await updateEntry({
          entryId: editor.entry._id,
          title: editor.title.trim(),
          guidance: editor.guidance.trim(),
          exampleBefore: editor.exampleBefore,
          exampleAfter: editor.exampleAfter,
          pattern: editor.pattern,
          patternFlags: editor.patternFlags,
          scope: editor.scope,
        });
        toast.success(t("admin.contentStudio.validatorMemory.toastSaved", "Memory entry saved"));
      }
      closeEditor();
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.validatorMemory.toastSaveFailed", "Saving failed"));
      setSaving(false);
    }
  };

  const handleActivate = async (entry: ValidatorMemoryEntry) => {
    if (!entry.title.trim() || entry.title === entry.code) {
      toast.error(t("admin.contentStudio.validatorMemory.errorCurateFirst", "Curate title and guidance first."));
      openEdit(entry);
      return;
    }
    if (!entry.guidance.trim()) {
      toast.error(t("admin.contentStudio.validatorMemory.errorGuidanceFirst", "Add guidance first."));
      openEdit(entry);
      return;
    }
    try {
      await setStatus({ entryId: entry._id, status: "active" });
      toast.success(t("admin.contentStudio.validatorMemory.toastActivated", "Entry activated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.validatorMemory.toastActivateFailed", "Activation failed"));
    }
  };

  const handleArchive = async (entry: ValidatorMemoryEntry) => {
    try {
      await setStatus({ entryId: entry._id, status: "archived" });
      toast.success(t("admin.contentStudio.validatorMemory.toastArchived", "Entry archived"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.validatorMemory.toastArchiveFailed", "Archiving failed"));
    }
  };

  const handleReactivate = async (entry: ValidatorMemoryEntry) => {
    try {
      await setStatus({ entryId: entry._id, status: "active" });
      toast.success(t("admin.contentStudio.validatorMemory.toastReactivated", "Entry reactivated"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.validatorMemory.toastReactivateFailed", "Reactivation failed"));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteEntry({ entryId: confirmDelete._id });
      toast.success(t("admin.contentStudio.validatorMemory.toastDeleted", "Entry deleted"));
    } catch (e: any) {
      toast.error(e?.message || t("admin.contentStudio.validatorMemory.toastDeleteFailed", "Deletion failed"));
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("admin.contentStudio.validatorMemory.title", "Validator memory")}
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t(
              "admin.contentStudio.validatorMemory.description",
              "The Content Studio's memory. Curate lessons learned from resolved findings here. Active entries automatically flow into Creator, Fix and Validator runs."
            )}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t("admin.contentStudio.validatorMemory.newEntry", "New entry")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4" />
                {t("admin.contentStudio.validatorMemory.inboxTitle", "Candidate inbox")}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {t(
                  "admin.contentStudio.validatorMemory.inboxHelp",
                  "Automatically captured findings that were recently resolved. Curate title and guidance, then activate."
                )}
              </div>
            </div>
            <Badge variant="secondary">{candidates.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-4">
              {t(
                "admin.contentStudio.validatorMemory.inboxEmpty",
                "No open candidates. Auto-captured entries appear here after the next fix-findings cycle."
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-md border p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {entry.stage}
                      </Badge>
                      <code className="text-[11px]">{entry.code}</code>
                      {entry.path && (
                        <span className="text-[11px] truncate">
                          {t("admin.contentStudio.validatorMemory.pathLabel", {
                            defaultValue: "Path: {{path}}",
                            path: entry.path,
                          })}
                        </span>
                      )}
                      {typeof entry.sourceUnitNumber === "number" && (
                        <span className="text-[11px]">
                          {t("admin.contentStudio.validatorMemory.unitNumber", {
                            defaultValue: "Unit {{n}}",
                            n: entry.sourceUnitNumber,
                          })}
                        </span>
                      )}
                      <span className="text-[11px]">
                        {t("admin.contentStudio.validatorMemory.lastSeen", {
                          defaultValue: "Last seen: {{when}}",
                          when: formatTimestamp(entry.lastSeenAt),
                        })}
                      </span>
                      <span className="text-[11px]">
                        {t("admin.contentStudio.validatorMemory.occurrences", {
                          defaultValue: "x{{n}}",
                          n: entry.occurrenceCount,
                        })}
                      </span>
                    </div>
                    {entry.exampleBefore && (
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                        {entry.exampleBefore}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(entry)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t("admin.contentStudio.validatorMemory.curate", "Curate")}
                    </Button>
                    <Button size="sm" onClick={() => handleActivate(entry)}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      {t("admin.contentStudio.validatorMemory.activate", "Activate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(entry)}
                    >
                      <Archive className="mr-1.5 h-3.5 w-3.5" />
                      {t("admin.contentStudio.validatorMemory.discard", "Discard")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t("admin.contentStudio.validatorMemory.entriesTitle", "Memory entries")}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {t("admin.contentStudio.validatorMemory.entriesHelp", "All captured entries, filtered by status and search.")}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin.contentStudio.validatorMemory.searchPlaceholder", "Search (title, code, path, guidance)")}
                  className="pl-7 h-8 w-64"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("admin.contentStudio.validatorMemory.statusActive", "Active")}</SelectItem>
                  <SelectItem value="candidate">{t("admin.contentStudio.validatorMemory.statusCandidate", "Candidate")}</SelectItem>
                  <SelectItem value="archived">{t("admin.contentStudio.validatorMemory.statusArchived", "Archived")}</SelectItem>
                  <SelectItem value="all">{t("admin.contentStudio.validatorMemory.filterAll", "All")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filteredActive.length === 0 ? (
            <div className="text-sm text-muted-foreground italic px-6 py-6">
              {t("admin.contentStudio.validatorMemory.entriesEmpty", "No entries for this filter.")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.contentStudio.validatorMemory.colStatus", "Status")}</TableHead>
                    <TableHead>{t("admin.contentStudio.validatorMemory.colTitleCode", "Title / code")}</TableHead>
                    <TableHead>{t("admin.contentStudio.validatorMemory.colGuidance", "Guidance")}</TableHead>
                    <TableHead>{t("admin.contentStudio.validatorMemory.colScope", "Scope")}</TableHead>
                    <TableHead className="text-right">{t("admin.contentStudio.validatorMemory.colCountLast", "# / last seen")}</TableHead>
                    <TableHead className="text-right">{t("admin.contentStudio.validatorMemory.colActions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActive.map((entry) => (
                    <TableRow key={entry._id}>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="font-medium truncate">{entry.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {entry.stage}
                          </Badge>
                          <code className="text-[11px]">{entry.code}</code>
                        </div>
                        {entry.path && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {entry.path}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <div
                          className={cn(
                            "text-xs line-clamp-3 whitespace-pre-wrap",
                            !entry.guidance && "italic text-muted-foreground"
                          )}
                        >
                          {entry.guidance || t("admin.contentStudio.validatorMemory.noGuidance", "(no guidance – please curate)")}
                        </div>
                        {entry.pattern && (
                          <div className="text-[10px] mt-1 text-muted-foreground">
                            {t("admin.contentStudio.validatorMemory.patternLabel", "Pattern:")} <code>{entry.pattern}</code>
                            {entry.patternFlags ? ` /${entry.patternFlags}` : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ScopeBadges scope={entry.scope} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-xs">
                        <div>
                          {t("admin.contentStudio.validatorMemory.occurrences", {
                            defaultValue: "x{{n}}",
                            n: entry.occurrenceCount,
                          })}
                        </div>
                        <div className="text-muted-foreground">
                          {formatTimestamp(entry.lastSeenAt)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(entry)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {entry.status === "archived" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReactivate(entry)}
                              title={t("admin.contentStudio.validatorMemory.reactivate", "Reactivate")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(entry)}
                              title={t("admin.contentStudio.validatorMemory.archive", "Archive")}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(entry)}
                            title={t("admin.contentStudio.validatorMemory.delete", "Delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={editor !== null} onOpenChange={(v) => (!v ? closeEditor() : null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {editor?.mode === "create"
                ? t("admin.contentStudio.validatorMemory.editorTitleCreate", "New memory entry")
                : t("admin.contentStudio.validatorMemory.editorTitleEdit", "Edit entry")}
            </SheetTitle>
            <SheetDescription>
              {t(
                "admin.contentStudio.validatorMemory.editorDescription",
                "Title and guidance are required. Pattern is optional and only used in the Validator scope."
              )}
            </SheetDescription>
          </SheetHeader>

          {editor && (
            <div className="space-y-4 py-4 px-1">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.stage", "Stage")}</Label>
                  <Select
                    value={editor.stage}
                    onValueChange={(v) =>
                      setEditor({ ...editor, stage: v as "validator" | "auditor" })
                    }
                    disabled={editor.mode === "edit"}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="validator">{t("admin.contentStudio.validatorMemory.stageValidator", "Validator")}</SelectItem>
                      <SelectItem value="auditor">{t("admin.contentStudio.validatorMemory.stageAuditor", "Lector")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.code", "Code")}</Label>
                  <Input
                    value={editor.code}
                    onChange={(e) => setEditor({ ...editor, code: e.target.value })}
                    disabled={editor.mode === "edit"}
                    placeholder={t("admin.contentStudio.validatorMemory.codePlaceholder", "e.g. validation")}
                    className="h-9"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.pathOptional", "Path (optional)")}</Label>
                  <Input
                    value={editor.path}
                    onChange={(e) => setEditor({ ...editor, path: e.target.value })}
                    disabled={editor.mode === "edit"}
                    placeholder={t("admin.contentStudio.validatorMemory.pathPlaceholder", "e.g. vocabulary.en.0")}
                    className="h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">{t("admin.contentStudio.validatorMemory.titleLabel", "Title")}</Label>
                <Input
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder={t("admin.contentStudio.validatorMemory.titlePlaceholder", "Short name of the lesson learned")}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">
                  {t("admin.contentStudio.validatorMemory.guidanceLabel", "Guidance (injected into prompts)")}
                </Label>
                <Textarea
                  value={editor.guidance}
                  onChange={(e) => setEditor({ ...editor, guidance: e.target.value })}
                  placeholder={t(
                    "admin.contentStudio.validatorMemory.guidancePlaceholder",
                    "What is the rule? How do you avoid this mistake?"
                  )}
                  className="min-h-[120px]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.exampleBefore", "Example (before)")}</Label>
                  <Textarea
                    value={editor.exampleBefore}
                    onChange={(e) =>
                      setEditor({ ...editor, exampleBefore: e.target.value })
                    }
                    className="min-h-[70px] font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.exampleAfter", "Example (after)")}</Label>
                  <Textarea
                    value={editor.exampleAfter}
                    onChange={(e) =>
                      setEditor({ ...editor, exampleAfter: e.target.value })
                    }
                    className="min-h-[70px] font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.patternRegex", "Pattern (regex, optional)")}</Label>
                  <Input
                    value={editor.pattern}
                    onChange={(e) => setEditor({ ...editor, pattern: e.target.value })}
                    placeholder={t("admin.contentStudio.validatorMemory.patternPlaceholder", "e.g. \\bzdravo,\\s+kako\\s+ste\\b")}
                    className="h-9 font-mono text-xs"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs">{t("admin.contentStudio.validatorMemory.flags", "Flags")}</Label>
                  <Input
                    value={editor.patternFlags}
                    onChange={(e) =>
                      setEditor({ ...editor, patternFlags: e.target.value })
                    }
                    placeholder="i"
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs font-medium">
                  {t("admin.contentStudio.validatorMemory.scopeTitle", "Scope (where is this entry applied?)")}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    {t(
                      "admin.contentStudio.validatorMemory.scopeCreatorHelp",
                      "Creator (prevention – KNOWN PITFALLS in the system prompt)"
                    )}
                  </div>
                  <Switch
                    checked={editor.scope.applyInCreator}
                    onCheckedChange={(v) =>
                      setEditor({
                        ...editor,
                        scope: { ...editor.scope, applyInCreator: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    {t(
                      "admin.contentStudio.validatorMemory.scopeFixHelp",
                      "Fix (repair – CORRECTION RECIPES in the fix prompt)"
                    )}
                  </div>
                  <Switch
                    checked={editor.scope.applyInFix}
                    onCheckedChange={(v) =>
                      setEditor({
                        ...editor,
                        scope: { ...editor.scope, applyInFix: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    {t(
                      "admin.contentStudio.validatorMemory.scopeValidatorHelp",
                      "Validator (regression – only useful with a pattern)"
                    )}
                  </div>
                  <Switch
                    checked={editor.scope.applyInValidator}
                    onCheckedChange={(v) =>
                      setEditor({
                        ...editor,
                        scope: { ...editor.scope, applyInValidator: v },
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    {t("admin.contentStudio.validatorMemory.scopeTranslatorHelp", "Translator (EN → DE translation)")}
                  </div>
                  <Switch
                    checked={editor.scope.applyInTranslator}
                    onCheckedChange={(v) =>
                      setEditor({
                        ...editor,
                        scope: { ...editor.scope, applyInTranslator: v },
                      })
                    }
                  />
                </div>
              </div>

              {editor.mode === "edit" && editor.entry && (
                <div className="text-xs text-muted-foreground border-t pt-3">
                  {t("admin.contentStudio.validatorMemory.statusLabel", "Status:")}{" "}
                  <StatusBadge status={editor.entry.status} /> –{" "}
                  {t("admin.contentStudio.validatorMemory.metaOccurrences", {
                    defaultValue: "Occurrences x{{n}}",
                    n: editor.entry.occurrenceCount,
                  })}{" "}
                  –{" "}
                  {t("admin.contentStudio.validatorMemory.lastSeen", {
                    defaultValue: "Last seen: {{when}}",
                    when: formatTimestamp(editor.entry.lastSeenAt),
                  })}
                </div>
              )}
            </div>
          )}

          <SheetFooter className="flex flex-row gap-2 px-1">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? t("admin.contentStudio.validatorMemory.saving", "Saving…")
                : t("admin.contentStudio.validatorMemory.save", "Save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(v) => (!v ? setConfirmDelete(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.contentStudio.validatorMemory.deleteConfirmTitle", "Delete this entry permanently?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.contentStudio.validatorMemory.deleteConfirmDescription", {
                defaultValue: "“{{title}}” ({{code}}) will be removed permanently. This action cannot be undone.",
                title: confirmDelete?.title ?? "",
                code: confirmDelete?.code ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              {t("admin.contentStudio.validatorMemory.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
