# Paddle Billing: Go-Live Checkliste

Diese Checkliste dokumentiert alle Schritte, um von der Paddle Sandbox-Umgebung zur Production-Umgebung zu wechseln.

---

## Voraussetzungen

- [ ] Domain-Freigabe durch Paddle erhalten (Review-Prozess abgeschlossen)
- [ ] Sandbox-Integration vollständig getestet
- [ ] Alle Webhooks funktionieren korrekt in Sandbox

---

## 1. Initiale Konfiguration (Paddle Dashboard - Live)

### 1.1 Account-Einstellungen prüfen

- [ ] **Balance Currency** korrekt eingestellt
- [ ] **Tax Settings** konfiguriert (Preise inkl. oder exkl. Steuer)
- [ ] **Payment Methods** aktiviert (Kreditkarte, PayPal, etc.)

### 1.2 Checkout-Einstellungen

| Einstellung | Wert | Status |
|-------------|------|--------|
| Default Payment Link | `https://learn-with.me` | [ ] |
| Allowed Domains | `learn-with.me` | [ ] |
| Branding/Logo | Hochgeladen | [ ] |

**Pfad:** Paddle Dashboard > Checkout > Checkout settings

---

## 2. Produkt-Katalog erstellen (Live)

### 2.1 Produkte anlegen

Erstelle die Produkte im **Live Dashboard** (nicht Sandbox!):

| Produkt | Sandbox ID | Live ID | Status |
|---------|------------|---------|--------|
| Intensive Plan | `pro_test_...` | `pro_live_...` | [ ] |
| Balanced Plan | `pro_test_...` | `pro_live_...` | [ ] |
| Standard Plan | `pro_test_...` | `pro_live_...` | [ ] |
| Relaxed Plan | `pro_test_...` | `pro_live_...` | [ ] |

**Pfad:** Paddle Dashboard > Catalog > Products > New Product

### 2.2 Preise anlegen

Für jeden Plan einen Preis erstellen:

| Plan | Dauer | Preis | Sandbox Price ID | Live Price ID | Status |
|------|-------|-------|------------------|---------------|--------|
| Intensive | 3 Monate | €XX | `pri_test_...` | `pri_live_...` | [ ] |
| Balanced | 6 Monate | €XX | `pri_test_...` | `pri_live_...` | [ ] |
| Standard | 9 Monate | €XX | `pri_test_...` | `pri_live_...` | [ ] |
| Relaxed | 12 Monate | €XX | `pri_test_...` | `pri_live_...` | [ ] |

**Wichtig:** 
- Preise als **One-Time** (nicht recurring) für Prepaid-Modell
- Currency: EUR
- Tax Category: korrekt setzen

**Pfad:** Paddle Dashboard > Catalog > Prices > New Price

### 2.3 Beta-Rabatt-Preise (falls benötigt)

| Plan | Rabatt | Sandbox Price ID | Live Price ID | Status |
|------|--------|------------------|---------------|--------|
| Intensive Beta50 | 50% | `pri_test_...` | `pri_live_...` | [ ] |
| Balanced Beta50 | 50% | `pri_test_...` | `pri_live_...` | [ ] |
| Standard Beta50 | 50% | `pri_test_...` | `pri_live_...` | [ ] |
| Relaxed Beta50 | 50% | `pri_test_...` | `pri_live_...` | [ ] |

---

## 3. Credentials generieren (Live)

### 3.1 API Key erstellen

- [ ] Neuen API Key im Live Dashboard erstellen
- [ ] Key sicher speichern (wird nur einmal angezeigt!)

**Format:** `pdl_live_apikey_...` (beginnt mit `pdl_live_`)

**Pfad:** Paddle Dashboard > Developer Tools > Authentication > API Keys > New API Key

### 3.2 Client-Side Token erstellen

- [ ] Neuen Client-Side Token im Live Dashboard erstellen
- [ ] Token notieren

**Format:** `live_...` (beginnt mit `live_`)

**Pfad:** Paddle Dashboard > Developer Tools > Authentication > Client-side tokens > New client-side token

---

## 4. Webhook Notification Setting erstellen (Live)

### 4.1 Notification Destination konfigurieren

| Einstellung | Wert |
|-------------|------|
| Type | URL (Webhook) |
| URL | `https://fleet-labrador-324.convex.site/paddle` |
| API Version | 1 |
| Events | `transaction.completed` (mindestens) |

