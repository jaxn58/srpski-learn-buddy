import { getDb } from "../server/db";
import { unitExplanations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const UNIT_1_PRACTICE_WITH_INTERACTIVE = `# Unit 1: Practice Examples & Dialogues

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

<InteractiveExercise type="fillInBlank" id="unit1-biti-conjugation" />

---

<InteractiveExercise type="translation" id="unit1-basic-phrases" />

---

<InteractiveExercise type="genderRecognition" id="unit1-gender" />

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

async function updateUnit1Exercises() {
  console.log("Updating Unit 1 with interactive exercises...");

  const db = await getDb();
  if (!db) {
    console.error("Database not available!");
    process.exit(1);
  }

  try {
    await db
      .update(unitExplanations)
      .set({
        practiceExamples: UNIT_1_PRACTICE_WITH_INTERACTIVE,
      })
      .where(eq(unitExplanations.unitNumber, 1));
    
    console.log(`✅ Updated Unit 1 with interactive exercises`);
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
  }

  console.log("Done!");
  process.exit(0);
}

updateUnit1Exercises().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

