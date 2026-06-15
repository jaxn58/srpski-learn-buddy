# Branch-Konsolidierung und Roadmap

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

---

## 1. Ausgangslage der Branches

- `beta` – aktuell in **Produktion** (Beta-Test läuft).
- `feature/buddy-context-streaming` – moderater Chat-Ausbau: Buddy-Modal mit Unit-Kontext, Streaming, Datei-Anhänge, Compact/Detailed-Modus.
- `chat` – **divergierender Vollausbau** (kein Nachfolger von `feature`): komplettes RAG-System, Knowledge-Admin, Dokumenten-Upload-Pipeline, Wissensartikel, dynamische Vorschläge.
- `feature/tariff-token-restructure` – **dieser Branch** (von `feature/buddy-context-streaming` abgezweigt), enthält aktuell die Restructure-Konzeptdokumente.

Wichtig: Pricing/Subscription/Schema (`convex/subscriptions.ts`, `convex/schema/core.ts`) sind in **allen drei** Code-Branches identisch. Der Tarif-Umbau kollidiert also nicht mit den Chat-Diffs.

## 2. Branch-Empfehlung: `chat` als technische Basis

Die Matrix verlangt für **AI Buddy Standalone** und **Full Package** Funktionen, die **nur im `chat`-Branch** existieren:

- `client/src/components/ChatDocumentUpload.tsx` (Dokumenten-Upload-UI)
- `client/src/pages/KnowledgeAdmin.tsx` (Knowledge-Verwaltung)
- `convex/ai/ingestKnowledge.ts` (Ingestion)
- `convex/documentsNode.ts` (Node-seitige Dokumentenverarbeitung)
- `convex/knowledge.ts` (Knowledge-Funktionen)

In `feature/buddy-context-streaming` fehlen diese. Daher: **`chat` ist die funktionale Grundlage** für „Dokumenten-Upload", „Knowledge Rack" und „Foto-Scan".

### Konsequenz / Vorsicht

`chat` ist von `beta` divergiert und **kein** Nachfolger von `feature`. Vor dem Aufsetzen des Pricing-Layers ist eine **Konsolidierung** nötig, damit der `chat`-Stand nicht versehentlich Produktions-Fixes aus `beta`/`feature` verliert.

## 3. Konsolidierungs-Schritte (Phase 0)

```mermaid
flowchart TD
  beta["beta (Produktion)"] --> verify
  chat["chat (Buddy-Vollausbau)"] --> verify
  feat["feature/buddy-context-streaming"] --> verify
  verify["Phase 0: Vergleich + Verifikation<br/>chat vs beta/feature, Regressionen pruefen"] --> integ
  integ["Integrationsstand: chat-Features auf aktuellem beta-Stand"] --> layer
  layer["Pricing-/Token-Layer daraufsetzen<br/>(dieser Branch-Track)"]
```

Konkret:
1. **Diff-Audit** `beta` ↔ `chat` und `feature` ↔ `chat`: welche Produktions-Fixes/Inhalte sind nur in `beta`/`feature` und müssen erhalten bleiben?
2. **Integrationsentscheidung:** entweder `chat` auf aktuellen `beta`-Stand rebasen/mergen, oder die fehlenden `chat`-Dateien gezielt in einen Integrationsbranch übernehmen.
3. **Verifikation** gegen Produktion: keine Regression bei Units, Vokabeln, Subscriptions, Auth, Webhooks.
4. Erst danach: Pricing-/Token-Layer (Phasen 1–5) aufsetzen.

> Diese Entscheidung (Merge-Strategie für `chat`) ist vor Phase 0 final zu bestätigen.

## 4. Implementierungs-Roadmap (nach Doku-Freigabe)

```mermaid
flowchart TD
  P0["Phase 0: Branch-Konsolidierung + Verifikation vs beta"] --> P1
  P1["Phase 1: Schema + zentrale getFeatureAccess + Token-Felder (alle optional, Zero-Migration)"] --> P2
  P2["Phase 2: Feature-Gating Frontend + Backend + Teaser Sprachkurs"] --> P3
  P3["Phase 3: Token-Metering + Anzeige + monatlicher Reset-Cron"] --> P4
  P4["Phase 4: Dodo-Produkte (Abos + Top-ups), Checkout + Webhook erweitern"] --> P5
  P5["Phase 5: Pricing-Page-Umbau (4 Pakete + Laufzeit-Toggle) + Upgrade-Nudges"]
  P5 --> P6["Phase 6 (separat): Community/Lerngruppen (Neu-Feature, eigener Track)"]
```

