import { useTranslation } from "react-i18next";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Optional draft settings that most authors never touch: inspiration
 * reference (PDF), house-style skills, and the author note. Collapsed by
 * default under "More options" so the guided brief workflow stays in focus.
 * Shared by the create and edit forms of the Draft panel.
 */
export interface DraftExtrasProps {
  refs: any[] | undefined;
  refId: string;
  setRefId: (v: string) => void;
  refChapter: string;
  setRefChapter: (v: string) => void;
  refPages: string;
  setRefPages: (v: string) => void;
  refNotes: string;
  setRefNotes: (v: string) => void;

  specialistSkills: any[] | undefined;
  auditorSkills: any[] | undefined;
  specialistSkillIds: string[];
  setSpecialistSkillIds: (v: string[]) => void;
  auditorSkillIds: string[];
  setAuditorSkillIds: (v: string[]) => void;

  disabled?: boolean;
  idPrefix: string;
}

const I18N = "admin.contentStudio.extras";

export function DraftExtras(props: DraftExtrasProps) {
  const { t } = useTranslation();
  const {
    refs, refId, setRefId, refChapter, setRefChapter, refPages, setRefPages, refNotes, setRefNotes,
    specialistSkills, auditorSkills, specialistSkillIds, setSpecialistSkillIds, auditorSkillIds, setAuditorSkillIds,
    disabled, idPrefix,
  } = props;

  const activeRefs = ((refs || []) as any[]).filter((r: any) => r?.isActive);
  const summaryParts: string[] = [];
  if (refId) summaryParts.push(t(`${I18N}.summaryReference`, "reference set"));
  if (specialistSkillIds.length + auditorSkillIds.length > 0) {
    summaryParts.push(t(`${I18N}.summarySkills`, { defaultValue: "{{count}} skill(s)", count: specialistSkillIds.length + auditorSkillIds.length }));
  }
  const toggle = (list: string[], set: (v: string[]) => void, id: string, checked: boolean) =>
    set(checked ? [...list, id] : list.filter((x) => x !== id));

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="extras" className="rounded-lg border px-4 sm:px-5">
        <AccordionTrigger className="py-3 hover:no-underline">
          <div className="flex flex-col items-start gap-0.5 text-left">
            <span className="text-sm font-semibold">{t(`${I18N}.title`, "More options")}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {summaryParts.length > 0 ? summaryParts.join(" · ") : t(`${I18N}.subtitle`, "Reference material and house-style skills. Not needed for a normal unit.")}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-5 space-y-6">
          {/* Reference */}
          <section className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">{t(`${I18N}.reference.title`, "Reference (optional)")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t(`${I18N}.reference.help`, "A PDF or book used for inspiration only. Its structure guidelines are given to the Creator; no text is copied.")}</p>
            </div>
            <Select
              value={refId || "__none__"}
              onValueChange={(v) => {
                setRefId(v === "__none__" ? "" : v);
                if (v === "__none__") { setRefChapter(""); setRefPages(""); setRefNotes(""); }
              }}
              disabled={disabled}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder={t(`${I18N}.reference.select`, "Select a reference...")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-sm">{t(`${I18N}.reference.none`, "None")}</SelectItem>
                {activeRefs.map((r: any) => (
                  <SelectItem key={String(r._id)} value={String(r._id)} className="text-sm">{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {refId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}-ref-chapter`} className="text-sm">{t(`${I18N}.reference.chapter`, "Chapter")}</Label>
                  <Input id={`${idPrefix}-ref-chapter`} value={refChapter} onChange={(e) => setRefChapter(e.target.value)} disabled={disabled} className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${idPrefix}-ref-pages`} className="text-sm">{t(`${I18N}.reference.pages`, "Pages")}</Label>
                  <Input id={`${idPrefix}-ref-pages`} value={refPages} onChange={(e) => setRefPages(e.target.value)} disabled={disabled} className="h-10 text-sm" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor={`${idPrefix}-ref-notes`} className="text-sm">{t(`${I18N}.reference.notes`, "How to use this reference for this unit")}</Label>
                  <Textarea id={`${idPrefix}-ref-notes`} value={refNotes} onChange={(e) => setRefNotes(e.target.value)} rows={2} disabled={disabled} className="text-sm" />
                </div>
              </div>
            )}
          </section>

          {/* House-style skills */}
          <section className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">{t(`${I18N}.skills.title`, "House style (skills)")}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{t(`${I18N}.skills.help`, "Optional style instructions for the Creator and the Lector, e.g. character names or tone. Structural rules live in the base prompts, not here.")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SkillList
                label={t(`${I18N}.skills.creator`, "Creator")}
                empty={t(`${I18N}.skills.noneCreator`, "No creator skills defined.")}
                skills={specialistSkills}
                selected={specialistSkillIds}
                onToggle={(id, checked) => toggle(specialistSkillIds, setSpecialistSkillIds, id, checked)}
                disabled={disabled}
              />
              <SkillList
                label={t(`${I18N}.skills.lector`, "Lector")}
                empty={t(`${I18N}.skills.noneLector`, "No lector skills defined.")}
                skills={auditorSkills}
                selected={auditorSkillIds}
                onToggle={(id, checked) => toggle(auditorSkillIds, setAuditorSkillIds, id, checked)}
                disabled={disabled}
              />
            </div>
          </section>

        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/**
 * The author's personal note at the top of the unit. Lives in the main flow
 * (not in the expert view): authors should see it every time, because a unit
 * without a note gets a generated founder story otherwise.
 */
export interface AuthorNoteFieldProps {
  authorNoteName: string;
  setAuthorNoteName: (v: string) => void;
  authorNoteQuote: string;
  setAuthorNoteQuote: (v: string) => void;
  onAuthorQuoteBlur?: () => void;
  disabled?: boolean;
  idPrefix: string;
}

export function AuthorNoteField({
  authorNoteName, setAuthorNoteName, authorNoteQuote, setAuthorNoteQuote, onAuthorQuoteBlur, disabled, idPrefix,
}: AuthorNoteFieldProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border bg-card p-4 sm:p-5 space-y-3">
      <div>
        <Label className="text-base font-semibold">{t(`${I18N}.authorNote.title`, "Author note (optional)")}</Label>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{t(`${I18N}.authorNote.help`, "A short personal note shown at the top of the unit in your voice. German is fine; it is translated for the English track. Leave the quote empty and the unit gets a neutral introduction instead.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-author-name`} className="text-sm">{t(`${I18N}.authorNote.name`, "Name")}</Label>
          <Input id={`${idPrefix}-author-name`} value={authorNoteName} onChange={(e) => setAuthorNoteName(e.target.value)} disabled={disabled} className="h-10 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-author-quote`} className="text-sm">{t(`${I18N}.authorNote.quote`, "Note (2-3 sentences)")}</Label>
          <Textarea
            id={`${idPrefix}-author-quote`}
            value={authorNoteQuote}
            onChange={(e) => setAuthorNoteQuote(e.target.value)}
            onBlur={onAuthorQuoteBlur}
            rows={3}
            disabled={disabled}
            className="text-sm leading-relaxed"
          />
        </div>
      </div>
    </section>
  );
}

function SkillList({
  label, empty, skills, selected, onToggle, disabled,
}: { label: string; empty: string; skills: any[] | undefined; selected: string[]; onToggle: (id: string, checked: boolean) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="space-y-1.5">
        {((skills || []) as any[]).map((s: any) => (
          <label key={String(s._id)} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(String(s._id))}
              onChange={(e) => onToggle(String(s._id), e.target.checked)}
              className="rounded"
              disabled={disabled}
            />
            {s.name}
          </label>
        ))}
        {!skills?.length && <span className="text-sm text-muted-foreground">{empty}</span>}
      </div>
    </div>
  );
}
