# Vocabulary Schema Migration - Checkpoint Test Guide

Dieses Dokument führt Schritt für Schritt durch alle Checkpoint-Tests für die Vocabulary Schema Migration.

## Vorbereitung

1. **Convex Dashboard öffnen**: https://dashboard.convex.dev
2. **Development Environment**: Stelle sicher, dass du im Development-Deployment arbeitest
3. **Browser Console**: Öffne Developer Tools (F12) für Logging
4. **Test-User**: Verwende einen Test-User mit einigen Vokabeln und Quiz-Progress

---

## Phase 1 Checkpoint: Schema & Backend-Grundlagen

### Test 1.1: Schema-Validierung

**Ziel**: Prüfen, ob das Schema korrekt erweitert wurde

**Schritte**:
1. Öffne Convex Dashboard → Schema
2. Prüfe folgende Tabellen:
   - `courseVocabulary`: Sollte Spalten `en`, `de`, `sr`, `es`, `fr`, `enAlt`, `deAlt` haben
   - `vocabularyProgress`: Sollte existieren mit `courseVocabularyId` Foreign Key
   - `quizProgress`: Sollte `incorrectVocabularyIds` Spalte haben

**Erwartetes Ergebnis**:
- ✅ Alle neuen Spalten sind vorhanden
- ✅ `vocabularyProgress` hat Index `by_user_course_vocab`
- ✅ `courseVocabulary` hat Index `by_unit_serbian`

**Prüfung im Code**:
```typescript
// In Convex Dashboard → Data → courseVocabulary
// Prüfe: Einige Einträge sollten en/de Spalten haben (nach Migration)
```

### Test 1.2: Neue Queries funktionieren

**Ziel**: Prüfen, ob `getAllCourseVocabulary` und `getVocabularyWithProgress` funktionieren

**Schritte**:
1. Öffne Convex Dashboard → Functions
2. Teste `vocabulary.getAllCourseVocabulary`:
   - Klicke auf "Run"
   - Erwartetes Ergebnis: Array von courseVocabulary Einträgen
3. Teste `vocabulary.getVocabularyWithProgress`:
   - Parameter: `{ unitNumber: 1 }`
   - Erwartetes Ergebnis: Array mit `progress` Objekten

**Erwartetes Ergebnis**:
- ✅ `getAllCourseVocabulary` gibt alle Vokabeln zurück
- ✅ `getVocabularyWithProgress` gibt kombinierte Objekte mit `progress` zurück
- ✅ Keine Fehler in der Console

**Manuelle Prüfung im Frontend**:
```typescript
// In Browser Console (auf der Vocabulary-Seite):
// Prüfe ob Queries geladen werden (keine Errors)
```

### Test 1.3: Keine Breaking Changes

**Ziel**: Prüfen, ob bestehende Queries weiterhin funktionieren

**Schritte**:
1. Teste bestehende Queries:
   - `vocabulary.getCourseVocabularyByUnit({ unitNumber: 1 })`
   - `vocabulary.getUserVocabularyProgress({})`
   - `progress.canCompleteUnit({ unitNumber: 1 })`

**Erwartetes Ergebnis**:
- ✅ Alle bestehenden Queries funktionieren weiterhin
- ✅ Keine TypeScript-Fehler
- ✅ Frontend lädt ohne Fehler

---

## Phase 2 Checkpoint: Backend Dual-Write

### Test 2.1: Dual-Write funktioniert

**Ziel**: Prüfen, ob `recordVocabularyAnswer` beide Tabellen aktualisiert

**Schritte**:
1. Öffne Vocabulary Practice Seite (Quiz Mode)
2. Beantworte eine Vokabel (korrekt oder falsch)
3. Prüfe in Convex Dashboard:
   - `vocabulary` Tabelle: Sollte aktualisiert sein
   - `vocabularyProgress` Tabelle: Sollte neuen/aktualisierten Eintrag haben

**Erwartetes Ergebnis**:
- ✅ Beide Tabellen werden aktualisiert
- ✅ `vocabularyProgress` hat `courseVocabularyId` Foreign Key
- ✅ `correctAnswerCount` ist in beiden Tabellen identisch

**Prüfung**:
```sql
-- In Convex Dashboard → Data
-- 1. Prüfe vocabulary Tabelle für deinen User
-- 2. Prüfe vocabularyProgress Tabelle für deinen User
-- 3. Vergleiche: correctAnswerCount sollte identisch sein
```

