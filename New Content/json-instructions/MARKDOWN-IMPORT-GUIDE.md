# Markdown-Import-Guide

## Überblick

Mit dem Markdown-Import-Feature kannst du **Markdown-Dateien direkt in JSON konvertieren** und in die Datenbank importieren - ohne Umweg über externe KI-Tools.

Der Parser:
- Extrahiert automatisch Metadaten, Vokabeln, Grammatik, Phrasen und Exercises
- Validiert die Struktur und Inhalte
- Wendet Auto-Fixes an (z.B. säubert Vokabeln, normalisiert Optionen)
- Zeigt dir ein Preview der generierten JSON
- Ermöglicht Download der JSON für spätere Verwendung

---

## Voraussetzungen

### Markdown-Struktur

Deine Markdown-Datei **muss** folgende Struktur haben:

```markdown
# Module X: [Modultitel]

## Unit Y: [Unittitel]

**Description:** [ONE short sentence shown under the unit title in the app]

## 1. Overview
[Einführungstext in die Unit]

#### A Note from the Founder (optional)
> "Kurzer persönlicher Kontext/Warum diese Unit wichtig ist."

## 2. Vocabulary
**Instructions:** ...

| Serbian | English | Answer (for database) |
|---------|---------|----------------------|
| ...     | ...     | ...                  |

## 3. Grammar (optional)
[Grammatik-Erklärungen in Markdown-Format]

## 4. Phrases and Dialogues (optional)
[Phrasen und Dialoge in Markdown-Format]

## 5. Interactive Test
**Test Introduction:** [Einleitung]

### Exercise 1: [Titel]
**Instructions:** [Anweisungen]

| English | Serbian | Answer (for database) |
|---------|---------|----------------------|
| ...     | ...     | ...                  |

### Exercise 2: [Titel]
...
```

### Wichtige Regeln

1. **Pflichtfelder:**
   - Module & Unit Header (`# Module X:` und `## Unit Y:`)
   - **Unit Description** direkt nach dem Unit-Header: `**Description:** ...`
   - Section `## 1. Overview`
   - Section `## 2. Vocabulary`
   - Section `## 5. Interactive Test` mit mindestens einem Exercise

2. **Vokabeln:**
   - Spalten: `Serbian`, `English`, `Answer (for database)`
   - **Answer** sollte nur das saubere serbische Wort enthalten (keine Gender-Marker, Slashes, Klammern)
   - Gender-Info und Notes werden automatisch erkannt und extrahiert

3. **Exercises:**
   - Jede Übung beginnt mit `### Exercise X: [Titel]`
   - **Instructions** sind Pflicht
   - **Empfohlen für Updates:** Füge pro Frage eine stabile **`Question ID`** hinzu (siehe Abschnitt „Stabile Question IDs“ unten)
   - **Tabelle** mit Fragen und Antworten ist Pflicht
   - Spalte `Answer (for database)` ist **kritisch** - ohne diese kann der Parser keine correctAnswer zuordnen

4. **Exercise-Typen** (werden automatisch erkannt):
   - **Translation** (Keywords: "translation", "time expressions")
   - **Fill in the Blank** (Keywords: "fill", "blank", "verb conjugation", "hajde da")
   - **Multiple Choice** (Keywords: "multiple", "choice", "situational")
   - **Vocabulary Matching** (Keywords: "matching")
   - **Dialogue Completion** (Keywords: "dialogue")

---

## Workflow

### 1. Markdown-Datei vorbereiten

Stelle sicher, dass deine Markdown-Datei die oben beschriebene Struktur hat. Besonders wichtig:
- **Alle Exercises haben Instructions**
- **Alle Fragen haben Antworten** in der Spalte `Answer (for database)`

---

## Stabile Question IDs (empfohlen für Updates ohne Progress-Verlust)

### Warum?
Unsere Datenbank nutzt `questionId` als **eindeutigen Schlüssel** für eine Frage. Wenn sich diese ID bei einem Update ändert, wirkt es für das System wie eine **neue Frage** (Progress kann dann nicht sauber „gematcht“ werden).

