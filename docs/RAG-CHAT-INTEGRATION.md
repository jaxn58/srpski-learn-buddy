# RAG-Integration im Chat (Learn Buddy)

## Was ist unsere RAG-Lösung?

RAG steht für **Retrieval Augmented Generation** — die KI erhält nicht nur den System-Prompt, sondern zusätzlich **kontextbezogene Daten aus unserer Datenbank**, die dynamisch zum Prompt hinzugefügt werden. Dadurch kann der Learn Buddy präzise, auf den Lernfortschritt des Users zugeschnittene Antworten geben.

Unsere RAG-Implementierung ist **kein Vektor-/Embedding-basiertes System**, sondern ein **strukturierter Abruf per Unit-Nummer**: Die aktuelle Unit des Users wird ermittelt, die relevanten Daten aus der DB geladen, als Textblock formatiert und dem System-Prompt angehängt.

---

## Aktueller Stand (implementiert)

### Datenfluss

```
User sendet Nachricht
       ↓
Frontend sendet unitContext = progress.currentUnit (z.B. 3)
       ↓
Backend: buildUnitContextBlock(unitNumber=3, learningLanguage="en")
       ↓
┌─────────────────────────────────────────────────────┐
│  courseVocabulary   → max. 30 Vokabeln der Unit     │
│  unitMetadata      → Unit-Titel                     │
│  unitContent       → Grammatik-Zusammenfassung      │
└─────────────────────────────────────────────────────┘
       ↓
Textblock wird an System-Prompt angehängt
       ↓
KI antwortet mit Unit-spezifischem Kontext
```

### Was aktuell geladen wird

| Datenquelle | Was | Limit | Sprache |
|---|---|---|---|
| `courseVocabulary` | Serbisch + Übersetzung + Genus | Max. 30 Einträge | User-Sprache (en/de/es/fr) |
| `unitMetadata` | Unit-Titel | 1 Eintrag | Englisch (fest) |
| `unitContent` (grammar) | Grammatik-Zusammenfassung | 500 Zeichen | Englisch (fest) |

### Beispiel-Output (was die KI sieht)

```
[UNIT CONTEXT: Greetings & Introductions (Unit 1)]

Key vocabulary for this unit:
- Zdravo = Hello
- Dobar dan = Good day
- Hvala = Thank you
- Molim (m) = Please / You're welcome
- Da = Yes
- Ne = No
...

Grammar summary:
The verb "biti" (to be) is one of the most important verbs in Serbian.
Present tense: ja sam, ti si, on/ona/ono je, mi smo, vi ste, oni/one/ona su...

[END UNIT CONTEXT]
```

### Beide Chat-Pfade

- **Streaming** (Hauptpfad): `getStreamContext` findet die letzte User-Nachricht mit `unitContext` in der Chat-Historie und baut den Block daraus.
- **Non-Streaming** (Fallback): `sendMessage` erhält `unitContext` direkt als Argument und ruft `getUnitContextBlock` auf.

---

## Was noch NICHT genutzt wird (Potenzial)

### Verfügbare Datenquellen im Schema

Die folgenden Tabellen existieren bereits in der Datenbank und könnten für eine erweiterte RAG-Integration genutzt werden:

#### 1. Erweiterte Unit-Inhalte (`unitContent`)

| Content-Type | Beschreibung | RAG-Potenzial |
|---|---|---|
| `overview` | Einführungstext der Unit | Kontext für allgemeine Unit-Fragen |
| `grammar` | Grammatik-Erklärung (vollständig) | Aktuell nur 500 Zeichen — Volltext möglich |
| `phrases` | Wichtige Phrasen der Unit | Konversationshilfe, Ausdrücke im Kontext |
| `dialogues` | Beispiel-Dialoge | Konversationsübung, Situationsbezug |
| `vocabulary` | Vokabel-Markdown (Volltext) | Alternative/Ergänzung zu `courseVocabulary` |
| `testIntroduction` | Übungs-Einleitung | Weniger relevant für Chat |
| `practice` | Übungsanweisungen | Weniger relevant für Chat |

**Mögliche Erweiterung:** Phrasen und Dialoge einbinden, damit der Learn Buddy Beispiel-Konversationen aus der Unit verwenden kann.

#### 2. Personalisierte Daten (User-Fortschritt)

| Tabelle | Daten | RAG-Potenzial |
|---|---|---|
| `vocabularyProgress` | Welche Vokabeln mastered/nicht mastered | Schwache Vokabeln gezielt üben |
| `quizProgress` | Quiz-Ergebnisse pro Unit | Schwache Units identifizieren |
| `exerciseQuestionProgress` | Einzelne Fragen-Ergebnisse | Spezifische Schwachstellen |
| `userProgress` | `currentUnit`, `completedUnits`, XP | Gesamtfortschritt verstehen |

**Mögliche Erweiterung:** Personalisiertes Coaching — "Du hast bei der Vokabel 'kuća' schon 3x falsch geantwortet. Lass uns das nochmal üben!"

#### 3. Kursstruktur

| Tabelle | Daten | RAG-Potenzial |
|---|---|---|
| `moduleMetadata` | Modul-Titel, Beschreibung, Reihenfolge | Überblick über den Kursaufbau |
| `unitMetadata` | Titel, Beschreibung, Topics, Grammar Focus | Detaillierte Unit-Infos |
| `unitInteractiveTests` | Fragen + Antworten (Quizzes) | Übungsfragen generieren (NICHT Lösungen!) |
| `unitContentAudio` | TTS-Audio-Referenzen | Weniger relevant für Text-Chat |

#### 4. Vollständige Vokabel-Daten (`courseVocabulary`)

