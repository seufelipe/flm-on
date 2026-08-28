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

  it("surfaces the curated-strand screenings (book club, silver screen)", () => {
    const [bookClub] = displayScreeningTags(["Cinema Book Club"]);
    expect(bookClub.label).toBe("cinema book club");
    expect(bookClub.symbol).toContain("☻");
    expect(displayScreeningTags(["Silver Screen"])[0].label).toBe("silver screen");
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
