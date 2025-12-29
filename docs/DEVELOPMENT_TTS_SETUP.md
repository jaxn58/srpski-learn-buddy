# Development Setup mit Text-to-Speech

## Problem
Das Text-to-Speech-System benötigt einen Backend-Server, der die Google Cloud TTS API aufruft. 

### Warum nicht die gleiche Architektur wie Production?

**Production** verwendet **Vercel Serverless Functions** (`api/audio/generate.ts`), die automatisch als API-Endpoints bereitgestellt werden.

**Problem**: Vercel Serverless Functions laufen **nur auf Vercel**, nicht lokal. 

**Lösung**: Wir verwenden einen **lokalen Express-Server**, der die gleiche Funktionalität bereitstellt, und **Vite Proxy** leitet alle `/api/*` Requests automatisch an diesen Server weiter.

## Architektur-Vergleich

### Production (Vercel)
```
Browser → Vercel → /api/audio/generate (Serverless Function) → Google TTS → Convex Prod DB
```

### Development (Lokal)
```
Browser → Vite (5173) --proxy--> Express (3001) → /api/audio/generate → Google TTS → Convex Dev DB
```

**Wichtig**: Der Vite Proxy ist bereits konfiguriert! Du musst nur beide Server starten.

## Lösung

### ⭐ Option 1: Manuelles Starten in separaten Terminals (Empfohlen)

**Terminal 1** (Express Server):
```bash
pnpm dev:server
```

**Warte bis du siehst**: `Server running on http://localhost:3001/`

**Terminal 2** (Vite Frontend):
```bash
pnpm dev
```

**Wichtig**: Starte **zuerst** den Express-Server, dann Vite!

### Option 2: Automatisches Starten mit PowerShell-Skript

```powershell
.\dev-with-tts.ps1
```

Dieses Skript startet automatisch beide Server, aber **Option 1 ist zuverlässiger**.

## Umgebungsvariablen

**Wichtig**: Dank Vite Proxy sind **keine speziellen Umgebungsvariablen** mehr nötig!

Der Vite Proxy ist so konfiguriert:
```typescript
proxy: {
  '/api': {
    target: process.env.VITE_SERVER_URL || 'http://localhost:3001',
    changeOrigin: true,
  }
}
```

**Optional**: Wenn du einen anderen Port verwenden möchtest, setze in `.env`:
```env
VITE_SERVER_URL=http://localhost:3001
```

Aber standardmäßig funktioniert es **ohne** diese Variable!

## Wie funktioniert es?

1. **Frontend** (Vite auf Port 5173):
   - Lädt die React-App
   - Sendet Request an `/api/audio/generate`
   - **Vite Proxy** leitet automatisch an `http://localhost:3001/api/audio/generate` weiter

2. **Backend** (Express auf Port 3001):
   - Empfängt Request von Vite Proxy
   - Stellt den `/api/audio/generate` Endpoint bereit
   - Ruft Google Cloud TTS API auf
   - Lädt Audio in Convex File Storage hoch
   - Gibt `storageId` zurück

3. **Convex**:
   - Speichert Audio-Dateien in der Development-Datenbank
   - Generiert temporäre URLs für Audio-Wiedergabe

## Warum Express statt Vercel Dev?

**Option 1: Vercel Dev** (`vercel dev`)
- ❌ Langsam (startet jedes Mal neu)
- ❌ Kompliziert (erfordert Vercel CLI)
- ❌ Overhead (simuliert Cloud-Umgebung)

**Option 2: Express Server** (unsere Wahl)
- ✅ Schnell (Hot Reload)
- ✅ Einfach (nur `pnpm dev:server`)
- ✅ Gleiche Funktionalität wie Vercel Serverless Function
- ✅ Vite Proxy leitet automatisch weiter

## Troubleshooting

### Fehler: "POST http://localhost:5173/api/audio/generate 404"

**Ursache**: Der Express-Server läuft nicht.

**Lösung**: Starte den Express-Server mit `pnpm dev:server` oder verwende `.\dev-with-tts.ps1`

### Fehler: "GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is not configured"

**Ursache**: Die Google Cloud Credentials fehlen in der `.env` Datei.

**Lösung**: Kopiere die Credentials aus `.env.example` oder von einem Teammitglied.

### Fehler: "VITE_CONVEX_URL is not configured"

**Ursache**: Die Convex-Datenbank-URL fehlt.

**Lösung**: Stelle sicher, dass `VITE_CONVEX_URL` in der `.env` auf die Development-Datenbank zeigt:
```env
VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud
```

## Wichtige Hinweise

- **Production bleibt unberührt**: Alle Änderungen betreffen nur die lokale Development-Umgebung
- **Separate Datenbanken**: Development und Production verwenden unterschiedliche Convex-Datenbanken
- **Audio-Dateien**: Werden in der jeweiligen Convex-Datenbank gespeichert (getrennt)

## Datum
18. Dezember 2024






