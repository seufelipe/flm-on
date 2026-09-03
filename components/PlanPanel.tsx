"use client";

import type { ItineraryTransition, ScreeningPair, TimedScreening } from "@/lib/clash";
import DayPlan from "./DayPlan";
import { ComboList } from "./ComboSuggestions";

// The one persistent plan surface — what ComboSuggestions + DayPlan used to do between them, in a
// single card. Lives in the desktop right rail (sticky) and inside the mobile plan sheet
// (behind the floating button). See CLAUDE.md decision #5.
//
// Bounded height + internal scroll is set by the caller via `className` (`lg:max-h-…` in the
// rail, `grow min-h-0` in the sheet); this component just keeps its dark title bar pinned while
// the body scrolls.
interface Props {
  combos: ScreeningPair[];
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  // The pinned day the double-bill suggestions are scoped to, or null ("This week") — suggestions
  // only make sense for one day. The plan itself may span the week.
  suggestionDay: string | null;
  onSelect: (s: TimedScreening) => void;
  onRemove: (s: TimedScreening) => void;
  onClear: () => void;
  onClose?: () => void;
  keyOf: (s: TimedScreening) => string;
  className?: string;
}

export default function PlanPanel({
  combos,
  items,
  transitions,
  suggestionDay,
  onSelect,
  onRemove,
  onClear,
  onClose,
  keyOf,
  className = "",
}: Props) {
  const hasPlan = items.length > 0;
  const spansWeek = new Set(items.map((s) => s.date)).size > 1;
  const title = !hasPlan ? "Make a plan" : spansWeek ? "Your week" : "Your plan";

  return (
    <div
      className={`flex flex-col overflow-hidden border-4 border-border bg-surface shadow-card-lg rounded-card ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 bg-fg text-surface px-5 py-3.5">
        <h2 className="font-black uppercase text-lg tracking-tight">{title}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {hasPlan && (
            <button
              type="button"
              onClick={onClear}
              className="border-2 border-surface rounded-btn px-2.5 py-1 text-xs font-bold uppercase tracking-wide cursor-pointer transition-transform active:translate-x-[2px] active:translate-y-[2px]"
            >
              Clear
            </button>
          )}
          {onClose && (
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label="Close plan"
              className="-mr-1 p-1 text-2xl leading-none cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 grow overflow-y-auto scrollbar-none p-5">
        {hasPlan ? (
          <DayPlan items={items} transitions={transitions} onRemove={onRemove} keyOf={keyOf} />
        ) : suggestionDay && combos.length > 0 ? (
          <>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-dim">Suggested double bills</p>
            <ComboList combos={combos} onSelect={onSelect} keyOf={keyOf} />
          </>
        ) : (
          <p className="text-dim">
            Tap a showtime to start a plan
            {suggestionDay ? "." : ", or pick a day for suggested double bills."}
          </p>
        )}
      </div>
    </div>
  );
}
