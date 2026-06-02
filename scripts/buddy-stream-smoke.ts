#!/usr/bin/env tsx
/**
 * Buddy Context Streaming smoke test
 *
 * --dry-run  Validates that VITE_CONVEX_SITE_URL is documented in .env.example.
 *            No network calls. Always safe in CI without secrets.
 *
 * (default)  Also tests the CORS OPTIONS preflight on /chat/stream when
 *            CONVEX_SITE_URL is set. Exits cleanly when the variable is absent.
 *
 * Usage:
 *   pnpm test:buddy-smoke --dry-run
 *   CONVEX_SITE_URL=https://your-app.convex.site pnpm test:buddy-smoke
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

const isDryRun = process.argv.includes("--dry-run");

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): never {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

async function checkEnvDocumentation() {
  const examplePath = resolve(ROOT, ".env.example");
  let content: string;
  try {
    content = readFileSync(examplePath, "utf-8");
  } catch {
    fail(".env.example not found — cannot verify env documentation");
  }
  if (!content.includes("VITE_CONVEX_SITE_URL")) {
    fail(".env.example is missing the VITE_CONVEX_SITE_URL entry");
  }
  pass("VITE_CONVEX_SITE_URL is documented in .env.example");
}

async function checkCorsOptions(siteUrl: string) {
  const url = `${siteUrl}/chat/stream`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
  } catch (e) {
    fail(`Network error on OPTIONS ${url}: ${(e as Error).message}`);
  }

  if (res.status !== 200 && res.status !== 204) {
    fail(`OPTIONS ${url} returned HTTP ${res.status} — expected 200 or 204`);
  }
  pass(`CORS preflight OPTIONS /chat/stream → HTTP ${res.status}`);

  const allowOrigin = res.headers.get("Access-Control-Allow-Origin");
  if (!allowOrigin) {
    fail("OPTIONS response is missing the Access-Control-Allow-Origin header");
  }
  pass(`Access-Control-Allow-Origin: ${allowOrigin}`);
}

async function main() {
  console.log("\n── Buddy Context Streaming Smoke Test ──\n");

  await checkEnvDocumentation();

  if (isDryRun) {
    console.log("Dry-run complete — no network calls made.\n");
    process.exit(0);
  }

  const siteUrl = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");
  if (!siteUrl) {
    console.log(
      "CONVEX_SITE_URL not set — skipping network checks.\n" +
        "To run the CORS preflight test set the variable:\n" +
        "  CONVEX_SITE_URL=https://your-app.convex.site pnpm test:buddy-smoke\n",
    );
    process.exit(0);
  }

  await checkCorsOptions(siteUrl);

  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
