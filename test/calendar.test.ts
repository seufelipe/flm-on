import { describe, it, expect } from "vitest";
import { planToICS } from "@/lib/calendar";
import { withEndTimes } from "@/lib/clash";
import { CINEMA_ADDRESS } from "@/lib/cinemas";
import type { Screening } from "@/lib/scrapers/types";

const NOW = new Date("2026-09-04T13:15:00.000Z");

function screening(overrides: Partial<Screening> = {}): Screening {
  return {
    cinema: "lighthouse",
    cinemaName: "Light House Cinema",
    filmTitle: "Film A",
    durationMins: 100,
    date: "2026-09-05",
    time: "18:30",
    bookingUrl: "https://example.com/book/a",
    ...overrides,
  };
}

function ics(...overrides: Partial<Screening>[]): string {
  return planToICS(withEndTimes(overrides.map((o) => screening(o))), NOW);
}

// Content lines, unfolded — folding is tested separately and would otherwise break every
// substring assertion on a long value.
function unfolded(text: string): string[] {
  return text.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("planToICS", () => {
  it("wraps the events in a VCALENDAR carrying the Europe/Dublin zone definition", () => {
    const lines = unfolded(ics({}));
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("TZID:Europe/Dublin");
    expect(lines).toContain("BEGIN:VTIMEZONE");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("writes the start and end as local times tagged with the zone", () => {
    const lines = unfolded(ics({}));
    expect(lines).toContain("DTSTART;TZID=Europe/Dublin:20260905T183000");
    expect(lines).toContain("DTEND;TZID=Europe/Dublin:20260905T201000");
    expect(lines).toContain("DTSTAMP:20260904T131500Z");
  });

  it("emits one event per screening across a multi-day plan", () => {
    const lines = unfolded(
      ics(
        { bookingUrl: "https://example.com/a" },
        { date: "2026-09-07", time: "20:00", bookingUrl: "https://example.com/b" },
      ),
    );
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain("DTSTART;TZID=Europe/Dublin:20260905T183000");
    expect(lines).toContain("DTSTART;TZID=Europe/Dublin:20260907T200000");
  });

  it("rolls the end date over when a late screening runs past midnight", () => {
    const lines = unfolded(ics({ time: "23:30", durationMins: 150 }));
    expect(lines).toContain("DTSTART;TZID=Europe/Dublin:20260905T233000");
    expect(lines).toContain("DTEND;TZID=Europe/Dublin:20260906T020000");
  });

  it("falls back to a two-hour event when the cinema listed no runtime", () => {
    expect(unfolded(ics({ durationMins: undefined }))).toContain(
      "DTEND;TZID=Europe/Dublin:20260905T203000",
    );
  });

  // The venue name and the address must reach the calendar on separate lines, or the geocode
  // doesn't resolve and the event shows no map — so the newline has to survive as an escaped \n
  // rather than a raw break (which would end the content line and corrupt the file).
  it("puts the cinema's name and postal address in LOCATION, newline escaped", () => {
    expect(unfolded(ics({ cinema: "ifi", cinemaName: "IFI" }))).toContain(
      String.raw`LOCATION:Irish Film Institute (IFI)\n6 Eustace St\, Dublin 2\, D02 PD85\, Ireland`,
    );
  });

  it("keeps every cinema's location on one content line", () => {
    for (const cinema of ["lighthouse", "ifi", "cineworld"] as const) {
      const text = ics({ cinema });
      // One LOCATION property, and the raw newline never survives into the file.
      expect(unfolded(text).filter((l) => l.startsWith("LOCATION:"))).toHaveLength(1);
      expect(CINEMA_ADDRESS[cinema]).toContain("\n");
    }
  });

  // The event is what/where/when only — the film's own details stay in the app.
  it("gives the event no body: no description, and none of the film's details", () => {
    const text = ics({
      director: "Lynne Ramsay",
      year: 2025,
      cert: "15A",
      screeningTags: ["70mm", "Parent and Baby"],
    });
    expect(text).not.toContain("DESCRIPTION");
    for (const detail of ["Lynne Ramsay", "2025", "15A", "70mm", "Parent"]) {
      expect(text).not.toContain(detail);
    }
  });

  it("keeps the event to what, where and when", () => {
    const props = unfolded(ics({ director: "Agnès Varda", cert: "PG" }))
      .slice(unfolded(ics({})).indexOf("BEGIN:VEVENT"))
      .filter((l) => !l.startsWith(" "))
      .map((l) => l.split(/[;:]/)[0]);
    expect(props).toEqual([
      "BEGIN",
      "UID",
      "DTSTAMP",
      "DTSTART",
      "DTEND",
      "SUMMARY",
      "LOCATION",
      "END",
      "END",
    ]);
  });

  it("escapes the characters iCalendar reserves", () => {
    const lines = unfolded(ics({ filmTitle: String.raw`Cash, Semi; Colon\Slash` }));
    expect(lines).toContain(String.raw`SUMMARY:Cash\, Semi\; Colon\\Slash`);
  });

  it("never leaks the booking url into the file", () => {
    const text = ics({ bookingUrl: "https://booking.example.com/secret-session-42" });
    expect(text).not.toContain("URL:");
    expect(text).not.toContain("booking.example.com");
  });

  it("gives a screening the same uid every time, so a re-import updates rather than duplicates", () => {
    const first = unfolded(ics({})).find((l) => l.startsWith("UID:"));
    const second = unfolded(ics({})).find((l) => l.startsWith("UID:"));
    expect(first).toBe(second);
    expect(first).toMatch(/^UID:[0-9a-f]{8}@flm\.on$/);
  });

  it("ignores whitespace in a booking url, which Light House's carry mid-query-string", () => {
    const clean = unfolded(ics({ bookingUrl: "https://x.ie/t?a=1&b=2" }));
    const scraped = unfolded(ics({ bookingUrl: "https://x.ie/t?a=1\n&b=2" }));
    const uid = (lines: string[]) => lines.find((l) => l.startsWith("UID:"));
    expect(uid(scraped)).toBe(uid(clean));
  });

  it("gives two different screenings different uids", () => {
    const lines = unfolded(
      ics({ bookingUrl: "https://example.com/a" }, { bookingUrl: "https://example.com/b" }),
    ).filter((l) => l.startsWith("UID:"));
    expect(new Set(lines).size).toBe(2);
  });

  it("uses CRLF endings and folds every line to 75 octets", () => {
    const text = ics({
      filmTitle: "Sátántangó — a title long enough to need folding, with accented characters",
      director: "Béla Tarr",
      cinema: "cineworld",
      cinemaName: "Cineworld Dublin",
    });
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.split("\r\n").filter(Boolean).some((l) => l.startsWith(" "))).toBe(true);
    for (const line of text.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("never splits a line between a backslash and the character it escapes", () => {
    // Cineworld's address is long enough to fold, and its escaped commas sit near the break.
    const text = ics({
      cinema: "cineworld",
      cinemaName: "Cineworld Dublin",
      filmTitle: String.raw`A, B, C\D, and a title long enough to be folded somewhere`,
    });
    for (const line of text.split("\r\n")) {
      // An odd number of trailing backslashes means the last one is a dangling escape; an even
      // number is one or more complete `\\` pairs, which is fine.
      const trailing = /\\*$/.exec(line)![0].length;
      expect(trailing % 2).toBe(0);
    }
  });

  it("unfolds back to the original value", () => {
    const title = "Sátántangó — a title long enough to need folding, with accented characters";
    const summary = unfolded(ics({ filmTitle: title })).find((l) => l.startsWith("SUMMARY:"));
    expect(summary).toBe(`SUMMARY:${title.replace(/,/g, "\\,")}`);
  });

  it("produces a valid, event-free calendar for an empty plan", () => {
    const lines = unfolded(planToICS([], NOW));
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).not.toContain("BEGIN:VEVENT");
  });
});
