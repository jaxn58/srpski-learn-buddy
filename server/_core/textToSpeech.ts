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

const AUDIO_VERSION_TAG = "puck-v2";

export type GenerateSerbianAudioOptions = {
  serbianWord: string;
  vocabularyId?: string; // Optional: for better file naming
  unitNumber?: number; // Optional: for better file organization
};

export type GenerateSerbianAudioResponse = {
  url: string;
};

/**
 * Upload audio buffer to Convex File Storage
 */
async function uploadToConvex(
  audioBuffer: Buffer,
  contentType: string
): Promise<{ url: string }> {
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

  // Get the public URL for the uploaded file
  const fileUrlResponse = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "vocabulary:getFileUrl",
      args: { storageId },
    }),
  });

  if (!fileUrlResponse.ok) {
    throw new Error(`Failed to get file URL: ${fileUrlResponse.status}`);
  }

  const { value: fileUrl } = await fileUrlResponse.json();

  return { url: fileUrl };
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

  // Parse Service Account JSON from environment variable
  let serviceAccountKey;
  try {
    serviceAccountKey = JSON.parse(ENV.googleCloudServiceAccountKey);
  } catch (error) {
    throw new Error(
      `Failed to parse GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY: ${error instanceof Error ? error.message : "Invalid JSON"}`
    );
  }

  // Initialize Text-to-Speech client with Service Account credentials
  const client = new TextToSpeechClient({
    credentials: serviceAccountKey
  });
  
  // Configure TTS request for Serbian
  const request = {
    input: { text: options.serbianWord },
    voice: {
      languageCode: 'sr-RS',
      name: 'sr-RS-Chirp3-HD-Puck', // Male HD voice
      ssmlGender: 'MALE' as const
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      speakingRate: 0.9, // Slightly slower
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
    const { url } = await uploadToConvex(audioBuffer, 'audio/mpeg');

    return { url };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
    throw new Error("Google Cloud TTS failed with unknown error");
  }
}