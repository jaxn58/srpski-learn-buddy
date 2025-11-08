import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { MessageSquarePlus, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatSessionsSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatSessionsSidebar({ currentSessionId, onSelectSession, onNewChat }: ChatSessionsSidebarProps) {
  const { data: sessions, isLoading } = trpc.chat.getSessions.useQuery();
  const deleteMutation = trpc.chat.deleteSession.useMutation();
  const utils = trpc.useUtils();

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    
    try {
      await deleteMutation.mutateAsync({ sessionId });
      utils.chat.getSessions.invalidate();
      
      // If deleting current session, trigger new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  return (
    <div className="w-64 border-r bg-card/50 flex flex-col h-full">
      <div className="p-4 border-b">
        <Button 
          onClick={onNewChat} 
          className="w-full"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Chat
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

          {sessions?.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                "hover:bg-accent",
                currentSessionId === session.id && "bg-accent"
              )}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {session.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(session.updatedAt!).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(session.id, e)}
                disabled={deleteMutation.isPending}
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

