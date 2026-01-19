/**
 * Simple Email Templates - No fancy design, just clear information
 * These templates use basic HTML that works everywhere and is easy to edit
 */

export const simpleTemplates = [
  {
    name: "beta-registration",
    subject: "Welcome to Serbian AI Tutor - You're In!",
    description: "Sent when a user registers and gets immediate access",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Welcome to Beta Testing!</h2>

<p>Hi {{USER_NAME}},</p>

<p>Welcome to the Serbian AI Tutor Beta Testing Program! Your account is <strong>active</strong> and you can start learning Serbian right away!</p>

<p><a href="https://learn-with.me/dashboard" style="display: inline-block; background-color: #C41E3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Start Learning Now</a></p>

<h3>Beta Tester Benefits</h3>
<ul>
  <li><strong>Free access</strong> to Unit 1 (Foundation) during beta testing</li>
  <li><strong>50% OFF discount</strong> when I launch paid plans</li>
  <li>Early access to new features and improvements</li>
  <li>Direct impact on product development through your feedback</li>
</ul>

<h3>What's Included in Beta</h3>
<ul>
  <li><strong>Unit 1 (Foundation)</strong> – the essential starting point</li>
  <li>First Steps</li>
  <li>Interactive exercises</li>
  <li>Vocabulary training</li>
  <li>AI Learning Buddy (chat)</li>
  <li>Audio support for vocabulary, phrases, and dialogues</li>
  <li>Gamification</li>
</ul>

<h3>Getting Started</h3>
<ol>
  <li>Click the button above to log in</li>
  <li>Complete the onboarding tutorial</li>
  <li>Start with Unit 1 (Foundation)</li>
</ol>

<h3>Your Feedback Matters!</h3>
<p>As a beta tester, your input is invaluable. You'll find a "Send Feedback" button in your dashboard. Please share your thoughts, report bugs, or suggest improvements anytime!</p>

<p><strong>After Beta:</strong> I’ll email you when paid plans go live and how to use your 50% discount.</p>

<p><strong>Didn't register?</strong> If you didn't sign up for Serbian AI Tutor, you can safely ignore this email.</p>

<p>Happy learning!<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL"],
  },
  
  {
    name: "feedback-confirmation",
    subject: "I received your feedback",
    description: "Sent to user when they submit feedback",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Feedback Received</h2>

<p>Hi {{USER_NAME}},</p>

<p>I received your feedback and really appreciate you taking the time to help me improve Serbian AI Tutor!</p>

<p>
<strong>Feedback Type:</strong> {{FEEDBACK_TYPE}}<br>
<strong>Title:</strong> {{FEEDBACK_TITLE}}
</p>

<h3>What Happens Next?</h3>
<p>I’ll review your feedback shortly. If it's a bug report, I’ll investigate and fix it. For feature requests and improvements, I’ll evaluate them for future updates.</p>

<p>Thank you for helping me build a better learning experience!</p>

<p>Best regards,<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "FEEDBACK_TYPE", "FEEDBACK_TITLE"],
  },
  
  {
    name: "feedback-admin-notification",
    subject: "[{{FEEDBACK_TYPE}}] New Feedback: {{FEEDBACK_TITLE}}",
    description: "Sent to admin when new feedback is submitted",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>New Feedback Submission</h2>

<p>
<strong>From:</strong> {{USER_NAME}} ({{USER_EMAIL}})<br>
<strong>Type:</strong> {{FEEDBACK_TYPE}}<br>
<strong>Title:</strong> {{FEEDBACK_TITLE}}
</p>

<h3>Feedback Description:</h3>
<p style="background-color: #f5f5f5; padding: 16px; border-left: 3px solid #ccc;">
{{FEEDBACK_DESCRIPTION}}
</p>

<p><strong>Next Step:</strong> Review this feedback in your Admin Panel at /admin/feedback and update the status accordingly.</p>

<p>Best regards,<br>
<strong>Serbian AI Tutor System</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{ADMIN_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "FEEDBACK_TYPE", "FEEDBACK_TITLE", "FEEDBACK_DESCRIPTION", "ADMIN_EMAIL"],
  },

  {
    name: "feedback-admin-reply",
    subject: "Re: {{FEEDBACK_TITLE}}",
    description: "Sent to user when a superadmin replies to their feedback",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Reply to Your Feedback</h2>

<p>Hi {{USER_NAME}},</p>

<p>Thanks again for your feedback about:</p>
<p><strong>{{FEEDBACK_TITLE}}</strong></p>

<h3>My reply</h3>
<p style="background-color: #f5f5f5; padding: 16px; border-left: 3px solid #ccc; white-space: pre-wrap;">
{{ADMIN_REPLY}}
</p>

<p>Best regards,<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "FEEDBACK_TITLE", "ADMIN_REPLY"],
  },

  {
    name: "waitlist-opt-in",
    subject: "Confirm Your Waitlist Registration",
    description: "Sent when a user joins the waitlist - requires confirmation",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>Confirm Your Waitlist Registration</h2>

<p>Hi {{USER_NAME}},</p>

<p>Thank you for your interest in Serbian AI Tutor! I'm excited that you want to join my waitlist for the upcoming Beta launch.</p>

<p><strong>Please confirm your email address to complete your registration:</strong></p>

<p><a href="{{CONFIRMATION_LINK}}" style="display: inline-block; background-color: #C41E3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Confirm My Email</a></p>

<p>Or copy and paste this link into your browser:<br>
{{CONFIRMATION_LINK}}</p>

<h3>What Happens Next?</h3>
<p>After confirming your email, you'll be added to my waitlist. I'll notify you as soon as the Beta is ready to launch!</p>

<h3>What to Expect</h3>
<ul>
  <li>Structured Serbian lessons from beginner to intermediate</li>
  <li>Interactive exercises and vocabulary training</li>
  <li>AI-powered learning assistant</li>
  <li>Gamification features: XP, badges, and streaks</li>
  <li><strong>Special Beta discount</strong> for early supporters</li>
</ul>

<p><small>By joining the waitlist, you agree to receive email updates about the Serbian AI Tutor Beta launch.</small></p>

<p>Best regards,<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL", "CONFIRMATION_LINK"],
  },

  {
    name: "waitlist-confirmed",
    subject: "You're on the Waitlist!",
    description: "Sent after user confirms their waitlist registration",
    category: "transactional" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>You're on the Waitlist!</h2>

<p>Hi {{USER_NAME}},</p>

<p>Great news! Your email has been confirmed and you're now officially on the Serbian AI Tutor waitlist.</p>

<h3>What's Next?</h3>
<p>I'll send you an email as soon as the Beta is ready to launch. You'll be among the first to know!</p>

<h3>What You Can Expect</h3>
<ul>
  <li>Early access to Serbian AI Tutor Beta</li>
  <li><strong>Special discount</strong> for waitlist members</li>
  <li>The opportunity to shape the product with your feedback</li>
  <li>A structured course across 5 modules (content grows over time)</li>
  <li>Vocabulary training with audio pronunciations</li>
  <li>AI-powered learning assistant to help you practice</li>
</ul>

<h3>Stay Connected</h3>
<p>Follow my progress and get Serbian learning tips:</p>
<ul>
  <li>Website: <a href="https://learn-with.me">learn-with.me</a></li>
</ul>

<p>Thank you for your interest in Serbian AI Tutor. I can't wait to help you on your Serbian language journey!</p>

<p>Best regards,<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}
</p>
`,
    variables: ["USER_NAME", "USER_EMAIL"],
  },

  {
    name: "waitlist-beta-launch",
    subject: "Serbian AI Tutor Beta is Now Open!",
    description: "Sent to all confirmed waitlist users when Beta launches",
    category: "marketing" as const,
    htmlContent: `
