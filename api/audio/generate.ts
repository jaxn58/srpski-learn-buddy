/**
 * Vercel Serverless Function for Audio Generation
 * 
 * This endpoint generates Serbian pronunciation audio using Google Cloud TTS
 * and uploads it to Convex File Storage.
 * 
 * POST /api/audio/generate
 * Body: { serbianWord?: string, text?: string, vocabularyId?: string, unitNumber?: number, contentType?: "phrases" | "dialogues", voiceKey?: string }
 * Response: { success: true, audioUrl: string } | { success: false, error: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from "node:fs";
import { createPrivateKey } from "node:crypto";

const AUDIO_VERSION_TAG = "puck-v4";

// Environment variables
const ENV = {
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
  convexUrl: process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "",
};

/**
 * Upload audio buffer to Convex File Storage
 */
async function uploadToConvex(
  storagePath: string,
  audioBuffer: Buffer,
  contentType: string
): Promise<{ storageId: string }> {
  if (!ENV.convexUrl) {
    throw new Error("CONVEX_URL is not configured. Check Vercel environment variables.");
  }

  // Call Convex mutation to generate upload URL
  const uploadUrlResponse = await fetch(`${ENV.convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "vocabulary:generateUploadUrl",
      args: {},
    }),
  });

  if (!uploadUrlResponse.ok) {
    throw new Error(`Failed to generate upload URL: ${uploadUrlResponse.status}`);
  }

  const { value: uploadUrl } = await uploadUrlResponse.json();

  // Upload the audio file to Convex storage
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Convex file upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  const { storageId } = await uploadResponse.json();

  // Return storage ID instead of URL (URLs expire after 1h)
  // Frontend will generate fresh URLs on-demand
  return { storageId };
}

/**
 * Generate Serbian audio using Google Cloud TTS
 */
async function generateSerbianAudio(options: {
  text: string;
  vocabularyId?: string;
  unitNumber?: number;
  contentType?: "phrases" | "dialogues";
}): Promise<{ storageId: string }> {
  if (!ENV.googleCloudServiceAccountKey) {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is not configured");
  }

  // Parse Service Account JSON from environment variable.
  // Robustly handle different formats (raw JSON, file path, escaped/unescaped newlines)
  let serviceAccountKey: any;
  const rawKey = ENV.googleCloudServiceAccountKey.trim();
  
  try {
    // Try file path first
    if (rawKey.toLowerCase().endsWith(".json") && fs.existsSync(rawKey)) {
      serviceAccountKey = JSON.parse(fs.readFileSync(rawKey, "utf8"));
    } 
    // Try direct JSON parse
    else if (rawKey.startsWith("{")) {
      try {
        serviceAccountKey = JSON.parse(rawKey);
      } catch (e) {
        // If direct parse fails, try with escaped newlines replaced
        // This handles cases where the JSON was copy-pasted with literal \n in the string
        const withNewlines = rawKey.replace(/\\n/g, "\n");
        serviceAccountKey = JSON.parse(withNewlines);
      }
    } else {
      throw new Error("Value must start with '{' (JSON) or end with '.json' (file path)");
    }
  } catch (error) {
    console.error("[TTS] Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY");
    console.error("[TTS] First 100 chars:", rawKey.substring(0, 100));
    throw new Error(
      `Failed to load GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }

  // Robustly normalize private_key to handle all possible escaping scenarios
  if (serviceAccountKey?.private_key && typeof serviceAccountKey.private_key === "string") {
    let pk = serviceAccountKey.private_key;
    
    // If the key contains literal "\n" strings (not actual newlines), replace them
    // This happens when JSON is copy-pasted with escaped newlines
    if (pk.includes("\\n") && !pk.includes("\n")) {
      pk = pk.replace(/\\n/g, "\n");
    }
    
    // Normalize all line endings to \n
    pk = pk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    
    // Trim whitespace
    pk = pk.trim();
    
    // Ensure trailing newline (some libraries require this)
    if (!pk.endsWith("\n")) {
      pk += "\n";
    }
    
    serviceAccountKey.private_key = pk;
  }
  if (!serviceAccountKey?.private_key || typeof serviceAccountKey.private_key !== "string") {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is missing private_key");
  }
  if (!/(BEGIN (RSA )?PRIVATE KEY)/.test(serviceAccountKey.private_key)) {
    throw new Error(
      "GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key does not look like a PEM key. Ensure you pasted the full service account JSON (including the PEM private_key)."
    );
  }
  // Fail fast with a clearer error than gRPC's "DECODER routines::unsupported".
  try {
    createPrivateKey({ key: serviceAccountKey.private_key, format: "pem" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key is not a valid PEM key: ${msg}`);
  }

  // Initialize TTS client
  const client = new TextToSpeechClient({
    credentials: serviceAccountKey,
    projectId: serviceAccountKey.project_id,
    apiEndpoint: 'texttospeech.googleapis.com',
  });

  function escapeSsml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function ssmlEdgeBreakMs(text: string): number {
    const n = [...text.trim()].length;
    if (n <= 4) return 420;
    if (n <= 10) return 300;
    return 260;
  }

  // Single voice mode (same philosophy as vocabulary audio): no selectable variants.
  const speakingRate = 0.9;
  const pitch = 0.0;
  const rateTag = "slow";

  const trimmed = options.text.trim();
  const graphemeCount = [...trimmed].length;
  /** UI often shows "I"/"A"; Serbian particles are lowercase Latin in normal orthography. */
  let ssmlInner = trimmed;
  if (graphemeCount === 1 && /^[A-Z]$/.test(trimmed)) {
    ssmlInner = trimmed.toLowerCase();
  }

  const edgeBreakMs = graphemeCount <= 1 ? 520 : ssmlEdgeBreakMs(trimmed);
  const ssmlText =
    graphemeCount <= 1
      ? `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS">${escapeSsml(ssmlInner)}</lang><break time="${edgeBreakMs}ms"/></speak>`
      : `<speak><break time="${edgeBreakMs}ms"/><prosody rate="${rateTag}">${escapeSsml(trimmed)}</prosody><break time="${edgeBreakMs}ms"/></speak>`;
  
  const request = {
    input: { ssml: ssmlText },
    voice: {
      languageCode: 'sr-RS',
      name: 'sr-RS-Chirp3-HD-Puck',
      ssmlGender: 'MALE' as const
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate,
      volumeGainDb: 0.0,
      pitch,
    }
  };

  try {
    // Generate audio
    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error("No audio content received from Google Cloud TTS");
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

    // Upload to Convex File Storage (Convex URLs are generated later from storageId)
    // Note: Convex file storage does not support stable "paths". We keep AUDIO_VERSION_TAG for cache keys upstream.
    const { storageId } = await uploadToConvex("unused", audioBuffer, 'audio/mpeg');
    return { storageId };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
    throw new Error("Google Cloud TTS failed with unknown error");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { serbianWord, text, vocabularyId, unitNumber, contentType } = req.body;
    const effectiveText = (typeof text === "string" && text.trim())
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
    console.error('[Audio Generation] Error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
