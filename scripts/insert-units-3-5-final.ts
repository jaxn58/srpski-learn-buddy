import { getDb } from "../server/db";
import { unitExplanations } from "../drizzle/schema";
import { nanoid } from "nanoid";

// UNIT 3 CONTENT
const UNIT_3_OVERVIEW = `## Welcome to Unit 3: Learning Serbian

**What You'll Learn:**
- Present tense verbs (Group 1 and 2)
- Talking about daily activities
- Media vocabulary (TV, radio, newspapers)
- The Locative case (basic introduction)
- Asking complex questions

**Real-Life Context:**
You want to talk about your daily routine and what you're learning. This unit helps you describe activities, discuss media, and understand basic Serbian grammar patterns.

**Study Tips:**
- Practice verb conjugations daily - they're the foundation!
- Listen to Serbian radio or TV to hear these verbs in action
- Don't worry about the Locative case yet - we'll revisit it in detail later

📖 *This unit corresponds to pages 16-22 in "Step by Step Serbian 1" by Mirjana Danilović*`;

const UNIT_3_GRAMMAR = `# Unit 3: Grammar Explained

## 1. Present Tense Verbs - Group 1 (-AM verbs)

These verbs end in **-am** in the "ja" (I) form. They're very regular!

### Example: **čitati** (to read)

| Person | Form | English | Example |
|--------|------|---------|---------|
| **ja** | **čitam** | I read | **Ja čitam knjigu.** (I read a book) |
| **ti** | **čitaš** | you read | **Ti čitaš novine.** (You read newspapers) |
| **on/ona/ono** | **čita** | he/she/it reads | **On čita časopis.** (He reads a magazine) |
| **mi** | **čitamo** | we read | **Mi čitamo lekciju.** (We read the lesson) |
| **vi** | **čitate** | you read | **Vi čitate knjigu.** (You read a book) |
| **oni/one/ona** | **čitaju** | they read | **Oni čitaju novine.** (They read newspapers) |

### More -AM verbs:

| Infinitive | Meaning | "ja" form |
|------------|---------|-----------|
| **gledati** | to watch | **gledam** |
| **slušati** | to listen | **slušam** |
| **pričati** | to speak/talk | **pričam** |
| **raditi** | to work | **radim** |
| **učiti** | to learn/study | **učim** |
| **pisati** | to write | **pišem** |
| **pevati** | to sing | **pevam** |

---

## 2. Present Tense Verbs - Group 2 (-IM verbs)

These verbs end in **-im** in the "ja" (I) form.

### Example: **govoriti** (to speak)

| Person | Form | English |
|--------|------|---------|
| **ja** | **govorim** | I speak |
| **ti** | **govoriš** | you speak |
| **on/ona/ono** | **govori** | he/she/it speaks |
| **mi** | **govorimo** | we speak |
| **vi** | **govorite** | you speak |
| **oni/one/ona** | **govore** | they speak |

### More -IM verbs:

| Infinitive | Meaning | "ja" form |
|------------|---------|-----------|
| **učiti** | to learn | **učim** |
| **raditi** | to work | **radim** |
| **voleti** | to love | **volim** |
| **razumeti** | to understand | **razumem** |

---

## 3. Media Vocabulary

### TV & Radio:

| Serbian | English | Example |
|---------|---------|---------|
| **televizija** | television | **Gledam televiziju.** (I watch TV) |
| **radio** | radio | **Slušam radio.** (I listen to the radio) |
| **program** | program | **Dobar program.** (Good program) |
| **vesti** | news | **Gledam vesti.** (I watch the news) |
| **film** | film/movie | **Volim filmove.** (I love movies) |
| **serija** | series | **Gledam seriju.** (I watch a series) |

### Print Media:

| Serbian | English |
|---------|---------|
| **novine** | newspaper |
| **časopis** | magazine |
| **knjiga** | book |
| **tekst** | text |
| **članak** | article |

---

## 4. The Locative Case (Introduction)

The Locative case is used after certain prepositions to indicate location.

### Key Prepositions:

- **u** - in
- **na** - on/at
- **o** - about

### Basic Pattern:

Masculine/Neuter nouns ending in a consonant → add **-u**

**Examples:**
- **grad** (city) → **u gradu** (in the city)
- **Beograd** (Belgrade) → **u Beogradu** (in Belgrade)
- **film** (film) → **o filmu** (about the film)
- **časopis** (magazine) → **u časopisu** (in the magazine)

Feminine nouns ending in **-a** → change to **-i**

**Examples:**
- **škola** (school) → **u školi** (in school)
- **knjiga** (book) → **u knjizi** (in the book)
- **Srbija** (Serbia) → **u Srbiji** (in Serbia)

---

## 5. Daily Activities Vocabulary

| Serbian | English | Example |
|---------|---------|---------|
| **ustajati** | to get up | **Ustajem u 7.** (I get up at 7) |
| **doručkovati** | to have breakfast | **Doručkujem u 8.** |
| **ići** | to go | **Idem u školu.** (I go to school) |
| **raditi** | to work | **Radim u kancelariji.** |
| **ručati** | to have lunch | **Ručam u 1.** |
| **večerati** | to have dinner | **Večeram u 7.** |
| **spavati** | to sleep | **Spavam 8 sati.** (I sleep 8 hours) |

---

## 6. Asking Complex Questions

**Šta radiš?** - What are you doing?  
**Šta čitaš?** - What are you reading?  
**Gde radiš?** - Where do you work?  
**Kada učiš?** - When do you study?  
**Zašto učiš srpski?** - Why are you learning Serbian?

---

## 🎯 Key Takeaways:

✅ -AM verbs: čitam, čitaš, čita, čitamo, čitate, čitaju  
✅ -IM verbs: govorim, govoriš, govori, govorimo, govorite, govore  
✅ Locative case: u gradu (in the city), u školi (in school)  
✅ Media: televizija, radio, novine, knjiga  
✅ Daily activities: ustajati, raditi, učiti, spavati`;

