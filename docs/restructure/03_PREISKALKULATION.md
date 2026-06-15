# Preiskalkulation

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

> Alle Preise sind **Vorschläge zur Freigabe**. Die KI-Kosten sind belegt; die Endpreise sind eine Geschäftsentscheidung (wertbasiert).

---

## 1. KI-Kostenbasis (Quelle: offizielle Google-Preise)

Modell laut Code-Standard (`convex/ai/chatConfig.ts`): **Gemini 2.5 Flash**.
Quelle: Google AI Pricing (https://ai.google.dev/gemini-api/docs/pricing), abgerufen Juni 2026.

| Modell | Input / 1M Tokens | Output / 1M Tokens |
|---|---:|---:|
| Gemini 2.5 Flash (Standard) | $0.30 | $2.50 |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 |
| Gemini 3 Flash Preview | $0.50 | $3.00 |
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 |

Embeddings (Semantic Search), `gemini-embedding-001`: $0.15 / 1M Input → pro Anfrage vernachlässigbar (~50–100 Tokens).

> Hinweis: USD/EUR wird hier näherungsweise als ~Parität behandelt. Für die Größenordnung der Kalkulation ist der Wechselkurs irrelevant (Kosten liegen im Bereich von Bruchteilen eines Cent).

## 2. Kosten pro Buddy-Nachricht

Token-Zusammensetzung je Nachricht (Schätzung, gedeckt durch `docs/CHAT_BETA_COST_ANALYSIS.md` aus dem `chat`-Branch): System-Prompt + RAG-Chunks + Unit-Kontext + Verlauf + User-Text als Input, plus Antwort als Output.

| Szenario | Input | Output | Kosten (2.5 Flash) |
|---|---:|---:|---:|
| Typisch (RAG aktiv, mittlere Antwort) | ~2.500 | ~800 | **~$0,003** |
| Schwer (voller Kontext + lange Antwort, ~2.048 Output) | ~5.000 | ~2.048 | **~$0,007** |

Mit **Flash-Lite** sänken dieselben Anfragen auf ~$0,0006 (typisch) bzw. ~$0,0013 (schwer) – Faktor ~6 günstiger. Im Chat-Admin ohne Deploy umschaltbar.

## 3. Kernaussage: KI-Kosten sind nicht der Preistreiber

Selbst im **Worst Case** kostet eine Buddy-Nachricht ~$0,007. Die monatlichen Inklusiv-Kontingente sind damit extrem günstig in der Bereitstellung:

| Paket | Inklusiv-Token/Monat | Max. KI-Kosten/Monat (Worst Case) |
|---|---:|---:|
| Basic Kombi | 40 | ~$0,28 |
| AI Buddy Standalone | 150 | ~$1,05 |
| Full Package | 250 | ~$1,75 |

Schlussfolgerung: Die Pakete und Token-Mengen sind **wertbasiert** zu bepreisen (Zahlungsbereitschaft, Positionierung), nicht kostenbasiert. Die KI-Kosten sind ein kleiner einstelliger Prozentsatz des Paketpreises.

## 4. Token-Nachkauf-Ökonomie

| Pack | Token | Verkaufspreis | KI-Kosten (Worst Case) | Deckungsbeitrag |
|---|---:|---:|---:|---:|
| Starter | 50 | 4,99 € | ~$0,35 | ~93 % |
| Plus | 150 | 11,99 € | ~$1,05 | ~91 % |
| Pro | 500 | 29,99 € | ~$3,50 | ~88 % |

Selbst bei durchgehend „schweren" Anfragen bleibt die Marge auf die reinen KI-Kosten über 85 %. (Andere Kostenanteile wie Zahlungsgebühren, Infrastruktur, Content/Entwicklung sind hier nicht enthalten und im Paketpreis zu decken.)

## 5. Abo-Preis-Grid (Vorschlag)

Prepaid-Gesamtpreise in EUR, je Laufzeit. **Full Package = aktueller Preis-Anker** (heutige Plan-Preise), damit Bestands-/Beta-User konform bleiben; die anderen Pakete darunter gestaffelt.

| Paket | 3 Monate | 6 Monate | 9 Monate | 12 Monate |
|---|---:|---:|---:|---:|
| Sprachkurs | 39 € | 49 € | 59 € | 69 € |
| AI Buddy Standalone | 45 € | 59 € | 75 € | 89 € |
| Basic Kombi | 55 € | 69 € | 85 € | 99 € |
| Full Package | 69 € | 79 € | 95 € | 119 € |

Eigenschaften des Grids:
- „Just-€20-more"-Logik: Basic Kombi 12M (99 €) → Full Package 12M (119 €) = +20 €.
- AI Buddy Standalone liegt unter Basic Kombi (kein Kurs enthalten), aber mit Nachkauf-Option.
- Sprachkurs als klarer Einstiegspreis.

### Ratenzahlung (bestehende Logik)

Aufschlag +10 %, monatliche Rate auf `*.99` aufgerundet (`getInstallmentMonthlyChargeCents` in `convex/subscriptions.ts`).

Beispiel Full Package 12 Monate: 119 € × 1,1 = 130,90 € → / 12 ≈ 10,91 € → gerundet **10,99 €/Monat**.

Empfehlung (zu bestätigen): Ratenzahlung erst ab Basic Kombi anbieten; Sprachkurs nur prepaid. Das reduziert die Zahl der Dodo-Produkte.

## 6. Sensitivität / Annahmen

- Realistische Daily-Active-Rate (20–30 %) senkt die durchschnittlichen KI-Kosten je zahlendem User zusätzlich deutlich.
- Inklusiv-Kontingent verfällt monatlich → kein „Aufstauen" von Kosten.
- Globales Tages-Budget (`chatAiConfig.dailyBudgetCents`) bleibt als Notbremse aktiv.
- Bei Bedarf günstigeres Modell (Flash-Lite) für einfache Anfragen → Kostenhebel ohne Preis-/Produktänderung.

## 7. Offene Preis-Entscheidungen

1. Finale Abo-Preise je Zelle des Grids.
2. Finale Token-Inklusiv-Mengen und Nachkauf-Preise.
3. Ratenzahlung für welche Pakete?
4. Modellwahl (2.5 Flash vs. günstiger/neuer) als bewusste Margen-Entscheidung.
