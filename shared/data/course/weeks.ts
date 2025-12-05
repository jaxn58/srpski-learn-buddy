import type { Unit } from "./units";

export interface Week {
  weekNumber: number;
  title: string;
  units: number[];
  goals: string[];
  practiceActivities: string[];
}

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



