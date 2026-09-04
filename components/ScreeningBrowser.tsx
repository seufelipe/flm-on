"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { CinemaId, Screening } from "@/lib/scrapers/types";
import { findCombos, withEndTimes, itineraryTransitions, fittingAdditions, type TimedScreening } from "@/lib/clash";
import { groupByFilm, type FilmGroup } from "@/lib/groupings";
import type { UpcomingFilm } from "@/lib/upcoming";
import { TIMEFRAMES, timeframeForTime, type Timeframe } from "@/lib/timeframe";
import { CINEMA_LABEL, CINEMA_ORDER } from "@/lib/cinemas";
import { formatDayDate, todayISO, nowTimeISO } from "@/lib/date";
import { isShortFilm } from "@/lib/duration";
import { isKidFriendly } from "@/lib/certs";
import { displayScreeningTags } from "@/lib/screeningTags";
import { displayFilmFormats } from "@/lib/formats";
import { hasNonEnglishLanguage, matchesLanguagePref } from "@/lib/languages";
import { isMysteryFilm } from "@/lib/mystery";
import {
  DEFAULT_PREFERENCES,
  isDefault,
  preferencesSnapshot,
  PREFERENCES_SERVER_SNAPSHOT,
  subscribePreferences,
  writePreferences,
} from "@/lib/preferences";
import { planSnapshot, PLAN_SERVER_SNAPSHOT, subscribePlan, writePlan } from "@/lib/plan";
import FilmCard from "./FilmCard";
import Masthead, { MastheadTitle } from "./Masthead";
import ComboSuggestions from "./ComboSuggestions";
import FilterControls from "./FilterControls";
import PlanPanel from "./PlanPanel";
import PlanButton from "./PlanButton";

interface Props {
  screenings: Screening[];
  days: string[];
  // Curated editorial tags keyed by FilmGroup.key (filmTitle.trim().toLowerCase()); see
  // data/film-labels.json and CLAUDE.md decision #11.
  labels?: Record<string, string>;
  // The still-unconfirmed "Next week" preview — cards only, no showtimes (decision #18).
  upcoming?: UpcomingFilm[];
  upcomingWeek?: { from: string; to: string } | null;
}

const EMPTY_KEYS: Set<string> = new Set();

// A FilmCard wants a FilmGroup; an UpcomingFilm has everything but the (unknown) sessions.
function upcomingGroup(f: UpcomingFilm): FilmGroup {
  return {
    key: f.title.trim().toLowerCase(),
    filmTitle: f.title,
    originalTitle: f.originalTitle,
    year: f.year,
    cert: f.cert,
    director: f.director,
    letterboxdUrl: f.letterboxdUrl,
    screenings: [],
  };
}

// bookingUrl is the one field guaranteed unique per actual bookable session — real listings can
// have two distinct sessions for the same film at the same time (e.g. subtitled vs standard).
function keyOf(s: Screening): string {
  return s.bookingUrl;
}

