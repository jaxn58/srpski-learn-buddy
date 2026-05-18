import { v } from "convex/values";
import { mutation, query, action, internalAction, internalMutation, internalQuery, QueryCtx, MutationCtx } from "./_generated/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertLearnerAccountActive } from "./authz";
import { streamingComponent } from "./streaming";
import type { StreamId } from "@convex-dev/persistent-text-streaming";
import { resolveModelConfig, generateChatResponse, streamChatResponse, generateAgenticResponse, streamAgenticResponse, streamMultimodalResponse } from "./ai/chatConfig";
import { embedText } from "./ai/embeddings";

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
    messagesPerDay: 10,
    maxMessageLength: 1500,
    maxTokensOverride: 2048,
  },
  paid: {
    messagesPerMinute: 20,
    messagesPerHour: 200,
    messagesPerDay: 100,
    maxMessageLength: 3000,
    maxTokensOverride: undefined as number | undefined,
  },
};

/** Returns midnight UTC (00:00:00.000) for the day that contains `nowMs`. */
function startOfDayUtc(nowMs: number): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Check rate limits for chat messages
async function checkRateLimit(ctx: MutationCtx, userId: Id<"users">, message: string): Promise<{ allowed: boolean; reason?: string; isPaidUser?: boolean }> {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  const todayStart = startOfDayUtc(now);

  // Get user and subscription to determine limits
  const user = await ctx.db.get(userId);
  if (!user) {
    return { allowed: false, reason: "User not found" };
  }

  // Admins and superadmins have unrestricted access
  if (user.role === "admin" || user.role === "superadmin") {
    return { allowed: true, isPaidUser: true };
  }

  const subscription = await ctx.db
    .query("userSubscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  // Determine if user is paid (has active non-beta subscription)
  const isPaidUser = !!(subscription && subscription.planType !== "beta");
  const limits = isPaidUser ? RATE_LIMITS.paid : RATE_LIMITS.beta;

  // Check message length
  if (message.length > limits.maxMessageLength) {
    return {
      allowed: false,
      reason: `Message too long. Maximum ${limits.maxMessageLength} characters allowed.`,
    };
  }

  // --- Daily limit check (only user-role messages count, each = one AI call) ---
  const todayUserMessages = await ctx.db
    .query("chatMessages")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.and(
        q.gte(q.field("_creationTime"), todayStart),
        q.eq(q.field("role"), "user")
      )
    )
    .collect();

  if (todayUserMessages.length >= limits.messagesPerDay) {
    return {
      allowed: false,
      reason: `Daily limit reached. You have used all ${limits.messagesPerDay} messages for today. Come back tomorrow!`,
    };
  }

  // NOTE: Global daily budget enforcement happens in the admin dashboard (getChatUsageStats).
  // A per-message full-table-scan in checkRateLimit would be too expensive.

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

  return { allowed: true, isPaidUser };
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
    attachmentStorageId: v.optional(v.string()),
    attachmentFileName: v.optional(v.string()),
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
      ...(args.attachmentStorageId
        ? { attachmentStorageId: args.attachmentStorageId as Id<"_storage">, attachmentFileName: args.attachmentFileName }
        : {}),
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

export const batchDeleteArchivedSessions = mutation({
  args: {
    sessionIds: v.array(v.id("chatSessions")),
  },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    let deleted = 0;
    for (const sessionId of args.sessionIds) {
      const session = await ctx.db.get(sessionId);
      if (!session || session.userId !== user._id || session.archived !== true) {
        continue;
      }
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
      await ctx.db.delete(sessionId);
      deleted++;
    }
    return { deleted };
  },
});

type ChatMessageDoc = Doc<"chatMessages">;
type ChatSessionDoc = Doc<"chatSessions">;

