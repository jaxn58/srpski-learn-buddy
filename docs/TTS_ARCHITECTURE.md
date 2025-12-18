# Text-to-Speech Architektur

## Übersicht

Das TTS-System verwendet **unterschiedliche Architekturen** für Production und Development, aber die **gleiche Funktionalität**.

## Production (Vercel)

### Architektur
```
Browser
  ↓ POST /api/audio/generate
Vercel Serverless Function (api/audio/generate.ts)
  ↓ Google Cloud TTS API
Audio Buffer
  ↓ Upload to Convex
Convex Production DB (fleet-labrador-324)
  ↓ Return storageId
Browser (gets audio URL from storageId)
```

### Dateien
- `api/audio/generate.ts` - Vercel Serverless Function
- `vercel.json` - Konfiguration für Vercel Rewrites

### Vorteile
- ✅ Automatisches Deployment
- ✅ Skaliert automatisch
- ✅ Keine Server-Wartung

## Development (Lokal)

### Architektur
```
Browser
  ↓ POST /api/audio/generate
Vite Dev Server (Port 5173)
  ↓ Proxy to http://localhost:3001/api/audio/generate
Express Server (Port 3001)
  ↓ server/_core/index.ts → /api/audio/generate
  ↓ server/_core/textToSpeech.ts → generateSerbianAudio()
  ↓ Google Cloud TTS API
Audio Buffer
  ↓ Upload to Convex
Convex Development DB (reminiscent-panda-57)
  ↓ Return storageId
Browser (gets audio URL from storageId)
```

### Dateien
- `vite.config.ts` - Proxy-Konfiguration
- `server/_core/index.ts` - Express Server mit `/api/audio/generate` Endpoint
- `server/_core/textToSpeech.ts` - TTS-Logik (identisch mit Production)

### Vorteile
- ✅ Schnelle Entwicklung (Hot Reload)
- ✅ Einfaches Debugging
- ✅ Keine Cloud-Abhängigkeit für lokale Tests

## Warum unterschiedliche Architekturen?

### Warum nicht Vercel Dev lokal?

**Vercel Dev** (`vercel dev`) simuliert die Vercel-Umgebung lokal, aber:
- ❌ **Langsam**: Startet Serverless Functions bei jedem Request neu
- ❌ **Komplex**: Erfordert Vercel CLI und Konfiguration
- ❌ **Overhead**: Simuliert Cloud-Umgebung (unnötig lokal)

### Warum Express lokal?

- ✅ **Schnell**: Hot Reload, keine Neustarts
- ✅ **Einfach**: Nur `pnpm dev:server` starten
- ✅ **Gleiche Funktionalität**: Verwendet die gleiche `textToSpeech.ts` Logik
- ✅ **Vite Proxy**: Leitet automatisch weiter, kein Frontend-Code-Änderung nötig

## Gemeinsame Komponenten

### Beide Umgebungen verwenden:

1. **Gleiche TTS-Logik**: `server/_core/textToSpeech.ts`
   - Google Cloud TTS API
   - Convex File Storage Upload
   - Identische Fehlerbehandlung

2. **Gleiche Umgebungsvariablen**:
   - `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` (Google TTS Credentials)
   - `CONVEX_URL` / `VITE_CONVEX_URL` (Convex-Datenbank)

3. **Gleiche Response-Struktur**:
   ```typescript
   { success: true, storageId: string }
   ```

## Unterschiede

| Aspekt | Production | Development |
|--------|-----------|-------------|
| **Server** | Vercel Serverless | Express (Port 3001) |
| **Endpoint-Datei** | `api/audio/generate.ts` | `server/_core/index.ts` |
| **Convex DB** | `fleet-labrador-324` | `reminiscent-panda-57` |
| **Deployment** | Automatisch via Vercel | Manuell via `pnpm dev:server` |
| **Skalierung** | Automatisch | Nicht nötig (lokal) |

## Migration zwischen Umgebungen

### Code-Synchronisation

Wenn du die TTS-Logik änderst, musst du **beide Dateien** aktualisieren:

1. `server/_core/textToSpeech.ts` (Development)
2. `api/audio/generate.ts` (Production)

**Wichtig**: Die Logik sollte **identisch** bleiben!

### Deployment

```bash
# Development: Starte Express Server
pnpm dev:server

# Production: Deploy zu Vercel
vercel --prod
```

## Troubleshooting

### Development funktioniert nicht

1. **Express Server läuft nicht**:
   ```bash
   pnpm dev:server
   ```

2. **Vite Proxy nicht konfiguriert**:
   - Prüfe `vite.config.ts` → `server.proxy`

3. **Falsche Convex DB**:
   - Prüfe `.env` → `VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud`

### Production funktioniert nicht

1. **Vercel Environment Variables fehlen**:
   ```bash
   vercel env ls
   ```

2. **Falsche Convex DB**:
   - Prüfe Vercel Dashboard → `CONVEX_URL=https://fleet-labrador-324.convex.cloud`

3. **Serverless Function Timeout**:
   - Prüfe `vercel.json` → `functions.maxDuration`

## Best Practices

1. **Teste lokal vor Deployment**: Stelle sicher, dass TTS lokal funktioniert
2. **Verwende gleiche Credentials**: `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` sollte identisch sein
3. **Separate Datenbanken**: Development und Production sollten **niemals** die gleiche Convex DB verwenden
4. **Code-Synchronisation**: Halte `textToSpeech.ts` und `api/audio/generate.ts` synchron

## Datum
18. Dezember 2024

