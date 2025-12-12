import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { MessageSquarePlus, MessageSquare, Trash, Archive, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatSessionsSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

type ChatSession = Doc<"chatSessions">;

export function ChatSessionsSidebar({ currentSessionId, onSelectSession, onNewChat }: ChatSessionsSidebarProps) {
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const archivedSessions = useQuery(api.chat.getArchivedSessions) as ChatSession[] | undefined;
  const isLoading = sessions === undefined;
  const archiveSessionMutation = useMutation(api.chat.archiveSession);
  const unarchiveSessionMutation = useMutation(api.chat.unarchiveSession);
  const deleteArchivedMutation = useMutation(api.chat.deleteArchivedSession);
  const bulkDeleteMutation = useMutation(api.chat.bulkDeleteNewChats);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Chat archivieren? Anschließend kann er endgültig gelöscht werden.")) return;
    
    try {
      await archiveSessionMutation({ sessionId: sessionId as any });
      
      // If archiving current session, trigger new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to archive session:", error);
      toast.error("Konnte Chat nicht archivieren.");
    }
  };

  const handleBulkDeleteNewChats = async () => {
    const newChatCount = sessions?.filter((session: ChatSession) => session.title === "New Chat").length || 0;
    if (newChatCount === 0) {
      toast.info("No empty chats to delete.");
      return;
    }
    
    if (!confirm(`Delete all ${newChatCount} empty chat${newChatCount > 1 ? 's' : ''}? This cannot be undone.`)) return;
    
    try {
      setBulkDeleting(true);
      const result = await bulkDeleteMutation({});

      toast.success(`Successfully deleted ${result.deletedCount} empty chat${result.deletedCount > 1 ? 's' : ''}.`);
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      toast.error("Failed to delete empty chats. Please try again.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
  };

  const handleUnarchive = async (sessionId: string) => {
    try {
      await unarchiveSessionMutation({ sessionId: sessionId as any });
      toast.success("Chat reaktiviert.");
    } catch (error) {
      console.error("Failed to unarchive session:", error);
      toast.error("Konnte Chat nicht reaktivieren.");
    }
  };

  const handleDeleteArchived = async (sessionId: string) => {
    if (!confirm("Diesen archivierten Chat endgültig löschen?")) return;
    try {
      await deleteArchivedMutation({ sessionId: sessionId as any });
      toast.success("Archivierter Chat gelöscht.");
    } catch (error) {
      console.error("Failed to delete archived session:", error);
      toast.error("Konnte archivierten Chat nicht löschen.");
    }
  };

  return (
    <div className="hidden md:flex w-64 border-r bg-card/50 flex-col h-screen md:sticky md:top-0 overflow-y-auto">
      <div className="p-4 border-b space-y-2">
        <Button 
          onClick={onNewChat} 
          className="w-full"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
        
        {sessions?.some((session: ChatSession) => session.title === "New Chat") && (
          <Button 
            onClick={handleBulkDeleteNewChats}
            variant="outline"
            className="w-full text-xs"
            size="sm"
            disabled={bulkDeleting}
          >
            <Trash className="h-3 w-3 mr-2" />
            Clear Empty Chats ({sessions.filter((session: ChatSession) => session.title === "New Chat").length})
          </Button>
        )}

        <Button
          onClick={() => setShowArchived((s) => !s)}
          variant="secondary"
          className="w-full text-xs"
          size="sm"
        >
          <Archive className="h-3 w-3 mr-2" />
          {showArchived ? "Archiv ausblenden" : "Archiv anzeigen"}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading...
            </div>
          )}
          
          {!isLoading && sessions?.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No chats yet
            </div>
          )}

          {sessions?.map((session: ChatSession) => (
            <div
              key={session._id}
              onClick={() => handleSelect(session._id)}
              className={cn(
                "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                "hover:bg-accent",
                currentSessionId === session._id && "bg-accent"
              )}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {session.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(session._creationTime).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 transition-opacity"
                onClick={(e) => handleDelete(session._id, e)}
                title="Archivieren"
              >
                <Archive className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {showArchived && (
            <div className="mt-4 border-t pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground px-2">Archiviert</div>
              {archivedSessions === undefined && (
                <div className="text-sm text-muted-foreground text-center py-2">Loading...</div>
              )}
              {archivedSessions !== undefined && archivedSessions.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-2">Keine archivierten Chats</div>
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
                      {new Date(session._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleUnarchive(session._id)}
                      title="Reaktivieren"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteArchived(session._id)}
                      title="Endgültig löschen"
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
    </div>
  );
}

