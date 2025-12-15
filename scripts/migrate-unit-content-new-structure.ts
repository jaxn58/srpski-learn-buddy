import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { COURSE_MODULES } from "../shared/data/course/modules";

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
      // Find the correct moduleId from COURSE_MODULES based on module number
      const moduleData = COURSE_MODULES.find(m => m.number === moduleNum);
      
      if (!moduleData) {
        console.error(`   ⚠️  WARNING: Module ${moduleNum} not found in COURSE_MODULES!`);
        console.error(`   ⚠️  Skipping module metadata update to avoid creating legacy entries.`);
      } else {
        const moduleId = moduleData.id;
        console.log(`   Using moduleId: ${moduleId}`);
        
        try {
          await client.mutation(api.modules.insertModuleMetadata, {
            moduleId: moduleId,
            language: "en",
            title: moduleName,
            description: moduleData.description, // Use description from COURSE_MODULES
          });
          process.stdout.write("   ✅ Module Meta ");
        } catch (e: any) {
          console.error(`❌ Module Meta Error: ${e.message}`);
        }
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
        
        // Handle Vocabulary specifically: Parse and upload to Master Data
        if (key === "vocabulary") {
          const vocabItems = parseVocabulary(text, unitNum);
          console.log(`   Found ${vocabItems.length} vocabulary items`);
          
          for (const item of vocabItems) {
            try {
              await client.mutation(api.vocabulary.upsertCourseVocabulary, {
                unitNumber: unitNum,
                serbian: item.serbian,
                translations: item.translations,
                gender: item.gender,
                pronunciation: item.pronunciation,
              });
            } catch (e: any) {
              console.error(`   ❌ Vocab Error (${item.serbian}): ${e.message}`);
            }
          }
          process.stdout.write("✅ Vocabulary ");
          continue; // Don't upload as raw markdown content if we use DB
        }
        
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
        // Extract and save the general test introduction
        const testIntroMatch = content.match(/## 6\. Interactive Test[^\n]*\n\n(.*?)(?=\n### Category|$)/s);
        if (testIntroMatch) {
          const testIntro = testIntroMatch[1].trim();
          try {
            await client.mutation(api.units.insertUnitContent, {
              unitNumber: unitNum,
              language: "en",
              contentType: "testIntroduction",
              content: testIntro,
            });
            process.stdout.write("✅ Test Intro ");
          } catch (e: any) {
            console.error(`❌ Test Intro Error: ${e.message}`);
          }
        }
        
        // Pass the full content so we can parse Answer Key
        const questions = parseInteractiveTest(content, unitNum);
        console.log(`\n   Found ${questions.length} test questions`);
        
        for (const q of questions) {
          try {
            await client.mutation(api.units.insertUnitInteractiveTest, {
              unitNumber: unitNum,
              language: "en",
              category: q.category,
              categoryInstructions: q.categoryInstructions,
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

function parseAnswerKey(content: string): Map<number, { answer: string, alternatives: string[] }> {
  const answerMap = new Map();
  
  // Find Answer Key section (with optional German title in parentheses)
  // Look for "## Answer Key" and capture everything until "## Summary" or end of file
  const answerKeyMatch = content.match(/## Answer Key[^\n]*\n([\s\S]*?)(?=\n## Summary|$)/);
  if (!answerKeyMatch) {
    return answerMap;
  }
  
  const answerKeyContent = answerKeyMatch[1];
  const lines = answerKeyContent.split('\n');
  
  for (const line of lines) {
    // Match patterns like "1. Dobar dan." or "21. a) Text" or "31. granica → border"
    const answerMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (answerMatch) {
      const qNum = parseInt(answerMatch[1]);
      let answerText = answerMatch[2].trim();
      
      // Handle multiple choice answers (extract the option text)
      const mcMatch = answerText.match(/^[a-d]\)\s+(.+)/);
      if (mcMatch) {
        answerText = mcMatch[1].trim();
      }
      
      // Handle vocabulary matching (extract the translation)
      const matchingMatch = answerText.match(/\w+\s+→\s+(.+)/);
      if (matchingMatch) {
        answerText = matchingMatch[1].trim();
      }
      
      // Handle alternatives separated by "/"
      const parts = answerText.split('/').map(p => p.trim());
      const mainAnswer = parts[0];
      const alternatives = parts.slice(1);
      
      // Remove asterisks (Montenegrin markers)
      const cleanAnswer = mainAnswer.replace(/\*/g, '').trim();
      const cleanAlternatives = alternatives.map(a => a.replace(/\*/g, '').trim());
      
      answerMap.set(qNum, {
        answer: cleanAnswer,
        alternatives: cleanAlternatives
      });
    }
  }
  
  return answerMap;
}

function parseInteractiveTest(content: string, unitNum: number) {
  const questions: any[] = [];
  
  // 1. Parse Answer Key first
  const answerMap = parseAnswerKey(content);
  console.log(`   Parsed ${answerMap.size} answers from Answer Key`);
  
  // Extract only the test section (from "## 6. Interactive Test" to "## Answer Key")
  const testSectionMatch = content.match(/## 6\. Interactive Test([\s\S]*?)(?=## Answer Key)/);
  if (!testSectionMatch) {
    console.log('   ⚠️  No Interactive Test section found');
    return questions;
  }
  
  const testContent = testSectionMatch[1];
  
  // Split by categories
  const categoryRegex = /### Category (\d+): (.*?)\n([\s\S]*?)(?=### Category|$)/g;
  let match;
  
  while ((match = categoryRegex.exec(testContent)) !== null) {
    const catNum = parseInt(match[1]);
    const catName = match[2].trim();
    const catContent = match[3].trim();
    
    // Determine category key
    let categoryKey = "unknown";
    let questionType = "text";
    
    if (catName.includes("Translation")) { categoryKey = "translation"; questionType = "translation"; }
    else if (catName.includes("Fill in")) { categoryKey = "fillInBlank"; questionType = "fillInBlank"; }
    else if (catName.includes("Multiple Choice")) { categoryKey = "multipleChoice"; questionType = "multipleChoice"; }
    else if (catName.includes("Vocabulary Matching")) { categoryKey = "vocabularyMatching"; questionType = "matching"; }
    else if (catName.includes("Dialogue Completion")) { categoryKey = "dialogueCompletion"; questionType = "dialogue"; }
    
    // Extract Instructions (everything between "**Instructions:**" and the first numbered question or dialogue marker)
    let categoryInstructions = "";
    const instructionsMatch = catContent.match(/\*\*Instructions:\*\*\s*(.+?)(?=\n\d+\.|\n\*\*Dialogue)/s);
    if (instructionsMatch) {
      categoryInstructions = instructionsMatch[1].trim();
    }
    
    // Parse questions based on category type
    const lines = catContent.split('\n');
    let currentQ: any = null;
    let qIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qMatch = line.match(/^(\d+)\.\s+(.*)/);
      
      if (qMatch) {
        // Save previous question if exists
        if (currentQ) questions.push(currentQ);
        
        const qNum = parseInt(qMatch[1]);
        let qText = qMatch[2].trim();
        qIndex++;
        
        // For dialogue completion, combine multi-line questions
        if (categoryKey === "dialogueCompletion") {
          // Check if next lines continue the dialogue context
          let j = i + 1;
          while (j < lines.length && !lines[j].match(/^\d+\./) && lines[j].trim() && !lines[j].includes("**Dialogue")) {
            qText += " " + lines[j].trim();
            j++;
          }
        }
        
        // Get answer from answerMap
        const answerData = answerMap.get(qNum);
        const correctAnswer = answerData?.answer || "";
        const acceptableAlternatives = answerData?.alternatives || [];
        
        currentQ = {
          unitNumber: unitNum,
          language: "en",
          category: categoryKey,
          categoryInstructions: categoryInstructions,
          questionId: `u${unitNum}_${categoryKey}_q${qNum}`,
          questionType: questionType,
          question: qText,
          correctAnswer: correctAnswer,
          acceptableAlternatives: acceptableAlternatives.length > 0 ? acceptableAlternatives : undefined,
          order: qNum, // Use original question number for order
          options: [],
        };
      } else if (currentQ && categoryKey === "multipleChoice") {
        // Parse options like "   - a) ..." or "    - a) ..."
        const optMatch = line.match(/^\s*-\s+[a-z]\)\s+(.*)/);
        if (optMatch) {
          currentQ.options.push(optMatch[1].trim());
        }
      } else if (currentQ && categoryKey === "vocabularyMatching" && line.includes("**Options:**")) {
        // For vocabulary matching, parse the options line
        // Example: "**Options:** border, hotel, passport, ..."
        const optionsMatch = line.match(/\*\*Options:\*\*\s*(.+)/);
        if (optionsMatch) {
          const optionsText = optionsMatch[1];
          currentQ.options = optionsText.split(',').map(o => o.trim());
        }
      }
    }
    
    // Push last question
    if (currentQ) questions.push(currentQ);
  }
  
  return questions;
}

function parseVocabulary(content: string, unitNum: number) {
  const items: any[] = [];
  const lines = content.split('\n');
  
  // Parse arrow format: "serbian → English"
  for (const line of lines) {
    const arrowMatch = line.match(/^\s*(.+?)\s*→\s*(.+?)\s*$/);
    if (arrowMatch) {
      const serbian = arrowMatch[1].trim();
      const english = arrowMatch[2].trim();
      
      if (serbian && english) {
        // Remove asterisks (Montenegrin markers) from serbian word
        const cleanSerbian = serbian.replace(/\*/g, '').trim();
        
        items.push({
          unitNumber: unitNum,
          serbian: cleanSerbian,
          translations: [{ language: "en", translation: english }],
          gender: undefined,
          pronunciation: undefined,
        });
      }
    }
  }
  
  return items;
}

migrateUnitContent().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
