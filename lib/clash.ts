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

function gapBetween(first: TimedScreening, second: TimedScreening): number {
  return second.startMins - first.endMins;
}

function filmKey(s: TimedScreening): string {
  return s.filmTitle.trim().toLowerCase();
}

function sameFilm(a: TimedScreening, b: TimedScreening): boolean {
  return filmKey(a) === filmKey(b);
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
// (which may now span several days). Minimum-gap rule: WALK_BUFFER_MINUTES cross-cinema,
// SAME_CINEMA_BUFFER_MINUTES same-cinema — but deliberately no MAX_COMBO_GAP_MINUTES cap here.
// Unlike a *suggested* addition, a plan the user built on purpose can have a long gap (lunch, a
// browse break) and that's not something to flag as wrong.
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

// Cross-cinema pairs need WALK_BUFFER_MINUTES to cover walking between buildings (e.g. Smithfield
// to Temple Bar); same-cinema pairs only need SAME_CINEMA_BUFFER_MINUTES since you're just moving
// between screens. The MAX_COMBO_GAP_MINUTES ceiling is what keeps a *suggestion* realistic —
// anything past it isn't a plan you'd actually make, it's two separate outings.
function fits(a: TimedScreening, b: TimedScreening): number | null {
  if (a.date !== b.date) return null;
  const gap = gapBetween(a, b);
  const minGap = a.cinema === b.cinema ? SAME_CINEMA_BUFFER_MINUTES : WALK_BUFFER_MINUTES;
  return gap >= minGap && gap <= MAX_COMBO_GAP_MINUTES ? gap : null;
}

// A screening that could join the plan, with the shape of the slot it would take. `afterKey` is
// the identity of the plan item it would follow (null = it would go *before* that day's first
// film), which is what makes a slot addressable — see `bestAdditionPerSlot`.
export interface PlanAddition {
  screening: TimedScreening;
  gapBefore: number | null;
  gapAfter: number | null;
  afterKey: string | null;
}

// Which not-yet-selected screenings could be added to a chronologically-sorted itinerary without
// breaking a transition. A newly-inserted screening only touches the transitions immediately
// adjacent to it (its neighbour by start time on either side) — not every other screening already
// in the plan — so this checks the candidate against its actual would-be neighbours, not a flat
// "pairs with something in the plan" check. A candidate with only one neighbour (inserting before
// the first item or after the last) only needs to satisfy that one side.
//
// Within-day only: a candidate is checked against the plan items on *its own* date, so a plan
// spanning the week only ever gets slot-in suggestions for days it already has something on. The
// same film on a *different* day is fair game (see it Tuesday and again Friday).
export function planAdditions(itinerary: TimedScreening[], candidates: TimedScreening[]): PlanAddition[] {
  const result: PlanAddition[] = [];
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

    const gapBefore = predecessor ? fits(predecessor, candidate) : null;
    if (predecessor && gapBefore === null) continue;

    const gapAfter = successor ? fits(candidate, successor) : null;
    if (successor && gapAfter === null) continue;

    if (gapBefore === null && gapAfter === null) continue;
    result.push({
      screening: candidate,
      gapBefore,
      gapAfter,
      afterKey: predecessor ? predecessor.bookingUrl : null,
    });
  }
  return result;
}

// The tightness of a candidate's fit — the smaller of the two gaps it would create. Also the
// ranking key: the least dead time wins.
function fitGap(a: PlanAddition): number {
  const gaps = [a.gapBefore, a.gapAfter].filter((g): g is number => g !== null);
  return Math.min(...gaps);
}

// Collapsed view of `planAdditions` for the film-card pill hints: bookingUrl → tightness of fit.
// Every key in this map is a screening that would slot cleanly into the plan.
export function fittingAdditions(itinerary: TimedScreening[], candidates: TimedScreening[]): Map<string, number> {
  return new Map(planAdditions(itinerary, candidates).map((a) => [a.screening.bookingUrl, fitGap(a)]));
}

// One suggestion per open slot — a slot being "before this day's first film", "between these two
// consecutive films" or "after this day's last film", addressed by the plan item it follows. The
// tightest fit wins; ties break on the earlier start, then the title, so the suggestion doesn't
// shuffle between renders.
//
// A film already in the plan is never suggested, **on any day**. `planAdditions` is deliberately
// looser (same-day only), because that rule is also what fades the film-card pills, and seeing a
// film twice in a week is a legitimate thing to *choose* — but volunteering something you've
// already committed to isn't a suggestion, it's a decision handed back to you.
export function bestAdditionPerSlot(additions: PlanAddition[], itinerary: TimedScreening[]): PlanAddition[] {
  const planned = new Set(itinerary.map(filmKey));
  const bySlot = new Map<string, PlanAddition>();
  for (const addition of additions) {
    if (planned.has(filmKey(addition.screening))) continue;
    const slot = `${addition.screening.date}:${addition.afterKey ?? "start"}`;
    const held = bySlot.get(slot);
    if (!held || betterFit(addition, held)) bySlot.set(slot, addition);
  }
  return [...bySlot.values()];
}

function betterFit(a: PlanAddition, b: PlanAddition): boolean {
  const byGap = fitGap(a) - fitGap(b);
  if (byGap !== 0) return byGap < 0;
  const byStart = a.screening.startMins - b.screening.startMins;
  if (byStart !== 0) return byStart < 0;
  return a.screening.filmTitle.localeCompare(b.screening.filmTitle) < 0;
}
