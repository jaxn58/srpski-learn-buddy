import { useMutation } from "convex/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { whenAudioCanPlayThrough } from "@/lib/whenAudioCanPlayThrough";

type PlayArgs = {
  vocabularyId: string;
  serbianWord: string;
  unitNumber?: number;
  audioStorageId?: string | null;
};

export function useVocabularyAudioPlayback() {
  const updateVocabularyAudioStorageId = useMutation(api.vocabulary.updateVocabularyAudioStorageId);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Cache: vocabularyId -> storageId
  const [audioStorageCache, setAudioStorageCache] = useState<Record<string, string>>({});
  const cacheRef = useRef(audioStorageCache);
  cacheRef.current = audioStorageCache;

  const play = useCallback(
    async ({ vocabularyId, serbianWord, unitNumber, audioStorageId }: PlayArgs) => {
      // Prevent multiple simultaneous requests
      if (loadingAudioId || playingAudioId === vocabularyId) {
        return;
      }

      setLoadingAudioId(vocabularyId);

      try {
        // 1) cache / provided storageId
        let storageId =
          cacheRef.current[vocabularyId] ||
          (audioStorageId && audioStorageId.trim() ? audioStorageId.trim() : undefined);

        // 2) If not found, generate via server endpoint
        if (!storageId) {
          const configuredServerUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "");
          const audioEndpoint = configuredServerUrl ? `${configuredServerUrl}/api/audio/generate` : "/api/audio/generate";

          const response = await fetch(audioEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              serbianWord,
              vocabularyId,
              unitNumber,
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

          // Save to cache immediately
          setAudioStorageCache((prev) => ({ ...prev, [vocabularyId]: storageId! }));

          // Persist asynchronously
          updateVocabularyAudioStorageId({
            vocabularyId: vocabularyId as any,
            audioStorageId: storageId,
          }).catch((err) => console.error("Failed to save audio storageId to DB:", err));
        }

        // 3) Get fresh URL from storageId (direct Convex query)
        const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "vocabulary:getAudioUrlFromStorageId",
            args: { storageId },
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to get audio URL: ${response.status}`);
        }

        const result = await response.json();
        const audioUrl = result.value as string | null | undefined;

        if (!audioUrl) {
          throw new Error("Failed to generate audio URL from storageId");
        }

        const audio = new Audio(audioUrl);
        audio.preload = "auto";

        audio.onplay = () => {
          setPlayingAudioId(vocabularyId);
          setLoadingAudioId(null);
        };

        audio.onended = () => {
          setPlayingAudioId(null);
        };

        audio.onerror = (e) => {
          setLoadingAudioId(null);
          setPlayingAudioId(null);
          console.error("Audio playback failed", e);
        };

        await whenAudioCanPlayThrough(audio);
        await audio.play();
      } catch (error) {
        console.error("Failed to get audio:", error);
        setLoadingAudioId(null);

        const errorMessage =
          error instanceof Error && error.message === "Failed to fetch"
            ? "Server not reachable. Please ensuring 'pnpm dev:server' is running."
            : "Failed to generate audio. Please try again.";

        alert(errorMessage);
      }
    },
    [loadingAudioId, playingAudioId, updateVocabularyAudioStorageId]
  );

  return useMemo(
    () => ({
      play,
      playingAudioId,
      loadingAudioId,
    }),
    [play, playingAudioId, loadingAudioId]
  );
}

