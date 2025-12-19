import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatModal } from "./ChatModal";

export function FloatingChatButton() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [displayText, setDisplayText] = useState("Can I help you?");
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const serbianText = "Mogu li vam pomoći?";
    const englishText = "Can I help you?";
    
    const interval = setInterval(() => {
      // Fade out
      setIsFading(true);
      
      // Nach dem Fade-out den Text ändern und wieder einblenden
      setTimeout(() => {
        setDisplayText((prev) => prev === englishText ? serbianText : englishText);
        setIsFading(false);
      }, 300); // Hälfte der Transition-Zeit für fade-out
    }, 3000); // Wechselt alle 3 Sekunden

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 px-6 rounded-full shadow-2xl bg-serbian-red hover:bg-serbian-red/90 text-white font-semibold gap-3 transition-all hover:scale-105"
        >
          <Brain className="text-white" style={{ width: '28px', height: '28px' }} />
          <span 
            className="hidden sm:inline-block min-w-[140px] text-center transition-opacity duration-500 ease-in-out"
            style={{ opacity: isFading ? 0 : 1 }}
          >
            {displayText}
          </span>
        </Button>
      </div>
      <ChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}



