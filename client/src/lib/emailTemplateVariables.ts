/**
 * Shared variable descriptions for email / newsletter admin UIs (English copy).
 */
export function getVariableDescription(variable: string): string {
  switch (variable) {
    case "EMAIL_SIGNATURE":
      return "Inserts the category signature (transactional/subscription/marketing) at this position.";
    case "USER_NAME":
      return "Recipient's display name.";
    case "USER_EMAIL":
      return "Recipient's email address.";
    case "UNSUBSCRIBE_LINK":
      return "Link to unsubscribe from marketing emails.";
    case "ADMIN_EMAIL":
      return "Admin/support email address (used in admin notifications).";
    case "ADMIN_URL":
      return "Link to the admin area.";
    case "SIGNUP_URL":
      return "Link to the sign-up page.";
    case "LOGIN_URL":
      return "Link to the login page.";
    case "CLERK_ID":
      return "Clerk user id (internal identifier from authentication).";
    case "CONFIRM_LINK":
      return "Double opt-in confirmation link (waitlist / legacy newsletter opt-in).";
    case "CONFIRMATION_LINK":
      return "Confirmation link (waitlist confirmation).";
    case "BETA_LAUNCH_NOTE":
      return "Optional note shown when a user did not opt into updates (waitlist).";
    case "FEEDBACK_TYPE":
      return "Feedback category/type selected by the user.";
    case "FEEDBACK_TITLE":
      return "Feedback title/summary.";
    case "FEEDBACK_DESCRIPTION":
      return "Full feedback text/details.";
    case "LINK_URL":
      return "URL for an email button/snippet link.";
    case "LINK_TEXT":
      return "Visible label text for an email button/snippet link.";
    default: {
      if (variable.endsWith("_URL")) return "A URL used in this email flow.";
      if (variable.endsWith("_EMAIL")) return "An email address used in this email flow.";
      return "Variable used by this email flow.";
    }
  }
}

export const NEWSLETTER_CORE_VARIABLES = ["USER_NAME", "USER_EMAIL", "UNSUBSCRIBE_LINK", "EMAIL_SIGNATURE"] as const;
