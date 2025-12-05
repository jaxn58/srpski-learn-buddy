import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VOCABULARY } from "@shared/data";
import { Search, BookOpen, Filter } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";

export default function VocabularyList() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<number | 'all'>('all');

  if (!user) {
    window.location.href = "/";
    return null;
  }

  // Filter and search vocabulary
  const filteredVocabulary = useMemo(() => {
    let filtered = VOCABULARY;

    // Filter by unit
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(v => v.unit === selectedUnit);
    }

    // Search in Serbian or English
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.serbian.toLowerCase().includes(search) || 
        v.english.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [searchTerm, selectedUnit]);

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

  const units = Array.from({ length: 27 }, (_, i) => i + 1);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  ← Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Vocabulary Reference</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Filter */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>
              Browse all {VOCABULARY.length} words from the coursebook
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search in Serbian or English..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Unit Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filter by Unit:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedUnit === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedUnit('all')}
                >
                  All Units
                </Button>
                {units.map(unit => (
                  <Button
                    key={unit}
                    variant={selectedUnit === unit ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    Unit {unit}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredVocabulary.length} word{filteredVocabulary.length !== 1 ? 's' : ''}
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
                      <Badge variant="secondary">Unit {unit}</Badge>
                      <span className="text-base font-normal text-muted-foreground">
                        {words.length} word{words.length !== 1 ? 's' : ''}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {words.map((word, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                        >
                          <span className="font-medium">{word.serbian}</span>
                          <span className="text-muted-foreground">{word.english}</span>
                        </div>
                      ))}
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
                {typeof selectedUnit === 'number' ? `Unit ${selectedUnit}` : 'All Units'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredVocabulary.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredVocabulary.map((word, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                    >
                      <span className="font-medium">{word.serbian}</span>
                      <span className="text-muted-foreground">{word.english}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No words found matching your search.
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
