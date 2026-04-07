import { v } from "convex/values";
import {
  action,
  internalAction,
  internalQuery,
  internalMutation,
  mutation,
  query,
  ActionCtx,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (user) {
    assertLearnerAccountActive(user);
  }
  return user;
}

async function assertFeedbackThreadAccess(
  ctx: QueryCtx | MutationCtx,
  feedbackId: Id<"feedbackSubmissions">,
  viewer: Doc<"users">
) {
  const feedback = await ctx.db.get(feedbackId);
  if (!feedback) throw new Error("Feedback not found");
  const isStaff = viewer.role === "admin" || viewer.role === "superadmin";
  if (!isStaff && feedback.userId !== viewer._id) {
    throw new Error("Unauthorized");
  }
  return feedback;
}

type FeedbackThreadMessage = {
  _id: string;
  createdAt: number;
  body: string;
  authorKind: "user" | "admin";
  isInternal: boolean;
  authorUserId: Id<"users">;
  isSynthetic: boolean;
  authorDisplayName?: string;
};

/** Public + internal (internal only for staff). Legacy rows without feedbackMessages get synthetic items. */
export const getThread = query({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const viewer = await getCurrentUser(ctx);
    if (!viewer) return null;

    const feedback = await assertFeedbackThreadAccess(ctx, args.feedbackId, viewer);
    const isStaff = viewer.role === "admin" || viewer.role === "superadmin";

    const rows = await ctx.db
      .query("feedbackMessages")
      .withIndex("by_feedback", (q) => q.eq("feedbackId", args.feedbackId))
      .collect();

    const visible = rows
      .filter((m) => isStaff || !m.isInternal)
      .sort((a, b) => a.createdAt - b.createdAt);

    const authorIds = [...new Set(visible.map((m) => m.authorUserId))];
    const authorNames = new Map<string, string>();
    for (const id of authorIds) {
      const u = await ctx.db.get(id);
      if (u) {
        authorNames.set(
          id,
          u.name?.trim() || u.email?.trim() || "User"
        );
      }
    }

    const submitter = await ctx.db.get(feedback.userId);
    const submitterLabel =
      submitter?.name?.trim() || submitter?.email?.trim() || "Learner";

    const out: FeedbackThreadMessage[] = visible.map((m) => ({
      _id: m._id,
      createdAt: m.createdAt,
      body: m.body,
      authorKind: m.authorKind,
      isInternal: m.isInternal,
      authorUserId: m.authorUserId,
      isSynthetic: false,
      authorDisplayName:
        isStaff
          ? m.authorKind === "user"
            ? submitterLabel
            : authorNames.get(m.authorUserId) || "Admin"
          : m.authorUserId === viewer._id
            ? "You"
            : "Team",
    }));

    const publicMsgs = visible.filter((m) => !m.isInternal);
    if (publicMsgs.length === 0 && feedback.description.trim()) {
      out.unshift({
        _id: "synthetic_initial",
        createdAt: feedback.submittedAt ?? feedback._creationTime,
        body: feedback.description,
        authorKind: "user",
        isInternal: false,
        authorUserId: feedback.userId,
        isSynthetic: true,
        authorDisplayName: isStaff ? submitterLabel : viewer._id === feedback.userId ? "You" : "Team",
      });
    }

    const hasAdminPublicInDb = visible.some(
      (m) => !m.isInternal && m.authorKind === "admin"
    );
    const legacyReply = (feedback.aiSentContent || "").trim();
    if (legacyReply && !hasAdminPublicInDb) {
      const sentBy = feedback.aiSentBy;
      let adminLabel = "Admin";
      if (sentBy) {
        const fromMap = authorNames.get(sentBy);
        if (fromMap) adminLabel = fromMap;
        else {
          const su = await ctx.db.get(sentBy);
          const resolved = su?.name?.trim() || su?.email?.trim();
          if (resolved) adminLabel = resolved;
        }
      }
      out.push({
        _id: "synthetic_admin_reply",
        createdAt:
          feedback.aiSentAt ??
          feedback.reviewedAt ??
          feedback._creationTime,
        body: feedback.aiSentContent!,
        authorKind: "admin",
        isInternal: false,
        authorUserId: sentBy ?? feedback.userId,
        isSynthetic: true,
        authorDisplayName: isStaff ? adminLabel : "Team",
      });
    }

    out.sort((a, b) => a.createdAt - b.createdAt);
    return {
      feedbackId: feedback._id,
      title: feedback.title,
      type: feedback.type,
      status: feedback.status,
      submittedAt: feedback.submittedAt,
      messages: out,
    };
  },
});

