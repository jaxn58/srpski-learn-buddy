# Cursor Agent Anweisungen

## !!! ABSOLUTE OBERSTE REGEL: KEINE DATENÜBERTRAGUNG OHNE EXPLIZITE ZUSTIMMUNG !!!

**ES WERDEN ZU KEINER ZEIT DATEN VON DEVELOPMENT NACH PRODUCTION ÜBERTRAGEN OHNE AUSDRÜCKLICHE, EXPLIZITE ZUSTIMMUNG DES BENUTZERS.**

- NIEMALS Daten, Content, Konfigurationen oder sonstige Änderungen von Dev nach Production deployen, synchronisieren, migrieren oder in irgendeiner Form übertragen – NICHT OHNE VORHERIGE EXPLIZITE FREIGABE.
- Dies gilt für: Convex-Datenbank-Inhalte, Convex Functions, Frontend-Deployments, Environment Variables, Schema-Migrationen, Content-Updates – ALLES.
- Auch indirekt (z.B. durch `npx convex deploy`, `vercel --prod`, Migrations-Skripte) darf NICHTS ohne Rückfrage passieren.
- Bei Problemen in Production: Analyse und Lösungsvorschläge machen, aber KEINE eigenständigen Aktionen auf Production ausführen.

## Projekt-Übersicht
Serbian Tutor - Eine Lernplattform für serbische Sprache mit XP-System, Übungen und Vokabeltraining.

## Allgemeine Entwicklungsrichtlinien

### Dokumentation zuerst – kein Halluzinieren
- **IMMER zuerst die offizielle Dokumentation des betreffenden Produkts/Services abrufen**, bevor irgendwelche Annahmen über verfügbare Features, API-Parameter, Modellnamen oder unterstützte Funktionen gemacht werden.
- Das gilt insbesondere für: externe APIs (Google Cloud, OpenAI, Stripe, Clerk, Resend, Convex, Vercel, …), Bibliotheken, Frameworks und alle Dienste, bei denen sich Verfügbarkeit oder Benennung ändern kann.
- **Konkret**: Vor dem Einsetzen von Stimm-Namen, Modell-IDs, Endpunkten oder Feature-Flags → `WebFetch` auf die offizielle Doku-URL ausführen und die tatsächlich verfügbaren Werte prüfen.
- **Verboten**: Modell- oder Ressourcennamen aus dem Trainingswissen einsetzen ohne vorherige Verifikation. Das führt zu nicht existierenden Referenzen und kostet Zeit.
- Beispiel-Workflow bei API-Problemen:
  1. Offizielle Doku abrufen (z.B. `https://cloud.google.com/text-to-speech/docs/voices`)
  2. Verfügbare Optionen für den konkreten Use-Case (Sprache, Region, Feature) prüfen
  3. Erst dann implementieren

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
- **Vor jeder Planerstellung MÜSSEN klärende Fragen (via `AskQuestion`) an den Benutzer gestellt werden**, um die Anforderungen präzise zu erfassen. Ein Plan darf erst nach dieser Abstimmungsphase erstellt werden.

### KI-Prompting & Inhalts-Strategie
- **System-Prompts (Instruktionen) sind ENGLISCH**: Alle technischen Anweisungen an die KI (z.B. im Admin-Bereich oder Content Studio) werden auf Englisch verfasst. Dies garantiert die höchste Präzision der KI-Modelle.
- **English-First Content Workflow**: Im Content Studio werden neue Lerneinheiten (Units) grundsätzlich zuerst auf Englisch generiert. Nach Freigabe der englischen Basisversion erfolgt die Übersetzung ins Deutsche als zweite, gleichwertige Zielsprache. Beide Sprachen (EN und DE) werden als Learner-Tracks ausgeliefert.
- **Ausgabesprache steuern**: Die Zielsprache der KI-Antworten (z.B. "Erkläre auf Deutsch") wird innerhalb der englischen Instruktionen als Parameter oder spezifische Anweisung übergeben.

## Architektur & Datenbank

