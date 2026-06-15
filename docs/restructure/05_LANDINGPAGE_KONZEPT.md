# Landing-Page-Konzept – Neues 4-Paket-System

**Teil von:** Tarif- und Token-Umbau (siehe `00_KONZEPT_UEBERSICHT.md`)
**Sprache Strategie-Dokument:** Deutsch
**Sprache Copy:** Englisch (English-first; DE-Übersetzung folgt separat)

> Nur Konzept und Copy – keine Code-/Schema-Änderungen in dieser Phase. Live-Demo und Lead-Magnet erfordern spätere Implementierungs-Specs.

---

## 1. Ziel und Positionierung

### 1.1 Übergeordnetes Ziel

Besucher sollen innerhalb eines einzigen Seitenbesuchs **sowohl den Mehrwert spüren (Demo)** als auch in eine Nachfolge-Kommunikation eingebunden werden (E-Mail), die sie zum Kauf führt. Die Seite muss zwei grundlegend verschiedene Zielgruppen gleichzeitig ansprechen, ohne sie zu verwirren.

### 1.2 Die zwei Kernzielgruppen

| Zielgruppe | Ihr Bedürfnis | Einstiegspaket | Hook |
|---|---|---|---|
| **Strukturierte Lerner** (Einsteiger, Schüler, Reisende) | Schritt-für-Schritt-Kurs, Gamification, klarer Fortschritt | Sprachkurs → Basic Kombi | „Learn Serbian step by step." |
| **Sofort-Helfer-Sucher** (Expats, Einwanderer, Profis, Reisende) | Antworten jetzt, Alltagshilfe, Kulturwissen | AI Buddy Standalone → Full | „Your Serbian brother. Always there for you." |

### 1.3 Paket-Positionierung auf der Seite

