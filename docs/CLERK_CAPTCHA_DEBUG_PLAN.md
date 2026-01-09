# Clerk CAPTCHA Debug Plan - Option 3

**Datum:** 8. Januar 2026  
**Status:** Vorbereitet für morgen  
**Problem:** Cloudflare Turnstile Error 600010 - CSP blockiert CAPTCHA

---

## Bisheriger Fortschritt

### ✅ Erfolgreich abgeschlossen:
1. DNS-Records bei Hetzner verifiziert (alle 5 CNAME-Records)
2. Clerk Production Keys in Vercel gesetzt
3. SSL-Zertifikate aktiv
4. App lädt fehlerfrei auf https://learn-with.me
5. Clerk Authentication Frontend funktioniert

### ❌ Aktuelles Problem:
- Cloudflare Turnstile CAPTCHA lädt nicht korrekt
- Error 600010: CSP blockiert eval() für Turnstile
- User-Registrierung schlägt beim CAPTCHA-Schritt fehl

### 🔄 Versuchte Lösungen:
1. CSP erweitert um `https://*.cloudflare.com`
2. X-Frame-Options Header entfernt
3. Verschiedene CSP-Kombinationen getestet

**Problem:** Trial-and-Error mit CSP ist ineffizient

---

## Plan für morgen: Evidence-Based CSP Debugging

### Phase 1: CSP temporär deaktivieren (15 Min)

**Ziel:** Bestätigen, dass CAPTCHA ohne CSP funktioniert

**Schritte:**
1. In `vercel.json` CSP-Header auskommentieren
2. Deployment triggern
3. Test der Registrierung
4. **Erwartung:** CAPTCHA funktioniert einwandfrei

**Ergebnis dokumentieren:**
- [ ] CAPTCHA lädt
- [ ] CAPTCHA funktioniert
- [ ] User-Registrierung erfolgreich

### Phase 2: Browser DevTools CSP-Analyse (20 Min)

**Ziel:** Exakte CSP-Anforderungen identifizieren

**Mit deaktivierter CSP:**

1. **Chrome DevTools öffnen** (F12)
2. **Network Tab:**
   - Alle Requests während CAPTCHA-Interaktion aufzeichnen
   - Domains notieren, die Turnstile lädt
3. **Console Tab:**
   - Auf Warnings achten
4. **Security Tab:**
   - CSP-Violations ansehen (falls vorhanden)

**Zu dokumentieren:**
- Welche Domains lädt Turnstile?
- Welche Script-Sources werden genutzt?
- Welche Connect-Sources werden gebraucht?
- Werden iframes geladen? Von wo?

### Phase 3: Minimale CSP erstellen (10 Min)

**Ziel:** Nur das Nötigste erlauben

Basierend auf Phase 2 Analyse:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' 
    https://clerk.learn-with.me 
    https://*.clerk.accounts.dev 
    https://*.convex.cloud
    [+ Turnstile domains aus Phase 2]
    https://vercel.live;
  connect-src 'self' 
    https://*.convex.cloud 
    https://*.clerk.accounts.dev 
    https://clerk.learn-with.me 
    [+ Turnstile API domains aus Phase 2]
    wss://*.convex.cloud 
    https://vercel.live;
  frame-src 'self' 
    [+ Turnstile iframe domains aus Phase 2]
    https://js.stripe.com 
    https://checkout.paddle.com 
    https://vercel.live;
  [... rest bleibt gleich]
```

### Phase 4: Finale CSP deployen und testen (15 Min)

1. Neue CSP in `vercel.json` eintragen
2. Deployment triggern
3. Registrierung testen mit CAPTCHA
4. Erfolg bestätigen

---

## Benötigte Tools/Zugriffe

- [x] Vercel CLI installiert
- [x] Git Repository Zugriff
- [x] Clerk Dashboard Zugriff (Production)
- [x] Browser DevTools Kenntnisse

---

## Alternative Lösungen (falls Option 3 nicht funktioniert)

### Fallback 1: Andere CAPTCHA Provider

Im Clerk Dashboard → Attack Protection:
- Wechsel von **Cloudflare Turnstile** zu **hCaptcha**
- hCaptcha hat einfachere CSP-Anforderungen
- Datenschutzfreundlicher als reCAPTCHA

### Fallback 2: Email Verification Only

- Deaktiviere CAPTCHA komplett
- Aktiviere stattdessen **Email Verification**
- User muss Email bestätigen vor Zugriff
- Weniger friction für legitime User
- Immer noch Spam-Schutz durch Email-Verification

### Fallback 3: Honeypot + Rate Limiting

- Clerk bietet auch nicht-visuellen Bot-Schutz
- Honeypot-Felder (unsichtbar für User)
- Rate Limiting auf Registrierungen
- Kein CAPTCHA nötig

---

## Erfolgs-Kriterien

Nach Abschluss sollten folgende Punkte erfüllt sein:

- [ ] User kann sich ohne Fehler registrieren
- [ ] CAPTCHA lädt und funktioniert
- [ ] CSP schützt die App weiterhin
- [ ] Keine Console-Errors
- [ ] Bot Protection aktiv
- [ ] User erscheint in Clerk Dashboard
- [ ] Convex-Integration funktioniert

---

## Zeitplan für morgen

| Zeit | Phase | Dauer |
|------|-------|-------|
| Start | Phase 1: CSP deaktivieren | 15 Min |
| +15 | Phase 2: DevTools Analyse | 20 Min |
| +35 | Phase 3: CSP erstellen | 10 Min |
| +45 | Phase 4: Deployment & Test | 15 Min |
| **Total** | | **~60 Min** |

---

## Notizen

- Aktueller Git Branch: `beta/first-deploy`
- Letzter erfolgreicher Deployment: ad9ff5e (X-Frame-Options entfernt)
- Production URL: https://learn-with.me
- Vercel Project: srpski-tutor-en

---

**Status:** Bereit für morgen  
**Nächster Schritt:** Phase 1 - CSP temporär deaktivieren
