import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User progress through the 12-week course
 */
export const userProgress = mysqlTable("userProgress", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  currentWeek: int("currentWeek").default(1).notNull(),
  currentUnit: int("currentUnit").default(1).notNull(),
  completedUnits: text("completedUnits"), // JSON array of completed unit IDs
  startedAt: timestamp("startedAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

/**
 * Vocabulary items learned by users
 */
export const vocabulary = mysqlTable("vocabulary", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  serbianWord: varchar("serbianWord", { length: 255 }).notNull(),
  englishTranslation: varchar("englishTranslation", { length: 255 }).notNull(),
  unitNumber: int("unitNumber").notNull(),
  mastered: boolean("mastered").default(false).notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  lastReviewedAt: timestamp("lastReviewedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Vocabulary = typeof vocabulary.$inferSelect;
export type InsertVocabulary = typeof vocabulary.$inferInsert;

/**
 * Chat conversations with the AI professor
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  unitContext: int("unitContext"), // Which unit this conversation is related to
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Exercise results and quiz scores
 */
export const exerciseResults = mysqlTable("exerciseResults", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  unitNumber: int("unitNumber").notNull(),
  exerciseType: varchar("exerciseType", { length: 64 }).notNull(), // "vocabulary", "grammar", "translation"
  score: int("score").notNull(), // Percentage 0-100
  totalQuestions: int("totalQuestions").notNull(),
  correctAnswers: int("correctAnswers").notNull(),
  completedAt: timestamp("completedAt").defaultNow(),
});

export type ExerciseResult = typeof exerciseResults.$inferSelect;
export type InsertExerciseResult = typeof exerciseResults.$inferInsert;

