# Content Studio — Publish-Timeout Fix

**Status:** Vorschlag, wartet auf Freigabe
**Kontext:** In Prod schlägt `contentStudio:publishDraftToPreview` mit Convex-Fehler `"Your request timed out performing too many system operations."` fehl (16-Sekunden-Timeout). Diagnose stammt aus einem Parallelchat, hier präzisiert und um die zwei mitbetroffenen Tabellen `unitContent` und `unitInteractiveTests` erweitert. Ziel: Publish nachhaltig unter das Convex-Ops-Limit bringen, ohne Frontend zu ändern.

---

## 1. Root Cause

**Die Mutation `internalPublishUnitPackageToPreview`** (`convex/contentStudio/_mutations.ts` Zeile 1113–1316) macht in **einer** Convex-Transaktion vier große Blöcke, die alle mit wachsender Historie in `courseVocabulary`, `unitContent` und `unitInteractiveTests` skalieren:

### Block 1 — Unit Metadata (Zeile 1140–1167)
Pro Sprache: 1 Query + 1 Patch/Insert. Klein. Nicht das Problem.

### Block 2 — Unit Content (Zeile 1180–1210)
Pro `(language, contentType)`-Kombination (2 × 6 = 12):
- `collect()` **aller** `unitContent`-Rows für Unit+Lang+Type → liest auch **archivierte Rows**
- pro aktive Preview-Row: `patch(isActive: false)`
- 1 `insert` neuer Row

Wenn eine Unit über die Zeit z.B. 20-mal publiziert wurde, liegen dort pro Kombination 20 archivierte Rows. Bei 12 Kombinationen sind das schon 240 Rows gelesen, ohne dass irgendetwas mit Vokabular passiert ist.

### Block 3 — Vocabulary (Zeile 1213–1274) — **der eigentliche Killer**
- 1 `collect()` **aller** courseVocabulary-Rows für die Unit (aktiv + archiviert, alle Versionen, alle Sprachen)
- Pro aktive Preview-Row: 1 `patch(isActive: false)`
- Pro neuem Vokabel (EN-Liste, meist 30-50 Einträge):
  - `findEarlierUnitVocabulary(ctx, key, unitNumber)` in `convex/vocabulary.ts` Zeile 953–1009 → **bis zu 6 zusätzliche `collect()`s** wegen Legacy-Fallback (Zeile 983–1006: primärer Index-Read plus bis zu 5 Casing-/NFD-Varianten auf `by_serbian`)
  - 1 `insert`

Bei 40 Vokabeln × 6 Fallback-Queries = **240 zusätzliche Sub-Queries in einer einzigen Mutation**. Jede dieser Queries kann selbst viele Rows lesen (`collect()` liest alles, was zum Key passt — inkl. Legacy-Duplikate).

### Block 4 — Interactive Tests (Zeile 1277–1312)
- 1 `collect()` **aller** Tests für Unit+Lang="en" (aktiv + archiviert, alle Versionen)
- Pro aktive Preview-Row: `patch(isActive: false)`
- Pro Frage aus dem Package (typisch 40-60): 1 `insert`

Bei mehreren Publish-Zyklen: bis zu hunderte archivierte Rows werden gelesen.

### Op-Rechnung (grob)

Convex zählt jeden Index-Update pro Insert/Patch als System-Op. Bei `courseVocabulary` mit 8 Indizes:
- 1 `insert` = 1 Row-Write + 8 Index-Updates = **≈ 9 Ops**
- 1 `patch` = 1 Row-Update + 8 Index-Updates = **≈ 9 Ops**
- 1 gelesene Row bei `collect()` = **1 Op**

Rechnung für eine „durchschnittliche Unit" in Prod (40 Vokabeln, ~15 alte Publish-Zyklen):
- Block 3 collect: 40 × 15 = 600 alte Rows lesen ≈ 600 Ops
- Block 3 archive: 40 aktive Rows patchen ≈ 40 × 9 = 360 Ops
- Block 3 `findEarlierUnitVocabulary`: 40 × 6 × ~50 Legacy-Hits ≈ 12 000 Ops
- Block 3 inserts: 40 × 9 = 360 Ops
- Blöcke 2, 4 addieren: ~1000 weitere Ops

