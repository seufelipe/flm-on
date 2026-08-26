import { describe, it, expect } from "vitest";
import {
  findCombos,
  withEndTimes,
  fittingAdditions,
  WALK_BUFFER_MINUTES,
  SAME_CINEMA_BUFFER_MINUTES,
  MAX_COMBO_GAP_MINUTES,
} from "@/lib/clash";
import type { Screening } from "@/lib/scrapers/types";

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function screening(overrides: Partial<Screening>): Screening {
  return {
    cinema: "lighthouse",
    cinemaName: "Light House Cinema",
    filmTitle: "Film A",
    date: "2026-08-23",
    time: "12:00",
    bookingUrl: "https://example.com/book/a",
    ...overrides,
  };
}

describe("withEndTimes", () => {
  it("defaults duration and flags it as estimated when missing", () => {
    const [timed] = withEndTimes([screening({ durationMins: undefined })]);
    expect(timed.durationEstimated).toBe(true);
    expect(timed.endMins).toBeGreaterThan(timed.startMins);
  });

  it("does not flag duration as estimated when provided", () => {
    const [timed] = withEndTimes([screening({ durationMins: 90 })]);
    expect(timed.durationEstimated).toBe(false);
    expect(timed.endMins - timed.startMins).toBe(90);
  });
});

describe("findCombos", () => {
  it("includes a cross-cinema pair with a gap inside the valid window", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120 });
    const b = screening({ cinema: "ifi", filmTitle: "Film B", time: "19:30", durationMins: 100 });
    const combos = findCombos([a, b]);
    expect(combos).toHaveLength(1);
    expect(combos[0].gapMins).toBe(30);
  });

  it("excludes a cross-cinema pair with a gap below WALK_BUFFER_MINUTES", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120 });
    const b = screening({ cinema: "ifi", filmTitle: "Film B", time: "19:10", durationMins: 100 });
    expect(WALK_BUFFER_MINUTES).toBeGreaterThan(0);
    expect(findCombos([a, b])).toHaveLength(0);
  });

  it("excludes a cross-cinema pair with a gap beyond MAX_COMBO_GAP_MINUTES", () => {
    const aStart = 600; // 10:00
    const aDuration = 90;
    const aEnd = aStart + aDuration;
    const bStart = aEnd + MAX_COMBO_GAP_MINUTES + 5; // just past the allowed window
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: minutesToTime(aStart), durationMins: aDuration });
    const b = screening({ cinema: "ifi", filmTitle: "Film B", time: minutesToTime(bStart), durationMins: 100 });
    expect(findCombos([a, b])).toHaveLength(0);
  });

  it("includes a same-cinema pair with a gap inside its shorter valid window", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120 });
    const b = screening({ cinema: "lighthouse", filmTitle: "Film B", time: "19:30", durationMins: 100 });
    const combos = findCombos([a, b]);
    expect(combos).toHaveLength(1);
    expect(combos[0].gapMins).toBe(30);
  });

  it("excludes a same-cinema pair with a gap below SAME_CINEMA_BUFFER_MINUTES", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120 });
    const b = screening({ cinema: "lighthouse", filmTitle: "Film B", time: "19:05", durationMins: 100 });
    expect(SAME_CINEMA_BUFFER_MINUTES).toBeGreaterThan(0);
    expect(findCombos([a, b])).toHaveLength(0);
  });

  it("excludes the same film showing at two different cinemas", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Same Film", time: "17:00", durationMins: 120 });
    const b = screening({ cinema: "ifi", filmTitle: "Same Film", time: "19:30", durationMins: 100 });
    expect(findCombos([a, b])).toHaveLength(0);
  });

  it("excludes a pair on different dates even if the time-of-day gap would be valid", () => {
    const a = screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120, date: "2026-08-23" });
    const b = screening({ cinema: "ifi", filmTitle: "Film B", time: "19:30", durationMins: 100, date: "2026-08-24" });
    expect(findCombos([a, b])).toHaveLength(0);
  });
});

describe("fittingAdditions", () => {
  it("suggests a candidate that fits before the only itinerary item", () => {
    const [item] = withEndTimes([screening({ filmTitle: "Film A", time: "17:00", durationMins: 120 })]);
    const [candidate] = withEndTimes([screening({ filmTitle: "Film B", time: "15:00", durationMins: 60, bookingUrl: "b" })]);
    const result = fittingAdditions([item], [candidate]);
    expect(result.get("b")).toBe(item.startMins - candidate.endMins);
  });

  it("suggests a candidate that fits after the only itinerary item", () => {
    const [item] = withEndTimes([screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 })]);
    const [candidate] = withEndTimes([screening({ filmTitle: "Film B", time: "14:00", durationMins: 120, bookingUrl: "b" })]);
    const result = fittingAdditions([item], [candidate]);
    expect(result.get("b")).toBe(candidate.startMins - item.endMins);
  });

  it("suggests a candidate that fits between two itinerary items", () => {
    const itinerary = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 }),
      screening({ filmTitle: "Film C", time: "16:30", durationMins: 90, bookingUrl: "c" }),
    ]);
    const [candidate] = withEndTimes([screening({ filmTitle: "Film B", time: "14:30", durationMins: 90, bookingUrl: "b" })]);
    const result = fittingAdditions(itinerary, [candidate]);
    expect(result.has("b")).toBe(true);
  });

  it("does NOT suggest a candidate that fits its first neighbor but overlaps its second", () => {
    // Film A ends 13:30. Candidate B (13:50-15:20) fits fine after A. But Film C starts 15:00,
    // so B would overlap C — the core regression: a naive pairwise check (does B pair with A? does
    // B pair with C?) would wrongly hint B because it pairs fine with A alone.
    const itinerary = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 }),
      screening({ filmTitle: "Film C", time: "15:00", durationMins: 90, bookingUrl: "c" }),
    ]);
    const [candidate] = withEndTimes([screening({ filmTitle: "Film B", time: "13:50", durationMins: 90, bookingUrl: "b" })]);
    const result = fittingAdditions(itinerary, [candidate]);
    expect(result.has("b")).toBe(false);
  });

  it("excludes a candidate showing the same film as something already in the itinerary", () => {
    const [item] = withEndTimes([screening({ filmTitle: "Same Film", time: "12:00", durationMins: 90 })]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Same Film", time: "17:00", durationMins: 90, bookingUrl: "b" }),
    ]);
    const result = fittingAdditions([item], [candidate]);
    expect(result.has("b")).toBe(false);
  });
});
