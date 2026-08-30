import type { ReactNode } from "react";

// A small fixed-width dark sticker whose text scrolls on a seamless loop — two copies on one
// track, translated -50% (the `flm-marquee` keyframe in app/globals.css, the project's only CSS
// animation). Reduced-motion falls back to a static full-width label. `--color-fg` sticker /
// `--color-bg` text, never accent (CLAUDE.md decision #7). Used by FilmNotes — the film-card
// sticker that carries the special-screening name(s) and the curated editorial label together
// (decisions #11, #13).
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
  return (
    <span
      role="img"
      aria-label={ariaLabel ?? (typeof text === "string" ? text : undefined)}
      title={title}
      className={`flm-marquee ml-3 cursor-default rounded-[3px] bg-fg text-bg align-middle text-xs font-bold uppercase tracking-wide ${className}`}
    >
      <span className="flm-marquee-track" aria-hidden="true">
        <span className="flm-marquee-item">{text}</span>
        <span className="flm-marquee-item">{text}</span>
      </span>
    </span>
  );
}
