/**
 * Vercel Serverless Function for Audio Generation
 *
 * POST /api/audio/generate
 * Body: { serbianWord?: string, text?: string, vocabularyId?: string, unitNumber?: number, contentType?: "phrases" | "dialogues" }
 * Response: { success: true, storageId: string } | { success: false, error: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { verifyToken } from '@clerk/backend';
import fs from "node:fs";
import { createPrivateKey } from "node:crypto";

const AUDIO_VERSION_TAG = "standard-v1";

const ALLOWED_ORIGINS = [
  "https://learn-with.me",
  "https://www.learn-with.me",
  "https://beta.learn-with.me",
];

function isAllowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  if (/^https:\/\/srpski-tutor[a-z0-9-]*-jaxn58s-projects\.vercel\.app$/.test(origin)) return origin;
  return null;
}

const ENV = {
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
  convexUrl: process.env.CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? "",
};

// ─── SSML helpers ────────────────────────────────────────────────────────────

function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Internal pronunciation map: Latin input → Cyrillic spoken form for the SSML.
 *
 * WHY: Chirp3 sr-RS generates near-silent (millisecond-length) audio for short
 * Latin Serbian words like "Vi", "Ja", "Da" because it reads them as
 * abbreviations or foreign-language tokens. Passing the Cyrillic equivalent
 * directly inside <lang xml:lang="sr-RS"> forces the engine to treat them as
 * native Serbian syllables and produce proper, audible speech.
 *
 * SCOPE: These strings are used ONLY to build the SSML string that is sent to
 * the Google TTS API. They are never stored in the database, never displayed in
 * the UI, and never appear in any user-facing content. The app uses Serbian
 * Latin throughout; this map is a purely internal TTS implementation detail.
 */
const CYRILLIC_PRONUNCIATION: Record<string, string> = {
  // biti – present & negation
  sam: "сам",  si: "си",   je: "је",   smo: "смо", ste: "сте", su: "су",
  jesam: "јесам", jesi: "јеси", jeste: "јесте", jest: "јест",
  nisam: "нисам", nisi: "ниси", nije: "није",
  nismo: "нисмо", niste: "нисте", nisu: "нису",
  // personal pronouns
  ja: "ја", ti: "ти", vi: "ви", mi: "ми",
  on: "он", ona: "она", ono: "оно", oni: "они", one: "оне",
  // common particles, prepositions, conjunctions
  da: "да",  ne: "не",  li: "ли",  se: "се",
  ko: "ко",  i: "и",   a: "а",   u: "у",  o: "о",  e: "е",
  iz: "из",  za: "за", na: "на", sa: "са", od: "од",
  do: "до",  po: "по", uz: "уз", im: "им", ih: "их",
  ga: "га",  mu: "му", ta: "та", te: "те", to: "то",
};

/**
 * Builds SSML for sr-RS-Neural2-A.
 *
 * Neural2 has FULL SSML support: <break>, <prosody>, <phoneme>, <lang> all work
 * correctly. This is why we switched away from Chirp3-HD-Puck: Chirp3 HD is a
 * generative model with severely limited SSML processing that silently discards
 * or mishandles markup for short utterances.
 *
 * Strategy:
 * - ALL words use SSML input (Neural2 handles it reliably).
 * - Short words (≤ 4 graphemes) get 200 ms break-padding before and after so the
 *   engine has enough context to compute prosody for isolated syllables. Rate is
 *   controlled by SSML <prosody rate> only; API speakingRate stays at 1.0 to
 *   avoid compounding slowdowns.
 * - Cyrillic forms are the internal pronunciation hint (never shown to users).
 */
