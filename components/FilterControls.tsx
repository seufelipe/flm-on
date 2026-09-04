"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { CinemaId } from "@/lib/scrapers/types";
import type { UpcomingFilm } from "@/lib/upcoming";
import { formatTimeframeRange, type Timeframe, type TimeframeDef } from "@/lib/timeframe";
import { CINEMA_LABEL, CINEMA_LOCATION } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate } from "@/lib/date";
import { CINEMA_WEEKEND_MARK, CINEMA_WEEKEND_NAME, isCinemaWeekendDay } from "@/lib/cinemaWeekend";
import { SEGMENT_BASE, controlSegmentClass } from "./controlSegment";
import PreferencesButton from "./PreferencesButton";

// Two renders, chosen by `layout`:
//   - "dock"  → the mobile fixed bottom bar: a flush segmented row (ControlGroup) that scrolls
//               sideways on overflow.
//   - "bar"   → the desktop sticky bar at the top of the film column: three dropdown menus
//               (FilterMenu) + the Specials toggle, one compact row at any width. A full week of
//               day chips is far too many flush segments for a bar that isn't pinned to a screen
//               edge — so on desktop each filter collapses to a button showing the current choice.
// See CLAUDE.md decision #7.

// The desktop filter-bar control shell — every button in the `bar` row (the three FilterMenu
// triggers, the Specials toggle, the Preferences button) wears this so they line up at one
// height. `py-1.5` + `text-sm` content ≈ the same box as a 20px icon.
const BAR_CONTROL =
  "relative shrink-0 flex items-center gap-2 border-2 px-3 py-1.5 rounded-[10px] transition-[translate,box-shadow] duration-100 cursor-pointer";

// --- shared: the "Specials, etc" browsing lens ---------------------------------------------------
// A binary toggle, not an "Any X + options" control — so a standalone button, not a ControlGroup.
// Same accent-fill / hard-press language as everything else. Hidden in the "Next week" preview
// (no sessions to lens). `shell` sets the layout/size — BAR_CONTROL on desktop, a flush
// self-stretch two-line box on the mobile dock.
function SpecialsToggle({
  on,
  onToggle,
  shell,
}: {
  on: boolean;
  onToggle: () => void;
  shell: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`${shell} ${controlSegmentClass(on)}`}
    >
      {/* The same flat-ink smiley the special-screening marks use (decision #13) — this is the
          lens that surfaces them. Decorative; the label carries the meaning. */}
      <span aria-hidden="true" className="text-[1.25em] leading-none [font-variant-emoji:text]">
        {"☻︎"}
      </span>
      <span className="font-bold uppercase text-sm tracking-wide">Specials, etc</span>
    </button>
  );
}

// --- shared: the National Cinema Weekend mark ------------------------------------------------
// A ★ beside the two campaign days in both day pickers (CLAUDE.md decision #19). Ink, not accent:
// a selected segment is already filled gold, and the mark has to stay readable on it. Deliberately
// not the ☻ of a special screening — that means a strand within a day, this means the whole day
// is cheap. The glyph is decorative, so the name rides along as screen-reader text (safe inside
// the button: SEGMENT_BASE is `relative`, so the absolutely-positioned sr-only span can't escape
// the dock's horizontal scroll box and give the row a phantom scrollbar).
function DayMark({ day }: { day: string }) {
  if (!isCinemaWeekendDay(day)) return null;
  return (
    <>
      <span aria-hidden="true" className="mr-1.5 [font-variant-emoji:text]">
        {CINEMA_WEEKEND_MARK}
      </span>
      <span className="sr-only">{CINEMA_WEEKEND_NAME}: </span>
    </>
  );
}

// --- shared: the Place filter's "any" label ------------------------------------------------------
// "Anywhere" was a promise the filter can't keep — it only ever spans the cinemas the preferences
// allow. So the option (and the desktop trigger showing it) names them instead: "3 cinemas", or
// the place's own name when a single cinema is enabled. Counted from the *preferences*, not from
// the cinemas that happen to have something on today, so the label doesn't flicker as you page
// through days.
function cinemaAnyLabel(cinemasEnabled: CinemaId[]): string {
  return cinemasEnabled.length === 1
    ? CINEMA_LABEL[cinemasEnabled[0]]
    : `${cinemasEnabled.length} cinemas`;
}

