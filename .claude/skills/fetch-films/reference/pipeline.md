# The fetch pipeline — module by module

Everything here is **server-only and weekly**: it runs from `npm run fetch:batch`, never from
`app/page.tsx`. Read this when a scrape breaks, a title/year/language/director comes out wrong,
or you're editing any of these modules. The per-cinema half is `cinemas.md`; the procedure is
`SKILL.md`.

Order of operations for one screening: **adapter → `cleanFilmTitle` → drop if hidden → resolve
Letterboxd → fold language into `screeningTags`**.

## `lib/scrapers/` — the adapters

`CinemaAdapter` per cinema; `index.ts` is the registry, so adding a cinema is one file plus one
array entry (deliberately no in-app settings UI). All three return **every** screening — nothing
is filtered at scrape time. Mechanics and quirks per cinema: `cinemas.md`.

## `lib/aggregate.ts` — the orchestrator

`getShowtimesForRange` / `refreshShowtimesForRange` (the latter invalidates the cache first, which
is what `fetch:batch` calls — so a re-run always re-scrapes).

Fetches each adapter's *missing* dates in one batched call and caches per `(cinema, date)`,
including an **explicit empty array** for dates a cinema has nothing on, so an empty day isn't
re-fetched forever. Then per screening: clean the title, drop hidden films, resolve Letterboxd,
fold the resolved language into `screeningTags`. Returns `DayResult` including
`titleAnnotations` — the trailing junk `cleanFilmTitle` stripped, keyed by cleaned title, which
feeds the label pre-fill.

**This is why most override files need a re-fetch.** Titles, hidden films, Letterboxd, language
and director are all resolved *here*, at fetch time, and baked into `staging-batch.json`. Only
`film-labels.json` is read later, at build time.

## `lib/cache.ts`

In-memory `Map` plus a `data/cache.json` fallback, 6h TTL. Only `fetch-batch` and dev use it.

## `lib/titles.ts` — `cleanFilmTitle(raw, overrides)`

Three passes, in order:

1. exact `corrections` — the escape hatch for a mistitled strand session
2. `stripPrefixes` — programme strands (`CINEMA BOOK CLUB:` …)
3. `stripAnnotations` — regex sources for trailing junk that isn't part of the name
   (`4K Restoration`, `Nth Anniversary`, a `Month YYYY` suffix), matched at the end, bare or
   dash-/colon-prefixed or in `(…)`

The cleaned title is what the UI shows **and** what Letterboxd resolution and its cache/override
keys use — so a `corrections` edit changes the Letterboxd key too, and both need a re-fetch.

