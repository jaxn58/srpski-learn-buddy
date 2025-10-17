export interface Unit {
  number: number;
  title: string;
  titleEnglish: string;
  page: number;
  topics: string[];
  grammarFocus: string[];
  vocabularyThemes: string[];
}

export interface Week {
  weekNumber: number;
  title: string;
  units: number[];
  goals: string[];
  practiceActivities: string[];
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

export const COURSE_WEEKS: Week[] = [
  {
    weekNumber: 1,
    title: "Getting Started with Serbian",
    units: [1],
    goals: [
      "Master the Serbian Latin alphabet",
      "Use basic greetings and polite phrases",
      "Conjugate the verb 'biti' (to be)",
      "Understand the concept of grammatical gender"
    ],
    practiceActivities: [
      "Read aloud and practice pronunciation",
      "Practice self-conversations with greetings",
      "Practice simple introductions"
    ]
  },
  {
    weekNumber: 2,
    title: "First Conversations",
    units: [2, 3],
    goals: [
      "Zahlen von 1-100 lernen",
      "Im Café bestellen können",
      "Über Sprachenlernen sprechen",
      "Den Lokativ-Fall verstehen"
    ],
    practiceActivities: [
      "Bestellungen im Café simulieren",
      "Sätze über eigenen Besitz bilden",
      "Einfache Fragen mit 'Da li' stellen"
    ]
  },
  {
    weekNumber: 3,
    title: "Sich in der Stadt orientieren",
    units: [4, 5],
    goals: [
      "Nach dem Weg fragen und Wegbeschreibungen verstehen",
      "Orte in der Stadt benennen",
      "Ein Zimmer beschreiben",
      "Den Vokativ verwenden"
    ],
    practiceActivities: [
      "Stadtplan erstellen und beschriften",
      "Practice giving directions",
      "Eigenes Zimmer auf Serbisch beschreiben"
    ]
  },
  {
    weekNumber: 4,
    title: "Alltagspraktische Konversation",
    units: [6],
    goals: [
      "Lebensmittel einkaufen",
      "Preise erfragen und verstehen",
      "'Treba' korrekt verwenden",
      "Wiederholung der ersten 6 Lektionen"
    ],
    practiceActivities: [
      "Einkaufsliste auf Serbisch erstellen",
      "Einkaufsgespräche simulieren",
      "Mini Revision Übungen bearbeiten"
    ]
  },
  {
    weekNumber: 5,
    title: "Tagesablauf und Termine",
    units: [7, 8],
    goals: [
      "Wochentage und Uhrzeiten verwenden",
      "Termine vereinbaren",
      "Im Restaurant bestellen",
      "Typische serbische Gerichte kennen"
    ],
    practiceActivities: [
      "Eigenen Wochenplan beschreiben",
      "Restaurantgespräche üben",
      "Tischreservierung simulieren"
    ]
  },
  {
    weekNumber: 6,
    title: "Die Welt des Genitivs und die Familie",
    units: [9, 10],
    goals: [
      "Den Genitiv Singular verwenden",
      "Reflexive Verben konjugieren",
      "Die Familie vorstellen",
      "Plural der Substantive bilden"
    ],
    practiceActivities: [
      "Tagesablauf detailliert beschreiben",
      "Familienstammbaum erstellen",
      "Genitivkonstruktionen üben"
    ]
  },
  {
    weekNumber: 7,
    title: "Menschen und Akkusativ",
    units: [11],
    goals: [
      "Menschen beschreiben (Charakter, Aussehen)",
      "Den Akkusativ verstehen und anwenden",
      "Possessivadjektive bilden",
      "STEP 1 Wiederholung abschließen"
    ],
    practiceActivities: [
      "Freunde und Familie beschreiben",
      "Akkusativsätze bilden",
      "STEP 1 Übungen bearbeiten"
    ]
  },
  {
    weekNumber: 8,
    title: "Nationalities and the Past",
    units: [12, 13],
    goals: [
      "Über Herkunft und Sprachen sprechen",
      "Die Vergangenheitsform (Perfekt) bilden",
      "Über vergangene Ereignisse berichten",
      "STEP 2 Wiederholung"
    ],
    practiceActivities: [
      "Über letztes Wochenende schreiben",
      "Verben in Vergangenheit konjugieren",
      "STEP 2 Übungen bearbeiten"
    ]
  },
  {
    weekNumber: 9,
    title: "Reisen, Wetter und Instrumental",
    units: [14, 15],
    goals: [
      "Über Wetter und Jahreszeiten sprechen",
      "Den Instrumental verwenden",
      "Transportmittel benennen",
      "STEP 3 Wiederholung"
    ],
    practiceActivities: [
      "Wetterbericht auf Serbisch schreiben",
      "Reisepläne beschreiben",
      "STEP 3 Übungen bearbeiten"
    ]
  },
  {
    weekNumber: 10,
    title: "The Dative, Plans and Phone Calls",
    units: [16, 17, 18],
    goals: [
      "Den Dativ verstehen und anwenden",
      "Telefongespräche führen",
      "Die Zukunftsform verwenden",
      "Über Pläne sprechen"
    ],
    practiceActivities: [
      "Wochenendpläne im Futur schreiben",
      "Telefonphrasen üben",
      "Dativkonstruktionen bilden"
    ]
  },
  {
    weekNumber: 11,
    title: "Feiern, Gesundheit und Wiederholung",
    units: [19, 20],
    goals: [
      "Über Feiern und Geburtstage sprechen",
      "Beim Arzt Symptome beschreiben",
      "Den Imperativ verwenden",
      "STEP 4 Wiederholung"
    ],
    practiceActivities: [
      "Geburtstagskarte schreiben",
      "Arztgespräche simulieren",
      "STEP 4 Übungen bearbeiten"
    ]
  },
  {
    weekNumber: 12,
    title: "Finale Themen und Ausblick",
    units: [21, 22, 23, 24, 25, 26, 27],
    goals: [
      "Kleidung einkaufen",
      "Vergleiche anstellen (Komparativ/Superlativ)",
      "Konditional verwenden",
      "Perfektive/Imperfektive Verben verstehen",
      "Einführung ins Kyrillische Alphabet"
    ],
    practiceActivities: [
      "Interessante Lektionen auswählen und vertiefen",
      "STEP 5, 6, 7 Wiederholungen",
      "Kyrillische Buchstaben lernen",
      "Texte im Anhang lesen"
    ]
  }
];

export const REVISION_STEPS = [
  { step: 1, page: 62, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { step: 2, page: 82, units: [11, 12, 13] },
  { step: 3, page: 106, units: [14, 15] },
  { step: 4, page: 134, units: [16, 17, 18, 19, 20] },
  { step: 5, page: 159, units: [21, 22] },
  { step: 6, page: 176, units: [23, 24, 25, 26] },
  { step: 7, page: 193, units: [27] }
];