export default function ScreeningBrowser({ screenings, days, labels, upcoming, upcomingWeek }: Props) {
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
  // Persisted viewing preferences (localStorage), via useSyncExternalStore so SSR and the first
  // client render agree (both "show everything") with no hydration warning. `prefsLoaded` is
  // false for exactly the frame between the server snapshot and the first real read, and the
  // film list holds until it's true rather than rendering everything and visibly shrinking. See
  // CLAUDE.md decision #14.
  const { prefs, loaded: prefsLoaded } = useSyncExternalStore(
    subscribePreferences,
    preferencesSnapshot,
    () => PREFERENCES_SERVER_SNAPSHOT,
  );

  // The saved plan (localStorage, lib/plan.ts) — the set of picked screenings by bookingUrl, now
  // spanning as many days as you like and surviving a reload (decision #5). Same store shape as
  // preferences. Stale keys (a past week, a screening that's since dropped out) are filtered on
  // read in `effectiveSelectedKeys` and pruned on the next write in `toggleSelected`.
  const { keys: planKeys, loaded: planLoaded } = useSyncExternalStore(
    subscribePlan,
    planSnapshot,
    () => PLAN_SERVER_SNAPSHOT,
  );
  const selectedKeys = useMemo(() => new Set(planKeys), [planKeys]);

  // A browsing lens, not a saved preference — show only special screenings and labelled films.
  // Ephemeral (resets on reload), lives in the filter bar next to Day/Cinema/Time. See #14.
  const [highlightsOnly, setHighlightsOnly] = useState(false);

  // The "Next week" preview: swaps the whole view for the unconfirmed upcoming-films list
  // (cards, no showtimes). Toggled from the day picker's trailing segment; any real day pick
  // exits it. Ephemeral like the Highlights lens. See CLAUDE.md decision #18.
  const [nextWeek, setNextWeek] = useState(false);

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
          matchesLanguagePref(prefs.language, s.screeningTags) &&
          (!highlightsOnly ||
            displayScreeningTags(s.screeningTags).length > 0 ||
            displayFilmFormats(s.screeningTags).length > 0 ||
            hasNonEnglishLanguage(s.screeningTags) ||
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
  //
  // The cinemas the preferences allow are passed through rather than reduced to a boolean: the
  // Place filter's "any" option names them ("3 cinemas") instead of saying "Anywhere", and
  // FilterControls derives "is this filter useful" from the same list.
  const cinemasEnabled = useMemo(() => CINEMA_ORDER.filter((id) => prefs.cinemas[id]), [prefs]);
  const timeFilterUseful = TIMEFRAMES.filter((tf) => prefs.timeframes[tf.id]).length > 1;

  // `days` comes from the committed showtimes.json, which can still list days before today if
  // it's being viewed after its batch was fetched (e.g. fetched Thursday, viewed the following
  // Monday) — a day chip for a date that's already passed isn't a day you can still plan. Also
  // drop days the preferences have emptied out entirely.
  const visibleDays = useMemo(
    () => days.filter((d) => d >= now.date && preferred.some((s) => s.date === d)),
    [days, now, preferred],
  );
  // The still-unconfirmed next-week films, narrowed by the persisted preferences that still make
  // sense without sessions (cinema / kids-only / language — not time or hide-shorts). The list is
  // already hand-trimmed to a teaser length in data/upcoming.json, so there's no extra cap here.
  // No count is surfaced (decision #8).
  const upcomingVisible = useMemo(() => {
    if (!upcoming?.length) return [];
    return upcoming.filter(
      (f) =>
        f.cinemas.some((c) => prefs.cinemas[c]) &&
        !(prefs.kidsOnly && !isKidFriendly(f.cert)) &&
        matchesLanguagePref(prefs.language, f.screeningTags),
    );
  }, [upcoming, prefs]);

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

  // Double-bill *suggestions* still only make sense pinned to one specific day — a suggested
  // "pair" across two dates isn't a realistic plan (the hand-built plan itself may span the
  // week; see decision #5). So the suggestion list is scoped to the pinned day; the plan is not.
  const suggestionScopeDay = effectiveDay;

  // Combos across the whole day (ignoring the cinema filter) drive the "pairs well" pill hints,
  // so building a plan across both cinemas still gets correct hints even while the browsing view
  // is narrowed to one cinema. findCombos allows same-cinema pairs too (just moving between
  // screens), not only cross-cinema ones.
  const allDayCombos = useMemo(() => {
    if (!suggestionScopeDay) return [];
    return findCombos(preferred.filter((s) => s.date === suggestionScopeDay));
  }, [preferred, suggestionScopeDay]);

  // The initial "Suggested double bills" browsing list (shown before anything is picked) is
  // further narrowed to the active cinema filter — otherwise it'd suggest a pair referencing a
  // cinema the user has filtered out of view.
  const visibleCombos = useMemo(() => {
    if (effectiveCinema === null) return allDayCombos;
    return allDayCombos.filter((c) => c.a.cinema === effectiveCinema && c.b.cinema === effectiveCinema);
  }, [allDayCombos, effectiveCinema]);

  // Every still-valid pick, on any day — a plan spans the week now (decision #5). Keys whose
  // screening has dropped out of the live dataset (a past week's plan, a now-started session, a
  // preference change) are filtered out here; `toggleSelected` writes the survivors back so the
  // stored plan is pruned on the next edit.
  const effectiveSelectedKeys = useMemo(() => {
    const present = new Set(timed.map((t) => keyOf(t)));
    const result = new Set<string>();
    for (const k of selectedKeys) if (present.has(k)) result.add(k);
    return result;
  }, [selectedKeys, timed]);

  // The plan itself ignores the cinema filter — screenings already picked should stay in the
  // plan even while browsing a single cinema to add more.
  const dayPlanItems = useMemo(() => {
    return timed.filter((s) => effectiveSelectedKeys.has(keyOf(s))).sort((a, b) => a.startMins - b.startMins);
  }, [timed, effectiveSelectedKeys]);

  // Screenings that would slot cleanly into the plan get highlighted as a suggested next pick.
  // This checks each candidate against its actual neighbors once inserted chronologically — not
  // just "pairs with something already selected" — so a 3rd (or 4th, ...) pick only gets hinted
  // if it fits *both* the film before and the film after it, not just one of them. Hints are
  // within-day only (fittingAdditions enforces that): candidates are limited to days the plan
  // already touches, so a week-spanning plan doesn't light up every day.
  const planDates = useMemo(() => new Set(dayPlanItems.map((s) => s.date)), [dayPlanItems]);

  const additionHints = useMemo(() => {
    if (dayPlanItems.length === 0) return new Map<string, number>();
    const candidates = timed.filter((s) => planDates.has(s.date) && !effectiveSelectedKeys.has(keyOf(s)));
    return fittingAdditions(dayPlanItems, candidates);
  }, [dayPlanItems, timed, planDates, effectiveSelectedKeys]);

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

  // Every screeningTag across each film's *whole* preferred set (not just the visible
  // screenings), so a special-screening note like "☻ parent & baby" stays on the card even when
  // the Day / Cinema / Time filter hides that particular session. Keyed like FilmGroup.key.
  const filmSpecialTags = useMemo(() => {
    const byFilm = new Map<string, Set<string>>();
    for (const s of preferred) {
      if (!s.screeningTags?.length) continue;
      const key = s.filmTitle.trim().toLowerCase();
      let tags = byFilm.get(key);
      if (!tags) {
        tags = new Set();
        byFilm.set(key, tags);
      }
      for (const t of s.screeningTags) tags.add(t);
    }
    return new Map(Array.from(byFilm, ([key, tags]) => [key, Array.from(tags)]));
  }, [preferred]);

  const dayPlanTransitions = useMemo(() => itineraryTransitions(dayPlanItems), [dayPlanItems]);

  function toggleSelected(s: TimedScreening) {
    const k = keyOf(s);
    // Write the *effective* (live-filtered) set, minus/plus this key — so any stale keys left in
    // storage from a past week get pruned on the way through. The Day filter is left alone: with
    // a persistent, week-spanning plan surface there's no need to jump the view to each pick, and
    // across days that jump is disorienting (decision #5).
    const base = [...effectiveSelectedKeys];
    writePlan(effectiveSelectedKeys.has(k) ? base.filter((x) => x !== k) : [...base, k]);
  }

  const clearPlan = () => writePlan([]);

  // Clicking a day header in the plan filters the film list to that day (leaving the "Next week"
  // preview if it's on).
  const pickDay = (date: string) => {
    setActiveDay(date);
    setNextWeek(false);
  };

  const filterProps = {
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
  };

  const filmList = prefsLoaded && (
    nextWeek ? (
      <div className="flex flex-col gap-8">
        <div className="bg-surface border-4 border-border rounded-card shadow-card p-4 sm:p-8">
          <p className="text-xl font-black uppercase tracking-tight">Next week (maybe)</p>
          <p className="mt-2 text-dim">
            A taste of what&rsquo;s coming
            {upcomingWeek ? ` the week of ${formatDayDate(upcomingWeek.from)}` : ""} — the times
            aren&rsquo;t set yet. The full, confirmed programme, with showtimes and the day
            planner, lands here Thursday morning.
          </p>
        </div>
        {upcomingVisible.length === 0 ? (
          <p className="bg-surface border-4 border-border rounded-card shadow-card p-4 sm:p-8 font-bold">
            Nothing lined up for next week within your current view yet — check back Thursday.
          </p>
        ) : (
          upcomingVisible.map((f) => {
            const key = f.title.trim().toLowerCase();
            return (
              <FilmCard
                key={key}
                group={upcomingGroup(f)}
                selectedKeys={EMPTY_KEYS}
                partnersOf={EMPTY_KEYS}
                keyOf={keyOf}
                onSelect={() => {}}
                showCinema={false}
                daySpecified
                preview
                // Live label (data/film-labels.json, editable + rebuild — decision #11)
                // wins over the one baked into data/upcoming.json at fetch time.
                label={labels?.[key] ?? f.label}
                // Drop links for cinemas the viewer has turned off — same as regular cards.
                cinemaLinks={f.cinemaLinks
                  .filter((l) => prefs.cinemas[l.cinema])
                  .map((l) => ({ label: l.label, url: l.url }))}
                specialTags={f.screeningTags}
              />
            );
          })
        )}
      </div>
    ) : (
      <>
        <div className="flex flex-col gap-8">
          {filmGroups.length === 0 && (
            <p className="bg-surface border-4 border-border rounded-card shadow-card p-4 sm:p-8 font-bold">
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
              planDates={planDates}
              keyOf={keyOf}
              onSelect={toggleSelected}
              showCinema={effectiveCinema === null}
              daySpecified={effectiveDay !== null}
              label={labels?.[group.key]}
              cinemaLinks={filmCinemaLinks.get(group.key)}
              specialTags={filmSpecialTags.get(group.key)}
            />
          ))}
        </div>

        {/* Mobile only — desktop shows suggestions in the sticky rail panel instead. */}
        {suggestionScopeDay && effectiveSelectedKeys.size === 0 && visibleCombos.length > 0 && (
          <div className="mt-10 lg:hidden">
            <ComboSuggestions combos={visibleCombos} onSelect={toggleSelected} keyOf={keyOf} />
          </div>
        )}
      </>
    )
  );

  return (
    <div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        {/* Right rail. Source order first: on mobile this collapses to just the masthead,
            stacked above the film list; the plan panel is desktop-only (the mobile plan lives
            behind the floating button). */}
        <div className="lg:col-start-2 lg:row-start-1 min-w-0">
          {/* Mobile: the page header (title / tagline / Preferences button). */}
          <div className="lg:hidden">
            <Masthead />
          </div>

          {/* Desktop: one rail card — the masthead sits at the top and scrolls away, the plan
              panel pins with it. The negative sticky `top` ≈ the masthead's height, so the title
              clears the viewport just before the plan holds (CLAUDE.md decision #5). ~10rem is a
              fixed estimate of the masthead block; nudge it if a sliver of the tagline shows. */}
          {/* `lg:mt-[86px]` drops the card so its top lines up with the first film card — the
              left column's sticky filter bar (~62px) plus its `mb-6` (24px). */}
          <div className="hidden lg:block lg:mt-[86px] lg:sticky lg:top-[calc(1rem-9.5rem)] border-4 border-border bg-surface shadow-card-lg rounded-card">
            <div className="px-5 pt-5 pb-4">
              <MastheadTitle />
            </div>
            {/* Hidden in the "Next week" preview only while the plan is empty — a saved week-plan
                stays visible (it's yours regardless of the view), but there's nothing to seed a
                new one from (no confirmed showtimes). */}
            {planLoaded && !(nextWeek && dayPlanItems.length === 0) && (
              <PlanPanel
                className="border-t-2 border-border"
                combos={visibleCombos}
                items={dayPlanItems}
                transitions={dayPlanTransitions}
                suggestionDay={nextWeek ? null : suggestionScopeDay}
                onSelect={toggleSelected}
                onRemove={toggleSelected}
                onClear={clearPlan}
                onPickDay={pickDay}
                keyOf={keyOf}
              />
            )}
          </div>
        </div>

        {/* Left column: the film list, with the filter controls as a sticky bar at its top on
            desktop (the mobile filter bar is the fixed bottom dock further down). */}
        <div className="lg:col-start-1 lg:row-start-1 min-w-0">
          {/* Solid bg, no backdrop-blur: `backdrop-filter` would make this a containing block for
              the `position: fixed` Preferences modal that now lives in the bar, trapping it inside
              the sticky strip. The mobile dock is opaque for the same reason. */}
          {prefsLoaded && (
            <div className="no-print hidden lg:block lg:sticky lg:top-0 z-20 -mx-4 mb-6 border-b-2 border-border bg-bg px-4 py-3">
              <FilterControls layout="bar" {...filterProps} />
            </div>
          )}
          {/* Held until preferences load (one frame) so the list doesn't render everything and
              then visibly shrink to a restricted view — see CLAUDE.md decision #14. min-height
              keeps the footer from jumping during that frame. `pb-28` clears the mobile dock. */}
          <div className="pb-28 lg:pb-4 min-h-[60vh]">{filmList}</div>
        </div>
      </div>

      {/* Mobile filter dock — fixed to the bottom of the viewport, scrolls sideways on overflow. */}
      {prefsLoaded && (
        <div className="lg:hidden no-print fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-bg px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <FilterControls layout="dock" {...filterProps} />
        </div>
      )}

      {/* Mobile plan — floating button + bottom sheet, above the filter dock. */}
      {planLoaded && (
        <div className="lg:hidden">
          <PlanButton
            count={dayPlanItems.length}
            combos={visibleCombos}
            items={dayPlanItems}
            transitions={dayPlanTransitions}
            suggestionDay={suggestionScopeDay}
            onSelect={toggleSelected}
            onRemove={toggleSelected}
            onClear={clearPlan}
            onPickDay={pickDay}
            keyOf={keyOf}
          />
        </div>
      )}
    </div>
  );
}
