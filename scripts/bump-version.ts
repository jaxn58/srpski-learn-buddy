#!/usr/bin/env tsx
/**
 * Automatic Version Bump Script
 * 
 * This script automatically increments the app version and creates a new version entry in Convex.
 * It runs before each deployment build.
 * 
 * Environment Variables:
 * - BUMP_VERSION_TYPE: "major" | "minor" | "patch" (default: "patch")
 * - CONVEX_DEPLOYMENT: Convex deployment URL
 * - CURRENT_GIT_COMMIT: Git commit hash (set by Vercel)
 * - CURRENT_GIT_BRANCH: Git branch name (set by Vercel)
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

// ============= CONFIGURATION =============

const BUMP_TYPE = (process.env.BUMP_VERSION_TYPE || "patch") as "major" | "minor" | "patch";
const CONVEX_URL = process.env.CONVEX_DEPLOYMENT || process.env.VITE_CONVEX_URL;
const GIT_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA || process.env.CURRENT_GIT_COMMIT;
const GIT_BRANCH = process.env.VERCEL_GIT_COMMIT_REF || process.env.CURRENT_GIT_BRANCH;

// Determine environment based on branch
const ENVIRONMENT = GIT_BRANCH === "main" ? "production" : GIT_BRANCH === "staging" ? "staging" : "beta";

// ============= SEMANTIC VERSIONING UTILITIES =============

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function incrementVersion(
  current: string,
  type: "major" | "minor" | "patch"
): string {
  const { major, minor, patch } = parseVersion(current);
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

// ============= MAIN SCRIPT =============

async function main() {
  console.log("🚀 Version Bump Script");
  console.log("=====================");
  console.log(`Bump Type: ${BUMP_TYPE}`);
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Git Commit: ${GIT_COMMIT || "N/A"}`);
  console.log(`Git Branch: ${GIT_BRANCH || "N/A"}`);
  console.log("");

  // Validate Convex URL
  if (!CONVEX_URL) {
    console.error("❌ Error: CONVEX_DEPLOYMENT or VITE_CONVEX_URL environment variable not set");
    console.log("Skipping version bump...");
    process.exit(0); // Exit gracefully to not block build
  }

  try {
    // Initialize Convex client
    const client = new ConvexHttpClient(CONVEX_URL);

    // Get current version from Convex
    console.log("📥 Fetching current version from Convex...");
    const currentVersion = await client.query(api.versions.getCurrentVersion, {
      environment: ENVIRONMENT as "beta" | "production" | "staging",
    });

    let newVersionString: string;

    if (!currentVersion) {
      // No version exists yet, start with 1.0.0
      newVersionString = "1.0.0";
      console.log("⚠️  No current version found. Starting with 1.0.0");
    } else {
      // Increment version
      newVersionString = incrementVersion(currentVersion.version, BUMP_TYPE);
      console.log(`📈 Incrementing version: ${currentVersion.version} → ${newVersionString}`);
    }

    // Create new version in Convex
    console.log("💾 Creating new version in Convex...");
    
    // Note: This would require authentication. For now, we'll skip the Convex write
    // and just update package.json. The version will be created manually via admin UI.
    console.log("⚠️  Skipping Convex write (requires authentication)");
    console.log("📝 Version will need to be created via Admin UI after deployment");

    // Update package.json
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    
    packageJson.version = newVersionString;
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`✅ Updated package.json version to ${newVersionString}`);

    // Output for CI/CD
    console.log("");
    console.log("📋 Summary:");
    console.log(`   New Version: ${newVersionString}`);
    console.log(`   Environment: ${ENVIRONMENT}`);
    console.log(`   Bump Type: ${BUMP_TYPE}`);
    console.log("");
    console.log("✨ Version bump completed successfully!");
    console.log("");
    console.log("⚠️  IMPORTANT: After deployment, create this version in the Admin UI:");
    console.log(`   1. Go to /admin/changelog`);
    console.log(`   2. Click "New Version"`);
    console.log(`   3. Enter version: ${newVersionString}`);
    console.log(`   4. Select environment: ${ENVIRONMENT}`);
    console.log(`   5. Add changelog entries`);

  } catch (error: any) {
    console.error("❌ Error during version bump:", error.message);
    console.log("Continuing with build anyway...");
    // Don't fail the build, just log the error
    process.exit(0);
  }
}

// Run the script
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(0); // Exit gracefully to not block build
});
