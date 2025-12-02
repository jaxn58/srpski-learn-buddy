import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MessageSquarePlus, Trash2, MessageSquare, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatSessionsSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatSessionsSidebar({ currentSessionId, onSelectSession, onNewChat }: ChatSessionsSidebarProps) {
  const sessions = useQuery(api.chat.getSessions);
  const isLoading = sessions === undefined;
  const deleteSessionMutation = useMutation(api.chat.deleteSession);
  const bulkDeleteMutation = useMutation(api.chat.bulkDeleteNewChats);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    
    try {
      await deleteSessionMutation({ sessionId: sessionId as any });
      
      // If deleting current session, trigger new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleBulkDeleteNewChats = async () => {
    const newChatCount = sessions?.filter(s => s.title === "New Chat").length || 0;
    if (newChatCount === 0) {
      toast.info("No empty chats to delete.");
      return;
    }
    
    if (!confirm(`Delete all ${newChatCount} empty chat${newChatCount > 1 ? 's' : ''}? This cannot be undone.`)) return;
    
    try {
      const result = await bulkDeleteMutation({});
      
      // If current session was deleted, trigger new chat
      const currentSession = sessions?.find(s => s._id === currentSessionId);
      if (currentSession?.title === "New Chat") {
        onNewChat();
      }
      
      toast.success(`Successfully deleted ${result.deletedCount} empty chat${result.deletedCount > 1 ? 's' : ''}.`);
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      toast.error("Failed to delete empty chats. Please try again.");
    }
  };

  return (
    <div className="w-64 border-r bg-card/50 flex flex-col h-full">
      <div className="p-4 border-b space-y-2">
        <Button 
          onClick={onNewChat} 
          className="w-full"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
        
        {sessions?.some(s => s.title === "New Chat") && (
          <Button 
            onClick={handleBulkDeleteNewChats}
            variant="outline"
            className="w-full text-xs"
            size="sm"
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash className="h-3 w-3 mr-2" />
            Clear Empty Chats ({sessions.filter(s => s.title === "New Chat").length})
          </Button>
        )}
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

          {sessions?.map((session) => (
            <div
              key={session._id}
              onClick={() => onSelectSession(session._id)}
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
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(session._id, e)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

