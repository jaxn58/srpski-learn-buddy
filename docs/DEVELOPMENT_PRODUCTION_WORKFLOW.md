# Development vs. Production Workflow Guide

**Referenz-Dokumentation für die Arbeit mit Convex Development- und Production-Datenbanken**

---

## 📋 Inhaltsverzeichnis

1. [⚠️ Kritische Deployment-Regel](#kritische-deployment-regel)
2. [Grundprinzip](#grundprinzip)
3. [Erste Einrichtung](#erste-einrichtung)
4. [Täglicher Development-Workflow](#täglicher-development-workflow)
5. [Deployment nach Production](#deployment-nach-production)
6. [Daten-Migration](#daten-migration)
7. [Troubleshooting](#troubleshooting)
8. [Checklisten](#checklisten)

---

## ⚠️ Kritische Deployment-Regel

**Wenn du Convex-Funktionen änderst oder neue hinzufügst (mutations, queries, actions):**

```bash
# 1. Convex ZUERST auf Production deployen
npx convex deploy --yes

# 2. DANN Vercel/Frontend deployen
vercel --prod --yes
```

### Warum ist diese Reihenfolge wichtig?

- ❌ **Falsche Reihenfolge:** Vercel zuerst → Frontend ruft neue Convex-Funktionen auf, die noch nicht existieren → **Server Error**
- ✅ **Richtige Reihenfolge:** Convex zuerst → Funktionen sind verfügbar → Frontend kann sie nutzen

### Beispiel-Fehler bei falscher Reihenfolge:

```json
{
  "status": "error",
  "errorMessage": "[Request ID: xxx] Server Error"
}
```

oder

```
Failed to parse URL from undefined
```

### Betroffene Dateien:

- Jede Änderung in `convex/*.ts` (außer reine Type-Definitionen)
- Neue `mutation`, `query`, `action` Exporte
- Neue Convex Storage-Funktionen (z.B. `generateUploadUrl`)

---

## 🎯 Grundprinzip

### Zwei getrennte Convex Deployments

- **Development Deployment** (`dev:xxx`)
  - Für lokale Entwicklung
  - Wird automatisch von `npx convex dev` verwendet
  - Enthält Testdaten und experimentelle Inhalte

- **Production Deployment** (`prod:xxx`)
  - Für die Live-App auf Vercel
  - Wird automatisch von Vercel verwendet
  - Enthält echte Benutzerdaten und finale Inhalte

### App-Versionierung

- **Versionsnummer:** Wird aus `package.json` gelesen und in der Sidebar angezeigt
- **Sichtbar:** Unten in der Sidebar (nur wenn nicht collapsed)
- **Format:** `v1.0.0` (semantic versioning)

### Wichtig: Komplette Trennung

- ✅ Code-Änderungen werden automatisch deployed
- ❌ Daten werden **NICHT** automatisch synchronisiert
- ⚠️ Schema-Änderungen werden deployed, aber Daten müssen manuell migriert werden

---

## 🔧 Erste Einrichtung

### 1. Convex Deployments identifizieren

```powershell
# Zeige alle Deployments
npx convex deployments

# Oder nutze das Script
.\scripts\show-convex-urls.ps1
```

**Wo finde ich die URLs?**
- Convex Dashboard: https://dashboard.convex.dev
- Wähle dein Projekt
- Siehst du `dev:xxx` und `prod:xxx` Deployments
- Jedes hat seine eigene URL (z.B. `https://xxx.convex.cloud`)

### 2. Environment Variables konfigurieren

**Lokale Entwicklung (`.env.local` oder `.env`):**

```env
# Development (wird von npx convex dev verwendet)
VITE_CONVEX_URL=https://your-dev-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment-name

# Production (für Migrations-Scripts)
VITE_CONVEX_URL_PRODUCTION=https://your-prod-deployment.convex.cloud
```

**Vercel Production (im Vercel Dashboard):**

```
VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment-name
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
# ... weitere Production-Keys
```

### 3. Erste Synchronisation

Nach dem ersten Beta-Deployment sollten beide Datenbanken synchron sein:

```powershell
# Prüfe ob beide DBs synchron sind
tsx scripts/migrate-to-production.ts
```

---

## 💻 Täglicher Development-Workflow

### Standard-Entwicklung

```powershell
# Terminal 1: Convex Development Server
npx convex dev

# Terminal 2: Frontend Development Server
pnpm dev
```

**Was passiert automatisch:**
- ✅ `npx convex dev` verbindet sich mit **Development Deployment**
- ✅ Alle Code-Änderungen werden sofort deployed
- ✅ Lokale App (`localhost:5173`) nutzt **Development-Datenbank**
- ✅ Du kannst gefahrlos testen und experimentieren

### Während der Entwicklung

- ✅ Neue Features implementieren
- ✅ Testdaten in Dev-DB hinzufügen
- ✅ Experimentieren ohne Production zu beeinflussen
- ✅ Fehler beheben und testen

**Wichtig:** Alle Änderungen bleiben in der Development-Datenbank!

---

## 🚀 Deployment nach Production

### Schritt 1: Code committen und pushen

```powershell
git add .
git commit -m "Feature XYZ implementiert"
git push
```

### Schritt 2: Vercel Deployment

- Vercel deployed automatisch nach Push
- Oder manuell im Vercel Dashboard: "Redeploy"

**Was passiert:**
- ✅ Code wird gebaut und deployed
- ✅ Production-App nutzt automatisch **Production Deployment**
- ❌ **ABER:** Production-Datenbank hat noch nicht die neuen Daten!

### Schritt 3: Daten-Migration (siehe nächster Abschnitt)

---

## 📦 Daten-Migration

### Wann muss ich migrieren?

- ✅ Nach Schema-Änderungen (neue Tabellen, neue Felder)
- ✅ Nach Content-Updates (neue Units, Vocabulary, Tests)
- ✅ Nach Email-Template-Änderungen
- ✅ Nach Konfigurations-Änderungen

### Migration: Komplette Unit-Daten

**Script:** `scripts/migrate-to-production.ts`

**Was wird migriert:**
- Module Metadata
- Unit Metadata (EN + DE)
- Unit Content (alle Sections)
- Interactive Tests (mit Schutz für Fragen mit User-Fortschritt)
- Course Vocabulary

**Wichtig:** Fragen mit User-Fortschritt werden **nicht überschrieben**, um Beta-Tester-Daten zu schützen. Siehe [Post-Beta Migration Plan](./POST_BETA_MIGRATION_PLAN.md) für Details.

**Voraussetzungen:**
```env
# In .env.local oder .env
VITE_CONVEX_URL=https://your-dev-deployment.convex.cloud
VITE_CONVEX_URL_PRODUCTION=https://your-prod-deployment.convex.cloud
```

**Ausführung:**
```powershell
# Option 1: Über npm-Script (empfohlen)
pnpm migrate:production

# Option 2: Direkt mit pnpm
pnpm exec tsx scripts/migrate-to-production.ts

# Option 3: Mit npx (falls tsx global installiert)
npx tsx scripts/migrate-to-production.ts
```

**Output:**
- Zeigt Fortschritt für jeden Schritt
- Listet migrierte/übersprungene Items
- Zeigt geschützte Fragen (mit User-Fortschritt)
- Gibt Zusammenfassung am Ende

**Schutz-Mechanismus:**
- Fragen mit User-Fortschritt werden automatisch erkannt
- Diese Fragen werden **nicht überschrieben**, um Beta-Tester-Daten zu schützen
- Neue Fragen werden normal migriert

### Migration: Email-Templates

**Script:** `scripts/sync-email-templates-to-production.ts`

**Dry-Run (zeigt nur Unterschiede):**
```powershell
tsx scripts/sync-email-templates-to-production.ts --dry-run
```

**Tatsächliche Synchronisation:**
```powershell
tsx scripts/sync-email-templates-to-production.ts
```

**Was passiert:**
- Vergleicht Dev- und Prod-Templates
- Zeigt neue, geänderte und unveränderte Templates
- Fragt nach Bestätigung
- Synchronisiert alle Templates

**Voraussetzungen:**
```env
VITE_CONVEX_URL_DEV=https://your-dev-deployment.convex.cloud
VITE_CONVEX_URL_PROD=https://your-prod-deployment.convex.cloud
```

### Eigene Migrations-Scripts erstellen

**Beispiel-Struktur:**

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DEV_URL = process.env.VITE_CONVEX_URL;
const PROD_URL = process.env.VITE_CONVEX_URL_PRODUCTION;

const devClient = new ConvexHttpClient(DEV_URL!);
const prodClient = new ConvexHttpClient(PROD_URL!);

async function migrate() {
  // 1. Daten aus Dev lesen
  const devData = await devClient.query(api.yourModule.getData);
  
  // 2. Daten nach Prod schreiben
  for (const item of devData) {
    await prodClient.mutation(api.yourModule.insertData, item);
  }
  
  console.log("✅ Migration complete!");
}

migrate();
```

---

## 🔍 Troubleshooting

### Problem: "VITE_CONVEX_URL not found"

**Lösung:**
```powershell
# Prüfe ob .env.local existiert
ls .env.local

# Falls nicht, erstelle es basierend auf .env.example
cp .env.example .env.local

# Füge beide URLs hinzu
VITE_CONVEX_URL=https://dev-xxx.convex.cloud
VITE_CONVEX_URL_PRODUCTION=https://prod-xxx.convex.cloud
```

### Problem: "Unauthorized" bei Migration

**Lösung:**
- Du musst als Superadmin eingeloggt sein
- Öffne Convex Dashboard im Browser
- Stelle sicher, dass du auf beiden Deployments eingeloggt bist

### Problem: Production-Datenbank ist leer

**Lösung:**
```powershell
# Führe komplette Migration aus
tsx scripts/migrate-to-production.ts
```

### Problem: Falsches Deployment wird verwendet

**Prüfe Environment Variables:**
```powershell
# Lokal
cat .env.local | grep CONVEX

# Vercel (im Dashboard)
# Settings → Environment Variables → Production
```

**Wechsle Deployment manuell:**
```powershell
npx convex dev --deployment dev:your-deployment
npx convex dev --deployment prod:your-deployment
```

### Problem: Schema-Änderungen werden nicht deployed

**Lösung:**
- Schema-Änderungen werden automatisch deployed wenn `npx convex dev` läuft
- Für Production: Code pushen → Vercel deployed automatisch
- Falls nicht: `npx convex deploy --prod` manuell ausführen

---

## ✅ Checklisten

### Vor dem ersten Development-Tag

- [ ] `.env.local` existiert mit beiden Convex URLs
- [ ] `npx convex dev` funktioniert
- [ ] `pnpm dev` funktioniert
- [ ] Lokale App verbindet sich mit Dev-DB

### Vor dem Deployment nach Production

- [ ] Alle Features getestet in Development
- [ ] Code committed und gepusht
- [ ] Vercel Environment Variables sind korrekt gesetzt
- [ ] Production Convex URL ist in Vercel hinterlegt

### Nach dem Deployment

- [ ] Vercel Deployment erfolgreich
- [ ] Production-App läuft ohne Fehler
- [ ] Daten-Migration durchgeführt (falls nötig)
- [ ] Production-App getestet

### Bei Schema-Änderungen

- [ ] Schema in Development getestet
- [ ] Code deployed nach Production
- [ ] Daten-Migration durchgeführt
- [ ] Production-App getestet

### Bei Content-Änderungen

- [ ] Content in Development getestet
- [ ] Code deployed nach Production
- [ ] `migrate-to-production.ts` ausgeführt
- [ ] Content in Production verifiziert

---

## 📝 Quick Reference

### Häufige Befehle

```powershell
# Development starten
npx convex dev          # Terminal 1
pnpm dev                # Terminal 2

# Deployments anzeigen
npx convex deployments

# URLs anzeigen
.\scripts\show-convex-urls.ps1

# Daten migrieren
pnpm migrate:production
pnpm sync:email-templates --dry-run

# Code deployen
git add . && git commit -m "..." && git push

# Version aktualisieren (in package.json)
# Dann: git commit && git push
```

### Wichtige Dateien

- `.env.local` - Lokale Environment Variables (nicht committed)
- `.env.production` - Production Environment Variables (nicht committed)
- `scripts/migrate-to-production.ts` - Unit-Daten Migration
- `scripts/sync-email-templates-to-production.ts` - Email-Template Sync

### Wichtige URLs

- **Convex Dashboard:** https://dashboard.convex.dev
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Lokale App:** http://localhost:5173

---

## 🎓 Best Practices

### DO's ✅

- ✅ Immer lokal mit `npx convex dev` entwickeln
- ✅ Neue Features erst in Dev testen
- ✅ Migrations-Scripts für Daten-Synchronisation nutzen
- ✅ Environment Variables sauber trennen (Dev vs. Prod)
- ✅ Nach Schema-Änderungen immer Migration durchführen
- ✅ Production nach Deployment testen

### DON'Ts ❌

- ❌ **NIEMALS** direkt gegen Production entwickeln
- ❌ **NIEMALS** Production-Daten manuell in Console ändern
- ❌ **NIEMALS** beide Deployments gleichzeitig mit `convex dev` verbinden
- ❌ **NIEMALS** Production-Keys lokal verwenden
- ❌ **NIEMALS** Migration überspringen bei Schema-Änderungen

---

## 📚 Weitere Ressourcen

- [Convex Documentation](https://docs.convex.dev)
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT_GUIDE.md)
- [Clerk Production Migration](./CLERK_PRODUCTION_MIGRATION.md)
- [Post-Beta Migration Plan](./POST_BETA_MIGRATION_PLAN.md) - Plan für Migration nach Beta-Ende
- [Deployment Index](./DEPLOYMENT_INDEX.md)

---

**Letzte Aktualisierung:** Dezember 2025
