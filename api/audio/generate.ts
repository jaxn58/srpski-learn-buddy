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

const AUDIO_VERSION_TAG = "puck-v8";

// Environment variables
const ENV = {
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
  convexUrl: process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "",
};

// ─── Serbian TTS helpers (inline to guarantee Vercel bundles them) ──────────

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeSsmlAttrValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const SERBIAN_LATIN_LOWER = new Set([
  "sam", "si", "je", "smo", "ste", "su",
  "jesam", "jesi", "jeste", "jest",
  "nisam", "nisi", "nije", "nismo", "niste", "nisu",
  "ja", "ti", "vi", "mi", "on", "ona", "ono", "im", "ih",
]);

function serbianLatinForTts(text: string): string {
  const t = text.trim();
  if (SERBIAN_LATIN_LOWER.has(t.toLowerCase().normalize("NFC"))) return t.toLowerCase();
  return t;
}

/** Latin → Cyrillic alias so Chirp3 reads correct Serbian instead of English/German homographs. */
const CYRILLIC_ALIAS: Record<string, string> = {
  ste: "сте", je: "је", ti: "ти", vi: "ви",
  ja: "ја",  si: "си", mi: "ми",
  i: "и", a: "а", u: "у", o: "о", e: "е",
};

function subAlias(display: string, cy: string): string {
  return `<sub alias="${escapeSsmlAttrValue(cy)}">${escapeSsml(display)}</sub>`;
}

function wrapWord(display: string): string {
  const cy = CYRILLIC_ALIAS[display.toLowerCase().normalize("NFC")];
  return cy ? subAlias(display, cy) : escapeSsml(display);
}

function edgeBreakMs(trimmed: string): number {
  const n = [...trimmed].length;
  if (n <= 4) return 420;
  if (n <= 10) return 300;
  return 260;
}

function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const singleGrapheme = [...trimmed].length <= 1;
  let inner = trimmed;
  if (singleGrapheme && /^[A-Z]$/.test(trimmed)) inner = trimmed.toLowerCase();
  inner = serbianLatinForTts(inner);
  const spoken = serbianLatinForTts(trimmed);

  if (singleGrapheme) {
    const cy = CYRILLIC_ALIAS[inner.toLowerCase().normalize("NFC")];
    const core = cy ? subAlias(inner, cy) : escapeSsml(inner);
    const doubled = `${core}<break time="240ms"/>${core}`;
    return {
      ssml: `<speak><break time="820ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${doubled}</emphasis></prosody></lang><break time="820ms"/></speak>`,
      speakingRate: 0.65,
      volumeGainDb: 7.5,
    };
  }

  return {
    ssml: `<speak><break time="${edgeBreakMs(trimmed)}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${wrapWord(spoken)}</prosody></lang><break time="${edgeBreakMs(trimmed)}ms"/></speak>`,
    speakingRate: 0.9,
    volumeGainDb: 0.0,
  };
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Upload audio buffer to Convex File Storage
 */
async function uploadToConvex(
  audioBuffer: Buffer,
  contentType: string
): Promise<{ storageId: string }> {
  if (!ENV.convexUrl) {
    throw new Error("CONVEX_URL is not configured. Check Vercel environment variables.");
  }

  const uploadUrlResponse = await fetch(`${ENV.convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "vocabulary:generateUploadUrl", args: {} }),
  });

  if (!uploadUrlResponse.ok) {
    throw new Error(`Failed to generate upload URL: ${uploadUrlResponse.status}`);
  }

  const { value: uploadUrl } = await uploadUrlResponse.json();

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

  let serviceAccountKey: any;
  const rawKey = ENV.googleCloudServiceAccountKey.trim();

  try {
    if (rawKey.toLowerCase().endsWith(".json") && fs.existsSync(rawKey)) {
      serviceAccountKey = JSON.parse(fs.readFileSync(rawKey, "utf8"));
    } else if (rawKey.startsWith("{")) {
      try {
        serviceAccountKey = JSON.parse(rawKey);
      } catch {
        serviceAccountKey = JSON.parse(rawKey.replace(/\\n/g, "\n"));
      }
    } else {
      throw new Error("Value must start with '{' (JSON) or end with '.json' (file path)");
    }
  } catch (error) {
    console.error("[TTS] Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY");
    throw new Error(
      `Failed to load GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  if (serviceAccountKey?.private_key && typeof serviceAccountKey.private_key === "string") {
    let pk = serviceAccountKey.private_key;
    if (pk.includes("\\n") && !pk.includes("\n")) pk = pk.replace(/\\n/g, "\n");
    pk = pk.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!pk.endsWith("\n")) pk += "\n";
    serviceAccountKey.private_key = pk;
  }
  if (!serviceAccountKey?.private_key || typeof serviceAccountKey.private_key !== "string") {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is missing private_key");
  }
  if (!/(BEGIN (RSA )?PRIVATE KEY)/.test(serviceAccountKey.private_key)) {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key does not look like a PEM key.");
  }
  try {
    createPrivateKey({ key: serviceAccountKey.private_key, format: "pem" });
  } catch (e) {
    throw new Error(`GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key is not a valid PEM key: ${e instanceof Error ? e.message : String(e)}`);
  }

  const client = new TextToSpeechClient({
    credentials: serviceAccountKey,
    projectId: serviceAccountKey.project_id,
    apiEndpoint: 'texttospeech.googleapis.com',
  });

  const { ssml, speakingRate, volumeGainDb } = buildTtsPayload(options.text);

  const request = {
    input: { ssml },
    voice: { languageCode: 'sr-RS', name: 'sr-RS-Chirp3-HD-Puck', ssmlGender: 'MALE' as const },
    audioConfig: { audioEncoding: 'MP3' as const, speakingRate, volumeGainDb, pitch: 0.0 },
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    if (!response.audioContent) throw new Error("No audio content received from Google Cloud TTS");
    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    const { storageId } = await uploadToConvex(audioBuffer, 'audio/mpeg');
    return { storageId };
  } catch (error) {
    if (error instanceof Error) throw new Error(`Google Cloud TTS failed: ${error.message}`);
    throw new Error("Google Cloud TTS failed with unknown error");
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { serbianWord, text, vocabularyId, unitNumber, contentType } = req.body;
    const effectiveText = (typeof text === "string" && text.trim())
      ? text.trim()
      : (typeof serbianWord === "string" && serbianWord.trim() ? serbianWord.trim() : "");

    if (!effectiveText) {
      return res.status(400).json({ success: false, error: '"text" or "serbianWord" is required' });
    }

    const { storageId } = await generateSerbianAudio({ text: effectiveText, vocabularyId, unitNumber, contentType });
    res.json({ success: true, storageId });
  } catch (error: any) {
    console.error('[Audio Generation] Error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
  }
}
