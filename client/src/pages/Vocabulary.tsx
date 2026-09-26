import { useAuth } from "@/_core/hooks/useAuth";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { BookOpen, CheckCircle, XCircle, RotateCcw, ArrowRight, Info, ChevronDown, Star, Volume2, Loader2, Calendar, PenTool, MessageSquare, Target, Brain } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { useBuddyModal } from "@/contexts/BuddyModalContext";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Types only - no hardcoded data imports
import type { SupportedLanguage } from "@shared/const";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { GamificationModal } from "@/components/GamificationModal";
import { BuddyHelpHint } from "@/components/BuddyHelpHint";
import { gradeVocabularyAnswer } from "@/lib/vocabQuizAnswer";
import { whenAudioCanPlayThrough } from "@/lib/whenAudioCanPlayThrough";
import { cumulativeSpacedRepetitionXp } from "../../../convex/gamification";

type QuizProgressDoc = Doc<"quizProgress">;
type VocabularyProgressDoc = Doc<"vocabularyProgress">;

type VocabItem = {
  _id: Id<"courseVocabulary">;
  serbian: string;
  serbianWord: string;
  unit: number;
  unitNumber: number;
  en?: string;
  de?: string;
  noteEn?: string;
  noteDe?: string;
  noteEs?: string;
  noteFr?: string;
  noteSr?: string;
};

// Single shape for both the word itself and its per-user progress, as
// returned by getVocabularyWithProgress. This is the only vocabulary source
// used by Learn/Quiz mode (see rationale at the `vocabWithProgress` query
// below) so the word list and its progress can never disagree.
type VocabWithProgressItem = {
  _id: Id<"courseVocabulary">;
  unitNumber: number;
  serbian: string;
  en?: string;
  de?: string;
  sr?: string;
  es?: string;
  fr?: string;
  audioStorageId?: string | null;
  noteEn?: string;
  noteDe?: string;
  noteSr?: string;
  noteEs?: string;
  noteFr?: string;
  progress: {
    correctAnswerCount?: number;
    incorrectAnswerCount?: number;
    reviewCount?: number;
    mastered?: boolean;
    lastReviewedAt?: number;
    lastAnsweredAt?: number;
  } | null;
};

function trimmedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function translationForLanguage(
  word: { en?: string; de?: string } | null | undefined,
  language: SupportedLanguage
): string {
  if (!word) return "";
  return language === "de" ? trimmedText(word.de) : trimmedText(word.en);
}

function noteForLanguage(
  word:
    | {
        noteEn?: string;
        noteDe?: string;
        noteEs?: string;
        noteFr?: string;
      }
    | null
    | undefined,
  language: SupportedLanguage
): string | null {
  if (!word) return null;
  const note =
    language === "de"
      ? trimmedText(word.noteDe)
      : language === "es"
        ? trimmedText(word.noteEs)
        : language === "fr"
          ? trimmedText(word.noteFr)
          : trimmedText(word.noteEn);
  return note || null;
}

function missingTranslationKey(
  language: SupportedLanguage
): "vocab.missingTranslation.de" | "vocab.missingTranslation.en" {
  return language === "de" ? "vocab.missingTranslation.de" : "vocab.missingTranslation.en";
}

