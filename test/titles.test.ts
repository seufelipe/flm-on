import { describe, it, expect } from "vitest";
import { cleanFilmTitle, titleAnnotation, type TitleOverrides } from "@/lib/titles";

const overrides: TitleOverrides = {
  stripPrefixes: ["ARCHIVE AT LUNCHTIME:", "CINEMA BOOK CLUB:"],
  stripAnnotations: [
    "\\d{1,3}(?:st|nd|rd|th)\\s+anniversary",
    "\\d+k(?:\\s+digital)?\\s+restoration",
    "digital\\s+restoration",
    "(?:january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{4}",
  ],
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

  it("strips a trailing restoration annotation, with or without parens or a dash", () => {
    expect(cleanFilmTitle("Trainspotting (4K Restoration)", overrides)).toBe("Trainspotting");
    expect(cleanFilmTitle("Amores perros - 4K Restoration", overrides)).toBe("Amores perros");
    expect(cleanFilmTitle("Kiki’s Delivery Service 4K Restoration", overrides)).toBe(
      "Kiki’s Delivery Service",
    );
  });

  it("strips a combined anniversary + restoration parenthetical", () => {
    expect(
      cleanFilmTitle("Sunset Boulevard (75th Anniversary 4K Restoration)", overrides),
    ).toBe("Sunset Boulevard");
  });

  it("strips a colon-separated anniversary annotation and the dangling colon", () => {
    expect(cleanFilmTitle("The Fast and the Furious: 25th Anniversary", overrides)).toBe(
      "The Fast and the Furious",
    );
  });

  it("strips a programme-strand prefix from a repertory screening", () => {
    expect(cleanFilmTitle("Cinema Book Club: Mrs. Doubtfire", overrides)).toBe("Mrs. Doubtfire");
  });

  it("strips a trailing month + year that a recurring strand appends", () => {
    expect(cleanFilmTitle("Mystery Matinee August 2026", overrides)).toBe("Mystery Matinee");
  });

  it("does not touch a title that merely contains a digit", () => {
    expect(cleanFilmTitle("Blade Runner 2049", overrides)).toBe("Blade Runner 2049");
  });
});

describe("titleAnnotation", () => {
  it("reports the stripped trailing annotation, lower-cased", () => {
    expect(titleAnnotation("The Fast and the Furious: 25th Anniversary", overrides)).toBe(
      "25th anniversary",
    );
    expect(titleAnnotation("Trainspotting (4K Restoration)", overrides)).toBe("4k restoration");
    expect(titleAnnotation("Amores perros - 4K Restoration", overrides)).toBe("4k restoration");
  });

  it("reports a combined annotation as one phrase", () => {
    expect(titleAnnotation("Sunset Boulevard (75th Anniversary 4K Restoration)", overrides)).toBe(
      "75th anniversary 4k restoration",
    );
  });

  it("is undefined when nothing is stripped or a correction handled the title", () => {
    expect(titleAnnotation("A Normal Film", overrides)).toBeUndefined();
    expect(titleAnnotation("WEIRD RAW TITLE", overrides)).toBeUndefined();
  });

  it("also reports a non-labelworthy annotation (fetch-batch filters to anniversary/restoration)", () => {
    expect(titleAnnotation("Mystery Matinee August 2026", overrides)).toBe("august 2026");
  });
});
