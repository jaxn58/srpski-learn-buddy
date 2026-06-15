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
import { Send, Brain, Sparkles, Info, ArrowLeft, Square, ThumbsUp, ThumbsDown, Languages, Globe, LifeBuoy, Paperclip, X, FileText, Image as ImageIcon, Loader2, MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useFeatureAccess, canUseDocuments } from "@/hooks/useFeatureAccess";
import { ChatMobileSheet } from "@/components/ChatMobileSheet";
import { toast } from "sonner";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "wouter";
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { ChatSessionsSidebar } from "@/components/ChatSessionsSidebar";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChatMarkdownContent } from "@/components/ChatMarkdownContent";
import { useChatStream } from "@/hooks/useChatStream";
import { EnergyPill } from "@/components/chat/EnergyPill";

type ChatMessageDoc = Doc<"chatMessages">;
type ChatMessageDisplay = ChatMessageDoc & { createdAt?: number };
type ChatSession = Doc<"chatSessions">;

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string;

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{
    storageId: string;
    fileName: string;
    fileType: string;
    fileBytes: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showAttachHint, setShowAttachHint] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const myAvatar = useQuery(api.users.getMyPublicAvatarUrl, user ? {} : "skip");
  const uiLang = (typeof navigator !== "undefined" && navigator.language?.startsWith("de")) ? "de" : "en";
  
  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString(i18n.language || 'en', options);
  };
  const progress = useQuery(api.progress.getUserProgress);

  // Beta daily usage tracking -- nowMs refreshes every minute to catch midnight reset
  const [usageNowMs, setUsageNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setUsageNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const chatUsage = useQuery(api.chat.getChatUsageToday, { nowMs: usageNowMs });
  const isDailyLimitReached = chatUsage != null && chatUsage.remaining === 0;

  // Live energy preview for the next action (drives the pill overlay and the
  // send-button "not enough Energy" state). RAG is hinted true because the
  // chat surface ships unit context + semantic search by default.
  const upcomingEnergyEstimate = useQuery(api.chat.estimateEnergyForAction, {
    ragHinted: true,
  });
  const upcomingEnergyCost = upcomingEnergyEstimate?.cost ?? null;
  const energyBlocksSend =
    upcomingEnergyEstimate != null &&
    !upcomingEnergyEstimate.unlimited &&
    !upcomingEnergyEstimate.teaserOnly &&
    !upcomingEnergyEstimate.enough;

  // Beta banner dismiss state (localStorage-based, per-session until dismissed)
  const BETA_BANNER_KEY = "chat_beta_banner_dismissed";
  const [betaBannerVisible, setBetaBannerVisible] = useState(() => {
    try { return localStorage.getItem(BETA_BANNER_KEY) !== "1"; } catch { return true; }
  });
  const dismissBetaBanner = () => {
    try { localStorage.setItem(BETA_BANNER_KEY, "1"); } catch { /* ignore */ }
    setBetaBannerVisible(false);
  };
  const createSessionMutation = useMutation(api.chat.createSession);
  const sendMessageAction = useAction(api.chat.sendMessage);
  const addMessageMutation = useMutation(api.chat.addMessage);
  const checkRateLimitMutation = useMutation(api.chat.checkMessageRateLimit);
  const createStreamMutation = useMutation(api.streaming.createStream);
  const addStreamingAssistantMsg = useMutation(api.chat.addStreamingAssistantMessage);
  const updateSessionMutation = useMutation(api.chat.updateSession);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const featureAccess = useFeatureAccess();
  const canUploadDocuments = canUseDocuments(featureAccess);

  const { data: streamData, feedResponse, reset: resetStream } = useChatStream();

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

  const prefillHandledRef = useRef(false);

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

  // Deep-link: read ?prefill= from URL and pre-fill the chat input
  useEffect(() => {
    if (prefillHandledRef.current) return;
    if (!sessions) return;

    const params = new URLSearchParams(window.location.search);
    const prefillText = params.get("prefill");
    if (!prefillText) return;

    prefillHandledRef.current = true;
    window.history.replaceState({}, "", window.location.pathname);

    const run = async () => {
      const sid = currentSessionId ?? (await createNewSession());
      if (!sid) return;
      setMessage(decodeURIComponent(prefillText));
      requestAnimationFrame(() => {
        setTimeout(() => inputRef.current?.focus(), 0);
      });
    };
    void run();
  }, [sessions, currentSessionId]);

  // Fetch messages for current session - Convex handles reactivity automatically
  const sessionMessages = useQuery(
    api.chat.getMessages,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );

  // Use Convex messages directly, with fallback to local state during loading
  const messages = (sessionMessages ?? []) as ChatMessageDisplay[];

  const sessionFeedback = useQuery(
    api.chat.getSessionFeedback,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );
  const feedbackByMessage = new Map(
    (sessionFeedback ?? []).map((f: { messageId: Id<"chatMessages">; rating: string }) => [f.messageId, f.rating])
  );
  const submitFeedback = useMutation(api.chat.submitMessageFeedback);

  const scrollRafRef = useRef(0);
  useEffect(() => {
    if (!scrollRef.current) return;
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, [messages, streamData.text]);

  // Stream-Status beobachten: wenn fertig, Streaming-State aufräumen
  useEffect(() => {
    if (!activeStreamId) return;
    if (streamData?.status === "done" || streamData?.status === "error") {
      setActiveStreamId(null);
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [activeStreamId, streamData?.status]);

  // Fokus zurück auf Input setzen, wenn isSending von true zu false wechselt
  useEffect(() => {
    if (!isSending && inputRef.current) {
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

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setActiveStreamId(null);
    setIsSending(false);
  }, []);

  const ALLOWED_ATTACH_TYPES = [
    "application/pdf", "text/plain", "text/markdown",
    "image/jpeg", "image/png", "image/webp",
  ];
  const MAX_ATTACH_SIZE: Record<string, number> = {
    "application/pdf":  200 * 1024,
    "text/plain":        50 * 1024,
    "text/markdown":     50 * 1024,
    "image/jpeg":     3 * 1024 * 1024,
    "image/png":      3 * 1024 * 1024,
    "image/webp":     3 * 1024 * 1024,
  };

  const compressImage = useCallback((file: File, maxDim = 1024, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ATTACH_TYPES.includes(file.type)) {
      toast.error(t('chat.unsupportedFile', 'PDF, TXT, MD, JPG, PNG or WebP only'));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const maxSize = MAX_ATTACH_SIZE[file.type] ?? 1 * 1024 * 1024;
    if (file.size > maxSize) {
      const isImage = file.type.startsWith("image/");
      const isText = file.type === "text/plain" || file.type === "text/markdown";
      if (isImage) {
        toast.error(t('chat.fileTooLarge.image', 'Images: max. 3 MB'));
      } else if (isText) {
        toast.error(t('chat.fileTooLarge.text', 'Text files: max. 50 KB'));
      } else {
        toast.error(t('chat.fileTooLarge.pdf', 'PDF: max. 200 KB'));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      let uploadBody: Blob = file;
      let uploadType = file.type || "application/octet-stream";

      if (isImage) {
        uploadBody = await compressImage(file);
        uploadType = "image/jpeg";
      }

      // Pre-flight: report intended bytes/type so the backend can enforce the
      // upload cap and AI-Energy budget BEFORE we transfer the file.
      const intendedBytes = uploadBody.size;
      const uploadUrl = await generateUploadUrl({
        fileBytes: intendedBytes,
        fileType: uploadType,
      });
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadType },
        body: uploadBody,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { storageId } = await resp.json();
      setAttachedFile({
        storageId,
        fileName: file.name,
        fileType: uploadType,
        fileBytes: intendedBytes,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !attachedFile) || isSending || !currentSessionId) return;
    if (isDailyLimitReached) return;

    const messageToSend = message;
    const currentAttachment = attachedFile;
    setMessage("");
    setAttachedFile(null);
    setIsSending(true);

    try {
      const hasImage = !!currentAttachment && currentAttachment.fileType.startsWith("image/");
      const hasFile = !!currentAttachment && !hasImage;

      await checkRateLimitMutation({
        sessionId: currentSessionId as Id<"chatSessions">,
        message: messageToSend,
        hasImageAttachment: hasImage,
        hasFileAttachment: hasFile,
        attachmentBytes: currentAttachment?.fileBytes,
        ragHinted: true,
      });

      await addMessageMutation({
        sessionId: currentSessionId as Id<"chatSessions">,
        role: "user",
        content: messageToSend || (currentAttachment ? `[Attached: ${currentAttachment.fileName}]` : ""),
        unitContext: progress?.currentUnit,
        ...(currentAttachment ? {
          attachmentStorageId: currentAttachment.storageId,
          attachmentFileName: currentAttachment.fileName,
        } : {}),
      });

      const meData = await new Promise<Doc<"users"> | null>((resolve) => {
        resolve(user as Doc<"users"> | null);
      });
      if (!meData) throw new Error("Not authenticated");

      const streamId = await createStreamMutation({});

      const messageId = await addStreamingAssistantMsg({
        sessionId: currentSessionId as Id<"chatSessions">,
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
          sessionId: currentSessionId,
          userId: meData._id,
          messageId,
          ...(currentAttachment ? {
            attachmentStorageId: currentAttachment.storageId,
            attachmentFileName: currentAttachment.fileName,
            attachmentFileType: currentAttachment.fileType,
            attachmentBytes: currentAttachment.fileBytes,
          } : {}),
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

      // Auto-rename session title
      const sessionForTitle = sessions?.find(
        (s) => (s._id as unknown as string) === currentSessionId
      );
      if (sessionForTitle?.title === t('chat.newChat') && (messages?.length ?? 0) <= 1) {
        const title = messageToSend.slice(0, 20) + (messageToSend.length > 20 ? "..." : "");
        updateSessionMutation({
          sessionId: currentSessionId as Id<"chatSessions">,
          title,
        }).catch(() => {});
      }
    } catch (error: any) {
      console.error("Failed to send message:", error);
      setActiveStreamId(null);

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
      setIsSending(false);
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
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("chat.backAria")}>
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
          {/* Beta Banner */}
          {betaBannerVisible && chatUsage != null && !chatUsage.isPaidUser && (
            <div className="mx-3 mt-2 sm:mx-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{t('chat.beta.banner')}</span>
              <button
                type="button"
                onClick={dismissBetaBanner}
                className="shrink-0 p-1.5 font-semibold underline underline-offset-2 hover:no-underline ml-1 text-xs min-h-[44px] min-w-[44px] flex items-center"
              >
                {t('chat.beta.bannerDismiss')}
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4"
          >
            {messages.length === 0 && (() => {
              return (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                  <div className="h-20 w-20 rounded-full bg-serbian-red flex items-center justify-center">
                    <Brain className="h-12 w-12 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{t('chat.welcome.title')}</h2>
                    <p className="text-muted-foreground mb-2">{t('chat.welcome.subtitle')}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl w-full">
                    {[
                      { key: "language", icon: <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />, bg: "bg-blue-100 dark:bg-blue-900/30", text: t('chat.suggestion1') },
                      { key: "culture", icon: <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />, bg: "bg-amber-100 dark:bg-amber-900/30", text: t('chat.suggestion2') },
                      { key: "sos", icon: <LifeBuoy className="h-4 w-4 text-red-600 dark:text-red-400" />, bg: "bg-red-100 dark:bg-red-900/30", text: t('chat.suggestion3') },
                    ].map((s) => (
                      <AnimatedItem key={s.key}>
                        <Card
                          className="p-4 hover:bg-accent cursor-pointer transition-colors h-full text-left"
                          onClick={() => void prefillExampleMessage(s.text)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", s.bg)}>
                              {s.icon}
                            </div>
                          </div>
                          <p className="text-xs text-primary font-medium leading-relaxed">
                            {s.text}
                          </p>
                        </Card>
                      </AnimatedItem>
                    ))}
                  </div>
                </div>
              );
            })()}
            
            {messages.map((msg: ChatMessageDisplay, idx: number) => {
              const isStreamingMsg = msg.role === "assistant" && msg.streamId && msg.streamId === activeStreamId;
              const displayContent = isStreamingMsg
                ? (streamData?.text || "")
                : msg.content;

              return (
                <div
                  key={msg._id || idx}
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
                        displayContent ? (
                          <div className={isStreamingMsg ? "streaming-cursor" : undefined}>
                            <ChatMarkdownContent content={displayContent} />
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        )
                      ) : (
                        <>
                          {msg.attachmentFileName && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/20">
                              {msg.attachmentFileName.match(/\.(jpg|jpeg|png|webp)$/i)
                                ? <ImageIcon className="h-3 w-3 shrink-0 opacity-80" />
                                : <FileText className="h-3 w-3 shrink-0 opacity-80" />}
                              <span className="text-[11px] opacity-90 truncate max-w-[200px]">{msg.attachmentFileName}</span>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap text-xs sm:text-sm leading-[1.35] sm:leading-[1.43]">{displayContent}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-2">
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(msg._creationTime || msg.createdAt || Date.now())}
                      </span>
                      {msg.role === "assistant" && msg._id && !isStreamingMsg && (
                        <div className="flex items-center gap-0.5 ml-1">
                          <button
                            onClick={() => submitFeedback({
                              messageId: msg._id as Id<"chatMessages">,
                              sessionId: currentSessionId as Id<"chatSessions">,
                              rating: "up",
                            })}
                            className={cn(
                              "p-2.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
                              feedbackByMessage.get(msg._id as Id<"chatMessages">) === "up"
                                ? "text-green-600 bg-green-100"
                                : "text-muted-foreground/40 hover:text-green-600 hover:bg-green-50"
                            )}
                            aria-label={t("chat.feedback.helpful")}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => submitFeedback({
                              messageId: msg._id as Id<"chatMessages">,
                              sessionId: currentSessionId as Id<"chatSessions">,
                              rating: "down",
                            })}
                            className={cn(
                              "p-2.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
                              feedbackByMessage.get(msg._id as Id<"chatMessages">) === "down"
                                ? "text-red-500 bg-red-100"
                                : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50"
                            )}
                            aria-label={t("chat.feedback.notHelpful")}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="p-3 sm:p-4 bg-muted/20 rounded-none sm:rounded-b-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {attachedFile && (
              <div className="flex items-center gap-2 px-2 pb-2">
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs">
                  {attachedFile.fileType.startsWith("image/")
                    ? <ImageIcon className="h-3 w-3 shrink-0" />
                    : <FileText className="h-3 w-3 shrink-0" />}
                  <span className="truncate max-w-[180px]">{attachedFile.fileName}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.webp"
              onChange={handleFileAttach}
            />
            <div className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={handleInputFocus}
                placeholder={
                  isDailyLimitReached
                    ? t('chat.beta.limitReached', { limit: chatUsage?.limit ?? 10 })
                    : currentSessionId
                      ? t('chat.placeholder')
                      : t('chat.noSessionPlaceholder', 'Please start a new chat first')
                }
                className="flex-1 rounded-full"
                disabled={isSending || !currentSessionId || isDailyLimitReached}
              />
              {/* Beta usage pill badge */}
              {chatUsage != null && !chatUsage.isPaidUser && (
                <span
                  title={t('chat.beta.usageTooltip', { limit: chatUsage.limit })}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold select-none cursor-default transition-colors",
                    isDailyLimitReached
                      ? "bg-destructive/10 text-destructive"
                      : chatUsage.remaining <= 3
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <MessageCircle className="h-3 w-3" />
                  {t('chat.beta.usageCounter', { used: chatUsage.used, limit: chatUsage.limit })}
                </span>
              )}
              {/* AI Energy pill (always visible for metered users) */}
              <EnergyPill upcomingCost={upcomingEnergyCost} />
              {canUploadDocuments && (
              <div
                className="relative shrink-0"
                onMouseEnter={() => setShowAttachHint(true)}
                onMouseLeave={() => setShowAttachHint(false)}
              >
                {showAttachHint && !isUploading && (
                  <div className="absolute bottom-full mb-2 right-0 z-50 pointer-events-none">
                    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md px-3 py-2 text-[11px] leading-relaxed whitespace-nowrap">
                      <p className="font-semibold mb-1">{t('chat.attachHint.title', 'Supported files')}</p>
                      <p>🖼 JPG / PNG / WebP &mdash; max. 3 MB</p>
                      <p>📄 PDF &mdash; max. 200 KB</p>
                      <p>📝 TXT / MD &mdash; max. 50 KB</p>
                    </div>
                    {/* Arrow pointing down */}
                    <div className="absolute right-3 top-full w-2.5 h-2.5 overflow-hidden">
                      <div className="w-2.5 h-2.5 bg-popover border-r border-b border-border rotate-45 -translate-y-1/2" />
                    </div>
                  </div>
                )}
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSending || !currentSessionId || !!attachedFile || isDailyLimitReached}
                  size="icon"
                  variant="ghost"
                  className="rounded-full h-10 w-10"
                >
                  {isUploading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Paperclip className="h-4 w-4" />}
                </Button>
              </div>
              )}
              {activeStreamId ? (
                <Button
                  onClick={handleStopStreaming}
                  size="icon"
                  variant="destructive"
                  className="rounded-full h-10 w-10"
                  title={t('chat.stopGenerating', 'Stop generating')}
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={(!message.trim() && !attachedFile) || isSending || !currentSessionId || isDailyLimitReached || energyBlocksSend}
                  size="icon"
                  className="rounded-full h-10 w-10"
                  title={energyBlocksSend
                    ? t('chat.energy.notEnough', { cost: upcomingEnergyEstimate?.cost ?? 0, available: upcomingEnergyEstimate?.available ?? 0 })
                    : undefined}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!currentSessionId && (
              <div className="text-center mt-2">
                <Button variant="link" size="sm" onClick={handleNewChat} className="text-primary">
                  {t('chat.startNewChat', 'Start a new chat to begin')}
                </Button>
              </div>
            )}
            {energyBlocksSend && (
              <p className="text-[11px] text-destructive text-center mt-2 px-4">
                {t('chat.energy.notEnough',
                  'Not enough AI Energy ({{available}}). This action needs {{cost}}. Top up or upgrade to continue.',
                  { cost: upcomingEnergyEstimate?.cost ?? 0, available: upcomingEnergyEstimate?.available ?? 0 }
                )}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/50 text-center mt-2 px-4">
              {t('chat.aiDisclaimer', 'AI can make mistakes. Always verify important information.')}
            </p>
          </div>
        </div>
          </main>
        </div>
      </div>
    </AnimatedPage>
  );
}
