# Audio Troubleshooting Guide

## Problem: "Audio wird nicht generiert" in Development

### Symptome
- Play-Button funktioniert nicht
- Keine Audio-Dateien werden erstellt
- Browser-Console zeigt Fehler: `Failed to generate audio`
- Vite-Terminal zeigt: `http proxy error: /api/audio/generate` + `ECONNREFUSED`

### Root Cause
Der **Express-Server** (Backend für TTS) läuft nicht. Nur der Vite-Server (Frontend) ist gestartet.

### Warum passiert das?
In Development benötigt das TTS-System **zwei Server**:
1. **Vite** (Port 5173) - Frontend
2. **Express** (Port 3001) - Backend mit Google Cloud TTS

Wenn du nur `pnpm dev` ausführst, startet nur Vite. Audio-Requests werden über Proxy an Express weitergeleitet, aber wenn Express nicht läuft, schlägt die Verbindung fehl.

---

## Lösung 1: Kombiniertes Script (Empfohlen)

Stoppe alle laufenden Server und starte das kombinierte Script:

```powershell
# Stoppe pnpm dev (falls läuft)
# Drücke Ctrl+C im Terminal

# Starte beide Server gleichzeitig
.\dev-with-tts.ps1
```

Das Script startet automatisch:
- Vite (Frontend) auf Port 5173
- Express (Backend/TTS) auf Port 3001

---

## Lösung 2: Zwei separate Terminals

Wenn du die Server separat starten möchtest:

**Terminal 1** (Frontend):
```powershell
pnpm dev
```

**Terminal 2** (Backend/TTS):
```powershell
pnpm dev:server
```

---

## Verifikation

Nach dem Start solltest du sehen:

**Terminal 1 (Vite)**:
```
VITE v7.2.7  ready in 597 ms
Local:   http://localhost:5173/
```

**Terminal 2 (Express)** (falls separates Terminal):
```
[Express] Server running on http://localhost:3001
[Express] TTS endpoint: /api/audio/generate
```

**Test im Browser**:
1. Öffne http://localhost:5173
2. Gehe zu Vocabulary-Seite
3. Klicke auf Play-Button bei einem Wort
4. Audio sollte generiert werden und abspielen

---

## Häufige Fehler

### Fehler 1: "ECONNREFUSED" im Vite-Terminal
**Ursache**: Express-Server läuft nicht
**Lösung**: Starte Express-Server mit `pnpm dev:server` oder `.\dev-with-tts.ps1`

### Fehler 2: "GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is not configured"
**Ursache**: Umgebungsvariable fehlt in `.env`
**Lösung**: Prüfe `.env` Datei, siehe [Google Cloud TTS Setup](./GOOGLE_CLOUD_TTS_SETUP.md)

### Fehler 3: "Port 3001 is already in use"
**Ursache**: Express-Server läuft bereits
**Lösung**: 
```powershell
# Finde den Prozess
netstat -ano | findstr :3001

# Beende den Prozess (ersetze PID)
taskkill /PID <PID> /F
```

### Fehler 4: Audio wird generiert, aber nicht abgespielt
**Ursache**: Fehlerhafte Audio-Datei oder Browser-Problem
**Lösung**: 
1. Prüfe Browser-Console auf Fehler
2. Prüfe Express-Terminal auf TTS-Fehler
3. Teste mit anderem Browser

---

## Debug-Checkliste

Wenn Audio nicht funktioniert, prüfe in dieser Reihenfolge:

- [ ] Ist Vite-Server gestartet? (Port 5173)
- [ ] Ist Express-Server gestartet? (Port 3001)
- [ ] Zeigt Vite-Terminal "ECONNREFUSED"?
- [ ] Ist `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` in `.env` gesetzt?
- [ ] Ist `VITE_CONVEX_URL` in `.env` korrekt?
- [ ] Funktioniert die Netzwerkverbindung zu Google Cloud?
- [ ] Sind Google Cloud TTS API-Quotas nicht überschritten?

---

## Production vs. Development

### Production (Vercel)
- ✅ Nur ein Deployment
- ✅ TTS läuft als Serverless Function
- ✅ Keine separaten Server nötig
- ✅ Automatisch skalierend

### Development (Lokal)
- ⚠️ Zwei separate Server nötig
- ⚠️ Express-Server muss manuell gestartet werden
- ⚠️ Proxy-Konfiguration in `vite.config.ts`
- ✅ Schnellere Entwicklung (Hot Reload)

---

## Siehe auch

- [Development TTS Setup](./DEVELOPMENT_TTS_SETUP.md)
- [TTS Architecture](./TTS_ARCHITECTURE.md)
- [Audio Reset Guide](./AUDIO_RESET_GUIDE.md)
- [Google Cloud TTS Setup](./GOOGLE_CLOUD_TTS_SETUP.md)
