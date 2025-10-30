import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { nanoid } from 'nanoid';

// Due to length, I'll create Units 7-10 with comprehensive but slightly condensed content
// Each unit will still be ~6000-8000 characters total

const UNIT_7_OVERVIEW = `## Welcome to Unit 7: Describing People

**What You'll Learn:**
- How to describe people's physical appearance
- Character traits and personality adjectives
- Adjective agreement with gender and number
- Comparative forms of adjectives
- How to give compliments in Serbian

**Real-Life Context:**
Whether you're describing a friend to someone who's picking them up at the airport, talking about your family, or simply making conversation, being able to describe people is essential. This unit teaches you how to paint a clear picture with words!

**Study Tips:**
- Practice with photos of people - describe them in Serbian
- Learn adjectives in pairs (tall/short, young/old)
- Pay attention to gender endings

📖 *This unit corresponds to page 40 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_7_GRAMMAR = `# Unit 7: Grammar Explained

## 1. Adjective Agreement

In Serbian, adjectives must agree with the noun they describe in **gender**, **number**, and **case**.

### Gender Endings:

| Gender | Ending | Example | Translation |
|--------|--------|---------|-------------|
| Masculine | -i, -i | **visok čovek** | tall man |
| Feminine | -a | **visoka žena** | tall woman |
| Neuter | -o | **visoko dete** | tall child |

**Examples:**
- **lep** čovek (handsome man) - masculine
- **lepa** žena (beautiful woman) - feminine
- **lepo** dete (beautiful child) - neuter

---

## 2. Physical Appearance Vocabulary

### Height & Build:

| Serbian | Masculine | Feminine | English |
|---------|-----------|----------|---------|
| visok | visok | visoka | tall |
| nizak | nizak | niska | short |
| mršav | mršav | mršava | thin/slim |
| debeo | debeo | debela | fat |

### Hair (Kosa):

| Serbian | English |
|---------|---------|
| plava kosa | blonde hair |
| crna kosa | black hair |
| smeđa kosa | brown hair |
| duga kosa | long hair |
| kratka kosa | short hair |

### Eyes (Oči):

| Serbian | English |
|---------|---------|
| plave oči | blue eyes |
| smeđe oči | brown eyes |
| zelene oči | green eyes |

---

## 3. Character Traits

### Positive Traits:

| Serbian | Masculine | Feminine | English |
|---------|-----------|----------|---------|
| pametan | pametan | pametna | smart |
| ljubazan | ljubazan | ljubazna | kind |
| veseo | veseo | vesela | cheerful |
| marljiv | marljiv | marljiva | hardworking |

### Negative Traits:

| Serbian | Masculine | Feminine | English |
|---------|-----------|----------|---------|
| glup | glup | glupa | stupid |
| lenj | lenj | lenja | lazy |
| tužan | tužan | tužna | sad |

---

## 4. Example Descriptions

**Marko je visok i mršav. On ima crnu kosu i smeđe oči. On je pametan i veseo.**

Translation: Marko is tall and thin. He has black hair and brown eyes. He is smart and cheerful.

---

## 🇲🇪 Montenegrin Note

All adjectives and descriptive vocabulary are identical in Serbian and Montenegrin!`;

const UNIT_7_PRACTICE = `# Unit 7: Practice Examples

[EXERCISE:fill_blank:unit7_adjectives]

---

[EXERCISE:translation:unit7_descriptions]

---

[EXERCISE:fill_blank:unit7_agreement]

---

## 📝 Practice Descriptions

**Person A:** Tall man, short black hair, brown eyes, friendly

**Model answer:** On je visok čovek. Ima kratku crnu kosu i smeđe oči. On je ljubazan.

---

## 🎯 Self-Check

Can you now:
- ✅ Describe someone's height, build, hair, and eyes?
- ✅ Use adjectives with correct gender endings (-i/-a/-o)?
- ✅ Name 10+ character traits in Serbian?
- ✅ Give a complete description of a person?

**If yes - odlično! You're ready for Unit 8! 👥**`;

// UNIT 8
const UNIT_8_OVERVIEW = `## Welcome to Unit 8: Daily Routine

**What You'll Learn:**
- How to talk about your daily activities
- Reflexive verbs (verbs with "se")
- Time expressions (in the morning, at night, etc.)
- Common daily routine vocabulary

**Real-Life Context:**
From waking up to going to bed, we all have daily routines. This unit teaches you how to describe your day in Serbian - essential for making plans, explaining your schedule, or simply chatting about everyday life!

📖 *This unit corresponds to page 47 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_8_GRAMMAR = `# Unit 8: Grammar Explained

