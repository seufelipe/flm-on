import { Baby, Coffee, FaceGrinning, MicVocal, type LucideIcon } from "lucide-react";

import { displayScreeningTags } from "@/lib/screeningTags";
import { cn } from "@/lib/utils";

// The generic specials mark: the "Specials, etc" lens that filters on *all* the strands
// (components/FilterControls.tsx), and the fallback for any strand with no mark of its own.
// Same shape as <CinemaWeekendMark>, and for the same reason.
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

// Per-strand marks, keyed by a KNOWN entry's `label`. Keyed here rather than in
// lib/screeningTags.ts so that module stays data-only and free of React — which is also the
// older argument for a single mark: *which* glyph a strand wears is a rendering decision.
// `relaxed` and `autism friendly` share a label, so they share a mark for free.
//
// A strand earns its own icon when the icon says something the smiley can't: a Baby and a Coffee
// tell you at a glance which of two marked pills is the 11am buggy screening and which is the
// over-65s matinee. Anything without one falls back to <SpecialsMark>, so adding a mark is one
// line and never a requirement.
const STRAND_MARKS: Record<string, LucideIcon> = {
  "parent & baby": Baby,
  "silver screen": Coffee,
  "q&a": MicVocal,
};

// One strand's mark — its own icon if it has one, the generic smiley otherwise.
export function StrandMark({ label, className }: { label: string; className?: string }) {
  const Icon = STRAND_MARKS[label] ?? FaceGrinning;
  return <Icon aria-hidden="true" className={cn("inline-block", className)} />;
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
          <StrandMark label={t.label} className="size-[1.1em] align-[-0.16em]" />
          <span className="sr-only">{t.title} screening</span>
        </span>
      ))}
    </>
  );
}
