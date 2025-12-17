import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { load, CheerioAPI, Cheerio } from "cheerio";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

interface UnitConfig {
  number: number;
  slug: string;
  file: string;
}

const UNITS: UnitConfig[] = [
  { number: 1, slug: "first-words", file: "20251214-v1-unit-1-first-words.html" },
  { number: 2, slug: "who-are-you", file: "20251214-v1-unit-2-who-are-you.html" },
  { number: 3, slug: "at-the-konoba", file: "20251214-v1-unit-3-at-the-konoba.html" },
  { number: 4, slug: "at-the-bank", file: "20251214-v1-unit-4-at-the-bank.html" },
  { number: 5, slug: "finding-a-place-to-stay", file: "20251214-v1-unit-5-finding-a-place-to-stay.html" },
  { number: 6, slug: "my-town-or-village", file: "20251214-v1-unit-6-my-town-or-village.html" },
];

const CONTENT_DIR = path.join(process.cwd(), "New Content", "learn-with.me-main", "website");

interface CategoryMapping {
  pattern: RegExp;
  key: "translation" | "fillInBlank" | "multipleChoice" | "dialogueCompletion";
  questionType: "translation" | "fillInBlank" | "multipleChoice";
}

const CATEGORY_MAP: CategoryMapping[] = [
  { pattern: /translation/i, key: "translation", questionType: "translation" },
  { pattern: /fill[-\s]?in/i, key: "fillInBlank", questionType: "fillInBlank" },
  { pattern: /multiple choice/i, key: "multipleChoice", questionType: "multipleChoice" },
  { pattern: /dialogue/i, key: "dialogueCompletion", questionType: "multipleChoice" },
];

interface ParsedQuestion {
  questionId: string;
  unitNumber: number;
  language: string;
  category: string;
  categoryInstructions?: string;
  questionType: string;
  question: string;
  correctAnswer: string;
  acceptableAlternatives?: string[];
  options?: string[];
  order: number;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\xa0/g, " ")
    .trim();
}

function splitAlternatives(answer: string): { answer: string; alternatives?: string[] } {
  const parts = answer
    .split(/|\||\//)
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (parts.length <= 1) {
    return { answer: cleanText(answer) };
  }

  const [primary, ...rest] = parts;
  const uniqueRest = Array.from(new Set(rest.filter((alt) => alt !== primary)));
  return { answer: primary, alternatives: uniqueRest.length ? uniqueRest : undefined };
}

function detectCategory(title: string) {
  for (const mapping of CATEGORY_MAP) {
    if (mapping.pattern.test(title)) {
      return mapping;
    }
  }
  return { pattern: /.*/, key: "translation" as const, questionType: "translation" as const };
}

function extractInstructions($: CheerioAPI, heading: Cheerio<Element>): string | undefined {
  // Instructions are usually in the next <p> element
  const nextParagraph = heading.nextAll("p").first();
  if (nextParagraph.length === 0) return undefined;
  const text = cleanText(nextParagraph.text());
  return text ? text : undefined;
}

function parseOptions(optionsText: string): Array<{ label: string; text: string }> {
  const regex = /(\b[ABCDEF])\)\s*([^ABCDEF]+)/gi;
  const matches: Array<{ label: string; text: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(optionsText))) {
    matches.push({ label: match[1], text: cleanText(match[2]) });
  }

  if (matches.length === 0) {
    // Fallback: split by double spaces
    return optionsText
      .split(/\s{2,}/)
      .map((part, idx) => ({ label: String.fromCharCode(65 + idx), text: cleanText(part) }))
      .filter((opt) => opt.text.length > 0);
  }

  return matches;
}

function parseMultipleChoiceRow(
  questionText: string,
  optionsText: string,
  answerText: string
): { question: string; options: string[]; correctAnswer: string } {
  const options = parseOptions(optionsText);
  const answerMatch = answerText.match(/([A-F])\)/i);
  let correctAnswer: string;

  if (answerMatch) {
    const matchLabel = answerMatch[1].toUpperCase();
    const option = options.find((opt) => opt.label === matchLabel);
    correctAnswer = option ? option.text : cleanText(answerText.replace(/^[A-F]\)\s*/, ""));
  } else {
    correctAnswer = cleanText(answerText);
  }

  return {
    question: cleanText(questionText),
    options: options.map((opt) => opt.text),
    correctAnswer,
  };
}