- **Full Package** = visueller Anker (prominent, „Best Value"-Badge, als erstes oder in der Mitte).
- **„Missing-Half"-Effekt**: Sprachkurs-User sehen, was fehlt (kein Buddy) → Upsell Richtung Basic Kombi. Standalone-User sehen, was fehlt (keine Struktur) → Upsell Richtung Full.
- **Basic Kombi** = „Sweetspot"-Paket: bekommt auf der Seite einen eigenen kurzen Erklärungsmoment, damit Besucher nicht zwischen Sprachkurs und Standalone hängen bleiben.

### 1.4 Primäres Conversion-Ziel je Besucher-Segment

| Besucher-Typ | Primäres Ziel | Sekundäres Ziel |
|---|---|---|
| Kauf-bereit | Direktkauf Full/Basic | – |
| Neugierig | E-Mail-Lead-Magnet eintragen | Demo spielen |
| Preissensibel | Demo → Sprachkurs kaufen | E-Mail |
| Skeptisch | Demo → Vertrauen aufbauen | E-Mail → Nurture |

---

## 2. Conversion-Prinzipien

Branchenstandards, konkret auf dieses Produkt angewendet. Aufbauend auf `docs/LANDINGPAGE.md`.

### 2.1 Emotionaler Hook (Above the Fold)

Regel: **6–8 Wörter**, Emotion oder Ergebnis vor Features. Der Nutzer muss in 3 Sekunden wissen: „Das ist für mich."

- Headline kommuniziert **Outcome**, nicht Feature.
- Sub-Headline erklärt **Wie**, nicht **Was**.
- Primärer CTA: direkt zur Demo (tiefste Friktion = 0, kein Signup).

### 2.2 Social Proof (Trust)

- Stats-Bar: konkrete Zahlen (User-Anzahl, Lernfortschritt), **erst durch echte Daten ersetzen** (siehe Offene Punkte).
- Testimonials: 2–3 kurze, spezifische Zitate mit Name/Herkunft. Placeholder-Copy im Konzept, später durch echte Beta-Tester ersetzen.
- Keine leeren Behauptungen (kein „Best app ever").

### 2.3 Risiko-Umkehr (Trust-Builder)

- Klare Preis-Transparenz: keine versteckten Kosten, Token sind verständlich erklärt.
- Geld-zurück-Garantie oder kostenloser Einstieg als Signal.
- FAQ direkt unter Pricing (häufigste Kaufeinwände).

### 2.4 Mehrere CTAs (Conversion-Momentum)

- CTA-Platzierung nach: Hero, Demo-Widget, Features/How-it-works, Pricing-Sektion, nach Testimonials, Final-CTA.
- Floating-CTA (sticky, rechts unten, nur auf Desktop) für lange Scroll-Tiefe.
- CTA-Texte variieren leicht je Kontext (nicht immer derselbe Wortlaut → wirkt natürlicher).

### 2.5 Mobile-first, Scan-Barkeit

- Maximal 2 Sätze pro Abschnitt für Fließtext.
- Bulletpoints statt Absätze für Feature-Listen.
- Pricing-Cards: 1 Zeile Beschreibung, keine Prosa.
- Alle CTAs mindestens 44px Touch-Target.

### 2.6 Token/Nachkauf vertrauensbildend erklären

Token-Konzept ist nicht selbstverständlich. Regel: **positiv formulieren** (Guthaben, nicht Verbrauch); **Vergleichsgröße** geben (z. B. „150 Nachrichten/Monat = 5 pro Tag").

---

## 3. Conversion-Funnel

```mermaid
flowchart TD
  visit["Besucher trifft ein"] --> hero["Hero: Hook + Subhook + zwei CTAs"]
  hero --> demo["Bait 1: Live-Demo Widget keine Anmeldung 1-3 Fragen"]
  hero --> magnet["Bait 2: Lead-Magnet E-Mail fuer Freebie"]
  demo --> demogate["Soft-Gate nach 3 Fragen: 'Get full access'"]
  demogate --> signup["Signup-Flow + Paket-Wahl"]
  magnet --> nurture["5-Mail-Nurture-Sequenz via Resend"]
  nurture --> signup
  hero --> proof["Stats-Bar + Brate-Story + How-it-works"]
  proof --> packages["4-Paket-Praesentation Full als Anker"]
  packages --> faq["FAQ Kaufeinwaende"]
  faq --> finalcta["Final CTA + Floating CTA"]
  finalcta --> signup
```

---

## 4. Bait 1 – Live-Buddy-Demo (anmeldefrei)

### 4.1 Konzept

Ein kleines **Inline-Chat-Widget** direkt im Hero-Bereich (oder als eigene Sektion kurz darunter). Besucher können **1–3 Fragen auf Englisch** an den Buddy stellen, ohne sich anzumelden. Nach der 3. Frage erscheint ein **Soft-Gate**: kein Fehler, sondern ein einladender Hinweis, dass man mit einem Konto weitermachen kann.

Ziel: Besucher „fühlen" den Mehrwert, bevor sie irgendwas eingeben. Das ist das stärkste Conversion-Signal für ein Chat-Produkt.

### 4.2 UX-Beschreibung

```
┌─────────────────────────────────────────────────────────┐
│  Try it now – no account needed                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Ask anything about Serbian...                   │    │
│  └─────────────────────────────────────────────────┘    │
│  [ Examples: "How do I say hello?" / "What is Slava?" ] │
│                                         [ Ask Brate → ] │
└─────────────────────────────────────────────────────────┘
```

- 3 Beispiel-Chips (anklickbar, prefüllen das Eingabefeld) als Einstiegshilfe.
- Antwort erscheint direkt im Widget (Streaming, Typewriter-Effekt wie im Chat).
- Nach 3 Nachrichten: freundliche Einblendung „You've used your free preview. Continue with Basic Kombi."

### 4.3 Feasibility und Kosten-Guardrails

> Dieser Abschnitt ist für die spätere Implementierungs-Spec.

- **Backend:** Neuer, separater Public-Endpoint (z. B. `POST /public/buddy-demo`) in `convex/http.ts`. Kein Auth-Check. Nutzt denselben `streamChatMessage`-Kern aus `convex/chat.ts`, aber mit eigenen, sehr restriktiven Limits.
- **Rate-Limiting:** IP-basiert (Convex kennt die Client-IP im HTTP-Kontext), max. **3 Nachrichten pro IP pro 24 h**. Eigene `demoRateLimits`-Tabelle in `convex/schema/chat.ts` oder via `chatAiConfig`.
- **Kostendeckel je Anfrage:**
  - Modell: **Gemini 2.5 Flash-Lite** (`$0.10/1M` Input, `$0.40/1M` Output) – nicht das teure Flash.
  - Max. Output-Tokens: **300** (kurze, knackige Antworten).
  - Kein RAG / kein Unit-Kontext (nur System-Prompt + User-Frage).
  - Maximale Kosten/Demo-Anfrage: ~$0,0002.
- **Globales Tages-Budget:** `chatAiConfig.dailyBudgetCents` deckt auch Demo-Traffic ab → automatische Notbremse bei unerwarteten Spitzen.
- **Missbrauchsschutz:** IP-Rate-Limit + kurze Antworten + kein wertvoll kuratierter Kontext = Demo hat keinen Wert für Prompt-Injection-Angriffe.

### 4.4 Demo-Copy (EN)

**Widget-Heading:**
> "Meet your Brate. Ask him anything."

**Placeholder-Text im Input:**
> "Try: 'How do I say thank you?' or 'What is Slava?'"

**Beispiel-Chips (anklickbar):**
- „How do I order coffee in Serbian?"
- „What is Slava? How does it work?"
- „Explain the difference between ti and Vi"

**Soft-Gate-Nachricht (nach 3 Fragen):**
> "You've used your free preview — and your Brate is just getting warmed up.
> Get Basic Kombi and ask him anything, anytime."
> `[ Start with Basic Kombi ]` `[ See all plans ]`

---

## 5. Bait 2 – E-Mail-Lead-Magnet

### 5.1 Freebie-Idee: „Serbian Survival Kit"

Ein **kostenloser PDF-Download** (oder E-Mail-Serie) mit den wichtigsten Phrasen für den Alltag in Serbien.

**Inhalt (Vorschlag):**
- Top 50 Survival-Phrasen (Begrüßung, Essen/Trinken, Einkaufen, Transport, Notfälle)
- Grundzahlen und Preise auf Serbisch
- Cyrillic Cheat Sheet (10 wichtigste Buchstaben zum Entziffern)
- 5 kulturelle „Do's and Don'ts"
- Bonus: QR-Code zur Lern-App (erste Unit kostenlos starten)

Titel-Optionen:
- **„The Serbian Survival Kit"** (sachlich, klar)
- **„Your Brate's First Gift"** (emotional, passt zur Persona-Idee)

### 5.2 E-Mail-Capture-Sektion auf der Landing Page

Platzierung: nach der Demo-Sektion / vor der Pricing-Sektion (wenn Demo Neugier weckt, aber Preis noch nicht klar ist → E-Mail als low-commitment Schritt).

Copy (EN):
> **Heading:** „Get your free Serbian Survival Kit"
> **Subheading:** „50 essential phrases, a Cyrillic cheat sheet, and 5 cultural rules every Serbian speaker needs. Free, instant, no strings attached."
> **Input placeholder:** „Your email address"
> **CTA-Button:** „Send me the kit"
> **Trust-Signal darunter:** „No spam. Unsubscribe anytime. ~2,000 learners already got it." *(Zahl erst ersetzen, wenn real.)*

### 5.3 Nurture-E-Mail-Sequenz (5 Mails via Resend)

System: bestehendes E-Mail-System mit **Resend API** (dokumentiert in `docs/NEWSLETTER_SYSTEM.md`). Die Sequenz nutzt das vorhandene Campaign-Management.

| Mail | Timing | Betreff (EN) | Ziel |
|---|---|---|---|
| 1 | Sofort | „Here's your Serbian Survival Kit + a surprise" | Freebie liefern, erste Erwähnung der App |
| 2 | Tag 2 | „The one Serbian phrase that changes everything" | Mehrwert, Teaser App-Feature |
| 3 | Tag 4 | „Meet your Brate – he knows something you don't" | Buddy-Demo vorstellen, CTA zur Landing Page (Demo-Widget) |
| 4 | Tag 7 | „How Sarah learned to order food in Serbian in 3 weeks" | Testimonial/Story, Social Proof, Paket-Link |
| 5 | Tag 12 | „Still thinking about it? Here's what's included." | Einwände abräumen, Vergleichstabelle, finaler CTA |

**Mail 1 – Struktur (EN):**
```
Betreff: Here's your Serbian Survival Kit + a surprise

Hi [Vorname],

Your Serbian Survival Kit is attached. 50 phrases, a Cyrillic cheat sheet, and a few 
things your guidebook forgot to mention.

Use it. Then come back and tell your Brate what you practiced.

[→ Try 1 free question, no account needed]  ← CTA zu Demo-Widget

See you in Serbia,
The Learn-with-me Team

P.S. Tomorrow I'll share the one phrase that makes Serbians smile every time.
```

**Mail 3 – Brate-Intro (EN):**
```
Betreff: Meet your Brate – he knows something you don't

Hi [Vorname],

You've got the phrases. But there's something a PDF can't give you:
someone who explains WHY.

Why Serbians say "ajde" in 15 different ways.
Why you bring flowers when visiting someone's home.
Why nobody actually calls it "Serbian coffee."

Your Brate knows. And he's available 24/7 — no scheduling, no awkward silences.

[→ Ask him one free question]  ← CTA zu Demo-Widget

The first question is on us.
```

---

## 6. Seitenstruktur mit englischer Copy

Die Landing Page folgt dieser Reihenfolge. Für jede Sektion: Zweck, Copy (EN), Design-Hinweis.

---

### 6.1 Hero (Above the Fold)

**Zweck:** Besucher sofort in eine der zwei Zielgruppen einsortieren und neugierig machen. Kein langer Text.

**Haupt-Headline:**
> „Learn Serbian. Or get a Serbian brother. Or both."

**Sub-Headline:**
> „Structured lessons for learners. A 24/7 AI companion for expats, immigrants, and everyone navigating Balkan life."

**Zwei primäre CTAs (nebeneinander):**
> `[ Try the Buddy — it's free ]` (primär, führt zur Demo direkt darunter)
> `[ See plans ]` (sekundär, scrollt zur Pricing-Sektion)

**Vertrauens-Signal unter den Buttons:**
> „No credit card. No signup to try."

**Design-Hinweis:** Bestehende Hero-Struktur aus `Home.tsx` verwenden. Gradient-Headline `from-primary to-secondary`. Zwei Buttons: primärer `bg-primary`, sekundärer `variant="outline"`.

---

### 6.2 Live-Demo-Widget

**Zweck:** Unmittelbares Erlebnis, Zero-Friction. Direkt nach dem Hero.

**Widget-Heading:**
> „Meet your Brate. Ask him anything — free, no account needed."

**Design-Hinweis:** Card-Komponente, `border-2 border-primary/20`. 3 anklickbare Beispiel-Chips in `bg-accent/10 text-accent-foreground`. Chat-Input mit Sende-Button. Antwort-Bereich mit Typewriter-Effekt (analog `useChatStream.ts`). Soft-Gate nach 3 Nachrichten als Banner, **nicht als Blocking-Modal**.

---

### 6.3 Stats-Bar

**Zweck:** Sozialer Beweis – reale Zahlen schaffen Vertrauen.

**Copy (EN) — Platzhalter, mit echten Daten ersetzen:**
> `[500+]` Learners across 30 countries
> `[27]` Structured units from A1 to B1
> `[800+]` Vocabulary words with audio

**Design-Hinweis:** 3-Spalten-Grid, große Zahl in `text-primary font-bold text-5xl`, Text darunter `text-muted-foreground`. Hintergrund `bg-gradient-to-r from-primary/5 to-secondary/5`.

---

### 6.4 „Meet your Brate" – Story-Sektion

**Zweck:** Emotionale Verbindung zur Buddy-Persona aufbauen. Erklärt den Unterschied zu ChatGPT und anderen Chatbots.

**Heading:**
> „Not a chatbot. A Brate."

**Body-Copy (EN):**
> „Brate" means brother in Serbian. And that's exactly what this is — not a language processing engine, but a companion who knows the language, the culture, the customs, and the unwritten rules.
>
> He explains why „ajde" means 10 different things depending on tone. He knows why you should always bring flowers. He'll help you decode a letter from the municipality, find the right words for the doctor, and understand why everything is closed on Vidovdan.
>
> Your Brate is part of every plan that includes the AI Buddy. In Basic Kombi and Full Package, he even knows which unit you're currently studying.

**CTA:**
> `[ Try asking him something ]` (scrollt zur Demo, falls noch nicht benutzt)

**Design-Hinweis:** Zweispaltiges Layout (Text links, illustratives Bild/Icon rechts). Kein neues Design — kein Bild ist eher besser als Platzhalter. Alternativ: großes Zitat-Block-Element mit serbischem „Brate" als Typografie-Akzent in `text-primary`.

---

### 6.5 How It Works (3 Schritte)

**Zweck:** Kaufentscheidung vereinfachen – App-Ablauf in 3 klaren Schritten.

**Heading:**
> „Simple. Start in 60 seconds."

**Schritt 1:**
> **Choose your path.** Course for structured learners. Buddy for everyday Balkan life. Basic Kombi for both. Full Package for everything.

**Schritt 2:**
> **Pick your duration.** 3, 6, 9, or 12 months. Pay once, learn at your pace. No recurring charges.

**Schritt 3:**
> **Start learning.** Your units, vocabulary, and Buddy are ready immediately. No setup. No downloads required.

**Design-Hinweis:** 3 nummerierte Cards oder Icon-Zeile. Zahl in `text-primary`, Cards in `bg-card border border-border`.

---

### 6.6 4-Paket-Karten + Vergleichstabelle

**Zweck:** Kaufentscheidung herbeiführen. Full Package als Anker, Basic Kombi als Sweetspot.

**Sektion-Heading:**
> „Choose your plan. Change when you need."

**Sub-Heading:**
> „All plans are one-time payments. Pick a duration. No subscription trap."

#### Paket-Karten (je eine Card, EN)

**Sprachkurs (Course):**
> „Learn Serbian, step by step."
> Perfect for focused learners who want a clear curriculum.
> 27 units · 800+ words · XP & streaks
> From €39 for 3 months
> `[ Get Course ]`
> *1-2 AI previews per day included*

**AI Buddy Standalone:**
> „Your Serbian brother. Available 24/7."
> For expats, immigrants, and professionals navigating Balkan life.
> Chat · Document upload · Knowledge library · Photo scan
> From €45 for 3 months + token packs
> `[ Get Buddy ]`

**Basic Kombi** ← Sweetspot-Badge: „Most popular for learners"
> „Structured lessons + your AI companion."
> The Buddy knows your current unit. He walks alongside your progress.
> Everything in Course + Buddy chat (context-aware) · 40 messages/month
> From €55 for 3 months
> `[ Get Basic Kombi ]`

**Full Package** ← „Best Value"-Badge
> „The complete Serbian experience."
> Lessons, your Brate, document analysis, knowledge library, and more.
> Everything in Basic Kombi + documents · knowledge · photo scan · community · top-up packs
> From €69 for 3 months
> `[ Get Full Package ]`

#### Token-Erklärung (unter den Karten, für Standalone + Full)

> **About message tokens:** Each AI Buddy reply uses 1 token. 150 tokens = 5 messages per day for a whole month. Need more? Top up anytime with Starter (50 tokens / €4.99), Plus (150 tokens / €11.99), or Pro (500 tokens / €29.99).

#### Laufzeit-Toggle

> `[ 3 months ] [ 6 months ] [ 9 months ] [ 12 months ]` — „Longer = better value per month"

#### Vergleichstabelle (nach den Karten, aufklappbar oder dauerhaft sichtbar)

| | Sprachkurs | AI Buddy | Basic Kombi | Full Package |
|---|:---:|:---:|:---:|:---:|
| Structured units (A1–B1) | ✓ | – | ✓ | ✓ |
| Vocabulary + audio | ✓ | – | ✓ | ✓ |
| XP, streaks, leaderboard | ✓ | – | ✓ | ✓ |
| AI Buddy chat | 1–2/day preview | ✓ | ✓ | ✓ |
| Context-linking (Buddy knows your unit) | – | – | ✓ | ✓ |
| Document upload & analysis | – | ✓ | – | ✓ |
| Knowledge library (PDF) | – | ✓ | – | ✓ |
| Photo scan | – | ✓ | – | ✓ |
| Buy extra message tokens | – | ✓ | – | ✓ |
| Community & study groups | – | – | – | ✓ |

**Design-Hinweis:** Full Package hat `border-2 border-primary` und Badge in `bg-primary text-primary-foreground`. Basic Kombi hat Badge in `bg-accent text-accent-foreground`. Laufzeit-Toggle als `<Tabs>` oder Button-Gruppe. Tabelle responsive (horizontal scrollen auf Mobile).

---

### 6.7 Testimonials

**Zweck:** Letzter Vertrauensaufbau vor dem Kaufabschluss.

**Heading:**
> „What learners say"

**Testimonial 1 (Placeholder):**
> „I've been living in Belgrade for 8 months. My Brate helped me understand a tax letter, navigate the health system, and finally understand why my neighbor says „Ma daj!" all the time."
> — **Markus T.**, Germany → Belgrade

**Testimonial 2 (Placeholder):**
> „I tried Duolingo. I tried YouTube. Nothing stuck. The structured units in Basic Kombi finally made Serbian grammar click — and when I got stuck, my Brate explained it my way."
> — **Lena K.**, Austria

**Testimonial 3 (Placeholder, für AI Buddy Standalone):**
> „I'm not learning Serbian to pass a test. I'm learning it to live here. The Buddy understands that."
> — **James O.**, UK → Novi Sad

**Design-Hinweis:** 3-spaltig auf Desktop, 1-spaltig auf Mobile. Cards mit `border border-border bg-card`. Initials-Avatar in `bg-primary/10 text-primary`. Alle Testimonials sind Platzhalter – **vor Launch durch echte Beta-Tester ersetzen** (Einholung via kurze E-Mail-Anfrage).

---

### 6.8 E-Mail-Lead-Magnet-Sektion

**Zweck:** E-Mail einfangen für Nurture, falls Besucher noch nicht kaufbereit.

**Heading:**
> „Not ready to commit? Start with a gift."

**Sub-Heading:**
> „Get your free Serbian Survival Kit — 50 essential phrases, a Cyrillic cheat sheet, and 5 cultural rules every Serbian speaker needs. Free. Instant. No spam."

**E-Mail-Input:** `[Your email address]`
**CTA-Button:** `[ Send me the kit ]`
**Trust-Signal:** „We use Resend to deliver. Unsubscribe anytime with one click."

**Design-Hinweis:** Hintergrundfarbe `bg-secondary/5`, Border `border border-secondary/20`. CTA `bg-primary`. Kein Modal – Inline-Sektion auf der Seite.

---

### 6.9 FAQ (gekürzt, Kaufeinwände)

**Zweck:** Letzte Bedenken ausräumen, direkt über Final-CTA platziert.

**Q: Do I need a credit card to try?**
> No. The live demo on this page works without any account. Sign up only when you're ready to buy.

**Q: Can I upgrade later?**
> Yes. Upgrade anytime within the same duration and pay only the difference. Example: Course (€39) → Basic Kombi (€55) = €16 extra.

**Q: What are message tokens?**
> Each Buddy reply uses 1 token. Your plan includes a monthly allowance. AI Buddy Standalone and Full Package let you buy extra packs when needed. Basic Kombi includes 40 tokens/month (no top-up, but no expiry on the 40).

**Q: Is this a subscription?**
> No. You pay once for your chosen duration (3, 6, 9, or 12 months). No recurring charges. No auto-renewal.

**Q: What happens when my plan expires?**
> Your progress is saved forever. You can renew, upgrade, or switch plans anytime.

**Q: I already speak some Serbian. Is this for me?**
> Yes. Units range from A1 (absolute beginner) to B1 (conversational). Your Buddy adapts to your level from the first message.

**Design-Hinweis:** Accordion-Komponente (`<Accordion>`). Max. 2 Sätze pro Antwort.

---

### 6.10 Final-CTA-Sektion

**Zweck:** Letzte Handlungsaufforderung für alle, die bis hierher gescrollt sind.

**Heading:**
> „Your Brate is waiting."

**Sub-Heading:**
> „Start with the live demo. Or pick your plan and begin today."

**Zwei Buttons:**
> `[ Try the free demo ]` (primär, scrollt nach oben zur Demo)
> `[ See all plans ]` (sekundär, scrollt zur Pricing-Sektion)

**Design-Hinweis:** Dunkler Hintergrund (`bg-primary/5` oder `bg-foreground/5`), starker Kontrast. Gleiche Button-Styles wie im Hero.

---

### 6.11 Floating-CTA (Sticky, Desktop)

**Zweck:** Immer sichtbar für Besucher mit langer Scroll-Tiefe.

**Copy:** `[ Start learning → ]`

**Verhalten:** Erscheint nach erstem Scroll (300px), verschwindet wenn Pricing-Sektion im Viewport ist (kein doppelter CTA). Nur auf Desktop (`hidden md:block`).

**Design-Hinweis:** `position: fixed`, `bottom-6 right-6`, `z-50`. Button `bg-primary shadow-xl`. Bestehende Floating-Button-Logik aus `FloatingChatButton.tsx` als Referenz für Position/Stil.

---

## 7. CI- und Komponenten-Mapping

Keine neuen Design-Entscheidungen. Alle Elemente auf bestehende Komponenten gemappt.

| Element | Komponente | Farbe/Klasse |
|---|---|---|
| Primärer CTA | `<Button size="lg">` | `bg-primary hover:bg-primary/90` |
| Sekundärer CTA | `<Button variant="outline" size="lg">` | `border-primary text-primary` |
| „Best Value"-Badge | `<Badge>` | `bg-primary text-primary-foreground` |
| „Most popular"-Badge | `<Badge>` | `bg-accent text-accent-foreground` |
| Stats-Zahlen | `<p className="text-5xl font-bold">` | `text-primary` |
| Paket-Karten | `<Card>` | `border border-border` |
| Hervorgehobene Karte | `<Card>` | `border-2 border-primary` |
| Testimonials | `<Card>` | `border border-border bg-card` |
| Lead-Magnet-Sektion | `<section>` | `bg-secondary/5 border border-secondary/20` |
| FAQ | `<Accordion>` | default |
| Demo-Chips | `<Button variant="ghost" size="sm">` | `bg-accent/10 text-accent-foreground` |
| Gradient-Headline | `<span>` | `bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent` |
| Stats-Bar Hintergrund | `<section>` | `bg-gradient-to-r from-primary/5 to-secondary/5` |
| Floating-CTA | `<Button size="lg">` | `bg-primary shadow-xl fixed bottom-6 right-6` |

---

## 8. Mess- und Optimierungsplan

### 8.1 Wichtigste KPIs

| Metrik | Zielwert | Messmethode |
|---|---|---|
| Demo-Nutzungsrate | >40% der Besucher senden mind. 1 Frage | Custom Event |
| Demo → Signup-Rate | >15% der Demo-Nutzer registrieren sich | Funnel-Tracking |
| E-Mail-Opt-in-Rate | >8% der Besucher tragen sich ein | Formular-Submit-Event |
| E-Mail-Nurture-Conversion | >5% der E-Mail-Leads kaufen binnen 30 Tagen | Resend + Kaufhistorie |
| Scroll-Depth zu Pricing | >60% der Besucher erreichen Pricing | Scroll-Event bei 70% |
| Bounce Rate | <45% | Analytics |

### 8.2 A/B-Tests (nach Launch)

| Element | Variante A | Variante B |
|---|---|---|
| Hero-Headline | „Learn Serbian. Or get a Serbian brother. Or both." | „Your Serbian brother. Always there." |
| Primärer CTA | „Try the Buddy — it's free" | „Ask your first question — free" |
| Demo-Position | Direkt unter Hero | Eigene Sektion nach Stats-Bar |
| Lead-Magnet-CTA | „Send me the kit" | „Get my free phrases" |

### 8.3 Analytics-Events (Implementierungshinweis)

```typescript
// Demo gestartet
trackEvent('demo_started', { source: 'hero_widget' });

// Demo Soft-Gate erreicht
trackEvent('demo_limit_reached', { questions_asked: 3 });

// Lead-Magnet abgesendet
trackEvent('lead_magnet_submitted', { location: 'landing_page' });

// Paket-Karte angeklickt
trackEvent('plan_cta_clicked', { plan: 'basic_kombi', duration: '6m' });
```

---

## 9. Offene Punkte (vor Go-Live zu klären)

1. **Echte Testimonials:** Placeholder-Zitate durch echte Beta-Tester ersetzen. Einholung per E-Mail: „Darf ich dein Feedback auf der Website zeigen?"
2. **Echte Stats:** User-Anzahl, Lernfortschritt-Daten aus Convex-Analytics. Platzhalter erst ersetzen, wenn Zahlen valide und dauerhaft wahr sind.
3. **Freebie erstellen:** „Serbian Survival Kit" als PDF produzieren (Inhalte im `chat`-Branch als kuratierte Knowledge-Basis vorhanden, diese könnte via `ingestKnowledge.ts` als Quelle dienen).
4. **Double-Opt-in für E-Mail:** DSGVO-konform. Resend unterstützt Double-Opt-in; muss im Capture-Flow aktiviert sein.
5. **Demo-Missbrauchsschutz:** IP-Rate-Limiting-Implementierung sorgfältig testen (Proxy-/VPN-Umgehung akzeptiertes Risiko bei dieser Kalkulation).
6. **Buddy-Name „Brate":** Dieser Begriff wird in der Copy als Persona-Name verwendet. Finale Entscheidung steht noch aus (kein Blocking für das Dokument, aber vor Code-Implementierung zu bestätigen).
7. **Legaltext für E-Mail-Capture:** Datenschutzhinweis unter dem Formular (Link zur Privacy Policy). Muss rechtlich geprüft sein.
8. **Teaser-Formulierung „1–2 AI-Fragen/24h" im Sprachkurs-Paket:** Die Copy nennt das als Feature. Muss exakt dem implementierten Limit entsprechen (zu bestätigen nach Phase 2 der Roadmap).
