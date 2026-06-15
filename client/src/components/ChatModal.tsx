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
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Send, User, Brain, Sparkles, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatMarkdownContent } from "@/components/ChatMarkdownContent";
import { useChatStream } from "@/hooks/useChatStream";

type ChatMessageDoc = Doc<"chatMessages">;
type ChatMessageDisplay = ChatMessageDoc & { createdAt?: number };
type ChatSession = Doc<"chatSessions">;

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string;

const BUDDY_SESSION_PREFIX = "buddy-unit-";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillText?: string;
  unitNumber?: number;
}

export function ChatModal({ isOpen, onClose, prefillText, unitNumber }: ChatModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prefillHandledRef = useRef(false);
  const skipAutoSelectRef = useRef(false);
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString('de-DE', options);
  };
  
  const progress = useQuery(api.progress.getUserProgress);
  // Stable day-start timestamp: rounded to midnight UTC so it never changes within a day
  const [todayMs] = useState(() => {
    const now = Date.now();
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  });
  const chatUsage = useQuery(api.chat.getChatUsageToday, { nowMs: todayMs });
  const createSessionMutation = useMutation(api.chat.createSession);
  const addMessageMutation = useMutation(api.chat.addMessage);
  const checkRateLimitMutation = useMutation(api.chat.checkMessageRateLimit);
  const createStreamMutation = useMutation(api.streaming.createStream);
  const addStreamingAssistantMsg = useMutation(api.chat.addStreamingAssistantMessage);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const showUsage = chatUsage !== null && chatUsage !== undefined
    && (!chatUsage.isPaidUser || chatUsage.isAdmin);

  const detailedDisabled = showUsage
    && !chatUsage!.isAdmin
    && chatUsage!.detailedRemaining !== null
    && chatUsage!.detailedRemaining === 0;

  const { data: streamData, feedResponse, reset: resetStream } = useChatStream();

  // Reset prefill tracking and session selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      prefillHandledRef.current = false;
      skipAutoSelectRef.current = false;
      setCurrentSessionId(null);
      setPendingPrefill(null);
    }
  }, [isOpen]);

  // Find or auto-select session based on context
  useEffect(() => {
    if (!sessions || !isOpen) return;

    if (unitNumber != null) {
      const buddyTag = `${BUDDY_SESSION_PREFIX}${unitNumber}`;
      const existing = sessions.find((s) => s.title.startsWith(buddyTag));
      if (existing) {
        setCurrentSessionId(existing._id as unknown as string);
      }
      return;
    }

    if (sessions.length === 0) {
      setCurrentSessionId(null);
      return;
    }

    if (!currentSessionId) {
      if (skipAutoSelectRef.current) return;
      setCurrentSessionId(sessions[0]._id as unknown as string);
    } else {
      const hasCurrent = sessions.some((s) => (s._id as unknown as string) === currentSessionId);
      if (!hasCurrent) {
        setCurrentSessionId(sessions[0]._id as unknown as string);
      }
    }
  }, [sessions, currentSessionId, isOpen, unitNumber, prefillText]);

  // Fetch messages for current session
  const sessionMessages = useQuery(
    api.chat.getMessages,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );

  const messages = (sessionMessages ?? []) as ChatMessageDisplay[];

  const sendStreaming = useCallback(async (text: string, sessionId: string, responseMode?: "compact" | "detailed") => {
    setIsSending(true);

    try {
      await checkRateLimitMutation({
        sessionId: sessionId as Id<"chatSessions">,
        message: text,
        responseMode,
      });

      await addMessageMutation({
        sessionId: sessionId as Id<"chatSessions">,
        role: "user",
        content: text,
        unitContext: unitNumber ?? progress?.currentUnit,
        responseMode,
      });

      const meData = user as Doc<"users"> | null;
      if (!meData) throw new Error("Not authenticated");

      const streamId = await createStreamMutation({});

      const messageId = await addStreamingAssistantMsg({
        sessionId: sessionId as Id<"chatSessions">,
        userId: meData._id,
        streamId: streamId as string,
      });

      resetStream();
      setActiveStreamId(streamId as string);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      fetch(`${CONVEX_SITE_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamId,
          sessionId,
          userId: meData._id,
          messageId,
          responseMode,
        }),
        signal: abortController.signal,
      }).then((response) => {
        if (response.ok && response.body) {
          feedResponse(response);
        } else {
          console.error("Stream response not ok:", response.status);
          toast.error(t('chat.sendError'));
          setActiveStreamId(null);
          setIsSending(false);
        }
      }).catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Stream fetch error:", err);
          toast.error(t('chat.sendError'));
          setActiveStreamId(null);
          setIsSending(false);
        }
      });
    } catch (error: any) {
      console.error("Failed to send message:", error);
      const errorMessage = error.message || t('chat.sendError');

      if (errorMessage.includes('Daily detailed limit reached')) {
        toast.error(errorMessage);
      } else if (errorMessage.includes('Rate limit exceeded')) {
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
      setIsSending(false);
    }
  }, [user, progress, unitNumber, checkRateLimitMutation, addMessageMutation, createStreamMutation, addStreamingAssistantMsg, resetStream, feedResponse, t]);

  // Watch stream status: clean up when done
  useEffect(() => {
    if (!activeStreamId) return;
    if (streamData?.status === "done" || streamData?.status === "error") {
      setActiveStreamId(null);
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [activeStreamId, streamData?.status]);

  // Prefill: when modal opens with prefillText, find/create unit session and auto-send
  useEffect(() => {
    if (!isOpen || !prefillText || prefillHandledRef.current) return;
    if (!sessions) return;

    prefillHandledRef.current = true;

    const run = async () => {
      let sid: string | null = null;

      if (unitNumber != null) {
        const buddyTag = `${BUDDY_SESSION_PREFIX}${unitNumber}`;
        const existing = sessions.find((s) => s.title.startsWith(buddyTag));
        if (existing) {
          sid = existing._id as unknown as string;
        } else {
          try {
            const sessionTitle = `${buddyTag} | ${t("buddy.sessionTitle", { unit: unitNumber })}`;
            const newId = await createSessionMutation({ title: sessionTitle });
            sid = newId as unknown as string;
          } catch {
            toast.error(t('chat.newChatError'));
            return;
          }
        }
      } else {
        sid = currentSessionId;
        if (!sid) {
          try {
            const newId = await createSessionMutation({ title: t('chat.newChat') });
            sid = newId as unknown as string;
          } catch {
            toast.error(t('chat.newChatError'));
            return;
          }
        }
      }

      if (!sid) return;
      setCurrentSessionId(sid);
      setPendingPrefill(prefillText);
    };
    void run();
  }, [isOpen, prefillText, sessions, currentSessionId, unitNumber, createSessionMutation, t]);

  // Auto-scroll to bottom when new messages or stream text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamData.text]);

  // Focus input when sending finishes
  useEffect(() => {
    if (!isSending && inputRef.current && isOpen) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (inputRef.current && !inputRef.current.disabled) {
            inputRef.current.focus();
          }
        }, 10);
      });
    }
  }, [isSending, isOpen]);

  const ensureSessionId = async (): Promise<string | null> => {
    if (currentSessionId) return currentSessionId;
    try {
      const sessionId = await createSessionMutation({ title: t('chat.newChat') });
      const sessionIdStr = sessionId as unknown as string;
      setCurrentSessionId(sessionIdStr);
      return sessionIdStr;
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error(t('chat.newChatError'));
      return null;
    }
  };

  const handleModeSelect = useCallback(async (mode: "compact" | "detailed") => {
    if (!pendingPrefill || !currentSessionId) return;
    const suffix = mode === "compact"
      ? t("buddy.modeSuffix.compact")
      : t("buddy.modeSuffix.detailed");
    const fullMessage = pendingPrefill + suffix;
    setPendingPrefill(null);
    await sendStreaming(fullMessage, currentSessionId, mode);
  }, [pendingPrefill, currentSessionId, sendStreaming]);

  const prefillExampleMessage = async (exampleText: string) => {
    const sessionId = await ensureSessionId();
    if (!sessionId) return;

    setMessage(exampleText);
    requestAnimationFrame(() => {
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  };

  const handleNewChat = async () => {
    if (isCreatingSession || isSending) return;
    setIsCreatingSession(true);
    try {
      abortControllerRef.current?.abort();
      resetStream();
      setActiveStreamId(null);
      setPendingPrefill(null);
      setMessage("");

      const sessionId = await createSessionMutation({ title: t('chat.newChat') });
      skipAutoSelectRef.current = true;
      setCurrentSessionId(sessionId as unknown as string);
      toast.success(t('chat.newChatSuccess'));
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error(t('chat.newChatError'));
    } finally {
      setIsCreatingSession(false);
    }
  };

  const headerActionsDisabled = isSending || isCreatingSession;

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    let sessionIdToUse = currentSessionId;
    if (!sessionIdToUse) {
      try {
        sessionIdToUse = await createSessionMutation({ title: t('chat.newChat') }) as unknown as string;
        setCurrentSessionId(sessionIdToUse);
      } catch (error) {
        console.error("Failed to create session:", error);
        toast.error(t('chat.newChatError'));
        return;
      }
    }

    const messageToSend = message;
    setMessage("");
    await sendStreaming(messageToSend, sessionIdToUse);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:w-[90vw] max-w-5xl max-h-[90vh] min-h-[60vh] sm:min-h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b pr-14">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <DialogTitle>{t('chat.modal.title')}</DialogTitle>
              <DialogDescription>{t('chat.modal.subtitle')}</DialogDescription>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleNewChat()}
              disabled={headerActionsDisabled}
              className="h-7 px-2.5 text-xs font-normal shrink-0"
            >
              <MessageSquarePlus className="h-3 w-3 mr-1.5 shrink-0" />
              {t('chat.modal.newChat')}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {pendingPrefill && !activeStreamId && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
                  <Brain className="h-9 w-9 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold mb-2">{t("buddy.modeSelect.title", "How detailed should the answer be?")}</h2>
                  <p className="text-sm text-muted-foreground">{t("buddy.modeSelect.subtitle", "Choose the level of detail for this answer.")}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-sm w-full">
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void handleModeSelect("compact")}
                  >
                    <p className="text-sm font-semibold mb-1">{t("buddy.modeSelect.compact", "Compact")}</p>
                    <p className="text-xs text-muted-foreground">{t("buddy.modeSelect.compactDesc", "3-4 sentences, essentials only")}</p>
                  </Card>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card
                          className={`p-4 transition-colors ${detailedDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent cursor-pointer"}`}
                          onClick={() => !detailedDisabled && void handleModeSelect("detailed")}
                        >
                          <p className="text-sm font-semibold mb-1">{t("buddy.modeSelect.detailed", "Detailed")}</p>
                          <p className="text-xs text-muted-foreground">
                            {detailedDisabled
                              ? t("buddy.modeSelect.detailedLimitReached", "Daily limit reached")
                              : t("buddy.modeSelect.detailedDesc", "Full explanation with examples")}
                          </p>
                          {!detailedDisabled && chatUsage?.detailedRemaining !== null && chatUsage?.detailedRemaining !== undefined && (
                            <p className="text-xs text-primary/70 mt-1.5 border-t pt-1.5">
                              {t("buddy.modeSelect.detailedQuota", "{{remaining}} of {{limit}} left today", { remaining: chatUsage.detailedRemaining, limit: chatUsage.detailedLimit })}
                            </p>
                          )}
                        </Card>
                      </TooltipTrigger>
                      {detailedDisabled && (
                        <TooltipContent>
                          <p>{t("buddy.modeSelect.detailedLimitTooltip", "You have used all detailed answers for today. Come back tomorrow!")}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}

            {messages.length === 0 && !activeStreamId && !pendingPrefill && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center">
                  <Brain className="h-12 w-12 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('chat.welcome.title')}</h2>
                  <p className="text-muted-foreground mb-2">{t('chat.welcome.subtitle')}</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    <span className="font-medium text-foreground/80">{t('chat.welcome.examplesHintTitle')}</span>{" "}
                    {t('chat.welcome.examplesHint')}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl">
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.1'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion1')}</p>
                  </Card>
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.2'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion2')}</p>
                  </Card>
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.3'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion3')}</p>
                  </Card>
                </div>
              </div>
            )}
            
            {!pendingPrefill && messages.map((msg: ChatMessageDisplay, idx: number) => {
              const isStreamingMsg = msg.role === "assistant" && (msg as any).streamId && (msg as any).streamId === activeStreamId;
              const displayContent = isStreamingMsg
                ? (streamData?.text || "")
                : msg.content;

              return (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className={`h-8 w-8 flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary' : 'bg-card border'}`}>
                    {msg.role === 'user' && myAvatar?.url ? (
                      <AvatarImage src={myAvatar.url} alt="Your avatar" />
                    ) : null}
                    <AvatarFallback className={`text-xs ${msg.role === 'assistant' ? 'text-white bg-transparent' : 'bg-muted text-foreground'}`}>
                      {msg.role === 'assistant' ? <Brain className="h-5 w-5 text-white" /> : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-[1.35] sm:leading-[1.43] ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : 'bg-muted text-foreground rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <ChatMarkdownContent content={displayContent} />
                      ) : (
                        <p className="whitespace-pre-wrap text-xs sm:text-sm leading-[1.35] sm:leading-[1.43]">{msg.content}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 px-2">
                      {formatMessageTime(msg._creationTime || msg.createdAt || Date.now())}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {!pendingPrefill && isSending && !activeStreamId && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0 bg-primary">
                  <AvatarFallback className="text-white text-xs bg-transparent">
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

          {/* Unit session hint */}
          {unitNumber != null && (
            <div className="px-4 py-2 bg-primary/5 border-t text-xs text-muted-foreground text-center">
              {t("buddy.sessionHint", { unit: unitNumber })}
            </div>
          )}

          {/* Input Area -- hidden while mode-selection (pendingPrefill) is active */}
          {!pendingPrefill && <div className="border-t p-4 bg-muted/30">
            {showUsage && chatUsage && (
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
                placeholder={t('chat.placeholder')}
                className="flex-1 rounded-full"
                disabled={isSending}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
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
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
