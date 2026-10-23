# Energy-Vorschau gegen Abzug bei Chat-Anhängen

Stand: 2026-10-23. Entscheidungsvorlage. Preise, Zuschläge, Standardwerte und die Abzugsbeträge sind unverändert. Die Entscheidung liegt beim Betreiber.

## Befund

Die Vorschau und der Abzug rechnen verschieden.

- Die Vorschau in `previewEnergyBandForChat` nimmt ein Token-Band für die Antwort und legt den Anhangszuschlag darauf. Ein Bild kostet den Bild-Zuschlag. Jede andere Datei kostet Upload-Grundpreis plus Preis pro KB.
- Der Abzug in `resolveChatEnergyCharge` rechnet die gemessenen Input- und Output-Tokens in Energy um, mindestens 1. Den Pauschalwert mit Upload-Zuschlag nutzt er nur bei einer Nicht-Bild-Datei, wenn der Anbieter keine Nutzung meldet.
- Der frühere Kommentar an der Vorschau hat behauptet, der Zuschlag sei die Abrechnung. Das gilt nicht. Der Zuschlag steht nur in der Vorschau. Die Pauschale ersetzt die Tokens nur im genannten Sonderfall, und auch dann ist die Basis eine andere: Pauschale ist Antwort-Grundpreis plus RAG plus Upload, die Vorschau ist Token-Band plus Upload.

Textdateien (`text/plain`, `text/markdown`) setzt der Chat vor dem Modellaufruf inline. Der Abzug sieht sie deshalb nicht als Datei. Die Vorschau setzt `hasFileAttachment` für jede Nicht-Bild-Datei, also auch für Text. Der gespeicherte Schätzwert im Ledger wird beim Abzug neu gerechnet, mit dem Datei-Flag des Abzugs. Bei Text steht im Ledger deshalb die Mitte des Token-Bands, nicht die Zahl aus der Datei-Vorschau.

## Gemessene Konfiguration (Dev, nur gelesen)

Deployment `reminiscent-panda-57`. Leere Felder gelten als Code-Default.

| Wert | Gespeichert | Wirksam |
| --- | --- | --- |
| USD pro Energy | leer | 0,00166 |
| Bild-Zuschlag | 3 | 3 |
| Upload-Grundpreis | 5 | 5 |
| Preis pro KB | 0,02 | 0,02 |
| Kompakt / Ausführlich / RAG | 1 / 3 / 1 | 1 / 3 / 1 |
| Quota Sprachkurs + AI (`energyQuotaBasic`) | 250 | 250 |
| Quota Beta (`betaEnergyQuotaMonthly`) | 120 | 120 |
| Quota Standalone / Pro | 600 / 750 | 600 / 750 |
| Hauptmodell | `gemini-2.5-flash` (Google) | dasselbe |

Die Preistabelle in `convex/ai/modelPricing.ts` (Stand 2026-09-16) stimmt mit der Anbieterseite vom 2026-10-23 überein: Gemini 2.5 Flash, Standard, Paid, 0,30 USD je 1 Mio. Input-Tokens (Text, Bild, Video) und 2,50 USD je 1 Mio. Output-Tokens einschließlich Thinking. Quelle: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). Der Chat setzt für dieses Modell das Thinking-Budget auf 0.

Anbieterregeln für Anhänge, gelesen am 2026-10-23:

