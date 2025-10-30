import { getDb } from "../server/db";
import { unitExplanations } from "../drizzle/schema";
import { nanoid } from "nanoid";

const UNIT_1_OVERVIEW = `## Welcome to Unit 1: At the Airport

**What You'll Learn:**
- The Serbian Latin alphabet and pronunciation
- Basic greetings and polite phrases
- How to introduce yourself
- The verb "biti" (to be) - your first Serbian verb!
- Understanding grammatical gender (masculine, feminine, neuter)
- Simple yes/no questions

**Real-Life Context:**
Imagine you've just landed in Belgrade. You're at the airport, meeting someone for the first time. This unit teaches you exactly what you need to navigate those first crucial conversations!

**Study Tips:**
- Practice the alphabet daily - Serbian pronunciation is very consistent!
- Repeat the greetings out loud
- Don't worry about perfection - Serbians appreciate any effort to speak their language

📖 *This unit corresponds to pages 5-9 in "Step by Step Serbian 1" by Mirjana Danilović*`;

const UNIT_1_GRAMMAR = `# Unit 1: Grammar Explained

## 1. The Serbian Alphabet

Serbian uses both Cyrillic and Latin alphabets. In this course, we focus on the Latin alphabet, which has 30 letters.

### Key Pronunciation Rules:

| Letter | Pronunciation | Example |
|--------|--------------|---------|
| **C** | ts (like "cats") | **centar** (center) |
| **Č** | ch (like "church") | **čaj** (tea) |
| **Ć** | soft ch (like "nature") | **ćao** (hi) |
| **Dž** | j (like "judge") | **džem** (jam) |
| **Đ** | soft j | **đak** (pupil) |
| **J** | y (like "yes") | **ja** (I) |
| **Š** | sh (like "ship") | **šta** (what) |
| **Ž** | zh (like "pleasure") | **život** (life) |

**Important:** Each letter has ONE sound - no exceptions! Once you learn it, you can read ANY Serbian word.

---

## 2. Greetings and Basic Phrases

### Essential Greetings:

- **Dobar dan!** - Good day! (most common greeting)
- **Dobro jutro!** - Good morning
- **Dobro veče!** - Good evening
- **Zdravo!** - Hi! (informal)
- **Ćao!** - Hi/Bye! (very informal)

### Polite Phrases:

- **Drago mi je.** - Nice to meet you. (Literally: "It's pleasant to me")
- **Hvala.** - Thank you
- **Molim.** - Please / You're welcome
- **Izvinite.** - Excuse me / Sorry

---

## 3. The Verb "biti" (to be)

This is THE most important verb in Serbian. You'll use it constantly!

### Full Conjugation:

| Person | Serbian | English | Pronunciation |
|--------|---------|---------|---------------|
| **ja** | **sam** | I am | yah sahm |
| **ti** | **si** | you are (informal singular) | tee see |
| **on/ona/ono** | **je** | he/she/it is | ohn/oh-nah/oh-noh yeh |
| **mi** | **smo** | we are | mee smoh |
| **vi** | **ste** | you are (formal/plural) | vee steh |
| **oni/one/ona** | **su** | they are | oh-nee/oh-neh/oh-nah soo |

### Examples in Context:

**Ja sam student.**  
*I am a student.*  
💡 "Sam" is like "am" in English - it's the "I" form of "to be"

**Ti si turist.**  
*You are a tourist.*  
💡 "Si" is used when talking to one person you know well (informal)

**On je pilot.**  
*He is a pilot.*  
💡 "Je" is like "is" - used for he, she, or it

**Mi smo iz Srbije.**  
*We are from Serbia.*

**Vi ste profesor.**  
*You are a professor.* (formal)  
💡 Use "vi/ste" when talking to someone you don't know well, or someone older/in authority

**Oni su studenti.**  
*They are students.*

### 📊 Comparison to English:

In English we say "I am, you are, he is". In Serbian it's "ja sam, ti si, on je". The words change just like in English!

---

## 4. Simple Questions with "Da li"

To form a yes/no question in Serbian, use **"Da li"** at the beginning:

**Da li ste vi...?** - Are you...?

### Examples:

**Da li ste vi Marko?**  
*Are you Marko?*

**Da li ste turist?**  
*Are you a tourist?*

**Answer:**  
- **Da, ja sam.** - Yes, I am.  
- **Ne, nisam.** - No, I'm not.

💡 "Nisam" = "ne" + "sam" = not am

---

## 5. Asking "Where are you from?"

**Odakle ste?** - Where are you from?

**Answer:**  
**Ja sam iz [country].**  
- **Ja sam iz Amerike.** - I am from America.  
- **Ja sam iz Srbije.** - I am from Serbia.  
- **Ja sam iz Nemačke.** - I am from Germany.

---

## 6. Gender of Nouns & Introduction to Cases (very basic for now)

In Serbian, all nouns have a gender: **masculine**, **feminine**, or **neuter**. This affects how words change.

### How to Recognize Gender:

| Gender | Typical Ending | Example |
|--------|---------------|---------|
| **Masculine** | consonant | **aerodrom** (airport), **student** (student) |
| **Feminine** | **-a** | **karta** (ticket), **Ana** (Ana) |
| **Neuter** | **-o** or **-e** | **ime** (name), **more** (sea) |

**Why does this matter?**

In Serbian, words change their endings depending on their role in the sentence. This is called "cases". For example, "Srbija" (Serbia) becomes "iz Srbije" (from Serbia). Don't worry about the rules yet - we'll introduce them gently!

---

## 7. Possessives: "my" and "your"

While not explicitly in the dialogue above, we would use them like:  
- **moj pasoš** (my passport) - if the noun is masculine  
- **moja karta** (my ticket) - if the noun is feminine  
- **moje ime** (my name) - if the noun is neuter

The ending of "moj/moja/moje" changes depending on the gender of the noun it describes.

Similarly:  
- **tvoj/tvoja/tvoje** (your - informal singular)

**Example:**  
- **Gde je moj pasoš?** - Where is my passport?  
- **Ovo je tvoja karta.** - This is your ticket.

---

## 🎯 Key Takeaways:

✅ Serbian pronunciation is consistent - one letter, one sound  
✅ "Biti" (to be) is essential: ja sam, ti si, on/ona/ono je, mi smo, vi ste, oni/one/ona su  
✅ Use "Da li" to form yes/no questions  
✅ All nouns have gender: masculine (consonant), feminine (-a), neuter (-o/-e)  
✅ "Odakle ste?" = Where are you from?  
✅ "Drago mi je" = Nice to meet you

**Practice Tip:** Try introducing yourself in Serbian: "Zdravo! Ja sam [your name]. Ja sam iz [your country]. Drago mi je!"`;

