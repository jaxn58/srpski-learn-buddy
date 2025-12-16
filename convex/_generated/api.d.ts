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
import type * as badges from "../badges.js";
import type * as beta from "../beta.js";
import type * as chat from "../chat.js";
import type * as debug_index from "../debug_index.js";
import type * as email from "../email.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as exercises from "../exercises.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as modules from "../modules.js";
import type * as progress from "../progress.js";
import type * as subscriptions from "../subscriptions.js";
import type * as system from "../system.js";
import type * as unitExercises from "../unitExercises.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as vocabulary from "../vocabulary.js";
import type * as weeks from "../weeks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  badges: typeof badges;
  beta: typeof beta;
  chat: typeof chat;
  debug_index: typeof debug_index;
  email: typeof email;
  emailTemplates: typeof emailTemplates;
  exercises: typeof exercises;
  feedback: typeof feedback;
  http: typeof http;
  modules: typeof modules;
  progress: typeof progress;
  subscriptions: typeof subscriptions;
  system: typeof system;
  unitExercises: typeof unitExercises;
  units: typeof units;
  users: typeof users;
  vocabulary: typeof vocabulary;
  weeks: typeof weeks;
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

export declare const components: {};
