import type { TimedScreening } from "./clash";

export interface FilmGroup {
  key: string;
  filmTitle: string;
  originalTitle?: string;
  year?: number;
  cert?: string;
  durationMins?: number;
  durationEstimated?: boolean;
  director?: string;
  letterboxdUrl?: string;
  screenings: TimedScreening[];
}

// Groups screenings by film title (case/whitespace-insensitive) so the same film showing at
// both cinemas appears once, with each cinema/time as a separate pill underneath — answers
// "what can I watch" rather than "what individual screenings exist".
export function groupByFilm(screenings: TimedScreening[]): FilmGroup[] {
  const groups = new Map<string, FilmGroup>();

  for (const s of screenings) {
    const key = s.filmTitle.trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        filmTitle: s.filmTitle,
        originalTitle: s.originalTitle,
        year: s.year,
        cert: s.cert,
        durationMins: s.durationMins,
        durationEstimated: s.durationEstimated,
        director: s.director,
        letterboxdUrl: s.letterboxdUrl,
        screenings: [],
      };
      groups.set(key, group);
    }
    group.originalTitle = group.originalTitle ?? s.originalTitle;
    group.cert = group.cert ?? s.cert;
    group.year = group.year ?? s.year;
    group.durationMins = group.durationMins ?? s.durationMins;
    group.director = group.director ?? s.director;
    group.letterboxdUrl = group.letterboxdUrl ?? s.letterboxdUrl;
    group.screenings.push(s);
  }

  const result = Array.from(groups.values());
  const chrono = (s: TimedScreening) => `${s.date}T${String(s.startMins).padStart(4, "0")}`;
  for (const g of result) {
    g.screenings.sort((a, b) => chrono(a).localeCompare(chrono(b)));
  }
  result.sort((a, b) => {
    const aFirst = a.screenings[0];
    const bFirst = b.screenings[0];
    if (!aFirst || !bFirst) return 0;
    return chrono(aFirst).localeCompare(chrono(bFirst));
  });
  return result;
}

export interface DayGroup {
  date: string;
  screenings: TimedScreening[];
}

// Buckets an already-chronologically-sorted screening list by date, preserving order — used to
// sub-group a film card's pills by day so a film playing all week doesn't render as one
// undifferentiated wall of pills.
export function groupScreeningsByDay(screenings: TimedScreening[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const s of screenings) {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) {
      last.screenings.push(s);
    } else {
      groups.push({ date: s.date, screenings: [s] });
    }
  }
  return groups;
}

export interface FilmSections {
  newThisWeek: FilmGroup[];
  alsoOn: FilmGroup[];
}

// Splits the film list into "new this week" and "also on" for the This-week view's two headings
// (CLAUDE.md decision #26). `newKeys` is data/showtimes.json's `newFilms` — the titles that
// weren't in the previously published week, keyed like FilmGroup.key. Order within each half is
// whatever came in, so the chronological sort above survives the split.
//
// **Both halves or neither**: if nothing is new, or *everything* is (the first run against an
// empty baseline, or a week where the whole programme turned over), the split says nothing, so
// it collapses to a single unlabelled list. The caller's rule is then just "headings when
// newThisWeek is non-empty" — keeping that here rather than in the component is what makes it
// testable.
export function partitionNewFilms(groups: FilmGroup[], newKeys?: Set<string>): FilmSections {
  if (!newKeys || newKeys.size === 0) return { newThisWeek: [], alsoOn: groups };

  const newThisWeek: FilmGroup[] = [];
  const alsoOn: FilmGroup[] = [];
  for (const g of groups) {
    (newKeys.has(g.key) ? newThisWeek : alsoOn).push(g);
  }
  if (alsoOn.length === 0) return { newThisWeek: [], alsoOn: groups };
  return { newThisWeek, alsoOn };
}
