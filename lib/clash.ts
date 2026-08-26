import type { Screening } from "./scrapers/types";

export const WALK_BUFFER_MINUTES = 20;
export const SAME_CINEMA_BUFFER_MINUTES = 10;
export const MAX_COMBO_GAP_MINUTES = 90;
export const DEFAULT_DURATION_MINS = 120;

export interface TimedScreening extends Screening {
  startMins: number;
  endMins: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function withEndTimes(screenings: Screening[]): TimedScreening[] {
  return screenings.map((s) => {
    const startMins = toMinutes(s.time);
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
}

// Transitions between consecutive screenings in a chronologically-sorted, manually-built day
// plan. Same minimum-gap rule as findCombos (WALK_BUFFER_MINUTES cross-cinema,
// SAME_CINEMA_BUFFER_MINUTES same-cinema), but deliberately no MAX_COMBO_GAP_MINUTES cap here —
// unlike a suggested pair, a plan the user built on purpose can have a long gap (lunch, a browse
// break) and that's not something to flag as wrong.
export function itineraryTransitions(sortedByStart: TimedScreening[]): ItineraryTransition[] {
  const transitions: ItineraryTransition[] = [];
  for (let i = 0; i < sortedByStart.length - 1; i++) {
    const first = sortedByStart[i];
    const second = sortedByStart[i + 1];
    const gap = gapBetween(first, second);
    const minGap = first.cinema === second.cinema ? SAME_CINEMA_BUFFER_MINUTES : WALK_BUFFER_MINUTES;
    transitions.push({ gapMins: gap, overlap: gap < 0, tooTight: gap >= 0 && gap < minGap });
  }
  return transitions;
}

function fits(a: TimedScreening, b: TimedScreening): number | null {
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
export function fittingAdditions(itinerary: TimedScreening[], candidates: TimedScreening[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const candidate of candidates) {
    if (itinerary.some((item) => sameFilm(item, candidate))) continue;

    let predecessor: TimedScreening | undefined;
    let successor: TimedScreening | undefined;
    for (const item of itinerary) {
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
