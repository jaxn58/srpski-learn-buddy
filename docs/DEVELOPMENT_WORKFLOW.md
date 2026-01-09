# Development Workflow - Dev vs. Production

## Übersicht

Wir arbeiten mit **zwei getrennten Umgebungen**:
- **Development (Dev)** - Lokale Entwicklung und Testing
- **Production (Prod)** - Live-System für echte User

---

## Convex Deployments

### Development Deployment
- **Name:** `reminiscent-panda-57`
- **URL:** (in `.env.local` konfiguriert)
- **Zweck:** Lokale Entwicklung, Testing, Experimente
- **Datenbank:** Separate Dev-Datenbank (unabhängig von Production)

### Production Deployment
- **Name:** `fleet-labrador-324`
- **URL:** `https://fleet-labrador-324.convex.cloud`
- **Zweck:** Live-System für echte User
- **Datenbank:** Production-Datenbank mit echten User-Daten

---

## Clerk Environments

### Development
- **API Keys:** Development keys in `.env.local`
- **User Database:** Separate dev users
- **Domain:** `localhost:5173`

### Production
- **API Keys:** Production keys in Vercel Environment Variables
- **User Database:** Echte Production-User
- **Domain:** `https://learn-with.me`
- **Custom Domain:** `clerk.learn-with.me`, `accounts.learn-with.me`

---

## Workflow: Feature-Entwicklung

### 1. Lokale Entwicklung

```bash
# Terminal 1: Convex Dev Server starten
npx convex dev

# Terminal 2: Vite Dev Server starten
pnpm dev

# Terminal 3: (Optional) Backend Server
pnpm dev:server
```

**Wichtig:**
- Arbeitet gegen **Dev Convex Deployment**
- Arbeitet gegen **Dev Clerk Environment**
- Änderungen werden NICHT in Production übernommen

### 2. Testing auf Dev

- Teste Features lokal: `http://localhost:5173`
- Erstelle Test-User in Dev-Environment
- Prüfe Console auf Errors
- Teste alle Flows end-to-end

### 3. Code Review & Commit

```bash
# Stage Änderungen
git add .

# Commit mit aussagekräftiger Message
git commit -m "feat: beschreibung der Änderung"

# Push zum Remote Branch
git push origin beta/production
```

### 4. Deployment nach Production

#### 4a. Convex Functions deployen

```bash
# Deploy Convex Functions nach Production
npx convex deploy -y
```

**Was passiert:**
- Convex Functions werden auf `fleet-labrador-324` deployed
- Schema-Änderungen werden angewendet
- Indexes werden aktualisiert

#### 4b. Frontend deployen

```bash
# Deploy Frontend nach Vercel Production
vercel --prod
```

**Was passiert:**
- Vite Build wird erstellt
- Frontend wird auf Vercel deployed
- Production URL wird aktualisiert: `https://learn-with.me`

---

## Wichtige Regeln

### ✅ DO's

1. **Immer erst lokal entwickeln** gegen Dev-Environment
2. **Testen auf Dev** bevor du nach Production deployest
3. **Commit-Messages** sollten klar sein (conventional commits)
4. **Breaking Changes** vorher dokumentieren
5. **Database Migrations** erst auf Dev testen

### ❌ DON'Ts

1. **NIEMALS direkt auf Production entwickeln**
2. **NIEMALS Production-Datenbank für Tests verwenden**
3. **NIEMALS Production-API-Keys lokal verwenden**
4. **NIEMALS ungetestete Änderungen deployen**
5. **NIEMALS Schema-Änderungen ohne Backup**

---

## Environment Variables

### Lokal (.env.local) - DEV

```bash
# Convex Dev Deployment
CONVEX_DEPLOYMENT=reminiscent-panda-57
VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud

# Clerk Development
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Google Cloud TTS (Dev)
VITE_TTS_API_ENDPOINT=http://localhost:3000/api/audio/generate
```

### Production (Vercel) - PROD

```bash
# Convex Production Deployment
VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud

# Clerk Production
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Google Cloud TTS (Production)
VITE_TTS_API_ENDPOINT=/api/audio/generate
GOOGLE_CLOUD_TTS_API_KEY=...
```

---

## Troubleshooting

### Problem: Lokale Änderungen erscheinen nicht

**Lösung:**
1. Prüfe, ob `npx convex dev` läuft
2. Prüfe, ob du gegen das richtige Deployment arbeitest
3. Hard Refresh im Browser (Ctrl+Shift+R)

### Problem: Production-User erscheinen lokal

**Lösung:**
1. Prüfe `.env.local` - sollte auf Dev-Deployment zeigen
2. Lösche Browser-Cache
3. Prüfe Clerk Environment

### Problem: Schema-Fehler beim Deployment

**Lösung:**
1. Teste Schema-Änderungen erst auf Dev
2. Backup der Production-Datenbank erstellen
3. `npx convex deploy -y --dry-run` für Preview

---

## Checkliste: Vor Production Deployment

- [ ] Feature funktioniert auf Dev
- [ ] Keine Console Errors
- [ ] Tests durchgeführt
- [ ] Code committed und gepusht
- [ ] Breaking Changes dokumentiert
- [ ] Convex Functions getestet
- [ ] Backup erstellt (bei Schema-Änderungen)

---

## Notfall-Rollback

### Convex Functions zurücksetzen

```bash
# In Convex Dashboard:
# 1. Gehe zu https://dashboard.convex.dev
# 2. Wähle Production Deployment
# 3. History → Wähle vorherigen Deploy
# 4. "Rollback" klicken
```

### Frontend zurücksetzen

```bash
# In Vercel Dashboard:
# 1. Gehe zu https://vercel.com
# 2. Wähle Projekt: srpski-tutor-en
# 3. Deployments → Wähle vorherigen Deploy
# 4. "Redeploy" klicken
```

---

## Nützliche Commands

```bash
# Convex Dev Server starten
npx convex dev

# Convex Functions nach Production deployen
npx convex deploy -y

# Frontend Dev Server
pnpm dev

# Frontend Production Build lokal testen
pnpm build && pnpm preview

# Frontend nach Production deployen
vercel --prod

# Backend Server (für TTS etc.)
pnpm dev:server

# Tests ausführen
pnpm test

# TypeScript Typ-Check
pnpm check
```

---

## Deployment-Reihenfolge

**Wichtig:** Richtige Reihenfolge einhalten!

1. **Convex Functions** deployen (Backend zuerst)
   ```bash
   npx convex deploy -y
   ```

2. **Frontend** deployen (Frontend danach)
   ```bash
   vercel --prod
   ```

**Warum?** Frontend benötigt die aktuellen Convex Functions. Wenn du Frontend zuerst deployest, könnte es auf alte Functions zugreifen.

---

## Aktueller Status (2026-01-09)

### Branch: `beta/production`
- Production-ready Code
- Clerk Production Auth aktiv
- Maximale Security CSP
- Cloudflare Turnstile CAPTCHA

### Convex:
- **Dev:** `reminiscent-panda-57`
- **Prod:** `fleet-labrador-324`
- **Latest Deploy:** Security-Fix für duplicate email

### Vercel:
- **Production URL:** https://learn-with.me
- **Latest Deploy:** Clean logs + CSP fixes
- **Build Time:** ~45 Sekunden

---

## Support

Bei Fragen oder Problemen:
1. Prüfe diese Dokumentation
2. Prüfe `docs/` Ordner für spezifische Guides
3. Kontakt: jack@jacksenn.me

---

**Letzte Aktualisierung:** 2026-01-09
**Version:** 1.1.0
**Branch:** `beta/production`
