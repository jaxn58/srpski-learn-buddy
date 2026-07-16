import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function getChatFeedbackPrompt(
  t: (key: string, options?: { name?: string }) => string,
  user?: { name?: string | null } | null
): string {
  const firstName = user?.name?.trim().split(/\s+/)[0];
  if (firstName) {
    return t("chat.feedback.prompt", { name: firstName });
  }
  return t("chat.feedback.promptNoName");
}

export interface ChatMessageFeedbackProps {
  formattedTime: string;
  prompt: string;
  rating?: string;
  onRateUp: () => void;
  onRateDown: () => void;
}

export function ChatMessageFeedback({
  formattedTime,
  prompt,
  rating,
  onRateUp,
  onRateDown,
}: ChatMessageFeedbackProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 px-2">
      <span className="text-xs text-muted-foreground">{formattedTime}</span>
      <span className="text-xs text-muted-foreground">{prompt}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onRateUp}
          className={cn(
            "p-2.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
            rating === "up"
              ? "text-green-600 bg-green-100"
              : "text-muted-foreground/40 hover:text-green-600 hover:bg-green-50"
          )}
          aria-label={t("chat.feedback.helpful")}
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRateDown}
          className={cn(
            "p-2.5 rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
            rating === "down"
              ? "text-red-500 bg-red-100"
              : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-50"
          )}
          aria-label={t("chat.feedback.notHelpful")}
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
