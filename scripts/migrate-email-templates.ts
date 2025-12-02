/**
 * Migration script to extract email templates from server/_core/email.ts
 * and import them into Convex emailTemplates table
 * 
 * Usage: npx tsx scripts/migrate-email-templates.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import "dotenv/config";

// Get Convex URL from environment variables or .env file
// Try multiple possible variable names
const CONVEX_URL = 
  process.env.VITE_CONVEX_URL || 
  process.env.CONVEX_URL || 
  process.env.NEXT_PUBLIC_CONVEX_URL;

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

const client = new ConvexHttpClient(CONVEX_URL);

// Email templates extracted from server/_core/email.ts
const templates = [
  {
    name: "beta-registration",
    subject: "🎉 Welcome to Serbian AI Tutor Beta Testing!",
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
                Thank you for your interest in the Serbian AI Tutor Beta Testing Program! We've received your registration and are excited to have you join us.
              </p>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>⏳ What's Next?</strong><br>
                  Your account is currently <strong>pending approval</strong>. Our team will review your registration and activate your account shortly. You'll receive another email once you're approved!
                </p>
              </div>
              
              <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>🎁 Beta Tester Benefits</strong><br>
                  • <strong>Free access</strong> to Units 1-5 during beta testing<br>
                  • <strong>50% OFF discount</strong> on the full course when we launch<br>
                  • Early access to all features and improvements
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 32px 0 16px 0; font-size: 18px; font-weight: 600;">What's Included in Beta:</h3>
              <ul style="color: #4a4a4a; line-height: 1.8; margin: 0 0 16px 0; padding-left: 20px;">
                <li><strong>5 Units</strong> of structured Serbian lessons (Units 1-5)</li>
                <li>Interactive exercises and vocabulary training</li>
                <li>AI-powered learning assistant</li>
                <li>Gamification features: XP, badges, and streaks</li>
              </ul>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>📚 After Launch:</strong><br>
                  Unlock all 27 units and 737+ vocabulary words with your exclusive <strong>50% discount</strong>!
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
                <strong>The Serbian AI Tutor Team</strong>
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
    name: "user-activation",
    subject: "✅ Your Serbian AI Tutor Account is Active!",
    description: "Sent when a user's account is activated by admin",
    category: "transactional" as const,
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Activated</title>
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
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your Account is Active!</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Welcome Aboard! 🚀</h2>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Hi {{USER_NAME}},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Great news! Your account has been <strong>activated</strong> and you can now start learning Serbian!
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{LOGIN_URL}}" style="display: inline-block; background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Start Learning Now →
                </a>
              </div>
              
              <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>✨ Remember:</strong> As a beta tester, you'll get <strong>50% OFF</strong> at launch!
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 32px 0 16px 0; font-size: 18px; font-weight: 600;">Getting Started:</h3>
              <ol style="color: #4a4a4a; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>Click the button above to log in</li>
                <li>Complete the onboarding tutorial</li>
                <li>Choose your learning pace (Intensive, Balanced, or Relaxed)</li>
                <li>Start with Unit 1: At the Airport</li>
              </ol>
              
              <div style="background-color: #EDE9FE; border-left: 4px solid #8B5CF6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #5B21B6; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>💬 Your Feedback Matters!</strong><br>
                  As a beta tester, your input is invaluable. After logging in, you'll find a "Send Feedback" button in your dashboard. Please share your thoughts, report bugs, or suggest improvements anytime!
                </p>
              </div>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 16px 0 0 0; font-size: 16px;">
                Happy learning!<br>
                <strong>The Serbian AI Tutor Team</strong>
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
    variables: ["USER_NAME", "USER_EMAIL", "LOGIN_URL"],
  },
  {
    name: "feedback-confirmation",
    subject: "✅ We Received Your Feedback!",
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
                We've received your feedback and really appreciate you taking the time to help us improve Serbian AI Tutor!
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
                  Our team will review your feedback shortly. If it's a bug report, we'll investigate and fix it. For feature requests and improvements, we'll evaluate them for future updates. Thank you for helping us build a better learning experience!
                </p>
              </div>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 24px 0 0 0; font-size: 16px;">
                Best regards,<br>
                <strong>The Serbian AI Tutor Team</strong>
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
  console.log("🚀 Starting email template migration...\n");
  console.log(`📡 Connecting to Convex: ${CONVEX_URL}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const template of templates) {
    try {
      console.log(`📝 Migrating template: ${template.name}...`);

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
      const allVariables = Array.from(foundVariables);

      // Use the variables from template definition, or fall back to detected ones
      const variables = template.variables.length > 0 ? template.variables : allVariables;

      // Use setup action which bypasses auth requirements for initial migration
      await client.action(api.emailTemplates.setupTemplate, {
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        description: template.description,
        variables: variables,
        category: template.category,
        isActive: true,
      });

      console.log(`  ✅ Successfully migrated: ${template.name}`);
      console.log(`     Variables: ${variables.join(", ")}\n`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed to migrate ${template.name}:`, error.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Migration complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log("=".repeat(50));
}

// Run migration
migrateTemplates().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});

