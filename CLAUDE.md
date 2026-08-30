@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts) that combines showtimes from the user's
favourite Dublin cinemas — **Light House Cinema** and **IFI** in full, plus the *non-standard*
programming (classics, IMAX, foreign-language, special events) of **Cineworld Dublin** — into
one place, with tools to plan a day at the cinema — anything from a double bill up to a full day
of back-to-back screenings. Built iteratively through direct conversation with the user; this file exists so a
future session can pick back up without re-deriving the reasoning below.

Public deployment (see decision #9) runs on a **weekly curated data pipeline**, not live
per-visitor scraping: a manually-run script fetches the week's showtimes, the user reviews a
plain-text report, and confirming promotes it to the one committed data file the deployed app
reads statically.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, cheerio for HTML parsing (Light House / IFI;
Cineworld is a JSON API), vitest for tests.
No database — `data/showtimes.json` (the published week) plus `data/title-overrides.json` and
`data/letterboxd-overrides.json` (curated corrections) are committed; everything else in `data/`
is gitignored runtime cache/staging.

## Architecture

- `lib/scrapers/lighthouse.ts`, `lib/scrapers/ifi.ts`, `lib/scrapers/cineworld.ts` —
  `CinemaAdapter` implementations (real scrapers, not dummy data — Phase 1 used hand-written
  dummy adapters to build the UI risk-free, Phase 2 swapped in these). Cineworld is a JSON-API
  adapter (decision #16), not an HTML scraper, and filters itself to non-standard screenings.
- `lib/scrapers/index.ts` — the adapter registry (`adapters: CinemaAdapter[]`). Adding a cinema
  later is one new adapter file + one array entry — deliberately not an in-app settings UI.
- `lib/aggregate.ts` — `getShowtimesForRange` / `refreshShowtimesForRange`. Fetches each
  adapter's *missing* dates in one batched call (not a per-day loop), then splits and caches the
  result per `(cinema, date)` — including caching an **explicit empty array** for dates a cinema
  has nothing on, so they aren't re-fetched every single page load.
- `lib/cache.ts` — in-memory Map + `data/cache.json` file fallback, 6h TTL. Only exercised by
  `scripts/fetch-batch.ts` and local dev now — the deployed app doesn't call the live pipeline at
  all (see decision #9).
- `lib/titles.ts` — `cleanFilmTitle`, applied to every screening in `lib/aggregate.ts` before
  Letterboxd resolution. From `data/title-overrides.json`: exact-match `corrections`, then
  `stripPrefixes` (programme strands — `"ARCHIVE AT LUNCHTIME:"`, `"CINEMA BOOK CLUB:"`), then
  `stripAnnotations` (regex sources for trailing tags that aren't part of the name — `4K
  Restoration`, `Nth Anniversary`, and a `Month YYYY` suffix that recurring strands append —
  matched at end of title, bare / dash-prefixed / in `(…)`). The cleaned title is
  what the UI shows *and* what Letterboxd resolution + its cache/override keys use, so editing
  these files shifts `letterboxd-overrides.json` keys too. (Note: `letterboxd-overrides.json` /
  `letterboxd-cache.json` keys are `title|year`, and `year` is the *scraped* year — often empty
  for a repertory foreign title, so the key can be `"I (Ai)|"` with a trailing bar.)
- `lib/hidden.ts` — `loadHiddenFilms` / `isHiddenFilm`, an editorial blocklist from
  `data/hidden-films.json` (`{ titleSubstrings: string[] }`). Applied in `lib/aggregate.ts` right
  after `cleanFilmTitle`, before Letterboxd — a hidden film (case-insensitive substring match on
  the cleaned title, e.g. `"harry potter"`) never reaches the staged or published showtimes,
  from any cinema. `scripts/fetch-batch.ts` echoes the active patterns.
- `lib/letterboxd.ts` — `resolveLetterboxd(title, year)` → `{ url?, year?, language? }`: resolves
  each film's Letterboxd page (see decision #4) *and* returns that page's `og:title` year (which
  `lib/aggregate.ts` adopts as the film's real year — cinema-reported years are unreliable,
  decisions #2, #4) *and* its "Primary Language" (`parsePrimaryLanguage`, non-English only —
  decision #17). Cached indefinitely in `data/letterboxd-cache.json` as `{ url, year, language }`
  per `title|year` key (no TTL; legacy bare-string / `{url,year}` entries migrate on read and
  re-resolve once to backfill). `data/letterboxd-overrides.json` is checked first and always
  wins; an override gives only a URL, so its page is fetched once for the year + language.
- `lib/clash.ts` — `findCombos`: valid double-bill pairs (same day, different film, gap between
  `MAX_COMBO_GAP_MINUTES` and a minimum that depends on whether the pair is cross-cinema
  (`WALK_BUFFER_MINUTES`, enough time to walk between buildings) or same-cinema
  (`SAME_CINEMA_BUFFER_MINUTES`, just enough to move between screens). `itineraryTransitions`:
  gap/overlap/too-tight status between consecutive items in an already-built day plan (no
  `MAX_COMBO_GAP_MINUTES` cap — a plan the user built on purpose can have a long gap on purpose).
  `fittingAdditions`: which not-yet-selected screenings could be added to a day plan — checks each
  candidate against its actual neighbors by start time once inserted, not a flat pairwise check
  against every selected screening (see decision #5).
- `lib/groupings.ts` — `groupByFilm`: groups screenings by title across cinemas *and* dates
  (case/whitespace-insensitively — the two cinemas don't scrape titles in matching case), so the
  same film shows as one card with multiple date/cinema/time pills, not duplicate rows.
- `components/ScreeningBrowser.tsx` — the interactive core (client component). Owns Day/Cinema/
  Time filters as single-select segmented controls (each a nullable value, `null` = "any" —
  an explicit "This week"/"Anywhere"/"Any Time" segment rather than an implicit all-deselected
  state; the Day one reads "This week" because that's the span it broadens to) and the day-plan
  selection state (`selectedKeys: Set<string>` — any number of screenings,
  not just a pair; see decision #5). Also holds the persisted preferences (decision #14) and
  applies them as the `preferred` pre-filter ahead of everything else.
- `components/PreferencesButton.tsx` + `components/SettingsPanel.tsx` + `lib/preferences.ts` +
  `lib/duration.ts` — the header preferences button and the overlay it opens (modal / bottom
  sheet), and the persisted state behind it; see decision #14. `PreferencesButton` shares the
  `lib/preferences.ts` store with `ScreeningBrowser` via `useSyncExternalStore` (no prop drilling).
- `components/controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass(active)`, the
  accent-fill / hard-press "selected" segment styling shared by the filter-bar `ControlGroup`
  and the `SettingsPanel` toggles.
- `components/FilmCard.tsx` — one film's card. Header line 1: title (black) + year inline
  (title-sized but `font-normal`, `text-dim`, no parens), with the cinema film-page links
  top-right as `text-dim`/`border-dim` chips (`border-2`/`rounded-btn`, from `Screening.filmPageUrl`
  — each cinema's own detail page, `ifi.ie/films/{slug}` / `lighthousecinema.ie/film/{slug}`,
  kept separate from `bookingUrl`). The links are the `cinemaLinks` prop — **one per cinema the
  film plays at across its whole preferred set, fixed regardless of the Day/Cinema/Time filter
  bar** (a film at both cinemas keeps both links while you browse one); only the session pills
  follow the filter bar. Line 2: cert, duration, format tag(s), and the Letterboxd link — now the
  Letterboxd three-dot mark (`LetterboxdLogo`, an inline SVG) rather than a text link — one of
  the two allowed exceptions to the ink + single-gold palette (decision #7), a third party's
  logo, so it keeps their orange/green/blue (the other is the IMAX-blue format box, decision
  #15). Screening pills are grouped by day then timeframe; the day sub-header shows
  unless a specific Day chip is active (`daySpecified` — then the chip already says the day).
  Each day's pill row is a single non-wrapping `overflow-x-auto` strip (`scrollbar-none`, a
  `@utility` in `globals.css`) — pills scroll sideways rather than stacking, so a card stays
  short on mobile. `-mx-8 px-8` cancels the card's `p-8` so the strip is full-bleed: pills line
  up with the rest of the content at rest but scroll right up to the card's inner border edge
  instead of stopping short inside a band of padding. The row is `relative` on purpose: the
  pills' `.sr-only` spans are `position:absolute` and would otherwise resolve their containing
  block to the viewport, escape the row's clip, and give the whole page a phantom horizontal
  scrollbar. `pb-2.5 -mb-2.5` keeps the chunky pill shadow inside the scroll box without adding
  visual gap.
  A special-screening session shows a bare `☻` mark after the time; a marquee sticker after the
  title names it once ("☻ parent & baby") — see decision #13.
- `components/MarqueeSticker.tsx` — the small fixed-width dark sticker whose text scrolls on a
  seamless loop (two copies + a `translateX(-50%)` loop via the `flm-marquee` keyframe in
  `app/globals.css`; reduced-motion → static full-width). `--color-fg` sticker, `--color-bg`
  text, never accent. Shared by `FilmLabel` and `ScreeningTagLabel`. (The film-format tag uses
  the same two-copy-loop trick vertically — `flm-filmstrip` — see `components/FilmFormats.tsx`.)
- `components/FilmLabel.tsx` — a curated editorial tag (from `data/film-labels.json`, see
  decision #11) rendered as a `<MarqueeSticker>` after a film's title + year. Decorative.
- `components/ScreeningTags.tsx` + `lib/screeningTags.ts` — special-screening markers.
  `displayScreeningTags` filters `Screening.screeningTags` (raw per-session descriptors from the
  scraper, plus a synthetic `Mystery Matinee` attached render-time by `ScreeningBrowser` —
  decision #12) to the surfaced set — Parent & Baby, Relaxed, Cinema Book Club, Silver Screen,
  Mystery Matinee — → `{ symbol, label, title, description, mark? }` (`title`/`description`
  curated from Light House's own `data-tooltip` text). `mark: false` (only Mystery Matinee) means
  it still counts as a surfaced special — Highlights filter, tooltip, "one sticker max"
  suppression — but `<ScreeningTagMarks>` / `<ScreeningTagLabel>` skip it, so no glyph shows.
  `<ScreeningTagMarks>` renders the bare `☻` on a pill / `DayPlan` row; `<ScreeningTagLabel>`
  renders a `☻ parent & baby` `<MarqueeSticker>` after the film title. The
  `title="<name> — <description>"` hover tooltip (`screeningTagsTooltip`) goes on the **whole**
  pill / plan-row button (not the glyph); the sticker carries its own (also its accessible name).
  `font-variant-emoji: text` (symbol carries U+FE0E) keeps the smiley flat. Decision #13.
- `components/FilmFormats.tsx` + `lib/formats.ts` — film-format markers (35mm / 70mm / IMAX),
  a sibling of the special-screening pair riding the same `Screening.screeningTags` field.
  `displayFilmFormats` maps the gauge tokens to `{ id, label, ratio, title, description }`.
  `<FilmFormatTag>` renders a small solid `--color-fg` box holding the label on the `FilmCard`
  meta line (after duration, before Letterboxd), sized to the format — same width, height
  stepping up 35mm → 70mm → IMAX (`ratio` = width/height, so a smaller ratio is taller).
  `<FilmFormatMarks>` renders a bare ratio-shaped rectangle after the time on a pill / `DayPlan`
  row (the format analogue of the `☻` mark). `filmFormatsTooltip` is merged into the pill /
  plan-row `title` alongside `screeningTagsTooltip`. Decorative → never accent (decision #7).
  All three formats also count toward the Highlights toggle. Decision #15.
- `components/ScreeningLanguage.tsx` + `lib/languages.ts` — international-feature markers, the
  third reader of `Screening.screeningTags` (sibling of `screeningTags.ts` / `formats.ts`).
  `displayLanguage` → `{ language?, subtitled, dubbed } | null`. Split by scope:
  `<LanguageTag>` shows the **per-film language** as a small outlined `--color-dim` chip on the
  `FilmCard` meta line, right after the duration ("French"); `<LanguageMarks>` shows the
  **per-showtime `ST` / `Dub`** (`captionMark`) after the time on a pill / `DayPlan` row;
  `languageTooltip` merges into the pill/row `title`. A tag, not a sticker (decision #13's "one
  sticker max" is unaffected). The language is per-film from Letterboxd's "Primary Language"
  (via `lib/letterboxd.ts`), folded into every screening's `screeningTags` by `lib/aggregate.ts`
  — `data/language-overrides.json` (`lib/languageOverrides.ts`) is the manual fix path;
  Cineworld's `Localization.Language.*` is the per-session fallback. Subtitled/dubbed comes from
  Cineworld's `Showtime.Accessibility.*` and Light House's long-captured
  `Subtitled`/`Dubbed`/`Open Captioned`. Counts toward Highlights; a `hideDubbed` preference
  hides dubbed sessions. Decision #17.
- `components/ComboSuggestions.tsx` — the "Suggested plans" browsing list shown before anything is
  selected (`effectiveSelectedKeys.size === 0`); clicking a suggestion adds its first leg to the
  plan. `components/DayPlan.tsx` — replaces that list once anything is selected: a continuous
  vertical rule (stacked `border-l-2` blocks) down the chosen screenings sorted chronologically,
  each film's time range + duration, with the gap (or an accent-coloured overlap/too-tight warning,
  via `itineraryTransitions` in `lib/clash.ts`) inline on the line between each consecutive pair;
  a row's `×` button removes it.
- `scripts/fetch-batch.ts` (`npm run fetch:batch`) — runs the live scrape pipeline for
  `upcomingDays()` (`lib/date.ts` — the full week when run on a Thursday, capped at the upcoming
  Thursday otherwise), writes `data/staging-batch.json`, prints a plain-text report (cleaned
  titles, casing mismatches, Letterboxd matches/misses) to review.
- `scripts/confirm-batch.ts` (`npm run fetch:confirm`) — promotes staging to `data/showtimes.json`,
  the one file that's actually committed and pushed. Only writes the file — git stays manual.
- `app/page.tsx` — server component, reads `data/showtimes.json` directly (no live fetch, no
  `force-dynamic` — see decision #9). Static per deploy.

## Decisions worth knowing before changing anything

1. **Light House's multi-day data comes from `/ajax/films-by-day/{n}` — deliberately fetched
   despite `robots.txt` disallowing `/ajax/*`.** (Reversed 2026-08-24; originally this adapter
   only ever returned "today" out of respect for that disallow.) The site's `/films` page only
   ever renders *today* in static HTML — the other 9 day-tabs (`n` = 1..9, confirmed live via
   network capture) are empty `<ul></ul>` placeholders filled client-side by that exact endpoint,
   same `div.film` markup as the main page. Revisited with the user for the public release's
   weekly-batch pipeline (decision #9): this is now a single deliberate fetch once a week from a
   manual script, not continuous per-visitor scraping, so the calculus changed. If this ever goes
   back to a live per-request model, revisit again — the original reasoning (continuous automated
   access against an explicit disallow) would apply again.

2. **IFI's `/whats-on` page is date-scoped via `?date=YYYY-MM-DD` and renders every screening
   for that day inline.** (Rewritten 2026-08-27 — IFI relaunched on an Astro site and the old
   `now-showing-coming-soon/` URL + per-event-page walk started 404ing; nothing IFI showed up in
   that day's batch until this was fixed.) The adapter now fetches one `/whats-on?date=` page per
   requested date (concurrency 4), parsing `article.screening-card` → title, `.screening-card__
   runtime`, `.age-rating img[alt]` for cert, `.tags .tag` (first tag = 4-digit year, second =
   director) for `year`, the "Learn more" CTA (`.screening-card__ctas a[href*="/films/"]`) for the
   `filmPageUrl` (→ `https://ifi.ie/films/{slug}`), and one `a.screening-card__screening` per
   bookable session (`href` = `shop.ifi.ie/performance/{id}/`, unique per session — decision #6).
   This closed the old "listing only shows today" gap: a film whose run starts mid-week is now
   discovered directly. `robots.txt` allows `*` on `/whats-on`. `resolveDateLabel`/`parseEventPage`
   are gone.

   Caveat on IFI's `year`: it's often the *programme/season* year (2026) rather than the film's
   production year — e.g. `+Sons` (a 2025 doc) is tagged 2026. It's still fed to Letterboxd
   resolution as the slug-guess hint, but the *displayed* year then comes from the matched page
   (decision #4), so `+Sons` ends up showing 2025. A wrong hint that finds no page yields NOT FOUND
   (visible in the batch report, fixable via override) rather than a confident wrong link — which
   is what the *yearless* bare-slug guess used to produce for IFI (e.g. `/film/the-odyssey/` → the
   1997 miniseries).

   Caveat on IFI's `title`: the new site titles a recurring-strand session by the *strand*, not
   the film — e.g. `Archive at Lunchtime August 2026: Programme 1` is really the "Horse Plays"
   archive strand (the old site named it properly). The only reliable signal for the real name is
   the poster image filename (`…/Archive-at-Lunchtime_-Horse-Plays.jpg`) or the first line of the
   synopsis, and even the image is a bare placeholder some months. Handled reactively via
   `corrections` in `data/title-overrides.json` (Aug's three entries → `"Horse Plays"`, Sept →
   `"The Irish Riviera"`; where a month has several programmes they collapse to one `groupByFilm`
   card). This is manual per month; a proper strand-aware model is still wanted (same open question
   as Light House's `CINEMA BOOK CLUB:` / IFI `Mystery Matinee`).

3. **`app/page.tsx` is static (`○ (Static)` in `next build` output), not `force-dynamic`.**
   (Reversed 2026-08-24 along with decision #9 — it used to require `force-dynamic` because it
   called the live scrape pipeline on every request.) Now it just reads the committed
   `data/showtimes.json`, so content only changes on redeploy and Next's normal static rendering
   is correct. Don't reintroduce `force-dynamic` unless `app/page.tsx` goes back to calling the
   live pipeline at request time.

4. **Letterboxd links are resolved by guessing the slug, not searching.** Letterboxd's
   `/search/...` endpoint sits behind a Cloudflare bot challenge (verified: 403,
   `cf-mitigated: challenge`, even with full browser headers). Individual `/film/{slug}/` pages
   are not blocked and aren't disallowed by robots.txt. We slugify the title, try a `-{year}`
   suffix first when the year is known, and verify the resolved page's own `og:title` year before
   accepting — that's the actual implementation of "use year to minimize mismatch." Trailing
   annotations like "(4K Restoration)" are stripped before slugifying (cinema listings add these,
   Letterboxd titles don't have them) — both in `cleanTitleForMatching` here and, since
   2026-08-27, structurally in `cleanFilmTitle` via `stripAnnotations`.

   Since 2026-08-27 the year on the *matched* page (its `og:title`) is also what the UI shows for
   that film — the cinema-reported year is used only for the slug guess and as a fallback when
   there's no match. So `Kiki's Delivery Service` shows 1989, not Light House's "2026"; a repertory
   pin in `letterboxd-overrides.json` fixes both the link and the displayed year in one go.

   Since 2026-08-31 the same page fetch also yields the film's **"Primary Language"**
   (`parsePrimaryLanguage`) — how every non-English film gets marked (decision #17).
   `resolveLetterboxd` returns `{ url?, year?, language? }` and the `letterboxd-cache.json` entry
   is `{ url, year, language }`; a legacy `{ url, year }` entry (no `language`) is treated as
   "not checked" and re-resolves once, so the first batch after this change re-fetches that
   week's films.

   **Light House stamps re-releases with the *current* year** ("Released: …-2026" on a 1986
   Tarkovsky restoration), which defeats the `og:title` year check and — worse — can match a
   *different* real film of the same name that genuinely is from this year (e.g. `The Sacrifice`
   auto-resolved to `the-sacrifice-2026`, a different 2026 film, instead of `the-sacrifice`). These
   are pinned in `data/letterboxd-overrides.json` (keyed on the *wrong* year LH reports, e.g.
   `"The Sacrifice|2026"`, `"Sunset Boulevard|2025"`). When reviewing a batch, sanity-check any
   repertory/restoration title's link, not just the NOT FOUND list.

5. **Day-plan building (suggestions + click-to-select) only activates when the Day filter is
   narrowed to a specific date (`activeDay !== null`)** — a plan is inherently single-day; the
   "This week" segment (the `null` day state) disables it entirely. The Day filter now **defaults
   to today** (the `activeDay` `useState` initializer: today while it still has an un-started
   screening, else the next day that has anything on — visiting late at night lands you on
   tomorrow), so planning is live on load; "This week" is one tap away but not where you land.
   Selecting a showtime auto-narrows the Day filter to
   that date if not already scoped to it, so planning starts immediately without a separate manual
   step; deselecting leaves the day filter alone. Selection state is `selectedKeys: Set<string>`
   (generalized 2026-08-24 from a single `selectedKey` — originally just double-bill pairs, now any
   number of screenings for a full day). Watch out if touching this: there was a real bug where
   changing the day filter left *stale* selections driving the plan for the wrong day — fixed by
   `effectiveSelectedKeys` in `ScreeningBrowser.tsx`, which drops any selected key whose screening's
   date doesn't match the day currently in scope. That guard predates the `Set` generalization (it
   originally guarded a single key) and still applies the same way to each key in the set.
   `allDayCombos` (whole day, ignoring the cinema filter) still exists solely to feed the
   pre-selection `ComboSuggestions` list (`visibleCombos`, narrowed to the active cinema so it
   doesn't suggest a pair referencing a hidden cinema) — it is **not** what drives the pill hints
   once you've started picking. Those come from `fittingAdditions` (`lib/clash.ts`), added
   2026-08-24 after a real UX bug: the original hint logic (`partnersOf`/`gapForPartner`) checked
   each candidate against every selected screening *independently* ("does it pair with #1, or with
   #2?"), so a 3rd pick could get hinted for fitting neatly after #1 while actually overlapping #2
   — correct for a 2nd pick (only one thing to compare against) but wrong beyond that, since a
   pick has to fit both its actual neighbors once inserted into the sorted plan, not just one
   selected screening in isolation. `fittingAdditions(itinerary, candidates)` finds each
   candidate's immediate predecessor/successor by start time in the current plan and requires
   *both* adjacent transitions to be valid (same buffer/cap rules as `findCombos`); a candidate
   with only one applicable neighbor (inserting before the first item or after the last) only
   needs that one side to pass.

6. **A screening's identity key is its `bookingUrl`, not `cinema|film|time`.** Real listings can
   have two distinct bookable sessions for the same film at the same time (e.g. different
   formats) — `bookingUrl` is the one field guaranteed unique per session. (They currently render
   as visually near-identical pills with no format label — a known minor gap, not fixed.)

7. **Visual design moved from brutalist to "chunky"** (reversed 2026-08-25, user's explicit
   request, referencing inkwellgames.com): warm cream page background (`--color-bg`) with a
   near-white card surface (`--color-surface`), warm near-black ink for borders/text
   (`--color-fg`/`--color-border`, not pure black), rounded corners (`--radius-card`/`--radius-btn`/
   `--radius-group`), and hard (non-blurred, offset) layered shadows instead of the old flat/
   square-cornered/shadowless look. Font is Elms Sans (`next/font/google`, a geometric sans with a
   real Black/900 cut) instead of the system sans stack. See the `@theme` block in
   `app/globals.css` for all tokens. **The accent-reservation rule itself is unchanged**: the one
   functional accent color (`--color-accent`, a warm gold `#fdc732`) is used only for
   actionable/important things and the current selection — never decoratively. Two colours
   outside ink+gold are allowed, both third-party brand identities, not decoration: the
   Letterboxd mark's orange/green/blue, and the IMAX format box's brand blue (decision #15).

   `body { cursor: default }` — plain text reads with the arrow cursor (an app, not a document);
   interactive elements set `cursor-pointer` themselves, and the film title (name only, not the
   year) opts back into `cursor-text` in `FilmCard` since that's the thing you actually copy.

   **Shadow tokens**: `--shadow-card`/`--shadow-card-lg` (cards), `--shadow-btn-secondary` (flat
   offset, used on a few standalone buttons like DayPlan's Clear), `--shadow-group`, and
   `--shadow-chip`/`--shadow-chip-half` — the two-tone "stacked card" shadow (grey block wrapped
   in a 2px border ring, same recipe as `--shadow-card`), added 2026-08-27. `--shadow-chip` is
   the resting elevation of the screening pills (`FilmCard.tsx`) *and* every filter-bar segment
   (`ScreeningBrowser.tsx`); its total reach is 6px (4px offset + 2px ring), so pressed/selected
   elements translate a matching 6px to land flush where the shadow edge was, and hover gives a
   half-press (`--shadow-chip-half`, 3px reach, `translate 3px`).

   **Segmented filter-bar controls** (Day/Cinema/Time in `ScreeningBrowser.tsx`): each segment
   *does* carry its own `border-2` + `--shadow-chip`, but the segments sit flush — a `-ml-0.5`
   negative margin (= the border width) pulls each segment's left border exactly onto the
   previous one's right border so they merge into one shared line, and only the group's two end
   segments round outward (`controlPositionClass`). An inactive segment's shadow is then mostly
   hidden under its right-hand neighbor; the visible bottom strips line up into one continuous
   stacked-card shadow under the whole control, so it still reads as a single unified control,
   not a strip of separate chips. Every segment needs an explicit `relative` + ascending inline
   `z-index` in DOM order (see the comment on `controlPositionClass`) because the active/pressed
   segment's `translate` creates a stacking context. There is deliberately **no** "disabled"
   segment variant — a segment the user can't act on is removed from the row (or, when it's the
   sole remaining option, shown as a non-interactive selected-styled segment); see `ControlGroup`.
   Don't collapse this back to a single wrapper-only border/shadow, or reintroduce a greyed-out
   disabled state, without asking first.

8. **No film-count / progress-style UI.** A "here are X films" counter with a struck-through
   previous count was tried and explicitly rejected — the user said counters "add pressure" they
   want to avoid. Don't reintroduce running counts, badges, or similar in the main UI without
   asking first.

9. **Public release runs on a weekly curated pipeline, not live per-visitor scraping.** Decided
   2026-08-24 when preparing for public deployment: live-scraping on every request meant any
   anonymous visitor could trigger a scrape (via the now-removed "Refresh now" button), and there
   was no chance to catch scraper mistakes — mangled titles, wrong Letterboxd matches — before
   real users saw them. Now: `npm run fetch:batch` (intended to run on Thursdays, when both
   cinemas' programmes turn over — `upcomingDays()` gives a full 7-day week in that case, capped
   at the upcoming Thursday if run any other day) cleans titles, resolves Letterboxd links, and
   writes `data/staging-batch.json` plus a plain-text report. The user reads the
   report, and `npm run fetch:confirm` promotes staging to `data/showtimes.json` — the one file
   that's committed and pushed; `app/page.tsx` reads it statically, no runtime fetch. This also
   drove decisions #1 and #3 above. `app/actions.ts` and `components/RefreshButton.tsx` were
   deleted — nothing left for a visitor to refresh.

10. **Installable to the home screen as "flm on" (lowercase), with generated icons.** Added
    2026-08-27. The document `<title>`, `metadata.appleWebApp.title` (iOS home-screen label), and
    `app/manifest.ts` `name`/`short_name` are all the lowercase `flm on`; the old descriptive
    string moved to `description`. `app/manifest.ts` needs `export const dynamic = "force-static"`
    (like every route, because of `output: "export"`) and uses **relative** URLs (`start_url: "."`,
    `src: "icon-192.png"`) so it resolves correctly both at the domain root locally and under the
    `/flm-on/` GitHub Pages basePath without env plumbing — Next only auto-prefixes basePath onto
    the file-convention icon `<link>`s, not manifest strings.

    The icon is the page's cream background (`--color-bg`) with a single near-white surface disc
    (`--color-surface`) wearing a lighter version of the buttons' chunky treatment — ink border +
    a slightly-tightened two-tone offset shadow (`--shadow-chip`: a grey block wrapped in an ink
    ring). They're **generated, committed PNGs**,
    not runtime routes: `npm run gen:icons` (`scripts/gen-icons.tsx`) builds a plain SVG (no
    font) and rasterises it with `sharp`, writing `app/icon.png` / `app/apple-icon.png` (Next
    auto-links these), `app/favicon.ico` (a PNG in a hand-rolled ICO container — sharp can't emit
    `.ico`), and `public/icon-{192,512,maskable}.png` (referenced by the manifest). The maskable
    variant uses a smaller disc so it + its shadow stay inside the safe circle. Re-run it if the
    palette changes.

11. **Curated per-film editorial labels (`data/film-labels.json`).** Added 2026-08-28. A
    committed flat map `{ "<normalized title>": "<label>" }` — key is exactly
    `filmTitle.trim().toLowerCase()` (same normalization as `groupByFilm` /
    `FilmGroup.key`), value is free text (e.g. `"classic!"`). Consumed at **render/build
    time only** — `app/page.tsx` `loadFilmLabels()` reads it and threads a `labels` map
    through `ScreeningBrowser` → `FilmCard` (`label={labels?.[group.key]}`); it is **not**
    part of `showtimes.json` and the scrape/`fetch:confirm` pipeline never touches it, so
    editing a label just needs a rebuild, not a re-scrape. `scripts/fetch-batch.ts` prints
    a "Labels" section listing every film's exact key + current label so one can be pasted
    in during the weekly review without guessing the apostrophe/casing — and, since decision
    #16, it also **writes** the file: any Cineworld "Big Screen Classics" film with no label
    yet gets `classic!` pre-filled (the file is rewritten sorted), for the user to review in
    the diff. Rendered by
    `components/FilmLabel.tsx` (a `<MarqueeSticker>`) after the title + year
    — decorative, so per decision #7 it uses `--color-fg`/`--color-bg`, never
    `--color-accent`, and per decision #8 it must not become a count/badge. Keyed on title alone (not `Title|Year`
    like `letterboxd-overrides.json`) deliberately — labels are per-film and the
    cinema-reported year is unreliable. A card shows **one** sticker max — a special-screening
    label (decision #13) takes precedence over this one.

12. **The IFI "Mystery Matinee" strand is rendered as a redacted card.** Added 2026-08-28.
    The whole point of the strand is that the film isn't announced, so its card leans into
    that: `lib/mystery.ts` `isMysteryFilm(title)` (`/^mystery matinee\b/i`, matched on the
    *cleaned* title) gates `FilmCard.tsx` to (a) drop the year and duration entirely — they'd
    narrow the guess, and IFI's values for both are placeholders anyway — and (b) render the
    title via `components/MysteryTitle.tsx`, a client component that covers each word with a
    solid `--color-fg` block (transparent text underneath, so it stays in the DOM for AT) and
    toggles to plain text on click, the way a review site hides a spoiler. Decorative, so per
    decision #7 the blocks are `--color-fg`, never accent. The trailing month/year on the raw
    listing (`Mystery Matinee August 2026`) is stripped by a new `stripAnnotations` regex
    (`(?:january|…|december)\s+\d{4}`) in `data/title-overrides.json`, so future months need no
    per-month correction — unlike the `Archive at Lunchtime` strand, whose real name lives only
    in the poster filename. `DayPlan`/`ComboSuggestions` still show the runtime for a Mystery
    Matinee added to a plan — the gap math needs it — only the card hides it.
    It also **counts as a special screening** (decision #13): `ScreeningBrowser` attaches a
    synthetic `"Mystery Matinee"` to `screeningTags` for any `isMysteryFilm` screening (in the
    `upcomingScreenings` memo — render-time only, like the redaction, not in `showtimes.json`),
    so it passes the Highlights filter through the same `displayScreeningTags` path as the rest.
    But its `KNOWN["mystery matinee"]` entry (in `lib/screeningTags.ts`) carries `mark: false`,
    so unlike the other specials it shows **no `☻` mark or sticker** — the redacted card is
    already treatment enough, and the extra badge would be noise on top of it.

13. **Special screenings get a per-session marker.** Added 2026-08-28. Light House runs
    **Parent & Baby** screenings (Wed/Sat mornings — babies welcome, volume down, lights up).
    The site tags them per showtime in `.time > em.additional` (one or more inner
    `<em class="tooltip">`, comma-joined — also `Dubbed`, `Subtitled`, `Open Captioned`), present
    in both the `/films` today-tab and the `/ajax/films-by-day/{n}` fragments (no detail-page
    fetch needed). `lib/scrapers/lighthouse.ts` `parseSessionTags` reads them into a generic
    `Screening.screeningTags?: string[]` (raw labels). That field flows end-to-end untouched —
    `aggregate`, `cache`, `clash`, `groupings`, the batch scripts all spread `...s` / JSON
    round-trip (same as decision #11's labels, but this one *is* in `showtimes.json`).
    `lib/screeningTags.ts` `displayScreeningTags` is the gate on what actually shows: the
    special-audience / curated-event strands — `Parent and Baby`, `Relaxed`/`Autism Friendly`
    (→ one `relaxed`), `Cinema Book Club`, `Silver Screen`, `Mystery Matinee` (the last attached
    render-time by `ScreeningBrowser`, not scraped, and carrying `mark: false` so it counts as a
    special but renders no glyph — see decision #12). Caption/language notes (`Subtitled` /
    `Dubbed` / `Open Captioned`) are captured but deliberately not surfaced — widening is a
    one-line edit to the `KNOWN` map (each entry also carries a `title` + `description`, cleaned
    up from Light House's `data-tooltip` text, shown as a `title=` hover tooltip — on the whole
    pill / plan-row button, and on the sticker itself). Rendered by `components/ScreeningTags.tsx`: a **bare `☻`
    mark** (`<ScreeningTagMarks>`) after the time on the `FilmCard` pill and the `DayPlan` row,
    and the name spelled out once per card as a `<MarqueeSticker>` after the title
    (`<ScreeningTagLabel>` → "☻ parent & baby", same sticker treatment as `FilmLabel`).
    Rationale (user): the slot is the same every week, so once the sticker names it you
    recognise the mark alone — no need to repeat the words on every pill. The mark is `☻`
    (U+263B, filled — reads better small than the outline `☺`) at `1.4em`, forced flat with
    `font-variant-emoji: text` (the symbol also carries U+FE0E); never accent. **A card shows
    at most one sticker** — `FilmCard` suppresses the curated `FilmLabel` when a screening
    label is present (so `Cinema Book Club: Mrs. Doubtfire` shows "☻ cinema book club", not its
    `classic!` label). The `kiki's delivery service → classic!` `film-labels.json` entry was
    removed since P&B outranks it.
    `scripts/fetch-batch.ts` prints a "Special screenings" section (plus, since decision #16, an
    "unrecognised screening tags" section) so a new/unexpected descriptor surfaces in the weekly
    review. **Cineworld** maps its `Showtime.Event.*` / `Showtime.Accessibility.AutismFriendly`
    tags onto this vocabulary (`Movies for Juniors`, `relaxed`, …) — decision #16. **Big Screen
    Classics** is the exception: it's in `KNOWN` with `mark: false` (no ☻ / sticker, like Mystery
    Matinee) — instead `scripts/fetch-batch.ts` pre-fills a `classic!` entry in
    `data/film-labels.json` (sorted, written back) for each BSC film that has no label yet, and
    the user reviews the diff. **IFI is only wired up for per-session formats** (decision #15 —
    `svg[data-icon]` on each booking link); its special-audience strands still aren't tagged. The "Archive at Lunchtime" strand isn't tagged per-session (only a
    ubiquitous `wheelchair` icon); the sole signal is the `filmPageUrl` slug
    `ifi.ie/films/archive-at-lunchtime-*`, which would need slug-based derivation in the IFI
    adapter — deliberately not done. The current `data/showtimes.json` was hand-patched for the
    live special sessions in this week's window (Kiki's P&B 2026-08-29 & 2026-09-02 11:00, and
    Mrs. Doubtfire / Cinema Book Club 2026-08-31 18:30); future weeks come from the scraper.
    Light House's full `em.additional` vocabulary seen so far: `Subtitled`, `Dubbed`,
    `Open Captioned`, `Parent and Baby`, `Cinema Book Club`, `Silver Screen`, `35mm`.

15. **Film formats — 35mm / 70mm / IMAX.** Added 2026-08-29. A sibling concept to the
    special-screening markers (#13), sharing the same `Screening.screeningTags` carrier but with
    its own module (`lib/formats.ts`) and components (`components/FilmFormats.tsx`). Sources:
    Light House already emits `35mm` in `em.additional`; the IFI adapter now reads
    `svg[data-icon]` on each `a.screening-card__screening` (`70mm` → format; `open-captioned`
    carried for parity but unsurfaced; `wheelchair`/`runtime` ignored) via the `ICON_TAGS` map.
    IMAX is sourced from Cineworld (decision #16 — a `Format.Projection.Imax` tag, plus a
    `": The IMAX Experience"` companion-movie form the adapter folds in); aliases `imax 70mm` /
    `15/70` / `1570` / `format.projection.imax` also map. `displayFilmFormats` mirrors
    `displayScreeningTags`. Render: `<FilmFormatTag>` — a box on the `FilmCard` meta line (after
    duration, before Letterboxd); all formats share a width, `height = width / ratio`, and
    `ratio` descends 35mm (1.5) → 70mm (1.2) → IMAX (0.95) so a bigger format is a taller box
    ("bigger format = taller", user's framing — not literal projection ratios).
    `<FilmFormatMarks>` — a bare ratio-shaped rectangle after the time on a pill / `DayPlan` row,
    the format analogue of the `☻` mark. `filmFormatsTooltip` is merged into the pill / plan-row
    `title` next to `screeningTagsTooltip`. Not a count (#8). All formats count toward the
    **Highlights** toggle (`preferred` memo in `ScreeningBrowser`). Formats are a *tag*, not a
    marquee sticker, so the "one sticker max" rule is unaffected — a 70mm Parent & Baby screening
    shows both.

    **Print (`print: true`) vs digital.** 35mm / 70mm are struck from an actual print: the card
    box is styled as a single frame of film strip — a `--color-fg` box, `--color-bg` radial-
    gradient sprocket rails tiled down each edge (`Perforations`), the label on a two-copy
    vertical reel (`.flm-filmstrip-reel`) and the rails scrolling their background
    (`.flm-filmstrip-rail`, one 5px dot-period per loop) — both upward, roughly speed-matched, so
    it reads as film running through a gate. `.flm-filmstrip-*` live in `globals.css`;
    reduced-motion / print freeze both. **IMAX (`print: false`)** is a normal digital projection
    (it just means the big house), so its box is a **static plaque in the IMAX brand blue**
    (`brandColor` `#0057b8`, white text) — no rails, no animation, same size/ratio. Its
    `<FilmFormatMarks>` rectangle is the same blue. That blue is the **second** allowed exception
    to the ink + single-gold palette (decision #7), after the Letterboxd mark — a third party's
    brand identity, not decoration.
    First real data: 2026-08-29 "The Odyssey" plays 35mm at Light House and 70mm at IFI the same
    week; 2026-08-30 it added IMAX at Cineworld — one card, three format boxes, each pill its mark.

14. **Settings panel — persisted viewing preferences (localStorage).** Added 2026-08-29. The
    app's **only** persisted state and its first `localStorage` / `useEffect` /
    `useSyncExternalStore` usage. `lib/preferences.ts`: `Preferences` (`cinemas` /
    `timeframes` maps + `hideShortFilms` + `kidsOnly` + `hideDubbed`; **`hideShortFilms` defaults
    on** — the archive-at-lunchtime strands are noise for most visits; `hideDubbed` defaults off —
    decision #17), `STORAGE_KEY = "flm-on:preferences"`, and `normalize` — a pure
    deep-merge-onto-`DEFAULT_PREFERENCES` that coerces bad types and drops unknown keys; that
    function is the forward-compat / migration seam (a breaking change would branch on a stored
    `version`). Adding the `cineworld` cinema (decision #16) needed no migration — `normalize`
    maps over `CINEMA_ORDER`, so a blob saved before it existed picks the new key up defaulted-on. Read via `useSyncExternalStore(subscribePreferences,
    preferencesSnapshot, () => PREFERENCES_SERVER_SNAPSHOT)` so SSR and the first client render
    agree (both use `DEFAULT_PREFERENCES`) with no hydration warning; a `storage` listener also
    syncs across tabs. **Model: standing pre-filter** — the `preferred` memo in `ScreeningBrowser` carves the
    dataset down before anything else derives from it (`cinemasPresent`, `visibleDays`,
    `usableTimeframes`, `timed`, combos all read `preferred`), so turning a cinema/time off just
    shrinks a `ControlGroup`'s option list and it collapses on its own. When a preference pins a
    group to a single value the corresponding filter-bar `ControlGroup` is **not rendered at all**
    (`cinemaFilterUseful` / `timeFilterUseful` gates) — there's nothing for it to narrow past your
    own preference. (This is a *controls-only* rule — the film chips still label each pill with
    its cinema.) No disabled segment
    (decision #7). New `effectiveCinema` / `effectiveDay` guards generalise the existing
    `effectiveTimeframe` "revert a now-impossible selection to any". `lib/duration.ts`
    `isShortFilm` / `SHORT_FILM_MAX_MINS = 40` — **per-screening**, so a film with a mix (e.g.
    "Horse Plays": four ~32-min programmes + one 65-min double bill) keeps only its long
    session; unknown runtime is never short. `kidsOnly` (also panel "General", also `preferred`)
    → `lib/certs.ts` `isKidFriendly` — IFCO `G`/`PG`/`12A` only; `15A`+ and **no listed cert**
    are excluded (Lighthouse doesn't upper-case its cert string, so normalize in the helper).

    **The Highlights toggle (labelled "☻ Specials, etc" — the same flat-ink smiley the
    special-screening marks use, decision #13) is a filter-bar toggle, not a saved
    preference** — a `useState` (`highlightsOnly`) in `ScreeningBrowser` (ephemeral, resets on
    reload), a standalone single-line segment first in the bar, ahead of the Day/Time/Place
    `ControlGroup`s (it's the lens reached for most). On →
    `preferred` keeps only screenings that are a surfaced special screening
    (`displayScreeningTags(...).length > 0`) **or** whose film carries a `data/film-labels.json`
    label (so `preferred` also reads the `labels` prop). It's a browsing lens flipped often, so
    it lives in the always-visible bar; the saved preferences live in a panel behind a header
    button. The empty-state reset clears both.

    UI: a **header button** (`components/PreferencesButton.tsx`, top-right of the `<h1>`; an
    inline horizontal-sliders SVG, `PreferenceIcon` — the filters convention, not a gear; a
    `--color-fg` dot when prefs ≠ default — binary, not a count, decision #8) opens
    `components/SettingsPanel.tsx` — a CSS-responsive centered modal (`sm:`) / bottom sheet with
    a gap to the viewport so its shadow shows, scrim + Escape + body-scroll-lock. Each option is
    a **toggle button in the same accent-fill / hard-press style as the filter-bar segments**
    (`components/controlSegment.ts` — `SEGMENT_BASE` + `controlSegmentClass`, extracted from
    `ScreeningBrowser` and shared), grouped inline (`flex flex-wrap`). **Cinemas and Times each
    require ≥1 on** — the last remaining one locks (`aria-disabled`, `cursor-default`, click is a
    no-op; still shows the selected accent fill, not a greyed disabled look). Hide-shorts /
    highlights / an edge case can still empty the view, so a "nothing within your current view"
    empty state with a one-tap Reset (clears prefs **and** the highlights toggle) stays as a
    fallback.
    `prefsLoaded` (rides in the snapshot) holds the film list for the one frame between the
    server snapshot and the first real read rather than rendering everything and shrinking it.

    Also fixed here (pre-existing, same component): `lib/date.ts` `formatDayDate` was
    `Intl … month: "short"`, which hydration-mismatched ("1 Sept" server vs "1 Sep" browser —
    CLDR drift); it's now a hand-rolled `<day> <Mon>`.

16. **Cineworld Dublin — a JSON-API adapter, filtered to non-standard screenings.** Added
    2026-08-30. `lib/scrapers/cineworld.ts`. Cineworld.ie is a Gatsby site backed by a public,
    unauthenticated JSON API (`robots.txt` empty). Theatre id **`X07A4`**. Two calls per batch
    window, both in `fetchCineworldRaw`:
    - `GET /api/gatsby-source-boxofficeapi/schedule?from={ISO}&to={ISO}&theaters={"id":"X07A4","timeZone":"Europe/Dublin"}`
      (`theaters` is URL-encoded JSON; day boundary 03:00 local) →
      `{ X07A4: { schedule: { <movieId>: { <YYYY-MM-DD>: [ {id, startsAt, tags[], data.ticketing[{provider,urls}]} ] } } } }`.
      Accepts an arbitrary range — one call for the week. The `provider:"default"` URL
      (`https://web.cineworld.ie/order/showtimes/0001-NNNNNN/seats`) is the `bookingUrl`, unique
      per session (decision #6).
    - `GET /api/gatsby-source-boxofficeapi/movies?basic=false&castingLimit=1&ids=…` (chunked at
      30) → `[{ id, title, runtime (SECONDS — ÷60), certificate, release / releases[].releasedAt,
      … }]`. `filmPageUrl` = `https://www.cineworld.ie/movies/{id}-{slug}/`.
    - `scheduledMovies` exists but is unused — the schedule call already returns only movies that
      play in the window.

    **Non-standard filter (`isNotableTagSet` / `normaliseTags`)**: a multiplex would bury the two
    arthouse cinemas (~257 showtimes in a 3-week sample), so the adapter keeps a screening only
    if — after dropping the "ordinary" tags (`Format.Projection.Digital`/`.Laser`,
    `Auditorium.Experience.4dx`/`.ScreenX`/`.Superscreen`, `Showtime.Accessibility.AudioDescription`)
    — a descriptor still survives: IMAX, a `Localization.Language.*`, `Subtitled`,
    `AutismFriendly`, or any `Showtime.Event.*` strand. Surviving raw tags are normalised onto
    the shared `screeningTags` vocabulary (`Format.Projection.Imax` → `IMAX`,
    `Showtime.Event.BigScreenClassics` → `Big Screen Classics`, `Localization.Language.Tamil` →
    `Tamil`); **unknown `Showtime.Event.*` are kept verbatim** so a new strand shows in the batch
    report (`summariseDroppedTitles` + the "unrecognised screening tags" section, both added to
    `scripts/fetch-batch.ts`). **4DX / ScreenX get no visual treatment yet** (decision #15, user:
    "IMAX only for now") and, being dropped, don't keep an otherwise-ordinary blockbuster.
    **Big Screen Classics** is kept (the tag survives → the screening is notable) but gets no ☻
    treatment — `KNOWN["big screen classics"]` is `mark: false`, and `fetch:batch` instead
    pre-fills a `classic!` label into `data/film-labels.json` for the user to review (decision
    #11). **Movies for Juniors** *does* get the ☻ mark (a genuine audience strand like
    Parent & Baby).

    Cineworld quirks: IMAX sometimes appears as a **separate movie** (`"… : The IMAX Experience"`,
    its own id) rather than a tag — the adapter strips that suffix and synthesises an `IMAX` tag
    so `groupByFilm` merges it onto the base film. Re-releases get a current-year `release` (same
    as Light House — decision #4; fix via `letterboxd-overrides.json`). Foreign titles carry a
    trailing `(Tamil)` etc. that duplicates the language tag — stripped in the adapter. Repertory
    foreign titles often have no `release`/`certificate` at all → year/cert `undefined`, so the
    `letterboxd-overrides.json` key has an empty year (`"I (Ai)|"`). A film that's genuinely
    interesting but plays Cineworld only as a plain digital showing is dropped with no override
    path yet (see Known gaps). Films the user never wants shown, from any cinema (e.g. Harry
    Potter), go in `data/hidden-films.json` (`lib/hidden.ts`, applied in `lib/aggregate.ts`).

17. **International / foreign-language support — `lib/languages.ts`.** Added 2026-08-30, reworked
    2026-08-31. The third reader of `Screening.screeningTags`, alongside `screeningTags.ts` and
    `formats.ts`. `displayLanguage(tags)` → `{ language?, subtitled, dubbed } | null`: an original
    non-English language name (`LANGUAGE_NAMES` map, ~90 entries) plus subtitled (incl.
    "open captioned") / dubbed state.

    **Language is per-film, from Letterboxd's "Primary Language" field** (`parsePrimaryLanguage`
    in `lib/letterboxd.ts` — parsed from the same page fetch that gives the year; the details
    panel uses `<h3><span>Language</span>` for single-language films, `Primary Language` +
    `Spoken Languages` for multi). `withLetterboxdLinks` in `lib/aggregate.ts` folds it into
    every screening's `screeningTags` (case-insensitively de-duped, so a cinema's own
    per-session language token wins). Covers **every non-English film across all three cinemas**,
    not just the ones a cinema happens to tag. Wrong/missing values are pinned in
    **`data/language-overrides.json`** (`lib/languageOverrides.ts`; `"<cleaned title>" → language`,
    or `null` to force unmarked) — checked before the Letterboxd value. Cineworld's
    `Localization.Language.*` showtime tag is the fallback for a film that doesn't resolve on
    Letterboxd. **Subtitled/dubbed is per-session**: Cineworld's `Showtime.Accessibility.*`,
    Light House's long-captured `Subtitled`/`Dubbed`/`Open Captioned` (parsed since decision #13,
    surface only now).

    Render (`components/ScreeningLanguage.tsx`): `<LanguageTag>` — the **language name only**, an
    outlined `--color-dim` chip on the `FilmCard` meta line right after the duration;
    `<LanguageMarks>` — the **per-showtime `ST` / `Dub`** (`captionMark`) after the time on a
    pill / `DayPlan` row (the language isn't repeated on every pill). `languageTooltip` merges
    into the pill/row `title`. A **tag, not a marquee sticker** (decision #13's "one sticker max"
    untouched); informational → never accent (decision #7). A language screening **counts toward
    the Highlights ("☻ Specials, etc") filter**. Preference **`hideDubbed`** (default off,
    General group in `SettingsPanel`) drops dubbed sessions — usually the kids' matinee version.

    `letterboxd-cache.json` entries are now `{ url, year, language }`; a legacy entry missing
    `language` re-resolves once to backfill (one slower batch run — see decision #4). A Primary
    Language name not in `LANGUAGE_NAMES` still rides in `screeningTags` and surfaces in the
    `fetch:batch` "unrecognised screening tags" section — one line to add. The batch report also
    has a **"Languages"** section listing every non-English film's resolved language for review.

## Known gaps

- No automated tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`)
  against scraper parsing and combo logic, run via `npx vitest run`.
- Duplicate-session pills aren't visually distinguished (#6 above).
- IFI special screenings (Parent & Baby, relaxed, captioned) aren't tagged — only Light House is
  wired up (#13). IFI *formats* are read from `svg[data-icon]` (#15), but only `70mm` /
  `open-captioned` are mapped; a new `data-icon` value is silently dropped (surfaces in the
  `fetch:batch` report only if it maps to something). No automatic check for a new/unhandled
  `em.additional` value beyond that report.
- IMAX now has a real source (Cineworld, #16); 4DX / ScreenX / Superscreen are recognised but
  deliberately unsurfaced (#15/#16).
- No alerting if a cinema's HTML structure changes — scrapers degrade to cached data via
  try/catch, but nothing flags a *silent* long-term failure. Same for Cineworld's JSON API
  shape (#16).
- Cineworld's non-standard filter is tag-based only — a genuinely interesting film that plays
  Cineworld solely as a plain digital showing is dropped, with no per-title allowlist to rescue
  it (would be a new `data/` file). The `fetch:batch` "dropped ordinary screenings" section is
  the manual check.
- Language marking depends on the film resolving on Letterboxd (a NOT-FOUND foreign film isn't
  marked unless a `data/language-overrides.json` entry is added) and on the "Primary Language"
  name being in `LANGUAGE_NAMES` (a missing one surfaces in the `fetch:batch` "unrecognised
  screening tags" section — one line to add). Letterboxd's primary language is occasionally wrong
  for Indian regional films / dubs — the batch "Languages" section is the manual check. IFI /
  Light House still don't tag *subtitled/dubbed* per session (only Cineworld + Light House
  `em.additional` do).
- Nothing enforces the Thursday cadence — if the weekly `fetch:batch`/`fetch:confirm` run is
  skipped, the public site just keeps serving last week's `data/showtimes.json` with no warning.
- IFI titles often scrape in ALL CAPS while Light House's don't — `fetch:batch`'s report flags
  these as `[CASING DIFFERS]` so a `data/title-overrides.json` correction can be added, but
  nothing catches a *new* casing mismatch automatically.
- `letterboxd-overrides.json` keys are `"exact title|year"` — if a cinema quietly changes a
  title's punctuation/accents (IFI relabelled "De Gaulle … Resistance" → "…Résistance"
  2026-08-29) the old key stops matching and the film silently drops to NOT FOUND until a new
  key is added. Sanity-check the report's NOT FOUND list against what *used* to resolve.

## Running it

- `npm run dev` — dev server
- `npx vitest run` — unit tests
- `npm run build` — production build (see decision #3 for what to check)
- `npm run fetch:batch` — weekly scrape into `data/staging-batch.json` + review report (decision #9)
- `npm run fetch:confirm` — promote staging to the committed `data/showtimes.json`
- `npm run gen:icons` — regenerate the app icons + favicon from `scripts/gen-icons.tsx` (see PWA note below)

## Data files (`data/`)

Committed:
- `showtimes.json` — the published week the app actually reads. Only file that gets pushed.
  A screening may carry `screeningTags: string[]` — the shared per-session vocabulary read by
  `lib/screeningTags.ts` (specials — decision #13), `lib/formats.ts` (`35mm`/`70mm`/`IMAX` —
  #15), and `lib/languages.ts` (`Tamil`/`Subtitled`/`Dubbed` — #17). Light House emits them from
  `em.additional`, IFI from format `svg[data-icon]`s, Cineworld normalises its API tags onto them
  (#16), and `lib/aggregate.ts` appends the per-film language from Letterboxd (#17).
- `title-overrides.json` — `{ stripPrefixes: string[], stripAnnotations: string[] (regex sources),
  corrections: Record<string,string> }`.
- `letterboxd-overrides.json` — `Record<"title|year", string | null>`, checked before auto-resolve.
  `year` is the *scraped* year and is often empty (`"I (Ai)|"`) for a repertory foreign title.
- `film-labels.json` — `Record<"<normalized title>", string>`, curated editorial tags shown
  as a marquee sticker after the film title (decision #11). Render-time only; not in
  `showtimes.json`. `fetch:batch` pre-fills `classic!` for Big Screen Classics films and rewrites
  it sorted (decisions #11, #16).
- `hidden-films.json` — `{ titleSubstrings: string[] }`, an editorial blocklist applied in
  `lib/aggregate.ts` (`lib/hidden.ts`) — a matching film never reaches staged/published data,
  from any cinema.
- `language-overrides.json` — `Record<"<normalized title>", string | null>` (`lib/languageOverrides.ts`),
  checked before Letterboxd's "Primary Language" — a string forces that language, `null` forces
  the film unmarked (decision #17).

Gitignored (runtime cache/staging, regenerated by scripts or local dev):
- `cache.json` — live-scrape cache, 6h TTL, includes explicit empty entries per date.
- `letterboxd-cache.json` — long-lived Letterboxd auto-match cache (`{ url, year }` per key), no TTL.
- `staging-batch.json` — this week's not-yet-confirmed fetch, written by `fetch:batch`.
