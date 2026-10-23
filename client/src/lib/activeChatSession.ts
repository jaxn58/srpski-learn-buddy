export type ActiveChatSessionInput = {
  sessionIds: readonly string[];
  currentSessionId: string | null;
  pinnedSessionId: string | null;
};

export type ActiveChatSessionResult = {
  sessionId: string | null;
  /** Cleared once the pinned id is present in `sessionIds`. */
  pinnedSessionId: string | null;
};

/**
 * Keeps a freshly created chat selected until the session list includes it.
 * Without a pin, a missing current id falls back to the newest session.
 */
export function resolveActiveChatSession(
  input: ActiveChatSessionInput,
): ActiveChatSessionResult {
  const { sessionIds, currentSessionId, pinnedSessionId } = input;

  if (pinnedSessionId) {
    if (!sessionIds.includes(pinnedSessionId)) {
      return { sessionId: pinnedSessionId, pinnedSessionId };
    }
    return { sessionId: pinnedSessionId, pinnedSessionId: null };
  }

  if (sessionIds.length === 0) {
    return { sessionId: null, pinnedSessionId: null };
  }

  if (currentSessionId && sessionIds.includes(currentSessionId)) {
    return { sessionId: currentSessionId, pinnedSessionId: null };
  }

  return { sessionId: sessionIds[0], pinnedSessionId: null };
}
