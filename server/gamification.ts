import { nanoid } from "nanoid";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  users,
  exerciseCompletions,
  userBadges,
  dailyActivity,
  type User,
  type InsertExerciseCompletion,
  type InsertUserBadge,
  type InsertDailyActivity,
} from "../drizzle/schema";

/**
 * Gamification System
 * 
 * XP Distribution:
 * - Unit Completion: 50 XP
 * - Exercise Completion: 16-17 XP per exercise (50 XP total for 3 exercises)
 * - Total per unit: 100 XP
 * 
 * Level System:
 * - Level = Math.floor(totalXP / 300) + 1
 * - Every 3 units = 1 level
 */

const XP_PER_UNIT = 50;
const XP_PER_EXERCISE_SET = 50; // Distributed across 3 exercises
const XP_PER_LEVEL = 300; // 3 units

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (user: User, completedUnits: number[]) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_steps",
    name: "First Steps",
    description: "Complete your first unit",
    icon: "🎯",
    condition: (user, completedUnits) => completedUnits.length >= 1,
  },
  {
    id: "airport_navigator",
    name: "Airport Navigator",
    description: "Master Unit 1: At the Airport",
    icon: "✈️",
    condition: (user, completedUnits) => completedUnits.includes(1),
  },
  {
    id: "cafe_regular",
    name: "Café Regular",
    description: "Master Unit 2: In the Café",
    icon: "☕",
    condition: (user, completedUnits) => completedUnits.includes(2),
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Complete your first week",
    icon: "🏆",
    condition: (user, completedUnits) => completedUnits.length >= 1,
  },
  {
    id: "month_master",
    name: "Month Master",
    description: "Complete 9 units",
    icon: "🌟",
    condition: (user, completedUnits) => completedUnits.length >= 9,
  },
  {
    id: "grammar_guru",
    name: "Grammar Guru",
    description: "Complete 15 units",
    icon: "📚",
    condition: (user, completedUnits) => completedUnits.length >= 15,
  },
  {
    id: "serbian_star",
    name: "Serbian Star",
    description: "Complete all 27 units",
    icon: "⭐",
    condition: (user, completedUnits) => completedUnits.length >= 27,
  },
  {
    id: "streak_starter",
    name: "Streak Starter",
    description: "Maintain a 3-day streak",
    icon: "🔥",
    condition: (user) => user.currentStreak >= 3,
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Maintain a 7-day streak",
    icon: "🔥🔥",
    condition: (user) => user.currentStreak >= 7,
  },
  {
    id: "dedicated_learner",
    name: "Dedicated Learner",
    description: "Maintain a 30-day streak",
    icon: "🔥🔥🔥",
    condition: (user) => user.currentStreak >= 30,
  },
];

/**
 * Award XP for completing a unit
 */
export async function awardUnitXP(userId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return 0;

    const newTotalXP = user.totalXP + XP_PER_UNIT;
    const newLevel = Math.floor(newTotalXP / XP_PER_LEVEL) + 1;

    await db
      .update(users)
      .set({
        totalXP: newTotalXP,
        level: newLevel,
      })
      .where(eq(users.id, userId));

    return XP_PER_UNIT;
  } catch (error) {
    console.error("[Gamification] Failed to award unit XP:", error);
    return 0;
  }
}

/**
 * Award XP for completing an exercise
 * Returns XP earned (0 if already completed or failed)
 */
export async function awardExerciseXP(
  userId: string,
  unitNumber: number,
  exerciseId: string,
  score: number,
  totalQuestions: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Check if exercise already completed
    const existing = await db
      .select()
      .from(exerciseCompletions)
      .where(
        and(
          eq(exerciseCompletions.userId, userId),
          eq(exerciseCompletions.unitNumber, unitNumber),
          eq(exerciseCompletions.exerciseId, exerciseId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return 0; // Already completed
    }

    // Only award XP if 100% correct
    if (score !== totalQuestions) {
      return 0;
    }

    // Calculate XP (distribute 50 XP across 3 exercises)
    const xpEarned = Math.floor(XP_PER_EXERCISE_SET / 3);

    // Record completion
    const completion: InsertExerciseCompletion = {
      id: nanoid(),
      userId,
      unitNumber,
      exerciseId,
      score,
      totalQuestions,
      xpEarned,
    };

    await db.insert(exerciseCompletions).values(completion);

    // Update user's total XP
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return 0;

    const newTotalXP = user.totalXP + xpEarned;
    const newLevel = Math.floor(newTotalXP / XP_PER_LEVEL) + 1;

    await db
      .update(users)
      .set({
        totalXP: newTotalXP,
        level: newLevel,
      })
      .where(eq(users.id, userId));

    return xpEarned;
  } catch (error) {
    console.error("[Gamification] Failed to award exercise XP:", error);
    return 0;
  }
}

/**
 * Check and award badges based on user progress
 */
export async function checkAndAwardBadges(
  userId: string,
  completedUnits: number[]
): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return [];

    // Get existing badges
    const existingBadges = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId));

    // Check which badges to award
    const newBadges: string[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (existingBadgeIds.has(badge.id)) continue;

      if (badge.condition(user, completedUnits)) {
        const newBadge: InsertUserBadge = {
          id: nanoid(),
          userId,
          badgeId: badge.id,
        };

        await db.insert(userBadges).values(newBadge);
        newBadges.push(badge.id);
      }
    }

    return newBadges;
  } catch (error) {
    console.error("[Gamification] Failed to check badges:", error);
    return [];
  }
}

/**
 * Update daily activity and streak
 */
export async function updateDailyActivity(userId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
    if (lastActive) {
      lastActive.setHours(0, 0, 0, 0);
    }

    // Check if already active today
    if (lastActive && lastActive.getTime() === today.getTime()) {
      return; // Already logged today
    }

    // Calculate streak
    let newStreak = 1;
    if (lastActive) {
      const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 1) {
        // Consecutive day
        newStreak = user.currentStreak + 1;
      } else if (daysDiff > 1) {
        // Streak broken
        newStreak = 1;
      }
    }

    const newLongestStreak = Math.max(user.longestStreak, newStreak);

    // Update user
    await db
      .update(users)
      .set({
        lastActiveDate: today,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
      })
      .where(eq(users.id, userId));

    // Log daily activity
    const activity: InsertDailyActivity = {
      id: nanoid(),
      userId,
      activityDate: today,
      unitsCompleted: 0,
      exercisesCompleted: 0,
      xpEarned: 0,
    };

    await db.insert(dailyActivity).values(activity);
  } catch (error) {
    console.error("[Gamification] Failed to update daily activity:", error);
  }
}

/**
 * Get user's gamification stats
 */
export async function getUserGamificationStats(userId: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;

    const badges = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));

    const completions = await db
      .select()
      .from(exerciseCompletions)
      .where(eq(exerciseCompletions.userId, userId));

    return {
      totalXP: user.totalXP,
      level: user.level,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      badges: badges.map((b) => {
        const def = BADGE_DEFINITIONS.find((d) => d.id === b.badgeId);
        return {
          ...b,
          name: def?.name || b.badgeId,
          description: def?.description || "",
          icon: def?.icon || "🏅",
        };
      }),
      exerciseCompletions: completions,
      nextLevelXP: (user.level * XP_PER_LEVEL),
      xpToNextLevel: (user.level * XP_PER_LEVEL) - user.totalXP,
    };
  } catch (error) {
    console.error("[Gamification] Failed to get stats:", error);
    return null;
  }
}

