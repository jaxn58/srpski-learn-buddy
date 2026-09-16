# Gemini Model Upgrade – Content Studio (September 2026)

**Datum**: 2026-09-16  
**Durchgeführt von**: AI Agent (Cursor), Phase 0 des Plans "Content Studio Upgrade"  
**Grund**: Modellliste des Content Studios enthielt ein abgeschaltetes Modell (`gemini-3.1-flash-lite-preview`) und ein Legacy-Modell (`gemini-3-flash-preview`); neue stabile Gemini-3.x-Modelle fehlten. Das Thinking-Handling in den AI-Aufrufen behandelte ausschließlich Gemini 2.5 und hätte Gemini 3.x fehlerhaft angesteuert.

---

## Zusammenfassung

Diese Runde ändert **keine aktive Modellkonfiguration**. Creator und Lector laufen weiterhin mit dem in der DB (`contentStudioConfig`) hinterlegten Modell (Stand Dev: `gemini-2.5-pro` für beide Stufen). Geändert wurden ausschließlich:

1. Die Auswahlliste im Admin-UI des Content Studios (`MODEL_META`).
2. Die Preistabelle für die Energy-/Kosten-Kalkulation (`MODEL_PRICING`).
3. Das Thinking-Handling der OpenAI-kompatiblen Gemini-Aufrufe (`callAiJson`, `callAiText`), jetzt zentral in `convex/contentStudio/_modelCapabilities.ts`.
4. Regressionstests für den Markdown-Parser (Fixtures publizierter Units) und für die Modellregeln.

Ein Modellwechsel erfolgt erst nach dem Eval (Phase 3) und ausschließlich über die Admin-Konfiguration, ohne Deploy.

---

## Offizieller Modellstatus (geprüft 2026-09-16)

Quellen:
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/openai (Abschnitt "Thinking")

| Modell | Status | Konsequenz |
|--------|--------|------------|
| `gemini-3.1-flash-lite-preview` | Abgeschaltet seit 2026-05-25 | Aus `MODEL_META` entfernt |
| `gemini-3-flash-preview` | Legacy, Ersatzempfehlung `gemini-3.6-flash` | Aus `MODEL_META` entfernt, durch `gemini-3.8-flash` ersetzt |
| `gemini-3.1-pro-preview` | Preview, kein Abschaltdatum | Bleibt (Flagship-Kandidat für Creator) |
| `gemini-3.8-flash` | GA seit 2026-09-02 | Neu in `MODEL_META` |
| `gemini-3.5-flash-lite` | GA seit 2026-07-21 | Neu in `MODEL_META` |
| `gemini-3.1-flash-lite` | GA seit 2026-05-07, Shutdown 2027-05-07 | Neu in `MODEL_META` mit Hinweis |
| `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite` | GA, kein Abschaltdatum | Unverändert |

Es gibt weiterhin **kein GA-Pro-Modell der 3er-Generation**.

### Preise (Standard-Tier, USD pro 1M Tokens)

| Modell | Input | Output (inkl. Thinking) | Hinweis |
|--------|-------|-------------------------|---------|
| gemini-3.1-pro-preview | 2,00 | 12,00 | bis 200k Kontext |
| gemini-3.8-flash / 3.7 / 3.6 | 0,75 | 3,75 | **Einführungspreis bis 2026-12-31**, ab 2027-01-01: 1,50 / 7,50 |
| gemini-3.5-flash | 1,50 | 9,00 | |
| gemini-3.5-flash-lite | 0,30 | 2,50 | |
| gemini-3.1-flash-lite | 0,25 | 1,50 | |
| gemini-2.5-pro | 1,25 | 10,00 | bis 200k Kontext |
| gemini-2.5-flash | 0,30 | 2,50 | |
| gemini-2.5-flash-lite | 0,10 | 0,40 | |

**Wiedervorlage**: Zum Jahreswechsel 2026/2027 `MODEL_META` und `MODEL_PRICING` für die 3.6/3.7/3.8-Flash-Preise anpassen und `PRICING_LAST_VERIFIED_AT` setzen.

---

## Thinking-Regeln (Gemini über OpenAI-kompatiblen Endpoint)

Laut offizieller Doku:

- **Alle Gemini 2.5- und 3.x-Modelle sind Thinking-Modelle.** Thinking-Tokens werden als Output abgerechnet und zählen in `max_tokens`. Ohne aufgeblähtes Budget endet die Antwort mit `finish_reason=length`.
- `reasoning_effort: "none"` (Thinking aus) akzeptieren **nur** Gemini 2.5 Flash und 2.5 Flash-Lite. Gemini 2.5 Pro und alle 3.x-Modelle lehnen den Wert ab.
- `reasoning_effort: low | medium | high` wird bei allen Thinking-Modellen auf `thinking_level` (3.x) bzw. `thinking_budget` (2.5) abgebildet.

### Vorher

`convex/contentStudio/_shared.ts` erkannte Thinking-Modelle über `model.includes("2.5")`. Für 3.x-Modelle wären weder `reasoning_effort` gesendet noch das Budget angehoben worden.

### Nachher

Neue, Convex-freie Hilfsfunktionen in `convex/contentStudio/_modelCapabilities.ts`:

- `isGeminiThinkingModel(provider, model)` – `^gemini-(2.5|3)` Familien.
- `supportsThinkingOff(provider, model)` – nur `gemini-2.5-flash*`.
- `buildReasoningParams(provider, model, effort)` – liefert `reasoning_effort` oder `{}`; "none" wird bei nicht unterstützten Modellen stillschweigend verworfen.
- `effectiveMaxTokens({...})` – Budget × 4, mindestens 16.384, außer Thinking wurde erfolgreich deaktiviert.

