import * as fs from "fs";
import * as path from "path";
import { UnitPackageSchema, type ValidationIssue, validateUnitPackageDeep } from "./unitPackage/schema";
import { autofixUnitPackage } from "./unitPackage/autofix";

type Args = {
  dir: string;
  file?: string;
  dryRun: boolean;
  fix: boolean;
  reportPath?: string;
  reportFormat: "json" | "md";
  aiPromptOut?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dir: path.join(process.cwd(), "New Content", "jsons"),
    dryRun: false,
    fix: false,
    reportFormat: "json",
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
    } else if (a === "--fix") {
      args.fix = true;
    } else if (a === "--report" && argv[i + 1]) {
      args.reportPath = argv[i + 1];
      i++;
    } else if (a === "--report-format" && argv[i + 1]) {
      const fmt = argv[i + 1];
      if (fmt === "json" || fmt === "md") {
        args.reportFormat = fmt;
      }
      i++;
    } else if (a === "--ai-prompt-out" && argv[i + 1]) {
      args.aiPromptOut = argv[i + 1];
      i++;
    }
  }

  return args;
}

function isJsonFile(p: string) {
  return p.toLowerCase().endsWith(".json");
}

const IGNORE_DIRS = new Set(["node_modules", "_reports", "_ai-prompts"]);

function listJsonFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      out.push(...listJsonFilesRecursive(full));
    } else if (ent.isFile() && isJsonFile(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function formatIssue(issue: ValidationIssue): string {
  const p = issue.path.length ? issue.path.join(".") : "(root)";
  return `${issue.level.toUpperCase()} ${p}: ${issue.message}`;
}

type ReportFileEntry = {
  file: string;
  changesCount: number;
  changesPreview: Array<{ kind: string; path: string; note?: string }>;
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  parseErrors: Array<{ path: string; message: string }>;
};

type Report = {
  generatedAt: string;
  dryRun: boolean;
  fix: boolean;
  scanned: { dir?: string; file?: string; count: number };
  summary: { files: number; validFiles: number; invalidFiles: number; totalErrors: number; filesFixed: number };
  files: ReportFileEntry[];
};

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function renderReportMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Content Validation Report`);
  lines.push(``);
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Dry-run: ${String(report.dryRun)}`);
  lines.push(`- Fix: ${String(report.fix)}`);
  lines.push(`- Files: ${report.summary.files}`);
  lines.push(`- Valid: ${report.summary.validFiles}`);
  lines.push(`- Invalid: ${report.summary.invalidFiles}`);
  lines.push(`- Total errors: ${report.summary.totalErrors}`);
  lines.push(``);

  for (const f of report.files) {
    lines.push(`## ${f.file}`);
    lines.push(``);
    lines.push(`- Valid: ${f.valid ? "yes" : "no"}`);
    lines.push(`- Changes: ${f.changesCount}`);
    if (f.changesPreview.length) {
      lines.push(`- Changes (preview):`);
      for (const c of f.changesPreview) {
        lines.push(`  - ${c.kind} @ ${c.path}${c.note ? ` (${c.note})` : ""}`);
      }
    }
    if (f.parseErrors.length) {
      lines.push(`- Parse errors:`);
      for (const e of f.parseErrors) {
        lines.push(`  - ${e.path}: ${e.message}`);
      }
    }
    if (f.errors.length) {
      lines.push(`- Validation errors:`);
      for (const e of f.errors) {
        lines.push(`  - ${e.path}: ${e.message}`);
      }
    }
    lines.push(``);
  }

  return lines.join("\n");
}

