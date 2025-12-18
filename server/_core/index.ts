import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { clerkMiddleware } from "@clerk/express";
import { appRouter } from "../routers";
import { createPaddleContext } from "./paddleContext";
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
  app.use(cors());
  
  // Email sending is now handled by Convex Actions (convex/email.ts)
  // The Express endpoint has been removed
  
  // Paddle webhook endpoint (must be BEFORE Clerk middleware)
  app.post("/api/paddle/webhook", async (req, res) => {
    try {
      const caller = appRouter.createCaller(
        await createPaddleContext({ req, res } as any)
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

  // Audio generation endpoint for Google Cloud TTS
  app.post("/api/audio/generate", async (req, res) => {
    try {
      const { generateSerbianAudio } = await import("./textToSpeech");
      const { serbianWord, vocabularyId, unitNumber } = req.body;

      if (!serbianWord || typeof serbianWord !== "string") {
        return res.status(400).json({
          success: false,
          error: "serbianWord is required and must be a string",
        });
      }

      const { storageId } = await generateSerbianAudio({
        serbianWord,
        vocabularyId,
        unitNumber,
      });

      res.json({ success: true, storageId });
    } catch (error: any) {
      console.error("[Audio Generation] Error:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
      });
    }
  });
  
  // Clerk middleware for authentication (protects routes after this point)
  // Note: Currently only used for potential future protected routes
  app.use(clerkMiddleware());
  
  // tRPC API (only for Paddle webhook - will be migrated to Convex HTTP Action later)
  // This is the only remaining tRPC usage
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: createPaddleContext,
    })
  );
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use port 3001 for development (to match Vite proxy configuration)
  const preferredPort = parseInt(process.env.PORT || "3001");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
