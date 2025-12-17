## Deployment-Checkliste für Beta-E-Mails (Clerk + Convex + Resend)

Dieses Dokument fasst zusammen, was du tun musst, damit die **Beta-Registrierungs-E-Mails** in einer **Produktionsumgebung** zuverlässig verschickt werden.

---

### 1. Zielarchitektur verstehen

- **Frontend + Backend**: Dein Express/Vite-Server (dieses Repo), z.B. auf Render, Railway, Fly.io oder einem eigenen Server.
- **Auth**: Clerk (Login, Session, User-Verwaltung).
- **Daten & Hintergrundjobs**: Convex (Beta-Registrierungen, Scheduling, `sendEmailAction`).
- **E-Mail-Versand**: Resend (Transaktionsmails, z.B. Beta-Bestätigung und Aktivierungs-Mails).

Der entscheidende Weg für Beta-Bestätigungen in Produktion:

1. User füllt das Beta-Formular im Frontend aus.
2. Convex-Mutation `beta.register` speichert die Registrierung.
3. Convex-Action `beta.sendEmailAction` ruft `SERVER_URL/api/email/send` auf.
4. Dein Express-Server verarbeitet `/api/email/send` und ruft die Funktionen aus `server/_core/email.ts` auf.
5. `sendEmail` nutzt Resend, um die E-Mail zu verschicken.

Damit das funktioniert, müssen **URL und ENV-Variablen** korrekt gesetzt sein.

---

### 2. Server deployen (Express/Vite)

Egal, welchen Hoster du nutzt (z.B. Render, Railway, Fly.io, eigener VPS), am Ende brauchst du eine **öffentliche URL**, z.B.:

- `https://serbian-ai-tutor.example.com`

Wichtige Punkte beim Deployment:

- Der Server muss `pnpm build` / `pnpm start` bzw. einen vergleichbaren Startbefehl aus `package.json` verwenden.
- Der Server muss **HTTPS** anbieten (Resend & Clerk mögen keine unsicheren HTTP-URLs in Produktion).

---

### 3. ENV-Variablen für den Server (Hosting-Plattform)

Auf deinem Hoster im Projekt / Service die folgenden Variablen setzen (entsprechen deiner lokalen `.env`, aber ohne „localhost“-URLs):

#### 3.1 Clerk

- `CLERK_SECRET_KEY=...`
- `CLERK_PUBLISHABLE_KEY=...`

Beide Werte bekommst du im Clerk-Dashboard bei deinem Projekt.

#### 3.2 Resend

- `RESEND_API_KEY=...`  
  → API Key aus dem Resend-Dashboard.
- `RESEND_FROM_EMAIL=noreply@deine-domain.tld`  
  → Diese Domain / E-Mail muss bei Resend verifiziert sein.
- `RESEND_REPLY_TO_EMAIL=hello@deine-domain.tld` (optional, aber empfohlen)

#### 3.3 Weitere wichtige Server-ENV (Beispiele)

- `JWT_SECRET=...`
- `CONVEX_URL=...` (Convex deployment URL)
- ggf. weitere Werte, die du lokal in `.env` nutzt (ohne `VITE_`).

> **Hinweis:** `SERVER_URL` brauchst du auf dem **Server selbst** normalerweise nicht. Wichtig ist sie für **Convex** (siehe nächster Abschnitt). Die Datenhaltung erfolgt vollständig über Convex, eine separate Datenbank ist nicht mehr erforderlich.

---

### 4. ENV-Variablen für Convex (Cloud)

Convex führt deine Funktionen in der Cloud aus und muss wissen, **unter welcher URL** dein Server erreichbar ist.

1. Im Projektverzeichnis kannst du alle derzeit gesetzten ENV-Variablen für Convex ansehen mit:

   ```bash
   npx convex env list
   ```

2. Setze in Convex unbedingt:

   ```bash
   npx convex env set SERVER_URL https://serbian-ai-tutor.example.com
   ```

   (Ersetze die URL durch deine echte Produktions-URL.)

   Alternativ im Convex-Dashboard im Bereich **Environment Variables**.

3. Optional, falls im Code genutzt:

- `CLERK_JWT_ISSUER_DOMAIN=...` (ist in diesem Projekt bereits vorhanden)
- weitere Keys, die in `convex/*.ts` über `process.env.XYZ` verwendet werden.

**Wichtig:** In `convex/beta.ts` wird `SERVER_URL` so verwendet:

```ts
const serverUrl = process.env.SERVER_URL || process.env.VITE_SERVER_URL || "http://localhost:3000";
```

