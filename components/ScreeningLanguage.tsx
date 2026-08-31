import { displayLanguage, captionMark } from "@/lib/languages";

// Two renderings, parallel to components/FilmFormats.tsx and components/ScreeningTags.tsx, but
// split by scope (CLAUDE.md decision #17):
//
//  - <LanguageTag>   — the film's original language as a small outlined chip on the FilmCard
//    meta line, right after the duration ("French"). Per-film; shown once. `null` for an
//    English film.
//  - <LanguageMarks> — the per-showtime caption state ("ST" / "Dub") after the time on a pill /
//    DayPlan row. The language name is on the card, not repeated here. The pill/row button
//    carries the fuller hover tooltip (via languageTooltip), not the mark.
//
// Informational, not the accent (decision #7): --color-dim only. A tag, not a marquee sticker,
// so the "one sticker max" rule (decision #13) is unaffected.

export function LanguageTag({ tags }: { tags?: string[] }) {
  const language = displayLanguage(tags)?.language;
  if (!language) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border-2 border-dim px-1.5 py-0.5 text-[0.62rem] font-bold uppercase leading-none tracking-wide text-dim">
      {language}
    </span>
  );
}

export function LanguageMarks({ tags }: { tags?: string[] }) {
  const info = displayLanguage(tags);
  const mark = info && captionMark(info);
  if (!mark) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border-2 border-dim px-1.5 py-0.5 text-[0.62rem] font-bold uppercase leading-none tracking-wide text-dim">
      {mark}
    </span>
  );
}
