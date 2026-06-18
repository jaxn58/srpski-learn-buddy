import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ChevronRight,
  FileText,
  Image,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function fileIcon(fileType: string, fileName: string) {
  if (fileType.startsWith("image/")) return Image;
  return FileText;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBaseExplorer() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Id<"userDocuments"> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [renamingId, setRenamingId] = useState<Id<"userDocuments"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const storageUsage = useQuery(api.documents.getUserStorageUsage);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.createDocument);
  const deleteDocument = useMutation(api.documents.deleteDocument);
  const deleteDocuments = useMutation(api.documents.deleteDocuments);
  const renameDocument = useMutation(api.documents.renameDocument);

  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.listUserDocuments,
    {
      search: search.trim() || undefined,
      fileTypeFilter: fileTypeFilter === "all" ? undefined : fileTypeFilter,
      sortBy,
    },
    { initialNumItems: 30 }
  );

  const openUploadOnMount = useMemo(() => {
    const q = location.split("?")[1] ?? "";
    return new URLSearchParams(q).get("upload") === "1";
  }, [location]);

  useEffect(() => {
    if (openUploadOnMount) {
      fileInputRef.current?.click();
    }
  }, [openUploadOnMount]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(t("knowledgeBase.upload.unsupported"));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("knowledgeBase.upload.tooLarge"));
      return;
    }

    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({
        fileBytes: file.size,
        fileType: file.type || "application/octet-stream",
        uploadSource: "knowledge_rack",
      });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");
      const { storageId } = await uploadResponse.json();

      await createDocument({
        storageId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
      });

      toast.success(t("knowledgeBase.upload.success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("knowledgeBase.upload.failed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteDocuments({
        documentIds: Array.from(selectedIds) as Id<"userDocuments">[],
      });
      toast.success(t("knowledgeBase.delete.batchSuccess"));
      setSelectedIds(new Set());
    } catch {
      toast.error(t("knowledgeBase.delete.failed"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument({ documentId: deleteTarget });
      toast.success(t("knowledgeBase.delete.success"));
    } catch {
      toast.error(t("knowledgeBase.delete.failed"));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRename = async (documentId: Id<"userDocuments">) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await renameDocument({ documentId, fileName: trimmed });
      toast.success(t("knowledgeBase.rename.success"));
    } catch {
      toast.error(t("knowledgeBase.rename.failed"));
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const percentUsed = storageUsage?.percentUsed ?? null;
  const uploadDisabled =
    isUploading ||
    (percentUsed !== null && percentUsed >= 100);

  return (
    <AnimatedPage className="space-y-4">
      <AnimatedItem>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/library">{t("myLibrary.title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{t("myLibrary.knowledgeBase.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("myLibrary.knowledgeBase.title")}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t("knowledgeBase.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDisabled}
              className="gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t("myLibrary.upload")}
            </Button>
          </div>
        </div>

        {storageUsage && storageUsage.quotaBytes !== null && (
          <div className="mt-4 rounded-lg border bg-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {t("knowledgeBase.storage.used", {
                  used: storageUsage.usedFormatted,
                  quota: storageUsage.quotaFormatted,
                })}
              </span>
              <span className="text-muted-foreground">{percentUsed}%</span>
            </div>
            <Progress
              value={percentUsed ?? 0}
              className={cn(
                "h-2",
                percentUsed !== null && percentUsed >= 80 && "[&>div]:bg-amber-500",
                percentUsed !== null && percentUsed >= 100 && "[&>div]:bg-destructive"
              )}
            />
            {percentUsed !== null && percentUsed >= 80 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("myLibrary.storage.almostFull")}
              </p>
            )}
          </div>
        )}
      </AnimatedItem>

      <AnimatedItem>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("knowledgeBase.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t("knowledgeBase.filter.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("knowledgeBase.filter.all")}</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="image">{t("knowledgeBase.filter.images")}</SelectItem>
              <SelectItem value="text">{t("knowledgeBase.filter.text")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">{t("knowledgeBase.sort.date")}</SelectItem>
              <SelectItem value="name">{t("knowledgeBase.sort.name")}</SelectItem>
              <SelectItem value="size">{t("knowledgeBase.sort.size")}</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
              {t("knowledgeBase.delete.selected", { count: selectedIds.size })}
            </Button>
          )}
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <div className="rounded-xl border bg-card overflow-hidden">
          {results.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="font-medium">{t("knowledgeBase.empty.title")}</p>
              <p className="text-sm mt-2">{t("knowledgeBase.empty.hint")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {results.map((doc) => {
                const Icon = fileIcon(doc.fileType, doc.fileName);
                const isSelected = selectedIds.has(doc._id);
                const isRenaming = renamingId === doc._id;

                return (
                  <li
                    key={doc._id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-muted/40",
                      isSelected && "bg-muted/60"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(doc._id)}
                      className="h-4 w-4 shrink-0"
                      aria-label={t("knowledgeBase.selectDocument")}
                    />
                    <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleRename(doc._id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                          className="h-8"
                        />
                      ) : (
                        <>
                          <p className="font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatSize(doc.fileSizeBytes)} ·{" "}
                            {new Date(doc._creationTime).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize text-xs">
                      {doc.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {doc.downloadUrl && (
                          <DropdownMenuItem asChild>
                            <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                              {t("knowledgeBase.actions.download")}
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setRenamingId(doc._id);
                            setRenameValue(doc.fileName);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          {t("knowledgeBase.actions.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(doc._id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("knowledgeBase.actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
          {status === "CanLoadMore" && (
            <div className="p-4 border-t text-center">
              <Button variant="outline" size="sm" onClick={() => loadMore(30)}>
                {t("knowledgeBase.loadMore")}
              </Button>
            </div>
          )}
        </div>
      </AnimatedItem>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("knowledgeBase.delete.confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("knowledgeBase.delete.confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("knowledgeBase.actions.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatedPage>
  );
}