### Test 2.2: JOIN-Queries funktionieren

**Ziel**: Prüfen, ob `getUserVocabularyProgress` JOIN korrekt durchführt

**Schritte**:
1. Teste `vocabulary.getUserVocabularyProgress({ unitNumber: 1 })`
2. Prüfe Rückgabe-Format:
   - Sollte `courseVocabularyId` enthalten
   - Sollte `serbianWord` und `englishTranslation` enthalten (aus JOIN)

**Erwartetes Ergebnis**:
- ✅ Query gibt kombinierte Daten zurück
- ✅ Progress-Daten sind korrekt verknüpft
- ✅ Fallback auf alte Struktur funktioniert (falls vocabularyProgress leer)

### Test 2.3: Fallback-Logik funktioniert

**Ziel**: Prüfen, ob Fallback auf alte Struktur funktioniert

**Schritte**:
1. Erstelle Test-User ohne `vocabularyProgress` Einträge
2. Teste `getUserVocabularyProgress`:
   - Sollte aus `vocabulary` Tabelle laden (Fallback)
3. Teste `canCompleteUnit`:
   - Sollte auch mit Fallback funktionieren

**Erwartetes Ergebnis**:
- ✅ Fallback funktioniert korrekt
- ✅ Keine Fehler wenn vocabularyProgress leer ist
- ✅ System funktioniert weiterhin mit alter Struktur

### Test 2.4: Bestehende Frontend-Funktionalität bleibt unverändert

**Ziel**: Prüfen, dass Frontend weiterhin funktioniert

**Schritte**:
1. Öffne Vocabulary Practice (Quiz Mode)
2. Beantworte einige Vokabeln
3. Prüfe:
   - Progress wird angezeigt
   - XP wird vergeben
   - Mastery-Status wird aktualisiert

**Erwartetes Ergebnis**:
- ✅ Alle Features funktionieren wie vorher
- ✅ Keine Breaking Changes sichtbar für User
- ✅ Performance ist akzeptabel

---

## Phase 3 Checkpoint: Frontend Translation-Zugriff

### Test 3.1: UnitView zeigt korrekte Übersetzungen

**Ziel**: Prüfen, ob Übersetzungen korrekt angezeigt werden

**Schritte**:
1. Öffne eine Unit-Seite (z.B. Unit 1)
2. Scrolle zu Vocabulary-Sektion
3. Prüfe:
   - Serbische Wörter werden angezeigt
   - Übersetzungen werden korrekt angezeigt (DE/EN je nach Sprache)
   - Alternative Übersetzungen werden angezeigt (falls vorhanden)

**Erwartetes Ergebnis**:
- ✅ Alle Übersetzungen werden korrekt angezeigt
- ✅ Keine `undefined` oder `null` Werte
- ✅ Alternative Übersetzungen (deAlt, enAlt) werden angezeigt

**Manuelle Prüfung**:
- Wechsle Sprache zwischen DE/EN
- Prüfe ob Übersetzungen sich ändern

### Test 3.2: VocabularyList zeigt korrekte Übersetzungen

**Ziel**: Prüfen, ob VocabularyList Übersetzungen korrekt anzeigt

**Schritte**:
1. Öffne Vocabulary List Seite
2. Wähle eine Unit
3. Prüfe:
   - Alle Vokabeln werden angezeigt
   - Übersetzungen sind korrekt
   - Suche funktioniert (Serbian + Translation)

**Erwartetes Ergebnis**:
- ✅ Übersetzungen werden korrekt angezeigt
- ✅ Suche funktioniert mit neuen Spalten
- ✅ Keine Fehler in Console

### Test 3.3: Alternative Übersetzungen funktionieren

**Ziel**: Prüfen, ob deAlt/enAlt korrekt angezeigt werden

**Schritte**:
1. Finde eine Vokabel mit `deAlt` oder `enAlt` in der Datenbank
2. Prüfe Anzeige:
   - Alternative sollte angezeigt werden (z.B. mit "*" Markierung)
   - Format sollte konsistent sein

**Erwartetes Ergebnis**:
- ✅ Alternative Übersetzungen werden angezeigt
- ✅ Format ist konsistent mit alter Struktur
- ✅ Fallback funktioniert (falls alt vorhanden)

---

## Phase 4 Checkpoint: Frontend Learn Mode

### Test 4.1: Learn Mode zeigt Vokabeln aus Datenbank

**Ziel**: Prüfen, ob Learn Mode Datenbank-Daten verwendet

