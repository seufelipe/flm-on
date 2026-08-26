"use client";

import { useMemo, useState } from "react";
import type { CinemaId, Screening } from "@/lib/scrapers/types";
import { findCombos, withEndTimes, itineraryTransitions, fittingAdditions, type TimedScreening } from "@/lib/clash";
import { groupByFilm } from "@/lib/groupings";
import { TIMEFRAMES, formatTimeframeRange, timeframeForTime, type Timeframe } from "@/lib/timeframe";
import { CINEMA_LABEL, CINEMA_LOCATION, CINEMA_ORDER } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate, todayISO, nowTimeISO } from "@/lib/date";
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

// Each segment keeps its own border and shadow (same elevation language as the film chips) but
// sits flush against its neighbors — a negative margin equal to the border width pulls each
// segment's left border exactly onto the previous one's right border, so they merge into a single
// shared line instead of doubling up or leaving a gap. Because they're flush, an *inactive*
// segment's own shadow renders mostly hidden under its right-hand neighbor (only its bottom sliver
// shows, and those slivers line up into one continuous strip under the whole row) — the same net
// look as a single shared group shadow. The *active* segment drops its shadow and translates by
// that same offset instead, so it visibly sinks relative to its still-raised neighbors — the same
// accent fill + flush treatment as a selected film chip (FilmCard.tsx), for one consistent
// "selected" language across the app.
function controlSegmentClass(active: boolean, disabled: boolean): string {
  if (disabled) {
    // Solid muted tones rather than opacity — opacity would fade the segment's own border to a
    // half-strength blend of whatever's underneath (the overlapping neighbor, at these flush
    // seams), which reads as a rendering glitch rather than a deliberate "disabled" look.
    return "border-dim bg-surface text-dim translate-x-[3px] translate-y-[3px] cursor-not-allowed";
  }
  if (active) {
    return "border-border bg-accent text-fg translate-x-[3px] translate-y-[3px] cursor-pointer";
  }
  return "border-border bg-surface text-fg shadow-btn-secondary cursor-pointer active:translate-x-[3px] active:translate-y-[3px] active:shadow-none";
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
  const overlap = isFirst ? "" : "-ml-1";
  return `${radius} ${overlap}`;
}

