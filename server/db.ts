import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, userProgress, InsertUserProgress, vocabulary, InsertVocabulary, chatMessages, InsertChatMessage, exerciseResults, InsertExerciseResult, unitExplanations, feedbackComments, InsertFeedbackComment, feedbackStatusHistory, InsertFeedbackStatusHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id) {
    throw new Error("User ID is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      id: user.id,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    // Set owner as superadmin and active by default
    if (user.id === ENV.ownerId) {
      values.role = 'superadmin';
      updateSet.role = 'superadmin';
      values.isActive = true;
      updateSet.isActive = true;
    } else if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }
    
    // Handle isActive field
    if (user.isActive !== undefined) {
      values.isActive = user.isActive;
      updateSet.isActive = user.isActive;
    }
    
    // Handle isBetaTester field
    if (user.isBetaTester !== undefined) {
      values.isBetaTester = user.isBetaTester;
      updateSet.isBetaTester = user.isBetaTester;
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUser(id: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get users: database not available");
    return [];
  }

  return await db.select().from(users);
}

export async function updateUserRole(userId: string, role: 'superadmin' | 'admin' | 'student') {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user role: database not available");
    return;
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ============= USER PROGRESS =============

export async function getUserProgress(userId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(userProgress)
    .where(eq(userProgress.userId, userId)).limit(1);
  
  if (result.length > 0) {
    const progress = result[0];
    let completedUnits = [];
    
    if (progress.completedUnits) {
      try {
        completedUnits = JSON.parse(progress.completedUnits);
      } catch (error) {
        console.error('[Database] Failed to parse completedUnits:', error);
        completedUnits = [];
      }
    }
    
    return {
      ...progress,
      completedUnits
    };
  }
  return undefined;
}

export async function createUserProgress(progress: InsertUserProgress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(userProgress).values(progress);
}

export async function updateUserProgress(userId: string, updates: Partial<InsertUserProgress>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(userProgress).set(updates).where(eq(userProgress.userId, userId));
}

export async function getAllUserProgress() {
  const db = await getDb();
  if (!db) return [];

  const results = await db.select().from(userProgress);
  return results.map(progress => {
    let completedUnits = [];
    
    if (progress.completedUnits) {
      try {
        completedUnits = JSON.parse(progress.completedUnits);
      } catch (error) {
        console.error('[Database] Failed to parse completedUnits:', error);
        completedUnits = [];
      }
    }
    
    return {
      ...progress,
      completedUnits
    };
  });
}

// ============= VOCABULARY =============

export async function getUserVocabulary(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(vocabulary).where(eq(vocabulary.userId, userId));
}

export async function addVocabulary(vocab: InsertVocabulary) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(vocabulary).values(vocab);
}

export async function updateVocabulary(id: string, updates: Partial<InsertVocabulary>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(vocabulary).set(updates).where(eq(vocabulary.id, id));
}

// ============= CHAT MESSAGES =============

export async function getChatHistory(userId: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

export async function addChatMessage(message: InsertChatMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(chatMessages).values(message);
}

// ============= EXERCISE RESULTS =============

export async function getExerciseResults(userId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select(). from(exerciseResults)
    .where(eq(exerciseResults.userId, userId))
    .orderBy(exerciseResults.completedAt);
}

export async function addExerciseResult(result: InsertExerciseResult) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(exerciseResults).values(result);
}



// ============= UNIT EXPLANATIONS =============

export async function getUnitExplanation(unitNumber: number) {
  console.log('[getUnitExplanation] Called with unitNumber:', unitNumber);
  const db = await getDb();
  if (!db) {
    console.log('[getUnitExplanation] Database not available!');
    return undefined;
  }

  const result = await db.select().from(unitExplanations)
    .where(eq(unitExplanations.unitNumber, unitNumber))
    .limit(1);
  
  console.log('[getUnitExplanation] Result:', result.length > 0 ? 'Found' : 'Not found', result.length > 0 ? `(${result[0].overview?.length} chars)` : '');
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUnitExplanations() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(unitExplanations);
}



// ============= FEEDBACK COMMENTS =============

export async function getFeedbackComments(feedbackId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(feedbackComments)
    .where(eq(feedbackComments.feedbackId, feedbackId))
    .orderBy(feedbackComments.createdAt);
}

export async function addFeedbackComment(comment: InsertFeedbackComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(feedbackComments).values(comment);
}

export async function deleteFeedbackComment(commentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(feedbackComments).where(eq(feedbackComments.id, commentId));
}

// ============= FEEDBACK STATUS HISTORY =============

export async function getFeedbackStatusHistory(feedbackId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(feedbackStatusHistory)
    .where(eq(feedbackStatusHistory.feedbackId, feedbackId))
    .orderBy(feedbackStatusHistory.changedAt);
}

export async function addFeedbackStatusChange(statusChange: InsertFeedbackStatusHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(feedbackStatusHistory).values(statusChange);
}