const UNIT_3_PRACTICE = `# Unit 3: Practice Examples & Dialogues

## 📝 Dialogue 1: Talking About Learning Serbian

**Marko:** Šta radiš?  
**You:** Učim srpski.  
**Marko:** Zašto učiš srpski?  
**You:** Volim Srbiju i srpsku kulturu.  
**Marko:** Kako učiš? Čitaš knjige?  
**You:** Da, čitam knjige i gledam filmove.  
**Marko:** Odlično! Razumeš li srpski?  
**You:** Malo razumem.

**Translation:**

**Marko:** What are you doing?  
**You:** I'm learning Serbian.  
**Marko:** Why are you learning Serbian?  
**You:** I love Serbia and Serbian culture.  
**Marko:** How do you learn? Do you read books?  
**You:** Yes, I read books and watch movies.  
**Marko:** Excellent! Do you understand Serbian?  
**You:** I understand a little.

---

## 📝 Dialogue 2: Daily Routine

**Ana:** Kada ustaješ?  
**You:** Ustajem u 7 ujutru.  
**Ana:** Šta radiš posle?  
**You:** Doručkujem i idem na posao.  
**Ana:** Gde radiš?  
**You:** Radim u kancelariji u centru.  
**Ana:** Kada ručaš?  
**You:** Ručam u 1 popodne.

**Translation:**

**Ana:** When do you get up?  
**You:** I get up at 7 in the morning.  
**Ana:** What do you do after?  
**You:** I have breakfast and go to work.  
**Ana:** Where do you work?  
**You:** I work in an office in the center.  
**Ana:** When do you have lunch?  
**You:** I have lunch at 1 in the afternoon.

---

<InteractiveExercise type="fillInBlank" id="unit3-present-tense" />

---

<InteractiveExercise type="fillInBlank" id="unit3-locative" />

---

<InteractiveExercise type="translation" id="unit3-daily-activities" />

---

## 📚 Vocabulary Review

### Time Expressions:
- **ujutru** - in the morning
- **popodne** - in the afternoon
- **uveče** - in the evening
- **noću** - at night
- **sada** - now
- **posle** - after
- **pre** - before

---

## 🌍 Cultural Note: Serbian Media

Serbians love their TV series (serije)! Popular genres:
- **Turske serije** - Turkish series (very popular!)
- **Domaće serije** - Domestic series
- **Filmovi** - Movies

**Useful phrase:** "Koju seriju gledaš?" (Which series are you watching?)

---

## 🎯 Self-Check

Can you now:
- ✅ Conjugate -AM and -IM verbs?
- ✅ Talk about daily activities?
- ✅ Use the Locative case (u gradu, u školi)?
- ✅ Discuss media (TV, radio, books)?
- ✅ Ask complex questions (Šta? Gde? Kada? Zašto?)?

If yes - excellent! You're ready for Unit 4! 🎉`;

// UNIT 4 & 5 content (abbreviated for space - will be similar structure)
const UNIT_4_OVERVIEW = `## Welcome to Unit 4: Finding Your Way

**What You'll Learn:**
- Asking for and giving directions
- The Vocative case (for addressing people)
- The verb "ići" (to go) and its conjugation
- Location prepositions
- City vocabulary

**Real-Life Context:**
You're exploring Belgrade and need to ask for directions. This unit teaches you how to navigate the city and communicate with locals about locations.

📖 *This unit corresponds to pages 23-29 in "Step by Step Serbian 1" by Mirjana Danilović*`;

