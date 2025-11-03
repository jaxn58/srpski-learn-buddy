import { Resend } from 'resend';

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
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Email] RESEND_API_KEY not configured, skipping email send');
      return { success: false, error: 'Email service not configured' };
    }

    const client = getResendClient();
    const { data, error } = await client.emails.send({
      from: `Serbian AI Tutor <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || REPLY_TO_EMAIL,
    });

    if (error) {
      console.error('[Email] Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Successfully sent email to ${options.to}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email] Exception while sending email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send beta registration confirmation email
 */
export async function sendBetaRegistrationEmail(name: string, email: string): Promise<{ success: boolean, error?: string }> {
  const html = `
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
                Thank you for your interest in the Serbian AI Tutor Beta Testing Program! We've received your registration and are excited to have you join us.
              </p>
              
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>⏳ What's Next?</strong><br>
                  Your account is currently <strong>pending approval</strong>. Our team will review your registration and activate your account shortly. You'll receive another email once you're approved!
                </p>
              </div>
              
              <div style="background-color: #DBEAFE; border-left: 4px solid #3B82F6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #1E40AF; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>🎁 Beta Tester Reward</strong><br>
                  As a beta tester, you'll receive <strong>50% OFF</strong> when we launch! This discount will be automatically applied to your account.
                </p>
              </div>
              
              <h3 style="color: #1a1a1a; margin: 32px 0 16px 0; font-size: 18px; font-weight: 600;">What You'll Get:</h3>
              <ul style="color: #4a4a4a; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
                <li>Access to all 27 units of structured Serbian lessons</li>
                <li>737+ vocabulary words with interactive exercises</li>
                <li>AI-powered learning assistant for review and reinforcement</li>
                <li>Gamification features: XP, badges, and streaks</li>
                <li>Flexible learning pace (3-12 months)</li>
              </ul>
              
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

  return sendEmail({
    to: email,
    subject: '🎉 Welcome to Serbian AI Tutor Beta Testing!',
    html,
    replyTo: undefined, // No reply functionality for beta registration
  });
}

/**
 * Send user activation notification email
 */
export async function sendUserActivationEmail(name: string, email: string, loginUrl: string): Promise<{ success: boolean, error?: string }> {
  const html = `
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

  return sendEmail({
    to: email,
    subject: '✅ Your Serbian AI Tutor Account is Active!',
    html,
  });
}

