import { describe, it, expect } from "vitest";
import { cleanFilmTitle, type TitleOverrides } from "@/lib/titles";

const overrides: TitleOverrides = {
  stripPrefixes: ["ARCHIVE AT LUNCHTIME:"],
  corrections: { "WEIRD RAW TITLE": "Weird Raw Title" },
};

describe("cleanFilmTitle", () => {
  it("strips a known prefix", () => {
    expect(cleanFilmTitle("ARCHIVE AT LUNCHTIME: Some Film", overrides)).toBe("Some Film");
  });

  it("is case-insensitive when matching a prefix", () => {
    expect(cleanFilmTitle("archive at lunchtime: Some Film", overrides)).toBe("Some Film");
  });

  it("applies a manual correction over prefix stripping", () => {
    expect(cleanFilmTitle("WEIRD RAW TITLE", overrides)).toBe("Weird Raw Title");
  });

  it("leaves an unaffected title unchanged", () => {
    expect(cleanFilmTitle("A Normal Film", overrides)).toBe("A Normal Film");
  });
});
