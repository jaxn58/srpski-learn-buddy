# Content Studio -- Anleitung zur bestmoeglichen Content-Erstellung

## Ueberblick

Das Content Studio erzeugt Lerneinheiten (Units) in einem mehrstufigen Pipeline-Prozess. Die Qualitaet des Ergebnisses haengt massgeblich davon ab, **was du beim Anlegen des Drafts angibst** und **wie du die Prompts in der DB konfiguriert hast**.

---

## Phase 1: Draft vorbereiten

Beim Erstellen eines Drafts gibt es folgende Eingabefelder:

| Feld | Pflicht | Einfluss auf Ergebnis |
|------|---------|----------------------|
| **Unit Number** | Ja | Bestimmt, welche Vokabeln als "bereits bekannt" gelten (alle Units < diese Nummer) |
| **Module Number** | Ja | Wird in den Markdown-Header geschrieben |
| **Title** | Ja | Wird als Ueberschrift und thematischer Kontext an die KI gegeben |
| **Description** | Nein | Ein-Satz-Zusammenfassung -- geht direkt in den User-Prompt und steuert den inhaltlichen Fokus |
| **Creator Brief** (unter `inspirationRef.notes`) | Nein | Freitext-Anweisungen an die KI -- **dein staerkstes Steuerungsmittel** |
| **PDF-Referenz** (unter `inspirationRef.referenceId`) | Nein | Ein Lehrbuch-PDF, aus dem die KI Strukturrichtlinien (keine Inhalte!) extrahiert |
| **Specialist Skills** | Automatisch | Alle aktiven Skills der Stage "specialist" werden automatisch geladen |

### Empfehlung fuer bestmoegliche Ergebnisse

1. **Title** kurz und praezise: z.B. "Numbers, Time & Days of the Week" statt "Unit about time"
2. **Description** mit Lernziel: z.B. "Learn to tell the time, count to 100, and name days and months in Serbian"
3. **Creator Brief** ist der Schluessel -- hier kannst du auf Deutsch oder Englisch konkrete Anweisungen geben:
   - Welche Vokabeln unbedingt enthalten sein sollen
   - Welche Grammatik-Themen behandelt werden muessen
   - Welcher Schwierigkeitsgrad erwartet wird
   - Spezifische Dialogsituationen (z.B. "Dialog in einem Cafe")
   - Was du NICHT willst (z.B. "Keine Faelle in dieser Unit")

---

## Phase 2: Generierung starten

### Schritt 1: Specialist (`runAiSpecialistGenerate`)

Die KI bekommt folgenden Input (in dieser Reihenfolge zusammengebaut):

```
SYSTEM-PROMPT:
  1. cs_unit_creator (aus chatPrompts DB)     -- Allgemeine Regeln, Formate, Hard Rules
  2. + Specialist Skills (aus DB)              -- Globale Zusatzregeln fuer alle Units
  3. + Reference Block (falls PDF vorhanden)   -- Richtlinien aus dem Lehrbuch-PDF

USER-PROMPT (fest im Code, nicht aenderbar):
  1. Markdown-Struktur-Vorlage                 -- Welche Sections, welche Headers
  2. Bekannte Vokabeln aus vorherigen Units    -- Damit keine Duplikate entstehen
  3. Overview-Format-Vorgaben                  -- Founder Note, Learning Objectives
  4. Section-Kurzregeln                        -- Vocab <= 30, Exercises: 6 Rows, etc.
  5. Creator Brief (dein Freitext)             -- Deine spezifischen Anweisungen
```

### Schritt 2: QC Validator (`runQcValidate`) -- laeuft automatisch

Reine Code-Pruefung (keine KI). Prueft:
- Markdown-Struktur valide?
- Alle 5 Sections vorhanden?
- Vocabulary-Format korrekt?
- Exercise-Formate korrekt?
- Keine doppelten Vokabeln aus vorherigen Units?

Ergebnis: `qc_passed` oder `qc_failed` + konkrete Findings-Liste

