"use client";

import { useState } from "react";
import type { ItineraryTransition, PlanAddition, TimedScreening } from "@/lib/clash";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsCompact } from "@/lib/useIsCompact";
import PlanPanel from "./PlanPanel";

// The mobile plan surface: a floating button carrying the plan-item count (the sanctioned
// exception to the "no counters" rule — decision #8 — same as DayPlan's "{n} films"), opening
// the plan in a bottom sheet. Sits above the fixed filter dock. With an empty plan it shows
// unbadged whenever there are starting points to offer (the sheet is mobile's only route to
// them), and hides entirely when there's nothing to plan with either. The sheet is the shared
// <DialogContent> — the same one SettingsPanel uses — so Escape, scroll-lock, the backdrop press,
// the focus trap and focus restore all come from Radix (decision #22). See decision #5.
interface Props {
  count: number;
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  suggestions: PlanAddition[];
  startingPoints: TimedScreening[];
  startingPointsShowDay: boolean;
  onAdd: (s: TimedScreening) => void;
  onRemove: (s: TimedScreening) => void;
  onClear: () => void;
  onExport: () => void;
  onPickDay: (date: string) => void;
  keyOf: (s: TimedScreening) => string;
}

export default function PlanButton({ count, items, transitions, suggestions, startingPoints, startingPointsShowDay, onAdd, onRemove, onClear, onExport, onPickDay, keyOf }: Props) {
  const [open, setOpen] = useState(false);
  const compact = useIsCompact();

  // Nothing planned and nothing to suggest — the filter dock stands alone. With starting points
  // available the button still shows (that's the only mobile way into them), just with no badge:
  // the badge counts your plan, and a "0" would be a counter for its own sake (decision #8).
  if (count === 0 && startingPoints.length === 0 && !open) return null;

  const triggerButton = (
    <button
      type="button"
      aria-label={count > 0 ? `Your plan — ${count} ${count === 1 ? "film" : "films"}` : "Start a plan"}
      className={`no-print fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-4 border-border rounded-full bg-accent text-fg pl-3 pr-5 py-2.5 font-black uppercase text-sm tracking-wide transition-[translate,box-shadow] duration-100 cursor-pointer ${
        open
          ? "translate-x-[6px] translate-y-[6px]"
          : "shadow-card-lg hover:translate-x-[3px] hover:translate-y-[3px] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
      }`}
    >
      {count > 0 && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-fg px-1 text-xs text-bg tabular-nums">
          {count}
        </span>
      )}
      Plan
    </button>
  );

  const panel = (
        <PlanPanel
          className="max-h-full w-full"
          items={items}
          transitions={transitions}
          suggestions={suggestions}
          startingPoints={startingPoints}
          startingPointsShowDay={startingPointsShowDay}
          onAdd={onAdd}
          onRemove={onRemove}
          onClear={onClear}
          onExport={onExport}
          // Modal only. In the drawer you fling it away or press the scrim, so PlanPanel is given
          // no onClose and renders no × (with a plan it still shows its heading + Clear).
          onClose={compact ? undefined : () => setOpen(false)}
          onPickDay={(date) => {
            onPickDay(date);
            setOpen(false);
          }}
          keyOf={keyOf}
        />
  );

  // PlanPanel draws its own visible "Your plan" heading, but both primitives require a title of
  // their own, so each gets an sr-only one.
  if (compact) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent aria-describedby={undefined}>
          <DrawerTitle className="sr-only">Your plan</DrawerTitle>
          <div className="flex min-h-0 flex-1 overflow-hidden">{panel}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="flex sm:max-w-md overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Your plan</DialogTitle>
        {panel}
      </DialogContent>
    </Dialog>
  );
}
