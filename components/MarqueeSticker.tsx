"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// A small fixed-width dark sticker whose text scrolls on a seamless loop — two identical copies
// on one track, and the track translates by exactly one copy's width per loop (the `flm-marquee`
// keyframe in app/globals.css). `--color-fg` sticker / `--color-bg` text, never accent
// (CLAUDE.md decision #7). Used by FilmNotes (decisions #11, #13).
//
// The shift and duration are measured client-side (`--flm-marquee-shift` /
// `--flm-marquee-duration`) rather than left as `translateX(-50%)` at a fixed 4.5s: the `%` of a
// `max-content` flex track rounds a fraction of a pixel off one copy's width — a visible stutter
// at the loop point, worse the faster it scrolls — and a fixed duration makes a long note whip
// by. Measuring fixes both. It always scrolls (even a short note), just seamlessly and at a
// steady pace. SSR / first paint fall back to the old behaviour via the CSS-var defaults.

const SCROLL_PX_PER_SEC = 40;
const MIN_DURATION_SEC = 4;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function MarqueeSticker({
  text,
  ariaLabel,
  title,
  className = "",
}: {
  text: ReactNode;
  // Required when `text` isn't a plain string (the visible content carries its own markup).
  ariaLabel?: string;
  // Optional native hover tooltip.
  title?: string;
  className?: string;
}) {
  const itemRef = useRef<HTMLSpanElement>(null);
  const [vars, setVars] = useState<CSSProperties>();

  useIsomorphicLayoutEffect(() => {
    const item = itemRef.current;
    if (!item) return;

    const measure = () => {
      // The first `.flm-marquee-item` is `white-space: nowrap` inside a `max-content` track, so
      // its width is the intrinsic content + trailing gap — one full loop's worth.
      const itemWidth = item.getBoundingClientRect().width;
      if (!itemWidth) return;
      setVars({
        ["--flm-marquee-shift" as keyof CSSProperties]: `${itemWidth}px`,
        ["--flm-marquee-duration" as keyof CSSProperties]: `${Math.max(
          itemWidth / SCROLL_PX_PER_SEC,
          MIN_DURATION_SEC,
        )}s`,
      } as CSSProperties);
    };

    measure();
    // Web font (Elms Sans) may land after the first measure and change the width.
    document.fonts?.ready.then(measure).catch(() => {});
    // `ariaLabel` tracks the visible content — re-measure when a card's notes change without a
    // remount (e.g. a Parent & Baby session dropping in/out as the Day filter changes).
  }, [ariaLabel]);

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (typeof text === "string" ? text : undefined)}
      title={title}
      className={`flm-marquee ml-3 cursor-default rounded-[3px] bg-fg text-bg align-middle text-xs font-bold uppercase tracking-wide ${className}`}
    >
      <span className="flm-marquee-track" aria-hidden="true" style={vars}>
        <span className="flm-marquee-item" ref={itemRef}>
          {text}
        </span>
        <span className="flm-marquee-item">{text}</span>
      </span>
    </span>
  );
}
