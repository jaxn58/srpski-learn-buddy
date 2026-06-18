# Wissensbasis – Content-Automatisierung (Hybrid)

> Status: **Konzept / geplant.** Umsetzung erst **nach** Abschluss der aktuellen
> Buddy+Wissensbasis-Konsolidierung (`integration/buddy-rack`). Dieses Dokument
> beschreibt das Vorgehen, damit der Standalone-Buddy auch praktische
> Themen (z. B. Ausländer-/Aufenthaltsrecht) beantworten kann – über die
> Knowledge Base, nicht über hartcodierte Inhalte.

---

## 1. Ausgangslage & Problem

Der KI-Lernbuddy soll in seiner Standalone-Funktion ein **Assistent** sein,
nicht nur ein Sprachtutor. Aktuell lehnt er fachfremde Fragen ab. Dafür gibt es
**zwei** Ursachen, die beide adressiert werden müssen:

1. **Leere Wissensbasis zum Thema:** Die semantische Suche (`semanticSearch` in
   `convex/chat.ts`) läuft bei jeder Nachricht automatisch und durchsucht
   `knowledgeChunks`. Sie findet aber nichts, weil zu Themen wie dem
   Ausländergesetz keine **veröffentlichten** Artikel existieren → kein Wissen
   wird in den Prompt injiziert.
2. **Rollen-Begrenzung im System-Prompt:** Der aktive System-Prompt
   (admin-verwaltet unter `/admin/prompt`, `chatPrompts`-Tabelle) scoped den
   Buddy auf „Sprache & Kultur" und lässt ihn fachfremde Fragen aktiv ablehnen.

> **Konsequenz:** Content-Automatisierung allein reicht nicht. Parallel muss die
> Buddy-Rolle im Prompt erweitert werden (siehe Abschnitt 7).

---

## 2. Zielbild

- Vertrauenswürdige, **definierte Quellen** werden in regelmäßigen Abständen
  automatisch abgerufen, aufbereitet und in die Wissensbasis übernommen.
- Jede automatisch gezogene Information landet zunächst als **Entwurf** und wird
  **erst nach Admin-Freigabe** veröffentlicht (Haftungs- und Qualitätssicherung).
- Veröffentlichte Artikel werden – wie heute schon – automatisch in
  `knowledgeChunks` eingebettet und sind damit für den Buddy durchsuchbar.
- Antworten zu Rechts-/Behördenthemen enthalten **Quellenangabe + Disclaimer**.

---

## 3. Warum Hybrid (statt rein manuell oder voll automatisch)

| Ansatz | Vorteil | Nachteil |
|---|---|---|
| Rein manuell | Volle Kontrolle, rechtlich sauber | Hoher Pflegeaufwand, schnell veraltet |
| Voll automatisch | Immer aktuell, kein Aufwand | Haftungsrisiko, Fehlinfos, Quellen-/Copyright-Probleme |
| **Hybrid (gewählt)** | Aktualität **und** Kontrolle; Review als Sicherheitsnetz | Etwas mehr Implementierungsaufwand |

Gerade bei einem Rechtsthema wie dem Ausländergesetz ist der Review-Schritt
nicht optional, sondern zwingend.

---

## 4. Bestehende Bausteine (wiederverwenden, nicht neu erfinden)

Diese Teile existieren bereits und bilden das Fundament:

- `convex/schema/chat.ts` → Tabellen `knowledgeArticles` (Admin-Wissensbasis,
  inkl. Kategorien `immigration`, `practical`, `history`, `culture` …) und
  `knowledgeChunks` (Vektor-Index `by_embedding`).
- `convex/ai/ingestKnowledge.ts` → Artikel/Dokument → Chunking → Embeddings →
  `knowledgeChunks`. Wird beim Veröffentlichen eines Artikels ausgelöst.
- `convex/ai/embeddings.ts` → `embedTexts` / `chunkText` (Gemini primär,
  OpenAI Fallback, 768 dim).
