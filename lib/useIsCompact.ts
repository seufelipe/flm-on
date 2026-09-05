"use client";

import { useSyncExternalStore } from "react";

// The single source of truth for the drawer/modal boundary. 640px is Tailwind's `sm`, which is
// already the line DialogContent switches on (bottom sheet below it, centred modal above), so the
// app keeps one mental model for "phone-shaped" rather than acquiring a second breakpoint.
//
// useSyncExternalStore, matching lib/preferences.ts and lib/plan.ts: the server snapshot and the
// first client render agree, so hydration is clean, and React re-renders with the real value
// straight after. It resolves "not compact" on the server, so a phone hydrates as a modal for one
// frame — invisible in practice, since neither overlay is ever open on first paint.
const COMPACT_QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(COMPACT_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(COMPACT_QUERY).matches;
const getServerSnapshot = () => false;

export function useIsCompact() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
