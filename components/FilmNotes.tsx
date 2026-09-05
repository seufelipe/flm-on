import { Fragment, type ReactNode } from "react";
import MarqueeSticker from "@/components/MarqueeSticker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
}: {
  tags?: string[];
  label?: string;
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
    <>
      {/* Leading breakable gap: sets the space between the year and the sticker when they share
          a line, but sits at the end of the previous line (collapsing to nothing) when the
          sticker wraps below the title — so a wrapped sticker lands flush, no phantom indent
          the way a `margin-left` on the sticker itself would give. The `{" "}` after it is the
          soft-wrap opportunity the sticker breaks at. */}
      <span aria-hidden="true" className="inline-block w-2 align-middle" />{" "}
      {/* The sticker names the strand ("☻ parent & baby"); the tooltip is where the strand is
          actually explained ("Parent & Baby — The volume is turned down…"). Radix rather than a
          native `title`, so it matches the pills below it — and so it can be styled at all: the
          sticker is the app's one dark surface, and the OS's grey box beside it read as a
          rendering accident. The same string stays on `aria-label`, since a tooltip is a
          hover/focus surface and touch never opens one. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <MarqueeSticker text={<>{text}</>} ariaLabel={aria} />
        </TooltipTrigger>
        <TooltipContent>{aria}</TooltipContent>
      </Tooltip>
    </>
  );
}
