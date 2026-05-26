import { createContext, useCallback, useContext, useState } from "react";

interface BuddyModalContextValue {
  isOpen: boolean;
  prefillText: string;
  unitNumber: number | undefined;
  questionId: string | undefined;
  askedQuestions: Record<string, boolean>;
  openBuddyModal: (prefillText: string, unitNumber?: number, questionId?: string) => void;
  closeBuddyModal: () => void;
}

const BuddyModalContext = createContext<BuddyModalContextValue | null>(null);

export function BuddyModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillText, setPrefillText] = useState("");
  const [unitNumber, setUnitNumber] = useState<number | undefined>(undefined);
  const [questionId, setQuestionId] = useState<string | undefined>(undefined);
  const [askedQuestions, setAskedQuestions] = useState<Record<string, boolean>>({});

  const openBuddyModal = useCallback((text: string, unit?: number, qId?: string) => {
    setPrefillText(text);
    setUnitNumber(unit);
    setQuestionId(qId);
    if (qId) {
      setAskedQuestions((prev) => ({ ...prev, [qId]: true }));
    }
    setIsOpen(true);
  }, []);

  const closeBuddyModal = useCallback(() => {
    setIsOpen(false);
    setPrefillText("");
    setUnitNumber(undefined);
    setQuestionId(undefined);
  }, []);

  return (
    <BuddyModalContext.Provider value={{ isOpen, prefillText, unitNumber, questionId, askedQuestions, openBuddyModal, closeBuddyModal }}>
      {children}
    </BuddyModalContext.Provider>
  );
}

export function useBuddyModal(): BuddyModalContextValue {
  const ctx = useContext(BuddyModalContext);
  if (!ctx) {
    throw new Error("useBuddyModal must be used within a BuddyModalProvider");
  }
  return ctx;
}
