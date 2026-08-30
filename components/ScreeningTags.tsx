import { displayScreeningTags } from "@/lib/screeningTags";

// <ScreeningTagMarks> — a bare symbol (☻) after the time on a pill / plan row for each surfaced
// special-screening descriptor (Parent & Baby, Cinema Book Club, …). No text: the slot is the
// same every week, so once you've seen the name on the card sticker you recognise the mark on
// its own. The hover tooltip lives on the whole pill/row button (see FilmCard / DayPlan, via
// `screeningTagsTooltip`), not on the glyph. The card-side sticker that names these lives in
// components/FilmNotes.tsx (it's now merged with the curated editorial label).
//
// Informational, not the accent (selected pills are already accent). See CLAUDE.md decision #13.
// The symbol is bumped up a touch and forced flat (`font-variant-emoji: text`, plus the U+FE0E
// it carries) so it stays a legible ink glyph rather than a colour emoji.

function Glyph({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden="true" className="text-[1.4em] leading-none [font-variant-emoji:text]">
      {symbol}
    </span>
  );
}

export function ScreeningTagMarks({ tags }: { tags?: string[] }) {
  // `mark: false` tags (Mystery Matinee) still count as specials elsewhere but render no glyph.
  const display = displayScreeningTags(tags).filter((t) => t.mark !== false);
  if (display.length === 0) return null;
  return (
    <>
      {display.map((t) => (
        <span key={t.label} className="leading-none">
          <Glyph symbol={t.symbol} />
          <span className="sr-only">{t.title} screening</span>
        </span>
      ))}
    </>
  );
}
