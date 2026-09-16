# Curriculum-Rahmen: Serbisch A1 bis B1 (Learn With Me)

**Stand**: 2026-09-16 (Entwurf zur Freigabe, Phase 1a des Plans "Content Studio Upgrade")  
**Geltungsbereich**: Alle Units, die über das Content Studio erzeugt werden. Ergänzt wird dieser Rahmen durch `CAN_DO_INVENTORY.md` (Lernziele pro Stufe) und `UNIT_MAP.md` (konkrete Unit-Karte).

---

## 1. Ausgangslage und Zielbild

Die App richtet sich an erwachsene Lerner, die Serbisch für den Alltag in Serbien und Montenegro brauchen: Urlauber, Zuwanderer, Berufstätige und Unternehmer. Lehrnorm ist **Ekavisch (Serbien)**, und die Standardkulisse der Units ist Serbien. Montenegro erscheint als wiederkehrender Reise- und Küstenkontext sowie über systematische Hinweise auf den montenegrinischen Sprachgebrauch (siehe Abschnitt 8).

Ausgangspunkt für die Dimensionierung sind die Richtwerte des Gemeinsamen Europäischen Referenzrahmens (GER/CEFR): etwa 80 bis 100 Lernstunden für A1, kumuliert 180 bis 200 für A2 und kumuliert 350 bis 400 für B1. Der aktive Wortschatz liegt bei rund 500 bis 600 Wörtern (A1), 1.000 bis 1.200 (A2) und 2.000 bis 2.500 (B1). Bei maximal 30 neuen Wörtern und einem Grammatikziel pro Unit ergibt das die in Abschnitt 2 genannte Unit-Anzahl; ein deutlich kleinerer Kurs müsste pro Unit mehrere Grammatikphänomene gleichzeitig einführen und würde die Lerner überfordern.

Zielbild: **72 Lern-Units plus 3 Prüfungssimulationen**, kleinteilig, mit einem Grammatikziel pro Unit und sichtbaren Lernerfolgen ab der ersten Sitzung.

---

## 2. Stufenplan und Modulzuordnung

Die App-Module bleiben wie benannt. Jedes Modul entspricht genau einer CEFR-Teilstufe.

| Modul (App) | CEFR | Units | Kumulierter Wortschatz (Ziel) | Kumulierte Lernzeit (Richtwert) |
|-------------|------|-------|-------------------------------|---------------------------------|
| 1 The Arrival | A1.1 | U001–U012 | ca. 300 | ca. 40–50 h |
| 2 Daily Life | A1.2 | U013–U024 | ca. 600 | ca. 90–100 h |
| 3 Communication & Culture | A2.1 | U025–U038 | ca. 950 | ca. 140–150 h |
| 4 Advanced Communication | A2.2 | U039–U052 | ca. 1.300 | ca. 190–200 h |
| 5 Mastery | B1 | U053–U072 | ca. 2.000 | ca. 350–400 h |
| 6 Test Module | Prüfungen | U073–U075 | – | Simulationen A1 / A2 / B1 |

Lernzeit pro Unit: 30 bis 45 Minuten Kernzeit plus Wiederholung über Vokabeltrainer und Interactive Test (Mastery-Prinzip: dreimal richtig). Das ergibt realistisch 1,5 bis 2,5 Stunden Lernerzeit pro Unit inklusive Wiederholung, womit die kumulierten Richtwerte erreicht werden.

Die Modulbeschreibungen in `moduleMetadata` (EN/DE) werden in Phase 1 an diese Zuordnung angepasst; Vorschläge stehen in `UNIT_MAP.md`, Abschnitt "Modulbeschreibungen".

---

## 3. Micro-Unit-Format

Jede Standard-Unit hält diese Grenzen ein. Sie sind im Creator-Prompt als harte Constraints hinterlegt und werden vom Parser bzw. Validator geprüft, soweit maschinell möglich.

