import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Send, Brain, Sparkles, Info, ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { ChatMobileSheet } from "@/components/ChatMobileSheet";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { ChatSessionsSidebar } from "@/components/ChatSessionsSidebar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChatMarkdownContent } from "@/components/ChatMarkdownContent";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const [todayMs] = useState(() => {
    const now = Date.now();
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  });
  const chatUsage = useQuery(api.chat.getChatUsageToday, { nowMs: todayMs });
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString('de-DE', options);
  };
  const progress = useQuery(api.progress.getUserProgress);
  const createSessionMutation = useMutation(api.chat.createSession);
  const sendMessageAction = useAction(api.chat.sendMessage);

  const createNewSession = async (options?: { showSuccessToast?: boolean }): Promise<string | null> => {
    if (isCreatingSession) return null;
    setIsCreatingSession(true);
    try {
      const sessionId = await createSessionMutation({ title: t('chat.newChat') });
      const sessionIdStr = sessionId as unknown as string;
      setCurrentSessionId(sessionIdStr);
      if (options?.showSuccessToast) {
        toast.success(t('chat.newChatSuccess'));
      }
      return sessionIdStr;
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error(t('chat.newChatError'));
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const prefillExampleMessage = async (exampleText: string) => {
    const sessionIdToUse = currentSessionId ?? (await createNewSession());
    if (!sessionIdToUse) return;

    setMessage(exampleText);
    requestAnimationFrame(() => {
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  };

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

  // Fokus zurück auf Input setzen, wenn isSending von true zu false wechselt
  useEffect(() => {
    if (!isSending && inputRef.current) {
      // Verwende requestAnimationFrame für bessere Timing-Kontrolle
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (inputRef.current && !inputRef.current.disabled) {
            inputRef.current.focus();
          }
        }, 10);
      });
    }
  }, [isSending]);

  const handleNewChat = async () => {
    await createNewSession({ showSuccessToast: true });
  };

  const handleSelectSession = async (sessionId: string | null) => {
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
      
      // Handle rate limit errors with specific messages
      const errorMessage = error.message || t('chat.sendError');
      
      if (errorMessage.includes('Rate limit exceeded')) {
        if (errorMessage.includes('per minute')) {
          toast.error(t('chat.rateLimit.perMinute'));
        } else if (errorMessage.includes('per hour')) {
          toast.error(t('chat.rateLimit.perHour'));
        } else {
          toast.error(errorMessage);
        }
      } else if (errorMessage.includes('Message too long')) {
        toast.error(t('chat.rateLimit.messageLength'));
      } else if (errorMessage.includes('Duplicate message')) {
        toast.error(t('chat.rateLimit.duplicate'));
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSending(false);
      // Fokus zurück auf das Eingabefeld setzen
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputFocus = () => {
    if (!isMobile) return;
    // Warte auf Tastatur-Animation, dann scrolle Input ins Sichtfeld
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 350);
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

  const currentSession = sessions?.find(
    (s) => (s._id as unknown as string) === currentSessionId
  );

  return (
    <AnimatedPage className="flex flex-col flex-1 min-h-0">
      {/* Mobile-Only Header (ersetzt TopNavigation auf /chat) */}
      {isMobile && (
        <div className="flex items-center gap-2 px-3 py-2 bg-background border-b shrink-0 pt-[env(safe-area-inset-top)]">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <ChatMobileSheet
              currentSessionId={currentSessionId}
              currentSessionTitle={currentSession?.title}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              isCreatingSession={isCreatingSession}
            />
          </div>
        </div>
      )}

      <div className="flex w-full gap-6 flex-1 min-h-0">
        <ChatSessionsSidebar 
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <main className="w-full flex-1 flex flex-col min-h-0">
        <div className="flex flex-col bg-card border-0 sm:border rounded-none sm:rounded-xl shadow-none sm:shadow-sm flex-1 min-h-0">
          {/* Top tools row: nur auf Desktop sichtbar */}
          <div className="hidden sm:flex px-4 pt-4 items-center justify-end">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Info className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('chat.usage.title')}</span>
                  <span className="sm:hidden">{t("common.info")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    {t('chat.usage.title')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('chat.usage.intro')}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Tips Section */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{t('chat.usage.tip1.title')}</h4>
                        <p className="text-sm text-muted-foreground">{t('chat.usage.tip1.desc')}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{t('chat.usage.tip2.title')}</h4>
                        <p className="text-sm text-muted-foreground">{t('chat.usage.tip2.desc')}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{t('chat.usage.tip3.title')}</h4>
                        <p className="text-sm text-muted-foreground">{t('chat.usage.tip3.desc')}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Fair Use Protection Section */}
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {t('chat.usage.protection.title')}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{t('chat.usage.protection.beta')}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{t('chat.usage.protection.paid')}</span>
                      </div>
                      <p className="text-muted-foreground mt-3 italic">
                        {t('chat.usage.protection.note')}
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-serbian-red flex items-center justify-center">
                  <Brain className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">{t('chat.welcome.title')}</h2>
                  <p className="text-muted-foreground mb-2">{t('chat.welcome.subtitle')}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    <span className="font-medium text-foreground/80">{t('chat.welcome.examplesHintTitle')}</span>{" "}
                    {t('chat.welcome.examplesHint')}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
                  <AnimatedItem>
                    <Card
                      className="p-4 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => void prefillExampleMessage("Explain the verb 'biti' to me")}
                    >
                      <p className="text-sm font-medium">{t('chat.suggestion1')}</p>
                    </Card>
                  </AnimatedItem>
                  <AnimatedItem>
                    <Card
                      className="p-4 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => void prefillExampleMessage("What is the locative case?")}
                    >
                      <p className="text-sm font-medium">{t('chat.suggestion2')}</p>
                    </Card>
                  </AnimatedItem>
                  <AnimatedItem>
                    <Card
                      className="p-4 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => void prefillExampleMessage("Dobar dan! Kako ste?")}
                    >
                      <p className="text-sm font-medium">{t('chat.suggestion3')}</p>
                    </Card>
                  </AnimatedItem>
                </div>
              </div>
            )}
            
            {messages.map((msg: ChatMessageDisplay, idx: number) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar
                  className={cn(
                    "h-8 w-8 flex-shrink-0",
                    msg.role === "assistant" ? "bg-serbian-blue" : "bg-card border"
                  )}
                >
                  {msg.role === "user" && myAvatar?.url ? (
                    <AvatarImage src={myAvatar.url} alt="Your avatar" />
                  ) : null}
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      msg.role === "assistant" ? "text-white bg-transparent" : "bg-muted text-foreground"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <Brain className="h-5 w-5 text-white" />
                    ) : (
                      <span className="font-semibold">
                        {(user?.publicNickname || user?.name || user?.email || "U")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm leading-[1.35] sm:leading-[1.43] ${
                      msg.role === 'user'
                        ? 'bg-serbian-blue text-white rounded-br-none'
                        : 'bg-muted text-foreground rounded-bl-none'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <ChatMarkdownContent content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs sm:text-sm leading-[1.35] sm:leading-[1.43]">{msg.content}</p>
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
                <Avatar className="h-8 w-8 flex-shrink-0 bg-serbian-blue">
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
          <div className="p-3 sm:p-4 bg-muted/20 rounded-none sm:rounded-b-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {chatUsage && (!chatUsage.isPaidUser || chatUsage.isAdmin) && (
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <span>{t("chat.usage.messagesLeft", "{{remaining}} of {{limit}} messages left", { remaining: chatUsage.remaining, limit: chatUsage.limit })}</span>
                {chatUsage.detailedLimit !== null && chatUsage.detailedRemaining !== null && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    <span className={chatUsage.detailedRemaining === 0 ? "text-destructive/70" : ""}>
                      {t("chat.usage.detailedLeft", "{{remaining}} of {{limit}} detailed left", { remaining: chatUsage.detailedRemaining, limit: chatUsage.detailedLimit })}
                    </span>
                  </>
                )}
                {chatUsage.isAdmin && (
                  <span className="text-muted-foreground/40 italic">(admin)</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={handleInputFocus}
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
          </main>
        </div>
      </div>
    </AnimatedPage>
  );
}
