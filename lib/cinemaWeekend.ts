// National Cinema Weekend — a one-off, date-boxed campaign note (CLAUDE.md decision #19).
//
// Sat 5 / Sun 6 September 2026: admission starts from €4 (Screen Ireland-backed, ~99% of cinemas
// in the Republic taking part — Light House, IFI Cinemas and Cineworld are all on the published
// list, so it covers every cinema this app carries). The app marks those two days in the day
// picker and puts a banner over the film list.
//
// Deliberately a hard-coded pair of dates with their own written-out labels rather than a general
// "campaign" facility: it's two days, once, and the whole thing self-expires. `visibleDays`
// already drops days that have passed, so once the weekend is behind us nothing here renders and
// the module can be deleted whole — no cleanup edit to any of its callers.

export const CINEMA_WEEKEND_NAME = "National Cinema Weekend";

// The picker mark. Ink, never accent — it has to stay legible on the accent fill a selected day
// segment carries (decision #7).
export const CINEMA_WEEKEND_MARK = "★";

// ISO date → the label the banner prose uses. Written out rather than formatted so no month-name
// CLDR mismatch can hydration-warn (same reason lib/date.ts hand-rolls its short months).
const CINEMA_WEEKEND_DAYS: Record<string, string> = {
  "2026-09-05": "Saturday 5 September",
  "2026-09-06": "Sunday 6 September",
};

export function isCinemaWeekendDay(dateISO: string): boolean {
  return dateISO in CINEMA_WEEKEND_DAYS;
}

// Which campaign days the current view actually covers, in order — the banner's whole visibility
// rule and its prose both come from this.
//
// `visibleDays` is already "still ahead of us, and with something on within your preferences", so
// a passed Saturday drops out on its own and the banner narrows to "Sunday 6 September" rather
// than promising a day that's gone. Pinned to a day → only that day counts; on "This week" the
// list spans the weekend, so every campaign day still in it does.
export function cinemaWeekendDaysInView(
  effectiveDay: string | null,
  visibleDays: string[],
): string[] {
  const days = visibleDays.filter(isCinemaWeekendDay);
  if (effectiveDay === null) return days;
  return days.includes(effectiveDay) ? [effectiveDay] : [];
}

// "Saturday 5 September and Sunday 6 September" — or just the one day, once the other has passed.
export function cinemaWeekendLabel(daysInView: string[]): string {
  return daysInView.map((d) => CINEMA_WEEKEND_DAYS[d]).join(" and ");
}
