"use client";

import { useEffect, useState } from "react";
import type { ItineraryTransition, PlanAddition, TimedScreening } from "@/lib/clash";
import PlanPanel from "./PlanPanel";

// The mobile plan surface: a floating button carrying the plan-item count (the sanctioned
// exception to the "no counters" rule — decision #8 — same as DayPlan's "{n} films"), opening
// the plan in a bottom sheet. Sits above the fixed filter dock. Hidden entirely until the plan
// has something in it. Sheet chrome / scroll-lock / Escape are cloned from
// PreferencesButton + SettingsPanel. See CLAUDE.md decision #5.
interface Props {
  count: number;
  items: TimedScreening[];
  transitions: ItineraryTransition[];
  suggestions: PlanAddition[];
  onAdd: (s: TimedScreening) => void;
  onRemove: (s: TimedScreening) => void;
  onClear: () => void;
  onPickDay: (date: string) => void;
  keyOf: (s: TimedScreening) => string;
}

export default function PlanButton({ count, items, transitions, suggestions, onAdd, onRemove, onClear, onPickDay, keyOf }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nothing planned — the filter dock stands alone.
  if (count === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Your plan — ${count} ${count === 1 ? "film" : "films"}`}
        className={`no-print fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-4 border-border rounded-full bg-accent text-fg pl-3 pr-5 py-2.5 font-black uppercase text-sm tracking-wide transition-[translate,box-shadow] duration-100 cursor-pointer ${
          open
            ? "translate-x-[6px] translate-y-[6px]"
            : "shadow-card-lg hover:translate-x-[3px] hover:translate-y-[3px] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
        }`}
      >
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-fg px-1 text-xs text-bg tabular-nums">
          {count}
        </span>
        Plan
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4 sm:pb-4">
          <button
            type="button"
            aria-label="Close plan"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-fg/35 cursor-default"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your plan"
            className="relative flex w-full max-h-full sm:max-w-md border-4 border-border bg-surface rounded-card shadow-card-lg overflow-hidden"
          >
            <PlanPanel
              className="max-h-full w-full"
              items={items}
              transitions={transitions}
              suggestions={suggestions}
              onAdd={onAdd}
              onRemove={onRemove}
              onClear={onClear}
              onClose={() => setOpen(false)}
              onPickDay={(date) => {
                onPickDay(date);
                setOpen(false);
              }}
              keyOf={keyOf}
            />
          </div>
        </div>
      )}
    </>
  );
}
