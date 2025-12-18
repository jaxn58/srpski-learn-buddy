import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;
const SERVER_TOKEN = process.env.CONVEX_SERVER_TOKEN;

if (!CONVEX_URL) {
  throw new Error("CONVEX_URL environment variable is not set");
}

export const convexClient = new ConvexHttpClient(CONVEX_URL);

export { api };
export { SERVER_TOKEN };












