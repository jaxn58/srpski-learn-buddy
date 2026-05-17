# Chat Beta -- Kostenanalyse & Rate-Limiting

> Stand: April 2026 | Modell: Gemini 2.5 Flash (Standard Paid Tier)

---

## Preise: Gemini 2.5 Flash

| Typ | Preis pro 1M Tokens |
|---|---|
| Input (Text / Bild / Video) | **$0.30** |
| Output (inkl. Thinking Tokens) | **$2.50** |

Quelle: [Google AI Developer Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## Token-Zusammensetzung pro Nachricht

Jede gesendete Chat-Nachricht besteht aus mehreren Schichten, die zu einem einzigen API-Call zusammengefugt werden:

| Schicht | Geschaetzte Tokens |
|---|---|
| System Prompt (Basis) | ~500 |
| Semantic RAG (bis 5 Knowledge-Chunks) | ~500 – 1.000 |
| Unit Context (Vokabeln + Grammatik + Phrasen) | ~1.000 – 2.500 |
| Chat-Verlauf (letzte 8 Nachrichten) | ~200 – 600 |
| User-Nachricht (max. 1.500 Zeichen bei Beta) | ~100 – 375 |
| **Gesamt Input** | **~1.300 – 5.000** |
| **Output** (Beta-Cap: 2.048 Tokens) | **~300 – 2.048** |

---

## Kosten pro Beta-User (alle 10 Nachrichten/Tag verbraucht)

| Szenario | Input/Tag | Output/Tag | Kosten/User/Tag |
|---|---|---|---|
| Leicht (kurze Msgs, wenig RAG) | 10.000 T | 3.000 T | **~$0.011** |
| Typisch (RAG aktiv, mittlere Antworten) | 25.000 T | 8.000 T | **~$0.028** |
| Maximum (voller Unit-Context + 2.048 T Output) | 50.000 T | 20.480 T | **~$0.066** |

---

## Hochrechnung (alle User nutzen taglich ihr volles Limit)

| User | Typisch/Tag | Typisch/Monat | Worst-Case/Monat |
|---|---|---|---|
| 10 | $0.28 | $8 | $20 |
| 25 | $0.70 | $21 | $50 |
| 50 | $1.40 | $42 | $100 |
| 100 | $2.80 | $84 | $200 |

> **Hinweis:** In der Praxis nutzen nie alle User jeden Tag ihr volles Limit.
> Ein realistischer Daily-Active-Rate von 20–30 % reduziert die Kosten nochmal um Faktor 3–4.

---

## Konfigurierte Limits (Beta-Phase)

| Parameter | Beta-User | Paid-User | Admin / Superadmin |
|---|---|---|---|
| Nachrichten / Tag | **10** | 100 | unbegrenzt |
| Nachrichten / Minute | 10 | 20 | unbegrenzt |
| Nachrichten / Stunde | 60 | 200 | unbegrenzt |
| Max. Nachrichtenlaenge | 1.500 Zeichen | 3.000 Zeichen | unbegrenzt |
| Max. Output-Tokens | **2.048** | unbegrenzt (Modell-Config) | unbegrenzt |
| Countdown-Badge im Chat | ja | nein | nein |
| Beta-Banner im Chat | ja | nein | nein |

---

## Automatischer "Schalter" -- wie die Beta-Phase endet

Die Limits sind vollstaendig subscription-basiert. Es ist **kein manueller Eingriff oder Code-Deployment** noetig:

```
Kein aktives Abo       →  Beta-Limits (10 Msg/Tag, 2.048 Token Output)
planType = "beta"      →  Beta-Limits (identisch)
planType = "intensive"
         "balanced"    →  Paid-Limits (100 Msg/Tag, volle Token)
         "standard"
         "relaxed"
role = "admin"         →  keine Limits
role = "superadmin"    →  keine Limits
```

Sobald ein User ein Abo kauft, greift automatisch das Paid-Tier.

---

## Globales Tages-Budget (Notbremse)

Im Chat-Admin-Dashboard (`/admin/chat`) kann ein **globales Tages-Budget in Cents** konfiguriert werden.

- Einheit: US-Cent (z.B. `500` = $5.00/Tag)
- Wird ueberschritten: Alle Chat-Anfragen werden fuer den Rest des Tages gesperrt
- `0` oder leer = kein globales Limit
- Kostenberechnung: Schaetzung basierend auf Zeichenlaenge (~4 Zeichen = 1 Token, Gemini Flash Preise)

---

## Potenzielle Kostensenkung: Gemini 2.5 Flash-Lite

Wer noch guenstiger fahren will:

| Modell | Input/1M | Output/1M | Faktor |
|---|---|---|---|
| Gemini 2.5 Flash (aktuell) | $0.30 | $2.50 | 1x |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | ~6–7x guenstiger |

Flash-Lite ist fuer einfache Sprachtutor-Aufgaben (Vokabeln, Grundgrammatik) ausreichend.
Fuer komplexe Grammatikerklarungen und kulturelle Kontexte empfiehlt sich Flash.
Das Modell ist jederzeit im Chat-Admin ohne Deployment wechselbar.

---

## Hinweis: Thinking Tokens

Gemini 2.5 Flash ist ein "Hybrid Reasoning Model" und kann intern Thinking Tokens generieren.
Unser System nutzt die OpenAI-kompatible REST-Schnittstelle, bei der Thinking standardmaessig deaktiviert ist.
Der Output-Preis von $2.50/1M ist dennoch der Worst-Case-Wert (inkl. Thinking).
