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
  isActive: boolean("isActive").default(false).notNull(), // New users start inactive, Superadmin must activate
  isBetaTester: boolean("isBetaTester").default(false).notNull(), // Badge for beta testers
  createdAt: timestamp("createdAt").defaultNow(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
  // Gamification fields
  totalXP: int("totalXP").default(0).notNull(),
  level: int("level").default(1).notNull(),
  currentStreak: int("currentStreak").default(0).notNull(),
  longestStreak: int("longestStreak").default(0).notNull(),
  lastActiveDate: timestamp("lastActiveDate"),
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



export const unitExplanations = mysqlTable("unitExplanations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  unitNumber: int("unitNumber").notNull().unique(),
  overview: text("overview").notNull(),
  grammarExplained: text("grammarExplained").notNull(),
  practiceExamples: text("practiceExamples").notNull(),
  bookReference: text("bookReference"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export type UnitExplanation = typeof unitExplanations.$inferSelect;
export type InsertUnitExplanation = typeof unitExplanations.$inferInsert;

// Gamification: Exercise Completions
export const exerciseCompletions = mysqlTable("exerciseCompletions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  unitNumber: int("unitNumber").notNull(),
  exerciseId: varchar("exerciseId", { length: 100 }).notNull(), // e.g., "unit1_biti_conjugation"
  score: int("score").notNull(), // Number of correct answers
  totalQuestions: int("totalQuestions").notNull(),
  xpEarned: int("xpEarned").notNull(),
  completedAt: timestamp("completedAt").defaultNow(),
});

export type ExerciseCompletion = typeof exerciseCompletions.$inferSelect;
export type InsertExerciseCompletion = typeof exerciseCompletions.$inferInsert;

// Gamification: Achievement Badges
export const userBadges = mysqlTable("userBadges", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  badgeId: varchar("badgeId", { length: 100 }).notNull(), // e.g., "first_steps", "cafe_regular"
  earnedAt: timestamp("earnedAt").defaultNow(),
});

export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = typeof userBadges.$inferInsert;

// Gamification: Daily Activity Log
export const dailyActivity = mysqlTable("dailyActivity", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  activityDate: timestamp("activityDate").notNull(), // Date only (midnight)
  unitsCompleted: int("unitsCompleted").default(0).notNull(),
  exercisesCompleted: int("exercisesCompleted").default(0).notNull(),
  xpEarned: int("xpEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type DailyActivity = typeof dailyActivity.$inferSelect;
export type InsertDailyActivity = typeof dailyActivity.$inferInsert;



// Feedback and Wish List Submissions
export const feedbackSubmissions = mysqlTable("feedbackSubmissions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["bug", "feature", "improvement", "other"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["new", "reviewed", "in_progress", "completed", "rejected"]).default("new").notNull(),
  adminNotes: text("adminNotes"),
  submittedAt: timestamp("submittedAt").defaultNow(),
  reviewedAt: timestamp("reviewedAt"),
});

export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
export type InsertFeedbackSubmission = typeof feedbackSubmissions.$inferInsert;



// Beta Testing Registrations (before OAuth login)
export const betaRegistrations = mysqlTable("betaRegistrations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  motivation: text("motivation"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  registeredAt: timestamp("registeredAt").defaultNow(),
  reviewedAt: timestamp("reviewedAt"),
});

export type BetaRegistration = typeof betaRegistrations.$inferSelect;
export type InsertBetaRegistration = typeof betaRegistrations.$inferInsert;

