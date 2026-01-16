import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { serveStatic, setupVite } from "./vite";
import path from "path";

// Load environment variables for the local Express server (including `.env.local`).
// This keeps Dev TTS behavior aligned with the frontend and avoids missing secrets at runtime.
const projectRoot = path.resolve(import.meta.dirname, "../..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

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
  
  // Paddle Billing webhook is handled by Convex HTTP actions:
  // - Dev:  https://reminiscent-panda-57.convex.site/paddle/webhook
  // - Prod: https://fleet-labrador-324.convex.site/paddle/webhook

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
