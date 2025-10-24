// Detailed explanations for all 27 units with examples suitable for 12-year-olds

export type GrammarExplanation = {
  topic: string;
  simpleExplanation: string;
  examples: {
    serbian: string;
    english: string;
    explanation: string;
  }[];
  comparisonToEnglish?: string;
};

export type UnitExplanation = {
  unitNumber: number;
  overview: string;
  grammarExplanations: GrammarExplanation[];
  practicalExamples: {
    situation: string;
    dialogue: {
      serbian: string;
      english: string;
    }[];
  }[];
};

export const UNIT_EXPLANATIONS: UnitExplanation[] = [
  // UNIT 1
  {
    unitNumber: 1,
    overview: "In this unit, you'll learn how to greet people and introduce yourself at the airport. It's like learning how to say 'hello' and 'my name is...' but in Serbian!",
    grammarExplanations: [
      {
        topic: "Verb 'biti' (to be)",
        simpleExplanation: "Just like in English we say 'I am', 'you are', 'he is', Serbian has its own way. The verb 'biti' means 'to be' and it changes depending on who you're talking about.",
        examples: [
          {
            serbian: "Ja sam student",
            english: "I am a student",
            explanation: "'Sam' is like 'am' in English - it's the 'I' form of 'to be'"
          },
          {
            serbian: "Ti si turist",
            english: "You are a tourist",
            explanation: "'Si' is like 'are' when talking to one person you know well"
          },
          {
            serbian: "On je pilot",
            english: "He is a pilot",
            explanation: "'Je' is like 'is' - used for he, she, or it"
          }
        ],
        comparisonToEnglish: "In English we say 'I am, you are, he is'. In Serbian it's 'ja sam, ti si, on je'. The words change just like in English!"
      },
      {
        topic: "Gender of Nouns",
        simpleExplanation: "In Serbian, every noun (thing or person) is either masculine (boy-like), feminine (girl-like), or neuter (neither). It's like how in English we say 'he' for boys and 'she' for girls, but in Serbian EVERYTHING has a gender!",
        examples: [
          {
            serbian: "aerodrom (masculine)",
            english: "airport",
            explanation: "Words ending in a consonant are usually masculine"
          },
          {
            serbian: "karta (feminine)",
            english: "ticket",
            explanation: "Words ending in -a are usually feminine"
          },
          {
            serbian: "ime (neuter)",
            english: "name",
            explanation: "Words ending in -o or -e are usually neuter"
          }
        ],
        comparisonToEnglish: "English doesn't really have this - we just say 'the ticket', 'the airport'. But in Serbian, you need to remember if it's masculine, feminine, or neuter!"
      }
    ],
    practicalExamples: [
      {
        situation: "Meeting someone at the airport",
        dialogue: [
          { serbian: "Dobar dan!", english: "Good day!" },
          { serbian: "Ja sam Ana. Kako se zovete?", english: "I am Ana. What's your name?" },
          { serbian: "Ja sam Marko. Drago mi je.", english: "I am Marko. Nice to meet you." },
          { serbian: "Odakle ste?", english: "Where are you from?" },
          { serbian: "Ja sam iz Amerike.", english: "I am from America." }
        ]
      }
    ]
  },

  // UNIT 2
  {
    unitNumber: 2,
    overview: "Time for coffee! You'll learn how to order drinks and food at a café, and count numbers. Perfect for when you're hungry!",
    grammarExplanations: [
      {
        topic: "Verb 'imati' (to have)",
        simpleExplanation: "This verb means 'to have', like when you say 'I have coffee' or 'Do you have tea?' It's super useful!",
        examples: [
          {
            serbian: "Ja imam kafu",
            english: "I have coffee",
            explanation: "'Imam' means 'I have'"
          },
          {
            serbian: "Da li imate čaj?",
            english: "Do you have tea?",
            explanation: "'Imate' is 'you have' (polite form)"
          },
          {
            serbian: "On ima sok",
            english: "He has juice",
            explanation: "'Ima' is 'has' for he/she/it"
          }
        ],
        comparisonToEnglish: "Just like English 'I have, you have, he has', Serbian has 'ja imam, ti imaš, on ima'!"
      },
      {
        topic: "Numbers 1-100",
        simpleExplanation: "You need to know numbers to order things and pay! Let's learn Serbian numbers.",
        examples: [
          {
            serbian: "jedan, dva, tri",
            english: "one, two, three",
            explanation: "The first three numbers"
          },
          {
            serbian: "Dve kafe, molim",
            english: "Two coffees, please",
            explanation: "'Dve' is 'two' for feminine things"
          },
          {
            serbian: "Pet dinara",
            english: "Five dinars",
            explanation: "Serbian money is called 'dinar'"
          }
        ],
        comparisonToEnglish: "Numbers work similarly, but in Serbian they change slightly based on what you're counting!"
      }
    ],
    practicalExamples: [
      {
        situation: "Ordering at a café",
        dialogue: [
          { serbian: "Dobar dan! Šta želite?", english: "Good day! What would you like?" },
          { serbian: "Jednu kafu, molim.", english: "One coffee, please." },
          { serbian: "Sa mlekom?", english: "With milk?" },
          { serbian: "Da, hvala.", english: "Yes, thank you." },
          { serbian: "Koliko košta?", english: "How much does it cost?" },
          { serbian: "Sto dinara.", english: "One hundred dinars." }
        ]
      }
    ]
  },

  // UNIT 3
  {
    unitNumber: 3,
    overview: "Learn how to talk about learning Serbian! You'll discuss how you study, what you read, and what you watch.",
    grammarExplanations: [
      {
        topic: "Present Tense Verbs",
        simpleExplanation: "These are action words that tell us what someone is doing RIGHT NOW. Like 'I learn', 'you read', 'he watches'.",
        examples: [
          {
            serbian: "Ja učim srpski",
            english: "I learn Serbian",
            explanation: "'Učim' means 'I learn' - it's happening now!"
          },
          {
            serbian: "Ti čitaš novine",
            english: "You read newspapers",
            explanation: "'Čitaš' means 'you read'"
          },
          {
            serbian: "On gleda televiziju",
            english: "He watches television",
            explanation: "'Gleda' means 'watches'"
          }
        ],
        comparisonToEnglish: "In English we say 'I learn, you learn, he learns'. Serbian verbs change their endings: učim, učiš, uči."
      },
      {
        topic: "Locative Case",
        simpleExplanation: "This is used when you talk about WHERE something is happening. It's like saying 'in the newspaper' or 'on TV' - the word changes a little!",
        examples: [
          {
            serbian: "u novinama",
            english: "in newspapers",
            explanation: "'Novine' becomes 'novinama' when you say 'in newspapers'"
          },
          {
            serbian: "na televiziji",
            english: "on television",
            explanation: "'Televizija' becomes 'televiziji' after 'na' (on)"
          },
          {
            serbian: "u školi",
            english: "in school",
            explanation: "'Škola' becomes 'školi' when you say 'in school'"
          }
        ],
        comparisonToEnglish: "English just uses 'in' or 'on' and the word stays the same. In Serbian, the word itself changes!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about learning Serbian",
        dialogue: [
          { serbian: "Kako učiš srpski?", english: "How do you learn Serbian?" },
          { serbian: "Čitam knjige i gledam filmove.", english: "I read books and watch movies." },
          { serbian: "Slušaš li radio?", english: "Do you listen to the radio?" },
          { serbian: "Da, slušam srpski radio svaki dan.", english: "Yes, I listen to Serbian radio every day." }
        ]
      }
    ]
  },

  // UNIT 4
  {
    unitNumber: 4,
    overview: "Lost in the city? Learn how to ask for directions and find places! You'll be able to ask 'Where is...?' and understand answers.",
    grammarExplanations: [
      {
        topic: "Verb 'ići' (to go)",
        simpleExplanation: "This verb means 'to go' - super important when you're moving around the city!",
        examples: [
          {
            serbian: "Ja idem u školu",
            english: "I go to school",
            explanation: "'Idem' means 'I go'"
          },
          {
            serbian: "Ti ideš u park",
            english: "You go to the park",
            explanation: "'Ideš' means 'you go'"
          },
          {
            serbian: "Oni idu u bioskop",
            english: "They go to the cinema",
            explanation: "'Idu' means 'they go'"
          }
        ],
        comparisonToEnglish: "Like English 'I go, you go, they go', but the verb changes more: idem, ideš, idu."
      },
      {
        topic: "Prepositions 'u' and 'na'",
        simpleExplanation: "These little words mean 'to' or 'in/on'. You use 'u' for enclosed places (like buildings) and 'na' for open places or surfaces.",
        examples: [
          {
            serbian: "Idem u školu",
            english: "I'm going to school",
            explanation: "Use 'u' because school is a building (enclosed)"
          },
          {
            serbian: "Idem na trg",
            english: "I'm going to the square",
            explanation: "Use 'na' because a square is an open space"
          },
          {
            serbian: "Idem na poštu",
            english: "I'm going to the post office",
            explanation: "Some places just use 'na' - you have to memorize these!"
          }
        ],
        comparisonToEnglish: "English just uses 'to' for everything. Serbian is pickier - you need to choose between 'u' and 'na'!"
      }
    ],
    practicalExamples: [
      {
        situation: "Asking for directions",
        dialogue: [
          { serbian: "Izvinite, gde je pošta?", english: "Excuse me, where is the post office?" },
          { serbian: "Idite pravo, pa levo.", english: "Go straight, then left." },
          { serbian: "Daleko li je?", english: "Is it far?" },
          { serbian: "Ne, pet minuta peške.", english: "No, five minutes on foot." },
          { serbian: "Hvala vam!", english: "Thank you!" }
        ]
      }
    ]
  },

  // UNIT 5
  {
    unitNumber: 5,
    overview: "Describe your hotel room and talk about what you can do there. Learn about furniture and hotel services!",
    grammarExplanations: [
      {
        topic: "Ordinal Numbers",
        simpleExplanation: "These are numbers that show order or position: first, second, third. You use them for floors, dates, and rankings!",
        examples: [
          {
            serbian: "prvi sprat",
            english: "first floor",
            explanation: "'Prvi' means 'first'"
          },
          {
            serbian: "druga soba",
            english: "second room",
            explanation: "'Druga' means 'second' (for feminine nouns)"
          },
          {
            serbian: "treći dan",
            english: "third day",
            explanation: "'Treći' means 'third'"
          }
        ],
        comparisonToEnglish: "Like English first, second, third - but in Serbian they change based on gender (prvi/prva/prvo)!"
      },
      {
        topic: "Verb 'moći' (can)",
        simpleExplanation: "This verb means 'can' or 'to be able to'. Use it when you want to say what you CAN do!",
        examples: [
          {
            serbian: "Mogu da plivam",
            english: "I can swim",
            explanation: "'Mogu' means 'I can'"
          },
          {
            serbian: "Možeš li mi pomoći?",
            english: "Can you help me?",
            explanation: "'Možeš' means 'you can'"
          },
          {
            serbian: "Ne mogu da dođem",
            english: "I cannot come",
            explanation: "Add 'ne' before 'mogu' to say 'cannot'"
          }
        ],
        comparisonToEnglish: "Just like English 'I can, you can' - but Serbian says 'mogu, možeš'!"
      }
    ],
    practicalExamples: [
      {
        situation: "Describing your hotel room",
        dialogue: [
          { serbian: "Kakva je vaša soba?", english: "What is your room like?" },
          { serbian: "Soba je na trećem spratu.", english: "The room is on the third floor." },
          { serbian: "Ima veliki krevet i televizor.", english: "It has a big bed and TV." },
          { serbian: "Mogu li koristiti bazen?", english: "Can I use the pool?" },
          { serbian: "Da, bazen je otvoren.", english: "Yes, the pool is open." }
        ]
      }
    ]
  },

  // UNIT 6
  {
    unitNumber: 6,
    overview: "Go shopping for food! Learn how to buy groceries, ask for prices, and say what you need.",
    grammarExplanations: [
      {
        topic: "Use of 'treba' (need)",
        simpleExplanation: "'Treba' means 'need' or 'should'. It's a special word that doesn't change - super easy!",
        examples: [
          {
            serbian: "Treba mi hleb",
            english: "I need bread",
            explanation: "'Treba mi' means 'I need' (literally: 'it is needed to me')"
          },
          {
            serbian: "Treba ti voda",
            english: "You need water",
            explanation: "'Treba ti' means 'you need'"
          },
          {
            serbian: "Treba nam mleko",
            english: "We need milk",
            explanation: "'Treba nam' means 'we need'"
          }
        ],
        comparisonToEnglish: "English says 'I need, you need, we need'. Serbian uses 'treba' + different little words (mi, ti, nam)!"
      }
    ],
    practicalExamples: [
      {
        situation: "Shopping at a market",
        dialogue: [
          { serbian: "Dobar dan! Šta vam treba?", english: "Good day! What do you need?" },
          { serbian: "Treba mi hleb i mleko.", english: "I need bread and milk." },
          { serbian: "Koliko košta hleb?", english: "How much does bread cost?" },
          { serbian: "Pedeset dinara.", english: "Fifty dinars." },
          { serbian: "Dobro, uzeću dva hleba.", english: "Good, I'll take two breads." }
        ]
      }
    ]
  },

  // UNIT 7
  {
    unitNumber: 7,
    overview: "Invite friends over! Learn days of the week, how to tell time, and make plans with people.",
    grammarExplanations: [
      {
        topic: "Days of the Week",
        simpleExplanation: "Learn the seven days so you can make plans and talk about your schedule!",
        examples: [
          {
            serbian: "ponedeljak, utorak, sreda",
            english: "Monday, Tuesday, Wednesday",
            explanation: "The first three days of the week"
          },
          {
            serbian: "U ponedeljak idem u školu",
            english: "On Monday I go to school",
            explanation: "Use 'u' before the day to say 'on Monday'"
          },
          {
            serbian: "Viđamo se u subotu",
            english: "We'll see each other on Saturday",
            explanation: "'Subota' is Saturday"
          }
        ],
        comparisonToEnglish: "Days work similarly to English, but you say 'u ponedeljak' (in Monday) instead of 'on Monday'!"
      },
      {
        topic: "Telling Time",
        simpleExplanation: "Learn how to say what time it is and when things happen!",
        examples: [
          {
            serbian: "Sada je tri sata",
            english: "It's three o'clock now",
            explanation: "'Sada' means 'now', 'sata' means 'o'clock'"
          },
          {
            serbian: "U pet sati",
            english: "At five o'clock",
            explanation: "Use 'u' to say 'at' a specific time"
          },
          {
            serbian: "Pola šest",
            english: "Half past five",
            explanation: "'Pola' means 'half' - but it refers to half TO the next hour!"
          }
        ],
        comparisonToEnglish: "Careful! 'Pola šest' means 5:30, not 6:30. It's 'half to six', not 'half past six'!"
      }
    ],
    practicalExamples: [
      {
        situation: "Inviting someone over",
        dialogue: [
          { serbian: "Dođi u goste u subotu!", english: "Come visit on Saturday!" },
          { serbian: "U koliko sati?", english: "At what time?" },
          { serbian: "U šest sati uveče.", english: "At six o'clock in the evening." },
          { serbian: "Odlično! Doći ću.", english: "Great! I'll come." }
        ]
      }
    ]
  },

  // UNIT 8
  {
    unitNumber: 8,
    overview: "Hungry? Learn how to order food at a restaurant, book a table, and understand a Serbian menu!",
    grammarExplanations: [
      {
        topic: "Restaurant Vocabulary",
        simpleExplanation: "Learn the special words you need to know when eating out!",
        examples: [
          {
            serbian: "Želim da rezervišem sto",
            english: "I want to reserve a table",
            explanation: "'Rezervišem' means 'to reserve'"
          },
          {
            serbian: "Mogu li da vidim meni?",
            english: "Can I see the menu?",
            explanation: "'Meni' means 'menu'"
          },
          {
            serbian: "Račun, molim",
            english: "The bill, please",
            explanation: "'Račun' means 'bill' or 'check'"
          }
        ],
        comparisonToEnglish: "Restaurant phrases are similar in both languages - polite requests and questions!"
      }
    ],
    practicalExamples: [
      {
        situation: "Ordering at a restaurant",
        dialogue: [
          { serbian: "Dobar dan! Imate li slobodan sto?", english: "Good day! Do you have a free table?" },
          { serbian: "Da, izvolite. Šta želite da naručite?", english: "Yes, please. What would you like to order?" },
          { serbian: "Pileću supu i ćevape, molim.", english: "Chicken soup and ćevapi, please." },
          { serbian: "I za piće?", english: "And to drink?" },
          { serbian: "Jednu vodu, molim.", english: "One water, please." }
        ]
      }
    ]
  },

  // UNIT 9
  {
    unitNumber: 9,
    overview: "Talk about your daily routine! What do you do every day from morning to night?",
    grammarExplanations: [
      {
        topic: "Genitive Case Singular",
        simpleExplanation: "This case shows possession (like 'of' in English) or is used after certain words. The word ending changes!",
        examples: [
          {
            serbian: "šolja kafe",
            english: "a cup of coffee",
            explanation: "'Kafa' becomes 'kafe' to mean 'of coffee'"
          },
          {
            serbian: "nema vremena",
            english: "there's no time",
            explanation: "After 'nema' (there isn't), use genitive: 'vreme' becomes 'vremena'"
          },
          {
            serbian: "iz škole",
            english: "from school",
            explanation: "After 'iz' (from), use genitive: 'škola' becomes 'škole'"
          }
        ],
        comparisonToEnglish: "English uses 'of' or 'from' and keeps the word the same. Serbian changes the word ending!"
      },
      {
        topic: "Reflexive Verbs",
        simpleExplanation: "These verbs have 'se' attached - they describe actions you do to yourself, like 'I wash myself' or 'I get dressed'.",
        examples: [
          {
            serbian: "Ja se umivam",
            english: "I wash myself",
            explanation: "'Se' shows you're doing it to yourself"
          },
          {
            serbian: "Ti se oblačiš",
            english: "You get dressed",
            explanation: "'Oblačiš se' means 'you dress yourself'"
          },
          {
            serbian: "On se budi u sedam",
            english: "He wakes up at seven",
            explanation: "'Budi se' means 'wakes himself up'"
          }
        ],
        comparisonToEnglish: "English sometimes says 'myself' but often drops it. Serbian ALWAYS uses 'se' for these verbs!"
      }
    ],
    practicalExamples: [
      {
        situation: "Describing your morning routine",
        dialogue: [
          { serbian: "Kada se budiš?", english: "When do you wake up?" },
          { serbian: "Budim se u sedam sati.", english: "I wake up at seven o'clock." },
          { serbian: "Šta radiš ujutru?", english: "What do you do in the morning?" },
          { serbian: "Umivam se, doručkujem i idem na posao.", english: "I wash up, have breakfast, and go to work." }
        ]
      }
    ]
  },

  // UNIT 10
  {
    unitNumber: 10,
    overview: "Talk about your family! Learn how to describe family members and their relationships.",
    grammarExplanations: [
      {
        topic: "Plural of Nouns",
        simpleExplanation: "When you have more than one thing, the word changes. Like 'cat' becomes 'cats' in English!",
        examples: [
          {
            serbian: "brat → braća",
            english: "brother → brothers",
            explanation: "Masculine nouns often add -i or change completely"
          },
          {
            serbian: "sestra → sestre",
            english: "sister → sisters",
            explanation: "Feminine nouns ending in -a change to -e"
          },
          {
            serbian: "dete → deca",
            english: "child → children",
            explanation: "Some words change completely (irregular plurals)"
          }
        ],
        comparisonToEnglish: "English usually adds -s. Serbian has different endings based on gender and sometimes changes the whole word!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about family",
        dialogue: [
          { serbian: "Imaš li braću i sestre?", english: "Do you have brothers and sisters?" },
          { serbian: "Da, imam jednog brata i dve sestre.", english: "Yes, I have one brother and two sisters." },
          { serbian: "Koliko godina ima tvoj brat?", english: "How old is your brother?" },
          { serbian: "On ima dvadeset godina.", english: "He is twenty years old." }
        ]
      }
    ]
  },

  // UNIT 11
  {
    unitNumber: 11,
    overview: "Describe people's personalities, hobbies, and jobs. What are they like? What do they do?",
    grammarExplanations: [
      {
        topic: "Possessive Pronouns",
        simpleExplanation: "These words show who something belongs to: my, your, his, her, our, their.",
        examples: [
          {
            serbian: "moj brat",
            english: "my brother",
            explanation: "'Moj' means 'my' for masculine nouns"
          },
          {
            serbian: "tvoja sestra",
            english: "your sister",
            explanation: "'Tvoja' means 'your' for feminine nouns"
          },
          {
            serbian: "naša kuća",
            english: "our house",
            explanation: "'Naša' means 'our' for feminine nouns"
          }
        ],
        comparisonToEnglish: "English keeps 'my, your' the same always. Serbian changes them based on the gender of the thing owned!"
      },
      {
        topic: "Accusative Case",
        simpleExplanation: "This case is used for the direct object - the thing receiving the action. Like 'I see HIM' or 'I love COFFEE'.",
        examples: [
          {
            serbian: "Vidim brata",
            english: "I see (my) brother",
            explanation: "'Brat' becomes 'brata' when he's the object"
          },
          {
            serbian: "Volim muziku",
            english: "I love music",
            explanation: "'Muzika' becomes 'muziku' as the object"
          },
          {
            serbian: "Imam prijatelja",
            english: "I have a friend",
            explanation: "'Prijatelj' becomes 'prijatelja'"
          }
        ],
        comparisonToEnglish: "English word order shows the object. Serbian changes the word ending AND uses flexible word order!"
      }
    ],
    practicalExamples: [
      {
        situation: "Describing a friend",
        dialogue: [
          { serbian: "Kakav je tvoj prijatelj?", english: "What is your friend like?" },
          { serbian: "On je veoma ljubazan i duhovit.", english: "He is very kind and funny." },
          { serbian: "Čime se bavi?", english: "What does he do?" },
          { serbian: "On je programer. Voli računare.", english: "He is a programmer. He loves computers." }
        ]
      }
    ]
  },

  // UNIT 12
  {
    unitNumber: 12,
    overview: "Learn about countries, nationalities, and languages. Where are you from? What language do you speak?",
    grammarExplanations: [
      {
        topic: "Nationalities and Languages",
        simpleExplanation: "Learn how to say where you're from and what languages you speak!",
        examples: [
          {
            serbian: "Ja sam Amerikanac",
            english: "I am American (male)",
            explanation: "Nationality changes for male/female: Amerikanac/Amerikanka"
          },
          {
            serbian: "Govorim engleski",
            english: "I speak English",
            explanation: "Language names are usually lowercase"
          },
          {
            serbian: "Ona je iz Srbije",
            english: "She is from Serbia",
            explanation: "'Iz' means 'from' (a country)"
          }
        ],
        comparisonToEnglish: "English uses capital letters for nationalities and languages. Serbian uses lowercase for languages!"
      },
      {
        topic: "Use of 'koji' (which)",
        simpleExplanation: "'Koji' means 'which' or 'that' - used to ask questions or connect ideas.",
        examples: [
          {
            serbian: "Koji jezik govoriš?",
            english: "Which language do you speak?",
            explanation: "'Koji' asks 'which' for masculine nouns"
          },
          {
            serbian: "Koja je tvoja nacionalnost?",
            english: "What is your nationality?",
            explanation: "'Koja' is 'which' for feminine nouns"
          },
          {
            serbian: "Čovek koji govori srpski",
            english: "The man who speaks Serbian",
            explanation: "'Koji' can also mean 'who' or 'that'"
          }
        ],
        comparisonToEnglish: "Like English 'which/who/that', but changes based on gender: koji/koja/koje!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about languages",
        dialogue: [
          { serbian: "Odakle si?", english: "Where are you from?" },
          { serbian: "Ja sam iz Kanade.", english: "I am from Canada." },
          { serbian: "Koje jezike govoriš?", english: "Which languages do you speak?" },
          { serbian: "Govorim engleski i francuski.", english: "I speak English and French." },
          { serbian: "Učiš li srpski?", english: "Are you learning Serbian?" },
          { serbian: "Da, učim srpski već tri meseca.", english: "Yes, I've been learning Serbian for three months." }
        ]
      }
    ]
  },

  // UNIT 13
  {
    unitNumber: 13,
    overview: "Talk about the past! What did you do yesterday? Last week? Learn to tell stories about what happened.",
    grammarExplanations: [
      {
        topic: "Past Tense Formation",
        simpleExplanation: "To talk about things that already happened, you use past tense. In Serbian, you combine a helping word with the past form!",
        examples: [
          {
            serbian: "Ja sam radio",
            english: "I worked (male speaking)",
            explanation: "'Sam' + 'radio' = I worked. Use 'radio' if you're male"
          },
          {
            serbian: "Ja sam radila",
            english: "I worked (female speaking)",
            explanation: "Use 'radila' if you're female"
          },
          {
            serbian: "Ti si išao u školu",
            english: "You went to school",
            explanation: "'Si' + 'išao' = you went"
          },
          {
            serbian: "On je jeo",
            english: "He ate",
            explanation: "'Je' + 'jeo' = he ate"
          }
        ],
        comparisonToEnglish: "English adds -ed (worked, walked). Serbian uses 'sam/si/je' + special past form that changes for male/female!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about yesterday",
        dialogue: [
          { serbian: "Šta si radio juče?", english: "What did you do yesterday?" },
          { serbian: "Išao sam u bioskop.", english: "I went to the cinema." },
          { serbian: "Koji film si gledao?", english: "Which movie did you watch?" },
          { serbian: "Gledao sam novu komediju.", english: "I watched a new comedy." },
          { serbian: "Da li ti se dopao?", english: "Did you like it?" },
          { serbian: "Da, bio je odličan!", english: "Yes, it was excellent!" }
        ]
      }
    ]
  },

  // UNIT 14
  {
    unitNumber: 14,
    overview: "Talk about weather, seasons, and months! Is it hot or cold? Rainy or sunny?",
    grammarExplanations: [
      {
        topic: "Weather Expressions",
        simpleExplanation: "Learn special phrases to describe the weather!",
        examples: [
          {
            serbian: "Hladno je",
            english: "It's cold",
            explanation: "Use 'je' (is) + adjective"
          },
          {
            serbian: "Pada kiša",
            english: "It's raining",
            explanation: "Literally 'rain is falling'"
          },
          {
            serbian: "Sunčano je",
            english: "It's sunny",
            explanation: "'Sunčano' comes from 'sunce' (sun)"
          }
        ],
        comparisonToEnglish: "English says 'it is raining'. Serbian says 'rain is falling' (pada kiša)!"
      },
      {
        topic: "Instrumental Case Singular",
        simpleExplanation: "This case is used to show HOW something is done or WITH what. Also used for seasons!",
        examples: [
          {
            serbian: "Pišem olovkom",
            english: "I write with a pencil",
            explanation: "'Olovka' becomes 'olovkom' to mean 'with a pencil'"
          },
          {
            serbian: "Zimi je hladno",
            english: "In winter it's cold",
            explanation: "'Zima' becomes 'zimi' for 'in winter'"
          },
          {
            serbian: "Putujem autobusom",
            english: "I travel by bus",
            explanation: "'Autobus' becomes 'autobusom'"
          }
        ],
        comparisonToEnglish: "English uses 'with' or 'by' and keeps the word same. Serbian changes the word ending!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about weather",
        dialogue: [
          { serbian: "Kakvo je vreme danas?", english: "What's the weather like today?" },
          { serbian: "Hladno je i pada kiša.", english: "It's cold and it's raining." },
          { serbian: "Koja je tvoja omiljena sezona?", english: "What's your favorite season?" },
          { serbian: "Volim leto. Leti je toplo i sunčano.", english: "I love summer. In summer it's warm and sunny." }
        ]
      }
    ]
  },

  // UNIT 15
  {
    unitNumber: 15,
    overview: "How do you travel? By car, train, or plane? Talk about transportation and travel preferences!",
    grammarExplanations: [
      {
        topic: "Instrumental Case Plural",
        simpleExplanation: "When you travel WITH multiple people or BY multiple means, use instrumental plural!",
        examples: [
          {
            serbian: "Putujem sa prijateljima",
            english: "I travel with friends",
            explanation: "'Prijatelji' becomes 'prijateljima' after 'sa' (with)"
          },
          {
            serbian: "Vozim se autobusima",
            english: "I ride by buses",
            explanation: "'Autobusi' becomes 'autobusima'"
          }
        ],
        comparisonToEnglish: "English just adds 'with friends'. Serbian changes 'prijatelji' to 'prijateljima'!"
      }
    ],
    practicalExamples: [
      {
        situation: "Discussing travel",
        dialogue: [
          { serbian: "Kako putuješ na posao?", english: "How do you travel to work?" },
          { serbian: "Putujem autobusom.", english: "I travel by bus." },
          { serbian: "Sa kim putuješ na odmor?", english: "Who do you travel with on vacation?" },
          { serbian: "Putujem sa porodicom.", english: "I travel with family." }
        ]
      }
    ]
  },

  // UNIT 16
  {
    unitNumber: 16,
    overview: "Moving to a new apartment! Describe rooms, furniture, and talk about your new place.",
    grammarExplanations: [
      {
        topic: "Dative Case Singular",
        simpleExplanation: "This case shows TO WHOM or FOR WHOM something is done. Like 'I give TO him' or 'I buy FOR her'.",
        examples: [
          {
            serbian: "Dajem knjige bratu",
            english: "I give books to (my) brother",
            explanation: "'Brat' becomes 'bratu' to mean 'to brother'"
          },
          {
            serbian: "Pišem majci",
            english: "I write to (my) mother",
            explanation: "'Majka' becomes 'majci'"
          },
          {
            serbian: "Kupujem poklon sestri",
            english: "I buy a gift for (my) sister",
            explanation: "'Sestra' becomes 'sestri'"
          }
        ],
        comparisonToEnglish: "English uses 'to' or 'for' and keeps the word same. Serbian changes the ending!"
      }
    ],
    practicalExamples: [
      {
        situation: "Talking about your apartment",
        dialogue: [
          { serbian: "Kakav je tvoj novi stan?", english: "What's your new apartment like?" },
          { serbian: "Velik je. Ima tri sobe.", english: "It's big. It has three rooms." },
          { serbian: "Šta imaš u dnevnoj sobi?", english: "What do you have in the living room?" },
          { serbian: "Imam sofu, sto i televizor.", english: "I have a sofa, table, and TV." }
        ]
      }
    ]
  },

  // UNIT 17
  {
    unitNumber: 17,
    overview: "Make phone calls in Serbian! Learn how to answer, leave messages, and have phone conversations.",
    grammarExplanations: [
      {
        topic: "Telephone Expressions",
        simpleExplanation: "Special phrases used when talking on the phone!",
        examples: [
          {
            serbian: "Halo, ko govori?",
            english: "Hello, who's speaking?",
            explanation: "Standard way to answer the phone"
          },
          {
            serbian: "Mogu li da razgovaram sa...?",
            english: "Can I speak with...?",
            explanation: "How to ask for someone"
          },
          {
            serbian: "Ostavi poruku",
            english: "Leave a message",
            explanation: "'Poruka' means 'message'"
          }
        ],
        comparisonToEnglish: "Phone phrases are similar but Serbian uses 'ko govori' (who speaks) instead of 'who is this'!"
      }
    ],
    practicalExamples: [
      {
        situation: "Phone conversation",
        dialogue: [
          { serbian: "Halo?", english: "Hello?" },
          { serbian: "Dobar dan, mogu li da razgovaram sa Markom?", english: "Good day, can I speak with Marko?" },
          { serbian: "Trenutak, molim.", english: "One moment, please." },
          { serbian: "Žao mi je, on nije tu.", english: "I'm sorry, he's not here." },
          { serbian: "Možete li da mu prenesete poruku?", english: "Can you give him a message?" }
        ]
      }
    ]
  },

  // UNIT 18
  {
    unitNumber: 18,
    overview: "Make plans for the future! What will you do this weekend? Next month?",
    grammarExplanations: [
      {
        topic: "Future Tense",
        simpleExplanation: "To talk about things that WILL happen, you use future tense. Add 'ću/ćeš/će' before the verb!",
        examples: [
          {
            serbian: "Ja ću ići",
            english: "I will go",
            explanation: "'Ću' means 'will' for 'I'"
          },
          {
            serbian: "Ti ćeš raditi",
            english: "You will work",
            explanation: "'Ćeš' means 'will' for 'you'"
          },
          {
            serbian: "On će doći",
            english: "He will come",
            explanation: "'će' means 'will' for he/she/it"
          }
        ],
        comparisonToEnglish: "English uses 'will' before the verb. Serbian uses ću/ćeš/će and the verb changes slightly!"
      }
    ],
    practicalExamples: [
      {
        situation: "Planning the weekend",
        dialogue: [
          { serbian: "Šta ćeš raditi ovog vikenda?", english: "What will you do this weekend?" },
          { serbian: "Ići ću na planinu.", english: "I will go to the mountain." },
          { serbian: "Sa kim ćeš ići?", english: "Who will you go with?" },
          { serbian: "Ići ću sa prijateljima.", english: "I will go with friends." }
        ]
      }
    ]
  },

  // UNIT 19
  {
    unitNumber: 19,
    overview: "Celebrate birthdays and special occasions! Learn about dates, parties, and celebrations.",
    grammarExplanations: [
      {
        topic: "Expressing Dates",
        simpleExplanation: "Learn how to say dates - when is your birthday? What day is it?",
        examples: [
          {
            serbian: "Prvi januar",
            english: "January first",
            explanation: "Use ordinal number + month"
          },
          {
            serbian: "Rođen sam petog maja",
            english: "I was born on May fifth",
            explanation: "Use genitive case for dates"
          },
          {
            serbian: "Danas je deseti oktobar",
            english: "Today is October tenth",
            explanation: "Month comes after the number"
          }
        ],
        comparisonToEnglish: "English says 'May 5th'. Serbian says 'fifth of May' (petog maja)!"
      }
    ],
    practicalExamples: [
      {
        situation: "Birthday party invitation",
        dialogue: [
          { serbian: "Kada ti je rođendan?", english: "When is your birthday?" },
          { serbian: "Petnaestog juna.", english: "June fifteenth." },
          { serbian: "Hoćeš li praviti žurku?", english: "Will you have a party?" },
          { serbian: "Da! Doći ćeš?", english: "Yes! Will you come?" },
          { serbian: "Naravno! Srećan rođendan!", english: "Of course! Happy birthday!" }
        ]
      }
    ]
  },

  // UNIT 20
  {
    unitNumber: 20,
    overview: "Not feeling well? Learn body parts, how to describe symptoms, and talk to a doctor.",
    grammarExplanations: [
      {
        topic: "Verb 'boleti' (to hurt)",
        simpleExplanation: "This verb means 'to hurt' or 'to ache'. Use it to say what hurts!",
        examples: [
          {
            serbian: "Boli me glava",
            english: "My head hurts",
            explanation: "Literally 'head hurts me'"
          },
          {
            serbian: "Bole me zubi",
            english: "My teeth hurt",
            explanation: "Use 'bole' (plural) for teeth"
          },
          {
            serbian: "Boli ga stomak",
            english: "His stomach hurts",
            explanation: "'Ga' means 'him'"
          }
        ],
        comparisonToEnglish: "English says 'my head hurts'. Serbian says 'head hurts me' (boli me glava)!"
      },
      {
        topic: "Imperative (Commands)",
        simpleExplanation: "Use imperative to give commands or advice, like 'Sit down!' or 'Take this medicine!'",
        examples: [
          {
            serbian: "Sedi!",
            english: "Sit down!",
            explanation: "Command form for 'to sit'"
          },
          {
            serbian: "Uzmi lek",
            english: "Take the medicine",
            explanation: "Command form for 'to take'"
          },
          {
            serbian: "Odmaraj se",
            english: "Rest (yourself)",
            explanation: "Command with reflexive 'se'"
          }
        ],
        comparisonToEnglish: "English uses base verb for commands. Serbian changes the verb ending!"
      }
    ],
    practicalExamples: [
      {
        situation: "At the doctor's office",
        dialogue: [
          { serbian: "Šta vas boli?", english: "What hurts you?" },
          { serbian: "Boli me grlo i glava.", english: "My throat and head hurt." },
          { serbian: "Imate temperaturu?", english: "Do you have a fever?" },
          { serbian: "Da, imam.", english: "Yes, I do." },
          { serbian: "Uzimajte ovaj lek tri puta dnevno.", english: "Take this medicine three times a day." }
        ]
      }
    ]
  },

  // UNIT 21
  {
    unitNumber: 21,
    overview: "Go shopping for clothes! Learn colors, clothing items, and how to shop for what you need.",
    grammarExplanations: [
      {
        topic: "Colors",
        simpleExplanation: "Learn color words to describe clothes and things!",
        examples: [
          {
            serbian: "crvena haljina",
            english: "red dress",
            explanation: "'Crvena' is feminine form of 'red'"
          },
          {
            serbian: "plavi šešir",
            english: "blue hat",
            explanation: "'Plavi' is masculine form of 'blue'"
          },
          {
            serbian: "zeleno odelo",
            english: "green suit",
            explanation: "'Zeleno' is neuter form of 'green'"
          }
        ],
        comparisonToEnglish: "English keeps colors the same. Serbian changes them based on the noun's gender!"
      },
      {
        topic: "Demonstrative Pronouns",
        simpleExplanation: "Words like 'this', 'that', 'these', 'those' - pointing to things!",
        examples: [
          {
            serbian: "Ovaj šešir",
            english: "This hat",
            explanation: "'Ovaj' means 'this' for masculine nouns"
          },
          {
            serbian: "Ta haljina",
            english: "That dress",
            explanation: "'Ta' means 'that' for feminine nouns"
          },
          {
            serbian: "Ono odelo",
            english: "That suit",
            explanation: "'Ono' means 'that' for neuter nouns"
          }
        ],
        comparisonToEnglish: "English uses 'this/that'. Serbian has different forms: ovaj/ova/ovo, taj/ta/to!"
      }
    ],
    practicalExamples: [
      {
        situation: "Shopping for clothes",
        dialogue: [
          { serbian: "Mogu li da probam ovu košulju?", english: "Can I try on this shirt?" },
          { serbian: "Naravno. Koja veličina?", english: "Of course. What size?" },
          { serbian: "Medium, molim.", english: "Medium, please." },
          { serbian: "Imate li ovu u plavoj boji?", english: "Do you have this in blue?" },
          { serbian: "Da, izvolite.", english: "Yes, here you are." }
        ]
      }
    ]
  },

  // UNIT 22
  {
    unitNumber: 22,
    overview: "Compare things! What's better, bigger, or more expensive? Learn to make comparisons.",
    grammarExplanations: [
      {
        topic: "Comparatives and Superlatives",
        simpleExplanation: "Compare things using 'more' (comparative) or 'most' (superlative)!",
        examples: [
          {
            serbian: "veći",
            english: "bigger",
            explanation: "Add -iji/-ija/-ije to make comparative"
          },
          {
            serbian: "najlepši",
            english: "most beautiful",
            explanation: "Add 'naj-' for superlative (the most)"
          },
          {
            serbian: "Ova knjiga je bolja",
            english: "This book is better",
            explanation: "'Dobar' becomes 'bolji' (irregular)"
          },
          {
            serbian: "To je najbolji film",
            english: "That's the best movie",
            explanation: "'Najbolji' means 'the best'"
          }
        ],
        comparisonToEnglish: "English adds -er/-est or uses 'more/most'. Serbian mostly adds -iji and naj-!"
      }
    ],
    practicalExamples: [
      {
        situation: "Comparing cities",
        dialogue: [
          { serbian: "Koji grad je veći, Beograd ili Novi Sad?", english: "Which city is bigger, Belgrade or Novi Sad?" },
          { serbian: "Beograd je veći.", english: "Belgrade is bigger." },
          { serbian: "Koji je najlepši grad u Srbiji?", english: "What's the most beautiful city in Serbia?" },
          { serbian: "Mislim da je Novi Sad najlepši.", english: "I think Novi Sad is the most beautiful." }
        ]
      }
    ]
  },

  // UNIT 23
  {
    unitNumber: 23,
    overview: "Describe what people look like! Appearance, characteristics, and professions.",
    grammarExplanations: [
      {
        topic: "Describing Appearance",
        simpleExplanation: "Learn adjectives to describe how people look!",
        examples: [
          {
            serbian: "On je visok i mršav",
            english: "He is tall and thin",
            explanation: "'Visok' means tall, 'mršav' means thin"
          },
          {
            serbian: "Ona ima plavu kosu",
            english: "She has blonde hair",
            explanation: "'Plava kosa' means blonde hair"
          },
          {
            serbian: "Ima braon oči",
            english: "Has brown eyes",
            explanation: "'Braon oči' means brown eyes"
          }
        ],
        comparisonToEnglish: "Similar to English, but adjectives must match gender in Serbian!"
      },
      {
        topic: "Negatives",
        simpleExplanation: "How to say 'no', 'not', 'never', 'nobody' - all the negative words!",
        examples: [
          {
            serbian: "Ne znam",
            english: "I don't know",
            explanation: "'Ne' before verb means 'not'"
          },
          {
            serbian: "Nikada ne kasnim",
            english: "I never am late",
            explanation: "'Nikada' means 'never'"
          },
          {
            serbian: "Niko nije došao",
            english: "Nobody came",
            explanation: "'Niko' means 'nobody'"
          }
        ],
        comparisonToEnglish: "English avoids double negatives. Serbian LOVES them - 'never not' is correct!"
      }
    ],
    practicalExamples: [
      {
        situation: "Describing someone",
        dialogue: [
          { serbian: "Kako izgleda tvoj brat?", english: "What does your brother look like?" },
          { serbian: "On je visok, ima crnu kosu i plave oči.", english: "He is tall, has black hair and blue eyes." },
          { serbian: "Čime se bavi?", english: "What does he do?" },
          { serbian: "On je lekar.", english: "He is a doctor." }
        ]
      }
    ]
  },

  // UNIT 24
  {
    unitNumber: 24,
    overview: "Book hotels and visit places! Learn about accommodation and making reservations.",
    grammarExplanations: [
      {
        topic: "Conditional/Subjunctive",
        simpleExplanation: "Use this to talk about wishes, possibilities, or polite requests - 'I would like', 'If I could'...",
        examples: [
          {
            serbian: "Želeo bih sobu",
            english: "I would like a room",
            explanation: "'Bih' makes it conditional/polite"
          },
          {
            serbian: "Da li biste mogli pomoći?",
            english: "Could you help?",
            explanation: "'Biste' is polite conditional 'would you'"
          },
          {
            serbian: "Ako bih mogao, došao bih",
            english: "If I could, I would come",
            explanation: "Use 'bih' for both parts of 'if...would'"
          }
        ],
        comparisonToEnglish: "English uses 'would'. Serbian uses 'bih/bi/bismo' + past form!"
      }
    ],
    practicalExamples: [
      {
        situation: "Booking a hotel",
        dialogue: [
          { serbian: "Želeo bih da rezervišem sobu.", english: "I would like to reserve a room." },
          { serbian: "Za koliko noći?", english: "For how many nights?" },
          { serbian: "Za tri noći, molim.", english: "For three nights, please." },
          { serbian: "Da li biste želeli sobu sa pogledom na more?", english: "Would you like a room with a sea view?" },
          { serbian: "Da, to bi bilo odlično!", english: "Yes, that would be great!" }
        ]
      }
    ]
  },

  // UNIT 25
  {
    unitNumber: 25,
    overview: "Talk about unusual or typical days! Learn about verb aspects - perfective vs imperfective.",
    grammarExplanations: [
      {
        topic: "Verb Aspects",
        simpleExplanation: "Serbian verbs come in pairs! Imperfective (ongoing/repeated) and perfective (completed/one-time).",
        examples: [
          {
            serbian: "Čitam knjigu (imperfective)",
            english: "I am reading a book",
            explanation: "Ongoing action, not finished"
          },
          {
            serbian: "Pročitao sam knjigu (perfective)",
            english: "I read (finished) the book",
            explanation: "Completed action, done!"
          },
          {
            serbian: "Pisao sam pismo (imperfective)",
            english: "I was writing a letter",
            explanation: "Process, ongoing"
          },
          {
            serbian: "Napisao sam pismo (perfective)",
            english: "I wrote (finished) the letter",
            explanation: "Completed, result achieved"
          }
        ],
        comparisonToEnglish: "English uses 'I read' for both. Serbian uses different verbs: čitati (ongoing) vs pročitati (finished)!"
      }
    ],
    practicalExamples: [
      {
        situation: "Describing your day",
        dialogue: [
          { serbian: "Šta si radio danas?", english: "What did you do today?" },
          { serbian: "Čitao sam ceo dan.", english: "I was reading all day." },
          { serbian: "Jesi li završio knjigu?", english: "Did you finish the book?" },
          { serbian: "Da, pročitao sam je.", english: "Yes, I finished reading it." }
        ]
      }
    ]
  },

  // UNIT 26
  {
    unitNumber: 26,
    overview: "Plan an evening out! Surprises, invitations, and making plans with friends.",
    grammarExplanations: [
      {
        topic: "Planning and Invitations",
        simpleExplanation: "Learn phrases for making plans and inviting people!",
        examples: [
          {
            serbian: "Hajde da idemo u bioskop",
            english: "Let's go to the cinema",
            explanation: "'Hajde da' means 'let's'"
          },
          {
            serbian: "Hoćeš li doći?",
            english: "Will you come?",
            explanation: "Asking if someone will come"
          },
          {
            serbian: "Dogovoreno!",
            english: "It's a deal!",
            explanation: "Agreeing to plans"
          }
        ],
        comparisonToEnglish: "Similar to English 'let's' and 'will you', but Serbian uses 'hajde da' construction!"
      }
    ],
    practicalExamples: [
      {
        situation: "Planning an evening",
        dialogue: [
          { serbian: "Hajde da večeras izađemo!", english: "Let's go out tonight!" },
          { serbian: "Dobra ideja! Gde ćemo?", english: "Good idea! Where shall we go?" },
          { serbian: "Možemo u restoran ili bioskop.", english: "We can go to a restaurant or cinema." },
          { serbian: "Idemo u restoran!", english: "Let's go to a restaurant!" },
          { serbian: "Dogovoreno! U osam sati?", english: "It's a deal! At eight o'clock?" }
        ]
      }
    ]
  },

  // UNIT 27
  {
    unitNumber: 27,
    overview: "The final unit! Review everything you've learned and prepare to use Serbian confidently!",
    grammarExplanations: [
      {
        topic: "Review and Practice",
        simpleExplanation: "This unit brings together everything you've learned - all the cases, tenses, and vocabulary!",
        examples: [
          {
            serbian: "Naučio sam mnogo srpskog",
            english: "I learned a lot of Serbian",
            explanation: "Using past tense and genitive case"
          },
          {
            serbian: "Mogu da razgovaram sa ljudima",
            english: "I can talk with people",
            explanation: "Using 'moći' + instrumental case"
          },
          {
            serbian: "Nastaviću da učim",
            english: "I will continue to learn",
            explanation: "Using future tense"
          }
        ],
        comparisonToEnglish: "You now know all the building blocks! Keep practicing and you'll speak Serbian fluently!"
      }
    ],
    practicalExamples: [
      {
        situation: "Reflecting on your learning",
        dialogue: [
          { serbian: "Koliko dugo učiš srpski?", english: "How long have you been learning Serbian?" },
          { serbian: "Učim tri meseca.", english: "I've been learning for three months." },
          { serbian: "Kako ti ide?", english: "How is it going?" },
          { serbian: "Dobro! Mogu da razumem i govorim.", english: "Good! I can understand and speak." },
          { serbian: "Sjajno! Nastavi tako!", english: "Great! Keep it up!" }
        ]
      }
    ]
  }
];

// Helper function to get explanation for a unit
export function getUnitExplanation(unitNumber: number): UnitExplanation | undefined {
  return UNIT_EXPLANATIONS.find(u => u.unitNumber === unitNumber);
}
