# Markdown Quality Checklist

## Analysierte Dateien

- ✅ `20251214-v5-unit-1-at-the-train-station.md`
- ✅ `20251214-v5-unit-2-at-the-konoba.md`

---

## Gefundene Probleme & Lösungen

### 1. Strukturelle Fehler

#### Problem 1.1: Doppelte oder fehlerhafte Headings

**Gefunden in:** Unit 1, Zeile 29

```markdown
## 2. V## 2. Vocabulary (Vokabular)
```

**Problem:** Heading-Syntax ist fehlerhaft (doppeltes `##`).

**Lösung:**

```markdown
## 2. Vocabulary (Vokabular)
```

**Warum kritisch:** Der Parser kann diese Section nicht korrekt identifizieren.

---

#### Problem 1.2: Doppelte Exercise-Nummern

**Gefunden in:** Unit 1, Zeilen 321 und 337

```markdown
### Exercise 5: Multiple Choice (Gender Recognition)
...
### Exercise 5: Multiple Choice (Vocabulary)
```

**Problem:** Exercise 5 erscheint zweimal. Die zweite sollte Exercise 6 sein.

**Lösung:**

```markdown
### Exercise 5: Multiple Choice (Gender Recognition)
...
### Exercise 6: Multiple Choice (Vocabulary)
```

**Warum kritisch:** Der Parser überschreibt Exercise 5 mit der zweiten Definition.

---

### 2. Vocabulary-Tabellen

#### Problem 2.1: Fehlende "Answer (for database)"-Spalte

**Gefunden in:** Unit 1, Zeile 33; Unit 2, Zeile 33

**Aktuell:**

```markdown
| Serbian | English | Notes |
| :--- | :--- | :--- |
| Zdravo | Hello (Informal) | Use with people your age or younger. |
```

**Problem:** Parser kann keine `correctAnswer` für Vokabel-Exercises generieren.

**Lösung:** Füge die Spalte "Answer (for database)" hinzu:

```markdown
| Serbian | English | Answer (for database) | Notes |
| :--- | :--- | :--- | :--- |
| Zdravo | Hello (Informal) | Zdravo | Use with people your age or younger. |
```

**Warum kritisch:** Ohne `Answer (for database)` können Vokabeln nicht korrekt importiert werden.

---

#### Problem 2.2: Montenegrin-Varianten im Serbian-Feld

**Gefunden in:** Unit 1, Zeile 42

**Aktuell:**

```markdown
| Gde* je...? | Where is...? | Essential for directions. |
```

**Problem:** Stern-Marker (`*`) sollte nicht im Serbian-Feld stehen (Audio-Generierung).

**Lösung:** Varianten in Notes auslagern:

```markdown
| Serbian | English | Answer (for database) | Notes |
| :--- | :--- | :--- | :--- |
| Gde je...? | Where is...? | Gde je...? | **Montenegro:** Gdje je...? |
```

**Warum kritisch:** Audio-Dateien würden mit `Gde*` generiert → Fehler.

---

#### Problem 2.3: Gender-Marker inkonsistent

**Gefunden in:** Unit 1, Zeilen 52-53

**Aktuell:**

```markdown
| Prijatelj | Friend | Masculine form |
| Putovanje | Journey / Trip | Neuter form |
```

**Problem:** Gender ist nur in Notes, sollte aber separates Feld sein.

**Lösung:** Nutze dediziertes Gender-Feld:

```markdown
| Serbian | English | Gender | Answer (for database) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Prijatelj | Friend | m | Prijatelj | |
| Putovanje | Journey / Trip | n | Putovanje | |
```

**Warum wichtig:** Strukturierte Gender-Info für spätere Features (z.B. Audio, Grammatik-Übungen).

---

### 3. Exercise-Tabellen

#### Problem 3.1: Fehlende "Options"-Spalte bei Multiple Choice

**Gefunden in:** Unit 1, Zeilen 313-318

**Aktuell:**

```markdown
### Exercise 4: Multiple Choice (Question Formation)

**Instructions:** Choose the correct way to form the Yes/No question in Serbian.

| Statement | Options | Answer (for database) |
| :--- | :--- | :--- |
| Ti si turista. | a) Ti si li turista? b) Jesi li ti turista? c) Jesi ti turista? | b |
```