function renderAIFixPrompt(params: {
  jsonText: string;
  errors: Array<{ path: string; message: string }>;
  parseErrors: Array<{ path: string; message: string }>;
}): string {
  const allErrors = [...params.parseErrors, ...params.errors];
  const errorsText = allErrors.length
    ? allErrors.map((e) => `${e.path}: ${e.message}`).join("\n")
    : "(no errors provided)";

  return [
    `Du bist ein “Fix-only” JSON-Editor.`,
    ``,
    `INPUT`,
    `1) Eine JSON-Datei im Schema "unitPackage.v1"`,
    `2) Eine Liste von Validator-Errors (Pfad + Message)`,
    ``,
    `AUFGABE`,
    `- Gib als Output NUR die korrigierte JSON-Datei zurück (reines JSON).`,
    `- Ändere NUR die Felder, die nötig sind, um die Errors zu beheben.`,
    `- Keine Re-Nummerierung von questionId/order.`,
    `- Serbian-Vokabeln bleiben audio-clean: keine Klammern, keine Slash-Listen, keine Satzzeichen.`,
    `- Für multipleChoice:`,
    `  - options muss mindestens 2 Strings enthalten`,
    `  - correctAnswer muss exakt einem options-String entsprechen`,
    `  - Entferne "A)"/"a)" Prefixe aus options`,
    `- Für translation/fillInBlank/dialogue:`,
    `  - correctAnswer darf nicht leer sein`,
    `  - fillInBlank-Fragen enthalten genau ein Blank "_____"`,
    ``,
    `OUTPUT`,
    `- Nur das vollständige, korrigierte JSON.`,
    ``,
    `BEGIN JSON`,
    params.jsonText.trimEnd(),
    `END JSON`,
    ``,
    `BEGIN ERRORS`,
    errorsText.trimEnd(),
    `END ERRORS`,
    ``,
  ].join("\n");
}