`callAiJson` und `callAiText` nutzen ausschließlich diese Funktionen. Aufrufer mit `reasoningEffort: "low"` (`_translationCore.ts`, `_verifier.ts`) sind unverändert und funktionieren mit 2.5 und 3.x.

**Nicht geändert**: `convex/ai/chatConfig.ts` (Learn-Buddy-Chat) hat eine eigene Erkennung `isGemini25Flash`. Sie ist für den Chat korrekt, solange dort 2.5-Modelle konfiguriert sind, und ist nicht Teil des Content-Studio-Plans.

---

## Nachtrag (gleicher Tag): Thinking-Tokens im Run-Log und in der Kostenformel

Der Creator-Testlauf (Unit 4, 2.5 Pro) zeigte `totalTokens` (10.442) deutlich über `inputTokens + outputTokens` (8.547). Die Differenz sind Thinking-Tokens, die Google als Output abrechnet. Bisher wurden sie weder gespeichert noch in die Kostenschätzung einbezogen, wodurch Creator-Kosten um rund 40 Prozent zu niedrig ausgewiesen wurden.

Änderungen:

- `contentDraftAiRuns.thinkingTokens` (optional) im Schema; `logAiRun` nimmt das Feld an.
- Neuer Helfer `usageForRunLog(usage)` in `_shared.ts`; alle Aufrufer (`_creator.ts`, `_sectionRevise.ts`, `_auditor.ts`) übergeben damit einheitlich Input, Output, Total und Thinking.
- `estimateCostUsdFromEnv`: Output-Seite = `outputTokens + thinkingTokens`. Fällt ohne `AI_PRICING_USD_PER_1M_JSON` auf die verifizierte Tabelle `MODEL_PRICING` zurück, sodass Kosten jetzt auch ohne Env-Override berechnet werden.
- Admin-UI: neue gemeinsame Komponente `client/src/components/admin/contentStudio/AiRunMeta.tsx` (Zeitstempel im Projektformat `formatDateTimeEU`, Token-Zeile inkl. thinking und Kosten). Inspector-Panel zeigt Datum und Tokens jetzt ebenfalls; Findings-Liste zeigt den Erstellungszeitpunkt je Finding.

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `convex/contentStudio/_modelCapabilities.ts` | Neu: Thinking-Regeln als pure Funktionen |
| `convex/contentStudio/_shared.ts` | `callAiJson`/`callAiText` verwenden `effectiveMaxTokens` und `buildReasoningParams` |
| `client/src/components/admin/contentStudio/constants.ts` | `MODEL_META` bereinigt und erweitert (siehe Tabelle oben) |
| `convex/ai/modelPricing.ts` | Gemini-3.x-Einträge, `PRICING_LAST_VERIFIED_AT = "2026-09-16"` |
| `scripts/contentStudio/model-capabilities.test.ts` | Neu: 35 Tests für die Thinking-Regeln |
| `scripts/markdownParser/parser-regression.test.ts` | Neu: 22 Tests, frieren Parser-Verhalten für publizierte Units ein |
| `scripts/markdownParser/__fixtures__/unit2-morning-coffee.md` | Fixture: Snapshot der publizierten Unit 2 (Dev) |
| `scripts/markdownParser/__fixtures__/unit3-market-numbers.md` | Fixture: Snapshot der publizierten Unit 3 (Dev) |
| `convex/schema/contentStudio.ts` | `contentDraftAiRuns.thinkingTokens` (optional) |
| `convex/contentStudio/_mutations.ts` | `logAiRun` akzeptiert und speichert `thinkingTokens` |
| `convex/contentStudio/_creator.ts`, `_sectionRevise.ts`, `_auditor.ts` | Run-Logging über `usageForRunLog` bzw. aggregierte Thinking-Tokens |
| `client/src/components/admin/contentStudio/AiRunMeta.tsx` | Neu: gemeinsame Zeitstempel- und Token-Anzeige |
| `client/src/components/admin/contentStudio/InspectorPanel.tsx`, `QAFindingsPanel.tsx` | Datum/Uhrzeit, Tokens inkl. thinking, Kosten; Zeitstempel je Finding |

---

## Verhalten bei alten Konfigurationen

Ist in `contentStudioConfig` ein Modell hinterlegt, das nicht mehr in `MODEL_META` steht (z. B. `gemini-3-flash-preview`), zeigt das Admin-UI es im "Custom"-Modus an; die Aufrufe laufen weiter, solange Google den Endpoint bedient. Für `gemini-3.1-flash-lite-preview` würde Google `404` liefern; dieses Modell war in Dev nicht konfiguriert.

---

## Rollback

- Modellliste/Preise: Datei-Revert; keine Datenmigration.
- Thinking-Handling: Revert von `_shared.ts` auf die `includes("2.5")`-Logik; `_modelCapabilities.ts` kann stehen bleiben.
- Aktive Modellwahl: jederzeit im Admin-UI ohne Deploy änderbar.

---

## Nächste Schritte laut Plan

1. Phase 2: Parser-Erweiterung für die didaktische Grammatik-Vorlage (rückwärtskompatibel, durch die neuen Regressionstests absichert).
2. Phase 3: Modell-Eval mit `gemini-2.5-pro` (Baseline), `gemini-3.8-flash`, `gemini-3.1-pro-preview`.
3. Entscheidung über die aktive Modellkonfiguration durch den Superadmin.
