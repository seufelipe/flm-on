"use client";

import type { ItineraryTransition, PlanAddition, TimedScreening } from "@/lib/clash";
import DayPlan from "./DayPlan";
import { GhostRow } from "./PlanRow";

// The one persistent plan surface. Flat treatment (no dark header bar): a light label row with a
// rule under it, then the body. Used inside the desktop right-rail card (pinned below the
// masthead) and inside the mobile plan sheet (behind the floating button). Empty, it offers a few
// starting points (one per timeframe, specials first — lib/startingPoints.ts) as bare ghost rows
// with no heading over them — dashed rows on an otherwise empty panel already read as an offer —
// falling back to a plain prompt when there's nothing to seed from. Once the plan has something
// in it the ghosts move inside <DayPlan>, at the slot each would take. See CLAUDE.md decision #5.
//
// No `bg-*` of its own — the caller's card (rail) / dialog (sheet) provides the surface, so the
// panel doesn't square off that card's rounded corners.
interface Props {
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  // One "choose this next" suggestion per open slot in the plan; DayPlan draws them in place.
  suggestions: PlanAddition[];
  // Empty-plan seeds: one screening per timeframe (lib/startingPoints.ts), drawn as bare ghosts.
  // `startingPointsShowDay` is on when they're pulled from the whole week rather than one pinned
  // day, so each row names its own day.
  startingPoints: TimedScreening[];
  startingPointsShowDay: boolean;
  onAdd: (s: TimedScreening) => void;
  onRemove: (s: TimedScreening) => void;
  onClear: () => void;
  onClose?: () => void;
  onPickDay: (date: string) => void;
  keyOf: (s: TimedScreening) => string;
  className?: string;
}

export default function PlanPanel({
  items,
  transitions,
  suggestions,
  startingPoints,
  startingPointsShowDay,
  onAdd,
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
            suggestions={suggestions}
            onRemove={onRemove}
            onAdd={onAdd}
            onPickDay={onPickDay}
            keyOf={keyOf}
          />
        ) : startingPoints.length > 0 ? (
          <div className="flex flex-col gap-2">
            {startingPoints.map((s) => (
              <GhostRow key={keyOf(s)} s={s} onAdd={onAdd} showDay={startingPointsShowDay} />
            ))}
          </div>
        ) : (
          <p className="text-dim">Tap a showtime to start a plan.</p>
        )}
      </div>
    </div>
  );
}
