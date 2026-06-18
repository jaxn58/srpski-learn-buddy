import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { guessMimeFromFileName, isImageMimeType } from "@/lib/attachmentMime";

type ChatAttachmentPreviewProps = {
  sessionId: Id<"chatSessions">;
  messageId: Id<"chatMessages">;
  fileName?: string;
  mimeType?: string;
  /** Styling when rendered inside the user's blue chat bubble */
  tone?: "userBubble" | "default";
  className?: string;
};

export function ChatAttachmentPreview({
  sessionId,
  messageId,
  fileName,
  mimeType,
  tone = "default",
  className,
}: ChatAttachmentPreviewProps) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const attachment = useQuery(api.chat.getMessageAttachmentUrl, {
    sessionId,
    messageId,
  });

  const resolvedMime =
    attachment?.mimeType ?? mimeType ?? guessMimeFromFileName(fileName ?? "file");
  const isImage = isImageMimeType(resolvedMime);
  const displayName = attachment?.fileName ?? fileName ?? "attachment";
  const onUserBubble = tone === "userBubble";

  if (attachment === undefined) {
    return (
      <Skeleton
        className={cn(
          "rounded-lg",
          isImageMimeType(resolvedMime) ? "h-[140px] w-[140px]" : "h-9 w-40",
          className
        )}
      />
    );
  }

  if (attachment === null) {
    return (
      <p
        className={cn(
          "text-[11px] italic",
          onUserBubble ? "text-white/80" : "text-muted-foreground",
          className
        )}
      >
        {t("chat.attachment.unavailable")}
      </p>
    );
  }

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label={t("chat.attachment.viewImage", { name: displayName })}
          className={cn(
            "block min-h-[44px] min-w-[44px] overflow-hidden rounded-lg border transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            onUserBubble ? "border-white/25" : "border-border",
            className
          )}
        >
          <img
            src={attachment.url}
            alt={displayName}
            className="h-[140px] w-[140px] max-w-full object-cover"
            loading="lazy"
          />
        </button>
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[min(calc(100vw-2rem),960px)] border-none bg-black/95 p-2 sm:p-4 shadow-2xl">
            <DialogTitle className="sr-only">{displayName}</DialogTitle>
            <img
              src={attachment.url}
              alt={displayName}
              className="mx-auto max-h-[85vh] w-full object-contain"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={displayName}
      className={cn(
        "inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
        onUserBubble
          ? "border-white/25 text-white/95 hover:bg-white/10"
          : "border-border bg-muted/40 text-foreground hover:bg-muted/70",
        className
      )}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span className="truncate max-w-[200px]">{displayName}</span>
    </a>
  );
}

type ChatPendingAttachmentProps = {
  fileName: string;
  fileType: string;
  previewUrl?: string | null;
  onRemove: () => void;
  tone?: "composer" | "default";
};

/** Local preview before the message is sent (object URL for images). */
export function ChatPendingAttachment({
  fileName,
  fileType,
  previewUrl,
  onRemove,
  tone = "composer",
}: ChatPendingAttachmentProps) {
  const { t } = useTranslation();

  if (fileType.startsWith("image/") && previewUrl) {
    return (
      <div className="relative inline-block">
        <img
          src={previewUrl}
          alt={fileName}
          className="h-[120px] w-[120px] rounded-lg object-cover border border-border"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("chat.attachment.remove")}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-destructive"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
        tone === "composer"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-foreground"
      )}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[180px]">{fileName}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("chat.attachment.remove")}
        className="ml-1 flex min-h-[44px] min-w-[44px] items-center justify-center transition-colors hover:text-destructive"
      >
        ×
      </button>
    </div>
  );
}
