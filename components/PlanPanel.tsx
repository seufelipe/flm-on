"use client";

import type { ItineraryTransition, ScreeningPair, TimedScreening } from "@/lib/clash";
import DayPlan from "./DayPlan";
import { ComboList } from "./ComboSuggestions";

// The one persistent plan surface — what ComboSuggestions + DayPlan used to do between them, in a
// single panel. Flat treatment (no dark header bar): a light label row with a rule under it,
// then the body. Used inside the desktop right-rail card (pinned below the masthead) and inside
// the mobile plan sheet (behind the floating button). See CLAUDE.md decision #5.
//
// No `bg-*` of its own — the caller's card (rail) / dialog (sheet) provides the surface, so the
// panel doesn't square off that card's rounded corners.
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
  onPickDay: (date: string) => void;
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
  onPickDay,
  keyOf,
  className = "",
}: Props) {
  const hasPlan = items.length > 0;
  // Empty state has no title — the card's own masthead already labels the surface.
  const showHeader = hasPlan || onClose != null;

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {showHeader && (
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-3">
          {hasPlan ? (
            <h2 className="font-black uppercase text-lg tracking-tight">Your plan</h2>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-1">
            {hasPlan && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-bold uppercase tracking-wide text-dim underline underline-offset-2 cursor-pointer"
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
      )}

      <div className="min-h-0 grow overflow-y-auto scrollbar-none p-5">
        {hasPlan ? (
          <DayPlan
            items={items}
            transitions={transitions}
            onRemove={onRemove}
            onPickDay={onPickDay}
            keyOf={keyOf}
          />
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
