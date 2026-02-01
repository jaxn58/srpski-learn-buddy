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
-Alle Agents sind ausschließlich Maschinen und keine Menschen, die irgendetwas empfinden. Also erwarte ich, dass eventuelle Beleidigungen meinerseits aus Frust, hier auf nicht fruchtbaren Boden fallen und ich wünsche keine Belehrungen von irgendwelchen Modellen (KI-Modellen). Sie werden bezahlt und haben zu funktionieren.
-Verwende keine Emojis im Agent Fenster.
- Immer auf Deutsch antworten.

## Architektur & Datenbank

### Mehrsprachigkeit
- Beim Erstellen von Datenbanken oder Strukturen gilt immer darauf zu achten, dass hier eine **Mehrsprachigkeit integrierbar, leicht integrierbar** sein soll.
- Vorerst benutzen wir aber nur **Englisch**.
- Bis zu dem Zeitpunkt, wo die App multi-language fähig gemacht wird, oder sobald sie freigeschaltet ist als multi-language App, sollen **alle Inhalte Englisch sein**. Darauf ist zu achten.

### Schema-Design & Konsistenz
- **IMMER zuerst bestehende Tabellen und Patterns analysieren**, bevor neue Tabellen erstellt werden
- **Bestehende Patterns verwenden** - nicht neu erfinden!
- Zwei Multilanguage-Ansätze im Projekt:
  1. **Spalten-basiert** (bevorzugt): `titleEn`, `titleDe`, `contentEn`, `contentDe` etc.
     - Verwendet bei: `moduleMetadata`, `courseVocabulary`
     - Vorteil: Weniger Einträge, einfacher zu verwalten
  2. **Zeilen-basiert**: Separate Einträge pro Sprache mit `language`-Feld
     - Verwendet bei: `unitMetadata`, `unitContent`, `unitInteractiveTests`
     - Vorteil: Flexibler für viele Sprachen
- **Vor der Implementierung**: Prüfe welches Pattern im bestehenden Schema verwendet wird und halte dich daran
- **Keine neuen Patterns erfinden** ohne vorherige Absprache

## XP System

### Regeln
- Nach der Mastery, das heißt **dreimal richtige Antwort**, kann kein weiteres XP mehr generiert werden.
- **XP System** (gilt für Vocabulary UND Unit Exercises):
  - 1st = 5 XP
  - 2nd = 10 XP
  - 3rd = 20 XP (Mastered!)
  - Total per Item = 35 XP
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

### SEO / Landingpage (statisch HTML) aktualisieren

Die Landingpage (`/`) wird beim Frontend-Build als **statisches HTML** prerendered (inkl. SEO-Head-Tags). Das passiert automatisch bei jedem normalen Vercel-Deploy.

**Wenn sich nur Content (Convex) geändert hat** und kein Code deployt wurde, dann die Landingpage so aktualisieren:

- In Vercel beim **letzten erfolgreichen Production Deployment** auf **Redeploy** klicken.
- Optional: Build Cache deaktivieren, wenn du sicherstellen willst, dass alle Daten frisch gezogen werden.

Wichtig: Kein In-App „Deploy Hook“-Trigger verwenden. Deployments werden bewusst nur über Vercel (manuell) angestoßen.

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
- **VOR JEDEM Production-Deployment: User explizit fragen "Soll ich jetzt auf Production deployen?"**
- Immer erst lokal entwickeln gegen Dev-Environment
- Testen auf Dev bevor nach Production deployed wird
- Commit-Messages sollten klar sein (conventional commits)
- Breaking Changes vorher dokumentieren
- Database Migrations erst auf Dev testen
- Convex Functions ZUERST deployen, dann Frontend
- **IMMER nur Platzhalter für Secrets verwenden** (z.B. `<development-key>`, `...`, `pk_test_...`)