### Wie?
Füge in **jede Exercise-Fragen-Tabelle** eine zusätzliche Spalte **`Question ID`** hinzu (am besten als **erste** Spalte).

Beispiel (Translation):

```markdown
| Question ID | English Prompt | Answer (for database) |
|------------|----------------|------------------------|
| u6_ex1_q01 | Where is the bank? | Gde je banka? |
| u6_ex1_q02 | I live in a small town. | Živim u malom gradu. |
```

Beispiel (Multiple Choice):

```markdown
| Question ID | Question | Options | Answer (for database) |
|------------|----------|---------|------------------------|
| u6_ex3_q01 | Choose the correct form | A) ... / B) ... / C) ... | B) ... |
```

### Regeln für stabile IDs
- **Nie neu generieren**, wenn du eine bestehende Frage nur textlich korrigierst.
- **Nur ändern**, wenn du bewusst eine Frage „neu“ machen willst.
- Format-Empfehlung: `u<UNIT>_ex<EX>_q<NN>` (z.B. `u6_ex3_q01`).

### Copy/Paste Prompt für externe KI (Question IDs erzwingen)

```text
You will produce a SINGLE Markdown file for ONE unit.

CRITICAL REQUIREMENT: add a short unit description line directly under the unit header.
Use EXACTLY this format:
**Description:** <one short sentence (max ~120 characters)>
This will be stored in `unitMetadata.description` and shown under the unit title in the app.

CRITICAL REQUIREMENT: add stable Question IDs for every exercise question.
Our system uses `questionId` as the unique key. If it changes between versions, progress cannot be matched reliably.

1) For EVERY exercise question table, add a column named EXACTLY:
   "Question ID"
   Put it as the FIRST column.

2) The value in "Question ID" MUST be stable and deterministic.
   Use this format exactly:
   u<UNIT>_ex<EX>_q<NN>
   Examples:
   u6_ex1_q01
   u6_ex1_q02
   u6_ex3_q01

3) Rules:
   - Never leave **Description** empty.
   - Never leave "Question ID" empty.
   - Never generate random IDs.
   - If you regenerate the unit later, reuse the SAME IDs for the SAME questions.
   - If a question is truly new, append the next NN.
   - Do NOT reuse an existing ID for a different question.

4) Do NOT change any other column requirements:
   - Every table must include "Answer (for database)" with the exact correct answer.
   - For multiple-choice, include "Options" and make sure the correct answer is exactly one of the options.
```
- **Vokabeln sind sauber** (nur Wort in Serbian-Spalte, Meta-Info in Notes)

Du kannst die Markdown-Datei mit unserem Test-Script vorab prüfen:

```bash
pnpm test:markdown
```

Dieses Script:
- Lädt `Unit-7-Going-Out-with-Friends-v1.md` (oder eine andere MD-Datei, die du im Script angibst)
- Parst sie zu JSON
- Wendet Auto-Fixes an
- Validiert die JSON
- Speichert Ausgaben in `New Content/jsons/_test-output/`

### 2. Admin UI öffnen

1. Gehe zu **Admin > Content Import**
2. Wähle den Tab **"Import Markdown"**

### 3. Markdown hochladen

- **Drag & Drop:** Ziehe die `.md`-Datei in den Upload-Bereich
- **Oder:** Klicke auf "Select file" und wähle die Datei aus

Die Datei wird sofort gelesen und der Inhalt angezeigt.

### 4. Parsen starten

Klicke auf **"Parse Markdown to JSON"**.

Der Parser:
- Validiert die Markdown-Struktur
- Extrahiert alle Inhalte
- Wendet Auto-Fixes an
- Validiert die generierte JSON

Du siehst dann:
- **Status:** Erfolg oder Fehler
- **Validation-Report:** Anzahl Errors, Warnings und Changes
- **Preview:** Die ersten 20 Zeilen der generierten JSON

