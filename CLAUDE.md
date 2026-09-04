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
a JSON API), vitest. No database. Committed in `data/`: `showtimes.json` (the published week) and
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
  subtraction (decision #5). `findCombos` (valid double-bill pairs: **same day** — the one
  `date !==` guard left — different film, gap between a cross-/same-cinema minimum and
  `MAX_COMBO_GAP_MINUTES`), `itineraryTransitions` (gap/overlap/too-tight/`crossDay` between
  consecutive plan items — no max cap, a deliberate plan can have a long gap), `fittingAdditions`
  (candidates that slot into a plan — checks each against both its would-be chronological
  neighbours *on its own day*, allows the same film on another day; decision #5).
- `app/page.tsx` — server component, reads `data/showtimes.json` directly. Static per deploy
  (decision #3).

### `Screening.screeningTags: string[]` — the shared per-session vocabulary

Raw descriptors on a showtime, read by three sibling modules. Sources: Light House `em.additional`,
IFI format `svg[data-icon]`s, Cineworld's normalised API tags (decision #16), plus `aggregate`
appending the per-film Letterboxd language (#17) and `ScreeningBrowser` attaching a synthetic
`Mystery Matinee` render-time (#12).

- `lib/screeningTags.ts` — `displayScreeningTags` → surfaced special-audience / event strands
  (`Parent and Baby`, `Relaxed`/`Autism Friendly` → one `relaxed`, `Cinema Book Club`,
  `Silver Screen`, `Big Screen Classics`, `Movies for Juniors`, `Mystery Matinee`). Each →
  `{ symbol, label, title, description, mark? }`. `mark: false` (Mystery Matinee, Big Screen
  Classics) = still a surfaced special (Highlights, tooltip) but no `☻` glyph / `FilmNotes`
  segment. `<ScreeningTagMarks>` = the bare `☻` on a pill / `DayPlan` row. Decision #13.
- `lib/formats.ts` — `displayFilmFormats` → `35mm` / `70mm` / `IMAX` (`{ id, label, ratio, print,
  brandColor? }`). Decision #15.
- `lib/languages.ts` — `displayLanguage` → `{ language?, subtitled, dubbed } | null` (original
  non-English language + per-session caption state); `matchesLanguagePref` for the Language
  preference. Decision #17.

### UI (all client, under `ScreeningBrowser`)

- `components/ScreeningBrowser.tsx` — the interactive core. Day/Cinema/Time filters
  (`null` = "This week"/"Anywhere"/"Any Time"), rendered by `components/FilterControls.tsx` in
  two shapes: `layout="dock"` — the mobile fixed-bottom bar, a flush **segmented** row
  (`ControlGroup`) that scrolls sideways; `layout="bar"` — the desktop sticky bar at the top of
  the film column, three **dropdown menus** (`FilterMenu`) + the Specials toggle, one compact
  row (decision #5, #7). Both consume the same `effective*` + `setActive*` prop bag. Plan
  selection is the persisted `flm-on:plan` store
  (`lib/plan.ts`, `planKeys` → `selectedKeys: Set<string>`), any number of screenings across any
  number of days. Owns the persisted preferences and applies them as the `preferred` pre-filter
  ahead of everything (decision #14). `effectiveCinema`/`effectiveDay`/`effectiveTimeframe` all
  revert a now-impossible value to "any"; `effectiveSelectedKeys` drops any plan key whose
  screening has fallen out of the live dataset (past week / now-started / preference change), and
  `toggleSelected` writes that pruned set back. The two-column shell is a bare `lg:grid` — right
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
  *and* the curated editorial label (decision #11) joined by ` · ` ("☻ parent & baby ·
  4k restoration"). `MarqueeSticker` is `"use client"`: measures one copy and pins the track to
  `2×` that width in px so the keyframe's plain `translate3d(-50%…)` lands exactly on one copy
  (var-free keyframe → runs on the compositor; a `%`-of-`max-content` translate stutters at
  speed), plus an inline `animation-duration` (~40px/s, 4s floor). `--color-fg`/`--color-bg`,
  never accent; reduced-motion → static. The `tilted` header sticker also gets
  `will-change: transform` (its own layer — it sits in a rotated wrapper). `filmSpecialTags` (in `ScreeningBrowser`) feeds it the tags across the
  film's *whole* preferred set, so "☻ parent & baby" stays on the card even on a day that
  session is filtered out. The per-pill `☻` marks stay per-session.
- `components/ScreeningTags.tsx` / `FilmFormats.tsx` / `ScreeningLanguage.tsx` — the pill/card
  renderers for the three `screeningTags` readers. `<LanguageTag>` = the per-film language name
  as a `--color-dim` speech bubble on the meta line — a `"use client"` component that measures
  its own text box (ResizeObserver) and draws the rounded-rect-plus-tail outline as one
  continuous SVG `<path>` (the box model can't miter a horizontal border into a 45° tail arm);
  `<LanguageMarks>` = the per-showtime `ST`/`Dub` on a pill.
  `<FilmFormatTag>` = a box on the meta line sized so a bigger format is taller; 35mm/70mm
  are an animated film-strip (`print: true`), IMAX is a static IMAX-blue plaque. Tooltips
  (`*Tooltip` helpers) merge into the whole pill/plan-row `title`.
- `components/ComboSuggestions.tsx` — the "Suggested plans" list (double bills, one pinned day —
  decision #5). Exports `ComboList` (the bare `<ul>`); the default export wraps it in a card and
  is rendered inline on mobile only (`lg:hidden`) when nothing's picked yet.
- `components/PlanPanel.tsx` — the one persistent plan surface (what `ComboSuggestions` + `DayPlan`
  used to split between them). Empty → the `ComboList` suggestions (or a prompt if no day pinned);
  non-empty → `<DayPlan>` + a Clear button. Lives in the desktop right rail (sticky, own
  `overflow-y-auto`) and inside `components/PlanButton.tsx` — the mobile floating button (a
  plan-item count, decision #8) + bottom sheet cloned from `SettingsPanel`.
- `components/DayPlan.tsx` — the plan grouped into a section per day (`formatDayFriendly` +
  `formatDayDate` header, per-day film count + `~span`); within a day, the gap / an
  accent-coloured overlap-or-too-tight warning between consecutive screenings. A step across a day
  boundary (`ItineraryTransition.crossDay`) renders as the next day's header, never a gap.
- `components/Masthead.tsx` — the "FLM ON" title + tagline, rendered by `ScreeningBrowser` (not
  `app/page.tsx`) so the `lg:` grid can move it into the right rail. Holds `PreferencesButton`
  only on mobile (`lg:hidden`) — on desktop that button lives in the filter bar (`FilterControls`
  `layout="bar"`, room to spare now the filters are menus).
- `components/{PreferencesButton,SettingsPanel,ActivePreferenceNote}.tsx` + `lib/preferences.ts`
  + `lib/duration.ts` — the preferences button, the overlay it opens, and the title-side marquee
  naming an active kids-only / language pref; all three share the store with `ScreeningBrowser`
  via `useSyncExternalStore`. Decision #14.
- `components/controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass(active)`, the accent-fill
  / hard-press "selected" segment styling shared by the filter bar and the settings panel.

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
   next write. Tapping a showtime just adds it — the Day filter does **not** snap to it (that
   jump is disorienting across days now). The Day filter still **defaults to today** for
   *browsing*. **Double-bill *suggestions* (`findCombos`) stay strictly one day** (`suggestionScopeDay`
   = the pinned day; `lib/clash.ts:65` `date !==` guard + its test) — a cross-day "pair" isn't a
   plan. The plan surface: a sticky `<PlanPanel>` in the desktop right rail, a floating
   `<PlanButton>` + bottom sheet on mobile. `lib/clash.ts` uses an **absolute-ordinal minute**
   model (`toOrdinalMinutes` = `daysBetweenISO(EPOCH, date)*1440 + toMinutes(time)`), so every
   gap calc is multi-day-correct and past-midnight end times no longer wrap. `itineraryTransitions`
   marks a day boundary as `crossDay` (rendered as a header, not "Overlaps 840min").
   `fittingAdditions` hints are **within-day only** and allow the same film on a *different* day.
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
       bar that isn't pinned to a screen edge. `FilterMenu` is the app's **first popover**: its
       own click-outside (`pointerdown` on `document`) + Escape dismissal, parent holds
       `openMenu` so only one is open at a time. Accent fill on a trigger = "this filter is
       narrowing the view"; open-but-default just presses in.
     The `"any"` / single-option / pinned-preference logic is the same across both (a menu with
     one real option, a hidden control when a preference pins it).

8. **No film-count / progress UI.** A "here are X films" counter was tried and rejected — the
   user said counters "add pressure". No running counts, badges, or the like in the main UI
   without asking. (An active kids-only / language preference is named on the title —
   `components/ActivePreferenceNote.tsx` — a gold sticker over the top / dark subtitle pills
   over the base, not a count.) The two sanctioned exceptions both count **the user's own plan**,
   never the catalogue: `DayPlan`'s per-day "{n} films · ~span" line, and the mobile
   `PlanButton` badge (how many screenings are in the plan).

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
    `DayPlan`/`ComboSuggestions` still show its runtime (gap math). `ScreeningBrowser` attaches a
    synthetic `"Mystery Matinee"` `screeningTag` render-time so it passes the Highlights filter;
    its `KNOWN` entry is `mark: false` (no glyph/sticker — the redacted card is treatment enough).

13. **Special screenings get a per-session marker.** Light House tags them per showtime in
    `.time > em.additional` (`Parent and Baby`, `Cinema Book Club`, `Silver Screen`, plus caption
    notes `Subtitled`/`Dubbed`/`Open Captioned`); the adapter reads them into `Screening.screeningTags`
    verbatim. `lib/screeningTags.ts` `KNOWN` is the gate on what surfaces (widening = one entry);
    each entry carries a curated `title` + `description` (from Light House's `data-tooltip`) used
    as the hover tooltip. Rendered as a bare `☻` on each matching pill + the name once per card
    in `FilmNotes` — rationale (user): once the card names it you recognise the mark, so don't
    repeat words on every pill. The `FilmNotes` sticker holds **multiple** notes joined by ` · `
    (the old "one sticker max" rule is gone); `mark: false` tags contribute neither glyph nor
    name. Cineworld maps its `Showtime.Event.*` / `Showtime.Accessibility.AutismFriendly` onto
    this vocab (decision #16). `fetch:batch` prints
    a "Special screenings" + "unrecognised screening tags" section for review.
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
    - **Model: standing pre-filter.** `preferred` (memo in `ScreeningBrowser`) carves the dataset
      down before anything else derives from it, so turning a cinema/time off just shrinks a
      `ControlGroup`'s option list and it collapses on its own. When a preference pins a group to
      one value the corresponding filter-bar control isn't rendered at all
      (`cinemaFilterUseful` / `timeFilterUseful`). Controls-only — pills still label their cinema.
    - `lib/duration.ts` `isShortFilm` / `SHORT_FILM_MAX_MINS = 40` is **per-screening** (a mixed
      strand keeps only its long session); unknown runtime is never short. `kidsOnly` →
      `lib/certs.ts` `isKidFriendly` (IFCO `G`/`PG`/`12A` only; `15A`+ and *no listed cert*
      excluded).
    - **The Highlights toggle** ("☻ Specials, etc") is a filter-bar `useState`, **not** a saved
      preference — ephemeral, first in the bar (the lens reached for most). On → `preferred`
      keeps only screenings that are a surfaced special / a film format / a **non-English
      original language** (`hasNonEnglishLanguage` — a subtitled/open-captioned session of an
      English film does *not* count) / a `film-labels.json` film. This is also what keeps
      Cineworld's ordinary multiplex programme
      out of view (decision #16) — with it off and Cineworld on, you get the full slate. The
      empty-state Reset clears prefs **and** this toggle.
    - UI: `PreferencesButton` (sliders icon not a gear — no badge) → `SettingsPanel` (responsive
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
      (flush, same treatment as the filter bar). Each group is one non-wrapping full-bleed
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
    reader. `displayLanguage` → `{ language?, subtitled, dubbed } | null` (`LANGUAGE_NAMES`, ~90
    entries).
    - **Language is per-film** (from Letterboxd, folded into every screening's `screeningTags` at
      fetch time — so it covers every non-English film across all three cinemas, not just the
      ones a cinema tags), while **subtitled/dubbed is per-session** (the cinema's own caption
      tags, with `Subtitled` assumed for an untagged non-English screening — except animation,
      which often screens dubbed). How that's resolved and how to correct it: `fetch-films` skill.
    - Render: `<LanguageTag>` = the language name only (meta-line chip); `<LanguageMarks>` = the
      per-showtime `ST`/`Dub` on a pill (not repeated with the language). Not part of the
      `FilmNotes` sticker. **A non-English original language counts toward Highlights
      (`hasNonEnglishLanguage`); a subtitled/dubbed session of an English film does not.**
    - The **`language` preference** (segmented control `any`/`english`/`non-english`,
      `matchesLanguagePref`) filters `preferred` on whether `displayLanguage` found a non-English
      original language. `dubbed` is no longer filtered on — just the pill "Dub" mark.

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

## Known gaps

- No tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`).
- Duplicate-session pills aren't visually distinguished (#6).
- **Nothing enforces the Thursday cadence** — a skipped refresh just keeps serving last week's
  `showtimes.json` silently.
- **Nothing alerts on a silent scrape failure**, and several classes of bad data (a wrong
  Letterboxd match, an untagged strand, a wrong language, a dropped format icon) are only ever
  caught by eye during the weekly review. The batch report has a section for each; the
  **`fetch-films` skill** enumerates them and says what to look for. Nothing is automatic.
- **Cineworld "highlight" detection is tag-based only** — a plain-digital showing of an
  interesting film shows only with the Highlights lens *off*, buried in the full multiplex slate,
  with no per-title allowlist to promote it.

## Running it

- `npm run dev` — dev server
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
