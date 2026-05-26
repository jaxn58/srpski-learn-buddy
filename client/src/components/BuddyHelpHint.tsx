import { Brain, ChevronRight, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useBuddyModal } from "@/contexts/BuddyModalContext";

interface BuddyHelpHintProps {
  serbianWord?: string;
  exerciseQuestion?: string;
  correctAnswer: string;
  userAnswer: string;
  unitNumber?: number | string;
  questionContext?: "vocabulary-quiz" | "fill-in-blank" | "multiple-choice" | "exercise";
  questionId?: string;
  delay?: number;
}

function buildPrefill({
  serbianWord,
  exerciseQuestion,
  correctAnswer,
  userAnswer,
  unitNumber,
  questionContext,
}: Omit<BuddyHelpHintProps, "delay" | "questionId">): string {
  const unitPart = unitNumber ? ` (Unit ${unitNumber})` : "";

  if (questionContext === "vocabulary-quiz" && serbianWord) {
    return `I got the word '${serbianWord}' wrong${unitPart} ΓÇö I answered '${userAnswer}' but the correct translation is '${correctAnswer}'. Can you help me understand and remember this word?`;
  }

  if (exerciseQuestion) {
    return `I made a mistake on this exercise${unitPart}: "${exerciseQuestion}" ΓÇö I answered '${userAnswer}' but the correct answer was '${correctAnswer}'. Can you explain this to me?`;
  }

  if (serbianWord) {
    return `I made a mistake with '${serbianWord}'${unitPart} ΓÇö I answered '${userAnswer}' but the correct answer was '${correctAnswer}'. Can you explain this to me?`;
  }

  return `I made a mistake on a question${unitPart} ΓÇö I answered '${userAnswer}' but the correct answer was '${correctAnswer}'. Can you explain this to me?`;
}

export function BuddyHelpHint(props: BuddyHelpHintProps) {
  const { t } = useTranslation();
  const { delay = 0.45, unitNumber, questionId } = props;
  const prefill = buildPrefill(props);
  const { openBuddyModal, askedQuestions } = useBuddyModal();

  const parsedUnit = typeof unitNumber === "number" ? unitNumber
    : typeof unitNumber === "string" ? parseInt(unitNumber, 10) || undefined
    : undefined;

  const asked = questionId ? askedQuestions[questionId] : undefined;

  if (asked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className="inline-block"
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => openBuddyModal("", parsedUnit)}
          onKeyDown={(e) => e.key === "Enter" && openBuddyModal("", parsedUnit)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground leading-tight">
            {t("buddy.alreadyAsked", "Already explained by Learn Buddy")}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="inline-block"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => openBuddyModal(prefill, parsedUnit, questionId)}
        onKeyDown={(e) => e.key === "Enter" && openBuddyModal(prefill, parsedUnit, questionId)}
        className="mt-3 inline-flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 cursor-pointer hover:bg-primary/10 transition-colors"
      >
        <Brain className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium leading-tight">
            {t("buddy.errorHelp.title", "Need help with this?")}
          </p>
          <p className="text-xs text-muted-foreground leading-tight">
            {t("buddy.errorHelp.desc", "Learn Buddy can explain this to you.")}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </motion.div>
  );
}