### 5. Ergebnis prüfen

#### Bei Errors (rot)

Die JSON hat Validierungsfehler und kann **nicht importiert** werden. Häufige Probleme:

- **Missing correctAnswer:** Exercise-Frage hat keine Antwort in der Markdown-Tabelle
  - **Fix:** Füge die Spalte `Answer (for database)` hinzu
- **Empty options:** Multiple-Choice-Frage hat keine Optionen
  - **Fix:** Füge die Spalte `Options` mit kommagetrennten Antworten hinzu
- **Missing exercise sections:** Keine Exercises gefunden
  - **Fix:** Stelle sicher, dass `## 5. Interactive Test` existiert und Übungen enthält

Klicke auf **"Show Errors"**, um Details zu sehen.

#### Bei Warnings (gelb)

Die JSON ist **valide**, aber es gibt Verbesserungsvorschläge:
- Vokabeln wurden automatisch gesäubert
- Optionen wurden normalisiert
- Duplikate wurden entfernt

Das ist **OK** - du kannst trotzdem importieren.

#### Bei Erfolg (grün)

Die JSON ist **fehlerfrei** und kann importiert werden!

### 6. JSON speichern (optional)

Klicke auf **"Download JSON"**, um die generierte JSON-Datei zu speichern. 

Vorteil:
- Backup für spätere Nutzung
- Kann im Tab "Import JSON" nochmals hochgeladen werden
- Kann manuell bearbeitet werden, falls notwendig

### 7. Import

#### Option A: Direkt importieren

1. Klicke auf **"Import to Database"**
2. **Modul auswählen:** Wähle das zugehörige Modul aus dem Dropdown
3. Bestätige mit **"IMPORT"**

#### Option B: JSON speichern + später im JSON-Tab importieren

1. Klicke auf **"Download JSON"**
2. Wechsle zum Tab **"Import JSON"**
3. Lade die JSON-Datei hoch und importiere sie dort

---

## Troubleshooting

### Parser findet keine Exercises

**Problem:** `exercises.en` ist leer oder hat nur 0 Kategorien.

**Ursache:**
- Section `## 5. Interactive Test` fehlt
- Oder: Keine `### Exercise X:` Subheadings gefunden

**Lösung:**
- Füge die Section `## 5. Interactive Test` hinzu
- Stelle sicher, dass jede Übung mit `### Exercise X:` beginnt

---

### Validation Error: "Missing correctAnswer"

**Problem:** Viele Fragen haben keine `correctAnswer` in der JSON.

**Ursache:**
- Spalte `Answer (for database)` fehlt in der Markdown-Tabelle
- Oder: Spalte ist leer

**Lösung:**
- Füge die Spalte `Answer (for database)` zu jeder Exercise-Tabelle hinzu
- Fülle sie mit den korrekten Antworten

---

### Validation Error: "options must have at least 2 items"

**Problem:** Multiple-Choice-Fragen haben keine oder zu wenige Optionen.

**Ursache:**
- Spalte `Options` fehlt in der Markdown-Tabelle
- Oder: Spalte hat weniger als 2 Optionen

**Lösung:**
- Füge die Spalte `Options` zur Tabelle hinzu
- Fülle sie mit mindestens 2 kommagetrennten Optionen
- Beispiel: `Options` = `ide, idem, idu`

---

### Vokabeln sind nicht "sauber"

**Problem:** `serbian` enthält Klammern, Slashes, Gender-Marker.

**Ursache:**
- In der Markdown-Tabelle steht z.B. `želim (m/f)` oder `student/studentkinja`

**Lösung:**
Der Parser säubert das **automatisch**:
- `želim (m/f)` → `želim` + `noteEn: "(m/f)"`
- `student/studentkinja` → Wird gesplittet in 2 Einträge

Falls das nicht ausreicht:
- Verwende die Spalte `Notes` für Meta-Informationen
- Schreibe nur das Hauptwort in die `Serbian`-Spalte

