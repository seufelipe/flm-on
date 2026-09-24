import { describe, it, expect } from "vitest";
import {
  groupByFilm,
  groupScreeningsByDay,
  partitionFilmSections,
  type FilmGroup,
  type FilmSection,
} from "@/lib/groupings";
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

describe("partitionFilmSections", () => {
  const group = (key: string, tags?: string[]): FilmGroup => ({
    key,
    filmTitle: key,
    screenings: tags ? [screening("2026-09-26", "14:00", "ifi", { screeningTags: tags })] : [],
  });
  const groups = [group("a"), group("b"), group("c")];
  const shape = (sections: FilmSection[]) =>
    sections.map((s) => [s.kind === "strand" ? s.strand.label : s.kind, s.films.map((g) => g.key)]);

  it("floats the new films to the top, keeping the incoming order inside each section", () => {
    expect(shape(partitionFilmSections(groups, { newKeys: new Set(["c", "a"]) }))).toEqual([
      ["new", ["a", "c"]],
      ["also", ["b"]],
    ]);
  });

  it("collapses to one list when nothing is new", () => {
    expect(partitionFilmSections(groups, { newKeys: new Set(["nothing-on-this-week"]) })).toEqual([
      { kind: "also", films: groups },
    ]);
  });

  it("collapses to one list when *everything* is new — a heading over the whole list says nothing", () => {
    expect(partitionFilmSections(groups, { newKeys: new Set(["a", "b", "c"]) })).toEqual([
      { kind: "also", films: groups },
    ]);
  });

  it("collapses with no options at all — a pinned day reads in time order, not new-first", () => {
    expect(partitionFilmSections(groups)).toEqual([{ kind: "also", films: groups }]);
    expect(partitionFilmSections(groups, { newKeys: new Set() })).toEqual([{ kind: "also", films: groups }]);
  });

  describe("a section strand (a festival)", () => {
    const fest = ["IFI Documentary Festival"];
    const mixed = [group("a"), group("f1", fest), group("b"), group("f2", ["Subtitled", ...fest])];

    it("leads the list, ahead of New this week, and claims a film that's also new", () => {
      expect(shape(partitionFilmSections(mixed, { newKeys: new Set(["b", "f1"]) }))).toEqual([
        ["IFI Documentary Festival", ["f1", "f2"]],
        ["new", ["b"]],
        ["also", ["a"]],
      ]);
    });

    it("heads the list even with nothing new", () => {
      expect(shape(partitionFilmSections(mixed, { newKeys: new Set() }))).toEqual([
        ["IFI Documentary Festival", ["f1", "f2"]],
        ["also", ["a", "b"]],
      ]);
    });

    it("counts a film when any one of its sessions is in the strand", () => {
      const knife: FilmGroup = {
        key: "knife",
        filmTitle: "Knife",
        screenings: [
          screening("2026-09-26", "18:00", "lighthouse"),
          screening("2026-09-26", "18:00", "ifi", { screeningTags: fest }),
        ],
      };
      expect(shape(partitionFilmSections([group("a"), knife], {}))).toEqual([
        ["IFI Documentary Festival", ["knife"]],
        ["also", ["a"]],
      ]);
    });

    it("ignores a surfaced strand that isn't a section", () => {
      expect(partitionFilmSections([group("a", ["Parent and Baby"]), group("b")], {})).toHaveLength(1);
    });

    it("collapses when the whole list is the festival", () => {
      const all = [group("f1", fest), group("f2", fest)];
      expect(partitionFilmSections(all, {})).toEqual([{ kind: "also", films: all }]);
    });
  });
});
