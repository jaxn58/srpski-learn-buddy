/**
 * Serbian vocabulary TTS: SSML + audio hints for Google Cloud Text-to-Speech (Chirp3 sr-RS).
 * Uses <sub alias="…"> with Cyrillic so the engine speaks Serbian, not English/German homographs.
 * (IPA <phoneme> with non-English symbols caused synthesizeSpeech failures in practice.)
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
 * Latin token -> Cyrillic string spoken instead (via <sub alias>), NFC keys lowercase.
 * Keeps Latin in UI/DB; TTS resolves to Serbian pronunciation.
 */
const CYRILLIC_SPOKEN_ALIAS: Record<string, string> = {
  ste: "сте",
  je: "је",
  ti: "ти",
  vi: "ви",
  ja: "ја",
  si: "си",
  mi: "ми",
  i: "и",
  a: "а",
  u: "у",
  o: "о",
  e: "е",
};

function subAliasBlock(displayLatin: string, spokenCyrillic: string): string {
  return `<sub alias="${escapeSsmlAttrValue(spokenCyrillic)}">${escapeSsml(displayLatin)}</sub>`;
}

function wrapWithCyrillicHintIfNeeded(display: string): string {
  const k = display.toLowerCase().normalize("NFC");
  const cy = CYRILLIC_SPOKEN_ALIAS[k];
  if (cy) return subAliasBlock(display, cy);
  return escapeSsml(display);
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
    const cy = CYRILLIC_SPOKEN_ALIAS[k];
    const core = cy ? subAliasBlock(inner, cy) : escapeSsml(inner);
    const doubled = `${core}<break time="240ms"/>${core}`;
    const ssml = `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${doubled}</emphasis></prosody></lang><break time="${edgeBreakMs}ms"/></speak>`;
    result = { ssml, speakingRate, volumeGainDb };
  } else {
    const speakingRate = 0.9;
    const volumeGainDb = 0.0;
    const edgeBreakMs = ssmlEdgeBreakMs(trimmed);
    const body = wrapWithCyrillicHintIfNeeded(spoken);
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
        hasSubAlias: result.ssml.includes("<sub "),
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
