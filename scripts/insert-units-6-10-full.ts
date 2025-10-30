import { getDb } from '../server/db';
import { unitExplanations } from '../drizzle/schema';
import { nanoid } from 'nanoid';

// Import content from SQL files (we'll read them directly)
import * as fs from 'fs';
import * as path from 'path';

async function insertUnits6to10() {
  console.log('Inserting Units 6-10 into database...');
  
  const db = await getDb();
  if (!db) {
    console.error('Database not available!');
    process.exit(1);
  }
  
  // Read content from SQL files
  const unit6Content = fs.readFileSync(path.join(__dirname, 'unit6-content.sql'), 'utf-8');
  const units710Content = fs.readFileSync(path.join(__dirname, 'units-7-10-content.sql'), 'utf-8');
  
  // Parse Unit 6 content
  const unit6OverviewMatch = unit6Content.match(/SET @unit6_overview = '([\s\S]*?)';/);
  const unit6GrammarMatch = unit6Content.match(/SET @unit6_grammar = '([\s\S]*?)';/);
  const unit6PracticeMatch = unit6Content.match(/SET @unit6_practice = '([\s\S]*?)';/);
  
  if (!unit6OverviewMatch || !unit6GrammarMatch || !unit6PracticeMatch) {
    console.error('Failed to parse Unit 6 content!');
    process.exit(1);
  }
  
  const UNIT_6_OVERVIEW = unit6OverviewMatch[1].replace(/\\'/g, "'");
  const UNIT_6_GRAMMAR = unit6GrammarMatch[1].replace(/\\'/g, "'");
  const UNIT_6_PRACTICE = unit6PracticeMatch[1].replace(/\\'/g, "'");
  
  // Parse Units 7-10 content
  const unit7OverviewMatch = units710Content.match(/SET @unit7_overview = '([\s\S]*?)';/);
  const unit7GrammarMatch = units710Content.match(/SET @unit7_grammar = '([\s\S]*?)';/);
  const unit7PracticeMatch = units710Content.match(/SET @unit7_practice = '([\s\S]*?)';/);
  
  const unit8OverviewMatch = units710Content.match(/SET @unit8_overview = '([\s\S]*?)';/);
  const unit8GrammarMatch = units710Content.match(/SET @unit8_grammar = '([\s\S]*?)';/);
  const unit8PracticeMatch = units710Content.match(/SET @unit8_practice = '([\s\S]*?)';/);
  
  const unit9OverviewMatch = units710Content.match(/SET @unit9_overview = '([\s\S]*?)';/);
  const unit9GrammarMatch = units710Content.match(/SET @unit9_grammar = '([\s\S]*?)';/);
  const unit9PracticeMatch = units710Content.match(/SET @unit9_practice = '([\s\S]*?)';/);
  
  const unit10OverviewMatch = units710Content.match(/SET @unit10_overview = '([\s\S]*?)';/);
  const unit10GrammarMatch = units710Content.match(/SET @unit10_grammar = '([\s\S]*?)';/);
  const unit10PracticeMatch = units710Content.match(/SET @unit10_practice = '([\s\S]*?)';/);
  
  if (!unit7OverviewMatch || !unit7GrammarMatch || !unit7PracticeMatch ||
      !unit8OverviewMatch || !unit8GrammarMatch || !unit8PracticeMatch ||
      !unit9OverviewMatch || !unit9GrammarMatch || !unit9PracticeMatch ||
      !unit10OverviewMatch || !unit10GrammarMatch || !unit10PracticeMatch) {
    console.error('Failed to parse Units 7-10 content!');
    process.exit(1);
  }
  
  const units = [
    {
      unitNumber: 6,
      overview: UNIT_6_OVERVIEW,
      grammarExplained: UNIT_6_GRAMMAR,
      practiceExamples: UNIT_6_PRACTICE,
      bookReference: 'Unit 6 corresponds to page 33 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 7,
      overview: unit7OverviewMatch[1].replace(/\\'/g, "'"),
      grammarExplained: unit7GrammarMatch[1].replace(/\\'/g, "'"),
      practiceExamples: unit7PracticeMatch[1].replace(/\\'/g, "'"),
      bookReference: 'Unit 7 corresponds to page 40 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 8,
      overview: unit8OverviewMatch[1].replace(/\\'/g, "'"),
      grammarExplained: unit8GrammarMatch[1].replace(/\\'/g, "'"),
      practiceExamples: unit8PracticeMatch[1].replace(/\\'/g, "'"),
      bookReference: 'Unit 8 corresponds to page 47 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 9,
      overview: unit9OverviewMatch[1].replace(/\\'/g, "'"),
      grammarExplained: unit9GrammarMatch[1].replace(/\\'/g, "'"),
      practiceExamples: unit9PracticeMatch[1].replace(/\\'/g, "'"),
      bookReference: 'Unit 9 corresponds to page 52 in "Step by Step Serbian 1" by Vladislava Ribnikar'
    },
    {
      unitNumber: 10,
      overview: unit10OverviewMatch[1].replace(/\\'/g, "'"),
      grammarExplained: unit10GrammarMatch[1].replace(/\\'/g, "'"),
      practiceExamples: unit10PracticeMatch[1].replace(/\\'/g, "'"),
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
    
    console.log('\n✅ All Units 6-10 inserted successfully!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

insertUnits6to10();

