export type SessionPreference = "permanent" | "week" | "browser-close";

const STORAGE_KEY = "session-preference";
const TIMESTAMP_KEY = "session-login-timestamp";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionPreference(): SessionPreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "permanent" || value === "week" || value === "browser-close") {
      return value;
    }
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
  return "permanent";
}

export function setSessionPreference(pref: SessionPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
}

export function setLoginTimestamp(): void {
  try {
    localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function getLoginTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(TIMESTAMP_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function isSessionExpired(): boolean {
  const ts = getLoginTimestamp();
  if (ts === null) return false;
  return Date.now() - ts > SEVEN_DAYS_MS;
}

export function clearLoginTimestamp(): void {
  try {
    localStorage.removeItem(TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}
