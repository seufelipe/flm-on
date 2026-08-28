"use client";

import { useState } from "react";

// A film title rendered redacted — each word sits under a solid dark block until clicked, the
// way a review site hides a spoiler. Click anywhere on it to toggle. Decorative treatment, so
// per CLAUDE.md decision #7 it uses --color-fg, never the accent. Used only for the IFI's
// "Mystery Matinee" strand (see lib/mystery.ts).
export default function MysteryTitle({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      aria-label={revealed ? text : `${text} — hidden, click to reveal`}
      className="font-black uppercase inline-flex flex-wrap items-baseline gap-x-3 gap-y-1 text-left align-middle cursor-pointer"
    >
      {words.map((word, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={
            revealed
              ? ""
              : "rounded-[3px] bg-fg text-transparent select-none px-1"
          }
        >
          {word}
        </span>
      ))}
    </button>
  );
}
