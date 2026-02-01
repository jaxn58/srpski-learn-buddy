/**
 * Content Studio – Model evaluation harness
 *
 * Goal:
 * - Compare candidate models for the three stages:
 *   1) Specialist (authoring) – quality + template compliance
 *   2) QC Fix-only – minimal, deterministic repair behaviour
 *   3) Auditor – consistency/safety findings quality
 *
 * This script is safe-by-default:
 * - If no API keys are configured, it will print a plan and exit.
 * - It never writes to the database.
 *
 * Run (example):
 *   node --loader ts-node/esm scripts/model-evaluation/content-studio-model-eval.ts
 *
 * Requirements:
 * - Set at least one of: GEMINI_API_KEY, OPENAI_API_KEY
 */

import { UnitPackageSchema, validateUnitPackageDeep } from "../unitPackage/schema";
import { validateUnitPackageTemplateRules } from "../unitPackage/templateRules";
import { autofixUnitPackage } from "../unitPackage/autofix";

type Provider = "gemini" | "openai";

type CandidateModel = {
  provider: Provider;
  model: string;
};

type EvalCase = {
  id: string;
  moduleNumber: number;
  moduleTitle: string;
  unitNumber: number;
  unitTitle: string;
  unitDescription: string;
};

const CASES: EvalCase[] = [
  {
    id: "u3_food_shopping",
    moduleNumber: 1,
    moduleTitle: "Ankommen (Arrival)",
    unitNumber: 3,
    unitTitle: "Food and Shopping",
    unitDescription: "Learn core food vocabulary and how to order and shop politely.",
  },
  {
    id: "u4_bank",
    moduleNumber: 1,
    moduleTitle: "Ankommen (Arrival)",
    unitNumber: 4,
    unitTitle: "At the Bank",
    unitDescription: "Learn essential banking phrases and polite requests in Serbian.",
  },
];

const CANDIDATES: CandidateModel[] = [
  { provider: "gemini", model: "gemini-2.5-pro" },
  { provider: "gemini", model: "gemini-2.5-flash" },
  { provider: "openai", model: "gpt-4o" },
  { provider: "openai", model: "gpt-4o-mini" },
];

function resolveProviderConfig(provider: Provider): { apiUrl: string; apiKey: string } | null {
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return {
      apiKey: key,
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    };
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return {
    apiKey: key,
    apiUrl: "https://api.openai.com/v1/chat/completions",
  };
}

