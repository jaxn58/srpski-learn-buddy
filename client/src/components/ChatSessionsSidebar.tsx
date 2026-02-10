import { useEffect, useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { MessageSquarePlus, MessageSquare, Trash, Archive, RotateCcw, Trash2 } from "lucide-react";
import { cn, formatDateEU } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
  const [showArchived, setShowArchived] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDelete = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  return (
    <div className="hidden md:flex w-72 flex-col md:sticky md:top-20 self-start max-h-[calc(100vh-6rem)]">
      <div className="bg-card border rounded-xl shadow-sm p-4 space-y-2 overflow-hidden">
        <Button 
          onClick={onNewChat} 
          className="w-full bg-primary hover:bg-primary/90 text-white text-xs"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          {t("chatSessions.button.newChat")}
        </Button>
        

        <Button
          onClick={() => setShowArchived((s) => !s)}
          variant="secondary"
          className="w-full text-xs"
          size="sm"
        >
          <Archive className="h-3 w-3 mr-2" />
          {showArchived ? t("chatSessions.toggle.hideArchive") : t("chatSessions.toggle.showArchive")}
        </Button>
      </div>

      <ScrollArea className="flex-1 mt-4">
        <div className="space-y-1 bg-card border rounded-xl shadow-sm p-2">
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

          {sessions?.map((session: ChatSession) => (
            (() => {
              const isActive = currentSessionId === session._id;
              return (
            <div
              key={session._id}
              onClick={() => handleSelect(session._id)}
              className={cn(
                "group relative flex items-center gap-2 p-3 pr-10 rounded-lg cursor-pointer transition-colors",
                isActive
                  ? "bg-[color:var(--accent)] text-white hover:brightness-95"
                  : "hover:bg-muted/40"
              )}
            >
              <MessageSquare
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-white" : "text-muted-foreground"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {session.title}
                </p>
                <p
                  className={cn(
                    "text-xs truncate",
                    isActive ? "text-white/85" : "text-muted-foreground"
                  )}
                >
                  {formatDateEU(session._creationTime)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7",
                  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity",
                  isActive && "opacity-100",
                  isActive
                    ? "text-white hover:bg-white/15"
                    : "text-muted-foreground hover:bg-muted/40",
                  processingIds.has(session._id) && "opacity-50 cursor-wait"
                )}
                onClick={(e) => handleDelete(session._id, e)}
                disabled={processingIds.has(session._id)}
                title="Archive"
                aria-label="Archive chat"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            </div>
              );
            })()
          ))}

          {showArchived && (
            <div className="mt-4 border-t border-border/60 pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground px-2">{t("chatSessions.section.archived")}</div>
              {archivedSessions === undefined && (
                <div className="text-sm text-muted-foreground text-center py-2">{t("common.loading")}</div>
              )}
              {archivedSessions !== undefined && archivedSessions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">{t("chatSessions.emptyArchived")}</div>
              )}
              {archivedSessions?.map((session: ChatSession) => (
                <div
                  key={session._id}
                  className="group flex items-center gap-2 p-3 rounded-lg transition-colors hover:bg-accent/60"
                >
                  <Archive className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                      title="Restore"
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
                      title="Delete permanently"
                      aria-label="Delete chat permanently"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

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

