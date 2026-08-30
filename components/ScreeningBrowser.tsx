"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CinemaId, Screening } from "@/lib/scrapers/types";
import { findCombos, withEndTimes, itineraryTransitions, fittingAdditions, type TimedScreening } from "@/lib/clash";
import { groupByFilm } from "@/lib/groupings";
import { TIMEFRAMES, formatTimeframeRange, timeframeForTime, type Timeframe } from "@/lib/timeframe";
import { CINEMA_LABEL, CINEMA_LOCATION, CINEMA_ORDER } from "@/lib/cinemas";
import { formatDayFriendly, formatDayDate, todayISO, nowTimeISO, nextBatchLabel } from "@/lib/date";
import { isShortFilm } from "@/lib/duration";
import { isKidFriendly } from "@/lib/certs";
import { displayScreeningTags } from "@/lib/screeningTags";
import { displayFilmFormats } from "@/lib/formats";
import { displayLanguage } from "@/lib/languages";
import { isMysteryFilm } from "@/lib/mystery";
import {
  DEFAULT_PREFERENCES,
  isDefault,
  preferencesSnapshot,
  PREFERENCES_SERVER_SNAPSHOT,
  subscribePreferences,
  writePreferences,
} from "@/lib/preferences";
import { SEGMENT_BASE, controlSegmentClass } from "./controlSegment";
import FilmCard from "./FilmCard";
import ComboSuggestions from "./ComboSuggestions";
import DayPlan from "./DayPlan";

interface Props {
  screenings: Screening[];
  days: string[];
  // Curated editorial tags keyed by FilmGroup.key (filmTitle.trim().toLowerCase()); see
  // data/film-labels.json and CLAUDE.md decision #11.
  labels?: Record<string, string>;
}

// bookingUrl is the one field guaranteed unique per actual bookable session — real listings can
// have two distinct sessions for the same film at the same time (e.g. subtitled vs standard).
function keyOf(s: Screening): string {
  return s.bookingUrl;
}

// controlSegmentClass / SEGMENT_BASE live in components/controlSegment.ts — shared with the
// settings toggles (SettingsPanel) for one "selected" language. Filter-bar segments additionally
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