**Problem:** `Options` als Text in der Spalte statt als strukturierte Daten.

**Lösung:** Trenne Options als kommagetrennte Liste:

```markdown
| Statement | Options | Answer (for database) |
| :--- | :--- | :--- |
| Ti si turista. | Ti si li turista?, Jesi li ti turista?, Jesi ti turista? | Jesi li ti turista? |
```

**Warum kritisch:** Parser kann Options nicht korrekt extrahieren, wenn sie als "a) ... b) ..." formatiert sind.

---

#### Problem 3.2: Answer enthält nur Buchstaben statt vollständigen Text

**Gefunden in:** Unit 1, Zeile 315

**Aktuell:**

```markdown
| Ti si turista. | a) Ti si li turista? b) Jesi li ti turista? c) Jesi ti turista? | b |
```

**Problem:** `correctAnswer` ist nur `"b"`, nicht der volle Text.

**Lösung:** Nutze den vollen Text als Answer:

```markdown
| Ti si turista. | Ti si li turista?, Jesi li ti turista?, Jesi ti turista? | Jesi li ti turista? |
```

**Warum kritisch:** Frontend benötigt den vollen Text, nicht nur den Buchstaben.

---

#### Problem 3.3: Fehlende Spalte "Question" oder "English"

**Gefunden in:** Unit 1, Zeile 313 (Exercise 4)

**Aktuell:**

```markdown
| Statement | Options | Answer (for database) |
```

**Problem:** Spalte heißt "Statement", sollte aber "Question" oder "English" heißen für Konsistenz.

**Lösung:** Nutze konsistente Spaltenüberschriften:

```markdown
| English Prompt | Options | Answer (for database) |
```

**Warum wichtig:** Parser erkennt "English" oder "Question" automatisch, "Statement" nicht.

---

### 4. Fehlende Sections

#### Problem 4.1: Grammar und Phrases nicht immer vorhanden

**Gefunden in:** Manche Units haben wenig Grammar/Phrases-Content.

**Problem:** Sections sind leer oder fehlen komplett.

**Lösung:** Füge Mindest-Content hinzu oder markiere explizit als Optional:

```markdown
## 3. Grammar (Gramatika)

*This unit focuses on practical phrases. Grammar is introduced in later units.*
```

**Warum wichtig:** Parser erwartet diese Sections, leere Sections sind OK, aber fehlende Sections führen zu Errors.

---

### 5. Montenegrin vs. Serbian (Ekavian vs. Ijekavian)

#### Problem 5.1: Varianten nicht konsistent dokumentiert

**Gefunden in:** Überall verstreut als `*Montenegro:` oder im Text.

**Problem:** Keine strukturierte Trennung zwischen Serbian (Standard) und Montenegrin (Variant).

**Lösung:** Nutze dedizierte Spalten oder strukturierte Notes:

**Option A: Separate Spalten**

```markdown
| Serbian (Ekavian) | Montenegrin (Ijekavian) | English | Answer (for database) |
| :--- | :--- | :--- | :--- |
| Gde je...? | Gdje je...? | Where is...? | Gde je...? |
```

**Option B: Strukturierte Notes**

```markdown
| Serbian | English | Answer (for database) | Dialect Notes |
| :--- | :--- | :--- | :--- |
| Gde je...? | Where is...? | Gde je...? | **Montenegro (Ijekavian):** Gdje je...? |
```

**Empfehlung:** Option B (strukturierte Notes), da Serbian (Ekavian) der Standard ist.

---

## Checkliste für neue Markdown-Dateien

### Metadata

- [ ] `# Module X: [Titel]` vorhanden
- [ ] `## Unit Y: [Titel]` vorhanden
- [ ] `**Base Language:**` und `**Target Language:**` angegeben

---

### 1. Overview

- [ ] Section `## 1. Overview` vorhanden
- [ ] Learning Objectives klar definiert

---

### 2. Vocabulary

- [ ] Section `## 2. Vocabulary (Vokabular)` vorhanden
- [ ] Tabelle mit folgenden Spalten:
  - [ ] `Serbian` (nur das Wort, keine Marker!)
  - [ ] `English`
  - [ ] `Answer (for database)` (= Serbian-Wort)
  - [ ] `Notes` (optional, für Gender, Dialect, etc.)