// Get feedback status history
export const getStatusHistory = query({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("feedbackStatusHistory")
      .withIndex("by_feedback", (q) => q.eq("feedbackId", args.feedbackId))
      .collect();
  },
});

// Get user's feedback submissions
export const getMySubmissions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const subs = await ctx.db
      .query("feedbackSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // SECURITY: Users should not receive internal/admin-only fields (adminNotes, AI draft/internal note, etc.).
    // We only return what the user should see, plus the actual reply that was sent ("aiSentContent").
    return subs.map((s) => ({
      _id: s._id,
      _creationTime: s._creationTime,
      type: s.type,
      title: s.title,
      description: s.description,
      status: s.status,
      submittedAt: s.submittedAt,
      reviewedAt: s.reviewedAt,
      // User-visible reply (what was actually sent). Kept for backward compatibility with existing records.
      replyToUser: s.aiSentContent,
      replySentAt: s.aiSentAt,
    }));
  },
});

export const getAllSubmissions = query({
  handler: async (ctx) => {
    try {
      const user = await getCurrentUser(ctx);
      if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
        return [];
      }

      const submissions = await ctx.db.query("feedbackSubmissions").order("desc").collect();
      
      // Enrich with user info
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (sub) => {
          try {
            const submitter = await ctx.db.get(sub.userId);
            const base = {
              ...sub,
              userName: submitter?.name || submitter?.email || "Unknown",
              userEmail: submitter?.email || "",
            } as any;

            // SECURITY: admins should NOT receive AI fields in the payload.
            if (user.role === "admin") {
              delete base.aiStatus;
              delete base.aiDraftReply;
              delete base.aiInternalNote;
              delete base.aiModel;
              delete base.aiGeneratedAt;
              delete base.aiError;
              delete base.aiSentAt;
              delete base.aiSentBy;
              delete base.aiSentContent;
            }

            return base;
          } catch (e) {
            console.error(`Failed to enrich submission ${sub._id}:`, e);
            return {
              ...sub,
              userName: "Unknown (Error)",
              userEmail: "",
            };
          }
        })
      );

      return enrichedSubmissions;
    } catch (error) {
      console.error("Error loading feedback submissions:", error);
      // Return empty array instead of throwing to prevent infinite loading state
      return [];
    }
  },
});

// Count conversations needing staff attention (admin/superadmin; returns 0 for others)
export const getNewCount = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return 0;
    }

    const all = await ctx.db.query("feedbackSubmissions").collect();

    return all.filter((f) => {
      if (f.status === "completed" || f.status === "rejected") return false;
      if (f.lastThreadActivityBy === "user") return true;
      // Legacy: no thread metadata yet
      if (
        f.lastThreadActivityBy === undefined &&
        f.status === "new" &&
        !f.aiSentAt
      ) {
        return true;
      }
      return false;
    }).length;
  },
});

export const submit = mutation({
  args: {
    type: v.union(
      v.literal("bug"),
      v.literal("feature"),
      v.literal("improvement"),
      v.literal("other")
    ),
    title: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const title = String(args.title || "").trim();
    const description = String(args.description || "").trim();
    if (title.length < 10) throw new Error("Title is too short");
    if (title.length > 200) throw new Error("Title is too long");
    if (description.length < 50) throw new Error("Description is too short");
    if (description.length > 5000) throw new Error("Description is too long");

    const now = Date.now();
    const feedbackId = await ctx.db.insert("feedbackSubmissions", {
      userId: user._id,
      type: args.type,
      title,
      description,
      status: "new",
      submittedAt: now,
      aiStatus: "pending",
      lastThreadActivityBy: "user",
      lastThreadActivityAt: now,
    });

    await ctx.db.insert("feedbackMessages", {
      feedbackId,
      authorUserId: user._id,
      authorKind: "user",
      body: description,
      isInternal: false,
      createdAt: now,
    });

    try {
      await ctx.scheduler.runAfter(0, internal.feedback.notifyAdminNewUserMessage, {
        feedbackId,
        excerpt: description.slice(0, 4000),
        context: "new_submission",
      });
    } catch (e) {
      console.error("[feedback.submit] Failed to schedule admin notification:", e);
    }

    // Fire-and-forget AI analysis (superadmin-only output stored on the submission)
    try {
      await ctx.scheduler.runAfter(0, internal.feedback.generateAiForFeedback, {
        feedbackId,
        force: false,
      });
    } catch (e) {
      console.error("[feedback.submit] Failed to schedule AI generation:", e);
      // Don't throw - feedback submission must succeed even if AI scheduling fails.
    }

    return feedbackId;
  },
});

