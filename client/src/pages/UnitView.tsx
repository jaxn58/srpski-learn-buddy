import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, CheckCircle2, Brain, Lightbulb, Lock, Star, MessageSquare, Mic, PenTool, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Link, useParams } from "wouter";
import { MarkdownContent } from "@/components/MarkdownContent";
import { UnitContentAudioMarkdown } from "@/components/UnitContentAudioMarkdown";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { InteractiveTest } from "@/components/InteractiveTest";
import { VocabularyDictionaryTable, type VocabularyDictionaryRow } from "@/components/vocabulary/VocabularyDictionaryTable";
import { useVocabularyAudioPlayback } from "@/hooks/useVocabularyAudioPlayback";
import { useBuddyModal } from "@/contexts/BuddyModalContext";

type VocabularyGroup = {
  title: string;
  // Normalized Serbian keys (trimmed/lowercased, spaces collapsed)
  serbianKeys: string[];
};

function normalizeProgressionFormattingInOverview(markdown: string): string {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let inProgression = false;
  let deindentNestedBullets = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Detect start of Progression block
    if (/^####\s+Progression\s*$/i.test(line.trim())) {
      inProgression = true;
      deindentNestedBullets = false;
      out.push(line);
      continue;
    }

    // Stop at the horizontal rule that usually ends the overview section
    if (inProgression && /^-{3,}\s*$/.test(line.trim())) {
      inProgression = false;
      deindentNestedBullets = false;
      out.push(line);
      continue;
    }

    if (!inProgression) {
      out.push(line);
      continue;
    }

    // Promote progression sub-sections to a consistent sub-heading hierarchy:
    // - "Prerequisites ..." and "New in this Unit" should look like siblings under "Progression".
    const prereqMatch = line.trim().match(/^\*\*Prerequisites\s*\(Known from earlier units\):\*\*\s*$/i);
    if (prereqMatch) {
      out.push("##### Prerequisites (Known from earlier units)");
      continue;
    }

    const newInMatch = line.trim().match(/^\*\*New in this Unit:\*\*\s*$/i);
    if (newInMatch) {
      out.push("##### New in this Unit");
      continue;
    }

    // Convert "- **New Vocabulary:**" / "- **New Grammar:**" into a paragraph-style label
    const newBlockMatch = line.match(/^\s*-\s+\*\*(New (Vocabulary|Grammar)):\*\*\s*$/i);
    if (newBlockMatch?.[1]) {
      const label = newBlockMatch[1];
      out.push(`**${label}:**`);
      deindentNestedBullets = true;
      continue;
    }

    // De-indent nested bullets so they become a clean list under the label
    if (deindentNestedBullets && /^\s{2}-\s+/.test(line)) {
      out.push(line.slice(2));
      continue;
    }

    // Reset de-indent mode when we leave the nested list area (blank lines are fine)
    if (deindentNestedBullets && line.trim() !== "" && !/^\s{2}-\s+/.test(line)) {
      deindentNestedBullets = false;
    }

    out.push(line);
  }

  // Avoid excessive blank lines after transformations
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function formatOverviewForDisplay(markdown: string): string {
  // Remove "## 1. Overview" header stored in DB, then normalize progression visuals.
  const base = String(markdown || "").replace(/^##\s+[^\n]+\n+/, "");
  return normalizeProgressionFormattingInOverview(base);
}

function normalizeSerbianKey(input: string): string {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractVocabularyGroupsFromMarkdown(markdown: string): VocabularyGroup[] {
  // Normalize CRLF -> LF so regex boundaries behave consistently.
  const md = String(markdown || "").replace(/\r\n/g, "\n");
  if (!md.trim()) return [];

  // Grab "## 2. ..." section only (language-agnostic).
  // IMPORTANT: Don't use multiline `$` here (it matches end-of-line). We want end-of-string.
  // This must work for translated headings (e.g., "Vokabeln") too.
  const match = md.match(/##\s+2\.\s+[^\n]*\n[\s\S]+?(?=\n##\s+\d+\.|$)/);
  if (!match) return [];
  const section = match[0];

  const groups: VocabularyGroup[] = [];

  // Find each subsection heading ("### Title") and slice until the next heading.
  // Avoid using multiline `$` in lookaheads (it matches end-of-line and can truncate bodies).
  const headingRe = /^###\s+(.+?)\s*$/gm;
  const headings: Array<{ title: string; index: number; afterIndex: number }> = [];
  let hm: RegExpExecArray | null = null;
  while ((hm = headingRe.exec(section)) !== null) {
    const title = String(hm[1] || "").trim();
    if (!title) continue;
    headings.push({ title, index: hm.index, afterIndex: hm.index + hm[0].length });
  }
  for (let hIdx = 0; hIdx < headings.length; hIdx++) {
    const title = headings[hIdx].title;
    const bodyStart = headings[hIdx].afterIndex;
    const bodyEnd = headings[hIdx + 1]?.index ?? section.length;
    const body = section.slice(bodyStart, bodyEnd);

    const lines = body.split(/\r?\n/);
    const firstTableLineIdx = lines.findIndex((l) => l.trim().startsWith("|"));
    if (firstTableLineIdx < 0) continue;

    // Collect contiguous table lines
    const tableLines: string[] = [];
    for (let i = firstTableLineIdx; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim().startsWith("|")) break;
      tableLines.push(line);
    }
    if (tableLines.length < 3) continue; // header + separator + at least one row

    const parseRow = (line: string): string[] => {
      const raw = line.trim();
      const trimmed = raw.startsWith("|") ? raw.slice(1) : raw;
      const trimmed2 = trimmed.endsWith("|") ? trimmed.slice(0, -1) : trimmed;
      return trimmed2.split("|").map((c) => c.trim());
    };

    const headers = parseRow(tableLines[0]).map((h) => h.toLowerCase());
    // Accept translated header labels too ("Serbisch", "Srpski", etc.).
    const serbianIdx = headers.findIndex(
      (h) => h.includes("serbian") || h.includes("serbisch") || h.includes("srpski") || h.includes("srp")
    );
    if (serbianIdx < 0) continue;

    const serbianKeys: string[] = [];
    const seenKeys = new Set<string>();
    for (let i = 2; i < tableLines.length; i++) {
      const cells = parseRow(tableLines[i]);
      const serbianCell = cells[serbianIdx] ?? "";
      const key = normalizeSerbianKey(serbianCell);
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        serbianKeys.push(key);
      }
    }

    if (serbianKeys.length === 0) continue;
    groups.push({ title, serbianKeys });
  }

  return groups;
}

export default function UnitView() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const params = useParams();
  const unitNumber = parseInt(params.unitNumber || "1");
  const { openBuddyModal } = useBuddyModal();
  
  // Use user's learning language or fallback.
  // ContentStudio Preview convenience: allow forcing language via URL, e.g. /unit/1?lang=de
  const forcedLanguage = React.useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const p = new URLSearchParams(window.location.search);
      const l = String(p.get("lang") || "").trim().toLowerCase();
      if (!l) return null;
      const allowed = new Set(["en", "de", "sr", "es", "fr"]);
      return allowed.has(l) ? l : null;
    } catch {
      return null;
    }
  }, []);
  const displayLanguage = forcedLanguage || user?.learningLanguage || (i18n.language === "de" ? "de" : "en");

  // ContentStudio Preview toggle:
  //   /unit/3?view=published  -> superadmin sees the LIVE (published) content
  //   default (no param)      -> superadmin sees preview when an active preview exists
  //
  // Non-superadmins ignore this flag — they always get the published release
  // (the backend enforces that; the flag is purely a UI-level override for
  // authoring in Content Studio).
  //
  // Kept as `useState` so the "Show live" / "Back to preview" toggle can
  // update the URL and re-render without a full page reload.
  const [preferPublished, setPreferPublished] = React.useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      const p = new URLSearchParams(window.location.search);
      return String(p.get("view") || "").trim().toLowerCase() === "published";
    } catch {
      return false;
    }
  });

  const setPreviewView = React.useCallback((mode: "preview" | "published") => {
    try {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (mode === "published") {
        url.searchParams.set("view", "published");
      } else {
        url.searchParams.delete("view");
      }
      window.history.replaceState(null, "", url.toString());
    } catch {
      // no-op — URL update is a nicety, not required for the query switch.
    }
    setPreferPublished(mode === "published");
  }, []);

  // Load Unit Metadata & Content from DB
  const unitMetadata = useQuery(api.units.getUnitMetadata, {
    unitNumber,
    language: displayLanguage,
    preferPublished,
  });
  const content = useQuery(api.units.getUnitContentSections, {
    unitNumber,
    language: displayLanguage,
    preferPublished,
  });
  const vocabularyWithProgress = useQuery(api.vocabulary.getVocabularyWithProgress, {
    unitNumber,
    preferPublished,
  });
  const previewOverlay = useQuery(
    api.units.getUnitPreviewOverlayInfo,
    user?.role === "superadmin" ? { unitNumber } : "skip",
  );

  const { play, playingAudioId, loadingAudioId } = useVocabularyAudioPlayback();

  const vocabularyRows: VocabularyDictionaryRow[] = React.useMemo(() => {
    if (!vocabularyWithProgress || vocabularyWithProgress.length === 0) return [];

    const getNoteForLanguage = (word: any, language: string): string | null => {
      if (!word) return null;
      if (language === "de") return word.noteDe || word.noteEn || null;
      if (language === "sr") return word.noteSr || word.noteEn || null;
      if (language === "es") return word.noteEs || word.noteEn || null;
      if (language === "fr") return word.noteFr || word.noteEn || null;
      return word.noteEn || null;
    };

    const getTranslationForLanguage = (word: any, language: string): string => {
      const pick = (key: "en" | "de" | "sr" | "es" | "fr") => {
        const val = word[key];
        return val && String(val).trim() ? String(val).trim() : "";
      };

      const translation =
        language === "de"
          ? pick("de") || pick("en")
          : language === "sr"
            ? pick("sr") || pick("en")
            : language === "es"
              ? pick("es") || pick("en")
              : language === "fr"
                ? pick("fr") || pick("en")
                : pick("en") || pick("de");

      return translation || "-";
    };

    return vocabularyWithProgress.map((word: any, idx: number) => {
      const translation = getTranslationForLanguage(word, displayLanguage);
      const note = getNoteForLanguage(word, displayLanguage);

      const correctCount = Number(word.progress?.correctAnswerCount ?? 0) || 0;
      const incorrectCount = Number(word.progress?.incorrectAnswerCount ?? 0) || 0;
      const mastered = Boolean(word.progress?.mastered) || correctCount >= 3;

      return {
        id: String(word._id ?? idx),
        serbian: word.serbian,
        translation,
        note,
        audioStorageId: word.audioStorageId ?? null,
        unitNumber: word.unitNumber ?? unitNumber,
        mastery: { correctCount, incorrectCount, mastered },
      } satisfies VocabularyDictionaryRow;
    });
  }, [vocabularyWithProgress, displayLanguage, unitNumber]);

  const vocabularyGroupsForUnitView = React.useMemo(() => {
    const md = content?.vocabulary;
    const groups = md ? extractVocabularyGroupsFromMarkdown(md) : [];
    if (!groups.length || vocabularyRows.length === 0) {
      return { hasGroups: false as const, groups: [] as Array<{ title: string; rows: VocabularyDictionaryRow[] }> };
    }

    const rowByKey = new Map<string, VocabularyDictionaryRow>();
    for (const row of vocabularyRows) {
      rowByKey.set(normalizeSerbianKey(row.serbian), row);
    }

    const usedKeys = new Set<string>();
    const grouped = groups
      .map((g) => {
        const rows = g.serbianKeys
          .map((k) => rowByKey.get(k))
          .filter((r): r is VocabularyDictionaryRow => Boolean(r));
        for (const k of g.serbianKeys) usedKeys.add(k);
        return { title: g.title, rows };
      })
      .filter((g) => g.rows.length > 0);

    // Only switch to grouped view if we have at least 2 groups with content.
    if (grouped.length < 2) {
      return { hasGroups: false as const, groups: [] as Array<{ title: string; rows: VocabularyDictionaryRow[] }> };
    }

    // Any remaining words (not present in markdown tables) go to "Other".
    const remaining: VocabularyDictionaryRow[] = vocabularyRows.filter(
      (r) => !usedKeys.has(normalizeSerbianKey(r.serbian))
    );
    if (remaining.length > 0) {
      grouped.push({ title: "Other", rows: remaining });
    }

    return { hasGroups: true as const, groups: grouped };
  }, [content?.vocabulary, vocabularyRows]);

  // Determine Module from unitMetadata
  const moduleSlug = unitMetadata?.moduleId;
  
  // Try to get module by slug (new consolidated structure)
  const moduleMetadata = useQuery(api.modules.getModuleBySlug, 
    moduleSlug ? { slug: moduleSlug } : "skip"
  );
  
  // Fallback: Try old getModuleMetadata if new structure doesn't exist
  const oldModuleMetadata = useQuery(api.modules.getModuleMetadata,
    moduleSlug && !moduleMetadata ? { moduleId: moduleSlug, language: displayLanguage } : "skip"
  );

  const moduleTitle = React.useMemo(() => {
    if (!moduleSlug) {
      return undefined;
    }

    const sanitizeTitle = (rawTitle: string) => {
      const parenthesesMatch = rawTitle.match(/\(([^)]+)\)/);
      if (parenthesesMatch?.[1]) {
        return parenthesesMatch[1].trim();
      }
      return rawTitle.trim();
    };

    // Use new consolidated structure if available
    if (moduleMetadata) {
      const title = displayLanguage === "de" ? moduleMetadata.titleDe : moduleMetadata.titleEn;
      if (title) {
        return sanitizeTitle(title);
      }
    }

    // Fallback to old structure
    if (oldModuleMetadata?.title) {
      return sanitizeTitle(oldModuleMetadata.title);
    }

    return undefined;
  }, [moduleSlug, moduleMetadata, oldModuleMetadata, displayLanguage]);

  // Progress hooks
  const progress = useQuery(api.progress.getUserProgress);
  const masteryStatus = useQuery(api.progress.getUnitMasteryStatus, { unitNumber });
  const completeUnitMutation = useMutation(api.progress.completeUnit);
  const markUnit1CompleteMutation = useMutation(api.admin.markUnit1Complete);
  const unitCompletionStatus = useQuery(api.progress.canCompleteUnit, { unitNumber });
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Derived values
  const isLoading = unitMetadata === undefined || content === undefined;
  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  const isMastered = masteryStatus?.isMastered ?? false;
  // Beta unit access is governed by the admin-tunable beta unit limit.
  const betaMaxUnits = accessInfo?.maxUnits ?? 1;
  const isLocked = Boolean(user?.isBetaTester) && unitNumber > betaMaxUnits;

  // During beta we only expose units up to the beta limit, so hide Next once
  // a beta user reaches the last accessible unit.
  const nextUnit = user?.role === "admin" || user?.role === "superadmin"
    ? unitNumber + 1
    : user?.isBetaTester
      ? (unitNumber < betaMaxUnits ? unitNumber + 1 : null)
      : unitNumber + 1;
  const prevUnit = unitNumber > 1 ? unitNumber - 1 : null;

  // Handle completion
  const handleComplete = React.useCallback(async () => {
    setIsCompleting(true);
    try {
      await completeUnitMutation({ unitNumber });
      setShowSuccess(true);
    } catch (error) {
      console.error('Failed to complete unit:', error);
    } finally {
      setIsCompleting(false);
    }
  }, [completeUnitMutation, unitNumber]);

  // Track scroll state for breadcrumb styling
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-complete if requirements met - TEMPORARILY DISABLED
  // React.useEffect(() => {
  //   if (!isCompleted && unitCompletionStatus?.canComplete && !isCompleting && !showSuccess) {
  //     handleComplete();
  //   }
  // }, [isCompleted, unitCompletionStatus?.canComplete, isCompleting, showSuccess, handleComplete]);

  // Handle manual Unit 1 completion (Admin)
  const handleMarkUnit1Complete = async () => {
    setIsMarkingComplete(true);
    try {
      await markUnit1CompleteMutation();
      toast.success(t('unit.mark1CompleteSuccess'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(t('unit.mark1CompleteFailed'));
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen p-4 md:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user || !unitMetadata) {
    return <div className="min-h-screen flex items-center justify-center">{t('unit.notFound')}</div>;
  }

  if (isLocked) {
    return (
      <AnimatedPage className="md:[&_[data-slot=card-header]]:px-9 md:[&_[data-slot=card-content]]:px-9 md:[&_[data-slot=card-footer]]:px-9">
        <div className="flex-1 p-8 flex items-center justify-center">
          <Card className="max-w-md border-yellow-200 bg-yellow-50">
            <CardHeader>
              <div className="flex items-center gap-2 text-yellow-600">
                <Lock className="h-6 w-6" />
                <CardTitle>{t('unit.lockedTitle')}</CardTitle>
              </div>
              <CardDescription>{t('unit.lockedDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard"><Button>{t('unit.backToDashboard')}</Button></Link>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    );
  }

  const unitDescription =
    unitMetadata.description && String(unitMetadata.description).trim()
      ? String(unitMetadata.description).trim()
      : null;

  const unitTopicsForBadges = unitMetadata.topics ?? [];

  return (
    <AnimatedPage className="md:[&_[data-slot=card-header]]:px-9 md:[&_[data-slot=card-content]]:px-9 md:[&_[data-slot=card-footer]]:px-9">
      <header className={`sticky top-16 z-40 -mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 pt-4 pb-2 mb-6 transition-all duration-200 ${
        isScrolled 
          ? 'bg-gradient-to-b from-background/95 via-background/90 to-background/0 backdrop-blur supports-[backdrop-filter]:backdrop-blur' 
          : ''
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center text-xs md:text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              {t("sidebar.dashboard")}
            </Link>
            {moduleTitle && moduleSlug && (
              <>
                <ChevronRight className="h-4 w-4 mx-1" />
                <Link
                  href={`/units#module-${moduleSlug}`}
                  className="hover:text-foreground transition-colors"
                >
                  {moduleTitle}
                </Link>
              </>
            )}
            {unitMetadata && (
              <>
                <ChevronRight className="h-4 w-4 mx-1" />
                <span className="font-semibold text-foreground">
                  {unitMetadata.title}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t('unit.number', { number: unitNumber })}
                  </span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {prevUnit && (
              <Link href={`/unit/${prevUnit}`}>
                <Button variant="outline" size="sm">
                  {t("unit.previous")}
                </Button>
              </Link>
            )}
            {nextUnit && (
              <Link href={`/unit/${nextUnit}`}>
                <Button variant="outline" size="sm">
                  {t("unit.next")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Content-Studio Preview banner (superadmin only, shown whenever a
          preview release exists for this unit — regardless of which view is
          currently active, so the superadmin always sees both counts). */}
      {previewOverlay?.isSuperadmin && previewOverlay.hasActivePreview && (
        <AnimatedItem>
          <div
            className={`mb-6 rounded-xl border px-4 py-3 shadow-sm ${
              preferPublished
                ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {preferPublished ? (
                  <EyeOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <Eye className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {preferPublished
                      ? "Live view (published release)"
                      : "Preview mode (draft release)"}
                  </div>
                  <div className="mt-0.5 text-xs opacity-90">
                    Only superadmins see this banner. Regular learners always
                    get the published release.
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <span className="font-medium">Preview:</span>{" "}
                      v{previewOverlay.previewUnitVersion ?? "?"} — vocab {previewOverlay.vocabPreviewCount}, content {previewOverlay.contentPreviewCount}, tests {previewOverlay.testsPreviewCount}
                    </span>
                    <span>
                      <span className="font-medium">Published:</span>{" "}
                      v{previewOverlay.publishedUnitVersion ?? "?"} — vocab {previewOverlay.vocabPublishedCount}, content {previewOverlay.contentPublishedCount}, tests {previewOverlay.testsPublishedCount}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {preferPublished ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewView("preview")}
                  >
                    Back to preview
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewView("published")}
                  >
                    Show live
                  </Button>
                )}
              </div>
            </div>
          </div>
        </AnimatedItem>
      )}

      {/* Header Card */}
      <AnimatedItem>
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
              <div>
                <CardTitle className="text-2xl sm:text-3xl mb-2">{unitMetadata.title}</CardTitle>
                {unitDescription && (
                  <CardDescription className="text-base">{unitDescription}</CardDescription>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {unitTopicsForBadges.map((topic: string, i: number) => (
                    <Badge key={i} variant="secondary">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {/* {isCompleted && <Badge className="bg-green-600"><CheckCircle2 className="w-4 h-4 mr-1"/> Completed</Badge>} */}
                {isMastered && (
                  <Badge className="bg-amber-500">
                    <Star className="w-4 h-4 mr-1" /> {t('unit.mastered')}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </AnimatedItem>

      {/* New 6-Tab Structure */}
      <AnimatedItem>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="overview" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.overview")}</span></TabsTrigger>
            <TabsTrigger value="vocabulary" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.vocabulary")}</span></TabsTrigger>
            <TabsTrigger value="grammar" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.grammar")}</span></TabsTrigger>
            <TabsTrigger value="phrases" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.phrases")}</span></TabsTrigger>
            <TabsTrigger value="dialogues" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.dialogues")}</span></TabsTrigger>
            <TabsTrigger value="test" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"><PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/> <span className="truncate">{t("unit.tab.exercises")}</span></TabsTrigger>
          </TabsList>

            {/* 1. Overview */}
            <TabsContent value="overview" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.overview.title")}</CardTitle>
                  <CardDescription>{t("unit.section.overview.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {content?.overview ? (
                    <MarkdownContent content={formatOverviewForDisplay(content.overview)} />
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No overview available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Vocabulary */}
            <TabsContent value="vocabulary" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.vocabulary.title")}</CardTitle>
                  <CardDescription>{t("unit.section.vocabulary.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {vocabularyWithProgress === undefined ? (
                    <div className="py-6 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-md" />
                      ))}
                    </div>
                  ) : vocabularyRows.length > 0 ? (
                    vocabularyGroupsForUnitView.hasGroups ? (
                      <div className="space-y-10">
                        {vocabularyGroupsForUnitView.groups.map((group) => (
                          <div key={group.title}>
                            <h3 className="text-lg font-semibold mb-4">{group.title}</h3>
                            <VocabularyDictionaryTable
                              rows={group.rows}
                              onPlayAudio={({ vocabularyId, serbianWord, unitNumber, audioStorageId }) =>
                                play({ vocabularyId, serbianWord, unitNumber, audioStorageId })
                              }
                              playingAudioId={playingAudioId}
                              loadingAudioId={loadingAudioId}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <VocabularyDictionaryTable
                        rows={vocabularyRows}
                        onPlayAudio={({ vocabularyId, serbianWord, unitNumber, audioStorageId }) =>
                          play({ vocabularyId, serbianWord, unitNumber, audioStorageId })
                        }
                        playingAudioId={playingAudioId}
                        loadingAudioId={loadingAudioId}
                      />
                    )
                  ) : content?.vocabulary ? (
                    <MarkdownContent content={content.vocabulary} />
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No vocabulary loaded.</p>
                  )}
                  <div className="mt-6 flex justify-end">
                    <Link href={`/vocabulary?unit=${unitNumber}`}>
                      <Button>{t("unit.practiceInVocabTrainer")}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Grammar */}
            <TabsContent value="grammar" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.grammar.title")}</CardTitle>
                  <CardDescription>{t("unit.section.grammar.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {content?.grammar ? (
                    <>
                      <MarkdownContent content={content.grammar} />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openBuddyModal(t("buddy.prefill.explainGrammar", { unit: unitNumber }), unitNumber)}
                        onKeyDown={(e) => e.key === "Enter" && openBuddyModal(t("buddy.prefill.explainGrammar", { unit: unitNumber }), unitNumber)}
                        className="mt-6 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-colors"
                      >
                        <Brain className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t("unit.askBuddy.grammar.title", "Need more help?")}</p>
                          <p className="text-xs text-muted-foreground">{t("unit.askBuddy.grammar.desc", "Ask Learn Buddy to explain this grammar topic in detail.")}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No grammar content available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. Phrases */}
            <TabsContent value="phrases" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.phrases.title")}</CardTitle>
                  <CardDescription>{t("unit.section.phrases.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {content?.phrases ? (
                    <>
                      <UnitContentAudioMarkdown
                        content={content.phrases}
                        unitNumber={unitNumber}
                        language={displayLanguage}
                        contentType="phrases"
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openBuddyModal(t("buddy.prefill.practicePhrases", { unit: unitNumber }), unitNumber)}
                        onKeyDown={(e) => e.key === "Enter" && openBuddyModal(t("buddy.prefill.practicePhrases", { unit: unitNumber }), unitNumber)}
                        className="mt-6 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-colors"
                      >
                        <Brain className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t("unit.askBuddy.phrases.title", "Want to practice?")}</p>
                          <p className="text-xs text-muted-foreground">{t("unit.askBuddy.phrases.desc", "Practice these phrases with Learn Buddy in a conversation.")}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No phrases available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Dialogues */}
            <TabsContent value="dialogues" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.dialogues.title")}</CardTitle>
                  <CardDescription>{t("unit.section.dialogues.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {content?.dialogues ? (
                    <>
                      <UnitContentAudioMarkdown
                        content={content.dialogues.replace(/^##\s+[^\n]+\n+/, "")}
                        unitNumber={unitNumber}
                        language={displayLanguage}
                        contentType="dialogues"
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openBuddyModal(t("buddy.prefill.practiceDialogues", { unit: unitNumber }), unitNumber)}
                        onKeyDown={(e) => e.key === "Enter" && openBuddyModal(t("buddy.prefill.practiceDialogues", { unit: unitNumber }), unitNumber)}
                        className="mt-6 flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 cursor-pointer hover:bg-primary/10 transition-colors"
                      >
                        <Brain className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{t("unit.askBuddy.dialogues.title", "Want to practice?")}</p>
                          <p className="text-xs text-muted-foreground">{t("unit.askBuddy.dialogues.desc", "Practice these dialogues with Learn Buddy in a role-play conversation.")}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No dialogues available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 6. Interactive Test */}
            <TabsContent value="test" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("unit.section.exercises.title")}</CardTitle>
                  <CardDescription>{t("unit.section.exercises.desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <InteractiveTest
                    unitNumber={unitNumber}
                    language={displayLanguage}
                    preferPublished={preferPublished}
                  />
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}
