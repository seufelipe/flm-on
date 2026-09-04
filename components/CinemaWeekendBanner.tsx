import { CINEMA_WEEKEND_MARK, CINEMA_WEEKEND_NAME, cinemaWeekendLabel } from "@/lib/cinemaWeekend";

// The National Cinema Weekend note over the film list (CLAUDE.md decision #19) — same card shell
// as the "Next week (maybe)" banner, since it's the same kind of thing: a word about the view
// you're in, not a film.
//
// Plain ink on surface, no accent fill: the accent is for actionable things and the one kids-only
// status sticker (decision #7), and this is neither. `days` is what makes it self-expiring — the
// caller passes the campaign days the current view still covers, and an empty list renders
// nothing.
//
// The ★ leads the heading, matching the day picker's marks.
export default function CinemaWeekendBanner({ days }: { days: string[] }) {
  if (days.length === 0) return null;

  return (
    <div className="bg-surface border-4 border-border rounded-card shadow-card p-4 sm:p-8">
      <p className="text-xl font-black uppercase tracking-tight">
        <span aria-hidden="true" className="mr-2 [font-variant-emoji:text]">
          {CINEMA_WEEKEND_MARK}
        </span>
        It&rsquo;s {CINEMA_WEEKEND_NAME}!
      </p>
      <p className="mt-2 text-dim">
        {cinemaWeekendLabel(days)} — tickets from €4 at all three cinemas here. Expect screenings
        to sell out faster than usual.
      </p>
    </div>
  );
}
