# Clerk Production Migration - Quick Start

## TL;DR - Die wichtigsten Schritte

### 1. Clerk Production Keys holen (5 Minuten)

1. Gehe zu [clerk.com/dashboard](https://clerk.com/dashboard)
2. Wähle dein Projekt
3. **Wichtig**: Wechsle zu **Production** Environment (oben rechts)
4. Gehe zu **API Keys**
5. Kopiere:
   - `pk_live_...` (Publishable Key)
   - `sk_live_...` (Secret Key)

### 2. Vercel Environment Variables setzen (2 Minuten)

**Option A: Automatisch mit Script**

```bash
# Windows PowerShell
.\scripts\update-vercel-env-production.ps1

# Linux/Mac
chmod +x scripts/update-vercel-env-production.sh
./scripts/update-vercel-env-production.sh
```

**Option B: Manuell über Vercel Dashboard**

1. Gehe zu [vercel.com/dashboard](https://vercel.com/dashboard)
2. Wähle Projekt: `srpski-tutor-en`
3. **Settings** → **Environment Variables**
4. Bearbeite:
   - `VITE_CLERK_PUBLISHABLE_KEY` → setze `pk_live_...`
   - `CLERK_SECRET_KEY` → setze `sk_live_...`
5. Aktiviere für **Production** Environment

### 3. Clerk Allowed Origins setzen (2 Minuten)

1. Zurück zu [clerk.com/dashboard](https://clerk.com/dashboard) (Production!)
2. **Domains** → **Allowed Origins**
3. Füge hinzu:
   - `https://srpski-tutor-en.vercel.app` (oder deine URL)
   - Optional: `https://*.vercel.app` (für Preview-Deployments)

### 4. Deployment triggern (1 Minute)

```bash
git commit --allow-empty -m "chore: migrate to Clerk Production"
git push origin main
```

### 5. Testen (5 Minuten)

1. Öffne deine Production-URL
2. Registriere einen Test-User
3. Prüfe Browser-Konsole: Sollte `pk_live_` zeigen
4. Prüfe Clerk Dashboard → Users: Test-User sollte erscheinen

---

## Häufige Fehler

### ❌ "Invalid publishable key"

→ Du hast versehentlich den Development-Key (`pk_test_`) verwendet
→ Stelle sicher, dass du im **Production** Environment in Clerk bist

### ❌ CORS-Fehler

→ Vercel-URL ist nicht in Clerk Allowed Origins
→ Füge deine exakte URL in Clerk hinzu (mit `https://`)

### ❌ "User not found" nach Login

→ Du hast einen User im Development Environment erstellt
→ Erstelle einen neuen User (Development und Production haben getrennte Datenbanken)

---

## Wichtig zu wissen

- **Development ≠ Production**: Separate User-Datenbanken!
- **Lokale Entwicklung**: Nutzt weiterhin Development-Keys (`pk_test_`)
- **Migration**: User aus Development müssen sich in Production neu registrieren

---

## Vollständige Dokumentation

Für Details siehe: [CLERK_PRODUCTION_MIGRATION.md](./CLERK_PRODUCTION_MIGRATION.md)

## Support

Bei Problemen:
1. Prüfe [CLERK_PRODUCTION_MIGRATION.md](./CLERK_PRODUCTION_MIGRATION.md) → Troubleshooting
2. Prüfe Vercel Build-Logs
3. Prüfe Browser-Konsole
4. Kontaktiere Clerk Support


