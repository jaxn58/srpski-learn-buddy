import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  BRIEF_FIELDS,
  BRIEF_FIELD_DEFAULTS,
  BRIEF_MAX_CHARS,
  BRIEF_WARN_CHARS,
  missingRequiredBriefFields,
  parseBriefText,
  renderBriefText,
  type BriefFieldDef,
  type BriefFieldId,
  type BriefFields,
} from "@shared/contentStudio/briefTemplate";

/**
 * Structured editor for the creator brief.
 *
 * The persisted value stays the rendered brief TEXT (`value` / `onChange`), so
 * versioning, templates and the Creator prompt are untouched. The form is a
 * view on that text: fields -> renderBriefText -> onChange; external value
 * changes (draft switch, template prefill, version restore, Brief Assistant)
 * are parsed back into fields. Legacy free-text briefs are not recognised by
 * the parser and open in raw mode with a one-click conversion.
 *
 * Layout: fields are grouped into four labelled sections so the author reads
 * a guided form, not a 15-item list. Minimum text size is 12px (text-xs).
 */
export interface BriefBuilderProps {
  value: string;
  onChange: (text: string) => void;
  moduleNumber: number | string;
  disabled?: boolean;
  /** Optional id prefix so labels stay unique when two builders are mounted. */
  idPrefix?: string;
  /**
   * "flat": all groups visible (default). "accordion": a readable summary on
   * top, each group collapsed until opened; groups with missing required
   * fields start open. Used by the guided draft workflow (step 3).
   */
  variant?: "flat" | "accordion";
  /** Hide the internal title/subtitle row when the parent already labels the step. */
  hideHeader?: boolean;
}

type Mode = "form" | "raw";

const I18N = "admin.contentStudio.brief";

/** Field groups shown as sections; order defines the reading flow. */
const FIELD_GROUPS: Array<{ id: string; fallbackTitle: string; fields: BriefFieldId[] }> = [
  { id: "classification", fallbackTitle: "Classification", fields: ["unitType", "cefrLevel", "strand", "setting"] },
  { id: "content", fallbackTitle: "Situation and goals", fields: ["situation", "canDo", "scenes", "cultural"] },
  { id: "grammar", fallbackTitle: "Grammar", fields: ["grammarIn", "grammarOut", "chunks", "recycle", "pitfalls"] },
  { id: "practice", fallbackTitle: "Exercises and listening", fields: ["exerciseFocus", "listening"] },
];

/** UI texts for a field; the English `def.*` values are the fallback and stay the prompt markers. */
function useFieldTexts() {
  const { t } = useTranslation();
  return {
    label: (def: BriefFieldDef) => t(`${I18N}.field.${def.id}.label`, def.label),
    help: (def: BriefFieldDef) => t(`${I18N}.field.${def.id}.help`, def.help),
    placeholder: (def: BriefFieldDef) => (def.placeholder ? t(`${I18N}.field.${def.id}.placeholder`, def.placeholder) : undefined),
    option: (def: BriefFieldDef, id: string, fallback: string) => t(`${I18N}.option.${def.id}.${id}`, fallback),
    group: (id: string, fallback: string) => t(`${I18N}.group.${id}`, fallback),
  };
}

