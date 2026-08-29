import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseFilmsPage, parseReleaseYear } from "@/lib/scrapers/lighthouse";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf-8");

describe("lighthouse parseFilmsPage", () => {
  const films = parseFilmsPage(fixture("lighthouse-films.html"));

  it("parses at least one film with title, cert, duration and a booking time", () => {
    expect(films.length).toBeGreaterThan(0);
    const tony = films.find((f) => f.title === "Tony");
    expect(tony).toBeDefined();
    expect(tony?.cert).toBe("15A");
    expect(tony?.durationMins).toBe(106);
    expect(tony?.times.length).toBeGreaterThan(0);
    expect(tony?.times[0].time).toMatch(/^\d{2}:\d{2}$/);
    expect(tony?.times[0].bookingUrl).toContain("web-booking.lighthousegroup.ie");
  });

  it("extracts a valid slug for the film detail page", () => {
    const tony = films.find((f) => f.title === "Tony");
    expect(tony?.slug).toBe("tony");
  });

  it("only includes films that actually have showtimes", () => {
    expect(films.every((f) => f.times.length > 0)).toBe(true);
  });

  it("reads per-session descriptors from em.additional", () => {
    const tony = films.find((f) => f.title === "Tony");
    const matinee = tony?.times.find((t) => t.time === "15:45");
    // Nested <em class="tooltip"> children, comma-separated in the markup.
    expect(matinee?.tags).toEqual(["Dubbed", "Parent and Baby"]);
    // A flat text em.additional (no inner tooltip) still parses, splitting on commas — here a
    // format descriptor (35mm) rides alongside the caption tag.
    expect(tony?.times.find((t) => t.time === "20:30")?.tags).toEqual(["Subtitled", "35mm"]);
  });

  it("leaves tags empty for an ordinary session", () => {
    const invite = films.find((f) => f.title === "The Invite");
    expect(invite?.times[0].tags).toEqual([]);
  });
});

describe("lighthouse parseReleaseYear", () => {
  it("extracts the year from the 'Released: DD-Mon-YYYY' field", () => {
    const year = parseReleaseYear(fixture("lighthouse-film-detail.html"));
    expect(year).toBe(2026);
  });
});