### Mehrsprachigkeit
- Die App ist **aktiv zweisprachig**: aktuell unterstuetzte Learner-Tracks sind **Englisch-Serbisch** und **Deutsch-Serbisch**. Beide Sprachen werden als vollwertige, parallele Zielsprachen behandelt.
- **Inhalte muessen in beiden Sprachen gepflegt sein** (EN und DE). Das gilt fuer Vokabeln (`en`, `de`, `noteEn`, `noteDe`), Unit-Metadaten, Unit-Content, Interactive Tests und alle User-sichtbaren Texte.
- Content-Workflow: EN wird als Basis zuerst generiert (siehe "English-First Content Workflow"), anschliessend wird in den DE-Track uebersetzt. Beide werden publiziert.
- Beim Erstellen neuer Tabellen oder Strukturen ist Mehrsprachigkeit weiterhin mitzudenken (weitere Sprachen wie `sr`, `es`, `fr` sind im Schema bereits vorgesehen - siehe `courseVocabulary`), auch wenn aktuell nur EN und DE aktiv ausgeliefert werden.
- **UI-Konsistenz**: Innerhalb eines Learner-Tracks muss dieselbe Zielsprache konsistent in allen Ansichten angezeigt werden (Wort-Karten, Tabelle, Unit-Detail, Quiz etc.). Mischung von EN- und DE-Uebersetzungen in parallelen Ansichten desselben Tracks ist ein Bug.

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
- **Beta (geschlossene Testphase)**: öffentlich erreichbar, aber nur für eingeladene Tester
  - Convex Deployment: eigenes, von Dev/Prod komplett getrenntes Convex-Projekt (Name wird bei Anlage ergänzt)
  - Vercel-Projekt: eigenes Projekt (Name wird bei Anlage ergänzt), gleiches Repo/gleicher Build wie Prod
  - Clerk: eigene Clerk-Production-Instanz mit Restricted Sign-up (Einladung/Allowlist im Clerk-Dashboard)
  - URL: `https://beta.learn-with.me`
  - `VITE_BETA_ENV=on` gesetzt → Seite wird site-wide `noindex, nofollow` (siehe `scripts/prerender-landing.ts`)
  - Eigene Datenbank; Content wird punktuell aus Production exportiert/importiert (nur Content-/Konfigurationstabellen, keine User-/Payment-Daten), Details siehe Beta-Setup-Runbook

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
- **VOR JEDEM Beta-Deployment ebenso explizit fragen** ("Soll ich jetzt auf Beta deployen?") - Beta ist öffentlich erreichbar und zählt trotz Testdaten wie ein Live-System
- Immer erst lokal entwickeln gegen Dev-Environment
- Testen auf Dev bevor nach Production deployed wird
- Commit-Messages sollten klar sein (conventional commits)
- Breaking Changes vorher dokumentieren
- Database Migrations erst auf Dev testen
- Convex Functions ZUERST deployen, dann Frontend
- **IMMER nur Platzhalter für Secrets verwenden** (z.B. `<development-key>`, `...`, `pk_test_...`)

**❌ DON'Ts:**
- **NIEMALS `npx convex deploy` ausführen ohne VORHER explizit zu fragen!** (gilt für Prod- UND Beta-Deployment)
- **NIEMALS `vercel --prod` ausführen ohne VORHER explizit zu fragen!** (gilt für Prod- UND Beta-Deployment)
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

**Dodo Payments (Convex Dashboard Env Vars - Phase 5, Stand Juni 2026):**

Kanonische 4-Tarife-Struktur (siehe `docs/restructure/01_TARIFE_UND_FEATURES.md`):
- `course` = Sprachkurs (prepaid + Raten; Raten seit Juni 2026)
- `standalone` = AI Chat Standalone (prepaid + Raten)
- `course_ai` = Sprachkurs + AI (prepaid + Raten)
- `course_ai_pro` = Sprachkurs + AI Pro (prepaid + Raten)

Subscription-Produkte (24 Env-Vars: 4 Tiers x 3 Laufzeiten x 2 Modi). Laufzeiten: **3 / 6 / 12 Monate** (9-Monats-Variante entfernt, Entscheidung Phase 4). Hinweis: Der `course`-Tarif war urspruenglich prepaid-only; seit Juni 2026 unterstuetzt er ebenfalls Ratenzahlung (gleiches 10-%-Modell).

Sprachkurs (prepaid + Raten, 6 Vars):
- `DODO_PRODUCT_COURSE_3M_PREPAID`, `DODO_PRODUCT_COURSE_6M_PREPAID`, `DODO_PRODUCT_COURSE_12M_PREPAID`
- `DODO_PRODUCT_COURSE_3M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_6M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_12M_INSTALLMENTS`

AI Chat Standalone (6 Vars):
- `DODO_PRODUCT_STANDALONE_3M_PREPAID`, `DODO_PRODUCT_STANDALONE_6M_PREPAID`, `DODO_PRODUCT_STANDALONE_12M_PREPAID`
- `DODO_PRODUCT_STANDALONE_3M_INSTALLMENTS`, `DODO_PRODUCT_STANDALONE_6M_INSTALLMENTS`, `DODO_PRODUCT_STANDALONE_12M_INSTALLMENTS`