export const addUserMessage = mutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");
    if (feedback.userId !== user._id) throw new Error("Unauthorized");

    const body = String(args.body || "").trim();
    if (body.length < 1) throw new Error("Message is empty");
    if (body.length > 5000) throw new Error("Message is too long");

    const now = Date.now();
    await ctx.db.insert("feedbackMessages", {
      feedbackId: args.feedbackId,
      authorUserId: user._id,
      authorKind: "user",
      body,
      isInternal: false,
      createdAt: now,
    });

    const patch: Partial<Doc<"feedbackSubmissions">> = {
      lastThreadActivityBy: "user",
      lastThreadActivityAt: now,
    };
    if (
      feedback.status === "answered" ||
      feedback.status === "completed"
    ) {
      patch.status = "in_progress";
    }
    await ctx.db.patch(args.feedbackId, patch);

    try {
      await ctx.scheduler.runAfter(0, internal.feedback.notifyAdminNewUserMessage, {
        feedbackId: args.feedbackId,
        excerpt: body.slice(0, 4000),
        context: "follow_up",
      });
    } catch (e) {
      console.error("[feedback.addUserMessage] Failed to schedule admin notification:", e);
    }

    return { success: true as const };
  },
});

export const addAdminInternalNote = mutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    const body = String(args.body || "").trim();
    if (body.length < 1) throw new Error("Note is empty");
    if (body.length > 8000) throw new Error("Note is too long");

    const now = Date.now();
    await ctx.db.insert("feedbackMessages", {
      feedbackId: args.feedbackId,
      authorUserId: user._id,
      authorKind: "admin",
      body,
      isInternal: true,
      createdAt: now,
    });

    return { success: true as const };
  },
});

/** Public admin reply in thread without emailing the user (in-app only). */
export const addAdminPublicMessage = mutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) throw new Error("Feedback not found");

    const body = String(args.body || "").trim();
    if (body.length < 1) throw new Error("Message is empty");
    if (body.length > 8000) throw new Error("Message is too long");

    await ctx.runMutation(internal.feedback.internalRecordPublicAdminReply, {
      feedbackId: args.feedbackId,
      body,
      sentBy: user._id,
    });

    return { success: true as const };
  },
});

async function getSuperadminUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user || user.role !== "superadmin") return null;
  return user;
}

export const getAllSubmissionsForSuperadmin = query({
  handler: async (ctx) => {
    const superadmin = await getSuperadminUser(ctx);
    if (!superadmin) throw new Error("Unauthorized");

    const submissions = await ctx.db.query("feedbackSubmissions").order("desc").collect();

    // Enrich with user info
    return await Promise.all(
      submissions.map(async (sub) => {
        const submitter = await ctx.db.get(sub.userId);
        return {
          ...sub,
          userName: submitter?.name || submitter?.email || "Unknown",
          userEmail: submitter?.email || "",
        };
      })
    );
  },
});

export const internalSetAiResult = internalMutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    aiStatus: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    aiDraftReply: v.optional(v.string()),
    aiInternalNote: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    aiGeneratedAt: v.optional(v.number()),
    aiError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedbackId, {
      aiStatus: args.aiStatus,
      aiDraftReply: args.aiDraftReply,
      aiInternalNote: args.aiInternalNote,
      aiModel: args.aiModel,
      aiGeneratedAt: args.aiGeneratedAt,
      aiError: args.aiError,
    });
  },
});

type AiFeedbackResult = {
  draftReply: string;
  internalNote: string;
};

const DEFAULT_FEEDBACK_REPLY_SYSTEM_PROMPT = [
  `You are a customer support agent for "Serbian AI Tutor", a Serbian learning app.`,
  ``,
  `Write a helpful, concise, friendly reply based ONLY on the provided context. If something is not in the context, ask a focused clarifying question. Never invent facts.`,
  ``,
  `Hard rules:`,
  `- Do NOT mention AI, internal tools, admin notes, or "knowledge base".`,
  `- Do NOT promise timelines, guarantees, or specific release dates.`,
  `- Keep everything in English.`,
  ``,
  `Tasks:`,
  `1) draftReply: reply text to send to the user (English). Short paragraphs. Ask 1-2 clarifying questions if needed.`,
  `2) internalNote: AI analysis for admins only (English). Include brief hypotheses (if bug) and suggested next steps. This must NOT be written as a message to the user.`,
  ``,
  `Return ONLY valid JSON with EXACTLY these keys:`,
  `{"draftReply":"...","internalNote":"..."}`,
].join("\n");