<h1>Serbian AI Tutor</h1>
<h2>The Wait is Over - Beta is Now Open!</h2>

<p>Hi {{USER_NAME}},</p>

<p>Exciting news! Serbian AI Tutor Beta is officially open and you're invited to join!</p>

<p>As a waitlist member, you get <strong>immediate access</strong> to start learning Serbian today.</p>

<p><a href="{{SIGNUP_URL}}" style="display: inline-block; background-color: #C41E3A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Sign Up Now</a></p>

<h3>What's Included in Beta</h3>
<ul>
  <li><strong>3 Units</strong> of structured Serbian lessons (Foundation Module)</li>
  <li>Interactive exercises and vocabulary training</li>
  <li>AI-powered learning assistant for practice and questions</li>
  <li>Gamification: XP, badges, and streak tracking</li>
  <li>Mobile-friendly interface - learn anywhere</li>
</ul>

<h3>Your Beta Benefits</h3>
<ul>
  <li><strong>Free access</strong> to all Beta content</li>
  <li><strong>50% OFF discount</strong> on the full course at launch</li>
  <li>Early access to new features</li>
  <li>Direct impact on product development</li>
</ul>

<h3>Ready to Start?</h3>
<p>Click the button above to create your account and begin your Serbian learning journey!</p>

<p><small>This Beta is available for a limited time. Don't miss your chance to be part of something special!</small></p>

<p>Hvala (Thank you) for being part of my community!</p>

<p>Best regards,<br>
<strong>Jacksenn</strong></p>

<hr>
<p style="font-size: 12px; color: #666;">
© 2025 Serbian AI Tutor by jacksenn.me<br>
This email was sent to {{USER_EMAIL}}<br>
<a href="{{SIGNUP_URL}}">Sign Up Here</a>
</p>
`,
    variables: ["USER_NAME", "SIGNUP_URL"],
  },
];

/**
 * Migration script to update templates with simple versions
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const CONVEX_URL = 
  process.env.VITE_CONVEX_URL || 
  process.env.CONVEX_URL || 
  process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ CONVEX_URL environment variable is not set");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function updateTemplates() {
  console.log("🚀 Updating email templates with simple versions...\n");
  
  // Check for ADMIN_SECRET
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error("❌ ADMIN_SECRET not found in environment!");
    console.error("Please set ADMIN_SECRET in your .env.local file");
    process.exit(1);
  }
  
  console.log("✅ Admin secret loaded");
  console.log(`   Secret length: ${adminSecret.length} characters`);
  console.log(`   First 4 chars: ${adminSecret.substring(0, 4)}...`);
  console.log("");

  let successCount = 0;
  let errorCount = 0;

  for (const template of simpleTemplates) {
    try {
      console.log(`📝 Updating template: ${template.name}...`);

      // Use internal mutation which bypasses auth
      await client.mutation(api.admin.adminUpsertEmailTemplate, {
        adminSecret,
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent.trim(),
        description: template.description,
        variables: template.variables,
        category: template.category,
        isActive: true,
      });

      console.log(`  ✅ Successfully updated: ${template.name}\n`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed to update ${template.name}:`, error.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Update complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log("=".repeat(50));
}

// Run the update
updateTemplates().catch((error) => {
  console.error("❌ Update failed:", error);
  process.exit(1);
});