Wenn `SERVER_URL` in Convex **nicht** gesetzt ist, fällt der Code auf den Default `http://localhost:3000` zurück – das darf in Produktion nicht passieren.

---

### 5. ENV-Variablen für das Frontend (Vite / Build-Umgebung)

Für den gebauten Client (Vite) müssen die `VITE_...`-Variablen im **Build-Kontext** gesetzt sein (z.B. Render „Environment → Environment Variables“):

- `VITE_CLERK_PUBLISHABLE_KEY=...`
- `VITE_CONVEX_URL=...`  
  → Convex-Deployment-URL, findest du im Convex-Dashboard.
- Optional:
  - `VITE_SERVER_URL=https://serbian-ai-tutor.example.com` (falls im Frontend genutzt)

Diese Variablen müssen gesetzt sein, **bevor** der Build läuft (`pnpm build` o.Ä.).

---

### 6. Route-Schutz: `/api/email/send` öffentlich lassen

In `server/_core/index.ts` sollte die E-Mail-Webhook-Route **vor** dem Clerk-Middleware-Aufruf registriert werden, damit Convex sie ohne Authentifizierung aufrufen kann.

Zielstruktur (vereinfacht):

```ts
// Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 1. Öffentlicher E-Mail-Webhook für Convex
app.post("/api/email/send", async (req, res) => {
  // ...
});

// 2. Clerk-Middleware für geschützte Routen
app.use(clerkMiddleware());

// 3. tRPC-API (geschützt durch Clerk)
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);
```

> **Ziel:** Convex kann `/api/email/send` ohne Clerk-Auth erreichen, der Rest der App bleibt durch Clerk geschützt.

---

### 7. End-to-End-Test nach dem Deployment

1. Produktions-URL im Browser öffnen:  
   `https://serbian-ai-tutor.example.com`

2. Beta-Formular auf der Landingpage mit einer **neuen** E-Mail-Adresse ausfüllen und absenden.

3. Logs prüfen:
   - **Convex-Logs** (Dashboard oder `npx convex dev --tail-logs` gegen das Dev-/Prod-Deployment):
     - Es darf **kein** `http://localhost:3000` oder `localhost:3001` mehr auftauchen.
     - Stattdessen sollte `https://serbian-ai-tutor.example.com/api/email/send` geloggt werden.
   - **Server-Logs** (plattformabhängig, z.B. Render Logs):
     - Zeilen wie:
       - `[Email] Attempting to send email to ...`
       - `[Email] ✅ Successfully sent email to ...`  
       oder detaillierte Fehler von Resend.
   - **Resend-Dashboard**:
     - Neuer E-Mail-Eintrag sollte erscheinen (Status z.B. „Sent“, „Delivered“ oder Fehlerhinweis).

4. Posteingang prüfen:
   - Im Hauptposteingang und im Spam-Ordner nach der Beta-Bestätigungs-Mail suchen.

---

### 8. Typische Fehlerquellen und wie du sie erkennst

- **Problem:** Convex loggt weiterhin `http://localhost:3000/api/email/send`  
  **Ursache:** `SERVER_URL` in Convex nicht gesetzt.  
  **Lösung:** `npx convex env set SERVER_URL https://deine-domain.tld` und neu deployen.

- **Problem:** Resend zeigt keine Logs, obwohl Convex `/api/email/send` aufruft  
  **Ursache:** Server-E-Mail-Webhook schlägt fehl (z.B. fehlende `RESEND_API_KEY`).  
  **Lösung:** Server-Logs prüfen, Resend-ENV-Variablen setzen / korrigieren.

- **Problem:** Resend-Log zeigt „Sender domain not verified“  
  **Ursache:** `RESEND_FROM_EMAIL` nutzt eine nicht verifizierte Domain.  
  **Lösung:** Domain bei Resend verifizieren oder eine bereits verifizierte Absenderadresse nutzen.

---

### 9. Zusammenfassung

- **Convex** braucht eine **öffentliche `SERVER_URL`**, die auf deinen deployten Express-Server zeigt.
- **Der Server** braucht gültige **Clerk-** und **Resend-ENV-Variablen**.
- `/api/email/send` muss **ohne Clerk-Auth** erreichbar sein, damit Convex den Hook aufrufen kann.
- Nach dem Deployment immer einen **End-to-End-Test mit neuer E-Mail-Adresse** machen und dabei Convex-Logs, Server-Logs und das Resend-Dashboard prüfen.

Wenn du später einen konkreten Hoster ausgewählt hast (z.B. Render, Railway oder Vercel + separater Node-Server), kannst du dieses Dokument als Grundlage nehmen und die jeweiligen UI-Schritte im Dashboard daran ausrichten.