Sprachkurs + AI (6 Vars):
- `DODO_PRODUCT_COURSE_AI_3M_PREPAID`, `DODO_PRODUCT_COURSE_AI_6M_PREPAID`, `DODO_PRODUCT_COURSE_AI_12M_PREPAID`
- `DODO_PRODUCT_COURSE_AI_3M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_AI_6M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_AI_12M_INSTALLMENTS`

Sprachkurs + AI Pro (6 Vars):
- `DODO_PRODUCT_COURSE_AI_PRO_3M_PREPAID`, `DODO_PRODUCT_COURSE_AI_PRO_6M_PREPAID`, `DODO_PRODUCT_COURSE_AI_PRO_12M_PREPAID`
- `DODO_PRODUCT_COURSE_AI_PRO_3M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_AI_PRO_6M_INSTALLMENTS`, `DODO_PRODUCT_COURSE_AI_PRO_12M_INSTALLMENTS`

> Legacy-Env-Vars (`DODO_PRODUCT_BUDDY_*`, `DODO_PRODUCT_BASIC_*`, `DODO_PRODUCT_FULL_*`) bleiben fuer Bestandskunden-Webhooks aktiv (Zero-Migration), neue Kaeufe laufen ueber die kanonischen IDs oben.

Energy Top-up-Produkte (3 Env-Vars, Werte siehe `docs/restructure/02_TOKEN_SYSTEM.md` §4 – Entscheidung Juni 2026 finalisiert, monoton fallende €/Energy-Treppe):
- `DODO_TOPUP_STARTER` (500 Energy, 4.99 EUR, 0 % Bonus, 0,00998 €/Energy)
- `DODO_TOPUP_PLUS` (1500 Energy = 1000 + 500 Bonus, 9.99 EUR, 50 % Bonus, 0,00666 €/Energy)
- `DODO_TOPUP_PRO` (4000 Energy = 2500 + 1500 Bonus, 22.99 EUR, 60 % Bonus, 0,00575 €/Energy)

> **Quelle der Wahrheit:** `convex/subscriptions.ts → TOPUP_PACKS`. Code und Doku sind synchronisiert; Dodo-Produkte im Dashboard muessen auf dieselben Werte gepflegt sein.

Weitere Dodo-Vars:
- `DODO_PAYMENTS_API_KEY` - API Key (Dev: test-key, Prod: live-key)
- `DODO_PAYMENTS_WEBHOOK_SECRET` - Webhook-Signatur-Secret
- `DODO_PAYMENTS_ENVIRONMENT` - `test_mode` | `live_mode` | `dev_mode`
- `DODO_BETA50_DISCOUNT_CODE` - Discount-Code-ID in Dodo fuer Beta-Tester-50%-Rabatt
- `BETA_END_DATE` - ISO-Datum wann die Beta endet (z.B. `2026-09-01`)

Upgrade Top-up-Produkte (auto-created via `internalEnsureDodoUpgradeProducts`):
- Werden dynamisch aus `SUBSCRIPTION_PLANS` generiert (alle gleichen Tiers, kuerzere Laufzeit -> laengere Laufzeit). Beispiele: `DODO_UPG_COURSE_AI_3M_COURSE_AI_6M`, `DODO_UPG_COURSE_AI_PRO_6M_COURSE_AI_PRO_12M`, sowie analog fuer Legacy-Tiers (`BUDDY`, `BASIC`, `FULL`) fuer Bestandskunden-Pfade.

Platform-Config Defaults (konfigurierbar im Admin-Bereich, **alle Werte in DB**):
- Welcome-Energy fuer ersten `course_ai_pro`-Kauf: **500** (0 = deaktiviert)
- Beta-Tester-Discount: **50%** (einmalig nach Beta-Ende)
- Energy-Quotas pro Tier (siehe `02_TOKEN_SYSTEM.md` §3): `course` = 0 (Teaser-only), `course_ai` = 250 (Juni 2026 von 120 angehoben – UX-Korrektur), `standalone` = 600 (Juni 2026 von 450 angehoben, da der Tarif keine Kurs-Inhalte enthält), `course_ai_pro` = 750. Felder in `platformConfig`: `energyQuotaBasic`, `energyQuotaBuddy`, `energyQuotaFull`. Defaults nur im Code als Fallback bei leerer Tabelle.
- Plan-Preise: dynamisch aus `dodoProducts`-Tabelle via `getDynamicPrice()`. `priceCents` in `SUBSCRIPTION_PLANS` sind reine Fallback-Defaults.

### Secrets & API Keys - KRITISCH!

**🚨 ABSOLUTE REGEL: NIEMALS echte Secrets in Dateien schreiben, die ins Git-Repository kommen!**