---

### "Module nicht gefunden"

**Problem:** Beim Import wird ein Fehler angezeigt, dass das Modul nicht existiert.

**Ursache:**
- `moduleNumber` in der Markdown stimmt nicht mit der Datenbank überein
- Oder: Modul wurde noch nicht angelegt

**Lösung:**
- Wähle beim Import manuell das richtige Modul aus dem Dropdown
- Oder: Lege das Modul zuerst in der Datenbank an

---

## Tipps für beste Ergebnisse

1. **Markdown konsistent halten:**
   - Nutze immer die gleichen Spaltenüberschriften
   - Halte dich an die Standard-Section-Namen
   - Schreibe "### Exercise X:" immer gleich

2. **Vokabeln vorbereiten:**
   - Trenne Gender-Info, alternative Übersetzungen und Dialect-Notes **vor** dem Import
   - Nutze die Spalten `Notes` oder schreibe sie direkt in separate Spalten

3. **Exercises gut strukturieren:**
   - Jede Exercise sollte Instructions haben
   - Nutze sinnvolle Titel (werden als `category` verwendet)
   - Für Multiple-Choice: Spalte `Options` mit mindestens 2 Optionen

4. **Test zuerst lokal:**
   - Nutze `pnpm test:markdown` für erste Checks
   - Schau dir die generierten Dateien in `_test-output/` an
   - Behebe Errors, bevor du im Admin UI importierst

5. **Backups erstellen:**
   - Nutze "Download JSON" nach erfolgreichem Parse
   - Speichere die JSON-Dateien in `New Content/jsons/` für spätere Verwendung

---

## Vergleich: Markdown vs. JSON Import

| Feature                     | Markdown Import          | JSON Import             |
|-----------------------------|--------------------------|-------------------------|
| **Quelle**                  | `.md`-Datei              | `.json`-Datei           |
| **Aufwand**                 | Mittel (Struktur nötig)  | Gering (wenn valide)    |
| **Auto-Fixes**              | Ja                       | Ja                      |
| **Validierung**             | Ja                       | Ja                      |
| **Preview**                 | Ja                       | Nur Statistik           |
| **Download JSON möglich**   | Ja                       | N/A                     |
| **Fehlerkorrektur**         | Markdown bearbeiten      | JSON bearbeiten         |
| **Empfohlen für**           | Neue Content-Erstellung  | Fertige/getestete Units |

**Empfehlung:**
- **Markdown Import** für neue Units, die du erst erstellst
- **JSON Import** für Units, die bereits als JSON vorliegen und validiert sind

---

## Beispiel-Workflow (komplett)

1. Externe KI erstellt Markdown-Datei mit Content
2. Du prüfst die MD-Datei lokal mit `pnpm test:markdown`
3. Falls Errors: MD-Datei anpassen
4. Falls OK: MD-Datei in Admin UI hochladen
5. "Parse Markdown to JSON" klicken
6. Validation Report prüfen
7. Falls Errors: MD-Datei anpassen und neu hochladen
8. Falls OK: "Download JSON" für Backup
9. Modul auswählen und "Import to Database"
10. Fertig! Unit ist nun in der Datenbank

---

## Nächste Schritte

- Lies die [JSON-FORMAT-SPEC.md](./JSON-FORMAT-SPEC.md) für Details zur JSON-Struktur
- Lies die [ADMIN-UI-GUIDE.md](./ADMIN-UI-GUIDE.md) für allgemeine Admin-UI-Nutzung
- Lies die [MODULE-SELECTION-FEATURE.md](./MODULE-SELECTION-FEATURE.md) für Details zur Modul-Auswahl

---

**Fragen oder Probleme?**

Wenn etwas nicht funktioniert:
1. Prüfe die Markdown-Struktur gegen die Anforderungen oben
2. Schau dir die Error-Messages im Validation Report an
3. Teste lokal mit `pnpm test:markdown`
4. Falls das Problem bleibt: Kontaktiere den Entwickler
