@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts). Combines showtimes from **Light House Cinema**
and **IFI** in full, plus the *non-standard* programming (classics, IMAX, foreign-language,
special events) of **Cineworld Dublin**, into one place — with tools to plan a day at the cinema,
from a double bill up to back-to-back screenings. Built entirely through conversation with the
user; this file exists so a future session can pick up without re-deriving the reasoning.

**Public deploy runs on a weekly curated pipeline, not live scraping** (decision #9): a
manually-run script fetches the week, prints a plain-text report to review, and confirming
promotes it to the one committed data file the deployed app reads statically.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, cheerio (Light House / IFI HTML; Cineworld is
a JSON API), vitest. No database. Committed in `data/`: `showtimes.json` (the published week) and
the curated override / editorial files (`title-overrides`, `letterboxd-overrides`, `film-labels`,
`hidden-films`, `language-overrides`); everything else in `data/` is gitignored cache/staging.

## Architecture

### Data pipeline (server-only — `app/page.tsx` never runs it)

- `lib/scrapers/{lighthouse,ifi,cineworld}.ts` — `CinemaAdapter`s. Light House / IFI are HTML
  scrapers; Cineworld is a JSON-API adapter that filters itself to non-standard screenings
  (decision #16). `lib/scrapers/index.ts` is the registry — adding a cinema is one file + one
  array entry (deliberately no in-app settings UI).
- `lib/aggregate.ts` — `getShowtimesForRange` / `refreshShowtimesForRange`. Fetches each adapter's
  *missing* dates in one batched call, caches per `(cinema, date)` (incl. an explicit empty array
  for dates a cinema has nothing on). Then, per screening: `cleanFilmTitle` → drop hidden films →
  resolve Letterboxd (URL, year, language, original title) → fold the language into
  `screeningTags`. Returns `DayResult` incl. `titleAnnotations` (for the label pre-fill).
- `lib/cache.ts` — in-memory Map + `data/cache.json` fallback, 6h TTL. Only `fetch-batch` + dev.
- `lib/titles.ts` — `cleanFilmTitle(raw, overrides)`: exact `corrections`, then `stripPrefixes`
  (programme strands), then `stripAnnotations` (regex sources for trailing junk not in the name —
  `4K Restoration`, `Nth Anniversary`, a `Month YYYY` suffix; matched at end, bare / dash- or
  colon-prefixed / in `(…)`). The cleaned title is what the UI shows *and* what Letterboxd
  resolution + its cache/override keys use. `titleAnnotation()` returns what `stripAnnotations`
  removed (for the label pre-fill, decision #11). `titlesEquivalent(a, b)`
  (case/punctuation/parenthetical-insensitive, Unicode-aware) gates whether an `originalTitle` is
  worth keeping.
- `lib/hidden.ts` — `data/hidden-films.json` (`{ titleSubstrings: string[] }`), a case-insensitive
  substring blocklist on the cleaned title, applied in `aggregate` before Letterboxd. A hidden
  film never reaches staged/published data, from any cinema.
- `lib/letterboxd.ts` — `resolveLetterboxd(title, year)` → `{ url?, year?, language?, originalTitle? }`
  (decision #4). One page fetch yields the `og:title` year (adopted as the film's real year),
  `parsePrimaryLanguage` (non-English only, decision #17), `parseOriginalTitle`
  (`<h2 class="originalname">`, native script). Cache: `data/letterboxd-cache.json`, keyed
  `title|year` (`year` = *scraped* year, often empty → `"I (Ai)|"`), no TTL, an entry missing any
  field re-resolves once (gitignored, so churn is invisible). `data/letterboxd-overrides.json`
  (`Record<"title|year", url|null>`) is checked first and always wins.
- `lib/languageOverrides.ts` — `data/language-overrides.json` (`Record<title, language|null>`),
  checked before the Letterboxd language; `null` forces a film unmarked.
- `lib/groupings.ts` — `groupByFilm`: groups by cleaned title across cinemas *and* dates
  (case/whitespace-insensitive), so one film = one card with many pills.
- `lib/clash.ts` — `findCombos` (valid double-bill pairs: same day, different film, gap between a
  cross-/same-cinema minimum and `MAX_COMBO_GAP_MINUTES`), `itineraryTransitions` (gap/overlap/
  too-tight between consecutive plan items — no max cap, a deliberate plan can have a long gap),
  `fittingAdditions` (which candidates slot into a plan — checks each against both its would-be
  chronological neighbours once inserted, not each selected screening independently; decision #5).
- `scripts/fetch-batch.ts` (`npm run fetch:batch`) — scrapes `upcomingDays()` (`lib/date.ts` —
  full week on a Thursday, else capped at the next Thursday), writes `data/staging-batch.json`,
  prints the review report (titles/casing, Letterboxd matches/misses, special screenings,
  unrecognised tags, Cineworld dropped titles, resolved languages, Labels), and *writes*
  `data/film-labels.json` pre-fills (decision #11). `scripts/confirm-batch.ts`
  (`npm run fetch:confirm`) copies staging → `data/showtimes.json`; git stays manual.
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

- `components/ScreeningBrowser.tsx` — the interactive core. Day/Cinema/Time filters as
  single-select segmented controls (`null` = an explicit "This week"/"Anywhere"/"Any Time"
  segment, not an all-deselected state). Day-plan selection `selectedKeys: Set<string>` (any
  number of screenings). Owns the persisted preferences and applies them as the `preferred`
  pre-filter ahead of everything (decision #14). `effectiveCinema`/`effectiveDay`/
  `effectiveTimeframe`/`effectiveSelectedKeys` all revert a now-impossible value to "any"/none —
  in particular `effectiveSelectedKeys` drops any selected key whose date ≠ the day in scope
  (a real bug once: stale selections drove the plan for the wrong day).
- `components/FilmCard.tsx` — one film's card. **Line 1** (`<h3>`): `[original title] TITLE [year]`
  — the black uppercase name flanked by `<TitleMeta>` (`font-normal text-dim`, title-sized,
  natural case); the original-language title shows before the name when `FilmGroup.originalTitle`
  is set. Cinema film-page links (`cinemaLinks` prop — one per cinema the film plays at across
  its *whole* preferred set, fixed regardless of the filter bar) as `text-dim` chips top-right.
  **Line 2** (`hasMetaLine`): cert, duration, `<LanguageTag>`, format box(es), the Letterboxd
  three-dot mark, then last the `<FilmNotes>` marquee sticker. Pills grouped by day then
  timeframe; each day's row is one non-wrapping `overflow-x-auto` strip (needs `relative` — the
  pills' `position:absolute` `.sr-only` spans would otherwise escape the clip and give the page a
  phantom horizontal scrollbar; `-mx-8 px-8` full-bleeds it past the card padding).
- `components/FilmNotes.tsx` + `components/MarqueeSticker.tsx` — the **one** dark scrolling
  sticker per card (`FilmNotes`, last on the meta line), carrying the special-screening name(s)
  *and* the curated editorial label (decision #11) joined by ` · ` ("☻ parent & baby ·
  4k restoration"). `MarqueeSticker` is `"use client"`: measures one copy and sets
  `--flm-marquee-shift` (exact px — a `%`-of-`max-content` translate stutters at speed) and
  `--flm-marquee-duration` (~40px/s, 4s floor). `--color-fg`/`--color-bg`, never accent;
  reduced-motion → static. `filmSpecialTags` (in `ScreeningBrowser`) feeds it the tags across the
  film's *whole* preferred set, so "☻ parent & baby" stays on the card even on a day that
  session is filtered out. The per-pill `☻` marks stay per-session.
- `components/ScreeningTags.tsx` / `FilmFormats.tsx` / `ScreeningLanguage.tsx` — the pill/card
  renderers for the three `screeningTags` readers. `<LanguageTag>` = the per-film language name
  (`--color-dim` chip on the meta line); `<LanguageMarks>` = the per-showtime `ST`/`Dub` on a
  pill. `<FilmFormatTag>` = a box on the meta line sized so a bigger format is taller; 35mm/70mm
  are an animated film-strip (`print: true`), IMAX is a static IMAX-blue plaque. Tooltips
  (`*Tooltip` helpers) merge into the whole pill/plan-row `title`.
- `components/ComboSuggestions.tsx` — the pre-selection "Suggested plans" list. `components/DayPlan.tsx`
  — replaces it once anything is selected: a chronological vertical rule with the gap / an
  accent-coloured overlap warning inline between consecutive items.
- `components/{PreferencesButton,SettingsPanel}.tsx` + `lib/preferences.ts` + `lib/duration.ts`
  — the header button and the overlay it opens; `PreferencesButton` shares the store with
  `ScreeningBrowser` via `useSyncExternalStore`. Decision #14.
- `components/controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass(active)`, the accent-fill
  / hard-press "selected" segment styling shared by the filter bar and the settings panel.

## Decisions worth knowing before changing anything

1. **Light House multi-day data comes from `/ajax/films-by-day/{n}` (`n`=1..9) despite
   `robots.txt` disallowing `/ajax/*`.** The `/films` page only renders *today* in static HTML;
   the other day-tabs are empty placeholders filled client-side by that endpoint (same
   `div.film` markup). Justified only because this is now **one deliberate fetch a week from a
   manual script** (decision #9), not per-visitor scraping. If it ever goes back to a live
   per-request model, revisit — the original "continuous automated access against an explicit
   disallow" objection applies again.

2. **IFI's `/whats-on?date=YYYY-MM-DD` renders every screening for that day inline** (one request
   per date, concurrency 4). Parse `article.screening-card` → title, `.screening-card__runtime`,
   `.age-rating img[alt]` cert, `.tags .tag` (first = year, second = director), the "Learn more"
   CTA → `filmPageUrl`, and one `a.screening-card__screening` per bookable session
   (`shop.ifi.ie/performance/{id}/`, unique per session — decision #6). `robots.txt` allows it.
   - IFI's **year** is often the programme/season year (e.g. `+Sons`, a 2025 doc, tagged 2026).
     It's only the Letterboxd slug-guess hint; the displayed year comes from the matched page
     (decision #4).
   - IFI **titles** a recurring-strand session by the *strand*, not the film (`Archive at
     Lunchtime August 2026: Programme 1` is really "Horse Plays"). Only reliable signal is the
     poster filename / synopsis first line. Handled reactively via `corrections` per month; a
     strand-aware model is still wanted (same open question as `CINEMA BOOK CLUB:` / Mystery
     Matinee).

3. **`app/page.tsx` is static, not `force-dynamic`.** It reads the committed `showtimes.json`;
   content changes only on redeploy. Don't reintroduce `force-dynamic` unless the page goes back
   to calling the live pipeline at request time.

4. **Letterboxd links are resolved by guessing the slug, not searching.** `/search/…` is behind
   a Cloudflare challenge (verified: 403, `cf-mitigated: challenge`, even with full browser
   headers); `/film/{slug}/` pages aren't blocked and aren't in robots.txt's disallow. Slugify the cleaned title,
   try `-{year}` first when known, and verify the resolved page's own `og:title` year (±1) before
   accepting. The matched page's year is also **what the UI shows** — the cinema-reported year is
   only the slug hint + a fallback for NOT-FOUND films (so `Kiki's Delivery Service` shows 1989,
   not "2026").
   - **Light House / Cineworld stamp re-releases with the current year**, which can match a
     *different* real film of that name from this year (`The Sacrifice` → `the-sacrifice-2026`).
     Pinned in `letterboxd-overrides.json` keyed on the *wrong* year (`"The Sacrifice|2026"`).
     When reviewing a batch, sanity-check every repertory/restoration link, not just NOT FOUND.
   - The same page fetch also yields the **Primary Language** (decision #17) and **original
     title** (native script) — see `lib/letterboxd.ts` above.

5. **Day-plan building only activates when the Day filter is one specific date** (`activeDay !==
   null`) — a plan is single-day. The Day filter **defaults to today** (the next day with
   sessions if today's slate is done); "This week" is one tap away. Selecting a showtime
   auto-narrows the Day filter to that date. Pill hints come from `fittingAdditions`
   (`lib/clash.ts`): a candidate must fit *both* its would-be chronological neighbours once
   inserted, not each selected screening in isolation. `allDayCombos` exists only to feed the
   pre-selection `ComboSuggestions` list.

6. **A screening's identity key is its `bookingUrl`.** Real listings can have two distinct
   bookable sessions for the same film at the same time. (They currently render as near-identical
   pills with no format label — a known minor gap.)

7. **Visual design: "chunky", not brutalist** (user's explicit call, ref inkwellgames.com). Warm
   cream page (`--color-bg`), near-white card (`--color-surface`), warm near-black ink
   (`--color-fg`/`--color-border`), rounded corners, hard (non-blurred, offset) layered shadows.
   Font: Elms Sans. All tokens in the `@theme` block of `app/globals.css`.
   - **Accent reservation (unchanged):** the one accent (`--color-accent`, gold `#fdc732`) is for
     actionable things and the current selection only, never decoration. **Two** non-ink/gold
     colours are allowed, both third-party brand identities: the Letterboxd mark's
     orange/green/blue, and the IMAX format box's brand blue.
   - `body { cursor: default }` (an app, not a document); interactive elements set
     `cursor-pointer`, the film *name* opts back into `cursor-text` (it's the thing you copy).
   - **`--shadow-chip`** (two-tone "stacked card", 6px total reach) is the resting elevation of
     screening pills *and* filter-bar segments; pressed/selected translate a matching 6px to land
     where the shadow edge was, hover is a half-press (`--shadow-chip-half`, 3px).
   - **Segmented controls** (filter bar `ControlGroup`, settings `Segmented`): each segment has
     its own border + shadow, `-ml-0.5` merges adjacent borders into one line, only the group's
     end segments round outward, and every segment needs an explicit `relative` + ascending
     inline `z-index` (the active segment's `translate` makes a stacking context). **No
     "disabled" variant** — a segment you can't act on is removed from the row (or, if it's the
     last one, shown non-interactive). Don't reintroduce a greyed-out disabled state without
     asking.

8. **No film-count / progress UI.** A "here are X films" counter was tried and rejected — the
   user said counters "add pressure". No running counts, badges, or the like in the main UI
   without asking. (The prefs-≠-default indicator is a single dot, not a count.)

9. **Public release = weekly curated pipeline, not live per-visitor scraping.** Live scraping on
   every request let any visitor trigger a scrape and gave no chance to catch mangled titles /
   wrong Letterboxd matches before users saw them. Now `npm run fetch:batch` (intended for
   Thursdays, when both cinemas' programmes turn over) → review the report → `npm run
   fetch:confirm` promotes staging to the one committed `showtimes.json`. Drove decisions #1 & #3.
   `app/actions.ts` + `RefreshButton` are gone.

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
    by ` · ` — decorative (`--color-fg`/`--color-bg`, never accent/count). `fetch:batch` **writes**
    the file (sorted), pre-filling a label for any film without one: a stripped annotation
    (`"25th anniversary"`, `"4k restoration"` — `titleAnnotation`, filtered to
    `/anniversary|restoration/`) wins over a Cineworld "Big Screen Classics" → `classic!`.

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

14. **Settings panel — persisted viewing preferences (localStorage).** The app's *only*
    persisted state. `lib/preferences.ts`: `Preferences` = `cinemas` / `timeframes` maps +
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
      keeps only screenings that are a surfaced special / a film format / a non-English language /
      a `film-labels.json` film. The empty-state Reset clears prefs **and** this toggle.
    - UI: header button (`PreferencesButton`, sliders icon not a gear; a `--color-fg` dot when
      prefs ≠ default) → `SettingsPanel` (responsive modal / bottom sheet). Options are toggle
      buttons in `controlSegment.ts` style; the **Language** group is a `Segmented` single-select
      (flush, same treatment as the filter bar). Cinemas + Times each require ≥1 on — the last
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

16. **Cineworld Dublin — a JSON-API adapter, filtered to non-standard screenings**
    (`lib/scrapers/cineworld.ts`). Cineworld.ie is a Gatsby site with a public, unauthenticated
    JSON API (`robots.txt` empty). Theatre id **`X07A4`**. Two calls per batch window
    (`fetchCineworldRaw`):
    - `GET /api/gatsby-source-boxofficeapi/schedule?from={ISO}&to={ISO}&theaters={"id":"X07A4","timeZone":"Europe/Dublin"}`
      (`theaters` = URL-encoded JSON; day boundary 03:00 local; accepts an arbitrary range) →
      `{ X07A4: { schedule: { <movieId>: { <YYYY-MM-DD>: [ {id, startsAt, tags[], data.ticketing} ] } } } }`.
      The `provider:"default"` URL (`web.cineworld.ie/order/showtimes/0001-NNNNNN/seats`) is the
      `bookingUrl` (unique per session, decision #6).
    - `GET /api/gatsby-source-boxofficeapi/movies?…&ids=…` (chunked at 30) → `[{ id, title,
      originalTitle, runtime (SECONDS — ÷60), certificate, release / releases[].releasedAt }]`.
      `filmPageUrl` = `cineworld.ie/movies/{id}-{slug}/`.

    **Non-standard filter (`isNotableTagSet` / `normaliseTags`):** a multiplex would bury the
    arthouse cinemas (~257 showtimes in a 3-week sample), so the adapter drops the "ordinary"
    tags (`Format.Projection.Digital`/`.Laser`, `Auditorium.Experience.4dx`/`.ScreenX`/
    `.Superscreen`, `Showtime.Accessibility.AudioDescription`) and keeps a screening only if a
    descriptor survives: IMAX, a `Localization.Language.*`, `Subtitled`, `AutismFriendly`, or any
    `Showtime.Event.*`. Survivors are normalised onto the shared `screeningTags` vocab
    (`Format.Projection.Imax` → `IMAX`, `Showtime.Event.BigScreenClassics` → `Big Screen
    Classics`, `Localization.Language.Tamil` → `Tamil`); **unknown `Showtime.Event.*` kept
    verbatim** → shows in the report ("unrecognised screening tags" + `summariseDroppedTitles`).
    **Big Screen Classics** is kept but `mark: false` — `fetch:batch` pre-fills a `classic!`
    label instead (decision #11).

    Also: **Cineworld defaults off** in preferences (decision #14). IMAX may be a **separate
    movie** (`"…: The IMAX Experience"`) — the adapter strips that + synthesises an `IMAX` tag so
    `groupByFilm` merges it. Re-releases get a current-year `release` (fix via
    `letterboxd-overrides.json`). Foreign titles carry a trailing `(Tamil)` — stripped.
    `originalTitle` from the `movies` API is only the **fallback** for the card's original title
    (Letterboxd's `originalname` is canonical, decision #4).

17. **International / foreign-language support — `lib/languages.ts`.** The third `screeningTags`
    reader. `displayLanguage` → `{ language?, subtitled, dubbed } | null` (`LANGUAGE_NAMES`, ~90
    entries).
    - **Language is per-film, from Letterboxd's "Primary Language"** (`parsePrimaryLanguage` —
      the details panel uses `<h3><span>Language>` for single-language, `Primary Language` +
      `Spoken Languages` for multi). `aggregate` folds it into every screening's `screeningTags`
      (case-insensitively de-duped so a cinema's own token wins). Covers **every non-English film
      across all three cinemas**, not just the ones a cinema tags. Fix wrong/missing values in
      `data/language-overrides.json`; Cineworld's `Localization.Language.*` is the fallback for a
      NOT-FOUND film.
    - **Subtitled/dubbed is per-session** — Cineworld `Showtime.Accessibility.*`, Light House
      `Subtitled`/`Dubbed`/`Open Captioned` (long captured, surface only now).
    - Render: `<LanguageTag>` = the language name only (meta-line chip); `<LanguageMarks>` = the
      per-showtime `ST`/`Dub` on a pill (not repeated with the language). Counts toward
      Highlights. Not part of the `FilmNotes` sticker.
    - The **`language` preference** (segmented control `any`/`english`/`non-english`,
      `matchesLanguagePref`) filters `preferred` on whether `displayLanguage` found a non-English
      original language. `dubbed` is no longer filtered on — just the pill "Dub" mark.
    - `fetch:batch` has a "Languages" section listing every non-English film's resolved language.

## Known gaps

- No tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`).
- Duplicate-session pills aren't visually distinguished (#6).
- **No silent-failure alerting** — scrapers degrade to cached data via try/catch, but nothing
  flags a long-term structural break in a cinema's HTML or Cineworld's JSON shape.
- **Nothing enforces the Thursday cadence** — a skipped `fetch:batch`/`fetch:confirm` just keeps
  serving last week's `showtimes.json` silently.
- **IFI**: special-audience strands not tagged (#13); a new format `svg[data-icon]` is silently
  dropped (#15); no automatic check for a new `em.additional` value beyond the batch report;
  titles often ALL CAPS (`[CASING DIFFERS]` in the report, but new mismatches aren't caught).
- **Cineworld's non-standard filter is tag-based only** — an interesting film that plays
  Cineworld only as a plain digital showing is dropped, with no per-title allowlist to rescue it.
  The report's "dropped ordinary screenings" section is the manual check.
- **Language marking** needs the film to resolve on Letterboxd and its "Primary Language" to be
  in `LANGUAGE_NAMES` (a miss shows in the report). Letterboxd's primary language is occasionally
  wrong for Indian regional films / dubs — the "Languages" report section is the check.
- `letterboxd-overrides.json` keys are `"exact title|year"` — if a cinema quietly changes a
  title's punctuation/accents the old key stops matching and the film silently drops to NOT
  FOUND. Sanity-check the report's NOT FOUND list against what *used* to resolve.

## Running it

- `npm run dev` — dev server
- `npx vitest run` — unit tests
- `npm run build` — production build; check `/` stays `○ (Static)` (decision #3)
- `npm run fetch:batch` — weekly scrape → `data/staging-batch.json` + review report (decision #9)
- `npm run fetch:confirm` — promote staging to the committed `data/showtimes.json`
- `npm run gen:icons` — regenerate app icons + favicon (decision #10)

## Data files (`data/`)

**Committed:**
- `showtimes.json` — the published week. Only file that gets pushed. Screenings may carry
  `screeningTags: string[]` (shared vocab — decisions #13/#15/#17) and `originalTitle` (#16).
- `title-overrides.json` — `{ stripPrefixes, stripAnnotations (regex sources), corrections }`.
- `letterboxd-overrides.json` — `Record<"title|year", string | null>`; `year` is the *scraped*
  year, often empty (`"I (Ai)|"`).
- `film-labels.json` — `Record<"<normalized title>", string>`, render-time only (decision #11);
  `fetch:batch` writes pre-fills into it.
- `hidden-films.json` — `{ titleSubstrings: string[] }`, editorial blocklist (`lib/hidden.ts`).
- `language-overrides.json` — `Record<"<normalized title>", string | null>` (decision #17).

**Gitignored** (regenerated by scripts / dev):
- `cache.json` — live-scrape cache, 6h TTL, incl. explicit empty entries.
- `letterboxd-cache.json` — long-lived match cache (`{ url, year, language, originalTitle }`), no TTL.
- `staging-batch.json` — this week's not-yet-confirmed fetch.
