# Content Studio — Redesign

**Status:** Kapitel 1 (Zielbild) definiert und wartet auf Freigabe. Kapitel 2 (Audit) und Kapitel 3 (Roadmap) sind Platzhalter — werden nach Freigabe von Kapitel 1 gefüllt.

**Kontext:** Zwei aktive Symptome haben eine strukturelle Ursache — Publish-Timeout in Prod (`internalPublishUnitPackageToPreview`) und der EN→DE-Translator, der englische Referenzen in Klammern anhängt. Beide sind Beispiele dafür, dass das Content Studio organisch gewachsen ist und ein Neudenken braucht. Ziel dieses Dokuments: Reihenfolge Zielbild → Ist-Zustand → Roadmap, damit jede zukünftige Änderung an einer klaren Zielarchitektur hängt statt am Einzelfall.

---

## Kapitel 1 — Zielbild

### 1.1 Grundprinzipien

Fünf Kernentscheidungen, aus der Abstimmung vom 15. Juli 2026:

| Dimension | Entscheidung |
|---|---|
| **Zielgruppe (Bedienung)** | Didaktische Redakteure ohne Programmier-Kenntnisse müssen produktiv arbeiten können. Das Content Studio ist kein Dev-Tool. |
| **Erstellungs-Modus** | AI-First bleibt: KI erzeugt Rohcontent, Mensch reviewt und korrigiert. Bestehender Drei-Stufen-Ablauf (Specialist → QC/Fix → Auditor) bleibt Fundament. |
| **Sprachen-Strategie** | **EN als Master**, DE und weitere Zielsprachen entstehen als Übersetzungsableitung. Konsistent mit `AGENTS.md`. |
| **Prompt-Management** | Zwei-Stufen-Modell mit **Parameter-basierten Skills**. Details in 1.4. |
| **Versionierung** | Sichtbare Versionshistorie pro Unit im Admin. Rollback auf frühere Versionen ist jederzeit möglich, nicht nur letzter Zustand. |

**Umfang der Umsetzung:** Greenfield. Content Studio wird strukturell neu gedacht. Alt-Code wird schrittweise ersetzt, nicht Big-Bang. Neue Features werden nur noch nach neuer Architektur gebaut; alte Pfade werden identifiziert und mit klarem Abschaltdatum markiert.

### 1.2 Rollenmodell

Zwei klar getrennte Rollen:

**Super-Admin** (aktuell: du)
- Legt die **Skill-Bibliothek** an: welche Skills existieren, was ihr Prompt-Text ist, welche Parameter sie haben, welche Werte pro Parameter erlaubt sind.
- Ändert Prompt-Basis-Texte (die strukturellen Anweisungen an die KI).
- Deployt Schema-/Code-Änderungen.

**Admin** (didaktischer Redakteur)
- Wählt für einen Draft aus der Skill-Bibliothek aus: welche Skills werden angewendet, welche Parameter-Werte werden gesetzt.
- Sieht Vorschau, führt AI-Runs aus, reviewt Ergebnisse, publiziert.
- **Legt keine Skills an, ändert keinen Prompt-Text.** Die didaktische Freiheit liegt in der **Parameter-Auswahl**, nicht in freier Prompt-Formulierung.

