import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VOCABULARY, getTranslation, type SupportedLanguage } from "@shared/data";
import { Search, BookOpen, Filter, Star } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";

type VocabularyProgressDoc = Doc<"vocabulary">;

export default function VocabularyList() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  
  // Get accessible units from Convex
  const accessInfo = useQuery(api.subscriptions.getAccessibleUnits);
  
  // BETA: Force English for all users
  const userLanguage: SupportedLanguage = "en";

  // Fetch vocabulary progress for all units
  const vocabProgressData = useQuery(api.vocabulary.getUserVocabularyProgress, {}) as VocabularyProgressDoc[] | undefined;

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter and search vocabulary
  const filteredVocabulary = useMemo(() => {
    let filtered = VOCABULARY;

    // Beta/Subscription Beschränkung
    if (accessInfo && accessInfo.maxUnits > 0) {
      filtered = filtered.filter(v => v.unit <= accessInfo.maxUnits);
    }

    // Filter by unit
    filtered = filtered.filter(v => v.unit === selectedUnit);

    // Search in Serbian or English
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.serbian.toLowerCase().includes(search) || 
        getTranslation(v, userLanguage).toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [searchTerm, selectedUnit, accessInfo]);

  // Units beschränken basierend auf Zugriff
  const units = accessInfo && accessInfo.maxUnits > 0
    ? Array.from({ length: Math.min(27, accessInfo.maxUnits) }, (_, i) => i + 1)
    : Array.from({ length: 27 }, (_, i) => i + 1);

  // Helper function to check if a unit is mastered
  // A unit is mastered when ALL vocabulary words in that unit have correctAnswerCount >= 3
  const isUnitMastered = (unitNumber: number): boolean => {
    // Get all vocabulary words for this unit
    const unitVocab = VOCABULARY.filter(v => v.unit === unitNumber);
    if (unitVocab.length === 0) return false;
    
    // Check if vocabProgressData is loaded
    if (!vocabProgressData || vocabProgressData.length === 0) {
      return false;
    }
    
    // Check if all words in the unit are mastered (correctAnswerCount >= 3)
    const allMastered = unitVocab.every(word => {
      const progress = vocabProgressData.find(
        (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unit
      );
      const correctCount = progress?.correctAnswerCount ?? 0;
      return correctCount >= 3;
    });
    
    return allMastered;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 md:ml-64 w-full">
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
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('vocabularyList.searchFilter')}</CardTitle>
            <CardDescription>
              {t('vocabularyList.searchFilter.desc', { count: VOCABULARY.length })}
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

        {/* Vocabulary List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t('vocabularyList.unit', { number: selectedUnit })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredVocabulary.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVocabulary.map((word, idx) => {
                  const wordProgress = vocabProgressData?.find(
                    (p: VocabularyProgressDoc) => p.serbianWord === word.serbian && p.unitNumber === word.unit
                  );
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {wordProgress?.mastered && (
                          <span className="text-yellow-500" title="Mastered!">⭐</span>
                        )}
                        <span className="font-medium">{word.serbian}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {wordProgress && (wordProgress.correctAnswerCount || 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {wordProgress.correctAnswerCount || 0}/3
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{getTranslation(word, userLanguage)}</span>
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

        {/* Quick Actions */}
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
      </div>
      </div>
    </div>
  );
}
