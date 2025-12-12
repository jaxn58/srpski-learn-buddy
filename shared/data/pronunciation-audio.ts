/**
 * Pronunciation audio mapping for Serbian words
 * Maps words to their audio file paths
 */

export interface PronunciationAudio {
  word: string;
  audioUrl: string;
  phonetic?: string;
}

/**
 * Pronunciation audio database
 * TODO: Populate with actual audio files
 */
export const pronunciationAudioMap: Record<string, PronunciationAudio> = {};

/**
 * Get pronunciation audio for a word
 */
export function getPronunciationAudio(
  word: string
): PronunciationAudio | null {
  return pronunciationAudioMap[word.toLowerCase()] || null;
}

/**
 * Check if a word has pronunciation audio available
 */
export function hasPronunciationAudio(word: string): boolean {
  return word.toLowerCase() in pronunciationAudioMap;
}


