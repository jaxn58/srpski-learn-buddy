/**
 * Setup script to add beta-admin-notification email template
 * 
 * Usage: npx tsx scripts/setup-beta-notification.ts
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
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const template = {
  name: "beta-admin-notification",
  subject: "🚀 New Beta User: {{USER_NAME}}",
  description: "Sent to admin when a new user registers for beta",
  category: "transactional" as const,
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Beta User Registration</title>
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
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">New Beta User Registration</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">New User Waiting for Approval! ⏳</h2>
              
              <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.8;">
                  <strong>Name:</strong> {{USER_NAME}}<br>
                  <strong>Email:</strong> {{USER_EMAIL}}<br>
                  <strong>Clerk ID:</strong> {{CLERK_ID}}
                </p>
              </div>
              
              <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>💡 Action Required:</strong><br>
                  Please go to the Admin Dashboard to review and approve this user.
                </p>
              </div>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{ADMIN_URL}}" style="display: inline-block; background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Go to Admin Dashboard →
                </a>
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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  variables: ["USER_NAME", "USER_EMAIL", "CLERK_ID", "ADMIN_URL"],
};

async function setupTemplate() {
  console.log("🚀 Setting up beta-admin-notification template...\n");
  console.log(`📡 Connecting to Convex: ${CONVEX_URL}\n`);

  try {
    await client.action(api.emailTemplates.setupTemplate, {
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      description: template.description,
      variables: template.variables,
      category: template.category,
      isActive: true,
    });

    console.log(`✅ Successfully setup: ${template.name}`);
  } catch (error: any) {
    console.error(`❌ Failed to setup template:`, error.message);
    process.exit(1);
  }
}

setupTemplate().catch((error) => {
  console.error("❌ Setup failed:", error);
  process.exit(1);
});
