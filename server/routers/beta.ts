import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { betaRegistrations } from "../../drizzle/schema";
import { randomBytes } from "crypto";
import { notifyOwner } from "../_core/notification";

export const betaRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email is required"),
        motivation: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const id = randomBytes(16).toString("hex");

      try {
        // Save beta registration to database
        await db.insert(betaRegistrations).values({
          id,
          name: input.name,
          email: input.email,
          motivation: input.motivation || null,
          status: "pending",
        });

        // Notify owner about new beta registration
        await notifyOwner({
          title: "🎉 New Beta Registration",
          content: `Name: ${input.name}\nEmail: ${input.email}\n\nMotivation: ${input.motivation || "No motivation provided"}\n\nPlease review in Admin Panel → Beta Registrations`,
        });

        return {
          success: true,
          message: "Registration successful! We'll review your application soon.",
        };
      } catch (error) {
        console.error("[Beta Registration] Failed:", error);
        throw new Error("Failed to register for beta testing");
      }
    }),
});

