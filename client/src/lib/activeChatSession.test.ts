import { describe, expect, it } from "vitest";
import { resolveActiveChatSession } from "./activeChatSession";

describe("resolveActiveChatSession", () => {
  it("keeps a pinned session that is not in the list yet, even if the current id already fell back", () => {
    const result = resolveActiveChatSession({
      sessionIds: ["older"],
      currentSessionId: "older",
      pinnedSessionId: "fresh",
    });
    expect(result).toEqual({ sessionId: "fresh", pinnedSessionId: "fresh" });
  });

  it("keeps a pinned session when the list is still empty", () => {
    const result = resolveActiveChatSession({
      sessionIds: [],
      currentSessionId: "fresh",
      pinnedSessionId: "fresh",
    });
    expect(result).toEqual({ sessionId: "fresh", pinnedSessionId: "fresh" });
  });

  it("releases the pin once that session appears and keeps its id", () => {
    const result = resolveActiveChatSession({
      sessionIds: ["fresh", "older"],
      currentSessionId: "fresh",
      pinnedSessionId: "fresh",
    });
    expect(result).toEqual({ sessionId: "fresh", pinnedSessionId: null });
  });

  it("selects the first session when nothing is pinned and the current id is missing", () => {
    const result = resolveActiveChatSession({
      sessionIds: ["latest", "older"],
      currentSessionId: "gone",
      pinnedSessionId: null,
    });
    expect(result).toEqual({ sessionId: "latest", pinnedSessionId: null });
  });

  it("clears the selection when the list is empty and nothing is pinned", () => {
    const result = resolveActiveChatSession({
      sessionIds: [],
      currentSessionId: "gone",
      pinnedSessionId: null,
    });
    expect(result).toEqual({ sessionId: null, pinnedSessionId: null });
  });

  it("keeps the current session when it is already in the list", () => {
    const result = resolveActiveChatSession({
      sessionIds: ["latest", "current"],
      currentSessionId: "current",
      pinnedSessionId: null,
    });
    expect(result).toEqual({ sessionId: "current", pinnedSessionId: null });
  });
});
