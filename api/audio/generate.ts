/**
 * Vercel Serverless Function for Audio Generation
 * 
 * This endpoint generates Serbian pronunciation audio using Google Cloud TTS
 * and uploads it to S3 storage.
 * 
 * POST /api/audio/generate
 * Body: { serbianWord: string, vocabularyId?: string, unitNumber?: number }
 * Response: { success: true, audioUrl: string } | { success: false, error: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const AUDIO_VERSION_TAG = "puck-v2";

// Environment variables
const ENV = {
  googleCloudServiceAccountKey: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  awsBucketName: process.env.AWS_BUCKET_NAME ?? "",
  awsRegion: process.env.AWS_REGION ?? "eu-central-1",
};

/**
 * Upload audio buffer to S3 storage
 */
async function uploadToS3(
  storagePath: string,
  audioBuffer: Buffer,
  contentType: string
): Promise<{ url: string }> {
  if (!ENV.awsAccessKeyId || !ENV.awsSecretAccessKey || !ENV.awsBucketName) {
    throw new Error("AWS credentials not configured");
  }

  const s3Client = new S3Client({
    region: ENV.awsRegion,
    credentials: {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey,
    },
  });

  const command = new PutObjectCommand({
    Bucket: ENV.awsBucketName,
    Key: storagePath,
    Body: audioBuffer,
    ContentType: contentType,
    ACL: 'public-read',
  });

  await s3Client.send(command);

  // Return public URL
  const url = `https://${ENV.awsBucketName}.s3.${ENV.awsRegion}.amazonaws.com/${storagePath}`;
  return { url };
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

    // Upload to S3
    const { url } = await uploadToS3(storagePath, audioBuffer, 'audio/mpeg');
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
