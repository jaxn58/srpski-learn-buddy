import { Resend } from 'resend';
import { renderEmailTemplate, type TemplateVariables } from './emailTemplates';

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@mail.jacksenn.me';
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'hello@jacksenn.me';

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Send an email using Resend
 * @param options Email options (to, subject, html, replyTo)
 * @returns Promise<{ success: boolean, messageId?: string, error?: string }>
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean, messageId?: string, error?: string }> {
  try {
    console.log(`[Email] Attempting to send email to ${options.to}...`);
    
    if (!process.env.RESEND_API_KEY) {
      console.error('[Email] RESEND_API_KEY not configured!');
      return { success: false, error: 'Email service not configured' };
    }

    console.log(`[Email] Using FROM: ${FROM_EMAIL}, REPLY_TO: ${options.replyTo || REPLY_TO_EMAIL}`);
    
    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: `Serbian AI Tutor <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: htmlToText(options.html),
      replyTo: options.replyTo || REPLY_TO_EMAIL,
    });

    if (error) {
      console.error('[Email] ❌ Failed to send email to', options.to);
      console.error('[Email] Error details:', JSON.stringify(error, null, 2));
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    console.log(`[Email] ✅ Successfully sent email to ${options.to}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email] ❌ Exception while sending email to', options.to);
    console.error('[Email] Exception details:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send beta registration confirmation email
 * Uses template from Convex if available, falls back to hardcoded template
 */
export async function sendBetaRegistrationEmail(name: string, email: string): Promise<{ success: boolean, error?: string }> {
  let subject: string;
  let html: string;

  try {
    // Try to use template from Convex
    const template = await renderEmailTemplate('beta-registration', {
      USER_NAME: name,
      USER_EMAIL: email,
    });
    subject = template.subject;
    html = template.html;
  } catch (error) {
    // Fallback to hardcoded template if Convex template not available
    console.warn('[Email] Using fallback template for beta-registration:', error);
    subject = 'Welcome to Serbian AI Tutor Beta Testing';
    html = `
<!DOCTYPE html>
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
                Hi ${name},
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
                This email was sent to ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  }

  return sendEmail({
    to: email,
    subject,
    html,
    replyTo: undefined, // No reply functionality for beta registration
  });
}

/**
 * Send user activation notification email
 * Uses template from Convex if available, falls back to hardcoded template
 */
export async function sendUserActivationEmail(name: string, email: string, loginUrl: string): Promise<{ success: boolean, error?: string }> {
  let subject: string;
  let html: string;

  try {
    // Try to use template from Convex
    const template = await renderEmailTemplate('user-activation', {
      USER_NAME: name,
      USER_EMAIL: email,
      LOGIN_URL: loginUrl,
    });
    subject = template.subject;
    html = template.html;
  } catch (error) {
    // Fallback to hardcoded template if Convex template not available
    console.warn('[Email] Using fallback template for user-activation:', error);
    subject = '✅ Your Serbian AI Tutor Account is Active!';
    html = `
<!DOCTYPE html>
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
                Hi ${name},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                Great news! Your account has been <strong>activated</strong> and you can now start learning Serbian!
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #C41E3A 0%, #0C4076 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
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
                This email was sent to ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  }

  return sendEmail({
    to: email,
    subject,
    html,
  });
}



/**
 * Send feedback confirmation email to user
 * Uses template from Convex if available, falls back to hardcoded template
 */
export async function sendFeedbackConfirmationEmail(name: string, email: string, feedbackType: string, feedbackTitle: string): Promise<{ success: boolean, error?: string }> {
  const typeLabels: Record<string, string> = {
    bug: '🐛 Bug Report',
    feature: '✨ Feature Request',
    improvement: '💡 Improvement Suggestion',
    other: '📝 Other'
  };

  let subject: string;
  let html: string;

  try {
    // Try to use template from Convex
    const template = await renderEmailTemplate('feedback-confirmation', {
      USER_NAME: name,
      USER_EMAIL: email,
      FEEDBACK_TYPE: typeLabels[feedbackType] || feedbackType,
      FEEDBACK_TITLE: feedbackTitle,
    });
    subject = template.subject;
    html = template.html;
  } catch (error) {
    // Fallback to hardcoded template if Convex template not available
    console.warn('[Email] Using fallback template for feedback-confirmation:', error);
    subject = 'I received your feedback';
    html = `
<!DOCTYPE html>
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
                Hi ${name},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-size: 16px;">
                I received your feedback and really appreciate you taking the time to help me improve Serbian AI Tutor!
              </p>
              
              <div style="background-color: #F3F4F6; border-left: 4px solid #6B7280; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>Feedback Type:</strong> ${typeLabels[feedbackType] || feedbackType}<br>
                  <strong>Title:</strong> ${feedbackTitle}
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
                This email was sent to ${email}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  }

  return sendEmail({
    to: email,
    subject,
    html,
    replyTo: undefined, // No reply functionality for feedback confirmation
  });
}

/**
 * Send feedback notification email to admin/owner
 * Uses template from Convex if available, falls back to hardcoded template
 */
export async function sendFeedbackAdminNotificationEmail(userName: string, userEmail: string, feedbackType: string, feedbackTitle: string, feedbackDescription: string, adminEmail: string): Promise<{ success: boolean, error?: string }> {
  const typeLabels: Record<string, string> = {
    bug: '🐛 Bug Report',
    feature: '✨ Feature Request',
    improvement: '💡 Improvement Suggestion',
    other: '📝 Other'
  };

  let subject: string;
  let html: string;

  try {
    // Try to use template from Convex
    const template = await renderEmailTemplate('feedback-admin-notification', {
      USER_NAME: userName,
      USER_EMAIL: userEmail,
      FEEDBACK_TYPE: typeLabels[feedbackType] || feedbackType,
      FEEDBACK_TITLE: feedbackTitle,
      FEEDBACK_DESCRIPTION: feedbackDescription,
      ADMIN_EMAIL: adminEmail,
    });
    subject = template.subject;
    html = template.html;
  } catch (error) {
    // Fallback to hardcoded template if Convex template not available
    console.warn('[Email] Using fallback template for feedback-admin-notification:', error);
    subject = `[${typeLabels[feedbackType] || feedbackType}] New Feedback: ${feedbackTitle}`;
    html = `
<!DOCTYPE html>
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
                  <strong>From:</strong> ${userName} (${userEmail})<br>
                  <strong>Type:</strong> ${typeLabels[feedbackType] || feedbackType}<br>
                  <strong>Title:</strong> ${feedbackTitle}
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 24px 0 12px 0; font-size: 16px; font-weight: 600;">Feedback Description:</h3>
              <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; padding: 16px; margin: 16px 0; border-radius: 4px; white-space: pre-wrap; word-wrap: break-word;">
                <p style="color: #4a4a4a; margin: 0; font-size: 14px; line-height: 1.6;">${feedbackDescription}</p>
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
                This email was sent to ${adminEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  }

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}

