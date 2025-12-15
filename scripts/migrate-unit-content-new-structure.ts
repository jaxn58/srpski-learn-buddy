import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

const CONTENT_DIR = path.join(process.cwd(), "New Content", "learn-with.me-main");

async function migrateUnitContent() {
  console.log("🚀 Migrating Unit Content (New Structure) to Convex...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Content Dir: ${CONTENT_DIR}`);

  const client = new ConvexHttpClient(CONVEX_URL);
  
  // Find markdown files
  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.startsWith("Unit-") && f.endsWith(".md"));
  console.log(`   Found ${files.length} unit files:`, files);

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    
    console.log(`\nProcessing ${file}...`);
    
    // 1. Extract Metadata (Module & Unit)
    const moduleMatch = content.match(/# Module (\d+): (.*)/);
    const unitMatch = content.match(/## Unit (\d+): (.*)/);
    
    if (moduleMatch && unitMatch) {
      const moduleNum = parseInt(moduleMatch[1]);
      const moduleName = moduleMatch[2].trim();
      const unitNum = parseInt(unitMatch[1]);
      const unitTitle = unitMatch[2].trim();
      
      console.log(`   Module ${moduleNum}: ${moduleName}`);
      console.log(`   Unit ${unitNum}: ${unitTitle}`);
      
      // Update Module Metadata
      // Assuming moduleId structure like "module-1" for simplicity now, or mapping to existing IDs
      // For now, let's update the existing modules if they match number, or fallback to generic ID
      const moduleId = `module-${moduleNum}`; // Simplification
      
      try {
        await client.mutation(api.modules.insertModuleMetadata, {
          moduleId: moduleId,
          language: "en",
          title: moduleName,
          description: `Module ${moduleNum}: ${moduleName}`, // Description might be elsewhere
        });
        process.stdout.write("   ✅ Module Meta ");
      } catch (e: any) {
        console.error(`❌ Module Meta Error: ${e.message}`);
      }

      // Update Unit Metadata
      try {
        await client.mutation(api.units.insertUnitMetadata, {
          unitNumber: unitNum,
          language: "en",
          title: unitTitle,
          topics: [], // We'd need to extract topics from overview potentially
          grammarFocus: [],
          vocabularyThemes: [],
        });
        process.stdout.write("✅ Unit Meta ");
      } catch (e: any) {
        console.error(`❌ Unit Meta Error: ${e.message}`);
      }
      
      // 2. Extract Content Sections
      const sections = extractSections(content);
      
      // Upload Sections
      for (const [key, text] of Object.entries(sections)) {
        if (key === "interactiveTest") continue; // Handle separately
        if (key === "vocabulary") continue; // Skip, use DB
        
        try {
          await client.mutation(api.units.insertUnitContent, {
            unitNumber: unitNum,
            language: "en",
            contentType: key,
            content: text,
          });
          process.stdout.write(`✅ ${key} `);
        } catch (e: any) {
          console.error(`❌ ${key} Error: ${e.message}`);
        }
      }
      
      // 3. Process Interactive Test
      if (sections.interactiveTest) {
        const questions = parseInteractiveTest(sections.interactiveTest, unitNum);
        console.log(`\n   Found ${questions.length} test questions`);
        
        for (const q of questions) {
          try {
            await client.mutation(api.units.insertUnitInteractiveTest, {
              unitNumber: unitNum,
              language: "en",
              category: q.category,
              questionId: q.questionId,
              questionType: q.questionType,
              question: q.question,
              correctAnswer: q.correctAnswer,
              acceptableAlternatives: q.acceptableAlternatives,
              options: q.options,
              hint: q.hint,
              order: q.order,
            });
          } catch (e: any) {
            console.error(`   ❌ Test Q Error (${q.questionId}): ${e.message}`);
          }
        }
        process.stdout.write("✅ Test Questions\n");
      }
    }
  }
}

function extractSections(content: string) {
  const sections: Record<string, string> = {};
  
  // Regex to match sections headers
  const overviewRegex = /## 1\. Overview([\s\S]*?)## 2\./;
  const vocabRegex = /## 2\. Vocabulary([\s\S]*?)## 3\./;
  const grammarRegex = /## 3\. Grammar([\s\S]*?)## 4\./;
  const phrasesRegex = /## 4\. Phrases([\s\S]*?)## 5\./;
  const dialoguesRegex = /## 5\. Dialogues([\s\S]*?)## 6\./;
  const testRegex = /## 6\. Interactive Test([\s\S]*?)(## Summary|## Answer Key|$)/;
  const summaryRegex = /## Summary([\s\S]*?)$/; // Summary usually at end
  
  const overviewMatch = content.match(overviewRegex);
  const vocabMatch = content.match(vocabRegex);
  const grammarMatch = content.match(grammarRegex);
  const phrasesMatch = content.match(phrasesRegex);
  const dialoguesMatch = content.match(dialoguesRegex);
  const testMatch = content.match(testRegex);
  const summaryMatch = content.match(summaryRegex);
  
  if (overviewMatch) sections.overview = overviewMatch[1].trim();
  if (vocabMatch) sections.vocabulary = vocabMatch[1].trim();
  if (grammarMatch) sections.grammar = grammarMatch[1].trim();
  if (phrasesMatch) sections.phrases = phrasesMatch[1].trim();
  if (dialoguesMatch) sections.dialogues = dialoguesMatch[1].trim();
  if (testMatch) sections.interactiveTest = testMatch[1].trim();
  
  // Append Summary to Overview if found
  if (summaryMatch) {
    const summary = summaryMatch[1].trim();
    if (sections.overview) {
      sections.overview += `\n\n---\n\n## Summary\n\n${summary}`;
    } else {
      sections.overview = `## Summary\n\n${summary}`;
    }
  }
  
  return sections;
}

function parseInteractiveTest(content: string, unitNum: number) {
  const questions: any[] = [];
  
  // Split by categories
  const categoryRegex = /### Category (\d+): (.*?)\n([\s\S]*?)(?=### Category|$)/g;
  let match;
  
  while ((match = categoryRegex.exec(content)) !== null) {
    const catNum = parseInt(match[1]);
    const catName = match[2].trim();
    const catContent = match[3].trim();
    
    // Parse questions based on category
    const lines = catContent.split('\n');
    let currentQ: any = null;
    
    // Determine category key
    let categoryKey = "unknown";
    let questionType = "text";
    
    if (catName.includes("Translation")) { categoryKey = "translation"; questionType = "translation"; }
    else if (catName.includes("Fill in")) { categoryKey = "fillInBlank"; questionType = "fillInBlank"; }
    else if (catName.includes("Multiple Choice")) { categoryKey = "multipleChoice"; questionType = "multipleChoice"; }
    else if (catName.includes("Vocabulary Matching")) { categoryKey = "vocabularyMatching"; questionType = "matching"; }
    else if (catName.includes("Dialogue Completion")) { categoryKey = "dialogueCompletion"; questionType = "dialogue"; }
    
    // Simple parsing - looking for numbered lines "1. ..."
    let qIndex = 0;
    
    for (const line of lines) {
      const qMatch = line.match(/^(\d+)\.\s+(.*)/);
      
      if (qMatch) {
        // Save previous question if exists
        if (currentQ) questions.push(currentQ);
        
        const qNum = parseInt(qMatch[1]);
        const qText = qMatch[2].trim();
        qIndex++;
        
        currentQ = {
          unitNumber: unitNum,
          language: "en",
          category: categoryKey,
          questionId: `u${unitNum}_${categoryKey}_q${qNum}`, // Stable ID
          questionType: questionType,
          question: qText,
          correctAnswer: "TODO", // Answers are in separate section usually, or need manual mapping
          order: qIndex,
          options: [],
        };
      } else if (currentQ && categoryKey === "multipleChoice") {
        // Parse options like "- a) ..."
        const optMatch = line.match(/-\s+[a-z]\)\s+(.*)/);
        if (optMatch) {
          currentQ.options.push(optMatch[1].trim());
        }
      }
    }
    // Push last question
    if (currentQ) questions.push(currentQ);
  }
  
  // Note: Correct answers are in "## Answer Key". Parsing that accurately is complex.
  // For now, we set a placeholder or try to extract if possible. 
  // In a real scenario, we might want to manually review or improve parser.
  // Or: Use AI to extract Q&A pairs structure! 
  
  return questions;
}

migrateUnitContent().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
