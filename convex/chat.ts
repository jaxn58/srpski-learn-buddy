import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";

// Central default system prompts by language (Emergency Fallback)
const EMERGENCY_FALLBACK_PROMPT = "You are a helpful Serbian language learning assistant. Please explain Serbian grammar and vocabulary clearly.";

function getSystemPrompt(language: string = "en"): string {
  // If we ever need code fallbacks again, they go here. 
  // For now, we rely on the DB and use a minimal emergency string.
  return EMERGENCY_FALLBACK_PROMPT;
}

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

// Rate limiting configuration
const RATE_LIMITS = {
  beta: {
    messagesPerMinute: 10,
    messagesPerHour: 60,
    maxMessageLength: 1500,
  },
  paid: {
    messagesPerMinute: 20,
    messagesPerHour: 200,
    maxMessageLength: 3000,
  },
};

// Check rate limits for chat messages
async function checkRateLimit(ctx: MutationCtx, userId: Id<"users">, message: string): Promise<{ allowed: boolean; reason?: string }> {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  // Get user and subscription to determine limits
  const user = await ctx.db.get(userId);
  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  const subscription = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  // Determine if user is paid (has active non-beta subscription)
  const isPaidUser = subscription && subscription.planType !== "beta";
  const limits = isPaidUser ? RATE_LIMITS.paid : RATE_LIMITS.beta;

  // Check message length
  if (message.length > limits.maxMessageLength) {
    return {
      allowed: false,
      reason: `Message too long. Maximum ${limits.maxMessageLength} characters allowed.`,
    };
  }

  // Count messages in the last minute
  const recentMessages = await ctx.db
    .query("chatMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.gte(q.field("_creationTime"), oneMinuteAgo))
    .collect();

  if (recentMessages.length >= limits.messagesPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Maximum ${limits.messagesPerMinute} messages per minute allowed. Please wait a moment.`,
    };
  }

  // Count messages in the last hour
  const hourMessages = await ctx.db
    .query("chatMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.gte(q.field("_creationTime"), oneHourAgo))
    .collect();

  if (hourMessages.length >= limits.messagesPerHour) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Maximum ${limits.messagesPerHour} messages per hour allowed. Please try again later.`,
    };
  }

  // Check for duplicate spam (same message 3+ times in 5 minutes)
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const recentDuplicates = recentMessages.filter(
    (m) => m.content === message && m._creationTime >= fiveMinutesAgo
  );

  if (recentDuplicates.length >= 3) {
    return {
      allowed: false,
      reason: "Duplicate message detected. Please try a different message.",
    };
  }

  return { allowed: true };
}


// Get all chat sessions for current user
export const getSessions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Fetch all sessions for user and filter archived != true (backward compatibility)
    const sessions = (await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()).filter((s) => s.archived !== true);

    return sessions;
  },
});

// Get messages for a session
export const getMessages = query({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Verify session belongs to user
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      return [];
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return messages;
  },
});

// Create a new chat session
export const createSession = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const created = await ctx.db.insert("chatSessions", {
      userId: user._id,
      title: args.title,
      archived: false,
      archivedAt: undefined,
    });

    return created;
  },
});

// Update session title
export const updateSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, { title: args.title });
  },
});

// Archive a chat session (soft delete)
export const archiveSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, { archived: true, archivedAt: Date.now() });

  },
});

// List archived sessions
export const getArchivedSessions = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Archived = true; tolerate undefined
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .filter((q) => q.eq(q.field("archived"), true))
      .collect();
  },
});

// Delete a chat session and all its messages
export const deleteSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    if (!session.archived) {
      throw new Error("Cannot delete non-archived chat. Archive first.");
    }

    // Delete all messages in session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete session
    await ctx.db.delete(args.sessionId);

  },
});

// Add a message to a session
export const addMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    unitContext: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: user._id,
      role: args.role,
      content: args.content,
      unitContext: args.unitContext,
    });
  },
});

// Clear all messages in a session
export const clearSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
  },
});

// Bulk delete empty "New Chat" sessions
export const bulkDeleteNewChats = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Get all sessions with title "New Chat" for this user
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const newChatSessions = sessions.filter(s => s.title === "New Chat");
    let deletedCount = 0;

    for (const session of newChatSessions) {
      // Check if session has any messages
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .first();

      // Only delete if empty (no messages)
      if (!messages) {
        await ctx.db.delete(session._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});

// Unarchive a chat session
export const unarchiveSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, { archived: false, archivedAt: undefined });
  },
});

// Hard-delete an archived chat session and its messages
export const deleteArchivedSession = mutation({
  args: {
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }
    if (session.archived !== true) {
      throw new Error("Cannot hard-delete a non-archived chat.");
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(args.sessionId);
  },
});

