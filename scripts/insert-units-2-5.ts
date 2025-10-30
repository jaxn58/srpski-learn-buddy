import { getDb } from "../server/db";
import { unitExplanations } from "../drizzle/schema";
import { nanoid } from "nanoid";

// UNIT 2 CONTENT
const UNIT_2_OVERVIEW = `## Welcome to Unit 2: In the Café

**What You'll Learn:**
- Numbers from 1 to 100
- How to order food and drinks in a café
- The verb "imati" (to have)
- Asking about prices
- Basic café vocabulary

**Real-Life Context:**
You're settling into Belgrade and want to grab a coffee. Serbian café culture is HUGE - people spend hours chatting over coffee. This unit teaches you how to order like a local!

**Study Tips:**
- Practice numbers out loud - they're essential for prices!
- Learn the café vocabulary - you'll use it daily
- Don't worry about perfection - café staff are very patient with learners

📖 *This unit corresponds to pages 10-15 in "Step by Step Serbian 1" by Mirjana Danilović*`;

const UNIT_2_GRAMMAR = `# Unit 2: Grammar Explained

## 1. Numbers 1-100

Numbers are essential for ordering, paying, and everyday conversation!

### Numbers 1-20:

| Number | Serbian | Pronunciation |
|--------|---------|---------------|
| 1 | **jedan** (m), **jedna** (f), **jedno** (n) | yeh-dahn |
| 2 | **dva** (m/n), **dve** (f) | dvah / dveh |
| 3 | **tri** | tree |
| 4 | **četiri** | cheh-tee-ree |
| 5 | **pet** | peht |
| 6 | **šest** | shehst |
| 7 | **sedam** | seh-dahm |
| 8 | **osam** | oh-sahm |
| 9 | **devet** | deh-veht |
| 10 | **deset** | deh-seht |
| 11 | **jedanaest** | yeh-dah-nah-ehst |
| 12 | **dvanaest** | dvah-nah-ehst |
| 13 | **trinaest** | tree-nah-ehst |
| 14 | **četrnaest** | cheht-r-nah-ehst |
| 15 | **petnaest** | peht-nah-ehst |
| 16 | **šesnaest** | shehst-nah-ehst |
| 17 | **sedamnaest** | seh-dahm-nah-ehst |
| 18 | **osamnaest** | oh-sahm-nah-ehst |
| 19 | **devetnaest** | deh-veht-nah-ehst |
| 20 | **dvadeset** | dvah-deh-seht |

### Tens (20-100):

| Number | Serbian | Pronunciation |
|--------|---------|---------------|
| 20 | **dvadeset** | dvah-deh-seht |
| 30 | **trideset** | tree-deh-seht |
| 40 | **četrdeset** | cheht-r-deh-seht |
| 50 | **pedeset** | peh-deh-seht |
| 60 | **šezdeset** | shehz-deh-seht |
| 70 | **sedamdeset** | seh-dahm-deh-seht |
| 80 | **osamdeset** | oh-sahm-deh-seht |
| 90 | **devedeset** | deh-veh-deh-seht |
| 100 | **sto** | stoh |

**Examples:**
- **21** = dvadeset jedan (20 + 1)
- **35** = trideset pet (30 + 5)
- **67** = šezdeset sedam (60 + 7)
- **99** = devedeset devet (90 + 9)

---

## 2. The Verb "imati" (to have)

This is your second essential verb! You'll use it constantly.

### Full Conjugation:

| Person | Serbian | English | Example |
|--------|---------|---------|---------|
| **ja** | **imam** | I have | **Ja imam kafu.** (I have coffee) |
| **ti** | **imaš** | you have | **Ti imaš čaj.** (You have tea) |
| **on/ona/ono** | **ima** | he/she/it has | **On ima novac.** (He has money) |
| **mi** | **imamo** | we have | **Mi imamo vreme.** (We have time) |
| **vi** | **imate** | you have | **Vi imate meniju.** (You have a menu) |
| **oni/one/ona** | **imaju** | they have | **Oni imaju kafu.** (They have coffee) |

### Negative Form:

To say "don't have", use **"nemam"** (ne + imam):

- **Ja nemam novac.** - I don't have money.
- **Ti nemaš vreme.** - You don't have time.
- **On nema kafu.** - He doesn't have coffee.

---

## 3. Café Vocabulary

### Drinks:

| Serbian | English | Pronunciation |
|---------|---------|---------------|
| **kafa** / **kava** | coffee | kah-fah / kah-vah |
| **espreso** | espresso | ehs-preh-soh |
| **cappuccino** | cappuccino | kah-poo-chee-noh |
| **čaj** | tea | chai |
| **sok** | juice | sohk |
| **voda** | water | voh-dah |
| **mineralna voda** | mineral water | mee-neh-rahl-nah voh-dah |
| **pivo** | beer | pee-voh |
| **vino** | wine | vee-noh |
| **mleko** | milk | mleh-koh |

### Food:

| Serbian | English |
|---------|---------|
| **sendvič** | sandwich |
| **pita** | pie/pastry |
| **kolač** | cake |
| **hleb** | bread |
| **sir** | cheese |
| **šunka** | ham |
| **kroasan** | croissant |

---

## 4. Ordering in a Café

### Useful Phrases:

**Molim...** - Please... (when ordering)

**Examples:**
- **Molim jedan espreso.** - One espresso, please.
- **Molim jednu kafu sa mlekom.** - One coffee with milk, please.
- **Molim dva čaja.** - Two teas, please.

**Želim...** - I want...
- **Želim kafu.** - I want coffee.

**Mogu li dobiti...?** - Can I get...?
- **Mogu li dobiti račun?** - Can I get the bill?

---

## 5. Asking About Prices

**Koliko košta...?** - How much does ... cost?

**Examples:**
- **Koliko košta kafa?** - How much does coffee cost?
- **Koliko košta sendvič?** - How much does a sandwich cost?

**Answer:**
- **Kafa košta 150 dinara.** - Coffee costs 150 dinars.
- **Sendvič košta 300 dinara.** - A sandwich costs 300 dinars.

💡 **Serbian currency:** Dinar (RSD). 1 coffee ≈ 150-200 dinars.

---

## 6. Saying "with" and "without"

**sa** - with  
**bez** - without

**Examples:**
- **Kafa sa mlekom** - Coffee with milk
- **Kafa sa šećerom** - Coffee with sugar
- **Kafa bez šećera** - Coffee without sugar
- **Čaj sa limunom** - Tea with lemon

---

## 🎯 Key Takeaways:

✅ Numbers 1-100 are built logically (20 + 1 = dvadeset jedan)  
✅ "Imati" (to have): imam, imaš, ima, imamo, imate, imaju  
✅ Negative: nemam, nemaš, nema...  
✅ "Molim..." = Please (when ordering)  
✅ "Koliko košta?" = How much does it cost?  
✅ "sa" = with, "bez" = without

**Practice Tip:** Go to a café and try ordering in Serbian! Even just "Molim jedan espreso" will impress! ☕`;

