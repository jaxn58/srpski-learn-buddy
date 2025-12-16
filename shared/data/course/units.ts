export interface Unit {
  number: number;
  title: string;
  titleEnglish: string;
  titleGerman: string;
  topics: string[];
  topicsGerman: string[];
  grammarFocus: string[];
  vocabularyThemes: string[];
}

export const COURSE_UNITS: Unit[] = [
  // New Units 1 and 2
  {
    number: 1,
    title: "Prve reči",
    titleEnglish: "First Words",
    titleGerman: "Erste Wörter",
    topics: ["Greetings", "Politeness", "Language barrier", "Basics"],
    topicsGerman: ["Begrüßungen", "Höflichkeit", "Sprachbarriere", "Grundlagen"],
    grammarFocus: ["Verb 'biti' (to be) - partial (sam, si, je)", "Basic phrases"],
    vocabularyThemes: ["Greetings", "Politeness", "Language barrier", "Basics"]
  },
  {
    number: 2,
    title: "Ko si ti?",
    titleEnglish: "Who Are You?",
    titleGerman: "Wer bist du?",
    topics: ["Introductions", "Countries and nationalities", "Noun gender basics"],
    topicsGerman: ["Vorstellungen", "Länder und Nationalitäten", "Grundlagen des Substantivgeschlechts"],
    grammarFocus: ["Verb 'biti' (to be) - full conjugation", "Verb 'zvati se' (to be called)", "Noun gender"],
    vocabularyThemes: ["Introduction", "Countries", "Nationalities"]
  },
  // Units 3-6: New content from learn-with.me
  {
    number: 3,
    title: "U konoba",
    titleEnglish: "At the Konoba",
    titleGerman: "Wie lernt Steve Bond Serbisch?", // Note: German title from DB doesn't match English content
    topics: ["Ordering food at a traditional restaurant", "Serbian cuisine"],
    topicsGerman: ["Essen in einem traditionellen Restaurant bestellen", "Serbische Küche"],
    grammarFocus: ["Food vocabulary", "Ordering phrases", "Polite requests"],
    vocabularyThemes: ["Food", "Restaurant", "Serbian dishes"]
  },
  {
    number: 4,
    title: "U banci",
    titleEnglish: "At the Bank",
    titleGerman: "Wo ist…?", // Note: German title from DB doesn't match English content
    topics: ["Banking services", "Money exchange", "Financial transactions"],
    topicsGerman: ["Bankdienstleistungen", "Geldwechsel", "Finanztransaktionen"],
    grammarFocus: ["Banking vocabulary", "Numbers and currency", "Formal requests"],
    vocabularyThemes: ["Banking", "Money", "Transactions"]
  },
  {
    number: 5,
    title: "Traženje smeštaja",
    titleEnglish: "Finding a Place to Stay",
    titleGerman: "Im Zimmer", // Note: German title from DB doesn't match English content
    topics: ["Looking for accommodation", "Describing preferences", "Negotiating rent"],
    topicsGerman: ["Unterkunft suchen", "Vorlieben beschreiben", "Miete verhandeln"],
    grammarFocus: ["Accommodation vocabulary", "Expressing preferences", "Questions about facilities"],
    vocabularyThemes: ["Accommodation", "Housing", "Facilities"]
  },
  {
    number: 6,
    title: "Moj grad ili selo",
    titleEnglish: "My Town or Village",
    titleGerman: "Lebensmittel einkaufen", // Note: German title from DB doesn't match English content
    topics: ["Describing your hometown", "Local landmarks", "Community life"],
    topicsGerman: ["Heimatstadt beschreiben", "Lokale Sehenswürdigkeiten", "Gemeinschaftsleben"],
    grammarFocus: ["Descriptive vocabulary", "Location expressions", "Community terms"],
    vocabularyThemes: ["Town", "Village", "Community", "Landmarks"]
  },
  // Unit 7: Continuation of course
  {
    number: 7,
    title: "Dođite u goste",
    titleEnglish: "Come to my place",
    titleGerman: "Kommt zu mir nach Hause",
    topics: ["Invitations", "Hospitality", "Social gatherings"],
    topicsGerman: ["Einladungen", "Gastfreundschaft", "Gesellschaftliche Zusammenkünfte"],
    grammarFocus: ["Imperative mood", "Invitation phrases", "Social expressions"],
    vocabularyThemes: ["Invitations", "Hospitality", "Social life"]
  },
  {
    number: 8,
    title: "U restoranu",
    titleEnglish: "In the restaurant",
    titleGerman: "Im Restaurant",
    topics: ["Dining out", "Menu reading", "Restaurant etiquette"],
    topicsGerman: ["Auswärts essen", "Speisekarte lesen", "Restaurant-Etikette"],
    grammarFocus: ["Restaurant vocabulary", "Ordering food", "Polite expressions"],
    vocabularyThemes: ["Restaurant", "Food", "Dining"]
  },
  {
    number: 9,
    title: "Dnevna rutina",
    titleEnglish: "Daily routine",
    titleGerman: "Ein typischer Tag",
    topics: ["Receive guests", "Days of the week", "Tell the time"],
    topicsGerman: ["Gäste empfangen", "Wochentage", "Die Uhrzeit angeben"],
    grammarFocus: ["Time expressions", "Making appointments"],
    vocabularyThemes: ["Days", "Time", "Invitations"]
  },
  {
    number: 8,
    title: "U restoranu",
    titleEnglish: "In the restaurant",
    titleGerman: "Im Restaurant",
    topics: ["Order a meal", "Book a table"],
    topicsGerman: ["Eine Mahlzeit bestellen", "Einen Tisch reservieren"],
    grammarFocus: ["Restaurant vocabulary"],
    vocabularyThemes: ["Serbian menu", "Restaurant", "Food"]
  },
  {
    number: 9,
    title: "Tipičan dan",
    titleEnglish: "Daily routine",
    titleGerman: "Ein typischer Tag",
    topics: ["Talk about daily routine"],
    topicsGerman: ["Über den Tagesablauf sprechen"],
    grammarFocus: ["Genitive case singular", "Verbs 'jesti' and 'piti'", "Reflexive verbs"],
    vocabularyThemes: ["Daily activities", "Routine"]
  },
  {
    number: 10,
    title: "Porodica",
    titleEnglish: "Family",
    titleGerman: "Familie",
    topics: ["Talk about family", "Personal details"],
    topicsGerman: ["Über die Familie sprechen", "Persönliche Angaben"],
    grammarFocus: ["Plural of nouns"],
    vocabularyThemes: ["Family members", "Personal information"]
  },
  {
    number: 11,
    title: "Ljudi",
    titleEnglish: "People",
    titleGerman: "Menschen",
    topics: ["Characters, hobbies and work"],
    topicsGerman: ["Charaktere, Hobbys und Arbeit"],
    grammarFocus: ["Possessive pronouns", "Accusative case singular and plural"],
    vocabularyThemes: ["Character traits", "Hobbies", "Professions"]
  },
  {
    number: 12,
    title: "Narodi i jezici",
    titleEnglish: "Nationalities and languages",
    titleGerman: "Nationalitäten und Sprachen",
    topics: ["Nationalities and languages"],
    topicsGerman: ["Nationalitäten und Sprachen"],
    grammarFocus: ["Locative case of adjectives", "Use of 'koji' (which)"],
    vocabularyThemes: ["Countries", "Nationalities", "Languages"]
  },
  {
    number: 13,
    title: "Kako je bilo juče?",
    titleEnglish: "How was it yesterday?",
    titleGerman: "Wie war es gestern?",
    topics: ["Talk about the past"],
    topicsGerman: ["Über die Vergangenheit sprechen"],
    grammarFocus: ["Past tense formation", "Past tense expressions"],
    vocabularyThemes: ["Past events", "Time expressions"]
  },
  {
    number: 14,
    title: "Vreme",
    titleEnglish: "Weather",
    titleGerman: "Wetter",
    topics: ["Weather, seasons and months", "Points of compass"],
    topicsGerman: ["Wetter, Jahreszeiten und Monate", "Himmelsrichtungen"],
    grammarFocus: ["Instrumental case singular"],
    vocabularyThemes: ["Weather", "Seasons", "Months", "Compass"]
  },
  {
    number: 15,
    title: "Kako, s kim i kada putujete?",
    titleEnglish: "How, with who and when do you travel?",
    titleGerman: "Wie, mit wem und wann reisen Sie?",
    topics: ["Means of travelling", "Travel preferences"],
    topicsGerman: ["Reisemittel", "Reisepräferenzen"],
    grammarFocus: ["Instrumental case plural", "Feminine nouns ending with consonant"],
    vocabularyThemes: ["Transport", "Travel"]
  },
  {
    number: 16,
    title: "Stivov novi stan",
    titleEnglish: "Steve's new apartment",
    titleGerman: "Steves neue Wohnung",
    topics: ["Describe an apartment", "Moving to new apartment"],
    topicsGerman: ["Eine Wohnung beschreiben", "In eine neue Wohnung umziehen"],
    grammarFocus: ["Dative case singular", "Dative of personal pronouns"],
    vocabularyThemes: ["Apartment", "Moving", "Furniture"]
  },
  {
    number: 17,
    title: "Telefonski razgovor",
    titleEnglish: "Telephone conversation",
    titleGerman: "Telefongespräch",
    topics: ["Use a telephone", "Leave and receive messages"],
    topicsGerman: ["Ein Telefon benutzen", "Nachrichten hinterlassen und empfangen"],
    grammarFocus: ["Expressions with dative case"],
    vocabularyThemes: ["Telephone", "Messages"]
  },
  {
    number: 18,
    title: "Stiv planira vikend",
    titleEnglish: "Planning a weekend",
    titleGerman: "Ein Wochenende planen",
    topics: ["Talk about future plans"],
    topicsGerman: ["Über zukünftige Pläne sprechen"],
    grammarFocus: ["Future tense", "Verb 'hteti' (to want)"],
    vocabularyThemes: ["Weekend activities", "Plans"]
  },
  {
    number: 19,
    title: "Srećan rođendan!",
    titleEnglish: "Happy birthday!",
    titleGerman: "Alles Gute zum Geburtstag!",
    topics: ["Anniversaries and celebrations", "Planning a party"],
    topicsGerman: ["Jubiläen und Feiern", "Eine Party planen"],
    grammarFocus: ["Express dates", "Genitive and accusative of personal pronouns"],
    vocabularyThemes: ["Celebrations", "Dates", "Parties"]
  },
  {
    number: 20,
    title: "Kod lekara",
    titleEnglish: "Health matters",
    titleGerman: "Beim Arzt",
    topics: ["Body parts", "Visit to the doctor"],
    topicsGerman: ["Körperteile", "Arztbesuch"],
    grammarFocus: ["Verb 'boleti' (to hurt)", "Imperative"],
    vocabularyThemes: ["Body", "Health", "Doctor"]
  },
  {
    number: 21,
    title: "Boje i odeća",
    titleEnglish: "Colors and Clothes",
    titleGerman: "Farben und Kleidung",
    topics: ["Colors", "Shopping for clothes"],
    topicsGerman: ["Farben", "Kleidung einkaufen"],
    grammarFocus: ["Demonstrative pronouns 'ovaj, taj, onaj'", "Plural of locative and dative"],
    vocabularyThemes: ["Colors", "Clothes", "Shoes"]
  },
  {
    number: 22,
    title: "Šta je bolje?",
    titleEnglish: "What's better?",
    titleGerman: "Was ist besser?",
    topics: ["Services in cities"],
    topicsGerman: ["Dienstleistungen in Städten"],
    grammarFocus: ["Comparatives and superlatives", "Plural of genitive"],
    vocabularyThemes: ["City services", "Comparisons"]
  },
  {
    number: 23,
    title: "Kako izgledaju?",
    titleEnglish: "How do they look like?",
    titleGerman: "Wie sehen sie aus?",
    topics: ["Describe people", "Professions"],
    topicsGerman: ["Menschen beschreiben", "Berufe"],
    grammarFocus: ["Negatives", "Indefinite and negative pronouns", "Use of 'svoj'"],
    vocabularyThemes: ["Appearance", "Professions"]
  },
  {
    number: 24,
    title: "Poseta",
    titleEnglish: "Visiting places",
    titleGerman: "Orte besuchen",
    topics: ["Hotel services", "Book a hotel room"],
    topicsGerman: ["Hotelservice", "Ein Hotelzimmer buchen"],
    grammarFocus: ["Subjunctive/conditional"],
    vocabularyThemes: ["Hotel", "Accommodation"]
  },
  {
    number: 25,
    title: "(Ne)običan dan",
    titleEnglish: "(Un)usual day",
    titleGerman: "Ein (un)gewöhnlicher Tag",
    topics: ["Events of a day"],
    topicsGerman: ["Ereignisse eines Tages"],
    grammarFocus: ["Imperfective and perfective aspects"],
    vocabularyThemes: ["Daily events", "Verb aspects"]
  },
  {
    number: 26,
    title: "Iznenađenje",
    titleEnglish: "Surprise",
    titleGerman: "Überraschung",
    topics: ["Plan an evening"],
    topicsGerman: ["Einen Abend planen"],
    grammarFocus: ["Prefixed verbs of motion"],
    vocabularyThemes: ["Evening activities", "Motion verbs"]
  },
  {
    number: 27,
    title: "Šta ćeš raditi sutra?",
    titleEnglish: "What will you do tomorrow?",
    titleGerman: "Was wirst du morgen machen?",
    topics: ["Arrange a meeting", "Invite friends"],
    topicsGerman: ["Ein Treffen vereinbaren", "Freunde einladen"],
    grammarFocus: ["Verb 'hteti'", "Instrumental of personal pronouns"],
    vocabularyThemes: ["Social invitations", "Future plans"]
  }
];

/**
 * Helper function to get units data formatted for landing page
 * This replaces the redundant unitsForLanding.ts file
 */
export interface UnitForLanding {
  number: number;
  title: string;
  titleEnglish: string;
  titleGerman: string;
  vocabCount: number;
  topics: string[];
  topicsGerman: string[];
}

/**
 * Get units data for landing page with vocabulary counts
 * Requires vocabulary data to calculate counts
 */
export function getUnitsForLanding(vocabulary: Array<{ unit: number }>): UnitForLanding[] {
  // Count vocabulary per unit
  const vocabCounts = vocabulary.reduce((acc, word) => {
    acc[word.unit] = (acc[word.unit] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return COURSE_UNITS.map(unit => ({
    number: unit.number,
    title: unit.title,
    titleEnglish: unit.titleEnglish,
    titleGerman: unit.titleGerman,
    vocabCount: vocabCounts[unit.number] || 0,
    topics: unit.topics,
    topicsGerman: unit.topicsGerman
  }));
}

/**
 * Calculate total vocabulary count across all units
 */
export function getTotalVocabularyCount(vocabulary: Array<{ unit: number }>): number {
  return vocabulary.length;
}



