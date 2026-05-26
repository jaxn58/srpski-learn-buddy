import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type StreamStatus = "pending" | "streaming" | "done" | "error";

export interface StreamBody {
  text: string;
  status: StreamStatus;
}

const CHAR_DELAY_MS = 50;
const CHARS_PER_TICK = 3;

/**
 * Typewriter hook for streaming chat responses.
 * Buffers network chunks and emits them character-by-character.
 * Does NOT query the DB -- the regular message list handles persistence.
 */
export function useChatStream(): {
  data: StreamBody;
  feedResponse: (response: Response) => void;
  reset: () => void;
} {
  const [displayText, setDisplayText] = useState("");
  const [status, setStatus] = useState<StreamStatus>("pending");

  const bufferRef = useRef("");
  const displayedLenRef = useRef(0);
  const networkDoneRef = useRef(false);
  const networkErrorRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTick(), [clearTick]);

  const reset = useCallback(() => {
    clearTick();
    bufferRef.current = "";
    displayedLenRef.current = 0;
    networkDoneRef.current = false;
    networkErrorRef.current = false;
    setDisplayText("");
    setStatus("pending");
  }, [clearTick]);

  const feedResponse = useCallback(
    (response: Response) => {
      reset();

      if (!response.body) {
        setStatus("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      intervalRef.current = setInterval(() => {
        const buf = bufferRef.current;
        const shown = displayedLenRef.current;

        if (shown < buf.length) {
          const next = Math.min(shown + CHARS_PER_TICK, buf.length);
          displayedLenRef.current = next;
          setDisplayText(buf.slice(0, next));
          setStatus("streaming");
        }

        if (
          displayedLenRef.current >= bufferRef.current.length &&
          networkDoneRef.current
        ) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setStatus(networkErrorRef.current ? "error" : "done");
        }
      }, CHAR_DELAY_MS);

      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            const text = decoder.decode(value, { stream: !done });
            if (text) bufferRef.current += text;
            if (done) {
              networkDoneRef.current = true;
              return;
            }
          }
        } catch (e) {
          console.error("Stream read error", e);
          networkDoneRef.current = true;
          networkErrorRef.current = true;
        }
      })();
    },
    [reset],
  );

  const data = useMemo<StreamBody>(
    () => ({ text: displayText, status }),
    [displayText, status],
  );

  return { data, feedResponse, reset };
}
