import { describe, it, expect } from "vitest";
import { groupByFilm, groupScreeningsByDay } from "@/lib/groupings";
import type { TimedScreening } from "@/lib/clash";

function screening(
  date: string,
  time: string,
  cinema: "lighthouse" | "ifi" | "cineworld",
  extra: Partial<TimedScreening> = {},
): TimedScreening {
  return {
    cinema,
    cinemaName: cinema,
    filmTitle: "Tony",
    date,
    time,
    bookingUrl: `${cinema}-${date}-${time}`,
    startMins: 0,
    endMins: 120,
    ...extra,
  };
}

describe("groupScreeningsByDay", () => {
  it("buckets screenings across multiple days, preserving chronological order", () => {
    const screenings = [
      screening("2026-08-24", "14:30", "lighthouse"),
      screening("2026-08-24", "18:20", "ifi"),
      screening("2026-08-25", "14:30", "lighthouse"),
      screening("2026-08-27", "19:00", "ifi"),
    ];

    const groups = groupScreeningsByDay(screenings);

    expect(groups.map((g) => g.date)).toEqual(["2026-08-24", "2026-08-25", "2026-08-27"]);
    expect(groups[0]!.screenings).toHaveLength(2);
    expect(groups[1]!.screenings).toHaveLength(1);
    expect(groups[2]!.screenings).toHaveLength(1);
  });

  it("produces a single bucket for single-day input", () => {
    const screenings = [
      screening("2026-08-24", "14:30", "lighthouse"),
      screening("2026-08-24", "18:20", "ifi"),
    ];

    const groups = groupScreeningsByDay(screenings);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe("2026-08-24");
    expect(groups[0]!.screenings).toHaveLength(2);
  });
});

describe("groupByFilm", () => {
  it("picks up an original title from whichever screening carries it", () => {
    const [group] = groupByFilm([
      screening("2026-08-24", "18:20", "ifi", { filmTitle: "De Gaulle" }),
      screening("2026-08-24", "20:10", "cineworld", {
        filmTitle: "De Gaulle",
        originalTitle: "La Bataille de Gaulle",
      }),
    ]);
    expect(group.originalTitle).toBe("La Bataille de Gaulle");
    expect(group.screenings).toHaveLength(2);
  });
});
