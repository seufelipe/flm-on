import { Fragment } from "react";
import { type ItineraryTransition, type TimedScreening } from "@/lib/clash";
import { CINEMA_LABEL } from "@/lib/cinemas";
import { formatDayFriendly } from "@/lib/date";

interface Props {
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  onRemove: (s: TimedScreening) => void;
  onClear: () => void;
  keyOf: (s: TimedScreening) => string;
}

function transitionLabel(t: ItineraryTransition): string {
  if (t.overlap) return `Overlaps ${Math.abs(t.gapMins)}min`;
  if (t.tooTight) return `Only ${t.gapMins}min`;
  return `${t.gapMins}min`;
}

// Rough door-to-door span of the plan: first film's start to last film's end, i.e. every
// screening's runtime plus the gaps between them. Rounded to 5 min and shown with a ~ prefix.
function formatSpan(mins: number): string {
  const rounded = Math.round(mins / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function DayPlan({ items, transitions, onRemove, onClear, keyOf }: Props) {
  // A plan is single-day, so every item shares a date — take the day from the first. Just the
  // day name ("Monday", "Today"), which is the first token formatDayFriendly returns.
  const dayLabel = items.length > 0 ? formatDayFriendly(items[0].date).split(/[,\s]/)[0] : null;
  const spanMins =
    items.length > 0
      ? Math.max(...items.map((s) => s.endMins)) - Math.min(...items.map((s) => s.startMins))
      : 0;
  return (
    <div className="bg-surface border-t-4 border-border">
      <div className="flex items-center justify-center-safe gap-3 overflow-x-auto px-6 py-3">
        <span className="shrink-0 whitespace-nowrap leading-tight">
          <span className="block font-bold">Your plan</span>
          {dayLabel && (
            <span className="block text-xs font-bold uppercase tracking-wide text-dim">for {dayLabel}</span>
          )}
        </span>
        {items.map((s, i) => {
          const transition = i > 0 ? transitions[i - 1] : null;
          const flagged = transition?.overlap || transition?.tooTight;
          return (
            <Fragment key={keyOf(s)}>
              {transition && (
                <>
                  <span aria-hidden="true" className="shrink-0 text-dim">
                    &rarr;
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold uppercase tracking-wide ${
                      flagged ? "text-accent-ink" : "text-dim"
                    }`}
                  >
                    {transitionLabel(transition)}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-dim">
                    &rarr;
                  </span>
                </>
              )}
              <button
                type="button"
                aria-label={`Remove ${s.filmTitle} from your day plan`}
                onClick={() => onRemove(s)}
                className="shrink-0 border-2 border-border rounded-btn bg-surface text-fg px-3 py-1.5 flex items-baseline gap-2 cursor-pointer transition-transform active:translate-x-[2px] active:translate-y-[2px]"
              >
                <span className="font-bold whitespace-nowrap">{s.filmTitle}</span>
                <span className="text-xs uppercase tracking-wide whitespace-nowrap text-dim">
                  {CINEMA_LABEL[s.cinema]} {s.time}
                </span>
              </button>
            </Fragment>
          );
        })}
        <span className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-dim leading-tight">
          <span className="block">
            {items.length} {items.length === 1 ? "film" : "films"}
          </span>
          <span className="block">~{formatSpan(spanMins)}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 border-2 border-border rounded-btn bg-surface text-fg px-3 py-1.5 text-xs font-bold uppercase tracking-wide cursor-pointer whitespace-nowrap shadow-btn-secondary transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
