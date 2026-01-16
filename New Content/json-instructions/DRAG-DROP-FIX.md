# Drag & Drop Fix für Content Import

## Problem

Wenn JSON-Dateien per Drag & Drop in das Upload-Fenster gezogen wurden, öffnete der Browser die Datei direkt, anstatt sie hochzuladen.

## Lösung

Die Upload-Komponente wurde mit vollständigem Drag & Drop Support erweitert:

### 1. Event-Handler implementiert

- **`onDragEnter`**: Aktiviert den Dragging-Status (visuelles Feedback)
- **`onDragLeave`**: Deaktiviert den Dragging-Status
- **`onDragOver`**: Verhindert das Standard-Browser-Verhalten
- **`onDrop`**: Verarbeitet die gedroppte Datei

### 2. Globale Event-Prevention

Ein `useEffect` Hook wurde hinzugefügt, der Browser-weite Drag & Drop Events blockiert:

```typescript
useEffect(() => {
  const preventDefault = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Verhindert, dass der Browser Dateien öffnet
  document.addEventListener('dragover', preventDefault);
  document.addEventListener('drop', preventDefault);

  return () => {
    document.removeEventListener('dragover', preventDefault);
    document.removeEventListener('drop', preventDefault);
  };
}, []);
```

### 3. Visuelles Feedback

Während des Drags ändert sich das Upload-Fenster:
- **Border**: Wechselt zu primärer Farbe
- **Hintergrund**: Leicht eingefärbt mit `bg-primary/5`
- **Icon**: Färbt sich in primärer Farbe
- **Text**: Ändert sich zu "Drop JSON file here"

## Ergebnis

Du kannst jetzt JSON-Dateien auf zwei Arten hochladen:

1. **Click to Upload**: Klicke auf das Upload-Fenster → Dateiauswahl öffnet sich
2. **Drag & Drop**: Ziehe eine JSON-Datei direkt ins Upload-Fenster → Wird sofort geladen

## Technische Details

**Geänderte Dateien:**
- `client/src/pages/ContentImportAdmin.tsx`

**Neue Features:**
- `isDragging` State für visuelles Feedback
- `processFile()` Funktion für einheitliche Dateiverarbeitung
- Vier neue Drag & Drop Handler
- Globale Event-Prevention auf Document-Ebene

**User Experience:**
- Kein Browser-Öffnen mehr bei versehentlichem Drop außerhalb des Fensters
- Klare visuelle Hinweise während des Drag-Vorgangs
- Nahtlose Integration mit bestehender Upload-Logik
