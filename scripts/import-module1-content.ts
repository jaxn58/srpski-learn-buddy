import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
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

type TranslationEntry = {
  language: string;
  translation: string;
  alt?: string;
};

interface ParsedVocabularyItem {
  serbian: string;
  translations: TranslationEntry[];
}

type SectionContent = {
  overview?: string;
  vocabulary?: string;
  grammar?: string;
  phrases?: string;
  dialogues?: string;
  testIntroduction?: string;
  vocabularyItems?: ParsedVocabularyItem[];
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

function parseVocabularyTables(sectionHtml: string, unitNumber: number): ParsedVocabularyItem[] {
  if (!sectionHtml.trim()) {
    return [];
  }

  const $ = load(`<section>${sectionHtml}</section>`);
  const itemsMap = new Map<string, ParsedVocabularyItem>();

  $("table").each((_, tableEl) => {
    const table = $(tableEl);
    const headers = getTableHeaders($, table);
    if (!headers.length) {
      return;
    }

    const englishColumns = findColumns(headers, ["english", "translation", "meaning"]);
    if (!englishColumns.length) {
      return;
    }

    const notesColumns = findColumns(headers, ["note", "notes", "comment"]);
    let serbianColumns = findColumns(headers, [
      "serbian",
      "serbian phrase",
      "phrase",
      "word",
      "masculine",
      "feminine",
      "neuter",
    ]);

    if (!serbianColumns.length) {
      serbianColumns = headers
        .map((_, idx) => idx)
        .filter((idx) => !englishColumns.includes(idx) && !notesColumns.includes(idx))
        .slice(0, 2);
    }

    const rows = getTableRows($, table);
    rows.forEach((row) => {
      const cells = $(row).find("td, th").toArray();
      if (!cells.length) {
        return;
      }

      const cellTexts = headers.map((_, idx) => {
        const cell = cells[idx];
        if (!cell) return "";
        return cleanCellText($(cell).text());
      });

      const englishText = englishColumns
        .map((idx) => cellTexts[idx])
        .find((text) => Boolean(text));
      if (!englishText) {
        return;
      }

      const notesText = notesColumns.map((idx) => cellTexts[idx]).filter(Boolean).join(" ");
      const altFromNotes = extractAltFromNotes(notesText);

      serbianColumns.forEach((colIdx) => {
        const value = cellTexts[colIdx];
        if (!value) {
          return;
        }

        const variants = splitSerbianVariants(value);
        if (!variants.length) {
          return;
        }

        for (const variant of variants) {
          const normalized = variant.trim();
          if (!normalized) continue;

          const entryKey = normalized.toLowerCase();
          const translationEntry: TranslationEntry = {
            language: "en",
            translation: englishText,
            ...(altFromNotes ? { alt: altFromNotes } : {}),
          };

          const existing = itemsMap.get(entryKey);
          if (existing) {
            const alreadyHasTranslation = existing.translations.some(
              (t) => t.translation === translationEntry.translation && t.alt === translationEntry.alt
            );
            if (!alreadyHasTranslation) {
              existing.translations.push(translationEntry);
            }
          } else {
            itemsMap.set(entryKey, {
              serbian: normalized,
              translations: [translationEntry],
            });
          }
        }
      });
    });
  });

  if (!itemsMap.size && sectionHtml.trim()) {
    console.warn(`  ⚠️  No vocabulary tables parsed for unit ${unitNumber}`);
  }

  return Array.from(itemsMap.values());
}

function getTableHeaders($root: cheerio.CheerioAPI, table: cheerio.Cheerio): string[] {
  let headerCells = table.find("thead tr").first().find("th");
  if (!headerCells.length) {
    const firstRow = table.find("tr").first();
    headerCells = firstRow.find("th");
    if (!headerCells.length) {
      headerCells = firstRow.find("td");
    }
  }

  const headers: string[] = [];
  headerCells.each((_, cell) => {
    const text = $root(cell).text();
    headers.push(normalizeHeaderName(cleanCellText(text)));
  });
  return headers;
}

function getTableRows($root: cheerio.CheerioAPI, table: cheerio.Cheerio): cheerio.Element[] {
  const bodyRows = table.find("tbody tr").toArray().filter((row) => $root(row).find("td").length);
  if (bodyRows.length) {
    return bodyRows;
  }

  const allRows = table.find("tr").toArray();
  if (allRows.length <= 1) {
    return [];
  }
  return allRows.slice(1);
}

function normalizeHeaderName(text: string): string {
  return text.toLowerCase().replace(/\u00a0/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function findColumns(headers: string[], keywords: string[]): number[] {
  return headers
    .map((header, idx) => (keywords.some((keyword) => header.includes(keyword)) ? idx : -1))
    .filter((idx) => idx >= 0);
}

function cleanCellText(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function splitSerbianVariants(value: string): string[] {
  return value
    .split("/")
    .map((part) => part.replace(/\*/g, "").trim())
    .filter(Boolean);
}

function extractAltFromNotes(notes: string): string | undefined {
  if (!notes) {
    return undefined;
  }

  const montenegroMatch = notes.match(/montenegro[^:]*:\s*"?([A-Za-zćčšđžĆČŠĐŽ\s]+)"?/i);
  if (montenegroMatch) {
    return cleanCellText(montenegroMatch[1]);
  }

  const ijekavianMatch = notes.match(/ijekavian[^:]*:\s*"?([A-Za-zćčšđžĆČŠĐŽ\s]+)"?/i);
  if (ijekavianMatch) {
    return cleanCellText(ijekavianMatch[1]);
  }

  return undefined;
}

function parseUnitContent(filePath: string, unitNumber: number): SectionContent {
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
    vocabularyItems: parseVocabularyTables(vocabularyHtml, unitNumber),
  };
}

async function importContent() {
  console.log("🚀 Importing Module 1 content...");
  console.log(`   Convex URL: ${CONVEX_URL}`);
  console.log(`   Content Dir: ${CONTENT_DIR}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);
  const moduleRefCache = new Map<string, string>();

  const getModuleRef = async (moduleSlug: string, language: "en" | "de" = "en") => {
    const key = `${moduleSlug}:${language}`;
    if (moduleRefCache.has(key)) {
      return moduleRefCache.get(key)!;
    }

    const moduleRef = await client.query(api.modules.getModuleRefBySlug, {
      moduleSlug,
      language,
    });

    if (!moduleRef) {
      throw new Error(`❌ Module reference not found for slug "${moduleSlug}" (${language})`);
    }

    moduleRefCache.set(key, moduleRef);
    return moduleRef;
  };
  const indexMetadata = parseIndexMetadata();

  for (const unit of UNITS) {
    console.log(`${"=".repeat(80)}\nProcessing Unit ${unit.number} (${unit.slug})\n${"=".repeat(80)}`);

    const unitFile = path.join(CONTENT_DIR, unit.file);
    if (!fs.existsSync(unitFile)) {
      console.warn(`⚠️  Unit file not found: ${unitFile}`);
      continue;
    }

    const sections = parseUnitContent(unitFile, unit.number);
    const metadata = indexMetadata[unit.number];

    if (!metadata) {
      console.warn(`⚠️  No metadata found in index for unit ${unit.number}`);
      continue;
    }

    try {
      console.log("  📝 Updating unit metadata...");
      const foundationModuleRef = await getModuleRef("foundation", "en");

      await client.mutation(api.units.insertUnitMetadata, {
        unitNumber: unit.number,
        language: "en",
        title: metadata.title,
        topics: [metadata.description],
        grammarFocus: metadata.grammarFocus,
        vocabularyThemes: metadata.vocabularyThemes,
        moduleRef: foundationModuleRef,
      });
      console.log("  ✅ Metadata updated");
    } catch (error: any) {
      console.error(`  ❌ Failed to update metadata: ${error.message}`);
    }

    // Insert unit content sections
    const { vocabularyItems, ...markdownSections } = sections;

    if (unit.number <= 5) {
      if (vocabularyItems && vocabularyItems.length > 0) {
        console.log(`  📚 Upserting ${vocabularyItems.length} vocabulary items...`);
        for (const vocab of vocabularyItems) {
          try {
            await client.mutation(api.vocabulary.upsertCourseVocabulary, {
              unitNumber: unit.number,
              serbian: vocab.serbian,
              translations: vocab.translations,
            });
          } catch (error: any) {
            console.error(`  ❌ Failed to upsert vocab "${vocab.serbian}": ${error.message}`);
          }
        }
        console.log("  ✅ Vocabulary upsert complete");
      } else {
        console.warn("  ⚠️  No vocabulary items parsed for this unit");
      }
    }

    const entries = Object.entries(markdownSections) as Array<[keyof SectionContent, string | undefined]>;
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
