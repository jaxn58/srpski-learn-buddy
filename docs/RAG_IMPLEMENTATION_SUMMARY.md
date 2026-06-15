# RAG-System — Vollständige Umsetzung v1-Bugfix + v2 bis v6

> **Dokument-Version:** 1.0  
> **Datum:** 2026-04-24  
> **Status:** Implementierung abgeschlossen

---

## Was wir realisiert haben

### P0 Bugfix — Mehrsprachigkeit repariert

Das bestehende System hat Grammatik und Unit-Metadaten ausschließlich auf Englisch geladen, obwohl der User z.B. Deutsch als Lernsprache eingestellt hat. Das ist jetzt behoben — alle Inhalte werden in der Sprache des Users geladen, mit automatischem Fallback auf Englisch falls die Übersetzung noch nicht existiert.

**Datei:** `convex/chat.ts` → `buildUnitContextBlock()`

---

### v2 — Enhanced Structured Retrieval

Der AI Buddy sieht jetzt massiv mehr Kontext:

| Verbesserung | Vorher | Nachher |
|---|---|---|
| Grammatik-Kontext | 500 Zeichen, nur Englisch | 3.000 Zeichen, mehrsprachig |
| Phrases & Dialogues | Nicht vorhanden | Eingebunden (je max. 1.500 Zeichen) |
| Aussprache | Nicht vorhanden | `[ZDRAH-voh]` bei jedem Vokabel-Wort |
| Sprachspezifische Notes | Nicht vorhanden | z.B. "(informal)", "(umgangssprachlich)" |
| Schwache Vokabeln | Nicht vorhanden | Max. 10 Wörter, die der User oft falsch hat |
| User-Profil | Nicht vorhanden | Unit, abgeschlossene Units, XP, Streak |
| Vokabeln vorheriger Units | Nicht vorhanden | Letzte 2 Units als Wiederholungs-Kontext |

**Datei:** `convex/chat.ts` → `buildUnitContextBlock()` (erweitert um `userId`-Parameter)

---

### v3 — Semantische Suche mit Embeddings

- **Neue Tabelle** `knowledgeChunks` mit Vektor-Index (1536 Dimensionen, OpenAI `text-embedding-3-small`)
- **Embedding-Utility** `convex/ai/embeddings.ts` — `embedText()`, `embedTexts()`, `chunkText()`
- **Ingestion-Pipeline** `convex/ai/ingestKnowledge.ts` — verarbeitet alle Unit-Inhalte, Artikel und User-Dokumente automatisch in durchsuchbare Chunks
- **Hybrid Retrieval**: Jede User-Frage wird sowohl strukturiert (v2) als auch semantisch (Vektor-Suche) beantwortet — der AI Buddy findet relevantes Wissen auch ohne exakte Schlüsselwort-Treffer

**Neue Dateien:**
- `convex/ai/embeddings.ts`
- `convex/ai/ingestKnowledge.ts`

**Geänderte Dateien:**
- `convex/schema/chat.ts` — neue Tabelle
- `convex/chat.ts` — `semanticSearch` internalAction + Hybrid-Logik in beiden Pfaden (sendMessage + streamChatMessage)

---

### v4 — User Document Uploads

- Users können bis zu **5 eigene Dokumente** (PDF, TXT, Markdown, max 10MB) hochladen
- **Automatische Verarbeitung**: Text-Extraktion → Chunking → Embedding
- **Upload-Button** (Büroklammer-Icon) direkt im Chat neben dem Send-Button
- User-Dokumente sind in der Vektor-Suche eingebunden und **nur für den jeweiligen User sichtbar**

**Neue Dateien:**
- `convex/documents.ts` — Upload-URL, Processing-Pipeline, Delete
- `client/src/components/ChatDocumentUpload.tsx` — Upload-UI-Komponente

**Geänderte Dateien:**
- `convex/schema/chat.ts` — Tabellen `userDocuments` + `userDocumentChunks`
- `client/src/pages/Chat.tsx` — Upload-Button integriert

---

### v5 — Admin Knowledge Base

- **Neue Tabelle** `knowledgeArticles` mit 7 Kategorien: Culture, Practical, Language, Cuisine, Geography, Immigration, History
- **Vollständige Admin-UI** unter `/admin/knowledge`: Artikel erstellen, bearbeiten, veröffentlichen
- **Auto-Ingestion**: Beim Publish wird der Artikel automatisch gechukt, embedded und für den AI Buddy durchsuchbar
- **10 initiale Seed-Artikel** vorbereitet:
  - Slava (Familienfeier des Patron-Heiligen)
  - Kafana-Kultur
  - Serbisches Weihnachten (Božić)
  - Bankkonto eröffnen in Serbien
  - Wohnung mieten
  - Arztbesuch / Gesundheitssystem
  - Serbisches Essen
  - Städte und Regionen Serbiens
  - Aufenthaltserlaubnis für Ausländer
  - Serbische Geschichte im Überblick

**Neue Dateien:**
- `convex/knowledge.ts` — CRUD Mutations/Queries + Auto-Ingestion-Hook
- `client/src/pages/KnowledgeAdmin.tsx` — Admin-Oberfläche
- `convex/seedKnowledgeArticles.ts` — Initiale Artikel