| Element | Vorgabe | Begründung |
|---------|---------|------------|
| Neue Vokabeln | 20 bis 30 (heute bis 50) | Behaltensleistung, Vokabeltrainer-Session unter 15 Minuten |
| Grammatik | genau 1 primäres Ziel, optional 1 wiederholtes Ziel aus einer früheren Unit | kognitive Last, klare Übungsausrichtung |
| Dialoge | 2 bis 3, je maximal 6 Zeilen | Audio-Länge, Nachsprechbarkeit |
| Phrasen-Tabelle | 8 bis 12 Einträge | direkt nutzbare Sprechakte |
| Übungen | 5 Kategorien (Template), je 5 bis 6 Items | XP-System (5/10/20 pro Item) bleibt kalkulierbar |
| Cultural Note | 1 kurzer Absatz | Motivation, Kontext |
| Founder Note | 2 bis 5 Sätze | bestehende Vorgabe |
| Zielzeit | 30 bis 45 Minuten Kernbearbeitung | schnelle Erfolgserlebnisse |

Jede Unit beginnt mit Learning Objectives in Can-Do-Form ("By the end of this unit, we will be able to ...") und endet mit einem Cultural-Note-Absatz. Die Can-Do-Statements stammen aus `CAN_DO_INVENTORY.md`.

---

## 4. Unit-Typen

Der Brief steuert den Typ über `Unit type:`; der Creator-Prompt kennt drei Modi.

- **standard**: siehe Abschnitt 3.
- **review** (jede sechste bis siebte Unit, je nach Modullänge): keine neuen Vokabeln, kein neues Grammatikziel. Inhalt: Wiederholung der letzten fünf bis sechs Units in neuen Situationen, gemischte Dialoge, Übungen aus dem gesamten Wiederholungsblock, ein Can-Do-Selbstcheck im Overview. Grammar-Sektion enthält eine kompakte Zusammenschau ("What we can do now") mit Verweisen auf die Ursprungs-Units statt neuer Regeln.
- **checkpoint** (letzte Unit eines Moduls): wie review, zusätzlich eine Prüfungssimulation im Stil des Test-Moduls für die jeweilige Teilstufe und eine Vorschau auf das nächste Modul.

Verteilung: Module mit 12 Units haben Review in der 6. und Checkpoint in der 12. Unit (U006/U012, U018/U024); Module mit 14 Units Review in der 7. und Checkpoint in der 14. Unit (U031/U038, U045/U052); Modul 5 (20 Units) Review in der 6., 11. und 16. Unit (U058, U063, U068) und Checkpoint in der 20. (U072).

---

## 5. Spiralprinzip und Grammatik-Progression

Jedes Grammatikphänomen erscheint dreimal, mit wachsender Tiefe:

1. **Einführen**: eine Form, ein Kontext, feste Wendungen erlaubt.
2. **Erweitern**: weitere Personen/Formen/Genera, Kontrast zu Bekanntem.
3. **Festigen**: Kombination mit anderem Stoff, Produktion in freieren Übungen.

Zwischen Einführen und Erweitern liegen mindestens zwei, höchstens sechs Units. Die konkreten Positionen stehen in `UNIT_MAP.md` (Spalte "Primary grammar" und "Recycle").

### Grammatik-Syllabus pro Stufe

**A1.1 (Modul 1)**  
Lateinisches Alphabet und Aussprache (č/ć, đ/dž, š, ž, silbisches r), `biti` im Präsens (alle Personen, in zwei Schritten) und Negation `nisam`, Personalpronomen, Genus der Substantive an der Endung, Fragepartikel `li` und `da li`, Fragewörter (`ko, šta, gde, kako, koliko, odakle`), Zahlen 1 bis 100 plus Hunderter als Einzelwörter (Dinarpreise), `zvati se`, `imati` und `želeti` im Präsens, Akkusativ Singular feminin (`-u`) zunächst als Wendung dann als Regel, `u/na + Ort` und `bez/sa + Zutat` als Wendungen mit Grammatik-Vorschau, Possessiva `moj/tvoj/vaš` im Nominativ.

**A1.2 (Modul 2)**  
Präsens der drei Konjugationsklassen (`-am/-im/-em`), Verneinung mit `ne`, Modalverben `moći/morati/hteti + da`, Plural der Substantive (regelmäßige Muster), Adjektiv-Kongruenz im Nominativ, Demonstrativa `ovaj/taj/onaj`, Lokativ mit `u/na` als Regel (Singular), Akkusativ Singular vollständig (inkl. maskulin belebt), Dativ in `treba mi / drago mi je`, Uhrzeit und Wochentage (`u pola devet`, `u ponedeljak`), Ordnungszahlen 1 bis 10, Imperativ der Höflichkeit als Wendung (`Dajte, Recite, Izvolite`).

