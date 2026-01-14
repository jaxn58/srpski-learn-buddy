# Newsletter System - Test-Anweisung & Checkliste

## Vorbereitung (5 Minuten)

### ✅ Schritt 1: Environment-Variablen prüfen

1. Öffne `.env.local` im Projekt-Root
2. Stelle sicher, dass folgende Variablen gesetzt sind:

```bash
# Resend API (für Email-Versand)
RESEND_API_KEY=re_...  # Dein Resend API Key

# Newsletter Whitelist (WICHTIG für Tests!)
NEWSLETTER_WHITELIST=deine.email@example.com,zweite.email@example.com

# Admin Secret (für Migration-Scripts)
ADMIN_SECRET=dein-geheimes-passwort
```

3. **Ersetze die Whitelist-Emails mit deinen echten Email-Adressen** (mindestens 2 verschiedene)

### ✅ Schritt 2: Dev-Server starten

```bash
# Terminal 1: Convex Dev
npx convex dev

# Terminal 2: Frontend Dev
pnpm dev
```

Warte bis beide Server laufen.

### ✅ Schritt 3: Als Admin einloggen

1. Öffne `http://localhost:5173`
2. Logge dich als Admin-User ein
3. Prüfe in der Sidebar: Du solltest den Link "Newsletter" sehen

---

## Test-Phase 1: Newsletter-Kontakte prüfen (5 Minuten)

### ✅ Schritt 4: Kontakte-Tab öffnen

1. Klicke auf "Newsletter" in der Admin-Sidebar
2. Wechsle zum Tab "Contacts"
3. **Erwartetes Ergebnis:**
   - Du siehst Statistik-Karten: Total Contacts, Subscribed, Unsubscribed, From Waitlist
   - Wenn keine Migration gelaufen ist: Alles bei 0
   - Wenn Migration gelaufen ist: Mindestens einige Kontakte sichtbar

### ✅ Schritt 5: Migration durchführen (falls noch nicht geschehen)

```bash
# Im Terminal ausführen
pnpm migrate:newsletter
```

**Erwartetes Ergebnis:**
```
✅ Migrated X confirmed waitlist entries.
✅ Migrated X active users.
📊 Newsletter Statistics: ...
```

4. **Refresh die Newsletter-Seite** im Browser
5. **Prüfe:** Jetzt sollten Kontakte sichtbar sein

### ✅ Schritt 6: Kontakte-Filter testen

1. **Suche testen:**
   - Gib eine Email-Adresse ins Suchfeld ein
   - **Erwartung:** Nur passende Kontakte werden angezeigt

2. **Status-Filter testen:**
   - Wähle "Subscribed Only"
   - **Erwartung:** Nur subscribed Kontakte sichtbar
   - Wähle "Unsubscribed Only"
   - **Erwartung:** Nur unsubscribed Kontakte sichtbar

3. **Source-Filter testen:**
   - Wähle "Waitlist"
   - **Erwartung:** Nur Kontakte von der Waitlist
   - Wähle "Users"
   - **Erwartung:** Nur registrierte User

**✅ Test-Phase 1 bestanden, wenn:**
- [ ] Kontakte werden angezeigt
- [ ] Filter funktionieren korrekt
- [ ] Statistiken sind plausibel

---

## Test-Phase 2: Email-Templates vorbereiten (5 Minuten)

### ✅ Schritt 7: Email-Templates prüfen

1. Gehe zu "Email Templates" im Admin-Panel
2. **Prüfe:** Gibt es bereits Newsletter-Templates?
   - `newsletter-welcome`
   - `newsletter-beta-launch`

---

## Changelog Addendum (2026-01-14) — Email Templates UX & Signatures (10–15 minutes)

> This addendum covers recent improvements to the Email Templates admin UI:
> - category signatures (transactional/subscription/marketing) injected via `{{EMAIL_SIGNATURE}}`
> - signature-missing warning + one-click insertion
> - variable library with descriptions + example values (tooltips)
> - collapsible helpers (Variable Library / Email-safe snippets)
> - test email sending from the editor + “Save & Send Test Email”

### ✅ A1: Verify signatures exist per category

1. Open `http://localhost:5173/admin/email-templates`
2. Click **Signatures**
3. Check all categories:
   - Transactional
   - Subscription
   - Marketing
