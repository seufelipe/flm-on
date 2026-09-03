// The "Next week" tease (CLAUDE.md decision #18). `fetch:batch` scrapes the following
// Thursday-week — still unconfirmed — and this picks the films worth showing as a preview:
// anything not already playing this week (a held-over film isn't news, even if next week's run
// is a special format — you can already see it). New shorts are dropped (matching the
// hideShortFilms default); a short *special* is kept. No session data goes to the UI; the cards
// render without showtime pills. The result is written to data/upcoming.json for the user to
// trim during the weekly review, then read straight at build time like data/film-labels.json.

import type { CinemaId, Screening } from "./scrapers/types";
import { withEndTimes } from "./clash";
import { groupByFilm } from "./groupings";
import { CINEMA_LABEL } from "./cinemas";
import { displayScreeningTags } from "./screeningTags";
import { displayFilmFormats } from "./formats";
import { hasNonEnglishLanguage } from "./languages";
import { isShortFilm } from "./duration";

export interface UpcomingFilm {
  title: string;
  year?: number;
  cert?: string;
  director?: string;
  originalTitle?: string;
  letterboxdUrl?: string;
  cinemas: CinemaId[];
  // One per cinema the film plays at that has a film page. Carries the cinema id so the UI can
  // drop a link for a cinema the viewer has turned off (matching how regular film cards work).
  cinemaLinks: { cinema: CinemaId; label: string; url: string }[];
  // Every screeningTag across the film's next-week sessions — feeds the card's FilmNotes sticker
  // and the language / format chips on the meta line (there are no pills to carry per-session marks).
  screeningTags: string[];
  label?: string;
  firstDate: string;
  // Why the film made the cut — for the fetch:batch report only, not shown in the UI.
  reason: "new" | "special";
}

// The "Specials, etc" test, applied to one session's tags (plus the curated-label check).
function isSpecialSession(
  tags: string[] | undefined,
  key: string,
  labels: Record<string, string>,
): boolean {
  return (
    displayScreeningTags(tags).length > 0 ||
    displayFilmFormats(tags).length > 0 ||
    hasNonEnglishLanguage(tags) ||
    key in labels
  );
}

export function selectUpcomingFilms(
  thisWeek: Screening[],
  nextWeek: Screening[],
  labels: Record<string, string>,
): UpcomingFilm[] {
  const thisWeekKeys = new Set(thisWeek.map((s) => s.filmTitle.trim().toLowerCase()));
  const groups = groupByFilm(withEndTimes(nextWeek));

  const films: UpcomingFilm[] = [];
  for (const g of groups) {
    // Already playing this week → not a "coming next week" tease, whatever next week's run is.
    if (thisWeekKeys.has(g.key)) continue;
    const special = g.screenings.some((s) => isSpecialSession(s.screeningTags, g.key, labels));
    // Archive shorts are noise here, matching the hideShortFilms default — keep one only if it's
    // an actual special (a relaxed screening, a 35mm print).
    if (isShortFilm(g.durationMins) && !special) continue;

    type Link = { cinema: CinemaId; label: string; url: string };
    const cinemas = new Map<CinemaId, Link | null>();
    for (const s of g.screenings) {
      if (cinemas.has(s.cinema)) continue;
      cinemas.set(
        s.cinema,
        s.filmPageUrl
          ? { cinema: s.cinema, label: CINEMA_LABEL[s.cinema] ?? s.cinemaName, url: s.filmPageUrl }
          : null,
      );
    }

    films.push({
      title: g.filmTitle,
      year: g.year,
      cert: g.cert,
      director: g.director,
      originalTitle: g.originalTitle,
      letterboxdUrl: g.letterboxdUrl,
      cinemas: Array.from(cinemas.keys()),
      cinemaLinks: Array.from(cinemas.values()).filter((v): v is Link => v !== null),
      screeningTags: Array.from(new Set(g.screenings.flatMap((s) => s.screeningTags ?? []))),
      label: labels[g.key],
      firstDate: g.screenings[0].date,
      reason: special ? "special" : "new",
    });
  }

  // Specials first (the strongest tease), then earliest first.
  films.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "special" ? -1 : 1;
    return a.firstDate.localeCompare(b.firstDate);
  });
  return films;
}
