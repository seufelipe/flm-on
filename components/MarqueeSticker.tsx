"use client";

import * as React from "react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// A small fixed-width sticker whose text scrolls on a seamless loop — two identical copies
// on one track, and the `flm-marquee` keyframe (app/globals.css) translates the track by exactly
// `-50%` per loop. Default `tone="ink"` = `--color-fg` sticker / `--color-bg` text, never accent
// (CLAUDE.md decision #7) — used by FilmNotes (decisions #11, #13). `tone="accent"` + `tilted`
// is the one exception: the header's <ActivePreferenceNote>, where the sticker marks an active
// viewing filter (decision #14) rather than decorating a card.
//
// The track is given an explicit pixel `width` (2× the measured content+gap) so `-50%` lands
// exactly on one copy's width — a `%` of a `max-content` track rounds a fraction of a pixel off
// and stutters at the loop point. The keyframe is a plain `translate3d(-50%…)` with NO `var()`:
// a keyframe that reads a custom property can't run on the compositor (custom props resolve on
// the main thread), which is what made the tilted header sticker judder. Duration is measured
// too (~40px/s, 4s floor) so a long note doesn't whip by. SSR / first paint fall back to the
// CSS defaults until the measure lands — so a plain `useEffect` is fine (no need for a
// `useLayoutEffect` that has to be branched away on the server).

const SCROLL_PX_PER_SEC = 40;
const MIN_DURATION_SEC = 4;

export default function MarqueeSticker({
  text,
  ariaLabel,
  className = "",
  tone = "ink",
  tilted = false,
  lower = false,
  ref,
  ...rest
}: {
  text: ReactNode;
  // Required when `text` isn't a plain string (the visible content carries its own markup).
  ariaLabel?: string;
  className?: string;
  // "ink" (default) = inverted-ink sticker; "accent" = gold sticker, dark text (header only).
  tone?: "ink" | "accent";
  // The header note: the sticker lives inside a rotated wrapper (<ActivePreferenceNote>), so
  // its clip box and scrolling track each get their own compositor layer — without that the
  // rotation re-rasterises every animation frame (a visible stutter). No extra rotation of its
  // own; the wrapper owns the angle.
  tilted?: boolean;
  // Render lowercase instead of the default all-caps (header "for kids!").
  lower?: boolean;
  // A Radix TooltipTrigger with `asChild` clones this component and hands it a ref plus its own
  // event/`data-state` props, so the outer span has to accept both — that's what lets FilmNotes
  // put the sticker's explanation in a real tooltip instead of a native `title`.
} & React.ComponentPropsWithRef<"span">) {
  const itemRef = useRef<HTMLSpanElement>(null);
  const [vars, setVars] = useState<CSSProperties>();

  useEffect(() => {
    const item = itemRef.current;
    if (!item) return;

    const measure = () => {
      // The first `.flm-marquee-item` is `white-space: nowrap`, so its width is the intrinsic
      // content + trailing gap — one full loop's worth. Pin the track to 2× that in px so the
      // keyframe's `-50%` is exactly one copy (no sub-pixel drift at the loop point).
      const itemWidth = item.getBoundingClientRect().width;
      if (!itemWidth) return;
      setVars({
        width: `${itemWidth * 2}px`,
        animationDuration: `${Math.max(itemWidth / SCROLL_PX_PER_SEC, MIN_DURATION_SEC)}s`,
      });
    };

    measure();
    // Web font (Elms Sans) may land after the first measure and change the width.
    document.fonts?.ready.then(measure).catch(() => {});
    // `ariaLabel` tracks the visible content — re-measure when a card's notes change without a
    // remount (e.g. a Parent & Baby session dropping in/out as the Day filter changes).
  }, [ariaLabel]);

  return (
    <span
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? (typeof text === "string" ? text : undefined)}
      {...rest}
      className={`flm-marquee cursor-default rounded-[3px] align-middle text-xs font-bold tracking-wide ${
        lower ? "lowercase" : "uppercase"
      } ${tone === "accent" ? "bg-accent text-fg" : "bg-fg text-bg"} ${
        tilted ? "will-change-transform [transform:translateZ(0)]" : ""
      } ${className}`}
    >
      <span
        className={`flm-marquee-track ${tilted ? "will-change-transform" : ""}`}
        aria-hidden="true"
        style={vars}
      >
        <span className="flm-marquee-item" ref={itemRef}>
          {text}
        </span>
        <span className="flm-marquee-item">{text}</span>
      </span>
    </span>
  );
}