function buildAiPrompt(params: {
  feedbackType: string;
  feedbackTitle: string;
  feedbackDescription: string;
  systemPromptOverride?: string;
  supportKnowledgeFacts?: string;
  supportKnowledgeTone?: string;
  supportKnowledgeFuture?: string;
}) {
  const systemPrompt =
    (params.systemPromptOverride || "").trim() || DEFAULT_FEEDBACK_REPLY_SYSTEM_PROMPT;

  const blocks: string[] = [];
  const facts = (params.supportKnowledgeFacts || "").trim();
  const tone = (params.supportKnowledgeTone || "").trim();
  const future = (params.supportKnowledgeFuture || "").trim();

  if (facts) {
    blocks.push(`PRODUCT FACTS (verified, highest priority)\n${facts}`);
  }
  if (tone) {
    blocks.push(`TONE & WORDING (style guidance)\n${tone}`);
  }
  if (future) {
    blocks.push(`FUTURE PLANS (defensive; no ETA, no promises)\n${future}`);
  }

  blocks.push(
    [
      `USER FEEDBACK`,
      `Type: ${params.feedbackType}`,
      `Title: ${params.feedbackTitle}`,
      `Description: ${params.feedbackDescription}`,
    ].join("\n")
  );

  return {
    systemPrompt,
    userPrompt: blocks.join("\n\n---\n\n"),
  };
}

async function callAi(
  ctx: ActionCtx,
  args: { systemPrompt: string; userPrompt: string }
): Promise<{ model: string; text: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("No AI API key configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in Convex environment variables.");
  }

  const isGemini = !!process.env.GEMINI_API_KEY;
  const apiUrl = isGemini
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const model = isGemini ? "gemini-2.5-flash" : "gpt-4o-mini";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 900,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = (await response.json()) as any;
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("AI returned no content");
  }

  return { model, text };
}

function parseAiFeedbackResult(raw: string): AiFeedbackResult {
  try {
    const parsed = JSON.parse(raw) as Partial<AiFeedbackResult>;
    const draftReply = typeof (parsed as any).draftReply === "string" ? (parsed as any).draftReply.trim() : "";
    const internalNote = typeof (parsed as any).internalNote === "string" ? (parsed as any).internalNote.trim() : "";
    if (!draftReply) {
      throw new Error("Missing draftReply");
    }
    return { draftReply, internalNote };
  } catch {
    // Fallback: store everything as draftReply (better than losing data)
    return { draftReply: raw.trim(), internalNote: "" };
  }
}

export const generateAiForFeedback = internalAction({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    force: v.boolean(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.runQuery(internal.feedback.internalGetFeedbackById, {
      feedbackId: args.feedbackId,
    });
    if (!feedback) return;

    if (!args.force && feedback.aiStatus === "ready") {
      return;
    }

    // Mark as pending and clear previous error (if any)
    await ctx.runMutation(internal.feedback.internalSetAiResult, {
      feedbackId: args.feedbackId,
      aiStatus: "pending",
      aiDraftReply: undefined,
      aiInternalNote: undefined,
      aiModel: undefined,
      aiGeneratedAt: undefined,
      aiError: undefined,
    });

    try {
      const [replySystem, facts, tone, future] = await Promise.all([
        ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "feedback_reply_system" }),
        ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "support_knowledge_facts" }),
        ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "support_knowledge_tone" }),
        ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "support_knowledge_future" }),
      ]);

      const prompt = buildAiPrompt({
        feedbackType: feedback.type,
        feedbackTitle: feedback.title,
        feedbackDescription: feedback.description,
        systemPromptOverride: replySystem?.content?.replace(/\[LANGUAGE\]/g, "English"), // Feedback is currently English-only
        supportKnowledgeFacts: facts?.content,
        supportKnowledgeTone: tone?.content,
        supportKnowledgeFuture: future?.content,
      });

      const { model, text } = await callAi(ctx, prompt);
      const result = parseAiFeedbackResult(text);

      await ctx.runMutation(internal.feedback.internalSetAiResult, {
        feedbackId: args.feedbackId,
        aiStatus: "ready",
        aiDraftReply: result.draftReply,
        aiInternalNote: result.internalNote,
        aiModel: model,
        aiGeneratedAt: Date.now(),
        aiError: undefined,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.feedback.internalSetAiResult, {
        feedbackId: args.feedbackId,
        aiStatus: "error",
        aiDraftReply: undefined,
        aiInternalNote: undefined,
        aiModel: undefined,
        aiGeneratedAt: Date.now(),
        aiError: error?.message ? String(error.message) : String(error),
      });
    }
  },
});

