# Tarif- und Token-Umbau – Konzept-Übersicht

**Status:** Konzept (interne Planung, deutsch)
**Branch:** `feature/tariff-token-restructure`
**Stand:** Juni 2026
**Quellen der Anforderung:** `docs/restructure/AI Learn Buddy.pdf`, `docs/restructure/My First Board.csv`

> Diese Dokumente beschreiben ausschließlich das **Konzept** und die **Kalkulation**. Es werden in dieser Phase keine Schema- oder Code-Änderungen vorgenommen. Die Implementierung erfolgt erst nach Freigabe (siehe `04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md`).

---

## 1. Ausgangslage (Ist-Zustand)

Die App vermarktet heute **rein laufzeitbasierte Tarife**. Es gibt kein Feature-Gating und kein Token-/Credit-System.

- Pläne (hardcodiert in `convex/subscriptions.ts`, `SUBSCRIPTION_PLANS`):
  - `beta` (0 €), `intensive` (3 Monate, 69 €), `balanced` (6 Monate, 79 €), `standard` (9 Monate, 95 €), `relaxed` (12 Monate, 119 €)
  - Zahlung: Einmalzahlung (`prepaid`) oder Ratenzahlung (`installments`, +10 %, auf `*.99` gerundet)
- Zugriff wird gesteuert über: aktives Abo mit `planType !== "beta"`, das Flag `isBetaTester` und Chat-Rate-Limits in `convex/chat.ts`. **Kein** deklaratives Entitlement-System.
- Payment-Provider: **Dodo Payments** (Produkt-IDs als Env-Variablen, Checkout-Overlay, Webhooks in `convex/http.ts`).
- **Kein** Token-/Credit-System. Der Chat kennt nur Rate-Limits (Beta: 10 Nachrichten/Tag, 3 davon „detailed").

## 2. Zielbild (Soll-Zustand)

Übergang von „Wie lange?" zu „**Welche Features?** × **Wie lange?**" – ein 2-Achsen-Modell mit vier Paketen, das die bestehende Dodo-/Subscription-Mechanik weiterverwendet, plus ein neues **AI-Energy-Guthaben-System** für den AI-Buddy (verbrauchsbasiert, nicht „1 Nachricht = 1 Token").

Die vier Pakete (Namen final):

1. **Sprachkurs** (EN: „Course") – günstiger Einstieg, nur Lerninhalte, kein vollwertiger Buddy
2. **AI Chat Standalone** – nur der Buddy mit allen erweiterten Fähigkeiten, ohne Lerninhalte
3. **Sprachkurs + AI** (EN: „Course + AI") – Lerninhalte + Basis-Buddy (kontextverknüpft) **+ Chat-Anhänge**, ohne Wissensablage
4. **Sprachkurs + AI Pro** (EN: „Course + AI Pro") – alles inkl. Wissensablage, Community/Lerngruppen, größtes Energy-Kontingent

## 3. Aktualisierte Feature-Matrix (nach Entscheidungen)

Quelle: `My First Board.csv`, mit getroffenen Entscheidungen eingearbeitet (Context-Linking aus Standalone entfernt; günstigstes Paket = „Sprachkurs"; **Chat-Anhänge und Wissensablage getrennt**, Juni 2026).

| Feature | Sprachkurs | AI Chat Standalone | Sprachkurs + AI | Sprachkurs + AI Pro |
|---|:---:|:---:|:---:|:---:|
| Feste Lerninhalte (strukturierte Kurse) | ✓ | ✗ | ✓ | ✓ |
| AI Buddy Chat (Basis) | ✗ | ✓ | ✓ | ✓ |
| Context-Linking (Buddy ↔ Lerninhalte) | ✗ | **✗** | ✓ | ✓ |
| Chat-Anhänge (Fotos & Dateien im Chat) | ✗ | ✓ | **✓** | ✓ |
| Wissensablage (Wissensbasis in Meine Bibliothek) | ✗ | ✓ | ✗ | ✓ |
| Energy-Nachkauf möglich | ✗ | ✓ | **✓** | ✓ |
| Community/Lerngruppen | ✗ | ✗ | ✗ | ✓ |
| Teaser: 1–2 AI-Fragen/24h | ✓ | ✗ | ✗ | ✗ |
| Zielgruppe | Preisbewusste Lerner, Einsteiger | Expats, Einwanderer, Profis | Lerner mit AI-Support | Power-User, Experten |
| Preis-Positionierung | Günstig (€) | Mittel (€€) + Energy-Pakete | Mittel (€€) + Energy-Pakete | Premium (€€€) + Energy-Pakete |

**Fett markiert** = Änderung gegenüber der Original-CSV bzw. früheren Matrix-Version.

> **Abgrenzung Chat-Anhänge vs. Wissensablage:** Chat-Anhänge sind Dateien/Fotos **in einer einzelnen Chat-Nachricht** (auch multimodal / „Foto-Scan" über Vision-Aufschlag). Die Wissensablage ist die **persistente Dokumenten-Bibliothek** in der **Wissensbasis** (Bereich **Meine Bibliothek**), durchsuchbar über Chats hinweg. Sprachkurs + AI hat Chat-Anhänge (100 MB Speicher), aber **keine** Wissensablage – der Upsell zu Pro betrifft primär die Wissensablage.

## 4. Getroffene Entscheidungen

- **Abrechnungsmodell:** 2-Achsen-Modell (Paket × Laufzeit), Wiederverwendung des bestehenden Laufzeit-/Dodo-Systems. (Details: `01_TARIFE_UND_FEATURES.md`)
- **Verbrauchseinheit:** **AI Energy** (nicht „Token = 1 Nachricht"). Verschiedene KI-Aktionen verbrauchen unterschiedlich viel Energy (kompakt/ausgewogen/ausführlich, RAG-Kontext, Vision-Aufschlag bei Chat-Anhängen/Bildern, Dokumenten-Analyse in der Wissensablage). Intern werden echte LLM-Tokens + Aktionstyp gemessen und in einen gerundeten Energy-Betrag umgerechnet. (Details: `02_TOKEN_SYSTEM.md`)
- **Energy-Verfügbarkeit:** Nur Buddy-haltige Pakete haben Energy-Guthaben. Nachkauf bei **AI Chat Standalone**, **Sprachkurs + AI** und **Sprachkurs + AI Pro**. **Sprachkurs + AI** hat 250 Energy/Monat (Mid-Tier-Komfort-Quote für aktive Lerner, ~3–4 Fragen/Tag); zusätzlicher Nachkauf ist möglich. Sprachkurs hat nur den Teaser.
- **Context-Linking:** Nur in Sprachkurs + AI und Sprachkurs + AI Pro (aus Standalone entfernt).
- **Chat-Anhänge vs. Wissensablage (Juni 2026):** Zwei getrennte Feature-Flags (`chatAttachments`, `knowledgeRack`). Chat-Anhänge ab Sprachkurs + AI (und Standalone/Pro); Wissensablage nur Standalone und Sprachkurs + AI Pro. „Foto-Scan" ist kein eigenes Flag – Bilder werden als Chat-Anhang verarbeitet (Vision-Aufschlag). **UI-Nomenklatur (DE):** Hub = **Meine Bibliothek**, Dokumentenbereich = **Wissensbasis**, Tarif-Feature = **Wissensablage**. Details: `01_TARIFE_UND_FEATURES.md` §2–4.
- **Name günstigstes Paket:** „Sprachkurs" (EN „Course"). „Standalone-App" verworfen (Kollision mit „AI Chat Standalone").
- **Teaser-Semantik:** Der Sprachkurs-Teaser (1–2 Fragen/24h) zeigt den **Buddy aus Sprachkurs + AI** (kontextverknüpfter Basis-Buddy) als Upsell-Vorschau.
- **Branch-Basis (empfohlen):** `chat`-Branch als technische Grundlage für die Buddy-/RAG-Features. (Details: `04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md`)

## 5. Offene Punkte (vor Implementierung final zu bestätigen)

1. **Finale Preise** je Paket × Laufzeit. *Entschieden Juni 2026:* Preis-Grid final (Sprachkurs 39–69 € / AI Chat Standalone 45–89 € / Sprachkurs + AI 55–99 € / Sprachkurs + AI Pro 69–119 €). Anker-Preis = bestehender Plan-Preis (Bestandsschutz). Details: `03_PREISKALKULATION.md` Abschnitt 5.
2. **Finale Energy-Kontingente** (Inklusiv-Mengen + Nachkauf-Pakete) und **finale Verbrauchstabelle** (Energy je Aktionstyp).
   - *Entschieden Juni 2026:* Launch-Inklusiv-Mengen (Sprachkurs + AI: **250** / AI Chat Standalone: **600** / Sprachkurs + AI Pro: 750). Standalone von 450 → 600 angehoben (kein Kurs → AI-Chat ist einziges Produkt-Element), Sprachkurs + AI von 120 → 250 angehoben (UX-Korrektur, 120 wirkte als „Demo-Quota"). Weitere Anhebungen als Post-Launch-Hebel offen (siehe `07_MARKTANALYSE.md`).
   - *Entschieden Juni 2026 (finalisiert):* Top-up-Pakete mit monoton fallender €/Energy-Treppe: Starter 500 Energy / 4,99 € (0,00998 €/Energy), Plus 1 500 (1 000 + 500 Bonus) / 9,99 € (0,00666 €/Energy, −33 %), Pro 4 000 (2 500 + 1 500 Bonus) / 22,99 € (0,00575 €/Energy, −14 %). Worst-Case-Marge ≥ 70 % in jedem Pack. Pro nicht durch 2× Plus schlagbar (siehe `02_TOKEN_SYSTEM.md` Abschnitt 4 und `03_PREISKALKULATION.md` Abschnitt 4).
   - *Weiter offen:* Verbrauchstabelle (Energy je Aktionstyp) bleibt Vorschlag, da admin-konfigurierbar zur Laufzeit (kein Implementierungs-Blocker).
3. **Energy-Verfallsregel:** Inklusiv-Kontingent monatlich zurücksetzen (Vorschlag), gekaufte Top-up-Energy bis Abo-Ende gültig.
   - *Entschieden:* **Upload-Abrechnung dynamisch** (proportional, kein fixer Energy-Cap), abgesichert über Pflicht-Vorabbestätigung + technisches Input-Limit; Grenzfall „nicht genug Energy" = blockieren statt zuschneiden (Variante A). Details: `02_TOKEN_SYSTEM.md` 2.2.
4. **Laufzeit-/Ratenzahlungs-Matrix:**
   - *Aktualisiert Juni 2026:* Ratenzahlung für **alle vier Tarife** (Sprachkurs, AI Chat Standalone, Sprachkurs + AI, Sprachkurs + AI Pro). Der Sprachkurs ist damit **nicht mehr prepaid-only** – auf Produktwunsch erhält auch der günstigste Tarif die monatliche Zahlung (gleiches 10-%-Aufschlag-Modell). Daraus 24 Abo-Produkt-IDs (4 Tarife × 3 Laufzeiten × 2 Modi) + 3 Top-ups = **27 Dodo-Produkt-IDs** (siehe `02_TOKEN_SYSTEM.md` Abschnitt 9, `03_PREISKALKULATION.md` Abschnitt 5).
5. **Grandfathering der Beta-/Bestandskunden:** Vorschlag = automatisch „Sprachkurs + AI Pro" (Zero-Migration via Default `featureTier = "course_ai_pro"`). *(noch zu bestätigen)*
6. **Buddy-Naming/Persona:** Geklärt — die Persona heißt durchgehend **„AI Buddy"**. Kulturell unverfänglich, in EN/DE gleichermaßen lesbar, kein politisches Statement. Der frühere Arbeitsname „Brate" ist überall ersetzt.
7. **Community/Lerngruppen:** existiert in keinem Branch, echtes Neu-Feature → eigener, späterer Arbeits-Track.

## 6. Dokument-Index

- `00_KONZEPT_UEBERSICHT.md` – dieses Dokument
- `01_TARIFE_UND_FEATURES.md` – Pakete, Laufzeiten, Feature-zu-Code-Mapping, Gating-Strategie
- `02_TOKEN_SYSTEM.md` – AI-Energy-Modell, Verbrauchstabelle, Kontingente, Nachkauf, Schema-Skizze, Dodo-Produkte
- `03_PREISKALKULATION.md` – KI-Kostenbasis, Preis-Grid, Token-Ökonomie
- `04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md` – Branch-Empfehlung, Konsolidierung, Phasen-Roadmap, Risiken
- `05_LANDINGPAGE_KONZEPT.md` – Landingpage-Konzept (Conversion, Live-Demo, Lead-Magnet, Mobile/SEO/a11y)
- `06_ADMIN_BEREICH.md` – Überführung des Admin-Bereichs (Tier-Override, Energy-Verwaltung, Energy-Config, Analytics, Dodo-Produkte)
- `07_MARKTANALYSE.md` – Wettbewerb, Alleinstellungsmerkmal, strategische Einordnung der Energy-Menge
