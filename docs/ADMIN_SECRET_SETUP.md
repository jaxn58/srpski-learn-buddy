# Admin Secret Setup

## Problem

Das `reset:audio:prod` Script benötigt Authentifizierung, um Audio auf Production zurückzusetzen. Da `ConvexHttpClient` keine Clerk-Auth unterstützt, verwenden wir ein **Admin Secret**.

## Setup

### 1. Generiere ein Admin Secret

Erstelle ein sicheres, zufälliges Secret (mindestens 32 Zeichen):

```bash
# Option 1: PowerShell
$secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
echo "ADMIN_SECRET=$secret"

# Option 2: Manuell
# Verwende einen Password-Generator oder erstelle ein langes, zufälliges Passwort
```

### 2. Füge das Secret zur lokalen `.env` hinzu

Öffne `d:\DEVELOPMENT\Cursor\srpski-tutor-en\.env` und füge hinzu:

```bash
# Admin Secret für Production-Scripts
ADMIN_SECRET=your-generated-secret-here
```

**Beispiel**:
```bash
ADMIN_SECRET=aB3xK9mP2qR7sT4vW8yZ1cD5eF6gH0jL
```

### 3. Füge das Secret zu Convex Environment Variables hinzu

1. Gehe zum Convex Dashboard: https://dashboard.convex.dev
2. Wähle dein Projekt: `fleet-labrador-324`
3. Gehe zu **Settings** → **Environment Variables**
4. Füge hinzu:
   - **Key**: `ADMIN_SECRET`
   - **Value**: (das gleiche Secret wie in `.env`)
   - **Environment**: Production
5. Klicke auf **Save**

### 4. Teste das Script

```bash
pnpm reset:audio:prod
```

Wenn das Secret korrekt konfiguriert ist, sollte das Script funktionieren.

## Sicherheit

### Wichtig

- ⚠️ **Teile das Admin Secret NIEMALS öffentlich**
- ⚠️ **Committe das Secret NICHT in Git** (`.env` ist in `.gitignore`)
- ⚠️ **Verwende ein starkes, zufälliges Secret** (min. 32 Zeichen)
- ⚠️ **Rotiere das Secret regelmäßig** (alle 3-6 Monate)

### Was das Secret schützt

Das Admin Secret erlaubt:
- ✅ Audio-Reset auf Production
- ✅ Zugriff auf Admin-Mutationen ohne Clerk-Auth

Das Admin Secret erlaubt NICHT:
- ❌ Zugriff auf das Convex Dashboard
- ❌ Zugriff auf andere Admin-Funktionen (nur Audio-Reset)
- ❌ Zugriff auf Benutzerdaten

## Troubleshooting

### Fehler: "ADMIN_SECRET is not set in .env"

**Lösung**: Füge `ADMIN_SECRET=...` zur `.env` Datei hinzu

### Fehler: "Invalid admin secret"

**Ursachen**:
1. Secret in `.env` stimmt nicht mit Convex Environment Variable überein
2. Secret wurde noch nicht zu Convex hinzugefügt
3. Convex Deployment wurde nicht neu gestartet nach Hinzufügen des Secrets

**Lösung**:
1. Prüfe, ob das Secret in beiden Orten identisch ist
2. Füge das Secret zu Convex Environment Variables hinzu
3. Warte 1-2 Minuten, bis Convex neu deployed ist
4. Versuche das Script erneut

### Fehler: "Server Error"

**Ursache**: Convex Mutation hat einen internen Fehler

**Lösung**:
1. Prüfe Convex Logs im Dashboard
2. Stelle sicher, dass die Mutation deployed ist
3. Prüfe, ob das Vocabulary existiert

## Alternative: Clerk Auth (Zukunft)

Aktuell verwenden wir ein Admin Secret, weil `ConvexHttpClient` keine Clerk-Auth unterstützt.

In Zukunft könnten wir:
1. Ein Admin-Dashboard im Frontend erstellen
2. Dort Clerk-Auth verwenden
3. Audio-Reset direkt im Browser durchführen

Vorteile:
- ✅ Keine Secrets nötig
- ✅ Bessere UX
- ✅ Audit-Log (wer hat was zurückgesetzt)

Nachteile:
- ❌ Mehr Entwicklungsaufwand
- ❌ Nur im Browser verfügbar (nicht als CLI-Tool)

## Siehe auch

- [Production Audio Reset](./PRODUCTION_AUDIO_RESET.md)
- [Audio Reset Guide](./AUDIO_RESET_GUIDE.md)