- `convex/knowledge.ts` → CRUD + Auto-Ingestion veröffentlichter Artikel.
- `convex/chat.ts` → `semanticSearch` (Buddy durchsucht `knowledgeChunks`).
- Frontend: `KnowledgeAdmin` (`/admin/knowledge`) zum Pflegen/Freigeben.

**Wichtig:** Die Web-Abruf-Logik braucht den `"use node"`-Kontext (Actions),
nicht Queries/Mutations.

---

## 5. Neue Bausteine (für die Automatisierung)

### 5.1 Schema-Erweiterungen (Vorschlag)

> Mehrsprachigkeit beachten (EN/DE), Pattern an bestehende Tabellen anlehnen.

- **`knowledgeSources`** (neue Tabelle) – Quellen-Register:
  - `name`, `url`, `category` (mappt auf `knowledgeArticles.category`)
  - `language`
  - `fetchStrategy`: `"html"` | `"sitemap"` | `"rss"` | `"api"`
  - `intervalHours` (z. B. 168 = wöchentlich)
  - `isActive`
  - `lastFetchedAt`, `lastContentHash` (für Change-Detection)
  - `trustLevel` / Hinweis zur rechtlichen Nutzbarkeit (ToS geprüft?)
- **`knowledgeArticles`** – additive Felder:
  - `sourceId` (→ `knowledgeSources`), `sourceUrl`
  - `provenance`: `"manual"` | `"auto"`
  - `reviewStatus`: `"draft"` | `"in_review"` | `"published"` | `"rejected"`
    (kann mit dem bestehenden `status` zusammengeführt werden)
  - `contentHash` (Dedup / Update-Erkennung)
  - `lastReviewedBy`, `lastReviewedAt`

### 5.2 Pipeline (Convex Action + Cron)

1. **Scheduler** (`convex/crons.ts`): periodischer Trigger pro Quelle bzw. ein
   Sammel-Cron, der fällige Quellen (`lastFetchedAt + intervalHours < now`) wählt.
2. **Fetch-Action** (`"use node"`): lädt die Quelle (`fetch`), respektiert
   `robots.txt`/ToS, extrahiert Haupttext (HTML→Text), normalisiert.
3. **Change-Detection:** `contentHash` vergleichen → nur bei Änderung weiter.
4. **(Optional) LLM-Aufbereitung:** Rohtext in saubere, strukturierte Artikel
   umschreiben/zusammenfassen (mit Quelle im Text). System-Prompt **englisch**.
5. **Entwurf anlegen:** `knowledgeArticles` mit `provenance="auto"`,
   `reviewStatus="draft"`, `sourceId`, `sourceUrl`. **Noch keine** Ingestion.
6. **Admin-Review:** im `KnowledgeAdmin` neuer Filter „Auto-Entwürfe / Review".
   Freigabe = `reviewStatus="published"` → löst bestehende Ingestion aus
   (`ingestKnowledge` → `knowledgeChunks`).
7. **Aktualisierung:** geänderte Quelle erzeugt Update-Entwurf des bestehenden
   Artikels (Diff sichtbar), erneut mit Review.

### 5.3 Übersetzung EN→DE

Auto-Artikel zuerst auf **Englisch** als Basis, nach Freigabe Übersetzung in den
DE-Track (analog `translationOf` bei `knowledgeArticles`). Beide Sprachen werden
eingebettet und ausgeliefert.

---

## 6. Datenfluss (Überblick)

```
knowledgeSources (Register)
        │  Cron (fällig?)
        ▼
Fetch-Action ("use node") ──► Extraktion ──► Change-Detection (Hash)
        │ (nur bei Änderung)
        ▼
(optional) LLM-Aufbereitung EN ──► knowledgeArticles (provenance=auto, draft)
        │
        ▼
   Admin-Review im KnowledgeAdmin  ──► reject ▷ Ende
        │ publish
        ▼
ingestKnowledge ──► knowledgeChunks (Embeddings)
        │
        ▼
semanticSearch (chat.ts) ──► Buddy nutzt Wissen + Quellenangabe + Disclaimer
```

