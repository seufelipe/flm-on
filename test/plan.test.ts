import { describe, it, expect, vi, afterEach } from "vitest";
import { STORAGE_KEY, normalizePlan, readPlan, writePlan } from "@/lib/plan";

describe("normalizePlan", () => {
  it("returns an empty array for junk input", () => {
    expect(normalizePlan(undefined)).toEqual([]);
    expect(normalizePlan(null)).toEqual([]);
    expect(normalizePlan("nope")).toEqual([]);
    expect(normalizePlan(42)).toEqual([]);
    expect(normalizePlan({ 0: "a" })).toEqual([]);
  });

  it("keeps the strings and drops non-string entries", () => {
    expect(normalizePlan(["a", "b"])).toEqual(["a", "b"]);
    expect(normalizePlan(["a", 1, null, "b", { x: 1 }])).toEqual(["a", "b"]);
  });
});

describe("read/writePlan", () => {
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
    writePlan(["https://x/1", "https://x/2"]);
    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify(["https://x/1", "https://x/2"]));
    expect(readPlan()).toEqual(["https://x/1", "https://x/2"]);
  });

  it("falls back to an empty plan on a corrupt stored value", () => {
    vi.stubGlobal("window", { localStorage: fakeLocalStorage });
    store.set(STORAGE_KEY, "{not json");
    expect(readPlan()).toEqual([]);
  });

  it("returns an empty plan with no window (SSR)", () => {
    expect(readPlan()).toEqual([]);
  });
});