export default function Vocabulary() {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const { t, i18n } = useTranslation();
  const { openBuddyModal } = useBuddyModal();
  const progress = useQuery(api.progress.getUserProgress);
  const [location] = useLocation();

  // Get accessible units from Convex
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  
  // UI language: source of truth is DB user setting; fallback to current i18n language.
  const rawLang = user?.learningLanguage ?? i18n.language;
  const userLanguage: SupportedLanguage =
    rawLang === "de" || rawLang === "es" || rawLang === "fr" ? rawLang : "en";
  
  const resolveTranslationLabel = (word: VocabItem | null | undefined): string => {
    if (!word) return "";
    return translationForLanguage(word, userLanguage) || t(missingTranslationKey(userLanguage));
  };
  
  // Load all unit metadata for displaying unit titles
  const allUnitsMetadata = useQuery(api.units.getAllUnitsMetadata, { language: userLanguage });
  
  // Create a map of unitNumber -> title for quick lookup
  const unitTitlesMap = useMemo(() => {
    if (!allUnitsMetadata) return new Map<number, string>();
    const map = new Map<number, string>();
    allUnitsMetadata.forEach((metadata: Doc<"unitMetadata">) => {
      map.set(metadata.unitNumber, metadata.title);
    });
    return map;
  }, [allUnitsMetadata]);
  
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [selectedUnit, setSelectedUnit] = useState<number | 'all'>('all');
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hasCaseHint, setHasCaseHint] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  // True once the current quiz round's last word has been answered. Decoupled
  // from currentIndex/filteredVocab.length because those can shift the very
  // moment a word leaves the pool (mastery, or "new words only"), before the
  // user advances - relying on them directly would show the completion card
  // (or hide the "Weiter" button) one word too early. Reset in handleReset.
  const [quizFinished, setQuizFinished] = useState(false);
  const [lastQuizProgress, setLastQuizProgress] = useState<any>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  // Optimistic updates for vocabulary progress
  const [optimisticProgress, setOptimisticProgress] = useState<Map<string, { correctAnswerCount: number; incorrectAnswerCount: number }>>(new Map());
  // Store the correct translation for the current answer (to prevent it from changing during feedback)
  const [currentCorrectTranslation, setCurrentCorrectTranslation] = useState<string | null>(null);
  // Store the current word object when answering (to prevent it from changing during feedback)
  const [answeredWord, setAnsweredWord] = useState<VocabItem | null>(null);
  // Track if unit selection was manual (to prevent auto-redirect from interfering)
  const [isManualSelection, setIsManualSelection] = useState(false);
  // Track recent quiz completion to prevent immediate auto-redirect
  const [recentQuizCompletion, setRecentQuizCompletion] = useState(false);
  // Track XP earned in this session (for display)
  const [sessionXP, setSessionXP] = useState(0);
  // Auto-advance setting (load from localStorage)
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    const saved = localStorage.getItem('vocab_quiz_auto_advance');
    return saved === 'true';
  });
  // "New words only" filter setting for quiz mode (load from localStorage).
  // When enabled, only vocabulary that has never been answered correctly
  // (correctAnswerCount === 0) is shown. Mastery (3x correct) requires this
  // filter to be turned off, since words leave the "new" pool after the
  // first correct answer.
  const [newWordsOnly, setNewWordsOnly] = useState<boolean>(() => {
    const saved = localStorage.getItem('vocab_quiz_new_words_only');
    return saved === 'true';
  });
  // Tracks whether the word just answered will drop out of the filtered quiz
  // pool (mastery reached, or excluded by the "new words only" filter). Used
  // by handleNextWord to decide whether the next word already occupies the
  // current index (pool shrank) or whether we still need to advance by one.
  const wordRemovedFromPoolRef = useRef(false);
  
  // Audio generation mutations/actions
  // We use direct fetch for generation to avoid Cloud->Localhost issues in dev
  const updateVocabularyAudioStorageId = useMutation(api.vocabulary.updateVocabularyAudioStorageId);
  
  // State for audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  
  // Audio storage ID cache for fast repeated playback
  const [audioStorageCache, setAudioStorageCache] = useState<Record<string, string>>({});

  // NEW: Fetch available unit numbers dynamically from database (only units with vocabulary AND metadata)
  const availableUnitNumbers = useQuery(api.vocabulary.getAvailableUnitNumbers);
  
  // Dynamically calculate available units based on access info
  const availableUnits = useMemo(() => {
    // Fallback: If no units from DB loaded, return empty array
    if (!availableUnitNumbers || availableUnitNumbers.length === 0) {
      return [];
    }
    
    // Filter units based on access
    if (accessInfo && accessInfo.maxUnits > 0) {
      return (availableUnitNumbers as number[]).filter((unit: number) => unit <= accessInfo.maxUnits);
    }
    
    // Return all available units from database
    return availableUnitNumbers;
  }, [availableUnitNumbers, accessInfo]);

  // localStorage key for quiz progress
  const getStorageKey = () => `quiz_progress_${selectedUnit === 'all' ? 0 : selectedUnit}_${user?._id || 'guest'}`;

  // Fetch ALL quiz progress for auto-selecting next unit
  const allQuizProgress = (useQuery(api.exercises.getAllQuizProgress) || []) as QuizProgressDoc[];

  // Fetch quiz progress when unit is selected in quiz mode
  // Use unitNumber 0 for "All Units" to track global progress
  const quizProgress = useQuery(
    api.exercises.getQuizProgress,
    mode === 'quiz' ? { unitNumber: selectedUnit === 'all' ? 0 : (selectedUnit as number) } : "skip"
  ) as QuizProgressDoc | null | undefined;


  // Mutations for quiz progress
  const updateQuizProgressMutation = useMutation(api.exercises.updateQuizProgress);
  const recordVocabularyAnswerMutation = useMutation(api.vocabulary.recordVocabularyAnswer);
  
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
      let word: any = null;
      if (!storageId) {
        if (vocabWithProgress) {
          word = vocabWithProgress.find((w: any) => w._id === vocabularyId);
        }
        
        storageId = word?.audioStorageId;
      }

      // 3. If not found, generate it via server endpoint
      if (!storageId) {
        // Use configured server URL if provided, otherwise fall back to same origin (works on Vercel)
        const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
        const audioEndpoint = configuredServerUrl
          ? `${configuredServerUrl}/api/audio/generate`
          : "/api/audio/generate";

        const token = await getToken();
        const response = await fetch(audioEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
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
      
      // 6. Generate fresh URL from storageId (direct API call)
      if (storageId) {
        const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "vocabulary:getAudioUrlFromStorageId",
            args: { storageId },
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get audio URL: ${response.status}`);
        }
        
        const result = await response.json();
        const audioUrl = result.value;
        
        if (!audioUrl) {
          throw new Error("Failed to generate audio URL from storageId");
        }
        
        const audio = new Audio(audioUrl);
        audio.preload = "auto";

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

        await whenAudioCanPlayThrough(audio);
        await audio.play();
      }
    } catch (error) {
      console.error("Failed to get audio:", error);
      setLoadingAudioId(null);
      // Optionally show toast error message
      // Show user-friendly error
      const errorMessage = error instanceof Error && error.message === "Failed to fetch" 
        ? "Server not reachable. Please ensuring 'pnpm dev:server' is running."
        : "Failed to generate audio. Please try again.";
        
      alert(errorMessage);
    }
  };

  // Single source of truth for both the word list and per-word progress in
  // Learn/Quiz mode. Always unscoped (all units), so unit-mastery stars for
  // units other than the currently selected one keep working, and so the
  // visible word list and its progress always come from the exact same
  // release-gated courseVocabulary row.
  //
  // Previously this page combined getAllCourseVocabulary (word list, ignores
  // releaseStatus) with getVocabularyWithProgress (progress, published-only
  // for non-superadmins) and a getUserVocabularyProgress fallback matched by
  // serbian+unit. During a content preview those three could disagree: the
  // word list would show a "preview" duplicate of a word while the learner's
  // real progress (correctAnswerCount) sat on the "published" duplicate -
  // invisible to the ID-based progress lookup, so mastery/"new words only"
  // treated an already-answered word as brand new while the badge (via the
  // serbian+unit fallback) still showed the real count. Using this single,
  // release-gated query for both the list and the progress lookup removes
  // that split entirely.
  const vocabWithProgress = useQuery(
    api.vocabulary.getVocabularyWithProgress,
    (mode === 'learn' || mode === 'quiz') ? { unitNumber: undefined } : "skip"
  ) as VocabWithProgressItem[] | undefined;

  // finalScore is passed explicitly by the caller (the score just computed
  // for the last answer), rather than read from the `score` state closure.
  // handleQuizComplete is invoked from inside handleSubmitAnswer via
  // setTimeout, so by the time it runs the `score` state closed over at
  // render time is already one answer behind - reading it directly would
  // save/display a score missing the final answer (or, since the bounds
  // effect no longer resets score while quizFinished, could otherwise still
  // be correct - but relying on that coupling is fragile).
  const handleQuizComplete = async (finalScore: { correct: number; total: number }) => {
    const earnedXP = calculateXP(finalScore.correct, finalScore.total);
    setXpEarned(earnedXP);
    
    const unitToSave = selectedUnit === 'all' ? 0 : (selectedUnit as number);
    const scorePercentage = finalScore.total > 0
      ? Math.round((finalScore.correct / finalScore.total) * 100)
      : 0;

    // Vocabulary XP is awarded server-side per answer via recordVocabularyAnswer.
    // The legacy client-side "addExerciseCompletion" call was removed as part of
    // the XP-injection security fix (see convex/exercises.ts addCompletion).

    // Reset currentIndex in DB to 0 so next quiz starts fresh
    await updateQuizProgressMutation({
      unitNumber: unitToSave,
      currentIndex: 0,
      lastScore: scorePercentage,
      });
    
    // Mark that we just completed a quiz (prevents auto-select from triggering)
    setRecentQuizCompletion(true);
    
    // Auto-advance to next unit if 100%
    if (selectedUnit !== 'all' && typeof selectedUnit === 'number' && scorePercentage === 100) {
      const nextUnit = selectedUnit + 1;
      if (nextUnit <= availableUnits[availableUnits.length - 1]) {
        // Wait a moment to show completion, then HARD REDIRECT to next unit
        // Keep isManualSelection=true to prevent auto-select useEffect from triggering
        setTimeout(() => {
          // Reset flags before redirect so new page starts fresh
          setIsManualSelection(false);
          setRecentQuizCompletion(false);
          window.location.href = `/vocabulary?unit=${nextUnit}`;
        }, 3000); // 3 seconds to celebrate success
      }
    }
  };

  // Load quiz progress from localStorage FIRST (immediate), then sync with database
  useEffect(() => {
    if (mode === 'quiz' && user) {
      setIsLoadingProgress(true);
      
      // ONLY load progress on initial load (when quiz hasn't started yet)
      // This prevents resetting currentIndex on every quizProgress update
      if (!quizStarted) {
        // 1. Load from localStorage immediately
        const storageKey = getStorageKey();
        const savedProgress = localStorage.getItem(storageKey);
        
        if (savedProgress) {
          try {
            const progress = JSON.parse(savedProgress);
            // Reset to 0 when restarting - filtered vocab will show only non-mastered words
            setCurrentIndex(0);
            setScore(progress.score || { correct: 0, total: 0 });
            setLastQuizProgress(progress);
          } catch (e) {
            console.error('Failed to parse quiz progress from localStorage', e);
          }
        }
        
        // 2. Sync with database in background (initial load only)
        if (quizProgress) {
          setLastQuizProgress(quizProgress);
          // Always start at index 0 - filtered vocab handles showing only non-mastered words
          setCurrentIndex(0);
        }
        
        setQuizStarted(true);
      } else {
        // Quiz already started - just update lastQuizProgress without touching currentIndex
        if (quizProgress) {
          setLastQuizProgress(quizProgress);
        }
      }
      
      setIsLoadingProgress(false);
    } else {
      setIsLoadingProgress(false);
    }
  }, [mode, selectedUnit, user, quizProgress, quizStarted]);

  // Read unit and mode parameters from URL and set them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unitParam = params.get('unit');
    const modeParam = params.get('mode');
    if (unitParam) {
      const unitNum = parseInt(unitParam);
      if (!isNaN(unitNum) && unitNum >= 1) {
        setSelectedUnit(unitNum);
      }
    }
    if (modeParam === 'quiz' && mode !== 'quiz') {
      setMode('quiz');
      setIsManualSelection(true);
    }
  }, [location]);

  // SMART: Auto-select next incomplete unit when in quiz mode
  useEffect(() => {
    // Basic checks
    if (mode !== 'quiz') return;
    if (!availableUnits.length) return;
    if (!allQuizProgress || allQuizProgress.length === 0) return;
    
    // Don't override manual unit selections - user chose this unit intentionally!
    if (isManualSelection) {
      return;
    }
    
    // Don't auto-redirect after quiz completion (let handleQuizComplete handle it)
    if (recentQuizCompletion) {
      return;
    }
    
    // Don't override URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('unit')) {
      return;
    }
    
    // Check CURRENT selected unit
    let shouldSwitch = false;
    let targetUnit: number | null = null;
    
    if (selectedUnit !== 'all' && typeof selectedUnit === 'number') {
      const currentProgress = allQuizProgress.find((p: QuizProgressDoc) => p.unitNumber === selectedUnit);
      
      // If current unit is 100% completed, we need to switch
      if (currentProgress && currentProgress.lastScore === 100 && currentProgress.totalAttempts > 0) {
        shouldSwitch = true;
        
        // Find next incomplete unit
        for (let i = selectedUnit + 1; i <= availableUnits[availableUnits.length - 1]; i++) {
          const progress = allQuizProgress.find((p: QuizProgressDoc) => p.unitNumber === i);
          if (!progress || progress.lastScore !== 100 || progress.totalAttempts === 0) {
            targetUnit = i;
            break;
          }
        }
        
        // All remaining units are also 100%? Loop back to first
        if (targetUnit === null) {
          targetUnit = availableUnits[0];
        }
      }
    }
    
    // If "all units" is selected, DON'T auto-switch - user chose "all" intentionally
    // Only switch away from completed individual units
    if (selectedUnit === 'all') {
      return; // Don't interfere with "All units" selection
    }
    
    // Execute the switch with HARD REDIRECT
    if (shouldSwitch && targetUnit !== null && targetUnit !== selectedUnit) {
      window.location.href = `/vocabulary?unit=${targetUnit}`;
    }
  }, [mode, selectedUnit, availableUnits, allQuizProgress, isManualSelection, recentQuizCompletion]);

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter vocabulary by unit and access. Learn and Quiz mode both read from
  // the same release-gated vocabWithProgress list (see query comment above).
  const filteredVocab = useMemo<VocabItem[]>(() => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) {
      // Expected during initial load - don't log as error
      return [];
    }

    let vocab = selectedUnit === 'all'
      ? vocabWithProgress
      : vocabWithProgress.filter((v) => v.unitNumber === selectedUnit);

    // Beta/Subscription Beschraenkung
    if (accessInfo && accessInfo.maxUnits > 0) {
      vocab = vocab.filter((v) => v.unitNumber <= accessInfo.maxUnits);
    }

    if (mode === 'quiz') {
      // Filter out mastered words (correctAnswerCount >= 3) and, when the
      // "new words only" filter is on, anything already answered correctly
      // at least once. Progress here comes from the exact same document as
      // the word itself, so this can never disagree with the progress badge.
      vocab = vocab.filter((word) => {
        const optimisticKey = String(word._id);
        const optimistic = optimisticProgress.get(optimisticKey);
        const correctCount = optimistic?.correctAnswerCount ?? word.progress?.correctAnswerCount ?? 0;

        // Mastered words (correctAnswerCount >= 3) never appear in the quiz
        if (correctCount >= 3) return false;

        // "New words only" filter: only words never answered correctly.
        // Mastery (3x correct) is unreachable while this filter is on, since
        // a word leaves the pool after its very first correct answer.
        if (newWordsOnly && correctCount > 0) return false;

        return true;
      });
    }

    // Map to format compatible with existing code
    const mappedVocab: VocabItem[] = vocab.map((word) => ({
      _id: word._id,
      serbian: word.serbian,
      serbianWord: word.serbian, // For compatibility
      unit: word.unitNumber,
      unitNumber: word.unitNumber,
      en: word.en,
      de: word.de,
      noteEn: word.noteEn,
      noteDe: word.noteDe,
      noteEs: word.noteEs,
      noteFr: word.noteFr,
      noteSr: word.noteSr,
    }));

    // Quiz mode requires a translation to type against; Learn mode shows the
    // word regardless (falls back to a "missing translation" label).
    const visibleVocab = mode === 'quiz'
      ? mappedVocab.filter((word) => Boolean(translationForLanguage(word, userLanguage)))
      : mappedVocab;

    // Sort by unitNumber (ascending), then alphabetically by serbian
    return visibleVocab.sort((a, b) => {
      if (a.unitNumber !== b.unitNumber) {
        return a.unitNumber - b.unitNumber;
      }
      return a.serbian.localeCompare(b.serbian);
    });
  }, [selectedUnit, accessInfo, mode, userLanguage, optimisticProgress, vocabWithProgress, newWordsOnly]);

  // Used only for the empty-state message: are there still unmastered words
  // in the current unit/access selection once the "new words only" filter is
  // ignored? Distinguishes "everything mastered" from "everything has been
  // answered correctly once, but 2nd/3rd repetitions are still pending" (in
  // which case the user must turn the filter off to continue toward mastery).
  const hasRemainingUnmasteredWords = useMemo(() => {
    if (mode !== 'quiz' || !vocabWithProgress || vocabWithProgress.length === 0) return false;

    let vocab = selectedUnit === 'all'
      ? vocabWithProgress
      : vocabWithProgress.filter((v) => v.unitNumber === selectedUnit);

    if (accessInfo && accessInfo.maxUnits > 0) {
      vocab = vocab.filter((v) => v.unitNumber <= accessInfo.maxUnits);
    }

    return vocab.some((word) => {
      const optimisticKey = String(word._id);
      const optimistic = optimisticProgress.get(optimisticKey);
      const correctCount = optimistic?.correctAnswerCount ?? word.progress?.correctAnswerCount ?? 0;
      return correctCount < 3;
    });
  }, [mode, vocabWithProgress, selectedUnit, accessInfo, optimisticProgress]);

  const currentWord = filteredVocab[currentIndex];
  const progressPercent = filteredVocab.length > 0 ? ((currentIndex + 1) / filteredVocab.length) * 100 : 0;
  
  // Get progress for current word (with optimistic updates)
  // Use answeredWord during feedback, otherwise use currentWord
  const currentWordProgress = useMemo(() => {
    // During feedback, use answeredWord to ensure we show progress for the word that was answered
    const wordToCheck = (showAnswer && answeredWord) ? answeredWord : currentWord;
    if (!wordToCheck) return null;
    
    // Use courseVocabularyId for optimistic updates.
    const optimisticKey = String(wordToCheck._id);
    const optimistic = optimisticProgress.get(optimisticKey);
    
    // Progress comes from the same release-gated vocabWithProgress row as the
    // word itself (matched by exact courseVocabularyId) - no more serbian+unit
    // fallback, which could previously surface progress from a different
    // (e.g. archived or differently-versioned) duplicate of the same word.
    const dbProgress = vocabWithProgress?.find((p) => p._id === wordToCheck._id)?.progress ?? null;
    
    if (optimistic && dbProgress) {
      // Merge optimistic update with database data
      return {
        ...dbProgress,
        correctAnswerCount: optimistic.correctAnswerCount,
        incorrectAnswerCount: optimistic.incorrectAnswerCount,
        mastered: optimistic.correctAnswerCount >= 3,
      };
    } else if (optimistic) {
      // Only optimistic update available (word not yet in DB)
      return {
        serbianWord: wordToCheck.serbian,
        unitNumber: wordToCheck.unit,
        correctAnswerCount: optimistic.correctAnswerCount,
        incorrectAnswerCount: optimistic.incorrectAnswerCount,
        mastered: optimistic.correctAnswerCount >= 3,
      } as any;
    }
    
    return dbProgress;
  }, [currentWord, answeredWord, showAnswer, vocabWithProgress, optimisticProgress]);

  // Reset currentIndex if it's out of bounds (e.g., the last word left the
  // filtered pool via mastery or the "new words only" filter). Skipped while
  // the completion card is showing (quizFinished), otherwise this would wipe
  // the session score the completion card still needs to display.
  useEffect(() => {
    if (quizFinished) return;
    if (currentIndex >= filteredVocab.length && filteredVocab.length > 0) {
      setCurrentIndex(0);
      setScore({ correct: 0, total: 0 });
    }
  }, [currentIndex, filteredVocab.length, quizFinished]);

  const handleNext = () => {
    if (currentIndex < filteredVocab.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
      setHasCaseHint(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
      setHasCaseHint(false);
    }
  };

  // Handle moving to next word (used for manual "Weiter" button click AND auto-advance)
  // Only ever called when the quiz round is NOT finished (guarded by
  // !quizFinished at the call sites), so there is always a next word to show.
  const handleNextWord = useCallback(() => {
    // Reset UI state to show next word
    setShowAnswer(false);
    setUserAnswer('');
    setIsCorrect(null);
    setHasCaseHint(false);
    setCurrentCorrectTranslation(null);
    setAnsweredWord(null);
    
    // If the just-answered word left the quiz pool (mastered, or excluded by
    // the "new words only" filter), the next word already occupies the
    // current index once the list re-filters - advancing again would skip
    // it. Otherwise the word stays in the pool, so advance by one as usual.
    const removedFromPool = wordRemovedFromPoolRef.current;
    wordRemovedFromPoolRef.current = false;
    if (!removedFromPool) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    }
  }, []);

  // Handle auto-advance setting change
  const handleAutoAdvanceChange = (checked: boolean) => {
    setAutoAdvance(checked);
    localStorage.setItem('vocab_quiz_auto_advance', checked.toString());
  };

  // Handle "new words only" filter change - the pool composition changes, so
  // reset the round like a unit/mode switch does.
  const handleNewWordsOnlyChange = (checked: boolean) => {
    setNewWordsOnly(checked);
    localStorage.setItem('vocab_quiz_new_words_only', checked.toString());
    handleReset();
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentWord) return;
    
    // Store the current word AND current index IMMEDIATELY to prevent them from changing
    const wordToAnswer = currentWord;
    const currentIndexSnapshot = currentIndex;
    const filteredVocabLengthSnapshot = filteredVocab.length;
    
    // One primary translation per learner language. Further senses live in the
    // note (`AlsoMeaning` / `Auch` / `Bedeutet auch`) and count as correct.
    // Usage text in the same note does not. No cross-language fallback.
    const correctTranslationForWord = translationForLanguage(wordToAnswer, userLanguage);
    if (!correctTranslationForWord) {
      return;
    }

    const grade = gradeVocabularyAnswer({
      userAnswer,
      primaryTranslation: correctTranslationForWord,
      note: noteForLanguage(wordToAnswer, userLanguage),
    });
    const correct = grade.correct;
    const caseMismatch = grade.caseMismatch;

    // Computed once here so every consumer (state, localStorage, DB save,
    // and handleQuizComplete on the last word) agrees on the exact same
    // score - reading the `score` state again later in this closure would
    // return the pre-update value, since setScore below hasn't re-rendered yet.
    const newScore = { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 };

    setIsCorrect(correct);
    setHasCaseHint(caseMismatch);
    setScore(newScore);
    // Store the current word and translation before showing answer (to prevent them from changing)
    setAnsweredWord(wordToAnswer);
    setCurrentCorrectTranslation(grade.matchedForm ?? correctTranslationForWord);
    setShowAnswer(true);

    // Save answer to vocabulary tracking in quiz mode
    if (mode === 'quiz' && wordToAnswer) {
      // Optimistic update: Update local state immediately
      // NEW: Use courseVocabularyId for optimistic key (if available)
      // FALLBACK: Use old serbian:unit format for backward compatibility
      const optimisticKey = String(wordToAnswer._id);
      const currentProgress = currentWordProgress;
      const currentCorrectCount = currentProgress?.correctAnswerCount || 0;
      const currentIncorrectCount = currentProgress?.incorrectAnswerCount || 0;
      
      const newCorrectCount = correct ? currentCorrectCount + 1 : currentCorrectCount;
      const newIncorrectCount = correct ? currentIncorrectCount : currentIncorrectCount + 1;
      
      // Track whether this answer removes the word from the quiz pool
      // (mastery reached, or excluded by the "new words only" filter), so
      // handleNextWord below can navigate to the correct next word without
      // skipping one once the list re-filters.
      wordRemovedFromPoolRef.current =
        correct && (newCorrectCount >= 3 || (newWordsOnly && newCorrectCount > 0));
      
      // Update optimistic progress immediately
      setOptimisticProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(optimisticKey, {
          correctAnswerCount: newCorrectCount,
          incorrectAnswerCount: newIncorrectCount,
        });
        return newMap;
      });
      
      // Progressive XP-System: Award XP immediately for correct answers
      let earnedXP = 0;
      if (correct) {
        // XP based on repetition level (Spaced Repetition Bonus)
        if (currentCorrectCount === 0) {
          earnedXP = 5; // 1st time correct
        } else if (currentCorrectCount === 1) {
          earnedXP = 10; // 2nd time correct
        } else if (currentCorrectCount === 2) {
          earnedXP = 20; // 3rd time correct (Mastered!)
        }
        
        // Optimistic XP display only. The authoritative XP is awarded
        // server-side by recordVocabularyAnswer (see below), which computes the
        // amount from the server-tracked repetition level. We no longer send a
        // client-computed xpEarned to the backend.
        setSessionXP(prev => prev + earnedXP);
        setXpEarned(prev => prev + earnedXP);
      }
      
      // Save to database
      try {
        // NEW: Use courseVocabularyId (preferred)
        // FALLBACK: Use serbianWord + unitNumber for backward compatibility
        const recorded = wordToAnswer._id
          ? await recordVocabularyAnswerMutation({
              courseVocabularyId: wordToAnswer._id,
              isCorrect: correct,
            })
          : await recordVocabularyAnswerMutation({
              serbianWord: wordToAnswer.serbian,
              unitNumber: wordToAnswer.unit || wordToAnswer.unitNumber,
              isCorrect: correct,
            });
        if ((recorded as { unitCompleted?: boolean } | null)?.unitCompleted) {
          toast.success(t("unit.unitCompleted"));
        }
        
        // Convex will automatically revalidate the query, which will update vocabWithProgress
        // The optimistic update will be replaced by the real data when it arrives
      } catch (e) {
        console.error('Failed to record vocabulary answer', e);
        // Revert optimistic update on error
        setOptimisticProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(optimisticKey);
          return newMap;
        });
      }
    }

    // Save answer to BOTH localStorage and database in quiz mode
    if (mode === 'quiz') {
      const newIndex = currentIndex + 1;
      const newScorePercentage = newScore.total > 0
        ? Math.round((newScore.correct / newScore.total) * 100)
        : 0;

      // 1. Save to localStorage immediately (fast, reliable)
      const storageKey = getStorageKey();
      const progressData = {
        currentIndex: newIndex,
        score: newScore,
        lastScore: newScorePercentage,
        totalAttempts: (lastQuizProgress?.totalAttempts || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(progressData));
      
      // 2. Save to database in background (persistent across devices)
      const unitToSave = selectedUnit === 'all' ? 0 : (selectedUnit as number);
      try {
        // Save quiz progress for current unit/selection
        await updateQuizProgressMutation({
          unitNumber: unitToSave,
          currentIndex: newIndex,
          lastScore: newScorePercentage,
          incrementAttempts: true,
        });
      } catch (e) {
        console.error('Failed to save quiz progress to database', e);
        // localStorage still has the progress, so user won't lose data
      }
    }
    
    // Check if this was the last word (use snapshot to avoid race conditions)
    const isLastWord = currentIndexSnapshot === filteredVocabLengthSnapshot - 1;
    
    if (isLastWord) {
      // Don't reset showAnswer - keep it true to show complete screen
      // Mark the round as finished via state (not the live, possibly already
      // shifted currentIndex/filteredVocab.length) so the "Weiter" button and
      // completion card render correctly regardless of pool removal.
      setQuizFinished(true);
      // Call handleQuizComplete to save results and XP, passing the score
      // computed above directly (avoids the stale `score` closure - see
      // handleQuizComplete's own comment).
      setTimeout(async () => {
        await handleQuizComplete(newScore);
      }, 100);
      return;
    }
    
    // DON'T increment index here - let handleNextWord do it when user clicks "Weiter"
    // This prevents race conditions with filteredVocab changes
    
    // Only auto-advance if setting is enabled (reset UI state AND increment index after delay)
    if (autoAdvance) {
      setTimeout(() => {
        handleNextWord();
      }, 2000);
    }
    // If autoAdvance is false, user will click "Weiter" button to continue
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setScore({ correct: 0, total: 0 });
    setUserAnswer('');
    setIsCorrect(null);
    setHasCaseHint(false);
    setXpEarned(0);
    setSessionXP(0); // Reset session XP
    setQuizStarted(false);
    setQuizFinished(false);
    setCurrentCorrectTranslation(null);
    setAnsweredWord(null);
    wordRemovedFromPoolRef.current = false;
    
    // Clear localStorage
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
  };

  const calculateXP = (correct: number, total: number): number => {
    const percentage = (correct / total) * 100;
    if (percentage === 100) return total * 10;
    if (percentage >= 80) return Math.floor(total * 8);
    if (percentage >= 60) return Math.floor(total * 5);
    if (percentage >= 40) return Math.floor(total * 3);
    return Math.floor(total * 1);
  };

  // Effective correct-answer count for a word, including optimistic quiz updates
  // so the pass/mastery card can react immediately after the last answer.
  // Plain helpers (not hooks): this block sits after the !user early return,
  // matching the existing pattern for filteredVocab-related helpers.
  const getEffectiveCorrectCount = (word: VocabWithProgressItem): number => {
    const optimistic = optimisticProgress.get(String(word._id));
    return optimistic?.correctAnswerCount ?? word.progress?.correctAnswerCount ?? 0;
  };

  // Unit passed = every word in the unit answered correctly at least once.
  const isUnitPassed = (unitNumber: number): boolean => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) return false;
    const unitVocab = vocabWithProgress.filter((word) => word.unitNumber === unitNumber);
    if (unitVocab.length === 0) return false;
    return unitVocab.every((word) => getEffectiveCorrectCount(word) >= 1);
  };

  // Unit mastered = every word correct at least 3 times (full XP per word).
  const isUnitMastered = (unitNumber: number): boolean => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) return false;
    const unitVocab = vocabWithProgress.filter((word) => word.unitNumber === unitNumber);
    if (unitVocab.length === 0) return false;
    return unitVocab.every((word) => getEffectiveCorrectCount(word) >= 3);
  };

  // Total XP earned so far in a unit (sum of spaced-repetition XP per word).
  const getUnitXpTotal = (unitNumber: number): number => {
    if (!vocabWithProgress || vocabWithProgress.length === 0) return 0;
    return vocabWithProgress
      .filter((word) => word.unitNumber === unitNumber)
      .reduce(
        (sum, word) => sum + cumulativeSpacedRepetitionXp(getEffectiveCorrectCount(word)),
        0
      );
  };

  const selectedUnitPassed =
    selectedUnit !== "all" && typeof selectedUnit === "number" && isUnitPassed(selectedUnit);
  const selectedUnitMastered =
    selectedUnit !== "all" && typeof selectedUnit === "number" && isUnitMastered(selectedUnit);
  const selectedUnitXpTotal =
    selectedUnit !== "all" && typeof selectedUnit === "number"
      ? getUnitXpTotal(selectedUnit)
      : 0;

  return (
    <AnimatedPage>
      {/* Screen-reader title (visual title handled by TopNavigation active state) */}
      <h1 className="sr-only">{t("vocabulary.title")}</h1>

      <div className="w-full space-y-6">
        {/* Mode Selection */}
        <AnimatedItem>
          <Card>
            <CardHeader>
              <CardTitle>{t('vocabulary.practiceMode')}</CardTitle>
              <CardDescription>{t('vocabulary.practiceMode.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant={mode === 'learn' ? 'default' : 'outline'}
                  onClick={() => { 
                    setMode('learn'); 
                    handleReset(); 
                  }}
                  className="flex-1 gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  {t('vocabulary.learnMode')}
                </Button>
                <Button
                  variant={mode === 'quiz' ? 'default' : 'outline'}
                  onClick={() => { 
                    setMode('quiz'); 
                    handleReset(); 
                  }}
                  className={
                    mode === "quiz"
                      ? "flex-1 gap-2"
                      : "flex-1 gap-2 border-[color:var(--accent)] text-foreground hover:bg-[color:var(--accent)]/10 hover:border-[color:var(--accent)]"
                  }
                >
                  <Star className={mode === "quiz" ? "h-4 w-4" : "h-4 w-4 text-[color:var(--accent)]"} />
                  {t('vocabulary.quizMode')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedItem>

        {/* Progress */}
        <AnimatedItem>
          <Card>
            <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('vocabulary.progress')}</span>
                <span>{currentIndex + 1} / {filteredVocab.length}</span>
              </div>
              <Progress value={progressPercent} />
              {mode === 'quiz' && score.total > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {t('vocabulary.score', {
                    correct: score.correct,
                    total: score.total,
                    percent: Math.round((score.correct / score.total) * 100),
                  })}
                </div>
              )}
              {mode === 'quiz' && sessionXP > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                  <span className="font-semibold text-yellow-700">{t('vocabulary.sessionXp', { xp: sessionXP })}</span>
                  <GamificationModal trigger={
                    <button className="text-blue-600 hover:text-blue-700 underline text-xs">
                      {t('vocabulary.xpHowItWorks')}
                    </button>
                  } />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </AnimatedItem>

        {/* Unit Filter */}
        <AnimatedItem>
          <Card>
            <CardHeader>
              <CardTitle>{t('vocabulary.filterByUnit')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedUnit === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { 
                    setIsManualSelection(true); // Mark as manual selection
                    setRecentQuizCompletion(false); // Reset quiz completion flag
                    setSelectedUnit('all'); 
                    handleReset(); 
                  }}
                >
                  {t('vocabulary.allUnits')}
                </Button>
                {(availableUnits as number[]).map((unit: number) => {
                  const mastered = isUnitMastered(unit);
                  const isSelected = selectedUnit === unit;
                  return (
                    <Button
                      key={unit}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={mastered && !isSelected ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500' : ''}
                      onClick={() => { 
                        setIsManualSelection(true); // Mark as manual selection
                        setRecentQuizCompletion(false); // Reset quiz completion flag
                        setSelectedUnit(unit); 
                        handleReset(); 
                      }}
                    >
                      {mastered && (
                        <Star className="h-4 w-4 mr-1.5 text-white fill-white" />
                      )}
                      {t('vocabulary.unit', { number: unit })}
                    </Button>
                  );
                })}
              </div>
              {mode === 'quiz' && (
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    {t('vocabulary.newWordsOnly.description')}
                  </p>
                  <Switch
                    id="new-words-only"
                    checked={newWordsOnly}
                    onCheckedChange={handleNewWordsOnlyChange}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedItem>
        {/* Flashcard */}
        {currentWord ? (
          <AnimatedItem>
            <Card className="min-h-[300px] sm:min-h-[400px] flex flex-col">
            <CardContent className="text-center space-y-6 py-8">
              {/* Header: Unit Badge + Last Attempt Info */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  {/* Unit Badge nur anzeigen wenn "All Units" ausgewaehlt ist */}
                  {selectedUnit === 'all' && (
                    <Badge variant="outline">
                      {t('vocabulary.unit', { number: (showAnswer && answeredWord ? answeredWord : currentWord).unit })}
                    </Badge>
                  )}
                </div>
                {mode === 'quiz' && lastQuizProgress && lastQuizProgress.lastScore > 0 && (
                  <div className="text-xs text-muted-foreground bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                    {t('vocabulary.lastAttempt', { score: lastQuizProgress.lastScore, attempts: lastQuizProgress.totalAttempts })}
                  </div>
                )}
              </div>

              {/* Word Section */}
              <div className="space-y-4">
                {/* Vokabel immer anzeigen (auch waehrend Feedback) */}
                {/* Use answeredWord during feedback, otherwise use currentWord */}
                {(() => {
                  const displayWord = showAnswer && answeredWord ? answeredWord : currentWord;
                  if (!displayWord) return null;
                  
                  return (
                    <div>
                    {/* Audio Icon ueber der Vokabel */}
                    {displayWord._id && (
                      <div className="flex justify-center mb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          onClick={() => handlePlayAudio(displayWord._id!, displayWord.serbian)}
                          disabled={loadingAudioId === displayWord._id}
                          title={loadingAudioId === displayWord._id ? "Generating audio..." : "Play pronunciation"}
                        >
                          {loadingAudioId === displayWord._id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Volume2 className={`h-5 w-5 ${playingAudioId === displayWord._id ? "text-primary" : ""}`} />
                          )}
                        </Button>
                      </div>
                    )}
                    {/* Vokabel */}
                    <div className="flex items-center justify-center mb-2">
                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                        {displayWord.serbian}
                      </h2>
                    </div>
                {/* Progress indicator with numbers or star */}
                {(mode === 'quiz' || mode === 'learn') && (
                  <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    {(() => {
                      // Get correct and incorrect counts with fallback
                      const correctCount = currentWordProgress?.correctAnswerCount ?? 0;
                      const incorrectCount = currentWordProgress?.incorrectAnswerCount ?? 0;
                      
                      // Wenn 3x richtig beantwortet: goldener Stern
                      if (correctCount >= 3) {
                        return (
                          <Badge className="bg-yellow-500 text-white gap-1">
                            <Star className="h-3 w-3 fill-white text-white" />
                            {t("common.mastered")}
                          </Badge>
                        );
                      }
                      
                      // Anzeige fuer richtige Antworten
                      if (correctCount > 0) {
                        return (
                          <>
                            <Badge variant="outline" className="text-sm">
                              {correctCount}/3
                            </Badge>
                            {incorrectCount > 0 && (
                              <Badge variant="outline" className="text-sm text-red-600 border-red-300 gap-1">
                                <XCircle className="h-3 w-3" />
                                {incorrectCount} {t("vocabulary.incorrect")}
                              </Badge>
                            )}
                          </>
                        );
                      }
                      
                      // Nur falsche Antworten (noch nie richtig)
                      if (incorrectCount > 0) {
                        return (
                          <Badge variant="outline" className="text-sm text-red-600 border-red-300 gap-1">
                            <XCircle className="h-3 w-3" />
                            {incorrectCount} {t("vocabulary.incorrect")}
                          </Badge>
                        );
                      }
                      
                      // Noch nie beantwortet: nichts anzeigen
                      return null;
                    })()}
                  </div>
                )}
                    {/* Quiz: Note erst nach der Antwort unter der Vokabel, damit sie die Loesung nicht vorwegnimmt */}
                    {mode === 'quiz' && showAnswer && (() => {
                      const word = answeredWord || displayWord;
                      const note = noteForLanguage(word, userLanguage);
                      return note ? (
                        <p className="text-muted-foreground mt-2 italic text-[0.85rem]">
                          {note}
                        </p>
                      ) : null;
                    })()}
                    {/* Uebersetzung nur im Learn-Mode anzeigen (im Quiz-Modus wird sie im Feedback-Bereich angezeigt) */}
                    {mode === 'learn' && (
                      <>
                        <p className="text-xl sm:text-2xl text-muted-foreground mt-4">
                          {resolveTranslationLabel(
                            showAnswer && answeredWord ? answeredWord : displayWord
                          )}
                        </p>
                        {/* Note anzeigen wenn vorhanden */}
                        {(() => {
                          const word = showAnswer && answeredWord ? answeredWord : displayWord;
                          const note = noteForLanguage(word, userLanguage);
                          return note ? (
                            <p className="text-muted-foreground mt-2 italic text-[0.85rem]">
                              {note}
                            </p>
                          ) : null;
                        })()}
                      </>
                    )}
                  </div>
                );
              })()}
              </div>

              {/* Input/Feedback Section */}
              {mode === 'learn' ? (
                <div className="space-y-3">
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={currentIndex === 0}
                    >
                      {t('vocabulary.previous')}
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={currentIndex === filteredVocab.length - 1}
                    >
                      {t('vocabulary.next')}
                    </Button>
                  </div>
                  {currentWord && (
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground gap-1.5"
                        onClick={() =>
                          openBuddyModal(
                            t("buddy.prefill.explainWord", { word: currentWord.serbian }),
                            currentWord.unitNumber
                          )
                        }
                      >
                        <Brain className="h-3.5 w-3.5" />
                        {t('vocabulary.askBuddy', 'Ask Learn Buddy')}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 max-w-md mx-auto w-full">
                  {!showAnswer ? (
                    <>
                      <div className="text-sm text-muted-foreground mb-2">
                        {t('vocabulary.typeTranslation')}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('vocabulary.yourAnswer')}
                          value={userAnswer}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSubmitAnswer()}
                          disabled={showAnswer}
                          className="text-lg"
                          autoFocus
                        />
                        <Button
                          onClick={handleSubmitAnswer}
                          disabled={!userAnswer.trim()}
                          size="lg"
                        >
                          {t('vocabulary.submit')}
                        </Button>
                      </div>
                      {/* Auto-advance setting for quiz mode */}
                      {mode === 'quiz' && (
                        <div className="flex items-center justify-between gap-2 pt-4 border-t">
                          <p className="text-xs text-muted-foreground">
                            {t('vocabulary.autoAdvance.description')}
                          </p>
                          <Switch
                            id="auto-advance"
                            checked={autoAdvance}
                            onCheckedChange={handleAutoAdvanceChange}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="feedback"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ 
                          type: "spring", 
                          stiffness: 300, 
                          damping: 25,
                          duration: 0.4
                        }}
                        className="space-y-4"
                      >
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                          className={`p-6 rounded-xl border-2 shadow-sm ${
                            isCorrect 
                              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-300' 
                              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300'
                          }`}
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.15 }}
                            className="flex items-center justify-center gap-2 mb-4"
                          >
                            {isCorrect ? (
                              <>
                                <CheckCircle className="h-7 w-7 text-green-600" />
                                <span className="text-xl font-semibold text-green-700">{t('vocabulary.correct')}</span>
                                {/* Show XP earned for this answer */}
                                {mode === 'quiz' && (() => {
                                  const currentProgress = currentWordProgress;
                                  const correctCount = currentProgress?.correctAnswerCount || 0;
                                  let xpForAnswer = 0;
                                  if (correctCount === 1) xpForAnswer = 5;
                                  else if (correctCount === 2) xpForAnswer = 10;
                                  else if (correctCount === 3) xpForAnswer = 20;
                                  
                                  if (xpForAnswer > 0) {
                                    return (
                                      <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.2 }}
                                      >
                                        <Badge className="bg-yellow-500 text-white ml-2 text-sm px-3 py-1">
                                          +{xpForAnswer} XP
                                        </Badge>
                                      </motion.div>
                                    );
                                  }
                                  return null;
                                })()}
                              </>
                            ) : (
                              <>
                                <XCircle className="h-7 w-7 text-red-600" />
                                <span className="text-xl font-semibold text-red-700">{t('vocabulary.incorrect')}</span>
                              </>
                            )}
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="text-center space-y-3"
                          >
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">{t('vocabulary.yourAnswer')}</div>
                              <div className="font-semibold text-lg">
                                {userAnswer}
                                {/* Note direkt hinter der Antwort bei korrekter Antwort */}
                                {isCorrect && (() => {
                                  const word = answeredWord || currentWord;
                                  const note = noteForLanguage(word, userLanguage);
                                  return note ? (
                                    <span className="text-muted-foreground italic text-sm ml-2">
                                      ({note})
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                            {isCorrect && hasCaseHint && (
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="pt-3 border-t border-amber-200"
                              >
                                <div className="flex items-center justify-center gap-2 text-sm text-amber-700">
                                  <span className="font-medium">{t('vocabulary.caseHint')}</span>
                                  <span className="font-semibold">{currentCorrectTranslation}</span>
                                </div>
                              </motion.div>
                            )}
                            {!isCorrect && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.35 }}
                                className="pt-3 border-t border-red-200"
                              >
                                <div className="text-xs text-muted-foreground mb-1">{t('vocabulary.correctAnswer')}</div>
                                <div className="font-semibold text-lg text-green-700">
                                  {currentCorrectTranslation ||
                                    resolveTranslationLabel(answeredWord || currentWord)}
                                </div>
                                {/* Note anzeigen wenn vorhanden */}
                                {(() => {
                                  const word = answeredWord || currentWord;
                                  const note = noteForLanguage(word, userLanguage);
                                  return note ? (
                                    <div className="text-muted-foreground mt-2 italic text-sm">
                                      {note}
                                    </div>
                                  ) : null;
                                })()}
                              </motion.div>
                            )}
                            {!isCorrect && (
                              <BuddyHelpHint
                                serbianWord={(answeredWord || currentWord)?.serbian}
                                correctAnswer={
                                  currentCorrectTranslation ||
                                  translationForLanguage(answeredWord || currentWord, userLanguage)
                                }
                                userAnswer={userAnswer}
                                unitNumber={(answeredWord || currentWord)?.unitNumber}
                                questionContext="vocabulary-quiz"
                              />
                            )}
                          </motion.div>
                        </motion.div>
                        {/* Auto-advance setting for quiz mode */}
                        {mode === 'quiz' && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center justify-between gap-2 pt-4 border-t"
                          >
                            <p className="text-xs text-muted-foreground">
                              {t('vocabulary.autoAdvance.description')}
                            </p>
                            <Switch
                              id="auto-advance"
                              checked={autoAdvance}
                              onCheckedChange={handleAutoAdvanceChange}
                            />
                          </motion.div>
                        )}
                        {/* Weiter-Button fuer Quiz-Modus */}
                        {mode === 'quiz' && showAnswer && !quizFinished && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="flex justify-center mt-4"
                          >
                            <Button
                              onClick={handleNextWord}
                              size="lg"
                              className="min-w-[120px]"
                            >
                              {t('vocabulary.next')}
                            </Button>
                          </motion.div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              )}

              {/* Quiz Instructions - Compact */}
              {mode === 'quiz' && (
                <Collapsible className="mt-4">
                  <div className="flex justify-end">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground h-auto py-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5" />
                          <span>{t('vocabulary.quizInstructions.title')}</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="pt-2 pb-1 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-[1rem]">1.</span>
                        <span>{t('vocabulary.quizInstructions.step1')}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-[1rem]">2.</span>
                        <span>{t('vocabulary.quizInstructions.step2')}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-[1rem]">3.</span>
                        <span>{t('vocabulary.quizInstructions.step3')}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-[1rem]">4.</span>
                        <span>{t('vocabulary.quizInstructions.step4')}</span>
                      </div>
                      <div className="pt-1.5 mt-1.5 border-t text-[0.7rem] italic">
                        {t('vocabulary.quizInstructions.tip')}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
          </AnimatedItem>
        ) : (
          <AnimatedItem>
            <Card className="min-h-[200px] flex items-center justify-center">
              <CardContent className="text-center py-12 space-y-4">
                {mode === 'quiz' && newWordsOnly && hasRemainingUnmasteredWords ? (
                  <>
                    <p className="text-muted-foreground">{t('vocabulary.newWordsOnly.empty')}</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t('vocabulary.newWordsOnly.description')}
                      </span>
                      <Switch
                        id="new-words-only-empty"
                        checked={newWordsOnly}
                        onCheckedChange={handleNewWordsOnlyChange}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('vocabulary.allCorrect')}</p>
                )}
              </CardContent>
            </Card>
          </AnimatedItem>
        )}

        {/* Completed: pass card only when this specific unit is passed (every word ≥1× correct).
            Round end without pass shows a small continue CTA so the user is not stuck. */}
        {quizFinished && showAnswer && mode === 'quiz' && selectedUnitPassed && typeof selectedUnit === 'number' && (
          <AnimatedItem>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-center">
                  {t('vocabulary.unitQuizPassed', { unit: selectedUnit })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm mb-2 text-yellow-800">
                    {t('vocabulary.unitXpTotal')}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-yellow-600">
                    {selectedUnitXpTotal} XP
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('vocabulary.sessionXpHint')}
                  </p>
                </div>
                <div className="flex gap-4 justify-center flex-wrap">
                  {!selectedUnitMastered && (
                    <Button onClick={handleReset}>
                      <Star className="mr-2 h-4 w-4" />
                      {t('vocabulary.continueToMastery')}
                    </Button>
                  )}
                  {availableUnits.length > 0 &&
                    selectedUnit < availableUnits[availableUnits.length - 1]! && (
                    <Link href={`/vocabulary?unit=${selectedUnit + 1}`}>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t('vocabulary.continueToNextUnit', { next: selectedUnit + 1 })}
                      </Button>
                    </Link>
                  )}
                  <Link href="/dashboard">
                    <Button variant="outline">
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {t('vocabulary.backToDashboard')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </AnimatedItem>
        )}

        {/* Round finished but unit not yet passed: continue practicing, no "bestanden" claim */}
        {quizFinished && showAnswer && mode === 'quiz' && !selectedUnitPassed && (
          <AnimatedItem>
            <Card className="bg-muted/40 border-border">
              <CardContent className="text-center py-6 space-y-4">
                <p className="text-muted-foreground">
                  {t('vocabulary.roundComplete.keepPracticing')}
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('vocabulary.continuePracticing')}
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="outline">
                      <ArrowRight className="mr-2 h-4 w-4" />
                      {t('vocabulary.backToDashboard')}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </AnimatedItem>
        )}

        {/* Study Tips */}
        <AnimatedItem>
          <Card className="bg-serbian-blue/10 border-serbian-blue/30">
            <CardHeader>
              <CardTitle className="text-serbian-blue flex items-center gap-2">
                <Target className="h-5 w-5" />
                {t('vocabulary.tips')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-serbian-blue flex-shrink-0 mt-0.5" />
                  <span>{t('vocabulary.tip1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Volume2 className="h-4 w-4 text-serbian-blue flex-shrink-0 mt-0.5" />
                  <span>{t('vocabulary.tip2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <PenTool className="h-4 w-4 text-serbian-blue flex-shrink-0 mt-0.5" />
                  <span>{t('vocabulary.tip3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <RotateCcw className="h-4 w-4 text-serbian-blue flex-shrink-0 mt-0.5" />
                  <span>{t('vocabulary.tip4')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-serbian-blue flex-shrink-0 mt-0.5" />
                  <span>{t('vocabulary.tip5')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </AnimatedItem>
      </div>

      <footer className="w-full border-t">
        <div className="container py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-semibold">{"\u00a9"} Developed by JACKSENN.ME 2025</p>
          </div>
        </div>
      </footer>
    </AnimatedPage>
  );
}
