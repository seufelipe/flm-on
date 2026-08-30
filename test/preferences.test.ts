import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_PREFERENCES,
  STORAGE_KEY,
  isDefault,
  normalize,
  readPreferences,
  writePreferences,
} from "@/lib/preferences";

describe("normalize", () => {
  it("returns defaults for junk input", () => {
    expect(normalize(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(normalize(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalize("nope")).toEqual(DEFAULT_PREFERENCES);
    expect(normalize(42)).toEqual(DEFAULT_PREFERENCES);
  });

  it("merges a partial blob onto the defaults", () => {
    const out = normalize({ cinemas: { ifi: false } });
    expect(out.cinemas).toEqual({ lighthouse: true, ifi: false, cineworld: true });
    expect(out.timeframes).toEqual(DEFAULT_PREFERENCES.timeframes);
    expect(out.hideShortFilms).toBe(DEFAULT_PREFERENCES.hideShortFilms);
    expect(out.kidsOnly).toBe(false);
    expect(out.language).toBe("any");
  });

  it("defaults a newly-added cinema on for a blob saved before it existed", () => {
    const out = normalize({ cinemas: { lighthouse: true, ifi: false } });
    expect(out.cinemas.cineworld).toBe(true);
  });

  it("coerces non-boolean values to their default", () => {
    const out = normalize({ timeframes: { late: 1, mid: "yes" }, hideShortFilms: "false", kidsOnly: 1 });
    expect(out.timeframes.late).toBe(true);
    expect(out.timeframes.mid).toBe(true);
    expect(out.hideShortFilms).toBe(DEFAULT_PREFERENCES.hideShortFilms);
    expect(out.kidsOnly).toBe(false);
  });

  it("ignores unknown keys", () => {
    const out = normalize({ cinemas: { odeon: true }, wat: 5 });
    expect(out).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps a genuine boolean that differs from the default", () => {
    expect(normalize({ hideShortFilms: false }).hideShortFilms).toBe(false);
    expect(normalize({ kidsOnly: true }).kidsOnly).toBe(true);
    expect(normalize({ timeframes: { early: false } }).timeframes.early).toBe(false);
  });

  it("reads the language pref, ignoring junk", () => {
    expect(normalize({ language: "english" }).language).toBe("english");
    expect(normalize({ language: "non-english" }).language).toBe("non-english");
    expect(normalize({ language: "klingon" }).language).toBe("any");
    expect(normalize({ language: 3 }).language).toBe("any");
    expect(normalize({ hideDubbed: true }).language).toBe("any"); // old key, dropped
  });
});

describe("isDefault", () => {
  it("is true for the defaults and false once anything is off", () => {
    expect(isDefault(DEFAULT_PREFERENCES)).toBe(true);
    expect(isDefault(normalize({ cinemas: { ifi: false } }))).toBe(false);
    expect(isDefault(normalize({ hideShortFilms: false }))).toBe(false);
    expect(isDefault(normalize({ kidsOnly: true }))).toBe(false);
    expect(isDefault(normalize({ language: "non-english" }))).toBe(false);
  });
});

describe("read/writePreferences", () => {
  const store = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };

  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it("round-trips through storage", () => {
    vi.stubGlobal("window", { localStorage: fakeLocalStorage });
    const prefs = normalize({ cinemas: { ifi: false }, hideShortFilms: true });
    writePreferences(prefs);
    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify(prefs));
    expect(readPreferences()).toEqual(prefs);
  });

  it("falls back to defaults on a corrupt stored value", () => {
    vi.stubGlobal("window", { localStorage: fakeLocalStorage });
    store.set(STORAGE_KEY, "{not json");
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("returns defaults with no window (SSR)", () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });
});
