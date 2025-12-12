import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { clerkMiddleware } from "@clerk/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Public email webhook endpoint for Convex actions (must be BEFORE Clerk middleware)
  app.post("/api/email/send", async (req, res) => {
    try {
      const { templateName, variables, to, replyTo } = req.body;

      if (!templateName || !variables || !to) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: templateName, variables, to" 
        });
      }

      // Import email functions
      const { sendBetaRegistrationEmail, sendUserActivationEmail, sendFeedbackConfirmationEmail, sendFeedbackAdminNotificationEmail } = await import("./email");

      let result;
      switch (templateName) {
        case "beta-registration":
          if (!variables.USER_NAME || !variables.USER_EMAIL) {
            return res.status(400).json({ success: false, error: "Missing USER_NAME or USER_EMAIL" });
          }
          result = await sendBetaRegistrationEmail(variables.USER_NAME, variables.USER_EMAIL);
          break;
        
        case "user-activation":
          if (!variables.USER_NAME || !variables.USER_EMAIL || !variables.LOGIN_URL) {
            return res.status(400).json({ success: false, error: "Missing USER_NAME, USER_EMAIL, or LOGIN_URL" });
          }
          result = await sendUserActivationEmail(variables.USER_NAME, variables.USER_EMAIL, variables.LOGIN_URL);
          break;
        
        case "feedback-confirmation":
          if (!variables.USER_NAME || !variables.USER_EMAIL || !variables.FEEDBACK_TYPE || !variables.FEEDBACK_TITLE) {
            return res.status(400).json({ success: false, error: "Missing required feedback variables" });
          }
          result = await sendFeedbackConfirmationEmail(
            variables.USER_NAME,
            variables.USER_EMAIL,
            variables.FEEDBACK_TYPE,
            variables.FEEDBACK_TITLE
          );
          break;
        
        case "feedback-admin-notification":
          if (!variables.USER_NAME || !variables.USER_EMAIL || !variables.FEEDBACK_TYPE || !variables.FEEDBACK_TITLE || !variables.FEEDBACK_DESCRIPTION || !variables.ADMIN_EMAIL) {
            return res.status(400).json({ success: false, error: "Missing required feedback admin variables" });
          }
          result = await sendFeedbackAdminNotificationEmail(
            variables.USER_NAME,
            variables.USER_EMAIL,
            variables.FEEDBACK_TYPE,
            variables.FEEDBACK_TITLE,
            variables.FEEDBACK_DESCRIPTION,
            variables.ADMIN_EMAIL
          );
          break;
        
        default:
          return res.status(400).json({ success: false, error: `Unknown template: ${templateName}` });
      }

      if (result.success) {
        res.json({ success: true, messageId: (result as any).messageId });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("[Email Webhook] Error:", error);
      res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
  });
  
  // Paddle webhook endpoint (must be BEFORE Clerk middleware)
  app.post("/api/paddle/webhook", async (req, res) => {
    try {
      const caller = appRouter.createCaller(
        await createContext({ req, res } as any)
      );
      await caller.paddle.webhook(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Paddle Webhook] Error:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
      });
    }
  });
  
  // Clerk middleware for authentication (protects routes after this point)
  app.use(clerkMiddleware());
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
