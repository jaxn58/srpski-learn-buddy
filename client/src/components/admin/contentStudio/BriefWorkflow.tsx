import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  applyBriefingFieldCorrections,
  hashBriefingText,
  type BriefingCheckStamp,
} from "@shared/contentStudio/briefingCheck";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleSelect } from "./ModuleSelect";
import { BriefAssistant } from "./BriefAssistant";
import { BriefBuilder } from "./BriefBuilder";
import { BRIEF_ASSIGNMENT_FIELD_IDS, BRIEF_EXPERT_FIELD_IDS, BRIEF_FIELD_DEFAULTS, parseBriefText, renderBriefText, type BriefFields } from "@shared/contentStudio/briefTemplate";

/**
 * Authoring panel for a unit. The author fills the assignment (situation,
 * what the learner can do, one grammar target, unit type, strand, setting).
 * The language level is the module's level, shown and not edited here.
 * "Create briefing" asks the assistant to fill only the remaining fields.
 *
 * Reference, house-style skills, briefing versions and anchored sections
 * stay in this flow, visible. The expert switch holds the remaining
 * briefing fields only.
 */
export interface BriefWorkflowProps {
  mode: "create" | "edit";
  moduleNumber: string;
  setModuleNumber: (v: string) => void;
  unitNumber: string;
  setUnitNumber: (v: string) => void;
  collides: boolean;
  collisionMessage: string | null;
  numbersValid: boolean;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  brief: string;
  setBrief: (v: string) => void;
  disabled?: boolean;
  idPrefix: string;
  /** Primary action: create mode = create unit + generate draft; edit mode = save + generate draft. */
  onPrimary: () => void | Promise<void>;
  /** Secondary action: create mode = create unit only; edit mode = save only. */
  onSecondary: () => void | Promise<void>;
  actionBusy?: boolean;
  /** Rendered inside the expert view (versions, reference, skills, templates). */
  expertChildren?: ReactNode;
  /** Rendered in the main flow below the last card, above the expert switch (author note). */
  belowResult?: ReactNode;
  /** Set while editing an existing draft, so the check can be stored on it. */
  draftId?: string | null;
  /** Stamp already stored for this draft, if it still matches the briefing. */
  savedCheck?: BriefingCheckStamp | null;
  /** Latest check result, including one that exists only in the create form. */
  onChecked?: (stamp: BriefingCheckStamp) => void;
}

const I18N = "admin.contentStudio.workflow";

/** Replaces only the Module line. Leaves every other line of a loaded briefing alone. */
function replaceModuleLine(brief: string, moduleNumber: string): string {
  const line = `Module: ${moduleNumber}`;
  if (/^Module:\s*.+$/m.test(brief)) return brief.replace(/^Module:\s*.+$/m, line);
  return `${line}\n${brief}`;
}

