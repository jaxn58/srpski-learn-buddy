import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Loader2, Wand2 } from "lucide-react";
import { ModuleSelect } from "./ModuleSelect";
import { BriefAssistant, type LevelCoverageShape } from "./BriefAssistant";
import { BriefBuilder } from "./BriefBuilder";
import { CreateModuleDialog } from "./CreateModuleDialog";
import { parseBriefText } from "@shared/contentStudio/briefTemplate";

/**
 * Authoring panel for a unit, built for authors who are not language
 * professionals. The visible flow is deliberately small:
 *
 *   module + unit number -> one free-text box -> "Create briefing"
 *   -> readable result (title, description) -> "Generate draft".
 *
 * The language level and grammar target come from the unit's position in the
 * course (curriculum) and are shown as one plain line; the author never has
 * to know CEFR codes or Can-Do statements. Topic, places and scenes come
 * from the author's text only.
 *
 * Everything structural (the 15-field briefing, briefing versions,
 * reference, house-style skills, author note) lives behind the "Expert view"
 * switch, off by default. Shared by the create and edit forms.
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
  /** Rendered inside the expert view (versions, reference, skills, author note, templates). */
  expertChildren?: ReactNode;
}

const I18N = "admin.contentStudio.workflow";

export function BriefWorkflow(props: BriefWorkflowProps) {
  const {
    mode, moduleNumber, setModuleNumber, unitNumber, setUnitNumber,
    collides, collisionMessage, numbersValid,
    title, setTitle, description, setDescription,
    brief, setBrief, disabled, idPrefix,
    onPrimary, onSecondary, actionBusy, expertChildren,
  } = props;
  const { t } = useTranslation();
  const [expert, setExpert] = useState(false);
  const [suggestion, setSuggestion] = useState<{ title?: string; description?: string }>({});
  const [coverage, setCoverage] = useState<LevelCoverageShape | null>(null);
  const [createModuleOpen, setCreateModuleOpen] = useState(false);

  const unitNo = Number(unitNumber);
  const moduleNo = Number(moduleNumber);
  const context = useQuery(
    api.curriculum.getUnitContext,
    numbersValid ? { unitNumber: unitNo, moduleNumber: moduleNo } : "skip",
  );

  const hasBrief = brief.trim().length > 0;
  const canAct = numbersValid && !collides && !disabled && !actionBusy;

  const levelLabel = (cefr: string) => t(`${I18N}.level.${cefr}`, cefr);
  const chosenGrammar = (() => {
    if (!hasBrief) return "";
    const parsed = parseBriefText(brief);
    return parsed.recognized ? String(parsed.fields.grammarIn ?? "").trim() : "";
  })();
  const taughtCount = context?.previouslyTaught.length ?? 0;

  // Stored judgement from earlier runs in this module (before this unit has a briefing).
  const storedCoverage = context?.moduleCoverage ?? null;
  const moduleAlreadyComplete =
    !hasBrief && !!storedCoverage && storedCoverage.status === "complete" && storedCoverage.unitNumber !== unitNo;

  const coverageLine = (c: { level: string; covered: string[]; missing: string[] }) => {
    const total = c.covered.length + c.missing.length;
    return total > 0
      ? t(`${I18N}.coverageLine`, { defaultValue: "Level {{level}}: {{done}} of {{total}} core points covered", level: c.level, done: c.covered.length, total })
      : t(`${I18N}.coverageLineNoCount`, { defaultValue: "Level {{level}}", level: c.level });
  };

  const nextModuleCta = context && (
    <Button variant="outline" size="sm" onClick={() => setCreateModuleOpen(true)} disabled={disabled}>
      {t(`${I18N}.createNextModule`, { defaultValue: "Create module {{n}} ({{level}})", n: context.nextModuleNumber, level: levelLabel(context.nextModuleLevel) })}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Where the unit sits in the course */}
      <div className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t(`${I18N}.module`, "Module")}</Label>
            <ModuleSelect value={moduleNumber} onChange={setModuleNumber} hasError={collides} />
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
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">{t(`${I18N}.levelLine`, "Language level")}: </span>
            {levelLabel(context.cefrLevel)}
            {taughtCount > 0 && (
              <>
                <span className="mx-1.5">·</span>
                {t(`${I18N}.buildsOn`, { defaultValue: "builds on {{n}} earlier unit(s)", n: taughtCount })}
              </>
            )}
            <span className="mx-1.5">·</span>
            {t(`${I18N}.grammarDecidedByAi`, "the grammar focus is chosen to fit your topic and the level")}
          </p>
        )}
      </div>

      {moduleAlreadyComplete && storedCoverage && context && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm space-y-2">
          <div className="font-medium">
            {t(`${I18N}.moduleCompleteTitle`, { defaultValue: "Module {{module}} already covers level {{level}} completely.", module: moduleNumber, level: storedCoverage.level })}
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {t(`${I18N}.moduleCompleteHint`, "You can still add a unit here (it will revise and deepen rather than introduce new grammar). For new material, continue in the next module.")}
          </p>
          <div className="flex flex-wrap items-center gap-3">{nextModuleCta}</div>
        </div>
      )}

      <Separator />

      {/* The one thing the author has to do */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">{t(`${I18N}.topicLabel`, "What should this unit be about?")}</Label>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`${I18N}.topicHelp`, "Type or dictate freely: places, people, situations, anything you want the learner to experience. Level, grammar and structure are handled for you.")}
        </p>
        <BriefAssistant
          unitNumber={unitNumber}
          moduleNumber={moduleNumber}
          currentBrief={brief}
          onApply={setBrief}
          onSuggestMeta={(meta) => {
            setSuggestion(meta);
            if (meta.title && !title.trim()) setTitle(meta.title);
            if (meta.description && !description.trim()) setDescription(meta.description);
          }}
          onCoverage={setCoverage}
          disabled={disabled || !numbersValid}
          hideHeader
        />
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
          {coverage && (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm space-y-1.5",
                coverage.status === "complete" && "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30",
              )}
            >
              <div className="font-medium">
                {coverageLine(coverage)}
                {coverage.status === "complete" && ` · ${t(`${I18N}.coverageComplete`, "complete")}`}
                {coverage.status === "nearly_complete" && ` · ${t(`${I18N}.coverageNearly`, "nearly complete")}`}
              </div>
              {coverage.note && <p className="text-muted-foreground leading-relaxed">{coverage.note}</p>}
              {coverage.missing.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t(`${I18N}.coverageMissing`, "Still open")}: {coverage.missing.join(", ")}
                </p>
              )}
              {coverage.status === "complete" && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">{t(`${I18N}.coverageNextHint`, "Further new material belongs in the next module.")}</span>
                  {nextModuleCta}
                </div>
              )}
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
            <Button className="h-11" onClick={() => void onPrimary()} disabled={!canAct}>
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

      {/* Expert view: everything structural, off by default */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 pt-2">
          <div>
            <div className="text-sm font-medium">{t(`${I18N}.expertTitle`, "Expert view")}</div>
            <p className="text-xs text-muted-foreground">{t(`${I18N}.expertHint`, "Structured briefing, learning goals, versions, reference and house style. Not needed for a normal unit.")}</p>
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
                {context.plannedHint && (
                  <p className="text-xs text-muted-foreground">
                    {t(`${I18N}.plannedHint`, "Suggestion from the course map (not binding)")}: {context.plannedHint.primaryGrammarEn}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{t(`${I18N}.planLanguageNote`, "Course content is authored in English; the German learner track is translated afterwards.")}</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">{t(`${I18N}.expertBriefing`, "Structured briefing (what the Creator receives)")}</div>
              {!hasBrief && (
                <p className="text-sm text-muted-foreground">{t(`${I18N}.expertNoBriefing`, "No briefing yet. Describe the unit above and create the briefing, or fill the fields here by hand.")}</p>
              )}
              <BriefBuilder value={brief} onChange={setBrief} moduleNumber={moduleNumber} disabled={disabled} idPrefix={idPrefix} variant="accordion" hideHeader />
            </div>

            {expertChildren}
          </div>
        )}
      </div>

      {context && (
        <CreateModuleDialog
          open={createModuleOpen}
          onOpenChange={setCreateModuleOpen}
          suggestedModuleNumber={context.nextModuleNumber}
          onCreated={(m) => {
            setCreateModuleOpen(false);
            if (typeof m.moduleNumber === "number") setModuleNumber(String(m.moduleNumber));
          }}
        />
      )}
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