async function callJson(params: {
  provider: Provider;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  const cfg = resolveProviderConfig(params.provider);
  if (!cfg) throw new Error(`Missing API key for provider=${params.provider}`);

  const res = await fetch(cfg.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      response_format: { type: "json_object" },
      max_tokens: params.maxTokens,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${params.provider}/${params.model} API error: ${res.status} ${res.statusText} – ${t}`);
  }

  const data: any = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") throw new Error("No model output");
  return raw;
}

function evaluateUnitPackageJson(rawJson: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e: any) {
    return {
      ok: false,
      schemaOk: false,
      error: `Invalid JSON: ${e?.message || String(e)}`,
      deepErrors: 0,
      templateErrors: 0,
    };
  }

  const unitPackage = parsed?.unitPackage ?? parsed;
  const base = UnitPackageSchema.safeParse(unitPackage);
  if (!base.success) {
    return {
      ok: false,
      schemaOk: false,
      error: `Schema invalid: ${base.error.issues[0]?.message || "unknown"}`,
      deepErrors: 0,
      templateErrors: 0,
    };
  }

  const { fixed } = autofixUnitPackage(base.data);
  const deep = validateUnitPackageDeep(fixed);
  const template = validateUnitPackageTemplateRules(fixed);
  const deepErrors = deep.filter((i) => i.level === "error").length;
  const templateErrors = template.filter((i) => i.level === "error").length;
  const ok = deepErrors === 0 && templateErrors === 0;

  return {
    ok,
    schemaOk: true,
    deepErrors,
    templateErrors,
    deepWarnings: deep.filter((i) => i.level === "warning").length,
    templateWarnings: template.filter((i) => i.level === "warning").length,
  };
}

function specialistSystemPrompt(): string {
  return [
    `You are a strict content authoring agent for a Serbian learning app.`,
    `Hard rules:`,
    `- Output ONLY valid JSON (no markdown, no commentary).`,
    `- JSON must represent ONE unit in schema 'unitPackage.v1'.`,
    `- All explanatory text must be English.`,
    `- Do NOT copy or quote any textbook.`,
    `- Vocabulary Serbian keys must be unique; polysemy goes into noteEn as 'AlsoMeaning: ...' etc.`,
    `- Exercises required: translation, fillInBlank, multipleChoice, dialogueCompletion.`,
    `- questionId must match u<UNIT>_ex<EX>_q<NN>.`,
    `- fillInBlank questions must contain exactly one blank '_____' (five underscores).`,
    `- multipleChoice/dialogueCompletion must have 3–4 options and correctAnswer must exactly match one option.`,
    ``,
    `Return JSON with a top-level key "unitPackage" containing the unit package.`,
  ].join("\n");
}

function specialistUserPrompt(c: EvalCase): string {
  return [
    `Create unit content with these inputs:`,
    `- moduleNumber: ${c.moduleNumber}`,
    `- moduleTitle: ${c.moduleTitle}`,
    `- unitNumber: ${c.unitNumber}`,
    `- unitTitle: ${c.unitTitle}`,
    `- unitDescription: ${c.unitDescription}`,
    ``,
    `The output must be a complete unitPackage.v1 JSON for English (en) base language and Serbian (sr) target.`,
  ].join("\n");
}

function qcFixOnlySystemPrompt(): string {
  return [
    `You are a strict FIX-ONLY JSON editor.`,
    `You will receive a unitPackage.v1 JSON and a list of validator errors.`,
    `Rules:`,
    `- Output ONLY JSON with top-level key "unitPackage".`,
    `- Change ONLY what is necessary to fix errors. Preserve meaning as much as possible.`,
    `- Never duplicate Serbian vocab keys; merge meanings into noteEn using AlsoMeaning/Usage/Context.`,
    `- For dialogueCompletion and multipleChoice: every question must have 3–4 options; correctAnswer must match exactly one option.`,
    `- For fillInBlank: question must contain exactly one '_____' blank (five underscores).`,
    `- questionId must match u<UNIT>_ex<EX>_q<NN>.`,
  ].join("\n");
}

function auditorSystemPrompt(): string {
  return [
    `You are an AI auditor for Serbian learning unit content.`,
    `You must NOT copy or quote any textbook. Inspiration-only.`,
    `Return ONLY JSON with keys: {"ok":boolean,"blockers":[...],"warnings":[...]}`,
    `blockers/warnings are arrays of {code,message,path?}.`,
    `Focus on: Serbian correctness, beginner suitability, Unit 1/2 consistency, forbidden patterns.`,
  ].join("\n");
}

function parseAudit(raw: string): { ok: boolean; blockers: any[]; warnings: any[] } | null {
  try {
    const j = JSON.parse(raw);
    const blockers = Array.isArray(j?.blockers) ? j.blockers : [];
    const warnings = Array.isArray(j?.warnings) ? j.warnings : [];
    return { ok: !!j?.ok, blockers, warnings };
  } catch {
    return null;
  }
}

async function main() {
  const hasAnyKey = !!process.env.GEMINI_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasAnyKey) {
    console.log(
      [
        "No API keys configured.",
        "Set GEMINI_API_KEY and/or OPENAI_API_KEY to run this harness.",
        "",
        "What this harness would do:",
        "- For each candidate model and each eval case, run Specialist prompt (json_object) and score:",
        "  - schema validity",
        "  - deep validation errors/warnings",
        "  - template rule errors/warnings",
      ].join("\n")
    );
    process.exit(0);
  }

  const specialistSystem = specialistSystemPrompt();
  const qcSystem = qcFixOnlySystemPrompt();
  const auditSystem = auditorSystemPrompt();

  const results: any[] = [];
  for (const model of CANDIDATES) {
    const cfg = resolveProviderConfig(model.provider);
    if (!cfg) continue; // skip providers without keys

    for (const c of CASES) {
      const rawSpecialist = await callJson({
        provider: model.provider,
        model: model.model,
        system: specialistSystem,
        user: specialistUserPrompt(c),
        maxTokens: 3500,
      });
      const specialistScore = evaluateUnitPackageJson(rawSpecialist);

      // QC Fix-only evaluation (only meaningful if schemaOk)
      let qcScore: any = null;
      if (specialistScore.schemaOk) {
        const specialistParsed = JSON.parse(rawSpecialist);
        const unitPackage = specialistParsed?.unitPackage ?? specialistParsed;
        const base = UnitPackageSchema.parse(unitPackage);

        // Induce a deterministic break (missing options for the first multiple choice question)
        const broken: any = JSON.parse(JSON.stringify(base));
        const mc = broken?.exercises?.en?.find((x: any) => x?.category === "multipleChoice");
        if (mc?.questions?.[0]) {
          mc.questions[0].options = [];
          mc.questions[0].correctAnswer = "";
        }

        const { fixed } = autofixUnitPackage(broken);
        const deepErrors = validateUnitPackageDeep(fixed).filter((i) => i.level === "error");
        const templateErrors = validateUnitPackageTemplateRules(fixed).filter((i) => i.level === "error");
        const errors = [...deepErrors, ...templateErrors];

        const qcUser = [
          `BEGIN JSON`,
          JSON.stringify(fixed),
          `END JSON`,
          ``,
          `BEGIN ERRORS`,
          errors.map((e) => `${(e.path || []).join(".")}: ${e.message}`).join("\n"),
          `END ERRORS`,
        ].join("\n");

        const rawQc = await callJson({
          provider: model.provider,
          model: model.model,
          system: qcSystem,
          user: qcUser,
          maxTokens: 2500,
        });

        qcScore = evaluateUnitPackageJson(rawQc);
      }

      // Auditor evaluation (structure only; content quality is reviewed separately)
      const rawAudit = await callJson({
        provider: model.provider,
        model: model.model,
        system: auditSystem,
        user: `UNIT PACKAGE JSON:\n${rawSpecialist}`,
        maxTokens: 1200,
      });
      const auditParsed = parseAudit(rawAudit);

      results.push({
        provider: model.provider,
        model: model.model,
        caseId: c.id,
        specialist: specialistScore,
        qcFixOnly: qcScore,
        auditor: auditParsed
          ? { ok: auditParsed.ok, blockers: auditParsed.blockers.length, warnings: auditParsed.warnings.length }
          : { ok: false, parseError: true },
      });
      console.log(
        `${model.provider}/${model.model} ${c.id}: specialist.ok=${specialistScore.ok} qcFixOnly.ok=${qcScore?.ok ?? "n/a"} auditor.parse=${auditParsed ? "ok" : "fail"}`
      );
    }
  }

  console.log("\n=== Summary (JSON) ===\n" + JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

