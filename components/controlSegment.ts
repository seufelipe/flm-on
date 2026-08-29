// Shared styling for a "segment" — the filter-bar controls (ScreeningBrowser's ControlGroup)
// and the settings toggles (SettingsPanel). Same accent-fill + hard-press "selected" language
// across both, so a toggle reads as the same kind of thing as a filter.
//
// The active segment drops its shadow entirely and translates by the shadow's full 6px reach,
// landing exactly where its shadow edge was; an inactive one carries the two-tone stacked
// --shadow-chip and gets a half-press on hover.

export const SEGMENT_BASE =
  "relative shrink-0 border-2 px-3 py-1 flex flex-col items-start gap-0.5 transition-[translate,box-shadow] duration-100";

export function controlSegmentClass(active: boolean): string {
  if (active) {
    return "border-border bg-accent text-fg translate-x-[6px] translate-y-[6px]";
  }
  return "border-border bg-surface text-fg shadow-chip hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-chip-half active:translate-x-[6px] active:translate-y-[6px] active:shadow-none";
}
