import MarqueeSticker from "@/components/MarqueeSticker";
import { displayScreeningTags } from "@/lib/screeningTags";

// Two renderings of a special-screening descriptor (Parent & Baby, Cinema Book Club, …):
//
//  - <ScreeningTagMarks> — a bare symbol (☻) after the time on a pill / plan row. No text: the
//    slot is the same every week, so once you've seen the label on the card you recognise the
//    mark on its own. The hover tooltip lives on the whole pill/row button (see FilmCard /
//    DayPlan, via `screeningTagsTooltip`), not on the glyph.
//  - <ScreeningTagLabel> — the symbol + the session name ("☻ parent & baby") as a marquee
//    sticker after the film's title, naming what the marks on that film's pills are. It isn't
//    inside a button, so it carries its own tooltip.
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

export function ScreeningTagLabel({ tags }: { tags?: string[] }) {
  const display = displayScreeningTags(tags).filter((t) => t.mark !== false);
  if (display.length === 0) return null;
  return (
    <>
      {display.map((t) => (
        <MarqueeSticker
          key={t.label}
          ariaLabel={`${t.title} — ${t.description}`}
          title={`${t.title} — ${t.description}`}
          text={
            <>
              <Glyph symbol={t.symbol} /> {t.label}
            </>
          }
        />
      ))}
    </>
  );
}
