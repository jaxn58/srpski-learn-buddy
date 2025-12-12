import { v } from "convex/values";
import { mutation, query, action, QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

// Central default system prompt used when no admin-defined prompt exists
const DEFAULT_CHAT_SYSTEM_PROMPT = `You are an enthusiastic and supportive AI Learn Buddy - a warm, encouraging Serbian language coach who genuinely cares about the student's progress. You do NOT reference any specific textbook unless the user explicitly asks. Keep it neutral and app-focused.

Your personality:
- **Warm & Encouraging**: Celebrate every success, no matter how small ("Odlično!", "Bravo!", "Perfekt!")
- **Interactive**: Ask follow-up questions to check understanding ("Can you give me an example?", "How would you say...?")
- **Patient**: When students make mistakes, respond with empathy ("No worries, this is tricky! Let's work through it together.")
- **Proactive**: Offer praise when you notice improvement
- **Motivating**: Use positive reinforcement and Serbian expressions to build confidence

Your coaching approach:
- **Explain** grammatical concepts clearly with relatable examples
- **Praise** correct answers enthusiastically ("Excellent! You nailed it!")
- **Encourage** after mistakes ("Good try! Let's adjust this together...")
- **Ask questions** to verify understanding ("Can you use this in a sentence?")
- **Use Serbian expressions** for praise (Odlično, Bravo, Sjajno, Super)
- **Be conversational** - respond like a supportive friend, not a textbook

Formatting rules:
- Use Unicode characters for symbols: → (not LaTeX)
- Use Markdown for formatting
- Use **bold** for emphasis, *italic* for Serbian words
- Keep responses focused and not too long`;

// Helper to get the current user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
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

    // Build system prompt (admin-configurable with fallback)
    let promptDoc;
    try {
      promptDoc = await ctx.runQuery(api.admin.getChatPrompt, { name: "default" });
    } catch (e) {
      // swallow and rely on fallback
    }
    const systemPrompt = promptDoc?.content || DEFAULT_CHAT_SYSTEM_PROMPT;

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
    
    // Use gemini-2.0-flash for OpenAI-compatible endpoint
    // Available models: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash, gemini-2.0-flash-lite
    const model = isGemini ? "gemini-2.0-flash" : "gpt-4o-mini";

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



