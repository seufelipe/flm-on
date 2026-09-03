import { describe, it, expect } from "vitest";
import { selectUpcomingFilms } from "@/lib/upcoming";
import type { Screening } from "@/lib/scrapers/types";

let n = 0;
function sc(over: Partial<Screening> = {}): Screening {
  n += 1;
  return {
    cinema: "ifi",
    cinemaName: "IFI",
    filmTitle: "A Film",
    date: "2026-09-04",
    time: "18:00",
    bookingUrl: `b-${n}`,
    ...over,
  };
}

describe("selectUpcomingFilms", () => {
  it("keeps a film that isn't playing this week (reason: new)", () => {
    const films = selectUpcomingFilms([sc({ filmTitle: "Held Over" })], [sc({ filmTitle: "Brand New" })], {});
    expect(films.map((f) => f.title)).toEqual(["Brand New"]);
    expect(films[0].reason).toBe("new");
  });

  it("drops an ordinary film that is already playing this week", () => {
    const films = selectUpcomingFilms([sc({ filmTitle: "Dune" })], [sc({ filmTitle: "Dune" })], {});
    expect(films).toEqual([]);
  });

  it("drops a held-over film even when next week has a special screening of it", () => {
    const films = selectUpcomingFilms(
      [sc({ filmTitle: "Alien" })],
      [sc({ filmTitle: "Alien", screeningTags: ["70mm"] })],
      {},
    );
    expect(films).toEqual([]);
  });

  it("drops a held-over film even when it has a curated label", () => {
    const films = selectUpcomingFilms(
      [sc({ filmTitle: "Trainspotting" })],
      [sc({ filmTitle: "Trainspotting" })],
      { trainspotting: "classic!" },
    );
    expect(films).toEqual([]);
  });

  it("drops a new short film but keeps a short special", () => {
    const films = selectUpcomingFilms(
      [],
      [
        sc({ filmTitle: "Archive Short", durationMins: 28 }),
        sc({ filmTitle: "Relaxed Short", durationMins: 28, screeningTags: ["Parent and Baby"] }),
      ],
      {},
    );
    expect(films.map((f) => f.title)).toEqual(["Relaxed Short"]);
  });

  it("collapses one film across cinemas into a single entry", () => {
    const films = selectUpcomingFilms(
      [],
      [
        sc({ filmTitle: "Wide Release", cinema: "ifi", cinemaName: "IFI", filmPageUrl: "https://ifi/x" }),
        sc({ filmTitle: "Wide Release", cinema: "cineworld", cinemaName: "Cineworld", filmPageUrl: "https://cw/x" }),
      ],
      {},
    );
    expect(films).toHaveLength(1);
    expect(films[0].cinemas).toEqual(["ifi", "cineworld"]);
    expect(films[0].cinemaLinks.map((l) => l.cinema)).toEqual(["ifi", "cineworld"]);
    expect(films[0].cinemaLinks.map((l) => l.label)).toEqual(["IFI", "Cineworld"]);
  });

  it("sorts specials before new films, then by first date", () => {
    const films = selectUpcomingFilms(
      [],
      [
        sc({ filmTitle: "New Later", date: "2026-09-12" }),
        sc({ filmTitle: "New Earlier", date: "2026-09-11" }),
        sc({ filmTitle: "Special", date: "2026-09-13", screeningTags: ["IMAX"] }),
      ],
      {},
    );
    expect(films.map((f) => f.title)).toEqual(["Special", "New Earlier", "New Later"]);
  });
});
