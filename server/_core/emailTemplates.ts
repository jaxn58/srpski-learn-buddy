/**
 * Email template helper - fetches templates from Convex and renders them
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(convexUrl);
  }
  return convexClient;
}

export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

/**
 * Render an email template from Convex with variables
 */
export async function renderEmailTemplate(
  templateName: string,
  variables: TemplateVariables
): Promise<{ subject: string; html: string }> {
  try {
    const client = getConvexClient();
    const result = await client.query(api.emailTemplates.render, {
      templateName,
      variables: variables as Record<string, string | number>,
    });

    if (!result) {
      throw new Error(`Template "${templateName}" not found or not active`);
    }

    return result;
  } catch (error) {
    console.error(`[Email Templates] Failed to render template "${templateName}":`, error);
    throw error;
  }
}

/**
 * Get template by name (for validation)
 */
export async function getEmailTemplate(templateName: string) {
  try {
    const client = getConvexClient();
    return await client.query(api.emailTemplates.getByName, { name: templateName });
  } catch (error) {
    console.error(`[Email Templates] Failed to get template "${templateName}":`, error);
    return null;
  }
}

