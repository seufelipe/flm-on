import { describe, it, expect } from "vitest";
import { isShortFilm, SHORT_FILM_MAX_MINS } from "@/lib/duration";

describe("isShortFilm", () => {
  it("treats an unknown runtime as not-short", () => {
    expect(isShortFilm(undefined)).toBe(false);
  });

  it("is short below the threshold, a feature at or above it", () => {
    expect(isShortFilm(SHORT_FILM_MAX_MINS - 1)).toBe(true);
    expect(isShortFilm(24)).toBe(true);
    expect(isShortFilm(SHORT_FILM_MAX_MINS)).toBe(false);
    expect(isShortFilm(120)).toBe(false);
  });
});
