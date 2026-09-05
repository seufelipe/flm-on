import { describe, it, expect } from "vitest";
import type { LanguageInfo } from "@/lib/languages";
import {
  displayLanguage,
  languageTooltip,
  captionMark,
  isLanguageName,
  hasNonEnglishLanguage,
  matchesLanguagePref,
} from "@/lib/languages";

describe("displayLanguage", () => {
  it("returns null for an ordinary English screening", () => {
    expect(displayLanguage()).toBeNull();
    expect(displayLanguage([])).toBeNull();
    expect(displayLanguage(["IMAX", "Parent and Baby"])).toBeNull();
  });

  it("reads an original language name (case-insensitive)", () => {
    expect(displayLanguage(["Tamil"])).toEqual({
      language: "Tamil",
      subtitled: false,
      openCaptioned: false,
      dubbed: false,
    });
    expect(displayLanguage(["  malayalam "])?.language).toBe("Malayalam");
  });

  it("reads subtitled / dubbed, with or without a language", () => {
    expect(displayLanguage(["Subtitled"])).toEqual({
      subtitled: true,
      openCaptioned: false,
      dubbed: false,
    });
    expect(displayLanguage(["Dubbed"])).toEqual({
      subtitled: false,
      openCaptioned: false,
      dubbed: true,
    });
    expect(displayLanguage(["Kannada", "Subtitled"])).toEqual({
      language: "Kannada",
      subtitled: true,
      openCaptioned: false,
      dubbed: false,
    });
  });

  it("keeps open captions apart from a subtitle track", () => {
    expect(displayLanguage(["Open Captioned"])).toEqual({
      subtitled: false,
      openCaptioned: true,
      dubbed: false,
    });
  });

  it("ignores unrelated tags alongside a language", () => {
    expect(displayLanguage(["Big Screen Classics", "French", "35mm"])?.language).toBe("French");
  });

  it("recognises the wider language set Letterboxd's Primary Language field uses", () => {
    for (const name of ["Korean", "Japanese", "Mandarin", "Cantonese", "Georgian", "Wolof", "Scottish Gaelic"]) {
      expect(displayLanguage([name])?.language).toBe(name);
    }
  });
});

describe("captionMark", () => {
  const info = (over: Partial<LanguageInfo>): LanguageInfo => ({
    subtitled: false,
    openCaptioned: false,
    dubbed: false,
    ...over,
  });

  it("is the per-showtime OC / ST / Dub only — never the language name", () => {
    expect(captionMark(info({ language: "Tamil", subtitled: true }))).toBe("ST");
    expect(captionMark(info({ openCaptioned: true }))).toBe("OC");
    expect(captionMark(info({ language: "French", dubbed: true }))).toBe("Dub");
    expect(captionMark(info({ language: "French" }))).toBeNull();
  });

  it("prefers OC over ST — an open-captioned session is always captioned", () => {
    expect(captionMark(info({ subtitled: true, openCaptioned: true }))).toBe("OC");
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

  it("opens every sentence with a preposition, the dubbed case included", () => {
    expect(languageTooltip(["Spanish", "Dubbed"])).toBe("Originally in Spanish, dubbed into English");
  });

  it("says something different for open captions than for a subtitle track", () => {
    // On an English film they are the accessibility screening, so name what they carry.
    expect(languageTooltip(["Open Captioned"])).toBe("With open captions, including sound descriptions");
    // On a foreign film they are the translation, already implied by the language.
    expect(languageTooltip(["Korean", "Open Captioned"])).toBe("In Korean, with open captions");
  });
});

describe("matchesLanguagePref", () => {
  it("'any' passes everything", () => {
    expect(matchesLanguagePref("any", ["Tamil"])).toBe(true);
    expect(matchesLanguagePref("any", undefined)).toBe(true);
  });

  it("'english' keeps only films with no non-English language", () => {
    expect(matchesLanguagePref("english", ["IMAX"])).toBe(true);
    expect(matchesLanguagePref("english", ["Subtitled"])).toBe(true); // no language name
    expect(matchesLanguagePref("english", ["French"])).toBe(false);
    expect(matchesLanguagePref("english", ["Tamil", "Subtitled"])).toBe(false);
  });

  it("'non-english' keeps only films with a non-English language", () => {
    expect(matchesLanguagePref("non-english", ["French"])).toBe(true);
    expect(matchesLanguagePref("non-english", ["Kannada", "Subtitled"])).toBe(true);
    expect(matchesLanguagePref("non-english", ["IMAX"])).toBe(false);
    expect(matchesLanguagePref("non-english", undefined)).toBe(false);
  });
});

describe("hasNonEnglishLanguage", () => {
  it("is true only for a genuine non-English original language", () => {
    expect(hasNonEnglishLanguage(["French"])).toBe(true);
    expect(hasNonEnglishLanguage(["Kannada", "Subtitled"])).toBe(true);
  });

  it("is false for an English film with only a subtitled / open-captioned session", () => {
    expect(hasNonEnglishLanguage(["Subtitled"])).toBe(false);
    expect(hasNonEnglishLanguage(["Open Captioned"])).toBe(false);
    expect(hasNonEnglishLanguage(["Dubbed"])).toBe(false);
    expect(hasNonEnglishLanguage(["IMAX"])).toBe(false);
    expect(hasNonEnglishLanguage(undefined)).toBe(false);
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