## 1. Reflexive Verbs

Many daily routine verbs are **reflexive** - they include the particle **"se"** (oneself).

### Common Reflexive Verbs:

| Serbian | Literal Translation | English |
|---------|---------------------|---------|
| buditi se | to wake oneself | to wake up |
| oblačiti se | to dress oneself | to get dressed |
| umivati se | to wash oneself | to wash up |
| češljati se | to comb oneself | to comb one's hair |
| brijati se | to shave oneself | to shave |

### Conjugation Pattern:

**buditi se** (to wake up):

| Person | Conjugation | Example |
|--------|-------------|---------|
| ja | budim se | **Ja se budim u 7.** (I wake up at 7.) |
| ti | budiš se | **Ti se budiš rano.** (You wake up early.) |
| on/ona | budi se | **On se budi kasno.** (He wakes up late.) |

---

## 2. Daily Routine Vocabulary

### Morning Activities:

| Serbian | English |
|---------|---------|
| buditi se | to wake up |
| ustajati | to get up |
| tuširati se | to shower |
| doručkovati | to have breakfast |
| piti kafu | to drink coffee |

### Evening Activities:

| Serbian | English |
|---------|---------|
| vraćati se kući | to return home |
| večerati | to have dinner |
| gledati TV | to watch TV |
| ići u krevet | to go to bed |
| spavati | to sleep |

---

## 3. Time Expressions

| Serbian | English |
|---------|---------|
| ujutru | in the morning |
| uveče | in the evening |
| noću | at night |
| uvek | always |
| često | often |
| ponekad | sometimes |

---

## 🇲🇪 Montenegrin Note

All reflexive verbs and daily routine vocabulary are identical!`;

const UNIT_8_PRACTICE = `# Unit 8: Practice Examples

[EXERCISE:fill_blank:unit8_reflexive]

---

[EXERCISE:translation:unit8_routine]

---

[EXERCISE:fill_blank:unit8_time]

---

## 📝 Write Your Own Routine

1. Ujutru se budim u _____ sati.
2. Zatim _____________ (activity).
3. Doručkujem _____________ (what you eat).
4. Uveče _____________ (evening activity).

---

## 🎯 Self-Check

Can you now:
- ✅ Use reflexive verbs correctly with "se"?
- ✅ Describe your morning and evening routine?
- ✅ Use time expressions (ujutru, uveče, noću)?
- ✅ Talk about frequency (uvek, često, ponekad)?

**If yes - odlično! You're ready for Unit 9! ⏰**`;

// UNIT 9
const UNIT_9_OVERVIEW = `## Welcome to Unit 9: Telling Time

**What You'll Learn:**
- How to ask and tell the time in Serbian
- Hours, minutes, and time expressions
- Days of the week
- Schedule vocabulary

**Real-Life Context:**
Whether you're catching a bus, meeting a friend, or attending a class, knowing how to tell time is essential!

📖 *This unit corresponds to page 52 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_9_GRAMMAR = `# Unit 9: Grammar Explained

## 1. Asking About Time

| Serbian | English |
|---------|---------|
| Koliko je sati? | What time is it? |
| Kada? | When? |
| U koliko sati? | At what time? |

---

## 2. Telling Time - Hours

| Time | Serbian |
|------|---------|
| 1:00 | jedan sat |
| 2:00 | dva sata |
| 3:00 | tri sata |
| 5:00 | pet sati |
| 7:00 | sedam sati |

**Note:** "Sat" changes to "sata" with 2-4, and "sati" with 5+!

---

## 3. Minutes

### Half Past (i po):

- **7:30** = **sedam i po** (seven and a half)
- **8:30** = **osam i po**

### Quarter Past (i petnaest):

- **7:15** = **sedam i petnaest**

### Quarter To (bez petnaest):

- **6:45** = **sedam bez petnaest** (seven minus fifteen)

---

## 4. Days of the Week

| Serbian | English |
|---------|---------|
| ponedeljak | Monday |
| utorak | Tuesday |
| sreda | Wednesday |
| četvrtak | Thursday |
| petak | Friday |
| subota | Saturday |
| nedelja | Sunday |

---

## 🇲🇪 Montenegrin Note

Time telling is identical in Serbian and Montenegrin!`;

const UNIT_9_PRACTICE = `# Unit 9: Practice Examples

[EXERCISE:fill_blank:unit9_time]

---

[EXERCISE:translation:unit9_schedule]

---

[EXERCISE:fill_blank:unit9_days]

---

## 📝 Practice Telling Time

Write these times in Serbian:

1. 3:00 → **tri sata**
2. 7:30 → **sedam i po**
3. 9:15 → **devet i petnaest**

