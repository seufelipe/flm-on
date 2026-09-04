// What changed since the last published week — the `fetch:batch` report's orienting section.
// Answers the two questions you actually ask on a Thursday: what's new, what's gone. Plus the
// cross-check against the previous "Next week" tease (CLAUDE.md decision #18) — a film we
// previewed that then failed to appear means the tease was wrong or the run moved.
//
// Both baselines come from git rather than disk (see scripts/fetch-batch.ts): `fetch:batch` has
// already overwritten data/upcoming.json by the time it reports, and data/showtimes.json may
// already have been promoted by an earlier `fetch:confirm` in the same review loop.

import type { CinemaId, Screening } from "./scrapers/types";

export interface DiffFilm {
  title: string;
  year?: number;
  cinemas: CinemaId[];
  // Was this film in the previous week's "Next week" preview? Only meaningful on `added`.
  previewed: boolean;
}

export interface WeekDiff {
  added: DiffFilm[];
  gone: DiffFilm[];
  heldOver: string[];
  // Titles teased in the previous week's preview that aren't in this batch at all.
  previewedButAbsent: string[];
}

// Same case/whitespace-insensitive key as scripts/fetch-batch.ts's summarizeFilms and
// lib/groupings.ts's groupByFilm — otherwise IFI's ALL CAPS titling reads as a different film
// from Light House's, and every held-over film shows up as both added and gone.
function key(title: string): string {
  return title.trim().toLowerCase();
}

function summarize(screenings: Screening[]): Map<string, DiffFilm> {
  const films = new Map<string, DiffFilm>();
  for (const s of screenings) {
    const k = key(s.filmTitle);
    const existing = films.get(k);
    if (!existing) {
      films.set(k, { title: s.filmTitle, year: s.year, cinemas: [s.cinema], previewed: false });
      continue;
    }
    existing.year ??= s.year;
    if (!existing.cinemas.includes(s.cinema)) existing.cinemas.push(s.cinema);
  }
  return films;
}

const byTitle = (a: DiffFilm, b: DiffFilm) => a.title.localeCompare(b.title);

export function diffFilms(
  previous: Screening[],
  current: Screening[],
  previousUpcoming: { title: string }[] = [],
): WeekDiff {
  const before = summarize(previous);
  const after = summarize(current);
  const previewedKeys = new Set(previousUpcoming.map((f) => key(f.title)));

  const added: DiffFilm[] = [];
  const heldOver: string[] = [];
  for (const [k, film] of after) {
    if (before.has(k)) heldOver.push(film.title);
    else added.push({ ...film, previewed: previewedKeys.has(k) });
  }

  const gone: DiffFilm[] = [];
  for (const [k, film] of before) {
    if (!after.has(k)) gone.push(film);
  }

  const previewedButAbsent: string[] = [];
  for (const f of previousUpcoming) {
    if (!after.has(key(f.title))) previewedButAbsent.push(f.title);
  }

  return {
    added: added.sort(byTitle),
    gone: gone.sort(byTitle),
    heldOver: heldOver.sort((a, b) => a.localeCompare(b)),
    previewedButAbsent: previewedButAbsent.sort((a, b) => a.localeCompare(b)),
  };
}