Aktuell werden nur Basisfelder genutzt. Weitere verfügbare Felder:

| Feld | Beschreibung | RAG-Potenzial |
|---|---|---|
| `pronunciation` | Aussprache-Hinweis | Aussprache-Fragen beantworten |
| `noteEn` / `noteDe` | Sprachspezifische Notizen | Kontextuelle Erklärungen |
| `gender` | Genus (m/f/n) | Genus-Fragen, Deklinationshilfe |
| `category` | Wortart/Kategorie | Thematische Gruppierung |
| `serbianNormalized` | Normalisierte Form | Suche/Matching |

---

## Mögliche zukünftige Erweiterungen

### Stufe 1: Erweiterte Unit-Kontexte (niedrige Komplexität)

- **Phrasen einbinden**: `unitContent` mit `contentType="phrases"` laden — gibt dem Learn Buddy Beispiel-Phrasen für die Unit.
- **Vollständige Grammatik**: Statt 500 Zeichen die komplette Grammatik-Erklärung (oder z.B. 2000 Zeichen).
- **Aussprache-Hinweise**: `pronunciation`-Feld aus `courseVocabulary` in den Vokabel-Block einbauen.
- **Notizen**: `noteEn`/`noteDe` (je nach User-Sprache) als zusätzlichen Kontext pro Vokabel.
- **Metadaten-Sprache**: `unitMetadata` in der User-Sprache laden statt immer Englisch.

### Stufe 2: Personalisiertes RAG (mittlere Komplexität)

- **Schwache Vokabeln**: Aus `vocabularyProgress` die nicht-mastered Vokabeln laden und dem Prompt hinzufügen ("Der User hat Schwierigkeiten mit: kuća, prozor, vrata").
- **Quiz-Schwächen**: Aus `exerciseQuestionProgress` die häufig falsch beantworteten Kategorien identifizieren.
- **Fortschrittskontext**: "Der User ist in Unit 5, hat Units 1-4 abgeschlossen, 340 XP gesamt" — damit die KI den Wissensstand einschätzen kann.

### Stufe 3: Cross-Unit-Kontext (höhere Komplexität)

- **Multi-Unit-Vokabeln**: Nicht nur die aktuelle Unit, sondern auch Vokabeln aus vorherigen Units laden (z.B. die letzten 3 Units).
- **Thematische Verknüpfung**: Wenn der User nach einem Grammatikthema fragt, das in einer anderen Unit behandelt wird, den Kontext dieser Unit laden.
- **Modul-Überblick**: Bei allgemeinen Fragen den Kursaufbau (Module und deren Units) als Kontext geben.

### Stufe 4: Deep-Links (UI-Feature, separat geplant)

- **"Ask Learn Buddy" Buttons** in den Unit-Seiten bei Vokabeln und Grammatik.
- Vorbefüllte Fragen mit dem spezifischen Kontext (z.B. "Erkläre mir das Wort 'kuća' in verschiedenen Fällen").
- **Kein Button bei Exercises** (Anti-Schummel).

---

## Technische Hinweise

### Token-Budget

Jeder RAG-Block verbraucht Tokens im KI-Aufruf. Aktuelle Schätzung:
- 30 Vokabeln: ~300-400 Tokens
- Grammatik (500 Zeichen): ~100-150 Tokens
- System-Prompt: ~400-600 Tokens
- **Gesamt pro Anfrage**: ~800-1200 Tokens für Kontext

Bei Erweiterungen (Phrasen, Fortschritt, Multi-Unit) steigt der Token-Verbrauch. Das `maxTokens`-Limit (aktuell 2048 für Output) ist davon unabhängig, aber das Eingabe-Limit des Modells muss beachtet werden.

### Relevanz-Filter (noch nicht implementiert)

Aktuell wird der gesamte Block immer angehängt. Mögliche Optimierungen:
- **Relevanz-Check**: Nur Daten laden, die zur User-Frage passen (z.B. nur Vokabeln wenn nach einem Wort gefragt wird).
- **Dynamische Tiefe**: Bei einfachen Fragen weniger Kontext, bei komplexen Grammatikfragen mehr.
- **Aktive/Publizierte Daten**: Filter auf `isActive=true` und `releaseStatus="published"` hinzufügen (aktuell fehlt dieser Filter).

### Bekannte Limitierungen

1. `unitMetadata` und `unitContent` werden aktuell immer auf Englisch geladen, unabhängig von der User-Sprache.
2. Kein Filter auf `isActive` oder `releaseStatus` — theoretisch könnten archivierte/inaktive Daten mitkommen.
3. Maximal 30 Vokabeln — bei Units mit mehr Vokabeln fehlt der Rest.
4. Grammatik ist auf 500 Zeichen gekürzt — bei langen Grammatik-Erklärungen geht Information verloren.

---

## Dateien & Code-Referenzen

| Datei | Funktion |
|---|---|
| `convex/chat.ts` | `buildUnitContextBlock()`, `getUnitContextBlock()`, `getStreamContext()` |
| `convex/chat.ts` | `sendMessage()` (Non-Streaming), `streamChatMessage()` (Streaming) |
| `convex/ai/chatConfig.ts` | AI-Provider-Konfiguration, Failover |
| `convex/schema/vocabulary.ts` | `courseVocabulary`, `vocabularyProgress` |
| `convex/schema/learning.ts` | `unitMetadata`, `unitContent`, `unitInteractiveTests` |
| `convex/schema/progress.ts` | `userProgress`, `quizProgress`, `exerciseQuestionProgress` |
| `convex/schema/chat.ts` | `chatMessages` (enthält `unitContext` Feld) |
| `client/src/pages/Chat.tsx` | Frontend: sendet `unitContext: progress?.currentUnit` |