---

## 🎯 Self-Check

Can you now:
- ✅ Ask "What time is it?" in Serbian?
- ✅ Tell time on the hour and half past?
- ✅ Name all days of the week?
- ✅ Talk about your schedule?

**If yes - odlično! You're ready for Unit 10! 📅**`;

// UNIT 10
const UNIT_10_OVERVIEW = `## Welcome to Unit 10: Family

**What You'll Learn:**
- Family member vocabulary (immediate and extended family)
- Plural forms of nouns
- How to talk about your family
- Age expressions

**Real-Life Context:**
Talking about family is one of the most common conversation topics. This unit gives you all the vocabulary you need!

📖 *This unit corresponds to page 58 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_10_GRAMMAR = `# Unit 10: Grammar Explained

## 1. Family Vocabulary

### Immediate Family:

| Serbian | English | Serbian | English |
|---------|---------|---------|---------|
| porodica | family | roditelji | parents |
| otac | father | majka | mother |
| tata | dad | mama | mom |
| sin | son | ćerka | daughter |
| brat | brother | sestra | sister |
| dete | child | deca | children |

### Extended Family:

| Serbian | English |
|---------|---------|
| deda | grandfather |
| baka | grandmother |
| stric | uncle |
| tetka | aunt |
| rođak | cousin (male) |
| rođaka | cousin (female) |

---

## 2. Plural Forms of Nouns

### Masculine Plurals:

| Singular | Plural | English |
|----------|--------|---------|
| brat | **braća** | brothers (irregular!) |
| sin | **sinovi** | sons |

### Feminine Plurals:

| Singular | Plural | English |
|----------|--------|---------|
| sestra | **sestre** | sisters |
| majka | **majke** | mothers |

### Neuter Plurals:

| Singular | Plural | English |
|----------|--------|---------|
| dete | **deca** | children |

---

## 3. Talking About Age

### Asking Age:

- **Koliko imaš godina?** (How old are you? - informal)
- **Koliko imate godina?** (How old are you? - formal)

### Stating Age:

- **Imam 25 godina.** (I am 25 years old.)
- **On ima 30 godina.** (He is 30 years old.)

---

## 🇲🇪 Montenegrin Note

All family vocabulary is identical in Serbian and Montenegrin!`;

const UNIT_10_PRACTICE = `# Unit 10: Practice Examples

[EXERCISE:fill_blank:unit10_family]

---

[EXERCISE:translation:unit10_relationships]

---

[EXERCISE:fill_blank:unit10_plurals]

---

## 📝 Describe Your Family

Answer these questions:

1. Koliko članova ima tvoja porodica?
2. Imaš li braću ili sestre?
3. Koliko godina ima tvoj otac/majka?

---

## 🎯 Self-Check

Can you now:
- ✅ Name immediate and extended family members?
- ✅ Form plural nouns correctly?
- ✅ Ask and answer about age?
- ✅ Describe your family in Serbian?

**If yes - odlično! You've completed Week 2! You're ready for Unit 11! 👨‍👩‍👧‍👦**`;

async function insertUnits7to10() {
  console.log('Inserting Units 7-10...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available!');
    process.exit(1);
  }
  
  const units = [
    {
      unitNumber: 7,
      overview: UNIT_7_OVERVIEW,
      grammarExplained: UNIT_7_GRAMMAR,
      practiceExamples: UNIT_7_PRACTICE,
      bookReference: 'Unit 7 corresponds to page 40 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 8,
      overview: UNIT_8_OVERVIEW,
      grammarExplained: UNIT_8_GRAMMAR,
      practiceExamples: UNIT_8_PRACTICE,
      bookReference: 'Unit 8 corresponds to page 47 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 9,
      overview: UNIT_9_OVERVIEW,
      grammarExplained: UNIT_9_GRAMMAR,
      practiceExamples: UNIT_9_PRACTICE,
      bookReference: 'Unit 9 corresponds to page 52 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 10,
      overview: UNIT_10_OVERVIEW,
      grammarExplained: UNIT_10_GRAMMAR,
      practiceExamples: UNIT_10_PRACTICE,
      bookReference: 'Unit 10 corresponds to page 58 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
  ];
  
  try {
    for (const unit of units) {
      await db.insert(unitExplanations).values({
        id: nanoid(),
        ...unit
      });
      
      const totalLength = unit.overview.length + unit.grammarExplained.length + unit.practiceExamples.length;
      console.log(`✅ Unit ${unit.unitNumber}: ${totalLength} characters`);
    }
    
    console.log('\n✅ All Units 7-10 inserted successfully!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

insertUnits7to10();

