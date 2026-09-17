import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn, formatDateTimeEU } from "@/lib/utils";
import { CheckCircle, XCircle, Sparkles, Loader2, X, RotateCcw, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AiRunTokenLine, formatAiRunTimestamp, useAiRunStageLabel } from "./AiRunMeta";

export interface QAFindingsPanelProps {
  findings: any[];
  errorFindings: any[];
  warningFindings: any[];
  latestReport: any;
  selected: any;
  isBusy: boolean;
  runningRevise: boolean;
  fixHumanNotes: string;
  setFixHumanNotes: (v: string) => void;
  onRunRevise: () => void;
  onDismissFinding: (params: { findingId: any; dismissed: boolean }) => void;
}

export function QAFindingsPanel({
  findings,
  errorFindings,
  warningFindings,
  latestReport,
  selected,
  isBusy,
  runningRevise,
  fixHumanNotes,
  setFixHumanNotes,
  onRunRevise,
  onDismissFinding,
}: QAFindingsPanelProps) {
  const { t } = useTranslation();
  const stageLabel = useAiRunStageLabel();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{t("admin.contentStudio.findings.title", "Findings")}</CardTitle>
            <div className="text-xs text-muted-foreground">
              {t("admin.contentStudio.findings.subtitle", "Validator report and list of findings.")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={errorFindings.length > 0 ? "default" : "outline"}
              onClick={onRunRevise}
              disabled={isBusy || (errorFindings.length === 0 && warningFindings.length === 0 && !fixHumanNotes.trim())}
            >
              {runningRevise ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {t("admin.contentStudio.findings.fixFindings", "Fix findings")}
            </Button>
            <Badge variant={errorFindings.length ? "destructive" : "secondary"}>
              {t("admin.contentStudio.findings.errorsCount", { defaultValue: "{{n}} errors", n: errorFindings.length })}
            </Badge>
            <Badge variant="secondary">
              {t("admin.contentStudio.findings.warningsCount", { defaultValue: "{{n}} warnings", n: warningFindings.length })}
            </Badge>
            {findings.filter((f: any) => f.severity === "info").length > 0 && (
              <Badge variant="outline" className="border-blue-300/60 text-blue-600 dark:text-blue-400">
                {t("admin.contentStudio.findings.infoCount", {
                  defaultValue: "{{n}} info",
                  n: findings.filter((f: any) => f.severity === "info").length,
                })}
              </Badge>
            )}
            {typeof (latestReport as any)?.variety?.score === "number" ? (
              <Badge
                variant="secondary"
                className={cn(
                  "border",
                  (latestReport as any).variety.score >= 8
                    ? "border-emerald-300/60 text-emerald-700 dark:text-emerald-300"
                    : (latestReport as any).variety.score >= 7
                      ? "border-amber-300/60 text-amber-700 dark:text-amber-300"
                      : "border-red-300/60 text-red-700 dark:text-red-300"
                )}
              >
                {t("admin.contentStudio.findings.variety", {
                  defaultValue: "Variety {{score}}/10",
                  score: (latestReport as any).variety.score,
                })}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {latestReport ? (
          <div className="rounded border p-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>{t("admin.contentStudio.findings.latestReport", "Latest Validator report")}</span>
              {latestReport.ok ? (
                <span className="text-emerald-600 font-semibold">{t("admin.contentStudio.findings.ok", "OK")}</span>
              ) : (
                <span className="text-red-600 font-semibold">{t("admin.contentStudio.findings.notOk", "NOT OK")}</span>
              )}
            </div>
            <div className="mt-1">
              <pre className="whitespace-pre-wrap break-words">{JSON.stringify(latestReport.counts ?? latestReport, null, 2)}</pre>
            </div>
          </div>
        ) : null}

        <div className="max-h-[360px] overflow-auto rounded border p-2">
          {findings.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("admin.contentStudio.findings.none", "No findings yet.")}</div>
          ) : (() => {
            const actionable = findings.filter((f: any) => f.severity !== "info");
            const infoFindings = findings.filter((f: any) => f.severity === "info");
            return (
              <div className="space-y-2">
                {actionable.length === 0 && infoFindings.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {t("admin.contentStudio.findings.noErrorsOrWarnings", "No errors or warnings.")}
                  </div>
                )}
                {actionable
                  .slice()
                  .sort((a: any, b: any) => {
                    if (a.dismissed && !b.dismissed) return 1;
                    if (!a.dismissed && b.dismissed) return -1;
                    return a.severity > b.severity ? -1 : 1;
                  })
                  .map((f: any, idx: number) => (
                    <div
                      key={f._id ?? `a-${idx}`}
                      className={cn(
                        "flex gap-2 text-sm items-start",
                        f.dismissed && "opacity-40"
                      )}
                    >
                      {f.severity === "error" ? (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-1 flex-wrap">
                          <span className={cn(f.dismissed && "line-through")}>{f.code}</span>
                          {f.stage === "auditor" && (
                            <span className="text-xs text-muted-foreground font-normal">
                              {t("admin.contentStudio.findings.lectorTag", "[Lector]")}
                            </span>
                          )}
                          {typeof f.persistCount === "number" && f.persistCount >= 2 && (
                            <span
                              title={t(
                                "admin.contentStudio.findings.persistsTitle",
                                "This finding survived multiple Fix findings attempts. Author notes are unlikely to help here - consider editing manually or dismissing."
                              )}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/60 text-amber-700 dark:text-amber-400 font-normal leading-none"
                            >
                              {t("admin.contentStudio.findings.persists", { defaultValue: "persists x{{n}}", n: f.persistCount })}
                            </span>
                          )}
                          {f.path ? <span className="text-muted-foreground font-normal break-all">({f.path})</span> : null}
                          {typeof f.createdAt === "number" && (
                            <span className="ml-auto text-xs text-muted-foreground font-normal whitespace-nowrap">
                              {formatDateTimeEU(f.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="[overflow-wrap:anywhere] text-muted-foreground">{f.message}</div>
                        {typeof f.persistCount === "number" && f.persistCount >= 2 && (
                          <div className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                            {t("admin.contentStudio.findings.persistsHint", {
                              defaultValue: "Fix findings did not resolve this entry {{n}} times. Edit it manually or dismiss the entry.",
                              n: f.persistCount,
                            })}
                          </div>
                        )}
                      </div>
                      {f._id && (
                        <button
                          type="button"
                          title={
                            f.dismissed
                              ? t("admin.contentStudio.findings.restore", "Restore finding")
                              : t("admin.contentStudio.findings.dismiss", "Dismiss finding (exclude from fix)")
                          }
                          className="shrink-0 mt-0.5 rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => onDismissFinding({ findingId: f._id, dismissed: !f.dismissed })}
                        >
                          {f.dismissed ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}

                {infoFindings.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="info-findings" className="border-0">
                      <AccordionTrigger className="py-1.5 text-xs text-muted-foreground hover:no-underline">
                        <span className="flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-blue-500" />
                          {infoFindings.length === 1
                            ? t("admin.contentStudio.findings.infoNoteOne", "1 informational note (review words used etc.)")
                            : t("admin.contentStudio.findings.infoNotes", {
                                defaultValue: "{{n}} informational notes (review words used etc.)",
                                n: infoFindings.length,
                              })}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1.5 pt-1">
                          {infoFindings.map((f: any, idx: number) => (
                            <div
                              key={f._id ?? `i-${idx}`}
                              className="flex gap-2 text-xs items-start text-muted-foreground"
                            >
                              <Info className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="break-words">{f.message}</div>
                              </div>
                              {typeof f.createdAt === "number" && (
                                <span className="text-xs whitespace-nowrap shrink-0">{formatDateTimeEU(f.createdAt)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            );
          })()}
        </div>

        {/* Human Notes for Fix AI */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("admin.contentStudio.findings.notesLabel", "Lector notes / manual instructions for the fix run (optional)")}
          </Label>
          <Textarea
            placeholder={t(
              "admin.contentStudio.findings.notesPlaceholder",
              "Paste Lector annotations or additional instructions here. The fix run applies them together with the findings above across the entire draft."
            )}
            value={fixHumanNotes}
            onChange={(e) => setFixHumanNotes(e.target.value)}
            rows={4}
            className="text-xs resize-none"
            disabled={isBusy}
          />
          {fixHumanNotes.trim() && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setFixHumanNotes("")}
            >
              {t("admin.contentStudio.findings.clear", "Clear")}
            </button>
          )}
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="ai-runs">
            <AccordionTrigger>{t("admin.contentStudio.aiRuns.title", "AI Runs")}</AccordionTrigger>
            <AccordionContent>
              <div className="rounded border p-2 text-xs text-muted-foreground">
                {((selected as any)?.aiRuns?.length ?? 0) === 0 ? (
                  <div>{t("admin.contentStudio.aiRuns.none", "No AI runs yet.")}</div>
                ) : (
                  <div className="space-y-2">
                    {((selected as any).aiRuns as any[]).slice(0, 8).map((r: any) => (
                      <div key={r._id} className="rounded border-l-2 border-muted-foreground/30 pl-2 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{stageLabel(r.stage)}</span>
                            <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>
                              {r.status}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-xs">{formatAiRunTimestamp(r)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {r.provider}/{r.model}
                        </div>
                        <AiRunTokenLine run={r} />
                        {r.outputSummary ? (
                          <div className="truncate">{String(r.outputSummary).slice(0, 160)}</div>
                        ) : null}
                        {r.error ? (
                          <div className="text-red-600 break-words">{String(r.error).slice(0, 240)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
