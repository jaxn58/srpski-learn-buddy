# Token-System

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

---

## 1. Grundprinzip: „Token = Buddy-Nachricht"

- **Sichtbare Einheit für den User:** 1 **Token** = 1 Buddy-Nachricht mit Standard-Antwortlänge.
- **Intern:** Es werden die tatsächlichen LLM-Tokens (Input + Output) gemessen und protokolliert, dem User aber als einfaches **Nachrichten-Guthaben** angezeigt („Du hast noch 47 Token").
- **Warum diese Abstraktion?** „Echte" LLM-Tokens sind für Endnutzer nicht greifbar. Ein Nachrichten-Guthaben ist verständlich, planbar und marktüblich. Die interne Messung sorgt trotzdem für eine faire Kostendeckung und erlaubt später Feintuning (z. B. teure Anfragen = mehr als 1 Token).

> Optionaler Ausbau (später): Sehr lange/teure Anfragen (z. B. großer Dokumenten-Kontext) könnten intern mehr als 1 Token kosten. Start: einfach 1 Nachricht = 1 Token.

## 2. Inklusiv-Kontingente je Paket (Vorschlag)

| Paket | Inklusiv-Token / Monat | Nachkauf möglich? | Reset |
|---|---:|:---:|---|
| Sprachkurs | 0 (nur Teaser 1–2 / 24 h) | – | Teaser-Tageszähler |
| AI Buddy Standalone | 150 | Ja | monatlich |
| Basic Kombi | 40 | **Nein** | monatlich |
| Full Package | 250 | Ja | monatlich |

- Werte sind ein Vorschlag und vor Implementierung final zu bestätigen.
- Der Teaser im Sprachkurs ist **kein** Token-Guthaben, sondern ein separater Tageszähler (1–2 Fragen / 24 h).

## 3. Nachkauf-Pakete (Top-ups, Vorschlag)

Einmalkauf über Dodo, gültig bis Abo-Ende. Nur für Pakete mit Nachkauf-Berechtigung (Standalone, Full).

| Paket | Token | Preis (Vorschlag) |
|---|---:|---:|
| Starter | 50 | 4,99 € |
| Plus | 150 | 11,99 € |
| Pro | 500 | 29,99 € |

(Marge/Begründung siehe `03_PREISKALKULATION.md`.)

## 4. Verfalls- und Reset-Regeln

- **Inklusiv-Kontingent:** setzt sich pro Abrechnungsmonat zurück (use-it-or-lose-it). Schützt vor Kostenakkumulation und ist Standard.
- **Gekaufte Top-up-Token:** verfallen **nicht** monatlich, sondern laufen bis zum Abo-Ende. Werden erst verbraucht, **nachdem** das monatliche Inklusiv-Kontingent aufgebraucht ist.
- **Reihenfolge des Verbrauchs:** zuerst Inklusiv-Kontingent des Monats, dann Top-up-Guthaben.

## 5. Schema-Skizze (Konzept, noch nicht implementiert)

### 5.1 Felder auf `userSubscriptions` (`convex/schema/core.ts`)

```typescript
// Token-Felder (nur für buddy-haltige Tiers relevant; alle optional → Zero-Migration)
tokenQuotaMonthly:   v.optional(v.number()), // Inklusiv-Kontingent pro Monat
tokenUsedThisPeriod: v.optional(v.number()), // im laufenden Monat verbraucht
tokenTopUpBalance:   v.optional(v.number()), // gekauftes, nicht verfallendes Guthaben
tokenPeriodResetAt:  v.optional(v.number()), // Zeitpunkt des nächsten Monats-Resets
```

Backward-Compat: Abos ohne diese Felder → als unbegrenzt behandeln (Bestandskunden/Beta).

### 5.2 Neue Tabelle: Nachkauf-Historie (`convex/schema/chat.ts`)

```typescript
tokenPurchases: defineTable({
  userId: v.id("users"),
  tokensAdded: v.number(),
  priceCents: v.number(),
  purchasedAt: v.number(),
  billingProvider: v.optional(v.string()),
  providerPaymentId: v.optional(v.string()),
}).index("by_user", ["userId"]),
```

### 5.3 Optional: Verbrauchs-Ledger (Audit/Analytics)

```typescript
tokenLedger: defineTable({
  userId: v.id("users"),
  delta: v.number(),                  // +n (Gutschrift) / -1 (Verbrauch)
  reason: v.union(
    v.literal("message"),
    v.literal("monthly_reset"),
    v.literal("topup"),
    v.literal("admin_adjust")
  ),
  messageId: v.optional(v.id("chatMessages")),
  estInputTokens: v.optional(v.number()),  // gemessene LLM-Tokens (intern)
  estOutputTokens: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_user", ["userId"]),
```

Der Ledger ist optional, aber empfohlen: ermöglicht Kostenanalyse je User und transparente Anzeige.

## 6. Metering (Verbrauch verbuchen)

- Der Verbrauch wird **in derselben Mutation** verbucht, die die Buddy-Nachricht/Antwort finalisiert (Convex serialisiert Mutationen pro Dokument → keine Race-Condition).
- Ablauf je Buddy-Nachricht:
  1. Feature-Gate prüfen (`buddyChat`), Tier-spezifische Tools (Upload/Knowledge) prüfen.
  2. Verfügbares Guthaben prüfen (`tokenQuotaMonthly - tokenUsedThisPeriod + tokenTopUpBalance`).
  3. Nachricht zulassen → Antwort streamen (`convex/chat.ts` `streamChatMessage`).
  4. Nach erfolgreicher Antwort: 1 Token abbuchen (zuerst Inklusiv, dann Top-up), optional Ledger-Eintrag mit gemessenen LLM-Tokens.
- **Monatlicher Reset:** per Convex-Cron (`convex/crons.ts`) – setzt `tokenUsedThisPeriod` auf 0 und `tokenPeriodResetAt` neu, sobald fällig. (Reset darf nicht in einer Query passieren – siehe Convex-Regel „kein `Date.now()` in Queries".)
- **Globale Notbremse:** das bestehende `chatAiConfig.dailyBudgetCents` bleibt als zusätzliche Kostengrenze erhalten.

## 7. Anzeige im Frontend (Konzept)

- Buddy-Tiers sehen einen Zähler „X Token übrig" (z. B. in `Chat.tsx` / `ChatModal.tsx`).
- Bei 10 % Restguthaben: dezenter Hinweis (nicht blockierend).
- Bei 0 (und Nachkauf möglich): freundlicher Top-up-CTA statt Fehler.
- Basic Kombi (kein Nachkauf): bei 0 Hinweis „Kontingent diesen Monat aufgebraucht – Upgrade auf Full Package für mehr + Nachkauf".

## 8. Dodo-Produkt-Matrix (Token + Abos)

- **Top-up-Produkte (Einmalzahlung):** Starter / Plus / Pro → je eine Dodo-Produkt-ID (Env-Variablen, analog zum bestehenden Muster `DODO_PRODUCT_*`).
- **Abo-Produkte:** Paket × Laufzeit × Zahlungsmodus. Bei 4 Paketen × 4 Laufzeiten × 2 Modi = bis zu **32 Produkt-IDs**. Empfehlung zur Reduktion (zu bestätigen):
  - Sprachkurs ggf. nur prepaid (kein Ratenkauf für niedrigste Preisstufe).
  - Ratenzahlung erst ab Basic Kombi.
- Webhook-Verarbeitung (`convex/subscriptions.ts` `internalProcessDodoWebhook`) wird erweitert, um `featureTier` und Token-Felder aus den Checkout-Metadaten zu übernehmen und Top-ups dem `tokenTopUpBalance` gutzuschreiben (Idempotenz über bestehendes `dodoWebhookEvents`-Muster).
