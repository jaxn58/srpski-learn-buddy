# Paddle Monthly Prices Setup (Sandbox)

## Voraussetzungen

1. **Paddle Sandbox API Key**
   - Dashboard: https://sandbox-vendors.paddle.com
   - Developer Tools → Authentication → API Keys
   - Key-Typ: "Read + Write"

2. **jq** (JSON processor)
   ```bash
   # Windows (Chocolatey)
   choco install jq
   
   # oder direkt: https://jqlang.github.io/jq/download/
   ```

3. **Git Bash oder WSL** (für Windows)
   - Das Script nutzt Bash-Syntax

## Setup-Schritte

### 1. API Key exportieren

```bash
export PADDLE_API_KEY="<your-sandbox-api-key>"
```

**Wichtig**: Niemals den echten Key committen!

### 2. Produkt-IDs ermitteln

**Option A: Über das Script** (empfohlen)
Das Script listet automatisch alle aktiven Produkte und fragt dich nach den IDs.

**Option B: Manuell im Dashboard**
1. Paddle Sandbox Dashboard → Catalog → Products
2. Klicke auf jedes Produkt (Intensive, Balanced, Standard, Relaxed)
3. Kopiere die Product ID (Format: `pro_...`)

### 3. Script ausführen

```bash
cd /d/DEVELOPMENT/Cursor/srpski-tutor-en
bash scripts/paddle-setup-monthly-prices-sandbox.sh
```

Das Script wird:
1. Deine Produkte auflisten
2. Dich nach den 4 Product IDs fragen
3. Für jedes Produkt einen monatlichen Recurring Price erstellen:
   - **Intensive**: €25.99/Monat (3 Monate = €77.97 total)
   - **Balanced**: €14.99/Monat (6 Monate = €89.94 total)
   - **Standard**: €11.99/Monat (9 Monate = €107.91 total)
   - **Relaxed**: €10.99/Monat (12 Monate = €131.88 total)
4. Dir die Price IDs ausgeben

### 4. Price IDs in Convex eintragen

Kopiere die Ausgabe des Scripts und füge sie in Convex ein:

**Convex Dashboard**: https://dashboard.convex.dev  
**Deployment**: `reminiscent-panda-57` (Dev)  
**Settings → Environment Variables**

```env
PADDLE_PRODUCT_INTENSIVE_MONTHLY=pri_test_...
PADDLE_PRODUCT_BALANCED_MONTHLY=pri_test_...
PADDLE_PRODUCT_STANDARD_MONTHLY=pri_test_...
PADDLE_PRODUCT_RELAXED_MONTHLY=pri_test_...
```

### 5. Dev-Server neustarten

```bash
# Terminal 1
npx convex dev

# Terminal 2
pnpm dev
```

### 6. Testen

1. App öffnen: http://localhost:5173
2. Zur Pricing-Sektion scrollen
3. **Pay monthly** auswählen
4. Einen Plan wählen → Paddle Checkout sollte mit dem monatlichen Preis öffnen

## Troubleshooting

### "jq: command not found"
- Windows: `choco install jq`
- Oder ersetze die jq-Zeilen im Script durch manuelle JSON-Parsing

### "401 Unauthorized"
- API Key prüfen (Sandbox vs. Live)
- Key-Berechtigung prüfen (muss "Read + Write" haben)

### "Product not found"
- Prüfe, ob die Product IDs korrekt sind (Format: `pro_...`)
- Prüfe, ob die Produkte im Sandbox-Modus aktiv sind

### Webhook funktioniert nicht
Stelle sicher, dass im Paddle Dashboard eine Notification konfiguriert ist:
- **URL**: `https://reminiscent-panda-57.convex.site/paddle/webhook`
- **Events**: `transaction.completed`, `transaction.payment_failed`

## Nächste Schritte

Nach erfolgreichem Setup:
1. Erste Test-Zahlung durchführen (Paddle Sandbox Test Cards)
2. Convex Logs prüfen → Webhook sollte ankommen
3. `userSubscriptions` Tabelle prüfen → `paymentMode: "installments"`

## Wenn du die Preise löschen/neu erstellen willst

Paddle Dashboard → Catalog → Prices → Archive (für jeden monatlichen Price)
Dann das Script erneut ausführen.
