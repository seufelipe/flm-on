import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  parseCineworldSchedule,
  normaliseTags,
  type CineworldSchedule,
  type CineworldMovie,
} from "@/lib/scrapers/cineworld";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf-8"));

const scheduleJson: CineworldSchedule = fixture("cineworld-schedule.json");
const movies: CineworldMovie[] = fixture("cineworld-movies.json");
const DAYS = ["2026-08-30", "2026-08-31"];

describe("cineworld normaliseTags", () => {
  it("drops ordinary projection tags and maps IMAX", () => {
    expect(normaliseTags(["Format.Projection.Digital", "Format.Projection.Laser"])).toEqual([]);
    expect(normaliseTags(["Format.Projection.Imax", "Format.Projection.Digital"])).toEqual(["IMAX"]);
  });

  it("keeps a language name, subtitles and event strands, spacing out camelCase", () => {
    expect(normaliseTags(["Localization.Language.Tamil", "Showtime.Accessibility.Subtitled"])).toEqual([
      "Tamil",
      "Subtitled",
    ]);
    expect(normaliseTags(["Showtime.Event.BigScreenClassics"])).toEqual(["Big Screen Classics"]);
    expect(normaliseTags(["Showtime.Accessibility.AutismFriendly"])).toEqual(["Autism Friendly"]);
  });

  it("drops premium-auditorium tags (4DX etc.) — not surfaced yet", () => {
    expect(normaliseTags(["Auditorium.Experience.4dx", "Format.Projection.Digital"])).toEqual([]);
  });
});

describe("cineworld parseCineworldSchedule", () => {
  const screenings = parseCineworldSchedule(scheduleJson, movies, DAYS);

  it("keeps every bookable session, one screening each", () => {
    expect(screenings.length).toBeGreaterThan(0);
    expect(screenings.every((s) => s.cinema === "cineworld")).toBe(true);
    expect(screenings.every((s) => DAYS.includes(s.date))).toBe(true);
    // bookingUrl is unique per session
    expect(new Set(screenings.map((s) => s.bookingUrl)).size).toBe(screenings.length);
    expect(screenings.every((s) => /web\.cineworld\.ie\/order\/showtimes\/0001-\d+/.test(s.bookingUrl))).toBe(true);
  });

  it("keeps an ordinary wide release, with no screeningTags", () => {
    const coyote = screenings.filter((s) => s.filmTitle === "Coyote vs Acme");
    expect(coyote.length).toBe(4);
    expect(coyote.every((s) => s.screeningTags === undefined)).toBe(true);

    // The Odyssey's plain digital sessions (8) plus its ": The IMAX Experience" companion (4).
    const odyssey = screenings.filter((s) => s.filmTitle === "The Odyssey");
    expect(odyssey.length).toBe(12);
    expect(odyssey.filter((s) => s.screeningTags?.includes("IMAX")).length).toBe(4);
    expect(odyssey.filter((s) => s.screeningTags === undefined).length).toBe(8);
  });

  it("converts runtime from seconds to minutes and reads the release year", () => {
    const toxic = screenings.find((s) => s.filmTitle === "Toxic");
    expect(toxic?.durationMins).toBe(175); // 10500s
    expect(toxic?.year).toBe(2026);
    expect(toxic?.cert).toBe("16");
    expect(toxic?.screeningTags).toEqual(["Kannada", "Subtitled"]);
  });

  it("leaves year/cert undefined for a repertory title with no release data", () => {
    const ai = screenings.filter((s) => s.filmTitle === "I (Ai)");
    expect(ai.length).toBeGreaterThan(0);
    expect(ai[0].year).toBeUndefined();
    expect(ai[0].cert).toBeUndefined();
    expect(ai[0].durationMins).toBe(188);
    // trailing "(Tamil)" stripped from the title; language carried as a tag instead
    expect(ai[0].screeningTags).toEqual(["Tamil", "Subtitled"]);
  });

  it("carries a genuinely different original title, drops one that's just the English title", () => {
    const dg = screenings.find((s) => s.filmTitle === "De Gaulle: Résistance");
    expect(dg?.originalTitle).toBe("La Bataille de Gaulle - partie 1 : L'Âge de Fer");
    expect(screenings.find((s) => s.filmTitle === "I (Ai)")?.originalTitle).toBeUndefined();
    expect(screenings.find((s) => s.filmTitle === "The Odyssey")?.originalTitle).toBeUndefined();
  });

  it("folds a ': The IMAX Experience' companion movie onto the base title with a synthetic IMAX tag", () => {
    const imax = screenings.filter((s) => s.filmTitle === "The Odyssey" && s.screeningTags?.includes("IMAX"));
    expect(imax.length).toBe(4);
    expect(imax[0].year).toBe(2026);
  });

  it("keeps a Big Screen Classics session even when it's also a 4DX showing", () => {
    const hp = screenings.filter((s) => s.filmTitle.startsWith("25 Years of Magic"));
    expect(hp.length).toBeGreaterThan(0);
    expect(hp.every((s) => s.screeningTags?.includes("Big Screen Classics"))).toBe(true);
    expect(hp.some((s) => s.screeningTags?.includes("4dx"))).toBe(false);
  });

  it("tags only the accessible session of an otherwise-ordinary blockbuster", () => {
    const spidey = screenings.filter((s) => s.filmTitle === "Spider-Man: Brand New Day");
    expect(spidey.length).toBe(8);
    expect(spidey.filter((s) => s.screeningTags?.includes("Autism Friendly")).length).toBe(1);
    expect(spidey.filter((s) => s.screeningTags === undefined).length).toBe(7);
  });

  it("honours the requested day set", () => {
    const oneDay = parseCineworldSchedule(scheduleJson, movies, ["2026-08-30"]);
    expect(oneDay.every((s) => s.date === "2026-08-30")).toBe(true);
    expect(oneDay.length).toBeLessThan(screenings.length);
  });

  it("builds a film-page URL from the movie id and slug", () => {
    const toxic = screenings.find((s) => s.filmTitle === "Toxic");
    expect(toxic?.filmPageUrl).toBe("https://www.cineworld.ie/movies/324492-toxic/");
  });
});
