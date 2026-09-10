// A cinema's marathon booking: one ticket, several films back to back. Light House lists it as a
// single session, so it arrives as one "film" whose year and runtime describe the whole sitting
// rather than any one film — the card drops both (components/FilmCard.tsx) while the plan keeps
// the runtime for its gap maths, exactly as the Mystery Matinee does (lib/mystery.ts, CLAUDE.md
// #12). Not a scraped descriptor: ScreeningBrowser attaches the tag off this check.
export function isMarathonFilm(title: string): boolean {
  return /\bmarathon\b/i.test(title.trim());
}
