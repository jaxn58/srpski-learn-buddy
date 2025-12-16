# Vocabulary System Architecture Documentation

**Datum:** 2025-12-16  
**Status:** ✅ Vollständig migriert auf Datenbank-basierte Struktur

---

## 📋 Inhaltsverzeichnis

1. [System-Übersicht](#system-übersicht)
2. [Datenbank-Schema](#datenbank-schema)
3. [Datenfluss](#datenfluss)
4. [Frontend-Komponenten](#frontend-komponenten)
5. [Backend-Queries & Mutations](#backend-queries--mutations)
6. [Troubleshooting-Guide](#troubleshooting-guide)
7. [Häufige Probleme](#häufige-probleme)

---

## 🏗️ System-Übersicht

Das Vocabulary-System ist vollständig **datenbank-basiert** und verwendet keine hardcoded Daten mehr. Alle Vokabeln werden aus der Convex-Datenbank geladen.

### Architektur-Prinzipien

- ✅ **Single Source of Truth**: Die Datenbank (`courseVocabulary`) ist die einzige Quelle für Vokabel-Daten
- ✅ **Spalten-basierte Übersetzungen**: Übersetzungen werden als Spalten (`en`, `de`, `sr`, etc.) gespeichert
- ✅ **Foreign Key Relationships**: `vocabularyProgress` verweist auf `courseVocabulary` via `courseVocabularyId`
- ✅ **Dual-Write während Migration**: Alte `vocabulary` Tabelle wird noch aktualisiert (wird später entfernt)
- ✅ **Optimistic Updates**: Frontend aktualisiert UI sofort, bevor Server-Response kommt

---

## 🗄️ Datenbank-Schema

### Tabelle: `courseVocabulary` (Master-Daten)

**Zweck**: Enthält alle Vokabeln des Kurses mit Übersetzungen.

```typescript
{
  _id: Id<"courseVocabulary">,
  serbian: string,              // Serbisches Wort (Primärschlüssel für Suche)
  unitNumber: number,           // Unit-Nummer (1-27)
  
  // Spalten-basierte Übersetzungen (NEU)
  en: string | undefined,       // Englische Übersetzung
  de: string | undefined,       // Deutsche Übersetzung
  sr: string | undefined,      // Serbische Übersetzung (selten)
  es: string | undefined,       // Spanische Übersetzung (optional)
  fr: string | undefined,       // Französische Übersetzung (optional)
  enAlt: string | undefined,    // Alternative englische Übersetzung
  deAlt: string | undefined,    // Alternative deutsche Übersetzung
  
  // Alte Struktur (DEPRECATED, wird entfernt)
  translations?: Array<{       // Array-Struktur (nur für Migration)
    language: string,
    translation: string,
    alt?: string
  }>
}
```

**Indizes:**
- `by_unit`: `["unitNumber"]` - Schnelle Suche nach Unit
- `by_unit_serbian`: `["unitNumber", "serbian"]` - Kombinierte Suche

**Wichtige Hinweise:**
- `serbian` ist das **Primärwort** (die Sprache, die gelehrt wird)
- Übersetzungen sind optional (`undefined` wenn nicht vorhanden)
- Neue Sprachen können einfach als neue Spalten hinzugefügt werden

---

### Tabelle: `vocabularyProgress` (User-Fortschritt)

**Zweck**: Speichert den Fortschritt jedes Users für jede Vokabel.

```typescript
{
  _id: Id<"vocabularyProgress">,
  userId: Id<"users">,                    // Foreign Key zu users
  courseVocabularyId: Id<"courseVocabulary">, // Foreign Key zu courseVocabulary
  
  // Fortschritts-Daten
  correctAnswerCount: number,              // Anzahl korrekter Antworten
  incorrectAnswerCount: number,             // Anzahl falscher Antworten
  reviewCount: number,                      // Anzahl Wiederholungen
  mastered: boolean,                        // true wenn correctAnswerCount >= 3
  lastAnsweredAt: number,                  // Timestamp (ms)
  lastReviewedAt: number,                   // Timestamp (ms)
}
```

**Indizes:**
- `by_user_course_vocab`: `["userId", "courseVocabularyId"]` - Eindeutige Kombination
- `by_user`: `["userId"]` - Alle Vokabeln eines Users

**Wichtige Hinweise:**
- **Unique Constraint**: `(userId, courseVocabularyId)` - Keine Duplikate möglich
- `mastered` wird automatisch auf `true` gesetzt wenn `correctAnswerCount >= 3`
- Diese Tabelle ist die **neue Struktur** und wird bevorzugt verwendet

---

### Tabelle: `vocabulary` (DEPRECATED - wird entfernt)

**Zweck**: Alte Struktur, wird noch für Dual-Write verwendet, aber nicht mehr als primäre Quelle.

```typescript
{
  _id: Id<"vocabulary">,
  userId: Id<"users">,
  serbianWord: string,           // Serbisches Wort (String, kein Foreign Key)
  englishTranslation: string,    // Englische Übersetzung
  unitNumber: number,
  
  // Fortschritts-Daten (gleiche Struktur wie vocabularyProgress)
  correctAnswerCount: number,
  incorrectAnswerCount: number,
  reviewCount: number,
  mastered: boolean,
  lastAnsweredAt: number,
  lastReviewedAt: number,
}
```

**Status:** 
- ⚠️ **DEPRECATED** - Wird noch aktualisiert (Dual-Write), aber nicht mehr gelesen
- 🗑️ **Wird entfernt** nach vollständiger Migration

---

## 🔄 Datenfluss

### 1. Vokabeln laden (Frontend → Backend)

```
Frontend (Vocabulary.tsx)
  ↓ useQuery(api.vocabulary.getAllCourseVocabulary)
Backend (convex/vocabulary.ts)
  ↓ query("courseVocabulary").collect()
Convex Database
  ↓ Returns: Array<courseVocabulary>
Frontend
  ↓ Verwendet für: Anzeige, Quiz, Learn Mode
```

### 2. Fortschritt laden (mit JOIN)

```
Frontend (Vocabulary.tsx)
  ↓ useQuery(api.vocabulary.getVocabularyWithProgress)
Backend (convex/vocabulary.ts)
  ↓ query("courseVocabulary").collect()
  ↓ query("vocabularyProgress").withIndex("by_user")
  ↓ JOIN: courseVocabulary + vocabularyProgress
Frontend
  ↓ Erhält: Array<{ _id, serbian, en, de, ..., progress: {...} }>
```

### 3. Antwort speichern (Frontend → Backend)

```
Frontend (Vocabulary.tsx)
  ↓ handleSubmitAnswer()
  ↓ Optimistic Update (sofortige UI-Aktualisierung)
  ↓ useMutation(api.vocabulary.recordVocabularyAnswer)
Backend (convex/vocabulary.ts)
  ↓ recordVocabularyAnswer()
  ↓ 1. Update vocabularyProgress (NEU)
  ↓ 2. Update vocabulary (ALT - Dual-Write)
  ↓ 3. Duplikat-Prüfung & Cleanup
Convex Database
  ↓ Beide Tabellen aktualisiert
Frontend
  ↓ Server-Response bestätigt Optimistic Update
```

---

## 🎨 Frontend-Komponenten

### `client/src/pages/Vocabulary.tsx`

**Zweck**: Hauptkomponente für Vocabulary Practice (Learn Mode & Quiz Mode)

**Wichtige Queries:**
```typescript
// Alle Vokabeln aus Datenbank
const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);

// Vokabeln mit Fortschritt (für Learn Mode)
const vocabWithProgress = useQuery(
  api.vocabulary.getVocabularyWithProgress,
  { unitNumber: selectedUnit }
);

// User-Fortschritt (für Quiz Mode Filter)
const vocabProgressData = useQuery(
  api.vocabulary.getUserVocabularyProgress,
  { unitNumber: undefined } // Alle Units
);
```

**Wichtige Mutations:**
```typescript
// Antwort speichern
const recordVocabularyAnswerMutation = useMutation(
  api.vocabulary.recordVocabularyAnswer
);
```

**Datenverarbeitung:**
- **Learn Mode**: Zeigt alle Vokabeln aus `courseVocabulary`
- **Quiz Mode**: Filtert mastered Words (`correctAnswerCount >= 3`) heraus
- **Optimistic Updates**: Aktualisiert UI sofort, bevor Server antwortet

**Übersetzungen:**
```typescript
// Spalten-basierte Übersetzungen (PRIORITÄT)
if (word.en && word.en.trim()) {
  translation = userLanguage === "de" ? word.de : word.en;
}
// Fallback: Database translations array
else if (word.translations && Array.isArray(word.translations)) {
  translation = word.translations.find(t => t.language === userLanguage)?.translation;
}
// Kein Fallback mehr zu hardcoded Daten!
```

---

### `client/src/pages/VocabularyList.tsx`

**Zweck**: Liste aller Vokabeln mit Mastery-Status

**Wichtige Queries:**
```typescript
// Alle Vokabeln
const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);

// Vokabeln mit Fortschritt (für Mastery-Anzeige)
const vocabWithProgress = useQuery(
  api.vocabulary.getVocabularyWithProgress,
  { unitNumber: selectedUnit }
);
```

**Funktionen:**
- **Suche**: Sucht in `serbian`, `en`, `de` Spalten
- **Unit-Filter**: Filtert nach `unitNumber`
- **Mastery-Anzeige**: Zeigt ⭐ für mastered Units (`isUnitMastered`)

---

### `client/src/pages/Home.tsx`

**Zweck**: Landing Page mit Vokabel-Statistiken

**Wichtige Queries:**
```typescript
// Alle Vokabeln für Statistiken
const courseVocabulary = useQuery(api.vocabulary.getAllCourseVocabulary);
```

**Funktionen:**
- **TOTAL_VOCABULARY**: Berechnet aus `courseVocabulary.length`
- **MODULES_DATA**: Gruppiert Vokabeln nach Units für Module-Anzeige

---

## 🔧 Backend-Queries & Mutations

### `convex/vocabulary.ts`

#### Queries

**`getAllCourseVocabulary`**
```typescript
// Gibt alle Vokabeln zurück
export const getAllCourseVocabulary = query({
  handler: async (ctx) => {
    return await ctx.db.query("courseVocabulary").collect();
  },
});
```

**`getVocabularyWithProgress`**
```typescript
// Gibt Vokabeln mit User-Fortschritt zurück (JOIN)
export const getVocabularyWithProgress = query({
  args: { unitNumber: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // 1. Lade courseVocabulary
    let courseVocab = await ctx.db.query("courseVocabulary").collect();
    if (args.unitNumber) {
      courseVocab = courseVocab.filter(v => v.unitNumber === args.unitNumber);
    }
    
    // 2. Lade vocabularyProgress für User
    const user = await getCurrentUser(ctx);
    const progress = user 
      ? await ctx.db.query("vocabularyProgress")
          .withIndex("by_user", q => q.eq("userId", user._id))
          .collect()
      : [];
    
    // 3. JOIN
    return courseVocab.map(word => ({
      ...word,
      progress: progress.find(p => p.courseVocabularyId === word._id) || null
    }));
  },
});
```

**`getUserVocabularyProgress`**
```typescript
// Gibt User-Fortschritt zurück (Fallback auf alte Struktur)
export const getUserVocabularyProgress = query({
  args: { unitNumber: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    
    // NEU: Verwende vocabularyProgress
    const progress = await ctx.db.query("vocabularyProgress")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
    
    // FALLBACK: Alte vocabulary Tabelle (wird entfernt)
    if (progress.length === 0) {
      return await ctx.db.query("vocabulary")
        .withIndex("by_user", q => q.eq("userId", user._id))
        .collect();
    }
    
    return progress;
  },
});
```

#### Mutations

**`recordVocabularyAnswer`** (KRITISCH)
```typescript
// Speichert Quiz-Antwort und aktualisiert Fortschritt
export const recordVocabularyAnswer = mutation({
  args: {
    courseVocabularyId: v.id("courseVocabulary"),
    isCorrect: v.boolean(),
    // ... weitere Parameter
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    
    // 1. Lade courseVocabulary
    const courseVocab = await ctx.db.get(args.courseVocabularyId);
    
    // 2. Prüfe auf Duplikate (NEU: .collect() statt .first())
    const existingProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user_course_vocab", q =>
        q.eq("userId", user._id)
         .eq("courseVocabularyId", args.courseVocabularyId)
      )
      .collect();
    
    // 3. Update oder Insert vocabularyProgress
    if (existingProgress.length > 0) {
      // Merge Duplikate, behalte ältesten Eintrag
      const oldest = existingProgress.sort((a, b) => 
        (a._creationTime || 0) - (b._creationTime || 0)
      )[0];
      // Update oldest...
    } else {
      // Insert new...
    }
    
    // 4. Dual-Write: Update alte vocabulary Tabelle
    // (wird später entfernt)
    
    // 5. Immediate Cleanup: Prüfe auf Race Conditions
    // ...
  },
});
```

**Wichtige Verbesserungen:**
- ✅ Verwendet `.collect()` statt `.first()` um **alle** Duplikate zu finden
- ✅ **Immediate Cleanup**: Prüft nach Insert ob Duplikate entstanden sind
- ✅ **Merge-Logik**: Kombiniert Zähler aus Duplikaten
- ✅ **Race Condition Schutz**: Verhindert Duplikate durch gleichzeitige Requests

---

## 🔍 Troubleshooting-Guide

### Problem: Vokabeln werden nicht angezeigt

**Symptome:**
- Leere Liste in Vocabulary Practice
- `courseVocabulary` ist `undefined` oder `[]`

**Lösungsschritte:**

1. **Prüfe Convex Dashboard → Data → courseVocabulary**
   - Sind Daten vorhanden?
   - Haben Einträge `serbian` und `unitNumber` Felder?

2. **Prüfe Browser Console**
   - Gibt es Fehler bei `getAllCourseVocabulary`?
   - Ist User authentifiziert?

3. **Prüfe Query-Logs in Convex Dashboard**
   - Öffne Functions → `vocabulary.getAllCourseVocabulary`
   - Klicke "Run" → Prüfe Output

**Häufige Ursachen:**
- Datenbank ist leer (Migration nicht ausgeführt)
- User ist nicht authentifiziert
- Query-Fehler in Backend

---

### Problem: Übersetzungen fehlen (`undefined` oder leer)

**Symptome:**
- Vokabeln werden angezeigt, aber Übersetzungen sind leer
- Console zeigt: `[Vocabulary] No translation available`

**Lösungsschritte:**

1. **Prüfe Datenbank-Struktur**
   ```typescript
   // In Convex Dashboard → Data → courseVocabulary
   // Prüfe: Haben Einträge `en` oder `de` Spalten?
   // Oder haben sie `translations` Array?
   ```

2. **Prüfe Fallback-Logik**
   - Spalten-basierte Übersetzungen (`word.en`, `word.de`)
   - Database translations array (`word.translations`)
   - Kein Fallback mehr zu hardcoded Daten!

3. **Migration prüfen**
   - Wurde `migrate-vocabulary-schema.ts` ausgeführt?
   - Sind `en`/`de` Spalten gefüllt?

**Häufige Ursachen:**
- Migration nicht vollständig ausgeführt
- Daten haben nur `translations` Array, keine Spalten
- Daten sind korrupt

---

### Problem: Duplikate in `vocabularyProgress`

**Symptome:**
- Mehrere Einträge für gleiche `(userId, courseVocabularyId)` Kombination
- Console zeigt Warnungen

**Lösungsschritte:**

1. **Prüfe Duplikate**
   ```typescript
   // In Convex Dashboard → Functions
   // Führe aus: vocabulary.findDuplicateVocabularyTest
   ```

2. **Cleanup-Script ausführen**
   ```bash
   npx tsx scripts/cleanup-duplicate-vocabulary-progress.ts
   ```

3. **Prüfe `recordVocabularyAnswer`**
   - Verwendet `.collect()` statt `.first()`?
   - Hat Immediate Cleanup nach Insert?

**Häufige Ursachen:**
- Race Conditions (zwei Requests gleichzeitig)
- Alte Code-Version ohne Duplikat-Prüfung
- Migration hat Duplikate erstellt

---

### Problem: Quiz Mode zeigt keine Vokabeln

**Symptome:**
- Quiz Mode ist leer, obwohl Vokabeln vorhanden sind
- Alle Vokabeln sind "mastered"

**Lösungsschritte:**

1. **Prüfe Filter-Logik**
   ```typescript
   // In Vocabulary.tsx → filteredVocab useMemo
   // Prüfe: Werden mastered Words korrekt gefiltert?
   // correctAnswerCount >= 3 → ausblenden
   ```

2. **Prüfe `vocabWithProgress` Query**
   - Wird für Quiz Mode geladen?
   - Enthält `progress` Daten?

3. **Prüfe Optimistic Updates**
   - Werden optimistic Updates korrekt berücksichtigt?
   - Key-Struktur: `word._id` statt `serbian:unit`

**Häufige Ursachen:**
- Alle Vokabeln sind bereits mastered
- `vocabWithProgress` wird nicht geladen
- Filter-Logik ist falsch

---

### Problem: Progress wird nicht gespeichert

**Symptome:**
- Antworten werden gegeben, aber Fortschritt wird nicht aktualisiert
- `vocabularyProgress` Tabelle bleibt leer

**Lösungsschritte:**

1. **Prüfe Mutation**
   ```typescript
   // In Browser Console während Quiz
   // Prüfe: Wird recordVocabularyAnswer aufgerufen?
   // Prüfe: Gibt es Fehler?
   ```

2. **Prüfe Convex Dashboard → Functions → vocabulary.recordVocabularyAnswer**
   - Klicke "Run" mit Test-Parametern
   - Prüfe Output und Logs

3. **Prüfe User-Authentifizierung**
   - Ist User eingeloggt?
   - Hat User `userId`?

**Häufige Ursachen:**
- User ist nicht authentifiziert
- Mutation schlägt fehl (Fehler in Logs)
- Network-Problem (Request kommt nicht an)

---

## 🐛 Häufige Probleme

### 1. "Cannot read properties of undefined (reading 'toLowerCase')"

**Ursache:** `word.serbian` ist `undefined`

**Lösung:**
```typescript
// Prüfe vor Verwendung:
if (!word.serbian) return; // oder filter vorher
const serbianMatch = word.serbian?.toLowerCase().includes(search);
```

**Prävention:**
- Filter beim Mapping: `.filter(word => word.serbian)`
- Null-Checks vor String-Operationen

---

### 2. "Query returned empty array"

**Ursache:** Datenbank ist leer oder Query-Fehler

**Lösung:**
- Prüfe Convex Dashboard → Data
- Prüfe Query-Logs
- Führe Migration aus

---

### 3. "Duplikate in vocabularyProgress"

**Ursache:** Race Condition oder alte Code-Version

**Lösung:**
- Verwende `.collect()` statt `.first()`
- Immediate Cleanup nach Insert
- Cleanup-Script ausführen

---

### 4. "Optimistic Updates funktionieren nicht"

**Ursache:** Falsche Key-Struktur

**Lösung:**
```typescript
// Verwende courseVocabularyId als Key:
const optimisticKey = word._id; // Nicht: `${word.serbian}:${word.unit}`
```

---

## 📝 Wichtige Dateien

### Frontend
- `client/src/pages/Vocabulary.tsx` - Hauptkomponente für Practice
- `client/src/pages/VocabularyList.tsx` - Liste aller Vokabeln
- `client/src/pages/Home.tsx` - Landing Page mit Statistiken

### Backend
- `convex/vocabulary.ts` - Alle Vocabulary-Queries & Mutations
- `convex/schema.ts` - Datenbank-Schema Definition
- `convex/admin.ts` - Admin-Funktionen (markUnit1Complete, etc.)

### Scripts
- `scripts/migrate-vocabulary-schema.ts` - Migration von translations[] zu Spalten
- `scripts/cleanup-duplicate-vocabulary-progress.ts` - Duplikat-Bereinigung

---

## ✅ Migration-Status

- ✅ **Phase 1**: Schema erweitert mit Spalten (`en`, `de`, etc.)
- ✅ **Phase 2**: Dual-Write implementiert
- ✅ **Phase 3**: Frontend verwendet Datenbank-Daten
- ✅ **Phase 4**: Learn Mode migriert
- ✅ **Phase 5**: Quiz Mode migriert
- ✅ **Phase 6**: Weitere Komponenten migriert
- ✅ **Phase 7**: Cleanup durchgeführt (keine hardcoded Daten mehr)

**Nächste Schritte:**
- 🗑️ Alte `vocabulary` Tabelle entfernen (nach Monitoring-Phase)
- 🗑️ `translations` Array aus Schema entfernen
- 📊 Performance-Monitoring

---

## 📞 Support

Bei Problemen:
1. Prüfe diese Dokumentation
2. Prüfe Convex Dashboard → Functions → Logs
3. Prüfe Browser Console für Fehler
4. Prüfe Network Tab für fehlgeschlagene Requests

**Wichtige Queries zum Testen:**
- `vocabulary.getAllCourseVocabulary` - Alle Vokabeln
- `vocabulary.getVocabularyWithProgress` - Mit Fortschritt
- `vocabulary.findDuplicateVocabularyTest` - Duplikat-Prüfung
