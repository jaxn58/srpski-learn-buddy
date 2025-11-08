import { COOKIE_NAME } from "@shared/const";
import { eq } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
import { feedbackRouter } from "./routers/feedback";
import { betaRouter } from "./routers/beta";
import { userRouter } from "./routers/user";
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
  getExerciseResults,
  addExerciseResult,
  getUnitExplanation as getUnitExplanationFromDb,
  getUser,
  getDb
} from "./db";
import { users } from "../drizzle/schema";
import { COURSE_UNITS, COURSE_WEEKS } from "../shared/courseData";
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

  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      // Return full user data from database (includes isBetaTester, isActive, etc.)
      if (!ctx.user) return null;
      const fullUser = await getUser(ctx.user.id);
      return fullUser || ctx.user;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
  }),

  chat: router({
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await getChatHistory(ctx.user.id, input.limit);
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        message: z.string(),
        unitContext: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await addChatMessage({
          id: nanoid(),
          userId: ctx.user.id,
          role: "user",
          content: input.message,
          unitContext: input.unitContext,
        });

        // Get recent chat history for context
        const history = await getChatHistory(ctx.user.id, 10);
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
- **Proactive**: Offer praise when you notice improvement ("I see you're getting much better with the locative case!")
- **Motivating**: Use positive reinforcement and Serbian expressions to build confidence
- **Personal**: Remember context from the conversation and build on it`
        };
        
        let systemPrompt = systemPrompts.en;

        if (input.unitContext) {
          const unit = COURSE_UNITS.find(u => u.number === input.unitContext);
          if (unit) {
            systemPrompt += `\n\nDie aktuelle Lektion ist: "${unit.title}" (${unit.titleEnglish})
Themen: ${unit.topics.join(", ")}
Grammatik: ${unit.grammarFocus.join(", ")}
Vokabular: ${unit.vocabularyThemes.join(", ")}`;
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

Formatting rules:
- Use Unicode characters for symbols: → (not $\\rightarrow$), × (not $\\times$), ÷ (not $\\div$)
- Use Markdown tables for structured data
- Use **bold** for emphasis, *italic* for Serbian words
- Use \`code\` only for actual code or technical terms, not for highlighting
- Never use LaTeX syntax`
        };
        
        systemPrompt += taskDescriptions.en;

        // Prepare messages for LLM
        const messages: any[] = [
          { role: "system", content: systemPrompt },
          ...history.reverse().slice(-8).map(msg => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
          })),
          { role: "user", content: input.message },
        ];

        // Call LLM
        const response = await invokeLLM({ messages });
        const content = response.choices[0]?.message?.content;
        const assistantMessage = typeof content === 'string' ? content : "Entschuldigung, ich konnte keine Antwort generieren.";

        // Save assistant response
        await addChatMessage({
          id: nanoid(),
          userId: ctx.user.id,
          role: "assistant",
          content: assistantMessage,
          unitContext: input.unitContext,
        });

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