**Geänderte Dateien:**
- `convex/schema/chat.ts` — neue Tabelle
- `client/src/App.tsx` — Route `/admin/knowledge`

---

### v6 — Agentic RAG mit Tool-Calling

**5 intelligente Tools**, die der AI Buddy eigenständig aufrufen kann:

| Tool | Beschreibung |
|---|---|
| `searchKnowledge` | Vektor-Suche in der gesamten Knowledge Base (Kultur, Praxis, Sprache) |
| `getUnitContent` | Gezielter Zugriff auf Vokabeln, Grammatik, Phrases einer bestimmten Unit |
| `getUserProgress` | Lernfortschritt, Schwächen, Streak, abgeschlossene Units abrufen |
| `searchVocabulary` | Ein bestimmtes serbisches Wort über alle Units hinweg suchen |
| `searchUserDocuments` | In den hochgeladenen Dokumenten des Users suchen |

- **Vercel AI SDK Integration** (`generateText`/`streamText` mit Multi-Step-Reasoning, max 5 Tool-Aufrufe pro Antwort)
- **Feature-Flag** `useAgenticRag` in der Admin-Konfiguration — jederzeit an/aus schaltbar
- **Automatischer Fallback** auf Hybrid-RAG (v3) wenn Agentic RAG fehlschlägt

**Neue Dateien:**
- `convex/ai/chatTools.ts` — Tool-Definitionen

**Geänderte Dateien:**
- `convex/ai/chatConfig.ts` — `generateAgenticResponse()`, `streamAgenticResponse()`
- `convex/chat.ts` — Agentic-Pfad neben bestehendem Hybrid-Pfad
- `convex/schema/chat.ts` — `useAgenticRag` Flag
- `convex/admin.ts` — Config-Feld für Agentic RAG

---

## Welche Vorteile wir dadurch haben

1. **Massiv intelligenterer AI-Assistent**: Der AI Buddy kann jetzt auf das gesamte Kursmaterial, kulturelles Wissen, praktische Guides und sogar User-eigene Dokumente zugreifen — nicht nur auf eine Handvoll Vokabeln.

2. **Skalierbare Wissensbasis**: Neue Artikel können Admins direkt über die UI hinzufügen — kein Code-Deployment nötig. Veröffentlichen genügt, und der AI Buddy weiß sofort Bescheid.

3. **Robuste Architektur**: Jede Stufe hat einen Fallback. Agentic RAG fällt auf Hybrid-RAG zurück, Hybrid-RAG auf strukturiertes Retrieval, mehrsprachige Inhalte auf Englisch. Das System ist widerstandsfähig.

4. **Keine neuen Dependencies**: Alles läuft mit bereits installierten Paketen (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `pdf-parse`). Convex `vectorSearch` ist built-in.

5. **Stufenweise Aktivierung**: Durch das Feature-Flag kann Agentic RAG im Produktivbetrieb getestet werden, ohne Risiko. Bei Problemen: ein Klick im Admin-Panel genügt.

---

## Welche Vorteile der User hat

1. **Personalisierte Antworten**: Der AI Buddy kennt jetzt die Schwächen des Users ("Du hast Probleme mit kuća, prozor und vrata — lass uns die nochmal üben!") und seinen Fortschritt.

2. **Tieferes Sprachverständnis**: Statt nur 500 Zeichen Grammatik-Zusammenfassung bekommt der AI Buddy jetzt die volle Grammatik, Phrases, Dialogbeispiele und Aussprache-Hilfen.

3. **Kulturelles und praktisches Wissen**: Fragen wie "Was ist Slava?", "Wie eröffne ich ein Bankkonto in Serbien?" oder "Was isst man zu Weihnachten?" werden jetzt mit fundiertem, spezifischem Wissen beantwortet.

4. **Eigene Dokumente einbinden**: Der User kann ein serbisches PDF, Studiennotizen oder ein Rezeptbuch hochladen — und der AI Buddy kann daraus zitieren und Fragen dazu beantworten.

5. **Mehrsprachigkeit**: Alle Inhalte werden in der eingestellten Sprache des Users geladen (Deutsch oder Englisch), nicht mehr nur auf Englisch.

---

## Was der User damit anfangen kann

### Serbisch lernen mit Kontext
> "Erkläre mir die Grammatik von Unit 3"

Der AI Buddy holt sich die vollständige Grammatik, Beispiel-Dialoge und relevante Vokabeln.

### Schwächen gezielt trainieren
> "Welche Wörter habe ich oft falsch?"

Der AI Buddy kennt die schwachen Vokabeln und kann Übungen vorschlagen.

### Kultur entdecken
> "Was ist eine Kafana?" oder "Wie feiert man Slava?"

Fundierte, detaillierte Antworten aus der Knowledge Base.

### Praktische Lebenshilfe
> "Ich ziehe nach Belgrad. Was muss ich zum Thema Wohnung wissen?"

Der AI Buddy liefert praktische Tipps zu Miete, Bankkonto, Arztbesuch.

