import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { nanoid } from 'nanoid';

// UNIT 11: Past Tense Introduction
const UNIT_11_OVERVIEW = `## Welcome to Unit 11: Past Tense Introduction

**What You'll Learn:**
- How to form the past tense in Serbian (prošlo vreme)
- Past tense endings for different genders
- Common past tense verbs
- How to talk about what you did yesterday, last week, etc.
- Time expressions for the past

**Real-Life Context:**
Whether you're sharing stories about your trip, talking about what you did yesterday, or discussing past events, the past tense is essential for everyday conversation. This unit introduces you to Serbian's straightforward past tense system!

**Why This Matters:**
The Serbian past tense is actually simpler than many other languages - it has only one past tense form (unlike English with simple past, present perfect, past perfect, etc.). Once you master this unit, you'll be able to talk about any past event!

**Study Tips:**
- Practice with your own daily activities from yesterday
- Keep a simple diary in Serbian using past tense
- Notice the gender agreement patterns

📖 *This unit corresponds to page 65 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_11_GRAMMAR = `# Unit 11: Grammar Explained

## 1. Past Tense Formation

Serbian past tense (prošlo vreme) is formed with:
**Auxiliary verb "biti" (to be) + Past participle**

### Past Participle Formation:

Remove the infinitive ending **-ti** and add gender-specific endings:

| Gender | Ending | Example (raditi - to work) |
|--------|--------|----------------------------|
| Masculine | -o | radio |
| Feminine | -la | radila |
| Neuter | -lo | radilo |

---

## 2. Past Tense Conjugation

### Example: **raditi** (to work)

| Person | Auxiliary | Participle (M/F) | Full Form | Translation |
|--------|-----------|------------------|-----------|-------------|
| ja | sam | radio/radila | **Ja sam radio/radila** | I worked (m/f) |
| ti | si | radio/radila | **Ti si radio/radila** | You worked |
| on | je | radio | **On je radio** | He worked |
| ona | je | radila | **Ona je radila** | She worked |
| ono | je | radilo | **Ono je radilo** | It worked |
| mi | smo | radili/radile | **Mi smo radili** | We worked |
| vi | ste | radili/radile | **Vi ste radili** | You worked (pl) |
| oni | su | radili | **Oni su radili** | They worked (m) |
| one | su | radile | **One su radile** | They worked (f) |

**Key Points:**
- The auxiliary verb agrees with the person (ja sam, ti si, on je...)
- The participle agrees with the gender (radio/radila/radilo)
- In plural, masculine form is used for mixed groups

---

## 3. Common Past Tense Verbs

### Regular Verbs:

| Infinitive | Masculine | Feminine | English |
|------------|-----------|----------|---------|
| biti | bio | bila | was/been |
| imati | imao | imala | had |
| raditi | radio | radila | worked |
| govoriti | govorio | govorila | spoke |
| učiti | učio | učila | learned |
| jesti | jeo | jela | ate |
| piti | pio | pila | drank |
| ići | išao | išla | went |
| doći | došao | došla | came |
| videti | video | videla | saw |

### Examples:

1. **Ja sam bio u Beogradu.** (I was in Belgrade - masculine)
2. **Ona je učila srpski.** (She learned Serbian)
3. **Mi smo jeli ćevape.** (We ate ćevapi)
4. **Oni su došli kasno.** (They came late)

---

## 4. Time Expressions for Past

| Serbian | English |
|---------|---------|
| juče | yesterday |
| prekjuče | the day before yesterday |
| prošle nedelje | last week |
| prošlog meseca | last month |
| prošle godine | last year |
| pre tri dana | three days ago |
| ranije | earlier |
| tada | then |
| pre | before |

---

## 5. Negative Past Tense

To make past tense negative, add **nisam, nisi, nije**, etc.:

