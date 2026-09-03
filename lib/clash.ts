import type { Screening } from "./scrapers/types";
import { daysBetweenISO } from "./date";

export const WALK_BUFFER_MINUTES = 20;
export const SAME_CINEMA_BUFFER_MINUTES = 10;
export const MAX_COMBO_GAP_MINUTES = 90;
export const DEFAULT_DURATION_MINS = 120;

// `startMins` / `endMins` are minutes since this fixed epoch, not since local midnight — so a
// plan can span several days and every gap calculation below stays a plain subtraction. It also
// means `endMins` no longer needs to wrap: a 23:30 film + 150min ends at the next day's 02:00.
export const ORDINAL_EPOCH = "1970-01-01";

export interface TimedScreening extends Screening {
  startMins: number;
  endMins: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function toOrdinalMinutes(date: string, time: string): number {
  return daysBetweenISO(ORDINAL_EPOCH, date) * 1440 + toMinutes(time);
}

// Wall-clock "HH:MM" from an ordinal minute count (the `% 24` folds the day component away).
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function withEndTimes(screenings: Screening[]): TimedScreening[] {
  return screenings.map((s) => {
    const startMins = toOrdinalMinutes(s.date, s.time);
    const duration = s.durationMins ?? DEFAULT_DURATION_MINS;
    return {
      ...s,
      durationEstimated: s.durationMins === undefined,
      startMins,
      endMins: startMins + duration,
    };
  });
}

function sortedPair(a: TimedScreening, b: TimedScreening): [TimedScreening, TimedScreening] {
  return a.startMins <= b.startMins ? [a, b] : [b, a];
}

function gapBetween(first: TimedScreening, second: TimedScreening): number {
  return second.startMins - first.endMins;
}

function sameFilm(a: TimedScreening, b: TimedScreening): boolean {
  return a.filmTitle.trim().toLowerCase() === b.filmTitle.trim().toLowerCase();
}

export interface ScreeningPair {
  a: TimedScreening;
  b: TimedScreening;
  gapMins: number;
}

// Valid double bills: same day, different films (the same film showing twice isn't a double
// bill), with enough of a gap between them but not an unreasonably long wait — anything past
// MAX_COMBO_GAP_MINUTES isn't a realistic plan. Cross-cinema pairs need WALK_BUFFER_MINUTES to
// cover walking between buildings (e.g. Smithfield to Temple Bar); same-cinema pairs only need
// SAME_CINEMA_BUFFER_MINUTES since you're just moving between screens.
export function findCombos(screenings: Screening[], limit = 10): ScreeningPair[] {
  const timed = withEndTimes(screenings);
  const combos: ScreeningPair[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[i].date !== timed[j].date) continue;
      if (sameFilm(timed[i], timed[j])) continue;
      const [first, second] = sortedPair(timed[i], timed[j]);
      const gap = gapBetween(first, second);
      const minGap = first.cinema === second.cinema ? SAME_CINEMA_BUFFER_MINUTES : WALK_BUFFER_MINUTES;
      if (gap >= minGap && gap <= MAX_COMBO_GAP_MINUTES) {
        combos.push({ a: first, b: second, gapMins: gap });
      }
    }
  }
  return combos.sort((a, b) => a.gapMins - b.gapMins).slice(0, limit);
}

export interface ItineraryTransition {
  gapMins: number;
  overlap: boolean;
  tooTight: boolean;
  // The two screenings are on different days — a plan spanning the week. Not a clash: the caller
  // renders a day break here, not a gap ("Overlaps 840min" would be nonsense).
  crossDay: boolean;
}

// Transitions between consecutive screenings in a chronologically-sorted, manually-built plan
// (which may now span several days). Same minimum-gap rule as findCombos (WALK_BUFFER_MINUTES
// cross-cinema, SAME_CINEMA_BUFFER_MINUTES same-cinema), but deliberately no MAX_COMBO_GAP_MINUTES
// cap here — unlike a suggested pair, a plan the user built on purpose can have a long gap
// (lunch, a browse break) and that's not something to flag as wrong.
export function itineraryTransitions(sortedByStart: TimedScreening[]): ItineraryTransition[] {
  const transitions: ItineraryTransition[] = [];
  for (let i = 0; i < sortedByStart.length - 1; i++) {
    const first = sortedByStart[i];
    const second = sortedByStart[i + 1];
    const gap = gapBetween(first, second);
    if (first.date !== second.date) {
      transitions.push({ gapMins: gap, overlap: false, tooTight: false, crossDay: true });
      continue;
    }
    const minGap = first.cinema === second.cinema ? SAME_CINEMA_BUFFER_MINUTES : WALK_BUFFER_MINUTES;
    transitions.push({ gapMins: gap, overlap: gap < 0, tooTight: gap >= 0 && gap < minGap, crossDay: false });
  }
  return transitions;
}

function fits(a: TimedScreening, b: TimedScreening): number | null {
  if (a.date !== b.date) return null;
  const gap = gapBetween(a, b);
  const minGap = a.cinema === b.cinema ? SAME_CINEMA_BUFFER_MINUTES : WALK_BUFFER_MINUTES;
  return gap >= minGap && gap <= MAX_COMBO_GAP_MINUTES ? gap : null;
}

// Which not-yet-selected screenings could be added to a chronologically-sorted itinerary without
// breaking a transition. A newly-inserted screening only touches the transitions immediately
// adjacent to it (its neighbor by start time on either side) — not every other screening already
// in the plan — so this checks the candidate against its actual would-be neighbors, not a flat
// "pairs with something in the plan" check. A candidate with only one neighbor (inserting before
// the first item or after the last) only needs to satisfy that one side. Same buffer/cap rules as
// findCombos — a suggested addition should still be a realistic pairing, unlike the itinerary
// display itself, which doesn't cap a gap the user already committed to.
//
// Hints are within-day only: a candidate is checked against the plan items on *its own* date, so
// a plan spanning the week only ever gets slot-in hints for days it already has something on. The
// same film on a *different* day is fair game (see it Tuesday and again Friday).
export function fittingAdditions(itinerary: TimedScreening[], candidates: TimedScreening[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const candidate of candidates) {
    const sameDayItinerary = itinerary.filter((item) => item.date === candidate.date);
    if (sameDayItinerary.length === 0) continue;
    if (sameDayItinerary.some((item) => sameFilm(item, candidate))) continue;

    let predecessor: TimedScreening | undefined;
    let successor: TimedScreening | undefined;
    for (const item of sameDayItinerary) {
      if (item.startMins <= candidate.startMins) {
        predecessor = item;
      } else {
        successor = item;
        break;
      }
    }

    const gaps: number[] = [];
    const gapBefore = predecessor ? fits(predecessor, candidate) : undefined;
    if (predecessor && gapBefore === null) continue;
    if (gapBefore != null) gaps.push(gapBefore);

    const gapAfter = successor ? fits(candidate, successor) : undefined;
    if (successor && gapAfter === null) continue;
    if (gapAfter != null) gaps.push(gapAfter);

    if (gaps.length > 0) result.set(candidate.bookingUrl, Math.min(...gaps));
  }
  return result;
}
