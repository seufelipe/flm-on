import { describe, it, expect } from "vitest";
import {
  cinemaWeekendDaysInView,
  cinemaWeekendLabel,
  isCinemaWeekendDay,
} from "@/lib/cinemaWeekend";

const SAT = "2026-09-05";
const SUN = "2026-09-06";
const WEEK = ["2026-09-04", SAT, SUN, "2026-09-07"];

describe("isCinemaWeekendDay", () => {
  it("is the two campaign days and nothing else", () => {
    expect(isCinemaWeekendDay(SAT)).toBe(true);
    expect(isCinemaWeekendDay(SUN)).toBe(true);
    expect(isCinemaWeekendDay("2026-09-04")).toBe(false);
    expect(isCinemaWeekendDay("2027-09-05")).toBe(false);
  });
});

describe("cinemaWeekendDaysInView", () => {
  it('covers both days on "This week"', () => {
    expect(cinemaWeekendDaysInView(null, WEEK)).toEqual([SAT, SUN]);
  });

  it("narrows to the pinned day", () => {
    expect(cinemaWeekendDaysInView(SAT, WEEK)).toEqual([SAT]);
    expect(cinemaWeekendDaysInView(SUN, WEEK)).toEqual([SUN]);
  });

  it("is empty on a day outside the weekend", () => {
    expect(cinemaWeekendDaysInView("2026-09-07", WEEK)).toEqual([]);
  });

  // visibleDays has already dropped days that have passed (or that the preferences emptied), so
  // the banner narrows on Sunday rather than still promising Saturday — and self-expires after.
  it("follows visibleDays as the weekend passes", () => {
    expect(cinemaWeekendDaysInView(null, [SUN, "2026-09-07"])).toEqual([SUN]);
    expect(cinemaWeekendDaysInView(null, ["2026-09-07", "2026-09-08"])).toEqual([]);
  });
});

describe("cinemaWeekendLabel", () => {
  it("names the days the banner is actually claiming", () => {
    expect(cinemaWeekendLabel([SAT, SUN])).toBe("Saturday 5 and Sunday 6");
    expect(cinemaWeekendLabel([SUN])).toBe("Sunday 6");
    expect(cinemaWeekendLabel([])).toBe("");
  });
});
