@AGENTS.md

# FLM ON — Dublin cinema showtime planner

Personal single-user app (no auth, no accounts) that combines showtimes from the user's two
favourite Dublin cinemas — **Light House Cinema** and **IFI** — into one place, with tools to
plan a day at the cinema — anything from a double bill up to a full day of back-to-back
screenings. Built iteratively through direct conversation with the user; this file exists so a
future session can pick back up without re-deriving the reasoning below.

Public deployment (see decision #9) runs on a **weekly curated data pipeline**, not live
per-visitor scraping: a manually-run script fetches the week's showtimes, the user reviews a
plain-text report, and confirming promotes it to the one committed data file the deployed app
reads statically.

## Stack

Next.js 16 (App Router) + TypeScript, Tailwind v4, cheerio for HTML parsing, vitest for tests.
No database — `data/showtimes.json` (the published week) plus `data/title-overrides.json` and
`data/letterboxd-overrides.json` (curated corrections) are committed; everything else in `data/`
is gitignored runtime cache/staging.

## Architecture

- `lib/scrapers/lighthouse.ts`, `lib/scrapers/ifi.ts` — `CinemaAdapter` implementations (real
  scrapers, not dummy data — Phase 1 used hand-written dummy adapters to build the UI risk-free,
  Phase 2 swapped in these).
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
  these files shifts `letterboxd-overrides.json` keys too.
- `lib/letterboxd.ts` — `resolveLetterboxd(title, year)` → `{ url?, year? }`: resolves each film's
  Letterboxd page (see decision #4) *and* returns that page's `og:title` year, which
  `lib/aggregate.ts` then adopts as the film's real year (cinema-reported years are unreliable —
  decisions #2, #4 — so the scraped year is only a fallback for NOT-FOUND films). Cached
  indefinitely in `data/letterboxd-cache.json` as `{ url, year }` per `title|year` key (no TTL — a
  match doesn't change; legacy bare-string entries are migrated on read and re-resolve once to
  pick up a year). `data/letterboxd-overrides.json` is checked first and always wins; an override
  gives only a URL, so its page is fetched once for the year.
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
  an explicit "Any Day"/"Anywhere"/"Any Time" segment rather than an implicit all-deselected
  state) and the day-plan selection state (`selectedKeys: Set<string>` — any number of screenings,
  not just a pair; see decision #5).
- `components/FilmCard.tsx` — one film's card. Header line 1: title (black) + year inline
  (title-sized but `font-normal`, `text-dim`, no parens), with the cinema film-page links
  top-right as chips (`your plan`-style: `border-2`/`rounded-btn`, one per cinema currently in
  view, from `Screening.filmPageUrl` — each cinema's own detail page, `ifi.ie/films/{slug}` /
  `lighthousecinema.ie/film/{slug}`, kept separate from `bookingUrl`). Line 2: cert, duration,
  Letterboxd link. Screening pills are grouped by day then timeframe; the day sub-header shows
  unless a specific Day chip is active (`daySpecified` — then the chip already says the day).
  A special-screening session shows a bare `☻` mark after the time; a marquee sticker after the
  title names it once ("☻ parent & baby") — see decision #13.
- `components/MarqueeSticker.tsx` — the small fixed-width dark sticker whose text scrolls on a
  seamless loop (two copies + a `translateX(-50%)` loop via the `flm-marquee` keyframe in
  `app/globals.css` — the project's only CSS animation; reduced-motion → static full-width).
  `--color-fg` sticker, `--color-bg` text, never accent. Shared by `FilmLabel` and
  `ScreeningTagLabel`.
- `components/FilmLabel.tsx` — a curated editorial tag (from `data/film-labels.json`, see
  decision #11) rendered as a `<MarqueeSticker>` after a film's title + year. Decorative.
- `components/ScreeningTags.tsx` + `lib/screeningTags.ts` — special-screening markers.
  `displayScreeningTags` filters `Screening.screeningTags` (raw per-session descriptors from the
  scraper) to the surfaced set — Parent & Baby, Relaxed, Cinema Book Club, Silver Screen — →
  `{ symbol, label, title, description }` (`title`/`description` are curated from Light House's
  own `data-tooltip` text).
  `<ScreeningTagMarks>` renders the bare `☻` on a pill / `DayPlan` row; `<ScreeningTagLabel>`
  renders a `☻ parent & baby` `<MarqueeSticker>` after the film title. The
  `title="<name> — <description>"` hover tooltip (`screeningTagsTooltip`) goes on the **whole**
  pill / plan-row button (not the glyph); the sticker carries its own (also its accessible name).
  `font-variant-emoji: text` (symbol carries U+FE0E) keeps the smiley flat. Decision #13.
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

   **Light House stamps re-releases with the *current* year** ("Released: …-2026" on a 1986
   Tarkovsky restoration), which defeats the `og:title` year check and — worse — can match a
   *different* real film of the same name that genuinely is from this year (e.g. `The Sacrifice`
   auto-resolved to `the-sacrifice-2026`, a different 2026 film, instead of `the-sacrifice`). These
   are pinned in `data/letterboxd-overrides.json` (keyed on the *wrong* year LH reports, e.g.
   `"The Sacrifice|2026"`, `"Sunset Boulevard|2025"`). When reviewing a batch, sanity-check any
   repertory/restoration title's link, not just the NOT FOUND list.

5. **Day-plan building (suggestions + click-to-select) only activates when the Day filter is
   narrowed to a specific date (`activeDay !== null`)** — a plan is inherently single-day; the
   "Any Day" segment disables it entirely. Selecting a showtime auto-narrows the Day filter to
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
   actionable/important things and the current selection — never decoratively.

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
    in during the weekly review without guessing the apostrophe/casing. Rendered by
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
    (→ one `relaxed`), `Cinema Book Club`, `Silver Screen`. Format notes (`Subtitled` / `Dubbed`
    / `Open Captioned` / `35mm`) are captured but deliberately not surfaced — widening is a
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
    `scripts/fetch-batch.ts` prints a "Special screenings" section so a new/unexpected
    descriptor surfaces in the weekly review. **IFI is not wired up** — no `screeningTags` on IFI
    screenings at all. Its "Archive at Lunchtime" strand isn't tagged per-session (only a
    ubiquitous `wheelchair` icon); the sole signal is the `filmPageUrl` slug
    `ifi.ie/films/archive-at-lunchtime-*`, which would need slug-based derivation in the IFI
    adapter — deliberately not done. The current `data/showtimes.json` was hand-patched for the
    live special sessions in this week's window (Kiki's P&B 2026-08-29 & 2026-09-02 11:00, and
    Mrs. Doubtfire / Cinema Book Club 2026-08-31 18:30); future weeks come from the scraper.
    Light House's full `em.additional` vocabulary seen so far: `Subtitled`, `Dubbed`,
    `Open Captioned`, `Parent and Baby`, `Cinema Book Club`, `Silver Screen`, `35mm`.

## Known gaps

- No automated tests for the interactive UI layer — only `lib/` unit tests (`test/*.test.ts`)
  against scraper parsing and combo logic, run via `npx vitest run`.
- Duplicate-session pills aren't visually distinguished (#6 above).
- IFI special screenings (Parent & Baby, relaxed, captioned) aren't tagged — only Light House is
  wired up (#13). No automatic check for a new/unhandled `em.additional` value beyond the
  `fetch:batch` report.
- No alerting if a cinema's HTML structure changes — scrapers degrade to cached data via
  try/catch, but nothing flags a *silent* long-term failure.
- Nothing enforces the Thursday cadence — if the weekly `fetch:batch`/`fetch:confirm` run is
  skipped, the public site just keeps serving last week's `data/showtimes.json` with no warning.
- IFI titles often scrape in ALL CAPS while Light House's don't — `fetch:batch`'s report flags
  these as `[CASING DIFFERS]` so a `data/title-overrides.json` correction can be added, but
  nothing catches a *new* casing mismatch automatically.

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
  A screening may carry `screeningTags: string[]` (raw per-session descriptors, decision #13).
- `title-overrides.json` — `{ stripPrefixes: string[], stripAnnotations: string[] (regex sources),
  corrections: Record<string,string> }`.
- `letterboxd-overrides.json` — `Record<"title|year", string | null>`, checked before auto-resolve.
- `film-labels.json` — `Record<"<normalized title>", string>`, curated editorial tags shown
  as a marquee sticker after the film title (decision #11). Render-time only; not in `showtimes.json`.

Gitignored (runtime cache/staging, regenerated by scripts or local dev):
- `cache.json` — live-scrape cache, 6h TTL, includes explicit empty entries per date.
- `letterboxd-cache.json` — long-lived Letterboxd auto-match cache (`{ url, year }` per key), no TTL.
- `staging-batch.json` — this week's not-yet-confirmed fetch, written by `fetch:batch`.
