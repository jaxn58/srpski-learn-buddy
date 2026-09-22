import { describe, it, expect, vi, afterEach } from "vitest";
import { createAiCallTimer } from "../../convex/contentStudio/_shared";

afterEach(() => {
  vi.useRealTimers();
});

describe("createAiCallTimer", () => {
  it("has no value before any request", () => {
    expect(createAiCallTimer().longestMs()).toBeUndefined();
  });

  it("keeps the longest of several requests", async () => {
    vi.useFakeTimers();
    const timer = createAiCallTimer();
    const wait = (ms: number) => () =>
      new Promise<string>((resolve) => setTimeout(() => resolve("ok"), ms));

    const first = timer.measure(wait(1_000));
    await vi.advanceTimersByTimeAsync(1_000);
    await first;

    const second = timer.measure(wait(3_000));
    await vi.advanceTimersByTimeAsync(3_000);
    await second;

    expect(timer.longestMs()).toBe(3_000);
  });

  it("measures a request that fails, e.g. a timeout abort", async () => {
    vi.useFakeTimers();
    const timer = createAiCallTimer();
    const failing = timer.measure(
      () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI API timeout")), 90_000))
    );
    const assertion = expect(failing).rejects.toThrow("AI API timeout");
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
    expect(timer.longestMs()).toBe(90_000);
  });
});