**Summe ≈ 14 320 Ops** — direkt am Convex-Limit von ~16 384. Ein Unit mit etwas mehr Historie kippt.

Dev hat diese Historie nicht → dort ist die Rechnung ~1000 Ops → funktioniert.

---

## 2. Zielbild neuer Publish-Fluss

```
┌────────────────────────────────────────────────────────────────┐
│  publishDraftToPreview (Action, orchestriert)                   │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] getDraft ..................... (unverändert)               │
│  [2] previewReplaceUnit ........... (siehe Baustein E)          │
│  [3] getVocabularyCrossUnitDuplicates (Query, NEU)              │
│      └─ 1 batched Query statt N×6 Sub-Queries in der Mutation   │
│                                                                  │
│  [4] internalPublishUnitMetadata .... (Mutation, klein)         │
│                                                                  │
│  [5] internalPublishUnitContent ...... (Mutation)               │
│      └─ pro Sprache: alle 6 contentTypes zusammen               │
│                                                                  │
│  [6] internalPublishUnitVocabulary ... (Mutation, gebatcht)     │
│      └─ Ruft in Schleife, batch=100 Rows,                       │
│         nimmt Dedup-Map als Arg (kein findEarlierUnitVocabulary)│
│                                                                  │
│  [7] internalPublishUnitTests ........ (Mutation, gebatcht)     │
│      └─ pro Kategorie, batch=100 Fragen                         │
│                                                                  │
│  [8] Rückgabe an UI (gleiches Format wie heute)                 │
│                                                                  │
└────────────────────────────────────────────────────────────────┘

Cleanup-Cron (parallel, wöchentlich)
      │
      └─ Löscht Rows mit isActive=false, releaseStatus≠published,
         archivedAt < now - 30d, in Batches à 500 Rows pro Mutation
```

Jede einzelne Mutation bleibt weit unter Convex-Limits. Idempotent: bei Fehler in Schritt 6 kann der User denselben Publish nochmal ausführen — die Archive-Operationen in Schritt 5+6 setzen einfach nochmal `isActive: false` (kein Nebeneffekt).

---

## 3. Was konkret gebaut wird

### Baustein A — Batched Cross-Unit-Dedup-Query

**Datei:** `convex/vocabulary.ts`

Neue exportierte Query:

```ts
export const getVocabularyCrossUnitDuplicates = query({
  args: {
    serbianKeys: v.array(v.string()),
    excludeUnitNumber: v.number(),
  },
  returns: v.array(v.object({
    serbianKey: v.string(),
    foundInUnit: v.number(),
  })),
  handler: async (ctx, args) => {
    // Deduplicate keys defensively
    const uniqueKeys = Array.from(new Set(args.serbianKeys.filter(Boolean)));
    const hits: Array<{ serbianKey: string; foundInUnit: number }> = [];
    for (const key of uniqueKeys) {
      const rows = await ctx.db
        .query("courseVocabulary")
        .withIndex("by_serbian_normalized", (q) => q.eq("serbianNormalized", key))
        .collect();
      // primary + legacy fallback aus findEarlierUnitVocabulary hier zusammengeführt
      // findet earliest activeRow mit unitNumber < excludeUnitNumber
      ...
    }
    return hits;
  },
});
```

Die Query läuft **einmal** in der Action (Schritt 3), nicht mehr pro Vokabel in der Mutation. Ist selbst kein Convex-Mutation-Kontext, sondern Query — Read-Limits sind großzügiger.

Die alte `findEarlierUnitVocabulary` bleibt erstmal für andere Aufrufer bestehen (Deprecation-Kommentar). Aus der Publish-Mutation wird der Aufruf entfernt.

### Baustein B — Publish-Action neu strukturiert

**Datei:** `convex/contentStudio/_publisher.ts` — die Action `publishDraftToPreview`

Ruft nacheinander:

1. `getDraft` (unverändert)
2. `previewReplaceUnit` (unverändert)
3. **Neu:** `getVocabularyCrossUnitDuplicates(serbianKeys, unitNumber)` — baut Dedup-Map
4. `internalPublishUnitMetadata`
5. `internalPublishUnitContent`
6. `internalPublishUnitVocabulary` in Schleife: solange `hasMore === true`, mit `batchIndex++`
7. `internalPublishUnitTests` in Schleife: solange `hasMore === true`

