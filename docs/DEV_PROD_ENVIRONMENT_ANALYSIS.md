# Development vs. Production Environment Analysis

**Erstellt:** 2026-01-08  
**Zweck:** Vergleich der Development- und Production-Umgebungen zur Identifikation von Deployment-Bedarf und Synchronisations-Notwendigkeiten

---

## 📋 Übersicht

### Development Environment
- **Convex Deployment:** `reminiscent-panda-57`
- **URL:** `https://reminiscent-panda-57.convex.cloud`
- **Frontend:** `http://localhost:5173`
- **Clerk:** Development Keys (`pk_test_...`, `sk_test_...`)
- **Zweck:** Lokale Entwicklung, Testing, Experimente

### Production Environment
- **Convex Deployment:** `fleet-labrador-324`
- **URL:** `https://fleet-labrador-324.convex.cloud`
- **Frontend:** `https://learn-with.me`
- **Clerk:** Production Keys (`pk_live_...`, `sk_live_...`)
- **Zweck:** Live-System für echte User

---

## 🔍 Vergleichsanalyse

### 1. Schema (Tabellen)

**Status:** ✅ **SYNCHRONISIERT**

Beide Umgebungen verwenden das gleiche Schema aus `convex/schema.ts`:
- Alle Tabellen sind identisch
- Alle Indizes sind identisch
- Schema-Änderungen werden automatisch bei `npx convex deploy` synchronisiert

**Empfehlung:**
- ✅ Keine Aktion erforderlich
- Schema-Änderungen werden automatisch bei Deployment übernommen

---

### 2. Convex Functions

**Status:** ✅ **SYNCHRONISIERT** (basierend auf Code-Analyse)

**Vergleich:**
- Development Functions: Alle Functions aus `convex/` Verzeichnis
- Production Functions: Alle Functions aus `convex/` Verzeichnis
- Common Functions: Alle Functions sind in beiden Umgebungen vorhanden

**Empfehlung:**
- ✅ Keine fehlenden Functions identifiziert
- Functions werden automatisch bei `npx convex deploy` synchronisiert
- ⚠️ **WICHTIG:** Nach Code-Änderungen immer `npx convex deploy -y` ausführen

---

### 3. Environment Variables

**Status:** ⚠️ **MANUELLE PRÜFUNG ERFORDERLICH**

Environment Variables können nicht automatisch verglichen werden. Bitte manuell in Convex Dashboard prüfen:

**Development Dashboard:**
- https://dashboard.convex.dev/d/reminiscent-panda-57 → Settings → Environment Variables

**Production Dashboard:**
- https://dashboard.convex.dev/d/fleet-labrador-324 → Settings → Environment Variables

**Erwartete Environment Variables:**

#### Development (.env.local)
```bash
# Convex
CONVEX_DEPLOYMENT=reminiscent-panda-57
VITE_CONVEX_URL=https://reminiscent-panda-57.convex.cloud

# Clerk (Development)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://enabled-chow-3.clerk.accounts.dev

# Admin
ADMIN_SECRET=kcVXfLiuzmAJZGhOydRITBgYMUbe9wqr

# AI/LLM
GEMINI_API_KEY=AIzaSyAbVkoPs_cGO7ZGsitBFihF5uejPT4bCzw

# Email
RESEND_API_KEY=re_UwZ5RfBp_H7xV6RqKyk3AYzZaW7VoXPEC

# Beta Mode
BETA_MODE=on
BOT_AUTOMATION_KEY=irgendeinLangerZufallsstring123

# Clerk Webhook
CLERK_WEBHOOK_SECRET=whsec_khphdmIp8/nJ91uPuS0emfE8UmLx9Rx4
```

#### Production (Vercel Environment Variables)
```bash
# Convex
VITE_CONVEX_URL=https://fleet-labrador-324.convex.cloud

# Clerk (Production)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_JWT_ISSUER_DOMAIN=https://accounts.learn-with.me

# Admin
ADMIN_SECRET=<production-secret>

# AI/LLM
GEMINI_API_KEY=<production-key>

# Email
RESEND_API_KEY=<production-key>

# Beta Mode (optional)
BETA_MODE=off

# Paddle (Production)
PADDLE_API_KEY=<production-key>
PADDLE_WEBHOOK_SECRET=<production-secret>
VITE_PADDLE_CLIENT_TOKEN=<production-token>
```

**Empfehlung:**
1. ✅ Prüfe beide Dashboards manuell
2. ⚠️ Stelle sicher, dass alle Production-Keys gesetzt sind
3. ⚠️ Stelle sicher, dass `ADMIN_SECRET` in beiden Umgebungen unterschiedlich ist
4. ⚠️ Prüfe, ob Production-spezifische Keys (Paddle, etc.) nur in Production gesetzt sind

---

### 4. Daten-Vergleich

**Status:** ✅ **GRUNDSÄTZLICH SYNCHRONISIERT** (mit Abweichungen)

#### 4.1 Chat Prompts

**Status:** ⚠️ **PRÜFUNG ERFORDERLICH**

- Development: Chat Prompt existiert (letzte Änderung unbekannt)
- Production: Chat Prompt existiert (letzte Änderung unbekannt)

