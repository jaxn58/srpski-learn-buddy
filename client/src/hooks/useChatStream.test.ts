import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStream } from "./useChatStream";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function makeResponse(text: string): Response {
  return new Response(makeStream(text));
}

// Advance fake timers AND flush all pending microtasks (async reader loop).
async function advanceTime(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChatStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("starts in pending state with empty text", () => {
    const { result } = renderHook(() => useChatStream());

    expect(result.current.data.status).toBe("pending");
    expect(result.current.data.text).toBe("");
  });

  it("returns error status immediately when response has no body", () => {
    const { result } = renderHook(() => useChatStream());

    act(() => {
      result.current.feedResponse(new Response(null));
    });

    expect(result.current.data.status).toBe("error");
    expect(result.current.data.text).toBe("");
  });

  it("transitions through streaming → done and delivers full text", async () => {
    const { result } = renderHook(() => useChatStream());
    const text = "Hello World"; // 11 chars — needs ceil(11/3)=4 ticks × 50ms = 200ms

    act(() => result.current.feedResponse(makeResponse(text)));

    // 600ms: reader loop completes (microtasks), typewriter finishes (timers)
    await advanceTime(600);

    expect(result.current.data.status).toBe("done");
    expect(result.current.data.text).toBe(text);
  });

  it("shows partial text mid-stream before all chars are emitted", async () => {
    const { result } = renderHook(() => useChatStream());
    // 30 chars → needs 10 ticks; after 1 tick (60ms) text should be partial
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234";

    act(() => result.current.feedResponse(makeResponse(text)));

    await advanceTime(60); // 1-2 ticks worth

    expect(result.current.data.status).toBe("streaming");
    expect(result.current.data.text.length).toBeGreaterThan(0);
    expect(result.current.data.text.length).toBeLessThan(text.length);
  });

  it("reset() clears text and returns to pending", async () => {
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.feedResponse(makeResponse("test")));
    await advanceTime(500);

    expect(result.current.data.status).toBe("done");

    act(() => result.current.reset());

    expect(result.current.data.status).toBe("pending");
    expect(result.current.data.text).toBe("");
  });

  it("reset() during active stream stops the typewriter", async () => {
    const { result } = renderHook(() => useChatStream());
    const text = "This is a longer text that takes many ticks to display fully";

    act(() => result.current.feedResponse(makeResponse(text)));
    await advanceTime(60); // partially through streaming

    expect(result.current.data.status).toBe("streaming");

    act(() => result.current.reset());

    expect(result.current.data.status).toBe("pending");
    expect(result.current.data.text).toBe("");

    // Advancing further after reset should NOT change state
    await advanceTime(1000);
    expect(result.current.data.status).toBe("pending");
  });
});