4. **Expected:**
   - Each category has an HTML signature
   - Preview renders
   - You can toggle “active” and save

### ✅ A2: Verify placeholder injection and warning

1. Open an existing template (Edit) or click **Create Template**
2. **Expected:**
   - The default content includes `{{EMAIL_SIGNATURE}}` in the footer area
3. Remove `{{EMAIL_SIGNATURE}}` from the HTML content
4. **Expected:**
   - A visible warning appears: “Signature placeholder is missing”
   - Buttons exist:
     - **Insert signature footer**
     - **Copy placeholder**
5. Click **Insert signature footer**
6. **Expected:**
   - `{{EMAIL_SIGNATURE}}` is re-inserted into the HTML content

### ✅ A3: Verify Variable Library tooltips (description + example)

1. In the editor, expand **Variable Library** (if collapsed)
2. Hover a variable badge (e.g. `{{USER_EMAIL}}`, `{{CONFIRM_LINK}}`)
3. **Expected:**
   - Tooltip shows:
     - short description (what it represents)
     - example value

### ✅ A4: Verify collapsible helpers (space saving)

1. Collapse **Variable Library**
2. Expand **Email-safe snippets**
3. **Expected:**
   - Both sections can be expanded/collapsed independently
   - Editor area gets more vertical space when collapsed

### ✅ A5: Send a real test email from the template editor

> Note: This sends the **saved** template version (matching real delivery). Save changes first.

1. Open a template that has:
   - Template name
   - Subject
   - HTML content
2. Click **Send Test Email**
3. Enter a recipient (your email)
4. Fill variables if requested
5. Click **Send**
6. **Expected:**
   - UI shows success toast
   - Email arrives in your inbox (check Spam if needed)
   - Signature is injected where `{{EMAIL_SIGNATURE}}` is placed

### ✅ A6: One-click: Save & Send Test Email

1. Make a small change in subject or body
2. Click **Save & Send Test Email**
3. **Expected:**
   - Template is saved (variables get updated/detected)
   - A test email is sent immediately with sensible default values

**✅ Addendum complete if:**
- [ ] Signatures exist and can be edited per category
- [ ] Missing-signature warning and insertion work
- [ ] Variable tooltips show description + example
- [ ] Helper sections are collapsible
- [ ] Test email sending works (and reflects saved template)
- [ ] Save & Send works end-to-end

### ✅ Schritt 8: Test-Template erstellen (falls keins existiert)

1. Klicke auf "Create Template"
2. Fülle aus:
   - **Name:** `newsletter-test`
   - **Subject:** `Newsletter Test - {{USER_NAME}}`
   - **Description:** `Test template for newsletter system`
   - **Category:** Marketing
   - **HTML Content:**

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Hello {{USER_NAME}}!</h1>
  
  <p>This is a test newsletter from Serbian AI Tutor.</p>
  
  <p>Here are some test links to check tracking:</p>
  
  <ul>
    <li><a href="https://learn-with.me" style="color: #007bff;">Visit our website</a></li>
    <li><a href="https://learn-with.me/dashboard" style="color: #007bff;">Go to Dashboard</a></li>
  </ul>
  
  <p>Thank you for testing!</p>
  
  <hr style="border: 1px solid #eee; margin: 20px 0;">

  <!-- Inject the category signature here -->
  {{EMAIL_SIGNATURE}}
  
  <p style="font-size: 12px; color: #666;">
    Don't want to receive these emails? 
    <a href="{{UNSUBSCRIBE_LINK}}" style="color: #007bff;">Unsubscribe</a>
  </p>
