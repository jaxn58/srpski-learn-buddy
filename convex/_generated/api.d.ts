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
import type * as emailTemplates from "../emailTemplates.js";
import type * as exercises from "../exercises.js";
import type * as feedback from "../feedback.js";
import type * as progress from "../progress.js";
import type * as subscriptions from "../subscriptions.js";
import type * as unitExercises from "../unitExercises.js";
import type * as units from "../units.js";
import type * as users from "../users.js";
import type * as vocabulary from "../vocabulary.js";

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
  emailTemplates: typeof emailTemplates;
  exercises: typeof exercises;
  feedback: typeof feedback;
  progress: typeof progress;
  subscriptions: typeof subscriptions;
  unitExercises: typeof unitExercises;
  units: typeof units;
  users: typeof users;
  vocabulary: typeof vocabulary;
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