const UNIT_2_PRACTICE = `# Unit 2: Practice Examples & Dialogues

## 📝 Dialogue 1: Ordering Coffee

**Scenario:** You're in a Belgrade café ordering coffee.

---

**Konobar (Waiter):** Dobar dan! Šta želite?  
**You:** Dobar dan. Molim jedan espreso.  
**Konobar:** Sa šećerom?  
**You:** Da, molim.  
**Konobar:** Odmah dolazi.

---

**Translation:**

**Waiter:** Good day! What would you like?  
**You:** Good day. One espresso, please.  
**Waiter:** With sugar?  
**You:** Yes, please.  
**Waiter:** Coming right up.

---

## 📝 Dialogue 2: Paying the Bill

**You:** Izvinite, koliko košta?  
**Konobar:** 150 dinara.  
**You:** Izvolite. (handing money)  
**Konobar:** Hvala. Doviđenja!  
**You:** Doviđenja!

**Translation:**

**You:** Excuse me, how much is it?  
**Waiter:** 150 dinars.  
**You:** Here you go.  
**Waiter:** Thank you. Goodbye!  
**You:** Goodbye!

---

<InteractiveExercise type="fillInBlank" id="unit2-imati-conjugation" />

---

<InteractiveExercise type="fillInBlank" id="unit2-numbers" />

---

<InteractiveExercise type="translation" id="unit2-cafe-phrases" />

---

## 📚 Vocabulary Review

### Café Essentials:
- **konobar** - waiter
- **konobarka** - waitress
- **meni** / **jelovnik** - menu
- **račun** - bill
- **novac** - money
- **dinar** - dinar (currency)
- **šećer** - sugar
- **limun** - lemon

---

## 🌍 Cultural Note: Serbian Café Culture

Serbians LOVE their coffee! A few things to know:
- **"Kafa"** usually means Turkish coffee (strong, unfiltered)
- Cafés are social hubs - people meet friends, work, and relax there
- It's normal to sit for hours over one coffee - no one will rush you!
- Tipping: Round up or add 10% for good service

**Useful phrase:** "Idemo na kafu!" (Let's go for coffee!) - This is how Serbians suggest hanging out!

---

## 🎯 Self-Check

Can you now:
- ✅ Count from 1 to 100 in Serbian?
- ✅ Order coffee and food in a café?
- ✅ Conjugate "imati" (to have)?
- ✅ Ask "How much does it cost?"?
- ✅ Say "with" and "without"?

If yes - great job! You're ready for Unit 3! 🎉`;

async function insertUnits2to5() {
  console.log("Inserting comprehensive content for Units 2-5...");

  const db = await getDb();
  if (!db) {
    console.error("Database not available!");
    process.exit(1);
  }

  try {
    // Insert Unit 2
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 2,
      overview: UNIT_2_OVERVIEW,
      grammarExplained: UNIT_2_GRAMMAR,
      practiceExamples: UNIT_2_PRACTICE,
      bookReference: "Unit 2 corresponds to pages 10-15 in 'Step by Step Serbian 1' by Mirjana Danilović",
    });
    
    console.log(`✅ Inserted Unit 2 with ${UNIT_2_OVERVIEW.length + UNIT_2_GRAMMAR.length + UNIT_2_PRACTICE.length} total characters`);

    // Units 3-5 will be added in next iteration
    console.log("⏳ Units 3-5 coming next...");
    
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  console.log("Done!");
  process.exit(0);
}

insertUnits2to5().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

