import type { Screening } from "./scrapers/types";
import { displayScreeningTags } from "./screeningTags";
import { displayFilmFormats } from "./formats";
import { hasNonEnglishLanguage, hasOpenCaptions } from "./languages";

// What the "☻ Specials, etc" lens keeps, and what counts as interesting when the app volunteers a
// film of its own accord (lib/startingPoints.ts). A screening qualifies on any of: a surfaced
// special-audience / event strand, a film format (35mm / 70mm / IMAX), a non-English original
// language, an open-captioned session, or a curated editorial label. See CLAUDE.md #14.
//
// Two near-misses worth keeping straight, because both look like they should count and don't:
//  - the language rule is about the *film's* original language, so a subtitled or dubbed session
//    of an English film doesn't qualify on that clause;
//  - but **open captions do**, on their own clause. They're burned into the print, there are only
//    a handful a week, and people who need them go looking for them specifically — which is the
//    test this lens is meant to apply. A plain subtitle track is neither scarce nor sought.
//
// `labels` is data/film-labels.json, keyed by the same `filmTitle.trim().toLowerCase()` the rest
// of the app uses for a FilmGroup.
export function isHighlight(s: Screening, labels?: Record<string, string>): boolean {
  return (
    displayScreeningTags(s.screeningTags).length > 0 ||
    displayFilmFormats(s.screeningTags).length > 0 ||
    hasNonEnglishLanguage(s.screeningTags) ||
    hasOpenCaptions(s.screeningTags) ||
    labels?.[s.filmTitle.trim().toLowerCase()] !== undefined
  );
}
