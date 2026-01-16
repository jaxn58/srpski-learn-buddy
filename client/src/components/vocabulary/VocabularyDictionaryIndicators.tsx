import { Badge } from "@/components/ui/badge";
import { Check, Star, XCircle } from "lucide-react";

export function MasteryIndicator({
  correctCount,
  mastered,
}: {
  correctCount: number;
  mastered: boolean;
}) {
  if (mastered) {
    return (
      <Badge
        variant="outline"
        className="border-yellow-200 bg-yellow-50 text-yellow-900"
        title="Mastered (3 correct answers)"
      >
        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
        Mastered
      </Badge>
    );
  }

  const filled = Math.max(0, Math.min(3, correctCount));
  const remaining = Math.max(0, 3 - filled);

  // Keep UI copy in English (project rule: content stays English for now)
  const titleText =
    remaining === 3
      ? "You need 3 correct answers to master this word."
      : remaining === 2
        ? "Only 2 correct answers left."
        : "Almost there — 1 correct answer left.";

  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-800 tabular-nums"
      aria-label={`Correct answers toward mastery: ${filled} of 3`}
      title={titleText}
    >
      <Check className="h-3 w-3" />
      {filled}/3
    </Badge>
  );
}

export function MistakesIndicator({ count }: { count: number }) {
  if (!count) return <span className="text-muted-foreground/40">—</span>;

  return (
    <Badge
      variant="outline"
      className="border-red-200 bg-red-50 text-red-700 tabular-nums"
      title="Incorrect attempts"
    >
      <XCircle className="h-3 w-3" />
      {count}
    </Badge>
  );
}

