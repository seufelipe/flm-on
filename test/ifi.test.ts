import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseWhatsonDay } from "@/lib/scrapers/ifi";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf-8");

describe("ifi parseWhatsonDay", () => {
  const screenings = parseWhatsonDay(fixture("ifi-whatson.html"), "2026-08-28");

  it("emits one screening per bookable session, tagged with the requested date", () => {
    expect(screenings.length).toBeGreaterThan(0);
    expect(screenings.every((s) => s.date === "2026-08-28")).toBe(true);
  });

  it("captures a multi-session film's separate times and booking URLs", () => {
    const iwys = screenings.filter((s) => s.filmTitle === "I Want Your Sex");
    expect(iwys.map((s) => s.time)).toEqual(["12:50", "18:00"]);
    expect(new Set(iwys.map((s) => s.bookingUrl)).size).toBe(2);
    expect(iwys[0].bookingUrl).toBe("https://shop.ifi.ie/performance/112301/");
  });

  it("extracts runtime, cert, year and the IFI film-page URL from the card", () => {
    const tony = screenings.find((s) => s.filmTitle === "Tony");
    expect(tony?.durationMins).toBe(106);
    expect(tony?.cert).toBe("15A");
    expect(tony?.year).toBe(2026);
    expect(tony?.filmPageUrl).toBe("https://ifi.ie/films/tony");
  });

  it("only keeps real Irish film certs (not IFI's 'Club' badge)", () => {
    const certs = screenings.map((s) => s.cert).filter(Boolean);
    expect(certs.length).toBeGreaterThan(0);
    expect(certs.every((c) => /^(G|PG|12A?|15A?|16|18)$/.test(c!))).toBe(true);
  });

  it("reads the year tag as a number", () => {
    expect(screenings.every((s) => s.year === undefined || typeof s.year === "number")).toBe(true);
    expect(screenings.find((s) => s.filmTitle === "The Odyssey")?.year).toBe(2026);
  });

  it("reads per-session format icons from svg[data-icon] into screeningTags", () => {
    const odyssey = screenings.find((s) => s.filmTitle === "The Odyssey" && s.time === "15:00");
    expect(odyssey?.screeningTags).toEqual(["70mm"]);
  });

  it("leaves screeningTags undefined for a session with no notable icons", () => {
    const tony = screenings.find((s) => s.filmTitle === "Tony");
    expect(tony?.screeningTags).toBeUndefined();
  });

  it("returns nothing for a day with no screenings", () => {
    expect(parseWhatsonDay(fixture("ifi-whatson-empty.html"), "2026-12-25")).toEqual([]);
  });
});
