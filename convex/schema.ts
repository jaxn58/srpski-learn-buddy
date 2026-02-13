/**
 * Convex Database Schema
 *
 * 54 tables organized into 9 logical modules:
 *
 *   core.ts           – Users, user progress, subscriptions, subscription history
 *   learning.ts       – Unit metadata, modules, unit content, audio, interactive tests, unitExplanations (deprecated)
 *   vocabulary.ts     – Course vocabulary, vocabulary progress, translations, quiz progress, vocabulary (deprecated)
 *   progress.ts       – Exercise progress, question mastery, badges, daily activity, completions
 *   chat.ts           – Chat sessions, messages, system prompts, prompt history
 *   feedback.ts       – Feedback submissions, comments, status history, beta registrations, wishlist
 *   communication.ts  – Email templates, signatures, waitlist, newsletter (contacts, campaigns, logs, link clicks)
 *   contentStudio.ts  – Content Studio config, skills, references, drafts, snapshots, AI runs, findings, reviews, imports
 *   system.ts         – App versions, changelog, onboarding, backups, Dodo webhook events
 *
 * Note: TS2589 ("Type instantiation is excessively deep") in Convex function files is a known
 * TypeScript limitation with large schemas (54+ tables). It does NOT affect runtime behavior –
 * Convex validates types at its own layer. See scripts/typecheck.mjs for the split check approach.
 */
import { defineSchema } from "convex/server";
import { coreTables } from "./schema/core";
import { learningTables } from "./schema/learning";
import { vocabularyTables } from "./schema/vocabulary";
import { progressTables } from "./schema/progress";
import { chatTables } from "./schema/chat";
import { feedbackTables } from "./schema/feedback";
import { communicationTables } from "./schema/communication";
import { contentStudioTables } from "./schema/contentStudio";
import { systemTables } from "./schema/system";

export default defineSchema({
  ...coreTables,
  ...learningTables,
  ...vocabularyTables,
  ...progressTables,
  ...chatTables,
  ...feedbackTables,
  ...communicationTables,
  ...contentStudioTables,
  ...systemTables,
});