- [Document understanding](https://ai.google.dev/gemini-api/docs/document-processing): eine PDF-Seite entspricht 258 Tokens. Der Satz, dass nativer PDF-Text nicht berechnet wird, steht dort nur im Abschnitt für Gemini 3.
- [Media resolution, generateContent](https://ai.google.dev/gemini-api/docs/generate-content/media-resolution), Stand 2026-10-13: Gemini 2.5, Default, Bild 256 plus Pan and Scan (etwa 2048); PDF mit nativem Text 256 plus nativer Text je Seite. Der Chat setzt `media_resolution` nicht.
- [Token counting](https://ai.google.dev/gemini-api/docs/generate-content/tokens): `usage_metadata.prompt_token_count` ist der Input und umfasst multimodale Eingaben. Bilder bis 384 Pixel auf beiden Seiten sind 258 Tokens, größere Bilder werden in 768-Pixel-Kacheln zu je 258 Tokens zerlegt.

Die zwei PDF-Angaben (258 je Seite, bzw. 256 plus nativer Text) widersprechen sich. Die Messung unten folgt der Seitenregel, nicht der vollen Textmenge.

## Messung in Dev

Konto: das lokal eingeloggte Dev-Konto. Die Session lief gegen `http://localhost:5173` und `reminiscent-panda-57`. Die Energy-Anzeige stand vor der Messung auf 750 und ist mit jedem Abzug gefallen. Modus kompakt, RAG an, je ein frischer Chat, derselbe Auftrag. Ein erstes PDF war ungültig (Gemini: „The document has no pages“). Dafür gibt es keinen Ledger-Eintrag. Die Tabelle enthält das danach gesendete gültige PDF.

| Fall | Bytes | UI-Vorschau | Ledger geschätzt | Abzug | Aktion | Input | Output | Modell |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: | --- |
| Bild, nach Kompression | 513 346 | 4–5 | 5 | 1 | `photo_scan` | 4 004 | 39 | gemini-2.5-flash, multimodal |
| PDF, 400 Seiten | 1 220 928 | 30–31 | 31 | 20 | `document_analysis` | 106 962 | 55 | gemini-2.5-flash, multimodal |
| Textdatei | 20 480 | 7–8 | 2 | 2 | `compact` | 6 104 | 55 | gemini-2.5-flash, inline |
| Nachricht ohne Anhang | 0 | 1–2 | 2 | 1 | `compact` | 3 824 | 45 | gemini-2.5-flash |

Die UI-Mitte ist bei Bild und PDF der Ledger-Schätzwert. Bei der Textdatei nicht: die Datei-Vorschau zeigt 7–8 (Mitte 8), der Abzug speichert 2, weil er die Datei nicht mehr als Datei sieht.

Alle vier erfolgreichen Aufrufe haben Input- und Output-Tokens geliefert. Der Sonderfall ohne Nutzung ist nicht eingetreten. Der Code behält ihn.

Ob die Anhang-Tokens im Input stecken:

- PDF gegen die Nachricht ohne Anhang: 106 962 − 3 824 = 103 138 Tokens. Geteilt durch 400 Seiten sind das 258 Tokens je Seite. Die Textmenge von 1 000 000 Zeichen steckt nicht zusätzlich im Input. Der Anhang ist in den gemeldeten Input-Tokens enthalten.
- Textdatei gegen die Nachricht ohne Anhang: 6 104 − 3 824 = 2 280 Tokens. Der Server kürzt Text auf 8 000 Zeichen. 8 000 / 4 = 2 000 Tokens. Die gekürzte Datei steckt im Input.
- Bild gegen die Nachricht ohne Anhang: 4 004 − 3 824 = 180 Tokens. Das liegt unter der dokumentierten Untergrenze von 258. RAG-Kontext schwankt zwischen den Chats, deshalb isoliert diese Differenz die Bild-Tokens nicht. Der PDF-Vergleich ist der belastbare Beleg, dass Medientokens im gemeldeten Input stehen, wenn der Aufruf gelingt.

USD-Kosten des Anbieters, Formel `(Input × 0,30 + Output × 2,50) / 1 000 000`:

| Fall | Anbieter-USD | Abzug × 0,00166 | Vorschau-Mitte × 0,00166 |
| --- | ---: | ---: | ---: |
| Bild | 0,001299 | 0,001660 | 0,008300 |
| PDF | 0,032226 | 0,033200 | 0,051460 |
| Text, Abzug | 0,001969 | 0,003320 | 0,003320 (Ledger-Mitte 2) |
| Text, UI-Mitte 8 | 0,001969 | 0,003320 | 0,013280 |
| Ohne Anhang | 0,001260 | 0,001660 | 0,003320 |

Am internen USD-Ziel ist das PDF bei 20 Energy nahezu kostendeckend (Marge etwa 2,9 %). Der Bild-Abzug von 1 Energy deckt die gemessenen 0,001299 USD (Marge etwa 21,8 % am Zielwert). Die UI-Mitte liegt in allen Anhangsfällen über den Anbieterkosten.

Die beobachteten 7–8 Energy entstehen bei den heutigen Sätzen für eine Nicht-Bild-Datei um 20 KB (Grundpreis 5 plus 0,4, aufgerundet 6, plus Band 1–2). Ein PDF von 1,2 MB zeigt 30–31, nicht 7–8.

## Buchungen, nur gelesen

Vollständiger Scan, keine User-IDs, keine Inhalte, keine Mutation.

Dev, 59 Ledger-Zeilen, Scan vollständig. `photo_scan`: 2 Zeilen, davon eine mit Tokenpaar (die Messung, geschätzt 5, tatsächlich 1). `document_analysis`: 1 Zeile (die Messung, geschätzt 31, tatsächlich 20). Dev hat darüber hinaus keine vergleichbare Anhangshistorie.

Production `fleet-labrador-324`, 128 Ledger-Zeilen, Scan vollständig. Nur Zeilen mit gesetztem Schätz- und Ist-Wert:

| Aktion | Anzahl | Davon ohne Tokens | Geschätzt höher | Tatsächlich höher | Summe geschätzt | Summe tatsächlich | Mittel geschätzt | Mittel tatsächlich |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `photo_scan` | 13 | 0 | 10 | 2 | 53 | 22 | 4,1 | 1,7 |
| `document_analysis` | 6 | 0 | 6 | 0 | 50 | 9 | 8,3 | 1,5 |

Zeitraum Fotos: 2026-07-17 bis 2026-10-23. Dokumente: 2026-10-21 bis 2026-10-23. In Production hatte jede dieser Zeilen Tokens. Der Sonderfall ohne Nutzung kommt in diesem Bestand nicht vor. Die Schätzung liegt bei Dokumenten durchgehend und bei Fotos überwiegend über dem Abzug. Das ist das Muster der Messung (kleine Datei: Vorschau um 7–8, Abzug um 1 bis 2). Textdateien fehlen in `document_analysis`, weil der Abzug sie als `compact` bucht.

## Varianten

Kontingent in den Anteilen: 120 Energy/Monat, wie vorgegeben (Beta). Daneben die live gelesene Quota Sprachkurs + AI von 250. Die Anzeige des Messkontos war 750 (Pro). An keiner Quota wird etwas geändert.

Marge am internen Ziel: `(Abzug × 0,00166 − Anbieter-USD) / (Abzug × 0,00166)`. Marge am Top-up-Preis Plus aus `03_PREISKALKULATION.md`: 0,00666 EUR je Energy, USD und EUR hier 1:1 wie in dieser Kalkulation. Starter liegt bei 0,00998, Pro bei 0,00575. Die Inklusiv-Quota hat keinen Stückpreis; die Top-up-Marge gilt nur, wenn die Energy gekauft wurde.

### A. Abzug = Vorschau

Der Zuschlag kommt zusätzlich zu den gemessenen Tokens. Für Text heißt das, die Datei auch beim Abzug als Upload zu zählen, sonst bleibt die UI bei 7–8 und der Abzug bei 2.

| Fall | Abzug | Anteil an 120 | Anteil an 250 | Marge am Ziel | Marge am Plus-Top-up |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bild | 1 + 3 = 4 | 3,3 % | 1,6 % | 80,4 % | 95,1 % |
| PDF | 20 + 29 = 49 | 40,8 % | 19,6 % | 60,4 % | 90,1 % |
| Text | 2 + 6 = 8 | 6,7 % | 3,2 % | 85,2 % | 96,3 % |

Bei 120 Energy reichen dann 30 solcher Bilder, 2 solche PDFs oder 15 solche Textdateien im Monat. Heute sind es 120 Bilder, 6 PDFs oder 60 Textdateien.

Aufwand: klein, eine Änderung in der Abzugsfunktion plus die Text-Klassifikation. Risiko: ein großes PDF verbraucht ein Vielfaches der gemessenen Anbieterkosten an Quota. Die Production-Dokumente liegen im Mittel bei 1,5 Energy Abzug gegen 8,3 geschätzt. Variante A würde diese Lücke in die andere Richtung aufmachen und den Nutzer mehr zahlen lassen, als die Tokens kosten. Die Vorschau wäre damit noch nicht gleich dem Abzug, weil die Vorschau ein Band ist (30–31) und A einen Punkt erzeugt (49 beim PDF, weil 20 plus 29 über der Vorschau liegt).

### B. Vorschau = Abzug

Der Abzug bleibt tokenbasiert. Die Vorschau zeigt das bisherige Antwort-Band und schätzt die Anhang-Tokens hinein. Die Energy-Zuschläge entfallen in der Vorschau. Die Admin-Felder bleiben gespeichert und werden dort nur noch angezeigt.

Schätzung aus der Messung und der Seitenregel, nicht als Code umgesetzt:

- Bild: 258 Input-Tokens. Das hebt das kompakte RAG-Band nicht über 1–2. Abzug der Messung: 1.
- PDF: Seitenzahl × 258, hier 103 200 Tokens. In das Band gerechnet ergibt das etwa 19–20 Energy. Abzug der Messung: 20.
- Text: gekürzte Zeichen / 4, hier 2 000 Tokens. Band etwa 1–2. Abzug der Messung: 2. Die UI zeigt heute 7–8.

| Fall | Vorschau danach | Abzug (unverändert) | Anteil an 120 | Anteil an 250 | Marge am Ziel | Marge am Plus-Top-up |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Bild | 1–2 | 1 | 0,8 % | 0,4 % | 21,8 % | 80,5 % |
| PDF | 19–20 | 20 | 16,7 % | 8,0 % | 2,9 % | 75,8 % |
| Text | 1–2 | 2 | 1,7 % | 0,8 % | 40,7 % | 85,2 % |
| Ohne Anhang | 1–2 | 1 | 0,8 % | 0,4 % | 24,1 % | 81,1 % |

Aufwand: mittel. Nur die Vorschau und die Admin-Beschriftung. Der Abzug bleibt. Risiko: die Gemini-2.5-Tabelle nennt zusätzlich nativen PDF-Text. Diese eine Datei hat den nicht berechnet. Wechselt das Modell oder die Abrechnung, kann eine reine Seiten-Schätzung zu niedrig liegen. Das Band und ein Vergleich mit der gemeldeten Nutzung nach dem ersten echten Einsatz begrenzen das. Ein zweites Risiko: der Ledger speichert heute bei Text die Mitte ohne Zuschlag. Eine geänderte Vorschau sollte denselben Wert speichern, den die UI zeigt.

### C. Mindestpreis je Upload

Der Abzug bleibt tokenbasiert, Uploads haben einen Boden von 2 oder von 3 Energy. Die Vorschau bleibt, wie sie ist, solange sie nicht zusätzlich geändert wird.

| Fall | Boden 2 | Boden 3 | UI heute | Anteil Boden 3 an 120 | Marge Boden 3 am Ziel |
| --- | ---: | ---: | --- | ---: | ---: |
| Bild | 2 | 3 | 4–5 | 2,5 % | 73,9 % |
| PDF | 20 | 20 | 30–31 | 16,7 % | 2,9 % |
| Text, wenn der Boden für Text gilt | 2 | 3 | 7–8 | 2,5 % | 60,5 % |
| Text, heutige Klassifikation | 2 | 2 | 7–8 | 1,7 % | 40,7 % |

Aufwand: klein, ein Boden in der Abzugsfunktion, plus eine Entscheidung, ob Text ein Upload ist. Risiko: die sichtbare Lücke bleibt. Das Bild läge bei 3 gegen eine Vorschau von 4–5, das PDF bei 20 gegen 30–31, der Text bei 2 oder 3 gegen 7–8. Der Boden hebt nur Fälle, die unter ihm liegen. Das große PDF und die Production-Dokumente mit Schätzwert 8 und Abzug 1 bis 2 werden davon nicht zur Vorschau hin geschlossen.

## Empfehlung

Variante B.

Der gemessene Anbieterpreis steckt in den Tokens. Beim PDF decken 20 Energy die 0,032 USD fast genau am internen Ziel. Der Größen-Zuschlag von 29 Energy und der Bild-Zuschlag von 3 Energy liegen über diesen Kosten. Variante A würde das PDF auf 49 Energy setzen, das sind 41 % einer 120er-Quota für eine Datei, deren Tokens 20 Energy kosten. Variante C schließt die Vorschau nicht an den Abzug an.

Variante B macht die Zahl, die der Nutzer vor dem Senden sieht, zur Schätzung dessen, was der Abzug danach aus den Tokens macht. Für die drei Messfälle landet das Band auf dem Abzug (Bild 1–2 gegen 1, PDF 19–20 gegen 20, Text 1–2 gegen 2). Die Production-Daten zeigen dasselbe Muster: geschätzt höher als abgezogen, bei durchgängig gelieferten Tokens. Die Zuschläge können im Admin stehen bleiben, ohne den Chat zu verteuern.

Offen bleibt nur die PDF-Formel, falls ein späteres Modell den nativen Text zusätzlich zu den 258 Tokens je Seite berechnet. Das ist ein Grund, die Schätzung an der Seitenzahl festzumachen und sie nach einem Modellwechsel gegen die gemeldete Nutzung zu prüfen. Es ist kein Grund, den Zuschlag auf die Tokens zu addieren.

Umgesetzt am 2026-10-23 als Variante B. Die Vorschau schätzt Anhang-Tokens (Bild 258, PDF 258 je Seite, Text gekürzte Zeichen durch 4) und addiert die Zuschläge nicht mehr. Der Abzug bleibt tokenbasiert. Die Zuschläge bleiben gespeichert und sind im Admin nur noch Anzeige; Upload-Grundpreis und Preis pro KB gelten weiter nur, wenn eine Nicht-Bild-Datei keine Tokens meldet.
