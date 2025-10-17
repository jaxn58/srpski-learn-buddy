import { mysqlEnum, mysqlTable, text, timestamp, varchar, int, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for admin features.
 */
export const users = mysqlTable("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["superadmin", "admin", "student"]).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userProgress = mysqlTable("userProgress", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  currentWeek: int("currentWeek").default(1).notNull(),
  currentUnit: int("currentUnit").default(1).notNull(),
  completedUnits: text("completedUnits"), // JSON array of completed unit numbers
  learningDuration: int("learningDuration").default(12).notNull(), // Duration in weeks: 12, 24, 36, 48
  uiLanguage: varchar("uiLanguage", { length: 10 }).default("en").notNull(), // always en
  startedAt: timestamp("startedAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

export const vocabulary = mysqlTable("vocabulary", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  serbianWord: text("serbianWord").notNull(),
  englishTranslation: text("englishTranslation").notNull(),
  unitNumber: int("unitNumber").notNull(),
  mastered: boolean("mastered").default(false).notNull(),
  reviewCount: int("reviewCount").default(0).notNull(),
  lastReviewedAt: timestamp("lastReviewedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Vocabulary = typeof vocabulary.$inferSelect;
export type InsertVocabulary = typeof vocabulary.$inferInsert;

export const chatMessages = mysqlTable("chatMessages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user or assistant
  content: text("content").notNull(),
  unitContext: int("unitContext"), // Optional: which unit was being studied
  createdAt: timestamp("createdAt").defaultNow(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const exerciseResults = mysqlTable("exerciseResults", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  unitNumber: int("unitNumber").notNull(),
  exerciseType: varchar("exerciseType", { length: 50 }).notNull(),
  score: int("score").notNull(), // Percentage score
  totalQuestions: int("totalQuestions").notNull(),
  correctAnswers: int("correctAnswers").notNull(),
  completedAt: timestamp("completedAt").defaultNow(),
});

export type ExerciseResult = typeof exerciseResults.$inferSelect;
export type InsertExerciseResult = typeof exerciseResults.$inferInsert;

