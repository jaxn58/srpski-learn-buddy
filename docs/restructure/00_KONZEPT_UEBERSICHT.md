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
2. **AI Buddy Standalone** – nur der Buddy mit allen erweiterten Fähigkeiten, ohne Lerninhalte
3. **Basic Kombi** – Lerninhalte + Basis-Buddy (kontextverknüpft), ohne erweiterte Buddy-Funktionen
4. **Full Package** – alles, inkl. Community/Lerngruppen, größtes Token-Kontingent

## 3. Aktualisierte Feature-Matrix (nach Entscheidungen)

Quelle: `My First Board.csv`, mit zwei getroffenen Entscheidungen eingearbeitet (Context-Linking aus Standalone entfernt; günstigstes Paket = „Sprachkurs").

| Feature | Sprachkurs | AI Buddy Standalone | Basic Kombi | Full Package |
|---|:---:|:---:|:---:|:---:|
| Feste Lerninhalte (strukturierte Kurse) | ✓ | ✗ | ✓ | ✓ |
| AI Buddy Chat (Basis) | ✗ | ✓ | ✓ | ✓ |
| Context-Linking (Buddy ↔ Lerninhalte) | ✗ | **✗** | ✓ | ✓ |
| Dokumenten-Upload & Analyse | ✗ | ✓ | ✗ | ✓ |
| Knowledge Rack (PDF-Bibliothek) | ✗ | ✓ | ✗ | ✓ |
| Foto-Scan (Dokumente, Speisekarten …) | ✗ | ✓ | ✗ | ✓ |
| Energy-Nachkauf möglich | ✗ | ✓ | ✗ | ✓ |
| Community/Lerngruppen | ✗ | ✗ | ✗ | ✓ |
| Teaser: 1–2 AI-Fragen/24h | ✓ | ✗ | ✗ | ✗ |
| Zielgruppe | Preisbewusste Lerner, Einsteiger | Expats, Einwanderer, Profis | Lerner mit AI-Support | Power-User, Experten |
| Preis-Positionierung | Günstig (€) | Mittel (€€) + Energy-Pakete | Mittel (€€) | Premium (€€€) + Energy-Pakete |

**Fett markiert** = Änderung gegenüber der Original-CSV (Context-Linking aus Standalone entfernt).

## 4. Getroffene Entscheidungen

- **Abrechnungsmodell:** 2-Achsen-Modell (Paket × Laufzeit), Wiederverwendung des bestehenden Laufzeit-/Dodo-Systems. (Details: `01_TARIFE_UND_FEATURES.md`)
- **Verbrauchseinheit:** **AI Energy** (nicht „Token = 1 Nachricht"). Verschiedene KI-Aktionen verbrauchen unterschiedlich viel Energy (kompakt/ausgewogen/ausführlich, RAG-Kontext, Foto-Scan, Datei-Upload). Intern werden echte LLM-Tokens + Aktionstyp gemessen und in einen gerundeten Energy-Betrag umgerechnet. (Details: `02_TOKEN_SYSTEM.md`)
- **Energy-Verfügbarkeit:** Nur Buddy-haltige Pakete haben Energy-Guthaben. Nachkauf nur bei **AI Buddy Standalone** und **Full Package**. **Basic Kombi** erhält kleines Fix-Kontingent ohne Nachkauf. Sprachkurs hat nur den Teaser.
- **Context-Linking:** Nur in Basic Kombi + Full Package (aus Standalone entfernt).
- **Name günstigstes Paket:** „Sprachkurs" (EN „Course"). „Standalone-App" verworfen (Kollision mit „AI Buddy Standalone").
- **Teaser-Semantik:** Der Sprachkurs-Teaser (1–2 Fragen/24h) zeigt den **Basic-Kombi-Buddy** (kontextverknüpfter Basis-Buddy) als Upsell-Vorschau.
- **Branch-Basis (empfohlen):** `chat`-Branch als technische Grundlage für die Buddy-/RAG-Features. (Details: `04_BRANCH_KONSOLIDIERUNG_UND_ROADMAP.md`)

## 5. Offene Punkte (vor Implementierung final zu bestätigen)

1. **Finale Preise** je Paket × Laufzeit (Vorschlag-Grid in `03_PREISKALKULATION.md`).
2. **Finale Energy-Kontingente** (Inklusiv-Mengen + Nachkauf-Pakete) und **finale Verbrauchstabelle** (Energy je Aktionstyp). *Entscheidung Juni 2026:* Launch-Mengen bleiben unverändert (Basic 120 / Standalone 450 / Full 750); Anhebung als Post-Launch-Hebel offen (siehe `07_MARKTANALYSE.md`).
3. **Energy-Verfallsregel:** Inklusiv-Kontingent monatlich zurücksetzen (Vorschlag), gekaufte Top-up-Energy bis Abo-Ende gültig.
   - *Entschieden:* **Upload-Abrechnung dynamisch** (proportional, kein fixer Energy-Cap), abgesichert über Pflicht-Vorabbestätigung + technisches Input-Limit; Grenzfall „nicht genug Energy" = blockieren statt zuschneiden (Variante A). Details: `02_TOKEN_SYSTEM.md` 2.2.
4. **Laufzeit-/Ratenzahlungs-Matrix:** Bekommen wirklich alle 4 Pakete alle 4 Laufzeiten + Ratenzahlung? Das ergäbe bis zu 32 Dodo-Subscription-Produkte + Top-up-Produkte. Ggf. Ratenzahlung erst ab Basic Kombi.
5. **Grandfathering der Beta-/Bestandskunden:** Vorschlag = automatisch „Full Package" (Zero-Migration via Default).
6. **Buddy-Naming/Persona:** z. B. „Brate" (aus den chat-Branch-Konzepten) – separat zu entscheiden.
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
