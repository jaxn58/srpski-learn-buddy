import { useAuth } from "@/_core/hooks/useAuth";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Send, Brain, MessageSquarePlus, Zap, Paperclip, Loader2, Square, FileDown } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { useFeatureAccess, canUseChatAttachments } from "@/hooks/useFeatureAccess";
import { ChatMarkdownContent } from "@/components/ChatMarkdownContent";
import { useChatStream } from "@/hooks/useChatStream";
import { ChatAttachmentPreview, ChatPendingAttachment } from "@/components/chat/ChatAttachmentPreview";
import { EnergyPill } from "@/components/chat/EnergyPill";
import { ChatResponseModeToggle } from "@/components/chat/ChatResponseModeToggle";
import { ChatMessageFeedback, getChatFeedbackPrompt } from "@/components/chat/ChatMessageFeedback";
import { useChatPdfExport } from "@/hooks/useChatPdfExport";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ChatMessageDoc = Doc<"chatMessages">;
type ChatMessageDisplay = ChatMessageDoc & { createdAt?: number };
type ChatSession = Doc<"chatSessions">;

const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string;

const BUDDY_SESSION_PREFIX = "buddy-unit-";

const ALLOWED_ATTACH_TYPES = [
  "application/pdf", "text/plain", "text/markdown",
  "image/jpeg", "image/png", "image/webp",
];
const MAX_ATTACH_SIZE: Record<string, number> = {
  "application/pdf": 3 * 1024 * 1024,
  "text/plain": 50 * 1024,
  "text/markdown": 50 * 1024,
  "image/jpeg": 3 * 1024 * 1024,
  "image/png": 3 * 1024 * 1024,
  "image/webp": 3 * 1024 * 1024,
};

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillText?: string;
  unitNumber?: number;
}

