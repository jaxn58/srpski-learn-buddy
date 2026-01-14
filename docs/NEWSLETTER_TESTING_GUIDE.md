# Newsletter System - Testing Guide

## Übersicht

Dieser Guide beschreibt, wie das Newsletter-System getestet werden kann.

## Voraussetzungen

1. **Development Environment Setup:**
   ```bash
   # .env.local
   NEWSLETTER_TEST_MODE=true
   NEWSLETTER_WHITELIST=your-email@example.com
   RESEND_API_KEY=<dev-key>
   VITE_APP_URL=http://localhost:5173
   ```

2. **Convex Dev Server läuft:**
   ```bash
   npx convex dev
   ```

3. **Frontend Dev Server läuft:**
   ```bash
   pnpm dev
   ```

## Test-Szenarien

### 1. Schema-Migration testen

**Ziel:** Prüfen, ob die Newsletter-Tabellen korrekt erstellt wurden.

**Schritte:**
1. Öffne Convex Dashboard: https://dashboard.convex.dev
2. Wähle dein Dev-Deployment
3. Gehe zu "Data" → "Tables"
4. Prüfe, ob folgende Tabellen existieren:
   - `newsletterContacts`
   - `newsletterCampaigns`
   - `newsletterEmailLogs`
   - `newsletterLinkClicks`

**Erwartetes Ergebnis:** Alle 4 Tabellen existieren mit korrekten Indices.

---

### 2. Waitlist-Synchronisation testen

**Ziel:** Prüfen, ob Waitlist-Einträge automatisch zu Newsletter-Contacts synchronisiert werden.

**Schritte:**
1. Öffne http://localhost:5173
2. Trage dich in die Waitlist ein (falls noch nicht geschehen)
3. Bestätige die Email (Confirmation-Link)
4. Öffne Convex Dashboard → `newsletterContacts` Tabelle
5. Prüfe, ob ein neuer Eintrag mit deiner Email existiert

**Erwartetes Ergebnis:**
- Contact existiert mit `source: "waitlist"`
- `subscribed: true`
- `tags: ["waitlist"]`
- `environment: "dev"`

---

### 3. Initial Migration testen

**Ziel:** Bestehende Waitlist-Einträge migrieren.

**Schritte:**
1. Terminal öffnen
2. Migration ausführen:
   ```bash
   pnpm migrate:newsletter
   ```
3. Output prüfen:
   - Anzahl migrierter Einträge
   - Keine Fehler

**Erwartetes Ergebnis:**
```
✅ Waitlist migration complete: X synced, Y skipped
📊 Newsletter Statistics
   Total Contacts: X
   Subscribed: X
   From Waitlist: X
```

---

### 4. Campaign erstellen testen

**Ziel:** Eine Test-Campaign erstellen.

**Schritte:**
1. Login als Admin
2. Navigiere zu `/admin/newsletter-campaigns`
3. Klicke "Create Campaign"
4. Fülle aus:
   - Name: "Test Campaign"
   - Subject: "Test Email"
   - Template: Wähle ein Template
   - Test Mode: ✓ (aktiviert)
5. Klicke "Create Campaign"

**Erwartetes Ergebnis:**
- Success-Toast: "Campaign created successfully"
- Campaign erscheint in der Liste mit Status "draft"
- Badge "Test Mode" ist sichtbar

---

### 5. Campaign versenden testen

**Ziel:** Test-Campaign an Whitelist senden.

**Schritte:**
1. In `/admin/newsletter-campaigns`
2. Bei deiner Test-Campaign klicke "Send"
3. Bestätige den Dialog
4. Warte 1-2 Minuten
5. Prüfe dein Email-Postfach

**Erwartetes Ergebnis:**
- Success-Toast: "Campaign scheduled! Sending to X recipients in Y batches"
- Campaign-Status ändert sich zu "sending" → "sent"
- Email kommt in deinem Postfach an
- Email enthält Unsubscribe-Link

---

### 6. Link-Tracking testen

**Ziel:** Prüfen, ob Link-Clicks getrackt werden.

**Schritte:**
1. Öffne die empfangene Test-Email
2. Klicke auf einen Link in der Email
3. Prüfe, ob du zur korrekten Ziel-URL weitergeleitet wirst
4. Öffne Convex Dashboard → `newsletterLinkClicks` Tabelle
5. Prüfe, ob ein Eintrag mit `clickedAt > 0` existiert

**Erwartetes Ergebnis:**
- Redirect funktioniert korrekt
- Link-Click wird in DB gespeichert
- `emailLog.status` wird zu "clicked" updated
- `campaign.clickedCount` wird inkrementiert

---

### 7. Unsubscribe testen

**Ziel:** Prüfen, ob Unsubscribe funktioniert.

**Schritte:**
1. Öffne die empfangene Test-Email
2. Klicke auf "Unsubscribe"-Link
3. Prüfe die Unsubscribe-Seite
4. Öffne Convex Dashboard → `newsletterContacts` Tabelle
5. Finde deinen Contact
6. Prüfe `subscribed: false`

