// The saved day plan (localStorage) — the app's second piece of persisted state, alongside
// lib/preferences.ts. Just the set of picked screenings, stored as their bookingUrls (the
// per-session identity key — see ScreeningBrowser's keyOf). Persisted because the whole point of
// week-planning is coming back to it across several sittings.
//
// Stale keys (a past week's screenings, a bookingUrl no longer in showtimes.json) aren't migrated
// here: ScreeningBrowser filters them out on read against the live dataset, and prunes them from
// storage on the next write. No "your plan is from last week" notice — silent is right for a
// single-user app.

export const STORAGE_KEY = "flm-on:plan";

// The forward-compat / migration seam (mirrors normalize() in lib/preferences.ts): a bare array
// of strings, anything else → empty. A breaking change would branch on a stored shape here.
export function normalizePlan(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string") : [];
}

export function readPlan(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? [] : normalizePlan(JSON.parse(raw));
  } catch {
    return [];
  }
}

// --- useSyncExternalStore backing ------------------------------------------------------------
//
// Same pattern as lib/preferences.ts: reading localStorage through a store (not setState-in-effect)
// keeps SSR and the first client render consistent with no hydration warning. `loaded` rides in
// the snapshot so the plan surfaces can hold for the one frame before the first real read rather
// than flashing an empty count. A `storage` event keeps the plan in sync across tabs.

export interface PlanState {
  keys: string[];
  loaded: boolean;
}

export const PLAN_SERVER_SNAPSHOT: PlanState = { keys: [], loaded: false };

let state: PlanState = { keys: [], loaded: false };
let lastRaw: string | null | undefined;
const listeners = new Set<() => void>();

function refresh(): void {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (state.loaded && raw === lastRaw) return;
  lastRaw = raw;
  state = { keys: readPlan(), loaded: true };
}

export function subscribePlan(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      refresh();
      callback();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function planSnapshot(): PlanState {
  refresh();
  return state;
}

export function writePlan(next: string[]): void {
  const serialized = JSON.stringify(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // private-mode / quota / disabled storage — the plan just won't persist this session.
    }
  }
  lastRaw = serialized;
  state = { keys: next, loaded: true };
  listeners.forEach((l) => l());
}