**Konsequenz für die UI:** Der Admin sieht keine Prompt-Textfelder. Er sieht Skills mit Namen, Beschreibung und Parameter-Dropdowns/Optionen. Der Super-Admin hat eine separate Ansicht („Skill-Verwaltung"), wo Prompt-Text und Parameter-Definition editierbar sind.

### 1.3 Content-Erstellungs-Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    CONTENT ERSTELLUNGS-FLOW                     │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│   [1] Admin legt Draft an                                        │
│       └─ wählt Skills + Parameter-Werte aus Bibliothek          │
│                                                                  │
│   [2] AI-Pipeline (EN als Master)                                │
│       ├─ Specialist erzeugt EN-Rohentwurf                       │
│       ├─ QC/Fix prüft & korrigiert EN                           │
│       └─ Auditor validiert EN                                   │
│                                                                  │
│   [3] Human Review (EN)                                          │
│       └─ Admin sieht Ergebnis, kann Section-Revise anstoßen     │
│                                                                  │
│   [4] Publish EN (Preview → Published)                           │
│       └─ Versionshistorie festgeschrieben                       │
│                                                                  │
│   [5] Übersetzungspipeline EN → DE (und weitere Zielsprachen)   │
│       ├─ Läuft nach EN-Publish separat und wiederholbar         │
│       └─ Nutzt eigene Skill-Klasse "translator" mit Parametern  │
│                                                                  │
│   [6] Human Review (DE)                                          │
│       └─ Admin bestätigt/korrigiert Übersetzung                 │
│                                                                  │
│   [7] Publish DE                                                 │
│       └─ Versionshistorie festgeschrieben (parallel zu EN)      │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

Wichtig: **EN und DE sind versionierte Zielobjekte, keine gekoppelten Zwillinge.** Eine EN-Version kann mehrere DE-Übersetzungsversionen haben (z.B. weil die Übersetzung mehrfach überarbeitet wurde). Die Rückverfolgbarkeit läuft über Version-IDs.

### 1.4 Skill-Modell mit Parametern

**Skill-Definition (nur Super-Admin editierbar):**

```
Skill: "Grammar Section — Anfänger"
Stage: specialist
Section: grammar
Prompt-Text (Template):
  You are teaching Serbian grammar at a beginner level.
  Tone: {{tone}}
  Length: {{length}}
  Include real-life examples: {{examples}}

Parameters:
  - tone: [formal | casual | child-friendly]  (default: casual)
  - length: [short | medium | long]           (default: medium)
  - examples: [yes | no]                      (default: yes)
```

**Admin-Auswahl beim Draft:**

Der Admin sieht ein Formular:
- Skill: „Grammar Section — Anfänger" (aus Dropdown vom Super-Admin verwaltet)
- Tone: [casual] ▼
- Length: [medium] ▼
- Examples: [yes] ▼

Das Ergebnis wird beim AI-Run in den Prompt eingesetzt. Der Admin sieht den finalen Prompt-Text **nicht**, aber er sieht das Ergebnis der KI.

**Alle AI-Stages** (Specialist, QC/Fix, Auditor, Translator) folgen diesem Muster. Kein Prompt läuft mehr ohne Skill-Deklaration.

### 1.5 Versionierung und Rollback

**Grundregel:** Jeder Publish (EN oder DE) erzeugt eine unveränderliche Version. Alte Versionen bleiben referenzierbar.

**Admin-Sicht pro Unit:**
- Aktuelle Live-Version (die Learner sehen)
- Preview-Versionen (unter Review)
- Historische Versionen mit Zeitstempel + Autor + verwendeten Skills + Parameter-Werten
- Ein-Klick-Rollback auf jede historische Version

**Datenmodell-Konsequenz:** Klare Trennung zwischen „live-sichtbar" (published + aktive Version) und „historisch" (published + nicht mehr aktiv). Kein Soft-Delete-Flag mehr, sondern explizite Versions-Zuordnung. Details werden im Audit + Roadmap geklärt.

**A/B-Testing:** Explizit **nicht** Teil des Zielbildes (Option `v_ab_testing` wurde nicht gewählt). Falls später gewünscht, ist es additiv auf der Versions-Struktur möglich.

### 1.6 Was explizit NICHT im Zielbild ist

Klare Abgrenzungen, damit später kein Feature-Creep entsteht:

- **Kein Human-First-Modus.** Die Pipeline bleibt AI-First. Admin schreibt keine Rohcontents, sondern konfiguriert die KI.
- **Kein freier Prompt-Zugriff für normale Admins.** Nur Parameter-Auswahl.
- **Kein Import-orientierter Modus** (externe Markdown-/JSON-Quellen als gleichberechtigte Content-Quelle). Import bleibt als Werkzeug bestehen (siehe bestehende `contentImportRuns`), ist aber nicht das primäre Erstellungsmuster.
- **Kein A/B-Testing** in der ersten Umsetzungswelle.
- **Kein externer Zugriff** (Freelancer / externe Autoren). Content Studio bleibt hinter Admin-Auth.
- **Keine Endnutzer-Sichtbarkeit auf Content-Studio-Interna.** Learner sehen nur die publizierte, aktive Version.

### 1.7 Offene Punkte für den Audit (Kapitel 2)

Fragen, die im Ist-Zustand-Audit geklärt werden müssen, bevor die Roadmap steht:

- **Prompt-Speicher-Konsolidierung:** Aktuell liegen Prompts in `chatPrompts` (auch Content-Studio-Section-Prompts), `contentStudioSkills` (aktuell nur inaktive Reste) und hardcoded im Code (`_translationCore.ts`, `_creator.ts`). Welche Migrationsstrategie in EINE Bibliothek?
- **Skill-Parameter-Format:** Als eigenes Feld im Skill-Schema (`parameters: v.array(v.object({key, label, options, default}))`) oder als Template-Engine-Konvention?
- **Übersetzer-Pipeline:** Bekommt eigener `stage: translator` in `contentStudioSkills` oder bleibt es hardcoded mit Basis-Prompt + optionalen Skills?
- **Versionshistorie:** Nutzen wir bestehende `unitVersion` + `isActive` (dann Cleanup-Strategie) oder Redesign zu einer expliziten `unitVersions`-Tabelle?
- **Cross-Unit-Duplikate:** Bleibt `courseVocabulary` unit-scoped (mit Guard) oder wird sie Master-Tabelle + Join (Hebel D aus der Publish-Timeout-Analyse)?
- **Publish-Atomarität:** Bleibt es eine große Mutation (Convex-Limits sprengen) oder Action + Batching?
- **Existierende Utilities:** Was aus `_vocabularyCleanup.ts`, `_validatorHelpers.ts`, `_verifier.ts`, `_auditor.ts` bleibt, was fließt neu?

Diese Punkte sind bewusst offen — sie hängen davon ab, was das Audit im Ist-Zustand tatsächlich findet.

---

## Kapitel 2 — Status Quo (Audit)

**Wird nach Freigabe von Kapitel 1 gefüllt.**

Umfang des Audits (geplant):

- Enumeration aller Prompt-Speicher (DB + Code)
- Enumeration aller Content-Studio-Tabellen mit Zeilenzahlen in Dev & Prod
- Alle Publish-/Import-Pfade und ihre Fehlerquellen
- Aktive Bugs mit Root-Cause-Referenz:
  - Publish-Timeout (`internalPublishUnitPackageToPreview`, dokumentiert im Parallelchat)
  - Translator-Klammer-Bug (dokumentiert in `CONTENT_STUDIO_TRANSLATOR_HARDENING.md`)
- Deprecated/tote Felder, Indizes und Code-Pfade
- Datenmengen-Analyse pro Tabelle (via Convex-Insights)

---

## Kapitel 3 — Roadmap

**Wird nach Freigabe von Kapitel 1 und Fertigstellung des Audits erstellt.**

Grundprinzip: **Greenfield, aber schrittweise.** Jede PR bringt uns näher an das Zielbild und macht keinen bestehenden Bug schlimmer. Die Reihenfolge wird nach Risiko/Nutzen im Audit priorisiert. Erwartbare frühe Bausteine:

- Prompt-Speicher-Konsolidierung als Fundament
- Skill-Parameter-Modell im Schema
- Migration bestehender aktiver Prompts in neue Skill-Bibliothek
- Publish-Refactoring gegen Convex-Limit
- Translator-Härtung als Sub-Item

Das existierende Dokument `CONTENT_STUDIO_TRANSLATOR_HARDENING.md` wird in diese Roadmap eingebettet und ggf. angepasst, sobald das Skill-Parameter-Modell steht.

---

## Freigabe-Checkpoint

Bevor Kapitel 2 (Audit) startet, brauche ich dein OK zu Kapitel 1:

1. Ist das Rollenmodell (Super-Admin vs Admin) so wie du es meinst?
2. Ist das Skill-Parameter-Beispiel aus 1.4 die richtige didaktische Freiheit für den Admin, oder brauchst du dort mehr/weniger?
3. Fehlt etwas Wesentliches im Zielbild, das jetzt schon rein sollte?

Auf dein Go warte ich, bevor der Audit anfängt.
