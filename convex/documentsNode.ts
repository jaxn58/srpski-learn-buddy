"use node";

/**
 * Node.js runtime actions for user document processing.
 *
 * Supports three extraction paths:
 *   1. Text/Markdown — direct text read
 *   2. PDF — pdf-parse first; falls back to Gemini Vision for scanned/image PDFs
 *   3. Images (JPEG, PNG, WebP) — Gemini Vision OCR
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const VISION_MODEL = "gemini-2.5-flash";
const MIN_TEXT_LENGTH_FOR_PDF = 50;

const VISION_PROMPT =
  "Extract ALL text from this document image. " +
  "Preserve the original structure (headings, paragraphs, lists, tables). " +
  "Return ONLY the extracted text — no commentary, no formatting instructions.";

/**
 * Use Gemini Vision to extract text from an image or scanned PDF.
 * Works with both raw images (JPEG/PNG/WebP) and native PDF bytes.
 */
async function extractTextWithVision(
  fileBytes: ArrayBuffer,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set — required for Vision-based text extraction");
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const base64 = Buffer.from(fileBytes).toString("base64");

  const isImage = mimeType.startsWith("image/");

  const result = await generateText({
    model: google(VISION_MODEL),
    messages: [
      {
        role: "user",
        content: isImage
          ? [
              { type: "text" as const, text: VISION_PROMPT },
              { type: "image" as const, image: base64, mediaType: mimeType },
            ]
          : [
              { type: "text" as const, text: VISION_PROMPT },
              { type: "file" as const, data: base64, mediaType: mimeType },
            ],
      },
    ],
    maxOutputTokens: 8192,
  });

  return result.text;
}

/**
 * Extract text from an uploaded file and create a draft knowledge article.
 * Scheduled by knowledge.scheduleExtraction after the admin uploads a file.
 */
// @ts-ignore TS2589
export const extractKnowledgeDocument = internalAction({
  args: {
    storageId: v.id("_storage"),
    fileType: v.string(),
    fileName: v.string(),
    category: v.string(),
    customCategory: v.optional(v.string()),
    language: v.string(),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) throw new Error("File not found in storage");

      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);

      let extractedText: string;
      let extractionMethod: "text" | "vision" = "text";
      const buffer = await response.arrayBuffer();

      if (args.fileType.startsWith("image/")) {
        extractionMethod = "vision";
        extractedText = await extractTextWithVision(buffer, args.fileType);
        console.log(`[extractKnowledge] Image → Vision OCR (${args.fileType})`);
      } else if (args.fileType === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(Buffer.from(buffer));

        if (pdfData.text && pdfData.text.trim().length > MIN_TEXT_LENGTH_FOR_PDF) {
          extractedText = pdfData.text;
          console.log(`[extractKnowledge] PDF → text extraction (${pdfData.text.trim().length} chars)`);
        } else {
          extractionMethod = "vision";
          extractedText = await extractTextWithVision(buffer, "application/pdf");
          console.log(`[extractKnowledge] PDF → Vision fallback (pdf-parse yielded ${pdfData.text?.trim().length ?? 0} chars)`);
        }
      } else {
        const decoder = new TextDecoder();
        extractedText = decoder.decode(buffer);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error(
          extractionMethod === "vision"
            ? "Vision analysis could not extract readable text."
            : "No meaningful text could be extracted from this file."
        );
      }

      const title = args.fileName.replace(/\.[^.]+$/, "");

      await ctx.runMutation(internal.knowledge.createArticleFromUpload, {
        title,
        content: extractedText.trim(),
        category: args.category,
        customCategory: args.customCategory,
        language: args.language,
        adminUserId: args.adminUserId,
        tags: ["auto-extracted"],
      });

      console.log(`[extractKnowledge] Draft article created: "${title}" (${extractionMethod}, ${extractedText.length} chars)`);
    } catch (e) {
      console.error("[extractKnowledge] Failed:", e);
      const errorTitle = `[Extraction failed] ${args.fileName}`;
      const errorContent = `Automatic text extraction failed:\n\n${e instanceof Error ? e.message : "Unknown error"}\n\nPlease upload again or create the article manually.`;
      await ctx.runMutation(internal.knowledge.createArticleFromUpload, {
        title: errorTitle,
        content: errorContent,
        category: args.category,
        customCategory: args.customCategory,
        language: args.language,
        adminUserId: args.adminUserId,
        tags: ["extraction-failed"],
      });
    }
  },
});

// @ts-ignore TS2589
export const processDocument = internalAction({
  args: {
    documentId: v.id("userDocuments"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.ai.ingestKnowledge.updateDocumentStatus, {
      documentId: args.documentId,
      status: "processing",
    });

    let extractionMethod: "text" | "vision" = "text";

    try {
      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) throw new Error("File not found in storage");

      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);

      let extractedText: string;
      const buffer = await response.arrayBuffer();

      if (args.fileType.startsWith("image/")) {
        extractionMethod = "vision";
        extractedText = await extractTextWithVision(buffer, args.fileType);
        console.log(`[processDocument] Image → Vision OCR (${args.fileType})`);
      } else if (args.fileType === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(Buffer.from(buffer));

        if (pdfData.text && pdfData.text.trim().length > MIN_TEXT_LENGTH_FOR_PDF) {
          extractedText = pdfData.text;
          console.log(`[processDocument] PDF → text extraction (${pdfData.text.trim().length} chars)`);
        } else {
          extractionMethod = "vision";
          extractedText = await extractTextWithVision(buffer, "application/pdf");
          console.log(`[processDocument] PDF → Vision fallback (pdf-parse yielded ${pdfData.text?.trim().length ?? 0} chars)`);
        }
      } else {
        const decoder = new TextDecoder();
        extractedText = decoder.decode(buffer);
      }

      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error(
          extractionMethod === "vision"
            ? "Vision analysis could not extract readable text. Please ensure the document is clearly legible."
            : "No meaningful text could be extracted from this file."
        );
      }

      await ctx.runAction(internal.ai.ingestKnowledge.ingestUserDocument, {
        documentId: args.documentId,
        userId: args.userId,
        extractedText,
      });

      await ctx.runMutation(internal.ai.ingestKnowledge.updateDocumentStatus, {
        documentId: args.documentId,
        status: "ready",
        extractionMethod,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown processing error";
      await ctx.runMutation(internal.ai.ingestKnowledge.updateDocumentStatus, {
        documentId: args.documentId,
        status: "error",
        errorMessage: errorMsg,
      });
      console.error(`[processDocument] Failed (method=${extractionMethod}):`, e);
    }
  },
});