type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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

    return { allowed: true, isPaidUser: rateLimitResult.isPaidUser ?? false };
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
    let isPaidUser = false;
    try {
      const rateLimitResult = await ctx.runMutation(api.chat.checkMessageRateLimit, {
        sessionId: args.sessionId,
        message: args.message,
      });
      isPaidUser = rateLimitResult?.isPaidUser ?? false;
    } catch (error) {
      // Rate limit error - throw it to the frontend
      throw error;
    }

    const config = await resolveModelConfig(ctx);
    // Cap output tokens for non-paid (beta) users to reduce cost
    if (!isPaidUser) {
      config.maxTokens = Math.min(config.maxTokens, RATE_LIMITS.beta.maxTokensOverride!);
    }

    await ctx.runMutation(api.chat.addMessage, {
      sessionId: args.sessionId,
      role: "user",
      content: args.message,
      unitContext: args.unitContext,
    });

    const history: ChatMessageDoc[] = await ctx.runQuery(api.chat.getMessages, {
      sessionId: args.sessionId as Id<"chatSessions">,
    });

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

    let promptDoc;
    try {
      promptDoc = await ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "default" });
    } catch (e) {
      // swallow and rely on fallback
    }
    
    const basePrompt = promptDoc?.content || getSystemPrompt(learningLanguage);
    let systemPrompt = basePrompt.replace(/\[LANGUAGE\]/g, languageName);

    // RAG v2: inject structured unit context if available
    if (args.unitContext != null) {
      const unitBlock = await ctx.runQuery(api.chat.getUnitContextBlock, {
        unitNumber: args.unitContext,
        learningLanguage,
        userId: user?._id,
      });
      if (unitBlock) {
        systemPrompt += "\n\n" + unitBlock;
      }
    }

    // RAG v3: semantic search for relevant knowledge
    try {
      const semanticContext: string = await ctx.runAction(internal.chat.semanticSearch, {
        query: args.message,
        language: learningLanguage,
        userId: user?._id,
      });
      if (semanticContext) {
        systemPrompt += "\n\n" + semanticContext;
      }
    } catch (e) {
      console.warn("[sendMessage] Semantic search failed, continuing without:", e);
    }

    const recentHistory: ChatMessageDoc[] = history.slice(-8);
    const messages: AiMessage[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    let assistantMessage: string;

    if (config.useAgenticRag) {
      try {
        assistantMessage = await generateAgenticResponse(
          config, messages, ctx, user?._id, learningLanguage
        );
      } catch (e) {
        console.warn("[sendMessage] Agentic RAG failed, falling back to standard:", e);
        assistantMessage = await generateChatResponse(config, messages);
      }
    } else {
      assistantMessage = await generateChatResponse(config, messages);
    }

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

// ============= STREAMING CHAT =============

// Internal mutation: insert an assistant message placeholder with a streamId
export const addStreamingAssistantMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Ensure the caller can only create messages for their own user record and
    // in sessions they own — prevents one authenticated user from injecting
    // messages into another user's chat history.
    if (user._id !== args.userId) throw new Error("Forbidden");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== user._id) throw new Error("Session not found");

    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      role: "assistant",
      content: "",
      streamId: args.streamId,
    });
  },
});

// Internal mutation: update the assistant message content once the stream finishes.
// Intentionally internal so no external caller can overwrite arbitrary messages.
export const finalizeStreamedMessage = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { content: args.content });
  },
});

