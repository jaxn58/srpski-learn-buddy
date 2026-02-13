import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BookOpen, CheckCircle2, Brain, Lightbulb, Lock, Star, MessageSquare, Mic, PenTool, ChevronRight } from "lucide-react";
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

  // Load Unit Metadata & Content from DB
  const unitMetadata = useQuery(api.units.getUnitMetadata, { unitNumber, language: displayLanguage });
  const content = useQuery(api.units.getUnitContentSections, { unitNumber, language: displayLanguage });
  const vocabularyWithProgress = useQuery(api.vocabulary.getVocabularyWithProgress, { unitNumber });

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

    const getTranslationForLanguage = (
      word: any,
      language: string
    ): { translation: string; altTranslation?: string } => {
      // Prefer column-based translations when present
      const hasAnyColumn =
        (word.en && String(word.en).trim()) ||
        (word.de && String(word.de).trim()) ||
        (word.sr && String(word.sr).trim()) ||
        (word.es && String(word.es).trim()) ||
        (word.fr && String(word.fr).trim());

      if (hasAnyColumn) {
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

        const altTranslation =
          language === "de"
            ? (word.deAlt && String(word.deAlt).trim() ? String(word.deAlt).trim() : undefined)
            : language === "en"
              ? (word.enAlt && String(word.enAlt).trim() ? String(word.enAlt).trim() : undefined)
              : undefined;

        return { translation: translation || "-", altTranslation };
      }

      // Fallback: translations[] array
      if (word.translations && Array.isArray(word.translations)) {
        const trans =
          word.translations.find((t: any) => t.language === language) ||
          word.translations.find((t: any) => t.language === "en");
        return {
          translation: trans?.translation || "-",
          altTranslation: trans?.alt,
        };
      }

      return { translation: "-" };
    };

    return vocabularyWithProgress.map((word: any, idx: number) => {
      const { translation, altTranslation } = getTranslationForLanguage(word, displayLanguage);
      const note = getNoteForLanguage(word, displayLanguage);

      const correctCount = Number(word.progress?.correctAnswerCount ?? 0) || 0;
      const incorrectCount = Number(word.progress?.incorrectAnswerCount ?? 0) || 0;
      const mastered = Boolean(word.progress?.mastered) || correctCount >= 3;

      return {
        id: String(word._id ?? idx),
        serbian: word.serbian,
        translation,
        altTranslation,
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
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Derived values
  const isLoading = unitMetadata === undefined || content === undefined;
  const isCompleted = progress?.completedUnits?.includes(unitNumber) || false;
  const isMastered = masteryStatus?.isMastered ?? false;
  const isLocked = user?.isBetaTester && unitNumber > 1; // Beta phase: only Unit 1

  // During beta we only expose Unit 1 for students, so hide Next for beta users.
  const nextUnit = user?.role === "admin" || user?.role === "superadmin"
    ? unitNumber + 1
    : user?.isBetaTester
      ? null
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
      toast.success('Unit 1 marked as complete!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error('Failed to mark Unit 1 as complete');
    } finally {
      setIsMarkingComplete(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  if (!user || !unitMetadata) {
    return <div className="min-h-screen flex items-center justify-center">Unit not found</div>;
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
              <Link href="/dashboard"><Button>Back to Dashboard</Button></Link>
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
                    (Unit {unitNumber})
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

      {/* Header Card */}
      <AnimatedItem>
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-3xl mb-2">{unitMetadata.title}</CardTitle>
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
                    <Star className="w-4 h-4 mr-1" /> Mastered
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
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="overview" className="gap-2"><Lightbulb className="w-4 h-4"/> {t("unit.tab.overview")}</TabsTrigger>
            <TabsTrigger value="vocabulary" className="gap-2"><BookOpen className="w-4 h-4"/> {t("unit.tab.vocabulary")}</TabsTrigger>
            <TabsTrigger value="grammar" className="gap-2"><Brain className="w-4 h-4"/> {t("unit.tab.grammar")}</TabsTrigger>
            <TabsTrigger value="phrases" className="gap-2"><MessageSquare className="w-4 h-4"/> {t("unit.tab.phrases")}</TabsTrigger>
            <TabsTrigger value="dialogues" className="gap-2"><Mic className="w-4 h-4"/> {t("unit.tab.dialogues")}</TabsTrigger>
            <TabsTrigger value="test" className="gap-2"><PenTool className="w-4 h-4"/> {t("unit.tab.exercises")}</TabsTrigger>
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
                    <div className="py-10 flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                    <MarkdownContent content={content.grammar} />
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
                    <UnitContentAudioMarkdown
                      content={content.phrases}
                      unitNumber={unitNumber}
                      language={displayLanguage}
                      contentType="phrases"
                    />
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
                    <UnitContentAudioMarkdown
                      content={content.dialogues.replace(/^##\s+[^\n]+\n+/, "")}
                      unitNumber={unitNumber}
                      language={displayLanguage}
                      contentType="dialogues"
                    />
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
                  <InteractiveTest unitNumber={unitNumber} language={displayLanguage} />
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </AnimatedItem>
    </AnimatedPage>
  );
}
