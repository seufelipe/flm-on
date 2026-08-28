"use client";

import { useId } from "react";

// A curated editorial tag (e.g. "classic!") shown before a film's title, rendered as text
// running around a full circle like a rubber stamp and spinning slowly forever. Purely
// decorative emphasis — deliberately not the accent colour and not a count/badge (CLAUDE.md
// decisions #7, #8). Curated in data/film-labels.json; see decision #11.
export default function FilmLabel({ text }: { text: string }) {
  const pathId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={text}
      className="flm-label-spin mr-2 inline-block h-[2.1em] w-[2.1em] shrink-0 align-[-0.7em]"
    >
      <defs>
        {/* Full circle starting at 9 o'clock, drawn clockwise over the top — the 12 o'clock
            point is 25% along it, so startOffset="25%" + textAnchor="middle" centres the
            label across the top, reading left-to-right, glyphs facing outward. */}
        <path id={pathId} fill="none" d="M12,50 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
      </defs>
      <text
        fill="var(--color-fg)"
        fontSize="17"
        fontWeight="800"
        letterSpacing="0.3"
        style={{ textTransform: "uppercase" }}
      >
        <textPath href={`#${pathId}`} startOffset="25%" textAnchor="middle">
          {text}
        </textPath>
      </text>
    </svg>
  );
}
