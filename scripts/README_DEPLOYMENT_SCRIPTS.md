# Deployment Scripts

Diese Scripts helfen dir bei der Automatisierung von Deployment-Aufgaben.

## Verfügbare Scripts

### 1. Clerk Production Environment Variables Update

Automatisiert das Setzen der Clerk Production Keys in Vercel.

#### Windows (PowerShell)

```powershell
.\scripts\update-vercel-env-production.ps1
```

#### Linux/Mac (Bash)

```bash
chmod +x scripts/update-vercel-env-production.sh
./scripts/update-vercel-env-production.sh
```

#### Was macht das Script?

1. **Prüft Voraussetzungen**:
   - Vercel CLI Installation
   - Projekt-Verbindung zu Vercel

2. **Fragt Clerk Keys ab**:
   - Publishable Key (`pk_live_...`)
   - Secret Key (`sk_live_...`)
   - Validiert Key-Format

3. **Environment-Auswahl**:
   - Production only
   - Production + Preview
   - Preview only

4. **Setzt Environment Variables**:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

5. **Optional: Deployment triggern**:
   - Erstellt leeren Commit
   - Pusht zu GitHub
   - Vercel deployt automatisch

#### Voraussetzungen

- Vercel CLI installiert: `npm install -g vercel`
- Projekt mit Vercel verbunden: `vercel link`
- Git Repository initialisiert
- Clerk Production Keys bereit

#### Sicherheit

- Secret Keys werden nicht im Terminal angezeigt (masked input)
- Keys werden nicht geloggt
- Keys werden nur an Vercel übertragen

#### Troubleshooting

**Problem**: "Vercel CLI ist nicht installiert"

```bash
npm install -g vercel
# oder
pnpm add -g vercel
```

**Problem**: "Projekt ist nicht mit Vercel verbunden"

```bash
vercel link
```

**Problem**: Script schlägt beim Setzen der Variables fehl

→ Setze die Variables manuell über das Vercel Dashboard:
1. Gehe zu [vercel.com/dashboard](https://vercel.com/dashboard)
2. Wähle dein Projekt
3. Settings → Environment Variables
4. Bearbeite die Keys manuell

---

## Weitere Scripts

### Migration Scripts

Diese Scripts befinden sich ebenfalls im `scripts/` Verzeichnis:

- `migrate-email-templates.ts` - Migriert Email-Templates zu Convex
- `migrate-new-units-1-2.ts` - Migriert Unit-Content
- `cleanup-*.ts` - Verschiedene Cleanup-Scripts

Siehe jeweilige Script-Dateien für Dokumentation.

---

## Best Practices

### 1. Teste lokal vor Production

```bash
# Lokale Entwicklung mit Development Keys
pnpm dev

# Build testen
pnpm build
```

### 2. Nutze Preview-Deployments

Teste neue Features zuerst in Preview-Deployments:

```bash
# Erstelle Feature-Branch
git checkout -b feature/new-feature

# Push zu GitHub
git push origin feature/new-feature

# Vercel erstellt automatisch Preview-Deployment
```

### 3. Trenne Development und Production

- **Lokal**: Development Keys (`pk_test_...`)
- **Vercel Production**: Production Keys (`pk_live_...`)
- **Vercel Preview**: Optional Production oder Development Keys

### 4. Dokumentiere Änderungen

Wenn du Scripts anpasst oder neue erstellst:
- Füge Kommentare hinzu
- Update diese README
- Dokumentiere in Commit-Messages

---

## Weiterführende Dokumentation

- [CLERK_PRODUCTION_MIGRATION.md](../docs/CLERK_PRODUCTION_MIGRATION.md) - Vollständiger Guide
- [CLERK_PRODUCTION_QUICK_START.md](../docs/CLERK_PRODUCTION_QUICK_START.md) - Schnellreferenz
- [VERCEL_DEPLOYMENT_GUIDE.md](../docs/VERCEL_DEPLOYMENT_GUIDE.md) - Vercel Setup
- [DEPLOYMENT_INDEX.md](../docs/DEPLOYMENT_INDEX.md) - Übersicht aller Guides




