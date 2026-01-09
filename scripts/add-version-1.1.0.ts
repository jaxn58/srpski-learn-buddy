/**
 * Script to add Version 1.1.0 to Convex Changelog System
 * 
 * Run with: npx tsx scripts/add-version-1.1.0.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ VITE_CONVEX_URL environment variable is not set");
  process.exit(1);
}

// Note: This script requires manual authentication
// You need to run this from the Admin UI or authenticate as admin

const client = new ConvexHttpClient(CONVEX_URL);

async function addVersion110() {
  console.log("🚀 Adding Version 1.1.0 to Changelog System");
  console.log("===============================================\n");

  try {
    // Create version 1.1.0
    console.log("📦 Creating version 1.1.0...");
    const versionId = await client.mutation(api.versions.createVersion, {
      version: "1.1.0",
      environment: "beta",
      deploymentCommit: "aeecb68dc2c13745b521a433ceae6b3c90ec87ae",
      deploymentBranch: "beta/first-deploy",
    });
    console.log(`✅ Version created with ID: ${versionId}\n`);

    // Add changelog entries (English)
    console.log("📝 Adding English changelog entries...");

    const entriesEN = [
      // Security
      {
        category: "changed" as const,
        title: "Maximum Security CSP Implementation",
        description: "Implemented strict Content Security Policy with Cloudflare Turnstile support. Industry-standard security level (4.5/5 stars) protecting against XSS, Clickjacking, and Data Exfiltration.",
        language: "en" as const,
      },
      {
        category: "changed" as const,
        title: "Production-Safe Logging System",
        description: "Created logger utility that removes sensitive data (User IDs, emails) from production console. Debug logs only active in development, error logs remain for monitoring.",
        language: "en" as const,
      },
      {
        category: "fixed" as const,
        title: "DNS & Email Configuration",
        description: "Verified all 5 Clerk DNS CNAME records for custom email domain. Fixed DNS records at Hetzner, SSL certificates now active for clerk.learn-with.me and accounts.learn-with.me.",
        language: "en" as const,
      },
      // Features
      {
        category: "added" as const,
        title: "Cloudflare Turnstile Bot Protection",
        description: "Integrated intelligent adaptive CAPTCHA that only shows when needed. Works seamlessly with strict CSP to protect user registration against bots.",
        language: "en" as const,
      },
      {
        category: "changed" as const,
        title: "Production Deployment Optimization",
        description: "Successfully deployed to production at learn-with.me. Vercel deployment optimized (47s build time), build cache active and working.",
        language: "en" as const,
      },
      // Bug Fixes
      {
        category: "fixed" as const,
        title: "CSP Error 600010 Fixed",
        description: "Resolved Cloudflare Turnstile being blocked by Content Security Policy. Removed conflicting X-Frame-Options header.",
        language: "en" as const,
      },
      {
        category: "fixed" as const,
        title: "DNS CNAME Records Corrected",
        description: "Fixed DNS records with missing '1' in hostnames and corrected clk._domainkey record name.",
        language: "en" as const,
      },
      {
        category: "fixed" as const,
        title: "User Sync Issues Resolved",
        description: "Fixed user synchronization issues between Clerk and Convex database.",
        language: "en" as const,
      },
    ];

    for (const entry of entriesEN) {
      await client.mutation(api.versions.addChangelogEntry, {
        versionId,
        ...entry,
      });
      console.log(`  ✓ Added: ${entry.title}`);
    }

    // Add German changelog entries
    console.log("\n📝 Adding German changelog entries...");

    const entriesDE = [
      // Security
      {
        category: "changed" as const,
        title: "Maximale Sicherheits-CSP Implementierung",
        description: "Strikte Content Security Policy mit Cloudflare Turnstile Support implementiert. Industry-Standard Sicherheitslevel (4,5/5 Sterne) schützt vor XSS, Clickjacking und Datendiebstahl.",
        language: "de" as const,
      },
      {
        category: "changed" as const,
        title: "Production-sicheres Logging-System",
        description: "Logger-Utility erstellt, das sensible Daten (User IDs, E-Mails) aus der Production Console entfernt. Debug-Logs nur in Entwicklung aktiv, Error-Logs bleiben für Monitoring.",
        language: "de" as const,
      },
      {
        category: "fixed" as const,
        title: "DNS & E-Mail Konfiguration",
        description: "Alle 5 Clerk DNS CNAME-Records für Custom Email Domain verifiziert. DNS-Records bei Hetzner korrigiert, SSL-Zertifikate jetzt aktiv für clerk.learn-with.me und accounts.learn-with.me.",
        language: "de" as const,
      },
      // Features
      {
        category: "added" as const,
        title: "Cloudflare Turnstile Bot-Schutz",
        description: "Intelligentes adaptives CAPTCHA integriert, das nur bei Bedarf angezeigt wird. Funktioniert nahtlos mit strikter CSP zum Schutz der User-Registrierung gegen Bots.",
        language: "de" as const,
      },
      {
        category: "changed" as const,
        title: "Production Deployment Optimierung",
        description: "Erfolgreich auf learn-with.me deployed. Vercel Deployment optimiert (47s Build-Zeit), Build-Cache aktiv und funktionierend.",
        language: "de" as const,
      },
      // Bug Fixes
      {
        category: "fixed" as const,
        title: "CSP Error 600010 behoben",
        description: "Cloudflare Turnstile wurde nicht mehr von Content Security Policy blockiert. Konfliktierenden X-Frame-Options Header entfernt.",
        language: "de" as const,
      },
      {
        category: "fixed" as const,
        title: "DNS CNAME-Records korrigiert",
        description: "DNS-Records mit fehlender '1' in Hostnamen korrigiert und clk._domainkey Record-Namen berichtigt.",
        language: "de" as const,
      },
      {
        category: "fixed" as const,
        title: "User-Sync-Probleme behoben",
        description: "User-Synchronisationsprobleme zwischen Clerk und Convex Datenbank behoben.",
        language: "de" as const,
      },
    ];

    for (const entry of entriesDE) {
      await client.mutation(api.versions.addChangelogEntry, {
        versionId,
        ...entry,
      });
      console.log(`  ✓ Hinzugefügt: ${entry.title}`);
    }

    console.log("\n✨ Success! Version 1.1.0 has been added to the changelog system.");
    console.log("📊 Total entries: English (8) + German (8) = 16 entries\n");
    console.log("🔗 View in Admin UI: /admin/changelog\n");
  } catch (error) {
    console.error("\n❌ Error adding version:", error);
    console.error("\n💡 This script requires admin authentication.");
    console.error("   Please run this from the Admin UI or authenticate as admin first.\n");
    process.exit(1);
  }
}

// Run the script
addVersion110();
