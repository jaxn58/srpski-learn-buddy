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
- Standalone / Full Package: „Nicht genug Energy — jetzt aufladen" (Top-up-CTA).
- Basic Kombi (kein Nachkauf): „Energy diesen Monat aufgebraucht — Upgrade auf Full Package oder naechster Monat".
- **Kein** stilles Truncaten des Dokuments (keine schlechtere Analyse-Qualitaet ohne Wissen des Users).

## 3. Inklusiv-Kontingente je Paket (Vorschlag)

| Paket | Inklusiv-Energy / Monat | Nachkauf moeglich? | Reset |
|---|---:|:---:|---|
| Sprachkurs | 0 (nur Teaser 1–2 / 24 h) | – | Teaser-Tageszaehler |
| AI Buddy Standalone | 450 | Ja | monatlich |
| Basic Kombi | 120 | **Nein** | monatlich |
| Full Package | 750 | Ja | monatlich |

**Grobe Orientierung fuer den User (Kommunikation, nicht exakt):**
- **120 Energy** ≈ ~40–60 ausgewogene Lernfragen mit Kontext pro Monat.
- **450 Energy** ≈ ~150 ausgewogene Gespraeche mit Kontext, oder ~30–90 Dokumenten-Analysen.
- **750 Energy** ≈ ~250 ausgewogene Gespraeche, oder eine Mischung aus Chat, Foto-Scans und Uploads.

- Werte sind ein Vorschlag und vor Implementierung final zu bestaetigen.
- Der Teaser im Sprachkurs ist **kein** Energy-Guthaben, sondern ein separater Tageszaehler (1–2 Fragen / 24 h).

> **Entscheidung (Juni 2026):** Die Inklusiv-Mengen werden zum Launch **nicht** angehoben (Marktanalyse-Empfehlung dazu siehe `07_MARKTANALYSE.md`). Eine Anhebung bleibt als bewusster **Post-Launch-Hebel** offen: Da die Mengen admin-konfigurierbar sind (siehe `06_ADMIN_BEREICH.md`), koennen wir das Inklusiv-Kontingent spaeter ohne Deploy als kleines Goodwill-/Marketing-„Top-up" fuer bestehende Kunden erhoehen. Preislich nach unten oder grosszuegiger zu werden, ist jederzeit moeglich – der umgekehrte Weg nicht.

## 4. Nachkauf-Pakete (Top-ups, Vorschlag)

Einmalkauf ueber Dodo, gueltig bis Abo-Ende. Nur fuer Pakete mit Nachkauf-Berechtigung (Standalone, Full).

| Pack | Energy | Preis (Vorschlag) |
|---|---:|---:|
| Starter | 150 | 4,99 € |
| Plus | 500 | 11,99 € |
| Pro | 1.500 | 29,99 € |

(Marge/Begruendung siehe `03_PREISKALKULATION.md`.)

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

## 8. Anzeige im Frontend (Konzept)

Leitidee: Der aktuelle Energy-Stand ist **immer sichtbar**, und vor jeder Aktion sieht der User **live**, was sie kostet.

- **Dauerhaftes Energy-Pill (immer sichtbar):** im Buddy-/Chat-Header ein kleines Pill `⚡ 312` (z. B. in `Chat.tsx` / `ChatModal.tsx`). Farbzustaende: normal / Bernstein bei <10 % / Rot bei 0. Tippen oeffnet ein Popover mit Aufschluesselung (Inklusiv vs. gekauftes Top-up), Reset-Datum und Top-up-CTA.
- **Kosten-Vorschau pro Aktion (live, vor dem Senden):**
  - Antwortmodus-Umschalter zeigt die Energy je Stufe: `Kompakt · 1⚡`, `Ausgewogen · 2⚡`, `Ausfuehrlich · 3⚡`. Ein Hinweis am Senden-Button aktualisiert sich, z. B. „Diese Antwort ≈ 3⚡ (inkl. Kontext)".
  - **Upload:** sobald eine Datei angehaengt ist, wird die Groesse (Seiten/Tokens) geschaetzt und live angezeigt: „Diese Analyse ≈ 12⚡ — du hast 312⚡". Aktualisiert sich beim Hinzufuegen/Entfernen von Dateien.
- **Abrechnung nach der Aktion (Reconciliation):** kurzes Feedback „−11⚡", Pill aktualisiert sich; der exakte, gemessene Wert steht im `energyLedger`. Vorschau = Schaetzung (`~`), Abbuchung = Ist-Wert (siehe 2.2 / Abschnitt 7).
- Bei 10 % Restguthaben: dezenter Hinweis (nicht blockierend).
- Bei 0 (und Nachkauf moeglich): freundlicher Top-up-CTA statt Fehler.
- **Grenzfall (Variante A):** reicht die geschaetzte Energy nicht, wird der Bestaetigen-Button zu „Nicht genug Energy — aufladen" (Standalone/Full) bzw. „Energy diesen Monat aufgebraucht — Upgrade / naechster Monat" (Basic Kombi). Kein stilles Zuschneiden.

## 9. Dodo-Produkt-Matrix (Energy + Abos)

- **Top-up-Produkte (Einmalzahlung):** Starter / Plus / Pro -> je eine Dodo-Produkt-ID (Env-Variablen, analog zum bestehenden Muster `DODO_PRODUCT_*`).
- **Abo-Produkte:** Paket × Laufzeit × Zahlungsmodus. Bei 4 Paketen × 4 Laufzeiten × 2 Modi = bis zu **32 Produkt-IDs**. Empfehlung zur Reduktion (zu bestaetigen):
  - Sprachkurs ggf. nur prepaid (kein Ratenkauf fuer niedrigste Preisstufe).
  - Ratenzahlung erst ab Basic Kombi.
- Webhook-Verarbeitung (`convex/subscriptions.ts` `internalProcessDodoWebhook`) wird erweitert, um `featureTier` und Energy-Felder aus den Checkout-Metadaten zu uebernehmen und Top-ups dem `energyTopUpBalance` gutzuschreiben (Idempotenz ueber bestehendes `dodoWebhookEvents`-Muster).
