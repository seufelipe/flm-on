import { Fragment } from "react";
import { type ItineraryTransition, type TimedScreening } from "@/lib/clash";
import { CINEMA_LABEL } from "@/lib/cinemas";

interface Props {
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  onRemove: (s: TimedScreening) => void;
  keyOf: (s: TimedScreening) => string;
}

function transitionLabel(t: ItineraryTransition): string {
  if (t.overlap) return `Overlaps ${Math.abs(t.gapMins)}min`;
  if (t.tooTight) return `Only ${t.gapMins}min`;
  return `${t.gapMins}min`;
}

export default function DayPlan({ items, transitions, onRemove, keyOf }: Props) {
  return (
    <div className="bg-surface border-t-4 border-border">
      <div className="flex items-center justify-center-safe gap-3 overflow-x-auto px-6 py-3">
        <span className="shrink-0 font-bold whitespace-nowrap">Your plan</span>
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
      </div>
    </div>
  );
}
