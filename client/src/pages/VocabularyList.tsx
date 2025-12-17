import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
// Types only - no hardcoded data imports
import type { SupportedLanguage } from "@shared/data";
import { Search, BookOpen, Filter, Star, Volume2, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo, useEffect } from "react";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";

type VocabularyProgressDoc = Doc<"vocabulary">;

export default function VocabularyList() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  
  // Audio URL cache for fast repeated playback (stores storage IDs)
  const [audioStorageCache, setAudioStorageCache] = useState<Record<string, string>>({});
  
  // Get accessible units from Convex
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  
  // BETA: Force English for all users
  const userLanguage: SupportedLanguage = "en";

  // Helper function to get note for current language
  const getNoteForLanguage = (word: any, language: SupportedLanguage): string | null => {
    if (!word) return null;
    if (language === "de") return word.noteDe || word.noteEn || null;
    if (language === "sr") return word.noteSr || word.noteEn || null;
    if (language === "es") return word.noteEs || word.noteEn || null;
    if (language === "fr") return word.noteFr || word.noteEn || null;
    return word.noteEn || null;
  };

  // Fetch vocabulary progress for all units
  const vocabProgressData = useQuery(api.vocabulary.getUserVocabularyProgress, {}) as VocabularyProgressDoc[] | undefined;
  
  // NEW: Fetch course vocabulary from database
  const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);
  const vocabWithProgress = useQuery(api.vocabulary.getVocabularyWithProgress, { unitNumber: selectedUnit });
  
  // NEW: Fetch available unit numbers dynamically from database
  const availableUnitNumbers = useQuery(api.vocabulary.getAvailableUnitNumbers);
  
  // Audio generation mutations/actions
  // We use direct fetch for generation to avoid Cloud->Localhost issues in dev
  const updateVocabularyAudioStorageId = useMutation(api.vocabulary.updateVocabularyAudioStorageId);
  
  // State for audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter and search vocabulary
  const filteredVocabulary = useMemo(() => {
    // NEW: Use courseVocabulary from database (if available)
    // FALLBACK: Use hardcoded VOCABULARY for backward compatibility
    if (!courseVocabulary || courseVocabulary.length === 0) {
      console.log('[VocabularyList] No courseVocabulary data available');
      return [];
    }
    
    // DEBUG: Log vocabulary statistics
    const unitCounts = courseVocabulary.reduce((acc, word) => {
      acc[word.unitNumber] = (acc[word.unitNumber] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    console.log('[VocabularyList] Vocabulary by unit:', unitCounts);
    console.log(`[VocabularyList] Selected unit: ${selectedUnit}`);
    console.log(`[VocabularyList] Unit ${selectedUnit} vocabulary count:`, unitCounts[selectedUnit] || 0);
    
    let filtered = courseVocabulary
      .filter(word => word.serbian) // Only include words with serbian field
      .map(word => ({
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
    if (accessInfo && accessInfo.maxUnits > 0) {
      filtered = filtered.filter(v => v.unit <= accessInfo.maxUnits);
    }

    // Filter by unit
    const beforeUnitFilter = filtered.length;
    filtered = filtered.filter(v => v.unit === selectedUnit);
    console.log(`[VocabularyList] After unit filter (${selectedUnit}): ${filtered.length} words (was ${beforeUnitFilter})`);

    // Search in Serbian or English
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v => {
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
  }, [searchTerm, selectedUnit, accessInfo, courseVocabulary, userLanguage]);

  // Units dynamisch aus Datenbank laden und basierend auf Zugriff beschränken
  const units = useMemo(() => {
    // Fallback: Wenn keine Units aus DB geladen, leeres Array zurückgeben
    if (!availableUnitNumbers || availableUnitNumbers.length === 0) {
      return [];
    }
    
    // Units basierend auf Zugriff filtern
    if (accessInfo && accessInfo.maxUnits > 0) {
      return availableUnitNumbers.filter(unit => unit <= accessInfo.maxUnits);
    }
    
    // Alle verfügbaren Units zurückgeben
    return availableUnitNumbers;
  }, [availableUnitNumbers, accessInfo]);
  
  // Sicherstellen, dass selectedUnit gültig ist, wenn Units geladen werden
  useEffect(() => {
    if (units.length > 0 && !units.includes(selectedUnit)) {
      // Wenn die ausgewählte Unit nicht mehr verfügbar ist, zur ersten verfügbaren Unit wechseln
      setSelectedUnit(units[0]);
    }
  }, [units, selectedUnit]);

  // Handle audio playback
  const handlePlayAudio = async (vocabularyId: string, serbianWord: string) => {
    // Prevent multiple simultaneous requests
    if (loadingAudioId || playingAudioId === vocabularyId) {
      return;
    }

    setLoadingAudioId(vocabularyId);
    
    try {
      // 1. Check cache first (fastest) - storageId
      let storageId = audioStorageCache[vocabularyId];
      
      // 2. If not in cache, check database
      if (!storageId) {
        const word = courseVocabulary?.find(w => w._id === vocabularyId);
        storageId = (word as any)?.audioStorageId;
      }
      
      // 3. If not found, generate it via server endpoint
      if (!storageId) {
        const word = courseVocabulary?.find(w => w._id === vocabularyId);
        
        // Use configured server URL if provided, otherwise fall back to same origin (works on Vercel)
        const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
        const audioEndpoint = configuredServerUrl
          ? `${configuredServerUrl}/api/audio/generate`
          : "/api/audio/generate";

        const response = await fetch(audioEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serbianWord,
            vocabularyId,
            unitNumber: word?.unitNumber,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Audio generation failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success || !result.storageId) {
          throw new Error("Invalid response from audio generation endpoint");
        }
        
        storageId = result.storageId;
        
        // 4. Save to cache immediately for instant replay
        setAudioStorageCache(prev => ({ ...prev, [vocabularyId]: storageId! }));
        
        // 5. Save the new storageId to database (async, don't wait)
        updateVocabularyAudioStorageId({
          vocabularyId: vocabularyId as any,
          audioStorageId: storageId!,
        }).catch(err => console.error("Failed to save audio storageId to DB:", err));
      }
      
      // 6. Generate fresh URL from storageId (via Convex storage.getUrl)
      if (storageId) {
        const audioUrl = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "vocabulary:getVocabularyAudioUrl",
            args: { vocabularyId: vocabularyId as any },
          }),
        }).then(r => r.json()).then(r => r.value);
        
        if (!audioUrl) {
          throw new Error("Failed to generate audio URL from storageId");
        }
        
        const audio = new Audio(audioUrl);
        
        audio.onplay = () => {
          setPlayingAudioId(vocabularyId);
          setLoadingAudioId(null);
        };
        
        audio.onended = () => {
          setPlayingAudioId(null);
        };
        
        audio.onerror = (e) => {
          setLoadingAudioId(null);
          setPlayingAudioId(null);
          console.error("Audio playback failed", e);
        };
        
        await audio.play();
      }
    }
    } catch (error) {
      console.error("Failed to get audio:", error);
      setLoadingAudioId(null);
      
      // Show user-friendly error
      const errorMessage = error instanceof Error && error.message === "Failed to fetch" 
        ? "Server not reachable. Please ensuring 'pnpm dev:server' is running."
        : "Failed to generate audio. Please try again.";
        
      alert(errorMessage); // Simple alert for now, could be toast
    }
  };

  // Helper function to check if a unit is mastered
  // A unit is mastered when ALL vocabulary words in that unit have correctAnswerCount >= 3
  const isUnitMastered = (unitNumber: number): boolean => {
    // NEW: Use courseVocabulary from database (if available)
    // FALLBACK: Return false if data not loaded
    if (!courseVocabulary || courseVocabulary.length === 0) {
      return false;
    }
    
    // Get all vocabulary words for this unit
    const unitVocab = courseVocabulary.filter(v => v.unitNumber === unitNumber);
    if (unitVocab.length === 0) return false;
    
    // Check if vocabProgressData or vocabWithProgress is loaded
    if ((!vocabProgressData || vocabProgressData.length === 0) && 
        (!vocabWithProgress || vocabWithProgress.length === 0)) {
      return false;
    }
    
    // Check if all words in the unit are mastered (correctAnswerCount >= 3)
    const allMastered = unitVocab.every(word => {
      // NEW: Try vocabWithProgress first (contains progress data)
      if (vocabWithProgress) {
        const progress = vocabWithProgress.find(p => p._id === word._id)?.progress;
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

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter */}
        <AnimatedItem>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t('vocabularyList.searchFilter')}</CardTitle>
              <CardDescription>
                {t('vocabularyList.searchFilter.desc', { count: courseVocabulary?.length || 0 })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('vocabularyList.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Unit Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">{t('vocabularyList.filterByUnit')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {units.map(unit => {
                  const mastered = isUnitMastered(unit);
                  const isSelected = selectedUnit === unit;
                  return (
                    <Button
                      key={unit}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={mastered && !isSelected ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' : ''}
                      onClick={() => setSelectedUnit(unit)}
                    >
                      {mastered && (
                        <Star className="h-4 w-4 mr-1.5 text-white fill-white" />
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
              <div className="space-y-1">
                {filteredVocabulary.map((word, idx) => {
                  const wordProgress = vocabProgressData?.find(
                    (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unit
                  );
                  
                  // Get translation
                  let displayTranslation: string = "";
                  let altTranslation: string | undefined = undefined;
                  
                  if (word.en && word.en.trim() || word.de && word.de.trim()) {
                    displayTranslation = userLanguage === "de" 
                      ? (word.de?.trim() || word.en?.trim() || "") 
                      : (word.en?.trim() || word.de?.trim() || "");
                    altTranslation = userLanguage === "de" ? word.deAlt : word.enAlt;
                  } else if (word.translations && Array.isArray(word.translations)) {
                    const translationObj = word.translations.find((t: any) => t.language === userLanguage) ||
                                          word.translations.find((t: any) => t.language === "en");
                    displayTranslation = translationObj?.translation || "";
                    altTranslation = translationObj?.alt;
                  }
                  
                  // Get note
                  const note = getNoteForLanguage(word, userLanguage);
                  
                  const isPlaying = playingAudioId === word._id;
                  const isLoading = loadingAudioId === word._id;
                  
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      {wordProgress?.mastered && (
                        <span className="text-yellow-500" title="Mastered!">⭐</span>
                      )}
                      {wordProgress && (wordProgress.correctAnswerCount || 0) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {wordProgress.correctAnswerCount || 0}/3
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handlePlayAudio(word._id, word.serbian)}
                        disabled={isLoading}
                        title={isLoading ? "Generating audio..." : "Play pronunciation"}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className={`h-4 w-4 ${isPlaying ? "text-primary" : ""}`} />
                        )}
                      </Button>
                      <div>
                        <span className="font-medium">{word.serbian}</span>
                        <span> - </span>
                        {altTranslation && altTranslation.trim() ? (
                          <span>
                            {displayTranslation} / {altTranslation}
                          </span>
                        ) : (
                          <span>{displayTranslation}</span>
                        )}
                        {note && note.trim() && (
                          <span className="text-muted-foreground italic text-[0.85rem]"> ({note})</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
          <div className="mt-8 flex gap-4 justify-center">
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
