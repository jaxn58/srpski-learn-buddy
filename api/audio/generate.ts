/**
 * Vercel Serverless Function for Audio Generation
 *
 * POST /api/audio/generate
 * Body: { serbianWord?: string, text?: string, vocabularyId?: string, unitNumber?: number, contentType?: "phrases" | "dialogues" }
 * Response: { success: true, storageId: string } | { success: false, error: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from "node:fs";
import { createPrivateKey } from "node:crypto";

const AUDIO_VERSION_TAG = "puck-v9";

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
 * Build SSML + audioConfig params for one Serbian Latin vocabulary token.
 *
 * Rules:
 * - Latin script only – no Cyrillic (app uses Serbian Latin throughout).
 * - speakingRate lives ONLY in audioConfig, never combined with <prosody rate>
 *   on the same content: layering both stretches the audio so badly that a single
 *   letter sounds like two ("sound → pause → letter" artefact).
 * - Very short words (≤4 graphemes) get no long leading/trailing breaks:
 *   large silent gaps at the start of very short MP3 clips cause audible artefacts.
 * - <emphasis level="strong"> + volume="x-loud" compensates for Chirp3 treating
 *   Serbian function words (ja, da, ti, …) as unstressed clitics in isolation.
 */
function buildTtsPayload(rawText: string): { ssml: string; speakingRate: number; volumeGainDb: number } {
  const trimmed = rawText.trim();
  const graphemeCount = [...trimmed].length;
  const w = escapeSsml(trimmed);

  // ── Single letter (I, A, U, O, E) ──────────────────────────────────────────
  if (graphemeCount <= 1) {
    return {
      // No leading/trailing breaks; no SSML rate (avoids doubling artefact).
      ssml: `<speak><lang xml:lang="sr-RS"><emphasis level="strong"><prosody volume="x-loud">${w}</prosody></emphasis></lang></speak>`,
      speakingRate: 0.75,
      volumeGainDb: 8.0,
    };
  }

  // ── Very short word: 2–4 graphemes (Da, Ja, Ti, Vi, Si, Iz, Ne, …) ─────────
  if (graphemeCount <= 4) {
    return {
      // Minimal 150 ms padding (enough for clean MP3 framing, not long enough to artefact).
      ssml: `<speak><break time="150ms"/><lang xml:lang="sr-RS"><emphasis level="strong"><prosody rate="slow" volume="x-loud">${w}</prosody></emphasis></lang><break time="150ms"/></speak>`,
      speakingRate: 0.85,
      volumeGainDb: 5.0,
    };
  }

  // ── Normal words ─────────────────────────────────────────────────────────────
  const ms = graphemeCount <= 10 ? 300 : 260;
  return {
    ssml: `<speak><break time="${ms}ms"/><lang xml:lang="sr-RS"><prosody rate="slow">${w}</prosody></lang><break time="${ms}ms"/></speak>`,
    speakingRate: 0.9,
    volumeGainDb: 0.0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function uploadToConvex(audioBuffer: Buffer, contentType: string): Promise<{ storageId: string }> {
  if (!ENV.convexUrl) throw new Error("CONVEX_URL is not configured. Check Vercel environment variables.");

  const uploadUrlResponse = await fetch(`${ENV.convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "vocabulary:generateUploadUrl", args: {} }),
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

    if (!effectiveText) return res.status(400).json({ success: false, error: '"text" or "serbianWord" is required' });

    const { storageId } = await generateSerbianAudio({ text: effectiveText, vocabularyId, unitNumber, contentType });
    res.json({ success: true, storageId });
  } catch (error: any) {
    console.error('[Audio Generation] Error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' });
  }
}
