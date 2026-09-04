import type { Screening } from "./scrapers/types";
import { displayScreeningTags } from "./screeningTags";
import { displayFilmFormats } from "./formats";
import { hasNonEnglishLanguage } from "./languages";

// What the "☻ Specials, etc" lens keeps, and what counts as interesting when the app volunteers a
// film of its own accord (lib/startingPoints.ts). A screening qualifies on any of: a surfaced
// special-audience / event strand, a film format (35mm / 70mm / IMAX), a non-English original
// language, or a curated editorial label. Note the language rule is about the *film's* original
// language — a subtitled or dubbed session of an English film doesn't count. See CLAUDE.md #14.
//
// `labels` is data/film-labels.json, keyed by the same `filmTitle.trim().toLowerCase()` the rest
// of the app uses for a FilmGroup.
export function isHighlight(s: Screening, labels?: Record<string, string>): boolean {
  return (
    displayScreeningTags(s.screeningTags).length > 0 ||
    displayFilmFormats(s.screeningTags).length > 0 ||
    hasNonEnglishLanguage(s.screeningTags) ||
    labels?.[s.filmTitle.trim().toLowerCase()] !== undefined
  );
}
