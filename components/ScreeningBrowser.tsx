"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CinemaId, Screening } from "@/lib/scrapers/types";
import { findCombos, withEndTimes, itineraryTransitions, fittingAdditions, type TimedScreening } from "@/lib/clash";
import { groupByFilm } from "@/lib/groupings";
import { TIMEFRAMES, formatTimeframeRange, timeframeForTime, type Timeframe } from "@/lib/timeframe";
import { CINEMA_LABEL, CINEMA_LOCATION, CINEMA_ORDER } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate, todayISO, nowTimeISO, nextBatchLabel } from "@/lib/date";
import FilmCard from "./FilmCard";
import ComboSuggestions from "./ComboSuggestions";
import DayPlan from "./DayPlan";

interface Props {
  screenings: Screening[];
  days: string[];
}

// bookingUrl is the one field guaranteed unique per actual bookable session — real listings can
// have two distinct sessions for the same film at the same time (e.g. subtitled vs standard).
function keyOf(s: Screening): string {
  return s.bookingUrl;
}

// Each segment keeps its own border and the two-tone stacked shadow (--shadow-chip, same
// elevation language as the film chips) but sits flush against its neighbors — a negative margin
// equal to the border width (2px, `-ml-0.5`) pulls each segment's left border exactly onto the
// previous one's right border, so they merge into a single shared line instead of doubling up or
// leaving a gap. Because they're flush, an *inactive* segment's own shadow renders mostly hidden
// under its right-hand neighbor (only its bottom strip shows, and those strips line up into one
// continuous stacked-card shadow under the whole row). Hovering an inactive segment gives it the
// half-press (--shadow-chip-half + 3px translate); the *active* one drops its shadow entirely and
// translates by the shadow's full 6px reach, so it lands exactly where its shadow edge was and
// sinks flush against its still-raised neighbors — the same accent fill + press treatment as a
// selected film chip (FilmCard.tsx), for one consistent "selected" language across the app.
//
// There's deliberately no "disabled" variant: a segment the user can't act on (a time window
// that's already passed, a filter with only one possible value) is removed from the row rather
// than shown greyed-out — see ControlGroup below.
function controlSegmentClass(active: boolean): string {
  if (active) {
    return "border-border bg-accent text-fg translate-x-[6px] translate-y-[6px]";
  }
  return "border-border bg-surface text-fg shadow-chip hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-chip-half active:translate-x-[6px] active:translate-y-[6px] active:shadow-none";
}

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
function controlPositionClass(isFirst: boolean, isLast: boolean): string {
  const radius = isFirst && isLast ? "rounded-[10px]" : isFirst ? "rounded-l-[10px]" : isLast ? "rounded-r-[10px]" : "";
  const overlap = isFirst ? "" : "-ml-0.5";
  return `${radius} ${overlap}`;
}

const SEGMENT_BASE =
  "relative shrink-0 border-2 px-3 py-1 flex flex-col items-start gap-0.5 transition-[translate,box-shadow] duration-100";