---

## Phase 3: Nachbearbeitung (wo du drehen kannst)

Wenn die erste Generierung nicht perfekt ist, hast du **drei Werkzeuge**:

### A) Section Revise -- einzelne Section nachbearbeiten

Dafuer kommen die **Section Prompts** zum Einsatz:
- `cs_section_overview` -- Regeln fuer die Overview-Section
- `cs_section_vocabulary` -- Regeln fuer die Vocabulary-Tabelle
- `cs_section_grammar` -- Regeln fuer die Grammar-Section
- `cs_section_phrases` -- Regeln fuer die Phrases/Dialogues
- `cs_section_exercises` -- Regeln fuer die 5 Exercise-Typen
- `cs_section_cultural` -- Regeln fuer die Cultural Note

Du gibst eine **Instruction** ein (z.B. "Replace all dialogueCompletion exercises with better ones about time") und die KI ueberarbeitet nur diese eine Section.

### B) Finding Fixer -- alle Findings automatisch beheben lassen

Prompt: `cs_finding_fixer` -- die KI bekommt die Findings-Liste + das komplette Markdown und fixt gezielt.

### C) Manuelles Editieren -- Markdown direkt bearbeiten

Ueber `saveMarkdownSnapshot` kannst du das Markdown direkt editieren. Danach QC Validator nochmal laufen lassen.

---

## Phase 4: Qualitaetssicherung

### Lector/Auditor (`runAiAuditor`) -- prueft inhaltlich

- Serbisch korrekt? (Ekavisch, nicht Ijekavisch)
- Uebersetzungen stimmen?
- Kulturelle/faktische Risiken?
- Uebungsfragen sinnvoll?

Prompt: `cs_lector` -- bestimmt, wie streng/mild der Lector prueft.

---

## Phase 5: Veroeffentlichung

1. **Preview** (`publishDraftToPreview`) -- Unit im Preview-Modus testen
2. **Freigabe** (`approveAfterPreview`) -- Review abschliessen
3. **Live** (`publishDraft`) -- Unit fuer User freischalten
4. **Optional: DE-Uebersetzung** (`translatePublishedUnitEnToDe`)

---

## Haeufige Fehler und Stellschrauben zur Optimierung

| Problem | Ursache | Loesung |
|---------|---------|---------|
| **Exercises haben falsches Format** (z.B. Options ohne Buchstaben, fehlende Instructions) | `cs_unit_creator` Prompt enthaelt nicht genug Format-Beispiele | Exercise-Format-Regeln im `cs_unit_creator` Prompt detaillierter machen -- inkl. Beispiel-Tabellen fuer alle 5 Typen |
| **Vokabeln aus vorherigen Units werden wiederholt** | Unit Number falsch gesetzt oder Kurs-Vokabel-DB unvollstaendig | Richtige Unit Number angeben; sicherstellen, dass vorherige Units publiziert sind |
| **Grammar-Section erklaert Faelle nicht** | `cs_unit_creator` hat die Case-Regel, aber KI ignoriert sie manchmal | Im Creator Brief explizit angeben: "Diese Unit nutzt Locative-Case -- erklaere ihn in der Grammar-Section" |
| **Dialogues haben falsches Tabellenformat** | KI nutzt manchmal Prosaform statt Tabelle | `cs_unit_creator` Prompt mit klarerem Dialogue-Format-Beispiel versehen |
| **Section Revise macht mehr kaputt als es fixt** | Section Prompt zu vage | `cs_section_*` Prompts praezisieren: "MODIFY ONLY what the instruction asks for" |
| **Lector findet zu viele Warnungen** | `cs_lector` Prompt zu streng | Lector-Prompt anpassen: nur echte Fehler melden, Style-Suggestions nur bei Evidence |
| **Finding Fixer kuerzt Output ab** | Grosse Units ueberschreiten Token-Limit | Ist bereits per Retry-Mechanismus abgefangen; ggf. Exercises einzeln per Section Revise fixen |
| **Founder Note fehlt oder ist auf Deutsch** | KI ignoriert die Regel im User-Prompt | Im Creator Brief zusaetzlich hinschreiben: "Include a Founder Note in English" |
| **dialogueCompletion (Ex5) hat Restaurant-Kontext obwohl Unit nicht ueber Essen ist** | Bekanntes KI-Bias-Problem | Explizit im Creator Brief: "Dialogue Completion exercises MUST be about [Topic], NOT about restaurants" |