</div>
```

3. **Variables:** `USER_NAME, UNSUBSCRIBE_LINK, EMAIL_SIGNATURE`
4. **Active:** ✅ Ja
5. Klicke "Create"

**✅ Test-Phase 2 bestanden, wenn:**
- [ ] Template wurde erfolgreich erstellt
- [ ] Template erscheint in der Liste als "Active"

---

## Test-Phase 3: Test-Campaign erstellen (5 Minuten)

### ✅ Schritt 9: Zurück zur Newsletter-Seite

1. Klicke auf "Newsletter" in der Sidebar
2. Bleibe im Tab "Campaigns"

### ✅ Schritt 10: Campaign erstellen

1. Klicke "Create Campaign"
2. Fülle das Formular aus:
   - **Campaign Name:** `Test Campaign 1`
   - **Email Subject:** `Your Test Newsletter is Here!`
   - **Email Template:** Wähle `newsletter-test` (oder ein anderes aktives Template)
   - **Description:** `Testing newsletter system functionality`
   - **Target Tags:** Leer lassen (= alle Kontakte)
   - **Target Source:** All Contacts
   - **Test Mode:** ✅ **WICHTIG: Aktiviert lassen!**

3. Klicke "Create Campaign"

**Erwartetes Ergebnis:**
- Success-Nachricht: "Campaign created successfully"
- Campaign erscheint in der Liste mit Status "draft"
- Badge "Test Mode" ist sichtbar

**✅ Test-Phase 3 bestanden, wenn:**
- [ ] Campaign wurde erstellt
- [ ] Status ist "draft"
- [ ] "Test Mode" Badge ist sichtbar

---

## Test-Phase 3.1: Unsubscribe Flow (Confirm UI) (5 Minuten)

> Ziel: Sicherstellen, dass **kein Auto-Unsubscribe** passiert und dass der User eine **Confirm-Seite** sieht.

### ✅ Schritt 10a: Unsubscribe-Link in einer echten Email prüfen

1. Sende dir selbst eine Email mit `{{UNSUBSCRIBE_LINK}}` (z.B.:
   - **Email Templates → Send Test Email**, oder
   - Newsletter-Campaign im **Test Mode**)
2. Öffne die Email und klicke auf den **Unsubscribe** Link
3. **Erwartet:**
   - Es öffnet sich `https://learn-with.me/newsletter/unsubscribe?token=...`
   - Du siehst eine **Confirm-Seite** mit Button **Unsubscribe**
   - **Wichtig:** Es passiert noch **keine** Abmeldung, bevor du klickst

### ✅ Schritt 10b: Confirm-Klick durchführen

