# Content Studio — Translator Hardening & Admin-Verwaltbarkeit

**Status:** Vorschlag, wartet auf Freigabe
**Kontext:** Beobachtetes Problem in Unit 3 DE (Prod), Exercise 5 „Dialogvervollständigung": mehrere Fragen haben einen zusätzlich angehängten englischen Referenztext in Klammern. Root Cause liegt im EN→DE-Übersetzer des Content Studio, der aktuell komplett hardcoded ist und keine Admin-Regeln kennt.

---

## 1. Aktueller Zustand (Ist)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CONTENT STUDIO PIPELINE                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   [Creator]  →  [QC / Fix]  →  [Auditor]  →  [Human Review]              │
│      │              │              │                                       │
│      ▼              ▼              ▼                                       │
│   Skills*       Skills*        Skills*        ← Admin-verwaltet           │
│   Memory*       Memory*        Memory*        ← Admin-verwaltet           │
│                                                                            │
│                          ▼ Publish EN                                      │
│                                                                            │
│              [EN → DE Translator]                                          │
│                    │                                                       │
│                    ▼                                                       │
│              **HARDCODED PROMPTS**              ← NICHT admin-verwaltet   │
│              keine Skills, keine Memory                                    │
│                                                                            │
│                    ▼ Publish DE                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Legende:** `Skills*` = `contentStudioSkills` (Tabelle mit Prompt-Snippets, Admin-UI in `ContentStudioAdmin`). `Memory*` = `contentStudioValidatorMemory` (Regel-Bibliothek mit Guidance/Pattern/Beispielen).

**Konkrete Fundstelle:** `convex/contentStudio/_translationCore.ts`
- `META_SYSTEM_BASE` (Zeilen ~320–360): Metadaten-Übersetzung
- `buildSectionSystemPrompt` (Zeilen ~415–500): Markdown-Sektionen
- `buildTestsSystemPrompt` (Zeilen ~785–840): interaktive Tests

Alle drei Prompt-Builder verketten reine String-Konstanten. Der Aufruf-Kontext lädt weder aktive Skills noch Memory-Einträge.

### Symptom des Bugs

Für die Kategorie `dialogueCompletion` (intern `questionType: multipleChoice`) fehlt eine explizite Regel: „Serbisches Dialog-Snippet bleibt Serbisch, kein zusätzlicher EN-Referenztext in Klammern anhängen." Die KI hat in einem alten Lauf für Unit 3 diese Regel selbständig erfunden — und falsch (EN in Klammern angehängt).

---

## 2. Zielbild (Soll)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CONTENT STUDIO PIPELINE (neu)                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   [Creator]  →  [QC / Fix]  →  [Auditor]  →  [Human Review]              │
│      │              │              │                                       │
│      ▼              ▼              ▼                                       │
│   Skills         Skills        Skills         ← Admin-verwaltet           │
│   Memory         Memory        Memory         ← Admin-verwaltet           │
│                                                                            │
│                                                                            │
│              [EN → DE Translator]                                          │
│                    │                                                       │
│                    ▼                                                       │
│              Basis-Prompt (Code, minimal, invariant)                       │
│                    +                                                       │
│              Skills mit stage="translator"      ← NEU, Admin-verwaltet   │
│                    +                                                       │
│              Memory (applyInTranslator=true)    ← NEU, Admin-verwaltet   │
│                    ▼                                                       │
│              Deterministischer Guard            ← NEU, Sicherheitsnetz    │
│              (Code-Invariante, kein Prompt-Text)                          │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Drei-Schichten-Prinzip:**