**❌ DON'Ts:**
- **NIEMALS `npx convex deploy` ausführen ohne VORHER explizit zu fragen!**
- **NIEMALS `vercel --prod` ausführen ohne VORHER explizit zu fragen!**
- **NIEMALS Dev-Server (pnpm dev, npm run dev, vite, etc.) starten oder stoppen ohne VORHER explizit zu fragen!**
- **NIEMALS direkt auf Production entwickeln**
- **NIEMALS Production-Datenbank für Tests verwenden**
- **NIEMALS Production-API-Keys lokal verwenden**
- **NIEMALS ungetestete Änderungen deployen**
- **NIEMALS Schema-Änderungen ohne Backup**
- **NIEMALS Frontend vor Convex Functions deployen**
- **NIEMALS echte Secrets, API Keys oder Passwörter in Dateien schreiben, die ins Git-Repository kommen!**

### Environment Variables

**Lokal (.env.local) - DEV:**
- `CONVEX_DEPLOYMENT=reminiscent-panda-57`
- `VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud`
- Clerk Development Keys (`pk_test_...`, `sk_test_...`)

**Production (Vercel) - PROD:**
- `VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud`
- Clerk Production Keys (`pk_live_...`, `sk_live_...`)

### Secrets & API Keys - KRITISCH!

**🚨 ABSOLUTE REGEL: NIEMALS echte Secrets in Dateien schreiben, die ins Git-Repository kommen!**

- **NIEMALS** echte API Keys, Secrets, Passwörter oder Tokens in Dokumentationsdateien schreiben
- **NIEMALS** echte Secrets in Code-Beispiele oder Konfigurationsdateien schreiben
- **NIEMALS** echte Secrets in Markdown-Dateien (.md) schreiben
- **NIEMALS** echte Secrets in TypeScript/JavaScript-Dateien schreiben (außer .env.local, die in .gitignore ist)

**Erlaubt sind nur:**
- Platzhalter wie `<development-key>`, `<production-secret>`, `...`, `pk_test_...`, `sk_live_...`
- Generische Beispiele ohne echte Werte
- Verweise auf Environment Variables ohne die tatsächlichen Werte

**Wo gehören echte Secrets hin?**
- Lokal: Nur in `.env.local` (die in `.gitignore` ist)
- Production: Nur in Convex Dashboard oder Vercel Environment Variables
- **NIEMALS** in Dateien, die ins Git-Repository gepusht werden

**Beispiel für Dokumentation:**
```bash
# ✅ RICHTIG:
GEMINI_API_KEY=<development-key>
ADMIN_SECRET=<production-secret>
RESEND_API_KEY=re_...

# ❌ FALSCH:
GEMINI_API_KEY=AIzaSyAbVkoPs_cGO7ZGsitBFihF5uejPT4bCzw
ADMIN_SECRET=kcVXfLiuzmAJZGhOydRITBgYMUbe9wqr
RESEND_API_KEY=re_UwZ5RfBp_H7xV6RqKyk3AYzZaW7VoXPEC
```

**Vor jedem Schreiben in Dateien prüfen:**
- Enthält diese Datei echte Secrets?
- Kommt diese Datei ins Git-Repository?
- Wenn ja: Nur Platzhalter verwenden!

## Wichtige Warnungen & Verbote

- ❌ **NIEMALS NIEMALS NIEMALS auf Production deployen ohne EXPLIZITE Zustimmung des Users!**
- ❌ **IMMER VORHER FRAGEN bevor `npx convex deploy` ausgeführt wird!**
- ❌ **IMMER VORHER FRAGEN bevor Dev-Server gestartet oder gestoppt werden!**
- ❌ **KEIN automatisches Deployment - IMMER erst fragen: "Soll ich jetzt auf Production deployen?"**
- ❌ **NIEMALS NIEMALS NIEMALS echte Secrets, API Keys oder Passwörter in Dateien schreiben, die ins Git-Repository kommen!**
- ❌ Keine Eigeninitiative bei Dateien oder Design-Änderungen ohne Rückfrage
- ❌ Keine Quick & Dirty Lösungen
- ❌ Keine Emojis im Agent Fenster
- ❌ Keine hardcoded Inhalte - alles dynamisch aus der Datenbank
- ❌ Keine deutschen Inhalte (bis Multi-Language aktiviert ist)
- ❌ **NIEMALS Frontend vor Convex Functions deployen** - Immer zuerst `npx convex deploy -y`, dann `vercel --prod`
- ❌ **NIEMALS direkt auf Production entwickeln** - Immer erst lokal auf Dev testen
- ❌ **NIEMALS Production-Datenbank für Tests verwenden**
