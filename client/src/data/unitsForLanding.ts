// Unit data for landing page with vocabulary counts
export const UNITS_DATA = [
  { number: 1, title: "Na aerodromu", titleEnglish: "At the airport", vocabCount: 197, topics: ["Greetings", "Gender of nouns", "Simple questions"] },
  { number: 2, title: "U kafeu", titleEnglish: "In the café", vocabCount: 134, topics: ["Making orders", "Numbers 1-100"] },
  { number: 3, title: "Kako Stiv Bond uči srpski?", titleEnglish: "Learning Serbian", vocabCount: 14, topics: ["Language learning", "Media"] },
  { number: 4, title: "Gde je…?", titleEnglish: "Where is…?", vocabCount: 18, topics: ["Places", "Directions"] },
  { number: 5, title: "U sobi", titleEnglish: "In the room", vocabCount: 16, topics: ["Room description", "Hotel services"] },
  { number: 6, title: "Kupovina hrane", titleEnglish: "Shopping for food", vocabCount: 15, topics: ["Food", "Prices"] },
  { number: 7, title: "Dođite u goste", titleEnglish: "Come to my place", vocabCount: 13, topics: ["Days", "Time", "Invitations"] },
  { number: 8, title: "U restoranu", titleEnglish: "In the restaurant", vocabCount: 20, topics: ["Ordering meals", "Serbian menu"] },
  { number: 9, title: "Tipičan dan", titleEnglish: "Daily routine", vocabCount: 17, topics: ["Daily activities", "Reflexive verbs"] },
  { number: 10, title: "Porodica", titleEnglish: "Family", vocabCount: 17, topics: ["Family members", "Personal details"] },
  { number: 11, title: "Ljudi", titleEnglish: "People", vocabCount: 18, topics: ["Character", "Hobbies", "Work"] },
  { number: 12, title: "Narodi i jezici", titleEnglish: "Nationalities and languages", vocabCount: 19, topics: ["Countries", "Languages"] },
  { number: 13, title: "Kako je bilo juče?", titleEnglish: "How was yesterday?", vocabCount: 14, topics: ["Past tense", "Past events"] },
  { number: 14, title: "Vreme", titleEnglish: "Weather", vocabCount: 31, topics: ["Weather", "Seasons", "Months"] },
  { number: 15, title: "Kako, s kim i kada putujete?", titleEnglish: "Travel", vocabCount: 16, topics: ["Transport", "Travel preferences"] },
  { number: 16, title: "Stivov novi stan", titleEnglish: "Steve's new apartment", vocabCount: 21, topics: ["Apartment", "Moving", "Furniture"] },
  { number: 17, title: "Telefonski razgovor", titleEnglish: "Telephone conversation", vocabCount: 13, topics: ["Phone calls", "Messages"] },
  { number: 18, title: "Stiv planira vikend", titleEnglish: "Planning a weekend", vocabCount: 12, topics: ["Future plans", "Weekend"] },
  { number: 19, title: "Srećan rođendan!", titleEnglish: "Happy birthday!", vocabCount: 13, topics: ["Celebrations", "Dates", "Parties"] },
  { number: 20, title: "Kod lekara", titleEnglish: "Health matters", vocabCount: 21, topics: ["Body parts", "Doctor visit"] },
  { number: 21, title: "Boje i odeća", titleEnglish: "Colors and clothes", vocabCount: 24, topics: ["Colors", "Shopping for clothes"] },
  { number: 22, title: "Šta je bolje?", titleEnglish: "What's better?", vocabCount: 16, topics: ["City services", "Comparisons"] },
  { number: 23, title: "Kako izgledaju?", titleEnglish: "How do they look?", vocabCount: 15, topics: ["Appearance", "Professions"] },
  { number: 24, title: "Poseta", titleEnglish: "Visiting places", vocabCount: 12, topics: ["Hotel services", "Accommodation"] },
  { number: 25, title: "(Ne)običan dan", titleEnglish: "(Un)usual day", vocabCount: 10, topics: ["Daily events", "Verb aspects"] },
  { number: 26, title: "Iznenađenje", titleEnglish: "Surprise", vocabCount: 10, topics: ["Evening activities", "Motion verbs"] },
  { number: 27, title: "Šta ćeš raditi sutra?", titleEnglish: "Tomorrow", vocabCount: 11, topics: ["Social invitations", "Future plans"] },
];

export const TOTAL_VOCABULARY = UNITS_DATA.reduce((sum, unit) => sum + unit.vocabCount, 0);