// Build a compact RAG context block from unit data
async function buildUnitContextBlock(
  ctx: QueryCtx,
  unitNumber: number,
  learningLanguage: string,
  userId?: Id<"users">
): Promise<string | null> {
  const vocab = await ctx.db
    .query("courseVocabulary")
    .withIndex("by_unit", (q) => q.eq("unitNumber", unitNumber))
    .collect();

  if (vocab.length === 0) return null;

  const langKey = learningLanguage as "en" | "de" | "es" | "fr";
  const noteKey = `note${learningLanguage.charAt(0).toUpperCase()}${learningLanguage.slice(1)}` as
    "noteEn" | "noteDe" | "noteEs" | "noteFr";

  const vocabLines = vocab.slice(0, 30).map((v) => {
    const translation = v[langKey] || v.en || "";
    const gender = v.gender ? ` (${v.gender})` : "";
    const pron = v.pronunciation ? ` [${v.pronunciation}]` : "";
    const note = v[noteKey] || v.noteEn || "";
    const noteStr = note ? ` — ${note}` : "";
    return `- ${v.serbian}${gender}${pron} = ${translation}${noteStr}`;
  });

  // unitMetadata: user language with English fallback
  let metadata = await ctx.db
    .query("unitMetadata")
    .withIndex("by_unit_lang", (q) =>
      q.eq("unitNumber", unitNumber).eq("language", learningLanguage)
    )
    .first();
  if (!metadata && learningLanguage !== "en") {
    metadata = await ctx.db
      .query("unitMetadata")
      .withIndex("by_unit_lang", (q) =>
        q.eq("unitNumber", unitNumber).eq("language", "en")
      )
      .first();
  }

  const unitTitle = metadata?.title ?? `Unit ${unitNumber}`;

  const sections: string[] = [
    `[UNIT CONTEXT: ${unitTitle} (Unit ${unitNumber})]`,
    "",
    "Key vocabulary for this unit:",
    ...vocabLines,
  ];

  // Grammar: user language with English fallback, expanded to 3000 chars
  let grammarContent = await ctx.db
    .query("unitContent")
    .withIndex("by_unit_lang_type", (q) =>
      q.eq("unitNumber", unitNumber).eq("language", learningLanguage).eq("contentType", "grammar")
    )
    .first();
  if (!grammarContent && learningLanguage !== "en") {
    grammarContent = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", unitNumber).eq("language", "en").eq("contentType", "grammar")
      )
      .first();
  }

  if (grammarContent?.content) {
    const grammarText = grammarContent.content.slice(0, 3000);
    sections.push("", "Grammar:", grammarText);
  }

  // Phrases: user language with English fallback
  let phrasesContent = await ctx.db
    .query("unitContent")
    .withIndex("by_unit_lang_type", (q) =>
      q.eq("unitNumber", unitNumber).eq("language", learningLanguage).eq("contentType", "phrases")
    )
    .first();
  if (!phrasesContent && learningLanguage !== "en") {
    phrasesContent = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", unitNumber).eq("language", "en").eq("contentType", "phrases")
      )
      .first();
  }

  if (phrasesContent?.content) {
    sections.push("", "Key phrases:", phrasesContent.content.slice(0, 1500));
  }

  // Dialogues: user language with English fallback
  let dialoguesContent = await ctx.db
    .query("unitContent")
    .withIndex("by_unit_lang_type", (q) =>
      q.eq("unitNumber", unitNumber).eq("language", learningLanguage).eq("contentType", "dialogues")
    )
    .first();
  if (!dialoguesContent && learningLanguage !== "en") {
    dialoguesContent = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", unitNumber).eq("language", "en").eq("contentType", "dialogues")
      )
      .first();
  }

  if (dialoguesContent?.content) {
    sections.push("", "Example dialogues:", dialoguesContent.content.slice(0, 1500));
  }

  // Personalization: weak vocabulary + progress context (requires userId)
  if (userId) {
    // Load vocabulary progress for this unit's words
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (vocabProgress.length > 0) {
      const vocabIds = new Set(vocab.map((v) => v._id));
      const weakProgress = vocabProgress.filter(
        (vp) => vocabIds.has(vp.courseVocabularyId) && !vp.mastered && vp.incorrectAnswerCount > 0
      );

      if (weakProgress.length > 0) {
        const weakWords = await Promise.all(
          weakProgress.slice(0, 10).map((wp) => ctx.db.get(wp.courseVocabularyId))
        );
        const weakList = weakWords
          .filter(Boolean)
          .map((w) => w!.serbian)
          .join(", ");
        if (weakList) {
          sections.push("", "Words the user struggles with:", weakList);
        }
      }
    }

    // Load user progress summary
    const userProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (userProgress) {
      const user = await ctx.db.get(userId);
      const completedStr = userProgress.completedUnits.length > 0
        ? userProgress.completedUnits.sort((a, b) => a - b).join(", ")
        : "none";
      const xp = user?.totalXP ?? 0;
      const streak = user?.currentStreak ?? 0;
      sections.push(
        "",
        `[USER PROFILE] Unit ${userProgress.currentUnit} | Completed: ${completedStr} | XP: ${xp} | Streak: ${streak} days`
      );
    }

    // Multi-unit vocabulary: include words from the previous 2 units
    if (unitNumber > 1) {
      const prevUnits = [unitNumber - 1, unitNumber - 2].filter((u) => u >= 1);
      const prevVocabLines: string[] = [];
      for (const pu of prevUnits) {
        const prevVocab = await ctx.db
          .query("courseVocabulary")
          .withIndex("by_unit", (q) => q.eq("unitNumber", pu))
          .collect();
        const lines = prevVocab.slice(0, 15).map((v) => {
          const translation = v[langKey] || v.en || "";
          return `- ${v.serbian} = ${translation}`;
        });
        prevVocabLines.push(...lines);
      }
      if (prevVocabLines.length > 0) {
        sections.push("", "Previously learned vocabulary:", ...prevVocabLines);
      }
    }
  }

  sections.push("", "[END UNIT CONTEXT]");
  return sections.join("\n");
}

