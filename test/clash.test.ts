import { describe, it, expect } from "vitest";
import {
  withEndTimes,
  fittingAdditions,
  planAdditions,
  bestAdditionPerSlot,
  itineraryTransitions,
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

  it("encodes the date into startMins so a later day sorts after an earlier day's late show", () => {
    const [late, nextMorning] = withEndTimes([
      screening({ time: "23:00", durationMins: 120, date: "2026-08-23" }),
      screening({ time: "09:00", durationMins: 90, date: "2026-08-24" }),
    ]);
    expect(nextMorning.startMins).toBeGreaterThan(late.endMins);
  });
});

describe("itineraryTransitions", () => {
  it("flags a same-day overlap", () => {
    const items = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 120 }),
      screening({ filmTitle: "Film B", time: "13:30", durationMins: 90, bookingUrl: "b" }),
    ]);
    const [t] = itineraryTransitions(items);
    expect(t.overlap).toBe(true);
    expect(t.crossDay).toBe(false);
  });

  it("flags a same-day gap that's too tight to make", () => {
    const items = withEndTimes([
      screening({ cinema: "lighthouse", filmTitle: "Film A", time: "12:00", durationMins: 90 }),
      screening({ cinema: "ifi", filmTitle: "Film B", time: "13:35", durationMins: 90, bookingUrl: "b" }),
    ]);
    const [t] = itineraryTransitions(items);
    expect(t.tooTight).toBe(true);
    expect(t.crossDay).toBe(false);
  });

  it("marks a step across a day boundary as crossDay with no clash flags", () => {
    const items = withEndTimes([
      screening({ filmTitle: "Film A", time: "20:00", durationMins: 120, date: "2026-08-23" }),
      screening({ filmTitle: "Film B", time: "11:00", durationMins: 90, date: "2026-08-24", bookingUrl: "b" }),
    ]);
    const [t] = itineraryTransitions(items);
    expect(t.crossDay).toBe(true);
    expect(t.overlap).toBe(false);
    expect(t.tooTight).toBe(false);
  });
});

describe("planAdditions", () => {
  it("records both gaps and the item it would follow, for a candidate between two items", () => {
    const itinerary = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 }),
      screening({ filmTitle: "Film C", time: "16:30", durationMins: 90, bookingUrl: "c" }),
    ]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Film B", time: "14:30", durationMins: 90, bookingUrl: "b" }),
    ]);
    const [addition] = planAdditions(itinerary, [candidate]);
    expect(addition.afterKey).toBe(itinerary[0].bookingUrl);
    expect(addition.gapBefore).toBe(60); // Film A ends 13:30, candidate starts 14:30
    expect(addition.gapAfter).toBe(30); // candidate ends 16:00, Film C starts 16:30
  });

  it("leaves gapBefore and afterKey null for a candidate before the day's first film", () => {
    const [item] = withEndTimes([screening({ filmTitle: "Film A", time: "17:00", durationMins: 120 })]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Film B", time: "15:00", durationMins: 60, bookingUrl: "b" }),
    ]);
    const [addition] = planAdditions([item], [candidate]);
    expect(addition.afterKey).toBeNull();
    expect(addition.gapBefore).toBeNull();
    expect(addition.gapAfter).toBe(item.startMins - candidate.endMins);
  });

  it("leaves gapAfter null for a candidate after the day's last film", () => {
    const [item] = withEndTimes([screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 })]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Film B", time: "14:00", durationMins: 120, bookingUrl: "b" }),
    ]);
    const [addition] = planAdditions([item], [candidate]);
    expect(addition.afterKey).toBe(item.bookingUrl);
    expect(addition.gapAfter).toBeNull();
    expect(addition.gapBefore).toBe(candidate.startMins - item.endMins);
  });

  it("excludes a cross-cinema candidate with a gap below WALK_BUFFER_MINUTES", () => {
    const [item] = withEndTimes([
      screening({ cinema: "lighthouse", filmTitle: "Film A", time: "17:00", durationMins: 120 }),
    ]);
    const [candidate] = withEndTimes([
      screening({ cinema: "ifi", filmTitle: "Film B", time: "19:10", durationMins: 100, bookingUrl: "b" }),
    ]);
    expect(WALK_BUFFER_MINUTES).toBeGreaterThan(SAME_CINEMA_BUFFER_MINUTES);
    expect(planAdditions([item], [candidate])).toHaveLength(0);
    // The same 10-minute turnaround is fine when you're only moving between screens.
    const [sameCinema] = withEndTimes([
      screening({ cinema: "lighthouse", filmTitle: "Film B", time: "19:10", durationMins: 100, bookingUrl: "b" }),
    ]);
    expect(planAdditions([item], [sameCinema])).toHaveLength(1);
  });

  it("excludes a candidate whose wait is beyond MAX_COMBO_GAP_MINUTES", () => {
    const itemStart = 600; // 10:00
    const itemDuration = 90;
    const candidateStart = itemStart + itemDuration + MAX_COMBO_GAP_MINUTES + 5;
    const [item] = withEndTimes([
      screening({ filmTitle: "Film A", time: minutesToTime(itemStart), durationMins: itemDuration }),
    ]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Film B", time: minutesToTime(candidateStart), durationMins: 100, bookingUrl: "b" }),
    ]);
    expect(planAdditions([item], [candidate])).toHaveLength(0);
  });
});