- [ ] Notification Destination erstellt
- [ ] **Webhook Secret** notiert (für Signatur-Verifizierung)

**Pfad:** Paddle Dashboard > Developer Tools > Notifications > New destination

### 4.2 Empfohlene Events

Für vollständige Integration diese Events abonnieren:

- [x] `transaction.completed` (Pflicht für Subscription-Aktivierung)
- [ ] `transaction.paid` (optional)
- [ ] `transaction.payment_failed` (optional, für Fehlerbehandlung)
- [ ] `subscription.created` (falls später Subscriptions genutzt werden)
- [ ] `subscription.canceled` (falls später Subscriptions genutzt werden)

---

## 5. Environment Variables aktualisieren

### 5.1 Convex Dashboard (Production: fleet-labrador-324)

Ersetze alle Sandbox-Werte mit Live-Werten:

```env
# Paddle Live Credentials
PADDLE_WEBHOOK_SECRET=<live-webhook-secret>
PADDLE_CLIENT_TOKEN=live_...
PADDLE_ENVIRONMENT=production

# Paddle Live Price IDs
PADDLE_PRODUCT_INTENSIVE=pri_live_...
PADDLE_PRODUCT_BALANCED=pri_live_...
PADDLE_PRODUCT_STANDARD=pri_live_...
PADDLE_PRODUCT_RELAXED=pri_live_...

# Beta Discount Price IDs (falls verwendet)
PADDLE_PRODUCT_INTENSIVE_BETA50=pri_live_...
PADDLE_PRODUCT_BALANCED_BETA50=pri_live_...
PADDLE_PRODUCT_STANDARD_BETA50=pri_live_...
PADDLE_PRODUCT_RELAXED_BETA50=pri_live_...
```

**Checkliste:**

- [ ] `PADDLE_WEBHOOK_SECRET` aktualisiert
- [ ] `PADDLE_CLIENT_TOKEN` aktualisiert
- [ ] `PADDLE_ENVIRONMENT` auf `production` gesetzt
- [ ] Alle `PADDLE_PRODUCT_*` IDs aktualisiert
- [ ] Alle `PADDLE_PRODUCT_*_BETA50` IDs aktualisiert (falls verwendet)

**Pfad:** https://dashboard.convex.dev > fleet-labrador-324 > Settings > Environment Variables

### 5.2 Code-Änderungen

**Keine Code-Änderungen erforderlich!**

Unsere Architektur lädt alle Paddle-Konfigurationen dynamisch aus Convex Environment Variables über `getPaddleCheckoutConfig`. Der Frontend-Code muss nicht angepasst werden.

---

## 6. Deployment

### 6.1 Deployment-Reihenfolge (WICHTIG!)

1. **Zuerst:** Convex Functions deployen
   ```bash
   npx convex deploy -y
   ```

2. **Dann:** Frontend deployen
   ```bash
   vercel --prod
   ```

**Checkliste:**

- [ ] Environment Variables in Convex Dashboard aktualisiert
- [ ] `npx convex deploy -y` ausgeführt
- [ ] `vercel --prod` ausgeführt

---

## 7. Post-Deployment Validierung

### 7.1 Funktionstest

- [ ] Website unter `https://learn-with.me` erreichbar
- [ ] Pricing-Seite zeigt korrekte Preise
- [ ] "Choose Plan" Button öffnet Paddle Checkout
- [ ] Checkout zeigt korrektes Branding und Preise

### 7.2 Erster Live-Test (optional)

Falls gewünscht, einen echten Test-Kauf durchführen:

- [ ] Plan auswählen und Checkout öffnen
- [ ] Mit echter Zahlungsmethode bezahlen
- [ ] Webhook wird empfangen (Convex Logs prüfen)
- [ ] Subscription wird aktiviert (Datenbank prüfen)
- [ ] Ggf. Refund über Paddle Dashboard

### 7.3 Webhook-Logs prüfen

- [ ] Convex Logs auf Fehler prüfen
- [ ] Paddle Dashboard > Developer Tools > Notifications > Logs

---

## 8. Unterschiede Sandbox vs. Live

| Aspekt | Sandbox | Live |
|--------|---------|------|
| API Base URL | `sandbox-api.paddle.com` | `api.paddle.com` |
| API Key Prefix | `pdl_test_apikey_` | `pdl_live_apikey_` |
| Client Token Prefix | `test_` | `live_` |
| Product ID Prefix | `pro_test_` | `pro_live_` |
| Price ID Prefix | `pri_test_` | `pri_live_` |
| Echte Zahlungen | Nein (Testdaten) | Ja |
| Domain Approval | Nicht erforderlich | Erforderlich |

