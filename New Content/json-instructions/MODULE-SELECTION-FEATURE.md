# Modul-Auswahl beim Content Import

## Feature-Übersicht

Du kannst jetzt beim Import einer Unit **manuell ein Modul auswählen**, zu dem die Unit gehören soll. Dies ist optional - wenn du kein Modul auswählst, wird das Modul aus der JSON-Datei verwendet.

## Wie funktioniert es?

### 1. Workflow

1. **JSON-Datei hochladen** und **validieren**
2. **Nach erfolgreicher Validierung** erscheint ein neues **Modul-Dropdown**
3. **Modul auswählen** (optional):
   - **"Use module from JSON file"** (Standard): Das Modul wird aus der JSON-Datei gelesen (`module.moduleNumber`)
   - **Oder ein Modul manuell auswählen**: Wähle aus der Liste der verfügbaren Module
4. **Import starten**: Die Unit wird mit dem ausgewählten Modul verknüpft

### 2. UI-Elemente

**Modul-Dropdown** (nur sichtbar bei erfolgreicher Validierung):
```
┌─────────────────────────────────────────┐
│ 📁 Select Module (Optional)            │
├─────────────────────────────────────────┤
│ [Dropdown]                              │
│   - Use module from JSON file          │
│   - Module 1: Introduction              │
│   - Module 2: Basic Grammar             │
│   - Module 3: Everyday Conversations    │
│   - ...                                 │
└─────────────────────────────────────────┘
```

**Hinweistext unter dem Dropdown:**
- Wenn **kein Modul ausgewählt**: "No module selected. The unit will be assigned based on the module information in the JSON file."
- Wenn **Modul ausgewählt**: "This unit will be assigned to the selected module above."

**Import-Bestätigung:**
Der Bestätigungs-Dialog zeigt jetzt auch die Modul-Auswahl an:
- Wenn **manuell ausgewählt**: "Module: [Modulname]" (blauer Hintergrund)
- Wenn **aus JSON**: "Module: From JSON file (Module X)" (grauer Hintergrund)

## Technische Details

### Backend

**Neue Query in `convex/contentImportAdmin.ts`:**
```typescript
export const listModulesForImport = query({
  args: {},
  handler: async (ctx) => {
    // Nur für Superadmin verfügbar
    // Gibt deduplizierte Liste aller Module zurück
    // Sortiert nach moduleNumber
  },
});
```

**Erweiterte Import-Action:**
```typescript
export const importUnitPackages = action({
  args: {
    files: v.array(...),
    confirm: v.string(),
    moduleId: v.optional(v.id("moduleMetadata")), // NEU
  },
  // ...
});
```

**Import-Logik (`internalImportUnitPackage`):**
```typescript
// Modul-Verknüpfung:
let module = null;
if (args.moduleId) {
  // 1. Priorität: Manuell ausgewähltes Modul
  module = await ctx.db.get(args.moduleId);
} else {
  // 2. Fallback: Modul aus JSON (moduleNumber)
  module = await ctx.db
    .query("moduleMetadata")
    .filter((q) => q.eq(q.field("moduleNumber"), fixed.module.moduleNumber))
    .first();
}
```

### Frontend

**Neue States in `ContentImportAdmin.tsx`:**
```typescript
const availableModules = useQuery(api.contentImportAdmin.listModulesForImport);
const [selectedModuleId, setSelectedModuleId] = useState<Id<"moduleMetadata"> | null>(null);
```

**Import-Aufruf mit moduleId:**
```typescript
const result = await importAction({
  files: [...],
  confirm: "IMPORT",
  moduleId: selectedModuleId || undefined // NEU
});
```

## Vorteile

1. **Flexibilität**: Du kannst das Modul manuell korrigieren, falls die JSON-Datei falsche Modul-Informationen enthält
2. **Kontrolle**: Du siehst alle verfügbaren Module und kannst bewusst auswählen
3. **Fallback**: Wenn du nichts auswählst, funktioniert alles wie vorher (Modul aus JSON)
4. **Transparenz**: Der Bestätigungs-Dialog zeigt genau, welches Modul verwendet wird

## Anwendungsfälle

### Szenario 1: JSON hat falsches Modul
- Unit in JSON sagt "Module 2", sollte aber zu "Module 3"
- Einfach "Module 3" im Dropdown auswählen
- Import läuft mit dem korrekten Modul

### Szenario 2: JSON hat korrektes Modul
- Dropdown auf "Use module from JSON file" lassen
- Import läuft wie gewohnt

### Szenario 3: Batch-Import mit verschiedenen Modulen
- Mehrere Units in verschiedene Module importieren
- Jede Unit einzeln hochladen und das richtige Modul auswählen

## Hinweise

- **Nur Superadmin**: Die Modul-Auswahl ist nur für Superadmin-Benutzer sichtbar
- **Validierung erforderlich**: Das Dropdown erscheint erst nach erfolgreicher Validierung
- **Optional**: Du musst kein Modul auswählen - das System funktioniert auch ohne manuelle Auswahl
- **Datenbank-Verknüpfung**: Die ausgewählte `moduleId` wird in der `unitMetadata`-Tabelle als `moduleMetadataId` gespeichert
