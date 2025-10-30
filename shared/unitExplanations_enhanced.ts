// Enhanced unit explanations with book-inspired content (copyright-safe)
// Based on "Step by Step Serbian 1" structure but with original examples

export interface UnitContent {
  unitNumber: number;
  title: string;
  bookPages: string;
  grammarTopics: Array<{
    topic: string;
    explanation: string;
    examples: Array<{ serbian: string; english: string; note?: string }>;
    table?: {
      headers: string[];
      rows: string[][];
    };
  }>;
  dialogues: Array<{
    title: string;
    lines: Array<{ speaker: string; serbian: string; english: string }>;
  }>;
  vocabulary: Array<{ serbian: string; english: string; category: string }>;
  exercises: Array<{
    type: string;
    instruction: string;
    items: string[];
  }>;
}

export const ENHANCED_UNIT_CONTENT: UnitContent[] = [
  // UNIT 1: Na aerodromu (At the airport)
  {
    unitNumber: 1,
    title: "Na aerodromu",
    bookPages: "Pages 5-9",
    grammarTopics: [
      {
        topic: "Serbian Latin Alphabet",
        explanation: "Serbian uses both Latin and Cyrillic alphabets. The Latin alphabet has 30 letters. Each letter represents one sound - what you see is what you pronounce!",
        examples: [
          { serbian: "a e i o u", english: "Vowels: ah, eh, ee, oh, oo", note: "Always pronounced the same" },
          { serbian: "č ć š ž đ", english: "Special letters: ch, soft-ch, sh, zh, j (as in jam)" }
        ]
      },
      {
        topic: "Greetings and Basic Phrases",
        explanation: "Learn essential phrases for meeting people. Serbian has formal and informal ways of speaking.",
        examples: [
          { serbian: "Dobar dan!", english: "Good day! (formal greeting)" },
          { serbian: "Zdravo!", english: "Hi! (informal)" },
          { serbian: "Hvala.", english: "Thank you." },
          { serbian: "Molim.", english: "Please / You're welcome." },
          { serbian: "Izvinite.", english: "Excuse me. (formal)" }
        ]
      },
      {
        topic: "Gender of Nouns",
        explanation: "Every Serbian noun has a gender: masculine, feminine, or neuter. You can usually tell by the ending!",
        examples: [
          { serbian: "pas (dog)", english: "Masculine - ends in consonant", note: "Most masculine nouns end in consonants" },
          { serbian: "mačka (cat)", english: "Feminine - ends in -a", note: "Most feminine nouns end in -a" },
          { serbian: "dete (child)", english: "Neuter - ends in -e or -o", note: "Neuter nouns often end in -e or -o" }
        ],
        table: {
          headers: ["Gender", "Typical Ending", "Example"],
          rows: [
            ["Masculine", "consonant", "aerodrom (airport)"],
            ["Feminine", "-a", "karta (ticket)"],
            ["Neuter", "-e, -o", "ime (name), mesto (place)"]
          ]
        }
      },
      {
        topic: "Verb 'biti' (to be) - Present Tense",
        explanation: "The verb 'to be' is the most important verb! It helps you say who you are and describe things.",
        examples: [
          { serbian: "Ja sam turist.", english: "I am a tourist." },
          { serbian: "Ti si ovde.", english: "You are here." },
          { serbian: "On je iz Amerike.", english: "He is from America." }
        ],
        table: {
          headers: ["Person", "Serbian", "English"],
          rows: [
            ["I", "ja sam", "I am"],
            ["you (informal)", "ti si", "you are"],
            ["he/she/it", "on/ona/ono je", "he/she/it is"],
            ["we", "mi smo", "we are"],
            ["you (plural/formal)", "vi ste", "you are"],
            ["they", "oni/one/ona su", "they are"]
          ]
        }
      },
      {
        topic: "Possessive Adjectives (my, your)",
        explanation: "To say 'my' or 'your', the word changes based on the gender of the noun!",
        examples: [
          { serbian: "moj pasoš (m)", english: "my passport" },
          { serbian: "moja karta (f)", english: "my ticket" },
          { serbian: "moje ime (n)", english: "my name" }
        ],
        table: {
          headers: ["Gender", "My", "Your (informal)", "Example"],
          rows: [
            ["Masculine", "moj", "tvoj", "moj/tvoj pasoš"],
            ["Feminine", "moja", "tvoja", "moja/tvoja torba"],
            ["Neuter", "moje", "tvoje", "moje/tvoje ime"]
          ]
        }
      },
      {
        topic: "Simple Questions",
        explanation: "Make questions by changing your voice tone (going up at the end) or using question words.",
        examples: [
          { serbian: "Gde je izlaz?", english: "Where is the exit?" },
          { serbian: "Šta je ovo?", english: "What is this?" },
          { serbian: "Ko ste vi?", english: "Who are you?" },
          { serbian: "Da li ste turist?", english: "Are you a tourist?", note: "'Da li' makes yes/no questions" }
        ]
      }
    ],
    dialogues: [
      {
        title: "At Airport Passport Control",
        lines: [
          { speaker: "Officer", serbian: "Dobar dan. Pasoš, molim.", english: "Good day. Passport, please." },
          { speaker: "Tourist", serbian: "Izvolite.", english: "Here you are." },
          { speaker: "Officer", serbian: "Odakle ste?", english: "Where are you from?" },
          { speaker: "Tourist", serbian: "Ja sam iz Amerike.", english: "I am from America." },
          { speaker: "Officer", serbian: "Dobro došli u Srbiju!", english: "Welcome to Serbia!" },
          { speaker: "Tourist", serbian: "Hvala!", english: "Thank you!" }
        ]
      },
      {
        title: "Finding Your Way",
        lines: [
          { speaker: "You", serbian: "Izvinite, gde je izlaz?", english: "Excuse me, where is the exit?" },
          { speaker: "Person", serbian: "Tamo, desno.", english: "There, on the right." },
          { speaker: "You", serbian: "Hvala vam.", english: "Thank you." },
          { speaker: "Person", serbian: "Nema na čemu.", english: "You're welcome." }
        ]
      }
    ],
    vocabulary: [
      { serbian: "aerodrom", english: "airport", category: "places" },
      { serbian: "pasoš", english: "passport", category: "documents" },
      { serbian: "karta", english: "ticket", category: "documents" },
      { serbian: "izlaz", english: "exit", category: "places" },
      { serbian: "ulaz", english: "entrance", category: "places" },
      { serbian: "torba", english: "bag", category: "objects" },
      { serbian: "ime", english: "name", category: "personal" },
      { serbian: "prezime", english: "surname", category: "personal" }
    ],
    exercises: [
      {
        type: "fill-in",
        instruction: "Complete with the correct form of 'biti' (to be)",
        items: [
          "Ja ___ turist. (I am a tourist)",
          "Ti ___ ovde. (You are here)",
          "On ___ iz Srbije. (He is from Serbia)"
        ]
      },
      {
        type: "translation",
        instruction: "Translate to Serbian",
        items: [
          "Good day!",
          "Where is the exit?",
          "My passport"
        ]
      }
    ]
  },

  // UNIT 2: U kafeу (In the café)
  {
    unitNumber: 2,
    title: "U kafeу",
    bookPages: "Pages 10-15",
    grammarTopics: [
      {
        topic: "Making Simple Orders",
        explanation: "Learn how to order food and drinks politely in a café or restaurant.",
        examples: [
          { serbian: "Molim vas, jednu kafu.", english: "Please, one coffee." },
          { serbian: "Ja bih sok.", english: "I would like juice." },
          { serbian: "Možete li mi doneti vodu?", english: "Can you bring me water?" }
        ]
      },
      {
        topic: "Cardinal Numbers 1-100",
        explanation: "Numbers are essential for ordering, paying, and telling time.",
        examples: [
          { serbian: "jedan, dva, tri", english: "one, two, three" },
          { serbian: "deset, dvadeset, trideset", english: "ten, twenty, thirty" },
          { serbian: "sto", english: "one hundred" }
        ],
        table: {
          headers: ["Number", "Serbian", "English"],
          rows: [
            ["1-5", "jedan, dva, tri, četiri, pet", "one, two, three, four, five"],
            ["6-10", "šest, sedam, osam, devet, deset", "six, seven, eight, nine, ten"],
            ["20, 30, 40", "dvadeset, trideset, četrdeset", "twenty, thirty, forty"],
            ["50, 100", "pedeset, sto", "fifty, one hundred"]
          ]
        }
      },
      {
        topic: "Verb 'imati' (to have)",
        explanation: "Use 'imati' to say what you have or don't have.",
        examples: [
          { serbian: "Ja imam novac.", english: "I have money." },
          { serbian: "Ti imaš vreme?", english: "Do you have time?" },
          { serbian: "Nemam kafu.", english: "I don't have coffee.", note: "Ne + imam = nemam" }
        ],
        table: {
          headers: ["Person", "Serbian", "English"],
          rows: [
            ["I", "ja imam", "I have"],
            ["you", "ti imaš", "you have"],
            ["he/she", "on/ona ima", "he/she has"],
            ["we", "mi imamo", "we have"],
            ["you (pl/formal)", "vi imate", "you have"],
            ["they", "oni/one imaju", "they have"]
          ]
        }
      }
    ],
    dialogues: [
      {
        title: "Ordering in a Café",
        lines: [
          { speaker: "Waiter", serbian: "Dobar dan! Šta želite?", english: "Good day! What would you like?" },
          { speaker: "You", serbian: "Molim vas, jednu kafu i vodu.", english: "Please, one coffee and water." },
          { speaker: "Waiter", serbian: "Odmah!", english: "Right away!" },
          { speaker: "You", serbian: "Koliko košta?", english: "How much does it cost?" },
          { speaker: "Waiter", serbian: "Dvesta dinara.", english: "Two hundred dinars." },
          { speaker: "You", serbian: "Izvolite.", english: "Here you are." }
        ]
      }
    ],
    vocabulary: [
      { serbian: "kafa", english: "coffee", category: "drinks" },
      { serbian: "čaj", english: "tea", category: "drinks" },
      { serbian: "sok", english: "juice", category: "drinks" },
      { serbian: "voda", english: "water", category: "drinks" },
      { serbian: "hleb", english: "bread", category: "food" },
      { serbian: "račun", english: "bill", category: "restaurant" },
      { serbian: "novac", english: "money", category: "general" }
    ],
    exercises: [
      {
        type: "ordering",
        instruction: "Practice ordering these items",
        items: [
          "One coffee",
          "Two teas",
          "Water, please"
        ]
      }
    ]
  }
];
