# Abschließende Prüfungen nach Fertigstellung

## 1. Datenmigration und Validierung
- `pnpm tsx scripts/migrate-unit-explanations.ts --dry-run` – Vorschau der Migration
- `pnpm tsx scripts/migrate-unit-explanations.ts` – Live-Migration ausführen
- `pnpm tsx scripts/validate-content-consistency.ts` – Konsistenz (Titel, Pflicht-Content, Legacy) prüfen
- `pnpm tsx scripts/validate-referential-integrity.ts` – Foreign-Key-Beziehungen und verwaiste Einträge checken

## 2. Frontend- und Funktions-Checks
- Dev-Server starten und Units 1–6 manuell testen (Tabs, Markdown, Vokabeln, Tests)
- Interaktive Tests (Exercises-Tab) öffnen, Beantwortung & XP-Logik prüfen
- Sprachumschaltung (en/de) für Metadaten und Content testen
- Dashboard/Units-Übersicht prüfen (Titel, Module, Badges)

## 3. Legacy-Bereinigung
- Nach erfolgreicher Migration `deleteAllUnitExplanations` (Mutation in `convex/units.ts`) ausführen oder `scripts/cleanup-unit-explanations.ts`
- Sicherstellen, dass keine Abhängigkeiten mehr auf `unitExplanations` zeigen

## 4. Neue Content-Quelle (Module 1–6)
- Quelle: `New Content/learn-with.me-main/website/20251214-v1-*.html`
- Content-Importer: `pnpm tsx scripts/import-module1-content.ts`
- Exercise-Importer: `pnpm tsx scripts/import-module1-exercises.ts`
- Bei Änderungen Skripte erneut ausführen oder Inhalte direkt in Convex editieren

## 5. Dokumentation & Kommunikation
- In Release-Notes erwähnen: neue Inhalte, Migration, Tests
- Team informieren, dass alte Inhalte (Units 7–27) noch bereinigt werden müssen
- Folgeaufgaben: Units 7–27 aktualisieren, interaktive Tests aus neuen Quellen füllen









