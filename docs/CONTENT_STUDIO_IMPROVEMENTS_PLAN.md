# Content Studio - Verbesserungsplan

## Übersicht

Dieses Dokument beschreibt den strukturierten Plan zur Integration der vorgeschlagenen Verbesserungen für das Content Studio System. Die Verbesserungen sind in 5 Kategorien unterteilt und nach Priorität geordnet.

---

## 1. Workflow-Optimierungen

### 1A) Batch-Operations
**Problem:** Mehrere Drafts gleichzeitig bearbeiten ist umständlich  
**Lösung:** "Batch Generate" für mehrere Drafts, "Batch Validate", "Batch Publish"

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Neue Tabelle `contentDraftBatchJobs`:
     ```typescript
     contentDraftBatchJobs: defineTable({
       jobType: v.union(v.literal("generate"), v.literal("validate"), v.literal("publish")),
       draftIds: v.array(v.id("contentDrafts")),
       status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
       results: v.optional(v.array(v.object({
         draftId: v.id("contentDrafts"),
         success: v.boolean(),
         error: v.optional(v.string()),
       }))),
       createdBy: v.id("users"),
       createdAt: v.number(),
       completedAt: v.optional(v.number()),
     })
     ```

2. **Backend Actions** (`convex/contentStudio/_mutations.ts` oder neue Datei `_batch.ts`)
   - `runBatchGenerate`: Sequenziell mehrere Drafts generieren
   - `runBatchValidate`: Sequenziell mehrere Drafts validieren
   - `runBatchPublish`: Sequenziell mehrere Drafts publishen
   - Progress-Tracking pro Draft

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Checkbox-Selection in Draft-Liste
   - "Batch Actions" Button mit Dropdown:
     - "Generate Selected (X)"
     - "Validate Selected (X)"
     - "Publish Selected (X)"
   - Progress-Dialog mit Status pro Draft
   - Toast-Notifications für Completion

**Aufwand:** ~8-12 Stunden  
**Priorität:** Mittelfristig (High Impact)

---

### 1B) Draft-Templates
**Problem:** Jeder Draft muss manuell konfiguriert werden  
**Lösung:** Templates speichern (Reference + Skills + Brief), "Create from Template"

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Neue Tabelle `contentDraftTemplates`:
     ```typescript
     contentDraftTemplates: defineTable({
       name: v.string(),
       description: v.optional(v.string()),
       // Template-Daten (kopiert aus contentDrafts)
       inspirationRef: v.optional(v.object({...})), // wie bei contentDrafts
       specialistSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
       auditorSkillIds: v.optional(v.array(v.id("contentStudioSkills"))),
       creatorBrief: v.optional(v.string()), // Template-Brief
       createdBy: v.id("users"),
       createdAt: v.number(),
       updatedAt: v.number(),
       isActive: v.boolean(),
     })
     ```

2. **Backend Mutations** (`convex/contentStudio/_mutations.ts`)
   - `createTemplate`: Speichert Template aus bestehendem Draft
   - `createDraftFromTemplate`: Erstellt neuen Draft basierend auf Template
   - `updateTemplate`: Aktualisiert Template
   - `deleteTemplate`: Löscht Template

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - "Templates" Tab in Settings Sheet
   - Template-Liste mit CRUD-Operationen
   - "Create Draft from Template" Button im Create-Dialog
   - Template-Dropdown beim Draft-Erstellen

**Aufwand:** ~6-8 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

### 1C) Auto-Save während Edit Content
**Problem:** Bei langen Edit-Sessions geht Input verloren  
**Lösung:** Auto-Save alle 30 Sekunden, "Draft has unsaved changes" Warnung

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Erweitere `contentDrafts`:
     ```typescript
     // In contentDrafts:
     draftMeta: v.optional(v.object({
       title: v.string(),
       description: v.optional(v.string()),
       creatorBrief: v.optional(v.string()),
       // ... andere Meta-Felder
     })),
     lastAutoSavedAt: v.optional(v.number()),
     ```

