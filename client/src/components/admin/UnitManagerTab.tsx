import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useMemo, useEffect, Fragment } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// AlertDialog imports removed — actions use inline confirm inputs
import { MarkdownContent } from "@/components/MarkdownContent";
import { Search, ExternalLink, Eye, ArrowUpCircle, XCircle, Loader2, WifiOff, Wifi, Trash2, AlertTriangle, Languages, ChevronDown, ChevronRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ReleaseStatus = "published" | "preview" | "offline";

interface LangVersion {
  title: string;
  description?: string;
  releaseStatus: string;
  isOffline: boolean;
  sectionCount: number;
  testCount: number;
  vocabCount: number;
  latestContentUpdatedAt?: number;
}

interface UnitOverview {
  unitNumber: number;
  moduleName?: string;
  moduleNumber?: number;
  deTranslationStale?: boolean;
  versions: Record<string, LangVersion>;
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  de: "Deutsch",
  es: "Espanol",
  fr: "Francais",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tiny colored dot indicating language version status. */
function langDot(version: LangVersion | undefined) {
  if (!version) return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/25" title="missing" />;
  if (version.isOffline) return <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="offline" />;
  if (version.releaseStatus === "preview") return <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="preview" />;
  return <span className="inline-block h-2 w-2 rounded-full bg-green-600" title="published" />;
}

function statusBadge(status: string | undefined, isOffline: boolean) {
  if (isOffline) {
    return <Badge variant="outline" className="text-muted-foreground">offline (toggle)</Badge>;
  }
  switch (status) {
    case "published":
      return <Badge className="bg-green-600/90 hover:bg-green-600 text-white">published</Badge>;
    case "preview":
      return <Badge className="bg-amber-500/90 hover:bg-amber-500 text-white">preview</Badge>;
    case "offline":
      return <Badge variant="outline" className="text-muted-foreground">offline</Badge>;
    default:
      return <Badge className="bg-green-600/90 hover:bg-green-600 text-white">published</Badge>;
  }
}

function langFlag(lang: string) {
  return LANG_LABELS[lang] ?? lang.toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface UnitManagerTabProps {
  /** Map of unitNumber -> timestamp for units that were recently translated to DE. */
  recentlyTranslatedUnits?: Map<number, number>;
  /** Called when a translation completes, so the parent can highlight the unit. */
  onTranslationComplete?: (unitNumber: number) => void;
}

export function UnitManagerTab({ recentlyTranslatedUnits, onTranslationComplete }: UnitManagerTabProps) {
  const overview = useQuery(api.contentStudio.getUnitManagementOverview);
  const promotePreview = useMutation(api.contentStudio.promoteLanguagePreviewToPublished);
  const offlinePreview = useMutation(api.contentStudio.takeLanguagePreviewOffline);
  const setUnitOffline = useMutation(api.units.setUnitOffline);
  const deleteUnitFull = useMutation(api.contentStudio.deleteUnitFull);
  const doTranslate = useAction(api.contentStudio.translatePublishedUnitEnToDe);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "preview" | "missing_de" | "de_outdated">("all");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [detailLang, setDetailLang] = useState<string>("en");
  const [inlinePreviewOpen, setInlinePreviewOpen] = useState(false);
  const [inlinePreviewSection, setInlinePreviewSection] = useState<{ contentType: string; content: string; tests?: any[] } | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const [promoteConfirm, setPromoteConfirm] = useState("");
  const [offlineConfirm, setOfflineConfirm] = useState("");
  const [publishMode, setPublishMode] = useState<"update" | "replace">("update");
  const [running, setRunning] = useState(false);

  const [unitOfflineConfirm, setUnitOfflineConfirm] = useState("");
  const [unitDeleteConfirm, setUnitDeleteConfirm] = useState("");

  // Translation workflow state
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateSource, setTranslateSource] = useState<"published" | "preview">("published");
  const [translateProvider, setTranslateProvider] = useState<"gemini" | "openai">("gemini");
  const [translateConfirm, setTranslateConfirm] = useState("");
  const [translateRunning, setTranslateRunning] = useState(false);
  const [translateReport, setTranslateReport] = useState<{
    totalDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalThinkingTokens: number;
    totalCostUsd: number | null;
    stepCount: number;
    qualityIssueCount: number;
    steps: Array<{
      step: string;
      provider: string;
      model: string;
      durationMs: number;
      inputTokens: number | null;
      outputTokens: number | null;
      thinkingTokens: number | null;
      totalTokens: number | null;
      estimatedCostUsd: number | null;
      qualityIssues: string[];
    }>;
  } | null>(null);

  // Auto-fade: force re-render every minute so "X min ago" updates, and entries older than 30 min disappear
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!recentlyTranslatedUnits || recentlyTranslatedUnits.size === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [recentlyTranslatedUnits]);

  /** Returns minutes-ago string if this unit was recently translated, otherwise null. */
  const recentTranslationInfo = (unitNumber: number): string | null => {
    const ts = recentlyTranslatedUnits?.get(unitNumber);
    if (!ts) return null;
    const minutesAgo = Math.floor((Date.now() - ts) / 60_000);
    if (minutesAgo >= 30) return null; // expired
    if (minutesAgo < 1) return "just now";
    return `${minutesAgo} min ago`;
  };

  // Detail queries (skip if no unit selected)
  const detailEn = useQuery(
    api.contentStudio.getUnitLanguageDetail,
    selectedUnit != null ? { unitNumber: selectedUnit, language: "en" } : "skip" as any
  );
  const detailDe = useQuery(
    api.contentStudio.getUnitLanguageDetail,
    selectedUnit != null ? { unitNumber: selectedUnit, language: "de" } : "skip" as any
  );

  const detail = detailLang === "de" ? detailDe : detailEn;

  // Pre-translation info (loads when translation dialog is open)
  const translatePreviewInfo = useQuery(
    api.contentStudio.getUnitTranslationPreviewEnToDe,
    translateOpen && selectedUnit != null
      ? { unitNumber: selectedUnit, sourceReleaseStatus: translateSource }
      : ("skip" as any)
  );

  // Filter logic
  const filteredUnits = useMemo(() => {
    if (!overview) return [];
    let list = [...overview];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((u) => {
        const uStr = `U${u.unitNumber} ${u.versions.en?.title ?? ""} ${u.versions.de?.title ?? ""} M${u.moduleNumber ?? ""}`.toLowerCase();
        return uStr.includes(q);
      });
    }

    // Status filter
    if (statusFilter === "published") {
      list = list.filter((u) => Object.values(u.versions).some((v: any) => v.releaseStatus === "published" && !v.isOffline));
    } else if (statusFilter === "preview") {
      list = list.filter((u) => Object.values(u.versions).some((v: any) => v.releaseStatus === "preview"));
    } else if (statusFilter === "missing_de") {
      list = list.filter((u) => {
        const de = u.versions.de;
        if (!de) return true;
        const en = u.versions.en;
        if (!en) return false;
        const hasFewSections = de.sectionCount < Math.ceil(en.sectionCount / 2);
        const hasNoTests = en.testCount > 0 && de.testCount === 0;
        return hasFewSections || hasNoTests;
      });
    } else if (statusFilter === "de_outdated") {
      list = list.filter((u) => u.deTranslationStale === true);
    }

    return list;
  }, [overview, search, statusFilter]);

  // Selected unit data from overview
  const selectedOverview = useMemo(
    () => overview?.find((u: UnitOverview) => u.unitNumber === selectedUnit) ?? null,
    [overview, selectedUnit]
  );

  // Available languages for selected unit
  const availableLangs = useMemo(() => {
    if (!selectedOverview) return [];
    return Object.keys(selectedOverview.versions).sort();
  }, [selectedOverview]);

  // Handlers
  const handlePromote = async (unitNumber: number, language: string, mode: "update" | "replace" = "update") => {
    const confirmStr = mode === "replace"
      ? `REPLACE ${language.toUpperCase()} UNIT ${unitNumber}`
      : `PUBLISH ${language.toUpperCase()} UNIT ${unitNumber}`;
    if (promoteConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setRunning(true);
    try {
      await promotePreview({ unitNumber, language, confirm: confirmStr, mode });
      const modeLabel = mode === "replace" ? "replaced (full)" : "promoted (update)";
      toast.success(`${langFlag(language)} version of Unit ${unitNumber} ${modeLabel} to published.`);
      setPromoteConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to promote preview.");
    } finally {
      setRunning(false);
    }
  };

  const handleOffline = async (unitNumber: number, language: string) => {
    const confirmStr = `OFFLINE ${language.toUpperCase()} PREVIEW UNIT ${unitNumber}`;
    if (offlineConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setRunning(true);
    try {
      await offlinePreview({ unitNumber, language, confirm: confirmStr });
      toast.success(`${langFlag(language)} preview of Unit ${unitNumber} taken offline.`);
      setOfflineConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to take preview offline.");
    } finally {
      setRunning(false);
    }
  };

  const handleSetUnitOffline = async (unitNumber: number, goOffline: boolean) => {
    const confirmStr = goOffline ? `OFFLINE UNIT ${unitNumber}` : `ONLINE UNIT ${unitNumber}`;
    if (unitOfflineConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setRunning(true);
    try {
      await setUnitOffline({ unitNumber, offline: goOffline, confirm: confirmStr });
      toast.success(
        goOffline
          ? `Unit ${unitNumber} is now offline (hidden for all users).`
          : `Unit ${unitNumber} is back online.`
      );
      setUnitOfflineConfirm("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update unit status.");
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteUnitFull = async (unitNumber: number) => {
    const confirmStr = `DELETE UNIT ${unitNumber}`;
    if (unitDeleteConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setRunning(true);
    try {
      await deleteUnitFull({ unitNumber, confirm: confirmStr });
      toast.success(`Unit ${unitNumber} has been permanently deleted.`);
      setUnitDeleteConfirm("");
      setSelectedUnit(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete unit.");
    } finally {
      setRunning(false);
    }
  };

  const handleTranslate = async () => {
    if (!selectedUnit) return;
    const confirmStr = `TRANSLATE UNIT ${selectedUnit} TO DE`;
    if (translateConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setTranslateRunning(true);
    setTranslateReport(null);
    try {
      const result = await doTranslate({
        unitNumber: selectedUnit,
        confirm: confirmStr,
        preferredProvider: translateProvider,
        sourceReleaseStatus: translateSource,
        targetReleaseStatus: "preview",
      } as any) as any;
      if (result?.translationStats) {
        setTranslateReport(result.translationStats);
      }
      toast.success(`DE translation for Unit ${selectedUnit} written to preview.`);
      setTranslateConfirm("");
      onTranslationComplete?.(selectedUnit);
    } catch (e: any) {
      toast.error(e?.message ?? "Translation failed.");
    } finally {
      setTranslateRunning(false);
    }
  };

  // Loading state
  if (!overview) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading units...</span>
      </div>
    );
  }

  const selectUnit = (unitNumber: number) => {
    if (selectedUnit === unitNumber) {
      setSelectedUnit(null);
      return;
    }
    setSelectedUnit(unitNumber);
    const u = filteredUnits.find((u) => u.unitNumber === unitNumber);
    if (u) {
      const langs = Object.keys(u.versions).sort();
      if (langs.length > 0 && !u.versions[detailLang]) {
        setDetailLang(langs[0]);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 w-[200px]"
            placeholder="Search..."
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Has published</SelectItem>
            <SelectItem value="preview">Has preview</SelectItem>
            <SelectItem value="missing_de">Missing DE</SelectItem>
            <SelectItem value="de_outdated">DE outdated</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="text-xs">{filteredUnits.length} / {overview.length}</Badge>
      </div>

      {/* Units table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-xs w-[60px]">Unit</th>
              <th className="px-3 py-2 text-left font-medium text-xs">Title</th>
              <th className="px-3 py-2 text-left font-medium text-xs w-[100px]">EN</th>
              <th className="px-3 py-2 text-left font-medium text-xs w-[140px]">DE</th>
              <th className="px-3 py-2 text-right font-medium text-xs w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUnits.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">No units match filters.</td>
              </tr>
            )}
            {filteredUnits.map((u) => {
              const isSelected = selectedUnit === u.unitNumber;
              const isRecent = recentlyTranslatedUnits?.has(u.unitNumber) ?? false;
              return (
                <Fragment key={u.unitNumber}>
                  <tr
                    className={`border-b cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                    onClick={() => selectUnit(u.unitNumber)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {isSelected
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        }
                        <span className="font-mono text-xs font-medium">U{u.unitNumber}</span>
                        {u.moduleNumber != null && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">M{u.moduleNumber}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="truncate block max-w-[300px]">
                        {u.versions.en?.title ?? u.versions.de?.title ?? `Unit ${u.unitNumber}`}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {u.versions.en
                        ? statusBadge(u.versions.en.releaseStatus, u.versions.en.isOffline)
                        : <Badge variant="outline" className="text-muted-foreground text-[10px]">missing</Badge>
                      }
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {u.versions.de
                          ? statusBadge(u.versions.de.releaseStatus, u.versions.de.isOffline)
                          : <Badge variant="outline" className="text-muted-foreground text-[10px]">missing</Badge>
                        }
                        {u.deTranslationStale && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" title="DE translation outdated" />
                        )}
                        {isRecent && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500 text-green-600">NEW</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Open in App"
                          onClick={() => window.open(`/unit/${u.unitNumber}`, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isSelected && selectedOverview && (
                    <tr className="border-b">
                      <td colSpan={5} className="p-0">
                        <InlineDetailCard
                          selectedOverview={selectedOverview}
                          detailLang={detailLang}
                          setDetailLang={setDetailLang}
                          availableLangs={availableLangs}
                          detailEn={detailEn}
                          detailDe={detailDe}
                          promoteConfirm={promoteConfirm}
                          setPromoteConfirm={setPromoteConfirm}
                          offlineConfirm={offlineConfirm}
                          setOfflineConfirm={setOfflineConfirm}
                          publishMode={publishMode}
                          setPublishMode={setPublishMode}
                          unitOfflineConfirm={unitOfflineConfirm}
                          setUnitOfflineConfirm={setUnitOfflineConfirm}
                          unitDeleteConfirm={unitDeleteConfirm}
                          setUnitDeleteConfirm={setUnitDeleteConfirm}
                          running={running}
                          onPromote={handlePromote}
                          onOffline={handleOffline}
                          onSetUnitOffline={handleSetUnitOffline}
                          onDeleteUnitFull={handleDeleteUnitFull}
                          onOpenPreview={(section) => { setInlinePreviewSection(section); setInlinePreviewOpen(true); }}
                          onOpenDiff={() => setDiffOpen(true)}
                          onOpenTranslate={(source) => { setTranslateSource(source); setTranslateConfirm(""); setTranslateOpen(true); }}
                          recentTranslationInfo={recentTranslationInfo(selectedOverview.unitNumber)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hint when no unit is selected */}
      {!selectedUnit && (
        <div className="text-center text-sm text-muted-foreground py-2">
          Click a row to expand unit details.
        </div>
      )}

      {/* Inline Preview Dialog */}
      <Dialog open={inlinePreviewOpen} onOpenChange={setInlinePreviewOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:w-[80vw] sm:max-w-[80vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {inlinePreviewSection?.contentType ?? "Preview"}{" "}
              <Badge variant="outline" className="ml-2">{langFlag(detailLang)}</Badge>
            </DialogTitle>
            <DialogDescription>
              Unit {selectedUnit} — Rendered Markdown
              {inlinePreviewSection?.tests && inlinePreviewSection.tests.length > 0 && (
                <span className="ml-2">+ {inlinePreviewSection.tests.length} test questions</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {inlinePreviewSection && (
            <ScrollArea className="max-h-[70vh]">
              <MarkdownContent content={inlinePreviewSection.content} />

              {/* Render test questions when this is the testIntroduction section */}
              {inlinePreviewSection.tests && inlinePreviewSection.tests.length > 0 && (
                <div className="mt-6 space-y-4">
                  <Separator />
                  <h3 className="text-sm font-semibold">Test Questions ({inlinePreviewSection.tests.length})</h3>
                  {(() => {
                    // Group tests by category
                    const byCategory = new Map<string, any[]>();
                    for (const t of inlinePreviewSection.tests) {
                      const cat = t.category || "uncategorized";
                      if (!byCategory.has(cat)) byCategory.set(cat, []);
                      byCategory.get(cat)!.push(t);
                    }
                    return Array.from(byCategory.entries()).map(([cat, questions]) => (
                      <div key={cat} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{cat}</Badge>
                          <span className="text-xs text-muted-foreground">{questions.length} questions</span>
                        </div>
                        <div className="space-y-2">
                          {questions.map((q: any, i: number) => (
                            <div key={q.questionId ?? i} className="rounded border p-3 text-sm space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium">{i + 1}. {q.question}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">{q.questionType}</Badge>
                              </div>
                              <div className="text-xs text-green-700 dark:text-green-400">
                                Answer: {q.correctAnswer}
                              </div>
                              {q.options && q.options.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Options: {q.options.join(" | ")}
                                </div>
                              )}
                              {q.hint && (
                                <div className="text-xs text-muted-foreground italic">
                                  Hint: {q.hint}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Translate EN → DE Dialog */}
      <Dialog open={translateOpen} onOpenChange={(open) => { setTranslateOpen(open); if (!open) { setTranslateConfirm(""); setTranslateReport(null); } }}>
        <DialogContent className="w-[95vw] max-w-[560px]">
          <DialogHeader>
            <DialogTitle>
              Translate EN → DE — Unit {selectedUnit}
            </DialogTitle>
            <DialogDescription>
              Translates the English content into German and writes it as a <strong>Preview</strong> release. Review the DE preview before publishing live.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Source + Provider selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">EN Source</label>
                <Select value={translateSource} onValueChange={(v) => setTranslateSource(v as any)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published EN</SelectItem>
                    <SelectItem value="preview">Preview EN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">AI Provider</label>
                <Select value={translateProvider} onValueChange={(v) => setTranslateProvider(v as any)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Source info */}
            <div className="rounded border bg-muted/30 p-3 text-xs space-y-1.5 min-h-[72px]">
              {translatePreviewInfo === undefined ? (
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading source info...
                </div>
              ) : !(translatePreviewInfo as any)?.sourceEn?.exists ? (
                <div className="text-destructive font-medium">
                  {(translatePreviewInfo as any)?.warnings?.[0] ?? "No eligible EN source found."}
                </div>
              ) : (
                <>
                  <div className="font-medium">
                    Source: {(translatePreviewInfo as any).sourceEn.title}
                    <Badge variant="outline" className="ml-2 text-[10px]">{translateSource}</Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Sections: {((translatePreviewInfo as any).sourceEn.contentSections ?? []).length}</span>
                    <span>Tests: {(translatePreviewInfo as any).sourceEn.tests?.count ?? 0} (v{(translatePreviewInfo as any).sourceEn.tests?.unitVersion ?? 1})</span>
                    <span>Vocab: {(translatePreviewInfo as any).sourceEn.vocabulary?.count ?? 0}</span>
                  </div>
                  {Array.isArray((translatePreviewInfo as any).warnings) && (translatePreviewInfo as any).warnings.length > 0 && (
                    <div className="space-y-0.5">
                      {(translatePreviewInfo as any).warnings.map((w: string, i: number) => (
                        <div key={i} className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          {w}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Confirm + Run */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Type <span className="font-mono text-foreground">TRANSLATE UNIT {selectedUnit} TO DE</span> to confirm:
              </label>
              <Input
                className="font-mono text-xs h-8"
                placeholder={`TRANSLATE UNIT ${selectedUnit} TO DE`}
                value={translateConfirm}
                onChange={(e) => setTranslateConfirm(e.target.value)}
                disabled={translateRunning}
              />
              <Button
                className="w-full"
                disabled={
                  translateRunning ||
                  translateConfirm !== `TRANSLATE UNIT ${selectedUnit} TO DE` ||
                  !(translatePreviewInfo as any)?.sourceEn?.exists
                }
                onClick={handleTranslate}
              >
                {translateRunning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Translating...</>
                ) : (
                  <><Languages className="mr-2 h-4 w-4" />Start Translation</>
                )}
              </Button>
            </div>

            {/* Translation Report */}
            {translateReport && (
              <div className="space-y-3 border-t pt-3">
                <div className="text-sm font-semibold">Translation Report</div>

                {/* Summary row */}
                <div className="rounded border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    <span>
                      Duration:{" "}
                      <span className="font-medium text-foreground">
                        {(translateReport.totalDurationMs / 1000).toFixed(1)}s
                      </span>
                    </span>
                    <span>
                      Steps:{" "}
                      <span className="font-medium text-foreground">{translateReport.stepCount}</span>
                    </span>
                    <span>
                      Input:{" "}
                      <span className="font-medium text-foreground">
                        {translateReport.totalInputTokens.toLocaleString()} tok
                      </span>
                    </span>
                    <span>
                      Output:{" "}
                      <span className="font-medium text-foreground">
                        {translateReport.totalOutputTokens.toLocaleString()} tok
                      </span>
                    </span>
                    {translateReport.totalThinkingTokens > 0 && (
                      <span>
                        Thinking:{" "}
                        <span className="font-medium text-blue-600">
                          {translateReport.totalThinkingTokens.toLocaleString()} tok
                        </span>
                      </span>
                    )}
                    {translateReport.totalCostUsd != null && (
                      <span>
                        Cost:{" "}
                        <span className="font-medium text-foreground">
                          ${translateReport.totalCostUsd.toFixed(4)}
                        </span>
                      </span>
                    )}
                  </div>
                  {translateReport.qualityIssueCount === 0 ? (
                    <div className="text-green-700 dark:text-green-400 font-medium">
                      No structural issues detected.
                    </div>
                  ) : (
                    <div className="text-amber-700 dark:text-amber-400 font-medium">
                      {translateReport.qualityIssueCount} structural issue(s) detected — review before publishing.
                    </div>
                  )}
                </div>

                {/* Quality issues detail */}
                {translateReport.qualityIssueCount > 0 && (
                  <div className="space-y-1.5">
                    {translateReport.steps
                      .filter((s) => s.qualityIssues.length > 0)
                      .map((s, i) => (
                        <div
                          key={i}
                          className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2 space-y-0.5"
                        >
                          <div className="font-medium text-amber-800 dark:text-amber-300 font-mono">
                            {s.step}
                          </div>
                          {s.qualityIssues.map((issue, j) => (
                            <div
                              key={j}
                              className="text-amber-700 dark:text-amber-400 flex items-start gap-1"
                            >
                              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                )}

                {/* Per-step breakdown */}
                <details className="text-xs">
                  <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground py-0.5">
                    Step breakdown ({translateReport.stepCount} steps)
                  </summary>
                  <div className="mt-2 space-y-0">
                    {translateReport.steps.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 py-1 border-b last:border-0 text-muted-foreground"
                      >
                        <span className="font-mono w-40 shrink-0 truncate text-foreground" title={s.step}>
                          {s.step}
                        </span>
                        <span className="w-12 text-right shrink-0">
                          {(s.durationMs / 1000).toFixed(1)}s
                        </span>
                        <span className="w-16 text-right shrink-0">
                          {(s.totalTokens ?? 0).toLocaleString()} tok
                        </span>
                        {s.thinkingTokens != null && s.thinkingTokens > 0 ? (
                          <span className="text-blue-600 w-20 text-right shrink-0">
                            {s.thinkingTokens.toLocaleString()} think
                          </span>
                        ) : (
                          <span className="w-20 shrink-0" />
                        )}
                        {s.qualityIssues.length > 0 && (
                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </details>

                <Button
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => { setTranslateReport(null); setTranslateOpen(false); }}
                >
                  Close Report
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* EN / DE Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="w-[98vw] max-w-[98vw] sm:w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>EN / DE Comparison — Unit {selectedUnit}</DialogTitle>
            <DialogDescription>Side-by-side rendered content for both language versions.</DialogDescription>
          </DialogHeader>
          <DiffView detailEn={detailEn} detailDe={detailDe} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InlineDetailCard — rendered inside a <td colSpan> below the selected row
// ---------------------------------------------------------------------------

interface InlineDetailCardProps {
  selectedOverview: UnitOverview;
  detailLang: string;
  setDetailLang: (lang: string) => void;
  availableLangs: string[];
  detailEn: any;
  detailDe: any;
  promoteConfirm: string;
  setPromoteConfirm: (v: string) => void;
  offlineConfirm: string;
  setOfflineConfirm: (v: string) => void;
  publishMode: "update" | "replace";
  setPublishMode: (v: "update" | "replace") => void;
  unitOfflineConfirm: string;
  setUnitOfflineConfirm: (v: string) => void;
  unitDeleteConfirm: string;
  setUnitDeleteConfirm: (v: string) => void;
  running: boolean;
  onPromote: (unitNumber: number, language: string, mode: "update" | "replace") => void;
  onOffline: (unitNumber: number, language: string) => void;
  onSetUnitOffline: (unitNumber: number, goOffline: boolean) => void;
  onDeleteUnitFull: (unitNumber: number) => void;
  onOpenPreview: (section: { contentType: string; content: string; tests?: any[] }) => void;
  onOpenDiff: () => void;
  onOpenTranslate: (source: "published" | "preview") => void;
  recentTranslationInfo: string | null;
}

function InlineDetailCard({
  selectedOverview,
  detailLang,
  setDetailLang,
  availableLangs,
  detailEn,
  detailDe,
  promoteConfirm,
  setPromoteConfirm,
  offlineConfirm,
  setOfflineConfirm,
  publishMode,
  setPublishMode,
  unitOfflineConfirm,
  setUnitOfflineConfirm,
  unitDeleteConfirm,
  setUnitDeleteConfirm,
  running,
  onPromote,
  onOffline,
  onSetUnitOffline,
  onDeleteUnitFull,
  onOpenPreview,
  onOpenDiff,
  onOpenTranslate,
  recentTranslationInfo,
}: InlineDetailCardProps) {

  return (
    <Card className="border-0 rounded-none shadow-none bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            Unit {selectedOverview.unitNumber}: {selectedOverview.versions[detailLang]?.title ?? selectedOverview.versions.en?.title ?? ""}
            {selectedOverview.moduleName && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {selectedOverview.moduleName}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {availableLangs.length >= 2 && (
              <Button variant="ghost" size="sm" onClick={onOpenDiff}>
                EN / DE Diff
              </Button>
            )}
            {selectedOverview.versions.en && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const enVersion = selectedOverview.versions.en;
                  onOpenTranslate(enVersion?.releaseStatus === "preview" ? "preview" : "published");
                }}
              >
                <Languages className="mr-1 h-3.5 w-3.5" />
                Translate EN → DE
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`/unit/${selectedOverview.unitNumber}?lang=${detailLang}`, "_blank");
              }}
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Open in App
            </Button>
          </div>
        </div>
      </CardHeader>

      {selectedOverview.deTranslationStale && (
        <div className="mx-6 mb-2 flex items-center justify-between gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            <span>EN content has been updated since the last DE translation.</span>
          </div>
          {selectedOverview.versions.en && (
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 shrink-0"
              onClick={() => {
                const enVersion = selectedOverview.versions.en;
                onOpenTranslate(enVersion?.releaseStatus === "preview" ? "preview" : "published");
              }}
            >
              <Languages className="mr-1 h-3.5 w-3.5" />
              Update DE
            </Button>
          )}
        </div>
      )}

      {recentTranslationInfo && (
        <div className="mx-6 mb-2 flex items-center gap-2 rounded border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span>DE translation completed <strong>{recentTranslationInfo}</strong></span>
        </div>
      )}

      <CardContent>
        <Tabs value={detailLang} onValueChange={(v) => setDetailLang(v)}>
          <TabsList className="mb-4">
            {availableLangs.map((lang) => (
              <TabsTrigger key={lang} value={lang} className="gap-1.5">
                {langFlag(lang)}
                {selectedOverview.versions[lang] && (
                  <span className="ml-1">
                    {statusBadge(
                      selectedOverview.versions[lang].releaseStatus,
                      selectedOverview.versions[lang].isOffline
                    )}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {availableLangs.map((lang) => {
            const langDetail = lang === "de" ? detailDe : detailEn;
            const langVersion = selectedOverview.versions[lang];
            if (!langVersion) return null;

            return (
              <TabsContent key={lang} value={lang} className="mt-0">
                <div className="flex items-center justify-between rounded border p-3 mb-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="font-medium">{langVersion.title}</div>
                      {langVersion.description && (
                        <div className="text-sm text-muted-foreground">{langVersion.description}</div>
                      )}
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{langVersion.sectionCount} sections</span>
                      <span>{langVersion.testCount} tests</span>
                      <span>{langVersion.vocabCount} vocab</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(langVersion.releaseStatus, langVersion.isOffline)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`/unit/${selectedOverview.unitNumber}?lang=${lang}`, "_blank");
                      }}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </div>
                </div>

                {langDetail ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Content Sections</h4>
                      {langDetail.sections.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No content sections.</div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {langDetail.sections.map((s: any) => (
                            <div
                              key={s.contentType}
                              className="flex flex-col items-center justify-center rounded border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => {
                                onOpenPreview({
                                  ...s,
                                  tests: s.contentType === "testIntroduction" ? langDetail.tests : undefined,
                                });
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                              <span className="font-mono text-xs">{s.contentType}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {s.content.length.toLocaleString()} chars
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Tests</h4>
                        {langDetail.testCategories && langDetail.testCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {langDetail.testCategories.map((tc: any) => (
                              <Badge key={tc.category} variant="outline" className="text-xs">
                                {tc.category}: {tc.count}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No tests.</div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Vocabulary</h4>
                        <div className="text-sm text-muted-foreground">
                          {langDetail.vocabulary.length} words
                          {langDetail.vocabulary.length > 0 && (
                            <span className="ml-1">
                              (e.g. {langDetail.vocabulary.slice(0, 3).map((v: any) => v.serbian).join(", ")}
                              {langDetail.vocabulary.length > 3 ? "..." : ""})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {langVersion.releaseStatus !== "preview" && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          {langVersion.isOffline ? (
                            <div className="rounded border border-green-500/40 bg-green-500/5 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Wifi className="h-4 w-4 text-green-600" />
                                  Unit wieder online schalten
                                </div>
                                <Badge className="bg-green-600/80 hover:bg-green-600 text-white text-[10px]">Reversibel</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Unit {selectedOverview.unitNumber} ist derzeit <strong>offline</strong> und fuer Nutzer nicht sichtbar. Alle Daten sind intakt.
                                Dieses Schalten gilt fuer <strong>alle Sprachversionen</strong> der Unit.
                              </p>
                              <Input
                                placeholder={`Eingabe: ONLINE UNIT ${selectedOverview.unitNumber}`}
                                value={unitOfflineConfirm}
                                onChange={(e) => setUnitOfflineConfirm(e.target.value)}
                                className="font-mono text-xs h-8"
                              />
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={running || unitOfflineConfirm !== `ONLINE UNIT ${selectedOverview.unitNumber}`}
                                onClick={() => onSetUnitOffline(selectedOverview.unitNumber, false)}
                              >
                                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1 h-3.5 w-3.5" />}
                                Online schalten
                              </Button>
                            </div>
                          ) : (
                            <div className="rounded border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <WifiOff className="h-4 w-4 text-amber-600" />
                                  Unit offline schalten
                                </div>
                                <Badge className="bg-amber-500/80 hover:bg-amber-500 text-white text-[10px]">Reversibel</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Die Unit wird fuer alle Nutzer ausgeblendet. Alle Daten bleiben erhalten und der Schritt ist jederzeit rueckgaengig zu machen.
                                Dieses Schalten gilt fuer <strong>alle Sprachversionen</strong> der Unit.
                              </p>
                              <Input
                                placeholder={`Eingabe: OFFLINE UNIT ${selectedOverview.unitNumber}`}
                                value={unitOfflineConfirm}
                                onChange={(e) => setUnitOfflineConfirm(e.target.value)}
                                className="font-mono text-xs h-8"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-500/60 text-amber-700 hover:bg-amber-500/10"
                                disabled={running || unitOfflineConfirm !== `OFFLINE UNIT ${selectedOverview.unitNumber}`}
                                onClick={() => onSetUnitOffline(selectedOverview.unitNumber, true)}
                              >
                                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
                                Offline schalten
                              </Button>
                            </div>
                          )}

                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="danger-delete" className="border-destructive/40">
                              <AccordionTrigger className="text-sm font-medium text-destructive hover:text-destructive px-4 py-3 rounded-t border border-destructive/30 bg-destructive/5 hover:no-underline hover:bg-destructive/10">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4" />
                                  Danger Zone — Unit vollstaendig loeschen
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="border border-t-0 border-destructive/30 bg-destructive/5 rounded-b px-4 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="destructive" className="text-[10px]">Nicht rueckgaengig zu machen</Badge>
                                  </div>
                                  <p className="text-xs text-destructive font-medium">
                                    Loescht alle Inhalte, Vokabeln, Tests UND den User-Fortschritt aller Nutzer dieser Unit unwiderruflich. Drafts bleiben erhalten.
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Empfehlung: Unit zuerst offline schalten, bevor sie geloescht wird. Diese Aktion kann nicht rueckgaengig gemacht werden.
                                  </p>
                                  <Input
                                    placeholder={`Eingabe: DELETE UNIT ${selectedOverview.unitNumber}`}
                                    value={unitDeleteConfirm}
                                    onChange={(e) => setUnitDeleteConfirm(e.target.value)}
                                    className="font-mono text-xs h-8 border-destructive/40 focus-visible:ring-destructive/40"
                                  />
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={running || unitDeleteConfirm !== `DELETE UNIT ${selectedOverview.unitNumber}`}
                                    onClick={() => onDeleteUnitFull(selectedOverview.unitNumber)}
                                  >
                                    {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                    Unit vollstaendig loeschen
                                  </Button>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </>
                    )}

                    {langVersion.releaseStatus === "preview" && (() => {
                      const confirmStr = publishMode === "replace"
                        ? `REPLACE ${lang.toUpperCase()} UNIT ${selectedOverview.unitNumber}`
                        : `PUBLISH ${lang.toUpperCase()} UNIT ${selectedOverview.unitNumber}`;
                      return (
                        <>
                          <Separator />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <ArrowUpCircle className="h-4 w-4 text-amber-600" />
                                Publish {langFlag(lang)} Preview
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Publish Mode</label>
                                <Select value={publishMode} onValueChange={(v) => { setPublishMode(v as any); setPromoteConfirm(""); }}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="update">Update (merge) — keeps user progress</SelectItem>
                                    <SelectItem value="replace">Replace (full) — resets user progress</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {publishMode === "replace" && (
                                <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded p-2">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                  <span>Replace mode will archive old content and <strong>reset all user progress</strong> (XP, mastery) for this unit.</span>
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">
                                {publishMode === "update"
                                  ? "Promotes this preview to published. Existing user progress is preserved."
                                  : "Replaces all published content with this preview. User progress will be reset."
                                }
                              </p>
                              <Input
                                placeholder={`Type: ${confirmStr}`}
                                value={promoteConfirm}
                                onChange={(e) => setPromoteConfirm(e.target.value)}
                                className="font-mono text-xs h-8"
                              />
                              <Button
                                size="sm"
                                disabled={running || promoteConfirm !== confirmStr}
                                onClick={() => onPromote(selectedOverview.unitNumber, lang, publishMode)}
                              >
                                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />}
                                {publishMode === "replace" ? "Replace & Publish" : "Publish"}
                              </Button>
                            </div>

                            <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <XCircle className="h-4 w-4 text-destructive" />
                                Take {langFlag(lang)} Preview Offline
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Removes this preview. The content will no longer be visible.
                              </p>
                              <Input
                                placeholder={`Type: OFFLINE ${lang.toUpperCase()} PREVIEW UNIT ${selectedOverview.unitNumber}`}
                                value={offlineConfirm}
                                onChange={(e) => setOfflineConfirm(e.target.value)}
                                className="font-mono text-xs h-8"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={
                                  running ||
                                  offlineConfirm !==
                                    `OFFLINE ${lang.toUpperCase()} PREVIEW UNIT ${selectedOverview.unitNumber}`
                                }
                                onClick={() => onOffline(selectedOverview.unitNumber, lang)}
                              >
                                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                                Take Offline
                              </Button>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading detail...
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Diff sub-component (side-by-side rendered markdown)
// ---------------------------------------------------------------------------
function DiffView({
  detailEn,
  detailDe,
}: {
  detailEn: any;
  detailDe: any;
}) {
  const [sectionType, setSectionType] = useState<string>("overview");

  // Collect all section types from both, plus synthetic "tests" and "vocabulary" tabs.
  const sectionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const s of detailEn?.sections ?? []) set.add(s.contentType);
    for (const s of detailDe?.sections ?? []) set.add(s.contentType);
    const order = ["overview", "grammar", "phrases", "dialogues", "vocabulary", "testIntroduction"];
    const sorted = Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    // Add synthetic tabs for tests and vocabulary data
    const hasTests = (detailEn?.tests?.length ?? 0) > 0 || (detailDe?.tests?.length ?? 0) > 0;
    const hasVocab = (detailEn?.vocabulary?.length ?? 0) > 0 || (detailDe?.vocabulary?.length ?? 0) > 0;
    if (hasTests) sorted.push("__tests__");
    if (hasVocab) sorted.push("__vocabulary__");
    return sorted;
  }, [detailEn, detailDe]);

  const enSection = detailEn?.sections?.find((s: any) => s.contentType === sectionType);
  const deSection = detailDe?.sections?.find((s: any) => s.contentType === sectionType);

  if (!detailEn && !detailDe) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading content...
      </div>
    );
  }

  // Synthetic tab: Tests side-by-side
  if (sectionType === "__tests__") {
    const enTests: any[] = detailEn?.tests ?? [];
    const deTests: any[] = detailDe?.tests ?? [];
    return (
      <div className="flex flex-col gap-3">
        <DiffTabBar sectionTypes={sectionTypes} current={sectionType} onChange={setSectionType} />
        <div className="grid grid-cols-2 gap-4">
          <DiffTestColumn label="EN" tests={enTests} />
          <DiffTestColumn label="DE" tests={deTests} />
        </div>
      </div>
    );
  }

  // Synthetic tab: Vocabulary side-by-side
  if (sectionType === "__vocabulary__") {
    const enVocab: any[] = detailEn?.vocabulary ?? [];
    const deVocab: any[] = detailDe?.vocabulary ?? [];
    return (
      <div className="flex flex-col gap-3">
        <DiffTabBar sectionTypes={sectionTypes} current={sectionType} onChange={setSectionType} />
        <div className="grid grid-cols-2 gap-4">
          <DiffVocabColumn label="EN" vocabulary={enVocab} />
          <DiffVocabColumn label="DE" vocabulary={deVocab} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <DiffTabBar sectionTypes={sectionTypes} current={sectionType} onChange={setSectionType} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge>EN</Badge>
            <span className="text-xs text-muted-foreground">
              {enSection ? `${enSection.content.length.toLocaleString()} chars` : "not available"}
            </span>
          </div>
          <div className="rounded border p-3">
            {enSection ? (
              <MarkdownContent content={enSection.content} />
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No EN content for this section.
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">DE</Badge>
            <span className="text-xs text-muted-foreground">
              {deSection ? `${deSection.content.length.toLocaleString()} chars` : "not available"}
            </span>
          </div>
          <div className="rounded border p-3">
            {deSection ? (
              <MarkdownContent content={deSection.content} />
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No DE content for this section.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffView sub-components
// ---------------------------------------------------------------------------

/** Shared tab bar for the DiffView */
function DiffTabBar({ sectionTypes, current, onChange }: { sectionTypes: string[]; current: string; onChange: (v: string) => void }) {
  const label = (st: string) => {
    if (st === "__tests__") return "Tests";
    if (st === "__vocabulary__") return "Vocabulary";
    return st;
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {sectionTypes.map((st) => (
        <Button
          key={st}
          variant={current === st ? "default" : "outline"}
          size="sm"
          className="text-xs h-7"
          onClick={() => onChange(st)}
        >
          {label(st)}
        </Button>
      ))}
    </div>
  );
}

/** Renders a column of test questions for the DiffView */
function DiffTestColumn({ label, tests }: { label: string; tests: any[] }) {
  // Group by category
  const byCategory = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tests) {
      const cat = t.category || "uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return map;
  }, [tests]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={label === "EN" ? "default" : "secondary"}>{label}</Badge>
        <span className="text-xs text-muted-foreground">{tests.length} questions</span>
      </div>
      <div className="rounded border p-3">
        {tests.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No {label} tests available.
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(byCategory.entries()).map(([cat, questions]) => (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{cat}</Badge>
                  <span className="text-xs text-muted-foreground">{questions.length} questions</span>
                </div>
                <div className="space-y-2">
                  {questions.map((q: any, i: number) => (
                    <div key={q.questionId ?? i} className="rounded border p-2.5 text-sm space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-xs">{i + 1}. {q.question}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{q.questionType}</Badge>
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-400">
                        Answer: {q.correctAnswer}
                      </div>
                      {q.options && q.options.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Options: {q.options.join(" | ")}
                        </div>
                      )}
                      {q.hint && (
                        <div className="text-xs text-muted-foreground italic">Hint: {q.hint}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a column of vocabulary for the DiffView */
function DiffVocabColumn({ label, vocabulary }: { label: string; vocabulary: any[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant={label === "EN" ? "default" : "secondary"}>{label}</Badge>
        <span className="text-xs text-muted-foreground">{vocabulary.length} words</span>
      </div>
      <div className="rounded border p-3">
        {vocabulary.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No {label} vocabulary available.
          </div>
        ) : (
          <div className="space-y-1">
            {vocabulary.map((v: any, i: number) => (
              <div key={v.serbian ?? i} className="flex items-baseline gap-2 text-sm py-0.5 border-b border-muted/50 last:border-0">
                <span className="font-medium">{v.serbian}</span>
                <span className="text-muted-foreground">{v.translation}</span>
                {v.alternatives && <span className="text-xs text-muted-foreground italic">({v.alternatives})</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
