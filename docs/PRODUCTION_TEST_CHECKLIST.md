# Production Test Checklist - Clerk Migration

**Datum:** 8. Januar 2026  
**Status:** Testing nach DNS-Verifizierung

---

## Test-Protokoll

### ✅ Schritt 1: DNS-Verifizierung
- [x] Frontend API: `clerk.learn-with.me` → verifiziert
- [x] Account Portal: `accounts.learn-with.me` → verifiziert
- [x] Email (clkmail): `clkmail.learn-with.me` → verifiziert
- [x] DKIM 1: `clk._domainkey.learn-with.me` → verifiziert
- [x] DKIM 2: `clk2._domainkey.learn-with.me` → verifiziert

### ⏳ Schritt 2: SSL-Zertifikate prüfen

**Aktion:** Öffne https://clerk.com/dashboard
1. Gehe zu **Configure** → **Domains**
2. Prüfe "SSL certificates" Status

**Erwartung:** Alle Zertifikate sollten "Active" sein (kann bis zu 30 Min nach DNS-Verifizierung dauern)

**Ergebnis:**
- [ ] SSL-Zertifikate aktiv
- [ ] Warte noch... (Zeit seit DNS-Verifizierung: ___ Min)

---

### ⏳ Schritt 3: Production App im Browser testen

**URL:** https://learn-with.me

**Browser-Setup:**
1. Öffne **Inkognito/Private Mode**
2. Drücke **F12** für DevTools
3. Wechsle zum **Console** Tab

**Test 3.1: App lädt ohne Fehler**

**Keine Clerk-Fehler!** (früher: "Failed to load Clerk")

**Ergebnis:**
- [ ] App lädt erfolgreich
- [ ] Keine JavaScript-Fehler
- [ ] Fehler gefunden: _______________

---

### ⏳ Schritt 4: Test-User Registrierung

**Test 4.1: Registrierungsformular**

1. Klicke auf "Sign Up" / "Get Started"
2. Verwende: `test-prod-{timestamp}@example.com`
3. Setze Passwort: `TestProd2026!`

**Erwartung:**
- [ ] Registrierungsformular lädt
- [ ] Keine Console-Fehler
- [ ] Formular-Submit funktioniert
- [ ] User wird eingeloggt
- [ ] Redirect zur App (`/dashboard` oder `/units`)

**Ergebnis:**
- [ ] ✅ Erfolgreich registriert
- [ ] ❌ Fehler: _______________

---

### ⏳ Schritt 5: Clerk Dashboard Verifizierung

**Aktion:** Öffne https://clerk.com/dashboard

1. Stelle sicher, dass du im **Production** Environment bist (oben rechts)
2. Gehe zu **Users**
3. Suche nach deinem Test-User

**Erwartung:**
- [ ] Test-User erscheint in der Liste
- [ ] Status: "Active"
- [ ] Email verifiziert (oder pending)

**Ergebnis:**
- [ ] ✅ User gefunden
- [ ] ❌ User nicht gefunden

---

### ⏳ Schritt 6: Convex-Integration prüfen

**Aktion:** In der eingeloggten App

1. Navigiere zu **Dashboard**
2. Prüfe, ob Units angezeigt werden
3. Klicke auf eine Unit
4. Prüfe, ob Unit-Details laden

**DevTools Console prüfen:**
- [ ] Keine "Unauthorized" Errors
- [ ] Keine "401" oder "403" Errors
- [ ] Convex Queries funktionieren

**Ergebnis:**
- [ ] ✅ Convex-Daten laden erfolgreich
- [ ] ❌ Fehler: _______________

---

### ⏳ Schritt 7: Production Keys Verifizierung

**Aktion:** DevTools Console

Führe aus:
```javascript
console.log('Clerk Key:', window.Clerk?.publishableKey);
```

**Erwartung:**
- Key sollte beginnen mit: `pk_live_`
- **NICHT** `pk_test_`

**Ergebnis:**
- [ ] ✅ Zeigt `pk_live_...`
- [ ] ❌ Zeigt noch `pk_test_...` (Rollback nötig!)

---

## Troubleshooting

### Problem: SSL-Zertifikate nicht aktiv

**Symptom:** Clerk Dashboard zeigt "Pending" bei SSL

**Lösung:**
- Warte bis zu 30 Minuten
- Prüfe DNS nochmal: `nslookup clerk.learn-with.me`
- Falls nach 45 Min noch pending: Clerk Support kontaktieren

---

### Problem: CORS-Fehler beim Login

**Symptom:** Console zeigt CORS error

**Lösung:**
1. Clerk Dashboard → **Configure** → **Paths**
2. Setze "Home URL": `https://learn-with.me`
3. Setze "Sign in URL": `https://learn-with.me/sign-in`
4. Setze "Sign up URL": `https://learn-with.me/sign-up`

---

### Problem: "Unauthorized" in Convex Queries

**Symptom:** Console zeigt Convex 401/403 Errors

**Ursache:** JWT Issuer Domain stimmt nicht

**Lösung:**
1. Prüfe Convex Environment Variables:
   ```bash
   npx convex env list
   ```
2. Sollte zeigen:
   ```
   CLERK_JWT_ISSUER_DOMAIN = https://clerk.learn-with.me
   ```
3. Falls falsch:
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://clerk.learn-with.me
   ```

---

### Problem: User kann sich nicht registrieren

**Symptom:** "Network error" oder "Failed to fetch"

**Mögliche Ursachen:**
1. Vercel Environment Variables fehlen
2. CLERK_SECRET_KEY nicht gesetzt
3. Clerk Production Keys falsch

**Lösung:**
1. Prüfe Vercel Dashboard → Environment Variables
2. Prüfe Vercel Deployment Logs
3. Teste mit einem neuen Deployment

---

## Rollback-Plan

Falls kritische Probleme auftreten:

```bash
# 1. In Vercel: Environment Variables auf Development Keys zurücksetzen
# 2. Neues Deployment triggern:
git commit --allow-empty -m "rollback: revert to Clerk Development"
git push origin main
```

---

## Erfolg Kriterien

Alle Tests müssen bestehen:
- [x] DNS-Records verifiziert
- [ ] SSL-Zertifikate aktiv
- [ ] App lädt ohne Fehler
- [ ] User-Registrierung funktioniert
- [ ] User erscheint in Clerk Dashboard
- [ ] Convex-Integration funktioniert
- [ ] Production Keys aktiv (`pk_live_`)

---

**Test durchgeführt von:** _______________  
**Test-Ergebnis:** ⏳ In Progress