`titleAnnotation()` returns what `stripAnnotations` removed (the label pre-fill, decision #11).
`titlesEquivalent(a, b)` — case/punctuation/parenthetical-insensitive, Unicode-aware — gates
whether an `originalTitle` is different enough to be worth showing.

## `lib/hidden.ts`

`data/hidden-films.json` (`{ titleSubstrings: string[] }`), a case-insensitive substring blocklist
on the **cleaned** title, applied before Letterboxd. A hidden film never reaches staged or
published data, from any cinema.

## `lib/letterboxd.ts` — one page fetch, six fields

`resolveLetterboxd(title, year)` → `{ url?, year?, language?, originalTitle?, director?, animated? }`.

**Resolution is a slug guess, not a search** (decision #4). `/search/…` sits behind a Cloudflare
challenge — verified 403, `cf-mitigated: challenge`, even with full browser headers — while
`/film/{slug}/` pages aren't blocked and aren't in robots.txt's disallow. So: slugify the cleaned
title, try `-{year}` first when the year is known, and **verify the resolved page's own `og:title`
year is within ±1** before accepting it.

That one page then yields:

- the **year** — adopted as the film's real year, and what the UI shows. The cinema-reported year
  is only the slug hint plus a fallback for NOT-FOUND films (so `Kiki's Delivery Service` shows
  1989, not 2026)
- `parsePrimaryLanguage` — non-English only (decision #17)
- `parseOriginalTitle` — `<h2 class="originalname">`, native script
- `parseDirector` — the `twitter:label*`/`data*` "Directed by" meta pair, co-directors
  comma-joined. **It only carries the primary director**, which is why a co-directed film needs
  `director-overrides.json`
- `parseIsAnimated` — an `/films/genre/animation/` anchor. Never shown; it gates the
  assumed-subtitles rule (decision #17)

**Cache:** `data/letterboxd-cache.json`, keyed `title|year` where `year` is the *scraped* year,
often empty (`"I (Ai)|"`). No TTL. An entry missing any field re-resolves once. Gitignored, so
its churn is invisible.

**Overrides:** `data/letterboxd-overrides.json` (`Record<"title|year", url|null>`) is checked
first and always wins.

**The failure mode that looks fine in the report:** Light House and Cineworld stamp re-releases
with the **current** year, which can match a genuinely different film of that name from this year
(`The Sacrifice` → `the-sacrifice-2026`). It resolves, so nothing flags it. Sanity-check every
repertory / restoration / re-release link during review, and pin the bad ones keyed on the
*wrong* year (`"The Sacrifice|2026"`).

**Key drift:** because the key is an exact title, a cinema quietly changing an apostrophe or an
accent silently drops the film to NOT FOUND. Check the NOT FOUND list against what *used* to
resolve.

## `lib/languageOverrides.ts` / `lib/directorOverrides.ts`

`data/language-overrides.json` (`Record<title, language|null>`) — checked before the Letterboxd
language; `null` forces a film unmarked.

`data/director-overrides.json` (`Record<title, string>`) — checked before the Letterboxd
director. City of God (Meirelles & Kátia Lund) is the worked example.

## Language and subtitles at fetch time (decision #17)

Language is **per-film**, from Letterboxd's Primary Language, folded into every screening's
`screeningTags` (de-duped case-insensitively, so a cinema's own token wins). That covers every
non-English film across all three cinemas, not just the ones a cinema bothers to tag. Cineworld's
`Localization.Language.*` is the fallback for a NOT-FOUND film.

The caption state is **per-session**, and there are three of them: `Subtitled` (a subtitle
track), `Open Captioned` (burned into the print, always visible) and `Dubbed`. Open captions are
**not** a flavour of subtitles — `displayLanguage` reports them separately and the pill mark is
`OC`, not `ST` (decision #17).

When a non-English film's session carries **none** of those three, `aggregate` **assumes
`Subtitled`** — the Irish norm for a foreign-language release — *unless* Letterboxd files the
film under Animation, since animations often screen English-dubbed. So an animated foreign film
shows a language chip but no OC/ST/Dub mark until a cinema tags one. The report's per-film
tally counts `OC` alongside `ST` / `Dub`, so an open-captioned session never lands in
`UNMARKED`. Note the assumption checks
`openCaptioned` too: a session already tagged `Open Captioned` has English text on screen, so
adding `Subtitled` on top would tag one screening as both and force the pill to pick a mark.

That Animation exception is exactly what the report's `UNMARKED` tally surfaces: an unmarked session means
the film resolved as Animation. Check whether it's really screening dubbed, and if not, pin
`language-overrides.json` or add a caption-tag source.

Needs the film to resolve on Letterboxd *and* its Primary Language to be in `LANGUAGE_NAMES`
(~90 entries) — a miss shows in the report. Letterboxd's primary language is occasionally wrong
for Indian regional films and dubs.

## `scripts/fetch-batch.ts`

Scrapes `upcomingDays()` (`lib/date.ts` — full week on a Thursday, else capped at the next
Thursday), writes `data/staging-batch.json`, prints the review report, and **writes**
`data/film-labels.json` pre-fills.

**Label pre-fills** (decision #11), most specific first: a stripped annotation matching
`/anniversary|restoration/` (`"25th anniversary"`, `"4k restoration"`) beats a Cineworld
"Big Screen Classics" → `classic!`. Existing values are never clobbered; the file is rewritten
sorted.

⚠️ **The label is the ONLY thing a Big Screen Classics film gets.** The strand itself is
deliberately unsurfaced in the UI (`UNSURFACED` in `lib/screeningTags.ts`, decision #13) — no ☻,
no sticker, and it no longer passes the Highlights lens on its own. So deleting a `classic!`
prefill at review doesn't demote that film to a plainer badge, it removes it from the "Specials,
etc" view entirely. Trim on that basis: keep a label for anything genuinely worth surfacing, and
sharpen `classic!` into the real occasion ("40th anniversary") where you can. The raw tag still
rides in `showtimes.json` purely so this prefill can read it.

**Diff baselines come from git, not disk** (`lib/filmDiff.ts`) — by the time it reports, this
script has already overwritten `data/upcoming.json`, and `showtimes.json` may already have been
re-confirmed earlier in the same review loop.

**A `NOT FOUND` prints its Letterboxd search link and the exact override line to paste.** The
scraped year survives into the report precisely *because* the film didn't match (`aggregate` only
overwrites `year` on a hit), so the printed key is exact, not a guess.

It also runs a **second** scrape of `nextWeekDays()` and rewrites `data/upcoming.json` via
`selectUpcomingFilms` — films **not already playing this week** (a held-over film isn't news, even
if next week's run is a special format), new shorts dropped but short *specials* kept,
specials/labelled films sorted first. Hand-trimmed afterwards; not staged or promoted.

`scripts/confirm-batch.ts` copies staging → `data/showtimes.json`. Git stays manual.

## `lib/filmDiff.ts`

`diffFilms(previous, current, previousUpcoming)` → `{ added, gone, heldOver, previewedButAbsent }`,
keyed case/whitespace-insensitively like `groupByFilm` so IFI's ALL CAPS isn't a different film.
`previewedButAbsent` is the reverse check on the Next-week tease: a film promised last week that
never appeared.
