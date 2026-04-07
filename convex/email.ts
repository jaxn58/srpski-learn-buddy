import { action, internalAction, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { api, internal } from "./_generated/api";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@mail.jacksenn.me";
const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || "hello@jacksenn.me";

type SendEmailResult = { success: boolean; messageId?: string; error?: string };

async function renderAndSendTemplateEmail(
  ctx: ActionCtx,
  args: {
    templateName: string;
    variables: Record<string, string | number>;
    to: string;
    replyTo?: string;
    language?: "en" | "de";
  }
): Promise<SendEmailResult> {
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
      variables: args.variables,
      language: args.language,
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
      subject,
      html,
      text: htmlToText(html),
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
}

function htmlToText(html: string): string {
  // Minimal, safe fallback: strip tags and collapse whitespace.
  // This is used for recipients/clients that prefer plain text.
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

/**
 * Send email using Resend API
 * This action replaces the Express /api/email/send endpoint
 */
export const sendEmail = internalAction({
  args: {
    templateName: v.string(),
    variables: v.record(v.string(), v.union(v.string(), v.number())),
    to: v.string(),
    replyTo: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<SendEmailResult> => {
    return await renderAndSendTemplateEmail(ctx, {
      templateName: args.templateName,
      variables: args.variables as Record<string, string | number>,
      to: args.to,
      replyTo: args.replyTo,
      language: args.language,
    });
  },
});

async function getSuperadminUser(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user || user.role !== "superadmin") return null;
  return user;
}

/**
 * Superadmin-only: send a test email based on an email template.
 * Note: this sends the SAVED template version (from DB) to match real delivery.
 * It can send even if the template is inactive.
 */
export const sendTestEmail = action({
  args: {
    templateName: v.string(),
    to: v.string(),
    variables: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    replyTo: v.optional(v.string()),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Superadmin access required");

    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const template = await ctx.runQuery(api.emailTemplates.getByName, {
      name: args.templateName,
    });

    if (!template) {
      throw new Error(`Template "${args.templateName}" not found`);
    }

    const vars = (args.variables || {}) as Record<string, string | number>;

    const lang = args.language === "de" ? "de" : "en";
    const pickLocalized = (params: { legacy: string; en?: string; de?: string }) => {
      if (lang === "de") return params.de || params.en || params.legacy;
      return params.en || params.legacy;
    };

    // Signature injection (placeholder-based)
    let renderedHtml = pickLocalized({
      legacy: template.htmlContent,
      en: template.htmlContentEn,
      de: template.htmlContentDe,
    });
    if (renderedHtml.includes("{{EMAIL_SIGNATURE}}")) {
      const sig = await ctx.runQuery(api.emailTemplates.getSignatureByCategory, {
        category: template.category,
      });
      const signatureHtml =
        sig && sig.isActive
          ? pickLocalized({
              legacy: sig.htmlContent || "",
              en: sig.htmlContentEn,
              de: sig.htmlContentDe,
            })
          : "";
      renderedHtml = renderedHtml.replace(/\{\{EMAIL_SIGNATURE\}\}/g, signatureHtml);
    }

    let renderedSubject = pickLocalized({
      legacy: template.subject,
      en: template.subjectEn,
      de: template.subjectDe,
    });

    // Replace variables
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      const stringValue = String(value);
      renderedHtml = renderedHtml.replace(regex, stringValue);
      renderedSubject = renderedSubject.replace(regex, stringValue);
    }

    const { data, error } = await resend.emails.send({
      from: `Serbian AI Tutor <${FROM_EMAIL}>`,
      to: args.to,
      subject: renderedSubject,
      html: renderedHtml,
      text: htmlToText(renderedHtml),
      replyTo: args.replyTo || REPLY_TO_EMAIL,
    });

    if (error) {
      console.error("[Email Test] Failed to send email:", error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    console.log(`[Email Test] ✅ Sent test email for ${args.templateName} to ${args.to}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  },
});

/**
 * Send beta registration email (convenience wrapper)
 */
export const sendBetaRegistrationEmail = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<SendEmailResult> => {
    return await renderAndSendTemplateEmail(ctx, {
      templateName: "beta-registration",
      variables: {
        USER_NAME: args.name,
        USER_EMAIL: args.email,
        LOGIN_URL: `${process.env.VITE_APP_URL || "https://learn-with.me"}/sign-in`,
      },
      to: args.email,
      language: args.language,
    });
  },
});


/**
 * Send feedback confirmation email (convenience wrapper)
 */
export const sendFeedbackConfirmationEmail = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    feedbackType: v.string(),
    feedbackTitle: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<SendEmailResult> => {
    return await renderAndSendTemplateEmail(ctx, {
      templateName: "feedback-confirmation",
      variables: {
        USER_NAME: args.name,
        USER_EMAIL: args.email,
        FEEDBACK_TYPE: args.feedbackType,
        FEEDBACK_TITLE: args.feedbackTitle,
      },
      to: args.email,
      language: args.language,
    });
  },
});

/**
 * Send feedback admin notification email (convenience wrapper)
 */
export const sendFeedbackAdminNotificationEmail = internalAction({
  args: {
    userName: v.string(),
    userEmail: v.string(),
    feedbackType: v.string(),
    feedbackTitle: v.string(),
    feedbackDescription: v.string(),
    adminEmail: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<SendEmailResult> => {
    return await renderAndSendTemplateEmail(ctx, {
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
      language: args.language,
    });
  },
});

/**
 * Send feedback admin reply email to the user (convenience wrapper)
 */
export const sendFeedbackAdminReplyEmail = internalAction({
  args: {
    userName: v.string(),
    userEmail: v.string(),
    feedbackTitle: v.string(),
    adminReply: v.string(),
    language: v.optional(v.union(v.literal("en"), v.literal("de"))),
  },
  handler: async (ctx, args): Promise<SendEmailResult> => {
    return await renderAndSendTemplateEmail(ctx, {
      templateName: "feedback-admin-reply",
      variables: {
        USER_NAME: args.userName,
        USER_EMAIL: args.userEmail,
        FEEDBACK_TITLE: args.feedbackTitle,
        ADMIN_REPLY: args.adminReply,
      },
      to: args.userEmail,
      language: args.language,
    });
  },
});








