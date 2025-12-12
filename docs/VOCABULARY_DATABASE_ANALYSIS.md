# Vokabeln in Datenbank: Architektur-Analyse

## Aktuelle Architektur

### Hard-coded (aktuell)
- **Speicherort**: `shared/data/vocabulary/words.ts` als TypeScript-Array
- **Größe**: ~500+ Vokabeln für 27 Units
- **Verwendung**: Direkter Import im Frontend
- **Datenbank**: Convex-Tabelle `vocabulary` nur für user-spezifischen Fortschritt

### Vorteile der aktuellen Lösung
- ✅ Sofort verfügbar (im Bundle)
- ✅ Type-Safety zur Compile-Zeit
- ✅ Keine Netzwerk-Latenz
- ✅ Funktioniert offline
- ✅ Keine zusätzlichen DB-Kosten

---

## Vorgeschlagene Architektur: Datenbank-basiert

### Neue Struktur
- **Neue Tabelle**: `vocabularyWords` (Master-Daten, global)
- **Bestehende Tabelle**: `vocabulary` (Fortschritt pro User)
- **Frontend**: Lädt Vokabeln via Query statt Import

---

## Vor- und Nachteile

### ✅ Vorteile

#### 1. **Dynamische Updates ohne Deployment**
- Neue Vokabeln hinzufügen ohne Code-Deployment
- Fehler korrigieren ohne Build-Prozess
- A/B-Tests für verschiedene Vokabel-Sets möglich

#### 2. **Multi-Language-Support einfacher**
- Neue Sprachen hinzufügen ohne Code-Änderungen
- Übersetzungen über Admin-UI verwaltbar
- Bessere Skalierbarkeit für viele Sprachen

#### 3. **Content-Management**
- Admin-UI für Vokabel-Verwaltung
- Versionierung und Audit-Trail möglich
- Bulk-Import/Export von Vokabeln

#### 4. **Skalierbarkeit**
- Vokabeln pro Sprache/Unit unabhängig verwaltbar
- Bessere Trennung von Code und Content

#### 5. **Analytics**
- Welche Vokabeln werden häufig verwendet?
- Welche Units sind beliebt?
- Datenbank-Querying für Reports

### ❌ Nachteile

#### 1. **Performance**
- **Aktuell**: Array im Bundle, sofort verfügbar
- **Neu**: Netzwerk-Request + DB-Query erforderlich
- **Latenz**: Beim ersten Laden spürbar
- **Lösung**: Caching erforderlich (React Query, etc.)

#### 2. **Komplexität**
- Neue Tabelle im Schema
- Migration der bestehenden Daten
- Seed-Script für Initial-Daten
- Caching-Strategie implementieren

#### 3. **Kosten**
- Mehr DB-Queries = mehr Convex-Kosten
- Caching reduziert, aber eliminiert nicht alle Queries
- Potenziell höhere monatliche Kosten

#### 4. **Offline-Funktionalität**
- **Aktuell**: Vokabeln im Bundle verfügbar
- **Neu**: Abhängig von Netzwerk-Verbindung
- **Lösung**: Service Worker + Cache

#### 5. **Type-Safety**
- **Aktuell**: TypeScript-Typen zur Compile-Zeit
- **Neu**: Runtime-Validierung erforderlich
- Validators für DB-Schema nötig

---

## Empfohlene Implementierung

### Schema-Erweiterung

```typescript
// Neue Tabelle für Master-Vokabeln (global, nicht user-spezifisch)
vocabularyWords: defineTable({
  serbian: v.string(),
  translations: v.object({
    en: v.string(),
    de: v.string(),
    es: v.optional(v.string()),
    fr: v.optional(v.string()),
  }),
  alternatives: v.optional(v.object({
    en: v.optional(v.array(v.string())),
    de: v.optional(v.array(v.string())),
    es: v.optional(v.array(v.string())),
    fr: v.optional(v.array(v.string())),
  })),
  unit: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_unit", ["unit"])
  .index("by_serbian", ["serbian"]),

// Bestehende Tabelle bleibt für User-Fortschritt
vocabulary: defineTable({
  userId: v.id("users"),
  vocabularyWordId: v.id("vocabularyWords"), // Referenz statt Duplikation
  mastered: v.boolean(),
  reviewCount: v.number(),
  lastReviewedAt: v.optional(v.number()),
  correctAnswerCount: v.number(),
  incorrectAnswerCount: v.number(),
  lastAnsweredAt: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_user_unit", ["userId", "unitNumber"])
  .index("by_vocab_word", ["vocabularyWordId"]),
```