export function BriefBuilder({ value, onChange, moduleNumber, disabled, idPrefix = "brief", variant = "flat", hideHeader = false }: BriefBuilderProps) {
  const { t, i18n } = useTranslation();
  const texts = useFieldTexts();
  const numberLocale = i18n.language?.startsWith("de") ? "de-DE" : "en-US";
  const initial = useMemo(() => parseBriefText(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fields, setFields] = useState<BriefFields>(() => ({ ...BRIEF_FIELD_DEFAULTS, ...initial.fields }));
  const [mode, setMode] = useState<Mode>(() => (value.trim() && !initial.recognized ? "raw" : "form"));
  const [legacyText, setLegacyText] = useState<string>(() => (value.trim() && !initial.recognized ? value : ""));
  const lastEmitted = useRef<string>(value);

  // External value change (draft switch, template, version restore, assistant): re-sync.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const parsed = parseBriefText(value);
    if (!value.trim()) {
      setFields({ ...BRIEF_FIELD_DEFAULTS });
      setLegacyText("");
      setMode("form");
      return;
    }
    if (parsed.recognized) {
      setFields({ ...BRIEF_FIELD_DEFAULTS, ...parsed.fields });
      setLegacyText("");
      setMode("form");
    } else {
      setLegacyText(value);
      setMode("raw");
    }
  }, [value]);

  const emit = (next: BriefFields) => {
    setFields(next);
    const text = renderBriefText({ moduleNumber, fields: next });
    lastEmitted.current = text;
    onChange(text);
  };

  // Module number lives outside the form; re-render text when it changes.
  useEffect(() => {
    if (mode !== "form") return;
    const text = renderBriefText({ moduleNumber, fields });
    if (text !== lastEmitted.current && value.trim()) {
      lastEmitted.current = text;
      onChange(text);
    }
  }, [moduleNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const rendered = mode === "form" ? renderBriefText({ moduleNumber, fields }) : value;
  const length = rendered.length;
  const missing = missingRequiredBriefFields(fields);
  const overLimit = length > BRIEF_MAX_CHARS;
  const nearLimit = !overLimit && length > BRIEF_WARN_CHARS;

  const switchToRaw = () => {
    setLegacyText(rendered);
    setMode("raw");
  };

  const switchToForm = () => {
    const parsed = parseBriefText(value);
    if (parsed.recognized) {
      setFields({ ...BRIEF_FIELD_DEFAULTS, ...parsed.fields });
      setMode("form");
      return;
    }
    // Legacy text: keep it as the Situation so nothing is lost.
    const next: BriefFields = { ...BRIEF_FIELD_DEFAULTS, situation: value.trim() };
    setMode("form");
    emit(next);
  };

  const defById = (id: BriefFieldId) => BRIEF_FIELDS.find((f) => f.id === id)!;

  /** One-line preview per group for collapsed accordion headers. */
  const groupPreview = (groupId: string): string => {
    const g = FIELD_GROUPS.find((x) => x.id === groupId);
    if (!g) return "";
    if (groupId === "classification") {
      return g.fields
        .map((id) => {
          const def = defById(id);
          const val = fields[id];
          return val ? texts.option(def, val, def.options?.find((o) => o.id === val)?.label ?? val) : null;
        })
        .filter(Boolean)
        .join(" · ");
    }
    const first = g.fields.map((id) => fields[id]).find((v) => v && v.trim());
    if (!first) return "";
    const oneLine = first.replace(/\s+/g, " ").trim();
    return oneLine.length > 90 ? `${oneLine.slice(0, 90)}…` : oneLine;
  };

  const groupMissing = (groupId: string) => missing.some((m) => FIELD_GROUPS.find((g) => g.id === groupId)?.fields.includes(m.id));
  const defaultOpenGroups = FIELD_GROUPS.filter((g) => groupMissing(g.id)).map((g) => g.id);

  const rawSwitch = (
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0">
      <span>{t(`${I18N}.editRaw`, "Edit raw text")}</span>
      <Switch
        checked={mode === "raw"}
        onCheckedChange={(checked) => (checked ? switchToRaw() : switchToForm())}
        disabled={disabled}
      />
    </label>
  );

  return (
    <div className="space-y-5">
      {/* Header row: title, subtitle, raw-mode switch */}
      {hideHeader ? (
        <div className="flex justify-end">{rawSwitch}</div>
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <Label className="text-base font-semibold">{t(`${I18N}.title`, "Briefing")}</Label>
            <p className="text-sm text-muted-foreground mt-0.5">{t(`${I18N}.subtitle`)}</p>
          </div>
          <div className="pt-1">{rawSwitch}</div>
        </div>
      )}

      {mode === "raw" ? (
        <div className="space-y-3">
          {legacyText && !parseBriefText(legacyText).recognized && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{t(`${I18N}.legacyHint`)}</span>
              <Button size="sm" variant="outline" onClick={switchToForm} disabled={disabled} className="shrink-0">
                {t(`${I18N}.convertToForm`, "Convert to form")}
              </Button>
            </div>
          )}
          <Textarea
            value={value}
            onChange={(e) => {
              lastEmitted.current = e.target.value;
              onChange(e.target.value);
            }}
            disabled={disabled}
            className="min-h-[360px] font-mono text-sm leading-relaxed"
            placeholder={renderBriefText({
              moduleNumber,
              fields: { ...BRIEF_FIELD_DEFAULTS, situation: "<one paragraph>", canDo: "<one statement per line>", grammarIn: "<exact forms>" },
            })}
          />
        </div>
      ) : variant === "accordion" ? (
        <Accordion type="multiple" defaultValue={defaultOpenGroups} className="w-full space-y-2">
          {FIELD_GROUPS.map((group) => {
            const preview = groupPreview(group.id);
            const hasMissing = groupMissing(group.id);
            return (
              <AccordionItem key={group.id} value={group.id} className="rounded-lg border bg-background px-4">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex flex-col items-start gap-0.5 text-left min-w-0 pr-2">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {texts.group(group.id, group.fallbackTitle)}
                      {hasMissing && (
                        <Badge variant="outline" className="text-xs font-normal border-amber-400/70 text-amber-700 dark:text-amber-300">
                          {t(`${I18N}.incomplete`, "incomplete")}
                        </Badge>
                      )}
                    </span>
                    {preview && <span className="text-xs text-muted-foreground font-normal truncate max-w-full">{preview}</span>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {group.id === "classification" ? (
                    <div className="grid gap-4 sm:grid-cols-2 pt-1">
                      {group.fields.map((id) => (
                        <SelectField key={id} def={defById(id)} value={fields[id] ?? ""} onChange={(v) => emit({ ...fields, [id]: v })} disabled={disabled} idPrefix={idPrefix} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 pt-1">
                      {group.fields.map((id) => (
                        <TextField key={id} def={defById(id)} value={fields[id] ?? ""} onChange={(v) => emit({ ...fields, [id]: v })} disabled={disabled} idPrefix={idPrefix} />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="space-y-6">
          {FIELD_GROUPS.map((group, gi) => (
            <section key={group.id} className="space-y-4">
              {gi > 0 && <Separator />}
              <h4 className="text-sm font-semibold text-foreground">{texts.group(group.id, group.fallbackTitle)}</h4>
              {group.id === "classification" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map((id) => (
                    <SelectField key={id} def={defById(id)} value={fields[id] ?? ""} onChange={(v) => emit({ ...fields, [id]: v })} disabled={disabled} idPrefix={idPrefix} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {group.fields.map((id) => (
                    <TextField key={id} def={defById(id)} value={fields[id] ?? ""} onChange={(v) => emit({ ...fields, [id]: v })} disabled={disabled} idPrefix={idPrefix} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Status line: length, limit warnings, missing required fields */}
      <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
        <span className={cn("font-medium", overLimit && "text-destructive", nearLimit && "text-amber-700 dark:text-amber-400")}>
          {t(`${I18N}.charCount`, {
            defaultValue: "{{chars}} / {{max}} characters",
            chars: length.toLocaleString(numberLocale),
            max: BRIEF_MAX_CHARS.toLocaleString(numberLocale),
          })}
        </span>
        {overLimit && (
          <span className="text-destructive">
            {t(`${I18N}.overLimit`, {
              defaultValue: "The Creator truncates the brief at {{max}} characters. Shorten it.",
              max: BRIEF_MAX_CHARS.toLocaleString(numberLocale),
            })}
          </span>
        )}
        {nearLimit && <span>{t(`${I18N}.nearLimit`, "Close to the limit.")}</span>}
        {mode === "form" && missing.length > 0 && (
          <span className="flex items-center gap-1.5 flex-wrap">
            {t(`${I18N}.missing`, "Missing:")}
            {missing.map((m) => (
              <Badge key={m.id} variant="outline" className="text-xs font-normal">{texts.label(m)}</Badge>
            ))}
          </span>
        )}
      </div>

      {mode === "form" && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="generated" className="rounded-lg border bg-muted/20 px-4">
            <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">
              {t(`${I18N}.generatedTitle`, "Generated briefing (what the Creator receives)")}
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-muted-foreground">
                {rendered || t(`${I18N}.empty`, "(empty)")}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

type FieldProps = { def: BriefFieldDef; value: string; onChange: (v: string) => void; disabled?: boolean; idPrefix: string };

function FieldLabel({ def, id, label }: { def: BriefFieldDef; id: string; label: string }) {
  return (
    <Label htmlFor={id} className="text-sm font-medium">
      {label}
      {def.required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
    </Label>
  );
}

function SelectField({ def, value, onChange, disabled, idPrefix }: FieldProps) {
  const { t } = useTranslation();
  const texts = useFieldTexts();
  const id = `${idPrefix}-${def.id}`;
  return (
    <div className="space-y-1.5">
      <FieldLabel def={def} id={id} label={texts.label(def)} />
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-10 text-sm">
          <SelectValue placeholder={t(`${I18N}.selectPlaceholder`, "Select...")} />
        </SelectTrigger>
        <SelectContent>
          {(def.options ?? []).map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-sm">{texts.option(def, o.id, o.label)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground leading-snug">{texts.help(def)}</p>
    </div>
  );
}

function TextField({ def, value, onChange, disabled, idPrefix }: FieldProps) {
  const texts = useFieldTexts();
  const id = `${idPrefix}-${def.id}`;
  return (
    <div className="space-y-1.5">
      <FieldLabel def={def} id={id} label={texts.label(def)} />
      {def.kind === "text" ? (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={texts.placeholder(def)} disabled={disabled} className="h-10 text-sm" />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={texts.placeholder(def)}
          rows={Math.max(def.rows ?? 3, 3)}
          disabled={disabled}
          className="text-sm leading-relaxed"
        />
      )}
      <p className="text-xs text-muted-foreground leading-snug">{texts.help(def)}</p>
    </div>
  );
}