function resolveAIPromptPath(params: { outArg: string; relFile: string; isDirMode: boolean }): string {
  const outAbs = path.isAbsolute(params.outArg) ? params.outArg : path.join(process.cwd(), params.outArg);

  // If running in --dir mode, we always interpret --ai-prompt-out as a directory target
  // (a prompt file is written per JSON file).
  if (params.isDirMode) {
    const base = path.basename(params.relFile, path.extname(params.relFile));
    return path.join(outAbs, `${base}.ai-fix-prompt.txt`);
  }

  // If running in --file mode:
  // - If the user passed a .txt path, use it directly.
  // - Otherwise interpret it as a directory and write a file inside.
  if (outAbs.toLowerCase().endsWith(".txt")) return outAbs;

  const base = path.basename(params.relFile, path.extname(params.relFile));
  return path.join(outAbs, `${base}.ai-fix-prompt.txt`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const targets = args.file
    ? [path.isAbsolute(args.file) ? args.file : path.join(process.cwd(), args.file)]
    : listJsonFilesRecursive(path.isAbsolute(args.dir) ? args.dir : path.join(process.cwd(), args.dir));

  if (targets.length === 0) {
    console.error(`No JSON files found. (dir=${args.dir}${args.file ? `, file=${args.file}` : ""})`);
    process.exit(1);
  }

  let totalErrors = 0;
  let totalFixed = 0;
  const reportFiles: ReportFileEntry[] = [];
  let aiPromptsWritten = 0;
  const isDirMode = !args.file;

  for (const filePath of targets) {
    const rel = path.relative(process.cwd(), filePath);
    const raw = fs.readFileSync(filePath, "utf-8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e: any) {
      totalErrors++;
      console.log(`\n${rel}`);
      console.log(`ERROR (json): ${e?.message || String(e)}`);
      const entry: ReportFileEntry = {
        file: rel,
        changesCount: 0,
        changesPreview: [],
        valid: false,
        errors: [],
        parseErrors: [{ path: "(json)", message: e?.message || String(e) }],
      };
      reportFiles.push(entry);

      if (args.aiPromptOut) {
        const promptPath = resolveAIPromptPath({ outArg: args.aiPromptOut, relFile: rel, isDirMode });
        ensureDirForFile(promptPath);
        fs.writeFileSync(
          promptPath,
          renderAIFixPrompt({ jsonText: raw, errors: entry.errors, parseErrors: entry.parseErrors }),
          "utf-8"
        );
        aiPromptsWritten++;
        console.log(`AI prompt written: ${path.relative(process.cwd(), promptPath)}`);
      }
      continue;
    }

    const base = UnitPackageSchema.safeParse(parsed);
    if (!base.success) {
      totalErrors++;
      console.log(`\n${rel}`);
      const parseErrors = base.error.issues.map((zodIssue) => ({
        path: zodIssue.path.join(".") || "(root)",
        message: zodIssue.message,
      }));
      for (const zodIssue of base.error.issues) {
        console.log(`ERROR ${zodIssue.path.join(".") || "(root)"}: ${zodIssue.message}`);
      }
      const entry: ReportFileEntry = {
        file: rel,
        changesCount: 0,
        changesPreview: [],
        valid: false,
        errors: [],
        parseErrors,
      };
      reportFiles.push(entry);

      if (args.aiPromptOut) {
        const promptPath = resolveAIPromptPath({ outArg: args.aiPromptOut, relFile: rel, isDirMode });
        ensureDirForFile(promptPath);
        fs.writeFileSync(
          promptPath,
          renderAIFixPrompt({ jsonText: raw, errors: entry.errors, parseErrors: entry.parseErrors }),
          "utf-8"
        );
        aiPromptsWritten++;
        console.log(`AI prompt written: ${path.relative(process.cwd(), promptPath)}`);
      }
      continue;
    }

    const { fixed, changes } = autofixUnitPackage(base.data);

    // Deep validation on the post-autofix result
    const deepIssues = validateUnitPackageDeep(fixed);
    const errors = deepIssues.filter((i) => i.level === "error");

    const hasChanges = changes.length > 0;
    const isValid = errors.length === 0;

    // Report
    console.log(`\n${rel}`);
    console.log(`- Changes: ${changes.length}`);
    console.log(`- Valid: ${isValid ? "yes" : "no"}`);

    if (args.dryRun && hasChanges) {
      for (const c of changes.slice(0, 50)) {
        console.log(`  - ${c.kind} @ ${c.path.join(".")}${c.note ? ` (${c.note})` : ""}`);
      }
      if (changes.length > 50) {
        console.log(`  - ... +${changes.length - 50} more changes`);
      }
    }

    if (!isValid) {
      totalErrors += errors.length;
      for (const issue of errors) {
        console.log(formatIssue(issue));
      }
    }

    const entry: ReportFileEntry = {
      file: rel,
      changesCount: changes.length,
      changesPreview: changes.slice(0, 50).map((c) => ({
        kind: c.kind,
        path: c.path.join("."),
        note: c.note,
      })),
      valid: isValid,
      errors: errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      parseErrors: [],
    };
    reportFiles.push(entry);

    if (args.aiPromptOut && !isValid) {
      const promptPath = resolveAIPromptPath({ outArg: args.aiPromptOut, relFile: rel, isDirMode });
      ensureDirForFile(promptPath);
      fs.writeFileSync(
        promptPath,
        renderAIFixPrompt({
          jsonText: JSON.stringify(fixed, null, 2) + "\n",
          errors: entry.errors,
          parseErrors: entry.parseErrors,
        }),
        "utf-8"
      );
      aiPromptsWritten++;
      console.log(`AI prompt written: ${path.relative(process.cwd(), promptPath)}`);
    }

    if (args.fix && hasChanges && !args.dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2) + "\n", "utf-8");
      totalFixed++;
      console.log(`- Wrote fixes to disk`);
    } else if (args.fix && hasChanges && args.dryRun) {
      console.log(`- (dry-run) Would write fixes to disk`);
    }
  }

  console.log(
    `\nSummary: errors=${totalErrors}, filesFixed=${totalFixed}, aiPromptsWritten=${aiPromptsWritten}, dryRun=${args.dryRun}, fix=${args.fix}`
  );

  if (args.reportPath) {
    const reportAbs = path.isAbsolute(args.reportPath)
      ? args.reportPath
      : path.join(process.cwd(), args.reportPath);

    const validFiles = reportFiles.filter((f) => f.valid).length;
    const invalidFiles = reportFiles.length - validFiles;

    const report: Report = {
      generatedAt: new Date().toISOString(),
      dryRun: args.dryRun,
      fix: args.fix,
      scanned: {
        dir: args.file ? undefined : args.dir,
        file: args.file,
        count: reportFiles.length,
      },
      summary: {
        files: reportFiles.length,
        validFiles,
        invalidFiles,
        totalErrors,
        filesFixed: totalFixed,
      },
      files: reportFiles,
    };

    ensureDirForFile(reportAbs);
    if (args.reportFormat === "md") {
      fs.writeFileSync(reportAbs, renderReportMarkdown(report), "utf-8");
    } else {
      fs.writeFileSync(reportAbs, JSON.stringify(report, null, 2) + "\n", "utf-8");
    }
    console.log(`Report written: ${path.relative(process.cwd(), reportAbs)}`);
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

