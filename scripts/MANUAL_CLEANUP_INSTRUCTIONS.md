# Manuelle Bereinigung der "practice" Einträge

## Problem

Der Convex Dev Server kann keine neuen Funktionen deployen, weil Schema-Validierungsfehler vorliegen:

```
✖ Schema validation failed.
Document with ID "md702gkfk39rqc52ycgrbwbfmd7wv8sd" in table "unitContent" does not match the schema
Value: "practice"
```

## Lösung: Manuelle Bereinigung über Convex Dashboard

Da der Dev Server aufgrund des Schema-Fehlers blockiert ist, müssen die Daten **manuell über das Convex Dashboard** gelöscht werden.

### Schritt 1: Convex Dashboard öffnen

1. Öffnen Sie: https://dashboard.convex.dev
2. Wählen Sie Ihr Projekt: **srpski-tutor-en**
3. Navigieren Sie zu: **Data** → **unitContent**

### Schritt 2: Filtern nach "practice" Einträgen

Im Convex Dashboard:

1. Klicken Sie auf die **unitContent** Tabelle
2. Verwenden Sie den Filter oder suchen Sie nach Dokumenten mit:
   - `contentType: "practice"`
   - `unitNumber: 7-27`

### Schritt 3: Dokumente löschen

Für jedes gefundene Dokument:

1. Klicken Sie auf das Dokument
2. Klicken Sie auf **Delete**
3. Bestätigen Sie die Löschung

### Betroffene Units

Löschen Sie alle Dokumente mit `contentType: "practice"` für folgende Units:

```
7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
```

### Bekannte Dokument-ID

Mindestens dieses Dokument ist betroffen:
- **ID**: `md702gkfk39rqc52ycgrbwbfmd7wv8sd`

## Alternative: Temporäres Schema-Update

Falls die manuelle Löschung zu aufwändig ist, können Sie temporär das Schema erweitern:

### 1. Schema temporär erweitern

In `convex/schema.ts`, Zeile 209-216:

```typescript
contentType: v.union(
  v.literal("overview"),
  v.literal("grammar"),
  v.literal("phrases"),
  v.literal("dialogues"),
  v.literal("vocabulary"),
  v.literal("testIntroduction"),
  v.literal("practice")  // ← TEMPORÄR hinzufügen
),
```

### 2. Warten bis Schema deployed ist

Der Convex Dev Server sollte jetzt ohne Fehler laufen.

### 3. Cleanup-Skript ausführen

```bash
pnpm cleanup:practice -- --dry-run  # Vorschau
pnpm cleanup:practice                # Tatsächliche Löschung
```

### 4. Schema wieder bereinigen

Entfernen Sie `v.literal("practice")` wieder aus dem Schema.

## Nach der Bereinigung

✅ Schema-Validierungsfehler sollten verschwunden sein
✅ Convex Dev Server läuft ohne Fehler
✅ Neue Funktionen können deployed werden

## Empfehlung

**Empfohlener Ansatz**: Alternative (temporäres Schema-Update)

Warum?
- Schneller und sicherer
- Automatisierte Bereinigung via Skript
- Keine manuelle Suche nach Dokumenten
- Vollständige Dokumentation der Änderungen