function parseExerciseQuestions($: CheerioAPI, heading: Cheerio<Element>, unitNumber: number): ParsedQuestion[] {
  const title = cleanText(heading.text());
  const mapping = detectCategory(title);
  const instructions = extractInstructions($, heading);
  const table = heading.nextAll("table").first();

  if (table.length === 0) {
    console.warn(`  ⚠️  No table found for ${title}`);
    return [];
  }

  const questions: ParsedQuestion[] = [];

  table.find("tbody tr").each((rowIndex, row) => {
    const cells = $(row).find("td");
    if (cells.length === 0) return;

    try {
      let questionText = "";
      let correctAnswer = "";
      let acceptableAlternatives: string[] | undefined;
      let options: string[] | undefined;

      if (mapping.key === "translation") {
        if (cells.length < 2) return;
        questionText = cleanText(cells.eq(0).text());
        const { answer, alternatives } = splitAlternatives(cleanText(cells.eq(1).text()));
        correctAnswer = answer;
        acceptableAlternatives = alternatives;
      } else if (mapping.key === "fillInBlank") {
        if (cells.length < 2) return;
        questionText = cleanText(cells.eq(0).text());
        const { answer, alternatives } = splitAlternatives(cleanText(cells.eq(1).text()));
        correctAnswer = answer;
        acceptableAlternatives = alternatives;
      } else {
        if (cells.length < 3) return;
        const parsed = parseMultipleChoiceRow(
          cells.eq(0).text(),
          cells.eq(1).text(),
          cells.eq(2).text()
        );
        questionText = parsed.question;
        correctAnswer = parsed.correctAnswer;
        options = parsed.options;
      }

      if (!questionText || !correctAnswer) return;

      const order = questions.length + 1;
      const questionId = `u${unitNumber}_${mapping.key}_q${order}`;

      questions.push({
        questionId,
        unitNumber,
        language: "en",
        category: mapping.key,
        categoryInstructions: instructions,
        questionType: mapping.questionType,
        question: questionText,
        correctAnswer,
        acceptableAlternatives,
        options,
        order,
      });
    } catch (error) {
      console.error(`  ❌ Failed to parse row ${rowIndex + 1} in ${title}:`, error);
    }
  });

  return questions;
}

async function saveQuestions(client: ConvexHttpClient<typeof api>, questions: ParsedQuestion[]) {
  for (const question of questions) {
    await client.mutation(api.units.insertUnitInteractiveTest, {
      unitNumber: question.unitNumber,
      language: question.language,
      category: question.category,
      categoryInstructions: question.categoryInstructions,
      questionId: question.questionId,
      questionType: question.questionType,
      question: question.question,
      correctAnswer: question.correctAnswer,
      acceptableAlternatives: question.acceptableAlternatives,
      options: question.options,
      order: question.order,
    });
  }
}

async function importExercises({ dryRun = false } = {}) {
  console.log("🚀 Importing exercises for Module 1...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Content Dir: ${CONTENT_DIR}`);
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  for (const unit of UNITS) {
    console.log(`${"=".repeat(80)}\nProcessing Unit ${unit.number} (${unit.slug})\n${"=".repeat(80)}`);

    const unitFile = path.join(CONTENT_DIR, unit.file);
    if (!fs.existsSync(unitFile)) {
      console.warn(`  ⚠️  Unit file not found: ${unitFile}`);
      continue;
    }

    const html = fs.readFileSync(unitFile, "utf-8");
    const $ = load(html);

    const interactiveHeading = $("h2")
      .filter((_, el) => cleanText($(el).text()).toLowerCase().startsWith("5. interactive test"))
      .first();

    if (interactiveHeading.length === 0) {
      console.warn("  ⚠️  No interactive test section found.");
      continue;
    }

    const questions: ParsedQuestion[] = [];

    interactiveHeading.nextAll("h3").each((_, elem) => {
      const heading = $(elem);
      const title = cleanText(heading.text());
      if (!title.toLowerCase().startsWith("exercise")) {
        return;
      }

      const parsed = parseExerciseQuestions($, heading, unit.number);
      if (parsed.length === 0) {
        console.warn(`  ⚠️  No questions parsed for ${title}`);
      }
      questions.push(...parsed);
    });

    console.log(`  📋 Parsed ${questions.length} questions.`);

    if (questions.length === 0) {
      continue;
    }

    if (dryRun) {
      questions.forEach((q) => {
        console.log(`  - ${q.questionId}: ${q.question} -> ${q.correctAnswer}`);
      });
      continue;
    }

    try {
      await saveQuestions(client, questions);
      console.log("  ✅ Questions saved to Convex");
    } catch (error) {
      console.error("  ❌ Failed to save questions:", error);
    }
  }

  console.log("\n✅ Exercise import completed.");
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || args.includes("-d");

importExercises({ dryRun }).catch((error) => {
  console.error("❌ Exercise import failed:", error);
  process.exit(1);
});




