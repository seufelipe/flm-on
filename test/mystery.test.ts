import { describe, it, expect } from "vitest";
import { isMysteryFilm } from "@/lib/mystery";

describe("isMysteryFilm", () => {
  it("matches the cleaned strand title", () => {
    expect(isMysteryFilm("Mystery Matinee")).toBe(true);
  });

  it("still matches if the month/year suffix wasn't stripped", () => {
    expect(isMysteryFilm("Mystery Matinee August 2026")).toBe(true);
    expect(isMysteryFilm("MYSTERY MATINEE")).toBe(true);
  });

  it("does not match an ordinary film", () => {
    expect(isMysteryFilm("Mystery Train")).toBe(false);
    expect(isMysteryFilm("The Matinee Idol")).toBe(false);
  });
});