describe("bestAdditionPerSlot", () => {
  const [item] = withEndTimes([screening({ filmTitle: "Film A", time: "12:00", durationMins: 90 })]);

  it("keeps only the tightest fit when several candidates want the same slot", () => {
    const candidates = withEndTimes([
      screening({ filmTitle: "Film B", time: "14:30", durationMins: 90, bookingUrl: "b" }),
      screening({ filmTitle: "Film C", time: "13:45", durationMins: 90, bookingUrl: "c" }),
    ]);
    const best = bestAdditionPerSlot(planAdditions([item], candidates), [item]);
    expect(best).toHaveLength(1);
    expect(best[0].screening.bookingUrl).toBe("c");
  });

  it("offers one candidate for each open slot", () => {
    const candidates = withEndTimes([
      screening({ filmTitle: "Film B", time: "14:00", durationMins: 90, bookingUrl: "b" }),
      screening({ filmTitle: "Film C", time: "10:00", durationMins: 60, bookingUrl: "c" }),
    ]);
    const best = bestAdditionPerSlot(planAdditions([item], candidates), [item]);
    expect(best.map((a) => a.afterKey).sort()).toEqual([item.bookingUrl, null].sort());
  });

  it("treats the same slot position on two different days as two slots", () => {
    const itinerary = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90, date: "2026-08-23" }),
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90, date: "2026-08-24", bookingUrl: "a2" }),
    ]);
    const candidates = withEndTimes([
      screening({ filmTitle: "Film B", time: "14:00", durationMins: 90, date: "2026-08-23", bookingUrl: "b" }),
      screening({ filmTitle: "Film B", time: "14:00", durationMins: 90, date: "2026-08-24", bookingUrl: "b2" }),
    ]);
    const best = bestAdditionPerSlot(planAdditions(itinerary, candidates), itinerary);
    expect(best.map((a) => a.screening.bookingUrl).sort()).toEqual(["b", "b2"]);
  });

  it("never suggests a film that is already in the plan on another day", () => {
    const itinerary = withEndTimes([
      screening({ filmTitle: "Film A", time: "12:00", durationMins: 90, date: "2026-08-23" }),
      screening({ filmTitle: "Repeat Film", time: "12:00", durationMins: 90, date: "2026-08-24", bookingUrl: "r" }),
    ]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Repeat Film", time: "14:00", durationMins: 90, date: "2026-08-23", bookingUrl: "b" }),
    ]);
    // It still *fits* — the pills for it stay pickable and un-faded (see fittingAdditions below).
    expect(planAdditions(itinerary, [candidate])).toHaveLength(1);
    // But volunteering a film you've already committed to isn't a suggestion.
    expect(bestAdditionPerSlot(planAdditions(itinerary, [candidate]), itinerary)).toHaveLength(0);
  });

  it("breaks a tie on the earlier start so the suggestion doesn't shuffle between renders", () => {
    // Both start 30min after Film A ends, at the same cinema — identical fit.
    const candidates = withEndTimes([
      screening({ filmTitle: "Film C", time: "14:00", durationMins: 90, bookingUrl: "c" }),
      screening({ filmTitle: "Film B", time: "14:00", durationMins: 60, bookingUrl: "b" }),
    ]);
    const best = bestAdditionPerSlot(planAdditions([item], candidates), [item]);
    expect(best).toHaveLength(1);
    expect(best[0].screening.bookingUrl).toBe("b");
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

  it("does not hint a candidate on a day the plan has nothing on", () => {
    const [item] = withEndTimes([
      screening({ filmTitle: "Film A", time: "17:00", durationMins: 120, date: "2026-08-23" }),
    ]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Film B", time: "19:30", durationMins: 100, date: "2026-08-24", bookingUrl: "b" }),
    ]);
    expect(fittingAdditions([item], [candidate]).has("b")).toBe(false);
  });

  it("allows the same film on a different day than the one already in the plan", () => {
    const itinerary = withEndTimes([
      screening({ filmTitle: "Repeat Film", time: "12:00", durationMins: 90, date: "2026-08-23" }),
      screening({ filmTitle: "Film C", time: "12:00", durationMins: 90, date: "2026-08-24", bookingUrl: "c" }),
    ]);
    const [candidate] = withEndTimes([
      screening({ filmTitle: "Repeat Film", time: "14:30", durationMins: 90, date: "2026-08-24", bookingUrl: "b" }),
    ]);
    const result = fittingAdditions(itinerary, [candidate]);
    expect(result.has("b")).toBe(true);
  });
});
