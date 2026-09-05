import { Star } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CINEMA_WEEKEND_NAME, cinemaWeekendLabel } from "@/lib/cinemaWeekend";
import { cn } from "@/lib/utils";

// The campaign's mark, shared by the banner below and the day picker's `DayMark`, so the star you
// see on a day chip is the same one heading the note that sent you there (CLAUDE.md decision #19).
// Lives here rather than in `lib/cinemaWeekend.ts` so that module stays pure TS — the pair is
// still deletable together when the weekend passes.
//
// Ink, never accent: it has to stay legible on the accent fill a selected day segment carries
// (decision #7). Filled rather than lucide's default outline, so it reads as the solid ★ it
// replaces at day-chip size. Always decorative — the day picker carries the name in an `sr-only`
// span, the banner in its own heading.
export function CinemaWeekendMark({ className }: { className?: string }) {
  return <Star aria-hidden="true" className={cn("fill-current", className)} />;
}

// The National Cinema Weekend note over the film list (decision #19) — an `Alert`, the same shell
// as the "Next week (maybe)" banner and the two empty states, since they're all the same kind of
// thing: a word about the view you're in, not a film.
//
// `role="note"`, not the Alert's default assertive live region: this is standing page furniture,
// so it shouldn't interrupt when a day change brings it into view. `days` is what makes it
// self-expiring — the caller passes the campaign days the current view still covers, and an empty
// list renders nothing.
export default function CinemaWeekendBanner({ days }: { days: string[] }) {
  if (days.length === 0) return null;

  return (
    <Alert role="note">
      <CinemaWeekendMark />
      <AlertTitle>It&rsquo;s {CINEMA_WEEKEND_NAME}!</AlertTitle>
      <AlertDescription>
        <p>
          On {cinemaWeekendLabel(days)} all three cinemas have tickets from €4. Expect screenings
          to sell out faster than usual!
        </p>
      </AlertDescription>
    </Alert>
  );
}