- [ ] Alle Montenegrin-Varianten in `Notes` oder separater Spalte
- [ ] Gender-Marker (m/f/n) konsistent dokumentiert
- [ ] Keine Sterne (`*`) oder Klammern im `Serbian`-Feld

---

### 3. Grammar

- [ ] Section `## 3. Grammar (Gramatika)` vorhanden
- [ ] Verb-Tabellen vollständig
- [ ] Beispiele mit korrekten Übersetzungen

---

### 4. Phrases

- [ ] Section `## 4. Phrases (Practical Application)` vorhanden
- [ ] Dialogues mit klar definierten Rollen
- [ ] Phrasen-Tabelle mit `Serbian`, `English`, `Notes`

---

### 5. Interactive Test

- [ ] Section `## 5. Interactive Test (Exercises)` vorhanden
- [ ] **Mindestens 3 Exercises**
- [ ] Jede Exercise hat:
  - [ ] Eindeutigen Titel: `### Exercise X: [Typ]`
  - [ ] **Instructions** (Pflicht!)
  - [ ] Tabelle mit Fragen und Antworten
  - [ ] Spalte `Answer (for database)` (Pflicht!)

---

### Exercise-Typen

#### Translation

```markdown
### Exercise 1: Translation

**Instructions:** Translate the following phrases from English to Serbian.

| English | Answer (for database) |
| :--- | :--- |
| Hello | Zdravo |
```

✅ **Parser erkennt:** Keywords "translation" im Titel

---

#### Fill in the Blank

```markdown
### Exercise 2: Fill-in-the-Blank

**Instructions:** Complete the sentences with the correct Serbian word.

| Sentence | Answer (for database) |
| :--- | :--- |
| Ja _________ Alex. | sam |
```

✅ **Parser erkennt:** Keywords "fill", "blank"

---

#### Multiple Choice

```markdown
### Exercise 3: Multiple Choice

**Instructions:** Choose the correct Serbian translation.

| English Prompt | Options | Answer (for database) |
| :--- | :--- | :--- |
| Where is...? | Kako je...?, Gde je...?, Šta je...? | Gde je...? |
```

✅ **Parser erkennt:** Keywords "multiple", "choice"

**Wichtig:**
- Spalte `Options` muss vorhanden sein
- Options als **kommagetrennte Liste** (nicht "a) ... b) ...")
- `Answer (for database)` muss **vollständiger Text** sein (nicht "a" oder "b")

---

#### Vocabulary Matching

```markdown
### Exercise 4: Vocabulary Matching

**Instructions:** Match the Serbian word with its English translation.

| Serbian Word | Options | Answer (for database) |
| :--- | :--- | :--- |
| Zdravo | Hello, Goodbye, Thank you | Hello |
```

✅ **Parser erkennt:** Keywords "matching"

---

#### Dialogue Completion

```markdown
### Exercise 5: Dialogue Completion

**Instructions:** Complete the dialogue with the correct Serbian phrase.

| Dialogue Line | Options | Answer (for database) |
| :--- | :--- | :--- |
| **Alex:** Izvinite, _________ dan. | Dobar, Dobro, Dobra | Dobar |
```

✅ **Parser erkennt:** Keywords "dialogue"

---

## Häufige Fehler & Quick Fixes

### Fehler 1: Parser findet keine Exercises

**Symptom:** `exercises.en` ist leer oder hat 0 Kategorien.

**Ursache:** Section `## 5. Interactive Test` fehlt oder Exercises beginnen nicht mit `### Exercise X:`.

**Quick Fix:**

```markdown
## 5. Interactive Test (Exercises)

### Exercise 1: Translation
...
### Exercise 2: Fill-in-the-Blank
...
```

---

### Fehler 2: "Missing correctAnswer" Errors

**Symptom:** Viele Validation Errors wie `correctAnswer is required`.

**Ursache:** Spalte `Answer (for database)` fehlt in Exercise-Tabellen.

**Quick Fix:** Füge die Spalte zu jeder Exercise-Tabelle hinzu:

```markdown
| English | Answer (for database) |
| :--- | :--- |
| Hello | Zdravo |
```

---

### Fehler 3: "options must have at least 2 items"

**Symptom:** Multiple-Choice-Exercises haben Validation Errors.

**Ursache:** Spalte `Options` fehlt oder ist falsch formatiert.

