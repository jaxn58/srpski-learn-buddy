# Admin UI - Content Import Tool

## Überblick

Das Content Import Tool ist jetzt auch als Web-Oberfläche im Admin-Bereich verfügbar. Nur Super-Admins haben Zugriff auf diese Funktion.

## Zugang

1. **Als Superadmin einloggen**
2. **Navigation:** Im Sidebar auf "Content Import" klicken
3. **URL:** `http://localhost:5173/admin/content-import` (Dev) oder `https://learn-with.me/admin/content-import` (Prod)

## Features

### 1. Content Import Tab

**Upload JSON File:**
- Klicke auf den Upload-Bereich oder ziehe eine JSON-Datei hinein
- Nur `.json` Dateien werden akzeptiert
- Format: `unitPackage.v1` Schema

**Validierung:**
- Klicke auf "Validate" um die hochgeladene Datei zu prüfen
- Das System führt automatisch Autofixes durch (z.B. Bereinigung von Serbian-Wörtern)
- Validierungsergebnis wird angezeigt:
  - **Grün (Success):** Keine Fehler, bereit für Import
  - **Rot (Failed):** Fehler gefunden, Import blockiert

**Validierungsergebnis:**
- **Summary:** Anzahl der Fehler und Auto-Fixes
- **Auto-fixes Applied:** Liste der automatischen Korrekturen
- **Validation Issues:** Detaillierte Fehlermeldungen mit Pfad und Beschreibung

**Download Fixed JSON:**
- Nach der Validierung kann das gefixte JSON heruntergeladen werden
- Button wird nur angezeigt, wenn Auto-Fixes durchgeführt wurden
- Dateiname: `[original-name]-fixed.json`

**Import to Database:**
- Button wird nur angezeigt, wenn die Validierung erfolgreich war
- Klicke auf "Import to Database"
- Bestätige im Dialog mit "Yes, Import"
- Das System führt folgende Operationen durch:
  1. Unit Metadata erstellen/aktualisieren
  2. Unit Content einfügen (Overview, Grammar, Phrases, Dialogues, Test Intro)
  3. Vocabulary einfügen (mit sauberem Serbian-Feld)
  4. Interactive Tests (Exercises) einfügen

### 2. Import History Tab

**Übersicht:**
- Liste aller Import-Operationen (Validierung & Import)
- Sortiert nach Datum (neueste zuerst)

**Anzeige:**
- **File(s):** Dateiname(n) der importierten JSON-Dateien
- **Unit(s):** Unit-Nummern der importierten Units
- **Type:** "Validate" oder "Import"
- **Status:** 
  - "Valid" (blaues Badge) - Validierung erfolgreich
  - "Imported" (grünes Badge) - Import erfolgreich
  - "Failed" (rotes Badge) - Validierung oder Import fehlgeschlagen
- **Errors:** Anzahl der gefundenen Fehler
- **Timestamp:** Datum und Uhrzeit der Operation

**Details anzeigen:**
- Klicke auf "View Report" um den vollständigen Report zu sehen
- Dialog zeigt:
  - Status, Type, Anzahl Dateien, Units, Errors, Warnings
  - Vollständiger JSON-Report mit allen Details

## Backend-Endpunkte

### `validateUnitPackages` (Action)
- **Input:** Array von JSON-Dateien (`{ fileName: string, unitPackage: unknown }`)
- **Output:** Report mit Validierungsergebnissen
- **Features:**
  - Schema-Validierung (Zod)
  - Auto-Fixes (sanitize Serbian, split entries, merge categories, etc.)
  - Deep Validation (Cross-field checks)
  - Report in `contentImportRuns` Tabelle speichern

### `importUnitPackages` (Action)
- **Input:** Array von JSON-Dateien + Bestätigung (`confirm: "IMPORT"`)
- **Output:** Report mit Import-Ergebnissen
- **Features:**
  - Validierung (blocking - Import nur bei 0 Fehlern)
  - Upsert in alle relevanten Tabellen:
    - `unitMetadata` (pro Sprache)
    - `unitContent` (alle Content-Typen pro Sprache)
    - `courseVocabulary` (English mit column-based translations)
    - `unitInteractiveTests` (alle Exercise-Kategorien und Questions)
  - Report in `contentImportRuns` Tabelle speichern

### `listRuns` (Query)
- **Input:** Optional `limit` (default: 50, max: 200)
- **Output:** Array von Import-Runs (ohne reportJson für Performance)
- **Access:** Superadmin-only

