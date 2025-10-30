import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { nanoid } from 'nanoid';

const UNIT_6_OVERVIEW = `## Welcome to Unit 6: Shopping for Food

**What You'll Learn:**
- How to shop for groceries in Serbian markets and supermarkets
- Essential food vocabulary (fruits, vegetables, meat, dairy, bakery items)
- How to ask for quantities and understand prices
- The verb "trebati" (to need) - a key verb for shopping
- Polite shopping phrases and cultural etiquette

**Real-Life Context:**
Imagine you're at a vibrant Serbian market (pijaca) or a modern supermarket in Belgrade. You need to buy ingredients for dinner - fresh vegetables for a Serbian salad, bread from the bakery, and some dairy products. This unit equips you with all the vocabulary and grammar you need to navigate Serbian food shopping with confidence!

**Why This Matters:**
Shopping for food is one of the most practical and frequent activities you'll do in Serbia. Markets are social hubs where locals gather, and knowing how to communicate properly will not only help you get what you need but also connect with Serbian culture.

**Study Tips:**
- Create flashcards with pictures of foods
- Visit Serbian market websites or YouTube videos to see real shopping scenarios
- Practice quantities with real objects at home
- Learn the currency (dinar) and practice price calculations

📖 *This unit corresponds to page 33 in "Step by Step Serbian 1" by Vladislava Ribnikar*`;

const UNIT_6_GRAMMAR = `# Unit 6: Grammar Explained

## 1. The Verb "Trebati" (To Need)

"Trebati" is one of the most useful verbs for shopping, but it works differently from English. It's an **impersonal verb**, meaning it doesn't have a traditional subject like "I" or "you". Instead, it uses the **dative case** to indicate who needs something.

### Basic Structure:

**English:** I need bread  
**Serbian:** Mi treba hleb (literally: "To me is needed bread")

### Conjugation Table:

| English | Dative Pronoun | Trebati | Example | Translation |
|---------|----------------|---------|---------|-------------|
| I need | mi | treba | **Mi treba hleb** | I need bread |
| You need (informal) | ti | treba | **Ti treba mleko** | You need milk |
| He needs | mu | treba | **Mu treba voda** | He needs water |
| She needs | joj | treba | **Joj treba sir** | She needs cheese |
| We need | nama | treba | **Nama treba voće** | We need fruit |
| You need (formal/plural) | vama | treba | **Vama treba meso** | You need meat |
| They need | njima | treba | **Njima treba hleb** | They need bread |

**Key Point:** The verb "treba" stays the same for all persons! Only the dative pronoun changes.

### Singular vs. Plural Items:

When you need ONE item (singular), use **"treba"**:
- **Mi treba hleb** (I need bread)
- **Ti treba jabuka** (You need an apple)

When you need MULTIPLE items (plural), use **"trebaju"**:
- **Mi trebaju jaja** (I need eggs)
- **Ti trebaju paradajzi** (You need tomatoes)
- **Njima trebaju krastavci** (They need cucumbers)

---

## 2. Food Vocabulary

### Fruits (Voće):

| Serbian | Pronunciation | English | Serbian | Pronunciation | English |
|---------|---------------|---------|---------|---------------|---------|
| jabuka | YA-boo-ka | apple | kruška | KROOSH-ka | pear |
| banana | ba-NA-na | banana | narandža | na-RAN-ja | orange |
| grožđe | GROZH-je | grapes | jagoda | YA-go-da | strawberry |
| šljiva | SHLY-va | plum | kajsija | kai-SEE-ya | apricot |
| breskva | BRES-kva | peach | lubenica | loo-BEN-i-tsa | watermelon |

### Vegetables (Povrće):

| Serbian | Pronunciation | English | Serbian | Pronunciation | English |
|---------|---------------|---------|---------|---------------|---------|
| paradajz | PA-ra-daiz | tomato | krastavac | kra-STA-vats | cucumber |
| paprika | PA-pri-ka | pepper | crni luk | TSR-ni look | onion |
| beli luk | BE-li look | garlic | karfiol | kar-FEE-ol | cauliflower |
| kupus | KOO-poos | cabbage | šargarepa | shar-ga-RE-pa | carrot |
| krompir | KROM-peer | potato | tikvica | tik-VEE-tsa | zucchini |

### Meat & Dairy:

| Serbian | English | Serbian | English |
|---------|---------|---------|---------|
| meso | meat | piletina | chicken |
| govedina | beef | svinjetina | pork |
| riba | fish | jaja | eggs |
| mleko | milk | sir | cheese |
| jogurt | yogurt | pavlaka | sour cream |
| puter | butter | kajmak | cream cheese |

### Bakery & Staples:

| Serbian | English | Serbian | English |
|---------|---------|---------|---------|
| hleb | bread | pecivo | pastry |
| brašno | flour | šećer | sugar |
| so | salt | biber | pepper |
| ulje | oil | sirće | vinegar |
| pirinač | rice | testenina | pasta |

---

## 3. Quantities & Measurements

### Common Quantities:

| Serbian | English | Example |
|---------|---------|---------|
| kilogram (kilo) | kilogram | **jedan kilo jabuka** (one kilo of apples) |
| pola kila | half a kilo | **pola kila sira** (half a kilo of cheese) |
| litar | liter | **dva litra mleka** (two liters of milk) |
| komad | piece | **tri komada hleba** (three pieces of bread) |
| kesica | bag | **jedna kesica brašna** (one bag of flour) |
| kutija | box | **dve kutije jaja** (two boxes of eggs) |

### Number Agreement with Nouns:

- **1** + nominative singular: **jedan paradajz** (one tomato)
- **2, 3, 4** + genitive singular: **dva paradajza** (two tomatoes)
- **5+** + genitive plural: **pet paradajza** (five tomatoes)

---

## 4. Essential Shopping Phrases

### Asking for Items:

- **Molim vas, imate li...?** - Excuse me, do you have...?
- **Dajte mi...** - Give me... (polite imperative)
- **Hoću...** - I want...
- **Treba mi...** - I need...

### Asking for Prices:

- **Koliko košta...?** - How much does... cost? (singular)
- **Koliko koštaju...?** - How much do... cost? (plural)
- **Koliko je to?** - How much is that?

### Quantities:

- **Koliko želite?** - How much do you want?
- **Dajte mi kilo** - Give me a kilo
- **Pola kila, molim** - Half a kilo, please

### Polite Expressions:

- **Hvala** - Thank you
- **Molim** - Please / You're welcome
- **Izvol'te** - Here you are
- **To je sve** - That's all

---

## 5. Example Conversations

### Conversation 1: At the Fruit Stand

**You:** Dobar dan! Koliko koštaju jabuke?  
**Vendor:** Jabuke su 150 dinara po kilu.  
**You:** Dajte mi dva kila, molim.  
**Vendor:** Izvol'te. Još nešto?  
**You:** Ne, hvala. To je sve.  
**Vendor:** 300 dinara, molim.

---

## 🇲🇪 Montenegrin Note

Food vocabulary is identical in Serbian and Montenegrin. Shopping phrases and the verb "trebati" work exactly the same way!`;