### Migration-Strategie

#### 1. Seed-Script erstellen

```typescript
// scripts/seed-vocabulary.ts
import { VOCABULARY } from "../shared/data/vocabulary/words";

export const seedVocabularyWords = async (ctx) => {
  console.log(`Seeding ${VOCABULARY.length} vocabulary words...`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const word of VOCABULARY) {
    // Check if already exists
    const existing = await ctx.db
      .query("vocabularyWords")
      .withIndex("by_unit", (q) => q.eq("unit", word.unit))
      .filter((q) => q.eq(q.field("serbian"), word.serbian))
      .first();
    
    if (!existing) {
      await ctx.db.insert("vocabularyWords", {
        serbian: word.serbian,
        translations: word.translations,
        alternatives: word.alternatives,
        unit: word.unit,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      inserted++;
    } else {
      skipped++;
    }
  }
  
  console.log(`✅ Inserted: ${inserted}, Skipped: ${skipped}`);
};
```

#### 2. Neue Queries erstellen

```typescript
// convex/vocabularyWords.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getAllVocabularyWords = query({
  handler: async (ctx) => {
    return await ctx.db.query("vocabularyWords").collect();
  },
});

export const getVocabularyByUnit = query({
  args: { unit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabularyWords")
      .withIndex("by_unit", (q) => q.eq("unit", args.unit))
      .collect();
  },
});

export const getVocabularyByUnits = query({
  args: { units: v.array(v.number()) },
  handler: async (ctx, args) => {
    const results = [];
    for (const unit of args.units) {
      const words = await ctx.db
        .query("vocabularyWords")
        .withIndex("by_unit", (q) => q.eq("unit", unit))
        .collect();
      results.push(...words);
    }
    return results;
  },
});

export const searchVocabulary = query({
  args: { 
    searchTerm: v.string(),
    unit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("vocabularyWords");
    
    if (args.unit) {
      query = query.withIndex("by_unit", (q) => q.eq("unit", args.unit));
    }
    
    const allWords = await query.collect();
    const search = args.searchTerm.toLowerCase();
    
    return allWords.filter(word => 
      word.serbian.toLowerCase().includes(search) ||
      Object.values(word.translations).some(t => 
        t?.toLowerCase().includes(search)
      )
    );
  },
});
```

#### 3. Frontend anpassen

```typescript
// Statt: import { VOCABULARY } from "@shared/data"

// client/src/pages/Vocabulary.tsx
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function Vocabulary() {
  // Alle Vokabeln laden (mit Caching)
  const vocabulary = useQuery(api.vocabularyWords.getAllVocabularyWords);
  
  // Oder nach Unit filtern
  const unitVocabulary = useQuery(
    api.vocabularyWords.getVocabularyByUnit,
    { unit: selectedUnit }
  );
  
  // ... rest der Komponente
}
```

#### 4. Caching-Strategie

```typescript
// Mit React Query für besseres Caching
import { useQuery } from "@tanstack/react-query";

const { data: vocabulary } = useQuery({
  queryKey: ["vocabulary", "all"],
  queryFn: () => convex.query(api.vocabularyWords.getAllVocabularyWords),
  staleTime: 1000 * 60 * 60, // 1 Stunde Cache
  cacheTime: 1000 * 60 * 60 * 24, // 24 Stunden im Cache
});
```

---

## Empfehlung: Drei-Phasen-Ansatz

### Phase 1: Kurzfristig (Jetzt)
**Hard-coded beibehalten**
- ✅ Performance ist optimal
- ✅ Type-Safety vorhanden
- ✅ Keine zusätzlichen Kosten
- ✅ Funktioniert zuverlässig

**Wann umstellen?**
- Wenn Content-Management wichtig wird
- Wenn mehrere Content-Manager ohne Code-Zugriff arbeiten
- Wenn häufige Vokabel-Updates nötig sind

