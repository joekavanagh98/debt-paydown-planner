// localStorage throws in Safari private mode and when quota is exceeded.
// Swallow failures so the app still runs in-memory.
export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Intentionally ignored: app continues in-memory if storage is unavailable.
  }
}
