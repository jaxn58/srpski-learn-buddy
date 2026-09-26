import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatModal } from "./ChatModal";
import { useFeatureAccess, canUseBuddy } from "@/hooks/useFeatureAccess";

export function FloatingChatButton() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [displayText, setDisplayText] = useState(() => t("chat.floatingButton.text"));
  const access = useFeatureAccess();

  useEffect(() => {
    setDisplayText(t("chat.floatingButton.text"));
  }, [i18n.language, t]);

  // Hide the Buddy entry point for plans without Buddy or course teaser access.
  if (!canUseBuddy(access)) return null;

  return (
    <>
      <div className="fixed right-4 z-50 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:right-12">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-11 w-11 gap-3 rounded-full bg-serbian-red p-0 font-semibold text-white shadow-2xl transition-all hover:scale-105 hover:bg-serbian-red/90 sm:h-14 sm:w-auto sm:px-6"
        >
          <Brain className="text-white" style={{ width: '28px', height: '28px' }} />
          <span 
            className="hidden sm:inline-block min-w-[140px] text-center"
          >
            {displayText}
          </span>
        </Button>
      </div>
      <ChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}



