/**
 * Migration script to extract email templates from server/_core/email.ts
 * and import them into Convex emailTemplates table
 *
 * SAFE BY DEFAULT: existing templates are never overwritten unless --force is passed.
 *
 * Usage:
 *   # Insert only new templates (safe, default)
 *   pnpm migrate:email-templates
 *
 *   # Show what would change without writing anything
 *   pnpm migrate:email-templates -- --dry-run
 *
 *   # Overwrite existing templates (use with caution on production!)
 *   pnpm migrate:email-templates -- --force
 *
 *   # Target production explicitly
 *   $env:VITE_CONVEX_URL="https://fleet-labrador-324.convex.cloud"; pnpm migrate:email-templates
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { config } from "dotenv";

// Load environment variables from .env.local (preferred in this repo)
config({ path: ".env.local" });

// Get Convex URL from environment variables or .env file
// Try multiple possible variable names
const CONVEX_URL = 
  process.env.VITE_CONVEX_URL || 
  process.env.CONVEX_URL || 
  process.env.NEXT_PUBLIC_CONVEX_URL;

const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL environment variable is not set");
  console.error("\nPlease set it using one of these methods:");
  console.error("\n1. Add to your .env file:");
  console.error("   VITE_CONVEX_URL=https://your-deployment.convex.cloud");
  console.error("\n2. Or set it as an environment variable:");
  console.error("   export VITE_CONVEX_URL=https://your-deployment.convex.cloud");
  console.error("   (Windows PowerShell: $env:VITE_CONVEX_URL='https://your-deployment.convex.cloud')");
  console.error("\n3. Or pass it directly:");
  console.error("   VITE_CONVEX_URL=https://your-deployment.convex.cloud pnpm migrate:email-templates");
  console.error("\n💡 You can find your Convex URL in:");
  console.error("   - Your Convex dashboard (Settings > Deployment URL)");
  console.error("   - Or check your .env file if you already have it configured");
  process.exit(1);
}

if (!ADMIN_SECRET) {
  console.error("❌ ADMIN_SECRET environment variable is not set");
  console.error("Please set ADMIN_SECRET in your .env.local file");
  console.error("See docs/ADMIN_SECRET_SETUP.md for instructions");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const force  = process.argv.includes("--force");

const client = new ConvexHttpClient(CONVEX_URL);

// Email templates extracted from server/_core/email.ts
const templates = [
  {
    name: "beta-registration",
    subject: "Welcome to Serbian AI Tutor Beta Testing",
    description: "Sent when a user registers for beta testing",
    category: "transactional" as const,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Registration Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Serbian AI Tutor</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Beta Testing Program</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Thank You for Registering! 🎉</h2>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Hi {{USER_NAME}},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Thank you for your interest in the Serbian AI Tutor Beta Testing Program! I received your registration and I'm excited to have you join.
              </p>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>⏳ What's Next?</strong><br>
                  Your account is currently <strong>pending approval</strong>. I will review your registration and activate your account shortly. You'll receive another email once you're approved!
                </p>
              </div>
              
              <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>🎁 Beta Tester Benefits</strong><br>
                  • <strong>Free access</strong> to Unit 1 (Foundation) during beta testing<br>
                  • <strong>50% OFF discount</strong> when I launch paid plans<br>
                  • Early access to new features and improvements
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 32px 0 16px 0; font-size: 18px; font-weight: 600;">What's Included in Beta:</h3>
              <ul style="color: #4a4a4a; line-height: 1.8; margin: 0 0 16px 0; padding-left: 20px;">
                <li><strong>Unit 1 (Foundation)</strong> – the essential starting point</li>
                <li>First Steps</li>
                <li>Interactive exercises</li>
                <li>Vocabulary training</li>
                <li>AI Learning Buddy (chat)</li>
                <li>Audio support for vocabulary, phrases, and dialogues</li>
                <li>Gamification</li>
              </ul>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>📚 After Launch:</strong><br>
                  I’ll email you when paid plans go live and how to use your <strong>50% discount</strong>.
                </p>
              </div>
              
              <div style="background-color: #FEE2E2; border-left: 4px solid #DC2626; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #991B1B; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>⚠️ Didn't register?</strong><br>
                  If you didn't sign up for Serbian AI Tutor, you can safely ignore this email. Your email address will not be used without your consent.
                </p>
              </div>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 24px 0 0 0; font-size: 16px;">
                Best regards,<br>
                <strong>Jacksenn</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                © 2025 Serbian AI Tutor by jacksenn.me
              </p>
              <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 12px;">
                This email was sent to {{USER_EMAIL}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    variables: ["USER_NAME", "USER_EMAIL"],
  },
  {
    name: "feedback-confirmation",
    subject: "I received your feedback",
    description: "Sent to user when they submit feedback",
    category: "transactional" as const,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Serbian AI Tutor</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Feedback Received</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Thank You for Your Feedback! 🙏</h2>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Hi {{USER_NAME}},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                I received your feedback and really appreciate you taking the time to help me improve Serbian AI Tutor!
              </p>
              
              <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>Feedback Type:</strong> {{FEEDBACK_TYPE}}<br>
                  <strong>Title:</strong> {{FEEDBACK_TITLE}}
                </p>
              </div>
              
              <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>✅ What Happens Next?</strong><br>
                  I’ll review your feedback shortly. If it's a bug report, I’ll investigate and fix it. For feature requests and improvements, I’ll evaluate them for future updates. Thank you for helping me build a better learning experience!
                </p>
              </div>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 24px 0 0 0; font-size: 16px;">
                Best regards,<br>
                <strong>Jacksenn</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                © 2025 Serbian AI Tutor by jacksenn.me
              </p>
              <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 12px;">
                This email was sent to {{USER_EMAIL}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    variables: ["USER_NAME", "USER_EMAIL", "FEEDBACK_TYPE", "FEEDBACK_TITLE"],
  },
  {
    name: "feedback-admin-notification",
    subject: "[{{FEEDBACK_TYPE}}] New Feedback: {{FEEDBACK_TITLE}}",
    description: "Sent to admin when new feedback is submitted",
    category: "transactional" as const,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feedback Submission</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Serbian AI Tutor</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">New Feedback Submission</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">New Feedback Received 📬</h2>
              
              <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.8;">
                  <strong>From:</strong> {{USER_NAME}} ({{USER_EMAIL}})<br>
                  <strong>Type:</strong> {{FEEDBACK_TYPE}}<br>
                  <strong>Title:</strong> {{FEEDBACK_TITLE}}
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 24px 0 12px 0; font-size: 16px; font-weight: 600;">Feedback Description:</h3>
              <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; padding: 16px; margin: 16px 0; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word;">
                <p style="color: #4a4a4a; margin: 0; font-size: 14px; line-height: 1.6;">{{FEEDBACK_DESCRIPTION}}</p>
              </div>
              
              <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>💡 Next Step:</strong> Review this feedback in your Admin Panel at /admin/feedback and update the status accordingly.
                </p>
              </div>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 24px 0 0 0; font-size: 16px;">
                Best regards,<br>
                <strong>Serbian AI Tutor System</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 14px;">
                © 2025 Serbian AI Tutor by jacksenn.me
              </p>
              <p style="color: #9ca3af; margin: 8px 0 0 0; font-size: 12px;">
                This email was sent to {{ADMIN_EMAIL}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    variables: ["USER_NAME", "USER_EMAIL", "FEEDBACK_TYPE", "FEEDBACK_TITLE", "FEEDBACK_DESCRIPTION", "ADMIN_EMAIL"],
  },
];

async function migrateTemplates() {
  const target = CONVEX_URL!.includes("fleet-labrador") ? "PRODUCTION" : "DEV";

  console.log("Starting email template migration\n");
  console.log(`  Target  : ${target} (${CONVEX_URL})`);
  console.log(`  Mode    : ${dryRun ? "DRY-RUN (no writes)" : force ? "FORCE (overwrites existing)" : "SAFE (skip existing)"}`);
  console.log("");

  if (target === "PRODUCTION" && force && !dryRun) {
    console.log("  WARNING: --force against PRODUCTION will overwrite customized templates.");
    console.log("  Press Ctrl+C within 5 seconds to abort.");
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Fetch all existing templates once so we can skip without extra roundtrips
  const existing: Array<{ name: string }> = await client.query(
    api.admin.adminGetAllEmailTemplates,
    { adminSecret: ADMIN_SECRET! }
  );
  const existingNames = new Set(existing.map((t) => t.name));

  let insertedCount = 0;
  let skippedCount  = 0;
  let errorCount    = 0;

  for (const template of templates) {
    try {
      const alreadyExists = existingNames.has(template.name);

      if (alreadyExists && !force) {
        console.log(`  SKIP  ${template.name}  (already exists; use --force to overwrite)`);
        skippedCount++;
        continue;
      }

      const action = alreadyExists ? "Overwrite" : "Insert";
      console.log(`  ${action}  ${template.name}${dryRun ? "  [DRY-RUN]" : ""}...`);

      // Extract variables from content
      const variableRegex = /\{\{(\w+)\}\}/g;
      const foundVariables = new Set<string>();
      let match;
      while ((match = variableRegex.exec(template.htmlContent)) !== null) {
        foundVariables.add(match[1]);
      }
      while ((match = variableRegex.exec(template.subject)) !== null) {
        foundVariables.add(match[1]);
      }

      const variables =
        template.variables.length > 0
          ? template.variables
          : Array.from(foundVariables);

      if (!dryRun) {
        await client.mutation(api.admin.adminUpsertEmailTemplate, {
          adminSecret: ADMIN_SECRET!,
          name: template.name,
          subject: template.subject,
          htmlContent: template.htmlContent,
          description: template.description,
          variables,
          category: template.category,
          isActive: true,
        });
      }

      console.log(`    OK  Variables: ${variables.join(", ")}`);
      insertedCount++;
    } catch (error: any) {
      console.error(`  ERROR  ${template.name}: ${error.message}`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Migration complete`);
  console.log(`  Inserted/Updated : ${insertedCount}${dryRun ? " (dry-run)" : ""}`);
  console.log(`  Skipped (exist)  : ${skippedCount}`);
  console.log(`  Errors           : ${errorCount}`);
  console.log("=".repeat(50));
}

// Run migration
migrateTemplates().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

