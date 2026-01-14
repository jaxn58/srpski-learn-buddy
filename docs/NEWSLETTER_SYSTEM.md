# Newsletter System Documentation

## Übersicht

Das Newsletter-System ermöglicht automatisches Newsletter-Management mit:
- Automatischer Synchronisation von Waitlist und Usern
- Campaign-Management mit Batch-Versand
- Link-Tracking und Analytics
- Unsubscribe-Management
- DevOps-konforme Environment-Trennung

## Architektur

```
Waitlist/Users → Newsletter Contacts → Campaigns → Email Logs → Analytics
                                            ↓
                                      Link Tracking
                                            ↓
                                    Resend Webhooks
```

## Environment-Konfiguration

### Development (.env.local)

```env
# Newsletter Test Mode
NEWSLETTER_TEST_MODE=true
NEWSLETTER_WHITELIST=your-email@example.com,admin@example.com

# Resend API (Development)
RESEND_API_KEY=<development-key>
RESEND_WEBHOOK_SECRET=<development-secret>
RESEND_FROM_EMAIL=noreply@mail.jacksenn.me
RESEND_REPLY_TO_EMAIL=hello@jacksenn.me

# App URL
VITE_APP_URL=http://localhost:5173
```

### Production (Convex Dashboard)

**Environment Variables in Convex Dashboard setzen:**

```env
# Newsletter Production
NEWSLETTER_TEST_MODE=false

# Resend API (Production)
RESEND_API_KEY=<production-key>
RESEND_WEBHOOK_SECRET=<production-secret>
RESEND_FROM_EMAIL=noreply@mail.jacksenn.me
RESEND_REPLY_TO_EMAIL=hello@jacksenn.me

# App URL
VITE_APP_URL=https://learn-with.me
```

## Test-Mode

Im Test-Mode werden Emails nur an die Whitelist gesendet:

```typescript
// In sendCampaign Mutation
if (campaign.testMode || process.env.NEWSLETTER_TEST_MODE === "true") {
  const whitelist = (process.env.NEWSLETTER_WHITELIST || "").split(",");
  contacts = contacts.filter(c => whitelist.includes(c.email));
}
```

**Wichtig:** Test-Mode ist automatisch aktiv in Dev-Environment!

## Datenbank-Schema

### newsletterContacts
- Zentrale Kontaktverwaltung
- Automatische Synchronisation von Waitlist/Users
- Unsubscribe-Token für DSGVO-Compliance
- Tags für Segmentierung
- Environment-Flag (dev/prod)

### newsletterCampaigns
- Campaign-Management
- Status-Tracking (draft → sending → sent)
- Denormalisierte Stats für Performance
- Test-Mode-Flag

### newsletterEmailLogs
- Detailliertes Email-Tracking
- Resend Message ID für Webhooks
- Engagement-Tracking (opens, clicks)
- Retry-Logik

### newsletterLinkClicks
- Link-Click-Tracking
- Tracking-Token für Redirects
- Optional: IP-Adressen (DSGVO beachten!)

## API-Endpoints

### HTTP Routes

**Unsubscribe:**
```
GET /newsletter/unsubscribe?token={unsubscribeToken}
```

**Link Tracking:**
```
GET /newsletter/track/{trackingToken}
```

**Resend Webhook:**
```
POST /newsletter/webhook/resend
```

### Convex Functions

**Contact Management:**
- `newsletter.getAllContacts` - Liste aller Kontakte (Admin)
- `newsletter.getContactByEmail` - Kontakt per Email (Admin)
- `newsletter.addContact` - Manuell Kontakt hinzufügen (Admin)
- `newsletter.unsubscribeContact` - Kontakt abmelden

**Campaign Management:**
- `newsletter.createCampaign` - Campaign erstellen (Admin)
- `newsletter.getAllCampaigns` - Alle Campaigns (Admin)
- `newsletter.getCampaignById` - Campaign per ID (Admin)
- `newsletter.updateCampaign` - Campaign bearbeiten (Admin)
- `newsletter.deleteCampaign` - Campaign löschen (Admin)
- `newsletter.sendCampaign` - Campaign versenden (Admin)

**Analytics:**
- `newsletter.getCampaignStats` - Campaign-Statistiken (Admin)
- `newsletter.getContactEngagement` - Contact-Engagement (Admin)
- `newsletter.getNewsletterMetrics` - Gesamt-Metriken (Admin)
- `newsletter.getLinkClickStats` - Link-Click-Statistiken (Admin)

## Workflow

### 1. Initial Setup

```bash
# Migration ausführen
pnpm migrate:newsletter

# Prüft:
# - Convex URL konfiguriert
# - Migriert confirmed Waitlist-Einträge
# - Zeigt Statistiken
```

### 2. Campaign erstellen

