# Audio Management Tools

Diese Scripts helfen bei der Verwaltung von TTS-Audio-Dateien in Development und Production.

## Verfügbare Scripts

### 1. `pnpm reset:audio` (Development)

**Zweck**: Fehlerhafte Audio-Dateien in Development zurücksetzen

**Features**:
- ✅ Reset nach serbischem Wort
- ✅ Reset nach Vocabulary ID
- ✅ Reset nach Unit
- ✅ Migration alter audioUrls
- ✅ Liste Wörter ohne Audio
- ✅ Keine Auth erforderlich

**Verwendung**:
```bash
pnpm reset:audio
```

**Dokumentation**: [AUDIO_RESET_GUIDE.md](../docs/AUDIO_RESET_GUIDE.md)

---

### 2. `pnpm reset:audio:prod` (Production)

**Zweck**: Fehlerhafte Audio-Dateien in Production zurücksetzen

**Features**:
- ✅ Reset nach serbischem Wort
- ✅ Reset nach Vocabulary ID
- ✅ Reset nach Unit
- ⚠️ Erfordert Admin/Superadmin-Rechte
- ⚠️ Mehrfache Sicherheitsbestätigungen

**Verwendung**:
```bash
pnpm reset:audio:prod
```

**Dokumentation**: [PRODUCTION_AUDIO_RESET.md](../docs/PRODUCTION_AUDIO_RESET.md)

---

### 3. `pnpm sync:audio` (Analyse)

**Zweck**: Vergleich zwischen Production und Development Audio-Status

**Features**:
- ✅ Zeigt Audio-Status beider Umgebungen
- ✅ Listet fehlende Audio-Dateien
- ✅ Nur Analyse, kein Reset

**Verwendung**:
```bash
pnpm sync:audio
```

**Ausgabe**:
```
🔄 Audio Sync Configuration:
  📦 Production DB: https://fleet-labrador-324.convex.cloud
  🔧 Development DB: https://reminiscent-panda-57.convex.cloud

📊 Audio Status:
  Production: 123/195 words with audio
  Development: 1/195 words with audio

🔍 Words with audio in Production but missing in Development:
📚 Unit 1 (10 words):
   - Ime
   - Ja sam...
   ...
```

---

### 4. `pnpm generate:audio` (Bulk-Generation)

**Zweck**: Bulk-Generierung fehlender Audio-Dateien in Development

**Features**:
- ✅ Generiert Audio für alle Wörter ohne Audio
- ✅ Zeigt Fortschritt
- ✅ Fehlerbehandlung
- ⚠️ Erfordert laufenden Express-Server

**Verwendung**:
```bash
# Starte Express-Server
pnpm dev:server

# In einem anderen Terminal
pnpm generate:audio
```

**Ausgabe**:
```
🔍 Fetching vocabulary...
✅ Found 195 vocabulary items.

📊 Found 133 words without audio

📚 Words by Unit:
  Unit 1: 10 words
  Unit 2: 44 words
  ...

Generate audio for 133 words? (y/n): y

🎵 Generating audio...

[1/133] Ime (Unit 1)... ✅
[2/133] Ja sam... (Unit 1)... ✅
[3/133] Kako (Unit 1)... ✅
...

📊 Summary:
  ✅ Success: 130
  ❌ Errors: 3
```

---

## Workflow-Beispiele

### Beispiel 1: Fehlerhaftes Wort in Production

```bash
# 1. Identifiziere das fehlerhafte Wort (z.B. "da")
# 2. Führe Production-Reset aus
pnpm reset:audio:prod

# 3. Wähle Option 1
Choose an option (1-4): 1

# 4. Gib das Wort ein
Enter serbian word to reset: da

# 5. Bestätige
⚠️  Reset audio for 1 word(s) on PRODUCTION? (y/n): y

# 6. Teste im Browser
# Gehe zu https://learn-with.me
# Klicke auf Play-Button für "da"
# Audio wird automatisch neu generiert
```

### Beispiel 2: Ganze Unit in Development neu generieren

```bash
# 1. Starte Express-Server
pnpm dev:server

# 2. Reset Unit
pnpm reset:audio
Choose an option (1-6): 3
Enter unit number: 1

# 3. Generiere Audio
pnpm generate:audio
# Wähle Unit 1 Wörter
```

### Beispiel 3: Production/Development Sync-Check

```bash
# 1. Prüfe Status
pnpm sync:audio

# 2. Wenn viele Wörter fehlen in Development:
pnpm generate:audio

# 3. Wenn fehlerhafte Wörter in Production:
pnpm reset:audio:prod
```

---

## Technische Details

### Audio-Generierung

**Development**:
- Express-Server (Port 3000)
- `/api/audio/generate` Endpoint
- Google Cloud TTS API
- Convex Storage Upload

**Production**:
- Vercel Serverless Function
- `/api/audio/generate` Endpoint
- Google Cloud TTS API
- Convex Storage Upload

### Datenbank-Struktur

```typescript
interface CourseVocabulary {
  _id: string;
  serbian: string;
  unitNumber: number;
  audioStorageId?: string; // Convex Storage ID (bevorzugt)
  audioUrl?: string;        // Deprecated (URLs expire after 1h)
}
```

### Reset-Logik

1. **Reset**: `audioStorageId` und `audioUrl` auf `undefined` setzen
2. **Frontend**: Erkennt fehlendes Audio
3. **API-Call**: `POST /api/audio/generate`
4. **TTS**: Google Cloud generiert Audio
5. **Upload**: Audio wird zu Convex Storage hochgeladen
6. **Update**: Neue `audioStorageId` wird in DB gespeichert

---

## Troubleshooting

### Problem: "Express server not running"

**Lösung**:
```bash
pnpm dev:server
```

### Problem: "Unauthorized" bei Production-Reset

**Lösung**: Prüfe Admin-Rechte im Convex Dashboard

### Problem: "Port 3000 already in use"

**Lösung**:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## Siehe auch

- [Audio Reset Guide](../docs/AUDIO_RESET_GUIDE.md)
- [Production Audio Reset](../docs/PRODUCTION_AUDIO_RESET.md)
- [Audio Troubleshooting](../docs/AUDIO_TROUBLESHOOTING.md)
- [TTS Architecture](../docs/TTS_ARCHITECTURE.md)
