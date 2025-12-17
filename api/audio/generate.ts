/**
 * Vercel Serverless Function for Audio Generation
 * 
 * This endpoint generates Serbian pronunciation audio using Google Cloud TTS
 * and uploads it to Convex File Storage.
 * 
 * POST /api/audio/generate
 * Body: { serbianWord: string, vocabularyId?: string, unitNumber?: number }
 * Response: { success: true, audioUrl: string } | { success: false, error: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const AUDIO_VERSION_TAG = "puck-v2";

// Environment variables
const ENV = {
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
  convexUrl: process.env.VITE_CONVEX_URL ?? "",
};

/**
 * Upload audio buffer to Convex File Storage
 */
async function uploadToConvex(
  storagePath: string,
  audioBuffer: Buffer,
  contentType: string
): Promise<{ url: string }> {
  if (!ENV.convexUrl) {
    throw new Error("VITE_CONVEX_URL is not configured");
  }

  const convex = new ConvexHttpClient(ENV.convexUrl);

  // Generate upload URL from Convex
  const uploadUrl = await convex.mutation(api.vocabulary.generateUploadUrl);

  // Upload the audio file
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Convex file upload failed: ${response.status} ${response.statusText}`);
  }

  const { storageId } = await response.json();

  // Get the public URL for the uploaded file
  const fileUrl = await convex.query(api.vocabulary.getFileUrl, { storageId });

  return { url: fileUrl };
}

/**
 * Generate Serbian audio using Google Cloud TTS
 */
async function generateSerbianAudio(options: {
  serbianWord: string;
  vocabularyId?: string;
  unitNumber?: number;
}): Promise<{ url: string }> {
  if (!ENV.googleCloudServiceAccountKey) {
    throw new Error("GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY is not configured");
  }

  // Parse Service Account JSON
  let serviceAccountKey;
  try {
    serviceAccountKey = JSON.parse(ENV.googleCloudServiceAccountKey);
  } catch (error) {
    throw new Error(
      `Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Invalid JSON"}`
    );
  }

  // Initialize TTS client
  const client = new TextToSpeechClient({
    credentials: serviceAccountKey
  });

  // Configure TTS request
  const request = {
    input: { text: options.serbianWord },
    voice: {
      languageCode: 'sr-RS',
      name: 'sr-RS-Chirp3-HD-Puck',
      ssmlGender: 'MALE' as const
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: 0.9,
    }
  };

  try {
    // Generate audio
    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error("No audio content received from Google Cloud TTS");
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

    // Generate storage path
    const voiceBase = request.voice.name.split('-').pop()?.toLowerCase() || 'default';
    const voiceSuffix = `${voiceBase}-${AUDIO_VERSION_TAG}`;

    let storagePath: string;
    if (options.unitNumber !== undefined && options.vocabularyId) {
      storagePath = `audio/vocabulary/unit-${options.unitNumber}/${options.vocabularyId}-${voiceSuffix}.mp3`;
    } else if (options.vocabularyId) {
      storagePath = `audio/vocabulary/${options.vocabularyId}-${voiceSuffix}.mp3`;
    } else {
      // Fallback: use sanitized word
      const sanitizedWord = options.serbianWord
        .toLowerCase()
        .replace(/[^a-z0-9čćđšž]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      storagePath = `audio/vocabulary/${sanitizedWord}-${voiceSuffix}.mp3`;
    }

    // Upload to Convex File Storage
    const { url } = await uploadToConvex(storagePath, audioBuffer, 'audio/mpeg');
    return { url };
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
    const { serbianWord, vocabularyId, unitNumber } = req.body;

    if (!serbianWord || typeof serbianWord !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'serbianWord is required and must be a string',
      });
    }

    const { url } = await generateSerbianAudio({
      serbianWord,
      vocabularyId,
      unitNumber,
    });

    res.json({ success: true, audioUrl: url });
  } catch (error: any) {
    console.error('[Audio Generation] Error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
}