// Public query wrapper for buildUnitContextBlock (used by sendMessage action)
// @ts-ignore TS2589
export const getUnitContextBlock = query({
  args: {
    unitNumber: v.number(),
    learningLanguage: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await buildUnitContextBlock(ctx, args.unitNumber, args.learningLanguage, args.userId);
  },
});

// Internal query: gather everything the stream httpAction needs
export const getStreamContext = query({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== args.userId) return null;
    if (session.archived) return null;

    const learningLanguage = user.learningLanguage || "en";
    let languageName: string;
    switch (learningLanguage) {
      case "de": languageName = "German"; break;
      case "en": languageName = "English"; break;
      case "es": languageName = "Spanish"; break;
      case "fr": languageName = "French"; break;
      default: languageName = "English";
    }

    const history = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const recentHistory = history
      .filter((msg) => msg.content.trim() !== "")
      .slice(-8)
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // RAG: Find the most recent unitContext from user messages
    let unitContextBlock: string | null = null;
    const lastUserMsgWithUnit = [...history]
      .reverse()
      .find((m) => m.role === "user" && m.unitContext != null);

    if (lastUserMsgWithUnit?.unitContext != null) {
      unitContextBlock = await buildUnitContextBlock(
        ctx,
        lastUserMsgWithUnit.unitContext,
        learningLanguage,
        args.userId
      );
    }

    // For RAG v3 semantic search: return the last user message text
    const lastUserMessage = [...history].reverse().find((m) => m.role === "user");

    // Admins and superadmins are treated as paid (no token cap)
    let isPaidUser = user.role === "admin" || user.role === "superadmin";
    if (!isPaidUser) {
      const subscription = await ctx.db
        .query("userSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .first();
      isPaidUser = !!(subscription && subscription.planType !== "beta");
    }

    return {
      languageName,
      recentHistory,
      unitContextBlock,
      lastUserMessage: lastUserMessage?.content ?? null,
      userId: args.userId,
      learningLanguage,
      isPaidUser,
    };
  },
});

// ============= CHAT USAGE TODAY (for countdown badge) =============

export const getChatUsageToday = query({
  args: {
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    // Admins and superadmins have no limits -- hide the badge entirely
    if (user.role === "admin" || user.role === "superadmin") {
      return null;
    }

    const subscription = await ctx.db
      .query("userSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    const isPaidUser = !!(subscription && subscription.planType !== "beta");
    const limit = isPaidUser ? RATE_LIMITS.paid.messagesPerDay : RATE_LIMITS.beta.messagesPerDay;

    const todayStart = startOfDayUtc(args.nowMs);

    const todayUserMessages = await ctx.db
      .query("chatMessages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.gte(q.field("_creationTime"), todayStart),
          q.eq(q.field("role"), "user")
        )
      )
      .collect();

    const used = todayUserMessages.length;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      isPaidUser,
    };
  },
});

// ============= SEMANTIC SEARCH (RAG v3) =============

