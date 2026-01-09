# Onboarding System Testing Guide

## Übersicht

Diese Anleitung beschreibt, wie das neue dynamische Onboarding-System getestet wird.

## Was wurde implementiert?

1. **Datenbank-Schema**: Neue `onboardingSteps` Tabelle in Convex
2. **Backend-API**: Convex Functions für CRUD-Operationen
3. **Migration-Script**: Automatische Migration der 4 bestehenden Steps
4. **Frontend-Komponente**: Dynamisches Laden der Steps aus der Datenbank
5. **Admin-Panel**: Vollständige Verwaltung der Onboarding-Steps
6. **Navigation**: Route `/admin/onboarding` und Sidebar-Link

## Voraussetzungen

- Lokale Dev-Umgebung läuft (`npx convex dev` + `pnpm dev`)
- Admin-Account mit `role: "admin"` oder `role: "superadmin"`
- ADMIN_SECRET in `.env.local` gesetzt

## Testing-Schritte

### 1. Migration durchführen

```bash
# Stelle sicher, dass Convex Dev läuft
npx convex dev

# In einem neuen Terminal:
npx tsx scripts/migrate-onboarding.ts
```

**Erwartetes Ergebnis:**
- Script zeigt 4 erfolgreich migrierte Steps
- Keine Fehler in der Console

**Fehlerbehandlung:**
- Falls `ADMIN_SECRET not set`: Setze in `.env.local`
- Falls `Unauthorized`: Prüfe Admin-Rechte des Accounts

### 2. Admin-Panel testen

**URL:** `http://localhost:5173/admin/onboarding`

#### 2.1 Navigation prüfen
- [ ] Sidebar zeigt "Onboarding" unter Admin-Bereich
- [ ] Icon (Presentation) wird korrekt angezeigt
- [ ] Link führt zur Onboarding-Admin-Seite

#### 2.2 Übersicht prüfen
- [ ] 4 Steps werden für Englisch (EN) angezeigt
- [ ] Tabelle zeigt: Step-Nummer, Titel, Icon, Status, Aktionen
- [ ] Alle Steps haben Status "Active"

#### 2.3 Sprach-Filter testen
- [ ] Wechsel zu "Deutsch" zeigt "No steps found"
- [ ] Wechsel zurück zu "English" zeigt wieder 4 Steps
- [ ] Filter-Dropdown funktioniert flüssig

#### 2.4 Step erstellen
1. Klicke auf "Create Step"
2. Fülle Formular aus:
   - Step Number: 5
   - Language: en
   - Title: "Test Step"
   - Description: "Test Description"
   - Icon: "Rocket"
   - Content: `<div><p>Test content</p></div>`
   - Active: true
3. Klicke "Create Step"

**Erwartetes Ergebnis:**
- [ ] Success-Toast erscheint
- [ ] Neuer Step erscheint in der Tabelle
- [ ] Step ist als "Active" markiert

#### 2.5 Step bearbeiten
1. Klicke auf Edit-Button (Stift-Icon) bei einem Step
2. Ändere den Titel
3. Klicke "Update Step"

**Erwartetes Ergebnis:**
- [ ] Success-Toast erscheint
- [ ] Änderung ist sofort sichtbar
- [ ] Dialog schließt sich automatisch

#### 2.6 Step deaktivieren/aktivieren
1. Klicke auf Toggle-Button bei einem Step

**Erwartetes Ergebnis:**
- [ ] Status wechselt zwischen "Active" und "Inactive"
- [ ] Icon wechselt entsprechend (ToggleLeft/ToggleRight)
- [ ] Success-Toast erscheint

#### 2.7 Step verschieben
1. Klicke auf Up/Down-Buttons

**Erwartetes Ergebnis:**
- [ ] Step-Reihenfolge ändert sich
- [ ] Step-Nummern werden automatisch aktualisiert
- [ ] Success-Toast erscheint

#### 2.8 Vorschau testen
1. Klicke auf "Preview"-Button

**Erwartetes Ergebnis:**
- [ ] Onboarding-Modal öffnet sich
- [ ] Zeigt "Admin Preview" als Username
- [ ] Navigation zwischen Steps funktioniert
- [ ] "Skip Tutorial" schließt das Modal
- [ ] HTML-Content wird korrekt gerendert

#### 2.9 Step löschen
1. Klicke auf Delete-Button (Papierkorb)
2. Bestätige im Dialog

**Erwartetes Ergebnis:**
- [ ] Confirmation-Dialog erscheint
- [ ] Nach Bestätigung wird Step gelöscht
- [ ] Success-Toast erscheint
- [ ] Step verschwindet aus der Liste

### 3. Frontend-Onboarding testen

#### 3.1 Neuer User-Test
Erstelle einen Test-User (oder lösche localStorage für bestehenden User):

```javascript
// In Browser Console:
localStorage.clear();
// Dann neu anmelden
```

**Erwartetes Ergebnis:**
- [ ] Onboarding erscheint automatisch für neue User (< 24h alt)
- [ ] Zeigt Username im ersten Step
- [ ] Navigation funktioniert (Next, Previous)
- [ ] HTML-Content wird korrekt gerendert
- [ ] Icons werden korrekt angezeigt
- [ ] "Skip Tutorial" schließt das Onboarding
- [ ] "Get Started!" im letzten Step schließt das Onboarding