// ================================================================================================
// dock (mobile) — the flush segmented row
// ================================================================================================

// controlSegmentClass / SEGMENT_BASE live in components/controlSegment.ts — shared with the
// settings toggles (SettingsPanel) for one "selected" language. Filter-dock segments additionally
// sit flush against each other:
//
// A negative margin equal to the border width (2px, `-ml-0.5`) pulls each segment's left border
// exactly onto the previous one's right border, so they merge into a single shared line. Because
// they're flush, an *inactive* segment's own --shadow-chip renders mostly hidden under its
// right-hand neighbor (only its bottom strip shows, and those strips line up into one continuous
// stacked-card shadow under the whole row).
//
// Only the group's two end segments round outward — everything in between stays square so the
// row reads as one continuous shape, not a strip of individually rounded chips.
//
// Every segment also needs an explicit `relative` + ascending `z-index` (set inline where each
// button renders) matching left-to-right DOM order. Without it, the active segment's `translate`
// (which establishes its own stacking context, same as `transform`) makes it paint above *every*
// plain sibling regardless of DOM order — fine on its left side, where translating away from the
// left neighbor leaves nothing to overlap, but wrong on its right side, where it now bleeds over
// a later sibling that should be layered on top of it. Giving every segment the same explicit
// z-index ordering restores "later sibling wins" for all of them, active or not.
//
// There's deliberately no "disabled" variant: a segment the user can't act on (a time window
// that's already passed, a filter with only one possible value) is removed from the row rather
// than shown greyed-out — see ControlGroup below.
function controlPositionClass(isFirst: boolean, isLast: boolean): string {
  const radius = isFirst && isLast ? "rounded-[10px]" : isFirst ? "rounded-l-[10px]" : isLast ? "rounded-r-[10px]" : "";
  const overlap = isFirst ? "" : "-ml-0.5";
  return `${radius} ${overlap}`;
}

// One filter control (Day / Time / Place). The point of this component is what it does when
// there's nothing to choose:
//   - 0 options  → the whole control disappears.
//   - 1 option   → that single option is shown as a plain segment with no "Any X" toggle beside
//                  it. One choice isn't a choice — but the row should still say what you're
//                  looking at, so it's shown, just not as something to press. It still takes the
//                  active fill from `isActive` (so it goes quiet when a trailing control like the
//                  Day row's "Next week" preview is the thing actually in view).
//   - 2+ options → the usual "Any X" segment plus one segment per option.
// `trailing` is an extra node rendered flush after the options (the Day row's "come back
// tomorrow" note); when present it takes the group's right-hand rounded corner.
function ControlGroup<T>({
  options,
  anyLabel,
  anyActive,
  isActive,
  onAny,
  onToggle,
  renderLabel,
  keyFor,
  trailing,
}: {
  options: T[];
  anyLabel: string;
  anyActive: boolean;
  isActive: (opt: T) => boolean;
  onAny: () => void;
  onToggle: (opt: T) => void;
  renderLabel: (opt: T) => ReactNode;
  keyFor: (opt: T) => string;
  trailing?: ReactNode;
}) {
  // Even with no options to choose from, a trailing node (the "Next week" preview segment) still
  // needs somewhere to render — the day picker's one always-present control.
  if (options.length === 0) return trailing ? <div className="shrink-0 flex">{trailing}</div> : null;

  if (options.length === 1) {
    const only = options[0];
    // When it's the view you're on, there's nothing to press — a plain non-interactive segment.
    // When it *isn't* (a trailing control like the Day row's "Next week" preview is what's in
    // view), clicking it is a real action — "take me back to this" — so it becomes a button.
    return (
      <div className="shrink-0 flex">
        {isActive(only) ? (
          <div
            style={{ zIndex: 0 }}
            className={`${SEGMENT_BASE} cursor-default ${controlPositionClass(true, !trailing)} ${controlSegmentClass(true)}`}
          >
            {renderLabel(only)}
          </div>
        ) : (
          <button
            onClick={() => onToggle(only)}
            style={{ zIndex: 0 }}
            className={`${SEGMENT_BASE} cursor-pointer ${controlPositionClass(true, !trailing)} ${controlSegmentClass(false)}`}
          >
            {renderLabel(only)}
          </button>
        )}
        {trailing}
      </div>
    );
  }

  return (
    <div className="shrink-0 flex">
      <button
        onClick={onAny}
        style={{ zIndex: 0 }}
        className={`relative shrink-0 border-2 px-3 py-1 flex items-center transition-[translate,box-shadow] duration-100 cursor-pointer ${controlPositionClass(true, false)} ${controlSegmentClass(anyActive)}`}
      >
        <span className="font-bold uppercase text-sm tracking-wide">{anyLabel}</span>
      </button>
      {options.map((opt, i) => (
        <button
          key={keyFor(opt)}
          onClick={() => onToggle(opt)}
          style={{ zIndex: i + 1 }}
          className={`${SEGMENT_BASE} cursor-pointer ${controlPositionClass(false, !trailing && i === options.length - 1)} ${controlSegmentClass(isActive(opt))}`}
        >
          {renderLabel(opt)}
        </button>
      ))}
      {trailing}
    </div>
  );
}

