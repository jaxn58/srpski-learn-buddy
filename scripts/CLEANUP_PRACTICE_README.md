# Cleanup Invalid "practice" ContentType

## Problem

Units 7-27 enthalten alte Daten in der `unitContent` Tabelle mit dem `contentType: "practice"`. Dieser Wert ist **nicht im Schema definiert** und verursacht Schema-Validierungsfehler:

```
✖ Schema validation failed.
Document with ID "..." in table "unitContent" does not match the schema: Value does not match validator.
Path: .contentType
Value: "practice"
Validator: v.union(v.literal("overview"), v.literal("grammar"), v.literal("phrases"), v.literal("dialogues"), v.literal("vocabulary"), v.literal("testIntroduction"))
```

## Lösung

Das Schema erlaubt nur folgende `contentType` Werte:
- `"overview"`
- `"grammar"`
- `"phrases"`
- `"dialogues"`
- `"vocabulary"`
- `"testIntroduction"`

Der Wert `"practice"` ist veraltet und muss aus der Datenbank entfernt werden.

## Verwendung

### 1. Dry Run (Vorschau ohne Änderungen)

Zeigt an, welche Einträge gefunden und gelöscht würden:

```bash
pnpm cleanup:practice -- --dry-run
```

oder

```bash
npm run cleanup:practice -- --dry-run
```

### 2. Tatsächliche Bereinigung

Löscht alle `"practice"` Einträge aus Units 7-27:

```bash
pnpm cleanup:practice
```

oder

```bash
npm run cleanup:practice
```

## Was wird gelöscht?

- **Betroffene Units**: 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
- **Betroffene Tabelle**: `unitContent`
- **Betroffener contentType**: `"practice"`
- **Alle Sprachen**: Das Skript löscht alle Einträge unabhängig von der Sprache

## Sicherheit

- Das Skript verwendet eine Convex Mutation (`deleteInvalidPracticeContent`)
- Dry-Run Modus verfügbar für sichere Vorschau
- Detaillierte Logs zeigen, was gefunden/gelöscht wurde
- Keine Auswirkung auf andere contentTypes oder Units 1-6

## Nach der Bereinigung

Nach erfolgreicher Ausführung:
1. ✅ Schema-Validierungsfehler sollten verschwunden sein
2. ✅ Convex Dev Server sollte ohne Fehler laufen
3. ✅ Units 7-27 haben keine "practice" Einträge mehr

## Technische Details

### Convex Mutation

Die Mutation `deleteInvalidPracticeContent` in `convex/units.ts`:
- Sucht nach allen `unitContent` Einträgen mit `contentType: "practice"`
- Filtert nach den angegebenen Unit-Nummern
- Löscht die Einträge (außer im Dry-Run Modus)
- Gibt detaillierte Statistiken zurück

### Skript

Das Skript `scripts/cleanup-invalid-practice-content.ts`:
- Verbindet sich mit Convex über HTTP Client
- Ruft die Mutation mit Units 7-27 auf
- Zeigt detaillierte Logs und Ergebnisse
- Unterstützt Dry-Run Modus via `--dry-run` Flag
