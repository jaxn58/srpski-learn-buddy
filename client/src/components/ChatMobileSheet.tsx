import { useState, useTransition, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn, formatDateEU } from "@/lib/utils";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquarePlus,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type ChatSession = Doc<"chatSessions">;

interface ChatMobileSheetProps {
  currentSessionId: string | null;
  currentSessionTitle?: string;
  onSelectSession: (id: string | null) => void;
  onNewChat: () => void;
  isCreatingSession: boolean;
}

export function ChatMobileSheet({
  currentSessionId,
  currentSessionTitle,
  onSelectSession,
  onNewChat,
  isCreatingSession,
}: ChatMobileSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const archivedSessions = useQuery(api.chat.getArchivedSessions) as ChatSession[] | undefined;

  const archiveSessionMutation = useMutation(api.chat.archiveSession);
  const unarchiveSessionMutation = useMutation(api.chat.unarchiveSession);
  const deleteArchivedMutation = useMutation(api.chat.deleteArchivedSession);
  const updateSessionMutation = useMutation(api.chat.updateSession);

  const markProcessing = (id: string) =>
    setProcessingIds((prev) => new Set(prev).add(id));

  const unmarkProcessing = (id: string) =>
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleSelect = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        onSelectSession(sessionId);
        setOpen(false);
      });
    },
    [onSelectSession]
  );

  const handleNewChat = useCallback(() => {
    onNewChat();
    setOpen(false);
  }, [onNewChat]);

  const startRename = useCallback((session: ChatSession) => {
    setRenamingId(session._id as unknown as string);
    setRenameValue(session.title);
    // Wait for next render cycle so the input is mounted
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const saveRename = useCallback(
    (id: string, value: string) => {
      const trimmed = value.trim();
      setRenamingId(null);
      if (!trimmed) return;

      const session = sessions?.find((s) => (s._id as unknown as string) === id);
      if (session && trimmed === session.title) return;

      markProcessing(id);
      updateSessionMutation({ sessionId: id as any, title: trimmed })
        .catch(() => toast.error(t("chatSessions.toast.renameFailed", "Rename failed")))
        .finally(() => unmarkProcessing(id));
    },
    [sessions, updateSessionMutation, t]
  );

  const handleArchive = useCallback(
    (sessionId: string) => {
      setConfirmDialog({
        open: true,
        title: t("chatSessions.confirm.archive.title"),
        description: t("chatSessions.confirm.archive.desc"),
        onConfirm: () => {
          startTransition(() => {
            markProcessing(sessionId);
            archiveSessionMutation({ sessionId: sessionId as any })
              .then(() => {
                if (sessionId === currentSessionId) {
                  onSelectSession(null);
                }
              })
              .catch(() => toast.error(t("chatSessions.toast.archiveFailed")))
              .finally(() => unmarkProcessing(sessionId));
          });
        },
      });
    },
    [archiveSessionMutation, currentSessionId, onSelectSession, t]
  );

  const handleUnarchive = useCallback(
    (sessionId: string) => {
      startTransition(() => {
        markProcessing(sessionId);
        unarchiveSessionMutation({ sessionId: sessionId as any })
          .then(() => toast.success(t("chatSessions.toast.restored")))
          .catch(() => toast.error(t("chatSessions.toast.restoreFailed")))
          .finally(() => unmarkProcessing(sessionId));
      });
    },
    [unarchiveSessionMutation, t]
  );

  const handleDeleteArchived = useCallback(
    (sessionId: string) => {
      setConfirmDialog({
        open: true,
        title: t("chatSessions.confirm.deleteArchived.title"),
        description: t("chatSessions.confirm.deleteArchived.desc"),
        onConfirm: () => {
          startTransition(() => {
            markProcessing(sessionId);
            deleteArchivedMutation({ sessionId: sessionId as any })
              .then(() => toast.success(t("chatSessions.toast.deleted")))
              .catch(() => toast.error(t("chatSessions.toast.deleteFailed")))
              .finally(() => unmarkProcessing(sessionId));
          });
        },
      });
    },
    [deleteArchivedMutation, t]
  );

  const displayTitle = currentSessionTitle ?? t("chat.newChat");

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button className="flex items-center gap-1 max-w-full text-sm font-semibold truncate hover:text-primary transition-colors">
            <span className="truncate">{displayTitle}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="max-h-[75dvh] flex flex-col rounded-t-xl pb-[env(safe-area-inset-bottom)] gap-0"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b flex-row items-center justify-between">
            <div>
              <SheetTitle>{t("chatSessions.title", "Chats")}</SheetTitle>
              <SheetDescription className="sr-only">
                {t("chatSessions.sheetDesc", "Manage your chat sessions")}
              </SheetDescription>
            </div>
            <Button
              size="sm"
              onClick={handleNewChat}
              disabled={isCreatingSession}
              className="shrink-0 mr-8"
            >
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              {t("chatSessions.button.newChat")}
            </Button>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 py-2 space-y-0.5">
              {sessions === undefined && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t("common.loading")}
                </p>
              )}
              {sessions !== undefined && sessions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t("chatSessions.empty")}
                </p>
              )}

              {sessions?.map((session) => {
                const id = session._id as unknown as string;
                const isActive = id === currentSessionId;
                const isRenaming = renamingId === id;
                const isProcessing = processingIds.has(id);

                return (
                  <div
                    key={id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-[color:var(--accent)] text-white"
                        : "hover:bg-muted/40",
                      isProcessing && "opacity-60"
                    )}
                  >
                    <MessageSquare
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-white" : "text-muted-foreground"
                      )}
                    />

                    {isRenaming ? (
                      <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveRename(id, renameValue);
                          }
                          if (e.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                        onBlur={() => saveRename(id, renameValue)}
                        className="h-7 text-sm flex-1 bg-background text-foreground"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={() => !isProcessing && handleSelect(id)}
                        disabled={isProcessing}
                      >
                        <p className="text-sm line-clamp-2 break-words">{session.title}</p>
                        <p
                          className={cn(
                            "text-xs",
                            isActive ? "text-white/75" : "text-muted-foreground"
                          )}
                        >
                          {formatDateEU(session._creationTime)}
                        </p>
                      </button>
                    )}

                    {!isRenaming && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-7 w-7 shrink-0",
                              isActive
                                ? "text-white hover:bg-white/15"
                                : "text-muted-foreground hover:bg-muted/40"
                            )}
                            disabled={isProcessing}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onSelect={() => startRename(session)}
                            className="cursor-pointer"
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            {t("chatSessions.action.rename", "Rename")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => handleArchive(id)}
                            className="cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            {t("chatSessions.action.archive", "Archive")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Archive toggle */}
            <div className="px-2 pb-1">
              <button
                onClick={() => setShowArchived((s) => !s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/40"
              >
                {showArchived ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <Archive className="h-3.5 w-3.5" />
                {showArchived
                  ? t("chatSessions.toggle.hideArchive")
                  : t("chatSessions.toggle.showArchive")}
              </button>
            </div>

            {/* Archived sessions */}
            {showArchived && (
              <div className="px-2 pb-3 space-y-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
                  {t("chatSessions.section.archived")}
                </p>
                {archivedSessions === undefined && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("common.loading")}
                  </p>
                )}
                {archivedSessions !== undefined && archivedSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("chatSessions.emptyArchived")}
                  </p>
                )}
                {archivedSessions?.map((session) => {
                  const id = session._id as unknown as string;
                  const isProcessing = processingIds.has(id);
                  return (
                    <div
                      key={id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors",
                        isProcessing && "opacity-60"
                      )}
                    >
                      <Archive className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 break-words">{session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateEU(session._creationTime)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-muted/40"
                        onClick={() => handleUnarchive(id)}
                        disabled={isProcessing}
                        title={t("chatSessions.action.restore", "Restore")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteArchived(id)}
                        disabled={isProcessing}
                        title={t("chatSessions.action.deletePermanently", "Delete permanently")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Confirmation Dialog - rendered outside Sheet to avoid z-index conflicts */}
      <AlertDialog
        open={confirmDialog?.open ?? false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
            >
              {t("common.confirm", "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
