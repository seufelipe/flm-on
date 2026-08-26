import { minutesToTime, type ItineraryTransition, type TimedScreening } from "@/lib/clash";
import { CINEMA_LABEL } from "@/lib/cinemas";

interface Props {
  heading: string;
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  onRemove: (s: TimedScreening) => void;
  keyOf: (s: TimedScreening) => string;
}

function transitionLabel(t: ItineraryTransition): string {
  if (t.overlap) return `Overlaps by ${Math.abs(t.gapMins)}min`;
  if (t.tooTight) return `Only ${t.gapMins}min — too tight`;
  return `${t.gapMins}min gap`;
}

export default function DayPlan({ heading, items, transitions, onRemove, keyOf }: Props) {
  return (
    <div className="bg-surface border-4 border-border rounded-card shadow-card overflow-hidden mb-8">
      <h2 className="font-black uppercase text-lg p-6 bg-fg text-surface">{heading}</h2>
      <div className="p-6">
        {items.map((s, i) => {
          const transition = i > 0 ? transitions[i - 1] : null;
          const flagged = transition?.overlap || transition?.tooTight;
          return (
            <div key={keyOf(s)}>
              {transition && (
                <div
                  className={`border-l-2 pl-6 py-2 text-xs font-bold uppercase tracking-wide ${
                    flagged ? "border-accent-ink text-accent-ink" : "border-border text-dim"
                  }`}
                >
                  {transitionLabel(transition)}
                </div>
              )}
              <div className="border-l-2 border-border pl-6 py-4 flex items-start justify-between gap-6">
                <div>
                  <div className="font-bold">{s.filmTitle}</div>
                  <div className="text-xs uppercase text-dim">
                    {CINEMA_LABEL[s.cinema]} · {s.time}–{minutesToTime(s.endMins)} · {s.endMins - s.startMins}min
                    {s.durationEstimated ? " (est.)" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${s.filmTitle} from your day plan`}
                  onClick={() => onRemove(s)}
                  className="shrink-0 border-4 border-border rounded-btn bg-surface shadow-btn-secondary w-8 h-8 flex items-center justify-center font-bold cursor-pointer transition-transform hover:bg-fg hover:text-surface active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
