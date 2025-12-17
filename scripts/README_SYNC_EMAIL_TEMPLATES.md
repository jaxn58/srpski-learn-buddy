# EmailTemplate Synchronization Script

## Übersicht

Das Script `sync-email-templates-to-production.ts` synchronisiert EmailTemplates von Development nach Production.

## Voraussetzungen

1. **Superadmin-Rechte**: Du musst als Superadmin auf beiden Deployments eingeloggt sein
2. **Convex URLs**: Du benötigst die URLs für beide Deployments

## Setup

### Option 1: Umgebungsvariablen in PowerShell setzen

```powershell
# Development URL setzen
$env:VITE_CONVEX_URL_DEV="https://your-dev-deployment.convex.cloud"

# Production URL setzen
$env:VITE_CONVEX_URL_PROD="https://your-prod-deployment.convex.cloud"

# Dry-Run ausführen (keine Änderungen)
pnpm sync:email-templates --dry-run

# Echte Synchronisation ausführen
pnpm sync:email-templates
```

### Option 2: .env Datei verwenden

Erstelle eine `.env` Datei im Root-Verzeichnis:

```env
VITE_CONVEX_URL_DEV=https://your-dev-deployment.convex.cloud
VITE_CONVEX_URL_PROD=https://your-prod-deployment.convex.cloud
```

Dann:

```powershell
pnpm sync:email-templates --dry-run
```

## Verwendung

### 1. Dry-Run (empfohlen zuerst)

Zeigt an, welche Änderungen vorgenommen würden, ohne sie tatsächlich durchzuführen:

```powershell
pnpm sync:email-templates --dry-run
```

### 2. Echte Synchronisation

Führt die Synchronisation durch (nach Bestätigung):

```powershell
pnpm sync:email-templates
```

## Was das Script macht

1. **Verbindung herstellen**: Verbindet sich mit Dev und Prod Convex
2. **Templates abrufen**: Holt alle Templates aus beiden Deployments
3. **Vergleichen**: Zeigt Unterschiede an:
   - ✨ NEW: Templates die nur in Dev existieren
   - 🔄 UPDATED: Templates die sich geändert haben
   - ✓ UNCHANGED: Templates die identisch sind
4. **Bestätigung**: Fragt nach Bestätigung (außer bei --dry-run)
5. **Synchronisieren**: Kopiert alle Templates von Dev nach Prod

## Beispiel-Output

```
🚀 EmailTemplate Synchronization Script
============================================================
🔍 DRY RUN MODE - No changes will be made
============================================================

📡 Development: https://dev.convex.cloud
📡 Production:  https://prod.convex.cloud

📥 Fetching templates from Development...
   ✅ Found 4 templates in Development

📥 Fetching templates from Production...
   ✅ Found 3 templates in Production

🔍 Comparing templates...

============================================================
📊 COMPARISON RESULTS
============================================================

✨ NEW Templates (1):
   + feedback-admin-notification

🔄 UPDATED Templates (2):
   ~ beta-registration
   ~ user-activation

✓ UNCHANGED Templates (1):
   = feedback-confirmation

============================================================
📝 Total changes to sync: 3
============================================================

🔍 DRY RUN completed. No changes were made.
```

## Fehlerbehebung

### "Unauthorized" Fehler

Du bist nicht als Superadmin eingeloggt. Lösung:

1. Öffne das Convex Dashboard für Dev: `https://dashboard.convex.dev`
2. Öffne das Convex Dashboard für Prod: `https://dashboard.convex.dev`
3. Stelle sicher, dass du eingeloggt bist
4. Führe das Script erneut aus

### "CONVEX_URL not set" Fehler

Die Umgebungsvariablen sind nicht gesetzt. Siehe Setup oben.

## Sicherheit

- Das Script überschreibt bestehende Templates in Production
- Es wird immer nach Bestätigung gefragt (außer bei --dry-run)
- Verwende zuerst --dry-run um zu sehen, was passieren würde
- Keine automatischen Backups - exportiere wichtige Templates vorher manuell

## Nächste Schritte

Nach erfolgreicher Synchronisation der EmailTemplates kann das gleiche Pattern für andere Content-Tabellen verwendet werden:
- `unitMetadata`
- `unitContent`
- `courseVocabulary`
- `moduleMetadata`
- `unitInteractiveTests`


