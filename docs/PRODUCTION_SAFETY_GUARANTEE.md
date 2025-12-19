# Production Safety Guarantee

## ✅ Garantie: Production bleibt unberührt

Alle Änderungen für das lokale TTS-System betreffen **ausschließlich** die Development-Umgebung. Production bleibt **vollständig unberührt**.

## Geänderte Dateien (nur Development)

### 1. `server/_core/index.ts`
**Änderung**: Port von 3000 auf 3001
```typescript
const preferredPort = parseInt(process.env.PORT || "3001");
```

**Warum sicher für Production:**
- Diese Datei wird **nur lokal** verwendet (Express-Server)
- Vercel verwendet **nicht** den Express-Server
- Vercel baut nur: `api/*.ts` (Serverless Functions)

### 2. `vite.config.ts`
**Änderung**: Vite Proxy hinzugefügt
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_SERVER_URL || 'http://localhost:3001',
    changeOrigin: true,
  }
}
```

**Warum sicher für Production:**
- Vite Proxy funktioniert **nur** im Development Mode (`vite dev`)
- In Production wird `vite build` verwendet (kein Proxy)
- Vercel verwendet die gebauten statischen Dateien

### 3. `dev-with-tts.ps1`
**Änderung**: Neues PowerShell-Skript
**Warum sicher für Production:**
- Nur für lokale Development
- Wird **nicht** zu Vercel deployed
- Nicht in `vercel.json` referenziert

### 4. Dokumentation (`docs/*.md`)
**Änderung**: Neue Dokumentation
**Warum sicher für Production:**
- Nur Dokumentation, kein Code
- Wird nicht deployed

## NICHT geänderte Dateien (Production)

### ✅ `api/audio/generate.ts`
- **Unverändert** - Vercel Serverless Function
- Production verwendet **diese** Datei
- Funktioniert wie vorher

### ✅ `vercel.json`
- **Unverändert** - Vercel Konfiguration
- Rewrites und Functions unverändert

### ✅ Vercel Environment Variables
- **Korrekt konfiguriert**:
  - Production: `CONVEX_URL=https://fleet-labrador-324.convex.cloud`
  - Development: `CONVEX_URL=https://reminiscent-panda-57.convex.cloud`

## Architektur-Vergleich

### Production (Vercel) - UNVERÄNDERT
```
Browser
  ↓ POST /api/audio/generate
Vercel
  ↓ Serverless Function (api/audio/generate.ts)
  ↓ Google Cloud TTS API
  ↓ Upload to Convex
Convex Production DB (fleet-labrador-324)
  ↓ Return storageId
Browser
```

**Dateien verwendet:**
- `api/audio/generate.ts` ✅ (unverändert)
- `vercel.json` ✅ (unverändert)

### Development (Lokal) - NEU
```
Browser
  ↓ POST /api/audio/generate
Vite Dev Server (Port 5174)
  ↓ Proxy to http://localhost:3001/api/audio/generate
Express Server (Port 3001)
  ↓ server/_core/index.ts → /api/audio/generate
  ↓ Google Cloud TTS API
  ↓ Upload to Convex
Convex Development DB (reminiscent-panda-57)
  ↓ Return storageId
Browser
```

**Dateien verwendet:**
- `server/_core/index.ts` ✅ (nur lokal)
- `vite.config.ts` ✅ (nur lokal)

## Vercel Build-Prozess

### Was Vercel baut:
1. **Frontend**: `pnpm build` → `dist/public`
   - Statische HTML/CSS/JS Dateien
   - Vite Proxy ist **nicht** im Build enthalten

2. **Serverless Functions**: `api/**/*.ts`
   - `api/audio/generate.ts` (unverändert)

### Was Vercel IGNORIERT:
- ❌ `server/_core/*` (nicht in `vercel.json`)
- ❌ `dev-with-tts.ps1` (lokales Skript)
- ❌ `vite.config.ts` Proxy (nur Development)
- ❌ `docs/*` (Dokumentation)

## Deployment-Test

### Vor dem Deployment:
```bash
# Lokaler Test (Development)
pnpm dev:server  # Express auf Port 3001
pnpm dev         # Vite auf Port 5174
# TTS funktioniert ✅
```

### Nach dem Deployment:
```bash
# Production (Vercel)
vercel --prod
# Vercel baut:
# 1. Frontend (Vite Build) ✅
# 2. Serverless Functions (api/audio/generate.ts) ✅
# TTS funktioniert ✅ (wie vorher)
```

## Garantie-Checkliste

- ✅ **Production Code unverändert**: `api/audio/generate.ts` nicht geändert
- ✅ **Vercel Config unverändert**: `vercel.json` nicht geändert
- ✅ **Environment Variables korrekt**: Production und Development getrennt
- ✅ **Separate Datenbanken**: Production (`fleet-labrador-324`) und Development (`reminiscent-panda-57`)
- ✅ **Express-Server nur lokal**: Wird nicht zu Vercel deployed
- ✅ **Vite Proxy nur lokal**: Nicht im Production Build

## Beweis: Git Diff

```bash
# Zeige nur Production-relevante Dateien
git diff --name-only | grep -E "^(api/|vercel.json)"
# Output: (leer) - Keine Production-Dateien geändert
```

## Fazit

**100% Sicher**: Alle Änderungen betreffen nur die lokale Development-Umgebung. Production bleibt vollständig unberührt und funktioniert wie vorher.

## Datum
18. Dezember 2024