// One filter control (Day / Time / Place). The point of this component is what it does when
// there's nothing to choose:
//   - 0 options  → the whole control disappears.
//   - 1 option   → that single option is shown as a selected-looking segment with no "Any X"
//                  toggle beside it. One choice isn't a choice — but the row should still say
//                  what you're looking at, so it's shown, just not as something to press.
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
  if (options.length === 0) return null;

  if (options.length === 1) {
    return (
      <div className="shrink-0 flex">
        <div
          style={{ zIndex: 0 }}
          className={`${SEGMENT_BASE} cursor-default ${controlPositionClass(true, !trailing)} ${controlSegmentClass(true)}`}
        >
          {renderLabel(options[0])}
        </div>
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

export default function ScreeningBrowser({ screenings, days }: Props) {
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe | null>(null);
  const [activeCinema, setActiveCinema] = useState<CinemaId | null>(null);
  // Defaults to "Any Day" (null) as usual, with two exceptions where a specific day is pinned
  // instead — both because "Any Day" would show the exact same set of films as the one day would,
  // just without the framing (day headers, day-plan building) that comes from actually having a
  // day in scope.
  const [activeDay, setActiveDay] = useState<string | null>(() => {
    const nowDate = todayISO();
    const nowTime = nowTimeISO();
    const upcomingDays = days.filter((d) => d >= nowDate);
    // 1. Only one day left to browse at all (e.g. the batch's date range is almost over) — same
    // logic as the disabled/enabled split on the time picker: with a single option, there's
    // nothing for "Any Day" to actually broaden the view to.
    if (upcomingDays.length === 1) return upcomingDays[0];
    // 2. Today's screenings have already fully passed — e.g. loading the page late in the
    // evening once everything remaining is for tomorrow onward. Landing on "Any Day" there would
    // just show a flat list with no day headers (a film's day header only appears once its
    // visible screenings span more than one day) and no obvious explanation why, so pin to the
    // first day that actually still has something on.
    const todayHasScreenings = screenings.some((s) => s.date === nowDate && s.time >= nowTime);
    if (todayHasScreenings) return null;
    // Today is excluded here (`d > nowDate`, not `>=`) — it's already confirmed empty above, and
    // "has any screening on that date at all" (with no time check) would otherwise match today's
    // now-fully-past screenings right back.
    return upcomingDays.find((d) => d > nowDate && screenings.some((s) => s.date === d)) ?? null;
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Whole days before today are dropped (the committed showtimes.json can still list them if
  // it's being viewed a day or more after its weekly batch was fetched), and today's sessions
  // that have already started are dropped too — if it's evening, this morning's screenings for
  // today no longer show. Fixed to whenever the component mounted (not re-evaluated every render)
  // since a stale-by-a-few-minutes cutoff is harmless and re-deriving it constantly isn't worth it.
  const now = useMemo(() => ({ date: todayISO(), time: nowTimeISO() }), []);
  const nowMins = useMemo(() => {
    const [h, m] = now.time.split(":").map(Number);
    return h * 60 + m;
  }, [now]);
  const upcomingScreenings = useMemo(
    () => screenings.filter((s) => s.date > now.date || (s.date === now.date && s.time >= now.time)),
    [screenings, now],
  );

  const cinemasPresent = useMemo(
    () => CINEMA_ORDER.filter((id) => upcomingScreenings.some((s) => s.cinema === id)),
    [upcomingScreenings],
  );

  // `days` comes from the committed showtimes.json, which can still list days before today if
  // it's being viewed after its batch was fetched (e.g. fetched Thursday, viewed the following
  // Monday) — a day chip for a date that's already passed isn't a day you can still plan.
  const visibleDays = useMemo(() => days.filter((d) => d >= now.date), [days, now]);
  // The "Come back tomorrow" note only appears the day before the next weekly batch; when it's
  // hidden the last day button becomes the group's right end and takes the rounded corner.
  const showBatchNote = nextBatchLabel(now.date) === "Tomorrow";

  // A time window is only offered while it's still ahead of us — and only *dropped* for being
  // past when today is the pinned day (a future day's "Early" hasn't happened yet). If that
  // leaves a single window, ControlGroup shows it as a plain selected segment.
  const usableTimeframes = useMemo(
    () => TIMEFRAMES.filter((tf) => !(activeDay === now.date && nowMins >= tf.endMins)),
    [activeDay, now.date, nowMins],
  );
  // Mirror of effectiveSelectedKeys: an activeTimeframe that's no longer in usableTimeframes
  // (the day rolled past it) is treated as "Any Time" so it doesn't keep silently filtering.
  const effectiveTimeframe =
    activeTimeframe !== null && usableTimeframes.some((tf) => tf.id === activeTimeframe) ? activeTimeframe : null;

  const timed = useMemo(() => withEndTimes(upcomingScreenings), [upcomingScreenings]);

  // Day-plan building only makes sense pinned to one specific day — otherwise "pairs well" would
  // be comparing showtimes across different dates, which isn't a realistic plan.
  const comboScopeDay = activeDay;

  // Combos across the whole day (ignoring the cinema filter) drive the "pairs well" pill hints,
  // so building a plan across both cinemas still gets correct hints even while the browsing view
  // is narrowed to one cinema. findCombos allows same-cinema pairs too (just moving between
  // screens), not only cross-cinema ones.
  const allDayCombos = useMemo(() => {
    if (!comboScopeDay) return [];
    return findCombos(upcomingScreenings.filter((s) => s.date === comboScopeDay));
  }, [upcomingScreenings, comboScopeDay]);

  // The initial "Suggested double bills" browsing list (shown before anything is picked) is
  // further narrowed to the active cinema filter — otherwise it'd suggest a pair referencing a
  // cinema the user has filtered out of view.
  const visibleCombos = useMemo(() => {
    if (activeCinema === null) return allDayCombos;
    return allDayCombos.filter((c) => c.a.cinema === activeCinema && c.b.cinema === activeCinema);
  }, [allDayCombos, activeCinema]);

  // Selections only count if they still belong to the day currently in scope — otherwise
  // switching days (e.g. picking a different day chip while a screening from the old day is
  // still selected) would leave stale selections driving the plan for the wrong day.
  const effectiveSelectedKeys = useMemo(() => {
    if (!comboScopeDay) return new Set<string>();
    const result = new Set<string>();
    for (const k of selectedKeys) {
      const s = timed.find((t) => keyOf(t) === k);
      if (s && s.date === comboScopeDay) result.add(k);
    }
    return result;
  }, [selectedKeys, comboScopeDay, timed]);

  // The day plan itself ignores the cinema filter — screenings already picked should stay in the
  // plan even while browsing a single cinema to add more.
  const dayPlanItems = useMemo(() => {
    return timed.filter((s) => effectiveSelectedKeys.has(keyOf(s))).sort((a, b) => a.startMins - b.startMins);
  }, [timed, effectiveSelectedKeys]);

  // Screenings that would slot cleanly into the plan get highlighted as a suggested next pick.
  // This checks each candidate against its actual neighbors once inserted chronologically — not
  // just "pairs with something already selected" — so a 3rd (or 4th, ...) pick only gets hinted
  // if it fits *both* the film before and the film after it, not just one of them. A candidate
  // that fits after film #1 but would overlap film #2 correctly gets no hint.
  const additionHints = useMemo(() => {
    if (dayPlanItems.length === 0) return new Map<string, number>();
    const candidates = timed.filter((s) => s.date === comboScopeDay && !effectiveSelectedKeys.has(keyOf(s)));
    return fittingAdditions(dayPlanItems, candidates);
  }, [dayPlanItems, timed, comboScopeDay, effectiveSelectedKeys]);

  const partnersOf = useMemo(() => new Set(additionHints.keys()), [additionHints]);

  const visible = timed.filter(
    (s) =>
      (effectiveTimeframe === null || timeframeForTime(s.time) === effectiveTimeframe) &&
      (activeCinema === null || s.cinema === activeCinema) &&
      (activeDay === null || s.date === activeDay),
  );

  const filmGroups = useMemo(() => groupByFilm(visible), [visible]);

  const dayPlanTransitions = useMemo(() => itineraryTransitions(dayPlanItems), [dayPlanItems]);

  function toggleSelected(s: TimedScreening) {
    const k = keyOf(s);
    const isRemoving = selectedKeys.has(k);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isRemoving) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
    // Adding a screening narrows the day filter to just that day, so plan-building kicks in
    // immediately without a separate manual step. Removing leaves the day filter as it was — no
    // surprise jump back to the full period.
    if (!isRemoving) {
      setActiveDay(s.date);
    }
  }

  return (
    <div>
      <div className="pb-40">
        <div className="flex flex-col gap-8">
          {filmGroups.length === 0 && (
            <p className="bg-surface border-4 border-border rounded-card shadow-card p-8 font-bold">
              No screenings match this filter.
            </p>
          )}
          {filmGroups.map((group) => (
            <FilmCard
              key={group.key}
              group={group}
              selectedKeys={effectiveSelectedKeys}
              partnersOf={partnersOf}
              keyOf={keyOf}
              onSelect={toggleSelected}
              showCinema={activeCinema === null}
              daySpecified={activeDay !== null}
            />
          ))}
        </div>

        {comboScopeDay && effectiveSelectedKeys.size === 0 && visibleCombos.length > 0 && (
          <div className="mt-10">
            <ComboSuggestions combos={visibleCombos} onSelect={toggleSelected} keyOf={keyOf} />
          </div>
        )}
      </div>

      <div className="no-print fixed bottom-0 left-0 right-0 z-20 flex flex-col">
        {comboScopeDay && effectiveSelectedKeys.size > 0 && (
          <DayPlan
            items={dayPlanItems}
            transitions={dayPlanTransitions}
            onRemove={toggleSelected}
            onClear={() => setSelectedKeys(new Set())}
            keyOf={keyOf}
          />
        )}
        <div className="flex items-center justify-center-safe gap-4 overflow-x-auto border-t-2 border-border bg-bg px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <ControlGroup
            options={visibleDays}
            anyLabel="Any Day"
            anyActive={activeDay === null}
            isActive={(day) => activeDay === day}
            onAny={() => setActiveDay(null)}
            onToggle={(day) => setActiveDay(activeDay === day ? null : day)}
            keyFor={(day) => day}
            renderLabel={(day) => (
              <>
                <span className="font-bold uppercase text-sm tracking-wide">{formatDayFriendly(day)}</span>
                <span className="text-xs text-dim uppercase tracking-widest">{formatDayDate(day)}</span>
              </>
            )}
            trailing={
              showBatchNote ? (
                /* Not a button — this is an announcement ("more data tomorrow"), not a
                   temporarily-unavailable control, so it keeps the flush/translated look even
                   though genuinely ruled-out options are now removed rather than shown disabled.
                   Only shown the day before the next batch — earlier it just reads as clutter. */
                <div
                  style={{ zIndex: visibleDays.length + 1 }}
                  className={`relative shrink-0 border-2 border-dim px-3 py-1 flex flex-col items-start justify-center gap-0.5 bg-surface text-dim translate-x-[6px] translate-y-[6px] cursor-default ${controlPositionClass(false, true)}`}
                >
                  <span className="font-normal uppercase text-xs tracking-wide">Come back</span>
                  <span className="text-xs text-dim uppercase tracking-widest">Tomorrow!</span>
                </div>
              ) : undefined
            }
          />

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

          <ControlGroup
            options={cinemasPresent}
            anyLabel="Anywhere"
            anyActive={activeCinema === null}
            isActive={(id) => activeCinema === id}
            onAny={() => setActiveCinema(null)}
            onToggle={(id) => setActiveCinema(activeCinema === id ? null : id)}
            keyFor={(id) => id}
            renderLabel={(id) => (
              <>
                <span className="font-bold uppercase text-sm tracking-wide">{CINEMA_LABEL[id]}</span>
                <span className="text-xs text-dim uppercase tracking-widest">{CINEMA_LOCATION[id]}</span>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}
