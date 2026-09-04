import { describe, it, expect } from "vitest";
import { diffFilms } from "@/lib/filmDiff";
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

describe("diffFilms", () => {
  it("splits a week into added / gone / held over", () => {
    const diff = diffFilms(
      [sc({ filmTitle: "Held Over" }), sc({ filmTitle: "Finished Run" })],
      [sc({ filmTitle: "Held Over" }), sc({ filmTitle: "Brand New" })],
    );
    expect(diff.added.map((f) => f.title)).toEqual(["Brand New"]);
    expect(diff.gone.map((f) => f.title)).toEqual(["Finished Run"]);
    expect(diff.heldOver).toEqual(["Held Over"]);
  });

  it("matches a held-over film across a casing difference between cinemas", () => {
    // IFI titles are often ALL CAPS while Light House's aren't — the same film must not read as
    // one gone and one added.
    const diff = diffFilms(
      [sc({ cinema: "lighthouse", cinemaName: "Light House", filmTitle: "Vertigo" })],
      [sc({ cinema: "ifi", filmTitle: "  VERTIGO " })],
    );
    expect(diff.added).toEqual([]);
    expect(diff.gone).toEqual([]);
    expect(diff.heldOver).toEqual(["  VERTIGO "]);
  });

  it("flags an added film that was in the previous week's preview", () => {
    const diff = diffFilms(
      [],
      [sc({ filmTitle: "Sinners" }), sc({ filmTitle: "Unheralded" })],
      [{ title: "SINNERS" }],
    );
    expect(diff.added.map((f) => [f.title, f.previewed])).toEqual([
      ["Sinners", true],
      ["Unheralded", false],
    ]);
  });

  it("reports a previewed film that never turned up", () => {
    const diff = diffFilms([], [sc({ filmTitle: "Arrived" })], [
      { title: "Arrived" },
      { title: "No Show" },
    ]);
    expect(diff.previewedButAbsent).toEqual(["No Show"]);
  });

  it("treats an empty previous week as everything added, with nothing gone", () => {
    const diff = diffFilms([], [sc({ filmTitle: "One" }), sc({ filmTitle: "Two" })]);
    expect(diff.added.map((f) => f.title)).toEqual(["One", "Two"]);
    expect(diff.gone).toEqual([]);
    expect(diff.heldOver).toEqual([]);
    expect(diff.previewedButAbsent).toEqual([]);
  });

  it("collects every cinema and the year for an added film", () => {
    const diff = diffFilms(
      [],
      [
        sc({ filmTitle: "Amores perros", cinema: "ifi", year: 2000 }),
        sc({ filmTitle: "Amores perros", cinema: "cineworld", cinemaName: "Cineworld" }),
        sc({ filmTitle: "Amores perros", cinema: "ifi" }),
      ],
    );
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].cinemas).toEqual(["ifi", "cineworld"]);
    expect(diff.added[0].year).toBe(2000);
  });
});
