/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai_chatConfig from "../ai/chatConfig.js";
import type * as ai_chatTools from "../ai/chatTools.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_ingestKnowledge from "../ai/ingestKnowledge.js";
import type * as ai_modelPricing from "../ai/modelPricing.js";
import type * as audioAdmin from "../audioAdmin.js";
import type * as authz from "../authz.js";
import type * as backup from "../backup.js";
import type * as backupAdmin from "../backupAdmin.js";
import type * as badges from "../badges.js";
import type * as chat from "../chat.js";
import type * as contentImportAdmin from "../contentImportAdmin.js";
import type * as contentStudio from "../contentStudio.js";
import type * as contentStudio__auditor from "../contentStudio/_auditor.js";
import type * as contentStudio__creator from "../contentStudio/_creator.js";
import type * as contentStudio__mutations from "../contentStudio/_mutations.js";
import type * as contentStudio__publisher from "../contentStudio/_publisher.js";
import type * as contentStudio__queries from "../contentStudio/_queries.js";
import type * as contentStudio__sectionRevise from "../contentStudio/_sectionRevise.js";
import type * as contentStudio__shared from "../contentStudio/_shared.js";
import type * as contentStudio__translationCore from "../contentStudio/_translationCore.js";
import type * as contentStudio__validator from "../contentStudio/_validator.js";
import type * as contentStudio__validatorHelpers from "../contentStudio/_validatorHelpers.js";
import type * as contentStudio__validatorMemory from "../contentStudio/_validatorMemory.js";
import type * as contentStudio__verifier from "../contentStudio/_verifier.js";
import type * as contentStudio__vocabularyCleanup from "../contentStudio/_vocabularyCleanup.js";
import type * as contentStudio_prompts from "../contentStudio/prompts.js";
import type * as crons from "../crons.js";
import type * as dashboardAnnouncements from "../dashboardAnnouncements.js";
import type * as documents from "../documents.js";
import type * as documentsNode from "../documentsNode.js";
import type * as email from "../email.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as energy from "../energy.js";
import type * as energyAdmin from "../energyAdmin.js";
import type * as exercises from "../exercises.js";
import type * as featureAccess from "../featureAccess.js";
import type * as feedback from "../feedback.js";
import type * as gamification from "../gamification.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as leaderboard from "../leaderboard.js";
import type * as modules from "../modules.js";
import type * as newsletter from "../newsletter.js";
import type * as onboarding from "../onboarding.js";
import type * as platform from "../platform.js";
import type * as progress from "../progress.js";
import type * as schema_chat from "../schema/chat.js";
import type * as schema_communication from "../schema/communication.js";
import type * as schema_contentStudio from "../schema/contentStudio.js";
import type * as schema_core from "../schema/core.js";
import type * as schema_feedback from "../schema/feedback.js";
import type * as schema_learning from "../schema/learning.js";
import type * as schema_progress from "../schema/progress.js";
import type * as schema_system from "../schema/system.js";
import type * as schema_vocabulary from "../schema/vocabulary.js";
import type * as seedChatSuggestions from "../seedChatSuggestions.js";
import type * as seedKnowledgeArticles from "../seedKnowledgeArticles.js";
import type * as streaming from "../streaming.js";
import type * as subscriptions from "../subscriptions.js";
import type * as system from "../system.js";
import type * as unitContentAudio from "../unitContentAudio.js";
import type * as unitExercises from "../unitExercises.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as versions from "../versions.js";
import type * as vocabulary from "../vocabulary.js";
import type * as waitlist from "../waitlist.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "ai/chatConfig": typeof ai_chatConfig;
  "ai/chatTools": typeof ai_chatTools;
  "ai/embeddings": typeof ai_embeddings;
  "ai/ingestKnowledge": typeof ai_ingestKnowledge;
  "ai/modelPricing": typeof ai_modelPricing;
  audioAdmin: typeof audioAdmin;
  authz: typeof authz;
  backup: typeof backup;
  backupAdmin: typeof backupAdmin;
  badges: typeof badges;
  chat: typeof chat;
  contentImportAdmin: typeof contentImportAdmin;
  contentStudio: typeof contentStudio;
  "contentStudio/_auditor": typeof contentStudio__auditor;
  "contentStudio/_creator": typeof contentStudio__creator;
  "contentStudio/_mutations": typeof contentStudio__mutations;
  "contentStudio/_publisher": typeof contentStudio__publisher;
  "contentStudio/_queries": typeof contentStudio__queries;
  "contentStudio/_sectionRevise": typeof contentStudio__sectionRevise;
  "contentStudio/_shared": typeof contentStudio__shared;
  "contentStudio/_translationCore": typeof contentStudio__translationCore;
  "contentStudio/_validator": typeof contentStudio__validator;
  "contentStudio/_validatorHelpers": typeof contentStudio__validatorHelpers;
  "contentStudio/_validatorMemory": typeof contentStudio__validatorMemory;
  "contentStudio/_verifier": typeof contentStudio__verifier;
  "contentStudio/_vocabularyCleanup": typeof contentStudio__vocabularyCleanup;
  "contentStudio/prompts": typeof contentStudio_prompts;
  crons: typeof crons;
  dashboardAnnouncements: typeof dashboardAnnouncements;
  documents: typeof documents;
  documentsNode: typeof documentsNode;
  email: typeof email;
  emailTemplates: typeof emailTemplates;
  energy: typeof energy;
  energyAdmin: typeof energyAdmin;
  exercises: typeof exercises;
  featureAccess: typeof featureAccess;
  feedback: typeof feedback;
  gamification: typeof gamification;
  http: typeof http;
  knowledge: typeof knowledge;
  leaderboard: typeof leaderboard;
  modules: typeof modules;
  newsletter: typeof newsletter;
  onboarding: typeof onboarding;
  platform: typeof platform;
  progress: typeof progress;
  "schema/chat": typeof schema_chat;
  "schema/communication": typeof schema_communication;
  "schema/contentStudio": typeof schema_contentStudio;
  "schema/core": typeof schema_core;
  "schema/feedback": typeof schema_feedback;
  "schema/learning": typeof schema_learning;
  "schema/progress": typeof schema_progress;
  "schema/system": typeof schema_system;
  "schema/vocabulary": typeof schema_vocabulary;
  seedChatSuggestions: typeof seedChatSuggestions;
  seedKnowledgeArticles: typeof seedKnowledgeArticles;
  streaming: typeof streaming;
  subscriptions: typeof subscriptions;
  system: typeof system;
  unitContentAudio: typeof unitContentAudio;
  unitExercises: typeof unitExercises;
  units: typeof units;
  users: typeof users;
  versions: typeof versions;
  vocabulary: typeof vocabulary;
  waitlist: typeof waitlist;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  persistentTextStreaming: import("@convex-dev/persistent-text-streaming/_generated/component.js").ComponentApi<"persistentTextStreaming">;
};
