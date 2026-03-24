/**
 * Convex Database Schema
 *
 * 51 tables organized into 9 logical modules:
 *
 *   core.ts           – Users, user progress, subscriptions, subscription history
 *   learning.ts       – Unit metadata, modules, unit content, audio, interactive tests
 *   vocabulary.ts     – Course vocabulary, vocabulary progress, quiz progress
 *   progress.ts       – Exercise progress, question mastery, badges, daily activity, completions
 *   chat.ts           – Chat sessions, messages, system prompts, prompt history
 *   feedback.ts       – Feedback submissions, comments, status history, wishlist
 *   communication.ts  – Email templates, signatures, waitlist, newsletter (contacts, campaigns, logs, link clicks)
 *   contentStudio.ts  – Content Studio config, skills, references, drafts, snapshots, AI runs, findings, reviews, imports
 *   system.ts         – App versions, changelog, onboarding, dashboard announcements, backups, Dodo webhook events
 *
 * Note: TS2589 ("Type instantiation is excessively deep") in Convex function files is a known
 * TypeScript limitation with large schemas (51 tables). These errors are suppressed via
 * `// @ts-ignore TS2589` comments in affected files (see scripts/add-ts-expect-errors.mjs).
 * Convex validates types at its own runtime layer regardless of TypeScript checks.
 * Run `node scripts/add-ts-expect-errors.mjs --apply` after adding new Convex functions.
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
