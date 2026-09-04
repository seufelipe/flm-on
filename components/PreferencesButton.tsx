"use client";

import { useState, useSyncExternalStore } from "react";
import {
  preferencesSnapshot,
  PREFERENCES_SERVER_SNAPSHOT,
  subscribePreferences,
  writePreferences,
} from "@/lib/preferences";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import SettingsPanel from "./SettingsPanel";

// "Preference"-style sliders glyph (three horizontal tracks, knobs at different positions) —
// the filters/preferences convention, distinct from a gear.
function PreferenceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="13" y2="6" />
      <line x1="19" y1="6" x2="21" y2="6" />
      <circle cx="16" cy="6" r="2.5" />
      <line x1="3" y1="12" x2="6" y2="12" />
      <line x1="12" y1="12" x2="21" y2="12" />
      <circle cx="9" cy="12" r="2.5" />
      <line x1="3" y1="18" x2="10" y2="18" />
      <line x1="16" y1="18" x2="21" y2="18" />
      <circle cx="13" cy="18" r="2.5" />
    </svg>
  );
}

// The preferences entry point — a header button that opens the settings modal / sheet. Shares
// the localStorage-backed store with ScreeningBrowser (both subscribe independently), so no
// prop drilling. Escape / scroll-lock / focus-trap / focus-restore are Radix's now (decision
// #22) — this used to run an effect for the first two and simply didn't do the last two. Active kids-only / language prefs are surfaced by <ActivePreferenceNote> beside
// the title, not here. See CLAUDE.md #14.
// `className` sets the button's shell (layout + border + bg); the hard-press behaviour and the
// `open` pressed-in state are always appended. Default is the compact icon chip used in the
// masthead; the desktop filter bar passes its own so this lines up with the menu triggers.
export default function PreferencesButton({ className }: { className?: string }) {
  const { prefs } = useSyncExternalStore(
    subscribePreferences,
    preferencesSnapshot,
    () => PREFERENCES_SERVER_SNAPSHOT,
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Preferences"
          className={`${
            className ?? "no-print shrink-0 border-2 border-border rounded-btn bg-surface text-fg p-2"
          } transition-[translate,box-shadow] duration-100 cursor-pointer ${
            open
              ? "translate-x-[6px] translate-y-[6px]"
              : "shadow-chip hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-chip-half active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          }`}
        >
          <PreferenceIcon />
        </button>
      </DialogTrigger>
      <SettingsPanel prefs={prefs} onChange={writePreferences} onClose={() => setOpen(false)} />
    </Dialog>
  );
}