1. Klicke auf **Unsubscribe**
2. **Erwartet:**
   - Success-Message („You're Unsubscribed“)
3. Gehe zurück ins Admin Panel → Newsletter → Contacts
4. Suche die Email-Adresse
5. **Erwartet:**
   - Kontakt ist jetzt **Unsubscribed**
   - `unsubscribedAt` ist gesetzt

### ✅ Optional (Advanced): One-Click-Unsubscribe Header (RFC 8058)

> Hinweis: One-Click läuft über die Convex HTTP Actions Domain `*.convex.site` (nicht `*.convex.cloud` und nicht `learn-with.me`).  
> Das ist notwendig wegen Vercel SPA-Rewrites.

---

## Test-Phase 4: Campaign versenden (10 Minuten)

### ✅ Schritt 11: Campaign versenden

1. Finde deine Test-Campaign in der Liste
2. Klicke auf "Send"
3. Bestätige im Popup: "Are you sure you want to send this campaign?"

**Erwartetes Ergebnis:**
- Success-Nachricht: "Campaign scheduled! Sending to X recipients in Y batches"
- Campaign-Status wechselt von "draft" zu "sending"
- **X sollte die Anzahl deiner Whitelist-Emails sein** (nicht alle Kontakte!)

### ✅ Schritt 12: Convex Logs prüfen

1. Öffne das Terminal mit `npx convex dev`
2. Beobachte die Logs
3. **Du solltest sehen:**

```
[Newsletter] TEST MODE: Sending only to whitelist (2 contacts)
[Newsletter] Preparing to send campaign "Test Campaign 1" to 2 contacts
[Newsletter] Scheduled X batches
[Newsletter] Sending batch of 2 emails...
[Newsletter] ✅ Sent to email1@example.com (re_...)
[Newsletter] ✅ Sent to email2@example.com (re_...)
[Newsletter] Batch complete: 2 sent, 0 failed
```

### ✅ Schritt 13: Emails prüfen

1. **Öffne dein Email-Postfach** (für die Adressen aus der Whitelist)
2. **Warte 1-2 Minuten** (Email-Versand kann etwas dauern)
3. **Prüfe:**
   - [ ] Email ist angekommen
   - [ ] Subject-Line ist korrekt
   - [ ] Personalisierung funktioniert ({{USER_NAME}} wurde ersetzt)
   - [ ] Links sind vorhanden
   - [ ] Unsubscribe-Link ist am Ende

**Wenn keine Email ankommt:**
- Prüfe Spam-Ordner
- Prüfe Convex Logs auf Fehler
- Prüfe, ob die Email wirklich in der Whitelist steht

**✅ Test-Phase 4 bestanden, wenn:**
- [ ] Email wurde versendet (Logs zeigen Erfolg)
- [ ] Email ist im Postfach angekommen
- [ ] Inhalt ist korrekt

---

## Test-Phase 5: Link-Tracking testen (5 Minuten)

### ✅ Schritt 14: Link in Email klicken

1. Öffne die Test-Email
2. Klicke auf einen der Links (z.B. "Visit our website")
3. **Erwartetes Verhalten:**
   - Du wirst auf eine `/newsletter/track/...` URL weitergeleitet
   - Du landest dann auf der finalen Ziel-URL (z.B. `https://learn-with.me`)

### ✅ Schritt 15: Click-Tracking prüfen

1. **Option A: In Convex Dashboard**
   - Öffne Convex Dashboard: https://dashboard.convex.dev
   - Gehe zu deinem Dev-Projekt
   - Öffne die Tabelle `newsletterLinkClicks`
   - **Prüfe:** Es sollte ein Eintrag für deinen Link-Klick existieren

2. **Option B: In Convex Logs**
   - Beobachte die Terminal-Logs
   - Nach dem Link-Klick solltest du sehen:
   ```
   [Newsletter] Link clicked: originalUrl, contactEmail
   ```

**✅ Test-Phase 5 bestanden, wenn:**
- [ ] Link-Redirect funktioniert
- [ ] Click wurde in `newsletterLinkClicks` geloggt
- [ ] User wird zur korrekten Ziel-URL weitergeleitet

---

## Test-Phase 6: Email-Open-Tracking (Optional, 5 Minuten)

### ✅ Schritt 16: Email-Open prüfen

1. Öffne die Test-Email erneut (wenn noch nicht geöffnet)
2. Warte 1-2 Minuten
3. **Prüfe in Convex Dashboard:**
   - Tabelle: `newsletterEmailLogs`
   - Suche nach deinem Email-Log-Eintrag
   - **Status sollte auf "opened" wechseln**
   - **openedCount sollte mindestens 1 sein**

**Hinweis:** Email-Opens werden über ein Tracking-Pixel erkannt. Das funktioniert nicht immer (z.B. wenn Bilder blockiert sind).

**✅ Test-Phase 6 bestanden, wenn:**
- [ ] Email-Log-Status ist "delivered" oder "opened"
- [ ] openedCount > 0 (wenn Tracking funktioniert)

---

## Test-Phase 7: Unsubscribe testen (5 Minuten)

### ✅ Schritt 17: Unsubscribe-Link klicken

1. Scrolle in der Test-Email ganz nach unten
2. Klicke auf den "Unsubscribe"-Link
3. **Erwartetes Verhalten:**
   - Du wirst zu einer Unsubscribe-Seite weitergeleitet
   - Bestätigungsnachricht: "You have been unsubscribed"

### ✅ Schritt 18: Unsubscribe-Status prüfen

1. Gehe zurück zum Newsletter-Panel
2. Wechsle zum Tab "Contacts"
3. Suche nach der Email-Adresse, die du gerade unsubscribed hast
4. **Prüfe:**
   - Badge sollte jetzt "Unsubscribed" zeigen (statt "Subscribed")
   - Unsubscribe-Datum sollte sichtbar sein

### ✅ Schritt 19: Erneuten Versand testen

1. Erstelle eine neue Test-Campaign
2. Versuche sie zu versenden
3. **Prüfe Logs:**
   - Die unsubscribed Email sollte NICHT in der Empfängerliste sein
   - Nur noch die anderen Whitelist-Emails sollten beliefert werden

**✅ Test-Phase 7 bestanden, wenn:**
- [ ] Unsubscribe funktioniert
- [ ] Status wird korrekt aktualisiert
- [ ] Unsubscribed Kontakte werden bei zukünftigen Campaigns ausgeschlossen

---

## Test-Phase 8: Campaign-Analytics (5 Minuten)

### ✅ Schritt 20: Campaign-Statistiken prüfen

1. Gehe zurück zum "Campaigns"-Tab
2. Finde deine gesendete Campaign
3. **Prüfe die angezeigten Statistiken:**
   - **Recipients:** Sollte die Anzahl der Whitelist-Emails sein
   - **Sent:** Sollte gleich Recipients sein
   - **Created:** Datum/Zeit sollte stimmen

4. Wenn die Campaign den Status "sent" hat:
   - Button "View Stats" sollte erscheinen
   - (Hinweis: Analytics-Seite ist noch nicht implementiert, aber der Button sollte da sein)

**✅ Test-Phase 8 bestanden, wenn:**
- [ ] Statistiken werden korrekt angezeigt
- [ ] Sent-Count stimmt
- [ ] Campaign-Status ist "sent"

---

## Test-Phase 9: Production-Mode-Test (Optional, nur wenn sicher!)

⚠️ **ACHTUNG:** Dieser Test sendet an ALLE Kontakte! Nur durchführen, wenn du bereit bist!

### ✅ Schritt 21: Production-Campaign erstellen

1. Erstelle eine neue Campaign
2. **WICHTIG:** Entferne den Haken bei "Test Mode"
3. Wähle als Target nur "Waitlist Only" oder setze spezielle Tags
4. Sende die Campaign

**Erwartetes Verhalten:**
- System sendet an ALLE Kontakte, die die Kriterien erfüllen
- Whitelist wird ignoriert

**Empfehlung:**
- Führe diesen Test NICHT auf Dev aus
- Warte bis Production-Deployment
- Teste zuerst mit einer kleinen Zielgruppe (z.B. nur Waitlist mit 5-10 Einträgen)

---

## Abschluss-Checkliste

### ✅ Alle Tests erfolgreich?

- [ ] **Kontakte werden korrekt angezeigt**
- [ ] **Filter funktionieren**
- [ ] **Campaign kann erstellt werden**
- [ ] **Email-Versand funktioniert (Test-Mode)**
- [ ] **Emails kommen an**
- [ ] **Personalisierung funktioniert**
- [ ] **Link-Tracking funktioniert**
- [ ] **Unsubscribe funktioniert**
- [ ] **Campaign-Statistiken werden angezeigt**

### 🎉 Wenn alle Punkte ✅ sind: Newsletter-System ist bereit für Production!

---

## Troubleshooting

### Problem: Keine Emails kommen an

**Mögliche Ursachen:**
1. **Resend API Key falsch:** Prüfe `.env.local`
2. **Whitelist-Email falsch:** Prüfe Schreibweise in `.env.local`
3. **Resend Account-Limit:** Prüfe Resend Dashboard auf Limits
4. **Domain nicht verifiziert:** Für Production muss deine Domain in Resend verifiziert sein

**Debug-Schritte:**
1. Prüfe Convex Logs auf Fehler
2. Prüfe Resend Dashboard → Logs
3. Prüfe `newsletterEmailLogs` Tabelle auf "failed" Status

### Problem: Links nicht trackbar

**Mögliche Ursachen:**
1. Link-Format ist ungültig
2. Tracking-Endpoint nicht erreichbar

**Debug-Schritte:**
1. Prüfe HTML-Source der Email
2. Links sollten `/newsletter/track/...` enthalten
3. Teste manuell: `http://localhost:5173/newsletter/track/test-token`

### Problem: Campaign bleibt bei "sending" hängen

**Mögliche Ursachen:**
1. Batch-Jobs sind noch nicht fertig (kann 1-2 Minuten dauern)
2. Fehler beim Versand

**Debug-Schritte:**
1. Warte 5 Minuten
2. Prüfe Convex Logs
3. Prüfe `newsletterEmailLogs` → Wie viele sind "sent"?

---

## Support

Bei Problemen:
1. Prüfe zuerst die Convex Logs
2. Prüfe die Resend Dashboard Logs
3. Prüfe die Convex Dashboard Tabellen
4. Dokumentiere das Problem mit Screenshots
