import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { parseWhatsonPage, parseEventPage, resolveDateLabel } from "@/lib/scrapers/ifi";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf-8");

describe("ifi parseWhatsonPage", () => {
  const listings = parseWhatsonPage(fixture("ifi-whatson.html"));

  it("parses today's active films with title and event URL", () => {
    expect(listings.length).toBeGreaterThan(0);
    const sons = listings.find((l) => l.eventUrl === "https://shop.ifi.ie/event/141596/");
    expect(sons).toBeDefined();
  });

  it("dedupes films that appear more than once in the listing", () => {
    const urls = listings.map((l) => l.eventUrl);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("ifi resolveDateLabel", () => {
  it("resolves a weekday + day/month label to the nearest date on or after the reference", () => {
    expect(resolveDateLabel("Sunday 23 Aug", "2026-08-23")).toBe("2026-08-23");
    expect(resolveDateLabel("Wednesday 26 Aug", "2026-08-23")).toBe("2026-08-26");
  });

  it("returns undefined for an unparseable label", () => {
    expect(resolveDateLabel("nonsense", "2026-08-23")).toBeUndefined();
  });
});

describe("ifi parseEventPage", () => {
  const schedule = parseEventPage(fixture("ifi-event.html"), "2026-08-23");

  it("extracts the run time", () => {
    expect(schedule.durationMins).toBe(119);
  });

  it("extracts sessions across multiple forward days with resolved ISO dates and booking URLs", () => {
    expect(schedule.sessions.length).toBeGreaterThanOrEqual(9);
    const uniqueDates = new Set(schedule.sessions.map((s) => s.date));
    expect(uniqueDates.size).toBeGreaterThanOrEqual(5);

    const first = schedule.sessions.find((s) => s.date === "2026-08-23");
    expect(first?.time).toBe("20:20");
    expect(first?.bookingUrl).toBe("https://shop.ifi.ie/performance/113207");
  });
});
