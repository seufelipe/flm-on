"use client";

import type { ItineraryTransition, PlanAddition, TimedScreening } from "@/lib/clash";
import DayPlan from "./DayPlan";
import { GhostRow } from "./PlanRow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
// Import can add and update but never delete, so a film taken back out of the plan stays in the
// calendar until it's removed there (CLAUDE.md decision #21). Too long for the button's label and
// too surprising to leave unsaid — the first re-import would otherwise read as a bug. "never
// removes them" is carrying that whole asymmetry: spelling out the scenario it applies to cost
// another clause and made this too long to take in on a hover.
const EXPORT_CAVEAT =
  "Saves your plan as a calendar file. Re-exporting updates those events, never removes them.";

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
  // Download the whole plan as one .ics — sits at the foot of the list, not up beside Clear.
  onExport: () => void;
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
  onExport,
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
          <>
            <DayPlan
              items={items}
              transitions={transitions}
              suggestions={suggestions}
              onRemove={onRemove}
              onAdd={onAdd}
              onPickDay={onPickDay}
              keyOf={keyOf}
            />
            {/* At the foot of the plan, after the last film — the header is where you abandon the
                plan, here is where it ends and you take it somewhere. Scrolls with the list rather
                than pinning as a footer bar: you reach it by reaching the end of the plan.
                Primary treatment: the neutral card fill (`bg-surface`) plus the app's hard-press
                language, sized to hug its label rather than spanning the panel. Gold was tried and
                dropped — the accent is reserved for actionable things (decision #7) and this is
                one, but at this size in a rail of ink-on-white rows it read as a warning rather
                than an offer. Clear stays a bare text button: one primary action per surface.
                The mt-6 is doing real work — with no divider it needs the air to clear the shadow
                and the last row. */}
            {/* The export-isn't-sync caveat (decision #21). Radix rather than a native `title`
                — but note this is the one tooltip in the app whose text you can't get from the
                UI any other way, and a tooltip is a hover/focus surface, so on a phone it can
                only be reached via the `aria-label`. That's why the label is spelled out there
                in full rather than left as "Add to calendar". */}
            <div className="no-print mt-6 flex justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onExport}
                    aria-label={`Add to calendar. ${EXPORT_CAVEAT}`}
                    className="border-2 border-border rounded-btn bg-surface text-fg px-4 py-2 font-black uppercase text-sm tracking-wide shadow-chip transition-[translate,box-shadow] duration-100 cursor-pointer hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-chip-half active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
                  >
                    Add to calendar
                  </button>
                </TooltipTrigger>
                <TooltipContent>{EXPORT_CAVEAT}</TooltipContent>
              </Tooltip>
            </div>
          </>
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
