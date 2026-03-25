/**
 * Wait until the browser has buffered enough of the media to play without stalling
 * (helps very short MP3 clips from being clipped at start).
 */
export function whenAudioCanPlayThrough(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onOk = () => {
      audio.removeEventListener("error", onBad);
      resolve();
    };
    const onBad = () => {
      audio.removeEventListener("canplaythrough", onOk);
      reject(audio.error ?? new Error("Audio failed to load"));
    };
    audio.addEventListener("canplaythrough", onOk, { once: true });
    audio.addEventListener("error", onBad, { once: true });
  });
}
