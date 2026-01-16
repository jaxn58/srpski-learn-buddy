import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Filter, Star } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { VocabularyDictionaryTable, type VocabularyDictionaryRow } from "@/components/vocabulary/VocabularyDictionaryTable";
import { useVocabularyAudioPlayback } from "@/hooks/useVocabularyAudioPlayback";

type VocabularyProgressDoc = Doc<"vocabulary">;

export default function VocabularyList() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  
  // Get accessible units from Convex
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);

  // Englisch-only (solange keine deutschen Inhalte vorhanden sind)
  const maxUnits = accessInfo?.maxUnits ?? 0;
  const hasAccess = Boolean(user) && accessInfo !== undefined && maxUnits > 0;

  // Fetch vocabulary progress for all units
  const vocabProgressData = useQuery(api.vocabulary.getUserVocabularyProgress, user ? {} : "skip") as
    | VocabularyProgressDoc[]
    | undefined;
  
  // NEW: Fetch course vocabulary from database
  const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary, hasAccess ? undefined : "skip");
  const vocabWithProgress = useQuery(
    api.vocabulary.getVocabularyWithProgress,
    hasAccess ? { unitNumber: selectedUnit } : "skip"
  );
  
  // NEW: Fetch available unit numbers dynamically from database
  const availableUnitNumbers = useQuery(api.vocabulary.getAvailableUnitNumbers, hasAccess ? undefined : "skip");
  
  const { play, playingAudioId, loadingAudioId } = useVocabularyAudioPlayback();

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter and search vocabulary
  const filteredVocabulary = useMemo(() => {
    // Zugriff noch nicht geladen -> nichts anzeigen (vermeidet kurzes "Leaken" vor Zugriff-Check)
    if (accessInfo === undefined) return [];

    // Kein Zugriff -> nichts anzeigen
    if (maxUnits <= 0) return [];

    // NEW: Use courseVocabulary from database (if available)
    // FALLBACK: Use hardcoded VOCABULARY for backward compatibility
    if (!courseVocabulary || courseVocabulary.length === 0) {
      // This is expected during initial load
      return [];
    }
    
    // Debug: Check if courseVocabulary has _id fields
    if (courseVocabulary.length > 0 && !courseVocabulary[0]._id) {
      console.error("[VocabularyList] courseVocabulary items are missing _id field!", courseVocabulary[0]);
    }
    
    let filtered = courseVocabulary
      .filter((word: any) => word.serbian) // Only include words with serbian field
      .map((word: any) => ({
        _id: word._id,
        serbian: word.serbian,
        serbianWord: word.serbian, // For compatibility
        unit: word.unitNumber,
        unitNumber: word.unitNumber,
        en: word.en,
        de: word.de,
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        noteEn: word.noteEn,
        noteDe: word.noteDe,
        noteSr: word.noteSr,
        noteEs: word.noteEs,
        noteFr: word.noteFr,
        // Include old translations array for backward compatibility
        translations: word.translations || [],
      }));

    // Beta/Subscription Beschränkung
    filtered = filtered.filter((v: any) => v.unit <= maxUnits);

    // Filter by unit
    const beforeUnitFilter = filtered.length;
    filtered = filtered.filter((v: any) => v.unit === selectedUnit);
    console.log(`[VocabularyList] After unit filter (${selectedUnit}): ${filtered.length} words (was ${beforeUnitFilter})`);

    // Search in Serbian or English
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((v: any) => {
        // Check if serbian word exists before calling toLowerCase
        const serbianMatch = v.serbian && v.serbian.toLowerCase().includes(search);
        // NEW: Support column-based translations (check if values exist)
        const translationMatch = (v.en && v.en.toLowerCase().includes(search)) || 
                                 (v.de && v.de.toLowerCase().includes(search)) ||
                                 // FALLBACK: Database translations array structure
                                 (v.translations && Array.isArray(v.translations) && v.translations.some((t: any) => 
                                   (t.translation && t.translation.toLowerCase().includes(search))
                                 ));
        return serbianMatch || translationMatch;
      });
    }

    return filtered;
  }, [searchTerm, selectedUnit, accessInfo, maxUnits, courseVocabulary]);

  // Units dynamisch aus Datenbank laden und basierend auf Zugriff beschränken
  const units = useMemo(() => {
    if (accessInfo === undefined) {
      return [];
    }

    if (maxUnits <= 0) {
      return [];
    }

    // Fallback: Wenn keine Units aus DB geladen, leeres Array zurückgeben
    if (!availableUnitNumbers || availableUnitNumbers.length === 0) {
      return [];
    }
    
    // Units basierend auf Zugriff filtern
    return availableUnitNumbers.filter((unit: number) => unit <= maxUnits);
  }, [availableUnitNumbers, accessInfo, maxUnits]);
  
  // Sicherstellen, dass selectedUnit gültig ist, wenn Units geladen werden
  useEffect(() => {
    if (units.length > 0 && !units.includes(selectedUnit)) {
      // Wenn die ausgewählte Unit nicht mehr verfügbar ist, zur ersten verfügbaren Unit wechseln
      setSelectedUnit(units[0]);
    }
  }, [units, selectedUnit]);

  // Keep local cache for future use (e.g., to avoid finding from DB again)
  // Note: playback itself is handled by the shared hook now.

  // Helper function to check if a unit is mastered
  // A unit is mastered when ALL vocabulary words in that unit have correctAnswerCount >= 3
  const isUnitMastered = (unitNumber: number): boolean => {
    // NEW: Use courseVocabulary from database (if available)
    // FALLBACK: Return false if data not loaded
    if (!courseVocabulary || courseVocabulary.length === 0) {
      return false;
    }
    
    // Get all vocabulary words for this unit
    const unitVocab = courseVocabulary.filter((v: any) => v.unitNumber === unitNumber);
    if (unitVocab.length === 0) return false;
    
    // Check if vocabProgressData or vocabWithProgress is loaded
    if ((!vocabProgressData || vocabProgressData.length === 0) && 
        (!vocabWithProgress || vocabWithProgress.length === 0)) {
      return false;
    }
    
    // Check if all words in the unit are mastered (correctAnswerCount >= 3)
    const allMastered = unitVocab.every((word: any) => {
      // NEW: Try vocabWithProgress first (contains progress data)
      if (vocabWithProgress) {
        const progress = vocabWithProgress.find((p: any) => p._id === word._id)?.progress;
        if (progress) {
          return (progress.correctAnswerCount ?? 0) >= 3;
        }
      }
      
      // FALLBACK: Use old vocabProgressData structure
      if (vocabProgressData) {
        const progress = vocabProgressData.find(
          (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unitNumber
        );
        return (progress?.correctAnswerCount ?? 0) >= 3;
      }
      
      return false;
    });
    
    return allMastered;
  };

  // Prepare rows for shared Dictionary Table component
  const tableRows: VocabularyDictionaryRow[] = useMemo(() => {
    return filteredVocabulary.map((word: any, idx: number) => {
      const wordProgress = vocabProgressData?.find(
        (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unit
      );

      // Englisch-only: Translation (mit Fallbacks)
      const enFromColumns = typeof word.en === "string" ? word.en.trim() : "";
      const deFromColumns = typeof word.de === "string" ? word.de.trim() : "";

      let displayTranslation: string = enFromColumns || "";
      let altTranslation: string | undefined = typeof word.enAlt === "string" ? word.enAlt : undefined;

      if (!displayTranslation && word.translations && Array.isArray(word.translations)) {
        const enObj = word.translations.find((t: any) => t?.language === "en");
        displayTranslation = (enObj?.translation || "").trim();
        if (!altTranslation && typeof enObj?.alt === "string") {
          altTranslation = enObj.alt;
        }
      }

      // Last-resort fallback
      if (!displayTranslation) {
        displayTranslation = deFromColumns || "";
      }

      // Englisch-only: Note
      const note = (typeof word.noteEn === "string" ? word.noteEn : null) as string | null;

      const correctCountRaw = (wordProgress?.correctAnswerCount ?? 0) as number;
      const incorrectCountRaw = (wordProgress as any)?.incorrectAnswerCount ?? 0;
      const correctCount = Math.max(0, correctCountRaw);
      const incorrectCount = Math.max(0, Number(incorrectCountRaw) || 0);
      const mastered = Boolean((wordProgress as any)?.mastered) || correctCount >= 3;

      // Safety check: Ensure _id exists (otherwise audio won't work)
      if (!word._id) {
        console.error(`[VocabularyList] Missing _id for word: ${word.serbian} (unit ${word.unit})`);
      }

      // Get audioStorageId from vocabWithProgress (NOT from courseVocabulary)
      // vocabWithProgress contains progress data including audioStorageId
      const audioStorageId = vocabWithProgress?.find((v: any) => v._id === word._id)?.audioStorageId ?? null;

      return {
        id: String(word._id ?? `fallback-${idx}`),
        serbian: word.serbian,
        translation: displayTranslation,
        altTranslation,
        note,
        audioStorageId,
        unitNumber: word.unit,
        mastery: { correctCount, incorrectCount, mastered },
      } satisfies VocabularyDictionaryRow;
    });
  }, [filteredVocabulary, vocabProgressData, vocabWithProgress]);

  return (
    <AnimatedPage>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  {t('vocabularyList.backToDashboard')}
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">{t('vocabularyList.title')}</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Search and Filter */}
        <AnimatedItem>
          <Card>
            <CardHeader>
              <CardTitle>{t('vocabularyList.searchFilter')}</CardTitle>
              <CardDescription>
                {t('vocabularyList.searchFilter.desc', { count: courseVocabulary?.length || 0 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search */}
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('vocabularyList.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Unit Filter */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('vocabularyList.filterByUnit')}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {units.map((unit: number) => {
                    const mastered = isUnitMastered(unit);
                    const isSelected = selectedUnit === unit;
                    return (
                      <Button
                        key={unit}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        className={mastered && !isSelected ? 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100' : ''}
                        onClick={() => setSelectedUnit(unit)}
                      >
                        {mastered && (
                          <Star className="h-4 w-4 mr-1.5 fill-yellow-500 text-yellow-500" />
                        )}
                        {t('vocabularyList.unit', { number: unit })}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Results count */}
              <div className="text-sm text-muted-foreground">
                {t('vocabularyList.showing', { count: filteredVocabulary.length })}
              </div>
            </CardContent>
        </Card>
        </AnimatedItem>

        {/* Vocabulary List */}
        <AnimatedItem>
          <Card>
            <CardHeader>
              <CardTitle>
                {t('vocabularyList.unit', { number: selectedUnit })}
              </CardTitle>
            </CardHeader>
            <CardContent>
            {filteredVocabulary.length > 0 ? (
              <VocabularyDictionaryTable
                rows={tableRows}
                onPlayAudio={({ vocabularyId, serbianWord, unitNumber, audioStorageId }) => {
                  // Safety check: Ensure vocabularyId is a valid Convex ID (not a number or "fallback-X")
                  if (!vocabularyId || vocabularyId.startsWith("fallback-") || /^\d+$/.test(vocabularyId)) {
                    console.error(`[VocabularyList] Invalid vocabularyId for "${serbianWord}": ${vocabularyId}`);
                    alert(`Cannot play audio: Invalid vocabulary ID. Please contact support.`);
                    return;
                  }
                  console.log(`[VocabularyList] Playing audio for "${serbianWord}" (ID: ${vocabularyId})`);
                  play({ vocabularyId, serbianWord, unitNumber, audioStorageId });
                }}
                playingAudioId={playingAudioId}
                loadingAudioId={loadingAudioId}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                {t('vocabularyList.noWords')}
              </div>
            )}
          </CardContent>
        </Card>
        </AnimatedItem>

        {/* Quick Actions */}
        <AnimatedItem>
          <div className="flex gap-4 justify-center">
          <Link href="/vocabulary">
            <Button variant="default">
              Practice Vocabulary
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              Back to Dashboard
            </Button>
          </Link>
        </div>
        </AnimatedItem>
      </div>
    </AnimatedPage>
  );
}
