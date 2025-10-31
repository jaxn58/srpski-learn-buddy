import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function fixExercisePlaceholders() {
  console.log('Fixing exercise placeholders in Units 6-15...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available!');
    process.exit(1);
  }
  
  try {
    // Get all units 6-15
    const units = await db.select().from(unitExplanations).where(
      eq(unitExplanations.unitNumber, 6)
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 7))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 8))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 9))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 10))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 11))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 12))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 13))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 14))
    ).union(
      db.select().from(unitExplanations).where(eq(unitExplanations.unitNumber, 15))
    );
    
    for (const unit of units) {
      let updatedPractice = unit.practiceExamples;
      
      // Replace [EXERCISE:fill_blank:id] with <InteractiveExercise type="fillInBlank" id="id" />
      updatedPractice = updatedPractice.replace(
        /\[EXERCISE:fill_blank:([^\]]+)\]/g,
        '<InteractiveExercise type="fillInBlank" id="$1" />'
      );
      
      // Replace [EXERCISE:translation:id] with <InteractiveExercise type="translation" id="id" />
      updatedPractice = updatedPractice.replace(
        /\[EXERCISE:translation:([^\]]+)\]/g,
        '<InteractiveExercise type="translation" id="$1" />'
      );
      
      // Update the database
      await db.update(unitExplanations)
        .set({ practiceExamples: updatedPractice })
        .where(eq(unitExplanations.id, unit.id));
      
      console.log(`✅ Unit ${unit.unitNumber}: Fixed exercise placeholders`);
    }
    
    console.log('\n✅ All exercise placeholders fixed!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

fixExercisePlaceholders();

