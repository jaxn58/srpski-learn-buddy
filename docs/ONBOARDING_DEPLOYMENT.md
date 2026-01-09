# Onboarding System Deployment Guide

## Übersicht

Dieses Dokument beschreibt den Deployment-Prozess für das neue dynamische Onboarding-System.

## Deployment-Reihenfolge

**KRITISCH:** Die Reihenfolge muss EXAKT eingehalten werden!

```
1. Code committen & pushen
2. Convex Functions deployen
3. Migration auf Production ausführen
4. Frontend deployen
5. Testen
```

## Schritt-für-Schritt Anleitung

### 1. Pre-Deployment Checks

#### 1.1 Alle Tests durchgeführt?
- [ ] Alle Tests aus `ONBOARDING_SYSTEM_TESTING.md` erfolgreich
- [ ] Keine kritischen Bugs gefunden
- [ ] Code Review abgeschlossen

#### 1.2 Environment-Variablen prüfen

**Dev (.env.local):**
```bash
VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud
ADMIN_SECRET=your-dev-secret
```

**Production (Vercel Environment Variables):**
```bash
VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud
ADMIN_SECRET=your-production-secret
```

### 2. Code Commit & Push

```bash
# Status prüfen
git status

# Alle Änderungen stagen
git add .

# Commit mit aussagekräftiger Message
git commit -m "feat: Add dynamic admin-managed onboarding system

- Add onboardingSteps table to schema
- Implement CRUD API in convex/onboarding.ts
- Create migration script for existing steps
- Refactor WelcomeOnboarding to load from DB
- Add OnboardingAdmin page with full management UI
- Add routing and sidebar navigation
- Update documentation"

# Push to beta/production branch
git push origin beta/production
```

### 3. Convex Deployment

**WICHTIG:** Convex MUSS vor dem Frontend deployed werden!

```bash
# 1. Convex Functions deployen
npx convex deploy -y

# 2. Warten bis Deployment abgeschlossen (ca. 30-60 Sekunden)
# 3. Prüfen in Convex Dashboard ob Functions sichtbar sind
```

**Verification:**
- Öffne Convex Dashboard: https://dashboard.convex.dev
- Wähle Production Deployment: `fleet-labrador-324`
- Prüfe unter "Functions": `onboarding.ts` sollte sichtbar sein
- Prüfe unter "Data": `onboardingSteps` Tabelle sollte existieren (leer)

### 4. Production Migration

**ACHTUNG:** Führe Migration NUR auf Production aus, wenn Convex Deployment erfolgreich war!

```bash
# Set Production Convex URL
export CONVEX_URL=https://fleet-labrador-324.convex.cloud

# Set Production Admin Secret (aus Vercel Environment Variables)
export ADMIN_SECRET=your-production-secret

# Run Migration
npx tsx scripts/migrate-onboarding.ts
```

**Erwartetes Ergebnis:**
```
🚀 Starting onboarding migration...
📡 Using Convex URL: https://fleet-labrador-324.convex.cloud
✅ Admin authentication configured

📝 Creating step 1: Welcome to Serbian AI Tutor...
   ✅ Created successfully (ID: ...)
📝 Creating step 2: How the Course Works...
   ✅ Created successfully (ID: ...)
📝 Creating step 3: Gamification & Rewards...
   ✅ Created successfully (ID: ...)
📝 Creating step 4: AI Learn Buddy - Your AI Tutor...
   ✅ Created successfully (ID: ...)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Migration Summary:
   ✅ Successfully migrated: 4 step(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Onboarding migration completed successfully!
```

**Verification:**
- Öffne Convex Dashboard
- Gehe zu "Data" → `onboardingSteps`
- 4 Einträge sollten sichtbar sein
- Prüfe `language: "en"` und `isActive: true`

### 5. Frontend Deployment

**WICHTIG:** Nur deployen, wenn Convex + Migration erfolgreich!

```bash
# Frontend deployen
vercel --prod
```

**Erwartetes Ergebnis:**
```
Vercel CLI 32.x.x
🔍  Inspect: https://vercel.com/...
✅  Production: https://learn-with.me [copied to clipboard]
```

### 6. Production Testing

#### 6.1 Smoke Test

1. **Öffne:** https://learn-with.me
2. **Login** mit Admin-Account
3. **Navigiere zu:** `/admin/onboarding`

**Prüfen:**
- [ ] Seite lädt ohne Fehler
- [ ] 4 Onboarding-Steps werden angezeigt
- [ ] Vorschau funktioniert
- [ ] Keine Console-Errors

#### 6.2 Neuer User Test

**Option A: Testaccount erstellen**
1. Logout aus Admin-Account
2. Registriere neuen Test-User
3. Nach erfolgreichem Login sollte Onboarding erscheinen

**Option B: LocalStorage manipulieren**
1. Im Admin-Account: Browser Console öffnen
2. `localStorage.clear()` ausführen
3. Seite neu laden → Dashboard öffnen
4. Onboarding sollte NICHT erscheinen (User ist älter als 24h)

**Erwartetes Verhalten:**
- [ ] Onboarding erscheint für User < 24h alt
- [ ] Zeigt 4 Steps aus der Datenbank
- [ ] Navigation funktioniert
- [ ] "Skip" und "Get Started" schließen das Onboarding

#### 6.3 Admin-Panel Test

