import type { ScreeningPair, TimedScreening } from "@/lib/clash";
import { CINEMA_LABEL } from "@/lib/cinemas";

interface Props {
  combos: ScreeningPair[];
  keyOf: (s: TimedScreening) => string;
  onSelect: (s: TimedScreening) => void;
}

export default function ComboSuggestions({ combos, keyOf, onSelect }: Props) {
  return (
    <div className="bg-surface border-4 border-border rounded-card shadow-card-lg overflow-hidden mb-8">
      <h2 className="font-black uppercase text-lg p-6 bg-fg text-surface">Suggested plans</h2>
      <ul className="flex flex-col gap-4 p-6">
        {combos.map((combo) => {
          function selectBoth() {
            onSelect(combo.a);
            onSelect(combo.b);
          }
          return (
            <li
              key={keyOf(combo.a) + keyOf(combo.b)}
              role="button"
              tabIndex={0}
              onClick={selectBoth}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectBoth();
                }
              }}
              className="border-4 border-border rounded-btn bg-surface shadow-btn-secondary p-6 flex flex-wrap items-center gap-x-3 gap-y-2 cursor-pointer transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <span className="border-2 border-border rounded-btn bg-surface px-3 py-1.5 flex items-baseline gap-2">
                <span className="font-bold">{combo.a.filmTitle}</span>
                <span className="text-xs uppercase text-dim">
                  {CINEMA_LABEL[combo.a.cinema]} {combo.a.time}
                </span>
              </span>
              <span aria-hidden="true" className="text-dim">
                &rarr;
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-dim">{combo.gapMins}min</span>
              <span aria-hidden="true" className="text-dim">
                &rarr;
              </span>
              <span className="border-2 border-border rounded-btn bg-surface px-3 py-1.5 flex items-baseline gap-2">
                <span className="font-bold">{combo.b.filmTitle}</span>
                <span className="text-xs uppercase text-dim">
                  {CINEMA_LABEL[combo.b.cinema]} {combo.b.time}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
