/**
 * Migration Script: Seed Content Studio Prompts to Production
 *
 * This script seeds ALL Content Studio prompts from the current codebase
 * (convex/contentStudio/prompts.ts) into the Production chatPrompts table:
 *
 *   cs_unit_creator      – Specialist/Unit Creator system prompt
 *   cs_finding_fixer     – Finding Fixer / Reviser system prompt
 *   cs_lector            – Lector / Auditor static system prompt
 *   cs_section_overview  – Section-specific editing prompt: Overview
 *   cs_section_vocabulary
 *   cs_section_grammar
 *   cs_section_phrases
 *   cs_section_exercises
 *   cs_section_cultural
 *
 * Existing prompts are always overwritten (code-base is the source of truth).
 *
 * Prerequisites:
 *   - VITE_CONVEX_URL in .env.local (Dev URL)
 *   - ADMIN_SECRET in .env.local (Production Admin Secret from Convex Dashboard)
 *
 * Usage:
 *   pnpm tsx scripts/migrate-content-studio-prompts-to-production.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";
import {
  SPECIALIST_SYSTEM_PROMPT,
  CREATOR_REVISE_SYSTEM_PROMPT,
  LECTOR_SYSTEM_PROMPT,
  SECTION_PROMPTS,
  CS_PROMPT_KEYS,
} from "../convex/contentStudio/prompts";

dotenv.config({ path: ".env.local" });

const PROD_CONVEX_URL =
  process.env.VITE_CONVEX_URL_PRODUCTION ?? "https://fleet-labrador-324.convex.cloud";

const adminSecret = process.env.ADMIN_SECRET;
if (!adminSecret) {
  console.error("ADMIN_SECRET not found in .env.local");
  console.error("Add the Production ADMIN_SECRET from Convex Dashboard -> Settings -> Environment Variables");
  process.exit(1);
}

console.log("Convex Production URL:", PROD_CONVEX_URL);
console.log("");

const prodClient = new ConvexHttpClient(PROD_CONVEX_URL);

interface PromptDefinition {
  name: string;
  content: string;
  description: string;
}

function buildPromptList(): PromptDefinition[] {
  const prompts: PromptDefinition[] = [
    {
      name: CS_PROMPT_KEYS.unitCreator,
      content: SPECIALIST_SYSTEM_PROMPT,
      description:
        "System prompt for the AI that generates full unit markdown from scratch (Specialist stage).",
    },
    {
      name: CS_PROMPT_KEYS.findingFixer,
      content: CREATOR_REVISE_SYSTEM_PROMPT,
      description:
        "System prompt for the AI that fixes validator/lector findings in existing content.",
    },
    {
      name: CS_PROMPT_KEYS.lector,
      content: LECTOR_SYSTEM_PROMPT,
      description:
        "Static instruction part of the Lector/Auditor. Dynamic context (unit number, vocabulary) is added at runtime.",
    },
    ...Object.entries(SECTION_PROMPTS).map(([sectionId, content]) => ({
      name: CS_PROMPT_KEYS.section(sectionId as Parameters<typeof CS_PROMPT_KEYS.section>[0]),
      content,
      description: `Section-specific editing prompt for the "${sectionId}" section.`,
    })),
  ];
  return prompts;
}

async function migrate() {
  console.log("Starting Content Studio Prompt Migration to Production");
  console.log("=".repeat(60));
  console.log("");

  const prompts = buildPromptList();
  console.log(`Prompts to migrate: ${prompts.length}`);
  prompts.forEach((p) => console.log(`  - ${p.name}`));
  console.log("");

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const prompt of prompts) {
    try {
      const result = await prodClient.mutation(api.admin.seedChatPrompt, {
        name: prompt.name,
        content: prompt.content,
        description: prompt.description,
        adminSecret: adminSecret!,
      });

      if (result.created) {
        console.log(`  [CREATED] ${prompt.name}`);
        created++;
      } else if (result.updated) {
        console.log(`  [UPDATED] ${prompt.name}`);
        updated++;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`  [FAILED]  ${prompt.name} – ${msg}`);
      if (msg.includes("Invalid admin secret")) {
        console.error("");
        console.error(
          "ADMIN_SECRET does not match Production. Check Convex Dashboard -> Settings -> Environment Variables."
        );
        process.exit(1);
      }
      failed++;
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("Migration Summary:");
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Failed  : ${failed}`);
  console.log("=".repeat(60));

  if (failed > 0) {
    console.error("");
    console.error(`${failed} prompt(s) failed to migrate. See errors above.`);
    process.exit(1);
  }

  console.log("");
  console.log("All Content Studio prompts successfully migrated to Production.");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Verify in Production Admin: https://learn-with.me/admin/prompt-admin");
  console.log("  2. Check that all cs_* prompts appear and are correct.");
}

migrate();
