import MarqueeSticker from "@/components/MarqueeSticker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StrandMark } from "@/components/ScreeningTags";
import { displayScreeningTags } from "@/lib/screeningTags";
import { formatWeekdayDate } from "@/lib/date";

// The marquee stickers after a film's title + year: one per special-screening strand
// (<StrandMark> + "parent & baby"), then one for the curated editorial label ("4k
// restoration") — each sticker is exactly one thing, so each can carry its own tooltip.
// `mark: false` screening tags (Mystery Matinee) get none. Decorative → `--color-fg` /
// `--color-bg` via MarqueeSticker, never the accent (decision #7); not a count (#8).
//
// A strand is a property of a session, not of the film, so on a card carrying two of them
// (Sense and Sensibility: a Friday Silver Screen, a Wednesday Knit-Along) each strand's tooltip
// also says when it plays — the stickers' marks are the key to the pills below, and the tooltip
// is where you find out which pill is which. A lone strand keeps its plain line: there's nothing
// to tell apart. Past MAX_LISTED sessions (a weekly Parent & Baby) the times would be a listing,
// not a pointer, so they're left to the pills.

const MAX_LISTED = 3;

export default function FilmNotes({
  tags,
  label,
  sessions,
}: {
  tags?: string[];
  label?: string;
  sessions?: Map<string, { date: string; time: string }[]>;
}) {
  const specials = displayScreeningTags(tags).filter((t) => t.mark !== false);
  if (specials.length === 0 && !label) return null;

  const line = (t: (typeof specials)[number]) => {
    const when = specials.length > 1 ? sessions?.get(t.label) : undefined;
    const listed =
      when && when.length > 0 && when.length <= MAX_LISTED
        ? ` (${when.map((s) => `${formatWeekdayDate(s.date)}, ${s.time}`).join("; ")})`
        : "";
    return `${t.title}${listed} — ${t.description}`;
  };

  return (
    <>
      {/* Leading breakable gap: sets the space between the year and the stickers when they
          share a line, but sits at the end of the previous line (collapsing to nothing) when the
          stickers wrap below the title — so they land flush, no phantom indent the way a
          `margin-left` would give. The `{" "}` after it is the soft-wrap opportunity. */}
      <span aria-hidden="true" className="inline-block w-2 align-middle" />{" "}
      {/* One inline-flex group, so the stickers wrap below the title together rather than one
          at a time; `flex-wrap` only matters under reduced motion, where a sticker drops its
          fixed width and shows its whole text. */}
      <span className="inline-flex flex-wrap gap-1.5 align-middle">
        {specials.map((t) => {
          // The sticker names the strand (the mark + "parent & baby"); the tooltip is where it
          // is explained ("Parent & Baby — The volume is turned down…"). Radix rather than a
          // native `title`, so it can be styled at all — the sticker is the app's one dark
          // surface. The same text sits on `aria-label`, since touch never opens a tooltip and
          // the visible marquee track is aria-hidden.
          const tip = line(t);
          return (
            <Tooltip key={t.label}>
              <TooltipTrigger asChild>
                <MarqueeSticker
                  text={
                    <>
                      <StrandMark label={t.label} className="size-[1.15em] align-[-0.2em]" /> {t.label}
                    </>
                  }
                  ariaLabel={tip}
                />
              </TooltipTrigger>
              <TooltipContent>{tip}</TooltipContent>
            </Tooltip>
          );
        })}
        {/* The curated label gets no tooltip: it's already fully readable on the sticker, so
            hovering it would show the thing being hovered. */}
        {label && <MarqueeSticker text={label} ariaLabel={label} />}
      </span>
    </>
  );
}