2. **Backend Mutation** (`convex/contentStudio/_mutations.ts`)
   - `autoSaveDraftMeta`: Speichert Meta-Daten ohne Snapshot zu erstellen
   - Optimistisch: Keine Validierung, nur Speichern

3. **Frontend Logic** (`client/src/pages/ContentStudioAdmin.tsx`)
   - `useEffect` Hook mit `setInterval` (30 Sekunden)
   - Prüft ob `draftEditTitle`, `draftEditDescription`, `draftCreatorBrief` geändert wurden
   - Ruft `autoSaveDraftMeta` auf
   - Badge "Unsaved changes" wenn lokaler State != gespeicherter State
   - Warnung beim Verlassen der Seite (Browser `beforeunload`)

**Aufwand:** ~4-6 Stunden  
**Priorität:** Sofort umsetzbar (Quick Win)

---

## 2. Qualitätsverbesserungen

### 2A) Exercise-Variety-Score
**Problem:** Repetitive Exercises werden erst im Validator erkannt  
**Lösung:** Real-time Score während Generation ("Variety: 7/10"), Warnung vor Generate

#### Implementierungsschritte:
1. **Backend Helper** (`convex/contentStudio/_validatorHelpers.ts`)
   - Neue Funktion `calculateExerciseVarietyScore(unitPackage)`:
     - Analysiert alle Exercise Prompts
     - Berechnet Ngram-Overlap zwischen Prompts
     - Score: 0-10 (10 = maximale Variety)
     - Formel: `10 - (overlapRatio * 10)` mit Cap bei 0

2. **Backend Action** (`convex/contentStudio/_creator.ts`)
   - Nach Markdown-Generation: Parse → Calculate Score
   - Wenn Score < 7: Warning-Log
   - Score wird in Snapshot-Metadata gespeichert

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Nach Generate: Badge "Variety Score: 7/10" (grün/gelb/rot)
   - Tooltip: "Low variety detected. Consider revising exercises."
   - Optional: Pre-Generate Check (wenn Draft bereits Snapshot hat)

**Aufwand:** ~6-8 Stunden  
**Priorität:** Mittelfristig (High Impact)

---

### 2B) Vocabulary-Coverage-Check
**Problem:** Wörter in Exercises fehlen manchmal in Vocabulary  
**Lösung:** Automatischer Check im Creator (nicht erst im Validator), Auto-Suggest

#### Implementierungsschritte:
1. **Backend Helper** (`convex/contentStudio/_validatorHelpers.ts`)
   - Erweitere `syncVocabularyCoverageFromExercises`:
     - Bereits vorhanden, aber nur im Validator
     - Verschiebe Logik in `_shared.ts` als wiederverwendbare Funktion

2. **Backend Action** (`convex/contentStudio/_creator.ts`)
   - Nach Markdown-Parse: Rufe Vocabulary-Coverage-Check auf
   - Wenn Wörter fehlen: Auto-Suggest aus `courseVocabulary`
   - Erstelle Findings mit Severity "warning" (nicht "error")

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - In Findings: Neue Kategorie "Vocabulary Coverage"
   - "Missing words in vocabulary: [word1, word2]"
   - "Auto-add" Button pro Finding

**Aufwand:** ~4-6 Stunden (Logik bereits vorhanden, nur UI fehlt)  
**Priorität:** Mittelfristig (High Impact)

---

### 2C) Serbian-Correctness-Pre-Check
**Problem:** Offensichtliche Serbian-Fehler werden erst im Lector gefunden  
**Lösung:** Lightweight Grammar-Check im Creator (z.B. via API), Warnungen

#### Implementierungsschritte:
1. **Backend Helper** (`convex/contentStudio/_shared.ts`)
   - Neue Funktion `checkSerbianBasicGrammar(text)`:
     - Regex-basierte Checks:
       - Diakritika-Consistency (č vs c)
       - Common typos (z.B. "srpski" vs "srpski")
       - Basic word boundaries
     - Optional: Lightweight API-Call (z.B. Gemini mit kurzem Prompt)
     - Returns: `{ warnings: string[], score: number }`

