import { describe, it, expect } from "vitest";
import {
  displayLanguage,
  languageTooltip,
  languageMarkLabel,
  isLanguageName,
} from "@/lib/languages";

describe("displayLanguage", () => {
  it("returns null for an ordinary English screening", () => {
    expect(displayLanguage()).toBeNull();
    expect(displayLanguage([])).toBeNull();
    expect(displayLanguage(["IMAX", "Parent and Baby"])).toBeNull();
  });

  it("reads an original language name (case-insensitive)", () => {
    expect(displayLanguage(["Tamil"])).toEqual({ language: "Tamil", subtitled: false, dubbed: false });
    expect(displayLanguage(["  malayalam "])?.language).toBe("Malayalam");
  });

  it("reads subtitled / dubbed, with or without a language", () => {
    expect(displayLanguage(["Subtitled"])).toEqual({ subtitled: true, dubbed: false });
    expect(displayLanguage(["Open Captioned"])?.subtitled).toBe(true);
    expect(displayLanguage(["Dubbed"])).toEqual({ subtitled: false, dubbed: true });
    expect(displayLanguage(["Kannada", "Subtitled"])).toEqual({
      language: "Kannada",
      subtitled: true,
      dubbed: false,
    });
  });

  it("ignores unrelated tags alongside a language", () => {
    expect(displayLanguage(["Big Screen Classics", "French", "35mm"])?.language).toBe("French");
  });
});

describe("languageMarkLabel", () => {
  it("is terse — language plus ST/Dub", () => {
    expect(languageMarkLabel({ language: "Tamil", subtitled: true, dubbed: false })).toBe("Tamil · ST");
    expect(languageMarkLabel({ subtitled: true, dubbed: false })).toBe("ST");
    expect(languageMarkLabel({ language: "French", subtitled: false, dubbed: true })).toBe("French · Dub");
  });
});

describe("languageTooltip", () => {
  it("spells the situation out", () => {
    expect(languageTooltip(["Tamil", "Subtitled"])).toBe("In Tamil, with English subtitles");
    expect(languageTooltip(["Subtitled"])).toBe("With English subtitles");
    expect(languageTooltip(["Dubbed"])).toBe("Dubbed into English");
    expect(languageTooltip(["French"])).toBe("In French");
    expect(languageTooltip(["IMAX"])).toBeUndefined();
  });
});

describe("isLanguageName", () => {
  it("recognises known languages only", () => {
    expect(isLanguageName("Tamil")).toBe(true);
    expect(isLanguageName("  FRENCH ")).toBe(true);
    expect(isLanguageName("Ai")).toBe(false);
    expect(isLanguageName("Subtitled")).toBe(false);
  });
});