**A2.1 (Modul 3)**  
Perfekt (alle Personen, `biti` + Partizip), Futur I (`ću/ćeš` als Klitikon und Vollform), Einführung des Verbalaspekts (Paare wie `kupiti/kupovati` erkennen), Genitiv Plural nach Mengen und Zahlen ab 5, Instrumental (`sa + Person`, Mittel), Dativ als indirektes Objekt und in `boli me`, reflexive Verben, Komparativ der häufigsten Adjektive, Höflichkeitskonditional als Wendung (`Da li biste ...`), Zeitpräpositionen (`pre, posle, za, od ... do`), Wetter und unpersönliche Ausdrücke.

**A2.2 (Modul 4)**  
Imperativ vollständig (2. Person Singular und Plural, Verneinung), Konditional (Potencijal) vollständig, Aspektpaare systematisch (Zeitform und Aspekt), Vokativ, Zahl und Substantiv (`2 bis 4 + Genitiv Singular`, `5 und mehr + Genitiv Plural`), Relativsätze mit `koji`, Indefinit- und Negativpronomen (`neko/nešto/niko/ništa`), Bewegungsverben mit Akkusativ (Ziel) versus Lokativ (Ort), unpersönliches `se`, indirekte Rede einfach, Adjektive in allen Singular-Kasus.

**B1 (Modul 5)**  
Gesamtes Kasussystem in Singular und Plural (Konsolidierung, keine Neueinführung), Aspekt sicher in allen Zeitformen, Verbaladverbien (Gerundien), Plusquamperfekt und Aorist zum Erkennen, komplexe Nebensätze (`iako, jer, pošto, ukoliko, dok`), formelles Register (`Vi`, Anrede, Schriftverkehr), Partizipien als Adjektive, Wortstellung und Klitika, Kyrillisch lesen, Datum, Prozent, große Zahlen, argumentative Konnektoren, Redewendungen.

---

## 6. Chunk-Policy (Umgang mit Kasus auf A1)

Hard Rule 4 des heutigen Creator-Prompts ("jeden verwendeten Kasus vollständig erklären") wird zu **"Chunk oder erklären"**:

- Der Brief listet unter `Chunks allowed:` feste Wendungen, die die Unit ohne Regelerklärung verwenden darf (z. B. `sa mlekom`, `bez šećera`, `u Podgorici`, `pola kilograma`).
- Der Creator markiert solche Wendungen in der Vokabel-Notes-Spalte mit `Chunk` und in der Grammar-Sektion höchstens mit einem Ein-Satz-Hinweis `Grammar preview: full explanation in Unit N`.
- Sobald der Kasus laut `UNIT_MAP.md` eingeführt wird, greift die volle didaktische Vorlage (Abschnitt 7) und die Chunks werden dort als bekannte Beispiele wieder aufgegriffen.
- Der Lector wertet einen als Chunk markierten Kasus nicht als fehlende Erklärung.

So bleiben A1-Units nutzbar (echte Sprechakte wie "Jednu kafu sa mlekom, molim") ohne drei Kasus in einer Sitzung.

---

## 7. Didaktische Grammatik-Vorlage

Jeder Grammatikpunkt (`###`) in einer Standard-Unit besteht aus sechs Blöcken auf `####`-Ebene. Die Vorlage ist im Creator-Prompt hinterlegt und wird vom Parser für Units im neuen Format geprüft (Legacy-Units bleiben gültig).

1. `#### Why You Need This` – 1 bis 2 Sätze, Situationsbezug aus der Unit.
2. `#### The Rule` – Erklärung in einfacher Sprache, Kontrast zum Englischen, wo hilfreich.
3. `#### Pattern` – Tabelle mit Formen/Auslösern, Serbisch, Englisch.
4. `#### Examples` – 6 bis 8 Sätze aus dem Unit-Wortschatz, Zielform fett.
5. `#### Watch Out` – 2 bis 3 typische Fehler deutsch- und englischsprachiger Lerner als falsch/richtig-Paar.
6. `#### Quick Check` – 2 bis 3 Mini-Aufgaben, darunter eine separate Zeile `**Answers:**`.

