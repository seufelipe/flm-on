import type { CinemaId } from "@/lib/scrapers/types";
import { CINEMA_ORDER } from "@/lib/cinemas";
import { TIMEFRAMES, type Timeframe } from "@/lib/timeframe";

// The app's only persisted state (localStorage). Standing viewing preferences that pre-filter
// the whole dataset before the ephemeral Day/Cinema/Time filter bar sees it — see CLAUDE.md
// decision #14.
export interface Preferences {
  cinemas: Record<CinemaId, boolean>;
  timeframes: Record<Timeframe, boolean>;
  hideShortFilms: boolean;
  kidsOnly: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  cinemas: { lighthouse: true, ifi: true },
  timeframes: { early: true, mid: true, late: true },
  hideShortFilms: true,
  kidsOnly: false,
};

export const STORAGE_KEY = "flm-on:preferences";

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// Deep-merges an untrusted parsed blob onto DEFAULT_PREFERENCES: every known key is read
// explicitly, non-booleans fall back to their default, unknown keys are ignored. This is the
// forward-compatibility / migration seam — a future key just gets a default line here; a
// breaking change would branch on a stored `version` (add one at that point).
export function normalize(raw: unknown): Preferences {
  const root = asRecord(raw);
  const cinemas = asRecord(root.cinemas);
  const timeframes = asRecord(root.timeframes);
  return {
    cinemas: Object.fromEntries(
      CINEMA_ORDER.map((id) => [id, asBool(cinemas[id], DEFAULT_PREFERENCES.cinemas[id])]),
    ) as Record<CinemaId, boolean>,
    timeframes: Object.fromEntries(
      TIMEFRAMES.map((tf) => [tf.id, asBool(timeframes[tf.id], DEFAULT_PREFERENCES.timeframes[tf.id])]),
    ) as Record<Timeframe, boolean>,
    hideShortFilms: asBool(root.hideShortFilms, DEFAULT_PREFERENCES.hideShortFilms),
    kidsOnly: asBool(root.kidsOnly, DEFAULT_PREFERENCES.kidsOnly),
  };
}

export function isDefault(prefs: Preferences): boolean {
  return (
    CINEMA_ORDER.every((id) => prefs.cinemas[id] === DEFAULT_PREFERENCES.cinemas[id]) &&
    TIMEFRAMES.every((tf) => prefs.timeframes[tf.id] === DEFAULT_PREFERENCES.timeframes[tf.id]) &&
    prefs.hideShortFilms === DEFAULT_PREFERENCES.hideShortFilms &&
    prefs.kidsOnly === DEFAULT_PREFERENCES.kidsOnly
  );
}

export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_PREFERENCES : normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// --- useSyncExternalStore backing ------------------------------------------------------------
//
// Reading localStorage this way (rather than a setState-in-useEffect) keeps SSR and the first
// client render consistent without a hydration warning, and satisfies the react-hooks
// set-state-in-effect lint. `loaded` rides along in the snapshot so the film list can hold for
// the one frame between the server snapshot and the first real read (decision #14). A `storage`
// event also keeps preferences in sync across tabs.

export interface PreferencesState {
  prefs: Preferences;
  loaded: boolean;
}

export const PREFERENCES_SERVER_SNAPSHOT: PreferencesState = {
  prefs: DEFAULT_PREFERENCES,
  loaded: false,
};

let state: PreferencesState = { prefs: DEFAULT_PREFERENCES, loaded: false };
let lastRaw: string | null | undefined;
const listeners = new Set<() => void>();

function refresh(): void {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (state.loaded && raw === lastRaw) return;
  lastRaw = raw;
  state = { prefs: readPreferences(), loaded: true };
}

export function subscribePreferences(callback: () => void): () => void {
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

export function preferencesSnapshot(): PreferencesState {
  refresh();
  return state;
}

export function writePreferences(next: Preferences): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // private-mode / quota / disabled storage — preferences just won't persist this session.
    }
  }
  lastRaw = JSON.stringify(next);
  state = { prefs: next, loaded: true };
  listeners.forEach((l) => l());
}
