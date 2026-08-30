import { displayLanguage, languageMarkLabel } from "@/lib/languages";

// Two renderings of a film's language / international-feature descriptors (original language +
// subtitled/dubbed), parallel to components/FilmFormats.tsx and components/ScreeningTags.tsx:
//
//  - <LanguageTag>   — a small outlined chip on the FilmCard meta line (after the format tag,
//    before the Letterboxd link): "Tamil · Subtitled", "Subtitled", "Dubbed".
//  - <LanguageMarks> — a compact uppercase label after the time on a pill / DayPlan row, the
//    language analogue of the ☻ / film-strip marks. The pill/row button carries the hover
//    tooltip (via languageTooltip), not the mark.
//
// Informational, not the accent (CLAUDE.md decision #7): --color-fg / --color-dim only. Language
// is a tag, not a marquee sticker, so the "one sticker max" rule (decision #13) is unaffected.

export function LanguageTag({ tags }: { tags?: string[] }) {
  const info = displayLanguage(tags);
  if (!info) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] border-2 border-dim px-1.5 py-0.5 text-[0.62rem] font-bold uppercase leading-none tracking-wide text-dim">
      {languageMarkLabel(info)}
    </span>
  );
}

export function LanguageMarks({ tags }: { tags?: string[] }) {
  const info = displayLanguage(tags);
  if (!info) return null;
  const label = languageMarkLabel(info);
  return (
    <span className="inline-flex items-center text-[0.62rem] font-bold uppercase leading-none tracking-wide text-dim">
      {label}
    </span>
  );
}