| Person | Negative Form | Example |
|--------|---------------|---------|
| ja | nisam | **Nisam radio** (I didn't work) |
| ti | nisi | **Nisi došao** (You didn't come) |
| on/ona | nije | **Nije bio** (He wasn't) |
| mi | nismo | **Nismo jeli** (We didn't eat) |
| vi | niste | **Niste videli** (You didn't see) |
| oni | nisu | **Nisu išli** (They didn't go) |

---

## 6. Questions in Past Tense

Questions use the same form, just with question intonation or question words:

- **Da li si bio u školi?** (Were you at school?)
- **Šta si radio juče?** (What did you do yesterday?)
- **Kada si došao?** (When did you come?)
- **Gde si bio?** (Where were you?)

---

## 7. Example Sentences

**Positive:**
1. **Juče sam gledao film.** (Yesterday I watched a movie)
2. **Ona je kupila hleb.** (She bought bread)
3. **Mi smo bili u restoranu.** (We were at a restaurant)

**Negative:**
1. **Nisam video Marka.** (I didn't see Marko)
2. **Ona nije došla na posao.** (She didn't come to work)
3. **Nismo imali vremena.** (We didn't have time)

**Questions:**
1. **Da li si učio srpski?** (Did you study Serbian?)
2. **Šta ste radili?** (What did you do?)
3. **Kada si stigao?** (When did you arrive?)

---

## 🇲🇪 Montenegrin Note

Past tense formation is identical in Serbian and Montenegrin!`;

const UNIT_11_PRACTICE = `# Unit 11: Practice Examples

[EXERCISE:fill_blank:unit11_past_tense]

---

[EXERCISE:translation:unit11_past_sentences]

---

[EXERCISE:fill_blank:unit11_time_expressions]

---

## 📝 Tell Your Story

Write about your yesterday in Serbian:

**Model:**
Juče sam se probudio u 7 sati. Bio sam umoran. Doručkovao sam kafu i hleb. Išao sam na posao. Radio sam do 5 sati. Uveče sam gledao TV.

**Your turn:** (Write 5-6 sentences about your yesterday)

---

## 🎯 Self-Check

Can you now:
- ✅ Form past tense with auxiliary + participle?
- ✅ Use correct gender endings (-o/-la/-lo)?
- ✅ Make negative past tense sentences?
- ✅ Ask questions in past tense?
- ✅ Use time expressions like "juče", "prošle nedelje"?

**If yes - odlično! You're ready for Unit 12! 📅**`;

// UNIT 12: Verbs of Motion
const UNIT_12_OVERVIEW = `## Welcome to Unit 12: Verbs of Motion

**What You'll Learn:**
- Key verbs of motion (ići, doći, otići, etc.)
- Directional prefixes
- How to express "going to" vs "coming from"
- Transportation vocabulary
- Prepositions of movement

**Real-Life Context:**
Getting around, giving directions, talking about travel - verbs of motion are essential for navigating life in Serbia!

📖 *This unit corresponds to page 72 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_12_GRAMMAR = `# Unit 12: Grammar Explained

## 1. Basic Motion Verbs

### Core Verbs:

| Verb | Meaning | Present | Past (M/F) |
|------|---------|---------|------------|
| ići | to go | idem | išao/išla |
| doći | to come | dođem | došao/došla |
| otići | to leave/go away | otiđem | otišao/otišla |
| poći | to set off | pođem | pošao/pošla |
| proći | to pass by | prođem | prošao/prošla |

---

## 2. Directional Prefixes

Serbian uses prefixes to show direction:

| Prefix | Direction | Example |
|--------|-----------|---------|
| do- | to/arrival | **doći** (to come/arrive) |
| oti- | away from | **otići** (to go away) |
| po- | start of motion | **poći** (to set off) |
| pro- | through/past | **proći** (to pass through) |
| u- | into | **ući** (to enter) |
| iz- | out of | **izići** (to exit) |

---

## 3. Transportation Vocabulary

### Vehicles:

| Serbian | English | Serbian | English |
|---------|---------|---------|---------|
| autobus | bus | tramvaj | tram |
| taksi | taxi | voz | train |
| avion | airplane | brod | boat |
| bicikl | bicycle | automobil | car |

### Phrases:

- **Idem autobusom** (I go by bus)
- **Putovati vozom** (to travel by train)
- **Voziti auto** (to drive a car)

---

## 4. Prepositions of Movement

| Serbian | English | Example |
|---------|---------|---------|
| u + accusative | to (into) | **Idem u školu** (I'm going to school) |
| iz + genitive | from (out of) | **Dolazim iz Beograda** (I'm coming from Belgrade) |
| na + accusative | to (onto) | **Idem na posao** (I'm going to work) |
| sa + genitive | from (off of) | **Dolazim sa posla** (I'm coming from work) |
| do + genitive | to/until | **Idem do prodavnice** (I'm going to the store) |

---

## 5. Example Sentences

1. **Idem u grad.** (I'm going to the city)
2. **Došao sam iz Novog Sada.** (I came from Novi Sad)
3. **Otišla je kući.** (She went home)
4. **Idemo autobusom.** (We're going by bus)

---

## 🇲🇪 Montenegrin Note

All motion verbs are identical in Serbian and Montenegrin!`;

const UNIT_12_PRACTICE = `# Unit 12: Practice Examples

[EXERCISE:fill_blank:unit12_motion_verbs]

---

[EXERCISE:translation:unit12_directions]

---

[EXERCISE:fill_blank:unit12_transportation]

---

## 📝 Describe Your Commute

Write about how you get to work/school:

**Model:** Svako jutro idem na posao autobusom. Autobus dolazi u 8 sati. Putujem 30 minuta. Dolazim do centra. Onda idem pešice do kancelarije.

---

## 🎯 Self-Check

Can you now:
- ✅ Use ići, doći, otići correctly?
- ✅ Understand directional prefixes?
- ✅ Talk about transportation methods?
- ✅ Use prepositions u/iz/na/sa correctly?

**If yes - odlično! You're ready for Unit 13! 🚌**`;

// UNIT 13: Weather and Seasons
const UNIT_13_OVERVIEW = `## Welcome to Unit 13: Weather and Seasons

**What You'll Learn:**
- Weather vocabulary and expressions
- Four seasons in Serbian
- Temperature and weather conditions
- How to talk about climate
- Seasonal activities

**Real-Life Context:**
Small talk about weather is universal! This unit helps you chat about sunny Belgrade summers and snowy mountain winters.

📖 *This unit corresponds to page 78 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_13_GRAMMAR = `# Unit 13: Grammar Explained

## 1. Seasons (Godišnja Doba)

| Serbian | English | Characteristics |
|---------|---------|-----------------|
| proleće | spring | Warm, flowers bloom |
| leto | summer | Hot, sunny |
| jesen | autumn/fall | Cool, leaves fall |
| zima | winter | Cold, snow |

**Phrases:**
- **U proleće** (in spring)
- **Tokom leta** (during summer)
- **Ove jeseni** (this autumn)
- **Prošle zime** (last winter)

---

## 2. Weather Expressions

### Basic Weather:

| Serbian | English |
|---------|---------|
| Kakvo je vreme? | What's the weather like? |
| Lepo je vreme | The weather is nice |
| Loše je vreme | The weather is bad |
| Toplo je | It's warm |
| Hladno je | It's cold |
| Vruće je | It's hot |

### Weather Conditions:

| Serbian | English |
|---------|---------|
| Sunčano je | It's sunny |
| Oblačno je | It's cloudy |
| Kiša pada | It's raining |
| Sneg pada | It's snowing |
| Vetar duva | The wind is blowing |
| Grmi | It's thundering |

---

## 3. Temperature

- **Koliko je stepeni?** (What's the temperature?)
- **Dvadeset stepeni** (20 degrees)
- **Minus pet stepeni** (Minus 5 degrees)
- **Trideset stepeni Celzijusa** (30 degrees Celsius)

---

## 4. Seasonal Activities

### Spring:
- **Cveće cveta** (Flowers bloom)
- **Šetam se po parku** (I walk in the park)

### Summer:
- **Kupam se na moru** (I swim in the sea)
- **Sunčam se** (I sunbathe)

### Autumn:
- **Lišće pada** (Leaves fall)
- **Beremo voće** (We pick fruit)

### Winter:
- **Pada sneg** (Snow falls)
- **Skijam se** (I ski)

---

## 🇲🇪 Montenegrin Note

Weather vocabulary is identical! Montenegro has a beautiful Mediterranean climate on the coast.`;

const UNIT_13_PRACTICE = `# Unit 13: Practice Examples

[EXERCISE:fill_blank:unit13_weather]

---

[EXERCISE:translation:unit13_seasons]

---

[EXERCISE:fill_blank:unit13_temperature]

---

## 📝 Describe Today's Weather

Write 3-4 sentences about today's weather:

**Model:** Danas je sunčano vreme. Toplo je - dvadeset stepeni. Nema vetra. Lepo je za šetnju.

---

## 🎯 Self-Check

Can you now:
- ✅ Name all four seasons?
- ✅ Describe weather conditions?
- ✅ Talk about temperature?
- ✅ Discuss seasonal activities?

**If yes - odlično! You're ready for Unit 14! ☀️**`;

// UNIT 14: Hobbies and Free Time
const UNIT_14_OVERVIEW = `## Welcome to Unit 14: Hobbies and Free Time

**What You'll Learn:**
- Hobby and leisure vocabulary
- Sports and activities
- How to talk about what you like to do
- Frequency expressions
- Cultural activities in Serbia

**Real-Life Context:**
Making friends, joining clubs, discussing interests - talking about hobbies is key to social life!

📖 *This unit corresponds to page 84 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_14_GRAMMAR = `# Unit 14: Grammar Explained

## 1. Hobby Vocabulary

### Common Hobbies:

| Serbian | English |
|---------|---------|
| čitanje | reading |
| pisanje | writing |
| crtanje | drawing |
| slikanje | painting |
| fotografisanje | photography |
| kuvanje | cooking |
| pečenje | baking |
| vrtlarstvo | gardening |
| muzika | music |
| ples | dance |

---

## 2. Sports (Sportovi)

| Serbian | English | Verb |
|---------|---------|------|
| fudbal | football/soccer | **igrati fudbal** |
| košarka | basketball | **igrati košarku** |
| tenis | tennis | **igrati tenis** |
| plivanje | swimming | **plivati** |
| trčanje | running | **trčati** |
| skijanje | skiing | **skijati se** |
| planinarenje | hiking | **planinariti** |
| vožnja bicikla | cycling | **voziti bicikl** |

---

## 3. Expressing Likes and Interests

### "Voleti" (to love/like):

- **Volim da čitam** (I like to read)
- **Volim čitanje** (I like reading)
- **Volim knjige** (I like books)

### "Baviti se" (to engage in):

- **Bavim se sportom** (I do sports)
- **Bavim se muzikom** (I do music)

### "Interesovati se za" (to be interested in):

- **Interesujem se za istoriju** (I'm interested in history)

---

## 4. Frequency Expressions

| Serbian | English |
|---------|---------|
| svaki dan | every day |
| često | often |
| ponekad | sometimes |
| retko | rarely |
| nikad | never |
| vikendom | on weekends |
| jednom nedeljno | once a week |

---

## 5. Example Sentences

1. **Volim da igram fudbal.** (I like to play football)
2. **Bavim se fotografisanjem.** (I do photography)
3. **Često čitam knjige.** (I often read books)
4. **Vikendom idem u planine.** (On weekends I go to the mountains)

---

## 🇲🇪 Montenegrin Note

All hobby vocabulary is identical! Montenegro is famous for outdoor activities like hiking and water sports.`;

const UNIT_14_PRACTICE = `# Unit 14: Practice Examples

[EXERCISE:fill_blank:unit14_hobbies]

---

[EXERCISE:translation:unit14_activities]

---

[EXERCISE:fill_blank:unit14_frequency]

---

## 📝 Write About Your Hobbies

Answer these questions:

1. Čime se baviš u slobodno vreme?
2. Koji sport voliš?
3. Koliko često čitaš knjige?

**Model:** U slobodno vreme volim da čitam. Bavim se trčanjem. Trčim tri puta nedeljno. Takođe volim da gledam filmove.

---

## 🎯 Self-Check

Can you now:
- ✅ Name 10+ hobbies in Serbian?
- ✅ Talk about sports you play?
- ✅ Express what you like to do?
- ✅ Use frequency expressions?

**If yes - odlično! You're ready for Unit 15! ⚽**`;

// UNIT 15: Making Plans and Invitations
const UNIT_15_OVERVIEW = `## Welcome to Unit 15: Making Plans and Invitations

**What You'll Learn:**
- How to invite someone
- Accept and decline invitations politely
- Make suggestions and plans
- Talk about future events
- Social etiquette in Serbia

**Real-Life Context:**
Meeting friends for coffee, planning weekend activities, inviting someone to dinner - essential social skills!

📖 *This unit corresponds to page 90 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_15_GRAMMAR = `# Unit 15: Grammar Explained

## 1. Making Invitations

### Formal Invitations:

- **Želite li da...?** (Would you like to...?)
- **Da li biste želeli da...?** (Would you like to...? - very formal)
- **Hoćete li...?** (Will you...?)

### Informal Invitations:

- **Hoćeš li da...?** (Do you want to...?)
- **Ajde da...** (Let's...)
- **Idemo...** (Let's go...)

---

## 2. Accepting Invitations

| Serbian | English |
|---------|---------|
| Da, hvala! | Yes, thank you! |
| Rado! | Gladly! |
| Naravno! | Of course! |
| Sjajno! | Great! |
| Dobra ideja! | Good idea! |
| Slažem se | I agree |

---

## 3. Declining Invitations

### Polite Refusals:

- **Žao mi je, ne mogu** (I'm sorry, I can't)
- **Hvala, ali imam posla** (Thanks, but I have work)
- **Možda drugi put** (Maybe another time)
- **Nažalost, zauzet sam** (Unfortunately, I'm busy)

---

## 4. Making Suggestions

- **Hajde da idemo u bioskop** (Let's go to the cinema)
- **Šta kažeš na kafu?** (What do you say to coffee?)
- **Da li želiš da...?** (Do you want to...?)
- **Možemo da...** (We can...)

---

## 5. Time and Place Arrangements

### When:

- **Kada ti odgovara?** (When suits you?)
- **U koliko sati?** (At what time?)
- **Sutra u 6?** (Tomorrow at 6?)
- **Vikendom?** (On the weekend?)

### Where:

- **Gde da se nađemo?** (Where should we meet?)
- **Kod tebe ili kod mene?** (At your place or mine?)
- **U centru?** (In the center?)

---

## 6. Example Dialogues

**Dialogue 1:**
- **A:** Hoćeš li da idemo na kafu sutra?
- **B:** Da, rado! U koliko sati?
- **A:** U 5 popodne?
- **B:** Odlično! Gde?
- **A:** Kod Trga Republike?
- **B:** Super! Vidimo se!

**Translation:**
- A: Do you want to go for coffee tomorrow?
- B: Yes, gladly! At what time?
- A: At 5 PM?
- B: Perfect! Where?
- A: At Republic Square?
- B: Great! See you!

---

## 🇲🇪 Montenegrin Note

All invitation phrases are identical! Montenegrins are known for their hospitality and love socializing over coffee.`;

const UNIT_15_PRACTICE = `# Unit 15: Practice Examples

[EXERCISE:fill_blank:unit15_invitations]

---

[EXERCISE:translation:unit15_plans]

---

[EXERCISE:fill_blank:unit15_responses]

---

## 📝 Role Play Practice

Create dialogues for these situations:

1. **Invite a friend to the cinema**
2. **Accept an invitation to dinner**
3. **Politely decline an invitation (you're busy)**

**Model:**
- **Ti:** Hoćeš li da idemo u bioskop večeras?
- **Prijatelj:** Žao mi je, ne mogu. Imam posla. Možda sutra?
- **Ti:** Dobro, sutra u 7?
- **Prijatelj:** Sjajno! Vidimo se!

---

## 🎯 Self-Check

Can you now:
- ✅ Invite someone formally and informally?
- ✅ Accept invitations enthusiastically?
- ✅ Decline politely with reasons?
- ✅ Make suggestions and plans?
- ✅ Arrange time and place?

**If yes - odlično! You've completed Week 3! You're ready for Unit 16! 🎉**`;

async function insertUnits11to15() {
  console.log('Inserting Units 11-15...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available!');
    process.exit(1);
  }
  
  const units = [
    {
      unitNumber: 11,
      overview: UNIT_11_OVERVIEW,
      grammarExplained: UNIT_11_GRAMMAR,
      practiceExamples: UNIT_11_PRACTICE,
      bookReference: 'Unit 11 corresponds to page 65 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 12,
      overview: UNIT_12_OVERVIEW,
      grammarExplained: UNIT_12_GRAMMAR,
      practiceExamples: UNIT_12_PRACTICE,
      bookReference: 'Unit 12 corresponds to page 72 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 13,
      overview: UNIT_13_OVERVIEW,
      grammarExplained: UNIT_13_GRAMMAR,
      practiceExamples: UNIT_13_PRACTICE,
      bookReference: 'Unit 13 corresponds to page 78 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 14,
      overview: UNIT_14_OVERVIEW,
      grammarExplained: UNIT_14_GRAMMAR,
      practiceExamples: UNIT_14_PRACTICE,
      bookReference: 'Unit 14 corresponds to page 84 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 15,
      overview: UNIT_15_OVERVIEW,
      grammarExplained: UNIT_15_GRAMMAR,
      practiceExamples: UNIT_15_PRACTICE,
      bookReference: 'Unit 15 corresponds to page 90 in "Step by Step Serbian 1" by Vladislava Ribnikar'
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
    
    console.log('\n✅ All Units 11-15 inserted successfully!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

insertUnits11to15();