**Quick Fix:**

```markdown
| English Prompt | Options | Answer (for database) |
| :--- | :--- | :--- |
| Where is...? | Kako je...?, Gde je...?, Šta je...? | Gde je...? |
```

**Wichtig:** Mindestens 2 Options, kommagetrennt!

---

### Fehler 4: Vokabeln sind nicht "sauber"

**Symptom:** `serbian` enthält Klammern, Slashes, Gender-Marker.

**Ursache:** Vokabel-Tabelle hat `Prijatelj (m)` oder `student/studentkinja`.

**Quick Fix:** Nur das Wort in `Serbian`, Rest in `Notes`:

```markdown
| Serbian | English | Answer (for database) | Notes |
| :--- | :--- | :--- | :--- |
| Prijatelj | Friend | Prijatelj | Gender: m |
```

**Alternativ:** Parser säubert automatisch, aber besser direkt richtig formatieren.

---

## Empfohlener Workflow für externe KI

Wenn du eine externe KI nutzt, um Markdown-Content zu erstellen, gib ihr diesen Prompt:

```
Create a Markdown file for a Serbian language learning unit with the following structure:

# Module [X]: [Module Title]
## Unit [Y]: [Unit Title]

**Base Language:** English
**Target Language:** Serbian (Serbo-Croatian)

## 1. Overview
- Include Learning Objectives

## 2. Vocabulary (Vokabular)
- Create a table with columns: Serbian | English | Answer (for database) | Notes
- "Serbian" column: ONLY the Serbian word (no brackets, slashes, gender markers, asterisks)
- "Answer (for database)": Same as Serbian word
- "Notes": Gender (m/f/n), Montenegrin variants, dialect notes
- Example:
  | Serbian | English | Answer (for database) | Notes |
  | :--- | :--- | :--- | :--- |
  | Prijatelj | Friend | Prijatelj | Gender: m |
  | Gde je...? | Where is...? | Gde je...? | **Montenegro:** Gdje je...? |

## 3. Grammar (Gramatika)
- Include verb conjugation tables
- Include practical examples

## 4. Phrases (Practical Application)
- Include essential phrases table
- Include a dialogue

## 5. Interactive Test (Exercises)
- Create at least 5 exercises with different types:
  - Translation
  - Fill-in-the-Blank
  - Multiple Choice
  - Vocabulary Matching
  - Dialogue Completion

For EVERY exercise:
1. Clear title: "### Exercise X: [Type]"
2. Instructions: "**Instructions:** [Clear instructions]"
3. Table with questions and answers
4. MUST include "Answer (for database)" column

For Multiple Choice exercises:
- Include "Options" column with comma-separated options (NOT "a) ... b) ...")
- "Answer (for database)" must be the FULL TEXT (not "a" or "b")
- Example:
  | English Prompt | Options | Answer (for database) |
  | :--- | :--- | :--- |
  | Where is...? | Kako je...?, Gde je...?, Šta je...? | Gde je...? |

CRITICAL RULES:
- NO asterisks (*) in "Serbian" column
- NO brackets, slashes, or gender markers in "Serbian" column
- ALL metadata goes in "Notes" column
- EVERY exercise table MUST have "Answer (for database)" column
- Multiple choice "Answer" must be FULL TEXT, not letter/number
```

---

## Nächste Schritte

1. **Bestehende Units korrigieren:**
   - Nutze diese Checklist, um Units 1-5 zu überarbeiten
   - Teste jede Unit mit `pnpm test:markdown`
   - Behebe alle Validation Errors

2. **Template erstellen:**
   - Erstelle eine Markdown-Template-Datei für neue Units
   - Nutze die Checklist als Basis

3. **Externe KI instruieren:**
   - Gib der KI den oben genannten Prompt
   - Teste die generierten Dateien immer lokal bevor du sie hochlädst

4. **CI/CD Integration:**
   - Integriere `validate-unit-packages.ts` in CI/CD
   - Blockiere Pull Requests mit Validation Errors

---

**Fragen oder Probleme?**

Wenn du unsicher bist, ob eine Markdown-Datei korrekt strukturiert ist:
1. Teste lokal mit `pnpm test:markdown`
2. Prüfe den Validation Report
3. Nutze diese Checklist zum Abgleich