2. **Backend Action** (`convex/contentStudio/_creator.ts`)
   - Nach Markdown-Generation: Check Serbian-Text in Vocabulary + Exercises
   - Erstelle Findings mit Severity "warning"

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - In Findings: "Serbian Grammar Warnings"
   - Zeige betroffene Wörter/Phrases

**Aufwand:** ~8-12 Stunden (abhängig von API-Integration)  
**Priorität:** Langfristig (Nice to Have)

---

## 3. Reference Library Erweiterungen

### 3A) Multi-PDF-Support
**Problem:** Nur ein PDF pro Reference möglich  
**Lösung:** Mehrere PDFs pro Reference, kombinierte Guidelines

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Erweitere `contentStudioReferences`:
     ```typescript
     // Statt einzelner storageId:
     pdfFiles: v.optional(v.array(v.object({
       storageId: v.string(),
       fileName: v.string(),
       uploadedAt: v.number(),
     }))),
     // Guidelines werden aus allen PDFs kombiniert
     ```

2. **Backend Action** (`convex/contentStudio/_creator.ts`)
   - `ensureReferenceGuidelines`: Verarbeitet alle PDFs
   - Kombiniert Extrakt aus allen PDFs (max. 40k chars total)
   - Generiert kombinierte Guidelines

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Reference Edit: "Add PDF" Button (mehrfach)
   - PDF-Liste mit Delete-Button
   - Upload-Progress pro PDF

**Aufwand:** ~6-8 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

### 3B) Guidelines-Manual-Edit
**Problem:** AI-Guidelines können unpassend sein, keine manuelle Anpassung  
**Lösung:** "Edit Guidelines" Button, manuelle Override möglich

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Erweitere `contentStudioReferences`:
     ```typescript
     guidelinesManualOverride: v.optional(v.boolean()), // true = manuell editiert
     guidelinesEditedAt: v.optional(v.number()),
     guidelinesEditedBy: v.optional(v.id("users")),
     ```

2. **Backend Mutation** (`convex/contentStudio/_mutations.ts`)
   - `updateReferenceGuidelines`: Speichert manuelle Guidelines
   - Setzt `guidelinesManualOverride = true`
   - Verhindert Auto-Regeneration

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - In Reference Edit: "Edit Guidelines" Button
   - Textarea mit Guidelines-Text
   - "Save Guidelines" Button
   - "Reset to AI-Generated" Button (falls manuell editiert)

**Aufwand:** ~3-4 Stunden  
**Priorität:** Sofort umsetzbar (Quick Win)

---

### 3C) Guidelines-Versioning
**Problem:** Guidelines werden überschrieben, keine Historie  
**Lösung:** Versionierung der Guidelines, "Revert to previous version"

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Neue Tabelle `contentStudioReferenceGuidelineVersions`:
     ```typescript
     contentStudioReferenceGuidelineVersions: defineTable({
       referenceId: v.id("contentStudioReferences"),
       guidelines: v.string(),
       version: v.number(), // Auto-increment
       provider: v.optional(v.string()),
       model: v.optional(v.string()),
       isManual: v.boolean(),
       createdBy: v.id("users"),
       createdAt: v.number(),
     })
       .index("by_reference", ["referenceId"])
       .index("by_reference_version", ["referenceId", "version"]),
     ```

2. **Backend Mutations** (`convex/contentStudio/_mutations.ts`)
   - Bei Guidelines-Update: Erstelle neuen Version-Eintrag
   - `revertGuidelinesToVersion`: Setzt Guidelines zurück auf bestimmte Version

3. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - "Guidelines History" Accordion in Reference Edit
   - Version-Liste mit Timestamp, Provider, Manual-Flag
   - "Revert" Button pro Version

**Aufwand:** ~4-6 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

## 4. UI/UX-Verbesserungen

### 4A) Progress-Indicator
**Problem:** Bei langen Generations läuft man blind  
**Lösung:** Echtzeit-Progress ("Generating... 45%", "Validating vocabulary...")

