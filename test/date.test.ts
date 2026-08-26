import { describe, it, expect } from "vitest";
import { daysUntilThursday, upcomingDays } from "@/lib/date";

describe("daysUntilThursday", () => {
  it("returns 0 on Thursday itself", () => {
    expect(daysUntilThursday("2026-08-27")).toBe(0);
  });

  it("counts forward to the next Thursday for every other weekday", () => {
    expect(daysUntilThursday("2026-08-24")).toBe(3); // Monday
    expect(daysUntilThursday("2026-08-25")).toBe(2); // Tuesday
    expect(daysUntilThursday("2026-08-26")).toBe(1); // Wednesday
    expect(daysUntilThursday("2026-08-28")).toBe(6); // Friday
    expect(daysUntilThursday("2026-08-29")).toBe(5); // Saturday
    expect(daysUntilThursday("2026-08-30")).toBe(4); // Sunday
  });
});

describe("upcomingDays", () => {
  it("is the full week ahead when today is Thursday", () => {
    expect(upcomingDays("2026-08-27")).toEqual([
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("runs up to but excluding the following Thursday on Friday", () => {
    expect(upcomingDays("2026-08-28")).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("runs up to but excluding this week's Thursday on Monday", () => {
    expect(upcomingDays("2026-08-24")).toEqual(["2026-08-24", "2026-08-25", "2026-08-26"]);
  });
});
