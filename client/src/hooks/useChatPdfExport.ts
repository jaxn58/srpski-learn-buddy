import { useCallback, useState } from "react";
import { useConvex } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { exportChatToPdf } from "@/lib/exportChatPdf";

export function useChatPdfExport() {
  const convex = useConvex();
  const { t, i18n } = useTranslation();
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);

  const exportSession = useCallback(
    async (sessionId: Id<"chatSessions">, sessionTitle: string) => {
      const idStr = sessionId as string;
      if (exportingSessionId === idStr) return;

      setExportingSessionId(idStr);
      try {
        const messages = await convex.query(api.chat.getMessages, { sessionId });
        await exportChatToPdf({
          sessionTitle,
          messages,
          locale: i18n.language?.startsWith("de") ? "de-DE" : "en-US",
          labels: {
            exportedOn: t("chatLibrary.export.exportedOn"),
            userLabel: t("chatLibrary.export.userLabel"),
            assistantLabel: t("chatLibrary.export.assistantLabel"),
            attachmentNote: t("chatLibrary.export.attachmentNote"),
            noMessages: t("chatLibrary.export.noMessages"),
            footerNotice: t("chatLibrary.export.footerNotice"),
            personalUseOnly: t("chatLibrary.export.personalUseOnly"),
          },
        });
        toast.success(t("chatLibrary.export.success"));
      } catch (error) {
        console.error("PDF export failed:", error);
        const detail = error instanceof Error ? error.message : String(error);
        toast.error(t("chatLibrary.export.failed"), {
          description: import.meta.env.DEV ? detail : undefined,
        });
      } finally {
        setExportingSessionId(null);
      }
    },
    [convex, exportingSessionId, i18n.language, t]
  );

  return {
    exportSession,
    exportingSessionId,
    isExporting: exportingSessionId !== null,
  };
}
