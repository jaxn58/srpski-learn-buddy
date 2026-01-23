import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { api } from "../convex/_generated/api";
import i18n from "../client/src/i18n";
import { LandingSsg } from "../client/src/pages/home/LandingSsg";
import { buildLandingModuleCards, computeLandingCounts } from "../client/src/pages/home/landingData";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

function getSiteUrl(): string | null {
  const explicit = process.env.SITE_URL || process.env.VITE_SITE_URL || process.env.PUBLIC_SITE_URL;
  if (explicit && typeof explicit === "string" && explicit.trim()) return explicit.trim().replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel && typeof vercel === "string" && vercel.trim()) return `https://${vercel.trim().replace(/\/+$/, "")}`;
  return null;
}

function stripHtml(input: string): string {
  return String(input || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceBetween(source: string, startMarker: string, endMarker: string, replacement: string): string {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Could not find markers: ${startMarker} ... ${endMarker}`);
  }
  const before = source.slice(0, startIdx + startMarker.length);
  const after = source.slice(endIdx);
  return `${before}\n${replacement}\n${after}`;
}

async function fetchLandingData(convexUrl: string) {
  const client = new ConvexHttpClient(convexUrl);

  const [modules, unitsEn, vocab] = await Promise.all([
    client.query(api.modules.getAllModulesConsolidated, {}),
    client.query(api.units.getAllUnitsMetadata, { language: "en" }),
    client.query(api.vocabulary.getAllCourseVocabulary, {}),
  ]);

  const counts = computeLandingCounts({ modules: modules as any, unitsEn: unitsEn as any, vocab: vocab as any });
  const modulesData = buildLandingModuleCards({ modules: modules as any, unitsEn: unitsEn as any, vocab: vocab as any });

  return { counts, modulesData };
}

async function main() {
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing CONVEX URL (set VITE_CONVEX_URL or CONVEX_URL for prerender).");
  }

  const siteUrl = getSiteUrl();
  const isWaitlistMode = process.env.VITE_WAITLIST_MODE === "on";
  const showWaitlist = isWaitlistMode; // prerender assumes non-privileged, logged-out visitor

  // Ensure i18n is initialized for Node usage
  await i18n.changeLanguage("en");
  const t = (key: string, options?: Record<string, any>) => i18n.t(key, options) as string;

  const { counts, modulesData } = await fetchLandingData(convexUrl);

  const heroDescriptionPlain = stripHtml(showWaitlist ? t("home.hero.descriptionWaitlist") : t("home.hero.description", counts));
  const title = t("app.title") || "Serbian AI Tutor";

  const headTags: string[] = [];
  headTags.push(`<title>${escapeHtml(title)}</title>`);
  headTags.push(`<meta name="description" content="${escapeHtml(heroDescriptionPlain)}" />`);

  if (siteUrl) {
    headTags.push(`<link rel="canonical" href="${escapeHtml(siteUrl + "/")}" />`);
    headTags.push(`<meta property="og:url" content="${escapeHtml(siteUrl + "/")}" />`);
    headTags.push(`<meta property="og:image" content="${escapeHtml(siteUrl + "/favicon.png")}" />`);
  }

  headTags.push(`<meta property="og:type" content="website" />`);
  headTags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  headTags.push(`<meta property="og:description" content="${escapeHtml(heroDescriptionPlain)}" />`);
  headTags.push(`<meta name="twitter:card" content="summary" />`);
  headTags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  headTags.push(`<meta name="twitter:description" content="${escapeHtml(heroDescriptionPlain)}" />`);

  // Minimal structured data (safe defaults). If SITE_URL is unknown, omit @id/url fields.
  const jsonLd: any = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: title,
    ...(siteUrl ? { url: siteUrl + "/" } : {}),
  };
  headTags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

  const appHtml = renderToStaticMarkup(
    React.createElement(LandingSsg, {
      t,
      counts,
      modules: modulesData,
      showWaitlist,
    })
  );

  const outPath = path.resolve(process.cwd(), "dist", "public", "landing.html");
  if (!fs.existsSync(outPath)) {
    throw new Error(`Expected build output not found: ${outPath}. Did you run \`vite build\` first?`);
  }

  const raw = fs.readFileSync(outPath, "utf-8");
  const withHead = replaceBetween(raw, "<!--PRERENDER_HEAD_START-->", "<!--PRERENDER_HEAD_END-->", headTags.join("\n"));

  const rootBlock = `<div id="root" data-prerendered="1">${appHtml}</div>`;
  const finalHtml = replaceBetween(withHead, "<!--PRERENDER_ROOT_START-->", "<!--PRERENDER_ROOT_END-->", rootBlock);

  fs.writeFileSync(outPath, finalHtml, "utf-8");
  console.log(`[prerender-landing] Wrote prerendered HTML to ${outPath}`);
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

main().catch((e) => {
  console.error("[prerender-landing] Failed:", e);
  process.exit(1);
});