**Schritte**:
1. Öffne Vocabulary Practice → Learn Mode
2. Wähle eine Unit
3. Prüfe Browser Console:
   - `courseVocabulary` Query sollte geladen werden
   - Keine `VOCABULARY` Imports sollten verwendet werden (für Learn Mode)

**Erwartetes Ergebnis**:
- ✅ Vokabeln werden aus Datenbank geladen
- ✅ Keine hardcoded Daten im Learn Mode
- ✅ Alle Vokabeln werden angezeigt

**Prüfung**:
```javascript
// In Browser Console:
// Prüfe Network Tab → Convex Queries
// Sollte: api.vocabulary.getAllCourseVocabulary sehen
```

### Test 4.2: Navigation funktioniert

**Ziel**: Prüfen, ob Previous/Next Navigation funktioniert

**Schritte**:
1. Im Learn Mode:
   - Klicke "Next" → Sollte zur nächsten Vokabel gehen
   - Klicke "Previous" → Sollte zur vorherigen Vokabel gehen
2. Prüfe:
   - Progress-Anzeige wird aktualisiert
   - Keine Fehler beim Navigieren

**Erwartetes Ergebnis**:
- ✅ Navigation funktioniert korrekt
- ✅ Progress wird korrekt angezeigt
- ✅ Keine Index-Fehler

### Test 4.3: Quiz Mode funktioniert weiterhin (alte Struktur)

**Ziel**: Prüfen, dass Quiz Mode noch mit alter Struktur funktioniert

**Schritte**:
1. Wechsle zu Quiz Mode
2. Starte ein Quiz
3. Prüfe:
   - Quiz funktioniert wie vorher
   - Vokabeln werden angezeigt
   - Antworten können gegeben werden

**Erwartetes Ergebnis**:
- ✅ Quiz Mode funktioniert weiterhin
- ✅ Keine Breaking Changes
- ✅ Alle Features funktionieren

---

## Phase 5 Checkpoint: Frontend Quiz Mode (KRITISCH)

### Test 5.1: Quiz Mode zeigt Vokabeln aus Datenbank

**Ziel**: Prüfen, ob Quiz Mode Datenbank-Daten verwendet

**Schritte**:
1. Öffne Vocabulary Practice → Quiz Mode
2. Wähle eine Unit
3. Prüfe Browser Console:
   - `courseVocabulary` Query sollte geladen werden
   - `vocabWithProgress` Query sollte geladen werden

**Erwartetes Ergebnis**:
- ✅ Vokabeln werden aus Datenbank geladen
- ✅ Keine hardcoded `VOCABULARY` mehr im Quiz Mode
- ✅ Alle Vokabeln werden angezeigt

### Test 5.2: Antwort geben funktioniert

**Ziel**: Prüfen, ob Antworten korrekt verarbeitet werden

**Schritte**:
1. Im Quiz Mode:
   - Gebe eine korrekte Antwort → Prüfe: Progress wird aktualisiert
   - Gebe eine falsche Antwort → Prüfe: Progress wird aktualisiert
2. Prüfe in Convex Dashboard:
   - `vocabularyProgress` sollte aktualisiert sein
   - `correctAnswerCount` sollte erhöht sein

**Erwartetes Ergebnis**:
- ✅ Antworten werden korrekt verarbeitet
- ✅ Progress wird in Datenbank gespeichert
- ✅ Feedback wird korrekt angezeigt

### Test 5.3: vocabularyProgress wird aktualisiert

**Ziel**: Prüfen, ob vocabularyProgress korrekt aktualisiert wird

**Schritte**:
1. Beantworte eine Vokabel im Quiz Mode
2. Prüfe in Convex Dashboard → `vocabularyProgress`:
   - Neuer Eintrag sollte erstellt werden (falls nicht vorhanden)
   - Oder bestehender Eintrag sollte aktualisiert werden
   - `courseVocabularyId` sollte korrekt sein

**Erwartetes Ergebnis**:
- ✅ vocabularyProgress wird korrekt aktualisiert
- ✅ courseVocabularyId Foreign Key ist korrekt
- ✅ Keine Duplikate

### Test 5.4: Optimistic Updates funktionieren

**Ziel**: Prüfen, ob Optimistic Updates mit neuer Key-Struktur funktionieren

**Schritte**:
1. Im Quiz Mode:
   - Gebe eine Antwort
   - Prüfe: Progress wird SOFORT angezeigt (optimistic)
   - Warte auf Server-Response
   - Prüfe: Progress wird bestätigt/aktualisiert

