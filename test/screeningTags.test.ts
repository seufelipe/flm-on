import { describe, it, expect } from "vitest";
import { displayScreeningTags } from "@/lib/screeningTags";

describe("displayScreeningTags", () => {
  it("maps a known descriptor to a symbol + session name", () => {
    const out = displayScreeningTags(["Parent and Baby"]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("parent & baby");
    expect(out[0].symbol).toContain("☻");
  });

  it("is case-insensitive and trims", () => {
    expect(displayScreeningTags(["  PARENT AND BABY "])[0].label).toBe("parent & baby");
  });

  it("drops descriptors that aren't surfaced", () => {
    expect(displayScreeningTags(["Dubbed", "Subtitled", "Open Captioned"])).toEqual([]);
    expect(displayScreeningTags(["Dubbed", "Parent and Baby"]).map((t) => t.label)).toEqual([
      "parent & baby",
    ]);
  });

  it("leaves film-format tags alone — those are handled by lib/formats.ts, not here", () => {
    expect(displayScreeningTags(["35mm", "70mm"])).toEqual([]);
  });

  it("surfaces the Mystery Matinee strand (attached by ScreeningBrowser, not the scraper)", () => {
    const [m] = displayScreeningTags(["Mystery Matinee"]);
    expect(m.label).toBe("mystery matinee");
    expect(m.symbol).toContain("☻");
  });

  it("flags Mystery Matinee and Big Screen Classics as mark:false — surfaced specials with no glyph", () => {
    expect(displayScreeningTags(["Mystery Matinee"])[0].mark).toBe(false);
    expect(displayScreeningTags(["Big Screen Classics"])[0].mark).toBe(false);
    // Everything else defaults to a visible mark.
    expect(displayScreeningTags(["Parent and Baby"])[0].mark).not.toBe(false);
    expect(displayScreeningTags(["Cinema Book Club"])[0].mark).not.toBe(false);
  });

  it("surfaces the curated-strand screenings (book club, silver screen)", () => {
    const [bookClub] = displayScreeningTags(["Cinema Book Club"]);
    expect(bookClub.label).toBe("cinema book club");
    expect(bookClub.symbol).toContain("☻");
    expect(displayScreeningTags(["Silver Screen"])[0].label).toBe("silver screen");
  });

  it("surfaces the Cineworld event strands (Movies for Juniors marked, Big Screen Classics not)", () => {
    expect(displayScreeningTags(["Movies For Juniors"])[0].label).toBe("movies for juniors");
    expect(displayScreeningTags(["Movies For Juniors"])[0].mark).not.toBe(false);
    expect(displayScreeningTags(["Big Screen Classics"])[0].label).toBe("big screen classics");
  });

  it("carries a title + description for the tooltip", () => {
    const [pb] = displayScreeningTags(["Parent and Baby"]);
    expect(pb.title).toBe("Parent & Baby");
    expect(pb.description.length).toBeGreaterThan(10);
  });

  it("dedupes the relaxed / autism-friendly aliases to one entry", () => {
    const out = displayScreeningTags(["Relaxed", "Autism Friendly"]);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("relaxed");
  });

  it("tolerates undefined / empty", () => {
    expect(displayScreeningTags()).toEqual([]);
    expect(displayScreeningTags([])).toEqual([]);
  });
});