### Eigene Materialien nutzen
> Ein Serbisch-Lehrbuch als PDF hochladen

Der AI Buddy kann daraus zitieren: "Was steht in meinem Dokument über Perfekt?"

### Vokabeln überall suchen
> "Was bedeutet 'zdravo'?"

Der AI Buddy durchsucht alle Units und liefert das Wort mit Aussprache, Übersetzung und Kontext.

### Automatische Wiederholung
Der AI Buddy bezieht Vokabeln der letzten 2 Units automatisch mit ein — Wiederholung ohne Extra-Aufwand.

---

## Möglichkeiten für erfolgreicheres Lernen und ein tolles Erlebnis

### 1. Adaptives Lernen
Der AI Buddy passt seine Antworten an den Lernstand an. Ein Anfänger in Unit 1 bekommt einfache Erklärungen, ein Fortgeschrittener in Unit 10 tiefere Grammatik-Details.

### 2. Immersives Kulturerlebnis
Durch die 10+ vorbereiteten Kultur-Artikel und die wachsende Knowledge Base wird der AI Buddy zu einem echten kulturellen Begleiter — nicht nur ein Sprachlehrer, sondern ein Companion, der das Balkan-Leben erklärt.

### 3. SOS-Buddy für den Alltag
Akute Fragen ("Wie sage ich beim Arzt, dass ich Halsschmerzen habe?") werden sofort mit relevantem Wissen beantwortet — inklusive der richtigen serbischen Sätze.

### 4. Eigenes Lerntempo
Durch hochgeladene Dokumente kann jeder User sein individuelles Lernmaterial einbringen — der AI Buddy wird zum personalisierten Tutor.

### 5. Kontinuierlich wachsendes Wissen
Admins können jederzeit neue Artikel zu aktuellen Themen hinzufügen (neuer Feiertag, neues Gesetz, saisonale Themen). Das Wissen des AI Buddy wächst mit jedem Tag.

### 6. Gamification-Verstärkung
Der AI Buddy kennt den Streak und XP des Users und kann motivieren: "Du hast eine 7-Tage-Serie! Weiter so — lass uns heute Unit 5 knacken!"

### 7. Nahtlose Mehrsprachigkeit
Ob der User Deutsch oder Englisch bevorzugt — der AI Buddy liefert Inhalte in der richtigen Sprache und stellt sicher, dass keine Information verloren geht.

---

## Architektur-Überblick

```
User-Frage
    │
    ├── v2: Strukturierter Kontext (Vokabeln, Grammatik, Phrases, Dialogues, Progress, schwache Wörter)
    │
    ├── v3: Semantische Suche (Embedding der Frage → vectorSearch → Top-5 Knowledge Chunks)
    │       └── + User-Dokument-Chunks (v4, Top-2, user-gefiltert)
    │
    └── v6: Agentic RAG (optional, Feature-Flag)
            └── AI entscheidet selbst, welche Tools aufgerufen werden
                ├── searchKnowledge
                ├── getUnitContent
                ├── getUserProgress
                ├── searchVocabulary
                └── searchUserDocuments
    │
    ▼
System-Prompt + Kontext + History → AI → Antwort (gestreamt)
```

### Fallback-Kette

```
Agentic RAG (v6)
    │ fehlschlag?
    ▼
Hybrid RAG (v2 + v3)
    │ Embedding fehlschlag?
    ▼
Strukturiertes RAG (v2)
    │ Sprache nicht verfügbar?
    ▼
Englischer Fallback
```

---

## Geänderte und neue Dateien (Gesamtübersicht)

### Neue Dateien
| Datei | Zweck |
|---|---|
| `convex/ai/embeddings.ts` | Embedding-Utility (OpenAI text-embedding-3-small) |
| `convex/ai/ingestKnowledge.ts` | Ingestion-Pipeline für Unit-Content, Artikel, User-Docs |
| `convex/ai/chatTools.ts` | 5 Tool-Definitionen für Agentic RAG |
| `convex/knowledge.ts` | Knowledge Base CRUD (Admin) |
| `convex/documents.ts` | User Document Upload + Processing |
| `convex/seedKnowledgeArticles.ts` | 10 initiale Kultur-/Praxis-Artikel |
| `client/src/pages/KnowledgeAdmin.tsx` | Admin-UI für Knowledge Base |
| `client/src/components/ChatDocumentUpload.tsx` | Upload-UI im Chat |

### Geänderte Dateien
| Datei | Änderungen |
|---|---|
| `convex/chat.ts` | P0 Bugfix, v2 Erweiterungen, Hybrid-RAG, Agentic-Pfad, Tool-Helper-Queries |
| `convex/schema/chat.ts` | 4 neue Tabellen + `useAgenticRag` Flag |
| `convex/ai/chatConfig.ts` | AI SDK Integration, Agentic-Response-Funktionen |
| `convex/admin.ts` | `useAgenticRag` im Config |
| `client/src/App.tsx` | Route `/admin/knowledge` |
| `client/src/pages/Chat.tsx` | Upload-Button integriert |
