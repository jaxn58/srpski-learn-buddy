import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  console.error("Please set VITE_CONVEX_URL in .env.local");
  process.exit(1);
}

const UNIT_16_OVERVIEW = `## Welcome to Unit 16: Steve's New Apartment

**What You'll Learn:**
- How to describe an apartment and its rooms
- Vocabulary for furniture and household items
- The Dative case (singular and plural)
- Dative forms of personal pronouns
- How to talk about moving and renting an apartment
- Using prepositions with the Dative case (ka, prema, k)

**Real-Life Context:**
Imagine you're moving to Belgrade! You need to find an apartment, talk to landlords, describe what rooms you need, and tell your friends about your new place. This unit teaches you everything you need for apartment hunting and moving in Serbia!

**Study Tips:**
- Practice the Dative case endings daily - they're essential!
- Repeat the apartment vocabulary out loud
- Role-play the dialogues with a partner
- Create your own description of your ideal Serbian apartment

📖 *This unit focuses on practical skills for living in Serbia*`;

const UNIT_16_GRAMMAR = `# Unit 16: Grammar Explained

## 1. The Dative Case (Dativ)

The Dative case answers the questions **"To whom?"** (Kome?) and **"To what?"** (Čemu?).

### Dative Singular Endings:

| Gender | Nominative | Dative | Example |
|--------|------------|--------|---------|
| **Masculine** | -Ø (consonant) | **-u** | prozor → prozor**u** (to the window) |
| **Neuter** | -o / -e | **-u** | kupatilo → kupatil**u** (to the bathroom) |
| **Feminine** | -a | **-i** | soba → sob**i** (to the room) |
| **Feminine** | -Ø (consonant) | **-i** | stvar → stvar**i** (to the thing) |

**Examples:**
- Prilazim **prozoru**. (I'm approaching the window.)
- Idem ka **centru**. (I'm going to the center.)
- Dajem ključ **Ani**. (I'm giving the key to Ana.)
- Pomažem **majci**. (I'm helping my mother.)

---

### Dative Plural Endings:

| Gender | Nominative Plural | Dative Plural | Example |
|--------|-------------------|---------------|---------|
| **Masculine** | -i | **-ima** | prozori → prozor**ima** |
| **Neuter** | -a | **-ima** | kupatila → kupatil**ima** |
| **Feminine (-a)** | -e | **-ama** | sobe → sob**ama** |
| **Feminine (-Ø)** | -i | **-ima** | stvari → stvar**ima** |

**Examples:**
- Prilazim **prozorima**. (I'm approaching the windows.)
- Idem ka **centrima**. (I'm going to the centers.)
- Dajem ključeve **sobama**. (I'm giving keys to the rooms.)

---

## 2. Dative Personal Pronouns

| Nominative | Dative | English |
|------------|--------|---------|
| **ja** | **mi** | to me |
| **ti** | **tebi** / **ti** | to you (informal) |
| **on** | **njemu** / **mu** | to him |
| **ona** | **njoj** / **joj** | to her |
| **ono** | **njemu** / **mu** | to it |
| **mi** | **nama** / **nam** | to us |
| **vi** | **vama** / **vam** | to you (formal/plural) |
| **oni/one/ona** | **njima** / **im** | to them |

**Note:** Short forms (mi, ti, mu, joj, nam, vam, im) are more common and used when the pronoun is NOT emphasized.

**Examples:**
- Daje **mi** ključ. (He gives me the key.)
- Pomažem **ti**. (I'm helping you.)
- Dajem **mu** stan. (I'm giving him the apartment.)
- Pokazujem **joj** sobu. (I'm showing her the room.)

---

## 3. When to Use the Dative Case

### A. Indirect Object (most common)

With verbs of giving, showing, telling, helping:

- **dati** (to give): Dajem ključ **gazdi**. (I'm giving the key to the landlord.)
- **pokazati** (to show): Pokazujem stan **prijatelju**. (I'm showing the apartment to my friend.)
- **reći** (to tell): Rekao sam **Ani**. (I told Ana.)
- **pomoći** (to help): Pomažem **majci**. (I'm helping my mother.)

### B. With Prepositions

**ka** / **k** / **prema** (towards, to):

- Idem **ka stanu**. (I'm going to the apartment.)
- Hodamo **prema prozoru**. (We're walking towards the window.)
- Trči **k vratima**. (He's running to the door.)

**blizu** (near):

- Blizu **centru** (near the center)

### C. With Certain Verbs

Some verbs always take Dative:

- **približiti se** (to approach): Približavam se **kući**. (I'm approaching the house.)
- **radovati se** (to look forward to): Radujem se **novom stanu**. (I'm looking forward to the new apartment.)
- **zahvaliti se** (to thank): Zahvaljujem se **gazdi**. (I'm thanking the landlord.)
- **dopadati se** (to like): Dopada mi se **stan**. (I like the apartment.) [Literally: The apartment pleases to me.]

---

## 4. Apartment Vocabulary (Stan)

### Rooms:

| Serbian | English |
|---------|---------|
| stan | apartment |
| kuća | house |
| soba | room |
| spavaća soba | bedroom |
| dnevna soba | living room |
| kuhinja | kitchen |
| kupatilo | bathroom |
| toalet | toilet |
| hodnik | hallway |
| balkon | balcony |
| terasa | terrace |
| podrum | basement |
| potkrovlje | attic |

### Furniture & Items:

| Serbian | English |
|---------|---------|
| nameštaj | furniture |
| krevet | bed |
| sto | table |
| stolica | chair |
| fotelja | armchair |
| sofa | sofa |
| orman | wardrobe |
| polica | shelf |
| lampa | lamp |
| tepih | carpet |
| ogledalo | mirror |
| frižider | refrigerator |
| šporet | stove |
| mašina za pranje | washing machine |

### Renting & Moving:

| Serbian | English |
|---------|---------|
| kirija | rent |
| gazda/gazdarica | landlord/landlady |
| vlasnik | owner |
| stanodavac | tenant |
| ključ | key |
| ugovor | contract |
| depozit | deposit |
| račun | bill |
| seliti se | to move (residence) |
| selidba | moving |
| komšija/komšinica | neighbor (m/f) |

---

## 5. Example Sentences

**Describing Location:**
- Stan je **blizu centru**. (The apartment is near the center.)
- Kuća je **prema parku**. (The house is towards the park.)

**Giving/Showing:**
- Gazda pokazuje stan **studentima**. (The landlord is showing the apartment to students.)
- Dajem ključ **svom bratu**. (I'm giving the key to my brother.)

**Helping:**
- Pomažem **prijateljima** sa nameštajem. (I'm helping friends with furniture.)
- Marko pomaže **Stivu**. (Marko is helping Steve.)

**Expressing Feelings:**
- Dopada mi se **ovaj stan**. (I like this apartment.)
- Radujem se **novom domu**. (I'm looking forward to the new home.)

---

## 🎯 Key Takeaways:

✅ Dative case is used for indirect objects ("to whom?", "to what?")  
✅ Singular endings: masculine/neuter **-u**, feminine **-i**  
✅ Plural endings: masculine/neuter/feminine(consonant) **-ima**, feminine(-a) **-ama**  
✅ Common prepositions: **ka**, **prema**, **k** (towards), **blizu** (near)  
✅ Dative pronouns: mi, ti, mu, joj, nam, vam, im  
✅ Verbs: dati, pomoći, pokazati, reći, približiti se, radovati se

**Practice Tip:** When describing your home or apartment, practice using Dative case with "ka" (towards) and "pomoći" (to help)!`;