#### Implementierungsschritte:
1. **Backend Action** (`convex/contentStudio/_creator.ts`, `_validator.ts`)
   - Streaming-Response (falls möglich) oder Polling
   - Progress-Events während Generation:
     - "Extracting PDF... 10%"
     - "Generating markdown... 45%"
     - "Parsing structure... 80%"
     - "Validating... 95%"
   - Speichere Progress in `contentDraftAiRuns`:
     ```typescript
     progressPercent: v.optional(v.number()),
     progressMessage: v.optional(v.string()),
     ```

2. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Progress-Bar Komponente (bereits vorhanden via `Progress`)
   - Polling während `runningCreator`/`runningValidator`:
     - Query `contentDraftAiRuns` für aktuellen Draft
     - Zeige `progressPercent` und `progressMessage`
   - Real-time Updates alle 1-2 Sekunden

**Aufwand:** ~6-8 Stunden  
**Priorität:** Sofort umsetzbar (Quick Win)

---

### 4B) Diff-View für Revisions
**Problem:** Nach "Edit Content" sieht man nicht, was sich geändert hat  
**Lösung:** Side-by-Side Diff (alt vs. neu), Highlight Changes

#### Implementierungsschritte:
1. **Backend Query** (`convex/contentStudio/_queries.ts`)
   - `getDraftSnapshotDiff`: Vergleicht zwei Snapshots
   - Returns: `{ added: [], removed: [], modified: [] }` pro Section

2. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Nach Section-Revise: "View Changes" Button
   - Diff-Komponente (z.B. `react-diff-viewer` oder custom)
   - Side-by-Side View:
     - Links: Vorher (letzter Snapshot)
     - Rechts: Nachher (aktueller Snapshot)
   - Highlight: Grün = hinzugefügt, Rot = entfernt, Gelb = geändert

**Aufwand:** ~8-10 Stunden  
**Priorität:** Sofort umsetzbar (Quick Win)

---

### 4C) Keyboard-Shortcuts
**Problem:** Viele Klicks für häufige Aktionen  
**Lösung:** Shortcuts (z.B. Ctrl+G = Generate, Ctrl+V = Validate)

#### Implementierungsschritte:
1. **Frontend Hook** (`client/src/hooks/useKeyboardShortcuts.ts`)
   - Neuer Hook für Keyboard-Shortcuts
   - `useEffect` mit `keydown` Event-Listener
   - Shortcuts:
     - `Ctrl+G` / `Cmd+G`: Generate
     - `Ctrl+V` / `Cmd+V`: Validate
     - `Ctrl+L` / `Cmd+L`: Run Lector
     - `Ctrl+P` / `Cmd+P`: Publish
     - `Ctrl+S` / `Cmd+S`: Save Draft
     - `Ctrl+/` / `Cmd+/`: Show Shortcuts Help

2. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Shortcut-Hints in Tooltips
   - "Keyboard Shortcuts" Dialog (via `Ctrl+/`)

**Aufwand:** ~3-4 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

## 5. Monitoring & Analytics

### 5A) Generation-Metrics
**Problem:** Keine Übersicht über Erfolgsraten  
**Lösung:** Dashboard: "QC Pass Rate: 78%", "Average Revisions per Draft: 2.3"

#### Implementierungsschritte:
1. **Backend Queries** (`convex/contentStudio/_queries.ts`)
   - `getGenerationMetrics`:
     - QC Pass Rate (qc_passed / total drafts)
     - Average Revisions per Draft (Anzahl Snapshots - 1)
     - Average Time to Publish (createdAt → publishedAt)
     - Drafts by Status (Count)

2. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - "Analytics" Tab oder neuer Section
   - Metrics-Cards:
     - "QC Pass Rate: 78%"
     - "Avg Revisions: 2.3"
     - "Avg Time to Publish: 4.2 days"
     - Status-Distribution (Pie Chart)

**Aufwand:** ~6-8 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

### 5B) AI-Cost-Tracking
**Problem:** Kosten für AI-Calls sind intransparent  
**Lösung:** "This generation cost: $0.12", "Total cost this month: $45.30"