**Erwartetes Ergebnis**:
- ✅ Optimistic Updates funktionieren
- ✅ Key-Struktur verwendet `word._id` statt `serbian:unit`
- ✅ Keine Race Conditions

**Prüfung**:
```javascript
// In Browser Console während Quiz:
// Prüfe: optimisticProgress Map sollte word._id als Key verwenden
```

### Test 5.5: XP wird korrekt vergeben

**Ziel**: Prüfen, ob XP-System mit courseVocabularyId funktioniert

**Schritte**:
1. Beantworte eine Vokabel 3x korrekt
2. Prüfe:
   - XP wird vergeben (5/10/20 XP)
   - `exerciseId` verwendet `courseVocabularyId`
   - User XP wird aktualisiert

**Erwartetes Ergebnis**:
- ✅ XP wird korrekt vergeben
- ✅ exerciseId Format: `vocab_word_{courseVocabularyId}_{count}`
- ✅ User.totalXP wird aktualisiert

**Prüfung in Convex Dashboard**:
```sql
-- Prüfe exerciseCompletions Tabelle
-- exerciseId sollte courseVocabularyId enthalten (nicht serbianWord)
```

### Test 5.6: Mastered Status wird korrekt gesetzt

**Ziel**: Prüfen, ob Mastery nach 3x korrekt funktioniert

**Schritte**:
1. Beantworte eine Vokabel 3x korrekt
2. Prüfe:
   - `vocabularyProgress.mastered` sollte `true` sein
   - Vokabel sollte aus Quiz entfernt werden (Filter)
   - Progress-Anzeige zeigt "Mastered" (⭐)

**Erwartetes Ergebnis**:
- ✅ Mastered Status wird nach 3x korrekt gesetzt
- ✅ Vokabel wird aus Quiz entfernt
- ✅ Progress-Anzeige ist korrekt

### Test 5.7: Quiz Filter funktioniert

**Ziel**: Prüfen, ob Mastered Words aus Quiz gefiltert werden

**Schritte**:
1. Mastere einige Vokabeln (3x korrekt)
2. Starte Quiz erneut
3. Prüfe:
   - Mastered Vokabeln werden NICHT angezeigt
   - Nur nicht-mastered Vokabeln werden angezeigt

**Erwartetes Ergebnis**:
- ✅ Mastered Words werden ausgeblendet
- ✅ Filter verwendet courseVocabularyId-basierte Suche
- ✅ Optimistic Updates werden berücksichtigt

### Test 5.8: Quiz Progress Persistenz funktioniert

**Ziel**: Prüfen, ob Quiz-Progress in localStorage und DB gespeichert wird

**Schritte**:
1. Starte Quiz, beantworte einige Fragen
2. Prüfe localStorage:
   - `quiz_progress_{unit}_{userId}` sollte existieren
   - `currentIndex` sollte korrekt sein
3. Lade Seite neu
4. Prüfe:
   - Quiz-Progress wird wiederhergestellt
   - `currentIndex` ist korrekt
   - Vokabeln werden von korrekter Position fortgesetzt

**Erwartetes Ergebnis**:
- ✅ Quiz-Progress wird in localStorage gespeichert
- ✅ Quiz-Progress wird in DB gespeichert
- ✅ Persistenz funktioniert nach Reload

**Prüfung**:
```javascript
// In Browser Console:
localStorage.getItem('quiz_progress_1_{userId}')
// Sollte JSON mit currentIndex, score, etc. enthalten
```

### Test 5.9: incorrectWordIds werden korrekt gespeichert

**Ziel**: Prüfen, ob incorrectWordIds als courseVocabularyId[] gespeichert werden

**Schritte**:
1. Gebe einige falsche Antworten im Quiz
2. Prüfe in Convex Dashboard → `quizProgress`:
   - `incorrectVocabularyIds` sollte `courseVocabularyId[]` enthalten
   - Oder `incorrectWordIds` sollte noch `serbianWord[]` enthalten (während Migration)

**Erwartetes Ergebnis**:
- ✅ incorrectVocabularyIds wird verwendet (wenn verfügbar)
- ✅ Fallback auf incorrectWordIds funktioniert
- ✅ Beide Formate werden unterstützt

### Test 5.10: isUnitMastered zeigt korrekten Status

**Ziel**: Prüfen, ob Unit Mastery Status korrekt angezeigt wird