// @ts-ignore TS2589
export const semanticSearch = internalAction({
  args: {
    query: v.string(),
    language: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<string> => {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await embedText(args.query);
      console.log(`[semanticSearch] Embedding OK (${queryEmbedding.length} dims) for: "${args.query.slice(0, 60)}"`);
    } catch (e) {
      console.warn("[semanticSearch] Embedding failed, returning empty:", e);
      return "";
    }

    // Search knowledge base chunks in user language
    const kbResults = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
      vector: queryEmbedding,
      limit: 5,
      filter: (q: any) => q.eq("language", args.language),
    });

    const chunks: string[] = [];
    for (const r of kbResults) {
      const doc = await ctx.runQuery(internal.chat.getKnowledgeChunk, { id: r._id });
      if (doc) chunks.push(doc.content);
    }

    // Fallback: if user language yielded few results, supplement with English
    if (chunks.length < 3 && args.language !== "en") {
      const enResults = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
        vector: queryEmbedding,
        limit: 5 - chunks.length,
        filter: (q: any) => q.eq("language", "en"),
      });

      const existingContent = new Set(chunks);
      for (const r of enResults) {
        const doc = await ctx.runQuery(internal.chat.getKnowledgeChunk, { id: r._id });
        if (doc && !existingContent.has(doc.content)) {
          chunks.push(doc.content);
        }
      }
    }

    console.log(`[semanticSearch] Results: ${kbResults.length} KB chunks → ${chunks.length} total`);

    if (chunks.length === 0) return "";

    return "[RELEVANT KNOWLEDGE]\n\n" + chunks.join("\n\n---\n\n") + "\n\n[END RELEVANT KNOWLEDGE]";
  },
});

