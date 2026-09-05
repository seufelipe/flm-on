"use client";

import { useState, useSyncExternalStore } from "react";
import {
  preferencesSnapshot,
  PREFERENCES_SERVER_SNAPSHOT,
  subscribePreferences,
  writePreferences,
} from "@/lib/preferences";
import { Settings2 } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { useIsCompact } from "@/lib/useIsCompact";
import SettingsPanel from "./SettingsPanel";

// The glyph is Lucide's `Settings2` — despite the name it draws sliders (two tracks with circular
// knobs), NOT a gear, so decision #14's "sliders, not a gear" still holds. It replaced a
// hand-rolled three-track version; the trade was one fewer track for keeping the round knobs.
// Lucide's defaults are already this app's: 24 viewBox, 2px stroke, round caps (decision #23).

// The preferences entry point — a header button that opens the settings modal / sheet. Shares
// the localStorage-backed store with ScreeningBrowser (both subscribe independently), so no
// prop drilling. Escape / scroll-lock / focus-trap / focus-restore are Radix's now (decision
// #22) — this used to run an effect for the first two and simply didn't do the last two.
// Below `sm:` the panel opens as a vaul drawer instead of a centred modal (decision #24); this
// component owns that decision and hands it to SettingsPanel so the two halves cannot disagree. Active kids-only / language prefs are surfaced by <ActivePreferenceNote> beside
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
  const compact = useIsCompact();

  const trigger = (
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
      <Settings2 aria-hidden="true" className="h-5 w-5" />
    </button>
  );

  const panel = (
    <SettingsPanel
      prefs={prefs}
      onChange={writePreferences}
      onClose={() => setOpen(false)}
      compact={compact}
    />
  );

  if (compact) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        {panel}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {panel}
    </Dialog>
  );
}
