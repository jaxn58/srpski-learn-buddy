# Gemini Model Upgrade (Januar 2026)

**Datum**: 2026-01-23  
**Durchgeführt von**: AI Agent (Cursor)  
**Grund**: Google stellt `gemini-2.0-flash` ab (frühestens Februar 2026); empfohlener Ersatz ist `gemini-2.5-flash`.

---

## Zusammenfassung

Alle Gemini-Modell-Referenzen im Projekt wurden konsistent auf **`gemini-2.5-flash`** umgestellt:

- **Chat & Feedback** (`convex/chat.ts`, `convex/feedback.ts`): `gemini-2.0-flash` → `gemini-2.5-flash`
- **Zentrale LLM-Utility** (`server/_core/llm.ts`): `gemini-1.5-flash` → `gemini-2.5-flash`
- **Translation-Script** (`scripts/translate-units-with-ai.ts`): `gemini-1.5-flash` → `gemini-2.5-flash`
- **Dokumentation** (`docs/migration_guide.md`): Beispiel-Code aktualisiert

---

## Hintergrund

### Google Deprecation Timeline (Stand: 2026-01-23)

| Modell | Release | Shutdown (frühestens) | Empfohlener Ersatz |
|--------|---------|----------------------|-------------------|
| `gemini-2.0-flash` | Feb 2025 | Feb 2026 | `gemini-2.5-flash` |
| `gemini-2.0-flash-001` | Feb 2025 | Feb 2026 | `gemini-2.5-flash` |
| `gemini-1.5-flash` | Mai 2024 | Sep 2025 (abgeschaltet) | `gemini-2.5-flash` |

**Quelle**: [Google Gemini API Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

### Warum `gemini-2.5-flash`?

- **Offiziell empfohlen** als Ersatz für 2.0 Flash
- **Stabil** (GA seit Juni 2025)
- **Bestes Price/Performance** laut Google
- **Kompatibel** mit OpenAI-API-Endpoint (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`)
- **Thinking-Capabilities** (adaptive reasoning)
- **1M Token Context Window**, 65k Output Tokens

---

## Geänderte Dateien

### 1. `convex/chat.ts` (Zeile 568)

**Vorher:**
```typescript
const model = isGemini ? "gemini-2.0-flash" : "gpt-4o-mini";
```

**Nachher:**
```typescript
const model = isGemini ? "gemini-2.5-flash" : "gpt-4o-mini";
```

**Kommentar aktualisiert (Zeile 566-567):**
```typescript
// Use gemini-2.5-flash for OpenAI-compatible endpoint
// Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
```

---

### 2. `convex/feedback.ts` (Zeile 370)

**Vorher:**
```typescript
const model = isGemini ? "gemini-2.0-flash" : "gpt-4o-mini";
```

**Nachher:**
```typescript
const model = isGemini ? "gemini-2.5-flash" : "gpt-4o-mini";
```

---

### 3. `server/_core/llm.ts` (Zeile 289)

**Vorher:**
```typescript
const model = process.env.GEMINI_API_KEY ? "gemini-1.5-flash" : "gpt-4o-mini";
```

**Nachher:**
```typescript
const model = process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "gpt-4o-mini";
```

---

### 4. `scripts/translate-units-with-ai.ts` (Zeile 114)

**Vorher:**
```typescript
const model = (GEMINI_API_KEY || (apiKey === GEMINI_API_KEY)) ? "gemini-1.5-flash" : "gpt-4o-mini";
```

**Nachher:**
```typescript
const model = (GEMINI_API_KEY || (apiKey === GEMINI_API_KEY)) ? "gemini-2.5-flash" : "gpt-4o-mini";
```

---

### 5. `docs/migration_guide.md` (Zeile 315)

**Vorher:**
```typescript
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
```

**Nachher:**
```typescript
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
```

---

### 6. `client/src/pages/Home.tsx` (Zeile 153, 178)

**Bonus-Fix** (unabhängig vom Modell-Upgrade):
- TypeScript-Fehler behoben: `getPlanAction` Return-Type präzisiert (`"current" | "upgrade" | "renew" | "choose"`)
- Vergleich in Zeile 178 jetzt korrekt typisiert

---

## Verifikation

### Typecheck
```bash
pnpm -s check
```
**Ergebnis**: ✅ Keine TypeScript-Fehler

### Build
```bash
pnpm -s build
```
**Ergebnis**: ✅ Erfolgreich (10s Client-Build, 6ms Server-Build)

### Linter
```bash
ReadLints convex/chat.ts convex/feedback.ts server/_core/llm.ts scripts/translate-units-with-ai.ts
```
**Ergebnis**: ✅ Keine Linter-Fehler

---

## Risiko & Rollback

### Risiko
- **Minimal**: Nur der Modell-String ändert sich; Endpoint, Auth und Request-Format bleiben identisch.
- **API-Kompatibilität**: `gemini-2.5-flash` nutzt denselben OpenAI-kompatiblen Endpoint wie 2.0 Flash.

### Rollback (falls nötig)
1. **Schnell**: Umgebungsvariable `OPENAI_API_KEY` setzen → automatischer Fallback auf `gpt-4o-mini`
2. **Manuell**: Modell-Strings zurück auf `gemini-2.0-flash` (bis spätestens Feb 2026)

---

## Nächste Schritte

1. **Deployment**: Änderungen auf Produktion deployen (Convex + Vercel)
2. **Monitoring**: Chat-Logs/Fehlerraten in den ersten 24h beobachten
3. **Optional**: Smoke-Test im Dev-Environment (eine Chat-Nachricht senden)

---

## Referenzen

- [Gemini API OpenAI Compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini Models Overview](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Gemini 2.5 Flash Specs](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash)
