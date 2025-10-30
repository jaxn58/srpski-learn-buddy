import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { adminRouter } from "./routers/admin";
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
  getUnitExplanation as getUnitExplanationFromDb
} from "./db";
import { COURSE_UNITS, COURSE_WEEKS } from "../shared/courseData";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  admin: adminRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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

    getUnitExplanation: publicProcedure
      .input(z.object({ unitNumber: z.number() }))
      .query(async ({ input }) => {
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
        const progress = await getUserProgress(ctx.user.id);
        if (!progress) throw new Error("Progress not found");

        // getUserProgress already returns parsed completedUnits array
        const completed = progress.completedUnits || [];
        if (!completed.includes(input.unitNumber)) {
          completed.push(input.unitNumber);
          
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

        return { success: true };
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
          en: `You are a friendly and patient Serbian language professor. You help students learn Serbian using the course book "Step by Step Serbian 1".

The student is currently in week ${progress?.currentWeek || 1}, lesson ${progress?.currentUnit || 1}.`
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
          en: `\n\nYour tasks:
- Explain grammatical concepts clearly with examples
- Correct mistakes gently and constructively
- Provide practical exercises and examples
- Respond in English, but use Serbian examples
- Be encouraging and motivating
- When the student writes in Serbian, correct mistakes and explain them`
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
        totalQuestions: z.number(),
        correctAnswers: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const score = Math.round((input.correctAnswers / input.totalQuestions) * 100);
        
        await addExerciseResult({
          id: nanoid(),
          userId: ctx.user.id,
          unitNumber: input.unitNumber,
          exerciseType: input.exerciseType,
          score,
          totalQuestions: input.totalQuestions,
          correctAnswers: input.correctAnswers,
        });

        return { success: true, score };
      }),
  }),
});

export type AppRouter = typeof appRouter;