---

## 7. Zweiter Hebel: Buddy-Rolle erweitern (kein Code nötig)

Parallel zum Content muss der System-Prompt unter `/admin/prompt` so angepasst
werden, dass der Buddy:

- praktische/behördliche Fragen beantwortet, **wenn** `[RELEVANT KNOWLEDGE]`
  vorhanden ist,
- sich bei fehlendem Wissen ehrlich zurückhält und auf offizielle Stellen
  verweist (statt pauschal „nicht mein Bereich"),
- bei Rechts-/Behördenthemen **Quelle nennt** und einen **Disclaimer**
  („keine verbindliche Rechtsberatung") anhängt.

Offene Produktentscheidung: getrennte Modi („Lernmodus" vs. „Assistenzmodus")
oder ein durchgängig breiter Assistent (siehe Abschnitt 9).

---

## 8. Rechtliches & Risiken (nicht optional)

- **Quellen-Auswahl:** möglichst offizielle/lizenzkonforme Quellen; ToS &
  Copyright je Quelle prüfen und in `knowledgeSources` dokumentieren.
- **Haftung:** Rechtsinfos immer mit Disclaimer + Quelle + Datum; keine
  verbindliche Beratung.
- **Aktualität:** veröffentlichtes `lastReviewedAt`/`sourceUrl` im Antwortkontext
  mitführen, damit der Buddy „Stand: …" angeben kann.
- **Kosten:** Fetch + Embeddings periodisch → Budget über bestehendes
  `chatAiConfig.dailyBudgetCents`-Denken hinaus separat einplanen.

---

## 9. Offene Entscheidungen (vor Implementierung zu klären)

1. **Themen-Scope (Reihenfolge):** Ausländer-/Aufenthaltsrecht, Behörden/Ämter,
   Alltag/praktisch, Gesundheit/Versicherung, Kultur/Geschichte – welche zuerst?
2. **Buddy-Rolle:** getrennte Modi vs. durchgängig breiter Assistent.
3. **Haftungs-Antwortstil:** mit Quelle + Disclaimer antworten vs. nur
   Orientierung + Verweis.
4. **Konkrete Startquellen:** welche offiziellen URLs/Feeds pro Thema.
5. **LLM-Aufbereitung ja/nein:** Rohtext speichern vs. KI-umgeschriebene Artikel.

---

## 10. Phasen-Roadmap

- **Phase 0 (jetzt):** Buddy+Wissensbasis-Merge stabilisieren (laufend).
- **Phase 1 – Fundament:** Schema-Erweiterungen (`knowledgeSources`,
  Artikel-Felder), KnowledgeAdmin um Review-Filter ergänzen, Prompt-Rolle
  erweitern. Inhalte zunächst **manuell** zu einem Pilotthema (z. B.
  Aufenthaltsrecht-Basics) pflegen → End-to-End testen.
- **Phase 2 – Automatisierung:** Fetch-Action + Cron + Change-Detection,
  Auto-Entwürfe mit Review. Ein bis zwei Pilotquellen.
- **Phase 3 – Skalierung:** Mehr Quellen, EN→DE-Übersetzungspfad, Monitoring
  (fehlgeschlagene Fetches, veraltete Artikel), Kosten-Reporting.

---

## 11. Definition of Done (für die spätere Umsetzung)

- Admin kann Quellen anlegen/aktivieren und Intervalle setzen.
- Cron zieht fällige Quellen, erzeugt nur bei Änderung Entwürfe.
- Auto-Entwürfe sind im KnowledgeAdmin klar als solche erkennbar und
  durchlaufen Review vor Veröffentlichung.
- Veröffentlichte Artikel werden eingebettet; der Buddy nutzt sie mit
  Quellenangabe + Disclaimer.
- Inhalte EN/DE konsistent; nichts hartcodiert.
