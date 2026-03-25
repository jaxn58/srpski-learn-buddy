/**
 * Text-to-Speech helper using Google Cloud Text-to-Speech API
 *
 * Example usage:
 *   const { url: audioUrl } = await generateSerbianAudio({
 *     serbianWord: "zdravo",
 *     vocabularyId: "abc123"
 *   });
 */
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { ENV } from "./env";
import fs from "node:fs";
import { createPrivateKey } from "node:crypto";

// ─── Serbian TTS helpers (inline, same logic as api/audio/generate.ts) ──────

function escapeSsml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function escapeSsmlAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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

const CYRILLIC_ALIAS: Record<string, string> = {
  ste: "сте", je: "је", ti: "ти", vi: "ви",
  ja: "ја",  si: "си", mi: "ми",
  i: "и", a: "а", u: "у", o: "о", e: "е",
};

function wrapWord(display: string): string {
  const cy = CYRILLIC_ALIAS[display.toLowerCase().normalize("NFC")];
  return cy ? `<sub alias="${escapeSsmlAttr(cy)}">${escapeSsml(display)}</sub>` : escapeSsml(display);
}

function edgeBreakMs(t: string): number {
  const n = [...t].length;
  return n <= 4 ? 420 : n <= 10 ? 300 : 260;
}

function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const single = [...trimmed].length <= 1;
  let inner = trimmed;
  if (single && /^[A-Z]$/.test(trimmed)) inner = trimmed.toLowerCase();
  inner = serbianLatinForTts(inner);
  const spoken = serbianLatinForTts(trimmed);
  if (single) {
    const cy = CYRILLIC_ALIAS[inner.toLowerCase().normalize("NFC")];
    const core = cy ? `<sub alias="${escapeSsmlAttr(cy)}">${escapeSsml(inner)}</sub>` : escapeSsml(inner);
    const doubled = `${core}<break time="240ms"/>${core}`;
    return {
      ssml: `<speak><break time="820ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${doubled}</emphasis></prosody></lang><break time="820ms"/></speak>`,
      speakingRate: 0.65,
      volumeGainDb: 7.5,
    };
  }
  const ms = edgeBreakMs(trimmed);
  return {
    ssml: `<speak><break time="${ms}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${wrapWord(spoken)}</prosody></lang><break time="${ms}ms"/></speak>`,
    speakingRate: 0.9,
    volumeGainDb: 0.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export type GenerateSerbianAudioOptions = {
  text: string;
  vocabularyId?: string; // Optional: for better file naming
  unitNumber?: number; // Optional: for better file organization
  contentType?: "phrases" | "dialogues";
};

export type GenerateSerbianAudioResponse = {
  storageId: string;
};

/**
 * Upload audio buffer to Convex File Storage
 */
async function uploadToConvex(
  audioBuffer: Buffer,
  contentType: string
): Promise<{ storageId: string }> {
  const convexUrl = process.env.VITE_CONVEX_URL;
  
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not configured");
  }

  // Call Convex mutation to generate upload URL
  const uploadUrlResponse = await fetch(`${convexUrl}/api/mutation`, {
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
  return { storageId };
}

/**
 * Generates Serbian audio using Google Cloud Text-to-Speech API
 * and uploads it to Convex File Storage
 */
export async function generateSerbianAudio(
  options: GenerateSerbianAudioOptions
): Promise<GenerateSerbianAudioResponse> {
  
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

  // Initialize Text-to-Speech client with Service Account credentials
  const client = new TextToSpeechClient({
    credentials: serviceAccountKey,
    projectId: serviceAccountKey.project_id,
    apiEndpoint: 'texttospeech.googleapis.com',
  });
  
  // Single voice mode (same as vocabulary audio): no selectable variants.
  const pitch = 0.0;

  const { ssml: ssmlText, speakingRate, volumeGainDb } = buildTtsPayload(options.text);
  const request = {
    input: { ssml: ssmlText },
    voice: {
      languageCode: 'sr-RS',
      name: 'sr-RS-Chirp3-HD-Puck', // Male HD voice
      ssmlGender: 'MALE' as const
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate,
      volumeGainDb,
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
    
    // Upload to Convex File Storage
    const { storageId } = await uploadToConvex(audioBuffer, 'audio/mpeg');

    return { storageId };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
    throw new Error("Google Cloud TTS failed with unknown error");
  }
}