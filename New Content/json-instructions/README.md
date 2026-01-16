## JSON Import Workflow (UnitPackage v1)

Diese Anleitung beschreibt den Standard-Workflow für JSON-Dateien in `New Content/jsons`.
Ziel: **robust validieren**, **KI-Prompt automatisch erzeugen**, **erst dann importieren**, wenn alles grün ist.

---

## 1) Dateien ablegen

- Lege Unit-JSONs hier ab: `New Content/jsons/`
- Beispiel: `New Content/jsons/Unit-1-First-Words-v7.json`

---

## 2) Validieren (schnell)

### 2.1 Alle JSONs im Standard-Ordner validieren

```bash
pnpm validate:content
```

### 2.2 Nur eine Datei validieren

```bash
pnpm validate:content -- --file "New Content/jsons/Unit-1-First-Words-v7.json"
```

Wenn das Kommando mit Exit Code `1` endet, ist die Datei **nicht importierbar** (Blocking).

---

## 3) Report + KI-Prompt automatisch erzeugen (ohne Copy/Paste)

Dieses Kommando:
- validiert **alle** JSONs im Ordner,
- schreibt einen **Report**,
- schreibt für **jede fehlerhafte** JSON ein fertiges **Fix-only KI-Prompt** als `.txt`.

```bash
npx --yes tsx scripts/validate-unit-packages.ts ^
  --dir "New Content/jsons" ^
  --dry-run ^
  --report "New Content/jsons/_reports/content-validation-report.json" ^
  --report-format json ^
  --ai-prompt-out "New Content/jsons/_ai-prompts"
```

Ergebnisse:
- Report: `New Content/jsons/_reports/content-validation-report.json`
- KI-Prompts: `New Content/jsons/_ai-prompts/*.ai-fix-prompt.txt`

Hinweis: Die Ordner `_reports` und `_ai-prompts` werden beim Scannen automatisch ignoriert.

---

## 4) KI-Fix Loop (bis grün)

1. Öffne die passende Prompt-Datei, z.B.:
   - `New Content/jsons/_ai-prompts/Unit-1-First-Words-v7.ai-fix-prompt.txt`
2. Kopiere den **gesamten** Prompt in die externe KI.
3. Die KI soll als Output **nur JSON** zurückgeben.
4. Ersetze den Inhalt der JSON-Datei durch das korrigierte JSON.
5. Re-Validate:

```bash
pnpm validate:content -- --file "New Content/jsons/Unit-1-First-Words-v7.json"
```

Wiederhole (3) + (4), bis der Validator **grün** ist.

---

## 5) Safe Auto-Fixes direkt in JSON schreiben (optional)

Schreibt „sichere“ Fixes (z.B. audio-clean Serbian, Splits, Kategorien-Merge, Option-Normalisierung) zurück:

```bash
npx --yes tsx scripts/validate-unit-packages.ts --dir "New Content/jsons" --fix
```

Danach immer nochmal validieren:

```bash
pnpm validate:content
```

---

## 6) Import (DEV) – erst wenn Validierung grün ist

### 6.1 Dry-Run Import (schreibt NICHT in die DB)

```bash
pnpm import:content -- --file "New Content/jsons/Unit-1-First-Words-v7.json" --dry-run
```

### 6.2 Echter Import (Blocking)

```bash
pnpm import:content -- --file "New Content/jsons/Unit-1-First-Words-v7.json"
```

### 6.3 Alles importieren (nur wenn alles valid ist)

```bash
pnpm import:content
```

---

## Typische Fehler (und wie sie behoben werden)

- **`correctAnswer must be non-empty`**:
  - KI muss `correctAnswer` ausfüllen (nicht leer).
- **`multipleChoice must have at least 2 options`**:
  - KI muss `options` ergänzen (mind. 2) und `correctAnswer` muss **exakt** einem `options`-String entsprechen.
- **Audio-clean Serbian**:
  - Im Feld `serbian` darf nur das Wort/die kurze Wortgruppe stehen (keine Klammern, Slash-Listen, Satzzeichen).

