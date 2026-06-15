# Admin-Bereich (Überführung in das neue Modell)

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

> Der bestehende Admin-Bereich muss in das neue 4-Paket-/AI-Energy-Modell überführt werden. Dieses Dokument beschreibt den Ist-Zustand, die nötigen Erweiterungen und die Einordnung in die Roadmap (`04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md`). Konzept-/Planungsphase – keine Code-Änderungen.

---

## 1. Ziel & Scope

Der Admin-Bereich ist heute auf das laufzeitbasierte Modell (`planType`, `isBetaTester`) ausgelegt. Mit der Einführung von **`featureTier`** (Sprachkurs / AI Chat Standalone / Sprachkurs + AI / Sprachkurs + AI Pro – Tier-IDs `course` / `standalone` / `course_ai` / `course_ai_pro`) und dem **AI-Energy-System** braucht er neue Sichten und Steuerungsmöglichkeiten. Ziel: Support, Monitoring und Konfiguration des neuen Modells vollständig im Admin abbilden – ohne Eingriff in die DB oder ins Dodo-Dashboard.

## 2. Ist-Zustand (Inventar)

Zugriff: Rolle `admin` oder `superadmin` (Prüfung in `convex/authz.ts` / `convex/admin.ts`; Frontend-Gate in `Admin.tsx`).

| Bereich | Datei(en) | Funktion heute |
|---|---|---|
| User-Übersicht + 24h-Stats | `client/src/pages/Admin.tsx`, `convex/admin.ts` (`getAllUsers`, `get24hStats`) | Userliste, Basis-Statistik |
| User-Detail | `client/src/pages/AdminUserDetail.tsx`, `convex/admin.ts` (`getUserById`, `toggleBetaTester`, `deleteUser`, Resets) | Subscription-Anzeige (`planName`), **Beta-Toggle**, Progress-Reset, User-Löschung |
| Subscription Analytics | `/admin/subscription-analytics`, `convex/subscriptions.ts` | Auswertung nach `planType` |
| Content Studio | `client/src/pages/ContentStudioAdmin.tsx` + `client/src/components/admin/*` | Unit-Manager, Audio, Validator-Memory, Vokabel-Cleanup |
| Content Import | `client/src/pages/ContentImportAdmin.tsx` | Import |
| Prompt-Admin | `client/src/pages/PromptAdmin.tsx`, `convex/admin.ts` (Chat-Prompt-Verwaltung) | System-Prompt verwalten/versionieren |
| Knowledge-Admin | `client/src/pages/KnowledgeAdmin.tsx` | **Nur im `chat`-Branch** vorhanden |
| Kommunikation | Email-Templates, Newsletter, Feedback, Wishlist, Dashboard-Announcements, Onboarding, Waitlist | unverändert relevant |
| System | Database Backups (`/admin/backup`) | unverändert relevant |

**Zentrale Lücke:** Es gibt **keine** Admin-Mutation, um Plan/Tier zu setzen oder Energy zu verwalten – Subscriptions entstehen ausschließlich über Dodo-Webhooks. Das neue `featureTier`/Energy-Modell ist im Admin bisher nicht abgebildet.

## 3. Soll: Admin-Erweiterungen

### 3.1 User-Detail – Tier-Override & Energy-Verwaltung

Erweiterung von `AdminUserDetail.tsx` + neue Mutations in `convex/admin.ts`:

- **Tier-Anzeige & Override:** aktuellen `featureTier` anzeigen; manueller Grant/Override (Sprachkurs / AI Chat Standalone / Sprachkurs + AI / Sprachkurs + AI Pro) für Support- und Komplimentär-Fälle. Setzt `featureTier` auf `userSubscriptions` (bzw. Override-Feld), unabhängig vom Dodo-Kauf.
- **Energy-Sicht:** `energyQuotaMonthly`, `energyUsedThisPeriod`, `energyTopUpBalance`, `energyPeriodResetAt` anzeigen; verbleibende Energy berechnet.
- **Energy-Grant/Adjust:** manuelles Gutschreiben/Korrigieren von Energy → schreibt `energyLedger`-Eintrag mit `reason: "admin_adjust"` (Audit).
- **Energy-Reset:** manueller Monats-Reset (z. B. Kulanz), schreibt Ledger-Eintrag.
- **Verbrauchshistorie:** `energyLedger` des Users (Aktionstyp, Energy, gemessene LLM-Tokens) als Tabelle.

> Die bestehende `toggleBetaTester`-Logik bleibt; Beta-Tester werden weiterhin als „full"/unbegrenzt behandelt (Grandfathering, siehe `04`).

### 3.2 Energy-Konfiguration (dynamisch, nicht hardcoded)

Konform zur Projektregel „Config dynamisch". Admin-editierbare Werte (eigene Config-Tabelle oder Erweiterung von `chatAiConfig`):

- **Verbrauchstabelle:** Energy je Aktionstyp (compact/balanced/detailed, Aufschläge RAG/Foto-Scan, Upload-Skalierung pro N Input-Tokens) – siehe `02_TOKEN_SYSTEM.md` Abschnitt 2.
- **Technisches Input-Limit für Uploads:** max. Dateigröße / Seitenzahl / Input-Tokens je Anfrage. Dies ist die eigentliche Kostenbremse (Uploads werden dynamisch über Energy abgerechnet, **ohne** fixen Energy-Cap – siehe `02` Abschnitt 2.2). Muss admin-konfigurierbar sein, da an Modell-Kontextfenster und Kostenrisiko gekoppelt.
- **Inklusiv-Kontingente** je `featureTier` (Sprachkurs + AI 250 / AI Chat Standalone 600 / Sprachkurs + AI Pro 750). Juni 2026: Standalone von 450 → 600 angehoben, Sprachkurs + AI von 120 → 250 angehoben. Bewusst auch als **Post-Launch-Hebel** ohne Deploy erhöhbar (siehe `02` Abschnitt 3 / `07_MARKTANALYSE.md`).
- **Modellwahl** (Gemini 2.5 Flash vs. Flash-Lite) und **`dailyBudgetCents`** (globale Notbremse) – bereits in `chatAiConfig` verankert (`convex/ai/chatConfig.ts`).

