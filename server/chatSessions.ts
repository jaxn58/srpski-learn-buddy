import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import { chatSessions, chatMessages, InsertChatSession, InsertChatMessage } from "../drizzle/schema";

// ============= CHAT SESSIONS =============

export async function createChatSession(session: InsertChatSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatSessions).values(session);
  return session;
}

export async function getChatSessions(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
}

export async function getChatSession(sessionId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(chatSessions)
    .set({ title, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function updateChatSessionTimestamp(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function deleteChatSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all messages in this session first
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  
  // Then delete the session
  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
}

export async function bulkDeleteChatSessionsByTitle(userId: string, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find all sessions with the specified title for this user
  const sessionsToDelete = await db.select().from(chatSessions)
    .where(and(
      eq(chatSessions.userId, userId),
      eq(chatSessions.title, title)
    ));

  // Delete messages for each session
  for (const session of sessionsToDelete) {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, session.id));
  }

  // Delete all sessions with the specified title
  await db.delete(chatSessions)
    .where(and(
      eq(chatSessions.userId, userId),
      eq(chatSessions.title, title)
    ));

  return sessionsToDelete.length;
}

// ============= CHAT MESSAGES (Session-aware) =============

export async function getChatMessagesBySession(sessionId: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

export async function addChatMessageToSession(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatMessages).values(message);
  
  // Update session timestamp
  await updateChatSessionTimestamp(message.sessionId);
}