1. Login als Admin
2. Navigiere zu `/admin/onboarding`
3. Teste CRUD-Operationen:
   - [ ] Create: Neuen Step erstellen
   - [ ] Read: Steps werden angezeigt
   - [ ] Update: Step bearbeiten
   - [ ] Delete: Test-Step löschen
   - [ ] Toggle: Active/Inactive
   - [ ] Reorder: Up/Down funktioniert
   - [ ] Preview: Zeigt aktuelle Steps

### 7. Rollback-Plan

Falls kritische Fehler auftreten:

#### Option 1: Frontend Rollback

```bash
# Vorheriges Deployment wiederherstellen
vercel rollback
```

#### Option 2: Convex Rollback

1. Öffne Convex Dashboard
2. Gehe zu "Deployments"
3. Wähle vorheriges Deployment
4. Klicke "Rollback"

#### Option 3: Migration Rückgängig machen

```bash
# Manuell in Convex Dashboard:
# 1. Data → onboardingSteps
# 2. Alle Einträge löschen
```

**ACHTUNG:** Nach Rollback muss Frontend neu deployed werden!

### 8. Post-Deployment Monitoring

#### 8.1 Convex Logs prüfen

1. Öffne Convex Dashboard
2. Gehe zu "Logs"
3. Filter: `onboarding`

**Auf Fehler achten:**
- [ ] Keine Errors beim Laden der Steps
- [ ] Keine Unauthorized-Errors
- [ ] Keine Database-Errors

#### 8.2 Sentry/Error-Tracking

Falls Sentry eingerichtet:
- [ ] Prüfe auf neue Errors related zu "onboarding"
- [ ] Prüfe User-Impact (wie viele User betroffen?)

#### 8.3 User-Feedback

In den ersten 24h nach Deployment:
- [ ] Feedback-Channel überwachen
- [ ] Beta-User fragen, ob Onboarding erscheint
- [ ] Admin-Panel-Nutzung tracken

## Deployment-Checkliste

### Pre-Deployment
- [ ] Alle Tests erfolgreich durchgeführt
- [ ] Code committed und gepusht
- [ ] Environment-Variablen geprüft
- [ ] Backup von Production-Daten erstellt

### Deployment
- [ ] Convex Functions deployed
- [ ] Convex Deployment verifiziert
- [ ] Production Migration erfolgreich
- [ ] Migration in Convex Dashboard verifiziert
- [ ] Frontend deployed
- [ ] Frontend Deployment verifiziert

### Post-Deployment
- [ ] Smoke Test erfolgreich
- [ ] Admin-Panel funktioniert
- [ ] Onboarding erscheint für neue User
- [ ] Keine kritischen Errors in Logs
- [ ] Team informiert über neues Feature

## Kommunikation

### Team-Benachrichtigung

Nach erfolgreichem Deployment:

```
✅ Deployment: Dynamic Onboarding System

🚀 Deployed to Production
- URL: https://learn-with.me/admin/onboarding
- Features:
  • Admin-Panel für Onboarding-Verwaltung
  • Dynamisches Laden aus Datenbank
  • Mehrsprachigkeit vorbereitet (aktuell: EN)
  • Vorschau-Funktion
  • Reorder & Toggle Active/Inactive

📝 Nächste Schritte:
- [ ] Admin-Team über neues Feature informieren
- [ ] Dokumentation im Wiki verlinken
- [ ] Für Beta-Test anpassen falls nötig

🔗 Admin-Zugang: https://learn-with.me/admin/onboarding
```

## Troubleshooting

### Problem: Migration schlägt fehl auf Production
**Symptom:** `Unauthorized` oder `Failed to create step`

**Lösung:**
1. Prüfe ADMIN_SECRET ist korrekt gesetzt
2. Prüfe Admin-User existiert in Production DB
3. Prüfe Convex Functions sind deployed
4. Logs in Convex Dashboard prüfen

### Problem: Frontend zeigt alte Onboarding-Steps
**Symptom:** Hardcoded Steps statt DB-Steps

**Lösung:**
1. Browser Cache leeren
2. Prüfe ob neue Frontend-Version deployed
3. Prüfe `api.onboarding.getActiveOnboardingSteps` wird aufgerufen
4. Network-Tab prüfen: Request sollte zu Convex gehen

### Problem: Admin-Panel zeigt "Unauthorized"
**Symptom:** Admin kann Seite nicht öffnen

**Lösung:**
1. Prüfe User-Role in Production DB
2. Stelle sicher `role: "admin"` oder `role: "superadmin"`
3. Prüfe Convex Functions sind deployed
4. Prüfe Browser Console für Details

### Problem: Onboarding erscheint nicht für neue User
**Symptom:** Neue User sehen kein Onboarding

**Lösung:**
1. Prüfe User-Erstellungsdatum (< 24h?)
2. Prüfe Steps sind `isActive: true` in DB
3. Prüfe Steps existieren für User-Sprache (`language: "en"`)
4. Browser Console für Errors prüfen

## Support-Kontakte

Bei kritischen Problemen:
1. **Deployment-Verantwortlicher:** [Name]
2. **Backend-Lead:** [Name]
3. **Frontend-Lead:** [Name]

## Dokumentation

- Testing Guide: `docs/ONBOARDING_SYSTEM_TESTING.md`
- Architecture: Plan-File im `.cursor/plans/` Verzeichnis
- Migration Script: `scripts/migrate-onboarding.ts`
- Admin Panel: `client/src/pages/OnboardingAdmin.tsx`

---

**Letzte Aktualisierung:** 2026-01-09
**Version:** 1.0.0
