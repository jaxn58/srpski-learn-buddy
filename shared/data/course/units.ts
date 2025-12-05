export interface Unit {
  number: number;
  title: string;
  titleEnglish: string;
  page: number;
  topics: string[];
  grammarFocus: string[];
  vocabularyThemes: string[];
}

export const COURSE_UNITS: Unit[] = [
  {
    number: 1,
    title: "Na aerodromu",
    titleEnglish: "At the airport",
    page: 5,
    topics: ["Greetings and main phrases", "Gender of nouns", "Simple questions"],
    grammarFocus: ["Verb 'biti' (to be)", "Introduction to cases", "Possessives 'my', 'your'"],
    vocabularyThemes: ["Airport", "Greetings", "Basic phrases"]
  },
  {
    number: 2,
    title: "U kafeu",
    titleEnglish: "In the café",
    page: 10,
    topics: ["Making simple orders", "Cardinal numbers"],
    grammarFocus: ["Verb 'imati' (to have)", "Numbers 1-100"],
    vocabularyThemes: ["Café", "Drinks", "Food", "Numbers"]
  },
  {
    number: 3,
    title: "Kako Stiv Bond uči srpski?",
    titleEnglish: "How is Steve Bond learning Serbian?",
    page: 16,
    topics: ["Talk about learning language", "Television, newspapers, radio"],
    grammarFocus: ["Present tense verbs", "Locative case"],
    vocabularyThemes: ["Learning", "Media", "Languages"]
  },
  {
    number: 4,
    title: "Gde je…?",
    titleEnglish: "Where is…?",
    page: 20,
    topics: ["Places of interest", "Asking for and giving directions"],
    grammarFocus: ["Verb 'ići' (to go)", "Prepositions 'u' and 'na' with locative", "Vocative case"],
    vocabularyThemes: ["City places", "Directions", "Buildings"]
  },
  {
    number: 5,
    title: "U sobi",
    titleEnglish: "In the room",
    page: 27,
    topics: ["Describe a room", "Hotel services and facilities"],
    grammarFocus: ["Ordinal numbers", "Verb 'moći' (can)", "Verbs ending with –eti and –ovati"],
    vocabularyThemes: ["Room furniture", "Hotel", "Ordinal numbers"]
  },
  {
    number: 6,
    title: "Kupovina hrane",
    titleEnglish: "Shopping for food",
    page: 33,
    topics: ["Make purchases", "Deal with prices"],
    grammarFocus: ["Use of 'treba' (need)"],
    vocabularyThemes: ["Food", "Shopping", "Prices"]
  },
  {
    number: 7,
    title: "Dođite u goste",
    titleEnglish: "Come to my place",
    page: 39,
    topics: ["Receive guests", "Days of the week", "Tell the time"],
    grammarFocus: ["Time expressions", "Making appointments"],
    vocabularyThemes: ["Days", "Time", "Invitations"]
  },
  {
    number: 8,
    title: "U restoranu",
    titleEnglish: "In the restaurant",
    page: 43,
    topics: ["Order a meal", "Book a table"],
    grammarFocus: ["Restaurant vocabulary"],
    vocabularyThemes: ["Serbian menu", "Restaurant", "Food"]
  },
  {
    number: 9,
    title: "Tipičan dan",
    titleEnglish: "Daily routine",
    page: 51,
    topics: ["Talk about daily routine"],
    grammarFocus: ["Genitive case singular", "Verbs 'jesti' and 'piti'", "Reflexive verbs"],
    vocabularyThemes: ["Daily activities", "Routine"]
  },
  {
    number: 10,
    title: "Porodica",
    titleEnglish: "Family",
    page: 58,
    topics: ["Talk about family", "Personal details"],
    grammarFocus: ["Plural of nouns"],
    vocabularyThemes: ["Family members", "Personal information"]
  },
  {
    number: 11,
    title: "Ljudi",
    titleEnglish: "People",
    page: 66,
    topics: ["Characters, hobbies and work"],
    grammarFocus: ["Possessive pronouns", "Accusative case singular and plural"],
    vocabularyThemes: ["Character traits", "Hobbies", "Professions"]
  },
  {
    number: 12,
    title: "Narodi i jezici",
    titleEnglish: "Nationalities and languages",
    page: 77,
    topics: ["Nationalities and languages"],
    grammarFocus: ["Locative case of adjectives", "Use of 'koji' (which)"],
    vocabularyThemes: ["Countries", "Nationalities", "Languages"]
  },
  {
    number: 13,
    title: "Kako je bilo juče?",
    titleEnglish: "How was it yesterday?",
    page: 84,
    topics: ["Talk about the past"],
    grammarFocus: ["Past tense formation", "Past tense expressions"],
    vocabularyThemes: ["Past events", "Time expressions"]
  },
  {
    number: 14,
    title: "Vreme",
    titleEnglish: "Weather",
    page: 91,
    topics: ["Weather, seasons and months", "Points of compass"],
    grammarFocus: ["Instrumental case singular"],
    vocabularyThemes: ["Weather", "Seasons", "Months", "Compass"]
  },
  {
    number: 15,
    title: "Kako, s kim i kada putujete?",
    titleEnglish: "How, with who and when do you travel?",
    page: 99,
    topics: ["Means of travelling", "Travel preferences"],
    grammarFocus: ["Instrumental case plural", "Feminine nouns ending with consonant"],
    vocabularyThemes: ["Transport", "Travel"]
  },
  {
    number: 16,
    title: "Stivov novi stan",
    titleEnglish: "Steve's new apartment",
    page: 109,
    topics: ["Describe an apartment", "Moving to new apartment"],
    grammarFocus: ["Dative case singular", "Dative of personal pronouns"],
    vocabularyThemes: ["Apartment", "Moving", "Furniture"]
  },
  {
    number: 17,
    title: "Telefonski razgovor",
    titleEnglish: "Telephone conversation",
    page: 115,
    topics: ["Use a telephone", "Leave and receive messages"],
    grammarFocus: ["Expressions with dative case"],
    vocabularyThemes: ["Telephone", "Messages"]
  },
  {
    number: 18,
    title: "Stiv planira vikend",
    titleEnglish: "Planning a weekend",
    page: 118,
    topics: ["Talk about future plans"],
    grammarFocus: ["Future tense", "Verb 'hteti' (to want)"],
    vocabularyThemes: ["Weekend activities", "Plans"]
  },
  {
    number: 19,
    title: "Srećan rođendan!",
    titleEnglish: "Happy birthday!",
    page: 124,
    topics: ["Anniversaries and celebrations", "Planning a party"],
    grammarFocus: ["Express dates", "Genitive and accusative of personal pronouns"],
    vocabularyThemes: ["Celebrations", "Dates", "Parties"]
  },
  {
    number: 20,
    title: "Kod lekara",
    titleEnglish: "Health matters",
    page: 138,
    topics: ["Body parts", "Visit to the doctor"],
    grammarFocus: ["Verb 'boleti' (to hurt)", "Imperative"],
    vocabularyThemes: ["Body", "Health", "Doctor"]
  },
  {
    number: 21,
    title: "Boje i odeća",
    titleEnglish: "Colors and Clothes",
    page: 145,
    topics: ["Colors", "Shopping for clothes"],
    grammarFocus: ["Demonstrative pronouns 'ovaj, taj, onaj'", "Plural of locative and dative"],
    vocabularyThemes: ["Colors", "Clothes", "Shoes"]
  },
  {
    number: 22,
    title: "Šta je bolje?",
    titleEnglish: "What's better?",
    page: 153,
    topics: ["Services in cities"],
    grammarFocus: ["Comparatives and superlatives", "Plural of genitive"],
    vocabularyThemes: ["City services", "Comparisons"]
  },
  {
    number: 23,
    title: "Kako izgledaju?",
    titleEnglish: "How do they look like?",
    page: 163,
    topics: ["Describe people", "Professions"],
    grammarFocus: ["Negatives", "Indefinite and negative pronouns", "Use of 'svoj'"],
    vocabularyThemes: ["Appearance", "Professions"]
  },
  {
    number: 24,
    title: "Poseta",
    titleEnglish: "Visiting places",
    page: 172,
    topics: ["Hotel services", "Book a hotel room"],
    grammarFocus: ["Subjunctive/conditional"],
    vocabularyThemes: ["Hotel", "Accommodation"]
  },
  {
    number: 25,
    title: "(Ne)običan dan",
    titleEnglish: "(Un)usual day",
    page: 178,
    topics: ["Events of a day"],
    grammarFocus: ["Imperfective and perfective aspects"],
    vocabularyThemes: ["Daily events", "Verb aspects"]
  },
  {
    number: 26,
    title: "Iznenađenje",
    titleEnglish: "Surprise",
    page: 186,
    topics: ["Plan an evening"],
    grammarFocus: ["Prefixed verbs of motion"],
    vocabularyThemes: ["Evening activities", "Motion verbs"]
  },
  {
    number: 27,
    title: "Šta ćeš raditi sutra?",
    titleEnglish: "What will you do tomorrow?",
    page: 190,
    topics: ["Arrange a meeting", "Invite friends"],
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
  vocabCount: number;
  topics: string[];
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
    vocabCount: vocabCounts[unit.number] || 0,
    topics: unit.topics
  }));
}

/**
 * Calculate total vocabulary count across all units
 */
export function getTotalVocabularyCount(vocabulary: Array<{ unit: number }>): number {
  return vocabulary.length;
}



