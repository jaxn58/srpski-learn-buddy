/**
 * Serbian vocabulary TTS: SSML + audio hints for Google Cloud Text-to-Speech (Chirp3 sr-RS).
 * Centralizes homograph normalization, IPA fallbacks, and single-grapheme handling.
 */

export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeSsmlAttrValue(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Table headers often title-case clitics; Chirp3 otherwise reads them as English/German.
 */
const SERBIAN_LATIN_LOWER_FOR_TTS = new Set([
  "sam",
  "si",
  "je",
  "smo",
  "ste",
  "su",
  "jesam",
  "jesi",
  "jeste",
  "jest",
  "nisam",
  "nisi",
  "nije",
  "nismo",
  "niste",
  "nisu",
  "ja",
  "ti",
  "vi",
  "mi",
  "on",
  "ona",
  "ono",
  "im",
  "ih",
]);

export function serbianLatinForTts(text: string): string {
  const t = text.trim();
  const key = t.toLowerCase().normalize("NFC");
  if (SERBIAN_LATIN_LOWER_FOR_TTS.has(key)) return key;
  return t;
}

/**
 * IPA hints for short words still mis-read after normalization (e.g. "Ste" → "Te", "Ja" → German).
 * Keys: NFC lowercase.
 */
const IPA_BY_WORD: Record<string, string> = {
  ste: "stɛ",
  je: "jɛ",
  ti: "tɨ",
  vi: "ʋi",
  ja: "jɑ",
  /** Avoid English “see” reading for 2nd-person clitic */
  si: "sɨ",
  mi: "mɨ",
};

const SINGLE_GRAPHEME_IPA: Record<string, string> = {
  i: "i",
  a: "a",
  u: "u",
  o: "o",
  e: "ɛ",
};

function phonemeBlock(display: string, ipa: string): string {
  return `<phoneme alphabet="ipa" ph="${escapeSsmlAttrValue(ipa)}">${escapeSsml(display)}</phoneme>`;
}

function wrapWordWithIpaIfNeeded(spoken: string): string {
  const k = spoken.toLowerCase().normalize("NFC");
  const ipa = IPA_BY_WORD[k];
  if (ipa) return phonemeBlock(spoken, ipa);
  return escapeSsml(spoken);
}

function ssmlEdgeBreakMs(trimmed: string): number {
  const n = [...trimmed].length;
  if (n <= 4) return 420;
  if (n <= 10) return 300;
  return 260;
}

export type SerbianVocabularyTtsPayload = {
  ssml: string;
  speakingRate: number;
  volumeGainDb: number;
};

/**
 * Builds SSML + speakingRate / volumeGainDb for one vocabulary token or short phrase.
 */
export function buildSerbianVocabularyTtsPayload(rawText: string): SerbianVocabularyTtsPayload {
  const trimmed = rawText.trim();
  const graphemes = [...trimmed];
  const singleGrapheme = graphemes.length <= 1;
  const rateTag = "slow";

  let inner = trimmed;
  if (singleGrapheme && /^[A-Z]$/.test(trimmed)) {
    inner = trimmed.toLowerCase();
  }
  inner = serbianLatinForTts(inner);
  const spoken = serbianLatinForTts(trimmed);

  let result: SerbianVocabularyTtsPayload;

  if (singleGrapheme) {
    const speakingRate = 0.65;
    const volumeGainDb = 7.5;
    const edgeBreakMs = 820;
    const k = inner.toLowerCase().normalize("NFC");
    const ipa = SINGLE_GRAPHEME_IPA[k];
    const core = ipa ? phonemeBlock(inner, ipa) : escapeSsml(inner);
    const doubled = `${core}<break time="240ms"/>${core}`;
    const ssml = `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${doubled}</emphasis></prosody></lang><break time="${edgeBreakMs}ms"/></speak>`;
    result = { ssml, speakingRate, volumeGainDb };
  } else {
    const speakingRate = 0.9;
    const volumeGainDb = 0.0;
    const edgeBreakMs = ssmlEdgeBreakMs(trimmed);
    const body = wrapWordWithIpaIfNeeded(spoken);
    const ssml = `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS"><prosody rate="${rateTag}">${body}</prosody></lang><break time="${edgeBreakMs}ms"/></speak>`;
    result = { ssml, speakingRate, volumeGainDb };
  }

  // #region agent log
  fetch("http://127.0.0.1:7243/ingest/2809ce81-d7cd-4442-a6ea-472067536925", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2e128e" },
    body: JSON.stringify({
      sessionId: "2e128e",
      location: "shared/ttsSerbianSsml.ts:buildSerbianVocabularyTtsPayload",
      message: "serbian tts ssml built",
      data: {
        hypothesisId: "H1",
        trimmed,
        singleGrapheme,
        hasPhoneme: result.ssml.includes("<phoneme"),
        ssmlLen: result.ssml.length,
        ssmlPreview: result.ssml.slice(0, 200),
        speakingRate: result.speakingRate,
        volumeGainDb: result.volumeGainDb,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return result;
}