**Schritte**:
1. Mastere alle Vokabeln einer Unit (3x korrekt jede)
2. Prüfe:
   - Unit wird als "Mastered" angezeigt (⭐)
   - `isUnitMastered` gibt `true` zurück
   - Status wird korrekt aktualisiert

**Erwartetes Ergebnis**:
- ✅ Unit Mastery wird korrekt erkannt
- ✅ Status-Anzeige ist korrekt
- ✅ Verwendet courseVocabulary statt VOCABULARY

---

## Phase 6 Checkpoint: Weitere Komponenten

### Test 6.1: Home Page zeigt korrekte Daten

**Ziel**: Prüfen, ob Home Page Vokabel-Anzahl aus Datenbank zeigt

**Schritte**:
1. Öffne Home Page
2. Prüfe:
   - TOTAL_VOCABULARY wird angezeigt
   - MODULES_DATA zeigt korrekte vocabCount pro Modul
   - Zahlen kommen aus Datenbank (nicht hardcoded)

**Erwartetes Ergebnis**:
- ✅ Vokabel-Anzahl wird aus Datenbank berechnet
- ✅ Module zeigen korrekte Zahlen
- ✅ Keine hardcoded VOCABULARY mehr

**Prüfung**:
```javascript
// In Browser Console auf Home Page:
// Prüfe Network Tab → api.vocabulary.getAllCourseVocabulary
// Sollte geladen werden
```

### Test 6.2: VocabularyList zeigt korrekten Mastery-Status

**Ziel**: Prüfen, ob VocabularyList Mastery korrekt anzeigt

**Schritte**:
1. Öffne Vocabulary List
2. Prüfe:
   - Unit Mastery Status (⭐) wird korrekt angezeigt
   - `isUnitMastered` verwendet courseVocabulary
   - Status wird korrekt aktualisiert

**Erwartetes Ergebnis**:
- ✅ Mastery Status ist korrekt
- ✅ Verwendet Datenbank-Daten
- ✅ Keine hardcoded VOCABULARY mehr

### Test 6.3: Keine VOCABULARY Imports mehr

**Ziel**: Prüfen, ob alle hardcoded Imports entfernt wurden

**Schritte**:
1. Suche nach `VOCABULARY` Imports im Code:
   ```bash
   grep -r "VOCABULARY" client/src/pages/
   ```
2. Prüfe:
   - Nur noch als Fallback/DEPRECATED markiert
   - Hauptfunktionalität verwendet Datenbank

**Erwartetes Ergebnis**:
- ✅ Keine aktiven VOCABULARY Imports mehr
- ✅ Alle als DEPRECATED markiert
- ✅ Fallback-Logik vorhanden

---

## Phase 7 Checkpoint: Migration & Validierung

### Test 7.1: Migration-Script Trockentest

**Ziel**: Prüfen, ob Migration-Script ohne Fehler läuft

**Schritte**:
1. Führe Migration-Script im Dry-Run-Modus aus:
   ```bash
   cd scripts
   DRY_RUN=true npx tsx migrate-vocabulary-schema.ts
   ```
2. Prüfe Output:
   - Keine Fehler
   - Anzahl der zu migrierenden Einträge wird angezeigt
   - Validierung zeigt keine Probleme

**Erwartetes Ergebnis**:
- ✅ Script läuft ohne Fehler
- ✅ Alle Einträge können migriert werden
- ✅ Keine Datenintegritäts-Probleme

### Test 7.2: Datenintegrität prüfen

**Ziel**: Prüfen, ob alle Daten konsistent sind

**Schritte**:
1. Nach Migration:
   - Prüfe: Anzahl `vocabulary` = Anzahl `vocabularyProgress`
   - Prüfe: Alle `courseVocabularyId` sind gültig
   - Prüfe: Keine Duplikate (`userId` + `courseVocabularyId`)

**Erwartetes Ergebnis**:
- ✅ Alle Daten sind konsistent
- ✅ Foreign Keys sind gültig
- ✅ Keine Duplikate

**Prüfung in Convex Dashboard**:
```sql
-- Prüfe vocabularyProgress Tabelle
-- Alle courseVocabularyId sollten gültige IDs sein
-- Keine Duplikate bei (userId, courseVocabularyId)
```

### Test 7.3: Quiz Progress Migration

**Ziel**: Prüfen, ob Quiz Progress korrekt migriert wurde

**Schritte**:
1. Führe Quiz Progress Migration aus:
   ```bash
   DRY_RUN=true npx tsx migrate-quiz-progress.ts
   ```
