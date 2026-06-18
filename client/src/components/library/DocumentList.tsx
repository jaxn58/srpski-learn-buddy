import { useMemo, useState, useEffect } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LibraryBulkBar } from "@/components/library/LibraryBulkBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDateEU } from "@/lib/utils";
import { getFolderMoveOptions, type LibraryFolder } from "@/lib/libraryTree";
import {
  FileText,
  FolderInput,
  Image,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function fileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  return FileText;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(fileType: string): string {
  if (fileType.startsWith("image/")) return "Image";
  if (fileType === "application/pdf") return "PDF";
  if (fileType.startsWith("text/") || fileType === "application/markdown") return "Text";
  return "File";
}

type DocumentSummary = {
  _id: Id<"userDocuments">;
  _creationTime: number;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  folderId?: Id<"documentFolders">;
  status: "uploaded" | "processing" | "ready" | "error";
  downloadUrl: string | null;
};

type DocumentListProps = {
  folderId: Id<"documentFolders"> | "uncategorized";
  folders: LibraryFolder[];
  onMoveDocument: (
    documentId: Id<"userDocuments">,
    folderId?: Id<"documentFolders">
  ) => Promise<void>;
  dragDocumentId: string | null;
  onDragStartDocument: (documentId: string | null) => void;
  selectedDocumentId: string | null;
  onSelectDocument: (documentId: string | null) => void;
  uploadDisabled?: boolean;
  uploadInputId?: string;
  onUploadClick: () => void;
  isUploading?: boolean;
};

export function DocumentList({
  folderId,
  folders,
  onMoveDocument,
  dragDocumentId,
  onDragStartDocument,
  selectedDocumentId,
  onSelectDocument,
  uploadDisabled = false,
  uploadInputId,
  onUploadClick,
  isUploading = false,
}: DocumentListProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Id<"userDocuments"> | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const deleteDocument = useMutation(api.documents.deleteDocument);
  const deleteDocuments = useMutation(api.documents.deleteDocuments);
  const moveDocumentsToFolder = useMutation(api.documents.moveDocumentsToFolder);
  const renameDocument = useMutation(api.documents.renameDocument);

  const listArgs = useMemo(() => {
    if (folderId === "uncategorized") {
      return {
        uncategorizedOnly: true as const,
        search: search.trim() || undefined,
        fileTypeFilter: fileTypeFilter === "all" ? undefined : fileTypeFilter,
        sortBy,
      };
    }
    return {
      folderId,
      search: search.trim() || undefined,
      fileTypeFilter: fileTypeFilter === "all" ? undefined : fileTypeFilter,
      sortBy,
    };
  }, [folderId, search, fileTypeFilter, sortBy]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.listUserDocuments,
    listArgs,
    { initialNumItems: 30 }
  );

  const folderOptions = useMemo(() => getFolderMoveOptions(folders), [folders]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [folderId, search, fileTypeFilter, sortBy]);

  const visibleIds = useMemo(() => results.map((doc) => doc._id as string), [results]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const indeterminate = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleIds));
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
    setBulkProcessing(true);
    try {
      const result = await deleteDocuments({
        documentIds: Array.from(selectedIds) as Id<"userDocuments">[],
      });
      toast.success(
        t("knowledgeBase.delete.batchSuccessCount", { count: result.deletedCount })
      );
      if (selectedDocumentId && selectedIds.has(selectedDocumentId)) {
        onSelectDocument(null);
      }
      setSelectedIds(new Set());
    } catch {
      toast.error(t("knowledgeBase.delete.failed"));
    } finally {
      setBulkProcessing(false);
      setBatchDeleteOpen(false);
    }
  };

  const handleBatchMove = async (targetFolderId: string | undefined) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const result = await moveDocumentsToFolder({
        documentIds: Array.from(selectedIds) as Id<"userDocuments">[],
        folderId: targetFolderId as Id<"documentFolders"> | undefined,
      });
      toast.success(t("myLibrary.bulk.moveSuccess", { count: result.movedCount }));
      setSelectedIds(new Set());
    } catch {
      toast.error(t("myLibrary.bulk.moveFailed"));
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument({ documentId: deleteTarget });
      toast.success(t("knowledgeBase.delete.success"));
      if (selectedDocumentId === (deleteTarget as string)) {
        onSelectDocument(null);
      }
    } catch {
      toast.error(t("knowledgeBase.delete.failed"));
    } finally {
      setDeleteTarget(null);
    }
  };

  const saveRename = async (doc: DocumentSummary) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === doc.fileName) {
      setRenamingId(null);
      return;
    }
    try {
      await renameDocument({ documentId: doc._id, fileName: trimmed });
      toast.success(t("knowledgeBase.rename.success"));
    } catch {
      toast.error(t("knowledgeBase.rename.failed"));
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  };

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground min-h-[240px]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border/40 px-4 py-2 shrink-0 bg-background/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder={t("knowledgeBase.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
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
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t("knowledgeBase.sort.date")}</SelectItem>
                <SelectItem value="name">{t("knowledgeBase.sort.name")}</SelectItem>
                <SelectItem value="size">{t("knowledgeBase.sort.size")}</SelectItem>
              </SelectContent>
            </Select>
            {uploadInputId && !uploadDisabled ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <label
                  htmlFor={uploadInputId}
                  className="inline-flex items-center cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : null}
                  {t("myLibrary.upload")}
                </label>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={uploadDisabled || isUploading}
                onClick={onUploadClick}
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : null}
                {t("myLibrary.upload")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <LibraryBulkBar
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        indeterminate={indeterminate}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        folderOptions={folderOptions}
        currentFolderId={folderId}
        onMoveToFolder={handleBatchMove}
        onDelete={() => setBatchDeleteOpen(true)}
        deleteLabel={t("knowledgeBase.delete.selected", { count: selectedIds.size })}
        isProcessing={bulkProcessing}
      />

      {!results.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 min-h-[240px] text-center px-6">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">{t("knowledgeBase.empty.title")}</p>
          <p className="text-xs text-muted-foreground max-w-sm">{t("knowledgeBase.empty.hint")}</p>
          {uploadInputId && !uploadDisabled ? (
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <label htmlFor={uploadInputId} className="inline-flex items-center cursor-pointer">
                {t("myLibrary.upload")}
              </label>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={uploadDisabled || isUploading}
              onClick={onUploadClick}
            >
              {t("myLibrary.upload")}
            </Button>
          )}
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 min-h-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/30 backdrop-blur-sm">
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSelected ? true : indeterminate ? "indeterminate" : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label={
                        allSelected
                          ? t("chatSessions.batch.deselectAll")
                          : t("chatSessions.batch.selectAll")
                      }
                    />
                  </TableHead>
                  <TableHead className="w-[min(100%,360px)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("knowledgeBase.list.columnName")}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell w-[80px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("knowledgeBase.list.columnType")}
                  </TableHead>
                  <TableHead className="hidden md:table-cell w-[90px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("knowledgeBase.list.columnSize")}
                  </TableHead>
                  <TableHead className="hidden sm:table-cell w-[120px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("knowledgeBase.list.columnDate")}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell w-[90px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("knowledgeBase.list.columnStatus")}
                  </TableHead>
                  <TableHead className="w-[52px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((doc) => {
                  const idStr = doc._id as string;
                  const Icon = fileIcon(doc.fileType);
                  const isSelected = selectedDocumentId === idStr;
                  const isRenaming = renamingId === idStr;
                  const isDragging = dragDocumentId === idStr;
                  const isChecked = selectedIds.has(idStr);

                  return (
                    <TableRow
                      key={idStr}
                      draggable
                      data-state={isSelected ? "selected" : undefined}
                      className={cn(
                        "cursor-default select-none group",
                        isSelected && "library-accent-bg hover:library-accent-bg",
                        isChecked && !isSelected && "bg-muted/30",
                        isDragging && "opacity-40",
                        !isSelected && !isChecked && "hover:bg-muted/50"
                      )}
                      onClick={() => onSelectDocument(idStr)}
                      onDragStart={() => onDragStartDocument(idStr)}
                      onDragEnd={() => onDragStartDocument(null)}
                    >
                      <TableCell className="py-2 w-8" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(idStr)}
                          aria-label={t("knowledgeBase.selectDocument")}
                        />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "text-serbian-blue" : "text-muted-foreground"
                            )}
                          />
                          {isRenaming ? (
                            <Input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") void saveRename(doc);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onBlur={() => void saveRename(doc)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 text-sm flex-1"
                              autoFocus
                            />
                          ) : (
                            <span className="truncate text-sm font-medium">{doc.fileName}</span>
                          )}
                        </div>
                        <p className="sm:hidden text-[11px] text-muted-foreground mt-1 pl-6">
                          {formatSize(doc.fileSizeBytes)} · {formatDateEU(doc._creationTime)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fileTypeLabel(doc.fileType)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground tabular-nums">
                        {formatSize(doc.fileSizeBytes)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground tabular-nums">
                        {formatDateEU(doc._creationTime)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-8 w-8 focus-visible:opacity-100 data-[state=open]:opacity-100",
                                isMobile ? "opacity-60" : "opacity-0 group-hover:opacity-100"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                            {doc.downloadUrl && (
                              <DropdownMenuItem asChild>
                                <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                                  {t("knowledgeBase.actions.download")}
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onSelect={() => {
                                setRenameValue(doc.fileName);
                                setRenamingId(idStr);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              {t("knowledgeBase.actions.rename")}
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <FolderInput className="h-4 w-4 mr-2" />
                                {t("knowledgeBase.actions.moveToFolder")}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {folderId !== "uncategorized" && (
                                  <DropdownMenuItem
                                    onSelect={() => void onMoveDocument(doc._id, undefined)}
                                  >
                                    {t("chatLibrary.uncategorized")}
                                  </DropdownMenuItem>
                                )}
                                {folderOptions.map((folder) =>
                                  folder.id === (doc.folderId as string | undefined) ? null : (
                                    <DropdownMenuItem
                                      key={folder.id}
                                      onSelect={() =>
                                        void onMoveDocument(
                                          doc._id,
                                          folder.id as Id<"documentFolders">
                                        )
                                      }
                                      className={folder.depth === 1 ? "pl-6" : undefined}
                                    >
                                      {folder.depth === 1 ? `— ${folder.name}` : folder.name}
                                    </DropdownMenuItem>
                                  )
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setDeleteTarget(doc._id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("knowledgeBase.actions.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          {status === "CanLoadMore" && (
            <div className="border-t border-border/60 p-2 shrink-0">
              <Button variant="ghost" size="sm" className="w-full h-8 text-xs" onClick={() => loadMore(30)}>
                {t("knowledgeBase.loadMore")}
              </Button>
            </div>
          )}
        </>
      )}

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

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("knowledgeBase.delete.batchConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("knowledgeBase.delete.batchConfirmBody", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBatchDelete()}>
              {t("knowledgeBase.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
