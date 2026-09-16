import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Quote } from "lucide-react";
import { SECTION_OPTIONS } from "./constants";
import { useSectionLabel } from "./utils/sectionLabel";
import type { BriefVersionShape } from "./BriefVersionsPanel";
import { computeBriefVersionNumbers, formatBriefVersionId } from "./utils/briefVersionLabel";

export interface CuratedSectionEntryShape {
  section: string;
  markdown: string;
  /** Human instruction from the Section Editor that produced this markdown. */
  instruction?: string;
  adoptedAt?: number;
  sourceSnapshotId?: string;
}

export interface CuratedSectionsPanelProps {
  curatedSections: CuratedSectionEntryShape[] | undefined;
  briefVersions: BriefVersionShape[] | undefined;
  moduleNumber?: number | string | null;
  unitNumber?: number | string | null;
}

/**
 * Read-only display of the current draft's adopted sections
 * (`contentDrafts.curatedSections`). These are the section markdowns that
 * were adopted from the rendered preview via "Adopt into Brief" and will be
 * included in the next full Creator regeneration.
 *
 * The panel is intentionally read-only: adopting is the moment the human
 * accepts a section. Removing/replacing happens by adopting again from a new
 * snapshot or by selecting an older Brief Version — not by editing text here.
 */
function formatRelativeTime(timestamp: number | undefined, t: TFunction): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "";
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return new Date(timestamp).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return t("admin.contentStudio.curated.justNow", "just now");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("admin.contentStudio.curated.minutesAgo", { defaultValue: "{{n}}m ago", n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("admin.contentStudio.curated.hoursAgo", { defaultValue: "{{n}}h ago", n: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t("admin.contentStudio.curated.daysAgo", { defaultValue: "{{n}}d ago", n: day });
  return new Date(timestamp).toLocaleDateString();
}

export function CuratedSectionsPanel({
  curatedSections,
  briefVersions,
  moduleNumber,
  unitNumber,
}: CuratedSectionsPanelProps) {
  const { t } = useTranslation();
  const sectionLabel = useSectionLabel();
  const [rawViewFor, setRawViewFor] = useState<Record<string, boolean>>({});

  const bySection = useMemo(() => {
    const map = new Map<string, CuratedSectionEntryShape>();
    for (const c of curatedSections ?? []) map.set(c.section, c);
    return map;
  }, [curatedSections]);

  const briefVersionNumbers = useMemo(
    () => computeBriefVersionNumbers(briefVersions ?? []),
    [briefVersions],
  );

  const versionIdForAdoption = (adoptedAt: number | undefined): string | null => {
    if (!adoptedAt || !Array.isArray(briefVersions)) return null;
    const match = briefVersions.find((v) => v.createdAt === adoptedAt);
    if (!match) return null;
    return formatBriefVersionId(
      moduleNumber,
      unitNumber,
      briefVersionNumbers.get(String(match._id)),
    );
  };

  const adopted = SECTION_OPTIONS.filter((s) => bySection.has(s.value));

  if (adopted.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="font-semibold">
          {t("admin.contentStudio.curated.title", "Curated sections (adopted from Markdown)")}
        </Label>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {adopted.length}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <Trans
          i18nKey="admin.contentStudio.curated.description"
          defaults="Read-only. Each entry shows the author <em>instruction</em> that caused the section revision (the cause) and the resulting rendered Markdown (the effect). Both are anchored in the Briefing so a future Creator run can build on them. To change a section, revise it in the Generator and <em>Adopt into Briefing</em> again — or select an older briefing version above."
          components={{ em: <span className="font-medium" /> }}
        />
      </p>

      <Accordion type="multiple" className="w-full">
        {adopted.map((opt) => {
          const entry = bySection.get(opt.value)!;
          const relTime = formatRelativeTime(entry.adoptedAt, t);
          const versionId = versionIdForAdoption(entry.adoptedAt);
          const raw = !!rawViewFor[opt.value];
          const contentValue = String(entry.markdown ?? "").trim();
          return (
            <AccordionItem
              key={opt.value}
              value={opt.value}
              className="border rounded-md mb-1.5 bg-background px-2"
            >
              <AccordionTrigger className="py-1.5 hover:no-underline">
                <div className="flex items-center gap-2 min-w-0 text-left w-full pr-2">
                  <span className="text-sm font-medium shrink-0">{sectionLabel(opt.value)}</span>
                  {relTime && (
                    <span
                      className="text-[11px] text-muted-foreground shrink-0"
                      title={
                        entry.adoptedAt
                          ? new Date(entry.adoptedAt).toLocaleString()
                          : undefined
                      }
                    >
                      {t("admin.contentStudio.curated.adopted", { defaultValue: "· adopted {{time}}", time: relTime })}
                    </span>
                  )}
                  {versionId && (
                    <Badge
                      variant="outline"
                      className="ml-auto text-[10px] font-mono shrink-0"
                    >
                      {versionId}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-3 space-y-2">
                <div
                  className={cn(
                    "rounded-md border p-2 text-xs leading-relaxed",
                    entry.instruction
                      ? "bg-primary/5 border-primary/20"
                      : "bg-muted/40 border-muted-foreground/20",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Quote className="h-3 w-3 text-primary shrink-0" />
                    <span className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
                      {t("admin.contentStudio.curated.instruction", "Instruction")}
                    </span>
                  </div>
                  {entry.instruction ? (
                    <p className="whitespace-pre-wrap break-words text-foreground">
                      {entry.instruction}
                    </p>
                  ) : (
                    <p className="italic text-muted-foreground">
                      {t(
                        "admin.contentStudio.curated.noInstruction",
                        "No instruction recorded — adopted from a draft that was not produced by a targeted section revision for this section (e.g. a full Creator run)."
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("admin.contentStudio.curated.renderedResult", "Rendered result")}
                  </span>
                  <div className="inline-flex rounded-md border overflow-hidden">
                    <Button
                      type="button"
                      size="sm"
                      variant={raw ? "ghost" : "secondary"}
                      className="h-6 rounded-none px-2 text-[11px]"
                      onClick={() =>
                        setRawViewFor((prev) => ({ ...prev, [opt.value]: false }))
                      }
                    >
                      {t("admin.contentStudio.curated.rendered", "Rendered")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={raw ? "secondary" : "ghost"}
                      className="h-6 rounded-none px-2 text-[11px]"
                      onClick={() =>
                        setRawViewFor((prev) => ({ ...prev, [opt.value]: true }))
                      }
                    >
                      {t("admin.contentStudio.curated.raw", "Raw")}
                    </Button>
                  </div>
                </div>
                {contentValue.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    {t("admin.contentStudio.curated.emptySection", "Section has no content.")}
                  </p>
                ) : raw ? (
                  <pre
                    className={cn(
                      "max-h-[320px] overflow-auto rounded border bg-muted/30",
                      "p-2 text-[11px] font-mono whitespace-pre-wrap break-words",
                    )}
                  >
                    {contentValue}
                  </pre>
                ) : (
                  <div className="max-h-[380px] overflow-auto rounded border bg-background p-2">
                    <MarkdownContent
                      content={contentValue}
                      className="prose-sm max-w-none"
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