Signatur der Action bleibt gleich, Rückgabe bleibt gleich. Frontend unverändert.

**Fehler-Semantik:** Bei einem Fehler in Schritt N wirft die Action einen `Error` mit `{ stage, batchIndex, cause }`. Idempotenz durch Archive-Muster gewährleistet — Retry ist safe. Ein expliziter "in_progress"-Status im Draft ist **nicht** nötig, weil kein User-Sichtbarkeits-Problem entsteht (Preview-Rows sind nicht live).

### Baustein C — Neue Split-Mutations

**Datei:** `convex/contentStudio/_mutations.ts` — die alte Riesen-Mutation wird durch vier kleinere ersetzt.

Signaturen:

```ts
internalPublishUnitMetadata(unitPackage, unitVersion, moduleId)
internalPublishUnitContent(unitPackage, unitVersion, language)
internalPublishUnitVocabulary(unitPackage, unitVersion, dedupMap, batchStart, batchSize)
  → returns { nextBatchStart, hasMore }
internalPublishUnitTests(unitPackage, unitVersion, category, batchStart, batchSize)
  → returns { nextBatchStart, hasMore }
```

Batch-Größe: **100** Vokabeln/Fragen pro Aufruf. Ergibt bei 8 Indizes ~1000 Ops pro Mutation — Faktor 16 Puffer zum Limit.

Die alte `internalPublishUnitPackageToPreview` bleibt als Wrapper bestehen (für externe Aufrufer, falls es welche gibt) — leitet an die neue Kette weiter mit `@deprecated`-Kommentar.

### Baustein D — Cleanup-Cron

**Datei:** `convex/crons.ts` (existiert bereits)

Neuer Cron-Eintrag, wöchentlich Sonntag 03:00 UTC:

```ts
crons.weekly("cleanup archived content studio rows",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.contentStudio.internalCleanupArchivedContent,
);
```

**Datei:** neue Action `convex/contentStudio/_cleanup.ts`

```ts
export const internalCleanupArchivedContent = internalAction({
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const table of ["courseVocabulary", "unitContent", "unitInteractiveTests"] as const) {
      let deletedTotal = 0;
      let batchIndex = 0;
      let hasMore = true;
      while (hasMore) {
        const { deleted, hasMore: more } = await ctx.runMutation(
          internal.contentStudio.internalDeleteArchivedBatch,
          { table, cutoff, batchSize: 500 }
        );
        deletedTotal += deleted;
        hasMore = more;
        batchIndex++;
        if (batchIndex > 100) break; // Safety
      }
      console.log(`[Cleanup] ${table}: ${deletedTotal} rows deleted`);
    }
  },
});
```

Löscht Rows mit `isActive === false` UND `releaseStatus !== "published"` UND `archivedAt < cutoff`. **Published-Rows werden niemals gelöscht.** Cleanup läuft batched (500 pro Mutation), safety-limit 100 Batches × 500 = 50 000 Rows pro Woche max.

Utilities aus `convex/contentStudio/_vocabularyCleanup.ts` werden geprüft und wo sinnvoll wiederverwendet — nicht duplizieren.

### Baustein E — `previewReplaceUnit` prüfen

Der 374-Docs-Read in `previewReplaceUnit` (Datei: `convex/contentImportAdmin.ts`) ist ein Warnsignal. Die Query läuft VOR jeder Publish-Mutation und wird selbst mit der Zeit teurer.

**Prüfen:** liest sie nur `isActive=true`-Rows oder alles? Falls alles: enger einschränken. Wird im Rahmen dieser Änderung mit ausgeleuchtet, aber nur angefasst, wenn nötig — sonst separat.

---

## 4. Was NICHT gebaut wird

- **Keine Frontend-Änderung.** `ContentStudioAdmin.tsx` und die Draft-UI rufen weiter dieselbe Action mit derselben Signatur.
- **Kein Schema-Umbau.** Alle Tabellen behalten ihre Felder und Indizes. Der Cleanup löscht Rows, aber ändert kein Schema.
- **Keine Master-Vocabulary-Umstellung.** Das ist Hebel D aus der Analyse — kommt ins große Redesign, nicht hier.
- **Kein Big-Bang.** Alte `internalPublishUnitPackageToPreview` bleibt als Wrapper, damit nichts hart bricht.
- **Kein A/B-Publish, keine Versionsanzeige im UI.** Kommt im großen Redesign.

