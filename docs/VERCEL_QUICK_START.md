# Vercel Deployment - Quick Start Checkliste

## 🚀 Schnellstart (5 Minuten)

### 1. Vorbereitung (2 Min)

```bash
# Stelle sicher, dass alles committed ist
git status
git add .
git commit -m "Prepare for Vercel deployment"
```

### 2. Vercel Account & CLI (1 Min)

```bash
# Installiere Vercel CLI (falls noch nicht installiert)
npm i -g vercel

# Login
vercel login
```

### 3. Projekt verbinden (1 Min)

```bash
# Im Projektverzeichnis
vercel link
```

Folge den Prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → Wähle deinen Account
- **Link to existing project?** → `N` (für neues Projekt)
- **Project name?** → `serbian-ai-tutor` (oder dein gewünschter Name)
- **Directory?** → `.` (aktuelles Verzeichnis)

### 4. Environment Variables setzen (1 Min)

**Wichtigste Variablen:**

```bash
# Über CLI (empfohlen für erste Einrichtung)
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add VITE_CONVEX_URL production
```

Oder über Dashboard: **Settings** → **Environment Variables**

### 5. Beta-Schutz aktivieren

1. Gehe zu [vercel.com/dashboard](https://vercel.com/dashboard)
2. Wähle dein Projekt
3. **Settings** → **Deployment Protection**
4. Aktiviere **Password Protection** oder **Vercel Authentication**
5. Konfiguriere den Schutz

### 6. Deploy!

```bash
vercel --prod
```

Oder pushe zu deinem Git Repository - Vercel deployt automatisch!

---

## ✅ Post-Deployment Checkliste

- [ ] Convex `SERVER_URL` aktualisieren: `npx convex env set SERVER_URL https://deine-app.vercel.app`
- [ ] Clerk Allowed Origins hinzufügen: `https://deine-app.vercel.app`
- [ ] App im Browser testen
- [ ] Login/Registrierung testen
- [ ] Beta-Schutz testen (mit nicht-autorisiertem Zugriff)

---

## 📚 Ausführliche Anleitung

Für detaillierte Informationen siehe: [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)

---

## 🆘 Häufige Probleme

**Build schlägt fehl?**
- Prüfe Build-Logs im Dashboard
- Stelle sicher, dass `pnpm-lock.yaml` committed ist

**Environment Variables nicht erkannt?**
- Variablen müssen mit `VITE_` Präfix beginnen (für Frontend)
- Neues Deployment nach dem Hinzufügen von Variablen erforderlich

**Password Protection nicht verfügbar?**
- Erfordert Pro Plan (kostenpflichtig)
- Alternative: Vercel Authentication (auch im Hobby Plan verfügbar)
