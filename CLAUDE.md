@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts). Combines showtimes from **Light House Cinema**,
**IFI** and **Cineworld Dublin** — all scraped in full — into one place, with tools to plan a day
at the cinema, from a double bill up to back-to-back screenings. Cineworld is off by default and,
when on, its ordinary multiplex programme is hidden by the "Specials, etc" lens unless you ask
for it (decisions #14, #16). Built entirely through conversation with the user; this file exists
so a future session can pick up without re-deriving the reasoning.

**Public deploy runs on a weekly curated pipeline, not live scraping** (decision #9): a
manually-run script fetches the week, prints a plain-text report to review, and confirming
promotes it to the one committed data file the deployed app reads statically.

**Before any layout change, sketch the proposed result as ASCII and get sign-off first** — the
user iterates on layout a lot and wants to see the shape before code. This covers anything that
moves, resizes, reflows, merges or splits regions (columns, cards, bars, headers, panels), not
one-off spacing tweaks.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, cheerio (Light House / IFI HTML; Cineworld is
a JSON API), vitest. Component primitives are Radix, vendored in via neobrutalism.dev's shadcn
registry and restyled to our own tokens (decision #22) — with `class-variance-authority`, which
those files' `cva` variant maps need — plus vaul for the mobile drawers (#24);
icons are lucide-react (#23). No database. Committed in `data/`: `showtimes.json` (the published week) and
the curated override / editorial files (`title-overrides`, `letterboxd-overrides`, `film-labels`,
`hidden-films`, `language-overrides`, `director-overrides`); everything else in `data/` is
gitignored cache/staging.

## Architecture

### Data pipeline (server-only, weekly — `app/page.tsx` never runs it)

Runs only from `npm run fetch:batch`, i.e. once a week. `lib/scrapers/{lighthouse,ifi,cineworld}.ts`
(adapters, registry in `index.ts`) → `lib/aggregate.ts`, which per screening does
**`cleanFilmTitle` → drop hidden films → resolve Letterboxd (url, year, language, original title,
director) → fold the language into `screeningTags`** → `scripts/fetch-batch.ts` writes
`data/staging-batch.json` + the review report, `scripts/confirm-batch.ts` promotes it.

Supporting modules: `lib/{cache,titles,hidden,letterboxd,languageOverrides,directorOverrides,filmDiff}.ts`.

**All of that lives in the `fetch-films` skill** — `reference/pipeline.md` for the modules,
`reference/cinemas.md` for the three cinemas, `SKILL.md` for the weekly procedure. It's out of
context here on purpose: it's a weekly ritual, not something a UI change touches. Load the skill
before editing any of those files or debugging a wrong title / year / language / director.

The two pipeline outputs the **UI** actually depends on:

- `lib/groupings.ts` — `groupByFilm`: groups by cleaned title across cinemas *and* dates
  (case/whitespace-insensitive), so one film = one card with many pills.
- `lib/clash.ts` — `startMins`/`endMins` are **absolute-ordinal minutes** (`toOrdinalMinutes` =
  minutes since a fixed epoch), so a plan can span days and every gap calc stays a plain
  subtraction (decision #5). `itineraryTransitions` (gap/overlap/too-tight/`crossDay` between
  consecutive plan items — no max cap, a deliberate plan can have a long gap) and the one
  suggestion engine: **`planAdditions`** (every candidate that slots into a plan — checked against
  both its would-be chronological neighbours *on its own day*, gap between a cross-/same-cinema
  minimum and `MAX_COMBO_GAP_MINUTES`, allows the same film on another day), read two ways —
  `fittingAdditions` collapses it to `bookingUrl → tightness` for the card pills, and
  `bestAdditionPerSlot(additions, itinerary)` keeps the single tightest fit per open slot for the
  plan's ghost rows — dropping any film already in the plan **on any day** (decision #5).
- `lib/highlights.ts` — `isHighlight(screening, labels)`: the single definition of "interesting"
  (a surfaced special / a film format / a non-English original language / an **open-captioned**
  session / a `film-labels.json` film). Gates the "Specials, etc" lens (#14) *and* ranks the empty-plan seeds.
- `lib/startingPoints.ts` — `startingPoints(candidates, labels, spreadDays)`: what an **empty**
  plan offers, since there's no itinerary to slot into. One screening per timeframe
  (Early/Mid/Late), **specials first** (`isHighlight`), then — when `spreadDays` is on ("This
  week") — a day nothing's been picked from yet, then the earlier start, then the title. A film is
  only ever offered once. Decision #5.
- `lib/calendar.ts` — `planToICS(items, now?)`: the saved plan as one iCalendar file, a bare
  what/where/when VEVENT per pick. Pure and DOM-free (the browser half lives in `ScreeningBrowser.exportPlan`). Decision #21.
- `app/page.tsx` — server component, reads `data/showtimes.json` directly. Static per deploy
  (decision #3).

### `Screening.screeningTags: string[]` — the shared per-session vocabulary

Raw descriptors on a showtime, read by three sibling modules. Sources: Light House `em.additional`,
IFI format `svg[data-icon]`s, Cineworld's normalised API tags (decision #16), plus `aggregate`
appending the per-film Letterboxd language (#17) and `ScreeningBrowser` attaching a synthetic
`Mystery Matinee` render-time (#12).

- `lib/screeningTags.ts` — `displayScreeningTags` → surfaced special-audience / event strands
  (`Parent and Baby`, `Relaxed`/`Autism Friendly` → one `relaxed`, `Cinema Book Club`,
  `Silver Screen`, `Movies for Juniors`, `Mystery Matinee`). Each →
  `{ label, title, description, mark? }`. `mark: false` (Mystery Matinee) = still a
  surfaced special (Highlights, tooltip) but no mark / `FilmNotes` segment.
  `<SpecialsMark>` (`components/ScreeningTags.tsx`) is the mark itself — lucide's `FaceGrinning`, shared by
  all three surfaces that carry it; `<ScreeningTagMarks>` is the bare one on a pill / `DayPlan`
  row. `UNSURFACED` / `isUnsurfacedTag`
  is the opposite list — tags we recognise and deliberately don't show (`Big Screen Classics`),
  read only by the batch report. Decision #13.
- `lib/formats.ts` — `displayFilmFormats` → `35mm` / `70mm` / `IMAX` (`{ id, label, ratio, print,
  brandColor? }`). Decision #15.
- `lib/languages.ts` — `displayLanguage` → `{ language?, subtitled, openCaptioned, dubbed } | null`
  (original non-English language + per-session caption state); `matchesLanguagePref` for the
  Language preference. Decision #17.

### UI (all client, under `ScreeningBrowser`)

- `components/ScreeningBrowser.tsx` — the interactive core. Day/Cinema/Time filters
  (`null` = "This week"/"N cinemas"/"Any Time"), rendered by `components/FilterControls.tsx` in
  two shapes: `layout="dock"` — the mobile fixed-bottom bar, a flush **segmented** row
  (`ControlGroup`) that scrolls sideways; `layout="bar"` — the desktop sticky bar at the top of
  the film column, three **dropdown menus** (`FilterMenu`) + the Specials toggle, one compact
  row (decision #5, #7). Both consume the same `effective*` + `setActive*` prop bag. Plan
  selection is the persisted `flm-on:plan` store
  (`lib/plan.ts`, `planKeys` → `selectedKeys: Set<string>`), any number of screenings across any
  number of days. Owns the persisted preferences and applies them as the `preferred` pre-filter
  ahead of everything (decision #14). `effectiveCinema`/`effectiveDay`/`effectiveTimeframe` all
  revert a now-impossible value to "any"; `effectiveSelectedKeys` drops any plan key whose
  screening has genuinely gone (past week / started over ten minutes ago, decision #20) —
  resolved against `timedAll`, **not**
  the preference-filtered `timed`, so a preference change never counts as gone — and
  `toggleSelected` writes that pruned set back. Three pieces of ephemeral `useState` live here
  rather than in preferences — `highlightsOnly`, `nextWeek` (#18) and the two suggestion mutes,
  `dismissed` + `planCleared` (#5). The two-column shell is a bare `lg:grid` — right
  rail (`<Masthead>` + sticky `<PlanPanel>`), left column (sticky `FilterControls` + film list).
- `components/FilmCard.tsx` — one film's card. **Line 1** (`<h3>`): `[original title] TITLE [year]`
  — the black uppercase name flanked by `<TitleMeta>` (`font-normal text-dim`, title-sized,
  natural case); the original-language title shows before the name when `FilmGroup.originalTitle`
  is set. The `<FilmNotes>` marquee sticker sits right after the year (`ml-3`, its own `text-xs`,
  `vertical-align: middle` against the title) — moved off the meta line once it had grown.
  **Line 2** (`hasMetaLine`): cert, duration + director (both `text-base text-dim`), `<LanguageTag>`,
  format box(es).
  **Footer row** (`hasFooter`, `mt-16` — same gap as below the header, no divider): the cinema
  film-page links (`cinemaLinks` prop — one per cinema the film plays at across its *whole*
  preferred set, fixed regardless of the filter bar) as `text-dim` chips on the left, the
  Letterboxd three-dot mark on the right (`justify-between`). Whole row is `no-print`.
  Pills grouped by day then
  timeframe; each day's row is one non-wrapping `overflow-x-auto` strip (needs `relative` — the
  pills' `position:absolute` `.sr-only` spans would otherwise escape the clip and give the page a
  phantom horizontal scrollbar; `-mx-8 px-8` full-bleeds it past the card padding).
- `components/FilmNotes.tsx` + `components/MarqueeSticker.tsx` — the **one** dark scrolling
  sticker per card (`FilmNotes`, beside the year on the title line), carrying the special-screening name(s)
  *and* the curated editorial label (decision #11) joined by ` · ` (`<SpecialsMark>` + "parent &
  baby · 4k restoration"). The sticker *names* the strand; its tooltip is where the strand is
  *explained* — the sticker is the app's one dark surface, so a light tooltip beside it reads as
  an answer rather than a second sticker. **The tooltip is the strands only, and a label-only card
  gets none**: a curated label is already fully readable on the sticker, so repeating it on hover
  gave a tooltip identical to the thing being hovered. The `aria-label` still carries the label,
  since the visible marquee track is `aria-hidden` and that's its only copy. `MarqueeSticker` is `"use client"`: measures one copy and pins the track to
  `2×` that width in px so the keyframe's plain `translate3d(-50%…)` lands exactly on one copy
  (var-free keyframe → runs on the compositor; a `%`-of-`max-content` translate stutters at
  speed), plus an inline `animation-duration` (~40px/s, 4s floor). `--color-fg`/`--color-bg`,
  never accent; reduced-motion → static. The `tilted` header sticker also gets
  `will-change: transform` (its own layer — it sits in a rotated wrapper). `filmSpecialTags` (in `ScreeningBrowser`) feeds it the tags across the
  film's *whole* preferred set, so "parent & baby" stays on the card even on a day that
  session is filtered out. The per-pill marks stay per-session.
- `components/ScreeningTags.tsx` / `FilmFormats.tsx` / `ScreeningLanguage.tsx` — the pill/card
  renderers for the three `screeningTags` readers. `<LanguageTag>` = the per-film language name
  as a `--color-dim` speech bubble on the meta line — a `"use client"` component that measures
  its own text box (ResizeObserver) and draws the rounded-rect-plus-tail outline as one
  continuous SVG `<path>` (the box model can't miter a horizontal border into a 45° tail arm);
  `<LanguageMarks>` = the per-showtime `OC`/`ST`/`Dub` on a pill.
  `<FilmFormatTag>` = a box on the meta line sized so a bigger format is taller; 35mm/70mm
  are an animated film-strip (`print: true`), IMAX is a static IMAX-blue plaque.
- `lib/screeningTooltip.ts` — `screeningTooltip(tags)`: the three modules' `*Tooltip` helpers
  merged into one ` · `-joined string, `undefined` when there's nothing to explain. What a whole
  showtime says on hover, used by the film-card pills and both plan rows; the format box on the
  meta line keeps `filmFormatsTooltip` on its own, since it explains only itself. Both callers had
  grown identical private copies, which is how the plan rows stayed on a native `title` for a
  release after the pills moved to Radix.
- `components/PlanRow.tsx` — the two row treatments both plan surfaces are built from:
  `<PlanRow>` (solid, ink, `bg-surface` — a pick; click removes) and `<GhostRow>` (dashed, dim,
  unfilled — a suggestion; click adds). `showDay` names the day on a ghost, for the whole-week
  starting points. Neither carries an affordance glyph — see decision #7. Both explain their
  marks with the shared `screeningTooltip` string (`withTooltip` skips the wrapper entirely when a
  screening has nothing to say), repeated on the `aria-label` — the mobile plan sheet is the
  surface a native `title` served worst.
- `components/PlanPanel.tsx` — the one persistent plan surface. Empty → the `startingPoints` seeds
  as bare `<GhostRow>`s, no heading over them (dashed rows on an otherwise empty panel already
  read as an offer), falling back to a plain prompt when there's nothing to seed from; non-empty → `<DayPlan>`, a
  Clear button in the header and, at the foot of the list, the **Add to calendar** primary button
  (decision #21). Lives in the desktop right rail (sticky, own
  `overflow-y-auto`) and inside `components/PlanButton.tsx` — the mobile floating button + bottom
  sheet cloned from `SettingsPanel`. The button carries the plan-item count (decision #8) once
  there's a plan, shows **unbadged** while the plan is empty but seeds exist (the sheet is
  mobile's only route to them), and hides entirely when there's neither.
- `components/DayPlan.tsx` — the plan grouped into a section per day (`formatDayFriendly` +
  `formatDayDate` header, per-day film count + `~span`); within a day, the gap / an
  accent-coloured overlap-or-too-tight warning between consecutive screenings. A step across a day
  boundary (`ItineraryTransition.crossDay`) renders as the next day's header, never a gap.
  Also draws the **"choose this next" ghost rows** (`suggestions`, from `bestAdditionPerSlot`):
  a dashed, dim, unfilled `GhostRow` sitting at the slot it would take —
  addressed by the plan item it follows (`PlanAddition.afterKey`, `null` = before that day's
  first film). A ghost **replaces the real transition label of its slot**: instead of the one gap
  you have now you see the two you'd have if you took it (`gapBefore` above, `gapAfter` below,
  the latter emitted as the next row's incoming label). Click a ghost → `onAdd` → it's a real
  `PlanRow`; click that → `onRemove` → gone, and the ghost re-derives. **Neither row carries an
  affordance glyph** (the ghost's leading `+` and the plan row's trailing `×` were both removed —
  user's call): the whole row is the target, dashed-vs-solid already says which way a click goes,
  and the `aria-label` carries it for anyone who can't see that.
- `components/Masthead.tsx` — the "FLM ON" title + tagline, rendered by `ScreeningBrowser` (not
  `app/page.tsx`) so the `lg:` grid can move it into the right rail. Holds `PreferencesButton`
  only on mobile (`lg:hidden`) — on desktop that button lives in the filter bar (`FilterControls`
  `layout="bar"`, room to spare now the filters are menus).
- `components/CinemaWeekendBanner.tsx` + `lib/cinemaWeekend.ts` — the National Cinema Weekend
  note over the film list (an `<Alert>`), and the star beside those two days in both day pickers
  (`DayMark` in `FilterControls`, drawing the shared `<CinemaWeekendMark>` this file also exports —
  it lives here, not in the `.ts` lib module, so that module stays pure TS). Decision #19;
  self-expiring, the pair deletable whole.
- `components/{PreferencesButton,SettingsPanel,ActivePreferenceNote}.tsx` + `lib/preferences.ts`
  + `lib/duration.ts` — the preferences button, the overlay it opens, and the title-side marquee
  naming an active kids-only / language pref; all three share the store with `ScreeningBrowser`
  via `useSyncExternalStore`. Decision #14.
- `components/controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass(active)`, the accent-fill
  / hard-press "selected" segment styling shared by the filter bar and the settings panel.
- **The four notes over the film list are all one `<Alert>`** (`components/ui/alert.tsx`, #22):
  the National Cinema Weekend banner (#19), the "Next week (maybe)" banner (#18) and the two
  empty states — "Nothing lined up for next week…" and "Nothing on this week…/No screenings match
  this filter." (the latter carrying the preferences Reset). They had four copies of the same
  `bg-surface border-4 border-border rounded-card shadow-card p-4 sm:p-8` shell between
  `CinemaWeekendBanner` and `ScreeningBrowser`. Each leads with a lucide icon in the alert's
  gutter — `Star` / `CalendarClock` / `CalendarOff` / `SearchX`, ink, never accent. **The two
  banners pass `role="note"`; only the two empty states keep the Alert's default `role="alert"`**,
  which is an assertive live region and so belongs to a note that appears *in answer to* something
  you just did (a filter change), not to standing page furniture.
- `components/ui/` — vendored shadcn/Radix primitives, restyled to our tokens (decision #22).
  `tooltip.tsx`: the Radix structure verbatim so a future `shadcn add` diffs cleanly, with only
  `TooltipContent`'s class list ours (a small light card — `bg-surface text-fg`, `rounded-base`,
  `shadow-shadow`; the dark `bg-fg text-bg` treatment stays MarqueeSticker's, so a tooltip doesn't
  read as one more sticker). Portals to `body`, which is also what keeps it out of the film card's
  `overflow-x-auto` pill strip. `dialog.tsx`: the modal half of **both** overlays — used above
  `sm:` only, since below it they are `drawer.tsx` instead (decision #24). `DialogContent` carries
  its own bottom-sheet-to-centred-modal positioning and the app's `border-4 / rounded-card / shadow-card-lg` shell, with
  no animation and no built-in close button (both call sites draw their own).
  `dropdown-menu.tsx`: trimmed to Root / Trigger / Content / Item / Separator, `modal={false}`,
  `bg-surface` rather than the registry's gold `bg-main`, and positioned by Radix's Popper —
  which also makes the panel collision-aware, where the old `absolute left-0 top-full` could run
  off a narrow viewport. `alert.tsx`: the shell behind the four notes over the film list —
  registry structure with our card values, one `default` variant (their gold `bg-main` and their
  `bg-black text-white` `destructive` both dropped), `size-5` icons and no `line-clamp-1` on the
  title. `lib/utils.ts` holds the `cn` helper every such component wants.

## Decisions worth knowing before changing anything

1. **Light House multi-day data is fetched from an endpoint its `robots.txt` disallows.**
   Justified **only** because this is one deliberate fetch a week from a manual script
   (decision #9), not per-visitor scraping. If it ever goes back to a live per-request model,
   revisit — the "continuous automated access against an explicit disallow" objection comes
   straight back. Which endpoint and why it's the only way: `fetch-films` skill.

2. **Cinema-reported titles and years are not trustworthy** — IFI names a recurring-strand
   session after the *strand* rather than the film and tags it with the season's year; Light
   House and Cineworld stamp re-releases with the current year. Hence the curated override files
   and the weekly human review. A strand-aware model is still wanted (open question, same as
   `CINEMA BOOK CLUB:` / Mystery Matinee). Per-cinema detail: `fetch-films` skill.

3. **`app/page.tsx` is static, not `force-dynamic`.** It reads the committed `showtimes.json`;
   content changes only on redeploy. Don't reintroduce `force-dynamic` unless the page goes back
   to calling the live pipeline at request time.

4. **Letterboxd is the source of truth for a film's own facts.** The matched page supplies the
   **year the UI shows** (not the cinema's — so `Kiki's Delivery Service` reads 1989, not 2026),
   the primary language (#17), the original title, and the director(s) on the card's meta line.
   Links are resolved by **guessing the slug, not searching** (`/search/…` is Cloudflare-blocked).
   How the guess works, how it fails, and how to pin a bad match: `fetch-films` skill.

5. **A plan can span the week; it persists.** `lib/plan.ts` (`flm-on:plan` localStorage, same
   `useSyncExternalStore` shape as `lib/preferences.ts`) holds the picked `bookingUrl`s across as
   many days as you like, surviving reloads and return visits — the point of week-planning is
   coming back to it. Stale keys are filtered on read (`effectiveSelectedKeys`) and pruned on the
   next write. **The plan resolves against reality, the suggestions against your preferences.**
   `dayPlanItems` / `effectiveSelectedKeys` read `timedAll` (everything still ahead of us, before
   the preferences narrow it), so muting a cinema — or flipping the Highlights lens — leaves a
   confirmed film confirmed; only the day passing, the session starting (plus the ten-minute
   grace — decision #20) or the screening leaving `showtimes.json` prunes a pick. That matters twice over: without it `toggleSelected` writes the
   pruned set back and the pick is gone for good. Ghosts and seeds are the other way round and
   read `preferred` — what to *offer* you next is exactly what a viewing preference should steer. Tapping a showtime just adds it — the Day filter does **not** snap to it (that
   jump is disorienting across days now). The Day filter still **defaults to today** for
   *browsing*. **Suggestions are one mechanism, and they live inside the plan**: once you've
   picked something, each open slot on a day the plan touches offers one dashed ghost row — the
   tightest-fitting candidate for that gap (`planAdditions` → `bestAdditionPerSlot` → `DayPlan`).
   Taking one is a plain `toggleSelected`, so it's the same gesture as tapping a pill. **A film
   already in the plan is never *suggested*, on any day** — `bestAdditionPerSlot` filters it out.
   The looser same-day-only rule inside `planAdditions` stays, because it's also what fades the
   card pills, and choosing to see a film twice in a week is legitimate; volunteering one you've
   already committed to is just handing a decision back to you. Nor is a film you've **taken back
   out** this session (`dismissed`, a `Set` of film keys in `ScreeningBrowser`): re-offering what
   you just removed makes the removal look broken — the solid row simply goes dashed. **`Clear`
   goes further**: it dismisses everything it threw away *and* silences the empty-state seeds
   outright (`planCleared`) — having binned a whole plan you don't want three fresh films pushed
   at you in its place. Slot ghosts are untouched by that, so building a new plan gets them back.
   Both are ephemeral like the Highlights lens — a reload is a fresh slate, since a persisted "never show me this" list with no UI to review or
   undo it would be a trap. **Suggestions only**: the film's pills stay live, and this never feeds
   the "wouldn't fit" fade (it filters `additions` on the way into `bestAdditionPerSlot`, not
   `planAdditions`), so the next-best candidate takes the slot rather than the slot going empty.
   An **empty** plan has no slots, so it seeds itself instead: `lib/startingPoints.ts` offers one
   ghost per timeframe (Early/Mid/Late), **specials first** — if the app volunteers something
   unprompted it should be the 70mm print, not whichever wide release sorted first. Scoped to the
   pinned day (which defaults to today); on "This week" it draws from the whole week, prefers a
   distinct day per pick and each ghost names its own day. No heading over them. Like every plan tool it reads the full
   `preferred` set, so the Time and Cinema filters don't narrow it. The old
   pinned-day "Suggested double bills" list (`findCombos` / `ComboSuggestions` / `suggestionScopeDay`)
   is **gone** — it was a second, differently-shaped suggestion surface that only existed before
   your first pick, and a cross-day "pair" was never a plan anyway. Consequence, accepted: an
   **empty** plan now gets no suggestions at all, just "Tap a showtime to start a plan."
   The plan surface: a sticky `<PlanPanel>` in the desktop right rail, a floating
   `<PlanButton>` + bottom sheet on mobile. `lib/clash.ts` uses an **absolute-ordinal minute**
   model (`toOrdinalMinutes` = `daysBetweenISO(EPOCH, date)*1440 + toMinutes(time)`), so every
   gap calc is multi-day-correct and past-midnight end times no longer wrap. `itineraryTransitions`
   marks a day boundary as `crossDay` (rendered as a header, not "Overlaps 840min").
   `planAdditions` is **within-day only** and allows the same film on a *different* day — so a
   week-spanning plan only ever gets ghosts (and pill fades) on days it already touches. Both ends
   count as slots, so a plan gets a ghost *before* its first film and *after* its last whenever
   something actually fits there.
   `FilmCard`'s "wouldn't fit" pill fade only applies on days the plan already touches (`planDates`
   prop) — an untouched day is a fresh start.

6. **A screening's identity key is its `bookingUrl`.** Real listings can have two distinct
   bookable sessions for the same film at the same time. (They currently render as near-identical
   pills with no format label — a known minor gap.)

7. **Visual design: "chunky", not brutalist** (user's explicit call, ref inkwellgames.com). Warm
   cream page (`--color-bg`), near-white card (`--color-surface`), warm near-black ink
   (`--color-fg`/`--color-border`), rounded corners, hard (non-blurred, offset) layered shadows.
   Font: Elms Sans. All tokens in the `@theme` block of `app/globals.css`.
   - **Accent reservation:** the one accent (`--color-accent`, gold `#fdc732`) is for
     actionable things, the current selection, and — the one status use — the header
     `<ActivePreferenceNote>` "for kids!" marquee (a tilted gold sticker stuck over the title
     when the kids-only filter is on, decision #14); never plain decoration (the film-card
     `FilmNotes` marquee stays ink, and the sibling language tag is a plain dark tag). **Two**
     non-ink/gold colours are allowed, both third-party brand identities: the Letterboxd mark's
     orange/green/blue, and the IMAX format box's brand blue.
   - `body { cursor: default }` (an app, not a document); interactive elements set
     `cursor-pointer`, the film *name* opts back into `cursor-text` (it's the thing you copy).
   - **`--shadow-chip`** (two-tone "stacked card", 6px total reach) is the resting elevation of
     screening pills *and* filter-bar segments; pressed/selected translate a matching 6px to land
     where the shadow edge was, hover is a half-press (`--shadow-chip-half`, 3px).
   - **Segmented controls** (`ControlGroup` in `FilterControls`, settings `Segmented`): each segment
     has its own border + shadow, `-ml-0.5` merges adjacent borders into one line, only the group's
     end segments round outward, and every segment needs an explicit `relative` + ascending
     inline `z-index` (the active segment's `translate` makes a stacking context). **No
     "disabled" variant** — a segment you can't act on is removed from the row (or, if it's the
     last one, shown non-interactive). Don't reintroduce a greyed-out disabled state without
     asking. The one exception: `ControlGroup`'s sole option renders non-interactive only while
     `isActive` (it *is* the current view); when something else holds the view — the Day row's
     "Next week" preview (decision #18) — it becomes a real button, "take me back to this".
   - **Two filter-bar shapes** (`components/FilterControls.tsx`, chosen by `layout`):
     - `"dock"` — the mobile fixed-bottom bar: the flush **segmented** `ControlGroup` row above,
       scrolling sideways on overflow.
     - `"bar"` — the desktop sticky bar at the top of the film column: Day / Time / Place each
       collapse to a **`FilterMenu`** — a trigger button showing the current choice that opens a
       chunky dropdown (`shadow-card`, `z-40`, first row is the "any" option, Day's `footer` is
       the "Next week" affordance). A full week of day chips is far too many flush segments for a
       bar that isn't pinned to a screen edge. Built on Radix's dropdown-menu (decision #22) —
       dismissal, roving focus and keyboard navigation come from there; the parent still holds
       `openMenu` so only one is open at a time. Accent fill on a trigger = "this filter is
       narrowing the view"; open-but-default just presses in.
     The `"any"` / single-option / pinned-preference logic is the same across both (a menu with
     one real option, a hidden control when a preference pins it).
     - **The Place filter's "any" option names the cinemas it covers** — `cinemaAnyLabel` in
       `FilterControls`: "3 cinemas", or the place's own name if a single one is enabled. Not
       "Anywhere", which was a promise the filter can't keep (it only ever spans the cinemas the
       preferences allow). Counted from the **preferences** (`cinemasEnabled`, which also decides
       whether the control renders at all), not from `cinemasPresent`, so it doesn't flicker as
       you page through days. Same label in both shapes: the dock's "any" segment, and the bar's
       trigger + first menu row.

8. **No film-count / progress UI.** A "here are X films" counter was tried and rejected — the
   user said counters "add pressure". No running counts, badges, or the like in the main UI
   without asking. (An active kids-only / language preference is named on the title —
   `components/ActivePreferenceNote.tsx` — a gold sticker over the top / dark subtitle pills
   over the base, not a count.) The two sanctioned exceptions both count **the user's own plan**,
   never the catalogue: `DayPlan`'s per-day "{n} films · ~span" line, and the mobile
   `PlanButton` badge (how many screenings are in the plan). The Place filter's "3 cinemas"
   label (decision #7) is a count of *your own preferences*, not of what's on — same principle.
   A ghost row's gap numbers (decision #5) are in the same category as `DayPlan`'s existing
   transition labels: facts about *your* plan, not a tally of the catalogue.

9. **Public release = weekly curated pipeline, not live per-visitor scraping.** Live scraping on
   every request let any visitor trigger a scrape and gave no chance to catch mangled titles /
   wrong Letterboxd matches before users saw them. Now `fetch:batch` → human review →
   `fetch:confirm`, on Thursdays when the programmes turn over. Drove decisions #1 & #3;
   `app/actions.ts` + `RefreshButton` are gone. **`fetch:confirm` is not the publish gate — the
   push is**; `git checkout data/` reverts a whole run. **The review is the `fetch-films`
   skill** — don't run the refresh freehand.

10. **Installable as "flm on" (lowercase).** `<title>`, `appleWebApp.title`, and `manifest.ts`
    `name`/`short_name` are the lowercase string; the descriptive text is `description`.
    `app/manifest.ts` needs `export const dynamic = "force-static"` and **relative** URLs
    (`start_url: "."`, `src: "icon-192.png"`) so it works at the domain root locally and under
    the `/flm-on/` GitHub Pages basePath. Icons are **generated, committed PNGs** —
    `npm run gen:icons` (`scripts/gen-icons.tsx`, SVG → `sharp`) writes `app/icon.png` /
    `app/apple-icon.png` / `app/favicon.ico` (hand-rolled ICO container) / `public/icon-{192,512,
    maskable}.png`. Re-run if the palette changes.

11. **Curated editorial labels — `data/film-labels.json`.** `Record<"<title.trim().toLowerCase()>",
    string>` (e.g. `"classic!"`). **Render/build-time only** — `app/page.tsx` reads it and threads
    a `labels` map to `FilmCard`; not in `showtimes.json`, so editing a label needs only a
    rebuild. Rendered by `FilmNotes` in the same sticker as the special-screening name(s), joined
    by ` · ` — decorative (`--color-fg`/`--color-bg`, never accent/count). `fetch:batch` also
    **writes** pre-fills into this file during the weekly review (rules: `fetch-films` skill).

12. **The IFI "Mystery Matinee" strand is a redacted card.** `lib/mystery.ts` `isMysteryFilm`
    (`/^mystery matinee\b/i` on the cleaned title) gates `FilmCard` to drop the year + duration
    (IFI's are placeholders anyway) and render the title via `MysteryTitle.tsx` (each word behind
    a `--color-fg` block, transparent text under it for AT, click to reveal). The trailing
    `Month YYYY` is handled by a `stripAnnotations` regex so future months need no correction.
    `DayPlan` still shows its runtime (gap math). `ScreeningBrowser` attaches a
    synthetic `"Mystery Matinee"` `screeningTag` render-time so it passes the Highlights filter;
    its `KNOWN` entry is `mark: false` (no glyph/sticker — the redacted card is treatment enough).

13. **Special screenings get a per-session marker.** Light House tags them per showtime in
    `.time > em.additional` (`Parent and Baby`, `Cinema Book Club`, `Silver Screen`, plus caption
    notes `Subtitled`/`Dubbed`/`Open Captioned`); the adapter reads them into `Screening.screeningTags`
    verbatim. `lib/screeningTags.ts` `KNOWN` is the gate on what surfaces (widening = one entry),
    and `UNSURFACED` is its counterpart — tags we've *decided* not to show, kept out of the weekly
    report's "unrecognised" list so it stays a list of genuinely new strands;
    each entry carries a curated `title` + `description` (originally Light House's `data-tooltip`)
    used as the hover tooltip. **House style for those descriptions, and the format ones in
    `lib/formats.ts`: exactly one ` — ` per rendered string** — the title/description separator —
    **and none inside a description**, kept under ~90 characters. A pill can show a strand and a
    format at once (joined by ` · `), so a description that spends its own em-dashes leaves four
    or five of them in a row each meaning something different; and past ~90 characters at
    `max-w-[16rem]` the tooltip stops being a glance. Rendered as a bare `<SpecialsMark>` on each matching pill + the name once per card
    in `FilmNotes` — rationale (user): once the card names it you recognise the mark, so don't
    repeat words on every pill.
    - **The mark is lucide's `FaceGrinning`** (`<SpecialsMark>` in `components/ScreeningTags.tsx`),
      which replaced the `☻` text glyph — see decision #23 for why that one moved to an icon after
      the original rule had kept it as text. **It is still the same smiley**: the glyph became an
      icon, the mark itself didn't change. (A `Gem` was tried in passing and rejected — the user
      likes seeing the face, and the whole point of `☻` was that it reads as one.) **One component serves all three surfaces** — the pill /
      plan row, the `FilmNotes` sticker that names the strand, and the "Specials, etc" lens that
      filters on it — so the mark you scan a row of showtimes for can't drift from the one on the
      control that shows them. Same shape as `<CinemaWeekendMark>` (#19), and for the same reason.
      Lucide's outline, **not** the star's `fill-current`: the eyes and mouth are strokes drawn
      *inside* the circle, so filling it paints over the face. That does invert the old glyph's
      rationale — `☻` was picked over `☺` because a filled smiley held up better at small sizes —
      but a 2px-stroked circle with dot eyes reads at pill size where a hairline `☺` didn't;
      confirmed in the browser at 380px and at desktop width. The caller sizes it (`size-[1.1em]` on a pill,
      `1.15em` in the sticker and on the lens) — an icon fills its box where the smiley's ink sat
      well inside its em, so 1em would have read smaller than the glyph it replaced.
      `KnownTag` no longer carries a `symbol`: every surfaced strand wears the same mark, so it
      belongs to the renderer, not the data. The `FilmNotes` sticker holds **multiple** notes joined by ` · `
    (the old "one sticker max" rule is gone); `mark: false` tags contribute neither glyph nor
    name. Cineworld maps its `Showtime.Event.*` / `Showtime.Accessibility.AutismFriendly` onto
    this vocab (decision #16). `fetch:batch` prints
    a "Special screenings" + "unrecognised screening tags" section for review.
    - **`Big Screen Classics` is deliberately NOT surfaced** (user's call). Every other strand in
      `KNOWN` *does* something to the screening — Parent & Baby turns the sound down, Relaxed dims
      the lights, Silver Screen pours the tea, Movies for Juniors cuts the price. Big Screen
      Classics only states which film was picked, and Cineworld is the only one of the three
      cinemas that badges that, so an identical re-release at the IFI or Light House carried no
      mark and the tag read as a difference between the *films* rather than between the cinemas'
      marketing. The selection is still worth surfacing — via `data/film-labels.json`, which
      `fetch:batch` still pre-fills from this very tag ("40th anniversary", `classic!`) for the
      user to review. Curated beats automatic, so the label is the whole of what the strand gets;
      trimming one at review really does mean that film shows nothing. **The raw tag stays in
      `showtimes.json`** — the prefill reads it — and `isUnsurfacedTag` keeps it out of the
      report's unrecognised list. Its films no longer pass the Highlights lens on the strand
      alone, only on their label.
    - Not tagged: IFI's special-audience strands (only Cineworld + Light House are wired); IFI's
      "Archive at Lunchtime" strand (sole signal is the `filmPageUrl` slug — slug-derivation
      deliberately not done).

14. **Settings panel — persisted viewing preferences (localStorage).** One of two persisted
    stores — the other is `lib/plan.ts` (`flm-on:plan`, the saved plan — decision #5), a separate
    key with the same `useSyncExternalStore` + `normalize` shape.
    `lib/preferences.ts`: `Preferences` = `cinemas` / `timeframes` maps +
    `hideShortFilms` (**defaults on** — the archive strands are noise) + `kidsOnly` + `language`
    (`"any"`/`"english"`/`"non-english"`). `normalize` is a pure deep-merge onto
    `DEFAULT_PREFERENCES` that coerces bad types and drops unknown keys — the forward-compat seam
    (a breaking change would branch on a stored `version`). **Cineworld defaults *off*** (Light
    House + IFI are the everyday view; Cineworld is opt-in) — and a blob saved before the key
    existed takes that default. Read via `useSyncExternalStore` so SSR + first client render
    agree (no hydration warning); a `storage` listener syncs across tabs.
    - **Model: standing pre-filter — over browsing, not over your plan.** `preferred` (memo in
      `ScreeningBrowser`) carves the dataset down before anything else derives from it (the
      exception is the saved plan itself, which resolves against `timedAll` — decision #5), so turning a cinema/time off just shrinks a
      `ControlGroup`'s option list and it collapses on its own. When a preference pins a group to
      one value the corresponding filter-bar control isn't rendered at all
      (`cinemaFilterUseful` / `timeFilterUseful`). Controls-only — pills still label their cinema.
    - `lib/duration.ts` `isShortFilm` / `SHORT_FILM_MAX_MINS = 40` is **per-screening** (a mixed
      strand keeps only its long session); unknown runtime is never short. `kidsOnly` →
      `lib/certs.ts` `isKidFriendly` (IFCO `G`/`PG`/`12A` only; `15A`+ and *no listed cert*
      excluded).
    - **The Highlights toggle** ("Specials, etc", wearing `<SpecialsMark>`) is a filter-bar `useState`, **not** a saved
      preference — ephemeral, first in the bar (the lens reached for most). On → `preferred`
      keeps only screenings that are a surfaced special / a film format / a **non-English
      original language** (`hasNonEnglishLanguage`) / an **open-captioned session**
      (`hasOpenCaptions`) / a `film-labels.json` film. The two caption cases split here, and the
      split is the point: open captions are burned in, there are a handful a week, and the people
      who need them go looking for them specifically — which is exactly the test this lens
      applies, so they count (user's call, reversing the original rule). A plain subtitle track on
      an English film is neither scarce nor sought, so it still doesn't. This is also what keeps
      Cineworld's ordinary multiplex programme
      out of view (decision #16) — with it off and Cineworld on, you get the full slate. The
      empty-state Reset clears prefs **and** this toggle.
    - UI: `PreferencesButton` (Lucide `Settings2`, which draws sliders not a gear — no badge) → `SettingsPanel` (responsive
      modal / bottom sheet). Sits in the desktop filter bar (`FilterControls layout="bar"`) and,
      on mobile, top-right of the masthead. **The desktop filter-bar wrapper is opaque `bg-bg`,
      not `backdrop-blur`** — `backdrop-filter` would make it a containing block for the
      `position: fixed` `SettingsPanel` and trap the modal inside the sticky strip. An active
      **kids-only** or **language**
      preference (the two that narrow the films with no filter-bar trace) is surfaced instead by
      `components/ActivePreferenceNote.tsx`, layered on the "FLM ON" title (its wrapper is
      `relative w-fit`): **kids-only** → a `MarqueeSticker` (`tone="accent" tilted`, the one
      status use of the accent) `absolute`-positioned at an angle over the top-right of the
      title, lowercase `for kids!`, as if a kid stuck it on; **language** → two *static* dark
      pills (one
      per line, each hugging its own text, sentence-case) stacked and centred on the logo,
      pulled up so they sit over the base of the title: `Only films` / `in english` (or
      `not in english`). Both can show at once. Cinemas / times / hide-shorts get no indicator.
      Options are toggle
      buttons in `controlSegment.ts` style; the **Language** group is a `Segmented` single-select
      (flush, same treatment as the filter bar) where **pressing the option you're already on
      reverts to the default** (`any`) — the same gesture as a filter-bar control, rather than a
      dead click. Each group is one non-wrapping full-bleed
      `overflow-x-auto` strip (the film-card pill idiom) — options scroll sideways rather than
      stacking on a narrow screen. Cinemas + Times each require ≥1 on — the last
      remaining one locks (keeps the selected look, click is a no-op — not a greyed disabled
      state, decision #7).

15. **Film formats — 35mm / 70mm / IMAX** (`lib/formats.ts`, `components/FilmFormats.tsx`).
    Sources: Light House `35mm` in `em.additional`; IFI `svg[data-icon]` (`70mm`); Cineworld
    `Format.Projection.Imax` + a `": The IMAX Experience"` companion-movie the adapter folds in
    (decision #16). `<FilmFormatTag>` is a box on the meta line, all one width, `height = width /
    ratio` with ratio descending 35mm→70mm→IMAX so a bigger format is a taller box ("bigger =
    taller", not literal projection ratios). **35mm / 70mm (`print: true`)** get an animated
    film-strip treatment (sprocket rails + scrolling label reel, `.flm-filmstrip-*` in
    `globals.css`, frozen for reduced-motion/print). **IMAX (`print: false`)** is a normal
    digital projection, so a static plaque in IMAX brand blue (`#0057b8`, the second palette
    exception — decision #7). `<FilmFormatMarks>` = a bare ratio-shaped rectangle on a pill.
    Counts toward Highlights. Not part of the `FilmNotes` sticker. 4DX / ScreenX / Superscreen
    are recognised but deliberately unsurfaced.

16. **Cineworld Dublin — a JSON-API adapter, scraped in full** (`lib/scrapers/cineworld.ts`).
    Not a scrape: a public, unauthenticated JSON API on a Gatsby site (`robots.txt` empty).
    What matters outside a fetch is that **an ordinary wide-release showing ends up with no
    `screeningTags` at all** — nothing is dropped at scrape time, so the whole multiplex slate is
    in `showtimes.json` and it's the **"Specials, etc" Highlights lens** (decision #14) that keeps
    it out of view. **Cineworld also defaults off** in preferences. Consequence: its git diffs
    churn with wide-release showtimes.

    Endpoints, the tag-normalisation vocabulary, the separate `"…: The IMAX Experience"` movie
    record and the rest: the `fetch-films` skill's `reference/cinemas.md`.

17. **International / foreign-language support — `lib/languages.ts`.** The third `screeningTags`
    reader. `displayLanguage` → `{ language?, subtitled, openCaptioned, dubbed } | null`
    (`LANGUAGE_NAMES`, ~90 entries).
    - **Language is per-film** (from Letterboxd, folded into every screening's `screeningTags` at
      fetch time — so it covers every non-English film across all three cinemas, not just the
      ones a cinema tags), while **the caption state is per-session** (the cinema's own caption
      tags, with `Subtitled` assumed for an untagged non-English screening — except animation,
      which often screens dubbed, and except a session that already carries `Open Captioned`).
      How that's resolved and how to correct it: `fetch-films` skill.
    - **Open captions are their own state, not a flavour of `subtitled`.** They're burned into
      the print, always on screen, and carry speaker IDs and sound effects — and the two tags mean
      different things to different people: on a non-English film subtitles are *translation*,
      while open captions on an English film are an *accessibility* screening for deaf and
      hard-of-hearing viewers. Collapsing them (as `displayLanguage` used to) made those two
      sessions describe themselves with the identical sentence, which is exactly what someone
      choosing between them needs told apart. So: a separate `openCaptioned` flag, its own pill
      mark `OC`, and two tooltip sentences — "In Korean, with open captions" (the language
      already says what they're for; "open" only adds that they can't be switched off) versus
      "With open captions, including sound descriptions" (on an English film, what they carry
      beyond dialogue *is* the reason to pick that session). `captionMark` returns `OC` ahead of
      `ST`: an open-captioned session is always captioned, where `ST` only promises a track.
    - Render: `<LanguageTag>` = the language name only (meta-line chip); `<LanguageMarks>` = the
      per-showtime `OC`/`ST`/`Dub` on a pill (not repeated with the language). Not part of the
      `FilmNotes` sticker. **A non-English original language counts toward Highlights
      (`hasNonEnglishLanguage`), and so does an open-captioned session (`hasOpenCaptions`, #14);
      a plain subtitled or dubbed session of an English film does not.**
    - The **`language` preference** (segmented control `any`/`english`/`non-english`,
      `matchesLanguagePref`) filters `preferred` on whether `displayLanguage` found a non-English
      original language. `dubbed` is no longer filtered on — just the pill "Dub" mark.
    - **Every tooltip sentence opens with a preposition** ("In Tamil…", "With open captions…",
      "Dubbed into English"), so a row of pills reads in one voice; the dubbed-with-a-language
      case is "Originally in Spanish, dubbed into English" for that reason rather than the
      "Spanish film…" it used to be.

18. **"Next week" preview — the unconfirmed tease** (`lib/upcoming.ts`, `data/upcoming.json`).
    The day picker's **trailing "Next week (maybe)" affordance** (`ScreeningBrowser` — it
    *replaces* the old Wednesday-only "Come back Tomorrow!" note; `nextBatchLabel` is no longer
    used in the UI): on the mobile **dock** a trailing segment on the Day `ControlGroup`, on the
    desktop **bar** the `footer` row of the Day `FilterMenu`.
    Pressing it (`nextWeek` state, ephemeral like the Highlights lens) swaps the whole view for a
    short list of films coming *next* week, rendered **cards only, no session pills** (`FilmCard
    preview` — the sessions aren't confirmed) under a "the full list lands Thursday" banner. You
    leave by tapping a day / "This week" (which is why the mobile sole-day segment goes
    interactive here — decision #7); it's non-interactive / the selected row once it's the view
    you're on. Only if there are no visible days at all (stale data) does it stay a plain toggle
    so the preview can't dead-end. The Time / Cinema / "Specials, etc" controls and the
    plan/combo tools are hidden while it's on (the desktop plan rail too, unless the plan is
    non-empty).
    - **Source:** `fetch:batch` writes `data/upcoming.json` (`{ generatedAt, week, films }`) from
      a second scrape of next week, then it's **hand-trimmed** during the weekly review — same
      batch-writes / human-trims / build-time-read pattern as `data/film-labels.json`, and not
      staged or promoted. Selection rules and the trimming order: `fetch-films` skill.
    - `app/page.tsx` reads it at build (`loadUpcoming`), passes `upcoming` / `upcomingWeek` to
      `ScreeningBrowser`; `upcomingVisible` re-applies the cinema / kids-only / language
      preferences (not time / hide-shorts) — no length cap, the committed file is already
      hand-trimmed to a teaser list (**no count shown** — decision #8). The "Next week" segment
      only renders when `data/upcoming.json` has films. A film shows if *any* enabled cinema
      plays it, and its film-page links are filtered to the enabled cinemas (each `cinemaLinks`
      entry carries its `cinema` id for this) — matching a regular card. The card's merged
      `screeningTags` stay film-level (no per-cinema split), so a format/strand tag from a
      muted cinema can still ride along; harmless for a session-less tease and none of the
      surfaced ones render visibly without a pill.
    - `FilmCard preview`: header + meta line + `FilmNotes` + the film-page/Letterboxd footer,
      no showtime section at all. The label is the live `film-labels.json` value
      (`labels?.[key] ?? f.label`), so a label edit + rebuild updates it like any card.
    - **Coverage caveat:** Light House only exposes 9 days out, so next-week coverage leans on
      Cineworld + IFI.

19. **National Cinema Weekend — a date-boxed campaign note** (`lib/cinemaWeekend.ts`,
    `components/CinemaWeekendBanner.tsx`). Sat 5 / Sun 6 September 2026: admission from €4 at
    participating cinemas across the Republic (Screen Ireland-backed). Two surfaces, both fed by
    `cinemaWeekendDaysInView(effectiveDay, visibleDays)`: a **star before the day name** in both
    day pickers (the dock segment, the desktop menu row *and* its collapsed trigger — `DayMark`),
    and a **banner above the film list** — an `<Alert>` (#22) with the same star in its icon
    gutter, the same shell as the "Next week (maybe)" one.
    - **Shown on a pinned Sat/Sun *and* on "This week"** (user's call): "This week" lists those
      days' screenings, so hiding the note there would keep the offer from the view most likely
      to be open. Not shown on an ordinary day, and never in the Next-week preview.
    - **A star, not the specials smiley** — that mark means a strand *within* a day; this means the
      whole day is cheap. It **leads** the day name / the banner heading — the mark is what you're
      scanning the row for, so it shouldn't sit behind the label. Ink in both places, never
      accent: a selected day segment is already filled gold and the mark has to stay readable on
      it (decision #7), and the accent's one status use is spoken for (#14).
    - **It's lucide's `Star`, not the `★` character** (#23) — the one typographic mark that
      moved. Drawn `fill-current` rather than lucide's default outline, so at day-chip size it
      still reads as the solid star it replaces. **One `<CinemaWeekendMark>` serves both
      surfaces**, so the star on a day chip can't drift from the one heading the note that sent
      you there; the caller sizes it (`size-[1em] align-[-0.14em]` inline in a day name, the
      alert's own `[&>svg]:size-5` in the gutter). Always `aria-hidden` — the day picker already
      carried the campaign name in an `sr-only` span beside it, and the banner has it in the
      heading.
    - **The copy says "all three cinemas have tickets from €4"** — Light House Cinema, IFI
      Cinemas and Cineworld are all on the campaign's published participant list, so the app can
      say so flatly. **"From €4" stays hedged** because the campaign's own wording is a floor,
      not a flat rate. The days are named **without the month** ("On Saturday 5 and Sunday 6…"):
      the banner only ever shows on days that are hours away, and the sentence still reads right
      once a passed Saturday leaves it "On Sunday 6". The one other line is that screenings will
      go faster than usual — the actionable part for a planner.
    - **It expires by itself.** The days are two hard-coded ISO dates with their written-out
      labels (no general "campaign" facility for a thing that happens once), and `visibleDays`
      already drops days that have passed — so on the Sunday the banner narrows to Sunday, and
      after the weekend nothing renders. The module and its component can then be deleted whole,
      with no edit to any caller.

20. **A screening lingers ten minutes past its start time** (`GRACE_MINUTES` + `screeningCutoff`
    in `lib/date.ts`). Every "is this still on?" test in `ScreeningBrowser` — the
    `upcomingScreenings` filter, `visibleDays`, the initial `activeDay`, the `usableTimeframes`
    retirement — compares against that cutoff rather than the wall clock, so it also governs
    the plan (`timedAll` derives from it, so a pick isn't pruned the instant its film starts —
    decision #5). Why: you can still walk into a film ten minutes late, and a session
    disappearing out from under a plan you're halfway through is a worse failure than one you
    can no longer quite make.
    - `screeningCutoff` returns the same `{ date, time }` shape as `todayISO()`/`nowTimeISO()`,
      so it string-compares straight against a `Screening` with no parsing. It **crosses
      midnight rather than clamping** (at 00:05 it reads yesterday 23:55) so a late-night
      screening gets the same grace as any other — the accepted consequence being that
      yesterday can stay a visible day chip for those few minutes, which is honest: that
      screening really is still joinable. `cutoffMinsToday` (what retires a finished timeframe)
      is measured from the start of *today* and so goes negative there, retiring nothing.
    - `now` is still fixed at mount (not re-evaluated per render), so in practice a film leaves
      on the next load after the grace expires — the grace is also what keeps that staleness
      from ever reading as a film blinking out mid-glance.

21. **The plan exports to a calendar as one `.ics` file** (`lib/calendar.ts`, `planToICS`; the
    button at the foot of `PlanPanel`, the browser half in `ScreeningBrowser.exportPlan`). The plan
    is the app's one piece of durable user state and it only existed inside the app; this is the
    way out. **One file for the whole plan**, not one per day or per screening: the plan is framed
    as a single week-spanning thing (decision #5), and an `.ics` holds many VEVENTs, so it imports
    as one ordinary calendar event per pick — in its own slot, on its own day, in whichever
    calendar the OS picker chooses. It does **not** create an "FLM ON" calendar.
    - **It's an export, not a sync, and that asymmetry is the thing to know.** Import can add and
      update but never delete, so a film you take back out of the plan stays in the calendar until
      you remove it there. What it *can* avoid is duplicating: each `UID` is a stable FNV-1a hash
      of the screening's `bookingUrl`, so exporting again after adding a film updates the events
      already there. The caveat is the button's tooltip (`EXPORT_CAVEAT` in `PlanPanel`) — it
      can't fit in a label, and leaving it unsaid would make the first surprising re-import read
      as a bug. It's the one tooltip in the app whose text is nowhere else in the UI, so the
      button's `aria-label` spells it out in full rather than stopping at "Add to calendar":
      a tooltip is a hover/focus surface, and on a phone that label is the only way to it. Keying the `UID`
      on the `bookingUrl` alone (not the time) is deliberate: a cinema moving a session should
      *update* the event, not leave a stale one beside a new one. Light House's scraped
      `bookingUrl`s carry a literal newline mid-query-string, so whitespace is stripped before
      hashing — otherwise the "stable" id rests on an accident of the scrape.
    - **Times are `TZID=Europe/Dublin` with a static `VTIMEZONE`**, not floating. Nothing in this
      repo computes a UTC offset and this avoids having to: the EU DST rules are fixed, so two
      `RRULE`s are correct in any year. Floating times are shorter but silently wrong the moment
      the device leaves Irish time. `DTEND` is derived from `endMins`, never from `s.date` — those
      are absolute ordinal minutes (`lib/clash.ts`), so a late film genuinely ends on the next date.
    - **The export reads `dayPlanItems`**, so it inherits decision #5: your plan resolved against
      reality, not the preference-filtered view. Muting a cinema never silently drops a confirmed
      film out of the file.
    - **The event is what / where / when and nothing else** (user's call) — `SUMMARY`, `DTSTART`,
      `DTEND`, `LOCATION`. No `URL` and no `DESCRIPTION`: the film's own details (director, year,
      cert, runtime, format / language / strand notes) are what the app itself is for, and by the
      time an event is sitting in your calendar you've booked and you know what you're seeing. The
      accepted consequence is that an event built on the `DEFAULT_DURATION_MINS` fallback no longer
      says its end time is a guess — nothing in the file marks an estimated runtime.
      `LOCATION` is `CINEMA_ADDRESS` (`lib/cinemas.ts`),
      and **its exact shape is load-bearing**: a calendar geocodes LOCATION as a *place lookup*
      rather than printing it, and only draws a map when that resolves. It needs the venue's
      registered name on its own first line, then the canonical postal address ending in the
      country — "Cineworld Cinemas", not the app's "Cineworld Dublin"; "Irish Film Institute
      (IFI)"; "6 Eustace St", not spelled out; no invented "Temple Bar" line. Written the obvious
      longhand way it silently resolved to nothing and every event showed no map. The name/address
      break is a real newline in the constant, escaped to `\n` on the way out. Don't tidy them onto
      one line and don't substitute `CINEMA_LABEL` — that's the app's short name, not the map's. `DESCRIPTION` carries director/year, cert + runtime, and the format / language /
      special-strand notes from the same three `screeningTags` readers the card uses. When the
      runtime is the `DEFAULT_DURATION_MINS` fallback it says "(estimated)" rather than letting the
      calendar present a made-up end time as fact.
    - **Built in the browser**, because `output: "export"` plus a `basePath` that differs between
      local and CI rules out any route. Web Share (`navigator.canShare({ files })`) first — installed
      to the home screen (decision #10) that's the difference between iOS offering Calendar directly
      and a file landing in Downloads — falling through to a blob + `<a download>` on desktop.
    - **The button is the plan panel's one primary control** — the app's accent-fill + 2px border +
      `shadow-chip` hard-press language, sized to hug its label and centred, sitting inside the
      panel's scrolling body after the last row (you reach it by reaching the end of the plan). The
      accent is legitimate here rather than a decoration: decision #7 reserves it for actionable
      things, and this is the plan's payoff action. Deliberately **not full-width** — a gold slab
      spanning the panel sits too close to reading as one more plan row — and `Clear` stays a bare
      underlined text button, so the surface has exactly one primary. `mt-6` clears both the last
      row and the shadow's offset.
    - The generator is pure and lives in `lib/`, which is the only reason it has tests
      (`test/calendar.test.ts`); the component half stays thin. Line folding is UTF-8-octet-aware
      and never splits an escape pair.

22. **Component primitives are vendored from neobrutalism.dev's shadcn registry — their
    structure, our values** (`components/ui/`, `lib/utils.ts`, the token bridge in
    `app/globals.css`). The app had hand-rolled every interactive surface: tooltips were the
    native `title` attribute (unstyleable, unpositionable, ~1s on the OS's own timer, and it
    never fires on touch at all — **no `title` attribute is left in the app**, and adding one
    back is a regression), and three separate overlays — `FilterMenu`'s own `pointerdown`
    + Escape listener, `SettingsPanel` and `PlanButton` — each declared `role="dialog"
    aria-modal="true"` with no focus trap, no focus restore and no inert background. Radix does
    all of that properly, and shadcn components are **copied source, not a dependency**, so
    taking them costs nothing in control.
    - **Decision #7 is unchanged — still chunky, not brutalist.** What was adopted is their token
      *vocabulary* (`bg-main`, `rounded-base`, `shadow-shadow`, `translate-x-boxShadowX`), not
      their look: 5px corners, a flat single-tone black shadow and pure black on cool grey are
      exactly what #7 was written to rule out. The bridge maps every one of those names onto the
      values we already had, so a copied-in component comes out looking like this app.
    - **The bridge is shaped as `:root` raw values + an `@theme inline` mapping**, which is the
      shape neobrutalism.dev's styling customizer emits. A future paste from it drops into the
      `:root` block and nothing else moves. Note the customizer itself caps radius at 15px and
      only emits a single-tone shadow — its output is a *starting point* to hand-edit, which is
      why our `--border-radius: 16px`-class values and two-tone `--shadow` live there directly.
    - **`--box-shadow-x/y` is the shadow's total REACH (6px), not its 4px offset.** Their shadow
      is single-tone so the two are the same number; ours wraps a 4px grey block in a 2px ink
      ring. Set it to 4 and every component's press lands 2px shy of the edge it's meant to fall
      into. This is the one value in the bridge that is not a straight copy of theirs.
    - **`--main` is our gold, so never take `variant="default"` unexamined.** Their components
      default to `bg-main` as an ordinary fill; ours reserves the accent for actionable and
      selected things (#7). Restyle to `neutral` on the way in — the tooltip is the card
      treatment (`bg-surface text-fg` + ink border + `shadow-shadow`) for exactly this reason,
      not `bg-main`.
    - **A Radix tooltip is a hover/focus surface: touch never opens one.** That's not a
      regression (native `title` did nothing on touch either), but it does mean the text has to
      exist somewhere a screen reader and a phone can reach — so every tooltip in the app has the
      same string on an `aria-label` (the pill, both plan rows, the format box, the `FilmNotes`
      sticker, the calendar button). Don't let the tooltip become the only copy. Two `title`s were
      *dropped* rather than converted, for saying nothing the visible text didn't already: `"for
      kids!"` on the sticker reading "for kids!", and `"Letterboxd"` on a link already labelled
      "View on Letterboxd".
    - One shared `TooltipProvider` is mounted at the `ScreeningBrowser` root rather than one per
      tooltip: that's what gives the "already showing one, move along the row of showtimes, no
      fresh delay" grouping. `delayDuration` is 300ms — Radix's own default of 0 makes a row of
      pills flash tooltips as you scan across it.
    - **No enter/exit animation on the dialog, and that is a correctness rule rather than taste.**
      A page that isn't being rendered — a backgrounded tab, the installed app behind the home
      screen — doesn't tick CSS animations at all, while `animation-fill-mode` still pins the
      element to frame 0. Radix keeps a node mounted until its exit animation fires
      `animationend`, and it mounts the scroll lock on the **overlay**, so a stalled exit strands
      `data-scroll-locked` on `<body>` — `overflow: hidden !important`, an unscrollable page —
      until the tab is looked at again. A stalled *enter* is the mirror image: the panel sits at
      `opacity: 0`, 16px low, i.e. it opens invisible. Both self-heal the moment the page renders
      again, which is precisely what makes them impossible to reproduce on demand. The surfaces
      these replaced had no animation either, so removing it also kept the swap invisible. Add
      motion to a Radix surface here only with a plan for the not-rendered case. (The tooltip
      still carries its registry animations: it's a hover surface, so it can only open on a page
      that is already rendering, and a stalled exit merely leaves it on screen until you look
      back. Same class, much smaller blast radius — but it is the same trap.)
    - **`DialogContent` positions itself; it is a direct child of `DialogPortal`.** `DialogPortal`
      wraps each of its children in its own `<Presence>`, so a positioning `<div>` around Content
      makes Content a grandchild and the wrapper unmounts out from under it. Centring at `sm:` is
      `inset-4` + `m-auto` rather than `-translate-1/2`, so that if motion is ever added back the
      keyframes' own `transform` can't drop a static translate mid-animation.
    - `components.json` points the shadcn CLI at our root-level `@/` layout (no `src/`), so
      `npx shadcn@latest add https://neobrutalism.dev/r/<name>.json` lands in `components/ui/`.
      Adopted so far: **tooltip**, **dialog** and **alert** — the dialog covering both overlays,
      since neither the registry's centred-only `dialog` nor its edge-anchored `sheet` matches
      this app's one shape (a bottom sheet on mobile that becomes a centred modal at `sm:`).
      **`alert` is the first one that brought a dependency**: `class-variance-authority`, which
      every registry component with a `variant` prop is written against. Hand-rolling around
      `cva` would have made this the first vendored file that *doesn't* diff cleanly against a
      future `shadcn add`, which is the whole point of taking their structure.
      Every hover surface is a `<Tooltip>`: the showtime pills (`FilmCard`), the plan and ghost
      rows (`PlanRow`, via `withTooltip`), the format boxes on the meta line (`FilmFormats`), the
      `FilmNotes` marquee and the calendar button (`PlanPanel`). `MarqueeSticker` takes a `ref` and
      spreads the rest of its props onto its outer span purely so `TooltipTrigger asChild` can
      clone it.
      `SettingsPanel` and `PlanButton` render `<DialogContent>` above `sm:` (and a vaul
      `<DrawerContent>` below it — #24) and no longer hand-roll a backdrop, an Escape listener or a
      scroll lock; `PreferencesButton` and `PlanButton` each
      dropped an entire `useEffect`. `FilterMenu` uses **dropdown-menu** (not `popover`): its rows
      already claimed `role="menuitemradio"`, so the menu primitive is the honest one — and it
      brings the arrow-key / Home / End / typeahead navigation those rows had always advertised
      and never had. Nothing hand-rolled is left.
    - **`modal={false}` on the dropdown, and that is not cosmetic.** Radix defaults menus to
      modal, which mounts `RemoveScroll` and puts `pointer-events: none` on `<body>`. For a
      filter bar that is wrong twice over: the film list underneath should stay scrollable while
      you pick a day, and a scroll lock is precisely what strands `data-scroll-locked` if its
      exit ever stalls.
    - **Two things Radix's `asChild` will not let a child override.** `role` is applied by the
      Radix primitive *before* it spreads your props, so `role="menuitemradio"` has to be handed
      to `DropdownMenuItem` — set on the child button it is silently replaced by `menuitem`
      (`aria-checked`, by contrast, does survive from the child). And `data-highlighted`, Radix's
      own keyboard-cursor flag, never lands on these rows at all, so **the menu's focus cursor is
      anchored on `:focus`** — an inset outline, applied in both states so it still reads on the
      gold selected row. Suppressing the outline centrally in `ui/dropdown-menu.tsx` would remove
      that cursor from every caller, which is why `DropdownMenuItem` sets no `outline-hidden`.
      **Confirmed by hand in a real browser** — it cannot be checked from an automated pane, where
      `document.hasFocus()` is false and `:focus` therefore matches nothing however correct the
      CSS is.
    - **A close only clears the slot it owns** (`menuOpenChange` in `FilterControls`). Pressing a
      second trigger while a menu is open fires both a close (the press is outside the first
      menu) and an open, in either order; clearing `openMenu` unconditionally on close would
      sometimes wipe the menu that had just opened, so moving between filters took two clicks.
    - **Three things about `alert` worth knowing before editing it.** Its `role="alert"` is an
      assertive live region, so it is right only for a note that appears in answer to something
      you just did; the standing banners pass `role="note"`, which works with no edit to the
      vendored file because it spreads props *after* `role` (the opposite of what `asChild` does
      two bullets up). `AlertDescription` is a **grid**, so a bare text node and an inline
      `<button>` beside it become two rows — the empty state's "…your current view. Reset" has to
      sit inside a `<p>`. And the registry's `line-clamp-1` on `AlertTitle` is dropped: these
      titles are sentences ("It's National Cinema Weekend!") and truncate on a phone otherwise.

23. **Icons are `lucide-react`.** Chosen because it needs nothing bent to fit: Lucide's defaults
    *are* this app's drawing spec — 24 viewBox, `fill: none`, `currentColor`, 2px stroke, round
    caps — which is exactly what the hand-rolled preferences glyph had already been written to.
    It's also in Next 16's built-in `optimizePackageImports` list, so a named import is
    tree-shaken with no config; verified on a real build — the one icon's path data ships in a
    single chunk and no other icon's does.
    - **Both typographic marks have now moved to icons, and neither reason for keeping them
      survived contact.** `★` went first (National Cinema Weekend, #19): the "it's read out" half
      was never true of the glyph — `DayMark` has always rendered it `aria-hidden` with an
      `sr-only` name beside it, so the label was doing that work, not the character — and it sits
      in plain flow text with nothing measuring it. Drawn `fill-current` so it stays the solid
      star it was.
    - **Then `☻` went too** (a surfaced special, #13 — now `<SpecialsMark>`, lucide's
      `FaceGrinning`, i.e. the same smiley redrawn as an icon). The
      objection had been mechanical: the mark rides inside `MarqueeSticker`'s scrolling track,
      which measures one copy of the string and pins the track to `2×` its width in px, and an SVG
      in a measured text run looked like a real complication. **It isn't — it's the opposite.** An
      icon sized in `em` has a deterministic width that doesn't depend on which font has loaded,
      so it's *more* stable under that measure than the glyph was; confirmed in the browser, where
      the track measures exactly `2×` the item and the two copies agree to a fraction of a pixel.
      (The `document.fonts.ready` re-measure still earns its keep for the text beside it.) The
      other half — that at pill size it sits among `OC` / `ST` / the ratio boxes and has to
      inherit the type's size and weight — is handled the way `CinemaWeekendMark` handles it: the
      caller sizes it in `em` and `currentColor` does the rest.
    - **No text glyph is load-bearing any more.** If a third one ever comes up, the bar is
      whether an `em`-sized icon can carry it — not the old blanket rule.
    - Likewise untouched: the **Letterboxd** three-dot mark (a brand identity, #7), the
      `<LanguageTag>` speech bubble (drawn to a measured text box, #17) and the film-format strips
      (#15) — all bespoke SVG that no icon set has.
    - Adopted so far: **`Settings2`** on `PreferencesButton` — despite the name it draws sliders,
      so #14's "sliders, not a gear" still holds; it cost one of the previous three tracks and
      kept the round knobs, which was the trade the user picked over `SlidersHorizontal`'s
      three-tracks-with-tick-marks. Then the four notes over the film list (#22): **`Star`**
      (shared with the day pickers), **`CalendarClock`** on "Next week (maybe)", **`CalendarOff`**
      and **`SearchX`** on the two empty states. Then **`FaceGrinning`** as the specials mark
      (#13), replacing the last of the two text glyphs.
    - The `▲`/`▼` on the filter-bar triggers and the `×` close controls are still text
      characters. Converting them is a live option, deliberately not taken yet.

24. **Below `sm:` both overlays are a vaul drawer; above it they stay the centred modal**
    (`components/ui/drawer.tsx`, `lib/useIsCompact.ts`). The user's call after feeling both on a
    phone: a bottom sheet you can fling away beats a modal you have to aim at a close button for,
    and the plan especially is opened one-handed mid-browse. Above `sm:` a drawer would be wrong —
    a settings panel glued to the bottom of a 1280px window is not a modal, so `DialogContent`
    stays there.
    - **The breakpoint lives in exactly one place** — `useIsCompact()`, 640px, which is the same
      line `DialogContent` already switches its own positioning on, so the app keeps one idea of
      "phone-shaped" rather than gaining a second breakpoint. Built on `useSyncExternalStore` like
      `lib/preferences.ts` and `lib/plan.ts`: the server snapshot resolves "not compact", so SSR
      and the first client render agree and hydration stays clean; React then re-renders with the
      real value. Invisible in practice because neither overlay is ever open on first paint. It
      re-evaluates live — resizing across 640px swaps the shell with no reload.
    - **`PreferencesButton` owns the decision and passes `compact` down to `SettingsPanel`**, so
      the Root that opens and the Content that renders can never disagree. Both halves have to
      match: a `<DrawerContent>` inside a `<Dialog>` finds no context.
    - **`DialogTitle` / `DialogDescription` are used inside the drawer too, deliberately.** vaul is
      built on `@radix-ui/react-dialog`'s own primitives (its `Drawer.Title` *is*
      `DialogPrimitive.Title`) and npm dedupes us to a single copy, so the context is shared. That
      is the whole reason `SettingsPanel` needs only one set of title components rather than a
      per-shell pair. If a second copy of `@radix-ui/react-dialog` ever gets installed, this breaks
      — and it breaks as a context error, not a style bug.
    - **`shouldScaleBackground` is forced to `false`.** The registry defaults it true, which writes
      `document.body.style.background` (black) and only does anything if the app wraps its content
      in a `[vaul-drawer-wrapper]`. On a warm cream page that is a visible regression for an effect
      nobody asked for.
    - **vaul is structurally safer than Radix Presence for decision #22's animation trap**, which
      is why a drawer may animate where the dialog may not: it has **zero** `transitionend` /
      `animationend` handlers and unmounts on a `setTimeout`, so it does not hang forever on a page
      that is not being rendered. It has its own scroll lock (`usePreventScroll`, `position: fixed`
      on `<body>` with a saved offset) rather than Radix's `overflow: hidden`. **Teardown
      confirmed by hand**: open the drawer, close it, the page still scrolls. Worth knowing that
      this is not observable in an automated pane — a page that isn't rendered throttles vaul's
      unmount timer indefinitely, so the sheet appears to hang open there and does not.
    - **Costs, accepted:** ~68KB of shipped JS (856K → 924K of chunks), and vaul has not published
      since December 2024. It declares React 19 in peers and works on 19.2.
    - The sheet is flush to the screen edges, so it carries `pb-[env(safe-area-inset-bottom)]`
      itself — nothing else is clearing the home indicator for it.
    - **Bottom-anchored, not right — considered and rejected.** vaul supports `direction="right"`,
      but its `shouldDrag` returns `true` unconditionally for `left`/`right`: every nested-scroll
      guard it has (the `scrollTop` checks, the `scrollLockTimeout`) runs only for `top`/`bottom`,
      and it never reads `scrollLeft`. The settings panel is four full-bleed `overflow-x-auto`
      option strips (#14), so a side sheet would put the dismiss gesture on the *same axis* as the
      content's own scrolling — swiping the Cinemas row to reach Cineworld would fling the drawer
      shut. `data-vaul-no-drag` on the strips does fix it, at the price of not being able to
      dismiss from an option row at all. A bottom sheet keeps the dismiss axis perpendicular to
      the scroll axis, which is a large part of why it feels right; that's the reason to keep it,
      not inertia.
    - **Neither drawer has a `×`** (user's call): you fling it down or press the scrim, and a close
      control sits exactly where the thumb starts the drag. `SettingsPanel` gates its button on
      `!compact`; `PlanButton` passes no `onClose`, which is already how `PlanPanel` decides
      whether to draw one. Both keep it in the modal, where there is nothing to drag.
    - **The drawer's horizontal padding goes on the SCROLLING element, not on `DrawerContent`.**
      The settings option strips full-bleed themselves with `-mx-6 px-6`, which only cancels out
      when that padding is on the same box that clips them — the modal gets this for free by
      putting `overflow-y-auto p-6` on one node. Split across two it left ~29px of sideways scroll.
    - **`Group`'s `<fieldset>` needs `min-w-0`.** A fieldset defaults to `min-width: min-content`
      and will not shrink below it, and the strip inside is deliberately 48px wider than the box,
      so the fieldset propped the panel open ~5px and the whole thing scrolled sideways. Its
      computed `min-width` still reports `0px`, which is what makes this one hard to see. It
      applies to the modal too — the bug was latent there, the drawer just made it obvious.

## Known gaps

- No tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`).
- Duplicate-session pills aren't visually distinguished (#6).
- **Nothing enforces the Thursday cadence** — a skipped refresh just keeps serving last week's
  `showtimes.json` silently.
- **Nothing alerts on a silent scrape failure**, and several classes of bad data (a wrong
  Letterboxd match, an untagged strand, a wrong language, a dropped format icon) are only ever
  caught by eye during the weekly review. The batch report has a section for each; the
  **`fetch-films` skill** enumerates them and says what to look for. Nothing is automatic.
- **`CINEMA_ADDRESS` is hand-maintained with nothing to verify it** — three constants read only by
  the calendar export (#21), and correctness there means "a calendar geocodes it to the right
  pin", which no test can assert: the unit tests only prove the string reaches the file intact.
  Confirmed once by hand in Calendar. A cinema that moves, a typo'd Eircode, or a tidy-up of the
  name/address line break all break the map silently. Light House's entry is the thinnest and
  resolves off the venue name alone.
- **Cineworld "highlight" detection is tag-based only** — a plain-digital showing of an
  interesting film shows only with the Highlights lens *off*, buried in the full multiplex slate,
  with no per-title allowlist to promote it.

## Running it

- `npm run dev` — dev server. To open it on a phone over the LAN, that host has to be listed in
  `allowedDevOrigins` in `next.config.ts` — Next 16 blocks cross-origin requests for `/_next/*` dev
  resources by default, and the failure is silent and confusing: the HTML arrives, no JS loads, so
  `ScreeningBrowser` never hydrates and the page just stops after the masthead. Dev-only; it has no
  effect on `next build` or the export.
- `npx vitest run` — unit tests
- `npm run build` — production build; check `/` stays `○ (Static)` (decision #3)
- `npm run fetch:batch` / `npm run fetch:confirm` — the weekly refresh (decision #9). **Driven by
  the `fetch-films` skill**; don't run them freehand
- `npm run gen:icons` — regenerate app icons + favicon (decision #10)

## Working on this

- **Before calling anything done:** `npx vitest run`, then `npm run build` and confirm `/` is still
  `○ (Static)` (decision #3). A UI change also needs a look in `npm run dev` — the marquee, sticker
  and segmented-control work is all pixel-level, and type-checking proves nothing about it.
- **This file is part of the change.** Nearly every feature commit here touches CLAUDE.md in the
  same commit — a new decision gets a numbered entry with its *reasoning*, a reversed one gets
  rewritten, not appended to. If a change makes a paragraph here wrong and you don't fix it, the
  change isn't finished.
- **So is the `fetch-films` skill** (`.claude/skills/fetch-films/`) — the weekly-refresh runbook
  and the per-cinema reference. A change to a scraper, an override file, the report or the
  aggregate pipeline updates the skill in the same commit, exactly like this file. It's out of
  context most sessions, which is the point *and* the risk: nothing will tell you it has rotted.
- **Root causes only.** The scrapers already degrade silently (see Known gaps); a patch that papers
  over a parse failure instead of fixing the selector hides a real break.

## Data files (`data/`)

**Committed and read at build time:**
- `showtimes.json` — the published week. Screenings may carry `screeningTags: string[]` (shared
  vocab — decisions #13/#15/#17), `originalTitle` (#16) and `director` (#4).
- `upcoming.json` — the hand-trimmed "Next week" tease (#18).
- `film-labels.json` — the curated editorial labels (#11). **The only override file a rebuild
  picks up**; edit it and reload.

**Committed, but applied at fetch time** (baked into `showtimes.json`, so editing one needs a
re-fetch): `title-overrides`, `letterboxd-overrides`, `hidden-films`, `language-overrides`,
`director-overrides`. Exact key formats are in the `fetch-films` skill's fix table — don't guess
one from memory.

**Gitignored**, regenerated by the weekly scripts: `cache.json`, `letterboxd-cache.json`,
`staging-batch.json`.