| Schicht | Was | Wo lebt sie | Änderbar durch |
|---|---|---|---|
| **1. Basis-Prompt** | Strukturelle Anweisungen (JSON-Output, `_____`-Blanks erhalten, IDs unverändert) | Code | Entwickler-Commit |
| **2. Admin-Skills + Memory** | Didaktische Regeln, Beispiele, Tonalität, Sonderfälle wie „dialogueCompletion bleibt Serbisch" | Convex-DB, `ContentStudioAdmin` UI | Admin per UI |
| **3. Deterministischer Guard** | Strukturelle Invarianten, die niemals verletzt werden dürfen (z.B. „keine EN-Klammer angehängt, die im Original nicht war") | Code (Test-Funktion) | Entwickler-Commit |

Klare Trennung. Kein Prompt-Fließtext im Code, nur strukturelle Basis. Kein Guard-Text in der DB, nur überprüfbare Invarianten. Kein Spaghetti.

---

## 3. Was konkret gebaut wird

### Baustein A — Schema-Erweiterung

**Datei:** `convex/schema/contentStudio.ts`

- `contentStudioSkills.stage`: Union um `v.literal("translator")` erweitern
- `contentStudioValidatorMemory.scope`: um `applyInTranslator: v.boolean()` erweitern
- Neuer Index: `by_stage_active` bleibt, funktioniert automatisch für `translator`

**Migration:** Keine Datenmigration nötig (Zusatz-Werte im Union sind rückwärtskompatibel). Bestehende Memory-Einträge bekommen `applyInTranslator: false` als Default über einen einmaligen Backfill.

### Baustein B — Translator lädt Admin-Regeln

**Datei:** `convex/contentStudio/_translationCore.ts`

Neue Helper-Funktion:

```ts
async function loadTranslatorAdminContext(ctx: ActionCtx): Promise<{
  skillBlock: string;   // Admin-Skills als "--- SKILL: name ---\n{prompt}" Block
  memoryBlock: string;  // Admin-Memory als kompakte Guidance-Liste
}>
```

Wird in **drei** Aufrufstellen eingebunden:
1. `translateMetadata(...)` — vor `META_SYSTEM_BASE` gestellt
2. `translateSection(...)` — vor `buildSectionSystemPrompt` gestellt
3. `translateTestsForCategoryOnce(...)` — vor `buildTestsSystemPrompt` gestellt

Reihenfolge im finalen System-Prompt: **Basis-Prompt → Admin-Skills → Admin-Memory → Retry-Feedback (falls Retry)**.

### Baustein C — Deterministischer Guard

**Datei:** `convex/contentStudio/_translationCore.ts` (nahe der existierenden Guards)

Neue Funktion:

```ts
export function findAppendedForeignParentheticalIssues(
  pairs: Array<{ questionId, questionType, category, questionEn, questionDe }>
): string[]
```

Prüft für `category === "dialogueCompletion"` (und optional `multipleChoice` mit serbischem Dialog-Prompt):

- Zählt Klammer-Blöcke `(...)` in `questionEn` vs `questionDe`
- Wenn `questionDe` **mehr** Klammer-Blöcke hat als `questionEn` **und** der Zusatzinhalt englisch aussieht (heuristische Wort-Menge oder identisch mit `questionEn`-Text) → Issue
- Feedback-Text für Retry: „Zusätzlich angehängte englische Klammer in questionId=... entfernen. Dialog bleibt Serbisch, keine EN-Referenz."

Wird in `translateTestsForCategory` neben `findLostOrUntranslatedGlossIssues` aufgerufen. Ein automatischer Retry, dann harter Fehler (bestehendes Muster).

### Baustein D — Admin-UI

**Datei:** `client/src/pages/ContentStudioAdmin.tsx` und untergeordnete Skill-Editor-Komponenten (bestehende Struktur)

- Skill-Erstellungs-Formular: Dropdown `stage` bekommt Option `translator` mit Label „EN → DE Translator"
- Skill-Liste: Filter/Kategorie um `translator` erweitern
- Validator-Memory-Editor: dritte Checkbox `In Translator anwenden` (bisher: In Creator, In Fix, In Validator)

**Kein neuer Screen.** Nur bestehende Formular-Felder erweitern. Kein Spaghetti-Fluss.

### Baustein E — Seed-Skill (initialer Inhalt)

Ein initialer Skill wird über eine einmalige Admin-Aktion angelegt (oder von Hand via UI). Vorschlag für den Text — **den bearbeitest du danach in der UI, er lebt in der DB**:

```
Name: Dialogue-Completion: kein Referenztext anhängen
Stage: translator
Prompt:
  For questions with category=="dialogueCompletion":
  - The prompt is a Serbian dialogue snippet with speaker markers (A: / B:).
  - Keep the Serbian text EXACTLY as-is. Do NOT translate it into German.
  - Do NOT append a parenthetical reference translation.
  - Do NOT paraphrase, restructure, or extend the dialogue.
  - Options and correctAnswer stay Serbian and unchanged.
```

Der Basis-Prompt im Code enthält **nur** die strukturelle Regel („Optionen bleiben Serbisch, IDs unverändert, JSON-Schema"). Die didaktische Nuance („kein Referenztext") wandert in den Admin-Skill.

---

## 4. Was NICHT gebaut wird

- Kein neuer Translator-Screen im Admin.
- Kein separates „Translator-Memory" — dieselbe Memory-Tabelle wie bestehend, nur Flag erweitert.
- Keine Änderung an der Publish-Reihenfolge oder am Draft-Workflow.
- Keine Änderung an bestehenden Skills/Memory-Einträgen.
- Kein Bereinigen des DB-Contents (Prod). Content wird neu generiert, wie du gesagt hast.

---

## 5. Warum das nicht Spaghetti wird

**Ein Muster, dreimal angewendet.** Die Translator-Integration folgt exakt der Struktur, die Creator (`_creator.ts`) und Section-Revise (`_sectionRevise.ts`) bereits nutzen: `basePrompt → skillBlock → memoryBlock → retryFeedback`. Keine neue Abstraktion, nur konsequente Anwendung des bestehenden Patterns.

**Klare Verantwortung pro Schicht.**
- Basis-Prompt = strukturelle Invariante (nie mehr angefasst, außer bei Schema-Änderung)
- Admin-Skill = inhaltliche Regel (jederzeit editierbar ohne Deploy)
- Guard = strukturelle Prüfung (nur bei neuen Prüfmustern angepasst)

**Kein doppelter Wahrheits-Ort.** Der Basis-Prompt sagt „was" (Format), der Admin-Skill sagt „wie" (Didaktik), der Guard prüft „ob's stimmt" (Invariante). Kein Text wandert von einem Ort zum anderen.

**Rückwärtskompatibel.** Ohne Admin-Skills mit `stage="translator"` verhält sich der Translator exakt wie heute (nur mit strengerem Guard). Bestehende Übersetzungsläufe brechen nicht.

---

## 6. Testbarkeit

- **Guard-Funktion** (`findAppendedForeignParentheticalIssues`) ist eine reine Funktion ohne Convex-Kontext → direkt Unit-Test-fähig
- **Fixture-Test:** EN-Frage `A: Excuse me... B: _____` + DE-Frage mit angehängtem `(A: Excuse me... B: _____)` → Guard muss `1 issue` melden
- **Regressions-Test:** Legitim gleiche Klammer-Anzahl → Guard muss `0 issues` melden
- **Integrations-Test:** Test-Draft mit `dialogueCompletion` durch Translator → in Mock-Mode prüfen, dass Skill-Block im finalen System-Prompt vorkommt

---

## 7. Aufwandsschätzung

| Baustein | Aufwand | Betroffene Dateien |
|---|---|---|
| A: Schema-Erweiterung | S | `convex/schema/contentStudio.ts`, kleiner Backfill |
| B: Translator lädt Admin-Regeln | M | `convex/contentStudio/_translationCore.ts` (+ ggf. `_shared.ts` für Loader) |
| C: Guard-Funktion | S | `_translationCore.ts` |
| D: Admin-UI-Erweiterung | S | `ContentStudioAdmin.tsx` + Skill-Editor-Komponente |
| E: Seed-Skill (optional, per Admin selbst anlegbar) | XS | keine (UI-Aktion) |
| Tests | S | neue Test-Datei unter `convex/contentStudio/__tests__/` |

**S** = < 1h, **M** = 1–3h, **XS** = < 15min. Gesamt: rund einen halben Arbeitstag.

---

## 8. Freigabe-Checkpoint

Bevor ich anfange:

1. Passt der Ansatz „Drei Schichten" (Basis-Prompt / Admin-Skill / Guard)?
2. Bau-Reihenfolge Vorschlag: A → C → B → D → Tests. C zuerst als Netz, damit auch ohne Admin-Skill schon abgesichert ist.
3. Soll ich beim Skill-Loader `contentStudioValidatorMemory` gleich mit einbinden (Baustein B), oder erst mal nur Skills, und Memory in einem Folgeschritt?

Auf dein Go warte ich, bevor ich in Dateien schreibe.