---

## 5. Warum das nicht Spaghetti wird

**Ein Muster, mehrfach angewendet.** Alle vier neuen Mutations folgen derselben Struktur (Args → collect archived → patch → insert → return `hasMore`). Batching ist überall gleich.

**Klare Grenze Action ↔ Mutation.** Die Action orchestriert und macht **keine DB-Writes selbst**. Jede Mutation macht genau einen Baustein.

**Idempotenz durch Archive-Muster.** Jede Mutation kann wiederholt werden, ohne dass Duplikate entstehen. Retry-Semantik ist trivial.

**Cleanup separat.** Der Cron kennt die Publish-Kette nicht und umgekehrt. Kein gekoppelter State.

---

## 6. Testbarkeit

- `getVocabularyCrossUnitDuplicates`: Unit-Test mit Fixture-Daten, prüft primäre + Fallback-Suche
- Neue Split-Mutations: jede einzeln aufrufbar, in Dev testbar
- Integration: Test-Draft in Dev mehrfach publishen, prüfen dass keine doppelten aktiven Rows entstehen
- Cleanup: manuell einmal in Dev laufen lassen, prüfen dass nur alte archivierte Rows verschwinden
- Regressionstest: alte `internalPublishUnitPackageToPreview` als Wrapper wirft gleiches Ergebnis wie neue Kette

---

## 7. Rollout

1. **Umsetzung in Dev.** Alle Änderungen gegen `reminiscent-panda-57`. `npx convex dev` läuft.
2. **Test in Dev.** Publish Unit 2 (oder ein Test-Draft), mehrfach. Vor allem: alte Preview-Rows durchlaufen den neuen Archive-Pfad korrekt.
3. **Manuellen Cleanup einmal in Dev.** Cron zunächst NICHT aktiv, sondern per Direktaufruf. Ergebnis prüfen.
4. **Cron in Dev aktivieren, eine Woche beobachten.**
5. **Auf dein OK Deploy nach Prod.** In der Reihenfolge Convex-Deploy → Frontend (Frontend unverändert, deshalb theoretisch nicht nötig — aber sicherheitshalber).
6. **Ersten Prod-Publish von dir mit einem unkritischen Draft testen.** Log-Monitoring.

Rollback-Sicherheit: Falls neue Kette bricht, kann der alte Wrapper wieder als primärer Aufruf reaktiviert werden (single-line-Änderung).

---

## 8. Aufwand

| Baustein | Aufwand | Dateien |
|---|---|---|
| A: batched Dedup-Query | S | `convex/vocabulary.ts` |
| B: Action neu strukturieren | M | `convex/contentStudio/_publisher.ts` |
| C: 4 neue Split-Mutations + Wrapper | M | `convex/contentStudio/_mutations.ts` |
| D: Cleanup-Cron + Action + Mutation | M | `convex/crons.ts`, `convex/contentStudio/_cleanup.ts` |
| E: `previewReplaceUnit` prüfen | XS bis S | `convex/contentImportAdmin.ts` (optional) |
| Tests | S | Vitest-Fixtures unter `convex/contentStudio/__tests__/` |

**S** < 1h, **M** = 1–3h, **XS** < 15min. Gesamt: rund einen Arbeitstag.

---

## 9. Entscheidungen (freigegeben)

1. **Cleanup-Retention: 30 Tage** — bestätigt.
2. **Cron-Zeit Sonntag 03:00 UTC** — bestätigt.
3. **Batch-Größe: 100** — bestätigt.
4. **Baustein E im gleichen PR** — bestätigt.
5. **Explizite Publish-Status-Anzeige im Draft** — bestätigt (nicht nur Error, sondern sichtbarer Fortschritt).

## 10. Erweiterung durch Entscheidung 5 — Publish-Status im Draft

Neuer Baustein F, wird zusammen mit A–E umgesetzt.

### F1 — Schema-Erweiterung `contentDrafts`

**Datei:** `convex/schema/contentStudio.ts`

Neues optionales Feld:

