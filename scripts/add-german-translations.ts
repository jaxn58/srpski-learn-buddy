/**
 * Script to add German translations for all unit explanations
 * Run with: npx tsx scripts/add-german-translations.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

/**
 * Comprehensive German translation function
 * Translates educational content from English to German
 */
function translateToGerman(text: string): string {
  if (!text) return '';
  
  let t = text;
  
  // Main headers
  t = t.replace(/## Welcome to Unit (\d+):/g, "## Willkommen zu Lektion $1:");
  t = t.replace(/## Welcome to Unit (\d+): Past Tense Introduction/g, "## Willkommen zu Lektion $1: Einführung in die Vergangenheitsform");
  t = t.replace(/Willkommen zu Lektion (\d+): Past Tense Introduction/g, "Willkommen zu Lektion $1: Einführung in die Vergangenheitsform");
  t = t.replace(/# Unit (\d+): Grammar Explained/g, "# Lektion $1: Grammatik erklärt");
  t = t.replace(/# Unit (\d+): Practice Examples/g, "# Lektion $1: Übungsbeispiele");
  t = t.replace(/# Unit (\d+): Practice Examples & Dialogues/g, "# Lektion $1: Übungsbeispiele & Dialoge");
  
  // Title phrases - must come early to catch them in titles
  t = t.replace(/At the Airport/g, "Am Flughafen");
  t = t.replace(/In the Café/g, "Im Café");
  t = t.replace(/In the café/g, "Im Café");
  t = t.replace(/In the room/g, "Im Zimmer");
  t = t.replace(/Learning Serbian/g, "Serbisch lernen");
  t = t.replace(/Finding Your Way/g, "Sich zurechtfinden");
  t = t.replace(/Describing Your Room/g, "Dein Zimmer beschreiben");
  t = t.replace(/Shopping for Food/g, "Lebensmittel einkaufen");
  t = t.replace(/Describing People/g, "Menschen beschreiben");
  t = t.replace(/Unit (\d+) corresponds to pages (\d+)-(\d+)/g, "Lektion $1 entspricht den Seiten $2-$3");
  t = t.replace(/Unit (\d+) corresponds to page (\d+)/g, "Lektion $1 entspricht Seite $2");
  
  // Section headers
  t = t.replace(/\*\*What You'll Learn:\*\*/g, "**Was du lernen wirst:**");
  t = t.replace(/\*\*Real-Life Context:\*\*/g, "**Alltagskontext:**");
  t = t.replace(/\*\*Why This Matters:\*\*/g, "**Warum das wichtig ist:**");
  t = t.replace(/\*\*Study Tips:\*\*/g, "**Lerntipps:**");
  
  // Book references
  t = t.replace(/This unit corresponds to page (\d+)/g, "Diese Lektion entspricht Seite $1");
  t = t.replace(/This unit corresponds to pages (\d+)-(\d+)/g, "Diese Lektion entspricht den Seiten $1-$2");
  t = t.replace(/Step by Step Serbian 1/g, "Schritt für Schritt Serbisch 1");
  t = t.replace(/by Vladislava Ribnikar/g, "von Vladislava Ribnikar");
  t = t.replace(/by Mirjana Danilović/g, "von Mirjana Danilović");
  
  // Exercise and section headers
  t = t.replace(/## 📝 Dialogue (\d+):/g, "## 📝 Dialog $1:");
  t = t.replace(/## ✏️ Exercise (\d+):/g, "## ✏️ Übung $1:");
  t = t.replace(/## 🎭 Role-Play Exercise/g, "## 🎭 Rollenspiel-Übung");
  t = t.replace(/## 📚 Vocabulary Review/g, "## 📚 Vokabel-Wiederholung");
  t = t.replace(/## 🌍 Cultural Note:/g, "## 🌍 Kultureller Hinweis:");
  t = t.replace(/## 🎯 Self-Check/g, "## 🎯 Selbstkontrolle");
  t = t.replace(/## 🎯 Key Takeaways:/g, "## 🎯 Wichtige Erkenntnisse:");
  
  // Fix "Dialogs" in title
  t = t.replace(/Übungsbeispiele & Dialogs/g, "Übungsbeispiele & Dialoge");
  t = t.replace(/Practice Examples & Dialogs/g, "Übungsbeispiele & Dialoge");
  
  // Dialog titles without emoji
  t = t.replace(/Dialog 1: Meeting Someone at the Airport/g, "Dialog 1: Jemanden am Flughafen treffen");
  t = t.replace(/Dialog 2: At the Information Desk/g, "Dialog 2: Am Informationsschalter");
  t = t.replace(/Dialog 1: Ordering Coffee/g, "Dialog 1: Kaffee bestellen");
  t = t.replace(/Dialog: Ordering Coffee/g, "Dialog: Kaffee bestellen");
  t = t.replace(/Dialog: Asking for Directions/g, "Dialog: Nach dem Weg fragen");
  t = t.replace(/Dialog: Describing a Room/g, "Dialog: Ein Zimmer beschreiben");
  
  // Exercise titles
  t = t.replace(/Exercise 1: Fill in the Blanks \(Verb "biti"\)/g, "Übung 1: Lücken ausfüllen (Verb \"biti\")");
  t = t.replace(/Exercise 2: Translate to Serbian/g, "Übung 2: Ins Serbische übersetzen");
  t = t.replace(/Exercise 3: Gender Recognition/g, "Übung 3: Geschlecht erkennen");
  
  // Speaker labels
  t = t.replace(/\*\*You:\*\*/g, "**Du:**");
  t = t.replace(/\*\*Employee:\*\*/g, "**Mitarbeiter:**");
  t = t.replace(/\*\*Local:\*\*/g, "**Einheimischer:**");
  t = t.replace(/\*\*Agent:\*\*/g, "**Agent:**");
  t = t.replace(/\*\*Marko:\*\*/g, "**Marko:**");
  t = t.replace(/\*\*Konobar \(Waiter\):\*\*/g, "**Kellner:**");
  
  // Common scenario descriptions
  t = t.replace(/You're in a Belgrade café ordering coffee\./g, "Du bist in einem Belgrader Café und bestellst Kaffee.");
  t = t.replace(/You're in a Belgrade café/g, "Du bist in einem Belgrader Café");
  t = t.replace(/You're in a/g, "Du bist in einem");
  
  // Grammar explanations
  t = t.replace(/in the "ja" \(Ich\) form\./g, "in der \"ja\" (Ich) Form.");
  t = t.replace(/in the "ja" \(Ich\) form/g, "in der \"ja\" (Ich) Form");
  t = t.replace(/They're very regular!/g, "Sie sind sehr regelmäßig!");
  t = t.replace(/\(to read\)/g, "(lesen)");
  t = t.replace(/\(to have\)/g, "(haben)");
  t = t.replace(/\(to go\)/g, "(gehen)");
  t = t.replace(/\(can\/to be able to\)/g, "(können)");
  
  // Dialog titles
  t = t.replace(/Dialog 1: Talking About Serbisch lernen/g, "Dialog 1: Über Serbisch lernen sprechen");
  t = t.replace(/Dialog: Talking About/g, "Dialog: Über ... sprechen");
  
  // Common labels
  t = t.replace(/Scenario:/g, "Szenario:");
  t = t.replace(/Translation:/g, "Übersetzung:");
  t = t.replace(/Answers:/g, "Antworten:");
  t = t.replace(/Answer:/g, "Antwort:");
  t = t.replace(/Example:/g, "Beispiel:");
  t = t.replace(/Examples:/g, "Beispiele:");
  t = t.replace(/Key Points:/g, "Wichtige Punkte:");
  t = t.replace(/Important:/g, "Wichtig:");
  t = t.replace(/Note:/g, "Hinweis:");
  t = t.replace(/🇲🇪 Montenegrin Note/g, "🇲🇪 Montenegrinischer Hinweis");
  
  // Instructions (längere Patterns zuerst)
  t = t.replace(/Practice this dialogue with a partner or out loud:/g, "Übe diesen Dialog mit einem Partner oder laut:");
  t = t.replace(/with a partner or out loud/g, "mit einem Partner oder laut");
  t = t.replace(/Complete the sentences/g, "Vervollständige die Sätze");
  t = t.replace(/Translate to Serbian/g, "Übersetze ins Serbische");
  t = t.replace(/Identify the gender/g, "Bestimme das Geschlecht");
  t = t.replace(/Practice this dialogue/g, "Übe diesen Dialog");
  t = t.replace(/Fill in the blanks/g, "Fülle die Lücken aus");
  t = t.replace(/Choose the correct/g, "Wähle die richtige");
  t = t.replace(/Match the following/g, "Verbinde die folgenden");
  
  // Self-check and completion
  t = t.replace(/Can you now:/g, "Kannst du jetzt:");
  t = t.replace(/If yes -/g, "Wenn ja -");
  t = t.replace(/congratulations!/g, "Glückwunsch!");
  t = t.replace(/You're ready for Unit (\d+)!/g, "Du bist bereit für Lektion $1!");
  t = t.replace(/odlično!/g, "ausgezeichnet!");
  
  // Writing instructions
  t = t.replace(/Write (\d+) sentences about/g, "Schreibe $1 Sätze über");
  t = t.replace(/Write about your/g, "Schreibe über dein");
  t = t.replace(/Your turn:/g, "Dein Zug:");
  t = t.replace(/Model:/g, "Vorlage:");
  t = t.replace(/Tell Your Story/g, "Erzähle deine Geschichte");
  t = t.replace(/Describe Your Symptoms/g, "Beschreibe deine Symptome");
  t = t.replace(/Plan Your Trip/g, "Plane deine Reise");
  t = t.replace(/Describe Your Day/g, "Beschreibe deinen Tag");
  
  // Common educational terms
  t = t.replace(/Vocabulary/g, "Vokabeln");
  t = t.replace(/Grammar/g, "Grammatik");
  t = t.replace(/Practice/g, "Übung");
  t = t.replace(/Exercise/g, "Übung");
  t = t.replace(/Dialogue/g, "Dialog");
  t = t.replace(/Dialogues/g, "Dialoge");
  
  // Media and topics
  t = t.replace(/Media vocabulary/g, "Medien-Vokabeln");
  t = t.replace(/TV, radio, newspapers/g, "Fernsehen, Radio, Zeitungen");
  
  // Numbers and counting
  t = t.replace(/Numbers from 1 to 100/g, "Zahlen von 1 bis 100");
  t = t.replace(/Numbers 1-100/g, "Zahlen 1-100");
  t = t.replace(/Numbers 1-20:/g, "Zahlen 1-20:");
  t = t.replace(/Numbers are essential for ordering, paying, and everyday conversation!/g, "Zahlen sind unerlässlich für Bestellungen, Bezahlen und alltägliche Gespräche!");
  t = t.replace(/Numbers are essential/g, "Zahlen sind unerlässlich");
  
  // Table headers
  t = t.replace(/\| Number \| Serbisch \| Aussprache \|/g, "| Zahl | Serbisch | Aussprache |");
  t = t.replace(/\| Number \|/g, "| Zahl |");
  t = t.replace(/\| Person \| Form \| Englisch \| Beispiel \|/g, "| Person | Form | Deutsch | Beispiel |");
  t = t.replace(/\| Englisch \|/g, "| Deutsch |");
  
  // Common list items in overview sections
  t = t.replace(/- Numbers from 1 to 100/g, "- Zahlen von 1 bis 100");
  t = t.replace(/- How to order food and drinks in a café/g, "- Wie man Essen und Getränke in einem Café bestellt");
  t = t.replace(/- The verb "imati" \(to have\)/g, "- Das Verb \"imati\" (haben)");
  t = t.replace(/- Asking about prices/g, "- Nach Preisen fragen");
  t = t.replace(/- Basic café vocabulary/g, "- Grundlegende Café-Vokabeln");
  t = t.replace(/- Basic café vocab/g, "- Grundlegende Café-Vokabeln");
  t = t.replace(/- Present tense verbs \(Group 1 and 2\)/g, "- Präsens-Verben (Gruppe 1 und 2)");
  t = t.replace(/- Talking about täglich activities/g, "- Über tägliche Aktivitäten sprechen");
  t = t.replace(/- Media vocabulary \(TV, radio, newspapers\)/g, "- Medien-Vokabeln (Fernsehen, Radio, Zeitungen)");
  t = t.replace(/- Describing rooms and furniture/g, "- Zimmer und Möbel beschreiben");
  t = t.replace(/- How to describe people's physical appearance/g, "- Wie man das körperliche Erscheinungsbild von Menschen beschreibt");
  t = t.replace(/- Character traits and personality adjectives/g, "- Charaktereigenschaften und Persönlichkeitsadjektive");
  t = t.replace(/- Adjective agreement with gender/g, "- Adjektivübereinstimmung mit Geschlecht");
  t = t.replace(/- Describing style and fit/g, "- Stil und Passform beschreiben");
  
  // Time expressions
  t = t.replace(/yesterday/g, "gestern");
  t = t.replace(/last week/g, "letzte Woche");
  t = t.replace(/last month/g, "letzten Monat");
  t = t.replace(/last year/g, "letztes Jahr");
  
  // Common phrases in context
  t = t.replace(/Imagine you've/g, "Stell dir vor, du hast");
  t = t.replace(/Imagine you're/g, "Stell dir vor, du bist");
  
  // Vocabulary and expression phrases
  t = t.replace(/Body parts vocabulary/g, "Vokabeln für Körperteile");
  t = t.replace(/Health and illness expressions/g, "Ausdrücke für Gesundheit und Krankheit");
  t = t.replace(/Common health-related phrases/g, "Häufige gesundheitsbezogene Phrasen");
  t = t.replace(/Transportation vocabulary/g, "Vokabeln für Verkehrsmittel");
  t = t.replace(/Travel-related phrases/g, "Reisebezogene Phrasen");
  t = t.replace(/Vocabulary for emotions and feelings/g, "Vokabeln für Emotionen und Gefühle");
  t = t.replace(/Essential food vocabulary/g, "Wichtige Vokabeln für Lebensmittel");
  t = t.replace(/Food vocabulary/g, "Vokabeln für Lebensmittel");
  t = t.replace(/Emotion vocabulary/g, "Vokabeln für Emotionen");
  t = t.replace(/Health vocabulary/g, "Vokabeln für Gesundheit");
  
  // How to phrases
  t = t.replace(/How to describe symptoms/g, "Wie man Symptome beschreibt");
  t = t.replace(/How to shop for groceries/g, "Wie man Lebensmittel einkauft");
  t = t.replace(/How to ask for quantities/g, "Wie man nach Mengen fragt");
  t = t.replace(/How to express happiness, sadness, anger/g, "Wie man Glück, Traurigkeit und Wut ausdrückt");
  t = t.replace(/How to form the past tense/g, "Wie man die Vergangenheitsform bildet");
  t = t.replace(/How to talk about what you did/g, "Wie man über das spricht, was man getan hat");
  t = t.replace(/How to order food and drinks in a café/g, "Wie man Essen und Getränke in einem Café bestellt");
  t = t.replace(/How to order food and drinks/g, "Wie man Essen und Getränke bestellt");
  
  // Visiting/Asking phrases
  t = t.replace(/Visiting a doctor or pharmacy/g, "Einen Arzt oder eine Apotheke besuchen");
  t = t.replace(/Asking about schedules and routes/g, "Nach Fahrplänen und Routen fragen");
  t = t.replace(/Asking for quantities and understand prices/g, "Nach Mengen fragen und Preise verstehen");
  t = t.replace(/Buying tickets and making reservations/g, "Fahrkarten kaufen und Reservierungen vornehmen");
  
  // Full sentences - Context descriptions
  t = t.replace(/Feeling sick abroad\? Need a pharmacy\?/g, "Fühlst du dich im Ausland krank? Brauchst du eine Apotheke?");
  t = t.replace(/This unit prepares you for health-related situations in Serbia\./g, "Diese Lektion bereitet dich auf gesundheitsbezogene Situationen in Serbien vor.");
  t = t.replace(/Getting around Serbia and Montenegro, booking trips, navigating transportation - essential for travelers!/g, "In Serbien und Montenegro unterwegs sein, Reisen buchen, Verkehrsmittel nutzen - unerlässlich für Reisende!");
  t = t.replace(/Connecting with people emotionally, expressing yourself authentically - essential for meaningful conversations!/g, "Sich emotional mit Menschen verbinden, sich authentisch ausdrücken - unerlässlich für bedeutsame Gespräche!");
  t = t.replace(/Whether you're sharing stories about your trip, talking about what you did yesterday, or discussing past events, the past tense is essential for everyday conversation\./g, "Ob du Geschichten über deine Reise erzählst, über das sprichst, was du gestern getan hast, oder über vergangene Ereignisse diskutierst - die Vergangenheitsform ist unerlässlich für alltägliche Gespräche.");
  // Fix mixed German/English sentences
  t = t.replace(/Whether you're sharing stories about your trip, talking about what you tat gestern, or discussing past events, der\/die\/das past tense ist essential for everyday conversation\./g, "Ob du Geschichten über deine Reise erzählst, über das sprichst, was du gestern getan hast, oder über vergangene Ereignisse diskutierst - die Vergangenheitsform ist unerlässlich für alltägliche Gespräche.");
  t = t.replace(/talking about what you tat gestern/g, "über das sprichst, was du gestern getan hast");
  t = t.replace(/der\/die\/das past tense ist essential/g, "die Vergangenheitsform ist unerlässlich");
  t = t.replace(/This unit introduces you to Serbian's straightforward past tense system!/g, "Diese Lektion führt dich in Serbiens unkompliziertes Vergangenheitssystem ein!");
  t = t.replace(/The Serbian past tense is actually simpler than many other languages - it has only one past tense form \(unlike English with simple past, present perfect, past perfect, etc\.\)\. Once you master this unit, you'll be able to talk about any past event!/g, "Die serbische Vergangenheitsform ist tatsächlich einfacher als viele andere Sprachen - sie hat nur eine Vergangenheitsform (im Gegensatz zu Englisch mit Simple Past, Present Perfect, Past Perfect, etc.). Sobald du diese Lektion beherrschst, kannst du über jedes vergangene Ereignis sprechen!");
  t = t.replace(/\(unlike English with Simple Past, Present Perfect, Past Perfect, etc\.\)/g, "(im Gegensatz zu Englisch mit Simple Past, Present Perfect, Past Perfect, etc.)");
  t = t.replace(/Shopping for food is one of the most practical and frequent activities you'll do in Serbia\. Markets are social hubs where locals gather, and knowing how to communicate properly will not only help you get what you need but also connect with Serbian culture\./g, "Lebensmittel einkaufen ist eine der praktischsten und häufigsten Aktivitäten, die du in Serbien machen wirst. Märkte sind soziale Treffpunkte, an denen sich Einheimische versammeln, und zu wissen, wie man richtig kommuniziert, hilft dir nicht nur, das zu bekommen, was du brauchst, sondern verbindet dich auch mit der serbischen Kultur.");
  t = t.replace(/Imagine you're at a vibrant Serbian market \(pijaca\) or a modern supermarket in Belgrade\. You need to buy ingredients for dinner - fresh vegetables for a Serbian salad, bread from the bakery, and some dairy products\. This unit equips you with all the vocabulary and grammar you need to navigate Serbian food shopping with confidence!/g, "Stell dir vor, du bist auf einem lebendigen serbischen Markt (pijaca) oder in einem modernen Supermarkt in Belgrad. Du musst Zutaten für das Abendessen kaufen - frisches Gemüse für einen serbischen Salat, Brot aus der Bäckerei und einige Milchprodukte. Diese Lektion stattet dich mit all dem Vokabular und der Grammatik aus, die du brauchst, um serbisches Lebensmitteleinkaufen mit Selbstvertrauen zu meistern!");
  
  // Self-Check questions
  t = t.replace(/Name 10\+ body parts\?/g, "10+ Körperteile benennen?");
  t = t.replace(/Describe common symptoms\?/g, "Häufige Symptome beschreiben?");
  t = t.replace(/Ask for medicine at a pharmacy\?/g, "In einer Apotheke nach Medikamenten fragen?");
  t = t.replace(/Explain how you feel\?/g, "Erklären, wie du dich fühlst?");
  t = t.replace(/Name different types of transportation\?/g, "Verschiedene Verkehrsmittel benennen?");
  t = t.replace(/Buy tickets and ask about schedules\?/g, "Fahrkarten kaufen und nach Fahrplänen fragen?");
  t = t.replace(/Navigate stations and airports\?/g, "Bahnhöfe und Flughäfen navigieren?");
  t = t.replace(/Use travel-related vocabulary\?/g, "Reisebezogenes Vokabular verwenden?");
  t = t.replace(/Name 10\+ emotions in Serbian\?/g, "10+ Emotionen auf Serbisch benennen?");
  t = t.replace(/Express how you feel\?/g, "Ausdrücken, wie du dich fühlst?");
  t = t.replace(/React appropriately to news\?/g, "Angemessen auf Nachrichten reagieren?");
  t = t.replace(/Show empathy and sympathy\?/g, "Empathie und Mitgefühl zeigen?");
  t = t.replace(/Use "trebati" correctly with dative pronouns\?/g, "\"Trebati\" korrekt mit Dativpronomen verwenden?");
  t = t.replace(/Name 10\+ fruits and vegetables in Serbian\?/g, "10+ Obst- und Gemüsesorten auf Serbisch benennen?");
  t = t.replace(/Ask for prices and quantities\?/g, "Nach Preisen und Mengen fragen?");
  t = t.replace(/Complete a shopping conversation\?/g, "Ein Einkaufsgespräch führen?");
  t = t.replace(/Understand the difference between "treba" and "trebaju"\?/g, "Den Unterschied zwischen \"treba\" und \"trebaju\" verstehen?");
  t = t.replace(/Form past tense with auxiliary \+ participle\?/g, "Vergangenheitsform mit Hilfsverb + Partizip bilden?");
  t = t.replace(/Use correct gender endings \(-o\/-la\/-lo\)\?/g, "Korrekte Geschlechtsendungen (-o/-la/-lo) verwenden?");
  t = t.replace(/Make negative past tense sentences\?/g, "Negative Vergangenheitssätze bilden?");
  t = t.replace(/Ask questions in past tense\?/g, "Fragen in der Vergangenheitsform stellen?");
  t = t.replace(/Use time expressions like "juče", "prošle nedelje"\?/g, "Zeitausdrücke wie \"juče\", \"prošle nedelje\" verwenden?");
  
  // Write instructions - full sentences
  t = t.replace(/Write 3-4 sentences about how you feel when you have a cold:/g, "Schreibe 3-4 Sätze darüber, wie du dich fühlst, wenn du erkältet bist:");
  t = t.replace(/Write 5 sentences about a trip you want to take:/g, "Schreibe 5 Sätze über eine Reise, die du machen möchtest:");
  t = t.replace(/Write 5 sentences about how you felt today:/g, "Schreibe 5 Sätze darüber, wie du dich heute gefühlt hast:");
  t = t.replace(/Write about your yesterday in Serbian:/g, "Schreibe über dein Gestern auf Serbisch:");
  t = t.replace(/Write 5-6 sentences about your yesterday\)/g, "Schreibe 5-6 Sätze über dein Gestern)");
  t = t.replace(/Write 5-6 sentences about your gestern\)/g, "Schreibe 5-6 Sätze über dein Gestern)");
  
  // Additional common phrases
  t = t.replace(/Essential for travelers!/g, "Unerlässlich für Reisende!");
  t = t.replace(/Essential for everyday conversation\./g, "Unerlässlich für alltägliche Gespräche.");
  t = t.replace(/Essential for meaningful conversations!/g, "Unerlässlich für bedeutsame Gespräche!");
  t = t.replace(/This unit equips you with all the vocabulary and grammar you need to navigate Serbian food shopping with confidence!/g, "Diese Lektion stattet dich mit all dem Vokabular und der Grammatik aus, die du brauchst, um serbisches Lebensmitteleinkaufen mit Selbstvertrauen zu meistern!");
  t = t.replace(/Markets are social hubs where locals gather, and knowing how to communicate properly will not only help you get what you need but also connect with Serbian culture\./g, "Märkte sind soziale Treffpunkte, an denen sich Einheimische versammeln, und zu wissen, wie man richtig kommuniziert, hilft dir nicht nur, das zu bekommen, was du brauchst, sondern verbindet dich auch mit der serbischen Kultur.");
  t = t.replace(/Practice with your own daily activities from yesterday/g, "Übe mit deinen eigenen täglichen Aktivitäten von gestern");
  t = t.replace(/Übung with your own daily activities from gestern/g, "Übe mit deinen eigenen täglichen Aktivitäten von gestern");
  t = t.replace(/Keep a simple diary in Serbian using past tense/g, "Führe ein einfaches Tagebuch auf Serbisch in der Vergangenheitsform");
  t = t.replace(/Notice the gender agreement patterns/g, "Achte auf die Geschlechtsübereinstimmungsmuster");
  t = t.replace(/Create flashcards with pictures of foods/g, "Erstelle Karteikarten mit Bildern von Lebensmitteln");
  t = t.replace(/Visit Serbian market websites or YouTube videos to see real shopping scenarios/g, "Besuche serbische Markt-Websites oder YouTube-Videos, um echte Einkaufsszenarien zu sehen");
  t = t.replace(/Practice quantities with real objects at home/g, "Übe Mengen mit echten Gegenständen zu Hause");
  t = t.replace(/Learn the currency \(dinar\) and practice price calculations/g, "Lerne die Währung (Dinar) und übe Preisberechnungen");
  
  // Fix "war man getan hat" - should be "was man getan hat"
  t = t.replace(/war man getan hat/g, "was man getan hat");
  t = t.replace(/über das spricht, war man getan hat/g, "über das spricht, was man getan hat");
  
  // Fix common mixed German/English patterns that occur after partial translation
  t = t.replace(/from gestern/g, "von gestern");
  t = t.replace(/with your own daily activities from gestern/g, "mit deinen eigenen täglichen Aktivitäten von gestern");
  t = t.replace(/what you tat/g, "was du getan hast");
  t = t.replace(/talking about what you tat/g, "über das sprichst, was du getan hast");
  t = t.replace(/der\/die\/das past tense/g, "die Vergangenheitsform");
  t = t.replace(/ist essential/g, "ist unerlässlich");
  t = t.replace(/past tense ist/g, "Vergangenheitsform ist");
  t = t.replace(/über das spricht, war man/g, "über das spricht, was man");
  
  // More mixed patterns from the screenshot
  t = t.replace(/What tat you tun\?/g, "Was hast du getan?");
  t = t.replace(/What tat you tun gestern\?/g, "Was hast du gestern getan?");
  t = t.replace(/When tat you arrive\?/g, "Wann bist du angekommen?");
  t = t.replace(/tat you/g, "hast du");
  t = t.replace(/tat you tun/g, "hast du getan");
  
  // Fix InteractiveExercise -> InteractiveÜbung (should stay as InteractiveExercise)
  t = t.replace(/InteractiveÜbung/g, "InteractiveExercise");
  
  // Additional context phrases
  t = t.replace(/At the airport and train station/g, "Am Flughafen und Bahnhof");
  t = t.replace(/At the airport and train station\./g, "Am Flughafen und Bahnhof.");
  t = t.replace(/Reacting to news and situations/g, "Auf Nachrichten und Situationen reagieren");
  t = t.replace(/Emotional expressions and exclamations/g, "Emotionale Ausdrücke und Ausrufe");
  t = t.replace(/Empathy and sympathy phrases/g, "Empathie- und Mitgefühlssätze");
  t = t.replace(/Polite shopping phrases and cultural etiquette/g, "Höfliche Einkaufsphrasen und kulturelle Etikette");
  t = t.replace(/Past tense endings for different genders/g, "Vergangenheitsendungen für verschiedene Geschlechter");
  t = t.replace(/Common past tense verbs/g, "Häufige Verben in der Vergangenheitsform");
  t = t.replace(/Time expressions for the past/g, "Zeitausdrücke für die Vergangenheit");
  
  // More full sentences
  t = t.replace(/The verb "trebati" \(to need\) - a key verb for shopping/g, "Das Verb \"trebati\" (brauchen) - ein Schlüsselverb fürs Einkaufen");
  t = t.replace(/in Serbian markets and supermarkets/g, "in serbischen Märkten und Supermärkten");
  t = t.replace(/\(fruits, vegetables, meat, dairy, bakery items\)/g, "(Obst, Gemüse, Fleisch, Milchprodukte, Backwaren)");
  t = t.replace(/\(bus, train, plane\)/g, "(Bus, Zug, Flugzeug)");
  
  // More phrases that appear in lists (with and without dashes)
  t = t.replace(/- Body parts vocabulary/g, "- Vokabeln für Körperteile");
  t = t.replace(/Body parts vocabulary/g, "Vokabeln für Körperteile");
  t = t.replace(/- Health and illness expressions/g, "- Ausdrücke für Gesundheit und Krankheit");
  t = t.replace(/Health and illness expressions/g, "Ausdrücke für Gesundheit und Krankheit");
  t = t.replace(/- How to describe symptoms/g, "- Wie man Symptome beschreibt");
  t = t.replace(/How to describe symptoms/g, "Wie man Symptome beschreibt");
  t = t.replace(/- Visiting a doctor or pharmacy/g, "- Einen Arzt oder eine Apotheke besuchen");
  t = t.replace(/Visiting a doctor or pharmacy/g, "Einen Arzt oder eine Apotheke besuchen");
  t = t.replace(/- Common health-related phrases/g, "- Häufige gesundheitsbezogene Phrasen");
  t = t.replace(/Common health-related phrases/g, "Häufige gesundheitsbezogene Phrasen");
  t = t.replace(/- Transportation vocabulary \(bus, train, plane\)/g, "- Vokabeln für Verkehrsmittel (Bus, Zug, Flugzeug)");
  t = t.replace(/- Buying tickets and making reservations/g, "- Fahrkarten kaufen und Reservierungen vornehmen");
  t = t.replace(/- Asking about schedules and routes/g, "- Nach Fahrplänen und Routen fragen");
  t = t.replace(/- At the airport and train station/g, "- Am Flughafen und Bahnhof");
  t = t.replace(/- Travel-related phrases/g, "- Reisebezogene Phrasen");
  t = t.replace(/- Vocabulary for emotions and feelings/g, "- Vokabeln für Emotionen und Gefühle");
  t = t.replace(/- How to express happiness, sadness, anger/g, "- Wie man Glück, Traurigkeit und Wut ausdrückt");
  t = t.replace(/- Reacting to news and situations/g, "- Auf Nachrichten und Situationen reagieren");
  t = t.replace(/- Emotional expressions and exclamations/g, "- Emotionale Ausdrücke und Ausrufe");
  t = t.replace(/- Empathy and sympathy phrases/g, "- Empathie- und Mitgefühlssätze");
  t = t.replace(/- How to shop for groceries in Serbian markets and supermarkets/g, "- Wie man Lebensmittel in serbischen Märkten und Supermärkten einkauft");
  t = t.replace(/- Essential food vocabulary \(fruits, vegetables, meat, dairy, bakery items\)/g, "- Wichtige Vokabeln für Lebensmittel (Obst, Gemüse, Fleisch, Milchprodukte, Backwaren)");
  t = t.replace(/- How to ask for quantities and understand prices/g, "- Wie man nach Mengen fragt und Preise versteht");
  t = t.replace(/- The verb "trebati" \(to need\) - a key verb for shopping/g, "- Das Verb \"trebati\" (brauchen) - ein Schlüsselverb fürs Einkaufen");
  t = t.replace(/- Polite shopping phrases and cultural etiquette/g, "- Höfliche Einkaufsphrasen und kulturelle Etikette");
  t = t.replace(/- How to form the past tense in Serbian \(prošlo vreme\)/g, "- Wie man die Vergangenheitsform im Serbischen bildet (prošlo vreme)");
  t = t.replace(/- Past tense endings for different genders/g, "- Vergangenheitsendungen für verschiedene Geschlechter");
  t = t.replace(/- Common past tense verbs/g, "- Häufige Verben in der Vergangenheitsform");
  t = t.replace(/- How to talk about what you did yesterday, last week, etc\./g, "- Wie man über das spricht, was man gestern, letzte Woche, etc. getan hat");
  t = t.replace(/- Time expressions for the past/g, "- Zeitausdrücke für die Vergangenheit");
  
  // More context sentences
  t = t.replace(/You're shopping for ingredients to make a Serbian salad \(šopska salata\)\./g, "Du kaufst Zutaten für einen serbischen Salat (šopska salata).");
  t = t.replace(/You need to buy ingredients for dinner - fresh vegetables for a Serbian salad, bread from the bakery, and some dairy products\./g, "Du musst Zutaten für das Abendessen kaufen - frisches Gemüse für einen serbischen Salat, Brot aus der Bäckerei und einige Milchprodukte.");
  
  // Additional phrases that might appear
  t = t.replace(/in Serbian/g, "auf Serbisch");
  t = t.replace(/in Serbian\./g, "auf Serbisch.");
  t = t.replace(/about a trip you want to take:/g, "über eine Reise, die du machen möchtest:");
  t = t.replace(/about how you felt today:/g, "darüber, wie du dich heute gefühlt hast:");
  t = t.replace(/about how you feel when you have a cold:/g, "darüber, wie du dich fühlst, wenn du erkältet bist:");
  
  // Fix remaining English phrases in lists (without dashes at start)
  t = t.replace(/^Body parts vocabulary$/gm, "Vokabeln für Körperteile");
  t = t.replace(/^Health and illness expressions$/gm, "Ausdrücke für Gesundheit und Krankheit");
  t = t.replace(/^How to describe symptoms$/gm, "Wie man Symptome beschreibt");
  t = t.replace(/^Visiting a doctor or pharmacy$/gm, "Einen Arzt oder eine Apotheke besuchen");
  t = t.replace(/^Common health-related phrases$/gm, "Häufige gesundheitsbezogene Phrasen");
  t = t.replace(/^Transportation vocabulary \(bus, train, plane\)$/gm, "Vokabeln für Verkehrsmittel (Bus, Zug, Flugzeug)");
  t = t.replace(/^Buying tickets and making reservations$/gm, "Fahrkarten kaufen und Reservierungen vornehmen");
  t = t.replace(/^Asking about schedules and routes$/gm, "Nach Fahrplänen und Routen fragen");
  t = t.replace(/^At the airport and train station$/gm, "Am Flughafen und Bahnhof");
  t = t.replace(/^Travel-related phrases$/gm, "Reisebezogene Phrasen");
  t = t.replace(/^Vocabulary for emotions and feelings$/gm, "Vokabeln für Emotionen und Gefühle");
  t = t.replace(/^How to express happiness, sadness, anger$/gm, "Wie man Glück, Traurigkeit und Wut ausdrückt");
  t = t.replace(/^Reacting to news and situations$/gm, "Auf Nachrichten und Situationen reagieren");
  t = t.replace(/^Emotional expressions and exclamations$/gm, "Emotionale Ausdrücke und Ausrufe");
  t = t.replace(/^Empathy and sympathy phrases$/gm, "Empathie- und Mitgefühlssätze");
  t = t.replace(/^How to shop for groceries in Serbian markets and supermarkets$/gm, "Wie man Lebensmittel in serbischen Märkten und Supermärkten einkauft");
  t = t.replace(/^Essential food vocabulary \(fruits, vegetables, meat, dairy, bakery items\)$/gm, "Wichtige Vokabeln für Lebensmittel (Obst, Gemüse, Fleisch, Milchprodukte, Backwaren)");
  t = t.replace(/^How to ask for quantities and understand prices$/gm, "Wie man nach Mengen fragt und Preise versteht");
  t = t.replace(/^The verb "trebati" \(to need\) - a key verb for shopping$/gm, "Das Verb \"trebati\" (brauchen) - ein Schlüsselverb fürs Einkaufen");
  t = t.replace(/^Polite shopping phrases and cultural etiquette$/gm, "Höfliche Einkaufsphrasen und kulturelle Etikette");
  t = t.replace(/^How to form the past tense in Serbian \(prošlo vreme\)$/gm, "Wie man die Vergangenheitsform im Serbischen bildet (prošlo vreme)");
  t = t.replace(/^Past tense endings for different genders$/gm, "Vergangenheitsendungen für verschiedene Geschlechter");
  t = t.replace(/^Common past tense verbs$/gm, "Häufige Verben in der Vergangenheitsform");
  t = t.replace(/^How to talk about what you did yesterday, last week, etc\.$/gm, "Wie man über das spricht, was man gestern, letzte Woche, etc. getan hat");
  t = t.replace(/^Time expressions for the past$/gm, "Zeitausdrücke für die Vergangenheit");
  
  // Bullet Points für "Was du lernen wirst:" - already handled above, but keep for completeness
  t = t.replace(/The verb "biti" \(to be\) - your first Serbian verb!/g, "Das Verb \"biti\" (sein) - dein erstes serbisches Verb!");
  
  // Kontext-Beschreibungen
  t = t.replace(/just landed in Belgrade\. You're at the airport, meeting someone for the first time\. This unit teaches you exactly what you need to navigate those first crucial conversations!/g, "gerade in Belgrad gelandet. Du bist am Flughafen und triffst jemanden zum ersten Mal. Diese Lektion lehrt dich genau das, was du brauchst, um diese ersten entscheidenden Gespräche zu meistern!");
  t = t.replace(/Practice the alphabet daily - Serbian pronunciation is very consistent!/g, "Übe das Alphabet täglich - die serbische Aussprache ist sehr konsistent!");
  // Fix mixed German/English pattern from screenshot - must come before individual word replacements
  t = t.replace(/Übung the alphabet daily - Serbian pronunciation is very consistent!/g, "Übe das Alphabet täglich - die serbische Aussprache ist sehr konsistent!");
  t = t.replace(/Übung the alphabet daily/g, "Übe das Alphabet täglich");
  t = t.replace(/Übung the alphabet/g, "Übe das Alphabet");
  t = t.replace(/the alphabet daily/g, "das Alphabet täglich");
  t = t.replace(/Serbian pronunciation is very consistent!/g, "Die serbische Aussprache ist sehr konsistent!");
  t = t.replace(/Serbian pronunciation is very consistent/g, "die serbische Aussprache ist sehr konsistent");
  t = t.replace(/pronunciation is very consistent/g, "Aussprache ist sehr konsistent");
  t = t.replace(/is very consistent!/g, "ist sehr konsistent!");
  t = t.replace(/is very consistent/g, "ist sehr konsistent");
  t = t.replace(/Repeat the greetings out loud/g, "Wiederhole die Begrüßungen laut");
  t = t.replace(/Don't worry about perfection - Serbians appreciate any effort to speak their language/g, "Mach dir keine Sorgen um Perfektion - Serben schätzen jede Anstrengung, ihre Sprache zu sprechen");
  
  // Grammatik-Überschriften
  t = t.replace(/## 1\. The Serbian Alphabet/g, "## 1. Das serbische Alphabet");
  t = t.replace(/1\. The Serbian Alphabet/g, "1. Das serbische Alphabet");
  t = t.replace(/The Serbian Alphabet/g, "Das serbische Alphabet");
  t = t.replace(/Serbian uses both Cyrillic and Latin alphabets\. In this course, we focus on the Latin alphabet, which has 30 letters\./g, "Serbisch verwendet sowohl das kyrillische als auch das lateinische Alphabet. In diesem Kurs konzentrieren wir uns auf das lateinische Alphabet, das 30 Buchstaben hat.");
  t = t.replace(/### Key Pronunciation Rules:/g, "### Wichtige Ausspracheregeln:");
  t = t.replace(/Key Pronunciation Rules:/g, "Wichtige Ausspracheregeln:");
  t = t.replace(/## 2\. Greetings and Basic Phrases/g, "## 2. Begrüßungen und grundlegende Phrasen");
  t = t.replace(/2\. Greetings and Basic Phrases/g, "2. Begrüßungen und grundlegende Phrasen");
  t = t.replace(/\*\*Important:\*\* Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word\./g, "**Wichtig:** Jeder Buchstabe hat EINEN Laut - keine Ausnahmen! Sobald du es lernst, kannst du JEDES serbische Wort lesen.");
  t = t.replace(/Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word\./g, "Jeder Buchstabe hat EINEN Laut - keine Ausnahmen! Sobald du es lernst, kannst du JEDES serbische Wort lesen.");
  
  // Section-Header für Past Tense (Lektion 11)
  t = t.replace(/## 1\. Past Tense Formation/g, "## 1. Bildung der Vergangenheitsform");
  t = t.replace(/1\. Past Tense Formation/g, "1. Bildung der Vergangenheitsform");
  t = t.replace(/## 2\. Past Tense Conjugation/g, "## 2. Konjugation der Vergangenheitsform");
  t = t.replace(/2\. Past Tense Conjugation/g, "2. Konjugation der Vergangenheitsform");
  t = t.replace(/## 3\. Common Past Tense Verbs/g, "## 3. Häufige Verben in der Vergangenheitsform");
  t = t.replace(/3\. Common Past Tense Verbs/g, "3. Häufige Verben in der Vergangenheitsform");
  t = t.replace(/## 4\. Time Expressions for Past/g, "## 4. Zeitausdrücke für die Vergangenheit");
  t = t.replace(/4\. Time Expressions for Past/g, "4. Zeitausdrücke für die Vergangenheit");
  t = t.replace(/## 5\. Negative Past Tense/g, "## 5. Negative Vergangenheitsform");
  t = t.replace(/5\. Negative Past Tense/g, "5. Negative Vergangenheitsform");
  t = t.replace(/## 6\. Questions in Past Tense/g, "## 6. Fragen in der Vergangenheitsform");
  t = t.replace(/6\. Questions in Past Tense/g, "6. Fragen in der Vergangenheitsform");
  t = t.replace(/## 7\. Example Sentences/g, "## 7. Beispielsätze");
  t = t.replace(/7\. Example Sentences/g, "7. Beispielsätze");
  
  // Weitere Section-Header
  t = t.replace(/## 1\. Present Tense Verbs - Group 1 \(-AM verbs\)/g, "## 1. Präsens-Verben - Gruppe 1 (-AM Verben)");
  t = t.replace(/## 2\. Present Tense Verbs - Group 2 \(-IM verbs\)/g, "## 2. Präsens-Verben - Gruppe 2 (-IM Verben)");
  t = t.replace(/## 3\. Media Vocabulary/g, "## 3. Medien-Vokabular");
  t = t.replace(/## 4\. The Locative Case \(Introduction\)/g, "## 4. Der Lokativ (Einführung)");
  t = t.replace(/## 5\. Daily Activities Vocabulary/g, "## 5. Vokabular für tägliche Aktivitäten");
  t = t.replace(/## 6\. Asking Complex Questions/g, "## 6. Komplexe Fragen stellen");
  t = t.replace(/## 1\. The Verb "ići" \(to go\)/g, "## 1. Das Verb \"ići\" (gehen)");
  t = t.replace(/## 2\. Asking for Directions/g, "## 2. Nach dem Weg fragen");
  t = t.replace(/## 3\. The Vocative Case/g, "## 3. Der Vokativ");
  t = t.replace(/## 4\. City Vocabulary/g, "## 4. Stadt-Vokabular");
  
  // Bullet Points - specific patterns that appear in lists
  t = t.replace(/- The Serbian Latin alphabet and pronunciation/g, "- Das serbische lateinische Alphabet und die Aussprache");
  t = t.replace(/The Serbian Latin alphabet and pronunciation/g, "Das serbische lateinische Alphabet und die Aussprache");
  t = t.replace(/- Basic greetings and polite phrases/g, "- Grundlegende Begrüßungen und höfliche Phrasen");
  t = t.replace(/Basic greetings and polite phrases/g, "Grundlegende Begrüßungen und höfliche Phrasen");
  t = t.replace(/- How to introduce yourself/g, "- Wie man sich vorstellt");
  t = t.replace(/How to introduce yourself/g, "Wie man sich vorstellt");
  t = t.replace(/- Understanding grammatical gender \(masculine, feminine, neuter\)/g, "- Grammatisches Geschlecht verstehen (männlich, weiblich, sächlich)");
  t = t.replace(/Understanding grammatical gender \(masculine, feminine, neuter\)/g, "Grammatisches Geschlecht verstehen (männlich, weiblich, sächlich)");
  t = t.replace(/- Simple yes\/no questions/g, "- Einfache Ja/Nein-Fragen");
  t = t.replace(/Simple yes\/no questions/g, "Einfache Ja/Nein-Fragen");
  
  // Context descriptions - fix incomplete translations
  t = t.replace(/just landed in Belgrade\./g, "gerade in Belgrad gelandet.");
  t = t.replace(/You're at the airport, meeting someone for the first time\. This unit teaches you exactly what you need to/g, "Du bist am Flughafen und triffst jemanden zum ersten Mal. Diese Lektion lehrt dich genau das, was du brauchst, um");
  t = t.replace(/navigate those first crucial conversations!/g, "diese ersten entscheidenden Gespräche zu meistern!");
  
  // Dialog-Überschriften und Szenarien (spezifische Patterns zuerst)
  t = t.replace(/## 📝 Dialogue 1: Meeting Someone at the Airport/g, "## 📝 Dialog 1: Jemanden am Flughafen treffen");
  t = t.replace(/## 📝 Dialogue 2: At the Information Desk/g, "## 📝 Dialog 2: Am Informationsschalter");
  t = t.replace(/Dialogue 1: Meeting Someone at the Airport/g, "Dialog 1: Jemanden am Flughafen treffen");
  t = t.replace(/Dialogue 2: At the Information Desk/g, "Dialog 2: Am Informationsschalter");
  t = t.replace(/\*\*Scenario:\*\* You've just arrived in Belgrade and meet your Serbian friend Marko\./g, "**Szenario:** Du bist gerade in Belgrad angekommen und triffst deinen serbischen Freund Marko.");
  t = t.replace(/You've just arrived in Belgrade and meet your Serbian friend Marko\./g, "Du bist gerade in Belgrad angekommen und triffst deinen serbischen Freund Marko.");
  
  // Dialog-Übersetzungen (spezifische Patterns mit Markdown zuerst, dann allgemeine)
  t = t.replace(/\*\*Marko:\*\* Good day!/g, "**Marko:** Guten Tag!");
  t = t.replace(/\*\*You:\*\* Good day!/g, "**You:** Guten Tag!");
  t = t.replace(/\*\*You:\*\* Good day! Are you Marko\?/g, "**You:** Guten Tag! Bist du Marko?");
  t = t.replace(/\*\*Marko:\*\* Yes, I am Marko\. What's your name\?/g, "**Marko:** Ja, ich bin Marko. Wie heißt du?");
  t = t.replace(/\*\*You:\*\* I am \[Your Name\]\. Nice to meet you\./g, "**You:** Ich bin [Dein Name]. Freut mich, dich kennenzulernen.");
  t = t.replace(/\*\*Marko:\*\* Nice to meet you\. Where are you from\?/g, "**Marko:** Freut mich, dich kennenzulernen. Woher kommst du?");
  t = t.replace(/\*\*You:\*\* I am from America\./g, "**You:** Ich komme aus Amerika.");
  t = t.replace(/\*\*Marko:\*\* Welcome to Serbia!/g, "**Marko:** Willkommen in Serbien!");
  t = t.replace(/\*\*You:\*\* Excuse me, where is the taxi\?/g, "**You:** Entschuldigung, wo ist das Taxi?");
  t = t.replace(/\*\*Employee:\*\* The taxi is outside, to the right\./g, "**Employee:** Das Taxi ist draußen, rechts.");
  t = t.replace(/\*\*You:\*\* Thank you\./g, "**You:** Danke.");
  t = t.replace(/\*\*Employee:\*\* You're welcome\./g, "**Employee:** Bitte schön.");
  
  // Allgemeine Dialog-Übersetzungen (ohne Markdown-Formatierung)
  t = t.replace(/Good day! Are you Marko\?/g, "Guten Tag! Bist du Marko?");
  t = t.replace(/Good day!/g, "Guten Tag!");
  t = t.replace(/Are you Marko\?/g, "Bist du Marko?");
  t = t.replace(/Yes, I am Marko\. What's your name\?/g, "Ja, ich bin Marko. Wie heißt du?");
  t = t.replace(/What's your name\?/g, "Wie heißt du?");
  t = t.replace(/I am \[Your Name\]\. Nice to meet you\./g, "Ich bin [Dein Name]. Freut mich, dich kennenzulernen.");
  t = t.replace(/Nice to meet you\. Where are you from\?/g, "Freut mich, dich kennenzulernen. Woher kommst du?");
  t = t.replace(/Nice to meet you\./g, "Freut mich, dich kennenzulernen.");
  t = t.replace(/Where are you from\?/g, "Woher kommst du?");
  t = t.replace(/I am from America\./g, "Ich komme aus Amerika.");
  t = t.replace(/Welcome to Serbia!/g, "Willkommen in Serbien!");
  t = t.replace(/Excuse me, where is the taxi\?/g, "Entschuldigung, wo ist das Taxi?");
  t = t.replace(/The taxi is outside, to the right\./g, "Das Taxi ist draußen, rechts.");
  t = t.replace(/Thank you\./g, "Danke.");
  t = t.replace(/You're welcome\./g, "Bitte schön.");
  
  // Grammar section headers and phrases
  t = t.replace(/This is THE most important verb in Serbian\./g, "Das ist DAS wichtigste Verb im Serbischen.");
  t = t.replace(/Do learn it and use it regularly\./g, "Lerne es und verwende es regelmäßig.");
  t = t.replace(/You'll use it constantly!/g, "Du wirst es ständig verwenden!");
  t = t.replace(/Full Conjugation:/g, "Vollständige Konjugation:");
  t = t.replace(/Examples in Context:/g, "Beispiele im Kontext:");
  t = t.replace(/Comparison to English:/g, "Vergleich mit Englisch:");
  t = t.replace(/Why does this matter\?/g, "Warum ist das wichtig?");
  t = t.replace(/Practice Tip:/g, "Übungstipp:");
  t = t.replace(/Popular genres:/g, "Beliebte Genres:");
  t = t.replace(/Useful phrase:/g, "Nützliche Phrase:");
  t = t.replace(/Positive:/g, "Positiv:");
  t = t.replace(/Negative:/g, "Negativ:");
  t = t.replace(/Questions:/g, "Fragen:");
  
  // Section headers that appear in grammar explanations
  t = t.replace(/Essential Greetings:/g, "Wichtige Begrüßungen:");
  t = t.replace(/Polite Phrases:/g, "Höfliche Phrasen:");
  t = t.replace(/The Verb "biti" \(to be\)/g, "Das Verb \"biti\" (sein)");
  t = t.replace(/Simple Questions with "Da li"/g, "Einfache Fragen mit \"Da li\"");
  t = t.replace(/To form a yes\/no question in Serbian, use "Da li" at the beginning\./g, "Um eine Ja/Nein-Frage im Serbischen zu bilden, verwende \"Da li\" am Anfang.");
  t = t.replace(/Asking "Where are you from\?"/g, "Fragen \"Woher kommst du?\"");
  t = t.replace(/Asking "Woher kommst du\?"/g, "Fragen \"Woher kommst du?\"");
  t = t.replace(/5\. Asking "Woher kommst du\?"/g, "5. Fragen \"Woher kommst du?\"");
  t = t.replace(/Gender of Nouns & Introduction to Cases \(very basic for now\)/g, "Geschlecht der Substantive & Einführung in die Fälle (sehr grundlegend für jetzt)");
  t = t.replace(/In Serbian, all nouns have a gender: masculine, feminine, or neuter\. This affects how words change\./g, "Im Serbischen haben alle Substantive ein Geschlecht: männlich, weiblich oder sächlich. Dies beeinflusst, wie sich Wörter ändern.");
  t = t.replace(/Im Serbischen, all nouns have a gender: \*\*masculine\*\*, \*\*feminine\*\*, or \*\*neuter\*\*\. This affects how words change\./g, "Im Serbischen haben alle Substantive ein Geschlecht: **männlich**, **weiblich** oder **sächlich**. Dies beeinflusst, wie sich Wörter ändern.");
  t = t.replace(/How to Recognize Gender:/g, "Wie man das Geschlecht erkennt:");
  t = t.replace(/Possessives: "my" and "your"/g, "Possessivpronomen: \"mein\" und \"dein\"");
  t = t.replace(/When not explicitly in the \[Serbian dialogue\] alone, we would use them too\./g, "Wenn sie nicht explizit im [serbischen Dialog] allein sind, würden wir sie auch verwenden.");
  t = t.replace(/The ending of "moj\/moja\/moje" changes depending on the word's gender and declension rule\.\.\./g, "Die Endung von \"moj/moja/moje\" ändert sich je nach Geschlecht und Deklinationsregel des Wortes...");
  
  // Fix mixed German/English in explanations
  t = t.replace(/Im Serbischen, words change their endings depending on their role in the sentence\. This is called "cases"\. For example, "Srbija" \(Serbia\) becomes "iz Srbije" \(from Serbia\)\. Don't worry about the rules yet - we'll introduce them gently!/g, "Im Serbischen ändern Wörter ihre Endungen je nach ihrer Rolle im Satz. Dies wird \"Fälle\" genannt. Zum Beispiel wird \"Srbija\" (Serbien) zu \"iz Srbije\" (aus Serbien). Mach dir noch keine Sorgen um die Regeln - wir werden sie sanft einführen!");
  t = t.replace(/words change their endings depending on their role in the sentence\. This is called "cases"\./g, "ändern Wörter ihre Endungen je nach ihrer Rolle im Satz. Dies wird \"Fälle\" genannt.");
  t = t.replace(/Don't worry about the rules yet - we'll introduce them gently!/g, "Mach dir noch keine Sorgen um die Regeln - wir werden sie sanft einführen!");
  t = t.replace(/\(Serbia\)/g, "(Serbien)");
  t = t.replace(/\(from Serbia\)/g, "(aus Serbien)");
  
  // Montenegrin note section
  t = t.replace(/ME: Montenegrin Language Note/g, "ME: Montenegrinischer Sprachhinweis");
  t = t.replace(/If you're learning Serbian to use in Montenegro, you'll be happy to know that Serbian and Montenegrin are mutually intelligible and share approximately 95% of their vocabulary and grammar\. The differences are minimal, and you'll be understood perfectly using what you learn in this course\./g, "Wenn du Serbisch lernst, um es in Montenegro zu verwenden, wirst du dich freuen zu erfahren, dass Serbisch und Montenegrinisch gegenseitig verständlich sind und etwa 95% ihres Vokabulars und ihrer Grammatik teilen. Die Unterschiede sind minimal, und du wirst perfekt verstanden, wenn du das verwendest, was du in diesem Kurs lernst.");
  t = t.replace(/Key Differences:/g, "Wichtige Unterschiede:");
  t = t.replace(/Alphabet:/g, "Alphabet:");
  t = t.replace(/Montenegrin has two additional letters, but are not universally used by all Montenegrins\. Many people still write 'š' and 'ž' using the traditional Serbian spelling, both for form and understood and accepted\./g, "Montenegrinisch hat zwei zusätzliche Buchstaben, die aber nicht von allen Montenegrinern universell verwendet werden. Viele Menschen schreiben 'š' und 'ž' immer noch mit der traditionellen serbischen Schreibweise, sowohl für die Form als auch verstanden und akzeptiert.");
  t = t.replace(/Pronunciation:/g, "Aussprache:");
  t = t.replace(/Instead of 'djelo' in casual speech\./g, "Statt 'djelo' in der Umgangssprache.");
  t = t.replace(/word order and constructions\./g, "Wortstellung und Konstruktionen.");
  t = t.replace(/The vast majority of words and exactly declension same\./g, "Die überwiegende Mehrheit der Wörter und genau dieselbe Deklination.");
  t = t.replace(/For This Course:/g, "Für diesen Kurs:");
  t = t.replace(/This course teaches standard Serbian, which is fully understood and used throughout Montenegro\. The grammar, vocabulary, and expressions you learn here will allow you to perfectly understand people in Belgrade, Podgorica, or anywhere else in the Serbian region\./g, "Dieser Kurs lehrt Standard-Serbisch, das in ganz Montenegro vollständig verstanden und verwendet wird. Die Grammatik, das Vokabular und die Ausdrücke, die du hier lernst, ermöglichen es dir, Menschen in Belgrad, Podgorica oder überall sonst in der serbischen Region perfekt zu verstehen.");
  t = t.replace(/If you want to learn Serbian letters, 5 or 2 in Montenegro, simply remember they are pronounced like 's' and 'z' and you will be learning in this course\./g, "Wenn du serbische Buchstaben lernen möchtest, 5 oder 2 in Montenegro, denke einfach daran, dass sie wie 's' und 'z' ausgesprochen werden und du wirst sie in diesem Kurs lernen.");
  
  // Common explanations and phrases
  t = t.replace(/most common greeting/g, "häufigste Begrüßung");
  t = t.replace(/most common/g, "häufigste");
  t = t.replace(/informal/g, "informell");
  t = t.replace(/very informal/g, "sehr informell");
  t = t.replace(/Literally:/g, "Wörtlich:");
  t = t.replace(/\(Literally: "It's pleasant to me"\)/g, "(Wörtlich: \"Es ist mir angenehm\")");
  t = t.replace(/lit: it is dear to me/g, "wörtl.: es ist mir lieb");
  t = t.replace(/Please \/ You're welcome\./g, "Bitte / Bitte schön.");
  t = t.replace(/Excuse me \/ Sorry\./g, "Entschuldigung / Entschuldigung.");
  t = t.replace(/Thank you/g, "Danke");
  t = t.replace(/Good day!/g, "Guten Tag!");
  t = t.replace(/Good morning/g, "Guten Morgen");
  t = t.replace(/Good evening/g, "Guten Abend");
  t = t.replace(/Hi!/g, "Hallo!");
  t = t.replace(/Hi\/Bye!/g, "Hallo/Tschüss!");
  t = t.replace(/Nice to meet you\./g, "Freut mich, dich kennenzulernen.");
  
  // Verb explanations - fix English explanations in German context
  t = t.replace(/"Sam" is like "am" in English - it's the "I" form of "to be"/g, "\"Sam\" ist wie \"am\" im Englischen - es ist die \"Ich\"-Form von \"sein\"");
  t = t.replace(/"Si" is used when talking to one person you know well \(informal\)/g, "\"Si\" wird verwendet, wenn du mit einer Person sprichst, die du gut kennst (informell)");
  t = t.replace(/"Je" is like "is" - used for he, she, or it/g, "\"Je\" ist wie \"ist\" - verwendet für er, sie oder es");
  t = t.replace(/Use "vi\/ste" when talking to someone you don't know well, or someone older\/in authority/g, "Verwende \"vi/ste\", wenn du mit jemandem sprichst, den du nicht gut kennst, oder jemandem, der älter ist/in Autorität steht");
  t = t.replace(/'Sam' ist 'am' in big letters - its the diminutive form of 'to be'\./g, "'Sam' ist 'am' in Großbuchstaben - es ist die Diminutivform von 'sein'.");
  t = t.replace(/'Si' ist 'am' in big letters - its the diminutive form of 'to be'\./g, "'Si' ist 'am' in Großbuchstaben - es ist die Diminutivform von 'sein'.");
  t = t.replace(/'Je' ist 'is' in 'he' and 'for he, she, or it'\./g, "'Je' ist 'ist' für 'er' und 'für er, sie oder es'.");
  t = t.replace(/'Smo' ist 'are' for 'we'\./g, "'Smo' ist 'sind' für 'wir'.");
  t = t.replace(/'Ste' ist 'are' when you talk to more than one person you know well\./g, "'Ste' ist 'sind', wenn du mit mehr als einer Person sprichst, die du gut kennst.");
  t = t.replace(/'Su' ist 'are' for 'they'\./g, "'Su' ist 'sind' für 'sie'.");
  t = t.replace(/'Nisam' = 'not am' = not to be/g, "'Nisam' = 'nicht bin' = nicht sein");
  t = t.replace(/"Nisam" = "ne" \+ "sam" = not am/g, "\"Nisam\" = \"ne\" + \"sam\" = nicht bin");
  
  // Gender explanations
  t = t.replace(/if the \(masculine\) noun ends in a consonant/g, "wenn das (männliche) Substantiv auf einen Konsonanten endet");
  t = t.replace(/if the \(feminine\) noun ends in -a/g, "wenn das (weibliche) Substantiv auf -a endet");
  t = t.replace(/if the \(neuter\) noun ends in -e/g, "wenn das (sächliche) Substantiv auf -e endet");
  t = t.replace(/Masculine nouns end in consonants, feminine in -a, neuter in -e\./g, "Männliche Substantive enden auf Konsonanten, weibliche auf -a, sächliche auf -e.");
  
  // Gender terms in tables
  t = t.replace(/\| \*\*Masculine\*\* \|/g, "| **Männlich** |");
  t = t.replace(/\| \*\*Feminine\*\* \|/g, "| **Weiblich** |");
  t = t.replace(/\| \*\*Neuter\*\* \|/g, "| **Sächlich** |");
  t = t.replace(/\| Masculine \|/g, "| Männlich |");
  t = t.replace(/\| Feminine \|/g, "| Weiblich |");
  t = t.replace(/\| Neuter \|/g, "| Sächlich |");
  
  // Table content - translations in parentheses
  t = t.replace(/\(airport\), \(student\)/g, "(Flughafen), (Student)");
  t = t.replace(/\(ticket\), \(Ana\)/g, "(Ticket), (Ana)");
  t = t.replace(/\(name\)/g, "(Name)");
  t = t.replace(/\(sea\)/g, "(Meer)");
  t = t.replace(/\(center\)/g, "(Zentrum)");
  t = t.replace(/\(tea\)/g, "(Tee)");
  t = t.replace(/\(hi\)/g, "(Hallo)");
  t = t.replace(/\(jam\)/g, "(Marmelade)");
  t = t.replace(/\(pupil\)/g, "(Schüler)");
  t = t.replace(/\(I\)/g, "(Ich)");
  t = t.replace(/\(what\)/g, "(was)");
  t = t.replace(/\(life\)/g, "(Leben)");
  
  // "consonant" in tables
  t = t.replace(/\| consonant \|/g, "| Konsonant |");
  t = t.replace(/consonant/g, "Konsonant");
  
  // Key takeaways
  t = t.replace(/Serbian pronunciation is consistent - one letter, one sound/g, "Die serbische Aussprache ist konsistent - ein Buchstabe, ein Laut");
  t = t.replace(/'Da' \(to be\) is essential! Learn 'ja', 'si', 'on\/ona\/ono je', 'mi smo', 'vi ste', 'oni\/one\/ona su'\./g, "'Biti' (sein) ist wichtig! Lerne 'ja sam', 'ti si', 'on/ona/ono je', 'mi smo', 'vi ste', 'oni/one/ona su'.");
  t = t.replace(/'Da li' is used to form yes\/no questions/g, "'Da li' wird verwendet, um Ja/Nein-Fragen zu bilden");
  t = t.replace(/'Otkle ste' - 'Where are you from\?'/g, "'Odakle ste' - 'Woher kommst du?'");
  t = t.replace(/'Drago mi je' - 'Nice to meet you'/g, "'Drago mi je' - 'Freut mich, dich kennenzulernen'");
  t = t.replace(/Try introducing yourself in Serbian: "Zdravo", "I am \[your name\]", "I come from \[your country\]\. Drago mi je!"/g, "Versuche, dich auf Serbisch vorzustellen: \"Zdravo\", \"Ja sam [dein Name]\", \"Ja komme aus [deinem Land]. Drago mi je!\"");
  
  // More grammar explanations from Unit 1
  t = t.replace(/Serbian uses both Cyrillic and Latin alphabets\. In this course, we focus on the Latin alphabet, which has 30 letters\./g, "Serbisch verwendet sowohl das kyrillische als auch das lateinische Alphabet. In diesem Kurs konzentrieren wir uns auf das lateinische Alphabet, das 30 Buchstaben hat.");
  t = t.replace(/Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word\./g, "Jeder Buchstabe hat EINEN Laut - keine Ausnahmen! Sobald du es lernst, kannst du JEDES serbische Wort lesen.");
  t = t.replace(/In English we say "I am, you are, he is"\. In Serbian it's "ja sam, ti si, on je"\. The words change just like in English!/g, "Auf Englisch sagen wir \"I am, you are, he is\". Auf Serbisch ist es \"ja sam, ti si, on je\". Die Wörter ändern sich genauso wie im Englischen!");
  t = t.replace(/In Serbian, words change their endings depending on their role in the sentence\. This is called "cases"\. For example, "Srbija" \(Serbia\) becomes "iz Srbije" \(from Serbia\)\. Don't worry about the rules yet - we'll introduce them gently!/g, "Im Serbischen ändern sich die Endungen der Wörter je nach ihrer Rolle im Satz. Das nennt man \"Fälle\". Zum Beispiel wird \"Srbija\" (Serbien) zu \"iz Srbije\" (aus Serbien). Mach dir noch keine Sorgen um die Regeln - wir werden sie sanft einführen!");
  t = t.replace(/While not explicitly in the dialogue above, we would use them like:/g, "Während sie nicht explizit im obigen Dialog sind, würden wir sie so verwenden:");
  t = t.replace(/The ending of "moj\/moja\/moje" changes depending on the gender of the noun it describes\./g, "Die Endung von \"moj/moja/moje\" ändert sich je nach Geschlecht des Substantivs, das es beschreibt.");
  t = t.replace(/Similarly:/g, "Ähnlich:");
  
  // Table content translations
  t = t.replace(/like 'cats'/g, "wie 'cats'");
  t = t.replace(/like 'church'/g, "wie 'church'");
  t = t.replace(/like 'nature'/g, "wie 'nature'");
  t = t.replace(/like 'judge'/g, "wie 'judge'");
  t = t.replace(/like 'yes'/g, "wie 'yes'");
  t = t.replace(/like 'ship'/g, "wie 'ship'");
  t = t.replace(/like 'pleasure'/g, "wie 'pleasure'");
  
  // Table content in parentheses (from Unit 1) - must come before general patterns
  t = t.replace(/\(airport\), \(student\)/g, "(Flughafen), (Student)");
  t = t.replace(/\(ticket\), \(Ana\)/g, "(Ticket), (Ana)");
  t = t.replace(/\(name\)/g, "(Name)");
  t = t.replace(/\(sea\)/g, "(Meer)");
  t = t.replace(/\(center\)/g, "(Zentrum)");
  t = t.replace(/\(airport\)/g, "(Flughafen)");
  t = t.replace(/\(student\)/g, "(Student)");
  t = t.replace(/\(ticket\)/g, "(Ticket)");
  t = t.replace(/\(tea\)/g, "(Tee)");
  t = t.replace(/\(bag\)/g, "(Tasche)");
  t = t.replace(/\(jam\)/g, "(Marmelade)");
  t = t.replace(/\(pupil\)/g, "(Schüler)");
  t = t.replace(/\(I\)/g, "(Ich)");
  t = t.replace(/\(what\)/g, "(was)");
  t = t.replace(/\(life\)/g, "(Leben)");
  t = t.replace(/\(airport\)/g, "(Flughafen)");
  t = t.replace(/\(student\)/g, "(Student)");
  t = t.replace(/\(ticket\)/g, "(Ticket)");
  t = t.replace(/\(name\)/g, "(Name)");
  t = t.replace(/\(sea\)/g, "(Meer)");
  
  // More specific phrases
  t = t.replace(/I am a student\./g, "Ich bin ein Student.");
  t = t.replace(/You are a tourist\./g, "Du bist ein Tourist.");
  t = t.replace(/He is a pilot\./g, "Er ist ein Pilot.");
  t = t.replace(/We are from Serbia\./g, "Wir kommen aus Serbien.");
  t = t.replace(/You are a professor \(formal\)\./g, "Du bist ein Professor (formell).");
  t = t.replace(/They are students\./g, "Sie sind Studenten.");
  t = t.replace(/Are you Marko\?/g, "Bist du Marko?");
  t = t.replace(/Is she Marija\?/g, "Ist sie Marija?");
  t = t.replace(/Are you tourists\?/g, "Seid ihr Touristen?");
  t = t.replace(/Are you\.\.\.\?/g, "Bist du...?");
  t = t.replace(/Are you a tourist\?/g, "Bist du ein Tourist?");
  t = t.replace(/Yes, I am\./g, "Ja, ich bin.");
  t = t.replace(/No, I'm not\./g, "Nein, ich bin nicht.");
  t = t.replace(/I come from America\./g, "Ich komme aus Amerika.");
  t = t.replace(/I come from Serbia\./g, "Ich komme aus Serbien.");
  t = t.replace(/I come from Germany\./g, "Ich komme aus Deutschland.");
  t = t.replace(/I am from America\./g, "Ich komme aus Amerika.");
  t = t.replace(/I am from Serbia\./g, "Ich komme aus Serbien.");
  t = t.replace(/I am from Germany\./g, "Ich komme aus Deutschland.");
  // Fix in example translations
  t = t.replace(/Ja sam iz Amerike\. - I am from America\./g, "Ja sam iz Amerike. - Ich komme aus Amerika.");
  t = t.replace(/Ja sam iz Srbije\. - I am from Serbia\./g, "Ja sam iz Srbije. - Ich komme aus Serbien.");
  t = t.replace(/Ja sam iz Nemačke\. - I am from Germany\./g, "Ja sam iz Nemačke. - Ich komme aus Deutschland.");
  t = t.replace(/Where is my passport\?/g, "Wo ist mein Pass?");
  t = t.replace(/This is your ticket\./g, "Das ist dein Ticket.");
  
  // Dialogue translations from Unit 1
  t = t.replace(/\*\*Marko:\*\* Good day!/g, "**Marko:** Guten Tag!");
  t = t.replace(/\*\*You:\*\* Good day! Are you Marko\?/g, "**You:** Guten Tag! Bist du Marko?");
  t = t.replace(/\*\*Marko:\*\* Yes, I am Marko\. What's your name\?/g, "**Marko:** Ja, ich bin Marko. Wie heißt du?");
  t = t.replace(/\*\*You:\*\* I am \[Your Name\]\. Nice to meet you\./g, "**You:** Ich bin [Dein Name]. Freut mich, dich kennenzulernen.");
  t = t.replace(/\*\*Marko:\*\* Nice to meet you\. Where are you from\?/g, "**Marko:** Freut mich, dich kennenzulernen. Woher kommst du?");
  t = t.replace(/\*\*You:\*\* I am from America\./g, "**You:** Ich komme aus Amerika.");
  t = t.replace(/\*\*Marko:\*\* Welcome to Serbia!/g, "**Marko:** Willkommen in Serbien!");
  t = t.replace(/\*\*You:\*\* Excuse me, where is the taxi\?/g, "**You:** Entschuldigung, wo ist das Taxi?");
  t = t.replace(/\*\*Employee:\*\* The taxi is outside, to the right\./g, "**Employee:** Das Taxi ist draußen, rechts.");
  t = t.replace(/\*\*You:\*\* Thank you\./g, "**You:** Danke.");
  t = t.replace(/\*\*Employee:\*\* You're welcome\./g, "**Employee:** Bitte schön.");
  
  // Exercise instructions and answers
  t = t.replace(/Complete the sentences with the correct form of "biti":/g, "Vervollständige die Sätze mit der richtigen Form von \"biti\":");
  t = t.replace(/\(I am a student\)/g, "(Ich bin ein Student)");
  t = t.replace(/\(You are a tourist\)/g, "(Du bist ein Tourist)");
  t = t.replace(/\(He is a pilot\)/g, "(Er ist ein Pilot)");
  t = t.replace(/\(We are from Serbia\)/g, "(Wir kommen aus Serbien)");
  t = t.replace(/\(You are a professor\)/g, "(Du bist ein Professor)");
  t = t.replace(/\(They are students\)/g, "(Sie sind Studenten)");
  t = t.replace(/Identify the gender of these nouns:/g, "Bestimme das Geschlecht dieser Substantive:");
  t = t.replace(/\(airport\), \(student\)/g, "(Flughafen), (Student)");
  t = t.replace(/\(ticket\), \(Ana\)/g, "(Ticket), (Ana)");
  t = t.replace(/\(name\)/g, "(Name)");
  t = t.replace(/\(sea\)/g, "(Meer)");
  t = t.replace(/\(ends in consonant\)/g, "(endet auf Konsonant)");
  t = t.replace(/\(ends in -a\)/g, "(endet auf -a)");
  t = t.replace(/\(ends in -e\)/g, "(endet auf -e)");
  t = t.replace(/Masculine \(ends in consonant\)/g, "Männlich (endet auf Konsonant)");
  t = t.replace(/Feminine \(ends in -a\)/g, "Weiblich (endet auf -a)");
  t = t.replace(/Neuter \(ends in -e\)/g, "Sächlich (endet auf -e)");
  
  // Past tense translations in tables (specific patterns first)
  t = t.replace(/I worked \(m\/f\)/g, "Ich arbeitete (m/w)");
  t = t.replace(/You worked \(sgl\)/g, "Du arbeitetest");
  t = t.replace(/You worked \(pl\)/g, "Ihr arbeitetet");
  t = t.replace(/They worked \(m\)/g, "Sie arbeiteten (m)");
  t = t.replace(/They worked \(f\)/g, "Sie arbeiteten (w)");
  t = t.replace(/\*\*I worked \(m\/f\)\*\*/g, "**Ich arbeitete (m/w)**");
  t = t.replace(/\*\*You worked\*\*/g, "**Du arbeitetest**");
  t = t.replace(/\*\*He worked\*\*/g, "**Er arbeitete**");
  t = t.replace(/\*\*She worked\*\*/g, "**Sie arbeitete**");
  t = t.replace(/\*\*It worked\*\*/g, "**Es arbeitete**");
  t = t.replace(/\*\*We worked\*\*/g, "**Wir arbeiteten**");
  t = t.replace(/\*\*They worked \(m\)\*\*/g, "**Sie arbeiteten (m)**");
  t = t.replace(/\*\*They worked \(f\)\*\*/g, "**Sie arbeiteten (w)**");
  t = t.replace(/I worked/g, "Ich arbeitete");
  t = t.replace(/You worked/g, "Du arbeitetest");
  t = t.replace(/He worked/g, "Er arbeitete");
  t = t.replace(/She worked/g, "Sie arbeitete");
  t = t.replace(/It worked/g, "Es arbeitete");
  t = t.replace(/We worked/g, "Wir arbeiteten");
  t = t.replace(/They worked/g, "Sie arbeiteten");
  
  // Past tense verb forms in tables (be careful with order - specific first)
  t = t.replace(/was\/been/g, "war/gewesen");
  t = t.replace(/\| was\/been \|/g, "| war/gewesen |");
  t = t.replace(/\| had \|/g, "| hatte |");
  t = t.replace(/\| worked \|/g, "| arbeitete |");
  t = t.replace(/\| spoke \|/g, "| sprach |");
  t = t.replace(/\| learned \|/g, "| lernte |");
  t = t.replace(/\| ate \|/g, "| aß |");
  t = t.replace(/\| drank \|/g, "| trank |");
  t = t.replace(/\| went \|/g, "| ging |");
  t = t.replace(/\| came \|/g, "| kam |");
  t = t.replace(/\| saw \|/g, "| sah |");
  // Only translate standalone words in table context, not in sentences
  t = t.replace(/^was\/been$/gm, "war/gewesen");
  t = t.replace(/^had$/gm, "hatte");
  // Don't translate "worked", "spoke", etc. as standalone words - they might be in sentences
  // Only translate them in specific contexts above
  
  // Time expressions for past (in table context)
  t = t.replace(/\| yesterday \|/g, "| gestern |");
  t = t.replace(/\| the day before yesterday \|/g, "| vorgestern |");
  t = t.replace(/\| last week \|/g, "| letzte Woche |");
  t = t.replace(/\| last month \|/g, "| letzten Monat |");
  t = t.replace(/\| last year \|/g, "| letztes Jahr |");
  t = t.replace(/\| three days ago \|/g, "| vor drei Tagen |");
  t = t.replace(/\| earlier \|/g, "| früher |");
  t = t.replace(/\| then \|/g, "| dann |");
  t = t.replace(/\| before \|/g, "| vorher |");
  // Standalone time expressions
  t = t.replace(/^yesterday$/gm, "gestern");
  t = t.replace(/^the day before yesterday$/gm, "vorgestern");
  t = t.replace(/^three days ago$/gm, "vor drei Tagen");
  t = t.replace(/^earlier$/gm, "früher");
  t = t.replace(/^then$/gm, "dann");
  t = t.replace(/^before$/gm, "vorher");
  
  // Negative past tense in tables
  t = t.replace(/\*\*Nisam radio\*\* \(I didn't work\)/g, "**Nisam radio** (Ich arbeitete nicht)");
  t = t.replace(/\*\*Nisi došao\*\* \(You didn't come\)/g, "**Nisi došao** (Du kamst nicht)");
  t = t.replace(/\*\*Nije bio\*\* \(He wasn't\)/g, "**Nije bio** (Er war nicht)");
  t = t.replace(/\*\*Nismo jeli\*\* \(We didn't eat\)/g, "**Nismo jeli** (Wir aßen nicht)");
  t = t.replace(/\*\*Niste videli\*\* \(You didn't see\)/g, "**Niste videli** (Ihr saht nicht)");
  t = t.replace(/\*\*Nisu išli\*\* \(They didn't go\)/g, "**Nisu išli** (Sie gingen nicht)");
  t = t.replace(/\(I didn't work\)/g, "(Ich arbeitete nicht)");
  t = t.replace(/\(You didn't come\)/g, "(Du kamst nicht)");
  t = t.replace(/\(He wasn't\)/g, "(Er war nicht)");
  t = t.replace(/\(We didn't eat\)/g, "(Wir aßen nicht)");
  t = t.replace(/\(You didn't see\)/g, "(Ihr saht nicht)");
  t = t.replace(/\(They didn't go\)/g, "(Sie gingen nicht)");
  t = t.replace(/I didn't work/g, "Ich arbeitete nicht");
  t = t.replace(/You didn't come/g, "Du kamst nicht");
  t = t.replace(/He wasn't/g, "Er war nicht");
  t = t.replace(/We didn't eat/g, "Wir aßen nicht");
  t = t.replace(/You didn't see/g, "Ihr saht nicht");
  t = t.replace(/They didn't go/g, "Sie gingen nicht");
  
  // Questions in past tense (with Serbian examples)
  t = t.replace(/\*\*Da li si bio u školi\?\*\* \(Were you at school\?\)/g, "**Da li si bio u školi?** (Warst du in der Schule?)");
  t = t.replace(/\*\*Šta si radio juče\?\*\* \(What did you do yesterday\?\)/g, "**Šta si radio juče?** (Was hast du gestern getan?)");
  t = t.replace(/\*\*Kada si došao\?\*\* \(When did you come\?\)/g, "**Kada si došao?** (Wann bist du gekommen?)");
  t = t.replace(/\*\*Gde si bio\?\*\* \(Where were you\?\)/g, "**Gde si bio?** (Wo warst du?)");
  t = t.replace(/Were you at school\?/g, "Warst du in der Schule?");
  t = t.replace(/What did you do yesterday\?/g, "Was hast du gestern getan?");
  t = t.replace(/When did you come\?/g, "Wann bist du gekommen?");
  t = t.replace(/Where were you\?/g, "Wo warst du?");
  
  // Example sentences in past tense (with Serbian examples)
  t = t.replace(/\*\*Juče sam gledao film\.\*\* \(Yesterday I watched a movie\)/g, "**Juče sam gledao film.** (Gestern schaute ich einen Film)");
  t = t.replace(/\*\*Ona je kupila hleb\.\*\* \(She bought bread\)/g, "**Ona je kupila hleb.** (Sie kaufte Brot)");
  t = t.replace(/\*\*Mi smo bili u restoranu\.\*\* \(We were at a restaurant\)/g, "**Mi smo bili u restoranu.** (Wir waren in einem Restaurant)");
  t = t.replace(/\*\*Nisam video Marka\.\*\* \(I didn't see Marko\)/g, "**Nisam video Marka.** (Ich sah Marko nicht)");
  t = t.replace(/\*\*Ona nije došla na posao\.\*\* \(She didn't come to work\)/g, "**Ona nije došla na posao.** (Sie kam nicht zur Arbeit)");
  t = t.replace(/\*\*Nismo imali vremena\.\*\* \(We didn't have time\)/g, "**Nismo imali vremena.** (Wir hatten keine Zeit)");
  t = t.replace(/\*\*Da li si učio srpski\?\*\* \(Did you study Serbian\?\)/g, "**Da li si učio srpski?** (Hast du Serbisch gelernt?)");
  t = t.replace(/\*\*Šta ste radili\?\*\* \(What did you do\?\)/g, "**Šta ste radili?** (Was hast du getan?)");
  t = t.replace(/\*\*Kada si stigao\?\*\* \(When did you arrive\?\)/g, "**Kada si stigao?** (Wann bist du angekommen?)");
  t = t.replace(/Yesterday I watched a movie/g, "Gestern schaute ich einen Film");
  t = t.replace(/She bought bread/g, "Sie kaufte Brot");
  t = t.replace(/We were at a restaurant/g, "Wir waren in einem Restaurant");
  t = t.replace(/I didn't see Marko/g, "Ich sah Marko nicht");
  t = t.replace(/She didn't come to work/g, "Sie kam nicht zur Arbeit");
  t = t.replace(/We didn't have time/g, "Wir hatten keine Zeit");
  t = t.replace(/Did you study Serbian\?/g, "Hast du Serbisch gelernt?");
  t = t.replace(/What did you do\?/g, "Was hast du getan?");
  t = t.replace(/When did you arrive\?/g, "Wann bist du angekommen?");
  
  // Fix mixed German/English sentences (specific patterns first)
  t = t.replace(/I war in Belgrade/g, "Ich war in Belgrad");
  t = t.replace(/I war in Belgrade - masculine/g, "Ich war in Belgrad - männlich");
  t = t.replace(/What tat you tun gestern\?/g, "Was hast du gestern getan?");
  t = t.replace(/When tat you come\?/g, "Wann bist du gekommen?");
  t = t.replace(/Where waren you\?/g, "Wo warst du?");
  t = t.replace(/We didn't haben time/g, "Wir hatten keine Zeit");
  t = t.replace(/We waren at a restaurant/g, "Wir waren in einem Restaurant");
  t = t.replace(/ist identical auf Serbisch and Montenegrinisch/g, "ist identisch im Serbischen und Montenegrinischen");
  t = t.replace(/Past tense formation ist identical auf Serbisch and Montenegrinisch/g, "Die Bildung der Vergangenheitsform ist identisch im Serbischen und Montenegrinischen");
  t = t.replace(/Past tense formation is identical in Serbian and Montenegrin!/g, "Die Bildung der Vergangenheitsform ist identisch im Serbischen und Montenegrinischen!");
  
  // Regular Verbs header
  t = t.replace(/Regular Verbs:/g, "Regelmäßige Verben:");
  
  // Key Points header (already exists but ensure it's there)
  t = t.replace(/Key Points:/g, "Wichtige Punkte:");
  
  // More section headers
  t = t.replace(/### Past Participle Formation:/g, "### Partizip Perfekt Bildung:");
  t = t.replace(/### Example: \*\*raditi\*\* \(to work\)/g, "### Beispiel: **raditi** (arbeiten)");
  
  // Additional patterns for table rows and content
  t = t.replace(/\| Masculine \| -o \|/g, "| Männlich | -o |");
  t = t.replace(/\| Feminine \| -la \|/g, "| Weiblich | -la |");
  t = t.replace(/\| Neuter \| -lo \|/g, "| Sächlich | -lo |");
  
  // Fix table content that appears after colons in examples
  t = t.replace(/:\s*\*\*I worked \(m\/f\)\*\*/g, ": **Ich arbeitete (m/w)**");
  t = t.replace(/:\s*\*\*You worked\*\*/g, ": **Du arbeitetest**");
  t = t.replace(/:\s*\*\*He worked\*\*/g, ": **Er arbeitete**");
  t = t.replace(/:\s*\*\*She worked\*\*/g, ": **Sie arbeitete**");
  t = t.replace(/:\s*\*\*It worked\*\*/g, ": **Es arbeitete**");
  t = t.replace(/:\s*\*\*We worked\*\*/g, ": **Wir arbeiteten**");
  t = t.replace(/:\s*\*\*They worked \(m\)\*\*/g, ": **Sie arbeiteten (m)**");
  t = t.replace(/:\s*\*\*They worked \(f\)\*\*/g, ": **Sie arbeiteten (w)**");
  
  // Additional table row patterns (Serbian forms stay as-is, only translate English parts)
  // These are already in Serbian, so we don't need to translate them
  
  // Fix common table cell patterns
  t = t.replace(/\| \*\*Ja sam radio\/radila\*\* \|/g, "| **Ja sam radio/radila** |");
  t = t.replace(/\| \*\*Ti si radio\/radila\*\* \|/g, "| **Ti si radio/radila** |");
  t = t.replace(/\| \*\*On je radio\*\* \|/g, "| **On je radio** |");
  t = t.replace(/\| \*\*Ona je radila\*\* \|/g, "| **Ona je radila** |");
  t = t.replace(/\| \*\*Ono je radilo\*\* \|/g, "| **Ono je radilo** |");
  t = t.replace(/\| \*\*Mi smo radili\*\* \|/g, "| **Mi smo radili** |");
  t = t.replace(/\| \*\*Vi ste radili\*\* \|/g, "| **Vi ste radili** |");
  t = t.replace(/\| \*\*Oni su radili\*\* \|/g, "| **Oni su radili** |");
  t = t.replace(/\| \*\*One su radile\*\* \|/g, "| **One su radile** |");
  
  // This is why declension rules matter
  t = t.replace(/This is why declension rules matter/g, "Deshalb sind Deklinationsregeln wichtig");
  
  // Additional patterns for table content that might appear in parentheses
  t = t.replace(/\(I am a student\)/g, "(Ich bin ein Student)");
  t = t.replace(/\(You are a tourist\)/g, "(Du bist ein Tourist)");
  t = t.replace(/\(He is a pilot\)/g, "(Er ist ein Pilot)");
  t = t.replace(/\(We are from Serbia\)/g, "(Wir kommen aus Serbien)");
  t = t.replace(/\(You are a professor\)/g, "(Du bist ein Professor)");
  t = t.replace(/\(They are students\)/g, "(Sie sind Studenten)");
  
  // More table content patterns
  t = t.replace(/\(informal singular\)/g, "(informell Singular)");
  t = t.replace(/\(formal\/plural\)/g, "(formell/Plural)");
  t = t.replace(/\(formal\)/g, "(formell)");
  t = t.replace(/\(informal\)/g, "(informell)");
  
  // Past tense table translations - specific patterns in parentheses
  t = t.replace(/\(I was in Belgrade - masculine\)/g, "(Ich war in Belgrad - männlich)");
  t = t.replace(/\(I was in Belgrade\)/g, "(Ich war in Belgrad)");
  t = t.replace(/\(She learned Serbian\)/g, "(Sie lernte Serbisch)");
  t = t.replace(/\(We ate ćevapi\)/g, "(Wir aßen ćevapi)");
  t = t.replace(/\(They came late\)/g, "(Sie kamen spät)");
  t = t.replace(/\(Were you at school\?\)/g, "(Warst du in der Schule?)");
  t = t.replace(/\(What did you do yesterday\?\)/g, "(Was hast du gestern getan?)");
  t = t.replace(/\(When did you come\?\)/g, "(Wann bist du gekommen?)");
  t = t.replace(/\(Where were you\?\)/g, "(Wo warst du?)");
  t = t.replace(/\(Yesterday I watched a movie\)/g, "(Gestern schaute ich einen Film)");
  t = t.replace(/\(She bought bread\)/g, "(Sie kaufte Brot)");
  t = t.replace(/\(We were at a restaurant\)/g, "(Wir waren in einem Restaurant)");
  t = t.replace(/\(I didn't see Marko\)/g, "(Ich sah Marko nicht)");
  t = t.replace(/\(She didn't come to work\)/g, "(Sie kam nicht zur Arbeit)");
  t = t.replace(/\(We didn't have time\)/g, "(Wir hatten keine Zeit)");
  t = t.replace(/\(Did you study Serbian\?\)/g, "(Hast du Serbisch gelernt?)");
  t = t.replace(/\(What did you do\?\)/g, "(Was hast du getan?)");
  t = t.replace(/\(When did you arrive\?\)/g, "(Wann bist du angekommen?)");
  
  // Fix incorrect mixed translations that appear in parentheses
  t = t.replace(/\(\*\*I war in Belgrade\*\* - masculine\)/g, "(**Ich war in Belgrad** - männlich)");
  t = t.replace(/\(\*\*What tat you tun gestern\?\*\*\)/g, "(**Was hast du gestern getan?**)");
  t = t.replace(/\(\*\*When tat you come\?\*\*\)/g, "(**Wann bist du gekommen?**)");
  t = t.replace(/\(\*\*Where waren you\?\*\*\)/g, "(**Wo warst du?**)");
  t = t.replace(/\(\*\*We didn't haben time\*\*\)/g, "(**Wir hatten keine Zeit**)");
  t = t.replace(/\(\*\*We waren at a restaurant\*\*\)/g, "(**Wir waren in einem Restaurant**)");
  
  // Fix patterns that appear in markdown bold
  t = t.replace(/\*\*I war in Belgrade\*\*/g, "**Ich war in Belgrad**");
  t = t.replace(/\*\*What tat you tun gestern\?\*\*/g, "**Was hast du gestern getan?**");
  t = t.replace(/\*\*When tat you come\?\*\*/g, "**Wann bist du gekommen?**");
  t = t.replace(/\*\*Where waren you\?\*\*/g, "**Wo warst du?**");
  t = t.replace(/\*\*We didn't haben time\*\*/g, "**Wir hatten keine Zeit**");
  t = t.replace(/\*\*We waren at a restaurant\*\*/g, "**Wir waren in einem Restaurant**");
  
  // More common phrases
  t = t.replace(/In English we say/g, "Auf Englisch sagen wir");
  t = t.replace(/In Serbian it's/g, "Auf Serbisch ist es");
  t = t.replace(/The words change just like in English!/g, "Die Wörter ändern sich genauso wie im Englischen!");
  t = t.replace(/Literally:/g, "Wörtlich:");
  t = t.replace(/Use "vi\/ste" when talking to someone you don't know well/g, "Verwende \"vi/ste\", wenn du mit jemandem sprichst, den du nicht gut kennst");
  t = t.replace(/or someone older\/in authority/g, "oder jemandem, der älter ist/in Autorität steht");
  t = t.replace(/💡 "Sam" is like "am" in English/g, "💡 \"Sam\" ist wie \"am\" im Englischen");
  t = t.replace(/💡 "Si" is used when talking to one person you know well/g, "💡 \"Si\" wird verwendet, wenn du mit einer Person sprichst, die du gut kennst");
  t = t.replace(/💡 "Je" is like "is"/g, "💡 \"Je\" ist wie \"is\"");
  t = t.replace(/💡 "Nisam" = "ne" \+ "sam" = not am/g, "💡 \"Nisam\" = \"ne\" + \"sam\" = nicht bin");
  t = t.replace(/💡 Use "vi\/ste" when talking to someone you don't know well, or someone older\/in authority/g, "💡 Verwende \"vi/ste\", wenn du mit jemandem sprichst, den du nicht gut kennst, oder jemandem, der älter ist/in Autorität steht");
  
  // Exercise and instruction phrases
  t = t.replace(/Complete the sentences with the correct form of/g, "Vervollständige die Sätze mit der richtigen Form von");
  t = t.replace(/Translate these common phrases from English to Serbian:/g, "Übersetze diese häufigen Phrasen vom Englischen ins Serbische:");
  t = t.replace(/Identify the gender of these nouns/g, "Bestimme das Geschlecht dieser Substantive");
  t = t.replace(/masculine, feminine, or neuter/g, "männlich, weiblich oder sächlich");
  t = t.replace(/Ends in a consonant/g, "Endet mit einem Konsonanten");
  t = t.replace(/Ends in -a/g, "Endet mit -a");
  t = t.replace(/Ends in -e/g, "Endet mit -e");
  t = t.replace(/Ends in -o/g, "Endet mit -o");
  
  // Table headers and labels - must come before table content translations
  t = t.replace(/\| Person \|/g, "| Person |");
  t = t.replace(/\| Serbian \|/g, "| Serbisch |");
  t = t.replace(/\| English \|/g, "| Englisch |");
  t = t.replace(/\| Englisch \|/g, "| Englisch |");
  t = t.replace(/\| Pronunciation \|/g, "| Aussprache |");
  t = t.replace(/\| Meaning \|/g, "| Bedeutung |");
  t = t.replace(/\| Form \|/g, "| Form |");
  t = t.replace(/\| Example \|/g, "| Beispiel |");
  t = t.replace(/\| Letter \|/g, "| Buchstabe |");
  t = t.replace(/\| Gender \|/g, "| Geschlecht |");
  t = t.replace(/\| Typical Ending \|/g, "| Typische Endung |");
  t = t.replace(/\| Infinitive \|/g, "| Infinitiv |");
  t = t.replace(/\| "ja" form \|/g, "| \"ja\" Form |");
  t = t.replace(/\| Auxiliary \|/g, "| Hilfsverb |");
  t = t.replace(/\| Participle \(M\/F\) \|/g, "| Partizip (M/F) |");
  t = t.replace(/\| Full Form \|/g, "| Vollständige Form |");
  t = t.replace(/\| Translation \|/g, "| Übersetzung |");
  t = t.replace(/\| Übersetzung \|/g, "| Übersetzung |");
  t = t.replace(/\| Masculine \|/g, "| Männlich |");
  t = t.replace(/\| Feminine \|/g, "| Weiblich |");
  t = t.replace(/\| Neuter \|/g, "| Sächlich |");
  t = t.replace(/\| Negative Form \|/g, "| Negative Form |");
  t = t.replace(/\| Ending \|/g, "| Endung |");
  
  // Standalone table header words (not in pipe format)
  t = t.replace(/^Ending$/gm, "Endung");
  t = t.replace(/^English$/gm, "Englisch");
  t = t.replace(/^Translation$/gm, "Übersetzung");
  t = t.replace(/^Meaning$/gm, "Bedeutung");
  t = t.replace(/^Example$/gm, "Beispiel");
  t = t.replace(/^Form$/gm, "Form");
  t = t.replace(/^Auxiliary$/gm, "Hilfsverb");
  t = t.replace(/^Infinitive$/gm, "Infinitiv");
  t = t.replace(/^Masculine$/gm, "Männlich");
  t = t.replace(/^Feminine$/gm, "Weiblich");
  t = t.replace(/^Neuter$/gm, "Sächlich");
  
  // More grammar explanations
  t = t.replace(/These verbs end in/g, "Diese Verben enden auf");
  t = t.replace(/in the "ja" \(I\) form\. They're very regular!/g, "in der \"ja\" (Ich) Form. Sie sind sehr regelmäßig!");
  t = t.replace(/These verbs end in/g, "Diese Verben enden auf");
  t = t.replace(/The Locative case is used after certain prepositions to indicate location\./g, "Der Lokativ wird nach bestimmten Präpositionen verwendet, um den Ort anzugeben.");
  t = t.replace(/Masculine\/Neuter nouns ending in a consonant → add/g, "Männliche/Sächliche Substantive, die auf einen Konsonanten enden → füge hinzu");
  t = t.replace(/Feminine nouns ending in/g, "Weibliche Substantive, die auf");
  t = t.replace(/→ change to/g, "→ ändere zu");
  t = t.replace(/Past tense formation is identical in Serbian and Montenegrin!/g, "Die Vergangenheitsformbildung ist im Serbischen und Montenegrinischen identisch!");
  t = t.replace(/Serbian past tense \(prošlo vreme\) is formed with:/g, "Die serbische Vergangenheitsform (prošlo vreme) wird gebildet mit:");
  t = t.replace(/Auxiliary verb "biti" \(to be\) \+ Past participle/g, "Hilfsverb \"biti\" (sein) + Partizip Perfekt");
  t = t.replace(/Serbian past tense \(prošlo vreme\) is formed with:/g, "Die serbische Vergangenheitsform (prošlo vreme) wird gebildet mit:");
  t = t.replace(/Past Participle Formation:/g, "Partizip Perfekt Bildung:");
  t = t.replace(/Remove the infinitive ending/g, "Entferne die Infinitivendung");
  t = t.replace(/and add gender-specific endings:/g, "und füge geschlechtsspezifische Endungen hinzu:");
  t = t.replace(/The auxiliary verb agrees with the person/g, "Das Hilfsverb stimmt mit der Person überein");
  t = t.replace(/The participle agrees with the gender/g, "Das Partizip stimmt mit dem Geschlecht überein");
  t = t.replace(/In plural, masculine form is used for mixed groups/g, "Im Plural wird die männliche Form für gemischte Gruppen verwendet");
  t = t.replace(/To make past tense negative, add/g, "Um die Vergangenheitsform negativ zu machen, füge hinzu");
  t = t.replace(/Questions use the same form, just with question intonation or question words:/g, "Fragen verwenden dieselbe Form, nur mit Frageintonation oder Fragewörtern:");
  
  // More grammar explanations
  t = t.replace(/Example \(raditi - to work\)/g, "Beispiel (raditi - arbeiten)");
  t = t.replace(/Example: \*\*raditi\*\* \(to work\)/g, "Beispiel: **raditi** (arbeiten)");
  t = t.replace(/\(I was in Belgrade - masculine\)/g, "(Ich war in Belgrad - männlich)");
  t = t.replace(/\(She learned Serbian\)/g, "(Sie lernte Serbisch)");
  t = t.replace(/\(We ate ćevapi\)/g, "(Wir aßen ćevapi)");
  t = t.replace(/\(They came late\)/g, "(Sie kamen spät)");
  
  // Cultural notes and tips
  t = t.replace(/Serbians are known for their warm hospitality!/g, "Serben sind für ihre herzliche Gastfreundschaft bekannt!");
  t = t.replace(/When you meet someone for the first time, it's common to:/g, "Wenn du jemanden zum ersten Mal triffst, ist es üblich:");
  t = t.replace(/Shake hands firmly/g, "Fest die Hand schütteln");
  t = t.replace(/Make eye contact/g, "Augenkontakt halten");
  t = t.replace(/Accept offers of coffee - it's a big part of Serbian culture!/g, "Kaffeeangebote annehmen - das ist ein großer Teil der serbischen Kultur!");
  t = t.replace(/Serbians love their TV series \(serije\)!/g, "Serben lieben ihre TV-Serien (serije)!");
  
  // More instruction phrases
  t = t.replace(/Try introducing yourself in Serbian:/g, "Versuche, dich auf Serbisch vorzustellen:");
  t = t.replace(/Write about your yesterday in Serbian:/g, "Schreibe über dein Gestern auf Serbisch:");
  t = t.replace(/Write 5-6 sentences about your yesterday\)/g, "Schreibe 5-6 Sätze über dein Gestern)");
  
  // Additional common words that appear frequently - REMOVED to avoid over-translation
  // These were causing issues by translating words that should stay in context
  // Individual word translations are handled by specific patterns above
  
  // Common sentence starters
  t = t.replace(/In this course, we focus on/g, "In diesem Kurs konzentrieren wir uns auf");
  t = t.replace(/In Serbian,/g, "Im Serbischen,");
  t = t.replace(/In English,/g, "Im Englischen,");
  t = t.replace(/For example,/g, "Zum Beispiel,");
  t = t.replace(/For instance,/g, "Beispielsweise,");
  t = t.replace(/Similarly:/g, "Ähnlich:");
  t = t.replace(/However,/g, "Jedoch,");
  t = t.replace(/Therefore,/g, "Daher,");
  t = t.replace(/Moreover,/g, "Außerdem,");
  t = t.replace(/Furthermore,/g, "Darüber hinaus,");
  t = t.replace(/Additionally,/g, "Zusätzlich,");
  t = t.replace(/Also,/g, "Auch,");
  t = t.replace(/Meanwhile,/g, "Inzwischen,");
  t = t.replace(/Otherwise,/g, "Andernfalls,");
  t = t.replace(/Instead,/g, "Stattdessen,");
  t = t.replace(/Nevertheless,/g, "Trotzdem,");
  t = t.replace(/Consequently,/g, "Folglich,");
  t = t.replace(/Thus,/g, "Somit,");
  t = t.replace(/Hence,/g, "Daher,");
  t = t.replace(/Accordingly,/g, "Dementsprechend,");
  t = t.replace(/In other words,/g, "Mit anderen Worten,");
  t = t.replace(/In fact,/g, "Tatsächlich,");
  t = t.replace(/Actually,/g, "Eigentlich,");
  t = t.replace(/Indeed,/g, "Tatsächlich,");
  t = t.replace(/Of course,/g, "Natürlich,");
  t = t.replace(/Certainly,/g, "Sicherlich,");
  t = t.replace(/Obviously,/g, "Offensichtlich,");
  t = t.replace(/Clearly,/g, "Klar,");
  t = t.replace(/Evidently,/g, "Offensichtlich,");
  t = t.replace(/Undoubtedly,/g, "Zweifellos,");
  t = t.replace(/Definitely,/g, "Definitiv,");
  t = t.replace(/Absolutely,/g, "Absolut,");
  t = t.replace(/Probably,/g, "Wahrscheinlich,");
  t = t.replace(/Perhaps,/g, "Vielleicht,");
  t = t.replace(/Maybe,/g, "Vielleicht,");
  t = t.replace(/Possibly,/g, "Möglicherweise,");
  t = t.replace(/Likely,/g, "Wahrscheinlich,");
  t = t.replace(/Unlikely,/g, "Unwahrscheinlich,");
  t = t.replace(/Usually,/g, "Normalerweise,");
  t = t.replace(/Generally,/g, "Allgemein,");
  t = t.replace(/Typically,/g, "Typischerweise,");
  t = t.replace(/Normally,/g, "Normalerweise,");
  t = t.replace(/Commonly,/g, "Häufig,");
  t = t.replace(/Rarely,/g, "Selten,");
  t = t.replace(/Seldom,/g, "Selten,");
  t = t.replace(/Occasionally,/g, "Gelegentlich,");
  t = t.replace(/Sometimes,/g, "Manchmal,");
  t = t.replace(/Often,/g, "Oft,");
  t = t.replace(/Frequently,/g, "Häufig,");
  t = t.replace(/Always,/g, "Immer,");
  t = t.replace(/Never,/g, "Niemals,");
  t = t.replace(/Constantly,/g, "Ständig,");
  t = t.replace(/Continuously,/g, "Kontinuierlich,");
  t = t.replace(/Regularly,/g, "Regelmäßig,");
  t = t.replace(/Periodically,/g, "Periodisch,");
  t = t.replace(/Occasionally,/g, "Gelegentlich,");
  t = t.replace(/Rarely,/g, "Selten,");
  t = t.replace(/Seldom,/g, "Selten,");
  t = t.replace(/Hardly,/g, "Kaum,");
  t = t.replace(/Scarcely,/g, "Kaum,");
  t = t.replace(/Barely,/g, "Kaum,");
  t = t.replace(/Almost,/g, "Fast,");
  t = t.replace(/Nearly,/g, "Beinahe,");
  t = t.replace(/Quite,/g, "Ganz,");
  t = t.replace(/Rather,/g, "Eher,");
  t = t.replace(/Fairly,/g, "Ziemlich,");
  t = t.replace(/Pretty,/g, "Ziemlich,");
  t = t.replace(/Very,/g, "Sehr,");
  t = t.replace(/Extremely,/g, "Extrem,");
  t = t.replace(/Incredibly,/g, "Unglaublich,");
  t = t.replace(/Amazingly,/g, "Erstaunlich,");
  t = t.replace(/Surprisingly,/g, "Überraschenderweise,");
  t = t.replace(/Unexpectedly,/g, "Unerwartet,");
  t = t.replace(/Fortunately,/g, "Glücklicherweise,");
  t = t.replace(/Unfortunately,/g, "Unglücklicherweise,");
  t = t.replace(/Luckily,/g, "Glücklicherweise,");
  t = t.replace(/Unluckily,/g, "Unglücklicherweise,");
  t = t.replace(/Sadly,/g, "Leider,");
  t = t.replace(/Happily,/g, "Glücklicherweise,");
  t = t.replace(/Thankfully,/g, "Gott sei Dank,");
  t = t.replace(/Hopefully,/g, "Hoffentlich,");
  t = t.replace(/Ideally,/g, "Idealerweise,");
  t = t.replace(/Preferably,/g, "Bevorzugt,");
  t = t.replace(/Ideally,/g, "Idealerweise,");
  t = t.replace(/Preferably,/g, "Bevorzugt,");
  t = t.replace(/Essentially,/g, "Im Wesentlichen,");
  t = t.replace(/Basically,/g, "Grundsätzlich,");
  t = t.replace(/Fundamentally,/g, "Grundlegend,");
  t = t.replace(/Primarily,/g, "Hauptsächlich,");
  t = t.replace(/Mainly,/g, "Hauptsächlich,");
  t = t.replace(/Mostly,/g, "Meistens,");
  t = t.replace(/Largely,/g, "Größtenteils,");
  t = t.replace(/Partially,/g, "Teilweise,");
  t = t.replace(/Partly,/g, "Teilweise,");
  t = t.replace(/Completely,/g, "Völlig,");
  t = t.replace(/Entirely,/g, "Völlig,");
  t = t.replace(/Totally,/g, "Völlig,");
  t = t.replace(/Fully,/g, "Vollständig,");
  t = t.replace(/Wholly,/g, "Völlig,");
  t = t.replace(/Thoroughly,/g, "Gründlich,");
  t = t.replace(/Comprehensively,/g, "Umfassend,");
  t = t.replace(/Extensively,/g, "Umfangreich,");
  t = t.replace(/Intensively,/g, "Intensiv,");
  t = t.replace(/Deeply,/g, "Tief,");
  t = t.replace(/Profoundly,/g, "Tiefgreifend,");
  t = t.replace(/Seriously,/g, "Ernsthaft,");
  t = t.replace(/Sincerely,/g, "Aufrichtig,");
  t = t.replace(/Honestly,/g, "Ehrlich,");
  t = t.replace(/Truly,/g, "Wirklich,");
  t = t.replace(/Really,/g, "Wirklich,");
  t = t.replace(/Actually,/g, "Tatsächlich,");
  t = t.replace(/Genuinely,/g, "Echt,");
  t = t.replace(/Truly,/g, "Wirklich,");
  t = t.replace(/Certainly,/g, "Sicherlich,");
  t = t.replace(/Definitely,/g, "Definitiv,");
  t = t.replace(/Absolutely,/g, "Absolut,");
  t = t.replace(/Undoubtedly,/g, "Zweifellos,");
  t = t.replace(/Indisputably,/g, "Unbestreitbar,");
  t = t.replace(/Unquestionably,/g, "Fraglos,");
  t = t.replace(/Unarguably,/g, "Unbestreitbar,");
  t = t.replace(/Indisputably,/g, "Unbestreitbar,");
  t = t.replace(/Unquestionably,/g, "Fraglos,");
  t = t.replace(/Unarguably,/g, "Unbestreitbar,");
  t = t.replace(/Indisputably,/g, "Unbestreitbar,");
  t = t.replace(/Unquestionably,/g, "Fraglos,");
  t = t.replace(/Unarguably,/g, "Unbestreitbar,");
  
  // Final cleanup: Fix any remaining mixed patterns
  // These should catch edge cases where partial translation occurred
  t = t.replace(/tat you/g, "hast du");
  t = t.replace(/tat you tun/g, "hast du getan");
  t = t.replace(/waren you/g, "warst du");
  t = t.replace(/haben time/g, "hatten Zeit");
  t = t.replace(/waren at/g, "waren in");
  
  // Fix common word-level translations that might have been missed (be careful with word boundaries)
  // Only translate in specific contexts to avoid over-translation
  t = t.replace(/\bthe alphabet\b/g, "das Alphabet");
  t = t.replace(/\bdaily\b/g, "täglich");
  t = t.replace(/\bvery consistent\b/g, "sehr konsistent");
  t = t.replace(/\bpronunciation\b/g, "Aussprache");
  t = t.replace(/\bis consistent\b/g, "ist konsistent");
  t = t.replace(/\bconsistent\b/g, "konsistent");
  
  return t;
}

async function addGermanTranslations() {
  console.log("🌍 Adding German translations for all unit explanations...\n");
  
  if (!CONVEX_URL) {
    console.error("❌ CONVEX_URL not found");
    console.error("💡 Please ensure .env.local contains VITE_CONVEX_URL or CONVEX_URL");
    process.exit(1);
  }
  
  console.log(`📡 Connecting to Convex: ${CONVEX_URL.substring(0, 30)}...\n`);

  try {
    console.log("📚 Fetching all unit explanations...");
    const explanations = await client.query(api.units.getAllExplanations);
    
    if (!explanations || explanations.length === 0) {
      console.log("❌ No unit explanations found");
      process.exit(1);
    }

    console.log(`✅ Found ${explanations.length} unit explanations\n`);

    const sorted = explanations.sort((a, b) => a.unitNumber - b.unitNumber);
    let successCount = 0;
    let errorCount = 0;

    for (const unit of sorted) {
      try {
        console.log(`🔄 Processing Unit ${unit.unitNumber}...`);

        const overviewGerman = translateToGerman(unit.overview || '');
        const grammarExplainedGerman = translateToGerman(unit.grammarExplained || '');
        const practiceExamplesGerman = translateToGerman(unit.practiceExamples || '');
        const bookReferenceGerman = unit.bookReference 
          ? translateToGerman(unit.bookReference) 
          : undefined;

        // Debug output for Unit 1
        if (unit.unitNumber === 1) {
          console.log(`\n📝 Debug: Unit 1 Translation Sample`);
          console.log(`Original overview (first 200 chars): ${(unit.overview || '').substring(0, 200)}`);
          console.log(`Translated overview (first 200 chars): ${overviewGerman.substring(0, 200)}`);
          console.log(`Overview German length: ${overviewGerman.length}`);
          console.log(`Grammar German length: ${grammarExplainedGerman.length}`);
          console.log(`Practice German length: ${practiceExamplesGerman.length}`);
        }

        const result = await client.mutation(api.units.updateGermanTranslationsScript, {
          unitNumber: unit.unitNumber,
          overviewGerman,
          grammarExplainedGerman,
          practiceExamplesGerman,
          bookReferenceGerman,
        });

        // Verify the write was successful
        if (result) {
          console.log(`✅ Unit ${unit.unitNumber} translated successfully (ID: ${result})`);
          
          // For Unit 1, verify the data was written
          if (unit.unitNumber === 1) {
            try {
              const verification = await client.query(api.units.getExplanation, { unitNumber: 1 });
              if (verification && (verification as any).overviewGerman) {
                console.log(`   ✓ Verified: overviewGerman exists in database (${(verification as any).overviewGerman.length} chars)`);
              } else {
                console.log(`   ⚠️  Warning: overviewGerman not found in database after write`);
              }
            } catch (verifyError: any) {
              console.log(`   ⚠️  Could not verify write: ${verifyError.message}`);
            }
          }
        } else {
          console.log(`⚠️  Unit ${unit.unitNumber} mutation returned no result`);
        }
        
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to translate Unit ${unit.unitNumber}: ${error.message}`);
        if (error.message.includes("Unauthorized")) {
          console.error(`   ⚠️  This requires admin authentication. Please run this script while logged in as admin.`);
        }
        errorCount++;
      }
    }

    console.log(`\n✨ Done!`);
    console.log(`✅ Successfully translated: ${successCount} units`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} units`);
      console.log(`\n💡 Note: If you see "Unauthorized" errors, you need to run this script while authenticated as an admin user.`);
      process.exit(1);
    }
    
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Verify translations: npx tsx scripts/verify-german-translations.ts`);
    console.log(`   2. Ensure user's learningLanguage is set to 'de'`);
    console.log(`   3. Check the UI - translations should appear automatically`);
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    if (error.message.includes("Unauthorized")) {
      console.error("\n💡 This script requires admin authentication. Please ensure you are logged in as an admin user.");
    }
    process.exit(1);
  }
}

// Main execution
(async () => {
  try {
    console.log("🚀 Starting translation script...\n");
    await addGermanTranslations();
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
})();
