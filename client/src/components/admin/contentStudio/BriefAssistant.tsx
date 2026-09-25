import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { parseBriefText, renderBriefText, type BriefFields } from "@shared/contentStudio/briefTemplate";

/**
 * Conversational entry point for the creator brief. The author describes the
 * unit in plain language (typed or dictated with the OS dictation feature);
 * the assistant combines that with the curriculum plan for the unit number,
 * fills the structured brief and asks at most a few follow-up questions.
 * The result is written into the Brief Builder via `onApply` (canonical
 * brief text), where every field stays editable.
 */
export interface BriefAssistantProps {
  unitNumber: number | string;
  moduleNumber: number | string;
  /** Current brief text (to keep manual edits and to send existing fields as context). */
  currentBrief: string;
  onApply: (briefText: string) => void;
  /** Title/description suggestions from the assistant (only applied by the parent when its fields are empty). */
  onSuggestMeta?: (meta: { title?: string; description?: string }) => void;
  disabled?: boolean;
  /** Hide the internal title/subtitle row when the parent already labels the input. */
  hideHeader?: boolean;
}

type Question = { id: string; question: string; kind: "text" | "choice"; options?: string[]; fieldId?: string };

const I18N = "admin.contentStudio.assistant";

export function BriefAssistant({ unitNumber, moduleNumber, currentBrief, onApply, onSuggestMeta, disabled, hideHeader = false }: BriefAssistantProps) {
  const { t } = useTranslation();
  const unitNo = Number(unitNumber);
  const moduleNo = Number(moduleNumber);
  const numbersValid = Number.isInteger(unitNo) && unitNo > 0 && Number.isInteger(moduleNo) && moduleNo > 0;

  const runAssistant = useAction(api.contentStudio.runBriefAssistant);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string>("");
  const [lastFields, setLastFields] = useState<BriefFields | null>(null);

  const currentFields = (): Record<string, string> => {
    const parsed = parseBriefText(currentBrief);
    const fields = parsed.recognized ? parsed.fields : {};
    return Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim())) as Record<string, string>;
  };

  const run = async (withAnswers: boolean) => {
    if (!numbersValid) return;
    setBusy(true);
    try {
      const res = await runAssistant({
        unitNumber: unitNo,
        moduleNumber: moduleNo,
        userText: text.trim(),
        currentFields: { ...currentFields(), ...(lastFields ?? {}) } as Record<string, string>,
        answers: withAnswers
          ? questions
              .filter((q) => (answers[q.id] ?? "").trim())
              .map((q) => ({ questionId: q.id, question: q.question, answer: answers[q.id].trim() }))
          : undefined,
      });
      const fields = res.fields as BriefFields;
      setLastFields(fields);
      setSummary(res.summary || "");
      setQuestions(withAnswers ? [] : (res.questions as Question[]));
      setAnswers({});
      onApply(renderBriefText({ moduleNumber: moduleNo, fields }));
      if (onSuggestMeta && (res.titleSuggestion || res.descriptionSuggestion)) {
        onSuggestMeta({ title: res.titleSuggestion, description: res.descriptionSuggestion });
      }
      toast.success(
        res.questions.length > 0 && !withAnswers
          ? t(`${I18N}.toastDraftedWithQuestions`, { defaultValue: "Brief drafted. {{count}} follow-up question(s).", count: res.questions.length })
          : t(`${I18N}.toastDrafted`, "Briefing created and written into the form.")
      );
    } catch (e: any) {
      toast.error(e?.message || t(`${I18N}.toastFailed`, "Briefing assistant failed."));
    } finally {
      setBusy(false);
    }
  };

  const allAnswered = questions.length > 0 && questions.every((q) => (answers[q.id] ?? "").trim());

  return (
    <div className={hideHeader ? "space-y-4" : "rounded-lg border bg-muted/20 p-4 space-y-4"}>
      {/* Title and explanation */}
      {!hideHeader && (
        <div className="min-w-0">
          <Label className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {t(`${I18N}.title`, "Briefing assistant")}
          </Label>
          <p className="text-sm text-muted-foreground mt-0.5">{t(`${I18N}.subtitle`)}</p>
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        disabled={disabled || busy}
        placeholder={t(`${I18N}.placeholder`)}
        className="text-sm leading-relaxed bg-background"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => run(false)} disabled={disabled || busy || !numbersValid || !text.trim()}>
          {busy && questions.length === 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {lastFields ? t(`${I18N}.redraft`, "Create again") : t(`${I18N}.draft`, "Create briefing")}
        </Button>
        {!numbersValid && <span className="text-sm text-muted-foreground">{t(`${I18N}.needNumbers`, "Set module and unit number first.")}</span>}
        {numbersValid && !text.trim() && (
          <span className="text-sm text-muted-foreground">{t(`${I18N}.needText`, "Describe the unit in a few sentences.")}</span>
        )}
      </div>

      {summary && (
        <p className="text-sm text-muted-foreground border-l-2 border-primary/40 pl-3 leading-relaxed">{summary}</p>
      )}

      {questions.length > 0 && (
        <div className="space-y-4 rounded-md border bg-background p-4">
          <div className="text-sm font-semibold">{t(`${I18N}.questionsTitle`, "A few questions to complete the briefing")}</div>
          {questions.map((q, idx) => (
            <div key={q.id} className="space-y-1.5">
              <Label className="text-sm font-medium leading-snug">
                {idx + 1}. {q.question}
              </Label>
              {q.kind === "choice" && q.options ? (
                <Select value={answers[q.id] ?? ""} onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} disabled={busy}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder={t("admin.contentStudio.brief.selectPlaceholder", "Select...")} />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((o) => (
                      <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} disabled={busy} className="h-10 text-sm" />
              )}
            </div>
          ))}
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => run(true)} disabled={busy || !allAnswered}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t(`${I18N}.applyAnswers`, "Apply answers")}
            </Button>
            <Button variant="ghost" onClick={() => setQuestions([])} disabled={busy}>
              {t(`${I18N}.skipQuestions`, "Skip, keep the briefing")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
