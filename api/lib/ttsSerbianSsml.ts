/**
 * Serbian vocabulary TTS: SSML + audio hints for Google Cloud Text-to-Speech (Chirp3 sr-RS).
 * Lives under api/ so Vercel bundles it with serverless routes (imports from ../../shared often fail at runtime).
 * Uses <sub alias="…"> with Cyrillic so the engine speaks Serbian, not English/German homographs.
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

  if (singleGrapheme) {
    const speakingRate = 0.65;
    const volumeGainDb = 7.5;
    const edgeBreakMs = 820;
    const k = inner.toLowerCase().normalize("NFC");
    const cy = CYRILLIC_SPOKEN_ALIAS[k];
    const core = cy ? subAliasBlock(inner, cy) : escapeSsml(inner);
    const doubled = `${core}<break time="240ms"/>${core}`;
    const ssml = `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS"><prosody rate="x-slow"><emphasis level="strong">${doubled}</emphasis></prosody></lang><break time="${edgeBreakMs}ms"/></speak>`;
    return { ssml, speakingRate, volumeGainDb };
  }

  const speakingRate = 0.9;
  const volumeGainDb = 0.0;
  const edgeBreakMs = ssmlEdgeBreakMs(trimmed);
  const body = wrapWithCyrillicHintIfNeeded(spoken);
  const ssml = `<speak><break time="${edgeBreakMs}ms"/><lang xml:lang="sr-RS"><prosody rate="${rateTag}">${body}</prosody></lang><break time="${edgeBreakMs}ms"/></speak>`;

  return { ssml, speakingRate, volumeGainDb };
}