const UNIT_1_PRACTICE = `# Unit 1: Practice Examples & Dialogues

## 📝 Dialogue 1: Meeting Someone at the Airport

**Scenario:** You've just arrived in Belgrade and meet your Serbian friend Marko.

---

**Marko:** Dobar dan!  
**You:** Dobar dan! Da li ste vi Marko?  
**Marko:** Da, ja sam Marko. Kako se zovete?  
**You:** Ja sam [Your Name]. Drago mi je.  
**Marko:** Drago mi je. Odakle ste?  
**You:** Ja sam iz Amerike.  
**Marko:** Dobrodošli u Srbiju!

---

**Translation:**

**Marko:** Good day!  
**You:** Good day! Are you Marko?  
**Marko:** Yes, I am Marko. What's your name?  
**You:** I am [Your Name]. Nice to meet you.  
**Marko:** Nice to meet you. Where are you from?  
**You:** I am from America.  
**Marko:** Welcome to Serbia!

---

## 📝 Dialogue 2: At the Information Desk

**You:** Izvinite, gde je taksi?  
**Employee:** Taksi je napolju, desno.  
**You:** Hvala.  
**Employee:** Molim.

**Translation:**

**You:** Excuse me, where is the taxi?  
**Employee:** The taxi is outside, to the right.  
**You:** Thank you.  
**Employee:** You're welcome.

---

## ✏️ Exercise 1: Fill in the Blanks (Verb "biti")

Complete the sentences with the correct form of "biti":

1. Ja _____ student. (I am a student)
2. Ti _____ turist. (You are a tourist)
3. On _____ pilot. (He is a pilot)
4. Mi _____ iz Srbije. (We are from Serbia)
5. Vi _____ profesor. (You are a professor)
6. Oni _____ studenti. (They are students)

**Answers:**
1. sam
2. si
3. je
4. smo
5. ste
6. su

---

## ✏️ Exercise 2: Translate to Serbian

1. Good day!
2. I am from Germany.
3. Nice to meet you.
4. Where are you from?
5. Thank you.

**Answers:**
1. Dobar dan!
2. Ja sam iz Nemačke.
3. Drago mi je.
4. Odakle ste?
5. Hvala.

---

## ✏️ Exercise 3: Gender Recognition

Identify the gender of these nouns:

1. **aerodrom** (airport)
2. **karta** (ticket)
3. **ime** (name)
4. **student** (student)
5. **Srbija** (Serbia)

**Answers:**
1. Masculine (ends in consonant)
2. Feminine (ends in -a)
3. Neuter (ends in -e)
4. Masculine (ends in consonant)
5. Feminine (ends in -a)

---

## 🎭 Role-Play Exercise

**Practice this dialogue with a partner or out loud:**

**Person A:** Zdravo! Ja sam Ana. Kako se zovete?  
**Person B:** Ja sam [name]. Drago mi je.  
**Person A:** Odakle ste?  
**Person B:** Ja sam iz [country]. A vi?  
**Person A:** Ja sam iz Srbije.

---

## 📚 Vocabulary Review

### People & Places:
- **aerodrom** - airport
- **taksi** - taxi
- **student** - student (m)
- **studentkinja** - student (f)
- **turist** - tourist (m)
- **turistkinja** - tourist (f)
- **pilot** - pilot
- **profesor** - professor

### Countries:
- **Srbija** - Serbia
- **Amerika** - America
- **Nemačka** - Germany
- **Engleska** - England

---

## 🌍 Cultural Note: Serbian Hospitality

Serbians are known for their warm hospitality! When you meet someone for the first time, it's common to:
- Shake hands firmly
- Make eye contact
- Use "vi" (formal you) until invited to use "ti" (informal you)
- Accept offers of coffee - it's a big part of Serbian culture!

**Useful phrase:** "Hvala na gostoprimstvu!" (Thank you for the hospitality!)

---

## 🎯 Self-Check

Can you now:
- ✅ Introduce yourself in Serbian?
- ✅ Say where you're from?
- ✅ Conjugate "biti" (to be)?
- ✅ Recognize masculine, feminine, and neuter nouns?
- ✅ Form a simple yes/no question?

If yes - congratulations! You're ready for Unit 2! 🎉`;

async function insertRealContent() {
  console.log("Inserting comprehensive Unit 1 content...");

  const db = await getDb();
  if (!db) {
    console.error("Database not available!");
    process.exit(1);
  }

  try {
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 1,
      overview: UNIT_1_OVERVIEW,
      grammarExplained: UNIT_1_GRAMMAR,
      practiceExamples: UNIT_1_PRACTICE,
      bookReference: "Unit 1 corresponds to pages 5-9 in 'Step by Step Serbian 1' by Mirjana Danilović",
    });
    
    console.log(`✅ Inserted Unit 1 with ${UNIT_1_OVERVIEW.length + UNIT_1_GRAMMAR.length + UNIT_1_PRACTICE.length} total characters`);
    console.log(`   - Overview: ${UNIT_1_OVERVIEW.length} chars`);
    console.log(`   - Grammar: ${UNIT_1_GRAMMAR.length} chars`);
    console.log(`   - Practice: ${UNIT_1_PRACTICE.length} chars`);
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  console.log("Done!");
  process.exit(0);
}

insertRealContent().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

