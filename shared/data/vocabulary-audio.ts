/**
 * Vocabulary audio mapping for Serbian words
 * Maps vocabulary words to their audio pronunciation files
 */

export interface VocabularyAudio {
  word: string;
  translation: string;
  audioUrl: string;
  category?: string;
}

/**
 * Vocabulary audio database
 * TODO: Populate with actual audio files from Google Cloud TTS
 */
export const vocabularyAudioMap: Record<string, VocabularyAudio> = {};

/**
 * Get vocabulary audio for a word
 */
export function getVocabularyAudio(word: string): VocabularyAudio | null {
  return vocabularyAudioMap[word.toLowerCase()] || null;
}

/**
 * Check if a word has audio available
 */
export function hasVocabularyAudio(word: string): boolean {
  return word.toLowerCase() in vocabularyAudioMap;
}

/**
 * Get all vocabulary with audio in a category
 */
export function getVocabularyByCategory(category: string): VocabularyAudio[] {
  return Object.values(vocabularyAudioMap).filter(
    (audio) => audio.category === category
  );
}






