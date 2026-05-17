import { Link } from "wouter";
import { Brain, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface BuddyHelpHintProps {
  serbianWord?: string;
  correctAnswer: string;
  userAnswer: string;
  unitNumber?: number | string;
  questionContext?: "vocabulary-quiz" | "fill-in-blank" | "multiple-choice" | "exercise";
  delay?: number;
}

function buildPrefill({
  serbianWord,
  correctAnswer,
  userAnswer,
  unitNumber,
  questionContext,
}: Omit<BuddyHelpHintProps, "delay">): string {
  const unitPart = unitNumber ? ` (Unit ${unitNumber})` : "";

  if (questionContext === "vocabulary-quiz" && serbianWord) {
    return `I got the word '${serbianWord}' wrong${unitPart} — I answered '${userAnswer}' but the correct translation is '${correctAnswer}'. Can you help me understand and remember this word?`;
  }

  if (serbianWord) {
    return `I made a mistake with '${serbianWord}'${unitPart} — I answered '${userAnswer}' but the correct answer was '${correctAnswer}'. Can you explain this to me?`;
  }

  return `I made a mistake on a question${unitPart} — I answered '${userAnswer}' but the correct answer was '${correctAnswer}'. Can you explain this to me?`;
}

export function BuddyHelpHint(props: BuddyHelpHintProps) {
  const { t } = useTranslation();
  const { delay = 0.45 } = props;
  const prefill = buildPrefill(props);
  const href = `/chat?prefill=${encodeURIComponent(prefill)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link href={href}>
        <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 cursor-pointer hover:bg-primary/10 transition-colors">
          <Brain className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">
              {t("buddy.errorHelp.title", "Need help with this?")}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {t("buddy.errorHelp.desc", "Learn Buddy can explain this to you.")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}