export default function ScreeningBrowser({ screenings, days, labels }: Props) {
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe | null>(null);
  const [activeCinema, setActiveCinema] = useState<CinemaId | null>(null);
  // Defaults to **today** — the day you're most likely to be planning for — which also means the
  // day-plan tools (suggestions, click-to-select) are live from the start (decision #5). Once
  // today's slate is done (visiting late at night, everything left is for tomorrow onward) it
  // falls through to the next day that still has something on. "This week" (null) stays one tap
  // away on the Day control; it's just not where you land.
  const [activeDay, setActiveDay] = useState<string | null>(() => {
    const nowDate = todayISO();
    const nowTime = nowTimeISO();
    const todayHasScreenings = screenings.some((s) => s.date === nowDate && s.time >= nowTime);
    if (todayHasScreenings) return nowDate;
    // `d > nowDate` (not `>=`) — today is already confirmed done above, and a bare "any screening
    // on that date" check with no time bound would just match today's now-past screenings again.
    return days.filter((d) => d > nowDate).find((d) => screenings.some((s) => s.date === d)) ?? null;
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Persisted viewing preferences (localStorage) — the app's only stored state, via
  // useSyncExternalStore so SSR and the first client render agree (both "show everything") with
  // no hydration warning. `prefsLoaded` is false for exactly the frame between the server
  // snapshot and the first real read, and the film list holds until it's true rather than
  // rendering everything and visibly shrinking. See CLAUDE.md decision #14.
  const { prefs, loaded: prefsLoaded } = useSyncExternalStore(
    subscribePreferences,
    preferencesSnapshot,
    () => PREFERENCES_SERVER_SNAPSHOT,
  );

  // A browsing lens, not a saved preference — show only special screenings and labelled films.
  // Ephemeral (resets on reload), lives in the filter bar next to Day/Cinema/Time. See #14.
  const [highlightsOnly, setHighlightsOnly] = useState(false);

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
    () =>
      screenings
        .filter((s) => s.date > now.date || (s.date === now.date && s.time >= now.time))
        // The Mystery Matinee strand isn't tagged by the scraper (it's title-detected — see
        // lib/mystery.ts); attach the tag here so it rides the same mark / sticker / Highlights
        // path as the scraped special screenings.
        .map((s) =>
          isMysteryFilm(s.filmTitle)
            ? { ...s, screeningTags: [...(s.screeningTags ?? []), "Mystery Matinee"] }
            : s,
        ),
    [screenings, now],
  );

  // Standing pre-filter: the persisted preferences carve down the whole dataset here, before the
  // Day/Cinema/Time filter bar (and everything else) derives from it. Turning a cinema or time
  // window off doesn't grey a filter segment out — the option list feeding that ControlGroup
  // just shrinks, and it collapses / disappears on its own (CLAUDE.md decisions #7, #14).
  const preferred = useMemo(
    () =>
      upcomingScreenings.filter(
        (s) =>
          prefs.cinemas[s.cinema] &&
          prefs.timeframes[timeframeForTime(s.time)] &&
          !(prefs.hideShortFilms && isShortFilm(s.durationMins)) &&
          !(prefs.kidsOnly && !isKidFriendly(s.cert)) &&
          !(prefs.hideDubbed && displayLanguage(s.screeningTags)?.dubbed) &&
          (!highlightsOnly ||
            displayScreeningTags(s.screeningTags).length > 0 ||
            displayFilmFormats(s.screeningTags).length > 0 ||
            displayLanguage(s.screeningTags) !== null ||
            labels?.[s.filmTitle.trim().toLowerCase()] !== undefined),
      ),
    [upcomingScreenings, prefs, labels, highlightsOnly],
  );

  const cinemasPresent = useMemo(
    () => CINEMA_ORDER.filter((id) => preferred.some((s) => s.cinema === id)),
    [preferred],
  );

  // When the preferences pin a group to a single value there's nothing left for that filter to
  // do (it can't broaden past your own preference), so it drops out of the filter bar entirely
  // rather than showing as a lone non-interactive segment.
  const cinemaFilterUseful = CINEMA_ORDER.filter((id) => prefs.cinemas[id]).length > 1;
  const timeFilterUseful = TIMEFRAMES.filter((tf) => prefs.timeframes[tf.id]).length > 1;

  // `days` comes from the committed showtimes.json, which can still list days before today if
  // it's being viewed after its batch was fetched (e.g. fetched Thursday, viewed the following
  // Monday) — a day chip for a date that's already passed isn't a day you can still plan. Also
  // drop days the preferences have emptied out entirely.
  const visibleDays = useMemo(
    () => days.filter((d) => d >= now.date && preferred.some((s) => s.date === d)),
    [days, now, preferred],
  );
  // The "Come back tomorrow" note only appears the day before the next weekly batch; when it's
  // hidden the last day button becomes the group's right end and takes the rounded corner.
  const showBatchNote = nextBatchLabel(now.date) === "Tomorrow";

  // Mirror of effectiveTimeframe (below): an activeCinema/activeDay that the preferences (or the
  // day rolling past) have removed from its option list is treated as "any" so a now-impossible
  // filter value doesn't keep silently narrowing the view.
  const effectiveCinema =
    activeCinema !== null && cinemasPresent.includes(activeCinema) ? activeCinema : null;
  const effectiveDay = activeDay !== null && visibleDays.includes(activeDay) ? activeDay : null;

  // A time window is only offered while it's still ahead of us — and only *dropped* for being
  // past when today is the pinned day (a future day's "Early" hasn't happened yet) — plus
  // whatever the preferences allow. If that leaves a single window, ControlGroup shows it as a
  // plain selected segment.
  const usableTimeframes = useMemo(
    () =>
      TIMEFRAMES.filter(
        (tf) => prefs.timeframes[tf.id] && !(effectiveDay === now.date && nowMins >= tf.endMins),
      ),
    [prefs, effectiveDay, now.date, nowMins],
  );
  // Mirror of effectiveSelectedKeys: an activeTimeframe that's no longer in usableTimeframes
  // (the day rolled past it, or a preference turned it off) is treated as "Any Time".
  const effectiveTimeframe =
    activeTimeframe !== null && usableTimeframes.some((tf) => tf.id === activeTimeframe) ? activeTimeframe : null;

  const timed = useMemo(() => withEndTimes(preferred), [preferred]);

  // Day-plan building only makes sense pinned to one specific day — otherwise "pairs well" would
  // be comparing showtimes across different dates, which isn't a realistic plan.
  const comboScopeDay = effectiveDay;

  // Combos across the whole day (ignoring the cinema filter) drive the "pairs well" pill hints,
  // so building a plan across both cinemas still gets correct hints even while the browsing view
  // is narrowed to one cinema. findCombos allows same-cinema pairs too (just moving between
  // screens), not only cross-cinema ones.
  const allDayCombos = useMemo(() => {
    if (!comboScopeDay) return [];
    return findCombos(preferred.filter((s) => s.date === comboScopeDay));
  }, [preferred, comboScopeDay]);

  // The initial "Suggested double bills" browsing list (shown before anything is picked) is
  // further narrowed to the active cinema filter — otherwise it'd suggest a pair referencing a
  // cinema the user has filtered out of view.
  const visibleCombos = useMemo(() => {
    if (effectiveCinema === null) return allDayCombos;
    return allDayCombos.filter((c) => c.a.cinema === effectiveCinema && c.b.cinema === effectiveCinema);
  }, [allDayCombos, effectiveCinema]);

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
      (effectiveCinema === null || s.cinema === effectiveCinema) &&
      (effectiveDay === null || s.date === effectiveDay),
  );

  const filmGroups = useMemo(() => groupByFilm(visible), [visible]);

  // Cinema film-page links for each card — one per cinema the film plays at across its *whole*
  // set of preferred screenings, not just what the Day/Cinema/Time filter bar currently shows.
  // Keyed like FilmGroup.key; order = first appearance (preferred is date/time sorted).
  const filmCinemaLinks = useMemo(() => {
    const byFilm = new Map<string, Map<CinemaId, { label: string; url: string }>>();
    for (const s of preferred) {
      if (!s.filmPageUrl) continue;
      const key = s.filmTitle.trim().toLowerCase();
      let cinemas = byFilm.get(key);
      if (!cinemas) {
        cinemas = new Map();
        byFilm.set(key, cinemas);
      }
      if (!cinemas.has(s.cinema)) {
        cinemas.set(s.cinema, { label: CINEMA_LABEL[s.cinema] ?? s.cinemaName, url: s.filmPageUrl });
      }
    }
    return new Map(Array.from(byFilm, ([key, cinemas]) => [key, Array.from(cinemas.values())]));
  }, [preferred]);

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
      {/* Held until preferences load (one frame) so the list doesn't render everything and then
          visibly shrink to a restricted view — see CLAUDE.md decision #14. min-height keeps the
          footer from jumping during that frame. */}
      <div className="pb-40 min-h-[60vh]">
        {prefsLoaded && (
          <>
            <div className="flex flex-col gap-8">
              {filmGroups.length === 0 && (
                <p className="bg-surface border-4 border-border rounded-card shadow-card p-8 font-bold">
                  {preferred.length === 0 && (!isDefault(prefs) || highlightsOnly) ? (
                    <>
                      Nothing on this week within your current view.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          writePreferences(DEFAULT_PREFERENCES);
                          setHighlightsOnly(false);
                        }}
                        className="underline underline-offset-2 cursor-pointer"
                      >
                        Reset
                      </button>
                    </>
                  ) : (
                    "No screenings match this filter."
                  )}
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
                  showCinema={effectiveCinema === null}
                  daySpecified={effectiveDay !== null}
                  label={labels?.[group.key]}
                  cinemaLinks={filmCinemaLinks.get(group.key)}
                />
              ))}
            </div>

            {comboScopeDay && effectiveSelectedKeys.size === 0 && visibleCombos.length > 0 && (
              <div className="mt-10">
                <ComboSuggestions combos={visibleCombos} onSelect={toggleSelected} keyOf={keyOf} />
              </div>
            )}
          </>
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
          {/* A binary browsing lens — not the "Any X + options" shape, so a standalone toggle
              segment rather than a ControlGroup. Same accent-fill press language as the rest.
              Sits first: it's the lens you reach for most, ahead of the Day/Time/Place filters.
              One line, so it mirrors the ControlGroups' "any" segment (`flex items-center`) and
              takes `self-stretch` to match their two-line height instead of sitting short. */}
          <button
            type="button"
            aria-pressed={highlightsOnly}
            onClick={() => setHighlightsOnly((v) => !v)}
            className={`relative shrink-0 self-stretch flex items-center gap-1.5 border-2 px-3 py-1 rounded-[10px] transition-[translate,box-shadow] duration-100 cursor-pointer ${controlSegmentClass(highlightsOnly)}`}
          >
            {/* Same flat-ink smiley the special-screening marks use (decision #13) — this is the
                lens that surfaces them, so it wears their glyph. Decorative; the label carries the
                meaning. */}
            <span aria-hidden="true" className="text-[1.4em] leading-none [font-variant-emoji:text]">
              {"☻︎"}
            </span>
            <span className="font-bold uppercase text-sm tracking-wide">Specials, etc</span>
          </button>

          <ControlGroup
            options={visibleDays}
            anyLabel="This week"
            anyActive={effectiveDay === null}
            isActive={(day) => effectiveDay === day}
            onAny={() => setActiveDay(null)}
            onToggle={(day) => setActiveDay(effectiveDay === day ? null : day)}
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

          {timeFilterUseful && (
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

          {cinemaFilterUseful && (
            <ControlGroup
              options={cinemasPresent}
              anyLabel="Anywhere"
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
      </div>
    </div>
  );
}
