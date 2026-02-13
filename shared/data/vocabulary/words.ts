// Comprehensive vocabulary list for all 27 units from "Serbian LearnBuddy"
// Multi-language support: English & German (more languages coming soon)

export type VocabWord = {
  serbian: string;
  translations: {
    en: string;
    de: string;
    es?: string;
    fr?: string;
  };
  alternatives?: {
    en?: string[];
    de?: string[];
    es?: string[];
    fr?: string[];
  };
  unit: number;
};

export const VOCABULARY: VocabWord[] = [
  // Unit 1 - Na aerodromu (At the airport / Am Flughafen)
  { 
    serbian: "aerodrom", 
    translations: { en: "airport", de: "Flughafen" },
    unit: 1 
  },
  { 
    serbian: "pasoš", 
    translations: { en: "passport", de: "Reisepass" },
    unit: 1 
  },
  { 
    serbian: "karta", 
    translations: { en: "ticket", de: "Ticket" },
    alternatives: { de: ["Karte", "Fahrkarte"] },
    unit: 1 
  },
  { 
    serbian: "prtljag", 
    translations: { en: "luggage", de: "Gepäck" },
    unit: 1 
  },
  { 
    serbian: "dobar dan", 
    translations: { en: "good day", de: "guten Tag" },
    unit: 1 
  },
  { 
    serbian: "dobro jutro", 
    translations: { en: "good morning", de: "guten Morgen" },
    unit: 1 
  },
  { 
    serbian: "dobro veče", 
    translations: { en: "good evening", de: "guten Abend" },
    unit: 1 
  },
  { 
    serbian: "laku noć", 
    translations: { en: "good night", de: "gute Nacht" },
    unit: 1 
  },
  { 
    serbian: "hvala", 
    translations: { en: "thank you", de: "danke" },
    unit: 1 
  },
  { 
    serbian: "molim", 
    translations: { en: "please", de: "bitte" },
    alternatives: { 
      en: ["you're welcome"], 
      de: ["gern geschehen", "bitte schön"] 
    },
    unit: 1 
  },
  { 
    serbian: "da", 
    translations: { en: "yes", de: "ja" },
    unit: 1 
  },
  { 
    serbian: "ne", 
    translations: { en: "no", de: "nein" },
    unit: 1 
  },
  { 
    serbian: "izvinite", 
    translations: { en: "excuse me", de: "entschuldigen Sie" },
    alternatives: { de: ["Entschuldigung"] },
    unit: 1 
  },
  { 
    serbian: "zdravo", 
    translations: { en: "hello", de: "hallo" },
    alternatives: { en: ["hi"], de: ["servus"] },
    unit: 1 
  },
  { 
    serbian: "ćao", 
    translations: { en: "bye", de: "tschüss" },
    alternatives: { de: ["ciao"] },
    unit: 1 
  },
  { 
    serbian: "doviđenja", 
    translations: { en: "goodbye", de: "auf Wiedersehen" },
    unit: 1 
  },
  { 
    serbian: "ja", 
    translations: { en: "I", de: "ich" },
    unit: 1 
  },
  { 
    serbian: "ti", 
    translations: { en: "you (informal)", de: "du" },
    unit: 1 
  },
  { 
    serbian: "on", 
    translations: { en: "he", de: "er" },
    unit: 1 
  },
  { 
    serbian: "ona", 
    translations: { en: "she", de: "sie" },
    unit: 1 
  },
  { 
    serbian: "ono", 
    translations: { en: "it", de: "es" },
    unit: 1 
  },
  { 
    serbian: "biti", 
    translations: { en: "to be", de: "sein" },
    unit: 1 
  },
  { 
    serbian: "imati", 
    translations: { en: "to have", de: "haben" },
    unit: 1 
  },

  // Unit 2 - U hotelu (At the hotel / Im Hotel)
  { 
    serbian: "hotel", 
    translations: { en: "hotel", de: "Hotel" },
    unit: 2 
  },
  { 
    serbian: "soba", 
    translations: { en: "room", de: "Zimmer" },
    unit: 2 
  },
  { 
    serbian: "ključ", 
    translations: { en: "key", de: "Schlüssel" },
    unit: 2 
  },
  { 
    serbian: "rezervacija", 
    translations: { en: "reservation", de: "Reservierung" },
    alternatives: { de: ["Buchung"] },
    unit: 2 
  },
  { 
    serbian: "noć", 
    translations: { en: "night", de: "Nacht" },
    unit: 2 
  },
  { 
    serbian: "dan", 
    translations: { en: "day", de: "Tag" },
    unit: 2 
  },
  { 
    serbian: "recepcija", 
    translations: { en: "reception", de: "Rezeption" },
    alternatives: { de: ["Empfang"] },
    unit: 2 
  },
  { 
    serbian: "kupatilo", 
    translations: { en: "bathroom", de: "Badezimmer" },
    alternatives: { de: ["Bad"] },
    unit: 2 
  },
  { 
    serbian: "krevet", 
    translations: { en: "bed", de: "Bett" },
    unit: 2 
  },
  { 
    serbian: "tuš", 
    translations: { en: "shower", de: "Dusche" },
    unit: 2 
  },
  { 
    serbian: "lift", 
    translations: { en: "elevator", de: "Aufzug" },
    alternatives: { de: ["Fahrstuhl", "Lift"] },
    unit: 2 
  },
  { 
    serbian: "doručak", 
    translations: { en: "breakfast", de: "Frühstück" },
    unit: 2 
  },
  { 
    serbian: "cena", 
    translations: { en: "price", de: "Preis" },
    unit: 2 
  },
  { 
    serbian: "slobodan", 
    translations: { en: "free", de: "frei" },
    alternatives: { en: ["available"], de: ["verfügbar"] },
    unit: 2 
  },
  { 
    serbian: "zauzet", 
    translations: { en: "occupied", de: "besetzt" },
    alternatives: { en: ["busy"], de: ["belegt"] },
    unit: 2 
  },

  // Unit 3 - U kafiću (At the café / Im Café)
  { 
    serbian: "kafić", 
    translations: { en: "café", de: "Café" },
    unit: 3 
  },
  { 
    serbian: "kafa", 
    translations: { en: "coffee", de: "Kaffee" },
    unit: 3 
  },
  { 
    serbian: "čaj", 
    translations: { en: "tea", de: "Tee" },
    unit: 3 
  },
  { 
    serbian: "voda", 
    translations: { en: "water", de: "Wasser" },
    unit: 3 
  },
  { 
    serbian: "sok", 
    translations: { en: "juice", de: "Saft" },
    unit: 3 
  },
  { 
    serbian: "pivo", 
    translations: { en: "beer", de: "Bier" },
    unit: 3 
  },
  { 
    serbian: "vino", 
    translations: { en: "wine", de: "Wein" },
    unit: 3 
  },
  { 
    serbian: "mleko", 
    translations: { en: "milk", de: "Milch" },
    unit: 3 
  },
  { 
    serbian: "šećer", 
    translations: { en: "sugar", de: "Zucker" },
    unit: 3 
  },
  { 
    serbian: "račun", 
    translations: { en: "bill", de: "Rechnung" },
    unit: 3 
  },
  { 
    serbian: "konobar", 
    translations: { en: "waiter", de: "Kellner" },
    unit: 3 
  },
  { 
    serbian: "meni", 
    translations: { en: "menu", de: "Speisekarte" },
    alternatives: { de: ["Menü"] },
    unit: 3 
  },
  { 
    serbian: "želeti", 
    translations: { en: "to want", de: "wollen" },
    alternatives: { en: ["wish"], de: ["wünschen", "möchten"] },
    unit: 3 
  },
  { 
    serbian: "piti", 
    translations: { en: "to drink", de: "trinken" },
    unit: 3 
  },

  // Unit 4 - Gde je...? (Where is...? / Wo ist...?)
  { 
    serbian: "gde", 
    translations: { en: "where", de: "wo" },
    unit: 4 
  },
  { 
    serbian: "ovde", 
    translations: { en: "here", de: "hier" },
    unit: 4 
  },
  { 
    serbian: "tamo", 
    translations: { en: "there", de: "dort" },
    alternatives: { de: ["da"] },
    unit: 4 
  },
  { 
    serbian: "ulica", 
    translations: { en: "street", de: "Straße" },
    unit: 4 
  },
  { 
    serbian: "trg", 
    translations: { en: "square", de: "Platz" },
    unit: 4 
  },
  { 
    serbian: "most", 
    translations: { en: "bridge", de: "Brücke" },
    unit: 4 
  },
  { 
    serbian: "park", 
    translations: { en: "park", de: "Park" },
    unit: 4 
  },
  { 
    serbian: "muzej", 
    translations: { en: "museum", de: "Museum" },
    unit: 4 
  },
  { 
    serbian: "pozorište", 
    translations: { en: "theater", de: "Theater" },
    unit: 4 
  },
  { 
    serbian: "bioskop", 
    translations: { en: "cinema", de: "Kino" },
    unit: 4 
  },
  { 
    serbian: "restoran", 
    translations: { en: "restaurant", de: "Restaurant" },
    unit: 4 
  },
  { 
    serbian: "banka", 
    translations: { en: "bank", de: "Bank" },
    unit: 4 
  },
  { 
    serbian: "pošta", 
    translations: { en: "post office", de: "Postamt" },
    alternatives: { de: ["Post"] },
    unit: 4 
  },
  { 
    serbian: "levo", 
    translations: { en: "left", de: "links" },
    unit: 4 
  },
  { 
    serbian: "desno", 
    translations: { en: "right", de: "rechts" },
    unit: 4 
  },
  { 
    serbian: "pravo", 
    translations: { en: "straight", de: "geradeaus" },
    unit: 4 
  },
  { 
    serbian: "blizu", 
    translations: { en: "near", de: "nah" },
    alternatives: { de: ["in der Nähe"] },
    unit: 4 
  },
  { 
    serbian: "daleko", 
    translations: { en: "far", de: "weit" },
    unit: 4 
  },

  // Unit 5 - Šta radiš? (What are you doing? / Was machst du?)
  { 
    serbian: "raditi", 
    translations: { en: "to work / do", de: "arbeiten / machen" },
    unit: 5 
  },
  { 
    serbian: "učiti", 
    translations: { en: "to learn / study", de: "lernen / studieren" },
    unit: 5 
  },
  { 
    serbian: "čitati", 
    translations: { en: "to read", de: "lesen" },
    unit: 5 
  },
  { 
    serbian: "pisati", 
    translations: { en: "to write", de: "schreiben" },
    unit: 5 
  },
  { 
    serbian: "govoriti", 
    translations: { en: "to speak", de: "sprechen" },
    alternatives: { de: ["reden"] },
    unit: 5 
  },
  { 
    serbian: "slušati", 
    translations: { en: "to listen", de: "hören" },
    alternatives: { de: ["zuhören"] },
    unit: 5 
  },
  { 
    serbian: "gledati", 
    translations: { en: "to watch / look", de: "schauen / ansehen" },
    unit: 5 
  },
  { 
    serbian: "razumeti", 
    translations: { en: "to understand", de: "verstehen" },
    unit: 5 
  },
  { 
    serbian: "znati", 
    translations: { en: "to know", de: "wissen / kennen" },
    unit: 5 
  },
  { 
    serbian: "moći", 
    translations: { en: "can / to be able", de: "können" },
    unit: 5 
  },
  { 
    serbian: "jezik", 
    translations: { en: "language", de: "Sprache" },
    unit: 5 
  },
  { 
    serbian: "knjiga", 
    translations: { en: "book", de: "Buch" },
    unit: 5 
  },
  { 
    serbian: "novine", 
    translations: { en: "newspaper", de: "Zeitung" },
    unit: 5 
  },
  { 
    serbian: "časopis", 
    translations: { en: "magazine", de: "Zeitschrift" },
    alternatives: { de: ["Magazin"] },
    unit: 5 
  },
  { 
    serbian: "film", 
    translations: { en: "film / movie", de: "Film" },
    unit: 5 
  },
  { 
    serbian: "muzika", 
    translations: { en: "music", de: "Musik" },
    unit: 5 
  },

  // Unit 6 - Koliko je sati? (What time is it? / Wie spät ist es?)
  { 
    serbian: "sat", 
    translations: { en: "hour / clock", de: "Stunde / Uhr" },
    unit: 6 
  },
  { 
    serbian: "vreme", 
    translations: { en: "time", de: "Zeit" },
    unit: 6 
  },
  { 
    serbian: "minut", 
    translations: { en: "minute", de: "Minute" },
    unit: 6 
  },
  { 
    serbian: "sekund", 
    translations: { en: "second", de: "Sekunde" },
    unit: 6 
  },
  { 
    serbian: "jutro", 
    translations: { en: "morning", de: "Morgen" },
    unit: 6 
  },
  { 
    serbian: "podne", 
    translations: { en: "noon", de: "Mittag" },
    unit: 6 
  },
  { 
    serbian: "popodne", 
    translations: { en: "afternoon", de: "Nachmittag" },
    unit: 6 
  },
  { 
    serbian: "veče", 
    translations: { en: "evening", de: "Abend" },
    unit: 6 
  },
  { 
    serbian: "noć", 
    translations: { en: "night", de: "Nacht" },
    unit: 6 
  },
  { 
    serbian: "rano", 
    translations: { en: "early", de: "früh" },
    unit: 6 
  },
  { 
    serbian: "kasno", 
    translations: { en: "late", de: "spät" },
    unit: 6 
  },
  { 
    serbian: "sada", 
    translations: { en: "now", de: "jetzt" },
    unit: 6 
  },
  { 
    serbian: "danas", 
    translations: { en: "today", de: "heute" },
    unit: 6 
  },
  { 
    serbian: "sutra", 
    translations: { en: "tomorrow", de: "morgen" },
    unit: 6 
  },
  { 
    serbian: "juče", 
    translations: { en: "yesterday", de: "gestern" },
    unit: 6 
  },

  // Unit 7 - Dogovor (Making arrangements / Verabredungen)
  { 
    serbian: "dogovor", 
    translations: { en: "arrangement / agreement", de: "Verabredung / Vereinbarung" },
    unit: 7 
  },
  { 
    serbian: "sastanak", 
    translations: { en: "meeting", de: "Treffen / Besprechung" },
    unit: 7 
  },
  { 
    serbian: "poziv", 
    translations: { en: "invitation", de: "Einladung" },
    unit: 7 
  },
  { 
    serbian: "ponedeljak", 
    translations: { en: "Monday", de: "Montag" },
    unit: 7 
  },
  { 
    serbian: "utorak", 
    translations: { en: "Tuesday", de: "Dienstag" },
    unit: 7 
  },
  { 
    serbian: "sreda", 
    translations: { en: "Wednesday", de: "Mittwoch" },
    unit: 7 
  },
  { 
    serbian: "četvrtak", 
    translations: { en: "Thursday", de: "Donnerstag" },
    unit: 7 
  },
  { 
    serbian: "petak", 
    translations: { en: "Friday", de: "Freitag" },
    unit: 7 
  },
  { 
    serbian: "subota", 
    translations: { en: "Saturday", de: "Samstag" },
    unit: 7 
  },
  { 
    serbian: "nedelja", 
    translations: { en: "Sunday", de: "Sonntag" },
    unit: 7 
  },
  { 
    serbian: "nedelja", 
    translations: { en: "week", de: "Woche" },
    unit: 7 
  },
  { 
    serbian: "vikend", 
    translations: { en: "weekend", de: "Wochenende" },
    unit: 7 
  },
  { 
    serbian: "slobodan", 
    translations: { en: "free (time)", de: "frei (Zeit)" },
    unit: 7 
  },

  // Unit 8 - U restoranu (In the restaurant / Im Restaurant)
  { 
    serbian: "restoran", 
    translations: { en: "restaurant", de: "Restaurant" },
    unit: 8 
  },
  { 
    serbian: "meni", 
    translations: { en: "menu", de: "Speisekarte" },
    alternatives: { de: ["Menü"] },
    unit: 8 
  },
  { 
    serbian: "jelo", 
    translations: { en: "dish / meal", de: "Gericht / Mahlzeit" },
    unit: 8 
  },
  { 
    serbian: "predjelo", 
    translations: { en: "appetizer", de: "Vorspeise" },
    unit: 8 
  },
  { 
    serbian: "glavno jelo", 
    translations: { en: "main course", de: "Hauptgericht" },
    unit: 8 
  },
  { 
    serbian: "desert", 
    translations: { en: "dessert", de: "Dessert" },
    alternatives: { de: ["Nachspeise", "Nachtisch"] },
    unit: 8 
  },
  { 
    serbian: "supa", 
    translations: { en: "soup", de: "Suppe" },
    unit: 8 
  },
  { 
    serbian: "salata", 
    translations: { en: "salad", de: "Salat" },
    unit: 8 
  },
  { 
    serbian: "meso", 
    translations: { en: "meat", de: "Fleisch" },
    unit: 8 
  },
  { 
    serbian: "riba", 
    translations: { en: "fish", de: "Fisch" },
    unit: 8 
  },
  { 
    serbian: "piletina", 
    translations: { en: "chicken", de: "Hühnchen" },
    alternatives: { de: ["Hähnchen", "Huhn"] },
    unit: 8 
  },
  { 
    serbian: "svinjetina", 
    translations: { en: "pork", de: "Schweinefleisch" },
    unit: 8 
  },
  { 
    serbian: "govedina", 
    translations: { en: "beef", de: "Rindfleisch" },
    unit: 8 
  },
  { 
    serbian: "hleb", 
    translations: { en: "bread", de: "Brot" },
    unit: 8 
  },
  { 
    serbian: "pirinač", 
    translations: { en: "rice", de: "Reis" },
    unit: 8 
  },
  { 
    serbian: "krompir", 
    translations: { en: "potato", de: "Kartoffel" },
    unit: 8 
  },
  { 
    serbian: "povrće", 
    translations: { en: "vegetables", de: "Gemüse" },
    unit: 8 
  },
  { 
    serbian: "voće", 
    translations: { en: "fruit", de: "Obst" },
    unit: 8 
  },
  { 
    serbian: "ukusan", 
    translations: { en: "delicious / tasty", de: "lecker / schmackhaft" },
    unit: 8 
  },
  { 
    serbian: "jesti", 
    translations: { en: "to eat", de: "essen" },
    unit: 8 
  },

  // Unit 9 - Tipičan dan (Daily routine / Tägliche Routine)
  { 
    serbian: "ustati", 
    translations: { en: "to get up", de: "aufstehen" },
    unit: 9 
  },
  { 
    serbian: "umiti se", 
    translations: { en: "to wash oneself", de: "sich waschen" },
    unit: 9 
  },
  { 
    serbian: "obući se", 
    translations: { en: "to get dressed", de: "sich anziehen" },
    unit: 9 
  },
  { 
    serbian: "doručkovati", 
    translations: { en: "to have breakfast", de: "frühstücken" },
    unit: 9 
  },
  { 
    serbian: "ići", 
    translations: { en: "to go", de: "gehen" },
    unit: 9 
  },
  { 
    serbian: "posao", 
    translations: { en: "work / job", de: "Arbeit / Job" },
    unit: 9 
  },
  { 
    serbian: "ručati", 
    translations: { en: "to have lunch", de: "zu Mittag essen" },
    unit: 9 
  },
  { 
    serbian: "ručak", 
    translations: { en: "lunch", de: "Mittagessen" },
    unit: 9 
  },
  { 
    serbian: "večerati", 
    translations: { en: "to have dinner", de: "zu Abend essen" },
    unit: 9 
  },
  { 
    serbian: "večera", 
    translations: { en: "dinner", de: "Abendessen" },
    unit: 9 
  },
  { 
    serbian: "odmarati se", 
    translations: { en: "to rest", de: "sich ausruhen" },
    unit: 9 
  },
  { 
    serbian: "spavati", 
    translations: { en: "to sleep", de: "schlafen" },
    unit: 9 
  },
  { 
    serbian: "svaki dan", 
    translations: { en: "every day", de: "jeden Tag" },
    unit: 9 
  },
  { 
    serbian: "obično", 
    translations: { en: "usually", de: "normalerweise / gewöhnlich" },
    unit: 9 
  },
  { 
    serbian: "ponekad", 
    translations: { en: "sometimes", de: "manchmal" },
    unit: 9 
  },
  { 
    serbian: "uvek", 
    translations: { en: "always", de: "immer" },
    unit: 9 
  },
  { 
    serbian: "nikad", 
    translations: { en: "never", de: "nie / niemals" },
    unit: 9 
  },

  // Unit 10 - Porodica (Family / Familie)
  { 
    serbian: "porodica", 
    translations: { en: "family", de: "Familie" },
    unit: 10 
  },
  { 
    serbian: "otac", 
    translations: { en: "father", de: "Vater" },
    unit: 10 
  },
  { 
    serbian: "majka", 
    translations: { en: "mother", de: "Mutter" },
    unit: 10 
  },
  { 
    serbian: "sin", 
    translations: { en: "son", de: "Sohn" },
    unit: 10 
  },
  { 
    serbian: "kćerka", 
    translations: { en: "daughter", de: "Tochter" },
    unit: 10 
  },
  { 
    serbian: "brat", 
    translations: { en: "brother", de: "Bruder" },
    unit: 10 
  },
  { 
    serbian: "sestra", 
    translations: { en: "sister", de: "Schwester" },
    unit: 10 
  },
  { 
    serbian: "deda", 
    translations: { en: "grandfather", de: "Großvater" },
    alternatives: { de: ["Opa"] },
    unit: 10 
  },
  { 
    serbian: "baba", 
    translations: { en: "grandmother", de: "Großmutter" },
    alternatives: { de: ["Oma"] },
    unit: 10 
  },
  { 
    serbian: "muž", 
    translations: { en: "husband", de: "Ehemann" },
    alternatives: { de: ["Mann"] },
    unit: 10 
  },
  { 
    serbian: "žena", 
    translations: { en: "wife / woman", de: "Ehefrau / Frau" },
    unit: 10 
  },
  { 
    serbian: "dete", 
    translations: { en: "child", de: "Kind" },
    unit: 10 
  },
  { 
    serbian: "deca", 
    translations: { en: "children", de: "Kinder" },
    unit: 10 
  },
  { 
    serbian: "roditelji", 
    translations: { en: "parents", de: "Eltern" },
    unit: 10 
  },
  { 
    serbian: "rođak", 
    translations: { en: "relative", de: "Verwandter" },
    unit: 10 
  },
  { 
    serbian: "prijatelj", 
    translations: { en: "friend (male)", de: "Freund" },
    unit: 10 
  },
  { 
    serbian: "prijateljica", 
    translations: { en: "friend (female)", de: "Freundin" },
    unit: 10 
  },

  // Unit 11 - Ljudi (People / Menschen)
  { 
    serbian: "čovek", 
    translations: { en: "man / person", de: "Mann / Person" },
    alternatives: { de: ["Mensch"] },
    unit: 11 
  },
  { 
    serbian: "ljudi", 
    translations: { en: "people", de: "Leute / Menschen" },
    unit: 11 
  },
  { 
    serbian: "muškarac", 
    translations: { en: "man", de: "Mann" },
    unit: 11 
  },
  { 
    serbian: "žena", 
    translations: { en: "woman", de: "Frau" },
    unit: 11 
  },
  { 
    serbian: "mlad", 
    translations: { en: "young", de: "jung" },
    unit: 11 
  },
  { 
    serbian: "star", 
    translations: { en: "old", de: "alt" },
    unit: 11 
  },
  { 
    serbian: "visok", 
    translations: { en: "tall", de: "groß" },
    alternatives: { de: ["hoch"] },
    unit: 11 
  },
  { 
    serbian: "nizak", 
    translations: { en: "short (height)", de: "klein / niedrig" },
    unit: 11 
  },
  { 
    serbian: "lep", 
    translations: { en: "beautiful / handsome", de: "schön / hübsch" },
    unit: 11 
  },
  { 
    serbian: "ružan", 
    translations: { en: "ugly", de: "hässlich" },
    unit: 11 
  },
  { 
    serbian: "pametan", 
    translations: { en: "smart / clever", de: "klug / intelligent" },
    alternatives: { de: ["schlau"] },
    unit: 11 
  },
  { 
    serbian: "glup", 
    translations: { en: "stupid", de: "dumm" },
    unit: 11 
  },
  { 
    serbian: "dobar", 
    translations: { en: "good", de: "gut" },
    unit: 11 
  },
  { 
    serbian: "loš", 
    translations: { en: "bad", de: "schlecht" },
    unit: 11 
  },
  { 
    serbian: "ljubazan", 
    translations: { en: "kind / polite", de: "freundlich / höflich" },
    unit: 11 
  },
  { 
    serbian: "zanimanje", 
    translations: { en: "occupation / profession", de: "Beruf" },
    unit: 11 
  },
  { 
    serbian: "hobi", 
    translations: { en: "hobby", de: "Hobby" },
    unit: 11 
  },
  { 
    serbian: "sport", 
    translations: { en: "sport", de: "Sport" },
    unit: 11 
  },

  // Unit 12 - Narodi i jezici (Nationalities and languages / Nationen und Sprachen)
  { 
    serbian: "narod", 
    translations: { en: "nation / people", de: "Nation / Volk" },
    unit: 12 
  },
  { 
    serbian: "zemlja", 
    translations: { en: "country / land", de: "Land" },
    unit: 12 
  },
  { 
    serbian: "grad", 
    translations: { en: "city", de: "Stadt" },
    unit: 12 
  },
  { 
    serbian: "Srbija", 
    translations: { en: "Serbia", de: "Serbien" },
    unit: 12 
  },
  { 
    serbian: "Srbijanac", 
    translations: { en: "Serbian (male)", de: "Serbe" },
    unit: 12 
  },
  { 
    serbian: "Srbijanka", 
    translations: { en: "Serbian (female)", de: "Serbin" },
    unit: 12 
  },
  { 
    serbian: "srpski", 
    translations: { en: "Serbian (language/adj)", de: "Serbisch" },
    unit: 12 
  },
  { 
    serbian: "Engleska", 
    translations: { en: "England", de: "England" },
    unit: 12 
  },
  { 
    serbian: "Englez", 
    translations: { en: "Englishman", de: "Engländer" },
    unit: 12 
  },
  { 
    serbian: "Engleskinja", 
    translations: { en: "Englishwoman", de: "Engländerin" },
    unit: 12 
  },
  { 
    serbian: "engleski", 
    translations: { en: "English (language/adj)", de: "Englisch" },
    unit: 12 
  },
  { 
    serbian: "Nemačka", 
    translations: { en: "Germany", de: "Deutschland" },
    unit: 12 
  },
  { 
    serbian: "Nemac", 
    translations: { en: "German (male)", de: "Deutscher" },
    unit: 12 
  },
  { 
    serbian: "Nemica", 
    translations: { en: "German (female)", de: "Deutsche" },
    unit: 12 
  },
  { 
    serbian: "nemački", 
    translations: { en: "German (language/adj)", de: "Deutsch" },
    unit: 12 
  },
  { 
    serbian: "Francuska", 
    translations: { en: "France", de: "Frankreich" },
    unit: 12 
  },
  { 
    serbian: "Italija", 
    translations: { en: "Italy", de: "Italien" },
    unit: 12 
  },
  { 
    serbian: "Rusija", 
    translations: { en: "Russia", de: "Russland" },
    unit: 12 
  },
  { 
    serbian: "Amerika", 
    translations: { en: "America", de: "Amerika" },
    unit: 12 
  },

  // Unit 13 - Kako je bilo juče? (How was it yesterday? / Wie war es gestern?)
  { 
    serbian: "juče", 
    translations: { en: "yesterday", de: "gestern" },
    unit: 13 
  },
  { 
    serbian: "prekjuče", 
    translations: { en: "day before yesterday", de: "vorgestern" },
    unit: 13 
  },
  { 
    serbian: "prošle nedelje", 
    translations: { en: "last week", de: "letzte Woche" },
    unit: 13 
  },
  { 
    serbian: "prošlog meseca", 
    translations: { en: "last month", de: "letzten Monat" },
    unit: 13 
  },
  { 
    serbian: "prošle godine", 
    translations: { en: "last year", de: "letztes Jahr" },
    unit: 13 
  },
  { 
    serbian: "bio", 
    translations: { en: "was (male)", de: "war (männlich)" },
    unit: 13 
  },
  { 
    serbian: "bila", 
    translations: { en: "was (female)", de: "war (weiblich)" },
    unit: 13 
  },
  { 
    serbian: "bilo", 
    translations: { en: "was (neuter)", de: "war (sächlich)" },
    unit: 13 
  },
  { 
    serbian: "išao", 
    translations: { en: "went (male)", de: "ging (männlich)" },
    unit: 13 
  },
  { 
    serbian: "išla", 
    translations: { en: "went (female)", de: "ging (weiblich)" },
    unit: 13 
  },
  { 
    serbian: "video", 
    translations: { en: "saw (male)", de: "sah (männlich)" },
    unit: 13 
  },
  { 
    serbian: "videla", 
    translations: { en: "saw (female)", de: "sah (weiblich)" },
    unit: 13 
  },
  { 
    serbian: "rekao", 
    translations: { en: "said (male)", de: "sagte (männlich)" },
    unit: 13 
  },
  { 
    serbian: "rekla", 
    translations: { en: "said (female)", de: "sagte (weiblich)" },
    unit: 13 
  },

  // Unit 14 - Vreme (Weather / Wetter)
  { 
    serbian: "vreme", 
    translations: { en: "weather / time", de: "Wetter / Zeit" },
    unit: 14 
  },
  { 
    serbian: "sunce", 
    translations: { en: "sun", de: "Sonne" },
    unit: 14 
  },
  { 
    serbian: "kiša", 
    translations: { en: "rain", de: "Regen" },
    unit: 14 
  },
  { 
    serbian: "sneg", 
    translations: { en: "snow", de: "Schnee" },
    unit: 14 
  },
  { 
    serbian: "vetar", 
    translations: { en: "wind", de: "Wind" },
    unit: 14 
  },
  { 
    serbian: "oblak", 
    translations: { en: "cloud", de: "Wolke" },
    unit: 14 
  },
  { 
    serbian: "temperatura", 
    translations: { en: "temperature", de: "Temperatur" },
    unit: 14 
  },
  { 
    serbian: "toplo", 
    translations: { en: "warm / hot", de: "warm / heiß" },
    unit: 14 
  },
  { 
    serbian: "hladno", 
    translations: { en: "cold", de: "kalt" },
    unit: 14 
  },
  { 
    serbian: "lepo", 
    translations: { en: "nice / beautiful", de: "schön" },
    unit: 14 
  },
  { 
    serbian: "loše", 
    translations: { en: "bad", de: "schlecht" },
    unit: 14 
  },
  { 
    serbian: "proleće", 
    translations: { en: "spring", de: "Frühling" },
    unit: 14 
  },
  { 
    serbian: "leto", 
    translations: { en: "summer", de: "Sommer" },
    unit: 14 
  },
  { 
    serbian: "jesen", 
    translations: { en: "autumn / fall", de: "Herbst" },
    unit: 14 
  },
  { 
    serbian: "zima", 
    translations: { en: "winter", de: "Winter" },
    unit: 14 
  },
  { 
    serbian: "januar", 
    translations: { en: "January", de: "Januar" },
    unit: 14 
  },
  { 
    serbian: "februar", 
    translations: { en: "February", de: "Februar" },
    unit: 14 
  },
  { 
    serbian: "mart", 
    translations: { en: "March", de: "März" },
    unit: 14 
  },
  { 
    serbian: "april", 
    translations: { en: "April", de: "April" },
    unit: 14 
  },
  { 
    serbian: "maj", 
    translations: { en: "May", de: "Mai" },
    unit: 14 
  },
  { 
    serbian: "jun", 
    translations: { en: "June", de: "Juni" },
    unit: 14 
  },
  { 
    serbian: "jul", 
    translations: { en: "July", de: "Juli" },
    unit: 14 
  },
  { 
    serbian: "avgust", 
    translations: { en: "August", de: "August" },
    unit: 14 
  },
  { 
    serbian: "septembar", 
    translations: { en: "September", de: "September" },
    unit: 14 
  },
  { 
    serbian: "oktobar", 
    translations: { en: "October", de: "Oktober" },
    unit: 14 
  },
  { 
    serbian: "novembar", 
    translations: { en: "November", de: "November" },
    unit: 14 
  },
  { 
    serbian: "decembar", 
    translations: { en: "December", de: "Dezember" },
    unit: 14 
  },
  { 
    serbian: "sever", 
    translations: { en: "north", de: "Norden" },
    unit: 14 
  },
  { 
    serbian: "jug", 
    translations: { en: "south", de: "Süden" },
    unit: 14 
  },
  { 
    serbian: "istok", 
    translations: { en: "east", de: "Osten" },
    unit: 14 
  },
  { 
    serbian: "zapad", 
    translations: { en: "west", de: "Westen" },
    unit: 14 
  },

  // Unit 15 - Kako, s kim i kada putujete? (How, with whom and when do you travel? / Wie, mit wem und wann reist du?)
  { 
    serbian: "putovati", 
    translations: { en: "to travel", de: "reisen" },
    unit: 15 
  },
  { 
    serbian: "putovanje", 
    translations: { en: "journey / trip", de: "Reise" },
    unit: 15 
  },
  { 
    serbian: "avion", 
    translations: { en: "airplane", de: "Flugzeug" },
    unit: 15 
  },
  { 
    serbian: "voz", 
    translations: { en: "train", de: "Zug" },
    unit: 15 
  },
  { 
    serbian: "autobus", 
    translations: { en: "bus", de: "Bus" },
    unit: 15 
  },
  { 
    serbian: "auto", 
    translations: { en: "car", de: "Auto" },
    unit: 15 
  },
  { 
    serbian: "taksi", 
    translations: { en: "taxi", de: "Taxi" },
    unit: 15 
  },
  { 
    serbian: "bicikl", 
    translations: { en: "bicycle", de: "Fahrrad" },
    unit: 15 
  },
  { 
    serbian: "brod", 
    translations: { en: "ship / boat", de: "Schiff / Boot" },
    unit: 15 
  },
  { 
    serbian: "stanica", 
    translations: { en: "station", de: "Bahnhof / Station" },
    unit: 15 
  },
  { 
    serbian: "voziti", 
    translations: { en: "to drive", de: "fahren" },
    unit: 15 
  },
  { 
    serbian: "leteti", 
    translations: { en: "to fly", de: "fliegen" },
    unit: 15 
  },
  { 
    serbian: "brzo", 
    translations: { en: "fast / quickly", de: "schnell" },
    unit: 15 
  },
  { 
    serbian: "sporo", 
    translations: { en: "slow / slowly", de: "langsam" },
    unit: 15 
  },
  { 
    serbian: "sa", 
    translations: { en: "with", de: "mit" },
    unit: 15 
  },
  { 
    serbian: "bez", 
    translations: { en: "without", de: "ohne" },
    unit: 15 
  },

  // Unit 16 - Stivov novi stan (Steve's new apartment / Steves neue Wohnung)
  { 
    serbian: "stan", 
    translations: { en: "apartment", de: "Wohnung" },
    unit: 16 
  },
  { 
    serbian: "kuća", 
    translations: { en: "house", de: "Haus" },
    unit: 16 
  },
  { 
    serbian: "sprat", 
    translations: { en: "floor / storey", de: "Etage / Stockwerk" },
    unit: 16 
  },
  { 
    serbian: "dnevna soba", 
    translations: { en: "living room", de: "Wohnzimmer" },
    unit: 16 
  },
  { 
    serbian: "spavaća soba", 
    translations: { en: "bedroom", de: "Schlafzimmer" },
    unit: 16 
  },
  { 
    serbian: "kuhinja", 
    translations: { en: "kitchen", de: "Küche" },
    unit: 16 
  },
  { 
    serbian: "trpezarija", 
    translations: { en: "dining room", de: "Esszimmer" },
    unit: 16 
  },
  { 
    serbian: "kupatilo", 
    translations: { en: "bathroom", de: "Badezimmer" },
    alternatives: { de: ["Bad"] },
    unit: 16 
  },
  { 
    serbian: "balkon", 
    translations: { en: "balcony", de: "Balkon" },
    unit: 16 
  },
  { 
    serbian: "prozor", 
    translations: { en: "window", de: "Fenster" },
    unit: 16 
  },
  { 
    serbian: "vrata", 
    translations: { en: "door", de: "Tür" },
    unit: 16 
  },
  { 
    serbian: "sto", 
    translations: { en: "table", de: "Tisch" },
    unit: 16 
  },
  { 
    serbian: "stolica", 
    translations: { en: "chair", de: "Stuhl" },
    unit: 16 
  },
  { 
    serbian: "fotelja", 
    translations: { en: "armchair", de: "Sessel" },
    unit: 16 
  },
  { 
    serbian: "kauč", 
    translations: { en: "couch / sofa", de: "Couch / Sofa" },
    unit: 16 
  },
  { 
    serbian: "krevet", 
    translations: { en: "bed", de: "Bett" },
    unit: 16 
  },
  { 
    serbian: "orman", 
    translations: { en: "wardrobe / closet", de: "Schrank / Kleiderschrank" },
    unit: 16 
  },
  { 
    serbian: "polica", 
    translations: { en: "shelf", de: "Regal" },
    unit: 16 
  },
  { 
    serbian: "tepih", 
    translations: { en: "carpet / rug", de: "Teppich" },
    unit: 16 
  },
  { 
    serbian: "lampa", 
    translations: { en: "lamp", de: "Lampe" },
    unit: 16 
  },
  { 
    serbian: "slika", 
    translations: { en: "picture / painting", de: "Bild / Gemälde" },
    unit: 16 
  },

  // Unit 17 - Telefonski razgovor (Telephone conversation / Telefongespräch)
  { 
    serbian: "telefon", 
    translations: { en: "telephone", de: "Telefon" },
    unit: 17 
  },
  { 
    serbian: "mobilni", 
    translations: { en: "mobile phone", de: "Handy / Mobiltelefon" },
    unit: 17 
  },
  { 
    serbian: "poziv", 
    translations: { en: "call", de: "Anruf" },
    unit: 17 
  },
  { 
    serbian: "poruka", 
    translations: { en: "message", de: "Nachricht" },
    unit: 17 
  },
  { 
    serbian: "broj", 
    translations: { en: "number", de: "Nummer" },
    unit: 17 
  },
  { 
    serbian: "zvati", 
    translations: { en: "to call", de: "anrufen" },
    unit: 17 
  },
  { 
    serbian: "odgovoriti", 
    translations: { en: "to answer", de: "antworten" },
    unit: 17 
  },
  { 
    serbian: "slušati", 
    translations: { en: "to listen", de: "hören / zuhören" },
    unit: 17 
  },
  { 
    serbian: "čuti", 
    translations: { en: "to hear", de: "hören" },
    unit: 17 
  },
  { 
    serbian: "javiti se", 
    translations: { en: "to get in touch", de: "sich melden" },
    unit: 17 
  },
  { 
    serbian: "halo", 
    translations: { en: "hello (on phone)", de: "hallo (am Telefon)" },
    unit: 17 
  },
  { 
    serbian: "trenutak", 
    translations: { en: "moment", de: "Moment / Augenblick" },
    unit: 17 
  },
  { 
    serbian: "zauzeto", 
    translations: { en: "busy (phone line)", de: "besetzt (Leitung)" },
    unit: 17 
  },

  // Unit 18 - Stiv planira vikend (Planning a weekend / Wochenendplanung)
  { 
    serbian: "plan", 
    translations: { en: "plan", de: "Plan" },
    unit: 18 
  },
  { 
    serbian: "planirati", 
    translations: { en: "to plan", de: "planen" },
    unit: 18 
  },
  { 
    serbian: "hteti", 
    translations: { en: "to want", de: "wollen" },
    unit: 18 
  },
  { 
    serbian: "hoću", 
    translations: { en: "I will / I want", de: "ich werde / ich will" },
    unit: 18 
  },
  { 
    serbian: "neću", 
    translations: { en: "I won't", de: "ich werde nicht" },
    unit: 18 
  },
  { 
    serbian: "izlet", 
    translations: { en: "trip / excursion", de: "Ausflug" },
    unit: 18 
  },
  { 
    serbian: "piknik", 
    translations: { en: "picnic", de: "Picknick" },
    unit: 18 
  },
  { 
    serbian: "šetnja", 
    translations: { en: "walk", de: "Spaziergang" },
    unit: 18 
  },
  { 
    serbian: "kupovina", 
    translations: { en: "shopping", de: "Einkaufen" },
    unit: 18 
  },
  { 
    serbian: "bioskop", 
    translations: { en: "cinema", de: "Kino" },
    unit: 18 
  },
  { 
    serbian: "koncert", 
    translations: { en: "concert", de: "Konzert" },
    unit: 18 
  },
  { 
    serbian: "zabava", 
    translations: { en: "party / fun", de: "Party / Spaß" },
    unit: 18 
  },

  // Unit 19 - Srećan rođendan! (Happy birthday! / Alles Gute zum Geburtstag!)
  { 
    serbian: "rođendan", 
    translations: { en: "birthday", de: "Geburtstag" },
    unit: 19 
  },
  { 
    serbian: "srećan", 
    translations: { en: "happy", de: "glücklich / fröhlich" },
    unit: 19 
  },
  { 
    serbian: "proslava", 
    translations: { en: "celebration", de: "Feier" },
    unit: 19 
  },
  { 
    serbian: "poklon", 
    translations: { en: "gift / present", de: "Geschenk" },
    unit: 19 
  },
  { 
    serbian: "torta", 
    translations: { en: "cake", de: "Kuchen / Torte" },
    unit: 19 
  },
  { 
    serbian: "sveća", 
    translations: { en: "candle", de: "Kerze" },
    unit: 19
  },
  { 
    serbian: "gost", 
    translations: { en: "guest", de: "Gast" },
    unit: 19 
  },
  { 
    serbian: "zabava", 
    translations: { en: "party", de: "Party / Feier" },
    unit: 19 
  },
  { 
    serbian: "čestitati", 
    translations: { en: "to congratulate", de: "gratulieren" },
    unit: 19 
  },
  { 
    serbian: "slaviti", 
    translations: { en: "to celebrate", de: "feiern" },
    unit: 19 
  },
  { 
    serbian: "datum", 
    translations: { en: "date", de: "Datum" },
    unit: 19 
  },
  { 
    serbian: "godina", 
    translations: { en: "year", de: "Jahr" },
    unit: 19 
  },
  { 
    serbian: "mesec", 
    translations: { en: "month", de: "Monat" },
    unit: 19 
  },

  // Unit 20 - Kod lekara (Health matters / Gesundheit)
  { 
    serbian: "lekar", 
    translations: { en: "doctor", de: "Arzt" },
    unit: 20 
  },
  { 
    serbian: "bolnica", 
    translations: { en: "hospital", de: "Krankenhaus" },
    unit: 20 
  },
  { 
    serbian: "apoteka", 
    translations: { en: "pharmacy", de: "Apotheke" },
    unit: 20 
  },
  { 
    serbian: "lek", 
    translations: { en: "medicine / drug", de: "Medikament / Arznei" },
    unit: 20 
  },
  { 
    serbian: "bolest", 
    translations: { en: "illness / disease", de: "Krankheit" },
    unit: 20 
  },
  { 
    serbian: "boleti", 
    translations: { en: "to hurt / ache", de: "schmerzen / wehtun" },
    unit: 20 
  },
  { 
    serbian: "boli me", 
    translations: { en: "it hurts me", de: "es tut mir weh" },
    unit: 20 
  },
  { 
    serbian: "glava", 
    translations: { en: "head", de: "Kopf" },
    unit: 20 
  },
  { 
    serbian: "oko", 
    translations: { en: "eye", de: "Auge" },
    unit: 20 
  },
  { 
    serbian: "uvo", 
    translations: { en: "ear", de: "Ohr" },
    unit: 20 
  },
  { 
    serbian: "nos", 
    translations: { en: "nose", de: "Nase" },
    unit: 20 
  },
  { 
    serbian: "usta", 
    translations: { en: "mouth", de: "Mund" },
    unit: 20 
  },
  { 
    serbian: "zub", 
    translations: { en: "tooth", de: "Zahn" },
    unit: 20 
  },
  { 
    serbian: "grlo", 
    translations: { en: "throat", de: "Hals / Rachen" },
    unit: 20 
  },
  { 
    serbian: "stomak", 
    translations: { en: "stomach", de: "Magen / Bauch" },
    unit: 20 
  },
  { 
    serbian: "ruka", 
    translations: { en: "hand / arm", de: "Hand / Arm" },
    unit: 20 
  },
  { 
    serbian: "noga", 
    translations: { en: "leg / foot", de: "Bein / Fuß" },
    unit: 20 
  },
  { 
    serbian: "srce", 
    translations: { en: "heart", de: "Herz" },
    unit: 20 
  },
  { 
    serbian: "temperatura", 
    translations: { en: "temperature / fever", de: "Temperatur / Fieber" },
    unit: 20 
  },
  { 
    serbian: "prehlada", 
    translations: { en: "cold (illness)", de: "Erkältung" },
    unit: 20 
  },
  { 
    serbian: "grip", 
    translations: { en: "flu", de: "Grippe" },
    unit: 20 
  },

  // Unit 21 - Boje i odeća (Colors and Clothes / Farben und Kleidung)
  { 
    serbian: "boja", 
    translations: { en: "color", de: "Farbe" },
    unit: 21 
  },
  { 
    serbian: "beo", 
    translations: { en: "white", de: "weiß" },
    unit: 21 
  },
  { 
    serbian: "crn", 
    translations: { en: "black", de: "schwarz" },
    unit: 21 
  },
  { 
    serbian: "crven", 
    translations: { en: "red", de: "rot" },
    unit: 21 
  },
  { 
    serbian: "plav", 
    translations: { en: "blue", de: "blau" },
    unit: 21 
  },
  { 
    serbian: "zelen", 
    translations: { en: "green", de: "grün" },
    unit: 21 
  },
  { 
    serbian: "žut", 
    translations: { en: "yellow", de: "gelb" },
    unit: 21 
  },
  { 
    serbian: "narandžast", 
    translations: { en: "orange", de: "orange" },
    unit: 21 
  },
  { 
    serbian: "ljubičast", 
    translations: { en: "purple", de: "lila / violett" },
    unit: 21 
  },
  { 
    serbian: "siv", 
    translations: { en: "gray", de: "grau" },
    unit: 21 
  },
  { 
    serbian: "braon", 
    translations: { en: "brown", de: "braun" },
    unit: 21 
  },
  { 
    serbian: "odeća", 
    translations: { en: "clothes", de: "Kleidung" },
    unit: 21 
  },
  { 
    serbian: "košulja", 
    translations: { en: "shirt", de: "Hemd" },
    unit: 21 
  },
  { 
    serbian: "majica", 
    translations: { en: "T-shirt", de: "T-Shirt" },
    unit: 21 
  },
  { 
    serbian: "pantalone", 
    translations: { en: "pants / trousers", de: "Hose" },
    unit: 21 
  },
  { 
    serbian: "farmerke", 
    translations: { en: "jeans", de: "Jeans" },
    unit: 21 
  },
  { 
    serbian: "suknja", 
    translations: { en: "skirt", de: "Rock" },
    unit: 21 
  },
  { 
    serbian: "haljina", 
    translations: { en: "dress", de: "Kleid" },
    unit: 21 
  },
  { 
    serbian: "jakna", 
    translations: { en: "jacket", de: "Jacke" },
    unit: 21 
  },
  { 
    serbian: "kaput", 
    translations: { en: "coat", de: "Mantel" },
    unit: 21 
  },
  { 
    serbian: "cipele", 
    translations: { en: "shoes", de: "Schuhe" },
    unit: 21 
  },
  { 
    serbian: "patike", 
    translations: { en: "sneakers", de: "Turnschuhe / Sneakers" },
    unit: 21 
  },
  { 
    serbian: "čizme", 
    translations: { en: "boots", de: "Stiefel" },
    unit: 21 
  },
  { 
    serbian: "nositi", 
    translations: { en: "to wear / carry", de: "tragen" },
    unit: 21 
  },

  // Unit 22 - Šta je bolje? (What's better? / Was ist besser?)
  { 
    serbian: "bolji", 
    translations: { en: "better", de: "besser" },
    unit: 22 
  },
  { 
    serbian: "najbolji", 
    translations: { en: "best", de: "am besten / der beste" },
    unit: 22 
  },
  { 
    serbian: "gori", 
    translations: { en: "worse", de: "schlechter" },
    unit: 22 
  },
  { 
    serbian: "najgori", 
    translations: { en: "worst", de: "am schlechtesten / der schlechteste" },
    unit: 22 
  },
  { 
    serbian: "veći", 
    translations: { en: "bigger", de: "größer" },
    unit: 22 
  },
  { 
    serbian: "najveći", 
    translations: { en: "biggest", de: "am größten / der größte" },
    unit: 22 
  },
  { 
    serbian: "manji", 
    translations: { en: "smaller", de: "kleiner" },
    unit: 22 
  },
  { 
    serbian: "najmanji", 
    translations: { en: "smallest", de: "am kleinsten / der kleinste" },
    unit: 22 
  },
  { 
    serbian: "viši", 
    translations: { en: "taller", de: "größer / höher" },
    unit: 22 
  },
  { 
    serbian: "niži", 
    translations: { en: "shorter", de: "kleiner / niedriger" },
    unit: 22 
  },
  { 
    serbian: "lepši", 
    translations: { en: "more beautiful", de: "schöner" },
    unit: 22 
  },
  { 
    serbian: "najlepši", 
    translations: { en: "most beautiful", de: "am schönsten / der schönste" },
    unit: 22 
  },
  { 
    serbian: "jeftiniji", 
    translations: { en: "cheaper", de: "günstiger / billiger" },
    unit: 22 
  },
  { 
    serbian: "skuplji", 
    translations: { en: "more expensive", de: "teurer" },
    unit: 22 
  },
  { 
    serbian: "brži", 
    translations: { en: "faster", de: "schneller" },
    unit: 22 
  },
  { 
    serbian: "sporiji", 
    translations: { en: "slower", de: "langsamer" },
    unit: 22 
  },

  // Unit 23 - Kako izgledaju? (How do they look like? / Wie sehen sie aus?)
  { 
    serbian: "izgled", 
    translations: { en: "appearance / look", de: "Aussehen" },
    unit: 23 
  },
  { 
    serbian: "izgledati", 
    translations: { en: "to look / appear", de: "aussehen" },
    unit: 23 
  },
  { 
    serbian: "kosa", 
    translations: { en: "hair", de: "Haare" },
    unit: 23 
  },
  { 
    serbian: "oči", 
    translations: { en: "eyes", de: "Augen" },
    unit: 23 
  },
  { 
    serbian: "plav", 
    translations: { en: "blond", de: "blond" },
    unit: 23 
  },
  { 
    serbian: "crn", 
    translations: { en: "black (hair)", de: "schwarz (Haare)" },
    unit: 23 
  },
  { 
    serbian: "smeđ", 
    translations: { en: "brown (hair)", de: "braun (Haare)" },
    unit: 23 
  },
  { 
    serbian: "kratak", 
    translations: { en: "short", de: "kurz" },
    unit: 23 
  },
  { 
    serbian: "dug", 
    translations: { en: "long", de: "lang" },
    unit: 23 
  },
  { 
    serbian: "debeo", 
    translations: { en: "fat / thick", de: "dick / fett" },
    unit: 23 
  },
  { 
    serbian: "mršav", 
    translations: { en: "thin / skinny", de: "dünn / mager" },
    unit: 23 
  },
  { 
    serbian: "lep", 
    translations: { en: "beautiful / handsome", de: "schön / hübsch" },
    unit: 23 
  },
  { 
    serbian: "ružan", 
    translations: { en: "ugly", de: "hässlich" },
    unit: 23 
  },
  { 
    serbian: "mlad", 
    translations: { en: "young", de: "jung" },
    unit: 23 
  },
  { 
    serbian: "star", 
    translations: { en: "old", de: "alt" },
    unit: 23 
  },

  // Unit 24 - Poseta (Visiting places / Orte besuchen)
  { 
    serbian: "poseta", 
    translations: { en: "visit", de: "Besuch" },
    unit: 24 
  },
  { 
    serbian: "posetiti", 
    translations: { en: "to visit", de: "besuchen" },
    unit: 24 
  },
  { 
    serbian: "turista", 
    translations: { en: "tourist", de: "Tourist" },
    unit: 24 
  },
  { 
    serbian: "turizam", 
    translations: { en: "tourism", de: "Tourismus" },
    unit: 24 
  },
  { 
    serbian: "znamenitost", 
    translations: { en: "landmark / sight", de: "Sehenswürdigkeit" },
    unit: 24 
  },
  { 
    serbian: "crkva", 
    translations: { en: "church", de: "Kirche" },
    unit: 24 
  },
  { 
    serbian: "tvrđava", 
    translations: { en: "fortress", de: "Festung" },
    unit: 24 
  },
  { 
    serbian: "zamak", 
    translations: { en: "castle", de: "Schloss" },
    unit: 24 
  },
  { 
    serbian: "spomenik", 
    translations: { en: "monument", de: "Denkmal" },
    unit: 24 
  },
  { 
    serbian: "fotografija", 
    translations: { en: "photograph", de: "Fotografie / Foto" },
    unit: 24 
  },
  { 
    serbian: "fotografisati", 
    translations: { en: "to photograph", de: "fotografieren" },
    unit: 24 
  },
  { 
    serbian: "razgledati", 
    translations: { en: "to sightsee", de: "besichtigen" },
    unit: 24 
  },

  // Unit 25 - (Ne)običan dan ((Un)usual day / (Un)gewöhnlicher Tag)
  { 
    serbian: "običan", 
    translations: { en: "usual / ordinary", de: "gewöhnlich / normal" },
    unit: 25 
  },
  { 
    serbian: "neobičan", 
    translations: { en: "unusual", de: "ungewöhnlich" },
    unit: 25 
  },
  { 
    serbian: "događaj", 
    translations: { en: "event", de: "Ereignis / Veranstaltung" },
    unit: 25 
  },
  { 
    serbian: "desiti se", 
    translations: { en: "to happen", de: "passieren / geschehen" },
    unit: 25 
  },
  { 
    serbian: "početi", 
    translations: { en: "to begin / start", de: "beginnen / anfangen" },
    unit: 25 
  },
  { 
    serbian: "završiti", 
    translations: { en: "to finish / end", de: "beenden / fertigstellen" },
    unit: 25 
  },
  { 
    serbian: "nastaviti", 
    translations: { en: "to continue", de: "fortsetzen / weitermachen" },
    unit: 25 
  },
  { 
    serbian: "prestati", 
    translations: { en: "to stop", de: "aufhören / stoppen" },
    unit: 25 
  },
  { 
    serbian: "uspeti", 
    translations: { en: "to succeed", de: "gelingen / Erfolg haben" },
    unit: 25 
  },
  { 
    serbian: "probati", 
    translations: { en: "to try", de: "versuchen / probieren" },
    unit: 25 
  },

  // Unit 26 - Iznenađenje (Surprise / Überraschung)
  { 
    serbian: "iznenađenje", 
    translations: { en: "surprise", de: "Überraschung" },
    unit: 26 
  },
  { 
    serbian: "iznenaditi", 
    translations: { en: "to surprise", de: "überraschen" },
    unit: 26 
  },
  { 
    serbian: "doći", 
    translations: { en: "to come / arrive", de: "kommen / ankommen" },
    unit: 26 
  },
  { 
    serbian: "otići", 
    translations: { en: "to leave / go away", de: "weggehen / verlassen" },
    unit: 26 
  },
  { 
    serbian: "ući", 
    translations: { en: "to enter", de: "eintreten / hineingehen" },
    unit: 26 
  },
  { 
    serbian: "izaći", 
    translations: { en: "to exit / go out", de: "ausgehen / hinausgehen" },
    unit: 26 
  },
  { 
    serbian: "proći", 
    translations: { en: "to pass", de: "vorbeigehen / passieren" },
    unit: 26 
  },
  { 
    serbian: "preći", 
    translations: { en: "to cross", de: "überqueren" },
    unit: 26 
  },
  { 
    serbian: "doneti", 
    translations: { en: "to bring", de: "bringen / mitbringen" },
    unit: 26 
  },
  { 
    serbian: "odneti", 
    translations: { en: "to take away", de: "wegnehmen / mitnehmen" },
    unit: 26 
  },

  // Unit 27 - Šta ćeš raditi sutra? (What will you do tomorrow? / Was wirst du morgen machen?)
  { 
    serbian: "sutra", 
    translations: { en: "tomorrow", de: "morgen" },
    unit: 27 
  },
  { 
    serbian: "prekosutra", 
    translations: { en: "day after tomorrow", de: "übermorgen" },
    unit: 27 
  },
  { 
    serbian: "sledeće nedelje", 
    translations: { en: "next week", de: "nächste Woche" },
    unit: 27 
  },
  { 
    serbian: "sledećeg meseca", 
    translations: { en: "next month", de: "nächsten Monat" },
    unit: 27 
  },
  { 
    serbian: "sledeće godine", 
    translations: { en: "next year", de: "nächstes Jahr" },
    unit: 27 
  },
  { 
    serbian: "uskoro", 
    translations: { en: "soon", de: "bald" },
    unit: 27 
  },
  { 
    serbian: "kasnije", 
    translations: { en: "later", de: "später" },
    unit: 27 
  },
  { 
    serbian: "možda", 
    translations: { en: "maybe / perhaps", de: "vielleicht" },
    unit: 27 
  },
  { 
    serbian: "sigurno", 
    translations: { en: "certainly / surely", de: "sicher / bestimmt" },
    unit: 27 
  },
  { 
    serbian: "verovatno", 
    translations: { en: "probably", de: "wahrscheinlich" },
    unit: 27 
  },
  { 
    serbian: "nadam se", 
    translations: { en: "I hope", de: "ich hoffe" },
    unit: 27 
  },
];



