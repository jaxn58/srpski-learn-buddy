import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { UnitPackageSchema, validateUnitPackageDeep } from "./unitPackage/schema";
import { autofixUnitPackage } from "./unitPackage/autofix";

dotenv.config({ path: ".env.local" });

type Args = {
  dir: string;
  file?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: path.join(process.cwd(), "New Content", "jsons"),
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) {
      args.dir = argv[i + 1];
      i++;
    } else if (a === "--file" && argv[i + 1]) {
      args.file = argv[i + 1];
      i++;
    } else if (a === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

function isJsonFile(p: string) {
  return p.toLowerCase().endsWith(".json");
}

function listJsonFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsonFilesRecursive(full));
    else if (ent.isFile() && isJsonFile(ent.name)) out.push(full);
  }
  return out;
}

async function importOne(client: ConvexHttpClient, pkg: any) {
  const unitNumber: number = pkg.unitNumber;
  const languages: string[] = pkg.languages;

  // 1) Unit metadata (per language)
  for (const lang of languages) {
    await client.mutation(api.units.insertUnitMetadata, {
      unitNumber,
      language: lang,
      title: pkg.title,
      topics: [],
      grammarFocus: [],
      vocabularyThemes: [],
      // moduleId deliberately omitted for now (avoid creating wrong module link)
    });
  }

  // 2) Unit content (per language)
  const contentTypeMap: Array<{ key: keyof typeof pkg.content.en; type: string }> = [
    { key: "overviewMd", type: "overview" },
    { key: "grammarMd", type: "grammar" },
    { key: "phrasesMd", type: "phrases" },
    { key: "dialoguesMd", type: "dialogues" },
    { key: "testIntroductionMd", type: "testIntroduction" },
  ];

  for (const lang of languages) {
    const c = pkg.content[lang];
    for (const m of contentTypeMap) {
      const value = c?.[m.key] ?? "";
      await client.mutation(api.units.insertUnitContent, {
        unitNumber,
        language: lang,
        contentType: m.type,
        content: String(value ?? ""),
      });
    }
  }

  // 3) Vocabulary (courseVocabulary master data)
  // Only import for English for now (baseLanguage), but keep structure ready.
  const vocabEn = pkg.vocabulary.en || [];
  for (const entry of vocabEn) {
    const translations = [
      {
        language: "en",
        translation: entry.en,
        alt: entry.enAlt || undefined,
      },
    ];

    await client.mutation(api.vocabulary.upsertCourseVocabulary, {
      unitNumber,
      serbian: entry.serbian,
      translations,
      gender: entry.gender || undefined,
      pronunciation: undefined,
      noteEn: entry.noteEn || undefined,
      noteDe: undefined,
      noteSr: undefined,
      noteEs: undefined,
      noteFr: undefined,
    });

    // Also fill column-based translations for fast frontend access.
    const existing = await client.query(api.vocabulary.findCourseVocabularyBySerbianAndUnit, {
      unitNumber,
      serbian: entry.serbian,
    });

    if (existing?._id) {
      await client.mutation(api.vocabulary.updateCourseVocabularyColumns, {
        courseVocabularyId: existing._id,
        en: entry.en,
        de: "",
        sr: undefined,
        es: undefined,
        fr: undefined,
        enAlt: entry.enAlt || undefined,
        deAlt: undefined,
        noteEn: entry.noteEn || undefined,
        noteDe: undefined,
        noteSr: undefined,
        noteEs: undefined,
        noteFr: undefined,
      });
    }
  }

  // 4) Exercises (unitInteractiveTests)
  const exercisesEn = pkg.exercises.en || [];
  for (const cat of exercisesEn) {
    for (const q of cat.questions) {
      await client.mutation(api.units.insertUnitInteractiveTest, {
        unitNumber,
        language: "en",
        category: cat.category,
        categoryInstructions: cat.categoryInstructions,
        questionId: q.questionId,
        questionType: q.questionType,
        question: q.question,
        correctAnswer: q.correctAnswer,
        acceptableAlternatives: q.acceptableAlternatives,
        options: q.options,
        hint: q.hint,
        order: q.order,
      });
    }
  }
}

async function main() {
  const CONVEX_URL = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!CONVEX_URL) {
    console.error("CONVEX_URL not found (set VITE_CONVEX_URL in .env.local).");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const targets = args.file
    ? [path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file)]
    : listJsonFilesRecursive(path.isAbsolute(args.dir) ? args.dir : path.join(process.cwd(), args.dir));

  if (targets.length === 0) {
    console.error(`No JSON files found. (dir=${args.dir}${args.file ? `, file=${args.file}` : ""})`);
    process.exit(1);
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  console.log(`Convex URL: ${CONVEX_URL}`);
  console.log(`Files: ${targets.length}`);
  if (args.dryRun) console.log(`Mode: dry-run (no DB writes)`);

  for (const filePath of targets) {
    const rel = path.relative(process.cwd(), filePath);
    const raw = fs.readFileSync(filePath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      console.log(`\n${rel}`);
      console.log(`ERROR (json): ${e?.message || String(e)}`);
      process.exit(1);
    }

    const base = UnitPackageSchema.safeParse(parsed);
    if (!base.success) {
      console.log(`\n${rel}`);
      for (const issue of base.error.issues) {
        console.log(`ERROR ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      process.exit(1);
    }

    const { fixed, changes } = autofixUnitPackage(base.data);
    const deepIssues = validateUnitPackageDeep(fixed);
    const errors = deepIssues.filter((i) => i.level === "error");

    console.log(`\n${rel}`);
    console.log(`- Changes: ${changes.length}`);
    console.log(`- Valid: ${errors.length === 0 ? "yes" : "no"}`);

    if (errors.length > 0) {
      for (const issue of errors) {
        console.log(`ERROR ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }

    if (args.dryRun) {
      console.log(`- (dry-run) Would import unit ${fixed.unitNumber} (${fixed.title})`);
      continue;
    }

    await importOne(client, fixed);
    console.log(`- Imported unit ${fixed.unitNumber} (${fixed.title})`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

