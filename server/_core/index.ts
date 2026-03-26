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

// Bridge VITE_-prefixed Clerk keys to the standard names that @clerk/express expects.
// The project stores keys as VITE_CLERK_PUBLISHABLE_KEY for the Vite frontend;
// the Express server needs them under their canonical names.
if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
}

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
  
  // Clerk middleware for authentication.
  // Keys are bridged from VITE_ prefix above, so Clerk finds them automatically.
  if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
  } else {
    console.warn("[Server] Clerk keys not found - auth middleware disabled. TTS endpoint will require TTS_API_SECRET.");
  }

  // Audio generation endpoint for Google Cloud TTS (after auth middleware)
  app.post("/api/audio/generate", async (req, res) => {
    try {
      const ttsSecret = process.env.TTS_API_SECRET;
      const hasTtsSecret = ttsSecret && req.headers["x-tts-secret"] === ttsSecret;
      const authObj = await (req as any).auth?.();
      const hasClerkAuth = !!authObj?.userId;

      if (!hasTtsSecret && !hasClerkAuth) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }

      const { generateSerbianAudio } = await import("./textToSpeech");
      const { serbianWord, text, vocabularyId, unitNumber, contentType } = req.body;
      const effectiveText =
        (typeof text === "string" && text.trim())
          ? text.trim()
          : (typeof serbianWord === "string" && serbianWord.trim() ? serbianWord.trim() : "");

      if (!effectiveText) {
        return res.status(400).json({
          success: false,
          error: 'Either "text" or "serbianWord" is required and must be a non-empty string',
        });
      }

      const { storageId } = await generateSerbianAudio({
        text: effectiveText,
        vocabularyId,
        unitNumber,
        contentType,
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
