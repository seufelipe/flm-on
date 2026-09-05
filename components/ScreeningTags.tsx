import { FaceGrinning } from "lucide-react";

import { displayScreeningTags } from "@/lib/screeningTags";
import { cn } from "@/lib/utils";

// The specials mark, shared by all three surfaces that carry it — the bare mark on a pill / plan
// row below, the card sticker that names the strand (components/FilmNotes.tsx) and the
// "Specials, etc" lens that filters on it (components/FilterControls.tsx) — so the mark you scan
// a row of showtimes for is the same one on the lens that shows them. Same shape as
// <CinemaWeekendMark>, and for the same reason.
//
// It replaced a `☻` text glyph (CLAUDE.md decisions #13, #23) and stays the same smiley — the
// glyph moved to an icon, the mark didn't change. Lucide's outline, not the star's
// `fill-current`: the eyes and mouth are strokes drawn *inside* the circle, so filling it paints
// over the face. The caller sizes it — `size-[1.1em]` rather than the star's `1em`, since an icon
// fills its box where the glyph's ink sat well inside its em.
//
// Informational, never the accent (a selected pill is already accent — decision #7), and always
// decorative: every caller names the strand in text beside it or in an `sr-only` span.
export function SpecialsMark({ className }: { className?: string }) {
  return <FaceGrinning aria-hidden="true" className={cn("inline-block", className)} />;
}

// <ScreeningTagMarks> — a bare mark after the time on a pill / plan row for each surfaced
// special-screening descriptor (Parent & Baby, Cinema Book Club, …). No text: the slot is the
// same every week, so once you've seen the name on the card sticker you recognise the mark on
// its own. The hover tooltip lives on the whole pill/row button (see FilmCard / DayPlan, via
// `screeningTagsTooltip`), not on the mark. The card-side sticker that names these lives in
// components/FilmNotes.tsx (it's now merged with the curated editorial label).

export function ScreeningTagMarks({ tags }: { tags?: string[] }) {
  // `mark: false` tags (Mystery Matinee) still count as specials elsewhere but render no mark.
  const display = displayScreeningTags(tags).filter((t) => t.mark !== false);
  if (display.length === 0) return null;
  return (
    <>
      {display.map((t) => (
        <span key={t.label} className="leading-none">
          <SpecialsMark className="size-[1.1em] align-[-0.16em]" />
          <span className="sr-only">{t.title} screening</span>
        </span>
      ))}
    </>
  );
}
