import { describe, it, expect } from "vitest";
import { filmContexts } from "@/lib/filmContext";

describe("filmContexts", () => {
  it("is the text alone when every session carries it", () => {
    expect(
      filmContexts([
        { cinema: "ifi", date: "2026-10-03", context: "Black History Month" },
        { cinema: "ifi", date: "2026-10-05", context: "Black History Month" },
      ]),
    ).toEqual([{ text: "Black History Month" }]);
  });

  it("says where and when when only some sessions carry it", () => {
    expect(
      filmContexts([
        { cinema: "lighthouse", date: "2026-10-08" },
        { cinema: "ifi", date: "2026-10-08", context: "International Lesbian Day" },
        { cinema: "lighthouse", date: "2026-10-10" },
      ]),
    ).toEqual([{ text: "International Lesbian Day", where: "IFI, Thu 8 Oct" }]);
  });

  it("drops the where and when past three places rather than list them", () => {
    const sessions = ["01", "02", "03", "04"].map((d) => ({
      cinema: "ifi" as const,
      date: `2026-10-${d}`,
      context: "Black History Month",
    }));
    expect(filmContexts([...sessions, { cinema: "lighthouse", date: "2026-10-05" }])).toEqual([
      { text: "Black History Month" },
    ]);
  });

  it("is empty when nothing carries a context", () => {
    expect(filmContexts([{ cinema: "ifi", date: "2026-10-01" }])).toEqual([]);
  });
});
