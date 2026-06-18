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
| Sprachkurs + AI | 250 | ~$0,50 |
| AI Chat Standalone | 600 | ~$1,20 |
| Sprachkurs + AI Pro | 750 | ~$1,50 |

Schlussfolgerung: Die Pakete und Energy-Mengen sind **wertbasiert** zu bepreisen (Zahlungsbereitschaft, Positionierung), nicht kostenbasiert. Die KI-Kosten sind ein kleiner einstelliger Prozentsatz des Paketpreises.

## 4. Energy-Nachkauf-Ökonomie

> **Entscheidung (Juni 2026, finalisiert):** Saubere monoton fallende €/Energy-Treppe über alle drei Packs, mit Worst-Case-Marge ≥ 70 %. Das Pro-Pack wurde gegenüber einem früheren Entwurf (3 000 Energy / 24,99 €) auf **4 000 Energy / 22,99 €** angepasst, weil dieser Entwurf einen Anti-Bulk-Discount erzeugte (1× Pro war teurer als 2× Plus für dieselbe Energy-Menge). Vollständige Herleitung in `02_TOKEN_SYSTEM.md` §4.

Annahmen: Aktives Modell Gemini 2.5 Flash ($0,30 Input / $2,50 Output pro 1M Tokens). Worst Case = 1 250 Input + 512 Output Tokens je Energy → ~$0,00166/Energy. Typical Mix = 833 in + 267 out → ~$0,00092/Energy. USD ~ EUR (1:1 konservativ).

| Pack | Energy (inkl. Bonus) | Bonus-Anteil | Preis | **€/Energy** | KI-Kosten Worst | **Marge Worst** | KI-Kosten Typical | Marge Typical |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Starter | 500 (0 Bonus) | 0 % | 4,99 € | **0,00998 €** | $0,83 | **83 %** | $0,46 | 91 % |
| Plus | 1 500 (500 Bonus) | 50 % | 9,99 € | **0,00666 €** (−33 % zu Starter) | $2,49 | **75 %** | $1,38 | 86 % |
| Pro | **4 000 (1 500 Bonus)** | **60 %** | **22,99 €** | **0,00575 €** (−14 % zu Plus) | $6,64 | **71 %** | $3,67 | 84 % |

Live-Werte (mit dem tatsächlich aktiven Modell und der tatsächlichen Verbrauchstabelle) sind im Admin-UI unter `/admin/energy` jederzeit sichtbar (`getEnergyEconomics` rechnet die Tabelle bei jedem Aufruf neu durch).

**Konsistenz-Check:** 2× Plus = 3 000 Energy für 19,98 € (0,00666 €/Energy). 1× Pro = 4 000 Energy für 22,99 € (0,00575 €/Energy). Pro bleibt **günstiger pro Energy** und liefert 1 000 Energy mehr; der Marginalpreis für die zusätzlichen 1 000 Energy = 3,01 €, also 0,003 €/Energy — starker Pro-Upgrade-Anreiz. ✓

**Strategische Notiz:** Heavy-User, die Top-ups kaufen, lösen tendenziell teurere Aktionen aus (Dokumenten-Analyse, viel RAG, detaillierte Antworten). Deswegen ist die Worst-Case-Spalte die für Top-up-Kalkulation relevantere — und genau die wurde als Untergrenze ≥ 70 % gehalten. Die typische Marge liegt 13–17 Prozentpunkte darüber.

(Andere Kostenanteile wie Zahlungsgebühren ~3 %, Infrastruktur ~5–10 %, Content/Entwicklung sind hier nicht enthalten und müssen im Paketpreis zusätzlich gedeckt sein. Auch nach Abzug dieser Posten bleibt jeder Top-up im positiven Deckungsbeitrag — Pro mit ~58 % effektiver Vollkosten-Marge, Plus ~62 %, Starter ~70 %.)

## 5. Abo-Preis-Grid

Prepaid-Gesamtpreise in EUR, je Laufzeit. **Sprachkurs + AI Pro = aktueller Preis-Anker** (heutige Plan-Preise), damit Bestands-/Beta-User konform bleiben; die anderen Pakete darunter gestaffelt.

> **Entscheidung (Juni 2026):** Preis-Grid final festgelegt. **Drei Laufzeiten: 3 / 6 / 12 Monate** (9-Monats-Variante entfernt – reduziert Komplexität in Pricing-UI und Dodo-Produkt-Matrix; die Mid-Tier-Laufzeit wird durch das 6-Monats-Paket abgedeckt).

| Paket | 3 Monate | 6 Monate | 12 Monate | €/Monat (12M) |
|---|---:|---:|---:|---:|
| Sprachkurs | 39 € | 49 € | 69 € | 5,75 € |
| AI Chat Standalone | 45 € | 59 € | 89 € | 7,42 € |
| Sprachkurs + AI | 55 € | 69 € | 99 € | 8,25 € |
| Sprachkurs + AI Pro | 69 € | 79 € | 119 € | 9,92 € |

