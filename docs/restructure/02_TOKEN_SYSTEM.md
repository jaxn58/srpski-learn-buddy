# AI-Energy-System

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

> **Begriffs-Update:** Die nutzersichtbare Verbrauchseinheit heisst **AI Energy** (kurz „Energy"), nicht mehr „Token = 1 Nachricht". Grund: Der AI-Buddy verbraucht je nach Aktion sehr unterschiedlich viel (RAG/Retrieval, Antwortlaenge, Foto-Scan, Dokumenten-Analyse). Ein starres „1 Nachricht = 1 Token" bildet die realen Kosten nicht ab und wuerde Heavy-Aktionen (z. B. grosse Datei-Uploads) systematisch unterbewerten. Der Dateiname und der Initiativtitel bleiben aus Verweis-Konsistenz erhalten.

---

## 1. Grundprinzip: „AI Energy" als Verbrauchseinheit

- **Sichtbare Einheit fuer den User:** **AI Energy** – ein Guthaben, das mit jeder KI-Aktion verbraucht wird (z. B. „Du hast noch 320 Energy").
- **Nicht** an „1 Nachricht" gekoppelt: Verschiedene Aktionen kosten unterschiedlich viel Energy (siehe Verbrauchstabelle, Abschnitt 2).
- **Intern:** Es werden weiterhin die tatsaechlichen LLM-Tokens (Input + Output) sowie der Aktionstyp gemessen und protokolliert. Daraus wird ein **gerundeter Energy-Betrag** abgeleitet und vom Guthaben abgebucht.
- **Warum dieses Modell?**
  - **Fair & kostendeckend:** Teure Aktionen (RAG mit grossem Kontext, Dokumenten-Analyse, Vision) kosten mehr Energy als eine kurze Antwort.
  - **Verstaendlich:** Der User sieht ein einfaches, planbares Guthaben statt abstrakter LLM-Tokens.
  - **Steuerbar:** Wir koennen einzelne Aktionen guenstiger/teurer machen, ohne das Produkt umzubauen.

> Leitlinie: Bei potenziell teuren Aktionen (v. a. **Datei-Upload & Analyse**) immer vorsichtig sein – Verbrauch proportional zur Groesse abrechnen, mit Pflicht-Vorabbestaetigung und technischem Input-Limit (siehe 2.2).

## 2. Verbrauchsmodell (relative Energy-Kosten)

### 2.1 Verbrauchstabelle (Vorschlag)

Basiswert: **1 Energy = eine kurze (kompakte) Antwort ohne schweren Kontext.** Alle anderen Werte sind relativ dazu. Werte sind ein Vorschlag und vor Implementierung final zu bestaetigen.

> **Live im Admin (seit Juni 2026):** Diese Werte sind unter **Admin → Content & System → AI Energy Config** (`/admin/energy`, Superadmin-only) zur Laufzeit aenderbar. Die Karte zeigt einen **Live-Kalkulator**, der vor dem Speichern $/Energy, Tier-Margen und Top-up-Margen anhand des **aktiven LLM-Modells** (aus `chatAiConfig`) durchrechnet. Aenderungen greifen sofort fuer neue Aktionen; bestehende Ledger-Eintraege bleiben unveraendert.

| Aktion | Energy | Anmerkung |
|---|---:|---|
| Kompakte Antwort (`compact`) | 1 | `maxTokensCompact` ~400 Output (`convex/chat.ts`) |
| Ausgewogene Antwort (`balanced`) | 2 | geplante mittlere Stufe (zwischen compact/detailed) |
| Ausfuehrliche Antwort (`detailed`) | 3 | `maxTokensDetailed` ~800 Output |
| Aufschlag: aktiver Kontext / RAG | +1 | Unit-Kontext + Knowledge-/Semantic-Search (grosser Input) |
| Aufschlag: Foto-Scan (Vision) | +3 | multimodale Bildverarbeitung |
| Datei-Upload & Analyse (je Dokument) | ab ~5, **proportional** | skaliert linear mit Dokumentgroesse, **kein fixer Energy-Cap** – begrenzt nur durch verfuegbares Guthaben + technisches Input-Limit (siehe 2.2) |

**Beispiele:**
- Kurze Frage ohne Kontext, kompakt: **1 Energy**.
- Typische Lernfrage (ausgewogen + Unit-Kontext/RAG): 2 + 1 = **3 Energy**.
- Ausfuehrliche Erklaerung mit RAG: 3 + 1 = **4 Energy**.
- Speisekarte fotografieren + ausgewogene Antwort: 3 (Foto) + 2 = **5 Energy**.
- PDF hochladen und analysieren lassen: **proportional zur Groesse** (z. B. ~12 Energy fuer ein laengeres PDF) – siehe dynamische Abrechnung in 2.2.

### 2.2 Dynamische Upload-Abrechnung (kein fixer Cap)

**Entscheidung:** Datei-Uploads werden **dynamisch** abgerechnet – der User „verbrennt" so viel Energy, wie die Analyse real kostet (proportional zur Dokumentgroesse). Es gibt **keinen** kuenstlichen Energy-Cap pro Dokument.

Begruendung: Ein fixer Cap schuetzt nicht uns, sondern die Brieftasche des Users – und wuerde sogar gegen uns laufen, wenn ein sehr grosses Dokument real teurer ist als der gedeckelte Energy-Betrag (dann subventionieren wir die Differenz). Solange `1 Energy ≈ realer LLM-Kostenanteil` bleibt, ist die dynamische Abrechnung per Definition kostendeckend.

Statt eines Energy-Caps greifen drei Schutzschienen:

1. **Pflicht-Vorabbestaetigung:** Vor der Analyse werden die **voraussichtlichen Energy-Kosten** angezeigt und muessen bestaetigt werden („Diese Analyse ≈ 12 Energy — fortfahren?"). Das ersetzt die Brieftaschen-Schutzfunktion des Caps – der User entscheidet bewusst.
2. **Technisches Input-Limit** (unabhaengig vom Energy-Stand): maximale Dateigroesse / Seitenzahl / Input-Tokens je Anfrage. Das ist die eigentliche Kostenbremse gegen Runaway/Missbrauch und an das Modell-Kontextfenster gekoppelt. **Admin-konfigurierbar** (siehe `06_ADMIN_BEREICH.md`).
3. **Globale Notbremse:** das bestehende `chatAiConfig.dailyBudgetCents` bleibt als zusaetzliche, kontoübergreifende Tagesgrenze erhalten.

**Effektiver „Cap" = das verfuegbare Energy-Guthaben des Users** (zzgl. technischem Input-Limit).

**Grenzfall „nicht genug Energy" (Variante A – gewaehlt):** Reicht das geschaetzte Energy-Budget fuer die Analyse nicht aus, wird die Aktion **blockiert** mit klarem Hinweis statt sie zuzuschneiden:
- AI Chat Standalone / Sprachkurs + AI / Sprachkurs + AI Pro: „Nicht genug Energy — jetzt aufladen" (Top-up-CTA, alle drei Tarife haben Nachkauf).
- **Kein** stilles Truncaten des Dokuments (keine schlechtere Analyse-Qualitaet ohne Wissen des Users).

## 3. Inklusiv-Kontingente je Paket (Vorschlag)

| Paket | Inklusiv-Energy / Monat | Nachkauf moeglich? | Reset |
|---|---:|:---:|---|
| Sprachkurs | 0 (nur Teaser 1–2 / 24 h) | – | Teaser-Tageszaehler |
| AI Chat Standalone | 600 | Ja | monatlich |
| Sprachkurs + AI | 250 | **Ja** | monatlich |
| Sprachkurs + AI Pro | 750 | Ja | monatlich |

**Grobe Orientierung fuer den User (Kommunikation, nicht exakt):**
- **250 Energy** ≈ ~80–125 ausgewogene Lernfragen mit Kontext pro Monat (≈ 3–4/Tag fuer aktive Lerner).
- **600 Energy** ≈ ~200 ausgewogene Gespraeche mit Kontext, oder ~40–120 Dokumenten-Analysen.
- **750 Energy** ≈ ~250 ausgewogene Gespraeche, oder eine Mischung aus Chat, Foto-Scans und Uploads.

- Werte sind ein Vorschlag und vor Implementierung final zu bestaetigen.
- Der Teaser im Sprachkurs ist **kein** Energy-Guthaben, sondern ein separater Tageszaehler (1–2 Fragen / 24 h).
- **Sprachkurs + AI** hat mit **250 Energy** ein komfortables Inklusiv-Kontingent fuer aktive Lerner (ca. 3–4 Lernfragen pro Tag); Top-ups bleiben moeglich, falls Spitzennutzung ausnahmsweise mehr verlangt. Wert wurde Juni 2026 von 120 auf 250 angehoben, da 120 als „Demo-Quota" wahrgenommen wurde und den Mid-Tier-Wert geschwaecht hat – wirtschaftlich unproblematisch (Worst-Case-KI-Kosten <7 % vom Monatsumsatz, siehe `03_PREISKALKULATION.md` §3).
- **AI Chat Standalone** bekommt mit **600 Energy** deutlich mehr Inklusiv-Menge als die Combo-Tarife (Begruendung: keine Kurs-Inhalte → der AI-Chat ist das einzige Produkt-Element des Tarifs und wird entsprechend intensiver genutzt). Wert wurde Juni 2026 von 450 auf 600 angehoben.

> **Entscheidung (Juni 2026):** Die Inklusiv-Mengen werden zum Launch **nicht** angehoben (Marktanalyse-Empfehlung dazu siehe `07_MARKTANALYSE.md`). Eine Anhebung bleibt als bewusster **Post-Launch-Hebel** offen: Da die Mengen admin-konfigurierbar sind (siehe `06_ADMIN_BEREICH.md`), koennen wir das Inklusiv-Kontingent spaeter ohne Deploy als kleines Goodwill-/Marketing-„Top-up" fuer bestehende Kunden erhoehen. Preislich nach unten oder grosszuegiger zu werden, ist jederzeit moeglich – der umgekehrte Weg nicht.

## 4. Nachkauf-Pakete (Top-ups)

Einmalkauf ueber Dodo, gueltig bis Abo-Ende. Verfuegbar fuer alle Buddy-haltigen Tarife mit Nachkauf-Berechtigung: AI Chat Standalone, Sprachkurs + AI, Sprachkurs + AI Pro.

### 4.1 Finale Werte (Entscheidung Juni 2026)

| Pack | Energy gesamt | Davon Bonus | Preis | €/Energy | Δ €/Energy zum naechst-kleineren Pack |
|---|---:|---:|---:|---:|---:|
| **Starter** | 500 | 0 | **4,99 €** | **0,00998 €** | – |
| **Plus** | 1 500 | 500 (50 % Bonus) | **9,99 €** | **0,00666 €** | **−33 %** |
| **Pro** | **4 000** | **1 500 (60 % Bonus)** | **22,99 €** | **0,00575 €** | **−14 %** |

### 4.2 Design-Regeln, die diese Werte erfuellen

Die Treppe muss fuenf Bedingungen gleichzeitig erfuellen — sonst ist sie kaputt:

1. **Monotoner Bulk-Discount:** €/Energy faellt mit jedem groesseren Pack.
2. **Pro nicht durch 2× Plus schlagbar:** 2× Plus = 3 000 Energy / 19,98 € (0,00666 €/Energy). 1× Pro = 4 000 Energy / 22,99 € (0,00575 €/Energy). Pro bleibt billiger pro Energy ✓ und liefert 1 000 Energy mehr. Die zusaetzlichen 1 000 Energy kosten effektiv nur **0,003 €/Energy** (Marginalpreis) — starker Pro-Upgrade-Anreiz.
3. **Worst-Case-Marge ≥ 70 %** auf reine KI-Kosten in jedem Pack (siehe Tabelle 4.3).
4. **Spuerbarer Sprung** (≥ 15 % €/Energy-Reduktion pro Stufe) — Starter→Plus: −33 %, Plus→Pro: −14 % (knapp, aber wirksam).
5. **`.99`-Preise** fuer psychologisches Pricing.

### 4.3 Margen-Tabelle

Aktives Modell Gemini 2.5 Flash. Worst Case = 1 250 Input + 512 Output Tokens/Energy → ~$0,00166/Energy. Typical Mix = 833 in + 267 out → ~$0,00092/Energy. USD ~ EUR (siehe `03_PREISKALKULATION.md` §1).

| Pack | Preis | KI-Kosten Worst | Marge Worst | KI-Kosten Typical | Marge Typical |
|---|---:|---:|---:|---:|---:|
| Starter | 4,99 € | $0,83 | **83 %** | $0,46 | 91 % |
| Plus | 9,99 € | $2,49 | **75 %** | $1,38 | 86 % |
| Pro | 22,99 € | $6,64 | **71 %** | $3,67 | 84 % |

Die Live-Margen mit der **tatsaechlich aktiven** Modell-Konfiguration sind im Admin-UI (`/admin/energy`) tagesaktuell sichtbar.

### 4.4 Verhaeltnis zu den Tarif-Inklusiv-Preisen (Anti-Kannibalisierung)

| Energy-Quelle | €/Energy |
|---|---:|
| Sprachkurs + AI Inklusiv (250 Energy/Monat aus 8,25 € Monatspreis) | 0,033 € |
| AI Chat Standalone Inklusiv (600 Energy/Monat aus 7,42 € Monatspreis) | 0,012 € |
| Sprachkurs + AI Pro Inklusiv (750 Energy/Monat aus 9,92 € Monatspreis) | 0,013 € |
| Top-Up Starter | 0,00998 € |
| Top-Up Plus | 0,00666 € |
| Top-Up Pro | 0,00575 € |

Top-Ups liegen pro Energy unter dem **AI-zentrierten Tarif-Anker (0,012–0,013 €)**, **kannibalisieren** die Tarife aber nicht: Inklusiv-Energy kommt **jeden Monat neu**, Top-Up nur einmal. Wer dauerhaft mehr braucht, faehrt mit einem Tarif-Upgrade besser — Top-Up ist die saubere Spitzennutzungs-Option.

### 4.5 Bonus-Logik (Marketing)

- **Starter** (0 % Bonus): Einstiegspack, keine Versuessung – Pflichteinkauf fuer Erst-Nachkaeufer.
- **Plus** (50 % Bonus): „kaufe 1 000, bekomme 500 dazu" – psychologisch starker Aha-Moment.
- **Pro** (60 % Bonus): „kaufe 2 500, bekomme 1 500 dazu" – signalisiert „je groesser, desto besser".

Bonus-Eskalation 0 % → 50 % → 60 % ist monoton und liefert dem User einen klaren visuellen Grund, das groessere Pack zu nehmen.

### 4.6 Dodo-Produkte

Drei Dodo-Top-up-Produkt-IDs (Env-Variablen): `DODO_TOPUP_STARTER`, `DODO_TOPUP_PLUS`, `DODO_TOPUP_PRO`.

> **Quelle der Wahrheit:** `convex/subscriptions.ts → TOPUP_PACKS`. Die Dodo-Produkte im Dodo-Dashboard **muessen** auf dieselben Energy/Preis-Werte gepflegt sein, sonst bucht Dodo den falschen Betrag und der User bekommt eine falsche Energy-Gutschrift. Energy-Total in Dodo = `energyAmount + bonusAmount`.

## 5. Verfalls- und Reset-Regeln

- **Inklusiv-Kontingent:** setzt sich pro Abrechnungsmonat zurueck (use-it-or-lose-it). Schuetzt vor Kostenakkumulation und ist Standard.
- **Gekaufte Top-up-Energy:** verfaellt **nicht** monatlich, sondern laeuft bis zum Abo-Ende. Wird erst verbraucht, **nachdem** das monatliche Inklusiv-Kontingent aufgebraucht ist.
- **Reihenfolge des Verbrauchs:** zuerst Inklusiv-Kontingent des Monats, dann Top-up-Guthaben.

## 6. Schema-Skizze (Konzept, noch nicht implementiert)

### 6.1 Felder auf `userSubscriptions` (`convex/schema/core.ts`)

```typescript
// Energy-Felder (nur fuer buddy-haltige Tiers relevant; alle optional -> Zero-Migration)
energyQuotaMonthly:   v.optional(v.number()), // Inklusiv-Kontingent pro Monat (Energy)
energyUsedThisPeriod: v.optional(v.number()), // im laufenden Monat verbrauchte Energy
energyTopUpBalance:   v.optional(v.number()), // gekauftes, nicht verfallendes Energy-Guthaben
energyPeriodResetAt:  v.optional(v.number()), // Zeitpunkt des naechsten Monats-Resets
```

Backward-Compat: Abos ohne diese Felder -> als unbegrenzt behandeln (Bestandskunden/Beta).

### 6.2 Neue Tabelle: Nachkauf-Historie (`convex/schema/chat.ts`)

```typescript
energyPurchases: defineTable({
  userId: v.id("users"),
  energyAdded: v.number(),
  priceCents: v.number(),
  purchasedAt: v.number(),
  billingProvider: v.optional(v.string()),
  providerPaymentId: v.optional(v.string()),
}).index("by_user", ["userId"]),
```

### 6.3 Empfohlen: Verbrauchs-Ledger (Audit/Analytics)

```typescript
energyLedger: defineTable({
  userId: v.id("users"),
  delta: v.number(),                  // +n (Gutschrift) / -n (Verbrauch in Energy)
  reason: v.union(
    v.literal("usage"),               // KI-Aktion
    v.literal("monthly_reset"),
    v.literal("topup"),
    v.literal("admin_adjust")
  ),
  // Bei reason="usage": welcher Aktionstyp verbraucht hat (fuer Analyse/Feintuning)
  actionType: v.optional(v.union(
    v.literal("compact"),
    v.literal("balanced"),
    v.literal("detailed"),
    v.literal("photo_scan"),
    v.literal("document_analysis")
  )),
  ragUsed: v.optional(v.boolean()),
  messageId: v.optional(v.id("chatMessages")),
  estInputTokens: v.optional(v.number()),  // gemessene LLM-Tokens (intern)
  estOutputTokens: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_user", ["userId"]),
```

Der Ledger ist empfohlen: ermoeglicht Kostenanalyse je User/Aktionstyp, transparente Anzeige und spaeteres Feintuning der Verbrauchstabelle.

> **Skalierungs-Hinweis (Juni 2026):** Der Ledger hat aktuell **keinen** Index auf `createdAt`. Der Admin-Live-Kalkulator (`getEnergyEconomics`) liest die letzten 30 Tage ueber ein `.take(50_000)`-Safety-Cap. Sobald die Tabelle dauerhaft >40 000 Eintraege fuehrt, **blendet die Admin-Karte automatisch eine Warnung ein** („Energy ledger scan cap nearing limit" / „cap reached"). In dem Fall: `by_createdAt`-Index hinzufuegen (`convex/schema/chat.ts` oder wo die Tabelle definiert ist) und in `convex/platform.ts → getEnergyEconomics` von `.take(50_000)` auf eine ranged Query (`withIndex("by_createdAt", q => q.gte("createdAt", windowStartMs))`) umstellen. Bis dahin sind die 30-Tage-Werte korrekt; nur Reports ueber einen laengeren Zeitraum koennten unvollstaendig werden.

## 7. Metering (Verbrauch verbuchen)

- Der Verbrauch wird **in derselben Mutation** verbucht, die die Buddy-Antwort/Aktion finalisiert (Convex serialisiert Mutationen pro Dokument -> keine Race-Condition).
- Ablauf je KI-Aktion:
  1. Feature-Gate pruefen (`buddyChat`), Tier-spezifische Tools (Upload/Knowledge/Vision) pruefen.
  2. **Energy-Kosten der Aktion bestimmen** aus Aktionstyp (compact/balanced/detailed) + Aufschlaegen (RAG-Kontext, Foto-Scan, Dokumentgroesse), gemaess Verbrauchstabelle (2.1).
  3. Verfuegbares Guthaben pruefen (`energyQuotaMonthly - energyUsedThisPeriod + energyTopUpBalance >= Kosten`). Reicht es nicht -> **Variante A** (blockieren + Top-up-/Upgrade-Hinweis, 2.2), keine Abbuchung.
  4. Bei Upload/Analyse: **technisches Input-Limit** pruefen (2.2), **voraussichtliche Energy-Kosten** schaetzen und bestaetigen lassen; geschaetzten Betrag vorlaeufig reservieren.
  5. Aktion zulassen -> Antwort streamen (`convex/chat.ts` `streamChatMessage`).
  6. Nach Erfolg: **real gemessene** Energy abbuchen (zuerst Inklusiv, dann Top-up) und ggf. die Reservierung aus Schritt 4 auf den Ist-Wert abgleichen; `energyLedger`-Eintrag mit Aktionstyp + gemessenen LLM-Tokens. Die Vorschau ist eine Schaetzung (`~`); verrechnet wird der gemessene Verbrauch.
- **Monatlicher Reset:** per Convex-Cron (`convex/crons.ts`) – setzt `energyUsedThisPeriod` auf 0 und `energyPeriodResetAt` neu, sobald faellig. (Reset darf nicht in einer Query passieren – siehe Convex-Regel „kein `Date.now()` in Queries".)

## 7a. Modell-Preise als Code-Konstante (Pricing-Quelle)

Der Live-Kalkulator im Admin (`/admin/energy`) braucht **echte LLM-Preise (USD pro 1M Tokens)**, um $/Energy und Tier-Margen zu berechnen. Diese Preise leben **bewusst nicht in der Datenbank**, sondern als Code-Konstante in `convex/ai/modelPricing.ts`.

**Begruendung (Entscheidung Juni 2026, Option A):**
- Modell-Preise aendern sich selten (typischerweise 1–2× pro Jahr) – ein UI-Editor dafuer waere Overengineering.
- Code-Versionierung gibt einen **sauberen Audit-Trail**: „Wann wurde der Preis von 0.30 auf X geaendert? In welchem Commit? Von wem?" → das beantwortet `git log convex/ai/modelPricing.ts`.
- Kein Risiko von versehentlichen Live-Aenderungen ueber ein UI-Feld.

**Was ist ein PR?** PR = **Pull Request** = der normale Code-Aenderungs-Workflow: Datei editieren → committen → Pull Request stellen → reviewen → mergen → deployen. Wenn Google/OpenAI ihre Preise anpassen, muss `convex/ai/modelPricing.ts` per PR aktualisiert werden (Werte plus `PRICING_LAST_VERIFIED_AT`-Datum hochsetzen). Kein Hexenwerk, aber explizit ein Code-Schritt – kein UI-Toggle.

**Pricing-Freshness-Warnung (live im Admin):**
- Datei haelt `PRICING_LAST_VERIFIED_AT` (ISO-Datum, hardcoded).
- Admin-Karte berechnet daraus das Alter und zeigt:
  - **`fresh`** (< 90 Tage): keine Warnung.
  - **`warn`** (≥ 90 Tage, gelber Banner): „Model pricing table may be outdated – please re-check."
  - **`alert`** (≥ 180 Tage, roter Banner): „Model pricing table is outdated – please verify prices and request a code update."
- Der Banner verlinkt direkt auf die offizielle Pricing-Doku des aktiven Providers (`https://ai.google.dev/gemini-api/docs/pricing` bzw. `https://platform.openai.com/docs/pricing`).
- **Workflow bei Aenderung:** Provider-Doku oeffnen → neue Preise in `MODEL_PRICING` eintragen → `PRICING_LAST_VERIFIED_AT` auf heutiges Datum setzen → PR + Deploy. Banner verschwindet automatisch nach dem Deploy.

> **Alternative (verworfen):** Datenbankspalte `chatAiConfig.modelInputUsdPer1M` plus Admin-UI-Eingabe. Vorteil: keine Code-Aenderung noetig. Nachteil: Audit-Trail nur in Convex-Logs (weniger sichtbar), Risiko von Tippfehlern mit unmittelbarer Produktions-Wirkung, und der Pflege-Aufwand fuer „aenderbar, was sich faktisch nie aendert" rechtfertigt das Schema-Feld nicht. Diese Option bleibt jederzeit nachruestbar, falls sich die Pflege-Realitaet aendert (z. B. wir wollen Pricing pro Customer-Segment differenzieren).

## 8. Anzeige im Frontend (Konzept)

Leitidee: Der aktuelle Energy-Stand ist **immer sichtbar**, und vor jeder Aktion sieht der User **live**, was sie kostet.

- **Dauerhaftes Energy-Pill (immer sichtbar):** im Buddy-/Chat-Header ein kleines Pill `⚡ 312` (z. B. in `Chat.tsx` / `ChatModal.tsx`). Farbzustaende: normal / Bernstein bei <10 % / Rot bei 0. Tippen oeffnet ein Popover mit Aufschluesselung (Inklusiv vs. gekauftes Top-up), Reset-Datum und Top-up-CTA.
- **Kosten-Vorschau pro Aktion (live, vor dem Senden):**
  - Antwortmodus-Umschalter zeigt die Energy je Stufe: `Kompakt · 1⚡`, `Ausgewogen · 2⚡`, `Ausfuehrlich · 3⚡`. Ein Hinweis am Senden-Button aktualisiert sich, z. B. „Diese Antwort ≈ 3⚡ (inkl. Kontext)".
  - **Upload:** sobald eine Datei angehaengt ist, wird die Groesse (Seiten/Tokens) geschaetzt und live angezeigt: „Diese Analyse ≈ 12⚡ — du hast 312⚡". Aktualisiert sich beim Hinzufuegen/Entfernen von Dateien.
- **Abrechnung nach der Aktion (Reconciliation):** kurzes Feedback „−11⚡", Pill aktualisiert sich; der exakte, gemessene Wert steht im `energyLedger`. Vorschau = Schaetzung (`~`), Abbuchung = Ist-Wert (siehe 2.2 / Abschnitt 7).
- Bei 10 % Restguthaben: dezenter Hinweis (nicht blockierend).
- Bei 0 (und Nachkauf moeglich): freundlicher Top-up-CTA statt Fehler.
- **Grenzfall (Variante A):** reicht die geschaetzte Energy nicht, wird der Bestaetigen-Button zu „Nicht genug Energy — aufladen" (Top-up-CTA, gilt fuer AI Chat Standalone, Sprachkurs + AI, Sprachkurs + AI Pro). Kein stilles Zuschneiden.

## 9. Dodo-Produkt-Matrix (Energy + Abos)

- **Top-up-Produkte (Einmalzahlung):** Starter / Plus / Pro -> je eine Dodo-Produkt-ID (Env-Variablen `DODO_TOPUP_STARTER`, `DODO_TOPUP_PLUS`, `DODO_TOPUP_PRO`). Insgesamt **3 Top-up-Produkt-IDs**.
- **Abo-Produkte (Entscheidung Juni 2026, aktualisiert Juni 2026):** Paket × Laufzeit × Zahlungsmodus. **Drei Laufzeiten: 3 / 6 / 12 Monate** (9-Monats-Variante entfernt). Ratenzahlung gilt seit der Aktualisierung für **alle vier Tarife** (zuvor war der Sprachkurs prepaid-only):
  - **Alle vier Tarife (Sprachkurs, AI Chat Standalone, Sprachkurs + AI, Sprachkurs + AI Pro):** je 3 Laufzeiten × 2 Modi (prepaid + Raten) = **6 Produkte pro Tarif**.
  - **Summe: 4 × 6 = 24 Abo-Produkte** + 3 Top-ups = **27 Dodo-Produkt-IDs**.
- Webhook-Verarbeitung (`convex/subscriptions.ts` `internalProcessDodoWebhook`) wird erweitert, um `featureTier` und Energy-Felder aus den Checkout-Metadaten zu uebernehmen und Top-ups dem `energyTopUpBalance` gutzuschreiben (Idempotenz ueber bestehendes `dodoWebhookEvents`-Muster).