export function ChatModal({ isOpen, onClose, prefillText, unitNumber }: ChatModalProps) {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<"compact" | "detailed">("compact");
  const [attachedFile, setAttachedFile] = useState<{
    storageId: string;
    fileName: string;
    fileType: string;
    fileBytes: number;
    previewUrl?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachPreviewUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prefillHandledRef = useRef(false);
  const skipAutoSelectRef = useRef(false);
  const sessions = useQuery(api.chat.getSessions) as ChatSession[] | undefined;
  const featureAccess = useFeatureAccess();
  const canUploadDocuments = canUseChatAttachments(featureAccess);
  const { exportSession, exportingSessionId } = useChatPdfExport();

  // Live energy preview for the next message (RAG is always on in the modal
  // because unit context is always attached). Drives the energy pill overlay
  // and the send-button block.
  const attachIsImage = attachedFile?.fileType.startsWith("image/") ?? false;
  const upcomingEnergyEstimate = useQuery(api.chat.estimateEnergyForAction, {
    responseMode,
    ragHinted: true,
    hasImageAttachment: attachIsImage,
    hasFileAttachment: attachedFile != null && !attachIsImage,
    attachmentBytes: attachedFile?.fileBytes,
  });
  const compactEstimate = useQuery(api.chat.estimateEnergyForAction, {
    responseMode: "compact" as const,
    ragHinted: true,
  });
  const detailedEstimate = useQuery(api.chat.estimateEnergyForAction, {
    responseMode: "detailed" as const,
    ragHinted: true,
  });
  const energyBlocksSend =
    upcomingEnergyEstimate != null &&
    !upcomingEnergyEstimate.unlimited &&
    !upcomingEnergyEstimate.teaserOnly &&
    !upcomingEnergyEstimate.enough;

  // Upload quota + rough per-analysis Energy band for the attach info tooltip.
  // Mirrors the main chat page so both surfaces show the same, admin-bound hint.
  const [attachQuotaNow, setAttachQuotaNow] = useState(() => Date.now());
  const attachQuota = useQuery(
    api.documents.getChatAttachmentQuota,
    canUploadDocuments && user ? { now: attachQuotaNow } : "skip"
  );
  const attachEnergyEstimate = useQuery(api.chat.estimateEnergyForAction, {
    ragHinted: true,
    hasFileAttachment: true,
  });
  const formatEnergyRange = (
    estimate?: { costMin: number; costMax: number; unlimited: boolean; teaserOnly: boolean } | null,
  ): string | null => {
    if (!estimate || estimate.unlimited || estimate.teaserOnly) return null;
    return estimate.costMin === estimate.costMax
      ? `${estimate.costMin}`
      : `${estimate.costMin}\u2013${estimate.costMax}`;
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    return date.toLocaleTimeString('de-DE', options);
  };

  const progress = useQuery(api.progress.getUserProgress);
  const createSessionMutation = useMutation(api.chat.createSession);
  const addMessageMutation = useMutation(api.chat.addMessage);
  const checkRateLimitMutation = useMutation(api.chat.checkMessageRateLimit);
  const createStreamMutation = useMutation(api.streaming.createStream);
  const addStreamingAssistantMsg = useMutation(api.chat.addStreamingAssistantMessage);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const { data: streamData, feedResponse, reset: resetStream } = useChatStream();

  const clearAttachedFile = useCallback(() => {
    if (attachPreviewUrlRef.current) {
      URL.revokeObjectURL(attachPreviewUrlRef.current);
      attachPreviewUrlRef.current = null;
    }
    setAttachedFile(null);
  }, []);

  // Reset prefill tracking and session selection when modal closes
  useEffect(() => {
    if (!isOpen) {
      prefillHandledRef.current = false;
      skipAutoSelectRef.current = false;
      setCurrentSessionId(null);
      setPendingPrefill(null);
      setResponseMode("compact");
      clearAttachedFile();
    }
  }, [isOpen, clearAttachedFile]);

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
  const currentSession = sessions?.find(
    (s) => (s._id as unknown as string) === currentSessionId
  );

  const sessionFeedback = useQuery(
    api.chat.getSessionFeedback,
    currentSessionId ? { sessionId: currentSessionId as Id<"chatSessions"> } : "skip"
  );
  const feedbackByMessage = new Map<Id<"chatMessages">, string>(
    (sessionFeedback ?? []).map(
      (f: { messageId: Id<"chatMessages">; rating: string }) =>
        [f.messageId, f.rating] as [Id<"chatMessages">, string],
    )
  );
  const submitFeedback = useMutation(api.chat.submitMessageFeedback);
  const feedbackPrompt = useMemo(() => getChatFeedbackPrompt(t, user), [t, user]);

  const sendStreaming = useCallback(async (
    text: string,
    sessionId: string,
    responseMode?: "compact" | "detailed",
    attachment?: { storageId: string; fileName: string; fileType: string; fileBytes: number } | null
  ) => {
    setIsSending(true);

    try {
      const hasImage = !!attachment && attachment.fileType.startsWith("image/");
      const hasFile = !!attachment && !hasImage;

      await checkRateLimitMutation({
        sessionId: sessionId as Id<"chatSessions">,
        message: text,
        responseMode,
        hasImageAttachment: hasImage,
        hasFileAttachment: hasFile,
        attachmentBytes: attachment?.fileBytes,
        ragHinted: true,
      });

      await addMessageMutation({
        sessionId: sessionId as Id<"chatSessions">,
        role: "user",
        content: text || (attachment ? `[Attached: ${attachment.fileName}]` : ""),
        unitContext: unitNumber ?? progress?.currentUnit,
        responseMode,
        ...(attachment ? {
          attachmentStorageId: attachment.storageId as unknown as Id<"_storage">,
          attachmentFileName: attachment.fileName,
          attachmentMimeType: attachment.fileType,
          attachmentSizeBytes: attachment.fileBytes,
        } : {}),
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

      // Send the Convex-issued Clerk JWT so the streaming endpoint can
      // authenticate the caller (it no longer trusts userId from the body).
      const streamToken = await getToken({ template: "convex" });

      fetch(`${CONVEX_SITE_URL}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(streamToken ? { Authorization: `Bearer ${streamToken}` } : {}),
        },
        body: JSON.stringify({
          streamId,
          sessionId,
          messageId,
          responseMode,
          ...(attachment ? {
            attachmentStorageId: attachment.storageId,
            attachmentFileName: attachment.fileName,
            attachmentFileType: attachment.fileType,
            attachmentBytes: attachment.fileBytes,
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
  }, [user, progress, unitNumber, checkRateLimitMutation, addMessageMutation, createStreamMutation, addStreamingAssistantMsg, resetStream, feedResponse, getToken, t]);

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
      setResponseMode("compact");
      setMessage("");
      clearAttachedFile();

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

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setActiveStreamId(null);
    setIsSending(false);
  }, []);

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
        toast.error(t('chat.fileTooLarge.pdf', 'PDF: max. 3 MB'));
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
        uploadSource: "chat_attachment",
      });
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadType },
        body: uploadBody,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { storageId } = await resp.json();
      let previewUrl: string | undefined;
      if (isImage) {
        if (attachPreviewUrlRef.current) {
          URL.revokeObjectURL(attachPreviewUrlRef.current);
        }
        previewUrl = URL.createObjectURL(uploadBody);
        attachPreviewUrlRef.current = previewUrl;
      }
      setAttachedFile({
        storageId,
        fileName: file.name,
        fileType: uploadType,
        fileBytes: intendedBytes,
        previewUrl,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !attachedFile) || isSending) return;

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
    const currentAttachment = attachedFile;
    setMessage("");
    clearAttachedFile();
    await sendStreaming(messageToSend, sessionIdToUse, responseMode, currentAttachment);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputFocus = () => {
    if (!isMobile) return;
    // Wait for the on-screen keyboard animation, then scroll the input into view.
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 350);
  };

  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 gap-0",
          "w-[100vw] max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0",
          "sm:w-[95vw] sm:max-w-5xl sm:h-auto sm:max-h-[90vh] sm:min-h-[70vh] sm:rounded-lg sm:border"
        )}
      >
        <DialogHeader className="px-4 sm:px-6 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6 pb-2.5 sm:pb-3 border-b pr-14">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg">{t('chat.modal.title')}</DialogTitle>
              <DialogDescription className="hidden sm:block">{t('chat.modal.subtitle')}</DialogDescription>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleNewChat()}
              disabled={headerActionsDisabled}
              aria-label={t('chat.modal.newChat')}
              className="h-8 sm:h-7 px-2 sm:px-2.5 text-xs font-normal shrink-0"
            >
              <MessageSquarePlus className="h-4 w-4 sm:h-3 sm:w-3 sm:mr-1.5 shrink-0" />
              <span className="hidden sm:inline">{t('chat.modal.newChat')}</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Tool row: PDF export */}
          {currentSessionId && currentSession && (
            <div className="flex justify-end px-3 sm:px-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-8"
                disabled={exportingSessionId === currentSessionId}
                onClick={() =>
                  void exportSession(
                    currentSessionId as Id<"chatSessions">,
                    currentSession.title
                  )
                }
                aria-label={t('chat.modal.exportPdf')}
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">{t('chat.modal.exportPdf')}</span>
              </Button>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4"
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
                    {compactEstimate && !compactEstimate.unlimited && (
                      <p className="flex items-center gap-1 mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                        <Zap className="h-3 w-3 shrink-0" />
                        ≈ {compactEstimate.costMin === compactEstimate.costMax
                          ? compactEstimate.costMin
                          : `${compactEstimate.costMin}\u2013${compactEstimate.costMax}`} Energy
                      </p>
                    )}
                  </Card>
                  <Card
                    className="p-4 transition-colors hover:bg-accent cursor-pointer"
                    onClick={() => void handleModeSelect("detailed")}
                  >
                    <p className="text-sm font-semibold mb-1">{t("buddy.modeSelect.detailed", "Detailed")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("buddy.modeSelect.detailedDesc", "Full explanation with examples")}
                    </p>
                    {detailedEstimate && !detailedEstimate.unlimited && (
                      <p className="flex items-center gap-1 mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                        <Zap className="h-3 w-3 shrink-0" />
                        ≈ {detailedEstimate.costMin === detailedEstimate.costMax
                          ? detailedEstimate.costMin
                          : `${detailedEstimate.costMin}\u2013${detailedEstimate.costMax}`} Energy
                      </p>
                    )}
                  </Card>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
                  <Card
                    className="p-3 sm:p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.1'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion1')}</p>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.2'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion2')}</p>
                  </Card>
                  <Card
                    className="p-3 sm:p-4 hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => void prefillExampleMessage(t('chat.examplePrefill.3'))}
                  >
                    <p className="text-sm font-medium">{t('chat.suggestion3')}</p>
                  </Card>
                </div>
              </div>
            )}

            {!pendingPrefill && messages.map((msg: ChatMessageDisplay, idx: number) => {
              const isStreamingMsg = msg.role === "assistant" && msg.streamId && msg.streamId === activeStreamId;
              const displayContent = isStreamingMsg
                ? (streamData?.text || "")
                : msg.content;
              const isUser = msg.role === "user";

              return (
                <div
                  key={msg._id || idx}
                  className={cn("flex", isUser ? "justify-end" : "justify-start")}
                >
                  <div className={cn("flex flex-col max-w-[85%] sm:max-w-[75%]", isUser ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "relative rounded-2xl px-3 py-2 sm:px-4 sm:py-3 text-sm leading-[1.4]",
                        isUser
                          ? "bg-serbian-blue text-white rounded-tr-none"
                          : "bg-muted text-foreground rounded-tl-none"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute top-0 h-3 w-3",
                          isUser
                            ? "-right-1.5 bg-serbian-blue [clip-path:polygon(0_100%,0_0,100%_0)]"
                            : "-left-1.5 bg-muted [clip-path:polygon(100%_100%,100%_0,0_0)]"
                        )}
                      />
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
                          {msg.attachmentStorageId && currentSessionId && msg._id && (
                            <div className="mb-2">
                              <ChatAttachmentPreview
                                sessionId={currentSessionId as Id<"chatSessions">}
                                messageId={msg._id as Id<"chatMessages">}
                                fileName={msg.attachmentFileName}
                                mimeType={msg.attachmentMimeType}
                                tone="userBubble"
                              />
                            </div>
                          )}
                          {displayContent ? (
                            <p className="whitespace-pre-wrap text-sm leading-[1.4]">{msg.content}</p>
                          ) : null}
                        </>
                      )}
                    </div>
                    {msg.role === "assistant" && msg._id && !isStreamingMsg && currentSessionId ? (
                      <ChatMessageFeedback
                        formattedTime={formatMessageTime(msg._creationTime || msg.createdAt || Date.now())}
                        prompt={feedbackPrompt}
                        rating={feedbackByMessage.get(msg._id as Id<"chatMessages">)}
                        onRateUp={() =>
                          submitFeedback({
                            messageId: msg._id as Id<"chatMessages">,
                            sessionId: currentSessionId as Id<"chatSessions">,
                            rating: "up",
                          })
                        }
                        onRateDown={() =>
                          submitFeedback({
                            messageId: msg._id as Id<"chatMessages">,
                            sessionId: currentSessionId as Id<"chatSessions">,
                            rating: "down",
                          })
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground mt-1 px-2">
                        {formatMessageTime(msg._creationTime || msg.createdAt || Date.now())}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {!pendingPrefill && isSending && !activeStreamId && (
              <div className="flex justify-start">
                <div className="relative bg-muted rounded-2xl rounded-tl-none px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="absolute top-0 -left-1.5 h-3 w-3 bg-muted [clip-path:polygon(100%_100%,100%_0,0_0)]"
                  />
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area -- hidden while mode-selection (pendingPrefill) is active */}
          {!pendingPrefill && (
            <div className="border-t p-3 sm:p-4 bg-muted/30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {attachedFile && (
                <div className="flex items-center gap-2 px-2 pb-2">
                  <ChatPendingAttachment
                    fileName={attachedFile.fileName}
                    fileType={attachedFile.fileType}
                    previewUrl={attachedFile.previewUrl}
                    onRemove={clearAttachedFile}
                  />
                  {(() => {
                    const analysisCost = formatEnergyRange(upcomingEnergyEstimate);
                    return analysisCost ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                        <Zap className="h-3 w-3 shrink-0" />
                        {t('chat.attachHint.analysisCost', {
                          cost: analysisCost,
                          defaultValue: '≈ {{cost}} Energy to analyze',
                        })}
                      </span>
                    ) : null;
                  })()}
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
                  placeholder={t('chat.placeholder')}
                  className="flex-1 rounded-full text-sm"
                  disabled={isSending}
                />
                <ChatResponseModeToggle
                  value={responseMode}
                  onChange={setResponseMode}
                  disabled={isSending}
                />
                <EnergyPill className="shrink-0" />
                {canUploadDocuments && (
                  <Tooltip
                    onOpenChange={(open) => {
                      if (open) setAttachQuotaNow(Date.now());
                    }}
                  >
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || isSending || !!attachedFile}
                        size="icon"
                        variant="ghost"
                        className="rounded-full h-10 w-10 shrink-0"
                        aria-label={t('chat.modal.attach')}
                      >
                        {isUploading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Paperclip className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="end"
                      collisionPadding={12}
                      className="max-w-[240px] px-2.5 py-1.5"
                    >
                      <div className="text-[11px] leading-snug space-y-px">
                        <div className="font-semibold">{t('chat.attachHint.title', 'Supported files')}</div>
                        <div className="opacity-80">{t('chat.attachHint.images', 'JPG / PNG / WebP — max. 3 MB')}</div>
                        <div className="opacity-80">{t('chat.attachHint.pdf', 'PDF — max. 3 MB')}</div>
                        <div className="opacity-80">{t('chat.attachHint.text', 'TXT / MD — max. 50 KB')}</div>
                        {(() => {
                          const analysisCost = formatEnergyRange(attachEnergyEstimate);
                          return analysisCost ? (
                            <div className="flex items-center gap-1 pt-0.5 tabular-nums">
                              <Zap className="h-3 w-3 shrink-0" />
                              {t('chat.attachHint.energy', {
                                cost: analysisCost,
                                defaultValue: 'Analysis from ≈ {{cost}} Energy',
                              })}
                            </div>
                          ) : null;
                        })()}
                        <div className="my-1 border-t border-background/20" />
                        {attachQuota?.unlimited ? (
                          <div className="opacity-80">{t('chat.attachHint.storageUnlimited', 'Storage: unlimited')}</div>
                        ) : attachQuota?.remainingFormatted != null && attachQuota.quotaFormatted != null ? (
                          <div className="opacity-80">
                            {attachQuota.remainingBytes === 0
                              ? t('chat.attachHint.storageExhausted', {
                                  used: attachQuota.usedFormatted,
                                  quota: attachQuota.quotaFormatted,
                                  defaultValue: 'Storage full ({{used}} of {{quota}})',
                                })
                              : t('chat.attachHint.storage', {
                                  remaining: attachQuota.remainingFormatted,
                                  quota: attachQuota.quotaFormatted,
                                  defaultValue: 'Storage: {{remaining}} of {{quota}} left',
                                })}
                          </div>
                        ) : (
                          <div className="opacity-60">{t('chat.attachHint.storageLoading', 'Storage: …')}</div>
                        )}
                        {attachQuota ? (
                          <div className="opacity-80">
                            {attachQuota.dailyRemaining === 0
                              ? t('chat.attachHint.dailyExhausted', {
                                  limit: attachQuota.dailyLimit,
                                  defaultValue: 'Today: upload limit reached ({{limit}}/day)',
                                })
                              : t('chat.attachHint.daily', {
                                  remaining: attachQuota.dailyRemaining,
                                  limit: attachQuota.dailyLimit,
                                  defaultValue: 'Today: {{remaining}} of {{limit}} uploads left',
                                })}
                          </div>
                        ) : (
                          <div className="opacity-60">{t('chat.attachHint.dailyLoading', 'Today: …')}</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
                {activeStreamId ? (
                  <Button
                    onClick={handleStopStreaming}
                    size="icon"
                    variant="destructive"
                    className="rounded-full h-10 w-10 shrink-0"
                    aria-label={t('chat.modal.stop')}
                    title={t('chat.modal.stop')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={(!message.trim() && !attachedFile) || isSending || energyBlocksSend}
                    size="icon"
                    className="rounded-full h-10 w-10 shrink-0"
                    title={energyBlocksSend
                      ? (upcomingEnergyEstimate?.debtBalance ?? 0) > 0
                        ? t('chat.energy.debtBlocked', { amount: upcomingEnergyEstimate?.debtBalance ?? 0 })
                        : t('chat.energy.notEnough', {
                            cost: upcomingEnergyEstimate?.costMax ?? upcomingEnergyEstimate?.cost ?? 0,
                            available: upcomingEnergyEstimate?.available ?? 0,
                          })
                      : undefined}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {energyBlocksSend && (
                <p className="text-[11px] text-destructive text-center mt-2 px-4">
                  {(upcomingEnergyEstimate?.debtBalance ?? 0) > 0
                    ? t('chat.energy.debtBlocked', { amount: upcomingEnergyEstimate?.debtBalance ?? 0 })
                    : t('chat.energy.notEnough', {
                        cost: upcomingEnergyEstimate?.costMax ?? upcomingEnergyEstimate?.cost ?? 0,
                        available: upcomingEnergyEstimate?.available ?? 0,
                      })}
                </p>
              )}
              {!currentSessionId && (
                <div className="text-center mt-2">
                  <Button variant="link" size="sm" onClick={handleNewChat} className="text-primary">
                    {t('chat.startNewChat', 'Start a new chat to begin')}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50 text-center mt-2 px-4">
                {t('chat.aiDisclaimer')}
              </p>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-1 px-4">
                {t("buddy.sessionHint")}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
