import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Send, User, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatMarkdownContent } from "@/components/ChatMarkdownContent";

type ChatMessageDoc = Doc<"chatMessages">;
type ChatMessageDisplay = ChatMessageDoc & { createdAt?: number };
type ChatSession = Doc<"chatSessions">;

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatModal({ isOpen, onClose }: ChatModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString('de-DE', options);
  };
  
  const progress = useQuery(api.progress.getUserProgress);
  const createSessionMutation = useMutation(api.chat.createSession);
  const sendMessageAction = useAction(api.chat.sendMessage);

  // Auto-select first session or create new one if none exists
  useEffect(() => {
    if (!sessions || !isOpen) return;

    if (sessions.length === 0) {
      // No sessions exist, will create one when user sends first message
      setCurrentSessionId(null);
      return;
    }

    // If no current session selected, select the latest one
    if (!currentSessionId) {
      const latestSessionId = sessions[0]._id as unknown as string;
      setCurrentSessionId(latestSessionId);
    } else {
      // Check if current session still exists
      const hasCurrent = sessions.some((s) => (s._id as unknown as string) === currentSessionId);
      if (!hasCurrent) {
        const latestSessionId = sessions[0]._id as unknown as string;
        setCurrentSessionId(latestSessionId);
      }
    }
  }, [sessions, currentSessionId, isOpen]);

  // Fetch messages for current session
  const sessionMessages = useQuery(
    api.chat.getMessages,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );

  const messages = (sessionMessages ?? []) as ChatMessageDisplay[];

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

  const prefillExampleMessage = async (exampleText: string) => {
    const sessionId = await ensureSessionId();
    if (!sessionId) return;

    setMessage(exampleText);
    requestAnimationFrame(() => {
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Fokus zurück auf Input setzen, wenn isSending von true zu false wechselt
  useEffect(() => {
    if (!isSending && inputRef.current && isOpen) {
      // Verwende requestAnimationFrame für bessere Timing-Kontrolle
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (inputRef.current && !inputRef.current.disabled) {
            inputRef.current.focus();
          }
        }, 10);
      });
    }
  }, [isSending, isOpen]);

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

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    // Create session if none exists
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
    setIsSending(true);

    try {
      await sendMessageAction({
        sessionId: sessionIdToUse as any,
        message: messageToSend,
        unitContext: progress?.currentUnit,
      });
    } catch (error: any) {
      console.error("Failed to send message:", error);
      
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

  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:w-[90vw] max-w-5xl max-h-[90vh] min-h-[60vh] sm:min-h-[70vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle>{t('chat.modal.title')}</DialogTitle>
              <DialogDescription>{t('chat.modal.subtitle')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            {messages.length === 0 && (
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
                    onClick={() => void prefillExampleMessage("Explain the verb 'biti' to me")}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion1')}</p>
                  </Card>
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage("What is the locative case?")}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion2')}</p>
                  </Card>
                  <Card
                    className="p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage("Dobar dan! Kako ste?")}
                  >
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
                <Avatar className={`h-8 w-8 flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary' : 'bg-primary'}`}>
                  <AvatarFallback className="text-white text-xs bg-transparent">
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
                      <ChatMarkdownContent content={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
