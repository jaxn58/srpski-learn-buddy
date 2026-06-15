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

### 2.1 Brücke zu AI Energy

Die nutzersichtbare Einheit ist **AI Energy** (siehe `02_TOKEN_SYSTEM.md`), kein „1 Nachricht = 1 Token". Eine Aktion kostet je nach Typ unterschiedlich viel Energy (kompakt 1, ausgewogen 2, ausführlich 3, +1 für RAG-Kontext, +3 Foto-Scan, Dokumenten-Analyse **proportional zur Größe ab ~5, ohne fixen Cap**).

Übersetzt in KI-Kosten (2.5 Flash, konservativ):

| Aktion | Energy | KI-Kosten (Worst Case) | Kosten / Energy |
|---|---:|---:|---:|
| Kompakt, kein Kontext | 1 | ~$0,0012 | ~$0,0012 |
| Ausgewogen + RAG | 3 | ~$0,003 | ~$0,0010 |
| Ausführlich + RAG | 4 | ~$0,007 | ~$0,0018 |
| Dokumenten-Analyse | ab ~5, proportional | skaliert mit Größe | ~$0,0007–0,0010 |

**Konservative Obergrenze für die Kalkulation: ~$0,002 pro Energy** (deckt den teuersten Fall ab). Diese Größe verwenden wir unten für Worst-Case-Abschätzungen.

> Die **dynamische** Upload-Abrechnung (proportional, kein Energy-Cap) ist per Definition kostendeckend: Der User verbraucht nur so viel Energy, wie die Analyse real kostet. Das echte Kostenrisiko begrenzt das **technische Input-Limit** (max. Tokens/Seiten), nicht ein Energy-Cap (siehe `02` Abschnitt 2.2).

## 3. Kernaussage: KI-Kosten sind nicht der Preistreiber

Selbst im **Worst Case** (~$0,002 pro Energy, siehe 2.1) sind die monatlichen Inklusiv-Kontingente extrem günstig in der Bereitstellung:

| Paket | Inklusiv-Energy/Monat | Max. KI-Kosten/Monat (Worst Case) |
|---|---:|---:|
| Basic Kombi | 120 | ~$0,24 |
| AI Buddy Standalone | 450 | ~$0,90 |
| Full Package | 750 | ~$1,50 |

Schlussfolgerung: Die Pakete und Energy-Mengen sind **wertbasiert** zu bepreisen (Zahlungsbereitschaft, Positionierung), nicht kostenbasiert. Die KI-Kosten sind ein kleiner einstelliger Prozentsatz des Paketpreises.

## 4. Energy-Nachkauf-Ökonomie

| Pack | Energy | Verkaufspreis | KI-Kosten (Worst Case) | Deckungsbeitrag |
|---|---:|---:|---:|---:|
| Starter | 150 | 4,99 € | ~$0,30 | ~94 % |
| Plus | 500 | 11,99 € | ~$1,00 | ~92 % |
| Pro | 1.500 | 29,99 € | ~$3,00 | ~90 % |

Selbst bei durchgehend „schweren" Aktionen (~$0,002 pro Energy) bleibt die Marge auf die reinen KI-Kosten über 90 %. (Andere Kostenanteile wie Zahlungsgebühren, Infrastruktur, Content/Entwicklung sind hier nicht enthalten und im Paketpreis zu decken.)

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
2. Finale Energy-Inklusiv-Mengen, Verbrauchstabelle (Energy je Aktionstyp) und Nachkauf-Preise.
3. Ratenzahlung für welche Pakete?
4. Modellwahl (2.5 Flash vs. günstiger/neuer) als bewusste Margen-Entscheidung.
