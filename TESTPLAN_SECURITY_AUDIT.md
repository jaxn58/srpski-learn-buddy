# Testplan: Security & Optimization Audit

Dieses Dokument beschreibt alle notwendigen Schritte, um die Aenderungen aus dem
Security & Optimization Audit vor dem Production-Deployment zu verifizieren.

---

## Phase 0: Environment-Variablen konfigurieren

Die folgenden **neuen** Variablen muessen gesetzt werden, bevor irgendein Test
sinnvoll ist. Ohne sie werden bestimmte Funktionen zwangslaeufig fehlschlagen.

### 0.1 Lokale Entwicklung (.env.local)

Oeffne `.env.local` und stelle sicher, dass diese Eintraege existieren:

```
# Bereits vorhanden (pruefen, ob gesetzt):
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud

# NEU - Convex Admin-Key fuer TTS-Upload (internalMutation)
# Abrufbar unter: https://dashboard.convex.dev -> Settings -> Deploy Key
# Nimm den Key fuer das DEV-Deployment (reminiscent-panda-57)
CONVEX_DEPLOY_KEY=<dev-deploy-key>
```

`TTS_API_SECRET` ist optional (Fallback fuer Scripts ohne Clerk-Token).
Wenn du es nicht brauchst, kann es weggelassen werden.

- [ ] `.env.local` enthaelt `CONVEX_DEPLOY_KEY`
- [ ] `.env.local` enthaelt `CLERK_SECRET_KEY`
- [ ] `.env.local` enthaelt `VITE_CLERK_PUBLISHABLE_KEY`

### 0.2 Convex Dashboard (Dev-Deployment: reminiscent-panda-57)

Oeffne https://dashboard.convex.dev -> Deployment "reminiscent-panda-57" -> Settings -> Environment Variables.

| Variable              | Wert                                    | Zweck                                   |
|-----------------------|-----------------------------------------|-----------------------------------------|
| `RESEND_WEBHOOK_SECRET` | Svix Signing Secret aus Resend Dashboard | Webhook-Signatur-Verifikation           |
| `OWNER_EMAIL`           | `hello@jacksenn.me`                     | Auto-Superadmin bei Login (ersetzt hardcoded Email) |

**RESEND_WEBHOOK_SECRET finden:**
1. Oeffne https://resend.com/webhooks
2. Klicke auf den bestehenden Webhook (oder erstelle einen neuen)
3. Kopiere den "Signing Secret" (beginnt mit `whsec_`)

- [ ] `RESEND_WEBHOOK_SECRET` im Convex Dashboard gesetzt
- [ ] `OWNER_EMAIL` im Convex Dashboard gesetzt

### 0.3 Vercel Dashboard (Production-Vorbereitung)

Diese Variablen muessen **vor dem Production-Deployment** in Vercel gesetzt werden.
Noch nicht noetig fuer lokale Tests, aber jetzt schon notieren:

| Variable              | Wert                                    | Scope      |
|-----------------------|-----------------------------------------|------------|
| `CONVEX_DEPLOY_KEY`    | Deploy-Key fuer Production (fleet-labrador-324) | Production |
| `CLERK_SECRET_KEY`     | Production Clerk Secret Key             | Production |

- [ ] Fuer Production-Deployment: Vercel Env-Vars vorbereitet

---

## Phase 1: Dev-Server neustarten

Nach den Env-Aenderungen muessen beide Server neu gestartet werden.

```bash
# Terminal 1: Convex Dev Server (falls nicht laeuft)
npx convex dev

# Terminal 2: Frontend + Express Dev Server
pnpm dev:server
```

**Pruefen:**
- [ ] Express-Server startet ohne Fehler (keine "Publishable key missing" Meldungen)
- [ ] Convex-Dev zeigt keine Errors
- [ ] Browser: `http://localhost:5173` laed die App

---

## Phase 2: i18n Lazy Loading

Die gesamte Uebersetzungsdatei (3000 Zeilen) wurde von Inline-JS in separate
JSON-Dateien umgebaut (`client/public/locales/en/translation.json` und `.../de/...`).

