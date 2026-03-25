import { useCallback, useMemo, useRef, useState } from "react";
import { whenAudioCanPlayThrough } from "@/lib/whenAudioCanPlayThrough";

type ContentType = "phrases" | "dialogues";

type PlayArgs = {
  unitNumber: number;
  language: string;
  contentType: ContentType;
  textSr: string;
};

const AUDIO_VERSION_TAG = "puck-v3";
const DEFAULT_VOICE_KEY = "default";

function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

function normalizeTextForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function useUnitContentAudioPlayback() {
  const [playingTextHash, setPlayingTextHash] = useState<string | null>(null);
  const [loadingTextHash, setLoadingTextHash] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cache: textHash -> storageId
  const storageCacheRef = useRef<Record<string, string>>({});

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
    }
    audioRef.current = null;
    setPlayingTextHash(null);
    setLoadingTextHash(null);
  }, []);

  const play = useCallback(
    async ({ unitNumber, language, contentType, textSr }: PlayArgs) => {
      const cleanedText = normalizeTextForHash(textSr);
      if (!cleanedText) return;

      // Stop anything currently playing (keeps UX predictable)
      stop();

      const textHash = fnv1a32Hex(`${AUDIO_VERSION_TAG}::${DEFAULT_VOICE_KEY}::${cleanedText}`);
      setLoadingTextHash(textHash);

      try {
        // 1) cache lookup
        let storageId = storageCacheRef.current[textHash];

        // 2) server-side cache lookup (Convex)
        if (!storageId) {
          const q = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: "unitContentAudio:getByTextHash",
              args: { textHash },
            }),
          });

          if (q.ok) {
            const result = await q.json();
            const value = result?.value as { audioStorageId?: string } | null | undefined;
            if (value?.audioStorageId) {
              storageId = String(value.audioStorageId);
              storageCacheRef.current[textHash] = storageId;
            }
          }
        }

        // 3) generate audio if missing
        if (!storageId) {
          const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
          const audioEndpoint = configuredServerUrl ? `${configuredServerUrl}/api/audio/generate` : "/api/audio/generate";

          const response = await fetch(audioEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: cleanedText,
              unitNumber,
              contentType,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Audio generation failed: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const result = await response.json();
          if (!result.success || !result.storageId) {
            throw new Error("Invalid response from audio generation endpoint");
          }

          storageId = String(result.storageId);
          storageCacheRef.current[textHash] = storageId;

          // Persist cache (no auth required; mirrors vocabulary audio behavior)
          fetch(`${import.meta.env.VITE_CONVEX_URL}/api/mutation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: "unitContentAudio:upsert",
              args: {
                unitNumber,
                language,
                contentType,
                textSr: cleanedText,
                voiceKey: DEFAULT_VOICE_KEY,
                textHash,
                audioStorageId: storageId,
              },
            }),
          }).catch(() => {
            // ignore (cache is best-effort)
          });
        }

        // 4) Get fresh URL from storageId (reuse existing helper)
        const urlResp = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "vocabulary:getAudioUrlFromStorageId",
            args: { storageId },
          }),
        });

        if (!urlResp.ok) {
          throw new Error(`Failed to get audio URL: ${urlResp.status}`);
        }

        const urlJson = await urlResp.json();
        const audioUrl = urlJson.value as string | null | undefined;
        if (!audioUrl) {
          throw new Error("Failed to generate audio URL from storageId");
        }

        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.preload = "auto";

          audio.onplay = () => {
            setPlayingTextHash(textHash);
            setLoadingTextHash(null);
          };

          audio.onended = () => {
            setPlayingTextHash(null);
            resolve();
          };

          audio.onerror = () => {
            setPlayingTextHash(null);
            setLoadingTextHash(null);
            reject(audio.error ?? new Error("Audio playback failed"));
          };

          void (async () => {
            try {
              await whenAudioCanPlayThrough(audio);
              await audio.play();
            } catch (err) {
              setPlayingTextHash(null);
              setLoadingTextHash(null);
              reject(err);
            }
          })();
        });
      } catch (error) {
        console.error("Failed to play unit content audio:", error);
        setLoadingTextHash(null);
        setPlayingTextHash(null);

        const errorMessage =
          error instanceof Error && error.message === "Failed to fetch"
            ? "Server not reachable. Please ensure the backend is running."
            : "Failed to generate audio. Please try again.";

        alert(errorMessage);
      }
    },
    [stop]
  );

  return useMemo(
    () => ({
      play,
      stop,
      playingTextHash,
      loadingTextHash,
    }),
    [play, stop, playingTextHash, loadingTextHash]
  );
}