// ================================================================================================
// bar (desktop) — dropdown menus
// ================================================================================================

// One row of the open menu panel. Left-aligned label, right-aligned sublabel (date / time range).
function MenuRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-6 px-3 py-2 text-sm font-bold uppercase tracking-wide cursor-pointer ${
        selected
          ? "bg-accent text-fg [&_[data-sub]]:text-accent-ink"
          : "bg-surface text-fg hover:bg-bg [&_[data-sub]]:text-dim"
      }`}
    >
      {children}
    </button>
  );
}

// A single-select filter as a dropdown: a trigger button showing the current choice, opening a
// chunky panel below it. The parent owns `open` so only one menu is open at a time. First row is
// always the "any" option; `footer` is the Day menu's "Next week" affordance.
//
// This is the app's first popover — its own click-outside + Escape dismissal, panel at `z-40`
// (above the sticky bar / dock at z-20 and the FAB at z-30, below the modals at z-50).
function FilterMenu<T>({
  triggerLabel,
  active,
  open,
  onOpenChange,
  anyLabel,
  anyActive,
  onAny,
  options,
  isActive,
  onSelect,
  renderOption,
  keyFor,
  footer,
}: {
  triggerLabel: ReactNode;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anyLabel: string;
  anyActive: boolean;
  onAny: () => void;
  options: T[];
  isActive: (opt: T) => boolean;
  onSelect: (opt: T) => void;
  renderOption: (opt: T) => ReactNode;
  keyFor: (opt: T) => string;
  footer?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // Accent fill only means "this filter is narrowing the view"; an open-but-default menu just
  // presses in (same as PreferencesButton while its modal is open).
  const triggerClass = active
    ? controlSegmentClass(true)
    : open
      ? "border-border bg-surface text-fg translate-x-[6px] translate-y-[6px] shadow-none"
      : controlSegmentClass(false);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`${BAR_CONTROL} ${triggerClass}`}
      >
        <span className="font-bold uppercase text-sm tracking-wide">{triggerLabel}</span>
        <span aria-hidden="true" className="text-[0.7em] leading-none">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-40 w-max min-w-full border-2 border-border bg-surface rounded-[10px] shadow-card overflow-hidden"
        >
          <MenuRow
            selected={anyActive}
            onClick={() => {
              onAny();
              onOpenChange(false);
            }}
          >
            <span>{anyLabel}</span>
          </MenuRow>
          {options.map((opt) => (
            <MenuRow
              key={keyFor(opt)}
              selected={isActive(opt)}
              onClick={() => {
                onSelect(opt);
                onOpenChange(false);
              }}
            >
              {renderOption(opt)}
            </MenuRow>
          ))}
          {footer && <div className="border-t-2 border-border">{footer}</div>}
        </div>
      )}
    </div>
  );
}

// ================================================================================================

interface Props {
  layout: "dock" | "bar";
  highlightsOnly: boolean;
  setHighlightsOnly: Dispatch<SetStateAction<boolean>>;
  nextWeek: boolean;
  setNextWeek: Dispatch<SetStateAction<boolean>>;
  visibleDays: string[];
  effectiveDay: string | null;
  setActiveDay: Dispatch<SetStateAction<string | null>>;
  upcoming?: UpcomingFilm[];
  timeFilterUseful: boolean;
  usableTimeframes: TimeframeDef[];
  effectiveTimeframe: Timeframe | null;
  setActiveTimeframe: Dispatch<SetStateAction<Timeframe | null>>;
  cinemasEnabled: CinemaId[];
  cinemasPresent: CinemaId[];
  effectiveCinema: CinemaId | null;
  setActiveCinema: Dispatch<SetStateAction<CinemaId | null>>;
}

export default function FilterControls(props: Props) {
  return props.layout === "bar" ? <BarMenus {...props} /> : <DockSegments {...props} />;
}

// --- bar (desktop) --------------------------------------------------------------------------------

function BarMenus({
  highlightsOnly,
  setHighlightsOnly,
  nextWeek,
  setNextWeek,
  visibleDays,
  effectiveDay,
  setActiveDay,
  upcoming,
  timeFilterUseful,
  usableTimeframes,
  effectiveTimeframe,
  setActiveTimeframe,
  cinemasEnabled,
  cinemasPresent,
  effectiveCinema,
  setActiveCinema,
}: Props) {
  const [openMenu, setOpenMenu] = useState<null | "day" | "time" | "place">(null);

  const dayTriggerLabel = nextWeek ? (
    "Next week"
  ) : effectiveDay === null ? (
    "This week"
  ) : (
    <>
      <DayMark day={effectiveDay} />
      {`${formatDayFriendly(effectiveDay)} ${formatDayDate(effectiveDay)}`}
    </>
  );

  const timeTriggerLabel =
    effectiveTimeframe === null
      ? "Any time"
      : (usableTimeframes.find((tf) => tf.id === effectiveTimeframe)?.label ?? "Any time");

  const nextWeekRow = upcoming?.length ? (
    <MenuRow
      selected={nextWeek}
      onClick={() => {
        setNextWeek(true);
        setOpenMenu(null);
      }}
    >
      <span>Next week</span>
      <span data-sub className="text-xs tracking-widest">(maybe) &rarr;</span>
    </MenuRow>
  ) : undefined;

  return (
    <div className="flex flex-wrap items-start gap-3">
      {!nextWeek && (
        <SpecialsToggle
          on={highlightsOnly}
          onToggle={() => setHighlightsOnly((v) => !v)}
          shell={BAR_CONTROL}
        />
      )}

      {visibleDays.length === 0 ? (
        // No days to pick (stale data) — the "Next week" preview is the only affordance, and it
        // mustn't dead-end, so it stays a plain toggle rather than a menu.
        upcoming?.length ? (
          <button
            type="button"
            aria-pressed={nextWeek}
            onClick={() => setNextWeek((v) => !v)}
            className={`${BAR_CONTROL} ${controlSegmentClass(nextWeek)}`}
          >
            <span className="font-bold uppercase text-sm tracking-wide">Next week</span>
            <span className="text-xs text-dim uppercase tracking-widest">(maybe)</span>
          </button>
        ) : null
      ) : (
        <FilterMenu
          triggerLabel={dayTriggerLabel}
          active={nextWeek || effectiveDay !== null}
          open={openMenu === "day"}
          onOpenChange={(o) => setOpenMenu(o ? "day" : null)}
          anyLabel="This week"
          anyActive={effectiveDay === null && !nextWeek}
          onAny={() => {
            setActiveDay(null);
            setNextWeek(false);
          }}
          options={visibleDays}
          isActive={(day) => effectiveDay === day && !nextWeek}
          onSelect={(day) => {
            setActiveDay(day);
            setNextWeek(false);
          }}
          keyFor={(day) => day}
          renderOption={(day) => (
            <>
              <span>
                <DayMark day={day} />
                {formatDayFriendly(day)}
              </span>
              <span data-sub className="text-xs tracking-widest">{formatDayDate(day)}</span>
            </>
          )}
          footer={nextWeekRow}
        />
      )}

      {!nextWeek && timeFilterUseful && (
        <FilterMenu
          triggerLabel={timeTriggerLabel}
          active={effectiveTimeframe !== null}
          open={openMenu === "time"}
          onOpenChange={(o) => setOpenMenu(o ? "time" : null)}
          anyLabel="Any time"
          anyActive={effectiveTimeframe === null}
          onAny={() => setActiveTimeframe(null)}
          options={usableTimeframes}
          isActive={(tf) => effectiveTimeframe === tf.id}
          onSelect={(tf) => setActiveTimeframe(tf.id)}
          keyFor={(tf) => tf.id}
          renderOption={(tf) => (
            <>
              <span>{tf.label}</span>
              <span data-sub className="text-xs tracking-widest">{formatTimeframeRange(tf)}</span>
            </>
          )}
        />
      )}

      {!nextWeek && cinemasEnabled.length > 1 && (
        <FilterMenu
          triggerLabel={
            effectiveCinema === null ? cinemaAnyLabel(cinemasEnabled) : CINEMA_LABEL[effectiveCinema]
          }
          active={effectiveCinema !== null}
          open={openMenu === "place"}
          onOpenChange={(o) => setOpenMenu(o ? "place" : null)}
          anyLabel={cinemaAnyLabel(cinemasEnabled)}
          anyActive={effectiveCinema === null}
          onAny={() => setActiveCinema(null)}
          options={cinemasPresent}
          isActive={(id) => effectiveCinema === id}
          onSelect={(id) => setActiveCinema(id)}
          keyFor={(id) => id}
          renderOption={(id) => (
            <>
              <span>{CINEMA_LABEL[id]}</span>
              <span data-sub className="text-xs tracking-widest">{CINEMA_LOCATION[id]}</span>
            </>
          )}
        />
      )}

      {/* Preferences (persisted viewing prefs — decision #14) lives here on desktop now that the
          filters are compact menus; on mobile it's in the masthead. `ml-auto` pushes it to the
          far end of the row / its wrap line. Same BAR_CONTROL shell as the other buttons so it
          lines up at one height. */}
      <div className="ml-auto">
        <PreferencesButton className={`${BAR_CONTROL} border-border bg-surface text-fg`} />
      </div>
    </div>
  );
}

// --- dock (mobile) -------------------------------------------------------------------------------

function DockSegments({
  highlightsOnly,
  setHighlightsOnly,
  nextWeek,
  setNextWeek,
  visibleDays,
  effectiveDay,
  setActiveDay,
  upcoming,
  timeFilterUseful,
  usableTimeframes,
  effectiveTimeframe,
  setActiveTimeframe,
  cinemasEnabled,
  cinemasPresent,
  effectiveCinema,
  setActiveCinema,
}: Props) {
  return (
    // `overflow-x-auto` forces `overflow-y` to compute to `auto` too, so a selected segment's
    // 6px downward `translate` (and the resting segments' 6px shadow) would trip a vertical
    // scrollbar. `pb-2 -mb-2` gives that reach room inside the scroll box without adding a
    // visible gap — same trick as SettingsPanel's option rows.
    <div className="flex items-center justify-center-safe gap-4 overflow-x-auto scrollbar-none pb-2 -mb-2">
      {!nextWeek && (
        <SpecialsToggle
          on={highlightsOnly}
          onToggle={() => setHighlightsOnly((v) => !v)}
          // Flush two-line box, `self-stretch` to match the segmented ControlGroups beside it.
          shell="relative shrink-0 self-stretch flex items-center gap-1.5 border-2 px-3 py-1 rounded-[10px] transition-[translate,box-shadow] duration-100 cursor-pointer"
        />
      )}

      <ControlGroup
        options={visibleDays}
        anyLabel="This week"
        anyActive={effectiveDay === null && !nextWeek}
        isActive={(day) => effectiveDay === day && !nextWeek}
        onAny={() => {
          setActiveDay(null);
          setNextWeek(false);
        }}
        onToggle={(day) => {
          setActiveDay(nextWeek ? day : effectiveDay === day ? null : day);
          setNextWeek(false);
        }}
        keyFor={(day) => day}
        renderLabel={(day) => (
          <>
            <span className="font-bold uppercase text-sm tracking-wide">
              <DayMark day={day} />
              {formatDayFriendly(day)}
            </span>
            <span className="text-xs text-dim uppercase tracking-widest">{formatDayDate(day)}</span>
          </>
        )}
        trailing={
          /* The "more is coming" affordance — replaces the old Wednesday-only "come back
             tomorrow" note, shown whenever there's an unconfirmed next-week list to preview.
             Behaves like a day segment: a real button to switch to it, then non-interactive
             once it's the view you're on. Takes the group's right rounded corner. Decision #18. */
          upcoming?.length ? (
            nextWeek && visibleDays.length > 0 ? (
              <div
                style={{ zIndex: visibleDays.length + 1 }}
                className={`${SEGMENT_BASE} cursor-default ${controlPositionClass(false, true)} ${controlSegmentClass(true)}`}
              >
                <span className="font-bold uppercase text-sm tracking-wide">Next week</span>
                <span className="text-xs text-dim uppercase tracking-widest">(maybe)</span>
              </div>
            ) : (
              <button
                type="button"
                aria-pressed={nextWeek}
                onClick={() => setNextWeek((v) => !v)}
                style={{ zIndex: visibleDays.length + 1 }}
                className={`${SEGMENT_BASE} cursor-pointer ${controlPositionClass(false, true)} ${controlSegmentClass(nextWeek)}`}
              >
                <span className="font-bold uppercase text-sm tracking-wide">Next week</span>
                <span className="text-xs text-dim uppercase tracking-widest">(maybe)</span>
              </button>
            )
          ) : undefined
        }
      />

      {!nextWeek && timeFilterUseful && (
        <ControlGroup
          options={usableTimeframes}
          anyLabel="Any Time"
          anyActive={effectiveTimeframe === null}
          isActive={(tf) => effectiveTimeframe === tf.id}
          onAny={() => setActiveTimeframe(null)}
          onToggle={(tf) => setActiveTimeframe(effectiveTimeframe === tf.id ? null : tf.id)}
          keyFor={(tf) => tf.id}
          renderLabel={(tf) => (
            <>
              <span className="font-bold uppercase text-sm tracking-wide">{tf.label}</span>
              <span className="text-xs text-dim uppercase tracking-widest">{formatTimeframeRange(tf)}</span>
            </>
          )}
        />
      )}

      {!nextWeek && cinemasEnabled.length > 1 && (
        <ControlGroup
          options={cinemasPresent}
          anyLabel={cinemaAnyLabel(cinemasEnabled)}
          anyActive={effectiveCinema === null}
          isActive={(id) => effectiveCinema === id}
          onAny={() => setActiveCinema(null)}
          onToggle={(id) => setActiveCinema(effectiveCinema === id ? null : id)}
          keyFor={(id) => id}
          renderLabel={(id) => (
            <>
              <span className="font-bold uppercase text-sm tracking-wide">{CINEMA_LABEL[id]}</span>
              <span className="text-xs text-dim uppercase tracking-widest">{CINEMA_LOCATION[id]}</span>
            </>
          )}
        />
      )}
    </div>
  );
}