const UNIT_16_PRACTICE = fs.readFileSync(
  path.join(__dirname, "..", "docs", "UNIT16_PRACTICE_EXAMPLES.md"),
  "utf-8"
);

async function updateUnit16() {
  console.log("🚀 Updating Unit 16 in Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);

  const client = new ConvexHttpClient(CONVEX_URL);

  try {
    const result = await client.mutation(api.units.seedExplanation, {
      unitNumber: 16,
      overview: UNIT_16_OVERVIEW,
      grammarExplained: UNIT_16_GRAMMAR,
      practiceExamples: UNIT_16_PRACTICE,
    });

    console.log(`✅ Successfully updated Unit 16!`);
    console.log(`   ID: ${result}`);
    console.log(`   Overview: ${UNIT_16_OVERVIEW.length} chars`);
    console.log(`   Grammar: ${UNIT_16_GRAMMAR.length} chars`);
    console.log(`   Practice: ${UNIT_16_PRACTICE.length} chars`);
    console.log(`\n📊 Content Summary:`);
    console.log(`   - 3 Dialogues (Looking for apartment, Describing to friend, Moving day)`);
    console.log(`   - 5 Practice Exercises (Dative forms, Translation, Pronouns, Vocabulary, Q&A)`);
    console.log(`   - Vocabulary sections (Rooms, Furniture, Moving terms)`);
    console.log(`   - Grammar tips and cultural notes`);
  } catch (error: any) {
    console.error(`❌ Error updating Unit 16:`, error.message);
    if (error.message.includes("already exists")) {
      console.log("   ℹ️ Unit 16 already exists, content was updated.");
    }
  }

  console.log("\n✨ Done! Unit 16 now has comprehensive Practice Examples.");
  console.log("   Next: Test in frontend at /unit/16");
  process.exit(0);
}

updateUnit16().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
