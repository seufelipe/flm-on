import { Fragment, type ReactNode } from "react";
import MarqueeSticker from "@/components/MarqueeSticker";
import { displayScreeningTags } from "@/lib/screeningTags";

// The one marquee sticker after a film's title + year: its special-screening name(s)
// ("☻ parent & baby") and its curated editorial label ("4k restoration"), all in a SINGLE
// sticker, joined by " · ". Relaxes the old "one note per card" rule (CLAUDE.md decision #13) —
// a Parent & Baby screening of a 4K restoration now shows both. `mark: false` screening tags
// (Mystery Matinee) contribute nothing, same as before. Decorative → `--color-fg` / `--color-bg`
// via MarqueeSticker, never the accent (decision #7); not a count (#8).

// U+FE0E on the symbol keeps the smiley flat (text presentation) to match the ink UI.
function Glyph({ symbol }: { symbol: string }) {
  return (
    <span aria-hidden="true" className="text-[1.4em] leading-none [font-variant-emoji:text]">
      {symbol}
    </span>
  );
}

export default function FilmNotes({
  tags,
  label,
  className,
}: {
  tags?: string[];
  label?: string;
  className?: string;
}) {
  const specials = displayScreeningTags(tags).filter((t) => t.mark !== false);

  const parts: ReactNode[] = specials.map((t) => (
    <Fragment key={`s:${t.label}`}>
      <Glyph symbol={t.symbol} /> {t.label}
    </Fragment>
  ));
  if (label) parts.push(<Fragment key="label">{label}</Fragment>);
  if (parts.length === 0) return null;

  const text = parts.flatMap((part, i) =>
    i === 0 ? [part] : [<Fragment key={`sep:${i}`}> · </Fragment>, part],
  );
  const aria = [...specials.map((t) => `${t.title} — ${t.description}`), label]
    .filter(Boolean)
    .join(" · ");

  return (
    <MarqueeSticker text={<>{text}</>} ariaLabel={aria} title={aria} className={className} />
  );
}
