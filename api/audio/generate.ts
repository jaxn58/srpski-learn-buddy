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

/**
 * Latin → Cyrillic: Chirp3 sr-RS reads native Cyrillic more reliably than Latin homographs.
 * Keys: NFC-normalised lowercase Latin. Text written directly as Cyrillic inside
 * <lang xml:lang="sr-RS"> – the most reliable path for the sr-RS voice.
 */
const CYRILLIC_FORM: Record<string, string> = {
  // biti – present & negation
  sam: "сам",  si: "си",   je: "је",    smo: "смо",  ste: "сте",  su: "су",
  jesam: "јесам", jesi: "јеси", jeste: "јесте", jest: "јест",
  nisam: "нисам", nisi: "ниси", nije: "није",
  nismo: "нисмо", niste: "нисте", nisu: "нису",
  // personal pronouns
  ja: "ја", ti: "ти", vi: "ви", mi: "ми",
  on: "он",   ona: "она",  ono: "оно",
  oni: "они", one: "оне",  ona_pl: "она",
  // question words / discourse particles
  da: "да",   ne: "не",   li: "ли",   se: "се",
  ko: "ко",   šta: "шта", što: "шта",
  to: "то",   taj: "тај", ta: "та",   te: "те",
  kako: "како", kada: "када", gde: "где", zašto: "зашто",
  // clitic pronouns
  im: "им", ih: "их", ga: "га", mu: "му", joj: "јој",
  // prepositions (often displayed title-cased in tables)
  iz: "из",  za: "за",  na: "на",  sa: "са",  od: "од",
  do: "до",  po: "по",  uz: "уз",  bez: "без", pod: "под",
  nad: "над", kod: "код", pre: "пре", pri: "при",
  // conjunctions / single-letter particles
  i: "и",  a: "а",  u: "у",  o: "о",  e: "е",
};

function edgeBreakMs(trimmed: string): number {
  const n = [...trimmed].length;
  if (n <= 4) return 420;
  if (n <= 10) return 300;
  return 260;
}

function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const graphemeCount = [...trimmed].length;
  const singleGrapheme = graphemeCount <= 1;

  // Single-letter words: slow, loud, emphasised, said ONCE.
  if (singleGrapheme) {
    const cyKey = trimmed.toLowerCase().normalize("NFC");
    const spoken = escapeSsml(CYRILLIC_FORM[cyKey] ?? trimmed.toLowerCase());
    return {
      ssml: `<speak><break time="820ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${spoken}</emphasis></prosody></lang><break time="820ms"/></speak>`,
      speakingRate: 0.65,
      volumeGainDb: 7.5,
    };
  }

  const key = trimmed.toLowerCase().normalize("NFC");
  const cyrillic = CYRILLIC_FORM[key] ?? null;
  const inner = escapeSsml(cyrillic ?? trimmed);
  const ms = edgeBreakMs(trimmed);
  // Short words (≤4 graphemes) get a volume boost so they are clearly audible.
  const volumeGainDb = graphemeCount <= 4 ? 4.0 : 0.0;

  return {
    ssml: `<speak><break time="${ms}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${inner}</prosody></lang><break time="${ms}ms"/></speak>`,
    speakingRate: 0.9,
    volumeGainDb,
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
