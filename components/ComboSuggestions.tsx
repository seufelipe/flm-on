import type { ScreeningPair, TimedScreening } from "@/lib/clash";
import { CINEMA_LABEL } from "@/lib/cinemas";

interface Props {
  combos: ScreeningPair[];
  keyOf: (s: TimedScreening) => string;
  onSelect: (s: TimedScreening) => void;
}

export default function ComboSuggestions({ combos, keyOf, onSelect }: Props) {
  return (
    <div className="bg-surface border-4 border-border rounded-card shadow-card overflow-hidden mb-8">
      <h2 className="font-black uppercase text-lg p-6 bg-fg text-surface">Suggested plans</h2>
      <ul className="flex flex-col gap-4 p-6">
        {combos.map((combo) => (
          <li
            key={keyOf(combo.a) + keyOf(combo.b)}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(combo.a)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(combo.a);
              }
            }}
            className="border-4 border-border rounded-btn bg-surface shadow-btn-secondary p-6 flex flex-wrap items-center gap-x-6 gap-y-2 cursor-pointer transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            <span className="font-bold">{combo.a.filmTitle}</span>
            <span className="text-xs uppercase text-dim">
              {CINEMA_LABEL[combo.a.cinema]} {combo.a.time}
            </span>
            <span aria-hidden="true">&rarr;</span>
            <span className="font-bold">{combo.b.filmTitle}</span>
            <span className="text-xs uppercase text-dim">
              {CINEMA_LABEL[combo.b.cinema]} {combo.b.time}
            </span>
            <span className="ml-auto text-xs font-bold">{combo.gapMins}min gap</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
