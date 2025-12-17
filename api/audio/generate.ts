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

    // Import the audio generation function
    // Note: This will bundle the dependencies with the serverless function
    const { generateSerbianAudio } = await import('../../server/_core/textToSpeech');

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