- **MCP-Server Nutzung (z.B. Dodo Payments):** Wenn ein MCP-Server für einen Dienst (wie Dodo Payments) vorhanden ist, MUSS der Agent diesen aktiv nutzen, um Konfigurationen (wie Webhooks) selbstständig anzulegen, zu prüfen und zu debuggen. Der User soll nicht mit manuellen Aufgaben "genervt" werden, die der Agent über den MCP-Server automatisieren kann.
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

# ❌ FALSCH (NIE so in Git-getrackte Dateien schreiben - echte Keys gehoeren ausschliesslich in .env.local / Convex Dashboard / Vercel Env):
GEMINI_API_KEY=AIzaSy<NEVER-PUT-A-REAL-KEY-HERE>
ADMIN_SECRET=<NEVER-PUT-A-REAL-SECRET-HERE>
RESEND_API_KEY=re_<NEVER-PUT-A-REAL-KEY-HERE>
```

**Vor jedem Schreiben in Dateien prüfen:**
- Enthält diese Datei echte Secrets?
- Kommt diese Datei ins Git-Repository?
- Wenn ja: Nur Platzhalter verwenden!

## User-Löschung (Clerk + Convex)

Die vollständige Löschung eines Users läuft über eine zentrale idempotente
Kaskaden-Mutation `internal.admin._deleteUserCascade`. Drei Pfade rufen sie auf:

- **Admin**: `api.admin.deleteUser` (`action`, nicht `mutation`, da `fetch()`
  auf die Clerk-REST-API nicht aus einer Mutation möglich ist). Auth läuft
  über `internal.admin._requireAdminForUserDelete`.
- **Self-Service**: `api.users.deleteMyAccount` (`action`), verlangt
  E-Mail-Bestätigung und blockiert bei aktivem Abonnement.
- **Webhook**: `/clerk-webhook` verarbeitet `user.deleted` und räumt Convex
  auf, wenn ein User im Clerk-Dashboard manuell gelöscht wird.

Wichtig für neue Tabellen mit `userId`: beim Hinzufügen **immer**
`_deleteUserCascade` in `convex/admin.ts` erweitern, sonst bleiben Waisen
zurück. Details: [`docs/CLERK_PRODUCTION_MIGRATION.md`](docs/CLERK_PRODUCTION_MIGRATION.md).

Im Clerk Dashboard muss das Webhook-Event `user.deleted` abonniert sein,
damit das Safety-Net greift.

## Bekannte Bugs & Loesungen

### Audio-Generierung schlaegt fehl ("Failed to generate audio. Please try again.")

**Symptom:** Klick auf Lautsprecher-Icon in Vokabel- oder Unit-Ansicht → Fehler-Dialog.

**Ursache (bestaetigt Juni 2026):** Die Convex-Mutation `vocabulary:generateUploadUrl` wurde faelschlicherweise mit einem `TTS_API_SECRET`-Pflicht-Check versehen. Da das Secret in der Dev-Umgebung (und im Express-Server `.env.local`) nicht konfiguriert war, warf die Mutation `"Audio upload is not configured (TTS_API_SECRET missing)."`. Convex gibt dabei HTTP 200 zurueck (kein HTTP-Fehler), der Body enthaelt aber `{"status":"error",...}` → der aufrufende Code bekam `value: undefined` → `fetch(undefined)` warf einen TypeError.

**Loesung:** Die `generateUploadUrl`-Mutation benoetigt keinen Secret-Check. Der TTS-Server-Endpoint erzwingt bereits Clerk-Auth. Die Upload-URL ist single-use und kurzlebig. Der Check wurde entfernt. Sollte der Bug wieder auftauchen: sicherstellen dass `convex/vocabulary.ts → generateUploadUrl` KEINEN `TTS_API_SECRET`-Check enthaelt.

**Zusaetzlich repariert:** `server/_core/textToSpeech.ts → uploadToConvex()` prueft jetzt korrekt ob der Convex-Response-Body `status: "error"` enthaelt (HTTP 200 ≠ Convex-Erfolg).

**NICHT in `.env.local` eintragen:** `TTS_API_SECRET` wird fuer den lokalen Dev-Server nicht benoetigt.

---

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
- ❌ Keine Mischung von EN- und DE-Inhalten in derselben Ansicht desselben Learner-Tracks (Learner waehlt EN oder DE, UI muss dann durchgaengig in dieser Sprache bleiben)
- ❌ **NIEMALS Frontend vor Convex Functions deployen** - Immer zuerst `npx convex deploy -y`, dann `vercel --prod`
- ❌ **NIEMALS direkt auf Production entwickeln** - Immer erst lokal auf Dev testen
- ❌ **NIEMALS Production-Datenbank für Tests verwenden**

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
