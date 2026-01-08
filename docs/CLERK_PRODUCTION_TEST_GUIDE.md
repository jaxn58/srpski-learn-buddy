# Clerk Production Test Guide

## Status der Migration

✅ **Abgeschlossen:**
- Clerk Production Keys abgerufen und in Vercel gesetzt
- DNS Records bei Hetzner eingerichtet (5 CNAME Records)
- Production Deployment erfolgreich
- Lokale Entwicklung verifiziert (nutzt Development Keys)

⏳ **Wartet auf:**
- SSL-Zertifikate von Clerk (kann 15-30 Minuten nach DNS-Verifizierung dauern)

## DNS Records (bei Hetzner eingerichtet)

✅ `clerk.learn-with.me` → `frontend-api.clerk.services.`
✅ `accounts.learn-with.me` → `accounts.clerk.services.`
✅ `clkmail.learn-with.me` → `mail.vw6c0sx48ih2.clerk.services.`
✅ `clk_domainkey.learn-with.me` → `dkim1.vw6c0sx48ih2.clerk.services.`
✅ `clk2._domainkey.learn-with.me` → `dkim2.vw6c0sx48ih2.clerk.services.`

## Test-Anleitung (30 Min nach DNS-Verifizierung)

### Schritt 1: SSL-Zertifikate prüfen

1. Öffne Clerk Dashboard: https://clerk.com/dashboard
2. Gehe zu **Configure** → **Domains**
3. Prüfe ob alle 5 DNS Records als "Verified" (grün) angezeigt werden
4. Prüfe unter "SSL certificates" ob die Zertifikate ausgestellt wurden

**Erwartung:** Alle Records grün, SSL-Zertifikate aktiv

### Schritt 2: Production App testen

1. Öffne https://learn-with.me im **Inkognito-Modus**
2. Öffne Browser DevTools (F12) → Console Tab
3. Prüfe auf JavaScript-Fehler

**Erwartete Ausgabe (keine Fehler):**
```
[WebAuthn Polyfill] Successfully patched Credentials API
```

**Keine Clerk-Fehler mehr!** (vorher: "Failed to load Clerk")

### Schritt 3: Registrierung testen

1. Klicke auf "Sign Up" oder "Register"
2. Erstelle einen Test-Account: `test+production@example.com`
3. Schließe die Registrierung ab

**Validierung:**
- ✅ Registrierungsformular lädt
- ✅ Keine Fehler beim Absenden
- ✅ User wird eingeloggt
- ✅ Redirect zur App funktioniert

### Schritt 4: Clerk Dashboard Verifizierung

1. Gehe zu Clerk Dashboard (Production!) → **Users**
2. Dein Test-User sollte dort erscheinen

**Validierung:**
- ✅ Test-User ist in der Liste
- ✅ User hat Status "Active"

### Schritt 5: Convex-Integration prüfen

1. Nach erfolgreichem Login → Navigiere zu einer Unit
2. Prüfe, ob Daten geladen werden (Units, Progress, Vocabulary)

**Validierung:**
- ✅ Units werden angezeigt
- ✅ User-Profil zeigt Daten
- ✅ Keine "Unauthorized" Fehler in Console

### Schritt 6: Browser-Konsole Final Check

Öffne DevTools → Console und prüfe auf Production Keys (pk_live_ statt pk_test_)

## Troubleshooting

### Problem: Clerk lädt nicht / SSL-Fehler

**Lösung:**
- Warte weitere 15 Minuten
- Prüfe Clerk Dashboard → Domains → SSL certificates Status
- Falls nach 45 Minuten immer noch nicht fertig: Clerk Support kontaktieren

### Problem: CORS-Fehler

**Lösung:**
1. Gehe zu Clerk Dashboard → **Configure** → **Paths**
2. Setze Home URL: `https://learn-with.me`
3. Warte 2 Minuten und teste erneut

### Problem: "Unauthorized" in Convex Queries

**Ursache:** JWT Issuer Domain stimmt nicht überein

**Lösung:**
1. Prüfe Vercel Environment Variables:
   ```bash
   vercel env pull .env.check --environment production
   type .env.check | findstr CLERK_JWT_ISSUER_DOMAIN
   ```
2. Sollte zeigen: `CLERK_JWT_ISSUER_DOMAIN=https://clerk.learn-with.me`
3. Falls falsch: Korrigiere in Vercel Dashboard und triggere neues Deployment

### Problem: User kann sich nicht registrieren

**Fehler in Console:** "Network error"

**Lösung:**
- Prüfe ob alle Clerk Environment Variables in Vercel gesetzt sind
- Prüfe Vercel Server Logs auf Errors

## Rollback-Plan (falls kritische Probleme)

Falls schwerwiegende Probleme auftreten:

1. Gehe zu Vercel Dashboard → Settings → Environment Variables
2. Ersetze die Production Keys durch die Development Keys aus `.env.local`
3. Triggere neues Deployment:
   ```bash
   git commit --allow-empty -m "rollback: revert to Clerk Development"
   git push origin beta/first-deploy
   ```

## Environment Variables

**In Vercel Production gesetzt:**
- `VITE_CLERK_PUBLISHABLE_KEY` = Clerk Production Publishable Key
- `CLERK_SECRET_KEY` = Clerk Production Secret Key
- `CLERK_JWT_ISSUER_DOMAIN` = https://clerk.learn-with.me

**Lokale Entwicklung** (`.env.local` bleibt unverändert):
- Nutzt weiterhin Development Keys
- Keine Änderungen nötig

## Wichtige Hinweise

1. **Getrennte User-Datenbanken:** User aus Development existieren NICHT in Production.

2. **Lokale Entwicklung:** Nutzt weiterhin Development Keys - das ist korrekt!

3. **E-Mail Records:** Die DKIM-Records sind optional für E-Mail-Authentifizierung.

## Nächste Schritte nach erfolgreichem Test

1. Beta-Tester können sich registrieren
2. Monitoring einrichten (Clerk Analytics)
3. Beta-Dokumentation erstellen

## Support

Bei Problemen:
1. Prüfe diese Anleitung → Troubleshooting
2. Prüfe Vercel Build-Logs
3. Prüfe Browser-Konsole
4. Kontaktiere Clerk Support: https://clerk.com/support

---

**Migration durchgeführt am:** 8. Januar 2026
**Status:** Warte auf SSL-Zertifikate (~30 Min nach DNS-Verifizierung)