#### Implementierungsschritte:
1. **Schema-Erweiterung** (`convex/schema.ts`)
   - Erweitere `contentDraftAiRuns`:
     ```typescript
     inputTokens: v.optional(v.number()),
     outputTokens: v.optional(v.number()),
     estimatedCost: v.optional(v.number()), // in USD
     ```

2. **Backend Action** (`convex/contentStudio/_shared.ts`)
   - Nach AI-Call: Berechne Tokens (falls API das liefert)
   - Berechne Cost basierend auf Provider/Model:
     - Gemini: Pricing-Tabelle
     - OpenAI: Pricing-Tabelle
   - Speichere in `contentDraftAiRuns`

3. **Backend Query** (`convex/contentStudio/_queries.ts`)
   - `getAiCosts`: Summiere Costs pro Zeitraum

4. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - Nach Generate/Validate/Lector: Toast mit Cost
   - "AI Costs" Tab: Monatliche Übersicht
   - Cost-Chart (optional)

**Aufwand:** ~8-10 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

### 5C) Quality-Trends
**Problem:** Keine Langzeit-Trends sichtbar  
**Lösung:** "Average Exercise Variety Score: 8.2 (↑0.3)", "QC Failures: 12% (↓2%)"

#### Implementierungsschritte:
1. **Backend Query** (`convex/contentStudio/_queries.ts`)
   - `getQualityTrends`: Aggregiert Daten über Zeit
   - Pro Monat:
     - Average Variety Score
     - QC Failure Rate
     - Average Revisions

2. **Frontend UI** (`client/src/pages/ContentStudioAdmin.tsx`)
   - "Quality Trends" Section
   - Line-Chart: Variety Score über Zeit
   - Line-Chart: QC Failure Rate über Zeit
   - Trend-Indikatoren (↑/↓)

**Aufwand:** ~6-8 Stunden  
**Priorität:** Langfristig (Nice to Have)

---

## Priorisierte Roadmap

### Phase 1: Quick Wins (Sofort umsetzbar)
1. ✅ **Auto-Save** (1C) - 4-6h
2. ✅ **Guidelines-Manual-Edit** (3B) - 3-4h
3. ✅ **Progress-Indicator** (4A) - 6-8h
4. ✅ **Diff-View** (4B) - 8-10h

**Total:** ~21-28 Stunden

### Phase 2: High Impact (Mittelfristig)
1. ✅ **Exercise-Variety-Score** (2A) - 6-8h
2. ✅ **Vocabulary-Coverage-Check** (2B) - 4-6h
3. ✅ **Batch-Operations** (1A) - 8-12h

**Total:** ~18-26 Stunden

### Phase 3: Nice to Have (Langfristig)
1. ✅ **Draft-Templates** (1B) - 6-8h
2. ✅ **Multi-PDF-Support** (3A) - 6-8h
3. ✅ **Guidelines-Versioning** (3C) - 4-6h
4. ✅ **Serbian-Correctness-Pre-Check** (2C) - 8-12h
5. ✅ **Keyboard-Shortcuts** (4C) - 3-4h
6. ✅ **Generation-Metrics** (5A) - 6-8h
7. ✅ **AI-Cost-Tracking** (5B) - 8-10h
8. ✅ **Quality-Trends** (5C) - 6-8h

**Total:** ~47-64 Stunden

---

## Nächste Schritte

1. **Review & Priorisierung:** User bestätigt Prioritäten
2. **Phase 1 starten:** Quick Wins implementieren
3. **Testing:** Jede Phase einzeln testen
4. **Iteration:** Feedback einarbeiten

---

## Technische Notizen

- **Schema-Änderungen:** Immer Migration-Script erstellen für Production
- **Backward Compatibility:** Alte Drafts müssen weiterhin funktionieren
- **Performance:** Batch-Operations sollten sequenziell laufen (nicht parallel) um Rate-Limits zu vermeiden
- **Error Handling:** Jede neue Feature sollte graceful failures haben