Review- und Checkpoint-Units ersetzen die Vorlage durch eine Zusammenschau (siehe Abschnitt 4).

---

## 8. Sprachnorm und montenegrinische Varianten

- Lehrform ist Ekavisch in Vokabelzellen, Dialogen, Beispielsätzen und Übungsantworten. Das sichert eindeutige Übungsauswertung und saubere TTS-Ausgabe.
- Montenegrinische Varianten (ijekavische Formen wie `mlijeko`, `gdje`, lexikalische Besonderheiten) erscheinen ausschließlich in der Notes-Spalte der Vokabeltabelle, in "Watch Out" oder in der Cultural Note. Die Notes werden vom Validator automatisch ergänzt (Lookup in `convex/contentStudio/_validatorHelpers.ts`; Ausbau zu einem DB-Lexikon ist als Folgeplan vorgemerkt).
- **Standardkulisse Serbien**: Belgrad, Novi Sad, Niš, Subotica, Kragujevac; Flughafen Nikola Tesla, Kalenić-Pijaca, Ada Ciganlija, Kopaonik. Preise in Dinar; deshalb werden die Hunderter (`sto, dvesta, trista, petsto`) bereits in U003 mit den Zehnern eingeführt.
- **Montenegro als Reise- und Küstenkontext** (Strang ARR): Küstenurlaub, Flughafen Tivat, Mietwagen, Reiseprobleme, einzelne Gastfiguren aus Montenegro in Dialogen, Cultural Notes. Preise dort in Euro, was den Währungskontrast lehrreich macht.
- **Behördenunits** (Aufenthalt, Firma, Einbürgerung) spielen in Serbien (MUP, Opština, eUprava, APR). Der Brief vermerkt, wo Montenegro abweicht (z. B. CRPS statt APR, Euro), damit beide Länder abgedeckt sind.
- Aussprache wird nicht als Lautschrift gelehrt; jede Vokabel ist per TTS abspielbar. Der Brief nennt unter `Listening focus:` 3 bis 5 Wörter oder Minimalpaare, auf die der Creator im Vokabel-Intro hinweist.

---

## 9. Thematische Stränge

Sechs Stränge ziehen sich durch alle Stufen. Jedes Modul deckt jeden Strang mindestens einmal ab; die Komplexität steigt mit der Stufe. Der Brief trägt den Strang im Feld `Strand:`.

| Strang | Kürzel | A1-Beispiel | B1-Beispiel |
|--------|--------|-------------|-------------|
| Ankommen & Reisen | ARR | Hotel-Check-in, Taxi; Küstenurlaub in Montenegro | Reisebuchung reklamieren, Grenzkontrolle |
| Sich niederlassen | SET | Wohnung besichtigen | Mietvertrag verhandeln, Behördenbescheid verstehen |
| Alltag | DAY | Markt, Café, Supermarkt | Reparatur beauftragen, Arzttermin mit Vorgeschichte |
| Menschen & Soziales | SOC | Vorstellen, Nachbarn | Meinung begründen, Konflikt klären |
| Arbeit & Business | BIZ | Beruf nennen | Firma gründen, Angebot verhandeln |
| Digitales & Services | DIG | SIM-Karte kaufen | Online-Formular, Kundendienst-Hotline |

---

## 10. Übungen und XP

Die fünf Übungskategorien des Templates bleiben (translation, fillInBlank, multipleChoice, vocabularyMatching, dialogueCompletion). Jede Unit legt im Brief unter `Exercise focus:` fest, welche Kategorien das Grammatikziel tragen. Mindestens die Hälfte der Items in Fill-in-the-Blank und Multiple Choice prüft das primäre Grammatikziel; die übrigen Items prüfen Wortschatz im Kontext.

Das XP-System (5/10/20 XP pro Item bis zur Mastery, danach 0) ist von Unit-Anzahl und Item-Anzahl unabhängig. 5 bis 6 Items pro Kategorie ergeben 25 bis 30 Items pro Unit, also 875 bis 1.050 XP Potenzial aus dem Interactive Test plus 700 bis 1.050 XP aus dem Vokabeltrainer (20 bis 30 Wörter), zusammen rund 1.600 bis 2.100 XP pro Unit (fünf bis sieben Level-Schritte à 300 XP). Die Level-Formel selbst ist nicht Teil dieses Rahmens; ob die Staffelung bei 72 Units noch motivierend wirkt (rund 400 erreichbare Level), wird als Folgepunkt geprüft.

