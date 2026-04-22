# Clerk Production Migration Guide

## Überblick

Dieser Guide führt dich durch die Migration von Clerk Development zu Production Environment für dein öffentliches Beta-Deployment auf Vercel.

**Warum ist das wichtig?**
- Development-Keys sind nur für Tests gedacht
- Beta-User würden in der Development-Datenbank gespeichert
- Bei späterer Migration zu Production müssten sich alle User neu registrieren
- Production hat bessere Performance und keine Test-Limitierungen

## Aktuelle Situation

Dein Projekt nutzt aktuell:
- **Vercel Project**: `srpski-tutor-en` (ID: `prj_v8lr0dZax5fCvQYli8NwjiAcdOed`)
- **Clerk Environment**: Development (`pk_test_...` / `sk_test_...`)
- **Convex**: Läuft bereits im Development-Modus

## Betroffene Dateien

Die folgenden Dateien verwenden Clerk API Keys:

1. **Frontend**:
   - `client/src/main.tsx` - ClerkProvider mit `VITE_CLERK_PUBLISHABLE_KEY`

2. **Backend/Server**:
   - `server/_core/env.ts` - Server-side Authentication mit `CLERK_SECRET_KEY`
   - `convex/admin.ts` - User-Management via Clerk API

3. **Konfiguration**:
   - `.env.local` (lokal, nicht im Git)
   - Vercel Environment Variables (Production)

## Migration Schritt-für-Schritt

### Phase 1: Clerk Production API Keys abrufen

#### 1.1 Clerk Dashboard öffnen