function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const graphemeCount = [...trimmed].length;

  const key = trimmed.toLowerCase().normalize("NFC");
  const spoken = escapeSsml(CYRILLIC_PRONUNCIATION[key] ?? trimmed);

  // ── Single letter (И, А, У, …) ───────────────────────────────────────────
  if (graphemeCount <= 1) {
    return {
      ssml: `<speak><break time="200ms"/><lang xml:lang="sr-RS"><prosody rate="slow" volume="x-loud">${spoken}</prosody></lang><break time="200ms"/></speak>`,
      speakingRate: 1.0,
      volumeGainDb: 6.0,
    };
  }

  // ── Short words 2–4 graphemes (Ja, Ti, Da, Je, Si, Vi, Iz, …) ────────────
  if (graphemeCount <= 4) {
    return {
      ssml: `<speak><break time="200ms"/><lang xml:lang="sr-RS"><prosody rate="slow" volume="loud">${spoken}</prosody></lang><break time="200ms"/></speak>`,
      speakingRate: 1.0,
      volumeGainDb: 4.0,
    };
  }

  // ── Normal words (5+ graphemes) ──────────────────────────────────────────
  const ms = graphemeCount <= 10 ? 300 : 260;
  return {
    ssml: `<speak><break time="${ms}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${spoken}</prosody></lang><break time="${ms}ms"/></speak>`,
    speakingRate: 1.0,
    volumeGainDb: 0.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function uploadToConvex(audioBuffer: Buffer, contentType: string): Promise<{ storageId: string }> {
  if (!ENV.convexUrl) throw new Error("CONVEX_URL is not configured. Check Vercel environment variables.");

  const uploadUrlResponse = await fetch(`${ENV.convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Shared secret gate: the Convex mutation validates this against its own
    // TTS_API_SECRET env var (this REST call carries no Clerk identity).
    body: JSON.stringify({ path: "vocabulary:generateUploadUrl", args: { secret: process.env.TTS_API_SECRET ?? "" } }),
  });
  if (!uploadUrlResponse.ok) throw new Error(`Failed to generate upload URL: ${uploadUrlResponse.status}`);

  const { value: uploadUrl } = await uploadUrlResponse.json();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
  const uploadResponse = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResponse.ok) throw new Error(`Convex file upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);

  const { storageId } = await uploadResponse.json();
  return { storageId };
}

async function generateSerbianAudio(options: {
  text: string;
  vocabularyId?: string;
  unitNumber?: number;
  contentType?: "phrases" | "dialogues";
}): Promise<{ storageId: string }> {
  if (!ENV.googleCloudServiceAccountKey) throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is not configured");

  let serviceAccountKey: any;
  const rawKey = ENV.googleCloudServiceAccountKey.trim();
  try {
    if (rawKey.toLowerCase().endsWith(".json") && fs.existsSync(rawKey)) {
      serviceAccountKey = JSON.parse(fs.readFileSync(rawKey, "utf8"));
    } else if (rawKey.startsWith("{")) {
      try { serviceAccountKey = JSON.parse(rawKey); }
      catch { serviceAccountKey = JSON.parse(rawKey.replace(/\\n/g, "\n")); }
    } else {
      throw new Error("Value must start with '{' (JSON) or end with '.json' (file path)");
    }
  } catch (error) {
    console.error("[TTS] Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY");
    throw new Error(`Failed to load GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  if (serviceAccountKey?.private_key && typeof serviceAccountKey.private_key === "string") {
    let pk = serviceAccountKey.private_key;
    if (pk.includes("\\n") && !pk.includes("\n")) pk = pk.replace(/\\n/g, "\n");
    pk = pk.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!pk.endsWith("\n")) pk += "\n";
    serviceAccountKey.private_key = pk;
  }
  if (!serviceAccountKey?.private_key || typeof serviceAccountKey.private_key !== "string") throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is missing private_key");
  if (!/(BEGIN (RSA )?PRIVATE KEY)/.test(serviceAccountKey.private_key)) throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key does not look like a PEM key.");
  try { createPrivateKey({ key: serviceAccountKey.private_key, format: "pem" }); }
  catch (e) { throw new Error(`GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY.private_key is not a valid PEM key: ${e instanceof Error ? e.message : String(e)}`); }

  const client = new TextToSpeechClient({
    credentials: serviceAccountKey,
    projectId: serviceAccountKey.project_id,
    apiEndpoint: 'texttospeech.googleapis.com',
  });

  const { ssml, speakingRate, volumeGainDb } = buildTtsPayload(options.text);

  const request = {
    input: { ssml },
    voice: { languageCode: 'sr-RS', name: 'sr-RS-Standard-B', ssmlGender: 'FEMALE' as const },
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

async function authenticateRequest(req: VercelRequest): Promise<boolean> {
  const ttsSecret = process.env.TTS_API_SECRET;
  if (ttsSecret && req.headers["x-tts-secret"] === ttsSecret) return true;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("[TTS Auth] CLERK_SECRET_KEY not configured");
    return false;
  }

  try {
    await verifyToken(token, { secretKey });
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  const allowed = isAllowedOrigin(origin);

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowed || '');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-TTS-Secret');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!allowed && origin) {
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }

  const isAuthenticated = await authenticateRequest(req);
  if (!isAuthenticated) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { serbianWord, text, vocabularyId, unitNumber, contentType } = req.body;
    const effectiveText = (typeof text === "string" && text.trim())
      ? text.trim()
      : (typeof serbianWord === "string" && serbianWord.trim() ? serbianWord.trim() : "");

    if (!effectiveText) return res.status(400).json({ success: false, error: '"text" or "serbianWord" is required' });

    const { storageId } = await generateSerbianAudio({ text: effectiveText, vocabularyId, unitNumber, contentType });
    res.json({ success: true, storageId });
  } catch (error: any) {
    console.error('[Audio Generation] Error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
  }
}