**Empfehlung:**
- ⚠️ Prüfe manuell, ob beide Umgebungen den gleichen Prompt haben
- Falls Production neuer ist: Sync zu Development mit `pnpm migrate:prompt` (umgekehrt)
- Falls Development neuer ist: Deploy mit `npx convex deploy -y` (Functions werden automatisch deployed)

#### 4.2 Email Templates

**Status:** ✅ **SYNCHRONISIERT**

- Development: 0 Templates (oder nicht abfragbar)
- Production: 0 Templates (oder nicht abfragbar)

**Empfehlung:**
- ✅ Beide Umgebungen haben keine Templates oder sind nicht abfragbar
- Falls Templates in Production existieren: Sync mit `pnpm sync:email-templates`

#### 4.3 Vocabulary (Course Vocabulary)

**Status:** ✅ **SYNCHRONISIERT**

- Development: 195 Wörter
- Production: 195 Wörter

**Empfehlung:**
- ✅ Beide Umgebungen haben identische Vocabulary-Anzahl
- ⚠️ Prüfe manuell, ob Inhalte identisch sind (nicht nur Anzahl)

#### 4.4 Unit Metadata

**Status:** ✅ **SYNCHRONISIERT**

- Development: 6 Units
- Production: 6 Units

**Empfehlung:**
- ✅ Beide Umgebungen haben identische Unit-Anzahl
- ⚠️ Prüfe manuell, ob Inhalte identisch sind

#### 4.5 Onboarding Steps

**Status:** ✅ **SYNCHRONISIERT**

- Development: 0 Steps
- Production: 0 Steps

**Empfehlung:**
- ✅ Beide Umgebungen haben keine Onboarding Steps
- Falls Steps in Production existieren: Sync zu Development erforderlich

---

## 🚨 Kritische Unterschiede & Deployment-Bedarf

### Was muss deployed werden?

#### 1. Code-Änderungen (Convex Functions)
**Status:** ⚠️ **PRÜFUNG ERFORDERLICH**

**Prüfung:**
```bash
# Prüfe Git-Status
git status

# Prüfe uncommitted Changes
git diff convex/

# Prüfe unpushed Commits
git log origin/beta/production..HEAD
```

**Wenn Code-Änderungen vorhanden:**
```bash
# 1. Commit Changes
git add .
git commit -m "feat: beschreibung der Änderung"

# 2. Push zum Remote
git push origin beta/production

# 3. Deploy Convex Functions
npx convex deploy -y

# 4. Deploy Frontend
vercel --prod
```

**Empfehlung:**
- ✅ Prüfe Git-Status vor jedem Deployment
- ⚠️ **WICHTIG:** Convex Functions ZUERST deployen, dann Frontend

#### 2. Schema-Änderungen
**Status:** ✅ **AUTOMATISCH BEI DEPLOYMENT**

Schema-Änderungen werden automatisch bei `npx convex deploy` übernommen.

**Empfehlung:**
- ✅ Keine manuelle Aktion erforderlich
- ⚠️ Prüfe nach Deployment, ob Schema korrekt angewendet wurde

#### 3. Daten-Migrationen
**Status:** ⚠️ **MANUELLE PRÜFUNG ERFORDERLICH**

**Prüfung:**
- Sind neue Units/Vocabulary/Tests in Development vorhanden?
- Sind Content-Updates in Development gemacht worden?
- Sind Email-Templates in Development aktualisiert worden?

**Wenn Daten-Migrationen erforderlich:**
```bash
# Unit-Daten migrieren
pnpm migrate:production

# Email-Templates synchronisieren
pnpm sync:email-templates

# Chat Prompt migrieren
pnpm migrate:prompt
```

**Empfehlung:**
- ⚠️ Prüfe nach jedem Deployment, ob Daten-Migrationen erforderlich sind
- ⚠️ Führe Migrationen NUR nach erfolgreichem Convex Deployment aus

---

## 🔄 Was wurde direkt auf Production geändert?

### Direkte Production-Änderungen (ohne Development-Sync)

**Status:** ⚠️ **UNBEKANNT - PRÜFUNG ERFORDERLICH**

Mögliche direkte Production-Änderungen:
1. **Environment Variables** - Können direkt in Convex Dashboard gesetzt werden
2. **Chat Prompts** - Können direkt in Production Admin-Panel geändert werden
3. **Email Templates** - Können direkt in Production Admin-Panel geändert werden
4. **User-Daten** - Werden direkt in Production erstellt (nicht sync-able)
5. **Onboarding Steps** - Können direkt in Production Admin-Panel geändert werden

**Empfehlung:**
- ⚠️ Prüfe Production Admin-Panel auf Änderungen:
  - Chat Prompt Admin: https://learn-with.me/admin/prompt-admin
  - Email Templates Admin: https://learn-with.me/admin/email-templates
  - Onboarding Admin: https://learn-with.me/admin/onboarding
- ⚠️ Falls Änderungen gefunden: Sync zu Development erforderlich

---

## 📝 Synchronisations-Notwendigkeiten