Eigenschaften des Grids:
- **Bestandsschutz:** Sprachkurs + AI Pro 12M = 119 € identisch zum heutigen Plan-Preis (Beta-/Bestandskunden bleiben konform).
- **„Just-€20-more"-Logik:** Sprachkurs + AI 12M (99 €) → Sprachkurs + AI Pro 12M (119 €) = +20 € Aufpreis für **Wissensablage**, Community + 500 Energy mehr/Monat → starkes Upsell-Argument auf der Pricing-Page (**Wissensablage** und Community sind die primären Upsell-Hebel; Chat-Anhänge sind in Sprachkurs + AI bereits enthalten).
- **AI Chat Standalone** liegt unter Sprachkurs + AI (kein Kurs enthalten), kompensiert mit deutlich größerem Energy-Kontingent (600 vs. 250) + Top-up-Option. Juni 2026: Standalone-Quote von 450 → 600 angehoben (kein Kurs → AI-Chat ist einziges Produkt-Element); Sprachkurs-+-AI-Quote von 120 → 250 angehoben (UX-Korrektur: 120 wirkte als „Demo-Quota").
- **Sprachkurs** als klarer Einstiegspreis (5,75 €/Monat bei 12M), prepaid **oder** Ratenzahlung.
- **Marktpositionierung:** Alle Tarife liegen effektiv €/Monat unter dem Wettbewerber-Marktpreis (~$10–$16/Monat-Abos), Einmalzahlung zusätzlicher USP (siehe `07_MARKTANALYSE.md`).

### Ratenzahlung (bestehende Logik)

Aufschlag +10 %, monatliche Rate auf `*.99` aufgerundet (`getInstallmentMonthlyChargeCents` in `convex/subscriptions.ts`).

Beispiel Sprachkurs + AI Pro 12 Monate: 119 € × 1,1 = 130,90 € → / 12 ≈ 10,91 € → gerundet **10,99 €/Monat**.

Beispiele Sprachkurs (Raten, +10 %, auf `*.99` gerundet): 3M 39 € → **14,99 €/Monat**, 6M 49 € → **8,99 €/Monat**, 12M 69 € → **6,99 €/Monat**.

> **Entscheidung (Juni 2026):** Ratenzahlung wird ursprünglich **ab „Sprachkurs + AI" aufwärts** angeboten (Sprachkurs nur prepaid).
>
> **Aktualisiert (Juni 2026):** Auf Produktwunsch erhält **auch der Sprachkurs** die Ratenzahlung (gleiches 10-%-Modell). Damit gilt für **alle vier Tarife** prepaid **und** Raten. Die Dodo-Produkt-Matrix wächst auf **4 Tarife × 3 Laufzeiten × 2 Modi = 24 Abo-Produkte** zzgl. 3 Top-up-Produkte (= 27 Produkt-IDs). Die ursprüngliche Begründung (geringe Conversion beim niedrigsten Einstiegspreis) wird zugunsten einer einheitlichen, marktüblichen Zahlungsoption verworfen.

## 6. Sensitivität / Annahmen

- Realistische Daily-Active-Rate (20–30 %) senkt die durchschnittlichen KI-Kosten je zahlendem User zusätzlich deutlich.
- Inklusiv-Kontingent verfällt monatlich → kein „Aufstauen" von Kosten.
- Globales Tages-Budget (`chatAiConfig.dailyBudgetCents`) bleibt als Notbremse aktiv.
- Bei Bedarf günstigeres Modell (Flash-Lite) für einfache Anfragen → Kostenhebel ohne Preis-/Produktänderung.

## 7. Preis-Entscheidungen (Stand)

1. ~~Finale Abo-Preise je Zelle des Grids.~~ **Entschieden Juni 2026:** Preis-Grid final (siehe Abschnitt 5).
2. **Finale Energy-Inklusiv-Mengen** (entschieden: Sprachkurs + AI 250 / AI Chat Standalone 600 / Sprachkurs + AI Pro 750), **Verbrauchstabelle** (Energy je Aktionstyp, weiter Vorschlag, admin-konfigurierbar) und **Nachkauf-Preise** (entschieden Juni 2026, finalisiert: Starter 500/4,99 €, Plus 1 500/9,99 €, Pro 4 000/22,99 € — siehe Abschnitt 4 für die vollständige Treppen-Herleitung und Marge-Tabelle).
3. ~~Ratenzahlung für welche Pakete?~~ **Entschieden Juni 2026, aktualisiert Juni 2026:** Ratenzahlung für **alle vier Tarife** inkl. Sprachkurs (siehe Abschnitt 5 / Ratenzahlung).
4. **Modellwahl** (2.5 Flash vs. günstiger/neuer) als bewusste Margen-Entscheidung. *(weiter offen, kein Blocker — admin-konfigurierbar zur Laufzeit)*
