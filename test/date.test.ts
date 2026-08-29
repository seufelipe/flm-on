import { describe, it, expect } from "vitest";
import { daysUntilThursday, upcomingDays, nextBatchLabel, formatDayDate } from "@/lib/date";

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

describe("formatDayDate", () => {
  it("is a stable '<day> <Mon>' with no ICU month-abbreviation drift", () => {
    expect(formatDayDate("2026-08-29")).toBe("29 Aug");
    expect(formatDayDate("2026-09-01")).toBe("1 Sep");
    expect(formatDayDate("2026-01-05")).toBe("5 Jan");
  });
});

describe("nextBatchLabel", () => {
  it("says Tomorrow only when Thursday is literally the next day", () => {
    expect(nextBatchLabel("2026-08-26")).toBe("Tomorrow"); // Wednesday
  });

  it("says Thursday for every other day, including Thursday itself", () => {
    expect(nextBatchLabel("2026-08-27")).toBe("Thursday"); // Thursday — next batch is a week out
    expect(nextBatchLabel("2026-08-24")).toBe("Thursday"); // Monday
    expect(nextBatchLabel("2026-08-25")).toBe("Thursday"); // Tuesday
    expect(nextBatchLabel("2026-08-28")).toBe("Thursday"); // Friday
  });
});