const UNIT_4_GRAMMAR = `# Unit 4: Grammar Explained

## 1. The Verb "ići" (to go)

This is an irregular but essential verb!

| Person | Form | English | Example |
|--------|------|---------|---------|
| **ja** | **idem** | I go | **Idem kući.** (I'm going home) |
| **ti** | **ideš** | you go | **Ideš u grad.** (You're going to the city) |
| **on/ona/ono** | **ide** | he/she/it goes | **On ide u školu.** (He's going to school) |
| **mi** | **idemo** | we go | **Idemo u bioskop.** (We're going to the cinema) |
| **vi** | **idete** | you go | **Idete kući.** (You're going home) |
| **oni/one/ona** | **idu** | they go | **Oni idu u park.** (They're going to the park) |

---

## 2. Asking for Directions

**Gde je...?** - Where is...?  
**Kako da dođem do...?** - How do I get to...?  
**Izvinite, gde je pošta?** - Excuse me, where is the post office?

### Direction Words:

| Serbian | English |
|---------|---------|
| **levo** | left |
| **desno** | right |
| **pravo** | straight |
| **napred** | forward |
| **nazad** | back |
| **blizu** | near |
| **daleko** | far |

---

## 3. The Vocative Case

Used when directly addressing someone by name!

**Pattern:**
- Masculine names ending in consonant → add **-e**
  - **Marko** → **Marko!** (no change for -o)
  - **Ivan** → **Ivane!**
  - **Petar** → **Petre!**

- Feminine names ending in **-a** → change to **-o**
  - **Ana** → **Ano!**
  - **Marija** → **Marijo!**

**Examples:**
- **Marko, gde si?** - Marko, where are you?
- **Ano, kako si?** - Ana, how are you?

---

## 4. City Vocabulary

| Serbian | English |
|---------|---------|
| **centar** | center |
| **ulica** | street |
| **trg** | square |
| **park** | park |
| **pošta** | post office |
| **banka** | bank |
| **bioskop** | cinema |
| **pozorište** | theater |
| **restoran** | restaurant |
| **hotel** | hotel |

---

## 🎯 Key Takeaways:

✅ "Ići" (to go): idem, ideš, ide, idemo, idete, idu  
✅ Directions: levo, desno, pravo  
✅ Vocative: Marko → Marko!, Ana → Ano!  
✅ "Gde je...?" = Where is...?`;

const UNIT_4_PRACTICE = `# Unit 4: Practice Examples & Dialogues

## 📝 Dialogue: Asking for Directions

**You:** Izvinite, gde je pošta?  
**Local:** Pošta je blizu. Idite pravo, pa levo.  
**You:** Hvala. Je li daleko?  
**Local:** Ne, nije daleko. Pet minuta peške.  
**You:** Hvala vam!  
**Local:** Nema na čemu!

**Translation:**

**You:** Excuse me, where is the post office?  
**Local:** The post office is nearby. Go straight, then left.  
**You:** Thank you. Is it far?  
**Local:** No, it's not far. Five minutes on foot.  
**You:** Thank you!  
**Local:** You're welcome!

---

<InteractiveExercise type="fillInBlank" id="unit4-ici-conjugation" />

---

<InteractiveExercise type="fillInBlank" id="unit4-directions" />

---

<InteractiveExercise type="translation" id="unit4-city-vocab" />

---

## 🎯 Self-Check

Can you now:
- ✅ Conjugate "ići" (to go)?
- ✅ Ask for directions?
- ✅ Use the Vocative case?
- ✅ Navigate the city?

If yes - great! You're ready for Unit 5! 🎉`;

const UNIT_5_OVERVIEW = `## Welcome to Unit 5: Describing Your Room

**What You'll Learn:**
- Describing rooms and furniture
- Ordinal numbers (first, second, third...)
- The verb "moći" (can/to be able to)
- Colors
- Possessive adjectives

**Real-Life Context:**
You're looking for an apartment or describing your room. This unit teaches you vocabulary for home and living spaces.

📖 *This unit corresponds to pages 30-36 in "Step by Step Serbian 1" by Mirjana Danilović*`;