```typescript
// In Admin-UI oder via Convex Dashboard
await client.mutation(api.newsletter.createCampaign, {
  name: "Beta Launch Announcement",
  subject: "Welcome to Serbian AI Tutor Beta!",
  templateName: "newsletter-beta-launch",
  targetTags: ["waitlist"],
  testMode: true, // Nur an Whitelist senden
});
```

### 3. Campaign versenden

```typescript
await client.mutation(api.newsletter.sendCampaign, {
  campaignId: "<campaign-id>",
});

// Erstellt Email Logs
// Scheduled Batch-Versand (50 Emails pro Batch)
// Rate-Limiting: 100 Emails/Minute
```

### 4. Tracking

**Link-Clicks werden automatisch getrackt:**
- Links in Email werden transformiert
- Redirect über `/newsletter/track/{token}`
- Click wird in DB gespeichert
- Campaign-Stats werden updated

**Email-Events via Webhook:**
- Resend sendet Events (delivered, opened, bounced)
- Webhook updated Email Log
- Campaign-Stats werden inkrementell updated

## DSGVO-Compliance

### Double-Opt-In
- Waitlist: Double-Opt-In via Confirmation-Email
- User: Opt-In erforderlich (autoSubscribe: false)

### Unsubscribe
- Unsubscribe-Link in jedem Newsletter
- One-Click-Unsubscribe (RFC 8058)
- Sofortige Wirkung (keine Verzögerung)

### Data Retention
- IP-Adressen nur mit Consent speichern
- Link-Clicks: 90 Tage Retention (optional)
- Alte Daten automatisch löschen (Cron Job)

### Data Export
- Admin kann Contact-Daten exportieren
- DSGVO-Auskunftsrecht

## Deployment

### Reihenfolge (KRITISCH!)

1. **Schema-Änderungen pushen**
   ```bash
   git add convex/schema.ts
   git commit -m "feat(newsletter): add schema"
   git push
   ```

2. **Convex Functions deployen**
   ```bash
   npx convex deploy -y
   ```

3. **Migration ausführen**
   ```bash
   pnpm migrate:newsletter
   ```

4. **Frontend deployen**
   ```bash
   vercel --prod
   ```

5. **Webhook konfigurieren**
   - Resend Dashboard → Webhooks
   - URL: `https://learn-with.me/newsletter/webhook/resend`
   - Events: delivered, opened, bounced, complained
   - Secret in Convex Environment Variables setzen

## Monitoring

### Logs prüfen

```bash
# Convex Dashboard → Logs
# Filter: [Newsletter]
```

### Metriken

```typescript
const metrics = await client.query(api.newsletter.getNewsletterMetrics);
// {
//   contacts: { total, subscribed, unsubscribed },
//   campaigns: { total, draft, sent },
//   last30Days: { emailsSent, openRate, clickRate, bounceRate }
// }
```

### Alerts (optional)

Cron Job prüft täglich:
- Bounce-Rate > 5% → Alert
- Failed-Emails > 10% → Alert
- Unsubscribe-Rate > 10% → Alert

## Troubleshooting

### Problem: Emails werden nicht versendet

**Lösung:**
1. Prüfe `RESEND_API_KEY` in Convex Dashboard
2. Prüfe Campaign-Status (muss "sending" sein)
3. Prüfe Email Logs: `newsletter.getEmailLogByResendId`
4. Prüfe Convex Logs für Fehler

### Problem: Links werden nicht getrackt

**Lösung:**
1. Prüfe Link-Format in Email
2. Prüfe `/newsletter/track/{token}` Endpoint
3. Prüfe `newsletterLinkClicks` Tabelle

### Problem: Webhooks funktionieren nicht

**Lösung:**
1. Prüfe Webhook-URL in Resend Dashboard
2. Prüfe `RESEND_WEBHOOK_SECRET` in Convex
3. Prüfe Webhook-Logs in Resend Dashboard
4. Prüfe Convex Logs für Webhook-Errors

## Best Practices

### DO's ✅
- Immer Test-Mode in Dev verwenden
- Campaigns vor Versand testen
- Unsubscribe-Link in jedem Template
- Rate-Limiting beachten (100 Emails/Minute)
- Campaign-Stats nach Versand prüfen

### DON'Ts ❌
- NIEMALS ohne Test-Mode in Dev senden
- NIEMALS Production-Contacts in Dev verwenden
- NIEMALS Unsubscribe-Link vergessen
- NIEMALS mehr als 100 Emails/Minute senden
- NIEMALS IP-Adressen ohne Consent speichern

## Nächste Schritte

1. Admin-UI implementieren (Phase 8)
2. Email-Templates für Newsletter erstellen
3. Erste Test-Campaign versenden
4. Analytics-Dashboard erstellen
5. Cron Job für Data-Retention einrichten

## Support

Bei Fragen oder Problemen:
- Dokumentation: `docs/NEWSLETTER_SYSTEM.md`
- Plan: `.cursor/plans/newsletter-system_implementation_*.plan.md`
- Code: `convex/newsletter.ts`
