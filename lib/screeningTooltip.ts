import { screeningTagsTooltip } from "@/lib/screeningTags";
import { filmFormatsTooltip } from "@/lib/formats";
import { languageTooltip } from "@/lib/languages";

// The one merged explanation of everything marked on a single showtime — the special-screening
// strand(s), the print/large format, and the language + caption state, joined by " · " in that
// order. It composes the three sibling `*Tooltip` builders (lib/screeningTags.ts, lib/formats.ts,
// lib/languages.ts); each of those still explains only its own concept, which is what the
// per-format box on the card's meta line wants.
//
// Both surfaces that show a whole showtime use this: the pills on a film card and the rows in
// the plan. They had grown identical private copies of the composition, which is how the plan
// rows ended up on a native `title` long after the pills moved to Radix.
//
// `undefined` when the screening has nothing to explain — the caller then skips mounting a
// tooltip at all rather than opening an empty one.
export function screeningTooltip(tags?: string[]): string | undefined {
  return (
    [screeningTagsTooltip(tags), filmFormatsTooltip(tags), languageTooltip(tags)]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}