### `getRun` (Query)
- **Input:** `runId` (ID der Import-Run)
- **Output:** Vollständige Import-Run mit reportJson
- **Access:** Superadmin-only

## Audit-Log

Alle Import-Operationen werden in der `contentImportRuns` Tabelle gespeichert:
- **type:** "validate" oder "import"
- **status:** "success" oder "failed"
- **startedAt / completedAt:** Timestamps
- **createdBy:** User-ID des Superadmins
- **fileNames:** Array der Dateinamen
- **filesCount:** Anzahl der Dateien
- **unitNumbers:** Array der Unit-Nummern
- **totalErrors / totalWarnings:** Fehler- und Warnungszähler
- **reportJson:** Vollständiger JSON-Report (für Details-Ansicht)

## Best Practices

### Vor dem Import:
1. **CLI-Validierung durchführen** (optional):
   ```bash
   pnpm validate:content "New Content/jsons"
   ```

2. **JSON über Admin UI hochladen und validieren**

3. **Validierungsbericht prüfen:**
   - Alle Fehler beheben (in externer KI oder manuell)
   - Auto-Fixes prüfen (sind sie sinnvoll?)
   - Fixed JSON herunterladen (falls nötig)

4. **Import durchführen:**
   - Nur wenn Validierung erfolgreich (grüner Status)
   - Bestätigung im Dialog erforderlich

### Nach dem Import:
1. **Import History prüfen:**
   - Status "Imported" (grün) = erfolgreich
   - Report anzeigen für Details

2. **Daten im Frontend testen:**
   - Unit aufrufen: `/course/unit/[unitNumber]`
   - Vocabulary prüfen
   - Exercises durchspielen

3. **Bei Problemen:**
   - Report in Import History anzeigen
   - Fehlerdetails prüfen
   - JSON korrigieren und erneut importieren (Upsert = überschreibt alte Daten)

## Technische Details

### Frontend-Komponente
- **Datei:** `client/src/pages/ContentImportAdmin.tsx`
- **Route:** `/admin/content-import`
- **Zugriff:** Superadmin-only (Redirect wenn nicht berechtigt)
- **UI-Komponenten:** shadcn/ui (Card, Button, Table, Badge, Alert, AlertDialog, Tabs)
- **Icons:** lucide-react
- **Toast:** sonner

### Backend-Logik
- **Datei:** `convex/contentImportAdmin.ts`
- **Mutations:** `internalCreateRun`, `internalImportUnitPackage`
- **Queries:** `listRuns`, `getRun`
- **Actions:** `validateUnitPackages`, `importUnitPackages`
- **Schema:** `convex/schema.ts` (Tabelle: `contentImportRuns`)

### Validation & Autofix
- **Schema:** `scripts/unitPackage/schema.ts` (Zod)
- **Autofix:** `scripts/unitPackage/autofix.ts`
- **Import-Logik:** `scripts/import-unit-packages.ts` (wiederverwendet in Convex Action)

## Troubleshooting

### "Unauthorized - Superadmin required"
- **Problem:** Du bist nicht als Superadmin eingeloggt
- **Lösung:** Stelle sicher, dass dein User-Account die Rolle "superadmin" hat

### "Validation failed"
- **Problem:** JSON enthält Fehler oder entspricht nicht dem Schema
- **Lösung:** 
  1. Validierungsbericht prüfen
  2. Fehler beheben (in externer KI oder manuell)
  3. Erneut validieren

### "Cannot import: X validation errors found"
- **Problem:** Import wird blockiert, weil noch Fehler vorhanden sind
- **Lösung:** Erst Validierung erfolgreich abschließen (0 Fehler), dann Import

### Import schlägt fehl (nach erfolgreicher Validierung)
- **Problem:** Datenbank-Fehler oder Konflikt
- **Lösung:** 
  1. Report in Import History anzeigen
  2. Fehlerdetails prüfen
  3. Convex-Logs prüfen (Convex Dashboard)
  4. Ggf. Datenbank-Schema prüfen

## Zusammenfassung

Das Admin UI Tool bietet eine benutzerfreundliche Oberfläche für den Content-Import-Prozess. Es kombiniert:
- **Automatische Validierung** mit detailliertem Feedback
- **Auto-Fixes** für häufige Formatierungsprobleme
- **Blocking Import** (nur bei 0 Fehlern)
- **Audit-Log** für alle Operationen
- **Report-Download** für Debugging

Alle Operationen sind Superadmin-only und werden vollständig in der Datenbank protokolliert.