---

## 9. Testdaten für Sandbox (Referenz)

Falls du weiterhin in Sandbox testen möchtest:

| Feld | Wert |
|------|------|
| Email | Beliebige eigene Email |
| Land | Beliebiges Paddle-unterstütztes Land |
| PLZ | Beliebige gültige PLZ |
| Kartennummer | `4242 4242 4242 4242` |
| Name | Beliebiger Name |
| Ablaufdatum | Beliebiges Datum in der Zukunft |
| CVV | `100` |

---

## 10. Troubleshooting

### Checkout öffnet nicht / "Something went wrong"

1. Browser-Konsole auf Fehler prüfen
2. `Default Payment Link` in Paddle korrekt gesetzt?
3. Domain in `Allowed Domains` eingetragen?
4. Client-Side Token korrekt (`live_...`)?
5. Price IDs korrekt (Live, nicht Sandbox)?

### Webhook wird nicht empfangen

1. Notification Destination URL korrekt?
2. Event `transaction.completed` abonniert?
3. Convex Production Deployment aktiv?
4. Webhook Secret in Convex Environment Variables?

### Subscription wird nicht aktiviert

1. Convex Logs auf Fehler prüfen
2. `clerkId` in Custom Data vorhanden?
3. User existiert in Datenbank?
4. Price ID in `PADDLE_PRODUCT_*` Environment Variables?

---

## Notizen

_Platz für eigene Notizen während des Go-Live-Prozesses:_

```
Live API Key erstellt am: ___________
Live Client Token erstellt am: ___________
Produkte erstellt am: ___________
Webhook konfiguriert am: ___________
Go-Live Datum: ___________
```

---

## 11. Beta-System Konfiguration

Das Beta-System steuert, wer als Beta-Tester gilt und den 50% Rabatt nach Beta-Ende erhält.

### 11.1 Übersicht: Alle Beta-Schalter

| Schalter | Typ | Wo | Funktion |
|----------|-----|-----|----------|
| `BETA_MODE` | Env Variable | Convex | Aktiviert automatische Beta-Tester-Markierung für neue User |
| `BETA_END_DATE` | Env Variable | Convex | Definiert das Ende des Beta-Zeitraums |
| `VITE_WAITLIST_MODE` | Env Variable | Vercel | Zeigt Waitlist statt Beta-Registration (Frontend) |
| `isBetaTester` | User-Flag | Datenbank | Markiert einzelne User als Beta-Tester |
| `betaDiscountUsedAt` | User-Timestamp | Datenbank | Trackt ob 50% Rabatt bereits verwendet wurde |

### 11.2 Beta-Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BETA PHASE TIMELINE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Start]                          [BETA_END_DATE]        [Future]   │
│     │                                  │                    │       │
│     │  ◀─── Beta Periode aktiv ────▶   │  ◀── Post-Beta ──▶ │       │
│     │                                  │                    │       │
│     │  • Neue User → isBetaTester=true │  • isBetaTester    │       │
│     │  • Kostenloser Zugang (3 Units)  │    bleibt true     │       │
│     │  • Kein 50% Rabatt verfügbar     │  • 50% Rabatt      │       │
│     │                                  │    EINMALIG        │       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 Convex Environment Variables (Beta)

```env
# Beta-Modus aktivieren (neue User werden automatisch Beta-Tester)
BETA_MODE=on

# Beta-Enddatum (ISO 8601 Format)
# Nach diesem Datum:
# - Keine neuen Beta-Tester mehr
# - 50% Rabatt wird für bestehende Beta-Tester freigeschaltet
BETA_END_DATE=2026-03-31T23:59:59Z
```

**Checkliste:**

- [ ] `BETA_MODE=on` gesetzt (Convex Dashboard)
- [ ] `BETA_END_DATE` mit gewünschtem Enddatum gesetzt (Convex Dashboard)
- [ ] Beta50-Preise in Paddle erstellt (50% vom Normalpreis)
- [ ] `PADDLE_PRODUCT_*_BETA50` Environment Variables gesetzt

**Pfad:** https://dashboard.convex.dev > fleet-labrador-324 > Settings > Environment Variables

### 11.4 Frontend Environment Variables (Vercel)

```env
# Waitlist-Modus deaktivieren (zeigt normale Pricing-Seite)
VITE_WAITLIST_MODE=off
```