```ts
publishState: v.optional(v.object({
  status: v.union(
    v.literal("running"),
    v.literal("success"),
    v.literal("failed"),
  ),
  stage: v.union(
    v.literal("metadata"),
    v.literal("content"),
    v.literal("vocabulary"),
    v.literal("tests"),
    v.literal("complete"),
  ),
  batchIndex: v.optional(v.number()),
  totalBatches: v.optional(v.number()),
  startedAt: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
})),
```

Rückwärtskompatibel (`optional`). Bestehende Drafts bleiben unangefasst.

### F2 — State-Update in der Publish-Action

**Datei:** `convex/contentStudio/_publisher.ts`

Neue interne Mutation `internalUpdateDraftPublishState(draftId, patch)` — schreibt in `contentDrafts.publishState`. Wird an den Anfang jedes Schritts aufgerufen (`stage: "metadata"`, `stage: "content"` etc.) und beim erfolgreichen Ende (`status: "success", stage: "complete"`) sowie im `catch` mit `status: "failed", error`.

Wichtig: State-Update ist eine **separate winzige Mutation** — landet niemals im Convex-Op-Limit.

### F3 — UI-Element im Draft-Panel

**Datei:** `client/src/components/admin/contentStudio/DraftEditPanel.tsx` (bereits offen in deiner IDE laut git status)

**Position:** oben im Panel als sticky Banner (unmittelbar unter dem Header, oberhalb aller Bearbeitungsfelder). Fehler und laufende Publishes sind so beim Öffnen sofort sichtbar, ohne dass gescrollt werden muss.

```
┌───────────────────────────────────────────────────────┐
│  Publish-Status                                        │
│  ─────────────────────────────────────────────────    │
│  ◐ Läuft: Vocabulary (Batch 3 / 5)                    │
│    gestartet um 20:14:32                              │
│                                                        │
│  oder                                                  │
│                                                        │
│  ✓ Erfolgreich (20:14:32 → 20:15:18, 46 s)            │
│                                                        │
│  oder                                                  │
│                                                        │
│  ✗ Fehlgeschlagen bei Stage 'vocabulary' (Batch 4)    │
│    Meldung: „Serbian key 'zdravo' collision with…"    │
│    [Retry] [Details]                                  │
└───────────────────────────────────────────────────────┘
```

- Live-Update via `useQuery` auf `getDraft` (die Query gibt es schon, wird um `publishState` erweitert)
- Idle-Zustand (kein `publishState` vorhanden): Anzeige komplett ausgeblendet
- **Retry = voller Rerun**: der Button ruft dieselbe `publishDraftToPreview`-Action neu auf und startet von Stage `metadata` — Idempotenz ist durch das Archive-Muster (Baustein A/C) gedeckt, ein Rerun ist sicher. Keine partiellen Resumes. Beim Rerun wird `publishState.status` sofort auf `running` gesetzt, damit das Banner ohne Delay den neuen Lauf zeigt.
- Details-Toggle zeigt vollständige `error`-Meldung

### F4 — Aufwand für F

| Sub-Baustein | Aufwand | Datei |
|---|---|---|
| F1: Schema-Feld | XS | `convex/schema/contentStudio.ts` |
| F2: State-Update-Mutation + Aufrufe | S | `convex/contentStudio/_publisher.ts`, `_mutations.ts` |
| F3: UI-Komponente + Retry-Handler | S | `DraftEditPanel.tsx` |

Gesamt: ~1–2h zusätzlich. Der Gesamtaufwand des Fixes steigt damit auf **~einen Arbeitstag plus 1–2h für F**.

---

## 11. Startfreigabe

Alles beantwortet. Ich beginne mit der Umsetzung in Dev in dieser Reihenfolge:

1. **A** (batched Dedup-Query in `convex/vocabulary.ts`)
2. **F1** (Schema-Erweiterung `contentDrafts.publishState`)
3. **C** (vier Split-Mutations in `_mutations.ts`, alte als Wrapper mit `@deprecated`)
4. **F2** (State-Update-Mutation)
5. **B** (Publish-Action neu strukturieren, State-Updates einweben)
6. **D** (Cleanup-Cron + Action + Delete-Mutation)
7. **E** (`previewReplaceUnit`-Check und ggf. Optimierung)
8. **F3** (UI-Element im DraftEditPanel)
9. **Tests** (Unit + Integration)

Sag „los" wenn ich starten soll, oder melde vorher noch Änderungswünsche zur Reihenfolge oder zum UI-Entwurf in F3.