### Phasen-Details

- **Phase 0 – Konsolidierung:** siehe oben. Ergebnis: stabiler Integrationsstand mit Buddy-Vollausbau auf aktuellem Produktionsfundament.
- **Phase 1 – Schema & zentrale Query:** `featureTier` (4 Tiers) + Token-Felder auf `userSubscriptions`, `tokenPurchases` (+ optional `tokenLedger`). Zentrale `getFeatureAccess`-Query (+ interne Variante). Alles `v.optional` → Zero-Migration, Bestand = `"full"` + unbegrenzt. **Risiko: praktisch null.**
- **Phase 2 – Gating:** Client-Hook + Routen/Navigations-Gating; Backend-Durchsetzung in `convex/chat.ts` (Tools nach Tier gaten); Teaser-Tageszähler für Sprachkurs (zeigt Basic-Kombi-Buddy).
- **Phase 3 – Token-System:** Verbrauch verbuchen (Mutation), Anzeige „X Token übrig", Low-Quota-Hinweis, monatlicher Reset-Cron in `convex/crons.ts`.
- **Phase 4 – Billing:** Dodo-Produkte anlegen (Abos je Paket×Laufzeit×Modus + Top-ups), Checkout-Metadaten um `featureTier`/Token erweitern, Webhook-Verarbeitung erweitern (Idempotenz via `dodoWebhookEvents`).
- **Phase 5 – Pricing-Page & UX:** `Home.tsx` / `MySubscription.tsx` auf 4 Pakete + Laufzeit-Toggle umbauen, Upgrade-Nudges/Teaser-CTAs.
- **Phase 6 – Community/Lerngruppen:** eigenständiges, größeres Feature ohne Vorlage → separater Track, nach dem Pricing-Umbau.

## 5. Migrations-/Rollout-Sicherheit

- Alle neuen Schema-Felder sind optional → **keine Datenmigration**, kein Zugriffsverlust für Bestands-/Beta-User (Default `"full"` + unbegrenzte Token).
- Phasen 1–3 sind ohne User-Impact deploybar (alle bestehenden User bleiben „full"/unbegrenzt).
- Phasen 4–5 „schalten" die neuen Pakete erst für **neue** Käufe scharf.
- Strikte Einhaltung der Deploy-Regeln (AGENTS.md): **kein** Deploy auf Produktion ohne explizite Freigabe; Convex-Functions zuerst, dann Frontend.

## 6. Risiken

| Risiko | Wahrsch. | Impact | Gegenmaßnahme |
|---|---|---|---|
| `chat`-Konsolidierung verliert Produktions-Fixes | Mittel | Hoch | Diff-Audit + Verifikation in Phase 0 vor Layer |
| Bestandskunden verlieren Zugriff | Sehr gering | Kritisch | `v.optional` + Default `"full"` + unbegrenzte Token |
| Viele Dodo-Produkte (bis 32 + Top-ups) | Mittel | Mittel | Ratenzahlung nur ab Basic Kombi; Sprachkurs prepaid-only |
| KI-Kostenüberlauf durch Heavy-User | Gering | Mittel | Token-Kontingent + Top-up + globales Tagesbudget |
| `userDocuments`-Ingestion unvollständig | Mittel | Mittel | In Phase 0/2 prüfen und vervollständigen (Knowledge Rack) |
| Entscheidungs-Paralyse (4 Pakete) | Mittel | Mittel | Full Package prominent; klare Vergleichstabelle; Anker-Preis |

## 7. Nächste Schritte

1. Konzept-Dokumente (`00`–`04`) freigeben.
2. Offene Punkte aus `00_KONZEPT_UEBERSICHT.md` Abschnitt 5 final entscheiden (Preise, Token-Mengen, Laufzeit-Matrix, Grandfathering, Buddy-Name).
3. Merge-Strategie für `chat` festlegen (Phase 0).
4. Implementierung phasenweise starten.