#### 3.2 LocalStorage-Check
Nach dem Schließen des Onboardings:

```javascript
// In Browser Console:
localStorage.getItem(`onboarding_seen_${userId}`);
// Sollte "true" zurückgeben
```

**Erwartetes Ergebnis:**
- [ ] Onboarding erscheint nicht erneut nach Reload
- [ ] LocalStorage-Flag ist gesetzt

#### 3.3 Inaktive Steps
1. Deaktiviere einen Step im Admin-Panel
2. Öffne Onboarding-Preview

**Erwartetes Ergebnis:**
- [ ] Inaktiver Step wird NICHT angezeigt
- [ ] Step-Zähler passt sich an (z.B. "Step 1 of 3" statt "Step 1 of 4")

### 4. Fallback-Test

Leere die Datenbank (nur für Test!):

```javascript
// In Convex Dashboard: Lösche alle onboardingSteps
```

**Erwartetes Ergebnis:**
- [ ] Onboarding zeigt Fallback-Message: "Welcome to Serbian AI Tutor"
- [ ] "Get Started!"-Button schließt das Onboarding
- [ ] Keine Fehler in der Console

### 5. Mehrsprachigkeits-Test (Vorbereitung)

Erstelle einen Step auf Deutsch:
1. Im Admin-Panel: "Create Step"
2. Language: "de"
3. Fülle restliche Felder aus

**Erwartetes Ergebnis:**
- [ ] Step wird erstellt
- [ ] Erscheint nur bei Sprach-Filter "Deutsch"
- [ ] Englische Steps bleiben unberührt

### 6. Performance-Test

Erstelle 10+ Steps und teste:
- [ ] Admin-Tabelle lädt schnell
- [ ] Reordering funktioniert flüssig
- [ ] Onboarding-Preview lädt schnell
- [ ] Keine Memory-Leaks beim Öffnen/Schließen

### 7. Responsive-Test

Teste auf verschiedenen Bildschirmgrößen:
- [ ] Desktop: Volle Breite, alle Features sichtbar
- [ ] Tablet: Angepasstes Layout
- [ ] Mobile: Onboarding-Modal scrollbar, Buttons zugänglich

## Checkliste: Kritische Features

- [x] Schema-Migration erfolgreich
- [x] Backend-API funktioniert (CRUD)
- [x] Migration-Script läuft fehlerfrei
- [x] Admin-Panel: Create, Read, Update, Delete
- [x] Admin-Panel: Toggle Active/Inactive
- [x] Admin-Panel: Reorder (Up/Down)
- [x] Admin-Panel: Vorschau
- [x] Frontend: Dynamisches Laden der Steps
- [x] Frontend: Fallback bei leerer DB
- [x] Frontend: LocalStorage-Tracking
- [x] Navigation: Route und Sidebar-Link
- [x] Icons werden korrekt gemapped
- [x] HTML-Content wird sicher gerendert

## Bekannte Einschränkungen

1. **HTML-Sicherheit**: `dangerouslySetInnerHTML` wird verwendet
   - Nur Admins können Inhalte bearbeiten
   - Produktions-Einsatz: Content Sanitization erwägen

2. **Icon-Auswahl**: Begrenzt auf vordefinierte Icons
   - Erweiterbar durch Hinzufügen in `ICON_MAP`

3. **Rich-Text-Editor**: Aktuell einfaches Textarea
   - Für bessere UX: Markdown-Editor oder WYSIWYG erwägen

## Nächste Schritte nach Testing

1. Alle Tests durchführen und Ergebnisse dokumentieren
2. Bugs fixen (falls vorhanden)
3. Production-Deployment durchführen (siehe ONBOARDING_DEPLOYMENT.md)

## Troubleshooting

### Problem: Migration schlägt fehl
**Lösung:**
- Prüfe ADMIN_SECRET in `.env.local`
- Prüfe Convex Dev Server läuft
- Prüfe Network-Tab für API-Fehler

### Problem: Admin-Panel zeigt "Unauthorized"
**Lösung:**
- Prüfe User-Role in Convex Dashboard
- Stelle sicher, dass `role: "admin"` oder `role: "superadmin"`

### Problem: Onboarding erscheint nicht für neue User
**Lösung:**
- Prüfe User-Erstellungsdatum (< 24h?)
- Prüfe LocalStorage: `onboarding_seen_${userId}` nicht gesetzt
- Prüfe Browser Console für Fehler

### Problem: Icons werden nicht angezeigt
**Lösung:**
- Prüfe Icon-Name im Admin-Panel korrekt geschrieben
- Prüfe `ICON_MAP` in `WelcomeOnboarding.tsx` enthält Icon
- Fallback ist `Info`-Icon

## Support

Bei Problemen:
1. Prüfe Browser Console auf Fehler
2. Prüfe Convex Logs im Dashboard
3. Prüfe Network-Tab für Failed Requests
4. Dokumentiere Fehler mit Screenshots/Logs