Weiterentwicklung der Übungsdidaktik (Distraktor-Regeln, kontextualisiertes Matching, Reihenfolge Wiedererkennen vor Produktion, Alternativantworten) ist als eigener Folgeplan vorgemerkt und nicht Teil dieses Rahmens.

---

## 11. Qualitätskriterien und Freigabekette

Jede Unit durchläuft vor Veröffentlichung:

1. **Creator** (KI) auf Basis von Brief und Prompt.
2. **Parser/Validator** (deterministisch): Struktur, Grammatik-Vorlage, Vocab-Coverage, Übungsformat, Micro-Unit-Grenzen, Montenegro-Notes.
3. **Lector** (KI, beratend): serbische Korrektheit, Bedeutungsabgleich, kulturelle Risiken, didaktische Lücken (`DIDACTIC_GAP`).
4. **Menschliches Review** im Content Studio (Rendered-Tab), Übernahme geprüfter Abschnitte in den Brief (Adopt).
5. **Übersetzung EN→DE** mit Verifier.
6. **Preview** in beiden Sprachen, Lerner-Testdurchlauf, dann Publish.

---

## 12. Technische Randbedingungen

Diese Punkte ergeben sich aus der Codeprüfung und sind für die Curriculum-Umsetzung bindend.

- **Unit-Nummern sind die Reihenfolge**. Es gibt kein separates Sortierfeld; Fortschritt, Vokabeln und Question-IDs hängen an der Nummer. Neue Units werden ausschließlich angehängt, bestehende nie umnummeriert. U001 bis U004 behalten Nummer und Grundthema.
- **Jede Unit trägt `moduleMetadataId`**. Modul-Fallbacks über Nummernbereiche im Client werden in Phase 2b entfernt.
- **Brief-Länge** maximal 6.000 Zeichen (Creator-Limit), Zielgröße unter 4.000.
- **Bekannter Wortschatz** wird dem Creator heute nur bis 300 Wörter übergeben; die Vollübergabe (Phase 2) muss vor Modul 2 stehen.
- **Freischaltung** folgt der Nummernkette (Unit N offen, wenn N–1 abgeschlossen). Das dynamische Abschlusskriterium (Phase 2b) ist Voraussetzung für Production-Veröffentlichungen neuer Units.
- **Publish-Modus** für regenerierte Units mit echten Lernern wird nach dem Pilot entschieden (`update` mit Progress-Remap oder `replace` mit Fortschritts-Reset und Vorabinformation).

---

## 13. Umgang mit dem Bestand (U001 bis U004)

- U001 (Preview) und U002 (Published) sind Pilot-Units: Neugenerierung mit neuem Brief, neuem Prompt und Micro-Format auf Dev.
- U003 (Published, 49 Vokabeln, drei Grammatikpunkte) und U004 (Preview) behalten Nummer und Thema. Bei Neugenerierung werden sie auf das Micro-Format zurückgeführt; überzählige Inhalte wandern in die Folge-Units gemäß `UNIT_MAP.md` (z. B. Zahlen 21 bis 100 in U005).
- Frühere Planungsskizzen sind hinfällig; `UNIT_MAP.md` ist die einzige Quelle für Unit-Themen und -Reihenfolge. In der Dev-Datenbank existieren nur die Drafts U001 bis U004 (siehe `UNIT_MAP.md`, Appendix A).

---

## 14. Rollout-Reihenfolge

1. Pilot U001 und U002 (Phase 4 des Plans).
2. Modul 1 vollständig (U003 bis U012), danach Checkpoint-Test mit Lerner-Testuser.
3. Modul 2, dann Modul 3 und 4; Modul 5 nach Freigabe des B1-Syllabus im Detail.
4. Test-Modul (U073 bis U075) nach Fertigstellung der jeweiligen Stufe.

Jeder Rollout-Schritt endet mit dem Prüfprotokoll aus dem Plan (technisch, Content Studio, Lerner-Flow, Datenintegrität, Rollback).
