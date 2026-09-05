import { Fragment, type ReactNode } from "react";
import MarqueeSticker from "@/components/MarqueeSticker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpecialsMark } from "@/components/ScreeningTags";
import { displayScreeningTags } from "@/lib/screeningTags";

// The one marquee sticker after a film's title + year: its special-screening name(s)
// (<SpecialsMark> + "parent & baby") and its curated editorial label ("4k restoration"), all in
// a SINGLE sticker, joined by " · ". Relaxes the old "one note per card" rule (CLAUDE.md
// decision #13) — a Parent & Baby screening of a 4K restoration now shows both. `mark: false`
// screening tags (Mystery Matinee) contribute nothing, same as before. Decorative →
// `--color-fg` / `--color-bg` via MarqueeSticker, never the accent (decision #7); not a count (#8).

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
      <SpecialsMark className="size-[1.15em] align-[-0.2em]" /> {t.label}
    </Fragment>
  ));
  if (label) parts.push(<Fragment key="label">{label}</Fragment>);
  if (parts.length === 0) return null;

  const text = parts.flatMap((part, i) =>
    i === 0 ? [part] : [<Fragment key={`sep:${i}`}> · </Fragment>, part],
  );
  // The accessible name is the whole sticker, label included — the visible marquee track is
  // aria-hidden, so this is the only copy of it.
  const aria = [...specials.map((t) => `${t.title} — ${t.description}`), label]
    .filter(Boolean)
    .join(" · ");
  // The tooltip is the strands only. A curated label ("4k restoration", "🇧🇷🇧🇷🇧🇷") is already
  // fully readable on the sticker, so repeating it on hover produced a tooltip identical to the
  // thing being hovered — which is the one thing a tooltip should never be. A label-only card
  // therefore gets no tooltip at all.
  const tip = specials.map((t) => `${t.title} — ${t.description}`).join(" · ");

  return (
    <>
      {/* Leading breakable gap: sets the space between the year and the sticker when they share
          a line, but sits at the end of the previous line (collapsing to nothing) when the
          sticker wraps below the title — so a wrapped sticker lands flush, no phantom indent
          the way a `margin-left` on the sticker itself would give. The `{" "}` after it is the
          soft-wrap opportunity the sticker breaks at. */}
      <span aria-hidden="true" className="inline-block w-2 align-middle" />{" "}
      {/* The sticker names the strand (the mark + "parent & baby"); the tooltip is where it is
          actually explained ("Parent & Baby — The volume is turned down…"). Radix rather than a
          native `title`, so it matches the pills below it — and so it can be styled at all: the
          sticker is the app's one dark surface, and the OS's grey box beside it read as a
          rendering accident. The text stays on `aria-label` too, since a tooltip is a
          hover/focus surface and touch never opens one. */}
      {tip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <MarqueeSticker text={<>{text}</>} ariaLabel={aria} />
          </TooltipTrigger>
          <TooltipContent>{tip}</TooltipContent>
        </Tooltip>
      ) : (
        <MarqueeSticker text={<>{text}</>} ariaLabel={aria} />
      )}
    </>
  );
}