const UNIT_5_GRAMMAR = `# Unit 5: Grammar Explained

## 1. The Verb "moći" (can/to be able to)

| Person | Form | English | Example |
|--------|------|---------|---------|
| **ja** | **mogu** | I can | **Mogu da pomognem.** (I can help) |
| **ti** | **možeš** | you can | **Možeš da dođeš.** (You can come) |
| **on/ona/ono** | **može** | he/she/it can | **On može da govori srpski.** (He can speak Serbian) |
| **mi** | **možemo** | we can | **Možemo da idemo.** (We can go) |
| **vi** | **možete** | you can | **Možete da sedite.** (You can sit) |
| **oni/one/ona** | **mogu** | they can | **Oni mogu da pomognu.** (They can help) |

---

## 2. Ordinal Numbers

| Cardinal | Ordinal (m) | Ordinal (f) | Ordinal (n) |
|----------|-------------|-------------|-------------|
| **jedan** (1) | **prvi** | **prva** | **prvo** |
| **dva** (2) | **drugi** | **druga** | **drugo** |
| **tri** (3) | **treći** | **treća** | **treće** |
| **četiri** (4) | **četvrti** | **četvrta** | **četvrto** |
| **pet** (5) | **peti** | **peta** | **peto** |

**Examples:**
- **prvi sprat** - first floor
- **druga soba** - second room
- **treće mesto** - third place

---

## 3. Room & Furniture Vocabulary

| Serbian | English |
|---------|---------|
| **soba** | room |
| **krevet** | bed |
| **sto** | table |
| **stolica** | chair |
| **orman** | closet/wardrobe |
| **prozor** | window |
| **vrata** | door |
| **lampa** | lamp |
| **tepih** | carpet |

---

## 4. Colors

| Serbian | English |
|---------|---------|
| **bela/beo/belo** | white |
| **crna/crn/crno** | black |
| **crvena/crven/crveno** | red |
| **plava/plav/plavo** | blue |
| **zelena/zelen/zeleno** | green |
| **žuta/žut/žuto** | yellow |

---

## 🎯 Key Takeaways:

✅ "Moći" (can): mogu, možeš, može, možemo, možete, mogu  
✅ Ordinals: prvi, drugi, treći...  
✅ Furniture: krevet, sto, stolica, orman  
✅ Colors: bela, crna, crvena, plava`;

const UNIT_5_PRACTICE = `# Unit 5: Practice Examples & Dialogues

## 📝 Dialogue: Describing a Room

**Agent:** Ovo je vaša soba.  
**You:** Lepa je! Koliko prozora ima?  
**Agent:** Ima dva prozora.  
**You:** A gde je krevet?  
**Agent:** Krevet je pored prozora.  
**You:** Perfektno!

**Translation:**

**Agent:** This is your room.  
**You:** It's beautiful! How many windows does it have?  
**Agent:** It has two windows.  
**You:** And where is the bed?  
**Agent:** The bed is next to the window.  
**You:** Perfect!

---

<InteractiveExercise type="fillInBlank" id="unit5-moci-conjugation" />

---

<InteractiveExercise type="fillInBlank" id="unit5-ordinals" />

---

<InteractiveExercise type="translation" id="unit5-furniture" />

---

## 🎯 Self-Check

Can you now:
- ✅ Conjugate "moći" (can)?
- ✅ Use ordinal numbers?
- ✅ Describe rooms and furniture?
- ✅ Name colors in Serbian?

If yes - congratulations! You've completed Unit 5! 🎉`;

async function insertUnits3to5Final() {
  console.log("Inserting comprehensive content for Units 3, 4, and 5...");

  const db = await getDb();
  if (!db) {
    console.error("Database not available!");
    process.exit(1);
  }

  try {
    // Insert Unit 3
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 3,
      overview: UNIT_3_OVERVIEW,
      grammarExplained: UNIT_3_GRAMMAR,
      practiceExamples: UNIT_3_PRACTICE,
      bookReference: "Unit 3 corresponds to pages 16-22 in 'Step by Step Serbian 1' by Mirjana Danilović",
    });
    console.log(`✅ Inserted Unit 3`);

    // Insert Unit 4
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 4,
      overview: UNIT_4_OVERVIEW,
      grammarExplained: UNIT_4_GRAMMAR,
      practiceExamples: UNIT_4_PRACTICE,
      bookReference: "Unit 4 corresponds to pages 23-29 in 'Step by Step Serbian 1' by Mirjana Danilović",
    });
    console.log(`✅ Inserted Unit 4`);

    // Insert Unit 5
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 5,
      overview: UNIT_5_OVERVIEW,
      grammarExplained: UNIT_5_GRAMMAR,
      practiceExamples: UNIT_5_PRACTICE,
      bookReference: "Unit 5 corresponds to pages 30-36 in 'Step by Step Serbian 1' by Mirjana Danilović",
    });
    console.log(`✅ Inserted Unit 5`);

    console.log("\n🎉 All units 3-5 inserted successfully!");
    
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  console.log("Done!");
  process.exit(0);
}

insertUnits3to5Final().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

