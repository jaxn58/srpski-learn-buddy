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

const AUDIO_VERSION_TAG = "puck-v2";

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
): Promise<{ url: string }> {
  console.log('[DEBUG] ENV.convexUrl:', ENV.convexUrl);
  console.log('[DEBUG] process.env.CONVEX_URL:', process.env.CONVEX_URL);
  console.log('[DEBUG] process.env.VITE_CONVEX_URL:', process.env.VITE_CONVEX_URL);
  
  if (!ENV.convexUrl) {
    throw new Error("CONVEX_URL is not configured. Check Vercel environment variables.");
  }

  // Call Convex mutation to generate upload URL
  console.log('[DEBUG] Calling Convex mutation: vocabulary:generateUploadUrl');
  const uploadUrlResponse = await fetch(`${ENV.convexUrl}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "vocabulary:generateUploadUrl",
      args: {},
    }),
  });

  if (!uploadUrlResponse.ok) {
    const errorText = await uploadUrlResponse.text();
    console.log('[DEBUG] Upload URL response error:', uploadUrlResponse.status, errorText);
    throw new Error(`Failed to generate upload URL: ${uploadUrlResponse.status}`);
  }

  const uploadUrlJson = await uploadUrlResponse.json();
  console.log('[DEBUG] Upload URL response:', uploadUrlJson);
  const { value: uploadUrl } = uploadUrlJson;

  // Upload the audio file to Convex storage
  console.log('[DEBUG] Uploading file to Convex storage, size:', audioBuffer.length);
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: contentType });
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.log('[DEBUG] File upload error:', uploadResponse.status, errorText);
    throw new Error(`Convex file upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  const uploadJson = await uploadResponse.json();
  console.log('[DEBUG] Upload response:', uploadJson);
  const { storageId } = uploadJson;

  // Get the public URL for the uploaded file
  console.log('[DEBUG] Getting file URL for storageId:', storageId);
  const fileUrlResponse = await fetch(`${ENV.convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "vocabulary:getFileUrl",
      args: { storageId },
    }),
  });

  if (!fileUrlResponse.ok) {
    const errorText = await fileUrlResponse.text();
    console.log('[DEBUG] Get file URL error:', fileUrlResponse.status, errorText);
    throw new Error(`Failed to get file URL: ${fileUrlResponse.status}`);
  }

  const fileUrlJson = await fileUrlResponse.json();
  console.log('[DEBUG] File URL response:', fileUrlJson);
  const { value: fileUrl } = fileUrlJson;
  console.log('[DEBUG] Final file URL:', fileUrl);

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
  console.log('[DEBUG] googleCloudServiceAccountKey length:', ENV.googleCloudServiceAccountKey?.length);
  console.log('[DEBUG] googleCloudServiceAccountKey first 50 chars:', ENV.googleCloudServiceAccountKey?.substring(0, 50));
  
  let serviceAccountKey;
  try {
    serviceAccountKey = JSON.parse(ENV.googleCloudServiceAccountKey);
    console.log('[DEBUG] Parsed serviceAccountKey keys:', Object.keys(serviceAccountKey));
  } catch (error) {
    throw new Error(
      `Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Invalid JSON"}`
    );
  }

  // Initialize TTS client with explicit config
  console.log('[DEBUG] Initializing TTS client with credentials');
  console.log('[DEBUG] Service account email:', serviceAccountKey.client_email);
  console.log('[DEBUG] Project ID:', serviceAccountKey.project_id);
  
  const client = new TextToSpeechClient({
    credentials: serviceAccountKey,
    projectId: serviceAccountKey.project_id,
    // Explicitly set the API endpoint
    apiEndpoint: 'texttospeech.googleapis.com',
    // Disable retry for debugging
    retry: false
  });
  console.log('[DEBUG] TTS client initialized');

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
    console.log('[DEBUG] About to call synthesizeSpeech with request:', JSON.stringify(request, null, 2));
    console.log('[DEBUG] Client endpoint:', (client as any).apiEndpoint);
    console.log('[DEBUG] Client projectId:', (client as any).projectId);
    
    const [response] = await client.synthesizeSpeech(request);
    
    console.log('[DEBUG] synthesizeSpeech response received');
    
    if (!response.audioContent) {
      throw new Error("No audio content received from Google Cloud TTS");
    }

    console.log('[DEBUG] Audio content length:', response.audioContent.length);
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
