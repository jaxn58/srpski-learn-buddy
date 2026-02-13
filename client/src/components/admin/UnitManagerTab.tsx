import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
// Table imports removed — unit selection is now a dropdown
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
import { Search, ExternalLink, Eye, ArrowUpCircle, XCircle, Loader2 } from "lucide-react";

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
}

interface UnitOverview {
  unitNumber: number;
  moduleName?: string;
  moduleNumber?: number;
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
export function UnitManagerTab() {
  const overview = useQuery(api.contentStudio.getUnitManagementOverview);
  const promotePreview = useMutation(api.contentStudio.promoteLanguagePreviewToPublished);
  const offlinePreview = useMutation(api.contentStudio.takeLanguagePreviewOffline);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "preview" | "missing_de">("all");
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);
  const [detailLang, setDetailLang] = useState<string>("en");
  const [inlinePreviewOpen, setInlinePreviewOpen] = useState(false);
  const [inlinePreviewSection, setInlinePreviewSection] = useState<{ contentType: string; content: string; tests?: any[] } | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const [promoteConfirm, setPromoteConfirm] = useState("");
  const [offlineConfirm, setOfflineConfirm] = useState("");
  const [running, setRunning] = useState(false);

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
      // "Missing DE" = no DE version, or DE version has significantly less content than EN
      // (catches old legacy DE metadata/content that doesn't represent a real translation)
      list = list.filter((u) => {
        const de = u.versions.de;
        if (!de) return true; // no DE at all
        const en = u.versions.en;
        if (!en) return false; // no EN to compare — not "missing DE"
        // DE exists but is incomplete: fewer than half of EN sections, or 0 tests while EN has some
        const hasFewSections = de.sectionCount < Math.ceil(en.sectionCount / 2);
        const hasNoTests = en.testCount > 0 && de.testCount === 0;
        return hasFewSections || hasNoTests;
      });
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
  const handlePromote = async (unitNumber: number, language: string) => {
    const confirmStr = `PUBLISH ${language.toUpperCase()} UNIT ${unitNumber}`;
    if (promoteConfirm !== confirmStr) {
      toast.error(`Please type "${confirmStr}" to confirm.`);
      return;
    }
    setRunning(true);
    try {
      await promotePreview({ unitNumber, language, confirm: confirmStr });
      toast.success(`${langFlag(language)} version of Unit ${unitNumber} promoted to published.`);
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

  // Loading state
  if (!overview) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading units...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact header: Unit dropdown + search + filter in one row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Unit Dropdown */}
        <Select
          value={selectedUnit != null ? String(selectedUnit) : ""}
          onValueChange={(v) => {
            const n = Number(v);
            setSelectedUnit(n);
            const u = filteredUnits.find((u) => u.unitNumber === n);
            if (u) {
              const langs = Object.keys(u.versions).sort();
              if (langs.length > 0 && !u.versions[detailLang]) {
                setDetailLang(langs[0]);
              }
            }
          }}
        >
          <SelectTrigger className="w-[320px] h-9">
            <SelectValue placeholder="Select unit..." />
          </SelectTrigger>
          <SelectContent className="max-h-[360px]">
            {filteredUnits.map((u) => (
              <SelectItem key={u.unitNumber} value={String(u.unitNumber)}>
                <span className="font-mono text-xs mr-1.5">U{u.unitNumber}</span>
                <span className="truncate">{u.versions.en?.title ?? u.versions.de?.title ?? `Unit ${u.unitNumber}`}</span>
                {u.moduleNumber != null && (
                  <span className="ml-1.5 text-xs text-muted-foreground">M{u.moduleNumber}</span>
                )}
              </SelectItem>
            ))}
            {filteredUnits.length === 0 && (
              <div className="py-3 text-center text-sm text-muted-foreground">No units match filters.</div>
            )}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 w-[200px]"
            placeholder="Search..."
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Has published</SelectItem>
            <SelectItem value="preview">Has preview</SelectItem>
            <SelectItem value="missing_de">Missing DE</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="text-xs">{filteredUnits.length} / {overview.length}</Badge>

        {/* Quick status indicators for selected unit */}
        {selectedOverview && (
          <div className="flex items-center gap-2 ml-auto">
            {Object.entries(selectedOverview.versions).map(([lang, v]) => (
              <div key={lang} className="flex items-center gap-1">
                <span className="text-xs font-medium">{lang.toUpperCase()}:</span>
                {statusBadge((v as LangVersion).releaseStatus, (v as LangVersion).isOffline)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-width detail panel */}
      {!selectedOverview ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a unit from the dropdown to view details.
          </CardContent>
        </Card>
      ) : (
        <Card>
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
                  <Button variant="ghost" size="sm" onClick={() => setDiffOpen(true)}>
                    EN / DE Diff
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const langParam = detailLang !== "en" ? `?lang=${detailLang}` : "";
                    window.open(`/unit/${selectedOverview.unitNumber}${langParam}`, "_blank");
                  }}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Open in App
                </Button>
              </div>
            </div>
          </CardHeader>

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
                    {/* Stats + Actions row */}
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
                            const langParam = lang !== "en" ? `?lang=${lang}` : "";
                            window.open(`/unit/${selectedOverview.unitNumber}${langParam}`, "_blank");
                          }}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Preview
                        </Button>
                      </div>
                    </div>

                    {/* Content */}
                    {langDetail ? (
                      <div className="space-y-4">
                        {/* Content Sections - horizontal layout */}
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
                                    setInlinePreviewSection({
                                      ...s,
                                      tests: s.contentType === "testIntroduction" ? langDetail.tests : undefined,
                                    });
                                    setInlinePreviewOpen(true);
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

                        {/* Tests + Vocab in a row */}
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

                        {/* Actions for published units */}
                        {langVersion.releaseStatus !== "preview" && (
                          <>
                            <Separator />
                            <div className="rounded border border-muted p-3">
                              <p className="text-xs text-muted-foreground">
                                This {langFlag(lang)} version is <strong>published</strong>. Offline/unpublish actions for published units are not yet implemented. Use "Open in App" to verify content.
                              </p>
                            </div>
                          </>
                        )}

                        {/* Promote / Offline actions (only for preview status) */}
                        {langVersion.releaseStatus === "preview" && (
                          <>
                            <Separator />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Promote Preview -> Published */}
                              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <ArrowUpCircle className="h-4 w-4 text-amber-600" />
                                  Publish {langFlag(lang)} Preview
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Promotes this preview to published. Users will see this content.
                                </p>
                                <Input
                                  placeholder={`Type: PUBLISH ${lang.toUpperCase()} UNIT ${selectedOverview.unitNumber}`}
                                  value={promoteConfirm}
                                  onChange={(e) => setPromoteConfirm(e.target.value)}
                                  className="font-mono text-xs h-8"
                                />
                                <Button
                                  size="sm"
                                  disabled={
                                    running ||
                                    promoteConfirm !== `PUBLISH ${lang.toUpperCase()} UNIT ${selectedOverview.unitNumber}`
                                  }
                                  onClick={() => handlePromote(selectedOverview.unitNumber, lang)}
                                >
                                  {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />}
                                  Publish
                                </Button>
                              </div>

                              {/* Take Preview Offline */}
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
                                  onClick={() => handleOffline(selectedOverview.unitNumber, lang)}
                                >
                                  {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                                  Take Offline
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
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

      {/* EN / DE Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="w-[98vw] max-w-[98vw] sm:w-[95vw] sm:max-w-[95vw] max-h-[90vh] overflow-hidden">
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

  // Collect all section types from both.
  const sectionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const s of detailEn?.sections ?? []) set.add(s.contentType);
    for (const s of detailDe?.sections ?? []) set.add(s.contentType);
    const order = ["overview", "grammar", "phrases", "dialogues", "vocabulary", "testIntroduction"];
    return Array.from(set).sort((a, b) => order.indexOf(a) - order.indexOf(b));
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

  return (
    <div className="flex flex-col gap-3 h-[75vh]">
      <div className="flex flex-wrap gap-1.5">
        {sectionTypes.map((st) => (
          <Button
            key={st}
            variant={sectionType === st ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setSectionType(st)}
          >
            {st}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge>EN</Badge>
            <span className="text-xs text-muted-foreground">
              {enSection ? `${enSection.content.length.toLocaleString()} chars` : "not available"}
            </span>
          </div>
          <ScrollArea className="flex-1 rounded border p-3">
            {enSection ? (
              <MarkdownContent content={enSection.content} />
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No EN content for this section.
              </div>
            )}
          </ScrollArea>
        </div>
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">DE</Badge>
            <span className="text-xs text-muted-foreground">
              {deSection ? `${deSection.content.length.toLocaleString()} chars` : "not available"}
            </span>
          </div>
          <ScrollArea className="flex-1 rounded border p-3">
            {deSection ? (
              <MarkdownContent content={deSection.content} />
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No DE content for this section.
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
