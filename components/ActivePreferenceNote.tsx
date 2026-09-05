"use client";

import { useSyncExternalStore } from "react";
import {
  preferencesSnapshot,
  PREFERENCES_SERVER_SNAPSHOT,
  subscribePreferences,
} from "@/lib/preferences";
import MarqueeSticker from "./MarqueeSticker";

// Two deliberately different treatments layered on the "FLM ON" title — one per preference that
// narrows the films with no filter-bar trace (CLAUDE.md #14). Rendered inside the header's
// `relative w-fit` wrapper (alongside the <h1>):
//
//  - language → two STATIC dark pills (one per line, each hugging its own text) stacked and
//    centred on the logo, sitting low over the base of the title / into the tagline like a
//    subtitle: "Only films / in english" or "Only films / not in english".
//  - kids-only → the tilted gold marquee (lowercase "for kids!"), stuck at an angle over the
//    "N" of the title as if a kid slapped it on there.
export default function ActivePreferenceNote() {
  const { prefs, loaded } = useSyncExternalStore(
    subscribePreferences,
    preferencesSnapshot,
    () => PREFERENCES_SERVER_SNAPSHOT,
  );

  if (!loaded) return null;

  const languageLine2 =
    prefs.language === "english"
      ? "in english"
      : prefs.language === "non-english"
        ? "not in english"
        : null;

  if (!prefs.kidsOnly && !languageLine2) return null;

  return (
    <>
      {languageLine2 && (
        <span
          className="no-print absolute left-1/2 top-full z-10 flex w-max -translate-x-1/2 -translate-y-[58%] flex-col items-center gap-0.5"
          aria-label={`Only films ${languageLine2}`}
        >
          <span
            aria-hidden="true"
            className="whitespace-nowrap rounded-[3px] bg-fg px-1.5 py-1 text-xs font-bold leading-none tracking-wide text-bg"
          >
            Only films
          </span>
          <span
            aria-hidden="true"
            className="whitespace-nowrap rounded-[3px] bg-fg px-1.5 py-1 text-xs font-bold leading-none tracking-wide text-bg"
          >
            {languageLine2}
          </span>
        </span>
      )}
      {prefs.kidsOnly && (
        <span className="no-print absolute -top-[3px] left-[64%] z-10 rotate-[12deg] sm:left-[72%]">
          <MarqueeSticker
            text="for kids!"
            ariaLabel="for kids!"
            tone="accent"
            tilted
            lower
          />
        </span>
      )}
    </>
  );
}
