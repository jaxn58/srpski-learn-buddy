# Google Cloud Text-to-Speech Setup Anleitung

Diese Anleitung führt Sie Schritt für Schritt durch die Einrichtung von Google Cloud Text-to-Speech für die Audio-Generierung serbischer Vokabeln.

## Übersicht

Google Cloud Text-to-Speech wird verwendet, um serbische Vokabeln automatisch als Audio-Dateien zu generieren. Die Audios werden in S3 gespeichert und in der Datenbank gecacht, um Performance zu optimieren.

## Schritt 1: Google Cloud Projekt erstellen/auswählen

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Wähle ein bestehendes Projekt oder erstelle ein neues Projekt
3. Notiere die **Project ID**: `gen-lang-client-0536354713`

## Schritt 2: Text-to-Speech API aktivieren

1. Navigiere zu **APIs & Services** > **Library**
2. Suche nach "Cloud Text-to-Speech API"
3. Klicke auf **Enable** um die API zu aktivieren
4. Warte bis die Aktivierung abgeschlossen ist (ca. 1-2 Minuten)

## Schritt 3: Service Account erstellen

1. Navigiere zu **IAM & Admin** > **Service Accounts**
2. Klicke auf **+ CREATE SERVICE ACCOUNT**
3. Gib einen Namen ein (z.B. `tts-service-account`)
4. Optional: Beschreibung hinzufügen
5. Klicke auf **CREATE AND CONTINUE**

## Schritt 4: Service Account Berechtigungen zuweisen

1. In der Rolle-Auswahl:

   - Wähle **Cloud Text-to-Speech API User** (oder **Editor** für mehr Berechtigungen)
   - Oder erstelle eine Custom Role mit nur `cloudtts.synthesizeSpeech` Berechtigung

2. Klicke auf **CONTINUE**
3. Optional: Benutzer hinzufügen (nicht notwendig für Server-zu-Server Kommunikation)
4. Klicke auf **DONE**

## Schritt 5: Service Account Key erstellen

1. Klicke auf den erstellten Service Account
2. Gehe zum Tab **KEYS**
3. Klicke auf **ADD KEY** > **Create new key**
4. Wähle **JSON** Format
5. Klicke auf **CREATE**
6. Die JSON-Datei wird automatisch heruntergeladen

## Schritt 6: Service Account Key konfigurieren

### Lokal (.env Datei)

1. Öffne die heruntergeladene JSON-Datei
2. Kopiere den gesamten JSON-Inhalt
3. Konvertiere zu einzeiligem String (entferne Zeilenumbrüche, escapen von Anführungszeichen)
4. Füge in `.env` hinzu:
   ```
   GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...",...}'
   ```

**Alternative**: Verwende ein Tool zum Konvertieren:

```bash
# Mit jq (falls installiert)
cat service-account-key.json | jq -c '.' > service-account-key-oneline.json
```

### Production (Vercel)

1. Gehe zu Vercel Dashboard > Projekt > Settings > Environment Variables
2. Füge neue Variable hinzu:

   - Name: `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY`
   - Value: Einzeiliger JSON-String (aus Schritt 6)
   - Environment: Production, Preview, Development (je nach Bedarf)

3. Speichere

**WICHTIG**:

- Service Account Key ist **geheim** - niemals in Git committen
- Key sollte regelmäßig rotiert werden (alle 90 Tage empfohlen)
- Bei Kompromittierung: Key sofort löschen und neuen erstellen

## Schritt 7: Service Account Key Format

Die Umgebungsvariable muss den kompletten JSON-Inhalt als String enthalten:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "tts-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

Als einzeiliger String (für .env):

```
GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

## Schritt 8: Kosten & Limits

- **Free Tier**: 0-4 Millionen Zeichen pro Monat kostenlos
- **Pricing**: $4.00 pro 1 Million Zeichen (nach Free Tier)
- **Rate Limits**: Standard 100 Requests/Sekunde (kann erhöht werden)
- **Monitoring**: Nutze Google Cloud Console > APIs & Services > Dashboard für Monitoring

## Troubleshooting

### Fehler: "Could not load the default credentials"

- Prüfe ob `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` gesetzt ist
- Prüfe ob JSON korrekt formatiert ist (einzeilig, escaped)
- Prüfe ob Service Account die richtigen Berechtigungen hat

### Fehler: "Permission denied"

- Prüfe ob Text-to-Speech API aktiviert ist
- Prüfe ob Service Account die Rolle "Cloud Text-to-Speech API User" hat

### Fehler: "Invalid JSON"

- Stelle sicher, dass der JSON-String korrekt escaped ist
- Verwende `JSON.parse()` zum Testen des Strings

### Audio wird nicht generiert

- Prüfe Server-Logs für Fehlermeldungen
- Stelle sicher, dass der Server-Endpoint `/api/audio/generate` erreichbar ist
- Prüfe ob S3 Storage korrekt konfiguriert ist

## Testing

Nach der Einrichtung können Sie die Audio-Funktionalität testen:

1. Öffne die Vocabulary List oder Vocabulary Practice Seite
2. Klicke auf den Play-Button (🔊) neben einer serbischen Vokabel
3. Das Audio sollte generiert und abgespielt werden
4. Beim zweiten Klick sollte das Audio aus dem Cache geladen werden (schneller)

## Weitere Informationen

- [Google Cloud Text-to-Speech Dokumentation](https://cloud.google.com/text-to-speech/docs)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Text-to-Speech Pricing](https://cloud.google.com/text-to-speech/pricing)
