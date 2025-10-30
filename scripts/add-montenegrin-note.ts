import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

const montenegrinNote = `

---

## 🇲🇪 Montenegrin Language Note

**If you're learning Serbian to use in Montenegro**, you'll be happy to know that Serbian and Montenegrin are **mutually intelligible** and share approximately 95% of their vocabulary and grammar. The differences are minimal, and you'll be understood perfectly using what you learn in this course.

### Key Differences:

**1. Alphabet:**
Montenegrin has two additional letters that represent common sound combinations:

| Letter | Sound | Serbian Equivalent | Example |
|--------|-------|-------------------|---------|
| **Ś / С́** | "sj" (like "sy") | sj | **sjutra** (tomorrow) → **śutra** |
| **Ź / З́** | "zj" | zj | **zjenica** (pupil of eye) → **źenica** |

**Important:** These letters were officially introduced in 2009 but are **not universally used** by all Montenegrins. Many people still write "sj" and "zj" using the traditional Serbian spelling. Both forms are understood and accepted.

**2. Pronunciation:**
- Montenegrin has a distinct melodic accent, especially in coastal regions
- The word for "where" is often pronounced **đe** instead of **gdje** in casual speech

**3. Grammar & Vocabulary:**
- Nearly identical to Serbian
- Some minor preferences in modal verb constructions
- The vast majority of words are exactly the same

### For This Course:

This course teaches **standard Serbian**, which is fully understood and used throughout Montenegro. The grammar, vocabulary, and expressions you learn here will serve you perfectly whether you're in Belgrade, Podgorica, or anywhere in the region.

If you encounter the letters Ś or Ź in Montenegro, simply remember they represent the "sj" and "zj" sounds you're learning in this course.

---
`;

async function addMontenegrinNote() {
  console.log('Adding Montenegrin note to Unit 1...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  try {
    // Get current Unit 1 content
    const result = await db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 1));
    
    if (result.length === 0) {
      console.error('Unit 1 not found in database!');
      process.exit(1);
    }
    
    const currentContent = result[0].grammarExplained;
    console.log(`Current content length: ${currentContent.length} chars`);
    
    // Add Montenegrin note at the end of Grammar Explained section
    const updatedContent = currentContent + montenegrinNote;
    console.log(`Updated content length: ${updatedContent.length} chars`);
    
    // Update database
    await db.update(unitExplanations)
      .set({ grammarExplained: updatedContent })
      .where(eq(unitExplanations.unitNumber, 1));
    
    console.log('✅ Montenegrin note added successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

addMontenegrinNote();

