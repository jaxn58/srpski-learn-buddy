import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VOCABULARY, getTranslation, type SupportedLanguage } from "@shared/data";
import { Search, BookOpen, Filter } from "lucide-react";
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
  const [selectedUnit, setSelectedUnit] = useState<number | 'all'>('all');
  
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
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(v => v.unit === selectedUnit);
    }

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

  // Group by unit
  const groupedByUnit = useMemo(() => {
    const groups: { [key: number]: typeof VOCABULARY } = {};
    filteredVocabulary.forEach(word => {
      if (!groups[word.unit]) {
        groups[word.unit] = [];
      }
      groups[word.unit].push(word);
    });
    return groups;
  }, [filteredVocabulary]);

  // Units beschränken basierend auf Zugriff
  const units = accessInfo && accessInfo.maxUnits > 0
    ? Array.from({ length: Math.min(27, accessInfo.maxUnits) }, (_, i) => i + 1)
    : Array.from({ length: 27 }, (_, i) => i + 1);

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
                <Button
                  variant={selectedUnit === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedUnit('all')}
                >
                  {t('vocabularyList.allUnits')}
                </Button>
                {units.map(unit => (
                  <Button
                    key={unit}
                    variant={selectedUnit === unit ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    {t('vocabularyList.unit', { number: unit })}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {t('vocabularyList.showing', { count: filteredVocabulary.length })}
            </div>
          </CardContent>
        </Card>

        {/* Vocabulary List */}
        {selectedUnit === 'all' ? (
          // Grouped by unit
          <div className="space-y-6">
            {Object.entries(groupedByUnit)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([unit, words]) => (
                <Card key={unit}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary">{t('vocabularyList.unit', { number: unit })}</Badge>
                      <span className="text-base font-normal text-muted-foreground">
                        {t('vocabularyList.words', { count: words.length })}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {words.map((word, idx) => {
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
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : (
          // Single unit or search results
          <Card>
            <CardHeader>
              <CardTitle>
                {typeof selectedUnit === 'number' ? t('vocabularyList.unit', { number: selectedUnit }) : t('vocabularyList.allUnits')}
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
        )}

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
