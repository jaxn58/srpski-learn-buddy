import { clerkClient } from "@clerk/express";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { feedbackRouter } from "./routers/feedback";
import { betaRouter } from "./routers/beta";
import { userRouter } from "./routers/user";
import { subscriptionRouter } from "./routers/subscription";
import { z } from "zod";
import { 
  getUserProgress, 
  createUserProgress, 
  updateUserProgress,
  getUserVocabulary,
  addVocabulary,
  updateVocabulary,
  getChatHistory,
  addChatMessage,
  clearChatHistory,
  getExerciseResults,
  addExerciseResult,
  getUnitExplanation as getUnitExplanationFromDb,
  getUser,
  upsertUser,
  getDb
} from "./db";
import { users } from "../drizzle/schema";
import { COURSE_UNITS, COURSE_WEEKS } from "../shared/data/index";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import {
  awardUnitXP,
  awardExerciseXP,
  checkAndAwardBadges,
  updateDailyActivity,
  getUserGamificationStats,
} from "./gamification";

export const appRouter = router({
  system: systemRouter,
  admin: adminRouter,
  feedback: feedbackRouter,
  beta: betaRouter,
  user: userRouter,
  subscription: subscriptionRouter,

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      // If no Clerk user ID, return null (not authenticated)
      if (!ctx.clerkUserId) {
        return null;
      }

      // Check if user exists in our database
      let user = await getUser(ctx.clerkUserId);

      // If user doesn't exist, sync from Clerk
      if (!user) {
        try {
          // Get user data from Clerk
          const clerkUser = await clerkClient.users.getUser(ctx.clerkUserId);
          
          const primaryEmail = clerkUser.emailAddresses.find(
            (email) => email.id === clerkUser.primaryEmailAddressId
          )?.emailAddress;

          const name = [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || clerkUser.username || null;

          // Create user in our database
          await upsertUser({
            id: ctx.clerkUserId,
            name,
            email: primaryEmail ?? null,
            loginMethod: "clerk",
            lastSignedIn: new Date(),
          });

          user = await getUser(ctx.clerkUserId);
          console.log(`[Auth] Synced new user from Clerk: ${ctx.clerkUserId}`);
        } catch (error) {
          console.error("[Auth] Failed to sync user from Clerk:", error);
          return null;
        }
      } else {
        // Update last signed in time
        await upsertUser({
          id: ctx.clerkUserId,
          lastSignedIn: new Date(),
        });
      }

      return user;
    }),
    
    // Logout is handled by Clerk on the frontend, but we keep this for compatibility
    logout: publicProcedure.mutation(() => {
      // Clerk handles logout on the frontend via signOut()
      return {
        success: true,
      } as const;
    }),
  }),

  course: router({
    getUnits: publicProcedure.query(() => {
      return COURSE_UNITS;
    }),

    getWeeks: publicProcedure.query(() => {
      return COURSE_WEEKS;
    }),

    getUnit: publicProcedure
      .input(z.object({ unitNumber: z.number() }))
      .query(({ input }) => {
        return COURSE_UNITS.find(u => u.number === input.unitNumber);
      }),

    getUnitExplanation: protectedProcedure
      .input(z.object({ unitNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        // Beta testers can only access Units 1-5
        if (ctx.user.isBetaTester && input.unitNumber > 5) {
          throw new Error("BETA_LOCKED");
        }
        return await getUnitExplanationFromDb(input.unitNumber);
      }),
  }),

  progress: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      let progress = await getUserProgress(ctx.user.id);
      
      if (!progress) {
        // Create initial progress for new user
        const newProgress = {
          id: nanoid(),
          userId: ctx.user.id,
          currentWeek: 1,
          currentUnit: 1,
          completedUnits: JSON.stringify([]),
          learningDuration: 12,
          uiLanguage: "en",
          startedAt: new Date(),
          lastActivityAt: new Date(),
        };
        await createUserProgress(newProgress);
        // Return with parsed completedUnits
        progress = {
          ...newProgress,
          completedUnits: []
        };
      }

      // getUserProgress already parses completedUnits
      return progress;
    }),

    update: protectedProcedure
      .input(z.object({
        currentWeek: z.number().optional(),
        currentUnit: z.number().optional(),
        completedUnits: z.array(z.number()).optional(),
        learningDuration: z.number().optional(),
        uiLanguage: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updates: any = {};
        if (input.currentWeek !== undefined) updates.currentWeek = input.currentWeek;
        if (input.currentUnit !== undefined) updates.currentUnit = input.currentUnit;
        if (input.completedUnits !== undefined) {
          updates.completedUnits = JSON.stringify(input.completedUnits);
        }
        if (input.learningDuration !== undefined) updates.learningDuration = input.learningDuration;
        if (input.uiLanguage !== undefined) updates.uiLanguage = input.uiLanguage;

        await updateUserProgress(ctx.user.id, updates);
        return { success: true };
      }),

    completeUnit: protectedProcedure
      .input(z.object({ unitNumber: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Beta testers can only complete Units 1-5
        if (ctx.user.isBetaTester && input.unitNumber > 5) {
          throw new Error("BETA_LOCKED");
        }
        
        const progress = await getUserProgress(ctx.user.id);
        if (!progress) throw new Error("Progress not found");

        // getUserProgress already returns parsed completedUnits array
        const completed = progress.completedUnits || [];
        let xpEarned = 0;
        let newBadges: string[] = [];

        if (!completed.includes(input.unitNumber)) {
          completed.push(input.unitNumber);
          
          // Award XP for unit completion (50 XP)
          xpEarned = await awardUnitXP(ctx.user.id);
          
          // Check and award badges
          newBadges = await checkAndAwardBadges(ctx.user.id, completed);
          
          // Update daily activity and streak
          await updateDailyActivity(ctx.user.id);
          
          // Find next incomplete unit
          let nextUnit = 1;
          for (let i = 1; i <= 27; i++) {
            if (!completed.includes(i)) {
              nextUnit = i;
              break;
            }
          }
          
          const updates: any = {
            completedUnits: JSON.stringify(completed),
            currentUnit: nextUnit, // Always update to next incomplete unit
          };
          
          // Also update week if needed (every ~2-3 units per week depending on duration)
          const unitsPerWeek = Math.ceil(27 / (progress.learningDuration || 12));
          const newWeek = Math.ceil(nextUnit / unitsPerWeek);
          if (newWeek !== progress.currentWeek) {
            updates.currentWeek = newWeek;
          }
          
          await updateUserProgress(ctx.user.id, updates);
        }

        return { 
          success: true,
          xpEarned,
          newBadges,
        };
      }),
  }),

  vocabulary: router({
    getByUnit: protectedProcedure
      .input(z.object({ unitNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        const allVocab = await getUserVocabulary(ctx.user.id);
        return allVocab.filter(v => v.unitNumber === input.unitNumber);
      }),

    getAll: protectedProcedure.query(async ({ ctx }) => {
      return await getUserVocabulary(ctx.user.id);
    }),

    add: protectedProcedure
      .input(z.object({
        serbianWord: z.string(),
        englishTranslation: z.string(),
        unitNumber: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await addVocabulary({
          id: nanoid(),
          userId: ctx.user.id,
          ...input,
          mastered: false,
          reviewCount: 0,
        });
        return { success: true };
      }),

    markMastered: protectedProcedure
      .input(z.object({ id: z.string(), mastered: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await updateVocabulary(input.id, {
          mastered: input.mastered,
          lastReviewedAt: new Date(),
        });
        return { success: true };
      }),

    getQuizProgress: protectedProcedure
      .input(z.object({ unitNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getQuizProgress } = await import("./db");
        return await getQuizProgress(ctx.user.id, input.unitNumber);
      }),

    saveQuizAnswer: protectedProcedure
      .input(z.object({
        unitNumber: z.number(),
        currentIndex: z.number(),
        isCorrect: z.boolean(),
        wordId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { saveQuizAnswer } = await import("./db");
        await saveQuizAnswer(ctx.user.id, input.unitNumber, input.currentIndex, input.isCorrect, [input.wordId]);
        return { success: true };
      }),

    completeQuiz: protectedProcedure
      .input(z.object({
        unitNumber: z.number(),
        score: z.number(),
        total: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { upsertQuizProgress, getQuizProgress } = await import("./db");
        const progress = await getQuizProgress(ctx.user.id, input.unitNumber);
        const percentage = Math.round((input.score / input.total) * 100);

        await upsertQuizProgress({
          id: (progress as any)?.id ?? nanoid(),
          userId: ctx.user.id,
          unitNumber: input.unitNumber,
          currentIndex: 0,
          totalAttempts: (progress?.totalAttempts || 0) + 1,
          lastScore: percentage,
          incorrectWordIds: progress?.incorrectWordIds || "[]",
          lastAttemptAt: new Date(),
        });
        return { success: true, percentage };
      }),

    resetQuizProgress: protectedProcedure
      .input(z.object({ unitNumber: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { resetQuizProgress } = await import("./db");
        await resetQuizProgress(ctx.user.id, input.unitNumber);
        return { success: true };
      }),
  }),

  chat: router({
    // Session management
    getSessions: protectedProcedure
      .query(async ({ ctx }) => {
        const { getChatSessions } = await import("./chatSessions");
        return await getChatSessions(ctx.user.id);
      }),

    createSession: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const { createChatSession } = await import("./chatSessions");
        const sessionId = nanoid();
        await createChatSession({
          id: sessionId,
          userId: ctx.user.id,
          title: input.title || "New Chat",
        });
        return { sessionId };
      }),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteChatSession } = await import("./chatSessions");
        await deleteChatSession(input.sessionId);
        return { success: true };
      }),

    bulkDeleteNewChats: protectedProcedure
      .mutation(async ({ ctx }) => {
        const { bulkDeleteChatSessionsByTitle } = await import("./chatSessions");
        const deletedCount = await bulkDeleteChatSessionsByTitle(ctx.user.id, "New Chat");
        return { success: true, deletedCount };
      }),

    getSessionMessages: protectedProcedure
      .input(z.object({ sessionId: z.string(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getChatMessagesBySession } = await import("./chatSessions");
        return await getChatMessagesBySession(input.sessionId, input.limit || 50);
      }),

    // Legacy endpoints (deprecated, keep for backward compatibility)
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await getChatHistory(ctx.user.id, input.limit);
      }),

    clearHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        await clearChatHistory(ctx.user.id);
        return { success: true };
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        message: z.string(),
        unitContext: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { addChatMessageToSession, getChatMessagesBySession, updateChatSessionTitle } = await import("./chatSessions");
        
        // Save user message
        await addChatMessageToSession({
          id: nanoid(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          role: "user",
          content: input.message,
          unitContext: input.unitContext,
        });

        // Get recent chat history for context (from this session only)
        const history = await getChatMessagesBySession(input.sessionId, 10);
        const progress = await getUserProgress(ctx.user.id);

        // Always use English
        const userLanguage = 'en';
        
        // Build context for AI
        const systemPrompts = {
          de: `Du bist ein freundlicher und geduldiger Serbisch-Professor. Du hilfst Studenten beim Lernen der serbischen Sprache mit dem Kursbuch "Step by Step Serbian 1".

Der Student ist aktuell in Woche ${progress?.currentWeek || 1}, Lektion ${progress?.currentUnit || 1}.`,
          en: `You are an enthusiastic and supportive AI Learn Buddy - a warm, encouraging Serbian language coach who genuinely cares about the student's progress. You use the course book "Step by Step Serbian 1" as your teaching foundation.

The student is currently in week ${progress?.currentWeek || 1}, lesson ${progress?.currentUnit || 1}.

Your personality:
- **Warm & Encouraging**: Celebrate every success, no matter how small ("Odlično!", "Bravo!", "Perfekt!")
- **Interactive**: Ask follow-up questions to check understanding ("Can you give me an example?", "How would you say...?")
- **Patient**: When students make mistakes, respond with empathy ("No worries, this is tricky! Let's work through it together.")
- **Proactive**: Offer praise when you notice improvement ("I see you're making great progress with this grammar concept!")
- **Motivating**: Use positive reinforcement and Serbian expressions to build confidence
- **Personal**: Remember context from the conversation and build on it

CRITICAL RULE: If you have already explained a grammar concept in this conversation, DO NOT explain it again unless the student specifically asks for clarification. Move the conversation forward instead.`
        };
        
        let systemPrompt = systemPrompts.en;

        if (input.unitContext) {
          const unit = COURSE_UNITS.find(u => u.number === input.unitContext);
          if (unit) {
            systemPrompt += `\n\nCurrent lesson context (for reference only - only mention if directly relevant to the student's question):
- Title: "${unit.title}" (${unit.titleEnglish})
- Topics: ${unit.topics.join(", ")}
- Vocabulary themes: ${unit.vocabularyThemes.join(", ")}

IMPORTANT: Only reference the grammar focus if the student asks about it directly. Do NOT force it into every response.`;
          }
        }

        const taskDescriptions = {
          de: `\n\nDeine Aufgaben:
- Erkläre grammatikalische Konzepte klar und mit Beispielen
- Korrigiere Fehler sanft und konstruktiv
- Gib praktische Übungen und Beispiele
- Antworte auf Deutsch, aber verwende serbische Beispiele
- Sei ermutigend und motivierend
- Wenn der Student auf Serbisch schreibt, korrigiere Fehler und erkläre sie`,
          en: `\n\nYour coaching approach:
- **Explain** grammatical concepts clearly with relatable examples
- **Praise** correct answers enthusiastically ("Excellent! You nailed it!")
- **Encourage** after mistakes ("Good try! Let's adjust this together...")
- **Ask questions** to verify understanding ("Can you use this in a sentence?")
- **Celebrate progress** when you notice improvement
- **Use Serbian expressions** for praise (Odlično, Bravo, Sjajno, Super)
- **Be conversational** - respond like a supportive friend, not a textbook
- **Check understanding** by asking the student to apply what they learned

Interaction style:
- Start responses with acknowledgment ("Great question!", "I love your curiosity!")
- End with encouragement or a follow-up question
- When correcting, sandwich feedback: praise → correction → encouragement
- Respond in English, but sprinkle in Serbian praise and examples

🚨 CRITICAL INSTRUCTION 🚨
The conversation history is provided for CONTEXT ONLY.
Answer ONLY the student's CURRENT question.
Do NOT continue explaining topics from previous messages.
Do NOT assume the student wants to continue the previous topic.
If the student asks "How are you?" → just answer how you are, nothing else.
If the student asks a NEW question → answer THAT question only.
Only continue a previous topic if the student explicitly references it.

Formatting rules:
- Use Unicode characters for symbols: → (not $\\rightarrow$), × (not $\\times$), ÷ (not $\\div$)
- Use Markdown tables for structured data
- Use **bold** for emphasis, *italic* for Serbian words
- Use \`code\` only for actual code or technical terms, not for highlighting
- Never use LaTeX syntax`
        };
        
        systemPrompt += taskDescriptions.en;

        // Prepare messages for LLM
        // History is already in correct order (oldest first), just take last 8 messages
        const recentHistory = history.slice(-8);
        
        const messages: any[] = [
          { role: "system", content: systemPrompt },
          ...recentHistory.map(msg => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
          })),
        ];

        // Call LLM
        const response = await invokeLLM({ messages });
        const content = response.choices[0]?.message?.content;
        const assistantMessage = typeof content === 'string' ? content : "Entschuldigung, ich konnte keine Antwort generieren.";

        // Save assistant response
        await addChatMessageToSession({
          id: nanoid(),
          sessionId: input.sessionId,
          userId: ctx.user.id,
          role: "assistant",
          content: assistantMessage,
          unitContext: input.unitContext,
        });
        
        // Auto-generate title from first user message if still "New Chat"
        // history.length === 1 means only the user message we just added (no assistant response yet)
        if (history.length === 1) {
          const title = input.message.slice(0, 12) + (input.message.length > 12 ? "..." : "");
          await updateChatSessionTitle(input.sessionId, title);
        }

        return {
          message: assistantMessage,
        };
      }),
  }),

  gamification: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return await getUserGamificationStats(ctx.user.id);
    }),
  }),

  exercises: router({
    getResults: protectedProcedure
      .input(z.object({ unitNumber: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const allResults = await getExerciseResults(ctx.user.id);
        if (input.unitNumber) {
          return allResults.filter(r => r.unitNumber === input.unitNumber);
        }
        return allResults;
      }),

    submitResult: protectedProcedure
      .input(z.object({
        unitNumber: z.number(),
        exerciseType: z.string(),
        exerciseId: z.string(),
        totalQuestions: z.number(),
        correctAnswers: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Beta testers can only submit exercises for Units 1-5
        if (ctx.user.isBetaTester && input.unitNumber > 5) {
          throw new Error("BETA_LOCKED");
        }
        
        const score = Math.round((input.correctAnswers / input.totalQuestions) * 100);
        
        // Award XP if 100% correct (16-17 XP per exercise)
        const xpEarned = await awardExerciseXP(
          ctx.user.id,
          input.unitNumber,
          input.exerciseId,
          input.correctAnswers,
          input.totalQuestions
        );
        
        await addExerciseResult({
          id: nanoid(),
          userId: ctx.user.id,
          unitNumber: input.unitNumber,
          exerciseType: input.exerciseType,
          score,
          totalQuestions: input.totalQuestions,
          correctAnswers: input.correctAnswers,
        });

        return { 
          success: true, 
          score,
          xpEarned,
          perfectScore: input.correctAnswers === input.totalQuestions,
        };
      }),
  }),


});

export type AppRouter = typeof appRouter;

