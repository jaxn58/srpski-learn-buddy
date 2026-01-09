# Cursor Agent Anweisungen

## Projekt-Übersicht
Serbian Tutor - Eine Lernplattform für serbische Sprache mit XP-System, Übungen und Vokabeltraining.

## Allgemeine Entwicklungsrichtlinien

### Code-Qualität
- **Keine 'Quick & Dirty' Lösungen** - Lösungen sollten immer durchdacht und analytisch angegangen werden. Es geht immer darum, eine solide und widerstandsfähige Lösung zu finden.
- Alle Inhalte für die App sollen **dynamisch** sein und nicht hardcoded aus der Datenbank gezogen werden. Vorschläge können gemacht werden, wenn es Probleme gibt.

### Dateien & Änderungen
- **Keine Eigeninitiative beim Anlegen von Dateien oder beim Ändern von Dateien**. Alles muss immer in Rückfrage mit dem Benutzer geschehen.
- Keine Eigeninitiative beim Design - immer konsistent mit bestehenden Komponenten.

### Kommunikation
- Verwende keine Emojis im Agent Fenster.
- Immer auf Deutsch antworten.

## Architektur & Datenbank

### Mehrsprachigkeit
- Beim Erstellen von Datenbanken oder Strukturen gilt immer darauf zu achten, dass hier eine **Mehrsprachigkeit integrierbar, leicht integrierbar** sein soll.
- Vorerst benutzen wir aber nur **Englisch**.
- Bis zu dem Zeitpunkt, wo die App multi-language fähig gemacht wird, oder sobald sie freigeschaltet ist als multi-language App, sollen **alle Inhalte Englisch sein**. Darauf ist zu achten.

## XP System

### Regeln
- Nach der Mastery, das heißt **dreimal richtige Antwort**, kann kein weiteres XP mehr generiert werden.
- **XP System**: 
  - 1st = 10 XP
  - 2nd = 5 XP
  - 3rd = 3 XP
  - danach = 0 XP

## Design & UI/UX

### Design-Konsistenz
- **NIEMALS Eigeninitiative beim Design** - immer konsistent mit bestehenden Komponenten.
- Sobald wir ein grafisches Stylesheet haben, ein CI für die Website oder für das Projekt, muss sich unbedingt daran gehalten werden. Keine Eigeninitiative bei designtechnischen Entscheidungen.

## Code-Style & Best Practices

### TypeScript & React
- TypeScript für alle neuen Dateien verwenden.
- Funktionale React-Komponenten bevorzugen.
- Konsistente Code-Struktur mit bestehenden Dateien beibehalten.

## Development Workflow

### Umgebungen
- **Development (Dev)**: Lokale Entwicklung und Testing
  - Convex Deployment: `reminiscent-panda-57`
  - URL: `http://localhost:5173`
  - Separate Dev-Datenbank (unabhängig von Production)
- **Production (Prod)**: Live-System für echte User
  - Convex Deployment: `fleet-labrador-324`
  - URL: `https://learn-with.me`
  - Production-Datenbank mit echten User-Daten

### Standard Development-Workflow

1. **Lokale Entwicklung**
   ```bash
   # Terminal 1: Convex Dev Server
   npx convex dev
   
   # Terminal 2: Frontend Dev Server
   pnpm dev
   ```
   - Arbeitet automatisch gegen **Dev Convex Deployment**
   - Arbeitet automatisch gegen **Dev Clerk Environment**
   - Änderungen werden NICHT automatisch in Production übernommen

2. **Testing auf Dev**
   - Teste Features lokal: `http://localhost:5173`
   - Erstelle Test-User in Dev-Environment
   - Prüfe Console auf Errors
   - Teste alle Flows end-to-end

3. **Code Review & Commit**
   ```bash
   git add .
   git commit -m "feat: beschreibung der Änderung"
   git push origin beta/production
   ```

4. **Deployment nach Production**
   - **KRITISCH: Richtige Reihenfolge einhalten!**
   - **Schritt 1:** Convex Functions ZUERST deployen
     ```bash
     npx convex deploy -y
     ```
   - **Schritt 2:** Frontend DANN deployen
     ```bash
     vercel --prod
     ```
   - **Warum diese Reihenfolge?** Frontend benötigt die aktuellen Convex Functions. Wenn Frontend zuerst deployed wird, könnte es auf alte Functions zugreifen → Server Error.

### Daten-Migration

Nach Schema-Änderungen oder Content-Updates muss eine Migration durchgeführt werden:

```bash
# Unit-Daten migrieren
pnpm migrate:production

# Email-Templates synchronisieren
pnpm sync:email-templates
```

**Wann migrieren?**
- Nach Schema-Änderungen (neue Tabellen, neue Felder)
- Nach Content-Updates (neue Units, Vocabulary, Tests)
- Nach Email-Template-Änderungen
- Nach Konfigurations-Änderungen

### Wichtige Workflow-Regeln

**✅ DO's:**
- Immer erst lokal entwickeln gegen Dev-Environment
- Testen auf Dev bevor nach Production deployed wird
- Commit-Messages sollten klar sein (conventional commits)
- Breaking Changes vorher dokumentieren
- Database Migrations erst auf Dev testen
- Convex Functions ZUERST deployen, dann Frontend

**❌ DON'Ts:**
- **NIEMALS direkt auf Production entwickeln**
- **NIEMALS Production-Datenbank für Tests verwenden**
- **NIEMALS Production-API-Keys lokal verwenden**
- **NIEMALS ungetestete Änderungen deployen**
- **NIEMALS Schema-Änderungen ohne Backup**
- **NIEMALS Frontend vor Convex Functions deployen**

### Environment Variables

**Lokal (.env.local) - DEV:**
- `CONVEX_DEPLOYMENT=reminiscent-panda-57`
- `VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud`
- Clerk Development Keys (`pk_test_...`, `sk_test_...`)

**Production (Vercel) - PROD:**
- `VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud`
- Clerk Production Keys (`pk_live_...`, `sk_live_...`)

## Wichtige Warnungen & Verbote

- ❌ Keine Eigeninitiative bei Dateien oder Design-Änderungen ohne Rückfrage
- ❌ Keine Quick & Dirty Lösungen
- ❌ Keine Emojis im Agent Fenster
- ❌ Keine hardcoded Inhalte - alles dynamisch aus der Datenbank
- ❌ Keine deutschen Inhalte (bis Multi-Language aktiviert ist)
- ❌ **NIEMALS Frontend vor Convex Functions deployen** - Immer zuerst `npx convex deploy -y`, dann `vercel --prod`
- ❌ **NIEMALS direkt auf Production entwickeln** - Immer erst lokal auf Dev testen
- ❌ **NIEMALS Production-Datenbank für Tests verwenden**
