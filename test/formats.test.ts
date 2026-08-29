import { describe, it, expect } from "vitest";
import { displayFilmFormats, filmFormatsTooltip } from "@/lib/formats";

describe("displayFilmFormats", () => {
  it("maps the known gauges to a format with a label and a ratio", () => {
    expect(displayFilmFormats(["35mm"])[0].label).toBe("35mm");
    expect(displayFilmFormats(["70mm"])[0].label).toBe("70mm");
    expect(displayFilmFormats(["imax"])[0].label).toBe("IMAX");
  });

  it("orders the box ratio so a bigger format renders taller (smaller ratio)", () => {
    const r = (tag: string) => displayFilmFormats([tag])[0].ratio;
    expect(r("35mm")).toBeGreaterThan(r("70mm"));
    expect(r("70mm")).toBeGreaterThan(r("imax"));
  });

  it("is case-insensitive, trims, and accepts aliases", () => {
    expect(displayFilmFormats(["  70 MM "])[0].id).toBe("70mm");
    expect(displayFilmFormats(["15/70"])[0].id).toBe("imax");
    expect(displayFilmFormats(["IMAX 70mm"])[0].id).toBe("imax");
  });

  it("drops non-format tags and de-dupes by format", () => {
    expect(displayFilmFormats(["Parent and Baby", "Subtitled"])).toEqual([]);
    expect(displayFilmFormats(["70mm", "70 mm"]).map((f) => f.id)).toEqual(["70mm"]);
  });

  it("keeps a format alongside a special-screening tag", () => {
    expect(displayFilmFormats(["Parent and Baby", "35mm"]).map((f) => f.id)).toEqual(["35mm"]);
  });

  it("tolerates undefined / empty", () => {
    expect(displayFilmFormats()).toEqual([]);
    expect(displayFilmFormats([])).toEqual([]);
  });

  it("builds a tooltip from the surfaced formats", () => {
    expect(filmFormatsTooltip(["70mm"])).toContain("70mm film");
    expect(filmFormatsTooltip(["Subtitled"])).toBeUndefined();
  });
});
