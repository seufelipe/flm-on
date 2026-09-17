"use client";

import { useState } from "react";
import { ChevronUp } from "lucide-react";
import type { ItineraryTransition, PlanAddition, TimedScreening } from "@/lib/clash";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { useIsCompact } from "@/lib/useIsCompact";
import PlanPanel from "./PlanPanel";

// The mobile plan surface: an ink tab rising out of the top edge of the filter dock, like the lip
// of the sheet it opens, carrying the plan-item count (the sanctioned exception to the "no
// counters" rule — decision #8 — same as DayPlan's "{n} films"). It must be rendered INSIDE the
// dock: it's `absolute bottom-full`, so the dock's padding box is what it stands on, and it covers
// the dock's top border so tab and bar read as one piece. Ink, not gold — it sits on every screen,
// and gold there was the loudest thing on the page. With an empty plan it shows
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
      className="no-print absolute bottom-full left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-t-card bg-fg text-bg pl-4 pr-5 pt-2 pb-1.5 font-black uppercase text-sm tracking-wide cursor-pointer"
    >
      <ChevronUp aria-hidden="true" className="size-4" strokeWidth={3} />
      Plan
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bg px-1 text-xs text-fg tabular-nums">
          {count}
        </span>
      )}
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
