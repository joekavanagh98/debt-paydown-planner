// localStorage throws in Safari private mode and when quota is exceeded.
// Swallow failures so the app still runs in-memory.
//
// Generic over T with no runtime validation: caller is trusted to know the
// stored shape. Real schema validation arrives in v6 with Zod.
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Intentionally ignored: app continues in-memory if storage is unavailable.
  }
}
