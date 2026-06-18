import { useMemo, useState, useCallback, useEffect } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDateEU } from "@/lib/utils";
import { getFolderMoveOptions } from "@/lib/libraryTree";
import {
  Archive,
  FileDown,
  FileText,
  FolderInput,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
} from "lucide-react";
import { useChatPdfExport } from "@/hooks/useChatPdfExport";
import { useIsMobile } from "@/hooks/useMobile";
import type { ChatFolder } from "./FolderTree";

type SessionSummary = {
  _id: Id<"chatSessions">;
  _creationTime: number;
  title: string;
  folderId?: Id<"chatFolders">;
  messageCount: number;
  attachmentCount: number;
};

type SessionListProps = {
  folderId: Id<"chatFolders"> | "uncategorized" | "__archived__";
  folders: ChatFolder[];
  onMoveSession: (sessionId: Id<"chatSessions">, folderId?: Id<"chatFolders">) => Promise<void>;
  dragSessionId: string | null;
  onDragStartSession: (sessionId: string | null) => void;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
};

export function SessionList({
  folderId,
  folders,
  onMoveSession,
  dragSessionId,
  onDragStartSession,
  selectedSessionId,
  onSelectSession,
}: SessionListProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { exportSession, exportingSessionId } = useChatPdfExport();
  const archiveSessionMutation = useMutation(api.chat.archiveSession);
  const archiveSessionsMutation = useMutation(api.chatLibrary.archiveSessions);
  const moveSessionsToFolder = useMutation(api.chatLibrary.moveSessionsToFolder);
  const updateSessionMutation = useMutation(api.chat.updateSession);
  const [confirmArchive, setConfirmArchive] = useState<SessionSummary | null>(null);
  const [batchArchiveOpen, setBatchArchiveOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const queryFolderId = folderId === "uncategorized" || folderId === "__archived__"
    ? undefined
    : folderId;
  const isArchiveView = folderId === "__archived__";

  const { results, status, loadMore } = usePaginatedQuery(
    api.chatLibrary.getSessionsByFolder,
    isArchiveView
      ? { archivedOnly: true }
      : { folderId: queryFolderId },
    { initialNumItems: 30 }
  );

  const folderOptions = useMemo(() => getFolderMoveOptions(folders), [folders]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [folderId]);

  const visibleIds = useMemo(() => results.map((session) => session._id as string), [results]);
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

  const openSession = useCallback(
    (sessionId: string) => {
      setLocation(`/chat?session=${sessionId}`);
    },
    [setLocation]
  );

  const saveRename = async (session: SessionSummary) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === session.title) {
      setRenamingId(null);
      return;
    }
    try {
      await updateSessionMutation({ sessionId: session._id, title: trimmed });
      toast.success(t("chatSessions.toast.renamed", "Chat renamed"));
    } catch {
      toast.error(t("chatSessions.toast.renameFailed", "Rename failed"));
    } finally {
      setRenamingId(null);
    }
  };

  const handleArchive = async (session: SessionSummary) => {
    try {
      await archiveSessionMutation({ sessionId: session._id });
      toast.success(t("chatSessions.toast.archived", "Chat archived"));
      if (selectedSessionId === (session._id as string)) {
        onSelectSession(null);
      }
    } catch {
      toast.error(t("chatSessions.toast.archiveFailed"));
    }
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const result = await archiveSessionsMutation({
        sessionIds: Array.from(selectedIds) as Id<"chatSessions">[],
      });
      toast.success(t("chatLibrary.bulk.archiveSuccess", { count: result.archivedCount }));
      if (selectedSessionId && selectedIds.has(selectedSessionId)) {
        onSelectSession(null);
      }
      setSelectedIds(new Set());
    } catch {
      toast.error(t("chatLibrary.bulk.archiveFailed"));
    } finally {
      setBulkProcessing(false);
      setBatchArchiveOpen(false);
    }
  };

  const handleBatchMove = async (targetFolderId: string | undefined) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const result = await moveSessionsToFolder({
        sessionIds: Array.from(selectedIds) as Id<"chatSessions">[],
        folderId: targetFolderId as Id<"chatFolders"> | undefined,
      });
      toast.success(t("myLibrary.bulk.moveSuccess", { count: result.movedCount }));
      setSelectedIds(new Set());
    } catch {
      toast.error(t("myLibrary.bulk.moveFailed"));
    } finally {
      setBulkProcessing(false);
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

  if (!results.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 min-h-[240px] text-center px-6">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">{t("chatLibrary.sessions.emptyTitle")}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{t("chatLibrary.sessions.emptyHint")}</p>
      </div>
    );
  }

  return (
    <>
      <LibraryBulkBar
        selectedCount={selectedIds.size}
        allSelected={allSelected}
        indeterminate={indeterminate}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={() => setSelectedIds(new Set())}
        folderOptions={folderOptions}
        currentFolderId={folderId}
        onMoveToFolder={handleBatchMove}
        onDelete={() => setBatchArchiveOpen(true)}
        deleteLabel={t("chatLibrary.bulk.archiveSelected", { count: selectedIds.size })}
        deleteIcon="archive"
        isProcessing={bulkProcessing}
      />

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
              <TableHead className="w-[min(100%,420px)] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("chatLibrary.list.columnName")}
              </TableHead>
              <TableHead className="hidden sm:table-cell w-[140px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("chatLibrary.list.columnDate")}
              </TableHead>
              <TableHead className="hidden md:table-cell w-[100px] text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("chatLibrary.list.columnMessages")}
              </TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((session) => {
              const idStr = session._id as string;
              const isSelected = selectedSessionId === idStr;
              const isRenaming = renamingId === idStr;
              const isExporting = exportingSessionId === idStr;
              const isDragging = dragSessionId === idStr;
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
                  onClick={() => onSelectSession(idStr)}
                  onDoubleClick={() => openSession(idStr)}
                  onDragStart={() => onDragStartSession(idStr)}
                  onDragEnd={() => onDragStartSession(null)}
                >
                  <TableCell className="py-2 w-8" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleSelect(idStr)}
                      aria-label={t("chatLibrary.bulk.selectSession")}
                    />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isSelected ? "text-serbian-blue" : "text-muted-foreground"
                        )}
                      />
                      {isRenaming ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") void saveRename(session);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onBlur={() => void saveRename(session)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-sm border rounded px-2 py-1 bg-background"
                          autoFocus
                        />
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate text-sm font-medium">{session.title}</span>
                          {session.attachmentCount > 0 && (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                              title={t("chatLibrary.sessions.attachmentCount", {
                                count: session.attachmentCount,
                              })}
                            >
                              <Paperclip className="h-3 w-3" />
                              {session.attachmentCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="sm:hidden text-[11px] text-muted-foreground mt-1 pl-6">
                      {formatDateEU(session._creationTime)} ·{" "}
                      {t("chatLibrary.sessions.messageCount", { count: session.messageCount })}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground tabular-nums">
                    {formatDateEU(session._creationTime)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right text-sm text-muted-foreground tabular-nums">
                    {session.messageCount}
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
                        <DropdownMenuItem onSelect={() => openSession(idStr)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          {t("chatLibrary.sessions.open")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isExporting}
                          onSelect={() => void exportSession(session._id, session.title)}
                        >
                          {isExporting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="h-4 w-4 mr-2" />
                          )}
                          {t("chatLibrary.export.action")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenameValue(session.title);
                            setRenamingId(idStr);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          {t("chatSessions.action.rename", "Rename")}
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <FolderInput className="h-4 w-4 mr-2" />
                            {t("chatLibrary.sessions.moveToFolder")}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {folderId !== "uncategorized" && (
                              <DropdownMenuItem
                                onSelect={() => void onMoveSession(session._id, undefined)}
                              >
                                {t("chatLibrary.uncategorized")}
                              </DropdownMenuItem>
                            )}
                            {folderOptions.map((folder) =>
                              folder.id === session.folderId ? null : (
                                <DropdownMenuItem
                                  key={folder.id as string}
                                  onSelect={() => void onMoveSession(session._id, folder.id)}
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
                          onSelect={() => setConfirmArchive(session)}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {t("chatSessions.action.archive", "Archive")}
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
            {t("chatLibrary.sessions.loadMore")}
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirmArchive} onOpenChange={(open) => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chatSessions.confirm.archive.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chatSessions.confirm.archive.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmArchive) void handleArchive(confirmArchive);
                setConfirmArchive(null);
              }}
            >
              {t("chatSessions.action.archive", "Archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchArchiveOpen} onOpenChange={setBatchArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chatLibrary.bulk.archiveConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("chatLibrary.bulk.archiveConfirmBody", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBatchArchive()}>
              {t("chatSessions.action.archive", "Archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