export function BriefWorkflow(props: BriefWorkflowProps) {
  const {
    mode, moduleNumber, setModuleNumber, unitNumber, setUnitNumber,
    collides, collisionMessage, numbersValid,
    title, setTitle, description, setDescription,
    brief, setBrief, disabled, idPrefix,
    onPrimary, onSecondary, actionBusy, expertChildren, belowResult,
    draftId, savedCheck, onChecked,
  } = props;
  const runBriefingCheck = useAction(api.contentStudio.runBriefingConsistencyCheck);
  const runBriefingCorrection = useAction(api.contentStudio.runBriefingFieldCorrection);
  const runAssistant = useAction(api.contentStudio.runBriefAssistant);
  const [localCheck, setLocalCheck] = useState<BriefingCheckStamp | null>(null);
  const [checking, setChecking] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const { t } = useTranslation();
  const [expert, setExpert] = useState(false);
  const [suggestion, setSuggestion] = useState<{ title?: string; description?: string }>({});

  const unitNo = Number(unitNumber);
  const moduleNo = Number(moduleNumber);
  const context = useQuery(
    api.curriculum.getUnitContext,
    numbersValid ? { unitNumber: unitNo, moduleNumber: moduleNo } : "skip",
  );

  const parsedBrief = parseBriefText(brief);
  const assignmentFields = parsedBrief.recognized ? parsedBrief.fields : {};
  const assignmentReady = BRIEF_ASSIGNMENT_FIELD_IDS.every((id) => String(assignmentFields[id] ?? "").trim().length > 0);
  const hasBrief = brief.trim().length > 0 && parsedBrief.recognized;
  const canAct = numbersValid && !collides && !disabled && !actionBusy;
  const briefHash = hashBriefingText(brief);
  const activeCheck = localCheck?.notesHash === briefHash
    ? localCheck
    : savedCheck?.notesHash === briefHash
      ? savedCheck
      : null;
  const briefingPassed = activeCheck?.ok === true;

  const rememberCheck = (res: {
    notesHash: string;
    ok: boolean;
    contradictions: BriefingCheckStamp["contradictions"];
    checkedAt: number;
    model: string;
  }) => {
    const stamp: BriefingCheckStamp = {
      notesHash: res.notesHash,
      ok: res.ok,
      contradictions: res.contradictions,
      checkedAt: res.checkedAt,
      model: res.model,
    };
    setLocalCheck(stamp);
    onChecked?.(stamp);
  };

  const coursePlace = numbersValid ? { unitNumber: unitNo, moduleNumber: moduleNo } : {};

  const checkBriefing = async (text: string) => {
    setChecking(true);
    setRerunning(false);
    try {
      const res = await runBriefingCheck({
        briefingText: text,
        ...coursePlace,
        ...(draftId ? { draftId: draftId as any } : {}),
      });
      if (!res.ok && res.contradictions.length > 0) {
        const correction = await runBriefingCorrection({
          briefingText: text,
          contradictions: res.contradictions,
          ...coursePlace,
        });
        const corrected = applyBriefingFieldCorrections(text, correction.fields);
        if (corrected) {
          setBrief(corrected);
          setLocalCheck(null);
          setRerunning(true);
          toast.info(t(`${I18N}.checkRerunning`, "The briefing was updated and is running again."));
          const parsed = parseBriefText(corrected);
          const currentFields = Object.fromEntries(
            Object.entries(parsed.fields).filter(([, value]) => typeof value === "string" && value.trim()),
          ) as Record<string, string>;
          const assistant = await runAssistant({
            unitNumber: unitNo,
            moduleNumber: moduleNo,
            userText: "",
            currentFields,
          });
          const rewritten = renderBriefText({
            moduleNumber: moduleNo,
            fields: assistant.fields as BriefFields,
          });
          setBrief(rewritten);
          if (assistant.titleSuggestion && !title.trim()) setTitle(assistant.titleSuggestion);
          if (assistant.descriptionSuggestion && !description.trim()) setDescription(assistant.descriptionSuggestion);
          const second = await runBriefingCheck({
            briefingText: rewritten,
            ...coursePlace,
            ...(draftId ? { draftId: draftId as any } : {}),
          });
          rememberCheck(second);
          return;
        }
      }
      rememberCheck(res);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t(`${I18N}.checkFailed`, "Briefing check failed.");
      toast.error(message);
    } finally {
      setChecking(false);
      setRerunning(false);
    }
  };

  const levelLabel = (cefr: string) => t(`${I18N}.level.${cefr}`, cefr);
  const chosenGrammar = (() => {
    if (!hasBrief) return "";
    const parsed = parseBriefText(brief);
    return parsed.recognized ? String(parsed.fields.grammarIn ?? "").trim() : "";
  })();

  const applyUnitTable = () => {
    const hint = context?.plannedHint;
    if (!hint) return;
    const parsed = parseBriefText(brief);
    const fields = {
      ...BRIEF_FIELD_DEFAULTS,
      ...(parsed.recognized ? parsed.fields : {}),
      unitType: hint.unitType,
      setting: hint.setting,
      situation: hint.situationEn,
      canDo: hint.canDoStatements.join("\n"),
      grammarIn: hint.primaryGrammarEn,
      ...(hint.strand ? { strand: hint.strand } : {}),
      ...(context?.cefrLevel ? { cefrLevel: context.cefrLevel } : {}),
    };
    setBrief(renderBriefText({ moduleNumber, fields }));
    if (!title.trim() && hint.titleEn) setTitle(hint.titleEn);
    toast.success(t(`${I18N}.applyTableDone`, "Unit table copied into the assignment."));
  };
  return (
    <div className="space-y-6">
      {/* Where the unit sits in the course */}
      <div className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t(`${I18N}.module`, "Module")}</Label>
            <ModuleSelect
              value={moduleNumber}
              hasError={collides}
              onChange={(next) => {
                setModuleNumber(next);
                if (brief.trim()) setBrief(replaceModuleLine(brief, next));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-unit`} className="text-sm font-medium">{t(`${I18N}.unitNumber`, "Unit number")}</Label>
            <Input
              id={`${idPrefix}-unit`}
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              aria-invalid={collides || undefined}
              disabled={disabled}
              className={cn("h-10 text-sm", collides && "border-destructive focus-visible:ring-destructive")}
            />
          </div>
        </div>
        {collisionMessage && <p className="text-sm text-destructive" role="alert">{collisionMessage}</p>}
        {!numbersValid && (unitNumber !== "" || moduleNumber !== "") && (
          <p className="text-sm text-muted-foreground">{t(`${I18N}.numbersInvalid`, "Module and unit must both be positive integers.")}</p>
        )}
        {numbersValid && context && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t(`${I18N}.levelLine`, "Language level")}</Label>
            <p className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm">
              {levelLabel(context.cefrLevel)}
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              {t(`${I18N}.levelHelp`, "Taken from this module. It sets sentence length, terminology and exercise difficulty.")}
            </p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">{t(`${I18N}.assignmentTitle`, "What this unit should achieve")}</Label>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {t(`${I18N}.assignmentHelp`, "These fields are the assignment. They stay as they are when you update the briefing. The assistant writes only the remaining fields.")}
          </p>
        </div>
        <BriefBuilder
          value={brief}
          onChange={setBrief}
          moduleNumber={moduleNumber}
          disabled={disabled || !numbersValid}
          idPrefix={`${idPrefix}-assignment`}
          variant="flat"
          hideHeader
          allowRaw={false}
          showGenerated={false}
          includeFieldIds={BRIEF_ASSIGNMENT_FIELD_IDS}
          lockedCefrLevel={context?.cefrLevel}
        />
        {context?.plannedHint && (
          <div className="space-y-1.5">
            <Button type="button" variant="outline" className="h-11" onClick={applyUnitTable} disabled={disabled || !numbersValid}>
              {t(`${I18N}.applyTable`, "Use the unit table")}
            </Button>
            <p className="text-xs text-muted-foreground leading-snug">
              {t(`${I18N}.applyTableHelp`, "Copies unit type, strand, setting, situation, Can-Do statements and the grammar target from the unit table. Then update the briefing so the assistant rewrites chunks and recycling.")}
            </p>
          </div>
        )}
        <BriefAssistant
          unitNumber={unitNumber}
          moduleNumber={moduleNumber}
          currentBrief={brief}
          onApply={async (text) => {
            setBrief(text);
            await checkBriefing(text);
          }}
          onSuggestMeta={(meta) => {
            setSuggestion(meta);
            if (meta.title && !title.trim()) setTitle(meta.title);
            if (meta.description && !description.trim()) setDescription(meta.description);
          }}
          disabled={disabled || !numbersValid}
          fieldsReady={assignmentReady && !!context?.cefrLevel}
          hideHeader
        />
        {checking && (
          <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3" role="status" aria-live="polite">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {rerunning
                ? t(`${I18N}.checkRerunning`, "The briefing was updated and is running again.")
                : t(`${I18N}.checkRunning`, "Checking the briefing…")}
            </p>
          </div>
        )}
      </div>

      {/* Result and next step */}
      {hasBrief && (
        <div className="rounded-lg border bg-muted/20 p-4 sm:p-5 space-y-4">
          <div>
            <div className="text-base font-semibold">{t(`${I18N}.readyTitle`, "Briefing ready")}</div>
            <p className="text-sm text-muted-foreground mt-0.5">{t(`${I18N}.readyHint`, "Check title and description, then let the Creator write the draft.")}</p>
          </div>
          {chosenGrammar && (
            <p className="text-sm leading-relaxed">
              <span className="font-medium">{t(`${I18N}.grammarLine`, "Grammar in this unit")}: </span>
              <span className="text-muted-foreground">{chosenGrammar}</span>
            </p>
          )}
          {!checking && activeCheck?.ok && (
            <p className="text-sm">{t(`${I18N}.checkPassed`, "The briefing is consistent.")}</p>
          )}
          {!checking && activeCheck && !activeCheck.ok && (
            <div className="space-y-2 text-sm">
              <p>{t(`${I18N}.checkFailedTitle`, "The briefing contradicts itself. The draft is not generated until this is resolved.")}</p>
              <ul className="space-y-2">
                {activeCheck.contradictions.map((item, index) => (
                  <li key={`${item.quoteA}-${index}`} className="rounded-md border bg-background p-3 space-y-1">
                    <p>{item.reason}</p>
                    <p className="text-muted-foreground">{item.quoteA}</p>
                    <p className="text-muted-foreground">{item.quoteB}</p>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" className="h-10" onClick={() => void checkBriefing(brief)} disabled={disabled || checking}>
                {t(`${I18N}.checkAgain`, "Check briefing")}
              </Button>
            </div>
          )}
          {!checking && !activeCheck && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">{t(`${I18N}.checkMissing`, "This briefing has not been checked yet.")}</p>
              <Button type="button" variant="outline" className="h-10" onClick={() => void checkBriefing(brief)} disabled={disabled || checking}>
                {t(`${I18N}.checkAgain`, "Check briefing")}
              </Button>
            </div>
          )}
          <div className="grid gap-4">
            <MetaField
              id={`${idPrefix}-title`}
              label={t(`${I18N}.titleLabel`, "Unit title")}
              value={title}
              onChange={setTitle}
              suggestion={suggestion.title}
              applyLabel={t(`${I18N}.applySuggestion`, "Use suggestion")}
              disabled={disabled}
            />
            <MetaField
              id={`${idPrefix}-description`}
              label={t(`${I18N}.descriptionLabel`, "Short description")}
              value={description}
              onChange={setDescription}
              suggestion={suggestion.description}
              applyLabel={t(`${I18N}.applySuggestion`, "Use suggestion")}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button className="h-11" onClick={() => void onPrimary()} disabled={!canAct || checking || !briefingPassed}>
              {actionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {mode === "create"
                ? t(`${I18N}.createAndGenerate`, "Create unit and generate draft")
                : t(`${I18N}.generate`, "Generate draft")}
            </Button>
            <Button variant="ghost" onClick={() => void onSecondary()} disabled={!canAct}>
              {mode === "create" ? t(`${I18N}.createOnly`, "Create unit only") : t(`${I18N}.saveOnly`, "Save only")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`${I18N}.generateHint`, "Takes 1 to 3 minutes: the Creator writes, the Validator checks the structure, the Lector reviews. You will see the progress in the Generator.")}
          </p>
        </div>
      )}

      {!hasBrief && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void onSecondary()} disabled={!canAct}>
            {mode === "create" ? t(`${I18N}.createOnly`, "Create unit only") : t(`${I18N}.saveOnly`, "Save only")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {mode === "create"
              ? t(`${I18N}.createOnlyHint`, "You can add the description and generate the draft later.")
              : t(`${I18N}.saveOnlyHint`, "Saves module, number, title and description.")}
          </span>
        </div>
      )}

      {expertChildren}

      {belowResult}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            <div className="text-sm font-medium">{t(`${I18N}.expertTitle`, "Expert view")}</div>
            <p className="text-xs text-muted-foreground">{t(`${I18N}.expertHint`, "The remaining briefing fields: what stays out of scope, chunks, recycling, pitfalls, scenes, listening, culture and exercise focus.")}</p>
          </div>
          <Switch checked={expert} onCheckedChange={setExpert} aria-label={t(`${I18N}.expertTitle`, "Expert view")} />
        </div>

        {expert && (
          <div className="space-y-6 rounded-lg border p-4 sm:p-5">
            {numbersValid && context && (
              <div className="space-y-1.5 text-sm">
                <div className="font-medium">{t(`${I18N}.taughtTitle`, "Already taught in earlier units")}</div>
                {context.previouslyTaught.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {context.previouslyTaught.map((u: { unitNumber: number; title: string; grammar: string }) => (
                      <li key={u.unitNumber}>
                        <span className="text-foreground">Unit {u.unitNumber} · {u.title}</span>: {u.grammar}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t(`${I18N}.taughtNone`, "Nothing yet, this is the first unit.")}</p>
                )}
                <p className="text-xs text-muted-foreground">{t(`${I18N}.planLanguageNote`, "Course content is authored in English; the German learner track is translated afterwards.")}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">{t(`${I18N}.expertBriefing`, "Remaining briefing fields")}</div>
              {!hasBrief && (
                <p className="text-sm text-muted-foreground">{t(`${I18N}.expertNoBriefing`, "No briefing yet. Fill the assignment above and create the briefing, or fill these fields by hand.")}</p>
              )}
              <BriefBuilder
                value={brief}
                onChange={setBrief}
                moduleNumber={moduleNumber}
                disabled={disabled}
                idPrefix={`${idPrefix}-expert`}
                variant="accordion"
                hideHeader
                includeFieldIds={BRIEF_EXPERT_FIELD_IDS}
                lockedCefrLevel={context?.cefrLevel}
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function MetaField({
  id, label, value, onChange, suggestion, applyLabel, disabled,
}: { id: string; label: string; value: string; onChange: (v: string) => void; suggestion?: string; applyLabel: string; disabled?: boolean }) {
  const showSuggestion = !!suggestion && suggestion.trim() !== value.trim();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-10 text-sm bg-background" />
      {showSuggestion && (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline text-left"
          onClick={() => onChange(suggestion!)}
          disabled={disabled}
        >
          {applyLabel}: {suggestion}
        </button>
      )}
    </div>
  );
}
