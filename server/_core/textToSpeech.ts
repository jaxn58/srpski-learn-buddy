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
import { storagePut } from "server/storage";
import { ENV } from "./env";
import fs from "fs";
import path from "path";

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
 * Generates Serbian audio using Google Cloud Text-to-Speech API
 * and uploads it to S3 storage
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
    
    // Generate S3 storage path
    // Pattern: audio/vocabulary/{unitNumber}/{vocabularyId}-{voiceName}.mp3
    // Including voice name in path ensures we generate new files when voice changes
    const voiceBase = request.voice.name.split('-').pop()?.toLowerCase() || 'default';
    const voiceSuffix = `${voiceBase}-${AUDIO_VERSION_TAG}`;
    
    let storagePath: string;
    let sanitizedWord: string | undefined;
    if (options.unitNumber !== undefined && options.vocabularyId) {
      storagePath = `audio/vocabulary/unit-${options.unitNumber}/${options.vocabularyId}-${voiceSuffix}.mp3`;
    } else if (options.vocabularyId) {
      storagePath = `audio/vocabulary/${options.vocabularyId}-${voiceSuffix}.mp3`;
    } else {
      // Fallback: use sanitized serbian word as filename
      sanitizedWord = options.serbianWord
        .toLowerCase()
        .replace(/[^a-z0-9čćđšž]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      storagePath = `audio/vocabulary/${sanitizedWord}-${voiceSuffix}.mp3`;
    }
    
    // Try S3 Upload if configured
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      try {
        const { url } = await storagePut(
          storagePath,
          audioBuffer,
          'audio/mpeg'
        );
        return { url };
      } catch (e) {
        console.warn("S3 upload failed, falling back to local storage:", e);
      }
    }

    // Fallback: Local storage (for development)
    // Save to client/public/audio/vocabulary/...
    const publicDir = path.resolve(process.cwd(), "client/public");
    const fullPath = path.join(publicDir, storagePath);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file
    await fs.promises.writeFile(fullPath, audioBuffer);
    
    // Return relative URL (accessible via Vite dev server)
    const url = "/" + storagePath;

    return { url };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google Cloud TTS failed: ${error.message}`);
    }
    throw new Error("Google Cloud TTS failed with unknown error");
  }
}