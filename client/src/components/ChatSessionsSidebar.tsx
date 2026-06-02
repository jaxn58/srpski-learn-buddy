import { useState, useTransition, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { MessageSquarePlus, MessageSquare, Archive, RotateCcw, Trash2, MoreHorizontal, Pencil, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatDateEU } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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

interface ChatSessionsSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onNewChat: () => void;
}

type ChatSession = Doc<"chatSessions">;

export function ChatSessionsSidebar({ currentSessionId, onSelectSession, onNewChat }: ChatSessionsSidebarProps) {
  const { t } = useTranslation();
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const archivedSessions = useQuery(api.chat.getArchivedSessions) as ChatSession[] | undefined;
  const isLoading = sessions === undefined;
  const archiveSessionMutation = useMutation(api.chat.archiveSession);
  const unarchiveSessionMutation = useMutation(api.chat.unarchiveSession);
  const deleteArchivedMutation = useMutation(api.chat.deleteArchivedSession);
  const batchDeleteMutation = useMutation(api.chat.batchDeleteArchivedSessions);
  const updateSessionMutation = useMutation(api.chat.updateSession);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDelete = useCallback((sessionId: string) => {
    // Non-blocking confirmation dialog
    setConfirmDialog({
      open: true,
      title: t("chatSessions.confirm.archive.title"),
      description: t("chatSessions.confirm.archive.desc"),
      onConfirm: () => {
        // Sofortiges visuelles Feedback ohne Blockierung
        startTransition(() => {
          // Optimistisches UI-Update
          setProcessingIds(prev => new Set(prev).add(sessionId));
          
          // Asynchrone Operation ohne UI-Blockierung
          archiveSessionMutation({ sessionId: sessionId as any })
            .then(() => {
              // If archiving current session, clear selection instead of creating new chat
              if (sessionId === currentSessionId) {
                onSelectSession(null);
              }
            })
            .catch((error) => {
              console.error("Failed to archive session:", error);
              toast.error(t("chatSessions.toast.archiveFailed"));
            })
            .finally(() => {
              setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(sessionId);
                return next;
              });
            });
        });
      }
    });
  }, [archiveSessionMutation, currentSessionId, onSelectSession]);


  const handleSelect = useCallback((sessionId: string) => {
    startTransition(() => {
      onSelectSession(sessionId);
    });
  }, [onSelectSession]);

  const startRename = useCallback((session: ChatSession) => {
    setRenamingId(session._id as unknown as string);
    setRenameValue(session.title);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const saveRename = useCallback((id: string, value: string) => {
    const trimmed = value.trim();
    setRenamingId(null);
    if (!trimmed) return;

    const session = sessions?.find((s) => (s._id as unknown as string) === id);
    if (session && trimmed === session.title) return;

    setProcessingIds((prev) => new Set(prev).add(id));
    updateSessionMutation({ sessionId: id as any, title: trimmed })
      .catch(() => toast.error(t("chatSessions.toast.renameFailed", "Rename failed")))
      .finally(() =>
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        })
      );
  }, [sessions, updateSessionMutation, t]);

  const handleUnarchive = useCallback((sessionId: string) => {
    startTransition(() => {
      setProcessingIds(prev => new Set(prev).add(sessionId));

      unarchiveSessionMutation({ sessionId: sessionId as any })
        .then(() => {
          toast.success(t("chatSessions.toast.restored"));
        })
        .catch((error) => {
          console.error("Failed to unarchive session:", error);
          toast.error(t("chatSessions.toast.restoreFailed"));
        })
        .finally(() => {
          setProcessingIds(prev => {
            const next = new Set(prev);
            next.delete(sessionId);
            return next;
          });
        });
    });
  }, [unarchiveSessionMutation]);

  const handleDeleteArchived = useCallback((sessionId: string) => {
    // Non-blocking confirmation dialog
    setConfirmDialog({
      open: true,
      title: t("chatSessions.confirm.deleteArchived.title"),
      description: t("chatSessions.confirm.deleteArchived.desc"),
      onConfirm: () => {
        startTransition(() => {
      
          setProcessingIds(prev => new Set(prev).add(sessionId));
          
          deleteArchivedMutation({ sessionId: sessionId as any })
            .then(() => {
              toast.success(t("chatSessions.toast.deleted"));
            })
            .catch((error) => {
              console.error("Failed to delete archived session:", error);
              toast.error(t("chatSessions.toast.deleteFailed"));
            })
            .finally(() => {
              setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(sessionId);
                return next;
              });
            });
        });
      }
    });
  }, [deleteArchivedMutation]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!archivedSessions) return;
    const allIds = archivedSessions.map(s => s._id as unknown as string);
    setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
  }, [archivedSessions]);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      open: true,
      title: t("chatSessions.confirm.batchDelete.title", "Delete selected chats?"),
      description: t("chatSessions.confirm.batchDelete.desc", {
        count: selectedIds.size,
        defaultValue: "{{count}} archived chats will be permanently deleted. This cannot be undone.",
      }),
      onConfirm: () => {
        setIsBatchDeleting(true);
        const ids = Array.from(selectedIds);
        batchDeleteMutation({ sessionIds: ids as any })
          .then((result) => {
            toast.success(t("chatSessions.toast.batchDeleted", {
              count: result.deleted,
              defaultValue: "{{count}} chats deleted.",
            }));
            setSelectedIds(new Set());
          })
          .catch(() => {
            toast.error(t("chatSessions.toast.batchDeleteFailed", "Could not delete selected chats."));
          })
          .finally(() => setIsBatchDeleting(false));
      },
    });
  }, [selectedIds, batchDeleteMutation, t]);

  return (
    <div className="hidden md:flex w-72 flex-col self-start h-[calc(100vh-6rem)]">
      <div className="bg-card border rounded-xl shadow-sm p-4 space-y-2 shrink-0">
        <Button 
          onClick={onNewChat} 
          className="w-full bg-primary hover:bg-primary/90 text-white text-xs"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          {t("chatSessions.button.newChat")}
        </Button>
        

        <Button
          onClick={() => {
            setShowArchived((s) => !s);
            setSelectedIds(new Set());
          }}
          variant="secondary"
          className="w-full text-xs"
          size="sm"
        >
          <Archive className="h-3 w-3 mr-2" />
          {showArchived ? t("chatSessions.toggle.hideArchive") : t("chatSessions.toggle.showArchive")}
        </Button>
      </div>

      <div className="flex-1 min-h-0 mt-4 overflow-y-auto rounded-xl border bg-card shadow-sm p-2">
        <div className="space-y-1">
          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {t("common.loading")}
            </div>
          )}
          
          {!isLoading && sessions?.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {t("chatSessions.empty")}
            </div>
          )}

          {sessions?.map((session: ChatSession) => {
            const id = session._id as unknown as string;
            const isActive = currentSessionId === id;
            const isRenaming = renamingId === id;
            const isProcessing = processingIds.has(id);

            return (
              <div
                key={id}
                className={cn(
                  "group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-[color:var(--accent)] text-white hover:brightness-95"
                    : "hover:bg-muted/40 cursor-pointer",
                  isProcessing && "opacity-60"
                )}
                onClick={() => !isRenaming && !isProcessing && handleSelect(id)}
              >
                <MessageSquare
                  className={cn(
                    "h-4 w-4 flex-shrink-0",
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
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => saveRename(id, renameValue)}
                    className="h-7 text-sm flex-1 bg-background text-foreground"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate leading-tight">{session.title}</p>
                    <p
                      className={cn(
                        "text-[0.65rem] truncate leading-tight",
                        isActive ? "text-white/70" : "text-muted-foreground/70"
                      )}
                    >
                      {formatDateEU(session._creationTime)}
                    </p>
                  </div>
                )}

                {!isRenaming && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 shrink-0",
                          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
                          isActive && "opacity-100",
                          isActive
                            ? "text-white hover:bg-white/15"
                            : "text-muted-foreground hover:bg-muted/40"
                        )}
                        disabled={isProcessing}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
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
                        onSelect={() => handleDelete(id)}
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

          {showArchived && (
            <div className="mt-4 border-t border-border/60 pt-3 space-y-2">
              <div className="flex items-center justify-between px-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {t("chatSessions.section.archived")}
                </div>
                {archivedSessions && archivedSessions.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[0.65rem] text-muted-foreground"
                      onClick={toggleSelectAll}
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      {selectedIds.size === archivedSessions.length
                        ? t("chatSessions.batch.deselectAll", "Deselect all")
                        : t("chatSessions.batch.selectAll", "Select all")}
                    </Button>
                  </div>
                )}
              </div>

              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={handleBatchDelete}
                  disabled={isBatchDeleting}
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  {t("chatSessions.batch.deleteSelected", {
                    count: selectedIds.size,
                    defaultValue: "Delete {{count}} selected",
                  })}
                </Button>
              )}

              {archivedSessions === undefined && (
                <div className="text-sm text-muted-foreground text-center py-2">{t("common.loading")}</div>
              )}
              {archivedSessions !== undefined && archivedSessions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">{t("chatSessions.emptyArchived")}</div>
              )}
              {archivedSessions?.map((session: ChatSession) => {
                const sid = session._id as unknown as string;
                const isSelected = selectedIds.has(sid);
                return (
                  <div
                    key={session._id}
                    className={cn(
                      "group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors hover:bg-accent/60",
                      isSelected && "bg-accent/30"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(sid)}
                      className="shrink-0"
                      aria-label={`Select "${session.title}"`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate leading-tight">
                        {session.title}
                      </p>
                      <p className="text-[0.65rem] text-muted-foreground/70 leading-tight">
                        {formatDateEU(session._creationTime)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                          processingIds.has(session._id) && "opacity-50 cursor-wait"
                        )}
                        onClick={() => handleUnarchive(session._id)}
                        disabled={processingIds.has(session._id)}
                        title={t("chatSessions.action.restore", "Restore")}
                        aria-label="Restore chat"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                          processingIds.has(session._id) && "opacity-50 cursor-wait"
                        )}
                        onClick={() => handleDeleteArchived(session._id)}
                        disabled={processingIds.has(session._id)}
                        title={t("chatSessions.action.deletePermanently", "Delete permanently")}
                        aria-label="Delete chat permanently"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Non-blocking confirmation dialog */}
      <AlertDialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