### Test 2.1: Englisch laden
1. Oeffne `http://localhost:5173` (oder Hard-Refresh mit Ctrl+Shift+R)
2. Die App sollte normal auf Englisch laden
3. Alle Texte sollten sichtbar sein (keine leeren Stellen oder `app.title` Keys)

- [ ] App laed auf Englisch, alle Texte korrekt

### Test 2.2: Sprachwechsel
1. Gehe zu Settings/Profile oder nutze den Sprachwechsel-Button
2. Wechsle auf Deutsch
3. Alle Texte sollten auf Deutsch erscheinen
4. Wechsle zurueck auf Englisch

- [ ] Sprachwechsel EN -> DE funktioniert
- [ ] Sprachwechsel DE -> EN funktioniert

### Test 2.3: Seitenaufruf mit Deutsch
1. Setze Sprache auf Deutsch
2. Lade die Seite komplett neu (F5)
3. App sollte direkt auf Deutsch laden

- [ ] App laed nach Refresh in gespeicherter Sprache

---

## Phase 3: Authentifizierung & Login

### Test 3.1: Login-Flow
1. Falls eingeloggt: Ausloggen
2. Gehe zur Landing Page
3. Klicke "Login" / "Sign In"
4. Logge dich ein (bestehender Test-Account)
5. Du solltest zum Dashboard weitergeleitet werden

- [ ] Login funktioniert normal

### Test 3.2: Superadmin-Auto-Promotion
1. Logge dich mit dem Account ein, dessen Email in `OWNER_EMAIL` steht
2. Pruefe im Admin-Panel: Rolle sollte "superadmin" sein

- [ ] Owner-Account ist automatisch Superadmin

---

## Phase 4: Audio-Generierung (TTS) -- KRITISCH

Dies ist der Bereich mit den meisten Aenderungen. Der TTS-Endpoint erfordert
jetzt Authentifizierung, und die Upload-URL ist eine internalMutation.

### Test 4.1: Vocabulary Audio
1. Gehe zu "Vocabulary" (Vokabeln)
2. Waehle ein Wort, das noch KEIN Audio hat (kein Lautsprecher-Icon/Cache)
3. Klicke auf den Audio-Button / Lautsprecher
4. **Erwartung:** Audio wird generiert und abgespielt
5. **Bei Fehler:** Browser-Console oeffnen (F12) -- schau nach 401/403/500 Errors

- [ ] Vocabulary Audio-Generierung funktioniert
- [ ] Kein 401 "Unauthorized" in der Console

### Test 4.2: Unit Content Audio
1. Gehe in eine Unit (z.B. Unit 1)
2. Navigiere zu "Phrases" oder "Dialogues"
3. Klicke auf einen Audio-Button bei einem serbischen Satz
4. **Erwartung:** Audio wird generiert und abgespielt

- [ ] Unit Content Audio funktioniert

### Test 4.3: Express-Server Logs pruefen
1. Schau in das Terminal, wo `pnpm dev:server` laeuft
2. Bei Audio-Requests sollten KEINE Errors erscheinen
3. Insbesondere kein "Publishable key missing"

- [ ] Keine Server-Errors bei Audio-Requests

**Falls Audio nicht funktioniert -- Debugging:**
1. Browser Console (F12 -> Network Tab): Ist der Request an `/api/audio/generate` ein 401?
   -> Clerk-Token wird nicht gesendet oder Middleware erkennt ihn nicht
   -> Pruefe: Ist `CLERK_SECRET_KEY` in `.env.local` gesetzt?
2. Ist der Request ein 500 mit "Failed to generate upload URL"?
   -> `CONVEX_DEPLOY_KEY` fehlt oder ist falsch
   -> Pruefe: Ist der Key fuer das richtige Deployment (Dev)?
3. Server-Log zeigt "Clerk keys not found"?
   -> `VITE_CLERK_PUBLISHABLE_KEY` fehlt in `.env.local`

---

## Phase 5: Admin-Bereich

### Test 5.1: User-Liste
1. Gehe zum Admin-Panel
2. Die User-Liste sollte laden (mit Progress und Subscription-Info)
3. Vergleiche: Sieht die Darstellung gleich aus wie vorher?

- [ ] Admin User-Liste laed korrekt

