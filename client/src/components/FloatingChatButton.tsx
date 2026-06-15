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
      <div className="fixed bottom-6 right-4 sm:right-12 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 px-6 rounded-full shadow-2xl bg-serbian-red hover:bg-serbian-red/90 text-white font-semibold gap-3 transition-all hover:scale-105"
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