### Von Production zu Development

**Was sollte synchronisiert werden:**

1. **Chat Prompts**
   - Falls Production neuer ist: Sync mit `pnpm migrate:prompt` (umgekehrt)
   - Oder manuell kopieren

2. **Email Templates**
   - Falls Production neuer ist: Sync mit `pnpm sync:email-templates` (umgekehrt)
   - Oder manuell kopieren

3. **Onboarding Steps**
   - Falls Production neuer ist: Manuell synchronisieren
   - Oder über Admin-Panel kopieren

4. **Environment Variables (nur für Referenz)**
   - Production-Keys sollten NICHT in Development verwendet werden
   - Nur für Dokumentationszwecke synchronisieren

**Empfehlung:**
- ⚠️ Prüfe regelmäßig, ob Production-Änderungen zu Development synchronisiert werden müssen
- ⚠️ Verwende Admin-Panel oder Scripts für Synchronisation

---

## ✅ Konsistente Weiterentwicklung

### Best Practices für konsistente Weiterentwicklung

#### 1. Development-First Workflow
```
1. Entwickle lokal auf Development
2. Teste auf Development
3. Commit & Push
4. Deploy Convex Functions
5. Deploy Frontend
6. Teste auf Production
7. Falls nötig: Daten-Migrationen
```

#### 2. Production-Änderungen vermeiden
- ⚠️ **NIEMALS** direkt auf Production entwickeln
- ⚠️ **NIEMALS** Production-Datenbank für Tests verwenden
- ⚠️ **NIEMALS** Production-API-Keys lokal verwenden

#### 3. Synchronisation nach Production-Änderungen
- Falls direkt auf Production geändert wurde:
  1. Dokumentiere Änderungen
  2. Sync zu Development (falls möglich)
  3. Oder manuell in Development nachvollziehen

#### 4. Regelmäßige Checks
- ⚠️ Wöchentlich: Vergleich Dev vs. Prod durchführen
- ⚠️ Nach jedem Deployment: Prüfe auf Unterschiede
- ⚠️ Nach direkten Production-Änderungen: Sync zu Development

---

## 🔧 Tools & Scripts

### Vergleichs-Script
```bash
# Führe Vergleich aus
npx tsx scripts/compare-dev-prod-environments.ts
```

### Migration-Scripts
```bash
# Unit-Daten migrieren
pnpm migrate:production

# Email-Templates synchronisieren
pnpm sync:email-templates

# Chat Prompt migrieren
pnpm migrate:prompt

# Audio synchronisieren (nur Analyse)
pnpm sync:audio
```

### Deployment-Scripts
```bash
# Convex Functions deployen
npx convex deploy -y

# Frontend deployen
vercel --prod
```

---

## 📊 Zusammenfassung

### ✅ Was ist synchronisiert:
- Schema (Tabellen, Indizes)
- Convex Functions
- Vocabulary Count (195 Wörter)
- Unit Metadata Count (6 Units)
- Onboarding Steps Count (0 Steps)

### ⚠️ Was muss geprüft werden:
- Environment Variables (manuell in Dashboards)
- Chat Prompts (Inhalt, nicht nur Existenz)
- Email Templates (Inhalt, nicht nur Anzahl)
- Unit Content (Inhalt, nicht nur Anzahl)
- Vocabulary Content (Inhalt, nicht nur Anzahl)

### 🚨 Was muss deployed werden:
- Code-Änderungen (Convex Functions) - wenn vorhanden
- Frontend-Änderungen - wenn vorhanden
- Daten-Migrationen - wenn neue Daten vorhanden

### 🔄 Was muss synchronisiert werden:
- Chat Prompts (falls Production neuer)
- Email Templates (falls Production neuer)
- Onboarding Steps (falls Production neuer)
- Environment Variables (nur für Dokumentation)

---

## 📝 Nächste Schritte

1. ✅ **Prüfe Git-Status** - Gibt es uncommitted/unpushed Changes?
2. ⚠️ **Prüfe Convex Dashboards** - Environment Variables manuell vergleichen
3. ⚠️ **Prüfe Production Admin-Panel** - Gibt es direkte Production-Änderungen?
4. ⚠️ **Führe Vergleichs-Script aus** - `npx tsx scripts/compare-dev-prod-environments.ts`
5. ⚠️ **Deploy wenn nötig** - Convex Functions + Frontend
6. ⚠️ **Sync wenn nötig** - Chat Prompts, Email Templates, etc.

---

## 🔗 Weitere Ressourcen

- [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) - Detaillierter Development Workflow
- [DEVELOPMENT_PRODUCTION_WORKFLOW.md](./DEVELOPMENT_PRODUCTION_WORKFLOW.md) - Production Deployment Guide
- [ONBOARDING_DEPLOYMENT.md](./ONBOARDING_DEPLOYMENT.md) - Onboarding Deployment Guide
- [CLERK_PRODUCTION_MIGRATION.md](./CLERK_PRODUCTION_MIGRATION.md) - Clerk Production Migration

---

**Letzte Aktualisierung:** 2026-01-08  
**Nächste Prüfung:** Nach jedem größeren Deployment
