import { z } from "zod";
import { publicProcedure, router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { betaRegistrations } from "../../drizzle/schema";
import { randomBytes } from "crypto";
import { notifyOwner } from "../_core/notification";
import { sendBetaRegistrationEmail } from "../_core/email";
import { eq } from "drizzle-orm";

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

        // Send confirmation email to user
        const emailResult = await sendBetaRegistrationEmail(input.name, input.email);
        if (!emailResult.success) {
          console.warn(`[Beta Registration] Failed to send confirmation email: ${emailResult.error}`);
        }

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

  // Admin procedures
  getAll: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const registrations = await db.select().from(betaRegistrations);
      return registrations;
    } catch (error) {
      console.error("[Beta Registrations] Failed to fetch:", error);
      throw new Error("Failed to fetch beta registrations");
    }
  }),

  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "approved", "rejected"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        await db
          .update(betaRegistrations)
          .set({
            status: input.status,
            reviewedAt: new Date(),
          })
          .where(eq(betaRegistrations.id, input.id));

        return { success: true };
      } catch (error) {
        console.error("[Beta Registration] Failed to update status:", error);
        throw new Error("Failed to update registration status");
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        await db.delete(betaRegistrations).where(eq(betaRegistrations.id, input.id));
        return { success: true };
      } catch (error) {
        console.error("[Beta Registration] Failed to delete:", error);
        throw new Error("Failed to delete registration");
      }
    }),
});

