# Vercel Deployment Guide - Beta-Version mit Passwort-Schutz

Diese Anleitung führt dich durch das Deployment deiner Serbian AI Tutor App auf Vercel mit Beta-Schutz.

## 📋 Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Vercel-Konfiguration](#vercel-konfiguration)
3. [Environment Variables](#environment-variables)
4. [Beta-Schutz einrichten](#beta-schutz-einrichten)
5. [Deployment durchführen](#deployment-durchführen)
6. [Post-Deployment](#post-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Voraussetzungen

### 1. Vercel Account

- Erstelle einen Account auf [vercel.com](https://vercel.com)
- **Wichtig für Beta-Schutz**: Du benötigst einen **Pro Plan** (kostenpflichtig) oder **Enterprise Plan**, um Password Protection zu nutzen
- Alternativ: Nutze Vercel Authentication (verfügbar auch im Hobby Plan)

### 2. Vercel CLI installieren

```bash
npm i -g vercel
# oder
pnpm add -g vercel
```

### 3. Git Repository

Stelle sicher, dass dein Projekt in einem Git Repository ist und alle Änderungen committed sind:

```bash
git status
git add .
git commit -m "Prepare for Vercel deployment"
```

---

## Vercel-Konfiguration

### 1. `vercel.json` erstellen

Erstelle eine `vercel.json` Datei im Root-Verzeichnis deines Projekts:

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "outputDirectory": "dist/public",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "functions": {
    "server/_core/index.ts": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

**Hinweis**: Falls du den Express Server nicht als Serverless Function benötigst (da Convex das Backend übernimmt), kannst du den `functions` Block entfernen.

### 2. `.vercelignore` erstellen (optional)

Erstelle eine `.vercelignore` Datei, um unnötige Dateien vom Deployment auszuschließen:

```
node_modules
.git
.vscode
.idea
*.log
.env.local
.env.*.local
dist
coverage
.nyc_output
docs
scripts
patches
New Content
```

---

## Environment Variables

### 1. Frontend Environment Variables

Diese Variablen müssen in Vercel gesetzt werden (über das Dashboard oder CLI):

#### Erforderliche Variablen:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

#### Optionale Frontend-Variablen:

```bash
VITE_PADDLE_CLIENT_TOKEN=paddletest_...
VITE_PADDLE_PRODUCT_INTENSIVE=...
VITE_PADDLE_PRODUCT_BALANCED=...
VITE_PADDLE_PRODUCT_STANDARD=...
VITE_PADDLE_PRODUCT_RELAXED=...
```

### 2. Server Environment Variables (falls Express Server benötigt)

Falls du den Express Server als Serverless Function nutzt (z.B. für Paddle Webhooks):

```bash
CLERK_SECRET_KEY=sk_test_...
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SERVER_TOKEN=...
JWT_SECRET=...
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_PRODUCT_INTENSIVE=...
PADDLE_PRODUCT_BALANCED=...
PADDLE_PRODUCT_STANDARD=...
PADDLE_PRODUCT_RELAXED=...
```

### 3. Environment Variables in Vercel setzen

#### Option A: Über das Vercel Dashboard

1. Gehe zu deinem Projekt auf [vercel.com](https://vercel.com)
2. Navigiere zu **Settings** → **Environment Variables**
3. Füge alle Variablen hinzu
4. Stelle sicher, dass sie für **Production**, **Preview** und **Development** aktiviert sind (je nach Bedarf)

#### Option B: Über die CLI

```bash
vercel env add VITE_CLERK_PUBLISHABLE_KEY
vercel env add VITE_CONVEX_URL
# ... weitere Variablen
```

---

## Beta-Schutz einrichten

Vercel bietet mehrere Optionen zum Schutz deiner Beta-Version:

### Option 1: Password Protection (Empfohlen für einfachen Schutz)

**Voraussetzung**: Pro Plan oder Enterprise Plan

#### Einrichtung:

1. Gehe zu deinem Projekt im Vercel Dashboard
2. Navigiere zu **Settings** → **Deployment Protection**
3. Aktiviere **Password Protection**
4. Setze ein sicheres Passwort
5. Wähle die Umgebungen aus (Production, Preview, Development)
6. Speichere die Einstellungen

**Vorteile**:
- Einfache Einrichtung
- Keine Code-Änderungen nötig
- Funktioniert automatisch für alle Deployments

**Nachteile**:
- Erfordert Pro Plan (kostenpflichtig)
- Ein Passwort für alle Benutzer

### Option 2: Vercel Authentication (Empfohlen für bessere Kontrolle)

**Voraussetzung**: Verfügbar auch im Hobby Plan

#### Einrichtung:

1. Gehe zu **Settings** → **Deployment Protection**
2. Aktiviere **Vercel Authentication**
3. Konfiguriere die Zugriffsregeln:
   - **Allowlist**: Nur bestimmte E-Mail-Adressen erlauben
   - **Blocklist**: Bestimmte E-Mail-Adressen blockieren
   - **Domain Allowlist**: Nur bestimmte Domains erlauben (z.B. `@deine-firma.com`)
4. Speichere die Einstellungen

**Vorteile**:
- Verfügbar auch im Hobby Plan
- Individuelle Zugriffskontrolle pro Benutzer
- Automatische E-Mail-Verifizierung

**Nachteile**:
- Benutzer müssen sich mit E-Mail anmelden

### Option 3: Clerk-basierter Schutz (Code-Implementierung)

Da deine App bereits Clerk verwendet, kannst du auch eine eigene Beta-Schutz-Logik implementieren:

1. Erstelle eine Middleware-Komponente, die prüft, ob der Benutzer ein Beta-Tester ist
2. Zeige eine Zugriffsverweigerungsseite für nicht autorisierte Benutzer
3. Nutze die bestehende `isBetaTester` Logik aus deinem Convex Schema

**Vorteile**:
- Volle Kontrolle über die Logik
- Funktioniert mit jedem Vercel Plan

**Nachteile**:
- Erfordert Code-Änderungen
- Benutzer sehen die App, bevor sie blockiert werden

---

## Deployment durchführen

### Schritt 1: Projekt mit Vercel verbinden

#### Option A: Über das Dashboard (Empfohlen für erste Einrichtung)

1. Gehe zu [vercel.com/new](https://vercel.com/new)
2. Verbinde dein Git Repository (GitHub, GitLab, Bitbucket)
3. Wähle dein Repository aus
4. Vercel erkennt automatisch Vite als Framework
5. Überprüfe die Build-Einstellungen:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist/public`
   - **Install Command**: `pnpm install`
6. Klicke auf **Deploy**

#### Option B: Über die CLI

```bash
# Im Projektverzeichnis
vercel login
vercel link
vercel --prod
```

### Schritt 2: Build-Prozess überwachen

Während des Deployments kannst du:
- Den Build-Log im Vercel Dashboard verfolgen
- Bei Fehlern die Logs analysieren
- Die Deployment-URL testen

### Schritt 3: Domain konfigurieren (optional)

1. Gehe zu **Settings** → **Domains**
2. Füge deine Custom Domain hinzu
3. Folge den DNS-Anweisungen von Vercel

---

## Post-Deployment

### 1. Convex Environment Variables aktualisieren

Stelle sicher, dass Convex die Produktions-URL kennt:

```bash
npx convex env set SERVER_URL https://deine-app.vercel.app
```

### 2. Clerk-Konfiguration prüfen

1. Gehe zu deinem Clerk Dashboard
2. Überprüfe die **Allowed Origins**:
   - Füge deine Vercel-URL hinzu: `https://deine-app.vercel.app`
   - Füge deine Custom Domain hinzu (falls vorhanden)
3. Überprüfe die **Redirect URLs**:
   - `https://deine-app.vercel.app/**`

### 3. Paddle Webhook konfigurieren (falls verwendet)

1. Gehe zu deinem Paddle Dashboard
2. Konfiguriere den Webhook-Endpoint:
   - URL: `https://deine-app.vercel.app/api/paddle/webhook`
   - Stelle sicher, dass der Endpoint erreichbar ist

### 4. Funktionstest

Teste die wichtigsten Funktionen:

- [ ] App lädt korrekt
- [ ] Login/Registrierung funktioniert
- [ ] Convex-Verbindung funktioniert
- [ ] Beta-Schutz ist aktiv
- [ ] Alle Features funktionieren wie erwartet

---

## Troubleshooting

### Problem: Build schlägt fehl

**Lösung**:
1. Prüfe die Build-Logs im Vercel Dashboard
2. Stelle sicher, dass alle Dependencies in `package.json` korrekt sind
3. Überprüfe, ob `pnpm-lock.yaml` committed ist
4. Prüfe die Node.js Version (sollte in `package.json` oder `.nvmrc` definiert sein)

### Problem: Environment Variables werden nicht erkannt

**Lösung**:
1. Stelle sicher, dass Variablen mit `VITE_` Präfix für Frontend-Variablen verwendet werden
2. Überprüfe, dass Variablen für die richtige Umgebung (Production/Preview) gesetzt sind
3. Führe ein neues Deployment aus nach dem Hinzufügen von Variablen

### Problem: Convex-Verbindung schlägt fehl

**Lösung**:
1. Überprüfe, dass `VITE_CONVEX_URL` korrekt gesetzt ist
2. Stelle sicher, dass die Convex-Deployment-URL korrekt ist
3. Prüfe die Convex-Logs im Convex Dashboard

### Problem: Password Protection funktioniert nicht

**Lösung**:
1. Überprüfe, ob du einen Pro Plan hast (für Password Protection)
2. Stelle sicher, dass Password Protection für die richtige Umgebung aktiviert ist
3. Versuche ein neues Deployment zu erstellen
4. Falls nicht verfügbar, nutze Vercel Authentication als Alternative

### Problem: CORS-Fehler

**Lösung**:
1. Überprüfe die Clerk-Konfiguration (Allowed Origins)
2. Stelle sicher, dass alle URLs korrekt konfiguriert sind
3. Prüfe die Browser-Konsole für detaillierte Fehlermeldungen

### Problem: Assets werden nicht geladen

**Lösung**:
1. Überprüfe die `publicDir` Konfiguration in `vite.config.ts`
2. Stelle sicher, dass Assets im `client/public` Verzeichnis sind
3. Prüfe die `base` URL in `vite.config.ts` (sollte leer sein für Root-Deployment)

---

## Nützliche Befehle

### Deployment-Status prüfen

```bash
vercel ls
```

### Logs anzeigen

```bash
vercel logs [deployment-url]
```

### Environment Variables auflisten

```bash
vercel env ls
```

### Projekt-Informationen

```bash
vercel inspect [deployment-url]
```

---

## Weitere Ressourcen

- [Vercel Dokumentation](https://vercel.com/docs)
- [Vercel Password Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/password-protection)
- [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)

---

## Checkliste vor dem Deployment

- [ ] `vercel.json` erstellt und konfiguriert
- [ ] Alle Environment Variables in Vercel gesetzt
- [ ] Convex Environment Variables aktualisiert
- [ ] Clerk-Konfiguration angepasst
- [ ] Beta-Schutz konfiguriert
- [ ] Build lokal getestet (`pnpm build`)
- [ ] Git Repository ist auf dem neuesten Stand
- [ ] Vercel Account hat den richtigen Plan (für Password Protection)

---

**Viel Erfolg beim Deployment! 🚀**