Vorteil: Verbrauchskosten und Großzügigkeit können ohne Deploy justiert werden.

### 3.3 Analytics-Erweiterung

Erweiterung der Subscription-Analytics (`convex/subscriptions.ts` + Analytics-Page):

- Aufschlüsselung nach **`featureTier`** (nicht nur `planType`): aktive Abos je Paket.
- **Umsatz je Paket** + **Top-up-Umsatz** (aus `energyPurchases`).
- **Energy-Verbrauch & KI-Kosten** je Tier/User (aus `energyLedger`): Identifikation von Heavy-Usern und Kostenkontrolle.
- Conversion-/Upgrade-Sicht (Sprachkurs → Sprachkurs + AI, AI Chat Standalone / Sprachkurs + AI → Sprachkurs + AI Pro).

### 3.4 Dodo-Produkt-Verwaltung

- Sichtbarkeit des Mappings **Produkt-ID ↔ Paket × Laufzeit × Modus** + Top-up-Produkte (Starter/Plus/Pro).
- Anlage/Pflege der neuen Dodo-Produkte über den **Dodo-MCP-Server** automatisierbar (gemäß `AGENTS.md`: MCP aktiv nutzen, User nicht mit manuellen Aufgaben belasten).
- Webhook-Idempotenz bleibt über `dodoWebhookEvents` (siehe `02_TOKEN_SYSTEM.md` Abschnitt 9).

### 3.5 Knowledge-/Dokumenten-Admin (Phase-0-Abhängigkeit)

- `KnowledgeAdmin.tsx` und die Ingestion-Pipeline (`convex/ai/ingestKnowledge.ts`, `convex/knowledge.ts`, `convex/documentsNode.ts`) existieren **nur im `chat`-Branch**.
- Sie sind Voraussetzung für die Verwaltung des „Knowledge Rack" (Standalone/Full) und müssen in der **Branch-Konsolidierung (Phase 0)** mit überführt werden.

## 4. Auth, Rollen & Sicherheit

- **Rollentrennung:** Kritische Aktionen (Tier-Override, Energy-Grant, Energy-Config, Dodo-Mapping) sollten `superadmin` vorbehalten sein; lesende Sichten (Analytics, User-Detail) für `admin`.
- **Audit:** Jede manuelle Energy-/Tier-Änderung erzeugt einen nachvollziehbaren Eintrag (`energyLedger` `admin_adjust` bzw. `subscriptionHistory`), inkl. ausführendem Admin.
- **Backend-Durchsetzung:** Alle neuen Admin-Funktionen prüfen serverseitig die Rolle (kein Client-Vertrauen), gemäß bestehender `authz`-Muster.
- **User-Löschung:** Neue Tabellen (`energyPurchases`, `energyLedger`) müssen in die Kaskaden-Löschung `internal.admin._deleteUserCascade` aufgenommen werden (siehe `AGENTS.md` – sonst Waisen-Daten).

## 5. Schema-Bezug

| Admin-Funktion | Schema/Quelle |
|---|---|
| Tier-Override | `featureTier` auf `userSubscriptions` (`convex/schema/core.ts`) |
| Energy-Sicht/Grant | `energy*`-Felder auf `userSubscriptions`, `energyLedger`, `energyPurchases` (`convex/schema/chat.ts`) – siehe `02` |
| Energy-Config | neue Config-Tabelle oder `chatAiConfig`-Erweiterung |
| Analytics | `userSubscriptions`, `subscriptionHistory`, `energyPurchases`, `energyLedger` |
| Knowledge-Admin | `knowledgeChunks`/`userDocuments` (chat-Branch) |

## 6. Einordnung in die Roadmap

Die Admin-Arbeiten laufen parallel zu den Phasen aus `04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md`:

- **Phase 0:** Knowledge-/Dokumenten-Admin aus `chat` mit konsolidieren.
- **Phase 1:** Admin-Read-Sicht auf `featureTier` + Energy-Felder in `AdminUserDetail.tsx`.
- **Phase 2:** Tier-Override-Mutation (Gating-konform).
- **Phase 3:** Energy-Grant/Adjust/Reset + Verbrauchshistorie + Energy-Config-UI.
- **Phase 4:** Dodo-Produkt-Mapping-Sicht + Top-up-Umsatz im Webhook erfasst.
- **Phase 5:** Analytics-Erweiterung (Tier, Energy/Kosten, Conversion) + Abgleich mit Pricing-Page.

## 7. Offene Punkte

1. **Rollen-Feinschnitt:** Welche Aktionen genau `superadmin`-only vs. `admin`? (Vorschlag in Abschnitt 4.)
2. **Energy-Config-Ort:** eigene Tabelle vs. Erweiterung `chatAiConfig` – vor Phase 3 entscheiden.
3. **Manuelle Grants & Buchhaltung:** Sollen Admin-Energy-Grants in der Kosten-/Umsatzanalyse gesondert markiert werden (kein Umsatz)?
4. **Komplimentär-Tiers:** Brauchen wir einen „Staff/Comp"-Status (voller Zugriff ohne Dodo-Kauf), getrennt vom Beta-Status?
5. **Knowledge-Admin-Migration:** Aufwand der Ingestion-Pipeline-Übernahme aus `chat` (teils unvollständig, siehe `01`/`04`).