---

## Optimale Reihenfolge fuer eine neue Unit

1. Draft anlegen mit **praezisem Title + Description + ausfuehrlichem Creator Brief**
2. `runAiSpecialistGenerate` ausfuehren
3. QC-Ergebnis pruefen -- Findings lesen
4. Bei Format-Fehlern: **Section Revise** auf die betroffene Section
5. Bei inhaltlichen Fehlern: **Finding Fixer** oder manuelles Editieren
6. Nochmal QC laufen lassen (passiert bei Section Revise/Finding Fixer automatisch)
7. Wenn `qc_passed`: **Lector** laufen lassen
8. Lector-Warnings pruefen -- bei echten Fehlern nochmal Section Revise
9. Preview publizieren, einmal durchklicken
10. Live schalten

---

## Die 9 Prompts und was sie steuern

| Prompt-Key | Wann aktiv | Was er steuert |
|------------|-----------|---------------|
| `cs_unit_creator` | Initiale Generierung | Gesamtstruktur, Formate, Sprach-Regeln, Exercise-Formate -- **der wichtigste Prompt** |
| `cs_finding_fixer` | Nach Findings | Wie Korrekturen vorgenommen werden, welche Sections verbatim kopiert werden |
| `cs_lector` | Nach QC-Pass | Wie streng die inhaltliche Pruefung ist, welche Warning-Codes erlaubt sind |
| `cs_section_overview` | Section Revise: Overview | Wie die Overview-Section ueberarbeitet wird |
| `cs_section_vocabulary` | Section Revise: Vocabulary | Regeln fuer neue Vokabel-Eintraege |
| `cs_section_grammar` | Section Revise: Grammar | Wie Grammar-Erklaerungen korrigiert/erweitert werden |
| `cs_section_phrases` | Section Revise: Phrases | Regeln fuer Dialogues und Phrase-Tabellen |
| `cs_section_exercises` | Section Revise: Exercises | Regeln fuer alle 5 Exercise-Typen |
| `cs_section_cultural` | Section Revise: Cultural | Wie Cultural Notes erweitert werden |

Der **Creator Brief** (Freitext beim Draft) ist dein direktester Einfluss auf den Inhalt. Die Prompts in der DB bestimmen die **generellen Regeln**; der Creator Brief bestimmt den **konkreten Inhalt** dieser spezifischen Unit.

---

## Prompt-Architektur (nach Refactoring)

Alle Prompts werden ausschliesslich aus der `chatPrompts`-Tabelle in der Convex-DB geladen. Es gibt **keine Code-Fallbacks** mehr. Wenn ein Prompt fehlt, bricht die Action mit einer klaren Fehlermeldung ab.

### Prompt-Aufloesung

```
chatPrompts DB (name = "cs_unit_creator")
       |
       v
resolvePromptFromDb(ctx, key)
       |
       +-- Prompt gefunden --> content zurueckgeben
       |
       +-- Prompt NICHT gefunden --> Error: "Please create it via /admin/prompt"
```

### Prompts verwalten

- **Einsehen/Bearbeiten:** `/admin/prompt` im Admin-Bereich
- **Status pruefen:** Prompt Preview im Content Studio Settings zeigt "Active" oder "Missing"
- **Einzige Ausnahme:** Der User-Prompt-Template (`getSpecialistUserPromptBase`) bleibt im Code, da er an den Markdown-Parser gekoppelt ist und sich nur zusammen mit dem Parser aendern darf.
