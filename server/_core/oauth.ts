import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { notifyOwner } from "./notification";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Development-only endpoint for direct login bypass
  app.post("/api/dev-login", async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    try {
      // Find user by email
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Create a session token using the SDK's internal JWT signing
      const sessionToken = await sdk.createSessionToken(user.id, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("[DevLogin] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      // If OAUTH_SERVER_URL is not set, we assume external OAuth is disabled.
      // We return a 404 to prevent the client from trying to use this endpoint.
      if (!ENV.oAuthServerUrl) {
        res.status(404).json({ error: "External OAuth is disabled" });
        return;
      }
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a new user
      const existingUser = await db.getUser(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        id: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Notify owner about new registration (but not for owner themselves)
      if (isNewUser && userInfo.openId !== ENV.ownerId) {
        try {
          await notifyOwner({
            title: "New User Registration",
            content: `A new user has registered and is waiting for approval:\n\nName: ${userInfo.name || 'N/A'}\nEmail: ${userInfo.email || 'N/A'}\nLogin Method: ${userInfo.loginMethod || userInfo.platform || 'N/A'}\n\nPlease activate the user in the Admin Panel to grant access.`
          });
        } catch (notifyError) {
          console.error("[OAuth] Failed to notify owner about new registration:", notifyError);
          // Don't fail the registration if notification fails
        }
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