export default function ScreeningBrowser({ screenings, days }: Props) {
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe | null>(null);
  const [activeCinema, setActiveCinema] = useState<CinemaId | null>(null);
  // Defaults to "Any Day" (null) as usual, unless today's screenings have already fully passed —
  // e.g. loading the page late in the evening once everything remaining is for tomorrow onward.
  // In that case, landing on "Any Day" would just show a flat list with no day headers (a film's
  // day header only appears once its visible screenings span more than one day) and no obvious
  // explanation why. Pinning to the first day that actually still has something on gives the page
  // the same "your day plan" framing it'd have on a normal day.
  const [activeDay, setActiveDay] = useState<string | null>(() => {
    const nowDate = todayISO();
    const nowTime = nowTimeISO();
    const todayHasScreenings = screenings.some((s) => s.date === nowDate && s.time >= nowTime);
    if (todayHasScreenings) return null;
    // Today is excluded here (`d > nowDate`, not `>=`) — it's already confirmed empty above, and
    // "has any screening on that date at all" (with no time check) would otherwise match today's
    // now-fully-past screenings right back.
    return days.find((d) => d > nowDate && screenings.some((s) => s.date === d)) ?? null;
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
  const gapForPartner = additionHints;

  const visible = timed.filter(
    (s) =>
      (activeTimeframe === null || timeframeForTime(s.time) === activeTimeframe) &&
      (activeCinema === null || s.cinema === activeCinema) &&
      (activeDay === null || s.date === activeDay),
  );

  const filmGroups = useMemo(() => groupByFilm(visible), [visible]);

  const dayPlanTransitions = useMemo(() => itineraryTransitions(dayPlanItems), [dayPlanItems]);

  const dayPlanHeading = comboScopeDay
    ? `Your day plan for ${formatDayFriendly(comboScopeDay)} ${formatDayDate(comboScopeDay)}`
    : "Your day plan";

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
      <div className="pb-24">
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
              gapForPartner={gapForPartner}
              keyOf={keyOf}
              onSelect={toggleSelected}
              showCinema={activeCinema === null}
            />
          ))}
        </div>

        {comboScopeDay && effectiveSelectedKeys.size === 0 && visibleCombos.length > 0 && (
          <div className="mt-10">
            <ComboSuggestions combos={visibleCombos} onSelect={toggleSelected} keyOf={keyOf} />
          </div>
        )}

        {comboScopeDay && effectiveSelectedKeys.size > 0 && (
          <div className="mt-10">
            <DayPlan
              heading={dayPlanHeading}
              items={dayPlanItems}
              transitions={dayPlanTransitions}
              onRemove={toggleSelected}
              keyOf={keyOf}
            />
          </div>
        )}
      </div>

      <div className="no-print fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-bg">
        <div className="flex items-center justify-start md:justify-center gap-4 overflow-x-auto px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="shrink-0 flex">
            <button
              onClick={() => setActiveDay(null)}
              style={{ zIndex: 0 }}
              className={`relative shrink-0 border-4 px-3 py-1 flex items-center transition-transform ${controlPositionClass(true, visibleDays.length === 0)} ${controlSegmentClass(activeDay === null, false)}`}
            >
              <span className="font-bold uppercase text-sm tracking-wide">Any Day</span>
            </button>
            {visibleDays.map((day, i) => (
              <button
                key={day}
                onClick={() => setActiveDay(activeDay === day ? null : day)}
                style={{ zIndex: i + 1 }}
                className={`relative shrink-0 border-4 px-3 py-1 flex flex-col items-start gap-0.5 transition-transform ${controlPositionClass(false, i === visibleDays.length - 1)} ${controlSegmentClass(activeDay === day, false)}`}
              >
                <span className="font-bold uppercase text-sm tracking-wide">{formatDayFriendly(day)}</span>
                <span className="text-xs text-dim uppercase tracking-widest">{formatDayDate(day)}</span>
              </button>
            ))}
          </div>

          <div className="shrink-0 flex">
            <button
              onClick={() => setActiveTimeframe(null)}
              style={{ zIndex: 0 }}
              className={`relative shrink-0 border-4 px-3 py-1 flex items-center transition-transform ${controlPositionClass(true, false)} ${controlSegmentClass(activeTimeframe === null, false)}`}
            >
              <span className="font-bold uppercase text-sm tracking-wide">Any Time</span>
            </button>
            {TIMEFRAMES.map((tf, i) => {
              // Only meaningful once the day filter is pinned to today — a future day's "early"
              // screenings haven't happened yet, so they're not unavailable in the same sense.
              const disabled = activeDay === now.date && nowMins >= tf.endMins;
              return (
                <button
                  key={tf.id}
                  onClick={() => setActiveTimeframe(activeTimeframe === tf.id ? null : tf.id)}
                  disabled={disabled}
                  style={{ zIndex: i + 1 }}
                  className={`relative shrink-0 border-4 px-3 py-1 flex flex-col items-start gap-0.5 transition-transform ${controlPositionClass(false, i === TIMEFRAMES.length - 1)} ${controlSegmentClass(activeTimeframe === tf.id, disabled)}`}
                >
                  <span className="font-bold uppercase text-sm tracking-wide">{tf.label}</span>
                  <span className="text-xs text-dim uppercase tracking-widest">{formatTimeframeRange(tf)}</span>
                </button>
              );
            })}
          </div>

          {cinemasPresent.length > 1 && (
            <div className="shrink-0 flex">
              <button
                onClick={() => setActiveCinema(null)}
                style={{ zIndex: 0 }}
                className={`relative shrink-0 border-4 px-3 py-1 flex items-center transition-transform ${controlPositionClass(true, false)} ${controlSegmentClass(activeCinema === null, false)}`}
              >
                <span className="font-bold uppercase text-sm tracking-wide">Anywhere</span>
              </button>
              {cinemasPresent.map((id, i) => (
                <button
                  key={id}
                  onClick={() => setActiveCinema(activeCinema === id ? null : id)}
                  style={{ zIndex: i + 1 }}
                  className={`relative shrink-0 border-4 px-3 py-1 flex flex-col items-start gap-0.5 transition-transform ${controlPositionClass(false, i === cinemasPresent.length - 1)} ${controlSegmentClass(activeCinema === id, false)}`}
                >
                  <span className="font-bold uppercase text-sm tracking-wide">{CINEMA_LABEL[id]}</span>
                  <span className="text-xs text-dim uppercase tracking-widest">{CINEMA_LOCATION[id]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