2. Prüfe:
   - Alle `incorrectWordIds` können konvertiert werden
   - `incorrectVocabularyIds` wird erstellt

**Erwartetes Ergebnis**:
- ✅ Migration läuft ohne Fehler
- ✅ Alle Words können konvertiert werden
- ✅ Keine Datenverluste

---

## Phase 8 Checkpoint: Cleanup & Finalisierung

### Test 8.1: Keine VOCABULARY Imports mehr

**Ziel**: Finale Validierung - keine hardcoded Daten mehr

**Schritte**:
1. Suche nach allen `VOCABULARY` Verwendungen:
   ```bash
   grep -r "VOCABULARY" client/src/
   ```
2. Prüfe:
   - Nur noch als DEPRECATED/Fallback
   - Keine aktive Verwendung mehr

**Erwartetes Ergebnis**:
- ✅ Keine aktiven Imports mehr
- ✅ Alle als DEPRECATED markiert
- ✅ System funktioniert vollständig mit Datenbank

### Test 8.2: getTranslation/getAlternatives nicht mehr verwendet

**Ziel**: Prüfen, ob alte Helper-Funktionen nicht mehr verwendet werden

**Schritte**:
1. Suche nach `getTranslation` und `getAlternatives`:
   ```bash
   grep -r "getTranslation\|getAlternatives" client/src/
   ```
2. Prüfe:
   - Nur noch als Fallback verwendet
   - Hauptfunktionalität verwendet Spalten (`word.de`, `word.en`)

**Erwartetes Ergebnis**:
- ✅ Alte Helper-Funktionen nur noch als Fallback
- ✅ Neue Spalten-Struktur wird bevorzugt verwendet

### Test 8.3: System funktioniert vollständig

**Ziel**: Finale End-to-End Tests

**Schritte**:
1. **Vocabulary Practice - Learn Mode**:
   - Vokabeln anzeigen ✅
   - Navigation ✅
   - Übersetzungen ✅
2. **Vocabulary Practice - Quiz Mode**:
   - Quiz starten ✅
   - Antworten geben ✅
   - Progress wird aktualisiert ✅
   - XP wird vergeben ✅
   - Mastery funktioniert ✅
3. **Vocabulary List**:
   - Vokabeln anzeigen ✅
   - Mastery Status ✅
   - Suche funktioniert ✅
4. **Home Page**:
   - Vokabel-Anzahl ✅
   - Module-Daten ✅

**Erwartetes Ergebnis**:
- ✅ Alle Features funktionieren
- ✅ Keine Fehler
- ✅ Performance ist akzeptabel

---

## Troubleshooting

### Problem: Queries geben leere Arrays zurück

**Lösung**:
1. Prüfe ob Daten in `courseVocabulary` vorhanden sind
2. Prüfe ob Migration-Script ausgeführt wurde
3. Prüfe ob User authentifiziert ist

### Problem: Foreign Key Fehler

**Lösung**:
1. Prüfe ob alle `courseVocabularyId` gültig sind
2. Führe Migration-Script erneut aus
3. Prüfe Datenintegrität

### Problem: Optimistic Updates funktionieren nicht

**Lösung**:
1. Prüfe ob Key-Struktur korrekt ist (`word._id`)
2. Prüfe Browser Console für Fehler
3. Prüfe ob `vocabWithProgress` geladen wird

### Problem: Performance-Probleme

**Lösung**:
1. Prüfe Query-Performance in Convex Dashboard
2. Prüfe ob Indizes vorhanden sind
3. Prüfe Anzahl der geladenen Daten

---

## Checkliste für jeden Checkpoint

- [ ] Alle Tests durchgeführt
- [ ] Erwartete Ergebnisse erreicht
- [ ] Keine Fehler in Console
- [ ] Performance ist akzeptabel
- [ ] Datenintegrität gewährleistet
- [ ] Fallback-Logik funktioniert
- [ ] Keine Breaking Changes

---

## Nächste Schritte nach erfolgreichen Tests

1. **Production-Migration vorbereiten**:
   - Backup erstellen
   - Migration-Scripts testen
   - Rollback-Plan bereitstellen

2. **Monitoring einrichten**:
   - Query-Performance überwachen
   - Fehler-Logging aktivieren
   - User-Feedback sammeln

3. **Cleanup nach Monitoring-Phase**:
   - Alte Tabellen entfernen
   - Hardcoded Dateien entfernen
   - Deprecated Code entfernen

