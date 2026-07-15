# Entscheidungsmatrix: Was zählt als Kurs-Vokabel?

**Status:** offen — noch keine Policy-Entscheidung  
**Kontext:** Cleanup-Panel „Auto-added entries“, Auto-Insert aus Übungen, Notes mit Ableitungen  
**Stand:** 2026-07-15

## Worum geht’s?

Manche Einträge in `courseVocabulary` sind **gebeugte Formen** (`zovem`, `zoveš`, …), nicht die Wörterbuch-Grundform (`zvati se`). In den Notes steht oft, wie sich die Form ableitet.

Frage: Ist das **gewollte Kurs-Vokabel** — oder nur Nebenprodukt vom Auto-Add aus Übungen?

Es gibt kein „richtig/falsch“ a priori. Es ist eine didaktische + produktseitige Entscheidung. Diese Matrix soll helfen, sie bewusst zu treffen.

---

## Die zwei Modelle

| | **A — Nur Grundformen** | **B — Formen erlaubt** |
|---|---|---|
| **Idee** | Eine Karte = Wörterbuch-Eintrag. Konjugation lebt in Grammar/Übungen. | Auch gebeugte Formen dürfen Karten sein, wenn Notes die Ableitung erklären. |
| **Beispiel** | Nur `zvati se` | `zvati se` **und** ggf. `zovem` / `zoveš` als eigene Karten |
| **Cleanup-Default** | AutoAdded-Flexionen → eher löschen / zur Grundform zusammenführen | AutoAdded-Flexionen → prüfen; behalten wenn Notes/Didaktik passen |

---

## Auswirkungs-Matrix

| Dimension | A — Nur Grundformen | B — Formen erlaubt |
|---|---|---|
| **Lerner-UX (Trainer)** | Weniger Karten, klarer Fokus. Formen übt man in Unit-Tests/Dialogen. | Mehr Karten; gut für „ich brauche genau diese Form“. Risiko: Trainer fühlt sich aufgebläht an. |
| **XP / Mastery** | Weniger Items → weniger XP-Oberfläche pro Unit (35 XP/Item nach Mastery, siehe `convex/gamification.ts`). | Mehr Items → mehr XP möglich. Fairness-Frage: belohnen wir Fleiß oder Dopplung derselben Wortfamilie? |
| **Notes / Didaktik** | Notes erklären Bedeutung, Register, Varianten (gde/gdje) — nicht ganze Konjugationstabellen. | Notes **müssen** Ableitung tragen („1sg von zvati se“), sonst sind Formen verwirrend. |
| **Auto-Add aus Übungen** | Strenge Regel: nur Grundformen inserten; Flexionen skippen oder dem bestehenden Lemma zuordnen. Cleanup wird seltener nötig. | Auto-Add darf Formen anlegen — aber braucht klare Kriterien (welche Formen? wann?), sonst wieder 80+ Müll-Kandidaten. |
| **DE-Übersetzung** | Eine saubere DE-Zeile pro Lemma. | Pro Form eigene DE-Zeile (`ich heiße`, `du heißt`, …) — mehr Pflege, mehr Translator-/QC-Last. |
| **Cross-Unit-Dedup** | Einfacher: ein serbisches Lemma = ein Key. | Schwerer: `zovem` vs. `zvati se` sind verschieden, semantisch verwandt — Dedup greift nicht automatisch. |
| **Audio / TTS** | Weniger Clips. | Mehr Clips; Formen klingen „nützlicher“ im Alltag, kosten aber Storage/Generierung. |
| **Content Studio / Creator** | Prompt: „nur Lemmata in Vocabulary-Tabelle“. Übungen dürfen flektieren. | Prompt: „Formen nur mit Ableitungs-Note und nur wenn lehrzielrelevant“. |
| **Cleanup-Panel heute** | Passt gut zur aktuellen Warnung („High confidence they are wrong“) für AutoAdded-Kram. | Warnung zu pauschal — viele AutoAdded-Zeilen wären dann **keine** Fehler, sondern Policy-Kandidaten. |

---

## Was heute faktisch passiert (ohne Policy)

1. Übungen enthalten flektierte Wörter.
2. Pipeline sieht: „steht nicht in der Unit-Vokabelliste“ → legt Eintrag an.
3. Marker: `AutoAdded: new vocabulary used in exercises`.
4. Cleanup listet das als Verdacht — **ohne** zu wissen, ob ihr Modell A oder B wollt.

Das Panel entscheidet also nicht die Policy. Es räumt nur Symptome weg. Deshalb: Policy zuerst (oder zumindest Default), Cleanup danach.

---

## Empfohlene Zwischenlösung (bis die Entscheidung steht)

| Sofort ok zum Löschen / Flaggen | Erstmal **nicht** massenlöschen |
|---|---|
| Personennamen, offensichtlicher Schrott | Formen mit sinnvoller EN/DE-Übersetzung und Ableitungs-Note |
| Kaputte Tokens / Nicht-Serbisch | Grenzfälle (`tvoj`, `zar`, Funktionswörter) — separat klären |
| Duplikate derselben Form in derselben Unit | Alles, was wie „bewusste Lehrform“ aussieht |

AI-Vorsortierung (Keep / Delete / Zur-Grundform) erst sinnvoll, **nachdem** A oder B (oder Hybrid) festliegt — sonst trainiert/promptet man gegen die falsche Regel.

---

## Hybrid-Option (falls weder A noch B reicht)

**C — Grundform + ausgewählte Lehrformen**

- Default: nur Grundform.
- Ausnahme: explizit markierte „Lehrformen“ (z. B. häufige 1sg bei Verben der Unit), immer mit Note und idealerweise Verweis auf die Grundform.
- Auto-Add: **nie** automatisch Formen anlegen; Formen nur aus Creator/Admin.

Mehr Disziplin im Content Studio, weniger Cleanup-Chaos.

---

## Entscheidungsfragen (zum Abhaken)

1. Soll ein Learner im Vokabel-Trainer **gebeugte Formen als eigene Karten** sehen? (ja / nein / nur ausgewählte)
2. Zählt XP pro Form — oder soll eine Wortfamilie eher **eine** Mastery-Einheit sein?
3. Dürfen Notes die Ableitung tragen und damit Formen rechtfertigen — oder gehören Ableitungen nur in den Grammar-Abschnitt?
4. Auto-Add: Formen **nie** / **immer wenn in Übung** / **nur mit Classifier-OK**?
5. Gilt die Regel für **EN- und DE-Track** gleich?

---

## Nächster Schritt (wenn entschieden)

- Policy in einem Satz in Content-Studio-Prompts / `cs_section_vocabulary` verankern.
- Auto-Add-Pfad anpassen (Insert härten).
- Cleanup-Copy und ggf. AI-Review an die Policy koppeln.
- Bestehende AutoAdded-Einträge einmalig nach der neuen Regel auditieren.

**Noch keine Code-Änderung nötig**, bis die Fragen oben beantwortet sind.