type ChatMessageDoc = Doc<"chatMessages">;
type ChatSessionDoc = Doc<"chatSessions">;

type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

// AI Learn Buddy - Send message and get AI response
// Internal mutation to check rate limits (called from action)
export const checkMessageRateLimit = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Session not found");
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(ctx, user._id, args.message);
    if (!rateLimitResult.allowed) {
      throw new Error(rateLimitResult.reason || "Rate limit exceeded");
    }

    return { allowed: true };
  },
});

export const sendMessage = action({
  args: {
    sessionId: v.id("chatSessions"),
    message: v.string(),
    unitContext: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ message: string }> => {
    const session = await ctx.runQuery(api.chat.getSessionById, { sessionId: args.sessionId });
    if (session?.archived) {
      throw new Error("Cannot send messages to an archived chat.");
    }

    // Check rate limits before proceeding
    try {
      await ctx.runMutation(api.chat.checkMessageRateLimit, {
        sessionId: args.sessionId,
        message: args.message,
      });
    } catch (error) {
      // Rate limit error - throw it to the frontend
      throw error;
    }

    // Get the API key from environment
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("AI API Key missing:", {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasGemini: !!process.env.GEMINI_API_KEY,
        envKeys: Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')),
      });
      throw new Error("No AI API key configured. Please set OPENAI_API_KEY or GEMINI_API_KEY in Convex environment variables.");
    }

    // Save user message first
    await ctx.runMutation(api.chat.addMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.message,
      unitContext: args.unitContext,
    });

    // Get recent chat history for context
    const history: ChatMessageDoc[] = await ctx.runQuery(api.chat.getMessages, {
      sessionId: args.sessionId as Id<"chatSessions">,
    });

    // Determine user language
    const user = await ctx.runQuery(api.users.me, {});
    if (user) {
      assertLearnerAccountActive(user);
    }
    const learningLanguage = user?.learningLanguage || "en";
    let languageName: string;
    switch (learningLanguage) {
      case "de":
        languageName = "German";
        break;
      case "en":
        languageName = "English";
        break;
      case "es":
        languageName = "Spanish"; 
        break;
      case "fr":
        languageName = "French"; 
        break;
      default:
        languageName = "English"; 
    }

    // Build system prompt (admin-configurable with fallback)
    let promptDoc;
    try {
      // Always use the base "default" prompt, dynamic instruction handles the rest
      promptDoc = await ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "default" });
    } catch (e) {
      // swallow and rely on fallback
    }
    
    const basePrompt = promptDoc?.content || getSystemPrompt(language);
    
    // Replace [LANGUAGE] placeholder with the actual language name
    const systemPrompt = basePrompt.replace(/\[LANGUAGE\]/g, languageName);

    // Prepare messages for the AI
    const recentHistory: ChatMessageDoc[] = history.slice(-8);
    const messages: AiMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // Determine which API to use
    const isGemini = !!process.env.GEMINI_API_KEY;
    const apiUrl = isGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    
    // Use Gemini 2.5 Flash for OpenAI-compatible endpoint (recommended replacement for 2.0 Flash)
    // Available models (examples): gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
    const model = isGemini ? "gemini-2.5-flash" : "gpt-4o-mini";

    // Call the AI API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      
      console.error("AI API error:", {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        model: model,
        isGemini: isGemini,
        error: errorDetails,
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey?.substring(0, 10) + "...",
        apiKeyLength: apiKey?.length,
      });
      
      const errorMessage = typeof errorDetails === 'object' && errorDetails.error?.message
        ? errorDetails.error.message
        : errorText || `HTTP ${response.status}`;
      
      throw new Error(`AI API error: ${response.status} - ${errorMessage}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const assistantMessage =
      data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    // Save assistant response
    await ctx.runMutation(api.chat.addMessage, {
      sessionId: args.sessionId,
      role: "assistant",
      content: assistantMessage,
    });

    // Update session title if it's still "New Chat"
    const sessionForTitle: ChatSessionDoc | null = await ctx.runQuery(api.chat.getSessionById, {
      sessionId: args.sessionId as Id<"chatSessions">,
    });
    if (sessionForTitle?.title === "New Chat" && history.length <= 1) {
      const title = args.message.slice(0, 20) + (args.message.length > 20 ? "..." : "");
      await ctx.runMutation(api.chat.updateSession, {
        sessionId: args.sessionId,
        title,
      });
    }

    return { message: assistantMessage };
  },
});

// Get session by ID (helper for action)
export const getSessionById = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});



