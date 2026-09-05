import { describe, it, expect } from "vitest";
import { isHighlight } from "@/lib/highlights";
import type { Screening } from "@/lib/scrapers/types";

// The "Specials, etc" lens, and what the app is allowed to volunteer unprompted
// (lib/startingPoints.ts). CLAUDE.md decision #14.
const screening = (over: Partial<Screening> = {}): Screening =>
  ({
    cinema: "lighthouse",
    cinemaName: "Light House Cinema",
    filmTitle: "Some Film",
    date: "2026-09-05",
    time: "18:00",
    bookingUrl: "https://example.test/1",
    ...over,
  }) as Screening;

describe("isHighlight", () => {
  it("is false for an ordinary wide-release showing", () => {
    expect(isHighlight(screening())).toBe(false);
    expect(isHighlight(screening({ screeningTags: [] }))).toBe(false);
  });

  it("counts a surfaced strand, a film format and a non-English original language", () => {
    expect(isHighlight(screening({ screeningTags: ["Parent and Baby"] }))).toBe(true);
    expect(isHighlight(screening({ screeningTags: ["70mm"] }))).toBe(true);
    expect(isHighlight(screening({ screeningTags: ["Korean", "Subtitled"] }))).toBe(true);
  });

  it("counts an open-captioned session of an English film", () => {
    // Scarce, and actively sought by the people who need them — the test this lens applies.
    expect(isHighlight(screening({ screeningTags: ["Open Captioned"] }))).toBe(true);
  });

  it("does NOT count a plain subtitled or dubbed session of an English film", () => {
    expect(isHighlight(screening({ screeningTags: ["Subtitled"] }))).toBe(false);
    expect(isHighlight(screening({ screeningTags: ["Dubbed"] }))).toBe(false);
  });

  it("does NOT count Big Screen Classics — the strand changes nothing about the screening", () => {
    // Its films reach the lens through their curated film-labels.json entry instead, which is
    // human-reviewed rather than whatever Cineworld chose to badge that week.
    expect(isHighlight(screening({ screeningTags: ["Big Screen Classics"] }))).toBe(false);
    expect(
      isHighlight(screening({ filmTitle: "Star Trek IV" }), { "star trek iv": "40th anniversary" }),
    ).toBe(true);
  });

  it("counts a curated editorial label, matched case- and whitespace-insensitively", () => {
    expect(isHighlight(screening({ filmTitle: "  Trainspotting " }), { trainspotting: "classic!" })).toBe(true);
    expect(isHighlight(screening({ filmTitle: "Trainspotting" }), { other: "classic!" })).toBe(false);
  });
});
