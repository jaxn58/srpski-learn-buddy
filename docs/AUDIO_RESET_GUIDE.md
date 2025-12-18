# Audio Reset Guide

## Problem

Manchmal werden TTS-Audiodateien fehlerhaft generiert:
- Kein Sound beim Abspielen
- Korrupte Audiodaten
- Veraltete Audio-URLs

Diese fehlerhafte `audioStorageId` bleibt in der Datenbank und verhindert eine Neugenerierung.

## Lösung

### 1. Admin-Mutation (Einzelne Wörter)

Für einzelne fehlerhafte Wörter kann die Admin-Mutation direkt verwendet werden:

```typescript
// In Convex Dashboard oder via Client
await client.mutation(api.vocabulary.resetVocabularyAudio, {
  vocabularyId: "jh7abc123...", // Die ID des fehlerhaften Wortes
});
```

**Voraussetzung**: Admin- oder Superadmin-Rolle erforderlich

**Effekt**: 
- Löscht `audioStorageId` und `audioUrl` aus der Datenbank
- Beim nächsten Abspielen wird das Audio neu generiert

---

### 2. Batch-Reset Script (Mehrere Wörter)

Für mehrere fehlerhafte Wörter oder systematische Probleme:

**Development:**
```bash
pnpm reset:audio
```

**Production:**
```bash
pnpm reset:audio:prod
```

⚠️ **WICHTIG**: Das Production-Script erfordert Admin/Superadmin-Rechte!

Das Script bietet folgende Optionen:

#### Option 1: Reset nach serbischem Wort
```
Choose an option: 1
Enter serbian word to reset: zdravo
```
- Findet alle Vorkommen des Wortes (über alle Units)
- Zeigt Details (Unit, ID, Storage-Status)
- Fragt zur Bestätigung

#### Option 2: Reset nach Vocabulary ID
```
Choose an option: 2
Enter vocabulary ID: jh7abc123...
```
- Direkter Reset eines spezifischen Eintrags
- Nützlich wenn die ID bekannt ist

#### Option 3: Reset nach Unit
```
Choose an option: 3
Enter unit number: 5
```
- Setzt alle Wörter einer Unit zurück
- Zeigt Vorschau der ersten 5 Wörter
- Fragt zur Bestätigung

#### Option 4: Migration alter audioUrls
```
Choose an option: 4
```
- Findet alle Wörter mit deprecated `audioUrl` (ohne `audioStorageId`)
- Setzt diese zurück, um Migration zu Convex Storage zu erzwingen
- Nützlich für System-Upgrades

#### Option 5: Liste Wörter ohne Audio
```
Choose an option: 5
```
- Zeigt alle Wörter ohne Audio (weder `audioStorageId` noch `audioUrl`)
- Gruppiert nach Unit
- Nur zur Information, kein Reset

---

## Workflow für fehlerhafte Audio-Dateien

### Schritt 1: Identifikation
1. Benutzer meldet: "Wort XY hat keinen Sound"
2. Notiere das serbische Wort und/oder die Unit-Nummer

### Schritt 2: Reset
```bash
# Starte das Script
pnpm reset:audio

# Wähle Option 1 (nach Wort) oder 3 (nach Unit)
Choose an option: 1

# Gib das fehlerhafte Wort ein
Enter serbian word to reset: zdravo

# Bestätige den Reset
Reset audio for 1 word(s)? (y/n): y
```

### Schritt 3: Verifikation
1. Gehe zur Vocabulary-Seite im Frontend
2. Klicke auf den Play-Button für das Wort
3. Das System generiert automatisch neues Audio
4. Prüfe, ob der Sound jetzt funktioniert

---

## Technische Details

### Was passiert beim Reset?

1. **Datenbank-Update**:
   ```typescript
   await ctx.db.patch(vocabularyId, {
     audioStorageId: undefined,
     audioUrl: undefined,
   });
   ```

2. **Beim nächsten Abspielen**:
   - Frontend ruft `getVocabularyAudioUrl` auf
   - Query findet keine `audioStorageId`
   - Frontend triggert Audio-Generierung via `/api/audio/generate`
   - Neue Audio-Datei wird in Convex Storage gespeichert
   - Neue `audioStorageId` wird in DB gespeichert

### Berechtigungen

- **Admin-Mutation**: Nur Admin/Superadmin
- **Script**: Keine Auth (verwendet Convex Client direkt)
  - Benötigt `VITE_CONVEX_URL` oder `CONVEX_URL` in `.env`

### Logging (Debug Mode)

Das Script und die Mutation sind mit Debug-Logging instrumentiert:
- Hypothese H1: Fehlerhafte TTS-Generierung
- Hypothese H2: Race Conditions beim Upload
- Hypothese H3: Problematische serbische Zeichen
- Hypothese H4: Network-Timeouts
- Hypothese H5: URL-Generierung schlägt fehl

Logs werden nach `d:\DEVELOPMENT\Cursor\srpski-tutor-en\.cursor\debug.log` geschrieben.

---

## Häufige Szenarien

### Szenario 1: Einzelnes Wort hat keinen Sound (Development)
```bash
pnpm reset:audio
# Option 1 → Wort eingeben → Bestätigen
```

### Szenario 2: Einzelnes Wort hat keinen Sound (Production)
```bash
pnpm reset:audio:prod
# Option 1 → Wort eingeben → Bestätigen
```

### Szenario 3: Ganze Unit hat Probleme (Production)
```bash
pnpm reset:audio:prod
# Option 3 → Unit-Nummer eingeben → Bestätigen
```

### Szenario 4: Nach TTS-System-Update (Development)
```bash
pnpm reset:audio
# Option 4 → Migriere alle alten audioUrls
```

### Szenario 5: Audit - Welche Wörter fehlen? (Development)
```bash
pnpm reset:audio
# Option 5 → Liste anzeigen (kein Reset)
```

---

## Troubleshooting

### Problem: "Unauthorized" Fehler bei Mutation
**Lösung**: Stelle sicher, dass der Benutzer Admin- oder Superadmin-Rolle hat.

### Problem: Script findet keine Wörter
**Lösung**: 
1. Prüfe `CONVEX_URL` in `.env`
2. Stelle sicher, dass die Datenbank Daten enthält
3. Prüfe die Schreibweise des serbischen Wortes (case-sensitive)

### Problem: Audio wird nicht neu generiert
**Lösung**:
1. Prüfe, ob TTS-System läuft (Development: Express Server, Production: Vercel)
2. Prüfe Google Cloud TTS Credentials
3. Prüfe Browser-Console für Fehler

### Problem: "CONVEX_URL is not set"
**Lösung**: 
```bash
# Development
echo "VITE_CONVEX_URL=https://your-dev-url.convex.cloud" >> .env

# Production
echo "CONVEX_URL=https://your-prod-url.convex.cloud" >> .env
```

---

## Best Practices

1. **Vor Batch-Reset**: Immer Option 5 verwenden, um zu sehen, was betroffen ist
2. **Nach Reset**: Stichprobenartig testen, ob Audio neu generiert wird
3. **Dokumentation**: Notiere, welche Wörter/Units zurückgesetzt wurden
4. **Monitoring**: Bei häufigen Problemen → Root Cause Analysis (Debug Logs)

---

## Siehe auch

- [TTS Architecture](./TTS_ARCHITECTURE.md)
- [Development TTS Setup](./DEVELOPMENT_TTS_SETUP.md)
- [Google Cloud TTS Setup](./GOOGLE_CLOUD_TTS_SETUP.md)
