import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { api } from "./_generated/api";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.jacksenn.me";
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || "hello@jacksenn.me";

/**
 * Send email using Resend API
 * This action replaces the Express /api/email/send endpoint
 */
export const sendEmail = action({
  args: {
    templateName: v.string(),
    variables: v.record(v.string(), v.union(v.string(), v.number())),
    to: v.string(),
    replyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Render template from Convex
    let subject: string;
    let html: string;

    try {
      const template = await ctx.runQuery(api.emailTemplates.render, {
        templateName: args.templateName,
        variables: args.variables as Record<string, string | number>,
      });

      if (!template) {
        throw new Error(`Template "${args.templateName}" not found or not active`);
      }

      subject = template.subject;
      html = template.html;
    } catch (error) {
      console.error(`[Email] Failed to render template ${args.templateName}:`, error);
      throw new Error(`Failed to render email template: ${args.templateName}`);
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `Serbian AI Tutor <${FROM_EMAIL}>`,
        to: args.to,
        subject: subject,
        html: html,
        replyTo: args.replyTo || REPLY_TO_EMAIL,
      });

      if (error) {
        console.error("[Email] Failed to send email:", error);
        return { success: false, error: error.message || JSON.stringify(error) };
      }

      console.log(`[Email] ✅ Successfully sent ${args.templateName} email to ${args.to}, ID: ${data?.id}`);
      return { success: true, messageId: data?.id };
    } catch (error: any) {
      console.error("[Email] Exception while sending email:", error);
      return { success: false, error: String(error) };
    }
  },
});

/**
 * Send beta registration email (convenience wrapper)
 */
export const sendBetaRegistrationEmail = action({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.email.sendEmail, {
      templateName: "beta-registration",
      variables: {
        USER_NAME: args.name,
        USER_EMAIL: args.email,
      },
      to: args.email,
    });
  },
});

/**
 * Send user activation email (convenience wrapper)
 */
export const sendUserActivationEmail = action({
  args: {
    name: v.string(),
    email: v.string(),
    loginUrl: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.email.sendEmail, {
      templateName: "user-activation",
      variables: {
        USER_NAME: args.name,
        USER_EMAIL: args.email,
        LOGIN_URL: args.loginUrl,
      },
      to: args.email,
    });
  },
});

/**
 * Send feedback confirmation email (convenience wrapper)
 */
export const sendFeedbackConfirmationEmail = action({
  args: {
    name: v.string(),
    email: v.string(),
    feedbackType: v.string(),
    feedbackTitle: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.email.sendEmail, {
      templateName: "feedback-confirmation",
      variables: {
        USER_NAME: args.name,
        USER_EMAIL: args.email,
        FEEDBACK_TYPE: args.feedbackType,
        FEEDBACK_TITLE: args.feedbackTitle,
      },
      to: args.email,
    });
  },
});

/**
 * Send feedback admin notification email (convenience wrapper)
 */
export const sendFeedbackAdminNotificationEmail = action({
  args: {
    userName: v.string(),
    userEmail: v.string(),
    feedbackType: v.string(),
    feedbackTitle: v.string(),
    feedbackDescription: v.string(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.email.sendEmail, {
      templateName: "feedback-admin-notification",
      variables: {
        USER_NAME: args.userName,
        USER_EMAIL: args.userEmail,
        FEEDBACK_TYPE: args.feedbackType,
        FEEDBACK_TITLE: args.feedbackTitle,
        FEEDBACK_DESCRIPTION: args.feedbackDescription,
        ADMIN_EMAIL: args.adminEmail,
      },
      to: args.adminEmail,
    });
  },
});



