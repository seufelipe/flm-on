"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { displayLanguage, captionMark } from "@/lib/languages";

// Two renderings, parallel to components/FilmFormats.tsx and components/ScreeningTags.tsx, but
// split by scope (CLAUDE.md decision #17):
//
//  - <LanguageTag>   — the film's original language as a small speech bubble on the FilmCard
//    meta line, right after the duration ("French") — the tail nods to "this is the language
//    it's spoken in". Per-film; shown once. `null` for an English film.
//  - <LanguageMarks> — the per-showtime caption state ("ST" / "Dub") after the time on a pill /
//    DayPlan row. The language name is on the card, not repeated here. The pill/row button
//    carries the fuller hover tooltip (via languageTooltip), not the mark.
//
// Informational, not the accent (decision #7): --color-dim only. A tag, not a marquee sticker,
// so the "one sticker max" rule (decision #13) is unaffected.

const TAIL_W = 8; // px, tail mouth width
const TAIL_H = 5; // px, how far the tail drops below the bubble
const TAIL_INSET = 7; // px, gap from the bubble's left edge to the tail
const RADIUS = 6;
const STROKE = 2;

// The whole outline — rounded rect + a downward tail on the bottom edge — as one continuous
// path, so the border reads as a single unbroken stroke that detours around the tail (rather
// than a separate triangle sitting on a straight line). Drawn as SVG because the box model
// can't miter a horizontal border into a 45° tail arm cleanly at every size.
function bubblePath(w: number, h: number): string {
  const r = RADIUS;
  const tl = TAIL_INSET;
  const tr = tl + TAIL_W;
  const tm = tl + TAIL_W / 2;
  return [
    `M ${r},0`,
    `H ${w - r}`,
    `A ${r},${r} 0 0 1 ${w},${r}`,
    `V ${h - r}`,
    `A ${r},${r} 0 0 1 ${w - r},${h}`,
    `H ${tr}`,
    `L ${tm},${h + TAIL_H}`,
    `L ${tl},${h}`,
    `H ${r}`,
    `A ${r},${r} 0 0 1 0,${h - r}`,
    `V ${r}`,
    `A ${r},${r} 0 0 1 ${r},0`,
    "Z",
  ].join(" ");
}

export function LanguageTag({ tags }: { tags?: string[] }) {
  const language = displayLanguage(tags)?.language;
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [language]);

  if (!language) return null;

  return (
    <span
      ref={ref}
      className="relative inline-flex shrink-0 items-center px-2 py-1 text-[0.62rem] font-bold uppercase leading-none tracking-wide text-dim"
    >
      {size && (
        <svg
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={size.w}
          height={size.h + TAIL_H}
          viewBox={`${-STROKE / 2} ${-STROKE / 2} ${size.w + STROKE} ${size.h + TAIL_H + STROKE}`}
        >
          <path
            d={bubblePath(size.w, size.h)}
            fill="var(--color-surface)"
            stroke="var(--color-dim)"
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="relative">{language}</span>
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