**Pfad:** https://vercel.com > Project > Settings > Environment Variables

### 11.5 Benutzer-Flow

**Während der Beta (vor `BETA_END_DATE`):**

| Benutzer | Sieht | Kann |
|----------|-------|------|
| Neuer User (registriert sich) | "Beta Access" Karte | 3 Units kostenlos nutzen |
| Beta-Tester (bereits registriert) | "Beta Access" Karte | 3 Units kostenlos nutzen |
| Nicht-Beta-User | Normale Preise | Pläne zum Normalpreis kaufen |

**Nach der Beta (nach `BETA_END_DATE`):**

| Benutzer | Sieht | Kann |
|----------|-------|------|
| Beta-Tester (noch nicht gekauft) | Preise mit "(Beta 50%)" | EINMALIG 50% Rabatt nutzen |
| Beta-Tester (bereits gekauft) | Normale Preise | Nur noch Normalpreis |
| Nicht-Beta-User | Normale Preise | Pläne zum Normalpreis kaufen |

### 11.6 Wichtige Regeln

1. **50% Rabatt ist EINMALIG** - Nach dem ersten Kauf mit Rabatt wird `betaDiscountUsedAt` gesetzt
2. **Rabatt erst nach Beta-Ende** - Während der Beta können Beta-Tester nicht kaufen (kostenloser Zugang)
3. **Nur für `isBetaTester=true`** - Der Rabatt gilt nur für markierte User
4. **Kein Ablaufdatum für Rabatt** - Beta-Tester können den Rabatt jederzeit nach Beta-Ende einlösen

### 11.7 Beta beenden (wenn gewünscht)

Um den Beta-Modus vollständig zu beenden:

1. **Keine neuen Beta-Tester mehr:**
   ```env
   BETA_MODE=off
   ```

2. **50% Rabatt deaktivieren** (optional):
   - `PADDLE_PRODUCT_*_BETA50` Environment Variables entfernen
   - Oder Beta50-Preise in Paddle archivieren

---

## 12. Vollständige Go-Live Checkliste (Zusammenfassung)

### Pre-Launch

- [ ] Paddle Domain-Freigabe erhalten
- [ ] Sandbox-Tests erfolgreich
- [ ] Live Produkte & Preise in Paddle erstellt
- [ ] Live Beta50-Preise in Paddle erstellt
- [ ] Live Webhook Notification Setting erstellt

### Environment Variables (Convex)

- [ ] `PADDLE_WEBHOOK_SECRET` (Live)
- [ ] `PADDLE_CLIENT_TOKEN` (Live)
- [ ] `PADDLE_ENVIRONMENT=production`
- [ ] `PADDLE_PRODUCT_INTENSIVE` (Live Price ID)
- [ ] `PADDLE_PRODUCT_BALANCED` (Live Price ID)
- [ ] `PADDLE_PRODUCT_STANDARD` (Live Price ID)
- [ ] `PADDLE_PRODUCT_RELAXED` (Live Price ID)
- [ ] `PADDLE_PRODUCT_INTENSIVE_BETA50` (Live Price ID)
- [ ] `PADDLE_PRODUCT_BALANCED_BETA50` (Live Price ID)
- [ ] `PADDLE_PRODUCT_STANDARD_BETA50` (Live Price ID)
- [ ] `PADDLE_PRODUCT_RELAXED_BETA50` (Live Price ID)
- [ ] `BETA_MODE=on`
- [ ] `BETA_END_DATE=YYYY-MM-DDTHH:mm:ssZ`

### Environment Variables (Vercel)

- [ ] `VITE_WAITLIST_MODE=off`

### Deployment

- [ ] `npx convex deploy -y` (Convex zuerst!)
- [ ] `vercel --prod` (Frontend danach!)

### Post-Launch Validierung

- [ ] Website erreichbar
- [ ] Checkout funktioniert
- [ ] Webhook wird empfangen
- [ ] Subscription wird aktiviert
- [ ] Beta-Tester sehen 50% Rabatt (nach Beta-Ende)

---

## Referenzen

- [Paddle Go-Live Checklist](https://developer.paddle.com/build/onboarding/go-live-checklist)
- [Paddle API Authentication](https://developer.paddle.com/api-reference/overview)
- [Paddle Webhooks](https://developer.paddle.com/webhooks/overview)
- [Convex Environment Variables](https://docs.convex.dev/production/environment-variables)