**Erwartetes Ergebnis:**
- Unsubscribe-Seite zeigt "Successfully Unsubscribed"
- Contact ist in DB als `subscribed: false` markiert
- `unsubscribedAt` Timestamp ist gesetzt

---

### 8. Analytics testen

**Ziel:** Campaign-Statistiken prüfen.

**Schritte:**
1. Navigiere zu `/admin/newsletter-campaigns`
2. Klicke "View Stats" bei deiner gesendeten Campaign
3. Prüfe die angezeigten Metriken

**Erwartetes Ergebnis:**
- Total, Sent, Delivered, Opened, Clicked Zahlen sind korrekt
- Open-Rate, Click-Rate werden berechnet
- Link-Click-Stats zeigen geklickte Links

---

### 9. Webhook-Integration testen (optional)

**Ziel:** Resend Webhooks testen.

**Voraussetzung:** Webhook in Resend Dashboard konfiguriert.

**Schritte:**
1. Sende eine Campaign
2. Öffne die Email (triggert "opened" Event)
3. Warte 1-2 Minuten
4. Öffne Convex Dashboard → `newsletterEmailLogs`
5. Prüfe, ob `status: "opened"` und `openedCount > 0`

**Erwartetes Ergebnis:**
- Email-Status wird via Webhook updated
- Campaign-Stats werden automatisch aktualisiert

---

### 10. Test-Mode Whitelist testen

**Ziel:** Prüfen, ob Test-Mode nur an Whitelist sendet.

**Schritte:**
1. Erstelle mehrere Waitlist-Einträge (verschiedene Emails)
2. Setze `NEWSLETTER_WHITELIST=your-email@example.com` in `.env.local`
3. Erstelle Campaign mit `testMode: true`
4. Sende Campaign
5. Prüfe, dass nur deine Email die Campaign erhält

**Erwartetes Ergebnis:**
- Nur Whitelist-Emails erhalten die Campaign
- Andere Contacts werden gefiltert
- Console-Log: "TEST MODE: Sending only to whitelist (1 contacts)"

---

## Manual Testing Checklist

- [ ] Schema-Migration erfolgreich
- [ ] Waitlist → Newsletter Contacts Sync funktioniert
- [ ] User → Newsletter Contacts Sync funktioniert
- [ ] Initial Migration erfolgreich
- [ ] Campaign erstellen funktioniert
- [ ] Campaign versenden funktioniert
- [ ] Email wird empfangen
- [ ] Link-Tracking funktioniert
- [ ] Unsubscribe funktioniert
- [ ] Analytics zeigen korrekte Daten
- [ ] Test-Mode Whitelist funktioniert
- [ ] Admin-UI ist bedienbar
- [ ] Keine Console-Errors

---

## Bekannte Einschränkungen

1. **Open-Tracking via Pixel:** Nicht implementiert (nur via Resend Webhook)
2. **IP-Tracking:** Optional, standardmäßig deaktiviert (DSGVO)
3. **Retry-Logik:** Implementiert, aber nicht getestet
4. **Rate-Limiting:** Implementiert (100 Emails/Minute), schwer zu testen

---

## Troubleshooting

### Problem: Migration findet keine Waitlist-Einträge

**Lösung:**
- Prüfe, ob Waitlist-Einträge in Convex existieren
- Prüfe, ob Status "confirmed" ist
- Prüfe CONVEX_URL in `.env.local`

### Problem: Campaign wird nicht versendet

**Lösung:**
- Prüfe Campaign-Status (muss "draft" sein)
- Prüfe RESEND_API_KEY in Convex Dashboard
- Prüfe Convex Logs für Fehler
- Prüfe, ob Contacts existieren

### Problem: Links werden nicht getrackt

**Lösung:**
- Prüfe, ob Links in Email transformiert wurden
- Prüfe `/newsletter/track/{token}` Endpoint
- Prüfe Convex Logs für Errors

### Problem: Unsubscribe funktioniert nicht

**Lösung:**
- Prüfe Unsubscribe-Token in Email
- Prüfe `/newsletter/unsubscribe` Endpoint
- Prüfe Convex Logs

---

## Next Steps nach Testing

1. **Production Deployment:**
   - Environment Variables in Convex Dashboard setzen
   - `NEWSLETTER_TEST_MODE=false` in Production
   - Webhook in Resend Dashboard konfigurieren

2. **Email-Templates erstellen:**
   - Newsletter-Templates in `emailTemplates` Tabelle
   - Mit `category: "marketing"`

3. **Erste echte Campaign:**
   - Ohne Test-Mode
   - An echte Waitlist-Contacts
   - Mit Analytics-Monitoring

4. **Monitoring einrichten:**
   - Bounce-Rate überwachen
   - Open-Rate überwachen
   - Unsubscribe-Rate überwachen

---

## Support

Bei Problemen:
- Dokumentation: `docs/NEWSLETTER_SYSTEM.md`
- Testing Guide: `docs/NEWSLETTER_TESTING_GUIDE.md`
- Code: `convex/newsletter.ts`
