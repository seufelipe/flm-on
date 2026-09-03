import { Fragment } from "react";
import { type ItineraryTransition, type TimedScreening } from "@/lib/clash";
import { ScreeningTagMarks } from "@/components/ScreeningTags";
import { FilmFormatMarks } from "@/components/FilmFormats";
import { LanguageMarks } from "@/components/ScreeningLanguage";
import { screeningTagsTooltip } from "@/lib/screeningTags";
import { filmFormatsTooltip } from "@/lib/formats";
import { languageTooltip } from "@/lib/languages";
import { CINEMA_LABEL } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate } from "@/lib/date";

interface Props {
  // Chronologically sorted (date then time — the ordinal model in lib/clash.ts), may span days.
  items: TimedScreening[];
  // itineraryTransitions(items) — transitions[i] is the step from items[i] to items[i+1].
  transitions: ItineraryTransition[];
  onRemove: (s: TimedScreening) => void;
  keyOf: (s: TimedScreening) => string;
}

function transitionLabel(t: ItineraryTransition): string {
  if (t.overlap) return `Overlaps ${Math.abs(t.gapMins)}min`;
  if (t.tooTight) return `Only ${t.gapMins}min`;
  return `${t.gapMins}min`;
}

// Rough door-to-door span of a single day in the plan: that day's first start to its last end.
// Rounded to 5 min and shown with a ~ prefix.
function formatSpan(mins: number): string {
  const rounded = Math.round(mins / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// The plan, grouped into a section per day. A plan can now span the whole week (CLAUDE.md
// decision #5); each day gets its own header + span, and the step between two days is drawn as
// the next day's header, not a gap ("Overlaps 840min" would be nonsense). Within a day the
// transitions between consecutive screenings show as before, flagged when they overlap / are too
// tight to make.
export default function DayPlan({ items, transitions, onRemove, keyOf }: Props) {
  const groups: { date: string; rows: { s: TimedScreening; transition: ItineraryTransition | null }[] }[] = [];
  items.forEach((s, idx) => {
    const transition = idx > 0 ? transitions[idx - 1] : null;
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.rows.push({ s, transition });
    else groups.push({ date: s.date, rows: [{ s, transition }] });
  });

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const spanMins =
          Math.max(...group.rows.map((r) => r.s.endMins)) -
          Math.min(...group.rows.map((r) => r.s.startMins));
        return (
          <div key={group.date} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 border-b-2 border-border pb-1">
              <span className="font-black uppercase text-sm tracking-tight">
                {formatDayFriendly(group.date)}
                <span className="ml-1.5 font-bold text-dim">{formatDayDate(group.date)}</span>
              </span>
              <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-dim">
                {group.rows.length} {group.rows.length === 1 ? "film" : "films"} · ~{formatSpan(spanMins)}
              </span>
            </div>
            {group.rows.map(({ s, transition }, i) => (
              <Fragment key={keyOf(s)}>
                {i > 0 && transition && !transition.crossDay && (
                  <div
                    className={`flex items-center gap-1.5 pl-1 text-xs font-bold uppercase tracking-wide ${
                      transition.overlap || transition.tooTight ? "text-accent-ink" : "text-dim"
                    }`}
                  >
                    <span aria-hidden="true">&darr;</span>
                    {transitionLabel(transition)}
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${s.filmTitle} from your plan`}
                  title={
                    [
                      screeningTagsTooltip(s.screeningTags),
                      filmFormatsTooltip(s.screeningTags),
                      languageTooltip(s.screeningTags),
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  onClick={() => onRemove(s)}
                  className="border-2 border-border rounded-btn bg-surface text-fg px-3 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-left cursor-pointer transition-transform active:translate-x-[2px] active:translate-y-[2px]"
                >
                  <span className="font-bold">{s.filmTitle}</span>
                  <span className="text-xs uppercase tracking-wide whitespace-nowrap text-dim">
                    {CINEMA_LABEL[s.cinema]} {s.time}
                  </span>
                  <ScreeningTagMarks tags={s.screeningTags} />
                  <FilmFormatMarks tags={s.screeningTags} />
                  <LanguageMarks tags={s.screeningTags} />
                  <span aria-hidden="true" className="ml-auto shrink-0 self-center text-dim">
                    &times;
                  </span>
                </button>
              </Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