const UNIT_6_PRACTICE = `# Unit 6: Practice Examples

[EXERCISE:fill_blank:unit6_trebati]

---

[EXERCISE:translation:unit6_shopping]

---

[EXERCISE:fill_blank:unit6_food_vocab]

---

## 📝 Dialogue Practice

**Scenario:** You're shopping for ingredients to make a Serbian salad (šopska salata).

**At the market:**

**You:** Dobar dan! Treba mi paradajz.  
**Vendor:** Koliko želite?  
**You:** Jedan kilo, molim.  
**Vendor:** Izvol'te. Još nešto?  
**You:** Da, trebaju mi i krastavci. Pola kila.  
**Vendor:** Dobro. Još?  
**You:** Treba mi crni luk - dva komada.  
**Vendor:** Izvol'te. To je sve?  
**You:** Ne, treba mi i sir. Pola kila.  
**Vendor:** To je 450 dinara.  
**You:** Hvala!

---

## 🎯 Self-Check

Can you now:
- ✅ Use "trebati" correctly with dative pronouns?
- ✅ Name 10+ fruits and vegetables in Serbian?
- ✅ Ask for prices and quantities?
- ✅ Complete a shopping conversation?
- ✅ Understand the difference between "treba" and "trebaju"?

**If yes - odlično! You're ready for Unit 7! 🛒**`;

async function insertUnit6() {
  console.log('Inserting Unit 6...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available!');
    process.exit(1);
  }
  
  try {
    await db.insert(unitExplanations).values({
      id: nanoid(),
      unitNumber: 6,
      overview: UNIT_6_OVERVIEW,
      grammarExplained: UNIT_6_GRAMMAR,
      practiceExamples: UNIT_6_PRACTICE,
      bookReference: 'Unit 6 corresponds to page 33 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    });
    
    const totalLength = UNIT_6_OVERVIEW.length + UNIT_6_GRAMMAR.length + UNIT_6_PRACTICE.length;
    console.log(`✅ Unit 6 inserted: ${totalLength} characters`);
    console.log('Done!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

insertUnit6();

