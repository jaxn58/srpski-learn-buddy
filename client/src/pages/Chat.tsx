import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Send, User, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sidebar } from "@/components/Sidebar";
import { ChatSessionsSidebar } from "@/components/ChatSessionsSidebar";
import { useTranslation } from "react-i18next";

// Custom Markdown components for clean rendering
const markdownComponents = {
  p: ({node, ...props}: any) => <p className="mb-3 leading-relaxed" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1.5" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1.5" {...props} />,
  li: ({node, ...props}: any) => <li className="mb-0.5" {...props} />,
  code: ({node, inline, ...props}: any) => 
    inline ? 
      <code className="bg-muted/80 px-1.5 py-0.5 rounded text-xs font-mono" {...props} /> :
      <code className="block bg-muted/80 p-3 rounded-md text-xs font-mono overflow-x-auto mb-3" {...props} />,
  pre: ({node, children, ...props}: any) => <pre className="mb-3" {...props}>{children}</pre>,
  table: ({node, ...props}: any) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm border-collapse border border-border" {...props} />
    </div>
  ),
  thead: ({node, ...props}: any) => <thead className="bg-muted/60" {...props} />,
  tbody: ({node, ...props}: any) => <tbody {...props} />,
  tr: ({node, ...props}: any) => <tr className="border-b border-border" {...props} />,
  th: ({node, ...props}: any) => <th className="text-left font-semibold p-2 border-r border-border last:border-r-0" {...props} />,
  td: ({node, ...props}: any) => <td className="p-2 border-r border-border last:border-r-0" {...props} />,
  blockquote: ({node, ...props}: any) => <blockquote className="border-l-4 border-primary/50 pl-3 italic mb-3 text-muted-foreground" {...props} />,
  h1: ({node, ...props}: any) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
  h3: ({node, ...props}: any) => <h3 className="text-sm font-bold mb-2 mt-2 first:mt-0" {...props} />,
  strong: ({node, ...props}: any) => <strong className="font-bold text-foreground" {...props} />,
  em: ({node, ...props}: any) => <em className="italic" {...props} />,
  hr: ({node, ...props}: any) => <hr className="my-4 border-border" {...props} />,
};

type ChatMessageDoc = Doc<"chatMessages">;
type ChatMessageDisplay = ChatMessageDoc & { createdAt?: number };
type ChatSession = Doc<"chatSessions">;

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString('de-DE', options);
  };
  const progress = useQuery(api.progress.getUserProgress);
  const createSessionMutation = useMutation(api.chat.createSession);
  const sendMessageAction = useAction(api.chat.sendMessage);

  // Wähle den ersten vorhandenen Chat, wenn keiner selektiert ist oder der aktuelle nicht mehr existiert.
  // Keine Auto-Erstellung eines neuen Chats bei leerer Liste.
  useEffect(() => {
    if (!sessions) return; // loading

    const hasCurrent = currentSessionId && sessions.some((s) => (s._id as unknown as string) === currentSessionId);

    if (sessions.length === 0) {
      if (currentSessionId) {
        setCurrentSessionId(null);
      }
      return;
    }

    if (!hasCurrent) {
      const latestSessionId = sessions[0]._id as unknown as string;
      setCurrentSessionId(latestSessionId);
    }
  }, [sessions, currentSessionId]);

  // Fetch messages for current session - Convex handles reactivity automatically
  const sessionMessages = useQuery(
    api.chat.getMessages,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );

  // Use Convex messages directly, with fallback to local state during loading
  const messages = (sessionMessages ?? []) as ChatMessageDisplay[];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleNewChat = async () => {
    try {
      const sessionId = await createSessionMutation({ title: t('chat.newChat') });
      setCurrentSessionId(sessionId as unknown as string);
      toast.success(t('chat.newChatSuccess'));
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error(t('chat.newChatError'));
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    // Messages will be loaded automatically via useQuery
  };

  const handleSend = async () => {
    if (!message.trim() || isSending || !currentSessionId) return;

    const messageToSend = message;
    setMessage("");
    setIsSending(true);

    try {
      // Call AI action - it saves the user message and gets AI response
      // Messages will be updated automatically via the sessionMessages query
      await sendMessageAction({
        sessionId: currentSessionId as any,
        message: messageToSend,
        unitContext: progress?.currentUnit,
      });
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast.error(error.message || t('chat.sendError'));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Sidebar />
      <div className="flex flex-1 w-full md:ml-64">
        <ChatSessionsSidebar 
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
        <div className="flex-1 w-full">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">{t('chat.back')}</Button>
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{t('chat.title')}</h1>
                <p className="text-xs text-muted-foreground">{t('chat.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-4xl">
        <div className="h-[calc(100vh-180px)] flex flex-col bg-card rounded-lg shadow-lg border">
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <Brain className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">{t('chat.welcome.title')}</h2>
                  <p className="text-muted-foreground mb-4">{t('chat.welcome.subtitle')}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("Explain the verb 'biti' to me")}>
                    <p className="text-sm font-medium">{t('chat.suggestion1')}</p>
                  </Card>
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("What is the locative case?")}>
                    <p className="text-sm font-medium">{t('chat.suggestion2')}</p>
                  </Card>
                  <Card className="p-4 hover:bg-accent cursor-pointer transition-colors" onClick={() => setMessage("Dobar dan! Kako ste?")}>
                    <p className="text-sm font-medium">{t('chat.suggestion3')}</p>
                  </Card>
                </div>
              </div>
            )}
            
            {messages.map((msg: ChatMessageDisplay, idx: number) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className={`h-8 w-8 flex-shrink-0 ${msg.role === 'assistant' ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-primary'}`}>
                  <AvatarFallback className="text-white text-xs bg-transparent">
                    {msg.role === 'assistant' ? <Brain className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="markdown-content">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 px-2">
                    {formatMessageTime(msg._creationTime || msg.createdAt || Date.now())}
                  </span>
                </div>
              </div>
            ))}
            
            {isSending && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                  <AvatarFallback className="text-white text-xs">
                    <Sparkles className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-muted/30">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={currentSessionId ? t('chat.placeholder') : t('chat.noSessionPlaceholder', 'Please start a new chat first')}
                className="flex-1 rounded-full"
                disabled={isSending || !currentSessionId}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isSending || !currentSessionId}
                size="icon"
                className="rounded-full h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!currentSessionId && (
              <div className="text-center mt-2">
                <Button variant="link" size="sm" onClick={handleNewChat} className="text-primary">
                  {t('chat.startNewChat', 'Start a new chat to begin')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="container py-8 border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold">© Developed by JACKSENN.ME 2025</p>
          </div>
        </footer>
      </main>
      </div>
    </div>
    </div>
  );
}

