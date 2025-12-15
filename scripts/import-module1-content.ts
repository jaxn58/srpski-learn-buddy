import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { load } from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL not found in environment variables");
  process.exit(1);
}

const CONTENT_DIR = path.join(process.cwd(), "New Content", "learn-with.me-main", "website");
const INDEX_FILE = path.join(CONTENT_DIR, "20251214-v1-index.html");

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

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});
turndownService.use(gfm);

type SectionContent = {
  overview?: string;
  vocabulary?: string;
  grammar?: string;
  phrases?: string;
  dialogues?: string;
  testIntroduction?: string;
};

interface IndexMetadata {
  title: string;
  description: string;
  grammarFocus: string[];
  vocabularyThemes: string[];
}

function parseIndexMetadata(): Record<number, IndexMetadata> {
  const html = fs.readFileSync(INDEX_FILE, "utf-8");
  const $ = load(html);
  const results: Record<number, IndexMetadata> = {};

  $(".unit-card").each((_, card) => {
    const numberText = $(card).find(".unit-number").text();
    const numberMatch = numberText.match(/(\d+)/);
    if (!numberMatch) return;
    const number = parseInt(numberMatch[1], 10);
    const title = $(card).find("h3").text().trim();
    const description = $(card).find("p").first().text().trim();

    const topicsHtml = $(card).find(".topics").html() || "";
    const topics$ = load(`<div>${topicsHtml}</div>`);
    let grammarFocus: string[] = [];
    let vocabularyThemes: string[] = [];

    topics$("div")
      .contents()
      .each((_, node) => {
        if (node.type === "text") return;
        if (node.type === "tag" && node.name === "strong") {
          const label = topics$(node).text().toLowerCase();
          const textNode = node.nextSibling;
          const rawText = textNode && textNode.type === "text" ? textNode.nodeValue || "" : "";
          const values = rawText
            .replace(/<br\s*\/>/gi, "")
            .split(/[,/]/)
            .map((v) => v.trim())
            .filter(Boolean);

          if (label.includes("grammar")) {
            grammarFocus = values;
          } else if (label.includes("vocab")) {
            vocabularyThemes = values;
          }
        }
      });

    results[number] = {
      title,
      description,
      grammarFocus,
      vocabularyThemes,
    };
  });

  return results;
}

function htmlBetweenHeadings($: cheerio.CheerioAPI, headingText: string): string {
  const heading = $("h2")
    .filter((_, el) =>
      $(el)
        .text()
        .trim()
        .toLowerCase()
        .startsWith(headingText.toLowerCase())
    )
    .first();

  if (!heading.length) {
    return "";
  }

  const contents: string[] = [];
  let node = heading.next();
  while (node.length && node[0].tagName !== "h2") {
    contents.push($.html(node));
    node = node.next();
  }
  return contents.join("\n");
}

function splitPhrasesSection(sectionHtml: string): { phrases?: string; dialogues?: string } {
  if (!sectionHtml.trim()) {
    return {};
  }

  const $ = load(`<section>${sectionHtml}</section>`);
  const nodes = $("section").contents().toArray();
  const dialogIndex = nodes.findIndex((node) => {
    if (node.type !== "tag") return false;
    if (node.name !== "h3") return false;
    const text = $(node).text().toLowerCase();
    return text.includes("dialogue");
  });

  if (dialogIndex === -1) {
    return { phrases: sectionHtml, dialogues: "" };
  }

  const phrasesNodes = nodes.slice(0, dialogIndex);
  const dialoguesNodes = nodes.slice(dialogIndex);

  const phrasesHtml = phrasesNodes.map((node) => $.html(node)).join("\n");
  const dialoguesHtml = dialoguesNodes.map((node) => $.html(node)).join("\n");

  return {
    phrases: phrasesHtml,
    dialogues: dialoguesHtml,
  };
}

function toMarkdown(html: string): string {
  const cleaned = html
    .replace(/<p>\s*&nbsp;\s*<\/p>/g, "")
    .trim();
  if (!cleaned) return "";
  return turndownService.turndown(cleaned).trim();
}

function parseUnitContent(filePath: string): SectionContent {
  const html = fs.readFileSync(filePath, "utf-8");
  const $ = load(html);

  const overviewHtml = htmlBetweenHeadings($, "1. Overview");
  const vocabularyHtml = htmlBetweenHeadings($, "2. Vocabulary");
  const grammarHtml = htmlBetweenHeadings($, "3. Grammar");
  const phrasesHtml = htmlBetweenHeadings($, "4. Phrases");
  const testHtml = htmlBetweenHeadings($, "5. Interactive Test");

  const phraseSplit = splitPhrasesSection(phrasesHtml);

  return {
    overview: toMarkdown(overviewHtml),
    vocabulary: toMarkdown(vocabularyHtml),
    grammar: toMarkdown(grammarHtml),
    phrases: toMarkdown(phraseSplit.phrases || ""),
    dialogues: toMarkdown(phraseSplit.dialogues || ""),
    testIntroduction: toMarkdown(testHtml),
  };
}

async function importContent() {
  console.log("🚀 Importing Module 1 content...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Content Dir: ${CONTENT_DIR}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const indexMetadata = parseIndexMetadata();

  for (const unit of UNITS) {
    console.log(`${"=".repeat(80)}\nProcessing Unit ${unit.number} (${unit.slug})\n${"=".repeat(80)}`);

    const unitFile = path.join(CONTENT_DIR, unit.file);
    if (!fs.existsSync(unitFile)) {
      console.warn(`⚠️  Unit file not found: ${unitFile}`);
      continue;
    }

    const sections = parseUnitContent(unitFile);
    const metadata = indexMetadata[unit.number];

    if (!metadata) {
      console.warn(`⚠️  No metadata found in index for unit ${unit.number}`);
      continue;
    }

    try {
      console.log("  📝 Updating unit metadata...");
      await client.mutation(api.units.insertUnitMetadata, {
        unitNumber: unit.number,
        language: "en",
        title: metadata.title,
        topics: [metadata.description],
        grammarFocus: metadata.grammarFocus,
        vocabularyThemes: metadata.vocabularyThemes,
        moduleId: "foundation",
      });
      console.log("  ✅ Metadata updated");
    } catch (error: any) {
      console.error(`  ❌ Failed to update metadata: ${error.message}`);
    }

    // Insert unit content sections
    const entries = Object.entries(sections) as Array<[keyof SectionContent, string | undefined]>;
    for (const [contentType, markdown] of entries) {
      if (!markdown) continue;
      try {
        console.log(`  🗂️  Saving ${contentType}...`);
        await client.mutation(api.units.insertUnitContent, {
          unitNumber: unit.number,
          language: "en",
          contentType: contentType as any,
          content: markdown,
        });
        console.log(`  ✅ ${contentType} saved`);
      } catch (error: any) {
        console.error(`  ❌ Failed to save ${contentType}: ${error.message}`);
      }
    }
  }

  console.log("\n✅ Import finished. Run validation to verify the new content.");
}

importContent().catch((error) => {
  console.error("❌ Import failed:", error);
  process.exit(1);
});
