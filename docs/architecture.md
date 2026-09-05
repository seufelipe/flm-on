# Architecture, in full

The complete component-by-component notes, verbatim from CLAUDE.md, which now carries a
compressed index instead. Everything here is still current — it was moved for context size, not
because it stopped mattering.

**Read this before working on a component you haven't touched before, and update it in the same
commit** — the same discipline CLAUDE.md, `docs/decisions/` and the `fetch-films` skill are under.
Per-decision reasoning lives in `docs/decisions/`; the weekly pipeline lives in the `fetch-films`
skill.

---

## Architecture

### Data pipeline (server-only, weekly — `app/page.tsx` never runs it)

Runs only from `npm run fetch:batch`, i.e. once a week: `lib/scrapers/` → `lib/aggregate.ts` →
`scripts/fetch-batch.ts` (staging + review report) → `scripts/confirm-batch.ts` (promote).

**The whole of it lives in the `fetch-films` skill** — `reference/pipeline.md` for the modules and
the order they run in, `reference/cinemas.md` for the three cinemas, `SKILL.md` for the weekly
procedure. It's out of context here on purpose: it's a weekly ritual, not something a UI change
touches. Load the skill before editing any of those files, any `data/` override file, or before
debugging a wrong title / year / language / director — don't work from what's left here.

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
  **Line 2** (`hasMetaLine`): cert, duration + director (both `text-base text-dim`, each led by a
  1em lucide icon that hugs its own text — `Hourglass`, and `User`/`Users` split on the
  comma-joined director string, #23), `<LanguageTag>`, format box(es).
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
  showtime says on hover, used by the film-card pills; the format box on the meta line keeps
  `filmFormatsTooltip` on its own, since it explains only itself. The plan rows still build the
  same string, but only for their `aria-label` — they show no tooltip.
- `components/PlanRow.tsx` — the two row treatments both plan surfaces are built from:
  `<PlanRow>` (solid, ink, `bg-surface` — a pick; click removes) and `<GhostRow>` (dashed, dim,
  unfilled — a suggestion; click adds). `showDay` names the day on a ghost, for the whole-week
  starting points. Neither carries an affordance glyph — see decision #7 — and neither shows a
  hover tooltip: they put the shared `screeningTooltip` string on their `aria-label` only. A
  tooltip on every row made scanning down the plan flicker, and the plan is mostly read on the
  mobile sheet, which no hover surface reaches anyway.
- `components/PlanPanel.tsx` — the one persistent plan surface. Empty → the `startingPoints` seeds
  as bare `<GhostRow>`s, no heading over them (dashed rows on an otherwise empty panel already
  read as an offer), falling back to a plain prompt when there's nothing to seed from; non-empty → `<DayPlan>`, a
  Clear button in the header and, at the foot of the list, the **Add to calendar** primary button
  (decision #21) — neutral `bg-surface` fill, not the accent. Lives in the desktop right rail (sticky, own
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
