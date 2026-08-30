import { describe, it, expect } from "vitest";
import { isHiddenFilm } from "@/lib/hidden";

const hidden = { titleSubstrings: ["harry potter", "minions"] };

describe("isHiddenFilm", () => {
  it("matches a hidden title as a case-insensitive substring", () => {
    expect(isHiddenFilm("Harry Potter and the Philosopher's Stone", hidden)).toBe(true);
    expect(isHiddenFilm("25 Years of Magic - Harry Potter and the Chamber of Secrets", hidden)).toBe(true);
    expect(isHiddenFilm("  MINIONS ", hidden)).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(isHiddenFilm("The Odyssey", hidden)).toBe(false);
    expect(isHiddenFilm("Potter's Field", hidden)).toBe(false);
  });

  it("no-ops with an empty blocklist", () => {
    expect(isHiddenFilm("Harry Potter", { titleSubstrings: [] })).toBe(false);
  });
});
