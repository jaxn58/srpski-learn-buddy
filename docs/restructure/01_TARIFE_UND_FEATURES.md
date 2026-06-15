# Tarife und Features

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)

---

## 1. Abrechnungsmodell: 2-Achsen-Modell (Empfehlung)

Der Kern der Empfehlung: Das **Paket** (Welche Features?) wird zur zweiten Dimension neben der bestehenden **Laufzeit** (Wie lange?). Beide Dimensionen sind unabhängig wählbar.

```
                 Laufzeit (bestehend)
                 3 Mon. | 6 Mon. | 9 Mon. | 12 Mon.
   Paket
   ──────────────────────────────────────────────
   Sprachkurs        ·        ·        ·        ·
   AI Buddy Standalone ·      ·        ·        ·
   Basic Kombi        ·       ·        ·        ·
   Full Package       ·       ·        ·        ·
```

### Warum dieses Modell?

- **Minimaler Bruch mit der Produktion.** Die bestehende Laufzeit-/Dodo-/Webhook-Logik in `convex/subscriptions.ts` bleibt strukturell erhalten. Es kommt im Wesentlichen ein Feld (`featureTier`) plus Token-Felder hinzu.
- **Zero-Migration.** Bestandsabos ohne `featureTier` werden serverseitig als `"full"` interpretiert → kein Datenmigrations-Schritt, kein Zugriffsverlust.
- **Klarer Upgrade-Pfad.** Innerhalb derselben Laufzeit zwischen Paketen upgraden (Preisdifferenz als Top-up, wie heute bei Laufzeit-Upgrades).

### Alternative (nicht empfohlen)

Klassisches wiederkehrendes Monats-/Jahres-Abo pro Paket. Vorteil: marktüblicher; Nachteil: größerer Umbau, Bruch mit aktuellem Laufzeitmodell und mit den bereits kommunizierten Beta-Konditionen. Für später dokumentiert, aktuell nicht verfolgt.

## 2. Die vier Pakete im Detail

### 2.1 Sprachkurs (EN: „Course")

- **Enthält:** Alle Units, Vokabelsystem, interaktive Übungen, XP/Streak/Leaderboard, Fortschritt, Audio (TTS).
- **Enthält NICHT:** vollwertigen AI-Buddy, Dokumenten-Upload, Knowledge Rack, Foto-Scan, Token-Nachkauf, Community.
- **Besonderheit – Teaser:** 1–2 AI-Fragen / 24 h. Der Teaser zeigt bewusst den **Basic-Kombi-Buddy** (kontextverknüpfter Basis-Buddy) – als Vorschau und Upsell-Anker Richtung Basic Kombi.
- **Zielgruppe:** Preisbewusste Lerner, Einsteiger.

### 2.2 AI Buddy Standalone

- **Enthält:** Buddy-Chat, Dokumenten-Upload & Analyse, Knowledge Rack (persönliche PDF-Bibliothek), Foto-Scan, Token-Nachkauf.
- **Enthält NICHT:** Lerninhalte/Units, Context-Linking (Entscheidung: entfernt, da keine Units vorhanden), Community.
- **Zielgruppe:** Expats, Einwanderer, Profis (Büro / öffentliche Einrichtungen), die einen Sprach-/Alltagshelfer brauchen – ohne Kurs.

### 2.3 Basic Kombi

- **Enthält:** Alle Lerninhalte (wie Sprachkurs) **+ Basis-Buddy** (`AI Buddy Chat (Basis)`) **mit Context-Linking** (Buddy kennt die aktuelle Unit/den Lernkontext).
- **Enthält NICHT:** Dokumenten-Upload, Knowledge Rack, Foto-Scan, Token-Nachkauf, Community.
- **Token:** kleines **festes** Monatskontingent, **kein** Nachkauf.
- **Zielgruppe:** Lerner mit AI-Support.

### 2.4 Full Package

- **Enthält:** Alles aus Basic Kombi **+** die erweiterten Buddy-Funktionen aus Standalone (Dokumenten-Upload, Knowledge Rack, Foto-Scan) **+** Token-Nachkauf **+ Community/Lerngruppen** (Neu-Feature).
- **Token:** größtes Monatskontingent + Nachkauf.
- **Zielgruppe:** Power-User, Experten, Professionals.

## 3. Feature-zu-Code-Mapping (Was existiert, was ist neu?)