### Test 5.2: Progress-Uebersicht
1. Im Admin-Panel: Wechsle zum Progress-Tab
2. Alle User-Progress-Eintraege sollten mit Namen/Email angezeigt werden

- [ ] Admin Progress-Uebersicht funktioniert

### Test 5.3: Content Studio
1. Oeffne das Content Studio
2. Wechsle zum "Import"-Tab
3. Der Tab sollte laden (wird jetzt lazy geladen)

- [ ] Content Studio Import-Tab laed

---

## Phase 6: Progress-Seite

### Test 6.1: Dashboard Stats
1. Gehe zum Dashboard
2. XP, Streak, Level sollten korrekt angezeigt werden

- [ ] Dashboard Stats laden korrekt

### Test 6.2: Progress-Seite
1. Gehe zu "Progress"
2. Charts (Wochenaktivitaet, Radial-Chart) sollten laden
3. Alle Statistiken sollten korrekt sein

- [ ] Progress-Seite rendert komplett
- [ ] Charts zeigen Daten an

### Test 6.3: Leaderboard
1. Gehe zu "Leaderboard"
2. Sollte normal laden

- [ ] Leaderboard laed

---

## Phase 7: Convex Dashboard -- Logs pruefen

1. Oeffne https://dashboard.convex.dev -> Deployment -> Logs
2. Fuehre einige der obigen Tests durch
3. Pruefe auf rote Fehler-Eintraege

Typische Fehler die auftreten koennten:
- `"Could not find public function for 'vocabulary:generateUploadUrl'"` 
  -> Die Funktion ist jetzt `internalMutation`. Convex Functions muessen
     redeployed werden (`npx convex dev` muss laufen).
- `"Could not find public function for 'newsletter:updateEmailLogFromWebhook'"`
  -> Gleicher Grund. Convex Dev muss laufen.

- [ ] Keine unerwarteten Errors in Convex Logs

---

## Phase 8: Schnelltest der gesicherten Endpoints

Diese Tests verifizieren, dass die Sicherheitsluecken tatsaechlich geschlossen sind.

### Test 8.1: generateUploadUrl ist intern
1. Oeffne Browser Console (F12)
2. Fuehre aus:
```js
fetch(import.meta.env.VITE_CONVEX_URL + "/api/mutation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "vocabulary:generateUploadUrl", args: {} })
}).then(r => r.json()).then(console.log)
```
3. **Erwartung:** Fehler-Response (Funktion nicht gefunden / nicht oeffentlich)

- [ ] generateUploadUrl ist nicht oeffentlich aufrufbar

### Test 8.2: makeSuperadmin ist intern
1. In Browser Console:
```js
fetch(import.meta.env.VITE_CONVEX_URL + "/api/mutation", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "users:makeSuperadmin", args: { email: "test@test.com" } })
}).then(r => r.json()).then(console.log)
```
3. **Erwartung:** Fehler-Response

- [ ] makeSuperadmin ist nicht oeffentlich aufrufbar

---

## Phase 9: Ergebnis-Zusammenfassung

| Bereich                    | Status |
|----------------------------|--------|
| i18n Lazy Loading          |        |
| Login / Auth               |        |
| TTS Audio (Vocabulary)     |        |
| TTS Audio (Unit Content)   |        |
| Admin User-Liste           |        |
| Admin Progress             |        |
| Content Studio Import      |        |
| Dashboard Stats            |        |
| Progress Charts            |        |
| Leaderboard                |        |
| Security: Endpoints intern |        |
| Convex Logs sauber         |        |

**Alle Tests bestanden?**
- Ja -> Bereit fuer Production-Deployment
- Nein -> Fehlgeschlagene Tests dokumentieren und beheben

---

## Checkliste vor Production-Deployment

- [ ] Alle Tests in Phase 1-8 bestanden
- [ ] `CONVEX_DEPLOY_KEY` (Production) in Vercel gesetzt
- [ ] `RESEND_WEBHOOK_SECRET` im Production Convex Dashboard gesetzt
- [ ] `OWNER_EMAIL` im Production Convex Dashboard gesetzt
- [ ] `@clerk/backend` als direkte Dependency hinzugefuegt (`pnpm add @clerk/backend`)
- [ ] `.env.example` mit neuen Variablen aktualisiert