### Phase 2: Mittelfristig (6-12 Monate)
**Hybrid-Ansatz einführen**
- Master-Vokabeln bleiben hard-coded (Performance)
- User-Fortschritt in DB (bereits vorhanden)
- Admin-UI für neue Vokabeln (werden in DB gespeichert)
- Neue Vokabeln werden aus DB geladen, alte bleiben im Code

**Vorteile:**
- Beste aus beiden Welten
- Schrittweise Migration möglich
- Performance bleibt gut für bestehende Vokabeln

### Phase 3: Langfristig (12+ Monate)
**Vollständig DB-basiert**
- Alle Vokabeln in Datenbank
- Mit aggressivem Caching (React Query Cache)
- Service Worker für Offline-Support
- Admin-UI für vollständige Verwaltung

**Wann umstellen?**
- Wenn Content-Management kritisch wird
- Wenn viele Sprachen hinzukommen (5+)
- Wenn Analytics wichtig werden
- Wenn A/B-Tests für Vokabeln nötig sind

---

## Wann sollte man umstellen?

### ✅ Umstellen, wenn:
- Mehrere Content-Manager ohne Code-Zugriff arbeiten
- Häufige Vokabel-Updates (mehr als 1x pro Woche)
- A/B-Tests für Vokabeln geplant sind
- Multi-Language-Support mit vielen Sprachen (5+)
- Analytics-Anforderungen für Vokabeln bestehen
- Content-Team unabhängig von Entwicklern arbeiten soll

### ❌ Nicht umstellen, wenn:
- Vokabeln selten ändern (weniger als 1x pro Monat)
- Performance kritisch ist (Mobile, langsame Verbindungen)
- Offline-Funktionalität wichtig ist
- Budget für DB-Queries begrenzt ist
- Kleines Team ohne Content-Manager

---

## Migration-Checkliste

Wenn Umstellung beschlossen wird:

- [ ] Schema erweitern (`vocabularyWords` Tabelle)
- [ ] Seed-Script erstellen (`scripts/seed-vocabulary.ts`)
- [ ] Migration-Script für bestehende Daten
- [ ] Neue Queries erstellen (`convex/vocabularyWords.ts`)
- [ ] Frontend-Komponenten anpassen
- [ ] Caching-Strategie implementieren
- [ ] Admin-UI für Vokabel-Verwaltung
- [ ] Tests schreiben
- [ ] Performance-Tests durchführen
- [ ] Dokumentation aktualisieren
- [ ] Rollback-Plan erstellen

---

## Technische Details

### Performance-Optimierungen

1. **Caching**
   - React Query mit `staleTime` und `cacheTime`
   - Service Worker für Offline-Support
   - IndexedDB für lokale Speicherung

2. **Query-Optimierung**
   - Indexes auf `unit` und `serbian`
   - Batch-Queries für mehrere Units
   - Pagination für große Listen

3. **Lazy Loading**
   - Vokabeln pro Unit on-demand laden
   - Nicht alle Vokabeln auf einmal laden

### Kosten-Abschätzung

**Aktuell (Hard-coded):**
- 0 zusätzliche DB-Queries
- Vokabeln im Bundle (~50-100 KB)

**DB-basiert (ohne Caching):**
- ~500 Queries pro User pro Session
- Bei 1000 aktiven Usern: ~500.000 Queries/Monat
- Convex-Kosten: ~$5-10/Monat zusätzlich

**DB-basiert (mit Caching):**
- ~1 Query pro User pro Session (Cache-Hit)
- Bei 1000 aktiven Usern: ~30.000 Queries/Monat
- Convex-Kosten: ~$1-2/Monat zusätzlich

---

## Fazit

Die aktuelle hard-coded Lösung ist für die meisten Anwendungsfälle optimal. Eine Umstellung auf Datenbank sollte nur erfolgen, wenn:

1. Content-Management kritisch wird
2. Häufige Updates ohne Deployment nötig sind
3. Multi-Language-Support mit vielen Sprachen geplant ist
4. Analytics-Anforderungen bestehen

Ein Hybrid-Ansatz bietet einen guten Kompromiss zwischen Flexibilität und Performance.

---

**Erstellt am**: 2024  
**Status**: Analyse-Dokument  
**Nächste Schritte**: Entscheidung über Umstellung basierend auf Anforderungen
