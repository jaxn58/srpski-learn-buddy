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

const CYRILLIC_FORM: Record<string, string> = {
  sam: "сам",  si: "си",   je: "је",    smo: "смо",  ste: "сте",  su: "су",
  jesam: "јесам", jesi: "јеси", jeste: "јесте", jest: "јест",
  nisam: "нисам", nisi: "ниси", nije: "није",
  nismo: "нисмо", niste: "нисте", nisu: "нису",
  ja: "ја", ti: "ти", vi: "ви", mi: "ми",
  on: "он", ona: "она", ono: "оно",
  oni: "они", one: "оне",
  da: "да",   ne: "не",   li: "ли",   se: "се",
  ko: "ко",   šta: "шта", što: "шта",
  to: "то",   taj: "тај", ta: "та",   te: "те",
  kako: "како", kada: "када", gde: "где", zašto: "зашто",
  im: "им", ih: "их", ga: "га", mu: "му", joj: "јој",
  iz: "из", za: "за", na: "на", sa: "са", od: "од",
  do: "до", po: "по", uz: "уз", bez: "без", pod: "под",
  nad: "над", kod: "код", pre: "пре", pri: "при",
  i: "и",  a: "а",  u: "у",  o: "о",  e: "е",
};

function edgeBreakMs(t: string): number {
  const n = [...t].length;
  return n <= 4 ? 420 : n <= 10 ? 300 : 260;
}

function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const graphemeCount = [...trimmed].length;
  const single = graphemeCount <= 1;
  if (single) {
    const spoken = escapeSsml(CYRILLIC_FORM[trimmed.toLowerCase().normalize("NFC")] ?? trimmed.toLowerCase());
    return {
      ssml: `<speak><break time="820ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${spoken}</emphasis></prosody></lang><break time="820ms"/></speak>`,
      speakingRate: 0.65,
      volumeGainDb: 7.5,
    };
  }
  const ms = edgeBreakMs(trimmed);
  const inner = escapeSsml(CYRILLIC_FORM[trimmed.toLowerCase().normalize("NFC")] ?? trimmed);
  const volumeGainDb = graphemeCount <= 4 ? 4.0 : 0.0;
  return {
    ssml: `<speak><break time="${ms}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${inner}</prosody></lang><break time="${ms}ms"/></speak>`,
    speakingRate: 0.9,
    volumeGainDb,
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