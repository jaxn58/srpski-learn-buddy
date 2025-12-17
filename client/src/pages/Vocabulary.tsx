import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { BookOpen, CheckCircle, XCircle, RotateCcw, ArrowRight, Info, ChevronDown, Star, Volume2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useCallback, useMemo } from "react";

// Types only - no hardcoded data imports
import type { VocabWord, SupportedLanguage } from "@shared/data";
// Sidebar import removed
import { AnimatedPage, AnimatedItem } from "@/components/AnimatedPage";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type QuizProgressDoc = Doc<"quizProgress">;
type VocabularyProgressDoc = Doc<"vocabulary">;

export default function Vocabulary() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const progress = useQuery(api.progress.getUserProgress);
  const [location] = useLocation();

  // Get accessible units from Convex
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  
  // BETA: Force English for all users
  const userLanguage: SupportedLanguage = "en";
  
  // Helper function to get note for current language
  const getNoteForLanguage = (word: any, language: SupportedLanguage): string | null => {
    if (!word) return null;
    if (language === "de") return word.noteDe || word.noteEn || null;
    if (language === "es") return word.noteEs || word.noteEn || null;
    if (language === "fr") return word.noteFr || word.noteEn || null;
    return word.noteEn || null;
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
  const [xpEarned, setXpEarned] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [lastQuizProgress, setLastQuizProgress] = useState<any>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  // Optimistic updates for vocabulary progress
  const [optimisticProgress, setOptimisticProgress] = useState<Map<string, { correctAnswerCount: number; incorrectAnswerCount: number }>>(new Map());
  // Store the correct translation for the current answer (to prevent it from changing during feedback)
  const [currentCorrectTranslation, setCurrentCorrectTranslation] = useState<string | null>(null);
  // Store the current word object when answering (to prevent it from changing during feedback)
  const [answeredWord, setAnsweredWord] = useState<VocabWord | null>(null);
  // Track if unit selection was manual (to prevent auto-redirect from interfering)
  const [isManualSelection, setIsManualSelection] = useState(false);
  // Track recent quiz completion to prevent immediate auto-redirect
  const [recentQuizCompletion, setRecentQuizCompletion] = useState(false);
  // Track XP earned in this session (for display)
  const [sessionXP, setSessionXP] = useState(0);
  // Modal state for gamification explanation
  const [showGamificationModal, setShowGamificationModal] = useState(false);
  // Auto-advance setting (load from localStorage)
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    const saved = localStorage.getItem('vocab_quiz_auto_advance');
    return saved === 'true';
  });
  
  // Audio generation mutations/actions
  // We use direct fetch for generation to avoid Cloud->Localhost issues in dev
  const updateVocabularyAudioUrl = useMutation(api.vocabulary.updateVocabularyAudioUrl);
  
  // State for audio playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Dynamically calculate available units based on access info
  const availableUnits = useMemo(() => {
    if (accessInfo && accessInfo.maxUnits > 0) {
      return Array.from({ length: Math.min(27, accessInfo.maxUnits) }, (_, i) => i + 1);
    }
    return Array.from({ length: 27 }, (_, i) => i + 1);
  }, [accessInfo]);

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
  const resetQuizProgressMutation = useMutation(api.exercises.resetQuizProgress);
  const addExerciseCompletionMutation = useMutation(api.exercises.addCompletion);
  const recordVocabularyAnswerMutation = useMutation(api.vocabulary.recordVocabularyAnswer);
  
  // Handle audio playback
  const handlePlayAudio = async (vocabularyId: string, serbianWord: string) => {
    // Prevent multiple simultaneous requests
    if (loadingAudioId || playingAudioId === vocabularyId) {
      return;
    }

    setLoadingAudioId(vocabularyId);
    
    try {
      // 1. Check if we already have the audio URL in our local data
      // For Vocabulary page, we can check vocabWithProgress or courseVocabulary
      let word: any = null;
      if (vocabWithProgress) {
        word = vocabWithProgress.find((w: any) => w._id === vocabularyId);
      }
      
      let audioUrl = word?.audioUrl;
      
      // If not in vocabWithProgress, check master list if available
      if (!audioUrl && courseVocabulary) {
        const masterWord = courseVocabulary.find((w: any) => w._id === vocabularyId);
        audioUrl = masterWord?.audioUrl;
        if (!word && masterWord) word = masterWord;
      }

      // Force regeneration if URL is from old voice (doesn't contain current version)
      if (audioUrl && !audioUrl.toLowerCase().includes('puck-v2')) {
        audioUrl = undefined;
      }

      // 2. If not found, generate it via server endpoint
      if (!audioUrl) {
        // Use Vite env var for server URL or fallback to relative path (proxy) or localhost
        const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
        
        const response = await fetch(`${serverUrl}/api/audio/generate`, {
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
        
        if (!result.success || !result.audioUrl) {
          throw new Error("Invalid response from audio generation endpoint");
        }
        
        audioUrl = result.audioUrl;
        
        // 3. Save the new URL to database
        await updateVocabularyAudioUrl({
          vocabularyId: vocabularyId as any,
          audioUrl: audioUrl!,
        });
      }
      
      if (audioUrl) {
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

  // Fetch vocabulary progress for filtering (both quiz and learn mode)
  // Load ALL units for mastery checking, not just selected unit
  const vocabProgressData = useQuery(
    api.vocabulary.getUserVocabularyProgress,
    (mode === 'quiz' || mode === 'learn') 
      ? { unitNumber: undefined } // Load all units
      : "skip"
  ) as VocabularyProgressDoc[] | undefined;

  // NEW: Fetch course vocabulary from database (for both Learn Mode and Quiz Mode)
  const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);
  const vocabWithProgress = useQuery(
    api.vocabulary.getVocabularyWithProgress,
    (mode === 'learn' || mode === 'quiz') 
      ? { unitNumber: selectedUnit === 'all' ? undefined : selectedUnit } 
      : "skip"
  );

  const handleQuizComplete = async () => {
    const earnedXP = calculateXP(score.correct, score.total);
    setXpEarned(earnedXP);
    
    const unitToSave = selectedUnit === 'all' ? 0 : (selectedUnit as number);
    const scorePercentage = Math.round((score.correct / score.total) * 100);
    
    // Save quiz completion to database
      await addExerciseCompletionMutation({
      unitNumber: unitToSave,
        exerciseId: `vocab_quiz_unit_${selectedUnit}`,
        score: score.correct,
        totalQuestions: score.total,
        xpEarned: earnedXP,
      });
    
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
      
      // 2. Sync with database in background
      // Only reset index if quiz hasn't started yet (initial load)
      if (quizProgress && !quizStarted) {
        setLastQuizProgress(quizProgress);
        // Always start at index 0 - filtered vocab handles showing only non-mastered words
        setCurrentIndex(0);
      } else if (quizProgress) {
        // Just update lastQuizProgress without resetting index if quiz is already in progress
        setLastQuizProgress(quizProgress);
      }
      
      setQuizStarted(true);
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
      if (!isNaN(unitNum) && unitNum >= 1 && unitNum <= 27) {
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

  // Filter vocabulary by unit and access
  const filteredVocab = useMemo(() => {
    // NEW: Learn Mode uses database data
    if (mode === 'learn' && courseVocabulary && courseVocabulary.length > 0) {
      let vocab = selectedUnit === 'all'
        ? courseVocabulary
        : courseVocabulary.filter((v: Doc<"courseVocabulary">) => v.unitNumber === selectedUnit);
      
      // Beta/Subscription Beschränkung
      if (accessInfo && accessInfo.maxUnits > 0) {
        vocab = vocab.filter((v: Doc<"courseVocabulary">) => v.unitNumber <= accessInfo.maxUnits);
      }
      
      // Map to format compatible with existing code
      const mappedVocab = vocab.map((word: Doc<"courseVocabulary">) => ({
        _id: word._id,
        serbian: word.serbian,
        serbianWord: word.serbian, // For compatibility
        unit: word.unitNumber,
        unitNumber: word.unitNumber,
        en: word.en,
        de: word.de,
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        // Include old translations array for backward compatibility during migration
        translations: word.translations || [],
      }));
      
      // Sort by unitNumber (ascending), then alphabetically by serbian (fallback if backend didn't sort)
      return mappedVocab.sort((a: { unitNumber: number; serbian: string }, b: { unitNumber: number; serbian: string }) => {
        if (a.unitNumber !== b.unitNumber) {
          return a.unitNumber - b.unitNumber;
        }
        return a.serbian.localeCompare(b.serbian);
      });
    }
    
    // NEW: Quiz Mode also uses database data
    if (mode === 'quiz' && courseVocabulary && courseVocabulary.length > 0) {
      let vocab = selectedUnit === 'all'
        ? courseVocabulary
        : courseVocabulary.filter((v: Doc<"courseVocabulary">) => v.unitNumber === selectedUnit);
      
      // Beta/Subscription Beschränkung
      if (accessInfo && accessInfo.maxUnits > 0) {
        vocab = vocab.filter((v: Doc<"courseVocabulary">) => v.unitNumber <= accessInfo.maxUnits);
      }
      
      // Filter out mastered words (correctAnswerCount >= 3)
      vocab = vocab.filter((word: Doc<"courseVocabulary">) => {
        // NEW: Use courseVocabularyId for optimistic updates
        const optimisticKey = word._id;
        const optimistic = optimisticProgress.get(optimisticKey);
        
        // Find progress from vocabWithProgress (contains progress data)
        const progress = vocabWithProgress?.find((p: { _id: string; progress: { correctAnswerCount: number } | null }) => p._id === word._id)?.progress;
        
        // Use optimistic count if available, otherwise use database count
        const correctCount = optimistic?.correctAnswerCount ?? progress?.correctAnswerCount ?? 0;
        
        // Show word if: not mastered (correctAnswerCount < 3)
        return correctCount < 3;
      });
      
      // Map to format compatible with existing code
      const mappedVocab = vocab.map((word: Doc<"courseVocabulary">) => ({
        _id: word._id,
        serbian: word.serbian,
        serbianWord: word.serbian, // For compatibility
        unit: word.unitNumber,
        unitNumber: word.unitNumber,
        en: word.en,
        de: word.de,
        enAlt: word.enAlt,
        deAlt: word.deAlt,
        // Include old translations array for backward compatibility during migration
        translations: word.translations || [],
      }));
      
      // Sort by unitNumber (ascending), then alphabetically by serbian (fallback if backend didn't sort)
      return mappedVocab.sort((a: { unitNumber: number; serbian: string }, b: { unitNumber: number; serbian: string }) => {
        if (a.unitNumber !== b.unitNumber) {
          return a.unitNumber - b.unitNumber;
        }
        return a.serbian.localeCompare(b.serbian);
      });
    }
    
    // Database is the only source of truth - no fallback to hardcoded data
    if (!courseVocabulary || courseVocabulary.length === 0) {
      console.error('[Vocabulary] No vocabulary data available from database');
      return [];
    }
    
    return [];
  }, [selectedUnit, accessInfo, mode, vocabProgressData, optimisticProgress, courseVocabulary, vocabWithProgress]);

  const currentWord = filteredVocab[currentIndex];
  const progressPercent = filteredVocab.length > 0 ? ((currentIndex + 1) / filteredVocab.length) * 100 : 0;
  
  // Get progress for current word (with optimistic updates)
  // Use answeredWord during feedback, otherwise use currentWord
  const currentWordProgress = useMemo(() => {
    // During feedback, use answeredWord to ensure we show progress for the word that was answered
    const wordToCheck = (showAnswer && answeredWord) ? answeredWord : currentWord;
    if (!wordToCheck) return null;
    
    // NEW: Use courseVocabularyId for optimistic updates (if available)
    // FALLBACK: Use old serbian:unit format for backward compatibility
    const optimisticKey = wordToCheck._id || `${wordToCheck.serbian}:${wordToCheck.unit}`;
    const optimistic = optimisticProgress.get(optimisticKey);
    
    // Find progress from database
    // NEW: Try vocabWithProgress first (contains progress data)
    let dbProgress = null;
    if (wordToCheck._id && vocabWithProgress) {
      const vocabProgress = vocabWithProgress.find((p: { _id: string; progress: VocabularyProgressDoc | null }) => p._id === wordToCheck._id)?.progress;
      if (vocabProgress) {
        dbProgress = vocabProgress as any;
      }
    }
    
    // FALLBACK: Use old vocabProgressData structure
    if (!dbProgress && vocabProgressData) {
      dbProgress = vocabProgressData.find(
        p => p.serbianWord === wordToCheck.serbian && p.unitNumber === wordToCheck.unit
      );
    }
    
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
    
    return dbProgress || null;
  }, [currentWord, answeredWord, showAnswer, vocabProgressData, vocabWithProgress, optimisticProgress]);

  // Reset currentIndex if it's out of bounds (e.g., after completing a quiz)
  useEffect(() => {
    if (currentIndex >= filteredVocab.length && filteredVocab.length > 0) {
      setCurrentIndex(0);
      setScore({ correct: 0, total: 0 });
    }
  }, [currentIndex, filteredVocab.length]);

  const handleNext = () => {
    if (currentIndex < filteredVocab.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
      setUserAnswer('');
      setIsCorrect(null);
    }
  };

  // Handle moving to next word (used both manually and automatically)
  const handleNextWord = useCallback(() => {
    // Check if it's the last word
    if (currentIndex >= filteredVocab.length - 1) {
      // Last word - don't advance, show completion
      return;
    }
    
    // Reset state before moving to next word
    setShowAnswer(false);
    setUserAnswer('');
    setIsCorrect(null);
    setCurrentCorrectTranslation(null);
    setAnsweredWord(null);
    
    // Move to next word
    setCurrentIndex(prevIndex => prevIndex + 1);
  }, [currentIndex, filteredVocab.length]);

  // Handle auto-advance setting change
  const handleAutoAdvanceChange = (checked: boolean) => {
    setAutoAdvance(checked);
    localStorage.setItem('vocab_quiz_auto_advance', checked.toString());
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim() || !currentWord) return;
    
    // Store the current word IMMEDIATELY to prevent it from changing
    const wordToAnswer = currentWord;
    
    // NEW: Support column-based translations (for both Learn Mode and Quiz Mode with database data)
    // FALLBACK: Support old getTranslation/getAlternatives (for backward compatibility)
    let correctTranslationForWord: string;
    let alternatives: string[] = [];
    
    // Check if column-based translations exist AND have values
    const hasColumnTranslations = wordToAnswer && 
      ((wordToAnswer.en && wordToAnswer.en.trim()) || (wordToAnswer.de && wordToAnswer.de.trim()));
    
    if (hasColumnTranslations) {
      // NEW: Column-based structure
      // BETA: Currently always English, but code prepared for future multi-language support
      correctTranslationForWord = (wordToAnswer.en?.trim() || wordToAnswer.de?.trim() || "");
      const alt = wordToAnswer.enAlt;
      alternatives = alt && alt.trim() ? [alt.trim()] : [];
    } else if (wordToAnswer && Array.isArray(wordToAnswer.translations)) {
      // FALLBACK: Database translations array structure [{ language: "en", translation: "Hello" }]
      const translationObj = wordToAnswer.translations.find((t: any) => t.language === userLanguage) ||
                            wordToAnswer.translations.find((t: any) => t.language === "en");
      correctTranslationForWord = translationObj?.translation || "";
      
      // Find alternatives from translations array
      const altTranslation = wordToAnswer.translations.find((t: any) => 
        t.language === userLanguage && t.alt
      );
      alternatives = altTranslation?.alt ? [altTranslation.alt] : [];
    } else {
      // No fallback - database should always provide translations
      console.error('[Vocabulary] No translation available for word:', wordToAnswer);
      correctTranslationForWord = "";
      alternatives = [];
    }

    const userAnswerLower = userAnswer.trim().toLowerCase();
    const correctTranslation = correctTranslationForWord.toLowerCase();
    const alternativesLower = alternatives.map(alt => alt.toLowerCase());
    const correct = userAnswerLower === correctTranslation || alternativesLower.includes(userAnswerLower);
    
    setIsCorrect(correct);
    setScore({ correct: score.correct + (correct ? 1 : 0), total: score.total + 1 });
    // Store the current word and translation before showing answer (to prevent them from changing)
    setAnsweredWord(wordToAnswer);
    setCurrentCorrectTranslation(correctTranslationForWord);
    setShowAnswer(true);

    // Save answer to vocabulary tracking in quiz mode
    if (mode === 'quiz' && wordToAnswer) {
      // Optimistic update: Update local state immediately
      // NEW: Use courseVocabularyId for optimistic key (if available)
      // FALLBACK: Use old serbian:unit format for backward compatibility
      const optimisticKey = wordToAnswer._id || `${wordToAnswer.serbian}:${wordToAnswer.unit}`;
      const currentProgress = currentWordProgress;
      const currentCorrectCount = currentProgress?.correctAnswerCount || 0;
      const currentIncorrectCount = currentProgress?.incorrectAnswerCount || 0;
      
      const newCorrectCount = correct ? currentCorrectCount + 1 : currentCorrectCount;
      const newIncorrectCount = correct ? currentIncorrectCount : currentIncorrectCount + 1;
      
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
        
        // Update session XP (for display)
        setSessionXP(prev => prev + earnedXP);
        setXpEarned(prev => prev + earnedXP);
        
        // Award XP to user immediately
        if (earnedXP > 0) {
          try {
            // NEW: Use courseVocabularyId for exerciseId (if available)
            // FALLBACK: Use old serbianWord format for backward compatibility
            const exerciseId = wordToAnswer._id 
              ? `vocab_word_${wordToAnswer._id}_${newCorrectCount}`
              : `vocab_word_${wordToAnswer.serbian}_${newCorrectCount}`;
            
            await addExerciseCompletionMutation({
              unitNumber: wordToAnswer.unit || wordToAnswer.unitNumber,
              exerciseId,
              score: 1,
              totalQuestions: 1,
              xpEarned: earnedXP,
            });
          } catch (e) {
            console.error('Failed to award XP', e);
          }
        }
      }
      
      // Save to database
      try {
        // NEW: Use courseVocabularyId (preferred)
        // FALLBACK: Use serbianWord + unitNumber for backward compatibility
        if (wordToAnswer._id) {
          await recordVocabularyAnswerMutation({
            courseVocabularyId: wordToAnswer._id,
            isCorrect: correct,
          });
        } else {
          // FALLBACK: Old format
          await recordVocabularyAnswerMutation({
            serbianWord: wordToAnswer.serbian,
            unitNumber: wordToAnswer.unit || wordToAnswer.unitNumber,
            isCorrect: correct,
          });
        }
        // Convex will automatically revalidate the query, which will update vocabProgressData
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
      const newScore = { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 };
      
      // 1. Save to localStorage immediately (fast, reliable)
      const storageKey = getStorageKey();
      const progressData = {
        currentIndex: newIndex,
        score: newScore,
        lastScore: Math.round((newScore.correct / newScore.total) * 100),
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
          lastScore: Math.round((newScore.correct / newScore.total) * 100),
          incrementAttempts: true,
        });
      } catch (e) {
        console.error('Failed to save quiz progress to database', e);
        // localStorage still has the progress, so user won't lose data
      }
    }
    
    // Check if this was the last word
    const isLastWord = currentIndex === filteredVocab.length - 1;
    
    if (isLastWord) {
      // Don't reset showAnswer - keep it true to show complete screen
      // Call handleQuizComplete to save results and XP
      setTimeout(async () => {
        await handleQuizComplete();
      }, 100);
      return;
    }
    
    // Only auto-advance if setting is enabled
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
    setXpEarned(0);
    setSessionXP(0); // Reset session XP
    setQuizStarted(false);
    setCurrentCorrectTranslation(null);
    setAnsweredWord(null);
    
    // Clear localStorage
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
  };

  const handleResetQuizProgress = async () => {
      await resetQuizProgressMutation({
      unitNumber: selectedUnit === 'all' ? 0 : (selectedUnit as number),
      });
      handleReset();
  };

  const calculateXP = (correct: number, total: number): number => {
    const percentage = (correct / total) * 100;
    if (percentage === 100) return total * 10;
    if (percentage >= 80) return Math.floor(total * 8);
    if (percentage >= 60) return Math.floor(total * 5);
    if (percentage >= 40) return Math.floor(total * 3);
    return Math.floor(total * 1);
  };

  // Helper function to check if a unit is mastered
  // A unit is mastered when ALL vocabulary words in that unit have correctAnswerCount >= 3
  const isUnitMastered = (unitNumber: number): boolean => {
    // NEW: Use courseVocabulary from database (if available)
    // FALLBACK: Use hardcoded VOCABULARY for backward compatibility
    let unitVocab: Array<{ _id?: string; serbian: string; serbianWord: string; unit: number; unitNumber: number }> = [];
    
    if (courseVocabulary && courseVocabulary.length > 0) {
      unitVocab = courseVocabulary
        .filter((v: Doc<"courseVocabulary">) => v.unitNumber === unitNumber)
        .map((word: Doc<"courseVocabulary">) => ({
          _id: word._id,
          serbian: word.serbian,
          serbianWord: word.serbian,
          unit: word.unitNumber,
          unitNumber: word.unitNumber,
        }));
    } else {
      // Database is the only source - no fallback
      console.error('[Vocabulary] No vocabulary data available for unit mastery check');
      return false;
    }
    
    if (unitVocab.length === 0) return false;
    
    // Check if vocabProgressData or vocabWithProgress is loaded
    if ((!vocabProgressData || vocabProgressData.length === 0) && 
        (!vocabWithProgress || vocabWithProgress.length === 0)) {
      return false;
    }
    
    // Check if all words in the unit are mastered (correctAnswerCount >= 3)
    const allMastered = unitVocab.every(word => {
      // NEW: Try vocabWithProgress first (contains progress data)
      if (word._id && vocabWithProgress) {
        const progress = vocabWithProgress.find((p: { _id: string; progress: { correctAnswerCount: number } | null }) => p._id === word._id)?.progress;
        if (progress) {
          return (progress.correctAnswerCount ?? 0) >= 3;
        }
      }
      
      // FALLBACK: Use old vocabProgressData structure
      if (vocabProgressData) {
        const progress = vocabProgressData.find(
          (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unit
        );
        return (progress?.correctAnswerCount ?? 0) >= 3;
      }
      
      return false;
    });
    
    return allMastered;
  };

  return (
    <AnimatedPage>
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">{t('vocabulary.backToDashboard')}</Button>
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">{t('vocabulary.title')}</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-4xl space-y-6">
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
                  className="flex-1"
                >
                  📚 {t('vocabulary.learnMode')}
                </Button>
                <Button
                  variant={mode === 'quiz' ? 'default' : 'outline'}
                  onClick={() => { 
                    setMode('quiz'); 
                    handleReset(); 
                  }}
                  className="flex-1"
                >
                  🎯 {t('vocabulary.quizMode')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedItem>

        {/* Quiz Instructions */}
        {mode === 'quiz' && (
          <AnimatedItem>
            <Collapsible>
              <Card className="bg-blue-50 border-blue-200">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-blue-100 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-600" />
                      {t('vocabulary.quizInstructions.title')}
                    </div>
                    <ChevronDown className="h-4 w-4 text-blue-600" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">1.</span>
                    <p>
                      <strong>{t('vocabulary.quizInstructions.step1')}</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">2.</span>
                    <p>
                      <strong>{t('vocabulary.quizInstructions.step2')}</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">3.</span>
                    <p>
                      <strong>{t('vocabulary.quizInstructions.step3')}</strong>
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">4.</span>
                    <p>
                      <strong>{t('vocabulary.quizInstructions.step4')}</strong>
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                    <p className="text-xs text-yellow-800">
                      {t('vocabulary.quizInstructions.tip')}
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          </AnimatedItem>
        )}

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
                {availableUnits.map(unit => {
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
                  {t('vocabulary.score', { correct: score.correct, total: score.total })} ({Math.round((score.correct / score.total) * 100)}%)
                </div>
              )}
              {mode === 'quiz' && sessionXP > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                  <span className="font-semibold text-yellow-700">Session XP: +{sessionXP}</span>
                  <Dialog open={showGamificationModal} onOpenChange={setShowGamificationModal}>
                    <DialogTrigger asChild>
                      <button className="text-blue-600 hover:text-blue-700 underline text-xs">
                        How does XP work?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                          🎮 Gamification System - XP & Rewards
                        </DialogTitle>
                        <DialogDescription>
                          Learn how our Progressive XP System rewards your learning progress
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        {/* Progressive XP System */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            ⭐ Progressive XP System
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Based on Spaced Repetition: The more you practice, the more XP you earn!
                          </p>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <div className="text-2xl">1️⃣</div>
                              <div className="flex-1">
                                <div className="font-semibold text-green-700">First Time Correct</div>
                                <div className="text-sm text-muted-foreground">+5 XP - Great start!</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="text-2xl">2️⃣</div>
                              <div className="flex-1">
                                <div className="font-semibold text-blue-700">Second Time Correct</div>
                                <div className="text-sm text-muted-foreground">+10 XP - You're learning!</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
                              <div className="text-2xl">3️⃣</div>
                              <div className="flex-1">
                                <div className="font-semibold text-yellow-700">Third Time Correct (Mastered! 🌟)</div>
                                <div className="text-sm text-muted-foreground">+20 XP - Word mastered!</div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="font-semibold text-purple-700 mb-2">Total per Word: 35 XP</div>
                            <div className="text-sm text-muted-foreground">
                              Master a word completely to earn all 35 XP! (5 + 10 + 20)
                            </div>
                          </div>
                        </div>

                        {/* Why Progressive XP? */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            💡 Why Progressive XP?
                          </h3>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span><strong>Immediate Feedback:</strong> See your progress instantly after each correct answer</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span><strong>Spaced Repetition Bonus:</strong> Harder repetitions = More XP</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span><strong>Motivating:</strong> Watch your XP grow as you learn</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span><strong>Fair:</strong> Rewards long-term learning, not just quick answers</span>
                            </li>
                          </ul>
                        </div>

                        {/* Example */}
                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-lg border-2 border-blue-200">
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            📚 Example: Unit 1 (23 Words)
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>23 words × 3 repetitions</span>
                              <span className="font-semibold">69 practice sessions</span>
                            </div>
                            <div className="flex justify-between">
                              <span>1st time (23 × 5 XP)</span>
                              <span className="font-semibold">+115 XP</span>
                            </div>
                            <div className="flex justify-between">
                              <span>2nd time (23 × 10 XP)</span>
                              <span className="font-semibold">+230 XP</span>
                            </div>
                            <div className="flex justify-between">
                              <span>3rd time - Mastered! (23 × 20 XP)</span>
                              <span className="font-semibold">+460 XP</span>
                            </div>
                            <div className="border-t-2 border-blue-300 pt-2 flex justify-between text-lg font-bold text-blue-700">
                              <span>Total Possible XP:</span>
                              <span>805 XP! 🎉</span>
                            </div>
                          </div>
                        </div>

                        {/* Tips */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            💪 Pro Tips
                          </h3>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <span>🎯</span>
                              <span>Practice daily for best results - consistency is key!</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span>🔁</span>
                              <span>Review words multiple times to earn maximum XP</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span>⭐</span>
                              <span>Master all words in a unit to unlock full XP potential</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span>📈</span>
                              <span>Watch your XP grow - every correct answer counts!</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
              {mode === 'quiz' && lastQuizProgress && lastQuizProgress.lastScore > 0 && (
                <div className="text-sm text-muted-foreground text-center bg-blue-50 p-2 rounded">
                  Last attempt: {lastQuizProgress.lastScore}% ({lastQuizProgress.totalAttempts} attempts)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </AnimatedItem>
        {/* Flashcard */}
        {currentWord && (
          <AnimatedItem>
            <Card className="min-h-[400px] flex flex-col justify-center">
            <CardContent className="text-center space-y-8 py-12">
              {/* Vokabel immer anzeigen (auch während Feedback) */}
              {/* Use answeredWord during feedback, otherwise use currentWord */}
              {(() => {
                const displayWord = showAnswer && answeredWord ? answeredWord : currentWord;
                if (!displayWord) return null;
                
                return (
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <Badge variant="outline">
                        {t('vocabulary.unit', { number: displayWord.unit })}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <h2 className="text-5xl font-bold">
                        {displayWord.serbian}
                      </h2>
                      {displayWord._id && (
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
                      )}
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
                          <Badge className="bg-yellow-500 text-white">
                            ⭐ Mastered
                          </Badge>
                        );
                      }
                      
                      // Anzeige für richtige Antworten
                      if (correctCount > 0) {
                        return (
                          <>
                            <Badge variant="outline" className="text-sm">
                              {correctCount}/3
                            </Badge>
                            {incorrectCount > 0 && (
                              <Badge variant="outline" className="text-sm text-red-600 border-red-300">
                                {incorrectCount}× incorrect
                              </Badge>
                            )}
                          </>
                        );
                      }
                      
                      // Nur falsche Antworten (noch nie richtig)
                      if (incorrectCount > 0) {
                        return (
                          <Badge variant="outline" className="text-sm text-red-600 border-red-300">
                            {incorrectCount}× incorrect
                          </Badge>
                        );
                      }
                      
                      // Noch nie beantwortet: nichts anzeigen
                      return null;
                    })()}
                  </div>
                )}
                    {/* Übersetzung nur im Learn-Mode anzeigen (im Quiz-Modus wird sie im Feedback-Bereich angezeigt) */}
                    {mode === 'learn' && (
                      <>
                        <p className="text-2xl text-muted-foreground mt-4">
                          {(() => {
                            const word = showAnswer && answeredWord ? answeredWord : displayWord;
                            // NEW: Support column-based translations (check if values exist)
                            // BETA: Currently always English, but code prepared for future multi-language support
                            if (word && ((word.en && word.en.trim()) || (word.de && word.de.trim()))) {
                              return (word.en?.trim() || word.de?.trim() || "");
                            }
                            // FALLBACK: Database translations array structure
                            if (word && Array.isArray(word.translations)) {
                              const translationObj = word.translations.find((t: any) => t.language === userLanguage) ||
                                                    word.translations.find((t: any) => t.language === "en");
                              return translationObj?.translation || "";
                            }
                            // No fallback - database should always provide translations
                            console.error('[Vocabulary] No translation available for display:', word);
                            return "";
                          })()}
                        </p>
                        {/* Note anzeigen wenn vorhanden */}
                        {(() => {
                          const word = showAnswer && answeredWord ? answeredWord : displayWord;
                          const note = getNoteForLanguage(word, userLanguage);
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

              {mode === 'learn' ? (
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
                            Automatic switch to the next word after two seconds. Turn on and off.
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
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg border-2 ${
                        isCorrect 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {isCorrect ? (
                            <>
                              <CheckCircle className="h-6 w-6 text-green-600" />
                              <span className="text-lg font-semibold text-green-600">{t('vocabulary.correct')}</span>
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
                                    <Badge className="bg-yellow-500 text-white ml-2 animate-bounce">
                                      +{xpForAnswer} XP
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : (
                            <>
                              <XCircle className="h-6 w-6 text-red-600" />
                              <span className="text-lg font-semibold text-red-600">{t('vocabulary.incorrect')}</span>
                            </>
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">{t('vocabulary.yourAnswer')}</div>
                          <div className="font-medium">
                            {userAnswer}
                            {/* Note direkt hinter der Antwort bei korrekter Antwort */}
                            {isCorrect && (() => {
                              const word = answeredWord || currentWord;
                              const note = getNoteForLanguage(word, userLanguage);
                              return note ? (
                                <span className="text-muted-foreground italic text-[0.85rem] ml-2">
                                  ({note})
                                </span>
                              ) : null;
                            })()}
                          </div>
                          {!isCorrect && (
                            <>
                              <div className="text-sm text-muted-foreground mt-2">{t('vocabulary.correctAnswer')}</div>
                              <div className="font-medium text-green-600">
                                {currentCorrectTranslation || (() => {
                                  const word = answeredWord || currentWord;
                                  // NEW: Support column-based translations (check if values exist)
                                  // BETA: Currently always English, but code prepared for future multi-language support
                                  if (word && ((word.en && word.en.trim()) || (word.de && word.de.trim()))) {
                                    return (word.en?.trim() || word.de?.trim() || "");
                                  }
                                  // FALLBACK: Database translations array structure [{ language: "en", translation: "Hello" }]
                                  if (word && Array.isArray(word.translations)) {
                                    const translationObj = word.translations.find((t: any) => t.language === userLanguage) ||
                                                          word.translations.find((t: any) => t.language === "en");
                                    return translationObj?.translation || "";
                                  }
                                  // No fallback - database should always provide translations
                                  console.error('[Vocabulary] No translation available for correct answer display');
                                  return "";
                                })()}
                              </div>
                              {/* Note anzeigen wenn vorhanden */}
                              {(() => {
                                const word = answeredWord || currentWord;
                                const note = getNoteForLanguage(word, userLanguage);
                                return note ? (
                                  <div className="text-muted-foreground mt-2 italic text-[0.85rem]">
                                    {note}
                                  </div>
                                ) : null;
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                      {/* Auto-advance setting for quiz mode */}
                      {mode === 'quiz' && (
                        <div className="flex items-center justify-between gap-2 pt-4 border-t">
                          <p className="text-xs text-muted-foreground">
                            Automatic switch to the next word after two seconds. Turn on and off.
                          </p>
                          <Switch
                            id="auto-advance"
                            checked={autoAdvance}
                            onCheckedChange={handleAutoAdvanceChange}
                          />
                        </div>
                      )}
                      {/* Weiter-Button für Quiz-Modus */}
                      {mode === 'quiz' && showAnswer && currentIndex < filteredVocab.length - 1 && (
                        <div className="flex justify-center mt-4">
                          <Button
                            onClick={handleNextWord}
                            size="lg"
                            className="min-w-[120px]"
                          >
                            {t('vocabulary.next')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </AnimatedItem>
        )}

        {/* Completed */}
        {currentIndex === filteredVocab.length - 1 && showAnswer && mode === 'quiz' && (
          <AnimatedItem>
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-center">
                  🎉 {t('vocabulary.quizComplete')}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-2xl font-bold">
                  {t('vocabulary.score', { correct: score.correct, total: score.total })} ({Math.round((score.correct / score.total) * 100)}%)
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm mb-2 text-yellow-800">
                    Total XP Earned in this Session
                  </p>
                  <p className="text-3xl font-bold text-yellow-600">
                    +{sessionXP} XP
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Progressive XP based on word mastery levels
                  </p>
                </div>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Button onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('vocabulary.tryAgain')}
                  </Button>
                  <Button variant="outline" onClick={handleResetQuizProgress}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Progress
                  </Button>
                  {/* Auto-advance to next unit */}
                  {selectedUnit !== 'all' && typeof selectedUnit === 'number' && selectedUnit < availableUnits[availableUnits.length - 1] && (
                    <Link href={`/vocabulary?unit=${(selectedUnit as number) + 1}`}>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <ArrowRight className="mr-2 h-4 w-4" />
                        {t('vocabulary.continueToNextUnit', { next: (selectedUnit as number) + 1 })}
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

        {/* Study Tips */}
        <AnimatedItem>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">{t('vocabulary.tips')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>{t('vocabulary.tip1')}</li>
                <li>{t('vocabulary.tip2')}</li>
                <li>{t('vocabulary.tip3')}</li>
                <li>{t('vocabulary.tip4')}</li>
                <li>{t('vocabulary.tip5')}</li>
              </ul>
            </CardContent>
          </Card>
        </AnimatedItem>
      </div>

      <footer className="container py-8 border-t bg-gradient-to-r from-red-50/50 via-white to-blue-50/50">
        <div className="text-center text-sm text-muted-foreground">
          <p className="font-semibold">© Developed by JACKSENN.ME 2025</p>
        </div>
      </footer>
    </AnimatedPage>
  );
}