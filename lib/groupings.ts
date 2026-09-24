import type { TimedScreening } from "./clash";
import type { ProgrammeFilm } from "./scrapers/types";
import { sectionStrand, type ScreeningTagDisplay } from "./screeningTags";

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
  programme?: ProgrammeFilm[];
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
        programme: s.programme,
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
    if (!group.programme?.length) group.programme = s.programme ?? group.programme;
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

// One heading's worth of the This-week list. `strand` is a `section` strand (decision #27), whose
// name and icon head the section; "new" and "also" are decision #26's two.
export type FilmSection =
  | { kind: "strand"; strand: ScreeningTagDisplay; films: FilmGroup[] }
  | { kind: "new"; films: FilmGroup[] }
  | { kind: "also"; films: FilmGroup[] };

// Splits the film list into the This-week view's headed sections, in order: each `section`
// strand (a festival, #27), then "New this week", then "Also on" (#26). Each film lands in exactly
// one — a festival film that's also new goes under the festival. `newKeys` is data/showtimes.json's
// `newFilms`, keyed like FilmGroup.key. A film files under a strand when any of its (visible)
// screenings carries one: the strand is per session, so a film at two cinemas where only one
// is running the festival still counts. Order within each section is whatever came in, so the
// chronological sort above survives the split.
//
// **Headings only when there are at least two sections.** Nothing new and no festival, or
// *everything* in one bucket (the first run against an empty baseline), says nothing, so it
// collapses to a single "also" section and the caller draws no heading at all. Call with no
// options — a pinned day — for the same single list. Keeping that rule here rather than in the
// component is what makes it testable.
export function partitionFilmSections(
  groups: FilmGroup[],
  opts?: { newKeys?: Set<string> },
): FilmSection[] {
  const single: FilmSection[] = [{ kind: "also", films: groups }];
  if (!opts) return single;

  const strands = new Map<string, { strand: ScreeningTagDisplay; films: FilmGroup[] }>();
  const fresh: FilmGroup[] = [];
  const also: FilmGroup[] = [];
  for (const g of groups) {
    const strand = g.screenings.map((s) => sectionStrand(s.screeningTags)).find(Boolean);
    if (strand) {
      const bucket = strands.get(strand.label) ?? { strand, films: [] };
      bucket.films.push(g);
      strands.set(strand.label, bucket);
    } else {
      (opts.newKeys?.has(g.key) ? fresh : also).push(g);
    }
  }

  const all: FilmSection[] = [
    ...Array.from(strands.values(), (b): FilmSection => ({ kind: "strand", ...b })),
    { kind: "new", films: fresh },
    { kind: "also", films: also },
  ];
  const sections = all.filter((sec) => sec.films.length > 0);
  return sections.length > 1 ? sections : single;
}
