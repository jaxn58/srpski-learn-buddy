# Text-to-Speech Development Server Fix

## Problem
Das Text-to-Speech-System funktionierte auf dem Produktionsserver, aber nicht auf dem Development Server.

## Ursache
Die Vercel Development Environment Variables waren falsch konfiguriert:
- **Development Environment** zeigte auf die **Production Convex-Datenbank** (`fleet-labrador-324`)
- **Lokale .env** zeigte korrekt auf die **Development Convex-Datenbank** (`reminiscent-panda-57`)

Dies führte zu einer Inkonsistenz: Das TTS-System generierte Audio und speicherte es in der Production-Datenbank, während der lokale Development Server versuchte, aus der Development-Datenbank zu lesen.

## Lösung
Die Vercel Environment Variables wurden korrigiert:

### Development Environment
- `CONVEX_URL=https://reminiscent-panda-57.convex.cloud`
- `VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud`

### Production & Preview Environment
- `CONVEX_URL=https://fleet-labrador-324.convex.cloud`
- `VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud`

### Lokale .env (bereits korrekt)
- `CONVEX_URL=https://reminiscent-panda-57.convex.cloud`
- `VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud`
- `CONVEX_DEPLOYMENT=dev:reminiscent-panda-57`

## Durchgeführte Schritte

1. **Analyse**: Vergleich der Environment Variables zwischen Production und Development
2. **Identifikation**: Feststellung, dass Development auf Production DB zeigte
3. **Korrektur**: 
   - Entfernen der falschen `CONVEX_URL` und `VITE_CONVEX_URL` aus Development
   - Hinzufügen der korrekten Development DB URLs
   - Sicherstellen, dass Production und Preview weiterhin auf Production DB zeigen

## Verifikation

Nach der Korrektur sollte das TTS-System auf allen Umgebungen funktionieren:

- ✅ **Production Server** (Vercel Production): Verwendet Production DB (`fleet-labrador-324`)
- ✅ **Development Server** (lokal mit `pnpm dev`): Verwendet Development DB (`reminiscent-panda-57`)
- ✅ **Preview Deployments** (Vercel Preview): Verwendet Production DB (`fleet-labrador-324`)

## Nächste Schritte

1. Lokalen Development Server neu starten: `pnpm dev`
2. TTS-Funktion testen (Play-Button bei Vokabeln)
3. Verifizieren, dass Audio generiert und abgespielt wird

## Wichtige Hinweise

- Die `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` ist für alle Environments (Development, Preview, Production) identisch
- Die Convex-Datenbanken sind getrennt:
  - **Development**: `reminiscent-panda-57` (für lokale Entwicklung)
  - **Production**: `fleet-labrador-324` (für Produktion und Preview)
- Audio-Dateien werden in Convex File Storage gespeichert (getrennt pro Datenbank)

## Datum
18. Dezember 2024