export const internalGetFeedbackById = internalQuery({
  args: { feedbackId: v.id("feedbackSubmissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.feedbackId);
  },
});

export const internalGetUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const internalRecordPublicAdminReply = internalMutation({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    body: v.string(),
    sentBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("feedbackMessages", {
      feedbackId: args.feedbackId,
      authorUserId: args.sentBy,
      authorKind: "admin",
      body: args.body,
      isInternal: false,
      createdAt: now,
    });
    await ctx.db.patch(args.feedbackId, {
      aiSentAt: now,
      aiSentBy: args.sentBy,
      aiSentContent: args.body,
      status: "answered",
      reviewedAt: now,
      lastThreadActivityBy: "admin",
      lastThreadActivityAt: now,
    });
  },
});

async function requireSuperadmin(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user || user.role !== "superadmin") {
    throw new Error("Unauthorized");
  }

  return user;
}

async function requireAdminOrSuperadminAction(ctx: ActionCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");

  const user = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new Error("Unauthorized");
  }

  return user;
}

export const sendAiReplyToUser = action({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    replyText: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | { success: true; emailSent: true; messageId?: string }
    | { success: true; emailSent: false; emailError: string }
  > => {
    const staff = await requireAdminOrSuperadminAction(ctx);

    const feedback = await ctx.runQuery(internal.feedback.internalGetFeedbackById, {
      feedbackId: args.feedbackId,
    });
    if (!feedback) throw new Error("Feedback not found");

    const submitter = await ctx.runQuery(internal.feedback.internalGetUserById, {
      userId: feedback.userId,
    });

    const userEmail = submitter?.email;
    const userName = submitter?.name || userEmail || "there";

    await ctx.runMutation(internal.feedback.internalRecordPublicAdminReply, {
      feedbackId: args.feedbackId,
      body: args.replyText,
      sentBy: staff._id,
    });

    // Additionally try email (best effort). Do not fail the whole operation if email is missing/fails.
    if (!userEmail) {
      return { success: true, emailSent: false, emailError: "missing_user_email" as const };
    }

    try {
      const emailResult = await ctx.runAction(internal.email.sendFeedbackAdminReplyEmail, {
        userName,
        userEmail,
        feedbackTitle: feedback.title,
        adminReply: args.replyText,
        language: submitter?.learningLanguage === "de" ? "de" : "en",
      });

      if (!emailResult?.success) {
        return { success: true, emailSent: false, emailError: String(emailResult?.error || "send_failed") };
      }

      return { success: true, emailSent: true, messageId: (emailResult as any)?.messageId };
    } catch (e: any) {
      return { success: true, emailSent: false, emailError: e?.message ? String(e.message) : String(e) };
    }
  },
});

export const regenerateAiForFeedback = action({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx);

    await ctx.runAction(internal.feedback.generateAiForFeedback, {
      feedbackId: args.feedbackId,
      force: true,
    });

    return { success: true };
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("feedbackSubmissions"),
    status: v.union(
      v.literal("new"),
      v.literal("reviewed"),
      v.literal("answered"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("rejected")
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const feedback = await ctx.db.get(args.id);
    if (!feedback) throw new Error("Feedback not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      adminNotes: args.adminNotes,
      reviewedAt: Date.now(),
    });
  },
});

export const deleteFeedback = mutation({
  args: {
    id: v.id("feedbackSubmissions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new Error("Unauthorized");
    }

    const msgs = await ctx.db
      .query("feedbackMessages")
      .withIndex("by_feedback", (q) => q.eq("feedbackId", args.id))
      .collect();
    for (const m of msgs) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const notifyAdminNewUserMessage = internalAction({
  args: {
    feedbackId: v.id("feedbackSubmissions"),
    excerpt: v.string(),
    context: v.union(v.literal("new_submission"), v.literal("follow_up")),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.runQuery(internal.feedback.internalGetFeedbackById, {
      feedbackId: args.feedbackId,
    });
    if (!feedback) return;

    const submitter = await ctx.runQuery(internal.feedback.internalGetUserById, {
      userId: feedback.userId,
    });

    const adminEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      process.env.RESEND_REPLY_TO_EMAIL ||
      "hello@jacksenn.me";

    const prefix =
      args.context === "follow_up" ? "[Follow-up] " : "[New feedback] ";

    try {
      await ctx.runAction(internal.email.sendFeedbackAdminNotificationEmail, {
        userName: submitter?.name || submitter?.email || "User",
        userEmail: submitter?.email || "",
        feedbackType: feedback.type,
        feedbackTitle: `${prefix}${feedback.title}`,
        feedbackDescription: args.excerpt,
        adminEmail,
        language: "en",
      });
    } catch (e) {
      console.error("[feedback.notifyAdminNewUserMessage] Email failed:", e);
    }
  },
});

