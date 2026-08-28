// The IFI's recurring "Mystery Matinee" strand: the film isn't announced until the lights go
// down. Its card treats that as the point — the year and duration are hidden (they'd narrow the
// guess) and the title is redacted behind click-to-reveal blocks (components/MysteryTitle.tsx).
// Matched on the cleaned title: data/title-overrides.json strips the trailing month/year so the
// listing collapses to a bare "Mystery Matinee", but the check tolerates the un-stripped form too.
export function isMysteryFilm(title: string): boolean {
  return /^mystery matinee\b/i.test(title.trim());
}
