import type { TimedScreening } from "./clash";
import { isHighlight } from "./highlights";
import { TIMEFRAMES, timeframeForTime } from "./timeframe";

// Where an *empty* plan gets its suggestions. There's no itinerary to slot into yet, so instead of
// the gap maths in lib/clash.ts this seeds one screening per timeframe — Early / Mid / Late — as
// three ways the day could start, rendered as the same dashed ghost rows.
//
// A special beats an ordinary showing (`isHighlight`): if the app is going to volunteer something
// unprompted it should be the 70mm print or the Parent & Baby screening, not whichever wide
// release happened to sort first. Among equals the earlier start wins, then the title, so the
// three don't shuffle between renders.
//
// Timeframes are filled in order and a film is only ever offered once — three slots showing the
// same film at three times isn't three suggestions.
//
// `spreadDays` is for the "This week" case, where the pool is the whole week rather than one
// pinned day: it makes a day nothing has been picked from yet beat one already used, so the three
// rows actually span the week instead of collapsing onto its first day. It ranks *below* the
// specials rule on purpose — a 70mm print today still beats an ordinary showing on Friday.
export function startingPoints(
  candidates: TimedScreening[],
  labels?: Record<string, string>,
  spreadDays = false,
): TimedScreening[] {
  const usedFilms = new Set<string>();
  const usedDays = new Set<string>();
  const picks: TimedScreening[] = [];
  for (const tf of TIMEFRAMES) {
    let best: TimedScreening | undefined;
    for (const c of candidates) {
      if (timeframeForTime(c.time) !== tf.id) continue;
      if (usedFilms.has(filmKey(c))) continue;
      if (!best || betterStart(c, best, labels, spreadDays ? usedDays : undefined)) best = c;
    }
    if (best) {
      usedFilms.add(filmKey(best));
      usedDays.add(best.date);
      picks.push(best);
    }
  }
  return picks;
}

function filmKey(s: TimedScreening): string {
  return s.filmTitle.trim().toLowerCase();
}

function betterStart(
  a: TimedScreening,
  b: TimedScreening,
  labels?: Record<string, string>,
  usedDays?: Set<string>,
): boolean {
  const aSpecial = isHighlight(a, labels);
  const bSpecial = isHighlight(b, labels);
  if (aSpecial !== bSpecial) return aSpecial;
  if (usedDays) {
    const aFresh = !usedDays.has(a.date);
    const bFresh = !usedDays.has(b.date);
    if (aFresh !== bFresh) return aFresh;
  }
  const byStart = a.startMins - b.startMins;
  if (byStart !== 0) return byStart < 0;
  return a.filmTitle.localeCompare(b.filmTitle) < 0;
}