1. Gehe zu [clerk.com/dashboard](https://clerk.com/dashboard)
2. Melde dich an
3. Wähle dein Projekt aus (Serbian AI Tutor / srpski-tutor-en)

#### 1.2 Zum Production Environment wechseln

1. **Wichtig**: Oben rechts im Dashboard siehst du einen **Environment-Selector**
2. Stelle sicher, dass du im **Production** Environment bist (nicht Development)
3. Falls du nur Development siehst, musst du eventuell zuerst Production aktivieren

#### 1.3 Production API Keys kopieren

1. Navigiere im linken Menü zu **API Keys**
2. Du siehst jetzt die Production Keys (erkennbar am Präfix):
   - **Publishable Key**: Beginnt mit `pk_live_...`
   - **Secret Key**: Beginnt mit `sk_live_...`

3. Kopiere beide Keys und speichere sie sicher (z.B. in einem Passwort-Manager)

**Wichtig**: Die Secret Keys werden nur einmal angezeigt! Wenn du sie verlierst, musst du neue generieren.

### Phase 2: Vercel Environment Variables aktualisieren

#### 2.1 Vercel Dashboard öffnen

1. Gehe zu [vercel.com/dashboard](https://vercel.com/dashboard)
2. Wähle dein Projekt: `srpski-tutor-en`
3. Navigiere zu **Settings** → **Environment Variables**

#### 2.2 Frontend Key aktualisieren

1. Suche nach der Variable: `VITE_CLERK_PUBLISHABLE_KEY`
2. Klicke auf **Edit**
3. Ersetze den alten Development-Key (`pk_test_...`) durch den neuen Production-Key (`pk_live_...`)
4. Stelle sicher, dass die Variable für folgende Environments aktiviert ist:
   - ✅ **Production**
   - ✅ **Preview** (optional, falls du Preview-Deployments testen willst)
   - ❌ **Development** (bleibt mit Test-Keys)

#### 2.3 Backend Key aktualisieren

1. Suche nach der Variable: `CLERK_SECRET_KEY`
2. Klicke auf **Edit**
3. Ersetze den alten Development-Key (`sk_test_...`) durch den neuen Production-Key (`sk_live_...`)
4. Aktiviere für dieselben Environments wie oben

#### 2.4 Änderungen speichern

- Klicke auf **Save**
- Vercel wird dich darauf hinweisen, dass ein neues Deployment nötig ist

### Phase 3: Clerk Allowed Origins konfigurieren

**Wichtig**: Clerk muss wissen, von welchen Domains deine App aufgerufen werden darf.

#### 3.1 Deine Vercel-URL ermitteln

Deine Production-URL ist vermutlich eine von:
- `https://srpski-tutor-en.vercel.app`
- `https://srpski-tutor-en-[team-name].vercel.app`
- Eine Custom Domain (falls konfiguriert)

Du findest die exakte URL in Vercel unter **Settings** → **Domains**.

#### 3.2 Allowed Origins in Clerk setzen

1. Gehe zurück zum Clerk Dashboard (Production Environment!)
2. Navigiere zu **Domains** (oder **Settings** → **Domains**)
3. Unter **Allowed Origins** füge hinzu:
   - Deine Vercel Production-URL (z.B. `https://srpski-tutor-en.vercel.app`)
   - Falls du Preview-Deployments nutzen willst: `https://*.vercel.app` (Wildcard)

4. Unter **Allowed Redirect URLs** füge hinzu:
   - `https://srpski-tutor-en.vercel.app/*` (mit Wildcard am Ende)
   - Falls Wildcard: `https://*.vercel.app/*`

#### 3.3 Callback URLs prüfen

Stelle sicher, dass folgende Callback-Patterns erlaubt sind:
- `https://[deine-domain]/sign-in/sso-callback`
- `https://[deine-domain]/sign-up/sso-callback`

### Phase 4: Convex mit Clerk Production verbinden

Convex muss ebenfalls auf die Production-Keys aktualisiert werden.

#### 4.1 Convex Dashboard öffnen

1. Gehe zu [dashboard.convex.dev](https://dashboard.convex.dev)
2. Wähle dein Projekt aus
3. Navigiere zu **Settings** → **Environment Variables**

#### 4.2 Clerk Keys in Convex aktualisieren

Falls du Clerk-Keys in Convex gesetzt hast:

```bash
# Im Terminal (im Projektverzeichnis)
npx convex env set CLERK_PUBLISHABLE_KEY pk_live_...
npx convex env set CLERK_SECRET_KEY sk_live_...
```

**Hinweis**: Prüfe in deiner `convex/auth.config.ts` oder ähnlichen Dateien, ob Clerk-Keys dort verwendet werden.

### Phase 5: Neues Deployment auslösen

#### 5.1 Deployment via Git Push

Die einfachste Methode:

```bash
# Erstelle einen leeren Commit (nur um Deployment zu triggern)
git commit --allow-empty -m "Trigger deployment with Clerk Production keys"
git push origin main
```

Vercel wird automatisch ein neues Deployment erstellen.

#### 5.2 Deployment via Vercel Dashboard

Alternativ:
1. Gehe zu deinem Projekt in Vercel
2. Klicke auf **Deployments**
3. Beim letzten erfolgreichen Deployment klicke auf **⋮** (drei Punkte)
4. Wähle **Redeploy**
5. Bestätige mit **Redeploy**

#### 5.3 Deployment überwachen

1. Beobachte den Build-Prozess im Vercel Dashboard
2. Prüfe die Logs auf Fehler
3. Warte, bis der Status **Ready** ist

### Phase 6: Funktionstest

#### 6.1 Production-URL öffnen

Öffne deine Production-URL im Browser (Inkognito-Modus empfohlen).

#### 6.2 Kritische Funktionen testen

- [ ] **App lädt**: Keine JavaScript-Fehler in der Konsole
- [ ] **Clerk lädt**: Du siehst Login/Registrierungs-Buttons
- [ ] **Registrierung**: Neuen Test-Account erstellen
- [ ] **Login**: Mit Test-Account einloggen
- [ ] **Convex-Verbindung**: Daten werden geladen (z.B. Units, Progress)
- [ ] **User-Profil**: User-Daten werden korrekt angezeigt

#### 6.3 Browser-Konsole prüfen

Öffne die Developer Tools (F12) und prüfe:

```javascript
// In der Konsole solltest du sehen:
[DEBUG] Environment check: {
  hasClerkKey: true,
  clerkKeyPrefix: "pk_live_...",  // ← Sollte jetzt pk_live_ sein!
  hasConvexUrl: true,
  // ...
}
```

#### 6.4 Clerk Dashboard prüfen

1. Gehe zurück zum Clerk Dashboard (Production!)
2. Navigiere zu **Users**
3. Dein Test-User sollte dort erscheinen

### Phase 7: Lokale Entwicklung anpassen (Optional)

**Wichtig**: Für die lokale Entwicklung solltest du weiterhin Development-Keys verwenden!

#### 7.1 `.env.local` prüfen

Stelle sicher, dass deine lokale `.env.local` Datei die **Development-Keys** enthält:

```bash
# .env.local (NUR für lokale Entwicklung)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
VITE_CONVEX_URL=https://[dein-dev-deployment].convex.cloud
```

#### 7.2 Convex Development

Für lokale Entwicklung:

```bash
# Terminal 1: Convex Development Server
npx convex dev

# Terminal 2: Vite Development Server
pnpm dev
```

Dies nutzt automatisch die lokalen Environment Variables (Development-Keys).

## Troubleshooting

### Problem: "Invalid publishable key"

**Ursache**: Der Clerk Key ist nicht korrekt oder gehört zum falschen Environment.

**Lösung**:
1. Prüfe, dass der Key mit `pk_live_` beginnt (nicht `pk_test_`)
2. Stelle sicher, dass du im Production Environment in Clerk bist
3. Kopiere den Key erneut (keine Leerzeichen am Anfang/Ende)

### Problem: CORS-Fehler

**Ursache**: Die Vercel-URL ist nicht in den Clerk Allowed Origins.

**Lösung**:
1. Gehe zu Clerk Dashboard → Domains
2. Füge deine exakte Vercel-URL hinzu
3. Stelle sicher, dass `https://` am Anfang steht
4. Warte 1-2 Minuten (DNS-Propagation)

### Problem: "User not found" nach Login

**Ursache**: Convex nutzt noch die alten Development-Keys oder die User-Datenbanken sind nicht synchronisiert.

**Lösung**:
1. Prüfe Convex Environment Variables
2. Stelle sicher, dass Convex die Production-Keys nutzt
3. Erstelle einen neuen Test-User (alte Development-User existieren nicht in Production)

### Problem: Deployment schlägt fehl

**Ursache**: Build-Fehler oder fehlende Environment Variables.

**Lösung**:
1. Prüfe die Build-Logs in Vercel
2. Stelle sicher, dass alle `VITE_*` Variablen gesetzt sind
3. Prüfe, dass `VITE_CONVEX_URL` korrekt ist

### Problem: Lokale Entwicklung funktioniert nicht mehr

**Ursache**: Du hast versehentlich die Production-Keys lokal gesetzt.

**Lösung**:
1. Prüfe deine `.env.local` Datei
2. Stelle sicher, dass dort `pk_test_...` Keys stehen
3. Starte `pnpm dev` neu

## Checkliste

Vor dem Go-Live:

- [ ] Clerk Production API Keys abgerufen
- [ ] Vercel Environment Variables aktualisiert (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- [ ] Clerk Allowed Origins konfiguriert (Vercel-URL hinzugefügt)
- [ ] Convex Environment Variables aktualisiert (falls nötig)
- [ ] Neues Deployment ausgelöst und erfolgreich
- [ ] Registrierung getestet (neuer User erstellt)
- [ ] Login getestet (User kann sich einloggen)
- [ ] Convex-Verbindung funktioniert (Daten werden geladen)
- [ ] Browser-Konsole zeigt `pk_live_` Key
- [ ] Clerk Dashboard zeigt Test-User in Production
- [ ] Lokale Entwicklung nutzt weiterhin Development-Keys

## Wichtige Hinweise

### Development vs. Production

| Aspekt | Development | Production |
|--------|-------------|------------|
| **API Keys** | `pk_test_...` / `sk_test_...` | `pk_live_...` / `sk_live_...` |
| **Verwendung** | Lokale Entwicklung | Live-Deployment (Vercel) |
| **User-Datenbank** | Getrennt | Getrennt |
| **Rate Limits** | Niedriger | Höher |
| **Kosten** | Kostenlos (meist) | Je nach Plan |

### User-Migration

**Wichtig**: User aus dem Development Environment können **nicht** automatisch zu Production migriert werden!

Wenn du bereits Beta-Tester im Development Environment hast:
1. Sie müssen sich in Production neu registrieren
2. Informiere sie vorab per E-Mail
3. Eventuell kannst du ihre Daten manuell migrieren (über Clerk API)

### Kosten

Prüfe deinen Clerk-Plan:
- **Free Tier**: Meist ausreichend für Beta (bis zu 10.000 MAU)
- **Pro Plan**: Falls mehr User oder Features benötigt werden

## User Deletion Flow

Die vollständige User-Löschung (Clerk + Convex) läuft seit dem Umbau über drei
koordinierte Pfade, die alle dieselbe Kaskaden-Mutation `internal.admin._deleteUserCascade`
wiederverwenden:

1. **Admin-Flow** (`convex/admin.ts` → `deleteUser` als `action`):
   - Auth-Check via `internal.admin._requireAdminForUserDelete`
   - `DELETE https://api.clerk.com/v1/users/:id` mit `CLERK_SECRET_KEY`
   - Bei Erfolg (oder 404 „already gone") → `_deleteUserCascade`
   - Bei Fehler: Convex-Daten bleiben erhalten, `forceIfClerkFails` optional.

2. **Self-Service-Flow** (`convex/users.ts` → `deleteMyAccount` als `action`):
   - Re-Auth via `ctx.auth.getUserIdentity()`
   - E-Mail-Bestätigung durch den User (case-insensitive Vergleich mit der
     Konto-E-Mail)
   - Guard: blockiert bei aktivem Abonnement, damit kein Zahlungs-Waise entsteht.
   - Clerk-Delete → Cascade → Frontend ruft `signOut()` + Redirect auf `/`.

3. **Webhook-Safety-Net** (`convex/http.ts` → `/clerk-webhook`, Event
   `user.deleted`): Wenn ein User manuell im Clerk-Dashboard gelöscht wird,
   räumt der Webhook Convex auf, damit keine Zombie-Rows zurückbleiben.

### Konfiguration im Clerk Dashboard (Pflicht)

Im **Clerk Dashboard → Webhooks → (dein Endpoint)** muss das Event
`user.deleted` abonniert sein. Falls nicht aktiviert, greift das Safety-Net
nicht und manuelle Löschungen im Clerk-Dashboard führen zu Dateninkonsistenzen.

Empfohlen: zusätzlich `user.created` abonnieren (für Welcome-Mails, bereits
implementiert) und `session.created` für Single-Session-Enforcement.

### Gelöschte Tabellen (Kaskade)

`_deleteUserCascade` löscht alle Zeilen zum User in:
`userProgress`, `userSubscriptions`, `subscriptionHistory`,
`exerciseQuestionProgress`, `questionProgress`, `exerciseResults`,
`exerciseCompletions`, `userBadges`, `dailyActivity`, `vocabularyProgress`,
`quizProgress`, `feedbackSubmissions` (inkl. `feedbackMessages`,
`feedbackComments`, `feedbackStatusHistory`), eigenständige `feedbackComments`,
`wishlistItems` (inkl. `wishlistUpvotes`), `wishlistUpvotes`, `chatSessions`
(inkl. `chatMessages`) und zuletzt die `users`-Zeile selbst.

## Nächste Schritte nach Migration

1. **Beta-Schutz aktivieren**: Siehe [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
2. **Monitoring einrichten**: Clerk Dashboard → Analytics
3. **Error Tracking**: Vercel Dashboard → Logs
4. **Beta-Tester einladen**: E-Mail-Liste vorbereiten
5. **Webhook `user.deleted` abonnieren**: Siehe Abschnitt „User Deletion Flow"

## Weiterführende Ressourcen

- [Clerk Production Checklist](https://clerk.com/docs/deployments/production-checklist)
- [Clerk Environment Variables](https://clerk.com/docs/deployments/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Convex Production Deployment](https://docs.convex.dev/production)

---

**Bei Fragen oder Problemen**: Prüfe zunächst die Troubleshooting-Sektion oder kontaktiere den Clerk Support.










