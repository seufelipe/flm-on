import type { TimedScreening } from "@/lib/clash";
import { ScreeningTagMarks } from "@/components/ScreeningTags";
import { FilmFormatMarks } from "@/components/FilmFormats";
import { LanguageMarks } from "@/components/ScreeningLanguage";
import { screeningTagsTooltip } from "@/lib/screeningTags";
import { filmFormatsTooltip } from "@/lib/formats";
import { languageTooltip } from "@/lib/languages";
import { CINEMA_LABEL } from "@/lib/cinemas";
import { formatDayFriendly } from "@/lib/date";

// The two row treatments the plan surfaces are built from — a picked screening and a suggested
// one. Shared by <DayPlan> (the plan itself, with its ghosts in slot position) and <PlanPanel>'s
// empty state (starting points, no plan to slot into yet).
//
// Neither carries an affordance glyph (there used to be a leading + on a ghost and a trailing ×
// on a plan row): the whole row is the target, dashed-vs-solid already says which way a click
// goes, and the aria-label carries it for anyone who can't see that. User's call.

function tooltipFor(s: TimedScreening): string | undefined {
  return (
    [screeningTagsTooltip(s.screeningTags), filmFormatsTooltip(s.screeningTags), languageTooltip(s.screeningTags)]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}

const ROW_BASE =
  "rounded-btn px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-left cursor-pointer transition-transform active:translate-x-[2px] active:translate-y-[2px]";

function Marks({ s }: { s: TimedScreening }) {
  return (
    <>
      <ScreeningTagMarks tags={s.screeningTags} />
      <FilmFormatMarks tags={s.screeningTags} />
      <LanguageMarks tags={s.screeningTags} />
    </>
  );
}

// A picked screening. Clicking it takes it back out of the plan.
export function PlanRow({ s, onRemove }: { s: TimedScreening; onRemove: (s: TimedScreening) => void }) {
  return (
    <button
      type="button"
      aria-label={`Remove ${s.filmTitle} from your plan`}
      title={tooltipFor(s)}
      onClick={() => onRemove(s)}
      className={`border-2 border-border bg-surface text-fg ${ROW_BASE}`}
    >
      <span className="font-bold">{s.filmTitle}</span>
      <span className="text-xs uppercase tracking-wide whitespace-nowrap text-dim">
        {CINEMA_LABEL[s.cinema]} {s.time}
      </span>
      <Marks s={s} />
    </button>
  );
}

// "Choose this next" — a proposal, not a pick: dashed and dim, with no fill and no resting
// elevation, so it reads as an outline of a row rather than one. Deliberately not the accent —
// that's reserved for what you've actually selected (CLAUDE.md decision #7). Clicking it makes it
// a real PlanRow; clicking that takes it out again and the ghost comes back.
//
// `showDay` names the day on the row. Off inside the plan (the day header above already says it)
// and for starting points on a pinned day; on when the starting points are drawn from the whole
// week, where each one can be a different day.
export function GhostRow({
  s,
  onAdd,
  showDay = false,
}: {
  s: TimedScreening;
  onAdd: (s: TimedScreening) => void;
  showDay?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Add ${s.filmTitle}${showDay ? ` on ${formatDayFriendly(s.date)}` : ""} at ${s.time} to your plan`}
      title={tooltipFor(s)}
      onClick={() => onAdd(s)}
      className={`border-2 border-dashed border-dim text-dim hover:border-border hover:text-fg ${ROW_BASE}`}
    >
      <span className="font-bold">{s.filmTitle}</span>
      <span className="text-xs uppercase tracking-wide whitespace-nowrap">
        {showDay && `${formatDayFriendly(s.date)} · `}
        {CINEMA_LABEL[s.cinema]} {s.time}
      </span>
      <Marks s={s} />
    </button>
  );
}
