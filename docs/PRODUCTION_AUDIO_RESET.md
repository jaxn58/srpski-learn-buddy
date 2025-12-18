# Production Audio Reset Guide

## Überblick

Das `reset:audio:prod` Script ermöglicht das Zurücksetzen fehlerhafter Audio-Dateien direkt auf dem **Produktionsserver**.

## Voraussetzungen

- ✅ **Admin Secret** konfiguriert (siehe [Admin Secret Setup](./ADMIN_SECRET_SETUP.md))
- ✅ Zugriff auf Production Convex DB (`fleet-labrador-324.convex.cloud`)
- ✅ Node.js und pnpm installiert

### Erstmaliges Setup

Wenn du das Script zum ersten Mal verwendest:

1. Generiere ein Admin Secret:
   ```bash
   .\scripts\generate-admin-secret.ps1
   ```

2. Folge den Anweisungen im Output
3. Füge das Secret zu `.env` und Convex hinzu
4. Warte 1-2 Minuten
5. Teste das Script

## Verwendung

```bash
pnpm reset:audio:prod
```

## Workflow

### 1. Script starten

```bash
PS D:\DEVELOPMENT\Cursor\srpski-tutor-en> pnpm reset:audio:prod

🚨 PRODUCTION AUDIO RESET TOOL
📦 Target: https://fleet-labrador-324.convex.cloud

⚠️  WARNING: This script will reset audio on PRODUCTION!
⚠️  Make sure you are logged in as admin/superadmin.

Continue with PRODUCTION reset? (y/n):
```

### 2. Bestätigung

Gib `y` ein, um fortzufahren.

### 3. Status-Übersicht

```
🔍 Fetching vocabulary from Production...
✅ Found 195 vocabulary items.

📊 Production Audio Status:
  ✅ With Storage ID: 62
  ⚠️  With old audioUrl only: 61
  ❌ Without audio: 72

🎯 Reset Options:
1. Reset specific word by serbian text
2. Reset specific word by vocabulary ID
3. Reset all words in a specific unit
4. Exit

Choose an option (1-4):
```

### 4. Option wählen

#### Option 1: Nach serbischem Wort

```
Choose an option (1-4): 1
Enter serbian word to reset: da

✅ Found 1 match(es):
  1. Unit 1 - da (ID: nn7abc123...)
     Storage ID: kg2xyz789..., Audio URL: no

⚠️  Reset audio for 1 word(s) on PRODUCTION? (y/n): y

  ✅ Reset: da (Unit 1)

✅ Successfully reset 1 word(s)
💡 Audio will be regenerated automatically when played next time.
```

#### Option 2: Nach Vocabulary ID

```
Choose an option (1-4): 2
Enter vocabulary ID: nn7abc123...

⚠️  Reset audio for vocabulary ID "nn7abc123..." on PRODUCTION? (y/n): y

✅ Successfully reset audio for: da (Unit 1)
💡 Audio will be regenerated automatically when played next time.
```

#### Option 3: Nach Unit

```
Choose an option (1-4): 3
Enter unit number: 1

✅ Found 10 words in unit 1
First 5 words:
  1. Ime (Storage ID: kg2xyz789...)
  2. Ja sam... (Storage ID: none)
  3. Kako (Storage ID: kg2abc456...)
  4. Ne (Storage ID: none)
  5. Ne razumem (Storage ID: kg2def789...)

⚠️  Reset audio for all 10 words in unit 1 on PRODUCTION? (y/n): y

  ✅ Reset: Ime
  ✅ Reset: Ja sam...
  ✅ Reset: Kako
  ✅ Reset: Ne
  ✅ Reset: Ne razumem
  ✅ Reset: Ovde*
  ✅ Reset: Pasoš
  ✅ Reset: Razumem
  ✅ Reset: Tamo
  ✅ Reset: Turista

✅ Successfully reset 10 word(s), 0 error(s)
💡 Audio will be regenerated automatically when played next time.
```

## Was passiert nach dem Reset?

1. **Datenbank-Update**: `audioStorageId` und `audioUrl` werden auf `undefined` gesetzt
2. **Automatische Regenerierung**: Beim nächsten Abspielen wird das Audio automatisch neu generiert
3. **Vercel Serverless Function**: Die TTS-Generierung läuft über `/api/audio/generate`
4. **Neue Storage-ID**: Die neue Audio-Datei erhält eine neue `audioStorageId`

## Wichtige Hinweise

### Berechtigungen

- ❌ **Ohne Admin-Rechte**: `Error: Unauthorized`
- ✅ **Mit Admin-Rechte**: Reset funktioniert

### Sicherheit

- Das Script verwendet die **hardcoded Production URL** (`fleet-labrador-324.convex.cloud`)
- Mehrfache Bestätigungen verhindern versehentliche Resets
- Jede Operation zeigt eine Warnung mit "PRODUCTION"

### Rate Limiting

- Google Cloud TTS hat Quotas (1 Million Zeichen/Monat kostenlos)
- Bei vielen Resets: Warte zwischen den Operationen
- Das Script hat keine eingebauten Delays

## Troubleshooting

### Fehler: "Unauthorized"

**Ursache**: Keine Admin-Rechte

**Lösung**: 
1. Prüfe deine Rolle im Convex Dashboard
2. Frage einen Superadmin, dich zu Admin zu machen
3. Oder verwende einen Admin-Account

### Fehler: "Vocabulary not found"

**Ursache**: Falsche Vocabulary ID

**Lösung**: 
1. Verwende Option 1 (nach serbischem Wort suchen)
2. Kopiere die korrekte ID aus der Ausgabe

### Fehler: "CONVEX_URL is not set"

**Ursache**: Sollte nicht auftreten (URL ist hardcoded)

**Lösung**: Prüfe, ob das Script korrekt ist

### Audio wird nicht regeneriert

**Ursache**: 
- Vercel Serverless Function hat Fehler
- Google Cloud TTS Credentials fehlen
- Network-Problem

**Lösung**:
1. Prüfe Vercel Logs: `vercel logs`
2. Prüfe Google Cloud TTS Quotas
3. Teste mit einem anderen Wort

## Best Practices

1. **Vor Reset**: Notiere, welches Wort fehlerhaft ist
2. **Nach Reset**: Teste das Wort im Browser
3. **Dokumentation**: Halte fest, welche Wörter zurückgesetzt wurden
4. **Batch-Operations**: Verwende Option 3 (Unit) für mehrere Wörter

## Vergleich: Development vs. Production

| Feature | Development (`reset:audio`) | Production (`reset:audio:prod`) |
|---------|----------------------------|----------------------------------|
| Target DB | `reminiscent-panda-57` | `fleet-labrador-324` |
| Auth | Keine | Admin/Superadmin |
| TTS | Express (Port 3000) | Vercel Serverless |
| Optionen | 6 (inkl. Liste & Migration) | 4 (nur Reset) |
| Sicherheit | Lokal | Mehrfache Bestätigung |

## Siehe auch

- [Audio Reset Guide](./AUDIO_RESET_GUIDE.md) - Allgemeine Anleitung
- [Audio Troubleshooting](./AUDIO_TROUBLESHOOTING.md) - Fehlerbehebung
- [TTS Architecture](./TTS_ARCHITECTURE.md) - System-Architektur