| Feature (Matrix) | Code-Entsprechung | Status |
|---|---|---|
| Feste Lerninhalte | Units/Vokabeln/Exercises, `convex/subscriptions.ts` `getAccessibleUnits`, `convex/units.ts` | Vorhanden (alle Branches) |
| AI Buddy Chat (Basis) | `convex/chat.ts` `streamChatMessage`, `POST /chat/stream` | Vorhanden (feature + chat) |
| Context-Linking | `convex/chat.ts` `buildUnitContextBlock`, `unitContext` auf Messages | Vorhanden (feature + chat) |
| Dokumenten-Upload & Analyse | `client/.../ChatDocumentUpload.tsx`, `convex/documentsNode.ts`, `userDocuments`/`userDocumentChunks` | **Nur chat-Branch**; Ingestion teils unvollständig |
| Knowledge Rack (PDF-Bibliothek) | `convex/knowledge.ts`, `convex/ai/ingestKnowledge.ts`, `client/.../KnowledgeAdmin.tsx` | **Nur chat-Branch** |
| Foto-Scan | Bild-Upload + multimodal (Gemini Vision) im Chat | Vorhanden (feature + chat) |
| Token-Kauf möglich | – | **Neu zu bauen** (siehe `02_TOKEN_SYSTEM.md`) |
| Community/Lerngruppen | – | **Neu zu bauen** (eigener Track, keine Vorlage in den Branches) |
| Teaser 1–2/24h | – (Rate-Limits existieren, aber kein Teaser-Zähler dieser Art) | **Neu zu bauen** (kleiner Tageszähler) |

## 4. Feature-Gating (Technik-Konzept)

Angelehnt an das bereits im `chat`-Branch skizzierte Muster (`docs/FEATURE_PACKAGES_IMPLEMENTATION_PLAN.md`), aber von 3 auf **4 Tiers** erweitert.

### 4.1 Neues Feld auf `userSubscriptions`

```typescript
// convex/schema/core.ts – userSubscriptions
featureTier: v.optional(v.union(
  v.literal("course"),   // Sprachkurs
  v.literal("buddy"),    // AI Buddy Standalone
  v.literal("basic"),    // Basic Kombi
  v.literal("full")      // Full Package
)),
```

`v.optional` ist bewusst gewählt: Bestandsabos ohne Feld → Default `"full"` (Zero-Migration).

### 4.2 Zentrale Zugriffs-Auflösung

Eine einzige Query (`getFeatureAccess`) liefert die abgeleiteten Flags – Single Source of Truth für Frontend (UI-Gating) und Backend (Durchsetzung):

```typescript
// abgeleitet aus featureTier
{
  learning:      tier === "course" || tier === "basic" || tier === "full",
  buddyChat:     tier === "buddy"  || tier === "basic" || tier === "full",
  contextLinking: tier === "basic" || tier === "full",          // NICHT bei buddy (Standalone)
  documents:     tier === "buddy"  || tier === "full",          // Upload + Knowledge Rack + Foto-Scan
  community:     tier === "full",
  tokenTopUp:    tier === "buddy"  || tier === "full",
  // Admin/Superadmin und Beta-Tester: alles true (siehe Grandfathering)
}
```

### 4.3 Durchsetzung (Defense-in-Depth)

- **Frontend:** Navigation, Routen und Buttons werden anhand der Flags ein-/ausgeblendet (z. B. kein Floating-Buddy-Button im Sprachkurs; kein „Units"-Tab im Standalone).
- **Backend:** Dieselben Flags werden in den Chat-Mutations/Actions (`convex/chat.ts`) und bei Upload/Knowledge-Funktionen geprüft, damit API-Aufrufe nicht das Client-Gating umgehen.

### 4.4 Teaser-Logik (Sprachkurs)

- Separater Tageszähler (z. B. 1–2 Fragen / 24 h), unabhängig vom Token-Guthaben.
- Antwortverhalten = Basic-Kombi-Buddy (mit Context-Linking zur aktuellen Unit), damit die Vorschau exakt das nächsthöhere Paket repräsentiert.
- Bei aufgebrauchtem Teaser: freundlicher Upsell-Hinweis Richtung Basic Kombi (kein blockierender Fehler).

## 5. Upgrade-Pfade

```mermaid
flowchart LR
  Course["Sprachkurs"] --> Basic["Basic Kombi"]
  Buddy["AI Buddy Standalone"] --> Full["Full Package"]
  Basic --> Full
  Course -. "Teaser weckt Bedarf" .-> Basic
```

- **Sprachkurs → Basic Kombi:** natürlicher Upgrade, vom Teaser getrieben.
- **Basic Kombi → Full Package:** für erweiterte Buddy-Funktionen + Community + Token-Nachkauf.
- **AI Buddy Standalone → Full Package:** wenn zusätzlich Lerninhalte gewünscht sind.

Upgrades innerhalb derselben Laufzeit: Preisdifferenz als Dodo-Top-up (analog zum bestehenden Laufzeit-Upgrade in `convex/subscriptions.ts`).
