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
  t = t.replace(/# Unit (\d+): Grammar Explained/g, "# Lektion $1: Grammatik erklärt");
  t = t.replace(/# Unit (\d+): Practice Examples/g, "# Lektion $1: Übungsbeispiele");
  t = t.replace(/# Unit (\d+): Practice Examples & Dialogues/g, "# Lektion $1: Übungsbeispiele & Dialoge");
  
  // Title phrases - must come early to catch them in titles
  t = t.replace(/At the Airport/g, "Am Flughafen");
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
  t = t.replace(/This unit introduces you to Serbian's straightforward past tense system!/g, "Diese Lektion führt dich in Serbiens unkompliziertes Vergangenheitssystem ein!");
  t = t.replace(/The Serbian past tense is actually simpler than many other languages - it has only one past tense form \(unlike English with simple past, present perfect, past perfect, etc\.\)\. Once you master this unit, you'll be able to talk about any past event!/g, "Die serbische Vergangenheitsform ist tatsächlich einfacher als viele andere Sprachen - sie hat nur eine Vergangenheitsform (im Gegensatz zu Englisch mit Simple Past, Present Perfect, Past Perfect, etc.). Sobald du diese Lektion beherrschst, kannst du über jedes vergangene Ereignis sprechen!");
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
  t = t.replace(/Keep a simple diary in Serbian using past tense/g, "Führe ein einfaches Tagebuch auf Serbisch in der Vergangenheitsform");
  t = t.replace(/Notice the gender agreement patterns/g, "Achte auf die Geschlechtsübereinstimmungsmuster");
  t = t.replace(/Create flashcards with pictures of foods/g, "Erstelle Karteikarten mit Bildern von Lebensmitteln");
  t = t.replace(/Visit Serbian market websites or YouTube videos to see real shopping scenarios/g, "Besuche serbische Markt-Websites oder YouTube-Videos, um echte Einkaufsszenarien zu sehen");
  t = t.replace(/Practice quantities with real objects at home/g, "Übe Mengen mit echten Gegenständen zu Hause");
  t = t.replace(/Learn the currency \(dinar\) and practice price calculations/g, "Lerne die Währung (Dinar) und übe Preisberechnungen");
  
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
  
  // Bullet Points für "Was du lernen wirst:"
  t = t.replace(/The Serbian Latin alphabet and pronunciation/g, "Das serbische lateinische Alphabet und die Aussprache");
  t = t.replace(/Basic greetings and polite phrases/g, "Grundlegende Begrüßungen und höfliche Phrasen");
  t = t.replace(/How to introduce yourself/g, "Wie man sich vorstellt");
  t = t.replace(/The verb "biti" \(to be\) - your first Serbian verb!/g, "Das Verb \"biti\" (sein) - dein erstes serbisches Verb!");
  t = t.replace(/Understanding grammatical gender \(masculine, feminine, neuter\)/g, "Grammatisches Geschlecht verstehen (männlich, weiblich, sächlich)");
  t = t.replace(/Simple yes\/no questions/g, "Einfache Ja/Nein-Fragen");
  
  // Kontext-Beschreibungen
  t = t.replace(/just landed in Belgrade\. You're at the airport, meeting someone for the first time\. This unit teaches you exactly what you need to navigate those first crucial conversations!/g, "gerade in Belgrad gelandet. Du bist am Flughafen und triffst jemanden zum ersten Mal. Diese Lektion lehrt dich genau das, was du brauchst, um diese ersten entscheidenden Gespräche zu meistern!");
  t = t.replace(/Practice the alphabet daily - Serbian pronunciation is very consistent!/g, "Übe das Alphabet täglich - die serbische Aussprache ist sehr konsistent!");
  t = t.replace(/Repeat the greetings out loud/g, "Wiederhole die Begrüßungen laut");
  t = t.replace(/Don't worry about perfection - Serbians appreciate any effort to speak their language/g, "Mach dir keine Sorgen um Perfektion - Serben schätzen jede Anstrengung, ihre Sprache zu sprechen");
  
  // Grammatik-Überschriften
  t = t.replace(/## 1\. The Serbian Alphabet/g, "## 1. Das serbische Alphabet");
  t = t.replace(/1\. The Serbian Alphabet/g, "1. Das serbische Alphabet");
  t = t.replace(/Serbian uses both Cyrillic and Latin alphabets\. In this course, we focus on the Latin alphabet, which has 30 letters\./g, "Serbisch verwendet sowohl das kyrillische als auch das lateinische Alphabet. In diesem Kurs konzentrieren wir uns auf das lateinische Alphabet, das 30 Buchstaben hat.");
  t = t.replace(/### Key Pronunciation Rules:/g, "### Wichtige Ausspracheregeln:");
  t = t.replace(/Key Pronunciation Rules:/g, "Wichtige Ausspracheregeln:");
  t = t.replace(/## 2\. Greetings and Basic Phrases/g, "## 2. Begrüßungen und grundlegende Phrasen");
  t = t.replace(/2\. Greetings and Basic Phrases/g, "2. Begrüßungen und grundlegende Phrasen");
  t = t.replace(/\*\*Important:\*\* Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word\./g, "**Wichtig:** Jeder Buchstabe hat EINEN Laut - keine Ausnahmen! Sobald du es lernst, kannst du JEDES serbische Wort lesen.");
  t = t.replace(/Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word\./g, "Jeder Buchstabe hat EINEN Laut - keine Ausnahmen! Sobald du es lernst, kannst du JEDES serbische Wort lesen.");
  
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
  
  return t;
}

async function addGermanTranslations() {
  console.log("🌍 Adding German translations for all unit explanations...\n");
  console.log(`📡 Connecting to Convex: ${CONVEX_URL?.substring(0, 30)}...\n`);

  try {
    console.log("📚 Fetching all unit explanations...");
    const explanations = await client.query(api.units.getAllExplanations);
    
    if (!explanations || explanations.length === 0) {
      console.log("❌ No unit explanations found");
      return;
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
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.message.includes("Unauthorized")) {
      console.error("\n💡 This script requires admin authentication. Please ensure you are logged in as an admin user.");
    }
    process.exit(1);
  }
}

console.log("🚀 Starting translation script...\n");
addGermanTranslations().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