// @ts-ignore TS2589
export const getKnowledgeChunk = query({
  args: { id: v.id("knowledgeChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// @ts-ignore TS2589
export const getUserDocChunk = query({
  args: { id: v.id("userDocumentChunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============= AGENTIC RAG HELPERS (v6 -- internal queries for tool calls) =============

// @ts-ignore TS2589
export const getUnitVocabulary = internalQuery({
  args: {
    unitNumber: v.number(),
    langKey: v.string(),
  },
  handler: async (ctx, args) => {
    const vocab = await ctx.db
      .query("courseVocabulary")
      .withIndex("by_unit", (q) => q.eq("unitNumber", args.unitNumber))
      .collect();

    if (vocab.length === 0) return null;

    const key = args.langKey as "en" | "de" | "es" | "fr";
    const lines = vocab.map((v) => {
      const translation = v[key] || v.en || "";
      const gender = v.gender ? ` (${v.gender})` : "";
      const pron = v.pronunciation ? ` [${v.pronunciation}]` : "";
      return `${v.serbian}${gender}${pron} = ${translation}`;
    });

    return `Unit ${args.unitNumber} Vocabulary (${vocab.length} words):\n` + lines.join("\n");
  },
});

// @ts-ignore TS2589
export const getUnitContentByType = internalQuery({
  args: {
    unitNumber: v.number(),
    language: v.string(),
    contentType: v.union(
      v.literal("overview"),
      v.literal("grammar"),
      v.literal("phrases"),
      v.literal("dialogues"),
      v.literal("vocabulary"),
      v.literal("testIntroduction"),
      v.literal("practice"),
    ),
  },
  handler: async (ctx, args) => {
    let content = await ctx.db
      .query("unitContent")
      .withIndex("by_unit_lang_type", (q) =>
        q.eq("unitNumber", args.unitNumber)
          .eq("language", args.language)
          .eq("contentType", args.contentType)
      )
      .first();

    if (!content && args.language !== "en") {
      content = await ctx.db
        .query("unitContent")
        .withIndex("by_unit_lang_type", (q) =>
          q.eq("unitNumber", args.unitNumber)
            .eq("language", "en")
            .eq("contentType", args.contentType)
        )
        .first();
    }

    return content?.content ?? null;
  },
});

// @ts-ignore TS2589
export const getUserProgressForTools = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!progress) return null;

    const user = await ctx.db.get(args.userId);
    const xp = user?.totalXP ?? 0;
    const streak = user?.currentStreak ?? 0;

    // Get weak vocabulary
    const vocabProgress = await ctx.db
      .query("vocabularyProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const weakEntries = vocabProgress.filter((vp) => !vp.mastered && vp.incorrectAnswerCount > 0);
    let weakWordsStr = "";
    if (weakEntries.length > 0) {
      const weakWords = await Promise.all(
        weakEntries.slice(0, 15).map((wp) => ctx.db.get(wp.courseVocabularyId))
      );
      weakWordsStr = weakWords
        .filter(Boolean)
        .map((w) => w!.serbian)
        .join(", ");
    }

    const completedStr = progress.completedUnits.length > 0
      ? progress.completedUnits.sort((a, b) => a - b).join(", ")
      : "none";

    let result = `Current Unit: ${progress.currentUnit}\n`;
    result += `Completed Units: ${completedStr}\n`;
    result += `XP: ${xp} | Streak: ${streak} days\n`;
    if (weakWordsStr) {
      result += `Weak vocabulary: ${weakWordsStr}`;
    }

    return result;
  },
});

// @ts-ignore TS2589
export const searchVocabularyForTools = internalQuery({
  args: {
    query: v.string(),
    langKey: v.string(),
  },
  handler: async (ctx, args) => {
    const allVocab = await ctx.db.query("courseVocabulary").collect();
    const queryLower = args.query.toLowerCase();

    const matches = allVocab.filter((v) => {
      const serbian = (v.serbian || "").toLowerCase();
      const normalized = (v.serbianNormalized || "").toLowerCase();
      const en = (v.en || "").toLowerCase();
      const de = (v.de || "").toLowerCase();
      return (
        serbian.includes(queryLower) ||
        normalized.includes(queryLower) ||
        en.includes(queryLower) ||
        de.includes(queryLower)
      );
    });

    if (matches.length === 0) return null;

    const key = args.langKey as "en" | "de" | "es" | "fr";
    const lines = matches.slice(0, 10).map((v) => {
      const translation = v[key] || v.en || "";
      const gender = v.gender ? ` (${v.gender})` : "";
      const pron = v.pronunciation ? ` [${v.pronunciation}]` : "";
      return `Unit ${v.unitNumber}: ${v.serbian}${gender}${pron} = ${translation}`;
    });

    return `Found ${matches.length} match(es):\n` + lines.join("\n");
  },
});

// ============= MESSAGE FEEDBACK =============

export const submitMessageFeedback = mutation({
  args: {
    messageId: v.id("chatMessages"),
    sessionId: v.id("chatSessions"),
    rating: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message || message.role !== "assistant") {
      throw new Error("Can only rate assistant messages");
    }

    const existing = await ctx.db
      .query("chatMessageFeedback")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();

    if (existing) {
      if (existing.rating === args.rating) {
        await ctx.db.delete(existing._id);
        return { action: "removed" };
      }
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        createdAt: Date.now(),
      });
      return { action: "updated" };
    }

    await ctx.db.insert("chatMessageFeedback", {
      messageId: args.messageId,
      sessionId: args.sessionId,
      userId: user._id,
      rating: args.rating,
      createdAt: Date.now(),
    });
    return { action: "created" };
  },
});

export const getSessionFeedback = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("chatMessageFeedback")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

// httpAction: POST /chat/stream
export const streamChatMessage = httpAction(async (ctx, request) => {
  // ---- Authentication: reject unauthenticated requests immediately ----
  // The caller must supply a valid Convex/Clerk JWT as "Authorization: Bearer <token>".
  // Without this check any internet client could trigger LLM calls and bypass
  // all rate limits by supplying arbitrary userId/sessionId values.
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json() as {
    streamId: string;
    sessionId: string;
    userId: string;
    messageId: string;
    attachmentStorageId?: string;
    attachmentFileName?: string;
    attachmentFileType?: string;
  };

  const streamId = body.streamId as StreamId;
  const sessionId = body.sessionId as Id<"chatSessions">;
  const userId = body.userId as Id<"users">;
  const messageId = body.messageId as Id<"chatMessages">;

  // ---- Authorization: confirm the authenticated caller owns the given userId ----
  // This prevents an authenticated-but-malicious user from streaming on behalf of
  // another user's account (quota abuse, history injection).
  const convexUser = await ctx.runQuery(internal.users.internalGetUserByClerkId, {
    clerkId: identity.subject,
  });
  if (!convexUser || convexUser._id !== userId) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let config;
  try {
    config = await resolveModelConfig(ctx);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let promptDoc;
  try {
    promptDoc = await ctx.runQuery(internal.admin.internalGetChatPromptByName, { name: "default" });
  } catch {
    // fallback below
  }
  const basePrompt = promptDoc?.content || EMERGENCY_FALLBACK_PROMPT;

  const streamContext = await ctx.runQuery(api.chat.getStreamContext, { sessionId, userId });
  if (!streamContext) {
    return new Response(JSON.stringify({ error: "Invalid session or user" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cap output tokens for non-paid (beta) users to reduce cost
  if (!streamContext.isPaidUser) {
    config.maxTokens = Math.min(config.maxTokens, RATE_LIMITS.beta.maxTokensOverride!);
  }

  let systemPrompt = basePrompt.replace(/\[LANGUAGE\]/g, streamContext.languageName);

  if (streamContext.unitContextBlock) {
    systemPrompt += "\n\n" + streamContext.unitContextBlock;
  }

  // RAG v3: semantic search for relevant knowledge
  if (streamContext.lastUserMessage) {
    try {
      const semanticContext: string = await ctx.runAction(internal.chat.semanticSearch, {
        query: streamContext.lastUserMessage,
        language: streamContext.learningLanguage,
        userId: streamContext.userId,
      });
      if (semanticContext) {
        systemPrompt += "\n\n" + semanticContext;
      }
    } catch (e) {
      console.warn("[streamChat] Semantic search failed, continuing without:", e);
    }
  }

  // Build attachment context (inline multimodal) -- use URL to avoid OOM in httpAction
  let attachmentUrl: string | null = null;
  let attachmentMimeType: string | null = null;
  if (body.attachmentStorageId) {
    try {
      const storageId = body.attachmentStorageId as Id<"_storage">;
      const url = await ctx.storage.getUrl(storageId);
      if (url) {
        attachmentUrl = url;
        attachmentMimeType = body.attachmentFileType || "application/octet-stream";
        console.log("[streamChat] Attachment URL ready:", body.attachmentFileName, "type:", attachmentMimeType);
      }
    } catch (e) {
      console.warn("[streamChat] Failed to get attachment URL:", e);
    }
  }

  type AiContentPart =
    | { type: "text"; text: string }
    | { type: "image"; image: URL; mediaType: string }
    | { type: "file"; data: URL; mediaType: string };

  type AiMsg = { role: "system" | "user" | "assistant"; content: string | AiContentPart[] };

  const aiMessages: AiMsg[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add history, potentially making the last user message multimodal
  const history = [...streamContext.recentHistory];
  if (attachmentUrl && attachmentMimeType && history.length > 0) {
    let lastUserIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "user") { lastUserIdx = i; break; }
    }

    if (lastUserIdx >= 0) {
      const userMsg = history[lastUserIdx];
      const isImage = attachmentMimeType.startsWith("image/");
      const attachInstruction = `\n\n[The user attached a file: "${body.attachmentFileName || "attachment"}". ` +
        `Analyze the attached content and respond in the language the user is chatting in. ` +
        `Summarize, translate, or explain the content as appropriate.]`;

      const fileUrl = new URL(attachmentUrl);
      const parts: AiContentPart[] = [
        { type: "text", text: userMsg.content + attachInstruction },
      ];

      if (isImage) {
        parts.push({ type: "image", image: fileUrl, mediaType: attachmentMimeType });
      } else {
        parts.push({ type: "file", data: fileUrl, mediaType: attachmentMimeType });
      }

      for (let i = 0; i < history.length; i++) {
        if (i === lastUserIdx) {
          aiMessages.push({ role: "user", content: parts });
        } else {
          aiMessages.push(history[i]);
        }
      }
    } else {
      aiMessages.push(...history);
    }
  } else {
    aiMessages.push(...history);
  }

  const response = await streamingComponent.stream(
    ctx,
    request,
    streamId,
    async (_ctx, _request, _streamId, append) => {
      let fullText: string;
      const hasAttachment = !!attachmentUrl;

      const lastMsg = aiMessages[aiMessages.length - 1];
      const lastContentType = Array.isArray(lastMsg?.content) ? `array(${lastMsg.content.length} parts)` : typeof lastMsg?.content;
      console.log("[streamChat] Routing:", {
        hasAttachment,
        useAgenticRag: config.useAgenticRag,
        totalMessages: aiMessages.length,
        lastMessageRole: lastMsg?.role,
        lastContentType,
      });

      if (hasAttachment) {
        try {
          fullText = await streamMultimodalResponse(config, aiMessages, append);
        } catch (e) {
          console.error("[streamChat] Multimodal streaming failed:", e);
          fullText = await streamChatResponse(config, aiMessages, append);
        }
      } else if (config.useAgenticRag) {
        try {
          fullText = await streamAgenticResponse(
            config, aiMessages, append,
            ctx, streamContext.userId, streamContext.learningLanguage
          );
        } catch (e) {
          console.warn("[streamChat] Agentic RAG failed, falling back to standard:", e);
          fullText = await streamChatResponse(config, aiMessages, append);
        }
      } else {
        fullText = await streamChatResponse(config, aiMessages, append);
      }

      await ctx.runMutation(internal.chat.finalizeStreamedMessage, {
        messageId,
        content: fullText || "I'm sorry, I couldn't generate a response.",
      });
    },
  );

  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Vary", "Origin");

  return response;
});

// =============================================
// Dynamic Chat Suggestions
// =============================================

function getSeasonFromMonth(month: number): "spring" | "summer" | "autumn" | "winter" {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function isNearHoliday(holidayMmDd: string, windowDays: number, nowMs: number): boolean {
  const now = new Date(nowMs);
  const [mm, dd] = holidayMmDd.split("-").map(Number);
  const year = now.getFullYear();

  const holiday = new Date(year, mm - 1, dd);
  const diffMs = holiday.getTime() - nowMs;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (Math.abs(diffDays) <= windowDays) return true;

  const holidayNextYear = new Date(year + 1, mm - 1, dd);
  const diffNext = (holidayNextYear.getTime() - nowMs) / (1000 * 60 * 60 * 24);
  return Math.abs(diffNext) <= windowDays;
}

type ScoredSuggestion = Doc<"chatSuggestions"> & { _score: number };

function scoreSuggestion(
  s: Doc<"chatSuggestions">,
  currentUnit: number | null,
  season: "spring" | "summer" | "autumn" | "winter",
  nowMs: number
): number {
  let score = s.priority ?? 0;

  if (currentUnit !== null) {
    const min = s.unitMin ?? 0;
    const max = s.unitMax ?? 999;
    if (currentUnit >= min && currentUnit <= max) score += 10;
    else if (s.unitMin !== undefined || s.unitMax !== undefined) score -= 20;
  }

  if (s.holidayDate) {
    const window = s.holidayWindowDays ?? 7;
    if (isNearHoliday(s.holidayDate, window, nowMs)) score += 25;
    else score -= 30;
  }

  if (s.seasonalTag) {
    if (s.seasonalTag === season) score += 5;
    else score -= 5;
  }

  return score;
}

// @ts-ignore TS2589
export const getChatSuggestions = query({
  args: {
    currentUnit: v.optional(v.number()),
    language: v.optional(v.string()),
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const month = new Date(args.nowMs).getMonth();
    const season = getSeasonFromMonth(month);
    const unit = args.currentUnit ?? null;
    const lang = args.language ?? "en";

    const categories = ["language", "culture", "sos"] as const;
    const results: Array<{
      category: string;
      text: string;
      prefill: string;
    }> = [];

    for (const cat of categories) {
      const all = await ctx.db
        .query("chatSuggestions")
        .withIndex("by_category", (q) => q.eq("category", cat).eq("isActive", true))
        .collect();

      if (all.length === 0) continue;

      const scored: ScoredSuggestion[] = all.map((s) => ({
        ...s,
        _score: scoreSuggestion(s, unit, season, args.nowMs),
      }));

      scored.sort((a, b) => b._score - a._score);

      // Take top candidates and pick one randomly for variety
      const topN = scored.slice(0, Math.min(3, scored.length));
      const pick = topN[Math.floor(Math.random() * topN.length)];

      results.push({
        category: cat,
        text: lang === "de" ? pick.textDe : pick.textEn,
        prefill: lang === "de" ? pick.prefillDe : pick.prefillEn,
      });
    }

    return results;
  },
});
