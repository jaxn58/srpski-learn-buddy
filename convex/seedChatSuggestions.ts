import { internalMutation } from "./_generated/server";

// @ts-ignore TS2589
export const seed = internalMutation({
  args: {},
  // @ts-ignore TS2589
  handler: async (ctx) => {
    const existing = await ctx.db.query("chatSuggestions").first();
    if (existing) {
      console.log("chatSuggestions already seeded, skipping. Delete all rows first to re-seed.");
      return;
    }

    const suggestions = [
      // ==============================================
      // LANGUAGE — Sprache
      // ==============================================

      // Beginner (Unit 1-3)
      {
        category: "language" as const,
        unitMin: 1, unitMax: 3,
        textEn: "Greetings & basics — How do I say hello properly?",
        textDe: "Begrüßung & Basics — Wie grüße ich richtig?",
        prefillEn: "What's the difference between 'Zdravo', 'Ćao' and 'Dobar dan'? When do I use which?",
        prefillDe: "Was ist der Unterschied zwischen 'Zdravo', 'Ćao' und 'Dobar dan'? Wann benutze ich was?",
        priority: 5, isActive: true,
      },
      {
        category: "language" as const,
        unitMin: 1, unitMax: 3,
        textEn: "First words — Introduce yourself in Serbian",
        textDe: "Erste Worte — Stell dich auf Serbisch vor",
        prefillEn: "Help me introduce myself in Serbian. I want to say my name, where I'm from, and what I do.",
        prefillDe: "Hilf mir, mich auf Serbisch vorzustellen. Ich möchte meinen Namen, woher ich komme und was ich mache sagen.",
        priority: 4, isActive: true,
      },
      {
        category: "language" as const,
        unitMin: 1, unitMax: 3,
        textEn: "Numbers & ordering — How to order coffee like a local",
        textDe: "Zahlen & bestellen — Kaffee bestellen wie ein Local",
        prefillEn: "How do I order a coffee in Serbian? What do I say at a kafana?",
        prefillDe: "Wie bestelle ich einen Kaffee auf Serbisch? Was sage ich in einer Kafana?",
        priority: 3, isActive: true,
      },

      // Intermediate (Unit 4-8)
      {
        category: "language" as const,
        unitMin: 4, unitMax: 8,
        textEn: "Cases explained — When do I use which case?",
        textDe: "Fälle erklärt — Wann benutze ich welchen Fall?",
        prefillEn: "Explain the Serbian cases to me. I keep mixing up accusative and locative — what's the trick?",
        prefillDe: "Erkläre mir die serbischen Fälle. Ich verwechsle ständig Akkusativ und Lokativ — was ist der Trick?",
        priority: 5, isActive: true,
      },
      {
        category: "language" as const,
        unitMin: 4, unitMax: 8,
        textEn: "Verb conjugation — Master 'biti', 'imati', 'hteti'",
        textDe: "Konjugation — 'biti', 'imati', 'hteti' meistern",
        prefillEn: "Walk me through the conjugation of 'biti' (to be), 'imati' (to have), and 'hteti' (to want) with examples.",
        prefillDe: "Führe mich durch die Konjugation von 'biti' (sein), 'imati' (haben) und 'hteti' (wollen) mit Beispielen.",
        priority: 4, isActive: true,
      },
      {
        category: "language" as const,
        unitMin: 4, unitMax: 8,
        textEn: "Shopping vocabulary — Bargain at the pijaca",
        textDe: "Einkaufs-Vokabeln — Handeln auf der Pijaca",
        prefillEn: "What phrases do I need for shopping at a Serbian market (pijaca)? How do I ask for prices and bargain?",
        prefillDe: "Welche Redewendungen brauche ich zum Einkaufen auf einem serbischen Markt (Pijaca)? Wie frage ich nach Preisen und handle?",
        priority: 3, isActive: true,
      },

      // Advanced (Unit 9+)
      {
        category: "language" as const,
        unitMin: 9, unitMax: 999,
        textEn: "Slang & colloquial — Talk like a real Belgrader",
        textDe: "Slang & Umgangssprache — Reden wie ein echter Belgrader",
        prefillEn: "Teach me some Belgrade slang and colloquial expressions that locals actually use. I want to sound natural!",
        prefillDe: "Bring mir Belgrader Slang und Umgangssprache bei, die Einheimische wirklich benutzen. Ich will natürlich klingen!",
        priority: 5, isActive: true,
      },
      {
        category: "language" as const,
        unitMin: 9, unitMax: 999,
        textEn: "Aspect pairs — Perfective vs. imperfective verbs",
        textDe: "Aspektpaare — Perfektive vs. imperfektive Verben",
        prefillEn: "Explain perfective vs. imperfective verb pairs in Serbian with everyday examples. When do I use which?",
        prefillDe: "Erkläre perfektive vs. imperfektive Verbpaare im Serbischen mit Alltagsbeispielen. Wann verwende ich welches?",
        priority: 4, isActive: true,
      },

      // Universal language (any unit)
      {
        category: "language" as const,
        textEn: "Cyrillic vs. Latin — Which script should I learn?",
        textDe: "Kyrillisch vs. Latein — Welche Schrift soll ich lernen?",
        prefillEn: "Should I learn Cyrillic or Latin script first? Where is each one used in daily life in Serbia?",
        prefillDe: "Soll ich zuerst Kyrillisch oder Lateinschrift lernen? Wo wird welche im Alltag in Serbien verwendet?",
        priority: 2, isActive: true,
      },

      // ==============================================
      // CULTURE — Kultur
      // ==============================================

      // Holiday-specific
      {
        category: "culture" as const,
        holidayDate: "01-07", holidayWindowDays: 14,
        textEn: "Božić — How Serbs celebrate Orthodox Christmas",
        textDe: "Božić — Wie Serben Weihnachten feiern",
        prefillEn: "Tell me about Serbian Orthodox Christmas (Božić). What traditions are there? What does 'Mir Božji, Hristos se rodi' mean?",
        prefillDe: "Erzähle mir über das serbisch-orthodoxe Weihnachten (Božić). Welche Traditionen gibt es? Was bedeutet 'Mir Božji, Hristos se rodi'?",
        priority: 10, isActive: true,
      },
      {
        category: "culture" as const,
        holidayDate: "01-14", holidayWindowDays: 7,
        textEn: "Srpska Nova Godina — Serbian New Year on Jan 14th",
        textDe: "Srpska Nova Godina — Serbisches Neujahr am 14. Januar",
        prefillEn: "What is Serbian New Year (Srpska Nova Godina)? Why do Serbs celebrate New Year twice?",
        prefillDe: "Was ist das serbische Neujahr (Srpska Nova Godina)? Warum feiern Serben zweimal Neujahr?",
        priority: 10, isActive: true,
      },
      {
        category: "culture" as const,
        holidayDate: "02-15", holidayWindowDays: 7,
        textEn: "Sretenje — Serbia's National Day",
        textDe: "Sretenje — Serbiens Nationalfeiertag",
        prefillEn: "What is Sretenje (February 15) and why is it Serbia's national day? What happened on this date?",
        prefillDe: "Was ist Sretenje (15. Februar) und warum ist es Serbiens Nationalfeiertag? Was geschah an diesem Datum?",
        priority: 10, isActive: true,
      },
      {
        category: "culture" as const,
        holidayDate: "06-28", holidayWindowDays: 7,
        textEn: "Vidovdan — The most important day in Serbian history",
        textDe: "Vidovdan — Der wichtigste Tag der serbischen Geschichte",
        prefillEn: "What is Vidovdan and why is it so important to Serbs? Tell me about the Battle of Kosovo.",
        prefillDe: "Was ist Vidovdan und warum ist er für Serben so wichtig? Erzähle mir über die Schlacht auf dem Amselfeld.",
        priority: 10, isActive: true,
      },
      {
        category: "culture" as const,
        holidayDate: "05-06", holidayWindowDays: 7,
        textEn: "Đurđevdan — St. George's Day and Roma celebration",
        textDe: "Đurđevdan — Georgstag und Roma-Feier",
        prefillEn: "What is Đurđevdan? How do Serbs and especially Roma communities celebrate it?",
        prefillDe: "Was ist Đurđevdan? Wie feiern Serben und besonders die Roma-Gemeinschaft diesen Tag?",
        priority: 10, isActive: true,
      },

      // Seasonal culture
      {
        category: "culture" as const,
        seasonalTag: "summer" as const,
        textEn: "Summer on the Balkan — EXIT Festival, Adriatic & Rakija",
        textDe: "Sommer am Balkan — EXIT Festival, Adria & Rakija",
        prefillEn: "What should I know about summer in Serbia? Tell me about EXIT Festival, the coast in Montenegro, and summer traditions.",
        prefillDe: "Was sollte ich über den Sommer in Serbien wissen? Erzähle mir über das EXIT Festival, die Küste in Montenegro und Sommertraditionen.",
        priority: 5, isActive: true,
      },
      {
        category: "culture" as const,
        seasonalTag: "winter" as const,
        textEn: "Winter traditions — Slava, Badnje Veče & warm Rakija",
        textDe: "Wintertraditionen — Slava, Badnje Veče & warme Rakija",
        prefillEn: "Tell me about Serbian winter traditions. What is Badnje Veče? What happens at a Slava celebration?",
        prefillDe: "Erzähle mir von serbischen Wintertraditionen. Was ist Badnje Veče? Was passiert bei einer Slava-Feier?",
        priority: 5, isActive: true,
      },
      {
        category: "culture" as const,
        seasonalTag: "autumn" as const,
        textEn: "Autumn — Kupus season, Slava time & cozy kafanas",
        textDe: "Herbst — Kupus-Saison, Slava-Zeit & gemütliche Kafanas",
        prefillEn: "What's special about autumn in Serbia? Tell me about the food, Slava season, and how people spend time in kafanas.",
        prefillDe: "Was ist besonders am Herbst in Serbien? Erzähle mir über das Essen, die Slava-Saison und wie Leute Zeit in Kafanas verbringen.",
        priority: 5, isActive: true,
      },
      {
        category: "culture" as const,
        seasonalTag: "spring" as const,
        textEn: "Spring — Vaskrs (Easter), nature & celebrations",
        textDe: "Frühling — Vaskrs (Ostern), Natur & Feste",
        prefillEn: "How do Serbs celebrate Orthodox Easter (Vaskrs)? What spring traditions exist?",
        prefillDe: "Wie feiern Serben das orthodoxe Ostern (Vaskrs)? Welche Frühlingstraditionen gibt es?",
        priority: 5, isActive: true,
      },

      // Universal culture
      {
        category: "culture" as const,
        textEn: "Slava — The unique Serbian family patron saint day",
        textDe: "Slava — Der einzigartige serbische Familien-Schutzpatron",
        prefillEn: "What is Slava? How does it work, what do guests bring, and how should I behave as a guest?",
        prefillDe: "Was ist eine Slava? Wie läuft das ab, was bringen Gäste mit, und wie verhalte ich mich als Gast?",
        priority: 3, isActive: true,
      },
      {
        category: "culture" as const,
        textEn: "Kafana culture — More than just a restaurant",
        textDe: "Kafana-Kultur — Mehr als nur ein Restaurant",
        prefillEn: "What is a kafana and why is it so important in Serbian culture? What should I know before visiting one?",
        prefillDe: "Was ist eine Kafana und warum ist sie so wichtig in der serbischen Kultur? Was sollte ich vor einem Besuch wissen?",
        priority: 3, isActive: true,
      },
      {
        category: "culture" as const,
        textEn: "Serbian cuisine — Ćevapi, Pljeskavica & more",
        textDe: "Serbische Küche — Ćevapi, Pljeskavica & mehr",
        prefillEn: "What are the most important Serbian dishes I need to try? What is the difference between Ćevapi, Pljeskavica, and Burek?",
        prefillDe: "Was sind die wichtigsten serbischen Gerichte, die ich probieren muss? Was ist der Unterschied zwischen Ćevapi, Pljeskavica und Burek?",
        priority: 2, isActive: true,
      },

      // ==============================================
      // SOS — Alltags-Helfer / Notfall
      // ==============================================

      // Universal SOS
      {
        category: "sos" as const,
        textEn: "At the doctor — Describe symptoms in Serbian",
        textDe: "Beim Arzt — Symptome auf Serbisch beschreiben",
        prefillEn: "I'm at the doctor and need to explain that I have a headache and feel nauseous. How do I say that in Serbian?",
        prefillDe: "Ich bin beim Arzt und muss erklären, dass ich Kopfschmerzen habe und mir übel ist. Wie sage ich das auf Serbisch?",
        priority: 5, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "Emergency phrases — Police, ambulance, help!",
        textDe: "Notfall-Sätze — Polizei, Krankenwagen, Hilfe!",
        prefillEn: "What are the most important emergency phrases in Serbian? How do I call for help, police, or an ambulance?",
        prefillDe: "Was sind die wichtigsten Notfall-Sätze auf Serbisch? Wie rufe ich um Hilfe, Polizei oder einen Krankenwagen?",
        priority: 6, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "At the pharmacy — Ask for medicine",
        textDe: "In der Apotheke — Nach Medikamenten fragen",
        prefillEn: "How do I ask for painkillers, cold medicine, or allergy pills at a Serbian pharmacy (apoteka)?",
        prefillDe: "Wie frage ich in einer serbischen Apotheke (Apoteka) nach Schmerzmitteln, Erkältungsmedizin oder Allergietabletten?",
        priority: 4, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "Lost & directions — 'Where is...?' in Serbian",
        textDe: "Verlaufen & Wegbeschreibung — 'Wo ist...?' auf Serbisch",
        prefillEn: "I'm lost! How do I ask for directions in Serbian? 'Where is the nearest...?', 'How do I get to...?'",
        prefillDe: "Ich habe mich verlaufen! Wie frage ich auf Serbisch nach dem Weg? 'Wo ist der/die nächste...?', 'Wie komme ich zu...?'",
        priority: 5, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "Taxi & transport — Get around without getting ripped off",
        textDe: "Taxi & Transport — Sicher ans Ziel kommen",
        prefillEn: "How do I take a taxi in Serbia? What should I say to the driver? How do I avoid being overcharged?",
        prefillDe: "Wie nehme ich ein Taxi in Serbien? Was sage ich dem Fahrer? Wie vermeide ich, übers Ohr gehauen zu werden?",
        priority: 4, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "Restaurant survival — Order, pay, and tip",
        textDe: "Restaurant-Survival — Bestellen, bezahlen & Trinkgeld",
        prefillEn: "How do I order food, ask for the bill, and handle tipping in a Serbian restaurant? What are common phrases?",
        prefillDe: "Wie bestelle ich Essen, frage nach der Rechnung und gebe Trinkgeld in einem serbischen Restaurant? Welche Phrasen brauche ich?",
        priority: 3, isActive: true,
      },

      // Seasonal SOS
      {
        category: "sos" as const,
        seasonalTag: "summer" as const,
        textEn: "Beach & sun — Essential summer phrases",
        textDe: "Strand & Sonne — Wichtige Sommer-Phrasen",
        prefillEn: "What Serbian phrases do I need at the beach? How do I rent a sunbed, order drinks, or ask about water temperature?",
        prefillDe: "Welche serbischen Phrasen brauche ich am Strand? Wie miete ich eine Liege, bestelle Getränke oder frage nach der Wassertemperatur?",
        priority: 4, isActive: true,
      },
      {
        category: "sos" as const,
        seasonalTag: "winter" as const,
        textEn: "Cold weather — Winter clothing & heating vocabulary",
        textDe: "Kälte — Winter-Kleidung & Heizungs-Vokabeln",
        prefillEn: "It's freezing! How do I ask if the heating works, buy warm clothes, or say 'It's too cold' in Serbian?",
        prefillDe: "Es ist eiskalt! Wie frage ich, ob die Heizung funktioniert, kaufe warme Kleidung oder sage 'Es ist zu kalt' auf Serbisch?",
        priority: 4, isActive: true,
      },
      {
        category: "sos" as const,
        textEn: "Apartment & landlord — Renting basics in Serbian",
        textDe: "Wohnung & Vermieter — Miet-Basics auf Serbisch",
        prefillEn: "I need to deal with my landlord in Serbian. How do I report a broken faucet, ask about rent, or discuss the lease?",
        prefillDe: "Ich muss mit meinem Vermieter auf Serbisch sprechen. Wie melde ich einen kaputten Wasserhahn, frage nach der Miete oder bespreche den Mietvertrag?",
        priority: 3, isActive: true,
      },
    ];

    for (const s of suggestions) {
      await ctx.db.insert("chatSuggestions", s);
    }

    console.log(`Seeded ${suggestions.length} chat suggestions.`);
  },
});
