import { describe, it, expect } from "vitest";
import { startingPoints } from "@/lib/startingPoints";
import { withEndTimes } from "@/lib/clash";
import type { Screening } from "@/lib/scrapers/types";

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

describe("startingPoints", () => {
  it("offers one screening per timeframe, in Early / Mid / Late order", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Late Film", time: "20:00", bookingUrl: "l" }),
        screening({ filmTitle: "Early Film", time: "10:00", bookingUrl: "e" }),
        screening({ filmTitle: "Mid Film", time: "14:00", bookingUrl: "m" }),
      ]),
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["e", "m", "l"]);
  });

  it("skips a timeframe with nothing in it rather than padding from another", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Early Film", time: "10:00", bookingUrl: "e" }),
        screening({ filmTitle: "Another Early Film", time: "11:00", bookingUrl: "e2" }),
      ]),
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["e"]);
  });

  it("prefers a special over an ordinary showing, even a later one", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Ordinary", time: "10:00", bookingUrl: "plain" }),
        screening({
          filmTitle: "On Film",
          time: "11:30",
          bookingUrl: "special",
          screeningTags: ["Parent and Baby"],
        }),
      ]),
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["special"]);
  });

  it("counts a curated editorial label as a special", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Ordinary", time: "10:00", bookingUrl: "plain" }),
        screening({ filmTitle: "Labelled", time: "11:30", bookingUrl: "labelled" }),
      ]),
      { labelled: "classic!" },
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["labelled"]);
  });

  it("falls back to the earliest start when nothing is special", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Later", time: "11:00", bookingUrl: "later" }),
        screening({ filmTitle: "Earlier", time: "10:00", bookingUrl: "earlier" }),
      ]),
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["earlier"]);
  });

  it("never offers the same film in two timeframes", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "All Day Film", time: "10:00", bookingUrl: "a1" }),
        screening({ filmTitle: "All Day Film", time: "14:00", bookingUrl: "a2" }),
        screening({ filmTitle: "Other Film", time: "14:30", bookingUrl: "b" }),
      ]),
    );
    expect(picks.map((p) => p.bookingUrl)).toEqual(["a1", "b"]);
  });

  it("can draw each pick from a different day when given the whole week", () => {
    const picks = startingPoints(
      withEndTimes([
        screening({ filmTitle: "Monday Film", time: "10:00", date: "2026-08-24", bookingUrl: "mon" }),
        screening({ filmTitle: "Wednesday Film", time: "14:00", date: "2026-08-26", bookingUrl: "wed" }),
      ]),
    );
    expect(picks.map((p) => p.date)).toEqual(["2026-08-24", "2026-08-26"]);
  });

  it("spreads across days when asked, rather than collapsing onto the week's first day", () => {
    const pool = withEndTimes([
      screening({ filmTitle: "Monday Early", time: "10:00", date: "2026-08-24", bookingUrl: "mon-e" }),
      screening({ filmTitle: "Monday Mid", time: "14:00", date: "2026-08-24", bookingUrl: "mon-m" }),
      screening({ filmTitle: "Tuesday Mid", time: "14:30", date: "2026-08-25", bookingUrl: "tue-m" }),
    ]);
    // Without the flag, the earliest start wins the Mid slot and both picks are Monday.
    expect(startingPoints(pool).map((p) => p.bookingUrl)).toEqual(["mon-e", "mon-m"]);
    expect(startingPoints(pool, undefined, true).map((p) => p.bookingUrl)).toEqual(["mon-e", "tue-m"]);
  });

  it("still puts a special ahead of an unused day", () => {
    const pool = withEndTimes([
      screening({ filmTitle: "Monday Early", time: "10:00", date: "2026-08-24", bookingUrl: "mon-e" }),
      screening({
        filmTitle: "Monday Mid Special",
        time: "14:00",
        date: "2026-08-24",
        bookingUrl: "mon-m",
        screeningTags: ["Parent and Baby"],
      }),
      screening({ filmTitle: "Tuesday Mid", time: "14:30", date: "2026-08-25", bookingUrl: "tue-m" }),
    ]);
    expect(startingPoints(pool, undefined, true).map((p) => p.bookingUrl)).toEqual(["mon-e", "mon-m"]);
  });

  it("returns nothing when there are no candidates", () => {
    expect(startingPoints([])).toEqual([]);
  });
});
